import { CelestialSystem } from '../stores/useAppStore';
import MappingDiscoveryService from './MappingDiscoveryService';

/**
 * Service to manage celestial ID mappings between different sources
 * 
 * This service handles the mapping between:
 * 1. Alert celestial IDs to celestial names
 * 2. Celestial names to current system IDs
 * 
 * The issue is that alerts have their own set of IDs which don't match 
 * the IDs in the current celestial system, causing alerts to not display properly.
 */
export class CelestialIdMappingService {
  private static instance: CelestialIdMappingService;
  
  // Map from alert IDs to names
  private alertIdToNameMap: Map<string, string> = new Map();
  
  // Map from names to current system IDs
  private nameToSystemIdMap: Map<string, string> = new Map();
  
  // Reverse map from current system IDs to names
  private systemIdToNameMap: Map<string, string> = new Map();
  
  // Cache of resolved alert IDs to system IDs
  private alertIdToSystemIdCache: Map<string, string> = new Map();
  
  // Known celestial body prefixes for UUIDs (e.g., first 8 chars)
  private knownUuidPrefixes: Map<string, string> = new Map();
  
  // Reference to the current celestial system
  private celestialSystem: CelestialSystem | null = null;
  
  private commonMappings: Record<string, string> = {};
  private dynamicMappings: Record<string, string> = {};
  private isInitialized = false;
  
  private storedIds: string[] = []; // Track keys separately
  
  private constructor() {
    this.alertIdToNameMap = new Map<string, string>();
    this.storedIds = [];
    this.initializeCommonMappings();
  }
  
  public static getInstance(): CelestialIdMappingService {
    if (!CelestialIdMappingService.instance) {
      CelestialIdMappingService.instance = new CelestialIdMappingService();
    }
    return CelestialIdMappingService.instance;
  }
  
  /**
   * Process celestial system data to build mappings
   */
  private processCelestialSystemData(system: CelestialSystem): void {
    // Clear existing maps to avoid stale data
    this.nameToSystemIdMap.clear();
    this.systemIdToNameMap.clear();
    
    // Build new maps
    system.celestialBodies.forEach(body => {
      // Skip empty or malformed data
      if (!body.id || !body.name) return;
      
      // Store mappings from name to system ID and vice versa
      const lowerName = body.name.toLowerCase();
      this.nameToSystemIdMap.set(lowerName, body.id);
      this.systemIdToNameMap.set(body.id, body.name);
      
      // If this is a long ID (UUID), also store the prefix for potential matching
      if (body.id.length >= 8) {
        this.knownUuidPrefixes.set(body.id.substring(0, 8), body.id);
      }
    });
    
    console.log(`[CelestialIdMappingService] Processed system data with ${system.celestialBodies.length} celestial bodies`);
  }
  
  /**
   * Initialize the mapping service
   * Can be called multiple times to refresh mappings
   */
  public initialize(celestialSystem?: CelestialSystem): void {
    console.log('[CelestialIdMappingService] Initializing mapping service');
    
    // Store the celestial system data if provided
    if (celestialSystem) {
      this.celestialSystem = celestialSystem;
      this.processCelestialSystemData(celestialSystem);
    }
    
    // Initialize common mappings for entities we know about
    this.initializeCommonMappings();
    
    // Register this mapping service with the discovery service
    if (MappingDiscoveryService.isInitialized && MappingDiscoveryService.isInitialized()) {
      // Since registerMappingService doesn't exist, we'll adapt our code to work without it
      console.log(`[CelestialIdMappingService] Discovered MappingDiscoveryService, but registerMappingService not available`);
    }
  }
  
  /**
   * Get the name for a celestial ID (alert ID or system ID)
   * @param id Celestial ID
   * @returns Celestial name or the ID if not found
   */
  public getNameFromId(id: string): string {
    if (!id) return 'Unknown';
    
    console.log(`[CelestialIdMappingService] Looking up name for ID: ${id}`);
    
    // Handle short IDs (like 3cbf39d0) which are first 8 chars of UUIDs
    if (id.length === 8 && /^[0-9a-f]{8}$/i.test(id)) {
      // Check if the short ID is directly mapped
      if (this.alertIdToNameMap.has(id)) {
        const name = this.alertIdToNameMap.get(id)!;
        console.log(`[CelestialIdMappingService] Found short ID mapping: ${id} → ${name}`);
        return name;
      }
      
      // Check if it's a prefix of a known long ID
      for (const [fullId, name] of this.alertIdToNameMap.entries()) {
        if (fullId.startsWith(id)) {
          console.log(`[CelestialIdMappingService] Matched short ID ${id} to full ID ${fullId} → ${name}`);
          // Cache this short ID for future lookups
          this.alertIdToNameMap.set(id, name);
          return name;
        }
      }
    }
    
    // First check direct name mappings
    if (this.alertIdToNameMap.has(id)) {
      const name = this.alertIdToNameMap.get(id)!;
      console.log(`[CelestialIdMappingService] Found in alertIdToNameMap: ${id} → ${name}`);
      return name;
    }
    
    // Try to check if this is a system ID that we can map directly
    if (this.systemIdToNameMap.has(id)) {
      const name = this.systemIdToNameMap.get(id)!;
      console.log(`[CelestialIdMappingService] Found in systemIdToNameMap: ${id} → ${name}`);
      return name;
    }
    
    // Try to convert alert ID to system ID first, then look up again
    const systemId = this.convertAlertIdToSystemId(id);
    if (systemId && systemId !== id) {
      const systemName = this.systemIdToNameMap.get(systemId);
      if (systemName) {
        console.log(`[CelestialIdMappingService] Converted to system ID: ${id} → ${systemId} → ${systemName}`);
        
        // Store this mapping for future lookups
        this.alertIdToNameMap.set(id, systemName);
        
        return systemName;
      }
    }
    
    // Try to extract a name from the ID using pattern analysis
    const extractedName = this.extractNameFromId(id);
    if (extractedName) {
      console.log(`[CelestialIdMappingService] Extracted name from ID: ${id} → ${extractedName}`);
      
      // Cache this extraction for future lookups
      this.alertIdToNameMap.set(id, extractedName);
      
      return extractedName;
    }
    
    // Try a more aggressive approach - check if any part of the ID contains a celestial name
    const celestialNames = [
      { key: 'stanton', name: 'Stanton' },
      { key: 'hurston', name: 'Hurston' },
      { key: 'crusader', name: 'Crusader' },
      { key: 'arccorp', name: 'ArcCorp' },
      { key: 'microtech', name: 'microTech' },
      { key: 'aberdeen', name: 'Aberdeen' },
      { key: 'daymar', name: 'Daymar' }
    ];
    
    const lowerCaseId = id.toLowerCase();
    for (const { key, name } of celestialNames) {
      if (lowerCaseId.includes(key)) {
        console.log(`[CelestialIdMappingService] Found name fragment in ID: ${id} → ${name}`);
        
        // Store this for future lookups
        this.alertIdToNameMap.set(id, name);
        
        return name;
      }
    }
    
    // No mapping found, return the original ID
    console.warn(`[CelestialIdMappingService] No name mapping found for ${id}, returning ID`);
    return id;
  }
  
  /**
   * Try to extract a name from an ID using various heuristics
   */
  private extractNameFromId(id: string): string | null {
    if (!id) return null;
    
    // Common celestial body names to check for in IDs, with proper capitalization
    const celestialNameMap: Record<string, string> = {
      'stanton': 'Stanton',
      'hurston': 'Hurston',
      'crusader': 'Crusader',
      'arccorp': 'ArcCorp', 
      'microtech': 'microTech',
      'ariel': 'Ariel',
      'aberdeen': 'Aberdeen',
      'magda': 'Magda',
      'ita': 'Ita',
      'cellin': 'Cellin',
      'daymar': 'Daymar',
      'yela': 'Yela',
      'lyria': 'Lyria',
      'wala': 'Wala',
      'calliope': 'Calliope',
      'clio': 'Clio',
      'euterpe': 'Euterpe'
    };
    
    // Check if ID contains any known celestial name
    const lowerId = id.toLowerCase();
    for (const [searchKey, properName] of Object.entries(celestialNameMap)) {
      if (lowerId.includes(searchKey)) {
        console.log(`[CelestialIdMappingService] Found name in ID: ${id} contains '${searchKey}' → '${properName}'`);
        return properName;
      }
    }
    
    // Check if the ID follows a name-uuid pattern
    // Pattern 1: name-uuid
    const nameUuidPattern = /^([a-z]+)[-_]([0-9a-f-]+)/i;
    const nameUuidMatch = id.match(nameUuidPattern);
    if (nameUuidMatch && nameUuidMatch[1] && nameUuidMatch[1].length > 2) {
      const extractedPart = nameUuidMatch[1];
      const capitalizedName = extractedPart.charAt(0).toUpperCase() + extractedPart.slice(1);
      
      // Check if the extracted name is in our celestial names list for proper capitalization
      const lowercaseExtracted = extractedPart.toLowerCase();
      if (lowercaseExtracted in celestialNameMap) {
        return celestialNameMap[lowercaseExtracted];
      }
      
      console.log(`[CelestialIdMappingService] Extracted name from pattern: ${id} → '${capitalizedName}'`);
      return capitalizedName;
    }
    
    // Check for other patterns
    const parts = id.split(/[-_\.]/); // Split by dash, underscore, or dot
    if (parts.length > 1) {
      for (const part of parts) {
        if (part.length > 2) {
          const lowercasePart = part.toLowerCase();
          
          // Check if this part matches a known celestial name
          if (lowercasePart in celestialNameMap) {
            return celestialNameMap[lowercasePart];
          }
          
          // Otherwise just capitalize it
          const capitalizedPart = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          console.log(`[CelestialIdMappingService] Potential name in part: ${id} → '${capitalizedPart}'`);
          return capitalizedPart;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Add an alert ID to name mapping
   * @param id Alert celestial ID
   * @param name Celestial name
   */
  public addAlertIdMapping(id: string, name: string): void {
    if (!id || !name) return;
    
    // Store the name mapping
    this.alertIdToNameMap.set(id, name);
    
    // If this is a UUID format, also store mapping for the short ID (first 8 chars)
    if (id.length > 8 && /^[0-9a-f-]{8}/.test(id)) {
      const shortId = id.substring(0, 8);
      this.alertIdToNameMap.set(shortId, name);
      console.log(`[CelestialIdMappingService] Added short ID mapping: ${shortId} → ${name}`);
    }
    
    // Check if we have a system ID for this name
    const systemId = this.getSystemIdForName(name);
    if (systemId) {
      // Cache this mapping for future
      this.alertIdToSystemIdCache.set(id, systemId);
      
      // Let the discovery service know about this successful mapping
      MappingDiscoveryService.recordSuccessfulUse(id, systemId);
    }
  }
  
  /**
   * Directly map a UUID format alert ID to a system ID
   * @param alertId Alert ID in UUID format
   * @param systemId Target system ID
   */
  public addDirectUuidMapping(alertId: string, systemId: string): void {
    if (!alertId || !systemId) return;
    
    // Skip self-mappings
    if (alertId === systemId) {
      console.warn(`[CelestialIdMappingService] Skipping self-mapping: ${alertId} -> ${systemId}`);
      return;
    }
    
    // Check if we already have a different mapping for this alert ID
    if (this.alertIdToSystemIdCache.has(alertId) && this.alertIdToSystemIdCache.get(alertId) !== systemId) {
      console.log(`[CelestialIdMappingService] Updating existing mapping: ${alertId} -> ${this.alertIdToSystemIdCache.get(alertId)} to ${systemId}`);
    }
    
    // Add to the cache
    this.alertIdToSystemIdCache.set(alertId, systemId);
    
    // Also add the name mapping if we know the name for this system ID
    if (this.systemIdToNameMap.has(systemId)) {
      const name = this.systemIdToNameMap.get(systemId)!;
      this.alertIdToNameMap.set(alertId, name);
      
      // If alertId is a long UUID, also add mapping for the short form (first 8 chars)
      if (alertId.length > 8) {
        const shortId = alertId.substring(0, 8);
        this.alertIdToNameMap.set(shortId, name);
      }
    }
    
    // Let the discovery service know about this successful mapping
    MappingDiscoveryService.recordSuccessfulUse(alertId, systemId);
  }
  
  /**
   * Record a successful mapping between an alert ID and a system ID
   * This is used by components that visually confirm a mapping is correct
   * @param alertId Alert ID in UUID format
   * @param systemId Target system ID
   */
  public recordSuccessfulUse(alertId: string, systemId: string): void {
    if (!alertId || !systemId) return;
    
    // Skip self-mappings
    if (alertId === systemId) return;
    
    // Add to our direct mapping cache
    this.alertIdToSystemIdCache.set(alertId, systemId);
    
    // If we know the name for this system ID, add a name mapping too
    if (this.systemIdToNameMap.has(systemId)) {
      const name = this.systemIdToNameMap.get(systemId)!;
      this.alertIdToNameMap.set(alertId, name);
      
      // If alertId is a long UUID, also add mapping for the short form (first 8 chars)
      if (alertId.length > 8) {
        const shortId = alertId.substring(0, 8);
        this.alertIdToNameMap.set(shortId, name);
      }
    }
    
    // Let the discovery service know about this mapping
    MappingDiscoveryService.recordSuccessfulUse(alertId, systemId);
    
    console.log(`[CelestialIdMappingService] Recorded successful mapping: ${alertId} -> ${systemId}`);
  }
  
  /**
   * Get the system ID for a celestial name
   * @param name The celestial name
   * @returns The system ID or null if not found
   */
  public getSystemIdForName(name: string): string | null {
    if (!name) return null;
    
    const lowercaseName = name.toLowerCase();
    
    // Check for direct name match
    if (this.nameToSystemIdMap.has(lowercaseName)) {
      return this.nameToSystemIdMap.get(lowercaseName)!;
    }
    
    // Try partial matches - exact start match first
    const matchingNames = Array.from(this.nameToSystemIdMap.keys())
      .filter(n => n.startsWith(lowercaseName) || lowercaseName.startsWith(n));
    
    if (matchingNames.length > 0) {
      // Use the first match
      return this.nameToSystemIdMap.get(matchingNames[0])!;
    }
    
    // Try even looser matching - contains
    const containsMatches = Array.from(this.nameToSystemIdMap.keys())
      .filter(n => n.includes(lowercaseName) || lowercaseName.includes(n));
    
    if (containsMatches.length > 0) {
      // Use the first match
      return this.nameToSystemIdMap.get(containsMatches[0])!;
    }
    
    return null;
  }
  
  /**
   * Convert an alert celestial ID to current system ID using all available mappings
   * @param alertId Alert celestial ID
   * @returns System celestial ID or null if not found
   */
  public convertAlertIdToSystemId(alertId: string): string | null {
    if (!alertId) return null;
    
    // Skip self-loops early
    if (this.systemIdToNameMap.has(alertId)) {
      return alertId; // Already a system ID
    }
    
    // Check if this is a short ID (first 8 chars of UUID)
    if (alertId.length === 8 && /^[0-9a-f]{8}$/i.test(alertId)) {
      // Try to find a full UUID that starts with this prefix
      const matchingSystemIds = Array.from(this.systemIdToNameMap.keys())
        .filter(id => id.startsWith(alertId));
      
      if (matchingSystemIds.length > 0) {
        console.log(`[CelestialIdMappingService] Found system ID matching short ID ${alertId}: ${matchingSystemIds[0]}`);
        return matchingSystemIds[0];
      }
      
      // Try to find a cached mapping that starts with this prefix
      const matchingAlertIds = Array.from(this.alertIdToSystemIdCache.keys())
        .filter(id => id.startsWith(alertId));
      
      if (matchingAlertIds.length > 0) {
        const systemId = this.alertIdToSystemIdCache.get(matchingAlertIds[0])!;
        console.log(`[CelestialIdMappingService] Found cached mapping for short ID ${alertId}: ${matchingAlertIds[0]} -> ${systemId}`);
        return systemId;
      }
    }
    
    // Check direct mapping first
    if (this.alertIdToSystemIdCache.has(alertId)) {
      return this.alertIdToSystemIdCache.get(alertId)!;
    }
    
    // Check if MappingDiscoveryService is ready to be used
    const isDiscoveryServiceReady = MappingDiscoveryService.isInitialized?.() ?? false;
    
    // Check if MappingDiscoveryService has a mapping
    let discoveryMapping = null;
    if (isDiscoveryServiceReady) {
      discoveryMapping = MappingDiscoveryService.discoverSystemId(alertId);
    }
    
    if (discoveryMapping && discoveryMapping !== alertId) {
      // Cache for future use
      this.alertIdToSystemIdCache.set(alertId, discoveryMapping);
      
      // Update name mapping if possible
      if (this.systemIdToNameMap.has(discoveryMapping)) {
        this.alertIdToNameMap.set(alertId, this.systemIdToNameMap.get(discoveryMapping)!);
      }
      
      return discoveryMapping;
    }
    
    // If we have a name for this alert ID, try to find a system ID for that name
    if (this.alertIdToNameMap.has(alertId)) {
      const name = this.alertIdToNameMap.get(alertId)!;
      const systemId = this.getSystemIdForName(name);
      
      if (systemId && systemId !== alertId) {
        // Cache for future use
        this.alertIdToSystemIdCache.set(alertId, systemId);
        return systemId;
      }
    }
    
    // Try to extract a name from the ID, then look up the system ID for that name
    const extractedName = this.extractNameFromId(alertId);
    if (extractedName) {
      const systemId = this.getSystemIdForName(extractedName);
      if (systemId) {
        // Cache this mapping for future lookups
        this.alertIdToSystemIdCache.set(alertId, systemId);
        return systemId;
      }
    }
    
    // No mapping found, return null
    return null;
  }
  
  /**
   * Find the ID for the Stanton system (main star system)
   * Used as a fallback when no specific location can be determined
   */
  public findStantonId(): string | null {
    // First try to find by name
    const stantonId = this.getSystemIdForName('stanton');
    if (stantonId) return stantonId;
    
    // If name lookup fails, try to find the root star
    if (this.celestialSystem) {
      // Look for the system's root ID or star
      if (this.celestialSystem.rootId) {
        return this.celestialSystem.rootId;
      }
      
      // Find the first celestial body of type 'star'
      const star = this.celestialSystem.celestialBodies.find(body => body.type === 'star');
      if (star) return star.id;
      
      // Last resort - return the first planet's ID
      if (this.celestialSystem.celestialBodies.length > 0) {
        return this.celestialSystem.celestialBodies[0].id;
      }
    }
    
    return null;
  }
  
  /**
   * Log current mappings for debugging
   */
  public logMappings(): void {
    console.log('[CelestialIdMappingService] Current Mappings');
    
    // Log alert ID to name map
    console.log('Alert ID to Name mappings:', Array.from(this.alertIdToNameMap.entries()).map(([id, name]) => ({
      id,
      name,
    })));
    
    // Log name to system ID map
    console.log('Name to System ID mappings:', Array.from(this.nameToSystemIdMap.entries()).map(([name, id]) => ({
      name,
      id,
    })));
    
    // Log resolved alert to system ID mappings
    console.log('Alert ID to System ID resolved mappings:', Array.from(this.alertIdToSystemIdCache.entries()).map(([alertId, systemId]) => ({
      alertId,
      systemId,
    })));
    
    // Log discovery service data
    console.log('Discovery Service data:', MappingDiscoveryService.exportMappingData());
  }
  
  /**
   * Attempt to find the current system's celestial body that corresponds to an alert ID
   * This uses multiple strategies to find a match
   * @param alertId The ID from an alert that needs to be mapped
   * @returns The corresponding ID in the current system or null if not found
   */
  public findMatchingCelestialId(alertId: string): string | null {
    return this.convertAlertIdToSystemId(alertId);
  }
  
  // Static wrapper for common operations
  public static getNameFromId(id: string): string {
    return CelestialIdMappingService.getInstance().getNameFromId(id);
  }
  
  public static convertAlertIdToSystemId(alertId: string): string | null {
    return CelestialIdMappingService.getInstance().convertAlertIdToSystemId(alertId);
  }
  
  public static addAlertIdMapping(id: string, name: string): void {
    CelestialIdMappingService.getInstance().addAlertIdMapping(id, name);
  }
  
  public static addDirectUuidMapping(alertId: string, systemId: string): void {
    CelestialIdMappingService.getInstance().addDirectUuidMapping(alertId, systemId);
  }
  
  public static recordSuccessfulUse(alertId: string, systemId: string): void {
    CelestialIdMappingService.getInstance().recordSuccessfulUse(alertId, systemId);
  }
  
  public static findMatchingCelestialId(alertId: string): string | null {
    return CelestialIdMappingService.getInstance().findMatchingCelestialId(alertId);
  }
  
  public static findStantonId(): string | null {
    return CelestialIdMappingService.getInstance().findStantonId();
  }
  
  public static logMappings(): void {
    CelestialIdMappingService.getInstance().logMappings();
  }
  
  /**
   * Initializes common ID-to-name mappings
   * This method is called during service initialization to set up known mappings
   */
  private initializeCommonMappings(): void {
    console.log("[CelestialIdMappingService] Initializing common mappings");
    
    // Common Stanton system celestial bodies
    const commonMappings: Record<string, string> = {
      // Stanton system
      '8af309da-4560-48df-8223-ddd02c016fb3': 'Stanton',
      // Planets
      '52a77839-4e55-4cdd-bdd3-ac7bb9626b03': 'Hurston',
      '20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5': 'Crusader',
      'a6e9252e-4c72-4e51-adbe-5e2222cc79c2': 'ArcCorp',
      'd6fc1705-6aba-4dbe-ba24-1ea80cb8d00d': 'microTech',
      
      // Specific areas
      'd191779b-ac62-4c84-90a5-7721aefb97c4': 'Hurston Area',
      'b3557a17-1d2d-4b7b-92ef-5e20445b10ea': 'MicroTech Orbit',
      '8e38ba99-f1cd-49df-bc4e-5ef9309b511f': 'ArcCorp City',
      
      // Emergency mappings for IDs found in console logs
      '3cbf39d0-a393-4c41-83c8-86561962e36b': 'Hurston',
      '90c3c7dc-02df-4f30-851c-dfb1a8876998': 'ArcCorp',
      
      // Short ID versions (first 8 chars)
      '3cbf39d0': 'Hurston',
      '90c3c7dc': 'ArcCorp',
      '52a77839': 'Hurston',
      '20f3f4d3': 'Crusader',
      'd6fc1705': 'microTech',
      '8af309da': 'Stanton',
      'a6e9252e': 'ArcCorp',
      'd191779b': 'Hurston Area',
      'b3557a17': 'MicroTech Orbit',
      '8e38ba99': 'ArcCorp City'
    };
    
    // Add all mappings using Object.keys instead of Object.entries to avoid downlevelIteration issues
    const keys = Object.keys(commonMappings);
    for (let i = 0; i < keys.length; i++) {
      const id = keys[i];
      const name = commonMappings[id];
      this.addAlertIdMapping(id, name);
      console.log(`[CelestialIdMappingService] Added common mapping: ${id} -> ${name}`);
    }
  }
  
  /**
   * Returns all celestial object names mapped to their UUIDs
   */
  public static getAllIdNameMap(): Record<string, string> {
    const instance = CelestialIdMappingService.getInstance();
    const result: Record<string, string> = {};
    
    // Convert map entries to a regular object manually to avoid iteration issues
    instance.alertIdToNameMap.forEach((value, key) => {
      result[key] = value;
    });
    
    return result;
  }

  /**
   * Gets all current celestial name mappings
   */
  getAllMappings(): Record<string, string> {
    // Create mappings object manually without using iteration methods
    const mappings: Record<string, string> = {};
    
    // Use forEach which is supported in ES5
    this.alertIdToNameMap.forEach((value, key) => {
      mappings[key] = value;
    });
    
    return mappings;
  }
  
  /**
   * Returns all stored IDs in the mapping service
   */
  public static getAllStoredIds(): string[] {
    const instance = CelestialIdMappingService.getInstance();
    const keys: string[] = [];
    
    // Use forEach to avoid ES2015 iteration issues
    instance.alertIdToNameMap.forEach((_, key) => {
      keys.push(key);
    });
    
    return keys;
  }

  // Update the existing set method to also maintain our array
  public set(alertId: string, celestialName: string): void {
    this.alertIdToNameMap.set(alertId, celestialName);
    if (!this.storedIds.includes(alertId)) {
      this.storedIds.push(alertId);
    }
  }
}

// Export singleton instance
export default CelestialIdMappingService.getInstance(); 