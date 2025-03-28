import { CelestialBody, CelestialSystem, JumpPoint } from '../../stores/useAppStore';
import { Vector3, addVectors } from '../../utils/coordinateUtils';
import { isValidNumber, isValidVector3 } from '../../utils/validationUtils';
import { SpatialEntity, DataProcessingError, DataProcessingErrorType, ProcessedCelestialSystem } from './types';
import { Octree } from './SpatialIndex';

// Define updated version of ProcessedCelestialSystem for our new implementation
interface EnhancedProcessedCelestialSystem {
  name: string;
  description?: string;
  bodies: ProcessedEntity[];
  metadata: {
    totalBodies: number;
    processingErrors: number;
    processedTypes: Record<string, number>;
  };
}

/**
 * Represents a processed entity with absolute positions
 */
interface ProcessedEntity {
  id: string;
  name: string;
  entityType: string;
  position: Vector3;
  radius: number;
  parent: string | null;
  metadata: {
    originalType: string;
    hasChildren: boolean;
    parentName: string | null;
    wasAbsoluteAlready: boolean;
    originalPosition: Vector3;
    positionMagnitude: number;
    [key: string]: any;
  };
}

/**
 * Service for transforming celestial data into a format with absolute positions
 * and efficient spatial queries
 */
export class DataTransformer {
  /**
   * Format distance for display using a numeric distance value
   */
  private formatDistance(pos1: Vector3, pos2: Vector3): string {
    const distance = this.getDistanceValue(pos1, pos2);
    return this.formatDistanceValue(distance);
  }
  
  /**
   * Format a distance value into a human-readable string with appropriate units
   */
  private formatDistanceValue(distance: number): string {
    if (distance >= 1000000000) {
      return `${(distance / 1000000000).toFixed(2)} billion km`;
    } else if (distance >= 1000000) {
      return `${(distance / 1000000).toFixed(2)} million km`;
    } else if (distance >= 1000) {
      return `${(distance / 1000).toFixed(2)} thousand km`;
    } else {
      return `${distance.toFixed(2)} km`;
    }
  }

  /**
   * Preprocess entities to detect and correct misused absolute coordinates
   * This should be called before the main processing to correct data issues
   * @param system The celestial system to preprocess
   */
  private preprocessEntitiesForAbsoluteCoordinates(system: CelestialSystem): void {
    console.group('🧹 Preprocessing entities for coordinate system corrections');
    
    // Create map of entities by ID for faster lookups
    const entityMap = new Map<string, CelestialBody>();
    system.bodies.forEach(body => {
      entityMap.set(body.id.toLowerCase(), body);
      entityMap.set(body.id, body); // Also store with original case
    });
    
    // Group entities by whether they have parents to aid in analysis
    const entitiesWithParents: CelestialBody[] = [];
    const entitiesWithoutParents: CelestialBody[] = [];
    
    system.bodies.forEach(body => {
      if (this.isAbsolutePosition(body)) {
        entitiesWithoutParents.push(body);
      } else {
        entitiesWithParents.push(body);
      }
    });
    
    console.log(`Found ${entitiesWithParents.length} entities with parents and ${entitiesWithoutParents.length} without parents`);
    
    // Find entities with suspiciously large position values that have parents
    const suspiciousEntities = entitiesWithParents.filter(body => {
      // Calculate position magnitude
      const pos = body.position;
      const magnitude = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
      
      // Consider large position values suspicious for entities with parents
      // These might be absolute coordinates mistakenly used in relative context
      return magnitude > 10000000; // 10 million units threshold
    });
    
    if (suspiciousEntities.length > 0) {
      console.warn(`⚠️ Found ${suspiciousEntities.length} entities with suspiciously large position values despite having parents:`);
      console.group('Entities with potentially incorrect coordinate usage');
      
      // Map to store corrected positions
      const corrections = new Map<string, Vector3>();
      
      // Group suspicious entities by parent for better analysis
      const suspiciousByParent = new Map<string, CelestialBody[]>();
      
      suspiciousEntities.forEach(entity => {
        if (!entity.parent) return; // Skip if no parent (shouldn't happen based on filter)
        
        // Group by parent
        const parentId = entity.parent.toLowerCase();
        if (!suspiciousByParent.has(parentId)) {
          suspiciousByParent.set(parentId, []);
        }
        suspiciousByParent.get(parentId)!.push(entity);
        
        // Find the parent
        const parentKey = entityMap.has(entity.parent) ? entity.parent : entity.parent.toLowerCase();
        const parent = entityMap.get(parentKey);
        
        if (parent) {
          const positionMagnitude = Math.sqrt(
            entity.position.x * entity.position.x + 
            entity.position.y * entity.position.y + 
            entity.position.z * entity.position.z
          );
          
          console.warn(`🚨 Entity "${entity.name}" (${entity.id}, type: ${entity.type}) appears to have absolute coordinates but is a child of "${parent.name}"`);
          console.log(`  Current Position: (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
          console.log(`  Position Magnitude: ${this.formatDistanceValue(positionMagnitude)}`);
          console.log(`  Parent Position: (${parent.position.x}, ${parent.position.y}, ${parent.position.z})`);
          
          // Calculate what the relative position should be if these were absolute coordinates
          const correctedPosition: Vector3 = {
            x: entity.position.x - parent.position.x,
            y: entity.position.y - parent.position.y,
            z: entity.position.z - parent.position.z
          };
          
          // Store the correction
          corrections.set(entity.id, correctedPosition);
          
          // Calculate corrected position magnitude
          const correctedMagnitude = Math.sqrt(
            correctedPosition.x * correctedPosition.x +
            correctedPosition.y * correctedPosition.y +
            correctedPosition.z * correctedPosition.z
          );
          
          console.log(`  Corrected Relative Position: (${correctedPosition.x}, ${correctedPosition.y}, ${correctedPosition.z})`);
          console.log(`  Corrected Position Magnitude: ${this.formatDistanceValue(correctedMagnitude)}`);
          
          // Log distance from parent (useful for validation)
          console.log(`  Distance from parent: ${this.formatDistanceValue(correctedMagnitude)}`);
          
          // Apply validation checks based on entity types
          if (entity.type.toLowerCase() === 'moon' && correctedMagnitude > 5000000) {
            console.log(`  ⚠️ Moon's distance from planet seems too large: ${this.formatDistanceValue(correctedMagnitude)}`);
          } else if (entity.type.toLowerCase() === 'station' && correctedMagnitude > 100000) {
            console.log(`  ⚠️ Station's distance seems too large: ${this.formatDistanceValue(correctedMagnitude)}`);
          } else if (entity.type.toLowerCase() === 'landingzone' && correctedMagnitude > 100000) {
            console.log(`  ⚠️ Landing zone's distance from parent seems too large: ${this.formatDistanceValue(correctedMagnitude)}`);
          }
        } else {
          console.warn(`⚠️ Entity "${entity.name}" has parent "${entity.parent}" but parent entity not found`);
        }
      });
      
      // Log summary of suspicious entities by parent
      console.group('Summary of suspicious entities by parent:');
      suspiciousByParent.forEach((entities, parentId) => {
        const parent = entityMap.get(parentId);
        console.log(`${entities.length} suspicious children of ${parent?.name || parentId}:`);
        entities.forEach(entity => {
          console.log(`  - ${entity.name} (${entity.type})`);
        });
      });
      console.groupEnd();
      
      // Apply corrections to the original data
      console.log('🔧 Applying corrections to entity positions...');
      system.bodies.forEach(body => {
        if (corrections.has(body.id)) {
          const correctedPosition = corrections.get(body.id)!;
          console.log(`✅ Correcting ${body.name} position to (${correctedPosition.x}, ${correctedPosition.y}, ${correctedPosition.z})`);
          body.position = correctedPosition;
        }
      });
      
      console.log(`✅ Applied ${corrections.size} position corrections`);
      console.groupEnd();
    } else {
      console.log('✅ No suspicious entity positions detected');
    }
    
    console.groupEnd();
  }

  /**
   * Determines if an entity's position should be treated as absolute coordinates
   * 
   * @param entity The entity to check
   * @returns True if the entity's position should be treated as absolute
   */
  private isAbsolutePosition(entity: CelestialBody): boolean {
    // STRICT RULE: An entity uses absolute coordinates ONLY IF it has no parent
    // All entities with parents use relative coordinates, REGARDLESS of:
    // - Entity type (star, planet, moon, etc.)
    // - Position magnitude or any other heuristics
    return !entity.parent;
  }

  /**
   * Process a celestial system by calculating absolute positions
   * 
   * @param system The celestial system data to process
   * @returns Processed data with absolute positions
   */
  public processSystem(system: CelestialSystem): ProcessedCelestialSystem {
    console.group('⚙️ Processing celestial system');
    
    // Step 1: Preprocess entities to detect and fix absolute coordinates misused as relative
    this.preprocessEntitiesForAbsoluteCoordinates(system);
    
    // Step 2: Analyze position data format to determine whether to treat as absolute or relative coordinates
    console.log('📊 Determining coordinate system format...');
    this.analyzeEntityPositions(system.bodies);
    
    // Step 3: Calculate positioning statistics
    let entitiesWithParents = system.bodies.filter(b => b.parent);
    let likelyAbsoluteCount = 0;
    let likelyRelativeCount = 0;
    
    entitiesWithParents.forEach(entity => {
      const pos = entity.position;
      const magnitude = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
      
      if (magnitude < 1000000) {
        likelyRelativeCount++;
      } else {
        likelyAbsoluteCount++;
      }
    });
    
    // Decide whether to assume absolute coordinates by default
    const assumeAbsoluteByDefault = likelyAbsoluteCount > likelyRelativeCount;
    console.log(`🔧 Position strategy: ${assumeAbsoluteByDefault ? 
      'Treating coordinates as absolute by default, checking individual entities' : 
      'Treating coordinates as parent-relative by default, checking individual entities'}`);
    
    // Create a map for entity lookup by ID
    const entityMap = new Map<string, CelestialBody>();
    system.bodies.forEach(body => {
      entityMap.set(body.id, body);
      // Also add with lowercase ID for case-insensitive lookups
      entityMap.set(body.id.toLowerCase(), body);
    });

    // Create map to store processed entities
    const processedEntities: Record<string, ProcessedEntity> = {};
    const alreadyProcessed = new Set<string>();
    
    // Keep track of processing statistics
    let absolutePositionCount = 0;
    let relativePositionCount = 0;
    const processedTypes: Record<string, number> = {};
    const processingErrors: string[] = [];
    
    // Process an entity by computing its absolute position
    const computeAbsolutePosition = (id: string): ProcessedEntity | null => {
      // Skip if already processed
      if (alreadyProcessed.has(id)) {
        return processedEntities[id];
      }
      
      // Get the entity
      const entity = entityMap.get(id);
      if (!entity) {
        console.warn(`⚠️ Entity with ID ${id} not found in entity map`);
        return null;
      }
      
      // Debug specific key entities
      const isKeyEntity = entity.name?.includes('Crusader') || 
                          entity.name?.includes('Orison') || 
                          entity.name?.includes('Stanton') ||
                          entity.name?.includes('Hurston') ||
                          entity.name?.includes('Aberdeen') ||
                          entity.name?.includes('Arial') ||
                          entity.name?.includes('Magda') ||
                          entity.name?.includes('Ita') ||
                          entity.name?.includes('Daymar') ||
                          entity.name?.includes('Cellin') || 
                          entity.name?.includes('Yela');
      
      if (isKeyEntity) {
        console.log(`🔍 [Trace] Processing key entity: ${entity.name} (${entity.type})`);
        console.log(`  ID: ${entity.id}`);
        console.log(`  Position: (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
        console.log(`  Parent: ${entity.parent || 'none'}`);
        
        // Check if this position is suspiciously large for a child entity
        const magnitude = Math.sqrt(
          entity.position.x * entity.position.x + 
          entity.position.y * entity.position.y + 
          entity.position.z * entity.position.z
        );
        
        if (magnitude > 10000000 && entity.parent) {
          console.warn(`🚨 Suspected absolute coordinates used as relative for ${entity.name}: magnitude = ${magnitude}`);
        }
      }
      
      // If entity has a parent, process the parent first
      let parentEntity: ProcessedEntity | null = null;
      if (entity.parent) {
        // Try to find the parent with exact ID first
        if (entityMap.has(entity.parent)) {
          if (isKeyEntity) console.log(`  Parent found with exact ID match: ${entity.parent}`);
          parentEntity = computeAbsolutePosition(entity.parent);
        } 
        // If not found, try case-insensitive lookup
        else {
          const normalizedParentId = entity.parent.toLowerCase();
          if (entityMap.has(normalizedParentId)) {
            if (isKeyEntity) console.log(`  Parent found with case-insensitive match: ${normalizedParentId}`);
            const parent = entityMap.get(normalizedParentId);
            if (parent) {
              parentEntity = computeAbsolutePosition(parent.id);
            }
          } else {
            console.warn(`⚠️ Parent ${entity.parent} of entity ${entity.name} (${entity.id}) does not exist`);
          }
        }
      }
      
      // Normalize the type
      const normalizedType = this.normalizeEntityType(entity.type);
      
      // Calculate position magnitude for metadata only
      const positionMagnitude = Math.sqrt(
        entity.position.x * entity.position.x + 
        entity.position.y * entity.position.y + 
        entity.position.z * entity.position.z
      );
      
      // Determine if this entity's position is absolute (strict rule: only root entities)
      const isEntityAbsolute = this.isAbsolutePosition(entity);
      
      // Calculate absolute position
      let absolutePosition: Vector3;
      
      if (isEntityAbsolute) {
        // Entity has no parent, use position as-is
        absolutePosition = { ...entity.position };
        absolutePositionCount++;
        
        if (isKeyEntity) {
          console.log(`  Using position as absolute (no parent): (${absolutePosition.x}, ${absolutePosition.y}, ${absolutePosition.z})`);
        }
      } else {
        // Entity has a parent, position must be relative
        if (!parentEntity) {
          // Parent reference exists but parent entity not found - warning case
          console.warn(`⚠️ Entity ${entity.name} has parent reference ${entity.parent} but parent not found - using position as absolute`);
          absolutePosition = { ...entity.position };
          absolutePositionCount++;
        } else {
          // Normal case: Add parent's position to get absolute coordinates
          absolutePosition = {
            x: parentEntity.position.x + entity.position.x,
            y: parentEntity.position.y + entity.position.y,
            z: parentEntity.position.z + entity.position.z
          };
          relativePositionCount++;
          
          if (isKeyEntity) {
            console.log(`  Parent ${parentEntity.name} position: (${parentEntity.position.x}, ${parentEntity.position.y}, ${parentEntity.position.z})`);
            console.log(`  Relative position: (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
            console.log(`  Calculated absolute position: (${absolutePosition.x}, ${absolutePosition.y}, ${absolutePosition.z})`);
            
            // Calculate distance from parent (for debugging)
            const distance = Math.sqrt(
              Math.pow(entity.position.x, 2) + 
              Math.pow(entity.position.y, 2) + 
              Math.pow(entity.position.z, 2)
            );
            console.log(`  Distance from parent (relative): ${this.formatDistanceValue(distance)}`);
          }
        }
      }
      
      // Check if position is suspiciously close to origin
      if (
        Math.abs(absolutePosition.x) < 100000 &&
        Math.abs(absolutePosition.y) < 100000 &&
        Math.abs(absolutePosition.z) < 100000 &&
        entity.name !== "Stanton" && // Exclude the star which should be at origin
        entity.type.toLowerCase() !== "star" // Exclude all stars
      ) {
        console.warn(`⚠️ Entity "${entity.name}" appears to be incorrectly located at or near system center:`, absolutePosition);
        console.log(`  Parent: ${entity.parent}, Type: ${entity.type}, Relative Position:`, entity.position);
      }
      
      // Create processed entity
      const processedEntity: ProcessedEntity = {
        id: entity.id,
        name: entity.name || `Unknown ${normalizedType}`,
        entityType: normalizedType,
        position: absolutePosition,
        radius: entity.radius || 0,
        parent: parentEntity ? parentEntity.id : (entity.parent || null),
        metadata: {
          originalType: entity.type,
          hasChildren: false,
          parentName: parentEntity ? parentEntity.name : null,
          wasAbsoluteAlready: isEntityAbsolute,
          originalPosition: { ...entity.position },
          positionMagnitude: positionMagnitude
        }
      };
      
      // Add to processed map
      processedEntities[entity.id] = processedEntity;
      alreadyProcessed.add(entity.id);
      
      // Update type counts
      const bodyType = processedEntity.entityType.toLowerCase();
      processedTypes[bodyType] = (processedTypes[bodyType] || 0) + 1;
      
      // Log the resolution path
      if (isKeyEntity || entity.type.toLowerCase() === 'station' || entity.type.toLowerCase() === 'moon' || 
          entity.type.toLowerCase() === 'lagrangepoint') {
        console.log(`[Trace] ${entity.name} → Parent: ${entity.parent || 'none'} → ` +
          `Relative: ${JSON.stringify(entity.position)} → Absolute: ${JSON.stringify(absolutePosition)}`);
        
        if (parentEntity) {
          const absDist = Math.sqrt(
            Math.pow(absolutePosition.x - parentEntity.position.x, 2) + 
            Math.pow(absolutePosition.y - parentEntity.position.y, 2) + 
            Math.pow(absolutePosition.z - parentEntity.position.z, 2)
          );
          console.log(`  Absolute distance from parent: ${this.formatDistanceValue(absDist)}`);
        }
      }
      
      return processedEntity;
    };
    
    // Process all entities recursively
    const processedBodies: ProcessedEntity[] = [];
    
    console.log('🧩 Recursively processing hierarchy');
    system.bodies.forEach(body => {
      try {
        const processed = computeAbsolutePosition(body.id);
        if (processed) {
          processedBodies.push(processed);
        }
      } catch (error) {
        const errorMsg = `Error processing entity ${body.id || 'unknown'}: ${error}`;
        console.error(errorMsg);
        processingErrors.push(errorMsg);
      }
    });
    
    // Validate distances between related entities
    this.validateEntityDistances(processedEntities);
    
    // Log processing statistics
    console.log(`📊 Processed ${processedBodies.length} entities with ${processingErrors.length} errors`);
    console.log(`📊 Entities using absolute coordinates: ${absolutePositionCount}`);
    console.log(`📊 Entities using relative coordinates: ${relativePositionCount}`);
    
    // Log summary of processed types
    console.group('📊 Entity types processed:');
    Object.entries(processedTypes).forEach(([type, count]) => {
      const emoji = this.getTypeEmoji(type);
      console.log(`${emoji} ${type}: ${count}`);
    });
    console.groupEnd();
    
    if (processingErrors.length > 0) {
      console.group('⚠️ Processing errors:');
      processingErrors.forEach(error => console.log(error));
      console.groupEnd();
    }
    
    console.groupEnd();
    
    // Convert processed entities to SpatialEntity
    const spatialEntities: SpatialEntity[] = processedBodies.map(entity => ({
      id: entity.id,
      name: entity.name,
      type: entity.entityType,
      position: entity.position,
      radius: entity.radius,
      parent: entity.parent || undefined,
      metadata: entity.metadata
    }));
    
    // Create spatial index for querying
    const spatialIndex = new Octree(spatialEntities);
    
    // After the spatialIndex is created, add this code:
    this.dumpHierarchyTree(spatialEntities);
    
    // Return in the format expected by the application
    return {
      originalSystem: system,
      entitiesWithAbsolutePositions: spatialEntities,
      spatialIndex: spatialIndex.getRoot()
    };
  }
  
  /**
   * Checks if a position appears to be in absolute coordinates based on magnitude
   * @param position The position to check
   * @returns True if the position appears to be in absolute coordinates
   * @deprecated DO NOT USE - Position classification is now solely based on parent-child relationships.
   *             This magnitude-based heuristic is unreliable and has been replaced by isAbsolutePosition().
   */
  private isLikelyAbsolutePosition(position: Vector3): boolean {
    console.warn("⚠️ isLikelyAbsolutePosition is deprecated - use isAbsolutePosition instead");
    // Position magnitude is no longer used to determine coordinate systems.
    // We now strictly follow the rule: if an entity has a parent, its position is relative.
    
    // This method remains only for backward compatibility but should not be used.
    const magnitude = Math.sqrt(
      position.x * position.x + 
      position.y * position.y + 
      position.z * position.z
    );
    
    return magnitude > 10000000;
  }

  /**
   * Validate that a celestial body has all required properties
   */
  private validateCelestialBody(body: CelestialBody): void {
    if (!body.id || typeof body.id !== 'string') {
      throw new DataProcessingError(
        DataProcessingErrorType.INVALID_POSITION,
        'unknown',
        'Celestial body is missing a valid ID'
      );
    }

    if (!body.position || !isValidVector3(body.position)) {
      throw new DataProcessingError(
        DataProcessingErrorType.INVALID_POSITION,
        body.id,
        `Celestial body ${body.id} has invalid position`
      );
    }

    if (!isValidNumber(body.radius) || body.radius <= 0) {
      throw new DataProcessingError(
        DataProcessingErrorType.INVALID_POSITION,
        body.id,
        `Celestial body ${body.id} has invalid radius`
      );
    }
  }

  /**
   * Log sample position adjustments to verify relative positioning is working correctly
   * @param entities List of entities with computed absolute positions 
   * @param bodyMap Map of original bodies with relative positions
   */
  private logPositionSamples(entities: SpatialEntity[], bodyMap: Map<string, CelestialBody>): void {
    console.group("📊 Position Adjustment Samples");
    
    // Find a few parent-child relationships to inspect
    const samples: Array<{parent: SpatialEntity, child: SpatialEntity, originalChild: CelestialBody}> = [];
    
    // Find a planet-moon pair
    const planets = entities.filter(e => e.type === 'planet');
    for (const planet of planets) {
      const moons = entities.filter(e => e.parent === planet.id && e.type === 'moon');
      if (moons.length > 0) {
        const moon = moons[0];
        const originalMoon = bodyMap.get(moon.id);
        if (originalMoon) {
          samples.push({parent: planet, child: moon, originalChild: originalMoon});
          break;
        }
      }
    }
    
    // Find a lagrange point with children
    const lagrangePoints = entities.filter(e => e.type === 'lagrangepoint');
    for (const lp of lagrangePoints) {
      const stations = entities.filter(e => e.parent === lp.id && e.type === 'station');
      if (stations.length > 0) {
        const station = stations[0];
        const originalStation = bodyMap.get(station.id);
        if (originalStation) {
          samples.push({parent: lp, child: station, originalChild: originalStation});
          break;
        }
      }
    }
    
    // Find a planet with a landing zone
    for (const planet of planets) {
      const landingZones = entities.filter(e => e.parent === planet.id && e.type === 'landingzone');
      if (landingZones.length > 0) {
        const landingZone = landingZones[0];
        const originalLZ = bodyMap.get(landingZone.id);
        if (originalLZ) {
          samples.push({parent: planet, child: landingZone, originalChild: originalLZ});
          break;
        }
      }
    }
    
    // SPECIFIC TROUBLESHOOTING: Check Crusader's positioning
    console.group("🔍 Specific Entity Positioning Check");
    
    // 1. Check Crusader (should have Stanton as parent)
    const crusader = entities.find(e => e.name === "Crusader");
    if (crusader) {
      console.group("🪐 Crusader Position Check");
      const crusaderOriginal = bodyMap.get(crusader.id);
      console.log("Type:", crusader.type);
      console.log("ID:", crusader.id);
      console.log("Parent ID:", crusader.parent);
      
      // Check parent
      if (crusader.parent) {
        const stanton = entities.find(e => e.id === crusader.parent);
        if (stanton) {
          console.log("Parent found:", stanton.name);
          console.log("Parent Position:", stanton.position);
          console.log("Crusader Relative Position:", crusaderOriginal?.position);
          console.log("Crusader Absolute Position:", crusader.position);
          
          // Check if position was calculated correctly
          if (crusaderOriginal) {
            const expectedPosition = addVectors(stanton.position, crusaderOriginal.position);
            const positionCorrect = 
              Math.abs(expectedPosition.x - crusader.position.x) < 0.001 &&
              Math.abs(expectedPosition.y - crusader.position.y) < 0.001 &&
              Math.abs(expectedPosition.z - crusader.position.z) < 0.001;
            
            console.log("Expected Position:", expectedPosition);
            console.log("Position Calculation Correct:", positionCorrect ? "✅ Yes" : "❌ No");
          }
        } else {
          console.warn("❌ Crusader's parent entity not found in processed entities");
        }
      } else {
        console.warn("❌ Crusader has no parent reference - treated as root object");
      }
      console.groupEnd();
    } else {
      console.warn("❌ Crusader not found in processed entities");
    }
    
    // 2. Check Orison (should have Crusader as parent)
    const orison = entities.find(e => e.name === "Orison");
    if (orison) {
      console.group("🏙️ Orison Position Check");
      const orisonOriginal = bodyMap.get(orison.id);
      console.log("Type:", orison.type);
      console.log("ID:", orison.id);
      console.log("Parent ID:", orison.parent);
      
      // Check parent
      if (orison.parent) {
        const parent = entities.find(e => e.id === orison.parent);
        if (parent) {
          console.log("Parent found:", parent.name);
          console.log("Parent Position:", parent.position);
          console.log("Orison Relative Position:", orisonOriginal?.position);
          console.log("Orison Absolute Position:", orison.position);
          
          // Check if position was calculated correctly
          if (orisonOriginal) {
            const expectedPosition = addVectors(parent.position, orisonOriginal.position);
            const positionCorrect = 
              Math.abs(expectedPosition.x - orison.position.x) < 0.001 &&
              Math.abs(expectedPosition.y - orison.position.y) < 0.001 &&
              Math.abs(expectedPosition.z - orison.position.z) < 0.001;
            
            console.log("Expected Position:", expectedPosition);
            console.log("Position Calculation Correct:", positionCorrect ? "✅ Yes" : "❌ No");
          }
        } else {
          console.warn("❌ Orison's parent entity not found in processed entities");
        }
      } else {
        console.warn("❌ Orison has no parent reference - treated as root object");
      }
      console.groupEnd();
    } else {
      console.warn("❌ Orison not found in processed entities");
    }
    
    // 3. Check CRU-L1 and Shallow Fields Station
    const cruL1 = entities.find(e => e.name === "CRU-L1");
    if (cruL1) {
      console.group("📍 CRU-L1 Position Check");
      const cruL1Original = bodyMap.get(cruL1.id);
      console.log("Type:", cruL1.type);
      console.log("ID:", cruL1.id);
      console.log("Parent ID:", cruL1.parent);
      
      // Check parent
      if (cruL1.parent) {
        const parent = entities.find(e => e.id === cruL1.parent);
        if (parent) {
          console.log("Parent found:", parent.name);
          console.log("Parent Position:", parent.position);
          console.log("CRU-L1 Relative Position:", cruL1Original?.position);
          console.log("CRU-L1 Absolute Position:", cruL1.position);
          
          // Calculate and verify the position
          if (cruL1Original) {
            const expectedPosition = addVectors(parent.position, cruL1Original.position);
            const positionCorrect = 
              Math.abs(expectedPosition.x - cruL1.position.x) < 0.001 &&
              Math.abs(expectedPosition.y - cruL1.position.y) < 0.001 &&
              Math.abs(expectedPosition.z - cruL1.position.z) < 0.001;
            
            console.log("Expected Position:", expectedPosition);
            console.log("Position Calculation Correct:", positionCorrect ? "✅ Yes" : "❌ No");
          }
        } else {
          console.warn("❌ CRU-L1's parent entity not found in processed entities");
        }
      } else {
        console.warn("❌ CRU-L1 has no parent reference - treated as root object");
      }
      
      // Check for Shallow Fields Station
      const shallowFields = entities.find(e => e.name === "Shallow Fields Station");
      if (shallowFields) {
        console.group("🛰️ Shallow Fields Station Position Check");
        const shallowFieldsOriginal = bodyMap.get(shallowFields.id);
        console.log("Type:", shallowFields.type);
        console.log("ID:", shallowFields.id);
        console.log("Parent ID:", shallowFields.parent);
        
        // Check parent
        if (shallowFields.parent === cruL1.id) {
          console.log("Correctly parented to CRU-L1");
          console.log("CRU-L1 Position:", cruL1.position);
          console.log("Shallow Fields Relative Position:", shallowFieldsOriginal?.position);
          console.log("Shallow Fields Absolute Position:", shallowFields.position);
          
          // Calculate and verify the position
          if (shallowFieldsOriginal) {
            const expectedPosition = addVectors(cruL1.position, shallowFieldsOriginal.position);
            const positionCorrect = 
              Math.abs(expectedPosition.x - shallowFields.position.x) < 0.001 &&
              Math.abs(expectedPosition.y - shallowFields.position.y) < 0.001 &&
              Math.abs(expectedPosition.z - shallowFields.position.z) < 0.001;
            
            console.log("Expected Position:", expectedPosition);
            console.log("Position Calculation Correct:", positionCorrect ? "✅ Yes" : "❌ No");
          }
        } else {
          console.warn(`❌ Shallow Fields Station has incorrect parent: ${shallowFields.parent}, expected: ${cruL1.id}`);
        }
        console.groupEnd();
      } else {
        console.warn("❌ Shallow Fields Station not found in processed entities");
      }
      console.groupEnd();
    } else {
      console.warn("❌ CRU-L1 not found in processed entities");
    }
    
    console.groupEnd(); // End specific entity checks
    
    // Log the original samples
    if (samples.length === 0) {
      console.log("No parent-child relationships found to inspect");
    } else {
      samples.forEach(({parent, child, originalChild}, index) => {
        console.group(`Sample ${index + 1}: ${parent.type} (${parent.name}) → ${child.type} (${child.name})`);
        
        // Log the original relative position of the child
        console.log("Original Relative Position:", originalChild.position);
        
        // Log the parent absolute position
        console.log("Parent Absolute Position:", parent.position);
        
        // Log the child absolute position
        console.log("Child Absolute Position:", child.position);
        
        // Calculate and verify the position adjustment
        const expectedPosition = addVectors(parent.position, originalChild.position);
        const adjustmentCorrect = 
          Math.abs(expectedPosition.x - child.position.x) < 0.001 &&
          Math.abs(expectedPosition.y - child.position.y) < 0.001 &&
          Math.abs(expectedPosition.z - child.position.z) < 0.001;
        
        console.log("Expected Child Position:", expectedPosition);
        console.log("Position Adjustment Correct:", adjustmentCorrect ? "✅ Yes" : "❌ No");
        
        console.groupEnd();
      });
    }
    
    // Dump a sample of entity positions for debugging
    console.group("📋 Entity Position Dump (Sample)");
    
    // Limit to just a few key entity types we're troubleshooting
    const dumpCategories = ['planet', 'landingzone', 'station', 'lagrangepoint'];
    
    // Create a readable dump of entities by type
    dumpCategories.forEach(category => {
      console.group(`${category.charAt(0).toUpperCase() + category.slice(1)}s`);
      
      const categoryEntities = entities
        .filter(e => e.type === category)
        .slice(0, 5); // Limit to 5 per category to avoid flooding console
        
      categoryEntities.forEach(entity => {
        console.log(`${entity.name} (ID: ${entity.id})`);
        console.log(`  Parent: ${entity.parent || 'none'}`);
        console.log(`  Position: x=${entity.position.x}, y=${entity.position.y}, z=${entity.position.z}`);
        
        // If it has a parent, show distance
        if (entity.parent) {
          const parent = entities.find(e => e.id === entity.parent);
          if (parent) {
            const dx = entity.position.x - parent.position.x;
            const dy = entity.position.y - parent.position.y;
            const dz = entity.position.z - parent.position.z;
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
            console.log(`  Distance from parent: ${distance}`);
          }
        }
      });
      
      console.groupEnd();
    });
    
    console.groupEnd(); // End entity position dump
    
    console.groupEnd(); // End position adjustment samples
  }

  /**
   * Validate distances between parent-child entities to detect anomalies
   */
  private validateEntityDistances(processedEntities: Record<string, ProcessedEntity>): void {
    console.group('🔍 Validating parent-child distances');
    
    // Track entities with anomalous distances
    const anomalies: Array<{parent: ProcessedEntity, child: ProcessedEntity, distance: number, expectedMax: number}> = [];
    
    // Check each entity with a parent
    Object.values(processedEntities).forEach(entity => {
      if (entity.parent) {
        const parentEntity = processedEntities[entity.parent];
        if (parentEntity) {
          // Calculate distance between entity and parent
          const distance = Math.sqrt(
            Math.pow(entity.position.x - parentEntity.position.x, 2) +
            Math.pow(entity.position.y - parentEntity.position.y, 2) +
            Math.pow(entity.position.z - parentEntity.position.z, 2)
          );
          
          // Expected distance depends on entity and parent types
          let expectedMaxDistance = Infinity;
          let anomalyDetected = false;
          
          // Define expected distances based on celestial body types
          if (entity.entityType === 'moon' && parentEntity.entityType === 'planet') {
            // Moons should be within reasonable distance of planets
            expectedMaxDistance = 2000000; // 2 million km
            anomalyDetected = distance > expectedMaxDistance;
          } 
          else if (entity.entityType === 'station' && 
                  (parentEntity.entityType === 'planet' || 
                   parentEntity.entityType === 'moon' || 
                   parentEntity.entityType === 'lagrangepoint')) {
            // Stations should be relatively close to their parent
            expectedMaxDistance = 200000; // 200,000 km
            anomalyDetected = distance > expectedMaxDistance;
          }
          else if (entity.entityType === 'landingzone' && 
                  (parentEntity.entityType === 'planet' || parentEntity.entityType === 'moon')) {
            // Landing zones should be at surface level
            const surfaceThreshold = parentEntity.radius * 1.2; // Allow some margin above surface
            expectedMaxDistance = surfaceThreshold;
            anomalyDetected = distance > surfaceThreshold || distance < parentEntity.radius * 0.8;
          }
          else if (entity.entityType === 'planet' && parentEntity.entityType === 'star') {
            // Planets should be in reasonable orbital distance
            expectedMaxDistance = 200000000; // 200 million km
            anomalyDetected = distance > expectedMaxDistance || distance < 1000000; // Too close to star
          }
          
          // Add to anomalies if suspicious
          if (anomalyDetected) {
            anomalies.push({
              parent: parentEntity,
              child: entity,
              distance: distance,
              expectedMax: expectedMaxDistance
            });
          }
          
          // Update parent to track that it has children
          parentEntity.metadata.hasChildren = true;
        }
      }
    });
    
    // Report anomalies
    if (anomalies.length > 0) {
      console.warn(`⚠️ Found ${anomalies.length} entities with unusual distances from their parents:`);
      
      // Group anomalies by parent type
      const anomaliesByParentType: Record<string, typeof anomalies> = {};
      
      anomalies.forEach(anomaly => {
        const parentType = anomaly.parent.entityType;
        if (!anomaliesByParentType[parentType]) {
          anomaliesByParentType[parentType] = [];
        }
        anomaliesByParentType[parentType].push(anomaly);
      });
      
      // Log grouped by parent type
      Object.entries(anomaliesByParentType).forEach(([parentType, typeAnomalies]) => {
        console.group(`📊 ${parentType} parents with unusual child distances (${typeAnomalies.length}):`);
        
        typeAnomalies.forEach(anomaly => {
          console.log(`🚨 ${anomaly.child.name} (${anomaly.child.entityType}) is ${this.formatDistanceValue(anomaly.distance)} from parent ${anomaly.parent.name}`);
          console.log(`   Expected max: ${this.formatDistanceValue(anomaly.expectedMax)}`);
          
          // Calculate what the relative position should be (for reference)
          const relativePosition = {
            x: anomaly.child.position.x - anomaly.parent.position.x,
            y: anomaly.child.position.y - anomaly.parent.position.y,
            z: anomaly.child.position.z - anomaly.parent.position.z
          };
          
          console.log(`   Relative position: (${relativePosition.x}, ${relativePosition.y}, ${relativePosition.z})`);
          console.log(`   Original position: (${anomaly.child.metadata.originalPosition.x}, ${anomaly.child.metadata.originalPosition.y}, ${anomaly.child.metadata.originalPosition.z})`);
        });
        
        console.groupEnd();
      });
    } else {
      console.log('✅ All entity distances appear reasonable');
    }
    
    console.groupEnd();
  }
  
  /**
   * Get the raw distance value between two positions
   */
  private getDistanceValue(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }

  /**
   * Analyze a batch of celestial bodies to identify potential positioning inconsistencies
   * and determine if they appear to be using absolute or relative coordinates
   * 
   * @param bodies List of celestial bodies to analyze
   * @returns Analysis report with recommendations
   */
  public analyzeEntityPositions(bodies: CelestialBody[]): void {
    // This method now uses the strict parent-based rule for coordinate system classification
    // rather than heuristics based on magnitude.
    console.group("🔍 Entity Position Analysis");
    
    // Group bodies by type for analysis
    const bodiesByType = new Map<string, CelestialBody[]>();
    bodies.forEach(body => {
      const type = body.type.toLowerCase();
      if (!bodiesByType.has(type)) {
        bodiesByType.set(type, []);
      }
      bodiesByType.get(type)!.push(body);
    });
    
    // Count entities with and without parents
    const entitiesWithParents = bodies.filter(b => b.parent);
    const entitiesWithoutParents = bodies.filter(b => !b.parent);
    
    console.log(`Found ${entitiesWithParents.length} entities with parents (using relative coordinates)`);
    console.log(`Found ${entitiesWithoutParents.length} entities without parents (using absolute coordinates)`);
    
    // Find the star(s) - typically should be at or near origin and without a parent
    const stars = bodiesByType.get('star') || [];
    console.log(`Found ${stars.length} stars`);
    
    if (stars.length > 0) {
      stars.forEach(star => {
        const pos = star.position;
        const magnitude = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
        console.log(`Star ${star.name} position: (${pos.x}, ${pos.y}, ${pos.z}), magnitude: ${magnitude}`);
        
        if (magnitude > 1000000) {
          console.warn(`⚠️ Star ${star.name} appears to be far from origin - unusual for a star`);
        }
        
        if (star.parent) {
          console.warn(`⚠️ Star ${star.name} has a parent (${star.parent}) - unusual configuration`);
        }
      });
    }
    
    // Analyze planets - should have star as parent
    const planets = bodiesByType.get('planet') || [];
    console.log(`Found ${planets.length} planets`);
    
    if (planets.length > 0) {
      // Check for planets without parents
      const planetsWithoutParents = planets.filter(p => !p.parent);
      if (planetsWithoutParents.length > 0) {
        console.warn(`⚠️ Found ${planetsWithoutParents.length} planets without parent references:`);
        planetsWithoutParents.forEach(planet => {
          console.log(`  - ${planet.name}`);
        });
      }
      
      // Calculate magnitudes for reference only
      let totalMagnitude = 0;
      planets.forEach(planet => {
        const pos = planet.position;
        const magnitude = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
        totalMagnitude += magnitude;
        
        // Log potentially suspicious planets
        if (magnitude > 200000000 && planet.parent) {
          console.warn(`⚠️ Planet ${planet.name} has very large position values despite having parent ${planet.parent}`);
          console.log(`  Position: (${pos.x}, ${pos.y}, ${pos.z}), magnitude: ${magnitude}`);
        }
      });
      
      const avgMagnitude = totalMagnitude / planets.length;
      console.log(`Average planet position magnitude: ${avgMagnitude} (for reference only)`);
    }
    
    // Analyze moons - must have planet parents
    const moons = bodiesByType.get('moon') || [];
    console.log(`Found ${moons.length} moons`);
    
    if (moons.length > 0) {
      // Check for moons without parents
      const moonsWithoutParents = moons.filter(m => !m.parent);
      if (moonsWithoutParents.length > 0) {
        console.warn(`⚠️ Found ${moonsWithoutParents.length} moons without parent references:`);
        moonsWithoutParents.forEach(moon => {
          console.log(`  - ${moon.name}`);
        });
      }
      
      // Find moons with suspiciously large position values
      const moonsWithLargePositions = moons.filter(moon => {
        const pos = moon.position;
        const magnitude = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
        return magnitude > 10000000; // 10 million units threshold
      });
      
      if (moonsWithLargePositions.length > 0) {
        console.warn(`⚠️ Found ${moonsWithLargePositions.length} moons with suspiciously large position values:`);
        moonsWithLargePositions.forEach(moon => {
          const pos = moon.position;
          const magnitude = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
          console.log(`  - ${moon.name} (parent: ${moon.parent}): magnitude ${magnitude}`);
        });
      }
    }
    
    // Check landing zones
    const landingZones = bodies.filter(b => b.type.toLowerCase() === 'landingzone');
    if (landingZones.length > 0) {
      console.log(`Found ${landingZones.length} landing zones`);
      
      // Check if landing zones have parent references
      const missingParents = landingZones.filter(lz => !lz.parent);
      if (missingParents.length > 0) {
        console.warn(`⚠️ ${missingParents.length} landing zones have no parent reference`);
        missingParents.forEach(lz => {
          console.warn(`  ${lz.name} missing parent reference`);
        });
      }
    }
    
    // Analyze and group entities with suspiciously large position values
    console.group("🔍 Entities with potentially incorrect coordinates");
    
    // Group by parent and type for better analysis
    const suspiciousEntities = entitiesWithParents.filter(entity => {
      const pos = entity.position;
      const magnitude = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
      return magnitude > 10000000; // 10 million units threshold
    });
    
    if (suspiciousEntities.length > 0) {
      console.warn(`⚠️ Found ${suspiciousEntities.length} entities with suspiciously large position values despite having parents`);
      
      // Group by entity type
      const suspiciousByType = new Map<string, CelestialBody[]>();
      suspiciousEntities.forEach(entity => {
        const type = entity.type.toLowerCase();
        if (!suspiciousByType.has(type)) {
          suspiciousByType.set(type, []);
        }
        suspiciousByType.get(type)!.push(entity);
      });
      
      // Log summary by type
      suspiciousByType.forEach((entities, type) => {
        console.log(`Found ${entities.length} suspicious ${type}s:`);
        entities.forEach(entity => {
          const magnitude = Math.sqrt(
            entity.position.x * entity.position.x + 
            entity.position.y * entity.position.y + 
            entity.position.z * entity.position.z
          );
          console.log(`  - ${entity.name} (parent: ${entity.parent}): magnitude ${magnitude}`);
        });
      });
    } else {
      console.log('✅ No entities with suspicious position values detected');
    }
    
    console.groupEnd();
    
    // Final assessment and recommendations
    console.group("📋 Coordinate System Assessment");
    console.log(`Strict Parent-Based Rule: ${entitiesWithoutParents.length} entities use absolute coordinates, ${entitiesWithParents.length} use relative`);
    
    if (suspiciousEntities.length > 0) {
      console.warn(`⚠️ ${suspiciousEntities.length} entities have suspicious position values and should be checked manually`);
    }
    
    console.log('🔧 Recommendation: Following the strict parent-based rule for coordinates:');
    console.log('  - All entities without parents use absolute coordinates');
    console.log('  - All entities with parents use coordinates relative to their parent');
    console.log('  - No exceptions based on magnitude or entity type');
    
    console.groupEnd();
    console.groupEnd();
  }

  /**
   * Get an emoji representing the entity type
   */
  private getTypeEmoji(type: string): string {
    switch(type.toLowerCase()) {
      case 'star': return '☀️';
      case 'planet': return '🌍';
      case 'moon': return '🌙';
      case 'jumppoint': return '🌀';
      case 'lagrangepoint': return '📍';
      case 'station': return '🛰️';
      case 'commarray': return '📡';
      case 'landingzone': return '🛬';
      default: return '🔹';
    }
  }

  /**
   * Normalize entity type to a standard format
   */
  private normalizeEntityType(type: string): string {
    const normalized = type.toLowerCase().trim();
    // Standardize naming conventions
    switch(normalized) {
      case 'star': return 'star';
      case 'planet': return 'planet';
      case 'moon': return 'moon';
      case 'jumppoint': case 'jump_point': case 'jump point': return 'jumppoint';
      case 'lagrangepoint': case 'lagrange_point': case 'lagrange point': return 'lagrangepoint';
      case 'landingzone': case 'landing_zone': case 'landing zone': return 'landingzone';
      case 'station': return 'station';
      case 'poi': case 'point_of_interest': case 'point of interest': return 'poi';
      case 'commarray': case 'comm_array': case 'comm array': return 'commarray';
      default: return normalized;
    }
  }

  // After the spatialIndex is created, add this code:
  private dumpHierarchyTree(entities: SpatialEntity[]): void {
    console.group('🌳 Celestial Hierarchy Tree');
    
    // Find the root entity (star)
    const rootEntities = entities.filter(e => !e.parent);
    if (rootEntities.length === 0) {
      console.log("No root entities found!");
      console.groupEnd();
      return;
    }
    
    // Create a map of children by parent ID
    const childrenByParent = new Map<string, SpatialEntity[]>();
    entities.forEach(entity => {
      if (entity.parent) {
        if (!childrenByParent.has(entity.parent)) {
          childrenByParent.set(entity.parent, []);
        }
        childrenByParent.get(entity.parent)!.push(entity);
      }
    });
    
    // Recursively print the hierarchy
    const printEntity = (entity: SpatialEntity, level: number, prefix: string = ''): void => {
      // Print entity info
      const indentation = '  '.repeat(level);
      const name = entity.name;
      const type = entity.type;
      
      console.log(`${prefix}${indentation}- ${name} (${type})`);
      
      // Get children
      const children = childrenByParent.get(entity.id) || [];
      
      // Sort children by type and then name
      children.sort((a, b) => {
        // First by type priority
        const typeOrder = { 'planet': 1, 'moon': 2, 'lagrangepoint': 3, 'station': 4, 'landingzone': 5 };
        const aOrder = typeOrder[a.type as keyof typeof typeOrder] || 99;
        const bOrder = typeOrder[b.type as keyof typeof typeOrder] || 99;
        
        if (aOrder !== bOrder) return aOrder - bOrder;
        
        // Then by name
        return a.name.localeCompare(b.name);
      });
      
      // Print each child with distances
      const lastIndex = children.length - 1;
      children.forEach((child, index) => {
        // Calculate distance between child and parent
        const distance = Math.sqrt(
          Math.pow(child.position.x - entity.position.x, 2) +
          Math.pow(child.position.y - entity.position.y, 2) +
          Math.pow(child.position.z - entity.position.z, 2)
        );
        
        // Format distance
        const distanceStr = this.formatDistanceValue(distance);
        
        // Check if distance is reasonable based on entity types
        let distanceOkay = true;
        if (entity.type === 'planet' && child.type === 'moon' && distance > 5000000) {
          distanceOkay = false; // Moons should be close to planets
        } else if (entity.type === 'lagrangepoint' && child.type === 'station' && distance > 100000) {
          distanceOkay = false; // Stations should be close to lagrange points
        } else if (entity.type === 'planet' && child.type === 'landingzone' && distance > (entity.radius || 1000000) * 1.5) {
          distanceOkay = false; // Landing zones should be at planet surface
        }
        
        // Status indicator
        const status = distanceOkay ? '✅' : '⚠️';
        
        // Print child with distance information
        const childPrefix = index === lastIndex ? '└── ' : '├── ';
        const nextLevelPrefix = index === lastIndex ? '    ' : '│   ';
        
        // Print this child
        console.log(`${prefix}${indentation}${childPrefix}${child.name} (${child.type}) [${distanceStr} from ${entity.name}] ${status}`);
        
        // Recursively print its children
        printEntity(child, 0, `${prefix}${indentation}${nextLevelPrefix}`);
      });
    };
    
    // Start with each root entity
    rootEntities.forEach(root => {
      printEntity(root, 0);
    });
    
    console.groupEnd();
  }
} 

