import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  getDoc, 
  Timestamp, 
  onSnapshot,
  serverTimestamp,
  CollectionReference,
  Query,
  DocumentData
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { v4 as uuidv4 } from 'uuid';
import { 
  RouteAlert, 
  AlertType, 
  Region, 
  RouteAlertInteraction, 
  calculateSafetyScore, 
  isAlertActive 
} from '../../models/RouteAlert';
import AuthService from '../AuthService';
import { SmartRoute } from '../../models/SmartRoute';
import { InterdictionCalculation } from '../../models/InterdictionCalculator';
import { createAlertVisualization, createSmartRouteVisualization, createInterdictionCalculationVisualization } from '../../models/RouteVisualization';
import CelestialIdMappingService from '../../services/CelestialIdMappingService';

// A cross-reference database to map database celestial IDs to current system celestial IDs
// This is needed because alerts from the database have completely different UUIDs than
// what's loaded in the current celestial system
const CELESTIAL_ID_CROSS_REFERENCE = {
  // Main celestial bodies
  'stanton': ['Stanton'],
  'hurston': ['Hurston'],
  'crusader': ['Crusader'],
  'arccorp': ['ArcCorp'],
  'microtech': ['microTech', 'Microtech'],
  
  // Moons of Hurston
  'ariel': ['Ariel'],
  'aberdeen': ['Aberdeen'],
  'magda': ['Magda'],
  'ita': ['Ita'],
  
  // Moons of Crusader
  'cellin': ['Cellin'],
  'daymar': ['Daymar'],
  'yela': ['Yela'],
  
  // Moons of ArcCorp
  'lyria': ['Lyria'],
  'wala': ['Wala'],
  
  // Moons of microTech
  'calliope': ['Calliope'],
  'clio': ['Clio'],
  'euterpe': ['Euterpe'],
};

export class RouteAlertService {
  private static instance: RouteAlertService;
  private alertsCache: Map<string, RouteAlert> = new Map();
  private smartRoutesCache: Map<string, SmartRoute> = new Map();
  private interdictionCalculationsCache: Map<string, InterdictionCalculation> = new Map();
  private celestialNameToIdMap: Map<string, string> = new Map();
  
  private constructor() {
    // Initialize cross-reference database
    this.initializeCelestialMappings();
  }
  
  /**
   * Initialize celestial ID mappings to help match alert IDs to system IDs
   */
  private initializeCelestialMappings(): void {
    // When the service is initialized, inject our cross-reference database
    for (const [key, nameVariants] of Object.entries(CELESTIAL_ID_CROSS_REFERENCE)) {
      nameVariants.forEach(name => {
        // We use the lowercase name as the key for case-insensitive matching
        this.celestialNameToIdMap.set(name.toLowerCase(), key);
      });
    }
    
    console.log(`[RouteAlertService] Initialized celestial mappings with ${this.celestialNameToIdMap.size} entries`);
  }
  
  /**
   * Add celestial ID mapping to CelestialIdMappingService when creating alert
   * This ensures alerts we create will have their IDs mapped to current system IDs
   * @param alert The alert that was just created
   */
  private addCelestialMappingsForAlert(alert: RouteAlert): void {
    try {
      // For origin
      if (alert.originId) {
        const originName = this.getCelestialNameById(alert.originId);
        if (originName) {
          CelestialIdMappingService.addAlertIdMapping(alert.originId, originName);
        }
      }
      
      // For destination
      if (alert.destinationId) {
        const destName = this.getCelestialNameById(alert.destinationId);
        if (destName) {
          CelestialIdMappingService.addAlertIdMapping(alert.destinationId, destName);
        }
      }
      
      // For location (if different from destination)
      if (alert.locationId && alert.locationId !== alert.destinationId) {
        const locName = this.getCelestialNameById(alert.locationId);
        if (locName) {
          CelestialIdMappingService.addAlertIdMapping(alert.locationId, locName);
        }
      }
    } catch (err) {
      console.warn("[RouteAlertService] Error adding celestial mappings:", err);
    }
  }
  
  /**
   * Get normalized celestial name for an ID
   */
  private getCelestialNameById(id: string): string | null {
    // Try to match the ID to a known celestial body
    for (const [key, nameVariants] of Object.entries(CELESTIAL_ID_CROSS_REFERENCE)) {
      // If the ID contains the key anywhere (case insensitive), return the first name variant
      if (id.toLowerCase().includes(key.toLowerCase()) && nameVariants.length > 0) {
        return nameVariants[0];
      }
    }
    return null;
  }
  
  /**
   * Process an alert to ensure it has proper mappings
   * @param alert The alert to process
   */
  private processAlertMappings(alert: RouteAlert): void {
    this.addCelestialMappingsForAlert(alert);
  }
  
  /**
   * Get the singleton instance of the RouteAlertService
   */
  public static getInstance(): RouteAlertService {
    if (!RouteAlertService.instance) {
      RouteAlertService.instance = new RouteAlertService();
    }
    return RouteAlertService.instance;
  }
  
  // --- Alert Methods ---
  
  /**
   * Create a new route alert
   */
  public async createAlert(alertData: Omit<RouteAlert, 'id' | 'timestamp' | 'authorId' | 'confirmations' | 'disputes' | 'safetyScore' | 'lastActivity'>): Promise<RouteAlert> {
    try {
      const currentUser = AuthService.getCurrentUser();
      
      if (!currentUser) {
        throw new Error('User must be authenticated to create an alert');
      }
      
      // Fix for PvP alerts: ensure all required fields have valid values
      // Use undefined instead of null to match the RouteAlert type
      const cleanedData = {
        ...alertData,
        // For PvP alerts, ensure we remove null values for Firestore
        // and use undefined which matches the RouteAlert type
        distanceTraveled: alertData.distanceTraveled === null ? undefined : alertData.distanceTraveled,
        distanceUnit: alertData.distanceUnit === null ? undefined : alertData.distanceUnit
      };
      
      console.log('Creating alert with cleaned data:', cleanedData);
      
      const newAlert: Omit<RouteAlert, 'id'> = {
        ...cleanedData,
        authorId: currentUser.id,
        authorName: currentUser.username || currentUser.email,
        timestamp: new Date(),
        lastActivity: new Date(),
        confirmations: 0,
        disputes: 0,
        safetyScore: 50 // Default neutral score
      };
      
      // Convert undefined values to null for Firestore
      // as Firestore doesn't accept undefined values
      const firestoreData = Object.fromEntries(
        Object.entries(newAlert).map(([key, value]) => 
          [key, value === undefined ? null : value]
        )
      );
      
      const docRef = await addDoc(collection(db, 'routeAlerts'), {
        ...firestoreData,
        timestamp: serverTimestamp(),
        lastActivity: serverTimestamp()
      });
      
      const alert = { id: docRef.id, ...newAlert };
      this.alertsCache.set(docRef.id, alert);
      
      this.processAlertMappings(alert);
      
      return alert;
    } catch (error) {
      console.error('Error creating route alert:', error);
      throw error;
    }
  }
  
  /**
   * Get all route alerts with optional filtering
   */
  public async getAlerts(filterOptions?: { region?: Region; shard?: number; type?: AlertType }): Promise<RouteAlert[]> {
    try {
      let q: CollectionReference<DocumentData> | Query<DocumentData> = collection(db, 'routeAlerts');
      
      // Add filters if provided
      if (filterOptions) {
        if (filterOptions.region) {
          q = query(q, where('region', '==', filterOptions.region));
        }
        
        if (filterOptions.shard !== undefined) {
          q = query(q, where('shard', '==', filterOptions.shard));
        }
        
        if (filterOptions.type) {
          q = query(q, where('type', '==', filterOptions.type));
        }
      }
      
      // Add ordering
      q = query(q, orderBy('timestamp', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const alerts: RouteAlert[] = [];
      
      querySnapshot.forEach((doc) => {
        const alertData = doc.data() as Partial<RouteAlert>;
        
        // Convert timestamps from Firestore
        const timestamp = alertData.timestamp instanceof Timestamp ? 
          alertData.timestamp.toDate() : new Date(alertData.timestamp as any);
          
        const lastActivity = alertData.lastActivity instanceof Timestamp ? 
          alertData.lastActivity.toDate() : new Date(alertData.lastActivity as any);
        
        // Ensure we have all required fields with proper types
        const alert: RouteAlert = {
          id: doc.id,
          type: alertData.type as AlertType,
          region: alertData.region as Region,
          shard: alertData.shard as number,
          originId: alertData.originId as string,
          destinationId: alertData.destinationId as string,
          locationId: alertData.locationId as string,
          position: alertData.position as any,
          distanceTraveled: alertData.distanceTraveled as number,
          distanceUnit: alertData.distanceUnit as any,
          timestamp,
          authorId: alertData.authorId as string,
          authorName: alertData.authorName as string,
          confirmations: alertData.confirmations as number || 0,
          disputes: alertData.disputes as number || 0,
          safetyScore: alertData.safetyScore as number || 50,
          lastActivity,
          nearestCelestialId: alertData.nearestCelestialId as string,
          nearestCelestialDistance: alertData.nearestCelestialDistance as number
        };
        
        // Apply alert ID mappings if needed
        this.processAlertMappings(alert);
        
        // Add to result set
        alerts.push(alert);
        
        // Update the cache
        this.alertsCache.set(doc.id, alert);
      });
      
      // Process alert mappings in bulk to ensure names are resolved
      this.processBulkAlertMappings(alerts);
      
      return alerts;
    } catch (error) {
      console.error('Error getting alerts:', error);
      throw error;
    }
  }
  
  /**
   * Process mappings for a batch of alerts
   * This helps build a more complete reference database 
   * @param alerts Array of alerts to process
   */
  private processBulkAlertMappings(alerts: RouteAlert[]): void {
    try {
      // Extract all unique celestial IDs from alerts
      const celestialIds = new Set<string>();
      
      alerts.forEach(alert => {
        if (alert.originId) celestialIds.add(alert.originId);
        if (alert.destinationId) celestialIds.add(alert.destinationId);
        if (alert.locationId) celestialIds.add(alert.locationId);
      });
      
      // Now process each unique ID
      celestialIds.forEach(id => {
        const name = this.getCelestialNameById(id);
        if (name) {
          CelestialIdMappingService.addAlertIdMapping(id, name);
        }
      });
      
      // Create additional mappings based on alert repetition
      // If the same celestial ID appears in multiple alerts, it's likely the same celestial body
      const idFrequency: {[id: string]: number} = {};
      
      alerts.forEach(alert => {
        if (alert.originId) idFrequency[alert.originId] = (idFrequency[alert.originId] || 0) + 1;
        if (alert.destinationId) idFrequency[alert.destinationId] = (idFrequency[alert.destinationId] || 0) + 1;
        if (alert.locationId) idFrequency[alert.locationId] = (idFrequency[alert.locationId] || 0) + 1;
      });
      
      // Log the most frequent IDs for debugging
      const sortedIds = Object.entries(idFrequency).sort((a, b) => b[1] - a[1]).slice(0, 10);
      console.log('[RouteAlertService] Most frequent celestial IDs:', sortedIds);
    } catch (err) {
      console.warn('[RouteAlertService] Error processing bulk alert mappings:', err);
    }
  }
  
  /**
   * Subscribe to real-time updates of route alerts
   */
  public subscribeToAlerts(
    callback: (alerts: RouteAlert[]) => void, 
    filterOptions?: { region?: Region; shard?: number; type?: AlertType }
  ): () => void {
    let q: CollectionReference<DocumentData> | Query<DocumentData> = collection(db, 'routeAlerts');
    
    // Add filters if provided
    if (filterOptions) {
      if (filterOptions.region) {
        q = query(q, where('region', '==', filterOptions.region));
      }
      
      if (filterOptions.shard !== undefined) {
        q = query(q, where('shard', '==', filterOptions.shard));
      }
      
      if (filterOptions.type) {
        q = query(q, where('type', '==', filterOptions.type));
      }
    }
    
    // Add ordering
    q = query(q, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const alerts: RouteAlert[] = [];
      
      querySnapshot.forEach((doc) => {
        const alertData = doc.data() as Partial<RouteAlert>;
        
        // Convert timestamps from Firestore
        const timestamp = alertData.timestamp instanceof Timestamp ? 
          alertData.timestamp.toDate() : new Date(alertData.timestamp as any);
          
        const lastActivity = alertData.lastActivity instanceof Timestamp ? 
          alertData.lastActivity.toDate() : new Date(alertData.lastActivity as any);
        
        // Ensure all required properties are properly typed
        const alert: RouteAlert = {
          id: doc.id,
          type: alertData.type as AlertType,
          region: alertData.region as Region,
          shard: alertData.shard as number,
          originId: alertData.originId as string,
          destinationId: alertData.destinationId as string,
          locationId: alertData.locationId as string,
          position: alertData.position as any,
          distanceTraveled: alertData.distanceTraveled as number,
          distanceUnit: alertData.distanceUnit as any,
          timestamp,
          authorId: alertData.authorId as string,
          authorName: alertData.authorName as string,
          confirmations: alertData.confirmations as number || 0,
          disputes: alertData.disputes as number || 0,
          safetyScore: alertData.safetyScore as number || 50,
          lastActivity,
          nearestCelestialId: alertData.nearestCelestialId as string,
          nearestCelestialDistance: alertData.nearestCelestialDistance as number
        };
        
        // Process alert mappings
        this.processAlertMappings(alert);
        
        // Add to result
        alerts.push(alert);
        
        // Update the cache
        this.alertsCache.set(doc.id, alert);
      });
      
      // Process all alert mappings in bulk
      this.processBulkAlertMappings(alerts);
      
      // Invoke the callback with the alerts
      callback(alerts);
    }, (error) => {
      console.error('Error subscribing to alerts:', error);
    });
    
    return unsubscribe;
  }
  
  /**
   * Get a single alert by id
   */
  public async getAlertById(alertId: string): Promise<RouteAlert | null> {
    // Check cache first
    if (this.alertsCache.has(alertId)) {
      return this.alertsCache.get(alertId)!;
    }
    
    try {
      const docRef = doc(db, 'routeAlerts', alertId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Convert timestamps from Firestore
        const timestamp = data.timestamp instanceof Timestamp ? 
          data.timestamp.toDate() : new Date(data.timestamp || Date.now());
          
        const lastActivity = data.lastActivity instanceof Timestamp ? 
          data.lastActivity.toDate() : new Date(data.lastActivity || Date.now());
        
        const alert: RouteAlert = {
          id: docSnap.id,
          type: data.type as AlertType,
          region: data.region as Region,
          shard: data.shard as number,
          originId: data.originId as string || '',
          destinationId: data.destinationId as string || '',
          locationId: data.locationId as string || '',
          position: data.position as any,
          distanceTraveled: data.distanceTraveled as number,
          distanceUnit: data.distanceUnit as any,
          timestamp,
          authorId: data.authorId as string,
          authorName: data.authorName as string,
          confirmations: data.confirmations as number || 0,
          disputes: data.disputes as number || 0,
          safetyScore: data.safetyScore as number || 50,
          lastActivity,
          nearestCelestialId: data.nearestCelestialId as string,
          nearestCelestialDistance: data.nearestCelestialDistance as number
        };
        
        this.alertsCache.set(alertId, alert);
        
        // Apply ID mappings
        this.processAlertMappings(alert);
        
        return alert;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting alert by ID:', error);
      throw error;
    }
  }
  
  /**
   * Update an alert
   */
  public async updateAlert(alertId: string, updates: Partial<RouteAlert>): Promise<RouteAlert> {
    try {
      const currentUser = AuthService.getCurrentUser();
      
      if (!currentUser) {
        throw new Error('User must be authenticated to update an alert');
      }
      
      const alert = await this.getAlertById(alertId);
      
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      // Check if user is the author of the alert
      if (alert.authorId !== currentUser.id && !AuthService.hasRole('admin')) {
        throw new Error('You do not have permission to update this alert');
      }
      
      // Update the alert
      const docRef = doc(db, 'routeAlerts', alertId);
      await updateDoc(docRef, {
        ...updates,
        lastActivity: serverTimestamp()
      });
      
      // Update cache
      const updatedAlert = { ...alert, ...updates, lastActivity: new Date() };
      this.alertsCache.set(alertId, updatedAlert);
      
      this.processAlertMappings(updatedAlert);
      
      return updatedAlert;
    } catch (error) {
      console.error('Error updating alert:', error);
      throw error;
    }
  }
  
  /**
   * Delete an alert
   */
  public async deleteAlert(alertId: string): Promise<void> {
    try {
      const currentUser = AuthService.getCurrentUser();
      
      if (!currentUser) {
        throw new Error('User must be authenticated to delete an alert');
      }
      
      const alert = await this.getAlertById(alertId);
      
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      // Check if user is the author of the alert
      if (alert.authorId !== currentUser.id && !AuthService.hasRole('admin')) {
        throw new Error('You do not have permission to delete this alert');
      }
      
      // Delete the alert
      await deleteDoc(doc(db, 'routeAlerts', alertId));
      
      // Remove from cache
      this.alertsCache.delete(alertId);
      
      // TODO: Delete related interactions
    } catch (error) {
      console.error('Error deleting alert:', error);
      throw error;
    }
  }
  
  /**
   * Confirm an alert (increases confirmations)
   */
  public async confirmAlert(alertId: string): Promise<RouteAlert> {
    try {
      const currentUser = AuthService.getCurrentUser();
      
      if (!currentUser) {
        throw new Error('User must be authenticated to confirm an alert');
      }
      
      const alert = await this.getAlertById(alertId);
      
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      // Check if user already interacted with this alert
      const existingInteraction = await this.getUserAlertInteraction(alertId, currentUser.id);
      
      if (existingInteraction) {
        if (existingInteraction.action === 'confirm') {
          throw new Error('You have already confirmed this alert');
        } else {
          // User is changing from dispute to confirm
          await this.updateAlertInteraction(existingInteraction.id, 'confirm');
          
          // Update alert stats
          const updatedAlert = await this.updateAlert(alertId, {
            confirmations: alert.confirmations + 1,
            disputes: alert.disputes - 1,
            safetyScore: calculateSafetyScore(alert.confirmations + 1, alert.disputes - 1)
          });
          
          return updatedAlert;
        }
      } else {
        // Create new interaction
        await this.createAlertInteraction(alertId, 'confirm');
        
        // Update alert stats
        const updatedAlert = await this.updateAlert(alertId, {
          confirmations: alert.confirmations + 1,
          safetyScore: calculateSafetyScore(alert.confirmations + 1, alert.disputes)
        });
        
        return updatedAlert;
      }
    } catch (error) {
      console.error('Error confirming alert:', error);
      throw error;
    }
  }
  
  /**
   * Dispute an alert (increases disputes)
   */
  public async disputeAlert(alertId: string): Promise<RouteAlert> {
    try {
      const currentUser = AuthService.getCurrentUser();
      
      if (!currentUser) {
        throw new Error('User must be authenticated to dispute an alert');
      }
      
      const alert = await this.getAlertById(alertId);
      
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      // Check if user already interacted with this alert
      const existingInteraction = await this.getUserAlertInteraction(alertId, currentUser.id);
      
      if (existingInteraction) {
        if (existingInteraction.action === 'dispute') {
          throw new Error('You have already disputed this alert');
        } else {
          // User is changing from confirm to dispute
          await this.updateAlertInteraction(existingInteraction.id, 'dispute');
          
          // Update alert stats
          const updatedAlert = await this.updateAlert(alertId, {
            confirmations: alert.confirmations - 1,
            disputes: alert.disputes + 1,
            safetyScore: calculateSafetyScore(alert.confirmations - 1, alert.disputes + 1)
          });
          
          return updatedAlert;
        }
      } else {
        // Create new interaction
        await this.createAlertInteraction(alertId, 'dispute');
        
        // Update alert stats
        const updatedAlert = await this.updateAlert(alertId, {
          disputes: alert.disputes + 1,
          safetyScore: calculateSafetyScore(alert.confirmations, alert.disputes + 1)
        });
        
        return updatedAlert;
      }
    } catch (error) {
      console.error('Error disputing alert:', error);
      throw error;
    }
  }
  
  /**
   * Get alerts created by a specific user
   */
  public async getUserAlerts(userId: string): Promise<RouteAlert[]> {
    try {
      const alertsQuery: Query<DocumentData> = query(
        collection(db, 'routeAlerts'),
        where('authorId', '==', userId),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(alertsQuery);
      const alerts: RouteAlert[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Convert timestamps from Firestore
        const timestamp = data.timestamp instanceof Timestamp ? 
          data.timestamp.toDate() : new Date(data.timestamp || Date.now());
          
        const lastActivity = data.lastActivity instanceof Timestamp ? 
          data.lastActivity.toDate() : new Date(data.lastActivity || Date.now());
        
        const alert: RouteAlert = {
          id: doc.id,
          type: data.type as AlertType,
          region: data.region as Region,
          shard: data.shard as number,
          originId: data.originId as string || '',
          destinationId: data.destinationId as string || '',
          locationId: data.locationId as string || '',
          position: data.position as any,
          distanceTraveled: data.distanceTraveled as number,
          distanceUnit: data.distanceUnit as any,
          timestamp,
          authorId: data.authorId as string,
          authorName: data.authorName as string,
          confirmations: data.confirmations as number || 0,
          disputes: data.disputes as number || 0,
          safetyScore: data.safetyScore as number || 50,
          lastActivity,
          nearestCelestialId: data.nearestCelestialId as string,
          nearestCelestialDistance: data.nearestCelestialDistance as number
        };
        
        // Process alert mappings
        this.processAlertMappings(alert);
        
        alerts.push(alert);
        this.alertsCache.set(doc.id, alert);
      });
      
      return alerts;
    } catch (error) {
      console.error('Error getting user alerts:', error);
      throw error;
    }
  }
  
  // --- Alert Interaction Methods ---
  
  /**
   * Create a new alert interaction
   */
  private async createAlertInteraction(alertId: string, action: 'confirm' | 'dispute'): Promise<RouteAlertInteraction> {
    try {
      const currentUser = AuthService.getCurrentUser();
      
      if (!currentUser) {
        throw new Error('User must be authenticated to interact with an alert');
      }
      
      const interaction: Omit<RouteAlertInteraction, 'id'> = {
        alertId,
        userId: currentUser.id,
        userName: currentUser.username || currentUser.email,
        action,
        timestamp: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'alertInteractions'), {
        ...interaction,
        timestamp: serverTimestamp()
      });
      
      return { id: docRef.id, ...interaction };
    } catch (error) {
      console.error('Error creating alert interaction:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing interaction
   */
  private async updateAlertInteraction(interactionId: string, newAction: 'confirm' | 'dispute'): Promise<void> {
    try {
      await updateDoc(doc(db, 'alertInteractions', interactionId), {
        action: newAction,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating alert interaction:', error);
      throw error;
    }
  }
  
  /**
   * Get a user's interaction with a specific alert
   */
  private async getUserAlertInteraction(alertId: string, userId: string): Promise<RouteAlertInteraction | null> {
    try {
      const interactionsQuery: Query<DocumentData> = query(
        collection(db, 'alertInteractions'),
        where('alertId', '==', alertId),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(interactionsQuery);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      const timestamp = data.timestamp instanceof Timestamp 
        ? data.timestamp.toDate() 
        : new Date(data.timestamp || Date.now());
        
      return {
        id: doc.id,
        alertId: data.alertId,
        userId: data.userId,
        userName: data.userName,
        action: data.action,
        timestamp
      };
    } catch (error) {
      console.error('Error getting user alert interaction:', error);
      throw error;
    }
  }
  
  /**
   * Get all interactions for a specific alert
   */
  public async getAlertInteractions(alertId: string): Promise<RouteAlertInteraction[]> {
    try {
      console.log(`Fetching interactions for alert ID: ${alertId}`);
      
      // Check if the alert exists first
      const alert = await this.getAlertById(alertId);
      if (!alert) {
        console.warn(`Alert ${alertId} not found when fetching interactions`);
        return [];
      }
      
      const interactionsQuery: Query<DocumentData> = query(
        collection(db, 'alertInteractions'),
        where('alertId', '==', alertId),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(interactionsQuery);
      const interactions: RouteAlertInteraction[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp instanceof Timestamp 
          ? data.timestamp.toDate() 
          : new Date(data.timestamp || Date.now());
          
        interactions.push({
          id: doc.id,
          alertId: data.alertId,
          userId: data.userId,
          userName: data.userName,
          action: data.action,
          timestamp
        });
      });
      
      return interactions;
    } catch (error) {
      console.error('Error getting alert interactions:', error);
      throw error;
    }
  }
  
  /**
   * Calculate user profile ranking based on their alert history
   */
  public async calculateUserRanking(userId: string): Promise<number> {
    try {
      // Get the user's 10 most recent alerts
      const alertsQuery: Query<DocumentData> = query(
        collection(db, 'routeAlerts'),
        where('authorId', '==', userId),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(alertsQuery);
      const alerts: RouteAlert[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Convert timestamps
        const timestamp = data.timestamp instanceof Timestamp 
          ? data.timestamp.toDate() 
          : new Date(data.timestamp || Date.now());
          
        const lastActivity = data.lastActivity instanceof Timestamp 
          ? data.lastActivity.toDate() 
          : new Date(data.lastActivity || Date.now());
          
        const alert: RouteAlert = {
          id: doc.id,
          type: data.type as AlertType,
          region: data.region as Region,
          shard: data.shard as number,
          originId: data.originId as string || '',
          destinationId: data.destinationId as string || '',
          locationId: data.locationId as string || '',
          position: data.position as any,
          distanceTraveled: data.distanceTraveled as number,
          distanceUnit: data.distanceUnit as any,
          timestamp,
          authorId: data.authorId as string,
          authorName: data.authorName as string,
          confirmations: data.confirmations as number || 0,
          disputes: data.disputes as number || 0,
          safetyScore: data.safetyScore as number || 50,
          lastActivity,
          nearestCelestialId: data.nearestCelestialId as string,
          nearestCelestialDistance: data.nearestCelestialDistance as number
        };
        
        alerts.push(alert);
      });
      
      // Take only the 10 most recent alerts
      const recentAlerts = alerts.slice(0, 10);
      
      if (recentAlerts.length === 0) {
        return 50; // Default neutral ranking
      }
      
      // Calculate average safety score
      const totalScore = recentAlerts.reduce((sum, alert) => sum + alert.safetyScore, 0);
      const averageScore = totalScore / recentAlerts.length;
      
      return Math.round(averageScore);
    } catch (error) {
      console.error('Error calculating user ranking:', error);
      throw error;
    }
  }
  
  /**
   * Update user profile ranking
   */
  public async updateUserRanking(userId: string): Promise<number> {
    try {
      const ranking = await this.calculateUserRanking(userId);
      
      // Update user profile with new ranking
      await AuthService.updateUserProfile(userId, { profileRanking: ranking });
      
      return ranking;
    } catch (error) {
      console.error('Error updating user ranking:', error);
      throw error;
    }
  }
  
  // --- Route Visualization Methods ---
  
  /**
   * Get route visualizations for all active alerts
   */
  public async getRouteVisualizations(): Promise<any[]> {
    try {
      const alerts = await this.getAlerts();
      const visualizations = alerts.map(alert => createAlertVisualization(alert));
      
      return visualizations;
    } catch (error) {
      console.error('Error getting route visualizations:', error);
      throw error;
    }
  }
  
  /**
   * Subscribe to route visualizations with real-time updates
   */
  public subscribeToRouteVisualizations(
    callback: (visualizations: any[]) => void, 
    filterOptions?: { region?: Region; shard?: number; type?: AlertType }
  ): () => void {
    const handleAlertsUpdate = (alerts: RouteAlert[]) => {
      const visualizations = alerts.map(alert => createAlertVisualization(alert));
      callback(visualizations);
    };
    
    return this.subscribeToAlerts(handleAlertsUpdate, filterOptions);
  }
  
  /**
   * Get a shareable URL for an alert, route, or calculation
   */
  public getShareableUrl(id: string, type: 'alert' | 'smartRoute' | 'interdictionCalculation'): string {
    const baseUrl = window.location.origin;
    
    switch (type) {
      case 'alert':
        return `${baseUrl}/alert/${id}`;
      case 'smartRoute':
        return `${baseUrl}/route/${id}`;
      case 'interdictionCalculation':
        return `${baseUrl}/interdiction/${id}`;
      default:
        return baseUrl;
    }
  }
}

// Export a default instance for easy imports
export default RouteAlertService.getInstance(); 