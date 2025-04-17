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
    
    // Initialize mappings from new data format to alert UUIDs 
    this.initializeFromNewDataFormat(system);
    
    console.log("[CelestialIdMappingService] Processed celestial system data - mappings updated");
  }
  
  /**
   * Initialize mappings from new data format IDs to alert UUIDs
   * This is crucial for handling the transition from UUID-based IDs to the new format
   */
  private initializeFromNewDataFormat(system: CelestialSystem): void {
    // Map from new format IDs to the UUIDs used in alerts
    const newToOldIdMap: Record<string, string> = {
      // Main planets and moons - map from new format to old UUIDs
      'stantonstar': '8af309da-4560-48df-8223-ddd02c016fb3', // Stanton
      'stanton1': '52a77839-4e55-4cdd-bdd3-ac7bb9626b03',   // Hurston
      'stanton2': '20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5',   // Crusader
      'stanton3': 'a6e9252e-4c72-4e51-adbe-5e2222cc79c2',   // ArcCorp
      'stanton4': 'd6fc1705-6aba-4dbe-ba24-1ea80cb8d00d',   // microTech
      
      // Problematic IDs from error logs
      'stanton1a': '6a5236af-9a91-487e-af3b-697c99687c2f',  // Aberdeen mentioned in error logs
      'stanton1b': 'b30cd9bd-51d7-4f7b-b309-402642419825',  // Arial mentioned in error logs
      
      // Add more mappings for other moons and locations
      'stanton1c': '3cbf39d0-a393-4c41-83c8-86561962e36b',  // Ita
      'stanton1d': '739a4be5-9894-4e42-9c72-a5e93cd06418',  // Magda
      
      'stanton2a': '01ae6c82-f5e3-46f4-9f7d-7c89d25fb917',  // Cellin
      'stanton2b': '9fa3f08c-eaed-4499-92a5-bf8cdf50a5c2',  // Daymar
      'stanton2c': '1a14c03b-b3c4-4e9a-98db-33adc819111d',  // Yela
      
      'stanton3a': '8ce5dd22-ce2b-46c7-8d8c-f55c46a417fc',  // Lyria
      'stanton3b': 'a9f22d6d-7874-4519-9d46-7d7da9882317',  // Wala
      
      'stanton4a': '5b8b4b94-db0f-4847-8e2f-f26b79d5c6c8',  // Calliope
      'stanton4b': 'beac3905-a16c-4e79-a9d3-5e6db1a0e13b',  // Clio
      'stanton4c': 'cf6f6a5d-7467-4e9c-8c88-e3e5dd89b61f',  // Euterpe
      
      // Add more as needed for Lagrange points and other entities
      'stanton1_l1': 'd191779b-ac62-4c84-90a5-7721aefb97c4', 
      'stanton4_l1': 'b3557a17-1d2d-4b7b-92ef-5e20445b10ea'
    };
    
    // Add these mappings to our cache
    Object.entries(newToOldIdMap).forEach(([newId, oldId]) => {
      // Find if this entity exists in the current system
      const entity = system.celestialBodies.find(body => body.id === newId);
      if (entity) {
        // Get the entity name for logging
        const entityName = entity.name;
        
        // Add direct mapping from old UUID to new ID
        this.addDirectUuidMapping(oldId, newId);
        
        // Also map the entity name to both IDs
        this.alertIdToNameMap.set(oldId, entityName);
        this.alertIdToNameMap.set(newId, entityName);
        
        // Debug
        console.log(`[CelestialIdMappingService] Added mapping: ${oldId} -> ${newId} (${entityName})`);
      }
    });
    
    console.log(`[CelestialIdMappingService] Initialized ${Object.keys(newToOldIdMap).length} mappings from new format to alert UUIDs`);
  }
  
  /**
   * Initialize the mapping service
   * Can be called multiple times to refresh mappings
   */
  public initialize(celestialSystem?: CelestialSystem): void {
    // Store the celestial system data if provided
    if (celestialSystem) {
      this.celestialSystem = celestialSystem;
      this.processCelestialSystemData(celestialSystem);
    }
    
    // Initialize common mappings for entities we know about
    this.initializeCommonMappings();
    
    this.isInitialized = true;
    console.log("[CelestialIdMappingService] Initialization complete");
  }
  
  /**
   * Get the name for a celestial ID (alert ID or system ID)
   * @param id Celestial ID
   * @returns Celestial name or the ID if not found
   */
  public getNameFromId(id: string): string {
    if (!id) return 'Unknown';
    
    // Handle short IDs (like 3cbf39d0) which are first 8 chars of UUIDs
    if (id.length === 8 && /^[0-9a-f]{8}$/i.test(id)) {
      // Check if the short ID is directly mapped
      if (this.alertIdToNameMap.has(id)) {
        const name = this.alertIdToNameMap.get(id)!;
        return name;
      }
      
      // Check if it's a prefix of a known long ID
      for (const [fullId, name] of Array.from(this.alertIdToNameMap.entries())) {
        if (fullId.startsWith(id)) {
          // Cache this short ID for future lookups
          this.alertIdToNameMap.set(id, name);
          return name;
        }
      }
    }
    
    // First check direct name mappings
    if (this.alertIdToNameMap.has(id)) {
      const name = this.alertIdToNameMap.get(id)!;
      return name;
    }
    
    // Try to check if this is a system ID that we can map directly
    if (this.systemIdToNameMap.has(id)) {
      const name = this.systemIdToNameMap.get(id)!;
      return name;
    }
    
    // Try to convert alert ID to system ID first, then look up again
    const systemId = this.convertAlertIdToSystemId(id);
    if (systemId && systemId !== id) {
      const systemName = this.systemIdToNameMap.get(systemId);
      if (systemName) {
        // Store this mapping for future lookups
        this.alertIdToNameMap.set(id, systemName);
        
        return systemName;
      }
    }
    
    // Try to extract a name from the ID using pattern analysis
    const extractedName = this.extractNameFromId(id);
    if (extractedName) {
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
        // Store this for future lookups
        this.alertIdToNameMap.set(id, name);
        
        return name;
      }
    }
    
    // No mapping found, return the original ID
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
      return;
    }
    
    // Check if we already have a different mapping for this alert ID
    if (this.alertIdToSystemIdCache.has(alertId) && this.alertIdToSystemIdCache.get(alertId) !== systemId) {
      this.alertIdToSystemIdCache.set(alertId, systemId);
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
      // If it's already a valid system ID, return it directly
      console.log(`[CelestialIdMappingService] ${alertId} is already a valid system ID`);
      return alertId;
    }
    
    // Check direct mapping first (this includes our new-to-old ID mappings)
    if (this.alertIdToSystemIdCache.has(alertId)) {
      const mappedId = this.alertIdToSystemIdCache.get(alertId)!;
      console.log(`[CelestialIdMappingService] Found direct mapping: ${alertId} -> ${mappedId}`);
      return mappedId;
    }
    
    // Check if this is a UUID format that needs to be mapped to new format
    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alertId);
    if (isUuidFormat) {
      console.log(`[CelestialIdMappingService] ${alertId} is in UUID format, looking for mapping to new format ID`);
      
      // Look for entity with this ID in our celestial system
      // This should handle the case of UUIDs from alerts that need to map to new format IDs
      const celestialBody = this.celestialSystem?.celestialBodies.find(
        body => body.id === alertId || 
               // Also try to match against display IDs and legacy IDs if available
               (body as any).legacyId === alertId
      );
      
      if (celestialBody) {
        console.log(`[CelestialIdMappingService] Found celestial body with UUID in system: ${alertId} (${celestialBody.name})`);
        return celestialBody.id;
      }
    }
    
    // Check if this is a new format ID (shorter, more readable)
    const isNewFormatId = alertId.includes('stanton') || alertId === 'stantonstar';
    if (isNewFormatId) {
      console.log(`[CelestialIdMappingService] ${alertId} appears to be in new format`);
      
      // If it's a new format ID but not found in our system (unlikely), try to map to a UUID
      // This branch should rarely be taken, as we've already checked if it's a valid system ID
      
      // Scan our mappings for new-to-old mappings
      const matchingEntries = Array.from(this.alertIdToSystemIdCache.entries())
        .filter(([alertUuid, systemId]) => systemId === alertId);
      
      if (matchingEntries.length > 0) {
        const [oldUuid, newId] = matchingEntries[0];
        console.log(`[CelestialIdMappingService] Found reverse mapping: ${alertId} (new) -> ${oldUuid} (old UUID)`);
        
        // Check if this old UUID is in our system
        const celestialBody = this.celestialSystem?.celestialBodies.find(
          body => body.id === oldUuid
        );
        
        if (celestialBody) {
          console.log(`[CelestialIdMappingService] Found body with old UUID: ${oldUuid} (${celestialBody.name})`);
          return oldUuid;
        } else {
          // Return the new format ID as-is if we can't find the old UUID in our system
          return alertId;
        }
      }
    }
    
    // Check if this is a short ID (first 8 chars of UUID)
    if (alertId.length === 8 && /^[0-9a-f]{8}$/i.test(alertId)) {
      console.log(`[CelestialIdMappingService] Handling short ID: ${alertId}`);
      
      // Try to find a full UUID that starts with this prefix
      const matchingSystemIds = Array.from(this.systemIdToNameMap.keys())
        .filter(id => id.startsWith(alertId));
      
      if (matchingSystemIds.length > 0) {
        console.log(`[CelestialIdMappingService] Found matching system ID for short ID ${alertId}: ${matchingSystemIds[0]}`);
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
    
    // Try the mapping discovery service if available
    const isDiscoveryServiceReady = MappingDiscoveryService.isInitialized?.() ?? false;
    if (isDiscoveryServiceReady) {
      const discoveryMapping = MappingDiscoveryService.discoverSystemId(alertId);
      
      if (discoveryMapping && discoveryMapping !== alertId) {
        console.log(`[CelestialIdMappingService] Discovery service found mapping: ${alertId} -> ${discoveryMapping}`);
        
        // Cache for future use
        this.alertIdToSystemIdCache.set(alertId, discoveryMapping);
        
        // Update name mapping if possible
        if (this.systemIdToNameMap.has(discoveryMapping)) {
          this.alertIdToNameMap.set(alertId, this.systemIdToNameMap.get(discoveryMapping)!);
        }
        
        return discoveryMapping;
      }
    }
    
    // If we have a name for this alert ID, try to find a system ID for that name
    if (this.alertIdToNameMap.has(alertId)) {
      const name = this.alertIdToNameMap.get(alertId)!;
      console.log(`[CelestialIdMappingService] Trying to find system ID for name: ${name} (from alert ID ${alertId})`);
      
      const systemId = this.getSystemIdForName(name);
      
      if (systemId && systemId !== alertId) {
        console.log(`[CelestialIdMappingService] Found system ID by name: ${name} -> ${systemId}`);
        
        // Cache for future use
        this.alertIdToSystemIdCache.set(alertId, systemId);
        return systemId;
      }
    }
    
    // Try to extract a name from the ID, then look up the system ID for that name
    const extractedName = this.extractNameFromId(alertId);
    if (extractedName) {
      console.log(`[CelestialIdMappingService] Extracted name from ID ${alertId}: ${extractedName}`);
      
      const systemId = this.getSystemIdForName(extractedName);
      if (systemId) {
        console.log(`[CelestialIdMappingService] Found system ID by extracted name: ${extractedName} -> ${systemId}`);
        
        // Cache this mapping for future lookups
        this.alertIdToSystemIdCache.set(alertId, systemId);
        return systemId;
      }
    }
    
    // Emergency fallback - add the IDs from console errors
    if (alertId === '6a5236af-9a91-487e-af3b-697c99687c2f') {
      const newId = 'stanton1a'; // Aberdeen
      console.log(`[CelestialIdMappingService] EMERGENCY FALLBACK: Mapping ${alertId} to ${newId} (Aberdeen)`);
      this.alertIdToSystemIdCache.set(alertId, newId);
      return newId;
    } else if (alertId === 'b30cd9bd-51d7-4f7b-b309-402642419825') {
      const newId = 'stanton1b'; // Arial
      console.log(`[CelestialIdMappingService] EMERGENCY FALLBACK: Mapping ${alertId} to ${newId} (Arial)`);
      this.alertIdToSystemIdCache.set(alertId, newId);
      return newId;
    }
    
    console.log(`[CelestialIdMappingService] No mapping found for ID: ${alertId}`);
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
   * This method is now a no-op to avoid console logging
   */
  public logMappings(): void {
    // No longer log to console
    return;
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
    // Common Stanton system celestial bodies
    const commonMappings: Record<string, string> = {
      // Stanton system
      '8af309da-4560-48df-8223-ddd02c016fb3': 'Stanton',
      // Planets
      '52a77839-4e55-4cdd-bdd3-ac7bb9626b03': 'Hurston',
      '20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5': 'Crusader',
      'a6e9252e-4c72-4e51-adbe-5e2222cc79c2': 'ArcCorp',
      'd6fc1705-6aba-4dbe-ba24-1ea80cb8d00d': 'microTech',
      
      // Moons and problem IDs from console errors
      '6a5236af-9a91-487e-af3b-697c99687c2f': 'Aberdeen', // From error logs
      'b30cd9bd-51d7-4f7b-b309-402642419825': 'Arial',    // From error logs
      
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
      '8e38ba99': 'ArcCorp City',
      '6a5236af': 'Aberdeen', // Short ID for Aberdeen
      'b30cd9bd': 'Arial'     // Short ID for Arial
    };
    
    // Direct mappings to the new format IDs
    const uuidToNewIdMappings: Record<string, string> = {
      // Main planets and star
      '8af309da-4560-48df-8223-ddd02c016fb3': 'stantonstar', // Stanton star
      '52a77839-4e55-4cdd-bdd3-ac7bb9626b03': 'stanton1',   // Hurston
      '20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5': 'stanton2',   // Crusader
      'a6e9252e-4c72-4e51-adbe-5e2222cc79c2': 'stanton3',   // ArcCorp
      'd6fc1705-6aba-4dbe-ba24-1ea80cb8d00d': 'stanton4',   // microTech
      
      // Problem IDs from logs - map to correct new format ID
      '6a5236af-9a91-487e-af3b-697c99687c2f': 'stanton1a',  // Aberdeen
      'b30cd9bd-51d7-4f7b-b309-402642419825': 'stanton1b',  // Arial
      
      // Additional useful mappings
      '3cbf39d0-a393-4c41-83c8-86561962e36b': 'stanton1c',  // Ita
      '739a4be5-9894-4e42-9c72-a5e93cd06418': 'stanton1d',  // Magda
    };
    
    // Add name mappings
    const keys = Object.keys(commonMappings);
    for (let i = 0; i < keys.length; i++) {
      const id = keys[i];
      const name = commonMappings[id];
      this.addAlertIdMapping(id, name);
    }
    
    // Add direct UUID mappings
    const uuidKeys = Object.keys(uuidToNewIdMappings);
    for (let i = 0; i < uuidKeys.length; i++) {
      const oldId = uuidKeys[i];
      const newId = uuidToNewIdMappings[oldId];
      this.addDirectUuidMapping(oldId, newId);
      
      // Also add mapping for short UUID (first 8 chars)
      if (oldId.length > 8) {
        const shortId = oldId.substring(0, 8);
        this.addDirectUuidMapping(shortId, newId);
      }
      
      console.log(`[CelestialIdMappingService] Added direct mapping: ${oldId} -> ${newId}`);
    }
    
    // Add specific legacy IDs that have been problematic
    this.alertIdToSystemIdCache.set('6a5236af-9a91-487e-af3b-697c99687c2f', 'stanton1a');
    this.alertIdToSystemIdCache.set('b30cd9bd-51d7-4f7b-b309-402642419825', 'stanton1b');
    
    console.log(`[CelestialIdMappingService] Initialized common mappings with ${keys.length} name mappings and ${uuidKeys.length} direct UUID mappings`);
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
    const entries = Array.from(this.alertIdToNameMap.entries());
    const mappings: Record<string, string> = {};
    
    for (const [key, value] of entries) {
      mappings[key] = value;
    }
    
    return mappings;
  }
  
  /**
   * Returns all stored IDs in the mapping service
   */
  public static getAllStoredIds(): string[] {
    return Array.from(CelestialIdMappingService.getInstance().alertIdToNameMap.keys());
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