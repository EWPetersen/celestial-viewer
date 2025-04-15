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
class CelestialIdMappingService {
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
  
  private constructor() {}
  
  public static getInstance(): CelestialIdMappingService {
    if (!CelestialIdMappingService.instance) {
      CelestialIdMappingService.instance = new CelestialIdMappingService();
    }
    return CelestialIdMappingService.instance;
  }
  
  /**
   * Initialize with a celestial system 
   * This sets up the name mappings from the system ID to names
   * @param system The celestial system with bodies 
   */
  public initialize(system: CelestialSystem): void {
    this.celestialSystem = system;
    
    // Clear existing maps to avoid stale data
    this.nameToSystemIdMap.clear();
    this.systemIdToNameMap.clear();
    
    // Initialize common mappings first
    this.initializeCommonMappings();
    
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
    
    console.log(`[CelestialIdMappingService] Initialized with ${system.celestialBodies.length} celestial bodies`);
  }
  
  /**
   * Get the name for a celestial ID (alert ID or system ID)
   * @param id Celestial ID
   * @returns Celestial name or the ID if not found
   */
  public getNameFromId(id: string): string {
    if (!id) return 'Unknown';
    
    console.log(`[CelestialIdMappingService] Looking up name for ID: ${id}`);
    
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
   * Initialize common ID mappings for known alert IDs
   * This helps with resolving names for common IDs seen in the system
   */
  public initializeCommonMappings(): void {
    console.log('[CelestialIdMappingService] Initializing common ID mappings');
    
    // Track IDs we've seen in logs that need mappings
    const commonMappings: Record<string, string> = {
      // IDs from the console output
      '4acc58f2-8286-441a-b585-ddd59cbf1530': 'Hurston',
      '33f09d8d-4412-4582-a5ff-4627bc1cba1d': 'Crusader',
      '7005dd64-73fd-462e-b677-d5d21eddf2ca': 'ArcCorp',
      '33c532f0-f0c2-4717-9052-005b0797a6c8': 'microTech',
      '041ce610-a269-4a32-9722-89e9fa34b43e': 'Stanton',
      '5cc84896-45e8-41e4-b173-4ddfbcf0d0cc': 'Aberdeen',
      '4c220bba-832f-46d9-a8f7-32cbfb5bf1e8': 'Daymar'
    };
    
    // Add these to our mappings
    Object.entries(commonMappings).forEach(([id, name]) => {
      this.alertIdToNameMap.set(id, name);
      console.log(`[CelestialIdMappingService] Added common mapping: ${id} → ${name}`);
    });
  }
  
  public static initializeCommonMappings(): void {
    CelestialIdMappingService.getInstance().initializeCommonMappings();
  }
}

// Export singleton instance
export default CelestialIdMappingService.getInstance(); 