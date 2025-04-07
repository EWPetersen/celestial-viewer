import { db } from '../../config/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp,
  arrayUnion,
  arrayRemove,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import AuthService from '../AuthService';
import { 
  RouteAlert, 
  RouteAlertCreationData, 
  calculateDistance, 
  convertToMeters 
} from '../../models/RouteAlert';
import useAppStore from '../../stores/useAppStore';

export class RouteAlertService {
  private static instance: RouteAlertService;
  private readonly COLLECTION_NAME = 'routeAlerts';
  
  private constructor() {}
  
  /**
   * Get the singleton instance of RouteAlertService
   */
  public static getInstance(): RouteAlertService {
    if (!RouteAlertService.instance) {
      RouteAlertService.instance = new RouteAlertService();
    }
    return RouteAlertService.instance;
  }
  
  /**
   * Convert a Firestore document to a RouteAlert
   */
  private convertDocToRouteAlert(doc: QueryDocumentSnapshot<DocumentData>): RouteAlert {
    const data = doc.data();
    return {
      id: doc.id,
      createdAt: data.createdAt?.toMillis() || Date.now(),
      updatedAt: data.updatedAt?.toMillis() || Date.now(),
      authorId: data.authorId,
      authorName: data.authorName,
      region: data.region,
      shard: data.shard,
      originCelestialBodyId: data.originCelestialBodyId,
      originCelestialBodyName: data.originCelestialBodyName,
      destinationCelestialBodyId: data.destinationCelestialBodyId,
      destinationCelestialBodyName: data.destinationCelestialBodyName,
      distance: data.distance,
      distanceUnit: data.distanceUnit,
      absoluteDistance: data.absoluteDistance,
      safetyScore: data.safetyScore || 0,
      confirmations: data.confirmations || [],
      disputes: data.disputes || []
    };
  }
  
  /**
   * Get a celestial body by ID
   */
  private getCelestialBodyById(id: string) {
    const { celestialSystem } = useAppStore.getState();
    return celestialSystem?.celestialBodies.find(body => body.id === id);
  }
  
  /**
   * Validate route alert data
   */
  private validateRouteAlertData(data: RouteAlertCreationData): { isValid: boolean; errorMessage?: string } {
    // Make sure user is authenticated
    if (!AuthService.isUserAuthenticated() || AuthService.isGuest()) {
      return { isValid: false, errorMessage: 'You must be logged in to create a route alert' };
    }
    
    // Check if the celestial bodies exist
    const originBody = this.getCelestialBodyById(data.originCelestialBodyId);
    const destinationBody = this.getCelestialBodyById(data.destinationCelestialBodyId);
    
    if (!originBody) {
      return { isValid: false, errorMessage: 'Origin celestial body not found' };
    }
    
    if (!destinationBody) {
      return { isValid: false, errorMessage: 'Destination celestial body not found' };
    }
    
    // Validate distance is numeric and positive
    if (isNaN(data.distance) || data.distance <= 0) {
      return { isValid: false, errorMessage: 'Distance must be a positive number' };
    }
    
    // Calculate absolute distance between origin and destination
    const absoluteDistance = calculateDistance(originBody.position, destinationBody.position);
    const enteredDistanceInMeters = convertToMeters(data.distance, data.distanceUnit);
    
    // Ensure entered distance is not greater than calculated absolute distance
    if (enteredDistanceInMeters > absoluteDistance) {
      return { 
        isValid: false, 
        errorMessage: `Entered distance cannot be greater than the direct distance between bodies (${absoluteDistance}m)` 
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * Create a new route alert
   */
  public async createRouteAlert(data: RouteAlertCreationData): Promise<{ success: boolean; alert?: RouteAlert; error?: string }> {
    try {
      // Validate data
      const validation = this.validateRouteAlertData(data);
      if (!validation.isValid) {
        return { success: false, error: validation.errorMessage };
      }
      
      const currentUser = AuthService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }
      
      // Get celestial body names
      const originBody = this.getCelestialBodyById(data.originCelestialBodyId);
      const destinationBody = this.getCelestialBodyById(data.destinationCelestialBodyId);
      
      if (!originBody || !destinationBody) {
        return { success: false, error: 'Celestial bodies not found' };
      }
      
      // Calculate absolute distance
      const absoluteDistance = calculateDistance(originBody.position, destinationBody.position);
      
      // Create the alert object
      const now = Timestamp.now();
      const routeAlert: Omit<RouteAlert, 'id'> = {
        createdAt: now.toMillis(),
        updatedAt: now.toMillis(),
        authorId: currentUser.id,
        authorName: currentUser.username,
        
        region: data.region,
        shard: data.shard,
        originCelestialBodyId: data.originCelestialBodyId,
        originCelestialBodyName: originBody.name,
        destinationCelestialBodyId: data.destinationCelestialBodyId,
        destinationCelestialBodyName: destinationBody.name,
        
        distance: data.distance,
        distanceUnit: data.distanceUnit,
        
        absoluteDistance,
        
        safetyScore: 0,
        
        confirmations: [],
        disputes: []
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...routeAlert,
        createdAt: now,
        updatedAt: now
      });
      
      return { 
        success: true, 
        alert: { 
          ...routeAlert, 
          id: docRef.id 
        } 
      };
    } catch (error: any) {
      console.error('Error creating route alert:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create route alert' 
      };
    }
  }
  
  /**
   * Get all route alerts
   */
  public async getRouteAlerts(): Promise<RouteAlert[]> {
    try {
      console.log('RouteAlertService: Getting all route alerts');
      
      // Check if user has Firestore access
      if (!AuthService.isUserAuthenticated() && !AuthService.isGuest()) {
        console.warn('RouteAlertService: User is not authenticated. Returning empty alerts array.');
        return [];
      }
      
      const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      console.log('RouteAlertService: Got query snapshot with', querySnapshot.docs.length, 'docs');
      return querySnapshot.docs.map(doc => this.convertDocToRouteAlert(doc));
    } catch (error: any) {
      console.error('RouteAlertService: Error getting route alerts:', error);
      
      // Check for specific Firestore errors
      if (error.code === 'permission-denied') {
        console.error('RouteAlertService: Firestore permission denied. Check security rules.');
      } else if (error.code?.includes('unavailable')) {
        console.error('RouteAlertService: Firestore unavailable. Check network connection.');
      }
      
      return [];
    }
  }
  
  /**
   * Get route alerts by celestial body ID
   */
  public async getRouteAlertsByCelestialBody(celestialBodyId: string): Promise<RouteAlert[]> {
    try {
      console.log('RouteAlertService: Getting route alerts for celestial body:', celestialBodyId);
      
      const q1 = query(
        collection(db, this.COLLECTION_NAME),
        where('originCelestialBodyId', '==', celestialBodyId)
      );
      
      const q2 = query(
        collection(db, this.COLLECTION_NAME),
        where('destinationCelestialBodyId', '==', celestialBodyId)
      );
      
      console.log('RouteAlertService: Executing queries');
      const [originSnap, destSnap] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      console.log('RouteAlertService: Got query snapshots with', 
        originSnap.docs.length, 'origin docs and', 
        destSnap.docs.length, 'destination docs'
      );
      
      // Combine results and remove duplicates
      const alerts: {[key: string]: RouteAlert} = {};
      
      originSnap.docs.forEach(doc => {
        alerts[doc.id] = this.convertDocToRouteAlert(doc);
      });
      
      destSnap.docs.forEach(doc => {
        alerts[doc.id] = this.convertDocToRouteAlert(doc);
      });
      
      return Object.values(alerts);
    } catch (error) {
      console.error('RouteAlertService: Error getting route alerts by celestial body:', error);
      return [];
    }
  }
  
  /**
   * Get a route alert by ID
   */
  public async getRouteAlertById(id: string): Promise<RouteAlert | null> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return this.convertDocToRouteAlert(docSnap as QueryDocumentSnapshot<DocumentData>);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting route alert by ID:', error);
      return null;
    }
  }
  
  /**
   * Confirm a route alert
   */
  public async confirmRouteAlert(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = AuthService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }
      
      const docRef = doc(db, this.COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return { success: false, error: 'Route alert not found' };
      }
      
      const alertData = docSnap.data();
      
      // Check if user has already confirmed
      if (alertData.confirmations && alertData.confirmations.includes(currentUser.id)) {
        return { success: false, error: 'You have already confirmed this alert' };
      }
      
      // Check if user has disputed and remove from disputes if necessary
      const safetyScoreAdjustment = alertData.disputes && alertData.disputes.includes(currentUser.id) ? 2 : 1;
      
      await updateDoc(docRef, {
        confirmations: arrayUnion(currentUser.id),
        disputes: arrayRemove(currentUser.id),
        safetyScore: (alertData.safetyScore || 0) + safetyScoreAdjustment,
        updatedAt: Timestamp.now()
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('Error confirming route alert:', error);
      return { success: false, error: error.message || 'Failed to confirm route alert' };
    }
  }
  
  /**
   * Dispute a route alert
   */
  public async disputeRouteAlert(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = AuthService.getCurrentUser();
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }
      
      const docRef = doc(db, this.COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return { success: false, error: 'Route alert not found' };
      }
      
      const alertData = docSnap.data();
      
      // Check if user has already disputed
      if (alertData.disputes && alertData.disputes.includes(currentUser.id)) {
        return { success: false, error: 'You have already disputed this alert' };
      }
      
      // Check if user has confirmed and remove from confirmations if necessary
      const safetyScoreAdjustment = alertData.confirmations && alertData.confirmations.includes(currentUser.id) ? -2 : -1;
      
      await updateDoc(docRef, {
        disputes: arrayUnion(currentUser.id),
        confirmations: arrayRemove(currentUser.id),
        safetyScore: (alertData.safetyScore || 0) + safetyScoreAdjustment,
        updatedAt: Timestamp.now()
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('Error disputing route alert:', error);
      return { success: false, error: error.message || 'Failed to dispute route alert' };
    }
  }
}

// Export a default instance for easy imports
export default RouteAlertService.getInstance(); 