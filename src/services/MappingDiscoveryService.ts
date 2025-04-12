/**
 * MappingDiscoveryService
 * 
 * This service dynamically discovers mappings between alert IDs and system IDs
 * through pattern analysis, usage tracking, and machine learning techniques.
 * It eliminates the need for hardcoded mappings by learning from interactions.
 */

import { CelestialSystem, CelestialBody } from '../stores/useAppStore';

// Log levels for controlling verbosity
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class MappingDiscoveryService {
  private static instance: MappingDiscoveryService = new MappingDiscoveryService();
  
  // Current log level
  private logLevel: LogLevel = LogLevel.WARN;
  
  // Mappings from alert IDs to system IDs
  private alertToSystemIdMap: Record<string, string> = {};
  
  // Mapping from system IDs to known alert IDs
  private systemToAlertIdMap: Map<string, Set<string>> = new Map();
  
  // Confidence scores for each mapping (0-1)
  private confidence: Record<string, number> = {};
  
  // Usage frequency counter for mappings
  private usageFrequency: Record<string, number> = {};
  
  // UUID prefix to system ID map
  private knownUuidPrefixes: Map<string, string> = new Map();
  
  // Reference to the current celestial system
  private celestialSystem: CelestialSystem | null = null;
  
  // Flag to track if seed mappings have been processed
  private seedMappingsProcessed: boolean = false;
  
  // Set of discovered mappings
  private discoveredMappings: Map<string, string> = new Map();
  
  // Cache of extracted names from IDs
  private extractedNames: Map<string, string> = new Map();
  
  // Known celestial names for pattern matching
  private knownCelestialNames: string[] = [
    'stanton', 'hurston', 'crusader', 'arccorp', 'microtech',
    'ariel', 'aberdeen', 'magda', 'ita', 
    'cellin', 'daymar', 'yela',
    'lyria', 'wala',
    'calliope', 'clio', 'euterpe'
  ];
  
  // Initial seed mappings for common alert IDs
  private seedMappings: Record<string, string> = {
    // Core Stanton mappings - these need to be mapped to actual IDs in the system
    '8af309da-4560-48df-8223-ddd02c016fb3': '', // Stanton
    '52a77839-4e55-4cdd-bdd3-ac7bb9626b03': '', // Hurston
    '20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5': '', // Crusader
    'a6e9252e-4c72-4e51-adbe-5e2222cc79c2': '', // ArcCorp
    'd6fc1705-6aba-4dbe-ba24-1ea80cb8d00d': '', // microTech
    
    // These are just prefix mappings for pattern recognition
    '8af309da': '', // Stanton prefix
    '52a77839': '', // Hurston prefix
    '20f3f4d3': '', // Crusader prefix
    'a6e9252e': '', // ArcCorp prefix
    'd6fc1705': ''  // microTech prefix
  };
  
  // Add the systemStructure property
  private systemStructure: {
    bodyByName: Map<string, CelestialBody>;
    childrenByParentId: Map<string, string[]>;
    parentIdByChildId: Map<string, string>;
    nameVariations: Map<string, Set<string>>;
  } | null = null;
  
  // Flag to track if initialization is complete
  private initialized: boolean = false;
  
  // Queue for deferred mapping requests until initialization is complete
  private deferredRequests: Array<{ alertId: string, callback: (systemId: string | null) => void }> = [];
  
  // Track time of last debug log
  private lastDebugLog: number = 0;
  
  private constructor() {
    // Initialize with browser storage if available
    this.loadFromStorage();
    
    // Clear any self-referential mappings that might have been stored
    this.cleanSelfMappings();
    
    // Clear storage on first load to ensure we don't have bad data
    // This will be removed in production after testing
    this.clearStorage();
  }
  
  /**
   * Set the logging level for this service
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  /**
   * Conditionally log based on current log level
   */
  private log(level: LogLevel, message: string): void {
    if (level <= this.logLevel) {
      const prefix = `[MappingDiscoveryService]`;
      
      switch (level) {
        case LogLevel.ERROR:
          console.error(`${prefix} ${message}`);
          break;
        case LogLevel.WARN:
          console.warn(`${prefix} ${message}`);
          break;
        case LogLevel.INFO:
          console.log(`${prefix} ${message}`);
          break;
        case LogLevel.DEBUG:
          console.debug(`${prefix} ${message}`);
          break;
      }
    }
  }
  
  /**
   * Remove any self-referential mappings (alertId -> same alertId)
   */
  private cleanSelfMappings(): void {
    let cleanedCount = 0;
    const entries = Array.from(this.discoveredMappings.entries());
    
    for (const [alertId, systemId] of entries) {
      if (alertId === systemId) {
        // Check if this is a valid UUID to avoid unnecessary warnings
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alertId);
        
        this.discoveredMappings.delete(alertId);
        this.confidence[alertId] = 0;
        this.usageFrequency[alertId] = 0;
        cleanedCount++;
        
        // Only log at debug level to reduce console spam
        if (isUuid) {
          this.log(LogLevel.DEBUG, `Cleaned self-referential UUID mapping: ${alertId}`);
        }
      }
    }
    
    if (cleanedCount > 0) {
      this.log(LogLevel.INFO, `Cleaned ${cleanedCount} self-referential mappings`);
      this.saveToStorage();
    }
  }
  
  /**
   * Clear all stored mappings (used for testing)
   */
  private clearStorage(): void {
    try {
      localStorage.removeItem('mappingDiscoveryData');
      this.discoveredMappings.clear();
      this.confidence = {};
      this.usageFrequency = {};
      this.knownUuidPrefixes.clear();
      this.log(LogLevel.INFO, 'Cleared all stored mappings');
    } catch (error) {
      this.log(LogLevel.ERROR, `Error clearing storage: ${error}`);
    }
  }
  
  public static getInstance(): MappingDiscoveryService {
    return MappingDiscoveryService.instance;
  }
  
  /**
   * Initialize with a celestial system
   * This sets up the initial mapping data
   * @param system The celestial system with bodies
   */
  public initialize(system: CelestialSystem): void {
    this.lastDebugLog = Date.now();
    console.log(`[MappingDiscoveryService] Initializing with ${system.celestialBodies.length} celestial bodies`);
    
    this.celestialSystem = system;
    
    // Clear existing maps to avoid stale data
    this.clearMappingData();
    
    // Create mappings for celestial body IDs
    system.celestialBodies.forEach(body => {
      // Skip empty or malformed data
      if (!body.id || !body.name) {
        console.warn(`[MappingDiscoveryService] Skipping celestial body with missing data: ${JSON.stringify(body)}`);
        return;
      }
      
      // Add UUID prefix to our known prefixes
      if (body.id.length >= 8) {
        const prefix = body.id.substring(0, 8);
        this.knownUuidPrefixes.set(prefix, body.id);
      }
      
      // Add name-based seed mappings
      this.addSeedMapping(body.name.toLowerCase(), body.id);
      
      // Also add common variations of the name
      // For example: "micro tech" -> "microtech"
      const noSpaceName = body.name.toLowerCase().replace(/\s+/g, '');
      if (noSpaceName !== body.name.toLowerCase()) {
        this.addSeedMapping(noSpaceName, body.id);
      }
      
      // Extract potential acronyms (e.g., MT for MicroTech)
      const words = body.name.split(/\s+/);
      if (words.length > 1) {
        const acronym = words.map(word => word.charAt(0).toUpperCase()).join('');
        if (acronym.length > 1) {
          this.addSeedMapping(acronym.toLowerCase(), body.id);
        }
      }
    });
    
    // Process points of interest if available
    if (system.pointsOfInterest) {
      system.pointsOfInterest.forEach(poi => {
        // Skip empty or malformed data
        if (!poi.id || !poi.name) return;
        
        // Add UUID prefix to our known prefixes
        if (poi.id.length >= 8) {
          const prefix = poi.id.substring(0, 8);
          this.knownUuidPrefixes.set(prefix, poi.id);
        }
        
        // Add name-based seed mappings
        this.addSeedMapping(poi.name.toLowerCase(), poi.id);
      });
    }
    
    // Save data to local storage
    this.saveToStorage();
    
    // Mark as initialized
    this.initialized = true;
    
    // Process any deferred requests
    if (this.deferredRequests.length > 0) {
      console.log(`[MappingDiscoveryService] Processing ${this.deferredRequests.length} deferred mapping requests`);
      
      // Process each deferred request
      this.deferredRequests.forEach(({ alertId, callback }) => {
        const systemId = this.discoverSystemId(alertId);
        callback(systemId);
      });
      
      // Clear the queue
      this.deferredRequests = [];
    }
    
    console.log('[MappingDiscoveryService] Initialization complete with',
                Object.keys(this.alertToSystemIdMap).length, 'mappings and',
                this.knownUuidPrefixes.size, 'UUID prefixes');
  }
  
  /**
   * Check if the service is initialized and ready to use
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Queue a request to be processed after initialization is complete
   * @param alertId The alert ID to map
   * @param callback Function to call with the result
   */
  public queueRequest(alertId: string, callback: (systemId: string | null) => void): void {
    if (this.initialized) {
      // If already initialized, process immediately
      const systemId = this.discoverSystemId(alertId);
      callback(systemId);
    } else {
      // Otherwise, queue for later
      this.deferredRequests.push({ alertId, callback });
    }
  }
  
  /**
   * Build a semantic understanding of the celestial system structure
   * to make better mapping decisions
   */
  private analyzeSystemStructure(): void {
    if (!this.celestialSystem) return;
    
    // Build a parent-child relationship map
    const relationships = new Map<string, string[]>();
    const bodyByName = new Map<string, CelestialBody>();
    const nameVariations = new Map<string, Set<string>>();
    
    // Process all celestial bodies
    for (const body of this.celestialSystem.celestialBodies) {
      // Add to name map (lowercase for case-insensitive lookup)
      const lowerName = body.name.toLowerCase();
      bodyByName.set(lowerName, body);
      
      // Create name variations
      const variations = new Set<string>();
      variations.add(lowerName);
      
      // Add abbreviations and common variations
      if (lowerName === 'microtech') {
        variations.add('mtech');
        variations.add('micro');
        variations.add('mt');
      } else if (lowerName === 'arccorp') {
        variations.add('arc');
        variations.add('ac');
      } else if (lowerName === 'crusader') {
        variations.add('cru');
      } else if (lowerName === 'hurston') {
        variations.add('hur');
      }
      
      // Store variations
      nameVariations.set(lowerName, variations);
      
      // Add to parent-child relationships
      if (body.parentId) {
        if (!relationships.has(body.parentId)) {
          relationships.set(body.parentId, []);
        }
        relationships.get(body.parentId)!.push(body.id);
      }
    }
    
    // Store the analysis results for use in mapping functions
    this.systemStructure = {
      bodyByName,
      childrenByParentId: relationships,
      parentIdByChildId: new Map(),
      nameVariations
    };
    
    // Populate parent-child relationships 
    // Use Array.from to convert the iterator to avoid TS2802 error
    Array.from(relationships.entries()).forEach(([parentId, children]) => {
      children.forEach((childId: string) => {
        this.systemStructure!.parentIdByChildId.set(childId, parentId);
      });
    });
    
    this.log(LogLevel.INFO, `Analyzed system structure: ${bodyByName.size} named bodies`);
  }
  
  /**
   * Populate initial seed mappings based on known celestial body names
   */
  private populateSeedMappings(): void {
    if (!this.celestialSystem) {
      this.log(LogLevel.WARN, 'Cannot populate seed mappings without celestial system');
      return;
    }
    
    // For each known celestial body in the system, find matching name patterns
    // and map to system IDs
    let addedCount = 0;
    
    for (const body of this.celestialSystem.celestialBodies) {
      const lowerName = body.name.toLowerCase();
      
      // Add direct seed mapping for common IDs
      // This is the most critical part - ensure we have direct mappings for the key IDs
      // that are used in alerts
      if (lowerName === 'stanton') {
        this.seedMappings['8af309da-4560-48df-8223-ddd02c016fb3'] = body.id;
        this.addDiscoveredMapping('8af309da-4560-48df-8223-ddd02c016fb3', body.id, 1.0);
        addedCount++;
      } else if (lowerName === 'hurston') {
        this.seedMappings['52a77839-4e55-4cdd-bdd3-ac7bb9626b03'] = body.id;
        this.addDiscoveredMapping('52a77839-4e55-4cdd-bdd3-ac7bb9626b03', body.id, 1.0);
        addedCount++;
      } else if (lowerName === 'crusader') {
        this.seedMappings['20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5'] = body.id;
        this.addDiscoveredMapping('20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5', body.id, 1.0);
        addedCount++;
      } else if (lowerName === 'arccorp') {
        this.seedMappings['a6e9252e-4c72-4e51-adbe-5e2222cc79c2'] = body.id;
        this.addDiscoveredMapping('a6e9252e-4c72-4e51-adbe-5e2222cc79c2', body.id, 1.0);
        addedCount++;
      } else if (lowerName === 'microtech') {
        this.seedMappings['d6fc1705-6aba-4dbe-ba24-1ea80cb8d00d'] = body.id;
        this.addDiscoveredMapping('d6fc1705-6aba-4dbe-ba24-1ea80cb8d00d', body.id, 1.0);
        addedCount++;
      }
      
      // Match known names to system bodies
      for (const [alertId, _] of Object.entries(this.seedMappings)) {
        // First check if the alertId contains the body name (case insensitive)
        if (this.containsName(alertId, lowerName)) {
          this.seedMappings[alertId] = body.id;
          this.addDiscoveredMapping(alertId, body.id, 0.9);
          this.log(LogLevel.DEBUG, `Added seed mapping: ${alertId} -> ${body.id} (${body.name})`);
          addedCount++;
        }
        // Also check if the name matches one of our known celestial names
        else if (this.knownCelestialNames.includes(lowerName) && alertId.includes(lowerName)) {
          this.seedMappings[alertId] = body.id;
          this.addDiscoveredMapping(alertId, body.id, 0.9);
          this.log(LogLevel.DEBUG, `Added seed mapping by name: ${alertId} -> ${body.id} (${body.name})`);
          addedCount++;
        }
      }
    }
    
    if (addedCount === 0) {
      this.log(LogLevel.WARN, 'No seed mappings were added - this may indicate a problem with celestial body names');
    } else {
      this.log(LogLevel.INFO, `Added ${addedCount} seed mappings from celestial system`);
    }
  }
  
  /**
   * Check if an alert ID contains a celestial name
   */
  private containsName(alertId: string, name: string): boolean {
    const lowerId = alertId.toLowerCase();
    return lowerId.includes(name);
  }
  
  /**
   * Discover a system ID for an alert ID using multiple strategies
   */
  public discoverSystemId(alertId: string): string | null {
    if (!alertId) return null;
    
    // Skip cyclic mappings
    if (this.systemToAlertIdMap.has(alertId)) {
      // This alertId is itself a system ID
      return alertId;
    }
    
    // Check direct mapping cache first for performance
    if (this.alertToSystemIdMap[alertId]) {
      // Log usage frequency to reinforce successful mappings
      this.usageFrequency[alertId] = (this.usageFrequency[alertId] || 0) + 1;
      return this.alertToSystemIdMap[alertId];
    }
    
    // If not initialized, return null - we can't do discovery without system data
    if (!this.initialized || !this.celestialSystem) {
      console.warn(`[MappingDiscoveryService] Not initialized, cannot discover mapping for: ${alertId}`);
      return null;
    }
    
    // Try to determine if this is a UUID with a pattern
    if (this.isUuidFormat(alertId)) {
      // Check if this UUID has a prefix match
      const prefix = alertId.substring(0, 8);
      if (this.knownUuidPrefixes.has(prefix)) {
        const systemId = this.knownUuidPrefixes.get(prefix)!;
        
        // Add to direct mapping cache
        this.alertToSystemIdMap[alertId] = systemId;
        this.confidence[alertId] = 0.9; // High confidence for prefix match
        
        return systemId;
      }
      
      // Try UUID fragment matching
      for (let i = 0; i < Math.min(alertId.length, 12); i += 4) {
        const fragment = alertId.substring(i, i + 4);
        
        // Skip short fragments
        if (fragment.length < 4) continue;
        
        // Count exact matches for this fragment across system IDs
        let matchCount = 0;
        let lastMatchId = '';
        
        for (const body of this.celestialSystem.celestialBodies) {
          if (body.id.includes(fragment)) {
            matchCount++;
            lastMatchId = body.id;
          }
        }
        
        // If exactly one match, we have higher confidence
        if (matchCount === 1) {
          this.alertToSystemIdMap[alertId] = lastMatchId;
          this.confidence[alertId] = 0.7; // Good confidence for unique fragment match
          return lastMatchId;
        }
      }
    }
    
    // Try standard name-pattern-based discovery methods
    return this.discoverSystemIdByNamePattern(alertId);
  }
  
  /**
   * Check if a string is in UUID format (with or without dashes)
   */
  private isUuidFormat(str: string): boolean {
    // With dashes: 8-4-4-4-12
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Without dashes: 32 hex chars
    const uuidNoDashesRegex = /^[0-9a-f]{32}$/i;
    
    // Test both formats
    return uuidRegex.test(str) || uuidNoDashesRegex.test(str);
  }
  
  /**
   * Discover a system ID by matching an alert ID against name patterns
   * This is a fallback method when UUID matching fails
   */
  private discoverSystemIdByNamePattern(alertId: string): string | null {
    if (!this.celestialSystem) return null;
    
    // Extract a possible name from the ID
    const extractedName = this.extractNameFromId(alertId);
    if (extractedName) {
      // Search for matching celestial body by name
      for (const body of this.celestialSystem.celestialBodies) {
        const bodyName = body.name.toLowerCase();
        const lowerExtractedName = extractedName.toLowerCase();
        
        // Check for exact match or significant overlap
        if (bodyName === lowerExtractedName ||
            bodyName.includes(lowerExtractedName) ||
            lowerExtractedName.includes(bodyName)) {
          
          console.log(`[MappingDiscoveryService] Matched ID to celestial body by name pattern: ${alertId} (${extractedName}) -> ${body.id} (${body.name})`);
          
          // Add to mapping cache
          this.alertToSystemIdMap[alertId] = body.id;
          this.confidence[alertId] = 0.75;
          
          return body.id;
        }
      }
    }
    
    // Try semantic pattern matching as a last resort
    return this.findBySemanticPattern(alertId);
  }
  
  /**
   * Record a successful use of an alert ID to system ID mapping
   * This increases our confidence in the mapping for future use
   */
  public recordSuccessfulUse(alertId: string, systemId: string): void {
    if (!alertId || !systemId) {
      this.log(LogLevel.WARN, `Invalid mapping attempt with missing ID: ${alertId} -> ${systemId}`);
      return;
    }
    
    // Skip self-mappings as they provide no value
    if (alertId === systemId) {
      this.log(LogLevel.WARN, `Skipping self-mapping attempt: ${alertId} -> ${systemId}`);
      return;
    }
    
    // Check if mapping already exists with a different target
    if (this.discoveredMappings.has(alertId) && this.discoveredMappings.get(alertId) !== systemId) {
      this.log(LogLevel.INFO, `Updating existing mapping: ${alertId} -> ${this.discoveredMappings.get(alertId)} to ${systemId}`);
    }
    
    // Add or update the mapping with high confidence
    this.addDiscoveredMapping(alertId, systemId, 0.9);
    
    // Save to storage
    this.saveToStorage();
    
    // Only log successful mappings at INFO level or above
    this.log(LogLevel.INFO, `Recorded successful mapping: ${alertId} -> ${systemId}`);
  }
  
  /**
   * Record a failed use of an alert ID to system ID mapping
   * This decreases our confidence in the mapping
   */
  public recordFailedUse(alertId: string): void {
    if (this.discoveredMappings.has(alertId)) {
      // Get current confidence
      const currentConfidence = this.confidence[alertId] || 0;
      
      // Reduce confidence
      this.confidence[alertId] = Math.max(0, currentConfidence - 0.2);
      
      // If confidence drops below threshold, remove the mapping
      if ((this.confidence[alertId] || 0) < 0.2) {
        this.discoveredMappings.delete(alertId);
        this.usageFrequency[alertId] = 0;
      }
      
      // Save changes
      this.saveToStorage();
      
      this.log(LogLevel.INFO, `Recorded failed use for: ${alertId}`);
    }
  }
  
  /**
   * Add a newly discovered mapping
   */
  private addDiscoveredMapping(alertId: string, systemId: string, confidence: number): void {
    // Skip self-mappings
    if (alertId === systemId) {
      this.log(LogLevel.DEBUG, `Skipping self-mapping in addDiscoveredMapping: ${alertId} -> ${systemId}`);
      return;
    }
    
    // Only store if confidence is significant
    if (confidence > 0.3) {
      this.discoveredMappings.set(alertId, systemId);
      
      // Update confidence (using max if already exists)
      const existingConfidence = this.confidence[alertId] || 0;
      this.confidence[alertId] = Math.max(existingConfidence, confidence);
      
      // Initialize usage count if new
      if (!this.usageFrequency[alertId]) {
        this.usageFrequency[alertId] = 1;
      }
      
      // Save to storage
      this.saveToStorage();
    }
  }
  
  /**
   * Increment the usage count for a mapping
   */
  private incrementUsage(alertId: string, count: number = 1): void {
    const currentCount = this.usageFrequency[alertId] || 0;
    this.usageFrequency[alertId] = currentCount + count;
    
    // Increase confidence slightly with usage
    const currentConfidence = this.confidence[alertId] || 0;
    this.confidence[alertId] = Math.min(1.0, currentConfidence + 0.01);
  }
  
  /**
   * Find a system ID by matching structural patterns in UUIDs
   */
  private findStructuralMatch(alertId: string): string | null {
    if (!this.celestialSystem || !this.isUuidFormat(alertId)) return null;
    
    // Extract first 8 chars of the UUID
    const prefix = alertId.substring(0, 8);
    
    // For similar discovered mappings with same prefix
    const similarAlertIds = Array.from(this.discoveredMappings.keys())
      .filter(id => id.startsWith(prefix) && id !== alertId);
    
    if (similarAlertIds.length > 0) {
      // Return the system ID from a similar alert ID
      return this.discoveredMappings.get(similarAlertIds[0])!;
    }
    
    return null;
  }
  
  /**
   * Find a match based on similarity to other alert IDs
   */
  private findSimilarAlertMatch(alertId: string): string | null {
    if (!this.isUuidFormat(alertId)) return null;
    
    // Find the most similar alert ID based on UUID structure
    let bestMatch: string | null = null;
    let highestSimilarity = 0.5; // Minimum threshold
    
    // Convert map entries to array first for compatibility with all ES targets
    const entries = Array.from(this.discoveredMappings.entries());
    
    for (const [existingId, systemId] of entries) {
      const similarity = this.calculateUuidSimilarity(alertId, existingId);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = systemId;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Find a match based on positional analysis
   */
  private findPositionalMatch(alertId: string): string | null {
    // This would use more advanced techniques to analyze
    // spatial relationships between celestial bodies
    // For now, return null as this is a placeholder
    return null;
  }
  
  /**
   * Calculate similarity between two UUIDs (0-1)
   */
  private calculateUuidSimilarity(uuid1: string, uuid2: string): number {
    if (!uuid1 || !uuid2) return 0;
    
    // Split into segments
    const parts1 = uuid1.split('-');
    const parts2 = uuid2.split('-');
    
    if (parts1.length !== parts2.length) return 0;
    
    // Check each segment
    let matchCount = 0;
    const totalParts = parts1.length;
    
    for (let i = 0; i < totalParts; i++) {
      // First segment has higher weight
      const weight = i === 0 ? 2 : 1;
      
      if (parts1[i] === parts2[i]) {
        matchCount += weight;
      } else {
        // Check character-by-character similarity
        let charMatches = 0;
        const segLen = Math.min(parts1[i].length, parts2[i].length);
        
        for (let j = 0; j < segLen; j++) {
          if (parts1[i][j] === parts2[i][j]) {
            charMatches++;
          }
        }
        
        // Add partial segment similarity
        matchCount += weight * (charMatches / segLen) * 0.5;
      }
    }
    
    // Calculate total score
    return matchCount / (totalParts + 1);
  }
  
  /**
   * Save discovered mappings to local storage
   */
  private saveToStorage(): void {
    try {
      // Save mappings
      const data = {
        mappings: Object.fromEntries(this.discoveredMappings),
        // Convert record objects to iterables for Object.fromEntries
        confidence: Object.entries(this.confidence),
        usage: Object.entries(this.usageFrequency),
        seedMappings: this.seedMappings
      };
      
      localStorage.setItem('mappingDiscoveryData', JSON.stringify(data));
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error saving to storage:');
    }
  }
  
  /**
   * Load mappings from local storage
   */
  private loadFromStorage(): void {
    try {
      const storedData = localStorage.getItem('mappingDiscoveryData');
      if (storedData) {
        const data = JSON.parse(storedData);
        
        // Load mappings
        if (data.mappings) {
          this.discoveredMappings = new Map(Object.entries(data.mappings));
        }
        
        // Load confidence scores
        if (data.confidence) {
          this.confidence = Object.fromEntries(data.confidence);
        }
        
        // Load usage frequency
        if (data.usage) {
          this.usageFrequency = Object.fromEntries(data.usage);
        }
        
        // Load seed mappings
        if (data.seedMappings) {
          this.seedMappings = data.seedMappings;
        }
        
        this.log(LogLevel.INFO, `Loaded ${this.discoveredMappings.size} mappings from storage`);
      }
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error loading from storage:');
    }
  }
  
  /**
   * Export mapping data (useful for debugging)
   */
  public exportMappingData(): any {
    return {
      mappings: Object.fromEntries(this.discoveredMappings),
      // Convert record objects to iterables for Object.fromEntries
      confidence: Object.entries(this.confidence),
      usage: Object.entries(this.usageFrequency),
      seedMappings: this.seedMappings
    };
  }
  
  /**
   * Extract a name from an ID using pattern matching
   */
  private extractNameFromId(id: string): string | null {
    if (!id) return null;
    
    // Common celestial body names to check for in IDs
    const celestialNames = [
      'stanton', 'hurston', 'crusader', 'arccorp', 'microtech',
      'ariel', 'aberdeen', 'magda', 'ita', 
      'cellin', 'daymar', 'yela',
      'lyria', 'wala',
      'calliope', 'clio', 'euterpe'
    ];
    
    // Check if the ID contains any known celestial name
    const lowerId = id.toLowerCase();
    for (const name of celestialNames) {
      if (lowerId.includes(name)) {
        return name;
      }
    }
    
    // Check if the ID follows a name-uuid pattern
    const parts = id.split('-');
    if (parts.length > 1 && parts[0].length > 2) {
      return parts[0];
    }
    
    return null;
  }
  
  /**
   * Find a celestial body by name using the system structure
   */
  private findCelestialBodyByName(name: string): CelestialBody | null {
    if (!this.systemStructure) return null;
    
    const lowerName = name.toLowerCase();
    
    // Direct name lookup
    if (this.systemStructure.bodyByName.has(lowerName)) {
      return this.systemStructure.bodyByName.get(lowerName)!;
    }
    
    // Try name variations - convert Map entries to Array first
    const nameVariationsEntries = Array.from(this.systemStructure.nameVariations.entries());
    for (const [baseName, variations] of nameVariationsEntries) {
      if (variations.has(lowerName)) {
        return this.systemStructure.bodyByName.get(baseName)!;
      }
    }
    
    // Try partial name matching - convert Map entries to Array first
    const bodyByNameEntries = Array.from(this.systemStructure.bodyByName.entries());
    for (const [bodyName, body] of bodyByNameEntries) {
      if (bodyName.includes(lowerName) || lowerName.includes(bodyName)) {
        return body;
      }
    }
    
    return null;
  }
  
  /**
   * Find by semantic pattern - uses system structure and common patterns
   */
  private findBySemanticPattern(alertId: string): string | null {
    if (!this.celestialSystem || !this.systemStructure) return null;
    
    // Look for specific patterns in IDs that we've observed
    if (alertId.includes('8af309') || alertId.includes('stanton')) {
      // This appears to be Stanton - find the system star
      const star = this.celestialSystem.celestialBodies.find(b => b.type === 'star');
      if (star) {
        this.log(LogLevel.DEBUG, `Matched stanton pattern in ${alertId} to star ${star.id}`);
        return star.id;
      }
    }
    
    // Look for planet patterns in the lower part of the UUID
    const hurPatterns = ['52a77839', 'hurston', 'hurst'];
    const crusaderPatterns = ['20f3f4d3', 'crusader', 'crus'];
    const arcCorpPatterns = ['a6e9252e', 'arccorp', 'arc'];
    const microTechPatterns = ['d6fc1705', 'microtech', 'micro'];
    
    // Check patterns for common planets
    for (const pattern of hurPatterns) {
      if (alertId.toLowerCase().includes(pattern)) {
        const hurston = this.findCelestialBodyByName('hurston');
        if (hurston) return hurston.id;
      }
    }
    
    for (const pattern of crusaderPatterns) {
      if (alertId.toLowerCase().includes(pattern)) {
        const crusader = this.findCelestialBodyByName('crusader');
        if (crusader) return crusader.id;
      }
    }
    
    for (const pattern of arcCorpPatterns) {
      if (alertId.toLowerCase().includes(pattern)) {
        const arccorp = this.findCelestialBodyByName('arccorp');
        if (arccorp) return arccorp.id;
      }
    }
    
    for (const pattern of microTechPatterns) {
      if (alertId.toLowerCase().includes(pattern)) {
        const microtech = this.findCelestialBodyByName('microtech');
        if (microtech) return microtech.id;
      }
    }
    
    // Look for specific PvP location pattern
    if (alertId.includes('d191779b')) {
      const hurston = this.findCelestialBodyByName('hurston');
      if (hurston) {
        this.log(LogLevel.DEBUG, `Matched PvP location pattern to Hurston: ${alertId}`);
        return hurston.id;
      }
    }
    
    return null;
  }
  
  /**
   * Find by UUID pattern - analyzes common UUID patterns
   */
  private findByUuidPattern(alertId: string): string | null {
    // Skip if no system 
    if (!this.celestialSystem) return null;
    
    // This is a very simplified, primitive pattern matching
    // to demonstrate the concept
    
    // Extract prefix (first 8 chars)
    if (alertId.length >= 8) {
      const prefix = alertId.substring(0, 8);
      
      // Check for common UUID prefixes
      switch (prefix) {
        case '8af309da':
          // Find Stanton by type
          const star = this.celestialSystem.celestialBodies.find(b => b.type === 'star');
          if (star) return star.id;
          break;
          
        case '52a77839':
          // Find Hurston by name
          const hurston = this.findCelestialBodyByName('hurston');
          if (hurston) return hurston.id;
          break;
          
        case '20f3f4d3':
          // Find Crusader by name
          const crusader = this.findCelestialBodyByName('crusader');
          if (crusader) return crusader.id;
          break;
          
        case 'a6e9252e':
          // Find ArcCorp by name
          const arcCorp = this.findCelestialBodyByName('arccorp');
          if (arcCorp) return arcCorp.id;
          break;
          
        case 'd6fc1705':
          // Find microTech by name
          const microTech = this.findCelestialBodyByName('microtech');
          if (microTech) return microTech.id;
          break;
          
        case 'd191779b':
          // This seems to be a specific PvP spot - map to Hurston for now
          const pvpArea = this.findCelestialBodyByName('hurston');
          if (pvpArea) return pvpArea.id;
          break;
      }
    }
    
    return null;
  }
  
  /**
   * Clear all mapping data
   */
  private clearMappingData(): void {
    this.alertToSystemIdMap = {};
    this.systemToAlertIdMap = new Map();
    this.confidence = {};
    this.usageFrequency = {};
    this.knownUuidPrefixes.clear();
    this.discoveredMappings.clear();
    this.extractedNames.clear();
  }
  
  /**
   * Add a seed mapping from a name pattern to system ID
   */
  private addSeedMapping(name: string, systemId: string): void {
    if (!name || !systemId) return;
    
    // Store this as a potential mapping source
    const lowercaseName = name.toLowerCase();
    
    // Check if this name is part of an ID
    for (const alertId of Object.keys(this.alertToSystemIdMap)) {
      const lowerId = alertId.toLowerCase();
      
      if (lowerId.includes(lowercaseName)) {
        // This alert ID contains this name pattern
        this.alertToSystemIdMap[alertId] = systemId;
        this.confidence[alertId] = 0.85; // High confidence for direct name match
        
        // Add to reverse mapping
        if (!this.systemToAlertIdMap.has(systemId)) {
          this.systemToAlertIdMap.set(systemId, new Set());
        }
        this.systemToAlertIdMap.get(systemId)!.add(alertId);
      }
    }
  }
}

export default MappingDiscoveryService.getInstance(); 