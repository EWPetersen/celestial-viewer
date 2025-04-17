import { v4 as uuidv4 } from 'uuid';
import { CelestialSystem } from '../../stores/useAppStore';
import { CelestialEntity, Position, ProcessedEntity, SystemData } from './interfaces';
import { addVectors } from '../../utils/coordinateUtils';
import { systemDataToCelestialSystem } from './adapters';
import { isValidRootEntity, isValidEntity, traverseEntityHierarchy } from './utils';

/**
 * DataLoaderService for loading and processing celestial data
 * This service handles fetching and parsing data from the JSON file
 * and computing absolute positions for all entities
 */
export class DataLoader {
  private static instance: DataLoader;
  private dataPath: string = '/rc/stanton_extract_new.json';
  private cachedSystemData: SystemData | null = null;
  
  // Special entity types that should always use absolute positions
  private readonly ABSOLUTE_POSITION_TYPES = ['landingzone', 'reststop', 'lagrangepoint', 'jumppoint'];

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance of the DataLoader
   */
  public static getInstance(): DataLoader {
    if (!DataLoader.instance) {
      DataLoader.instance = new DataLoader();
    }
    return DataLoader.instance;
  }

  /**
   * Set the path to the data file
   * @param path Path to the data file
   */
  public setDataPath(path: string): void {
    this.dataPath = path;
    // Reset cache when changing data source
    this.cachedSystemData = null;
  }

  /**
   * Validates the root entity from the JSON data
   * @param entity The entity to validate
   * @throws Error if the entity is not valid
   */
  private validateRootEntity(entity: CelestialEntity): void {
    if (!entity || !entity.id || !entity.name || !entity.type || entity.type.toLowerCase() !== 'star') {
      throw new Error('Invalid root entity: Does not match expected Stanton star structure');
    }
  }

  /**
   * Load and process the celestial system data
   * @param forceRefresh Force a refresh of the data (ignore cache)
   * @returns Promise with the processed system data
   */
  public async loadSystemData(forceRefresh: boolean = false): Promise<SystemData> {
    if (this.cachedSystemData && !forceRefresh) {
      return this.cachedSystemData;
    }

    try {
      // Fetch data from the configured path
      const response = await fetch(this.dataPath);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch celestial data: ${response.status} ${response.statusText}`);
      }
      
      // Parse the complete JSON response without any preprocessing
      const jsonData = await response.json() as CelestialEntity;
      
      // Validate the root entity
      this.validateRootEntity(jsonData);
      
      // Additional debugging to check entity structure
      const entityCounts: Record<string, number> = {};
      
      traverseEntityHierarchy(jsonData, [], (entity, path) => {
        entityCounts[entity.type] = (entityCounts[entity.type] || 0) + 1;
      });
      
      // Process the data and compute absolute positions
      const systemData = this.processSystemData(jsonData);
      
      // Cache the processed data
      this.cachedSystemData = systemData;
      return systemData;
      
    } catch (error) {
      throw new Error(`Error loading system data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Load and convert the data to the CelestialSystem format
   * used by the app store
   * @param forceRefresh Force a refresh of the data
   * @returns Promise with the CelestialSystem data
   */
  public async loadCelestialSystem(forceRefresh: boolean = false): Promise<CelestialSystem> {
    const systemData = await this.loadSystemData(forceRefresh);
    
    // Additional validation before conversion
    const rootEntity = systemData.entities[systemData.root];
    if (!rootEntity) {
      console.error('SystemData structure:', systemData);
      throw new Error('Root entity ID exists but entity not found in the entities map. This should never happen.');
    }
    
    if (rootEntity.type.toLowerCase() !== 'star' || rootEntity.name !== 'Stanton') {
      throw new Error(`Root entity validation failed. Expected Stanton (star), got ${rootEntity.name} (${rootEntity.type})`);
    }
    
    return systemDataToCelestialSystem(systemData);
  }

  /**
   * Process the raw JSON data into a structured SystemData object
   * @param rootEntity The root celestial entity from the JSON
   * @returns Processed SystemData
   */
  private processSystemData(rootEntity: CelestialEntity): SystemData {
    const entities: Record<string, ProcessedEntity> = {};
    const entityByType: Record<string, string[]> = {};
    
    // Use the entity's ID from the new data format
    const rootId = rootEntity.id;
    
    // Set up the base SystemData structure
    const systemData: SystemData = {
      root: rootId,
      entities,
      entityByType
    };
    
    // Process the root entity and its children recursively
    const processedRootId = this.processEntity(
      rootEntity,
      null, // Root has no parent
      { x: 0, y: 0, z: 0 }, // Root absolute position is (0,0,0)
      systemData
    );
    
    // Ensure the root ID is correct
    if (processedRootId && processedRootId !== rootId) {
      systemData.root = processedRootId;
    }
    
    // Validate that root entity was properly processed
    if (!processedRootId || !systemData.entities[systemData.root]) {
      throw new Error('Failed to process root entity');
    }
    
    return systemData;
  }

  /**
   * Process a single entity and its children recursively
   * @param entity The entity to process
   * @param parentId The ID of the parent entity
   * @param parentAbsolutePosition The absolute position of the parent
   * @param systemData The system data being built
   * @returns The ID of the processed entity
   */
  private processEntity(
    entity: CelestialEntity,
    parentId: string | null,
    parentAbsolutePosition: Position,
    systemData: SystemData
  ): string {
    // Skip null or invalid entries
    if (!isValidEntity(entity)) {
      console.warn('Skipping invalid entity:', entity);
      return '';
    }
    
    // Use the entity's ID from the new data format
    const entityId = entity.id;
    
    // Extract position from position_x, position_y, position_z fields
    const relativePosition: Position = {
      x: entity.position_x ?? 0,
      y: entity.position_y ?? 0,
      z: entity.position_z ?? 0
    };
    
    // Debug log for specific entity types with position issues
    const specialEntityTypes = ['lagrangepoint', 'jumppoint', 'landingzone', 'reststop', 'station', 'commarray'];
    const entityTypeLC = entity.type.toLowerCase();
    if (specialEntityTypes.includes(entityTypeLC)) {
      console.log(`[DataLoader] Processing ${entityTypeLC} - ${entity.name} (${entity.id})`);
      console.log(`[DataLoader] Raw position data: x:${entity.position_x}, y:${entity.position_y}, z:${entity.position_z}`);
      console.log(`[DataLoader] Parent position: x:${parentAbsolutePosition.x}, y:${parentAbsolutePosition.y}, z:${parentAbsolutePosition.z}`);
      console.log(`[DataLoader] Position source: ${entity.position_source}`);
    }
    
    // Compute the absolute position
    let absolutePosition: Position;
    
    // Special case: landingzone, reststop, and other specified types always use absolute positions
    if (this.ABSOLUTE_POSITION_TYPES.includes(entityTypeLC)) {
      // For these types, we want to check if they should be relative to parent
      const isDerivedFromParent = entity.position_source === "derived_from_parent";
      
      if (isDerivedFromParent) {
        // If position is derived from parent, add to parent position
        absolutePosition = addVectors(parentAbsolutePosition, relativePosition);
        
        if (specialEntityTypes.includes(entityTypeLC)) {
          console.log(`[DataLoader] ${entityTypeLC} position derived from parent: x:${absolutePosition.x}, y:${absolutePosition.y}, z:${absolutePosition.z}`);
        }
      } else {
        // Else use as absolute position (backward compatibility)
        absolutePosition = { ...relativePosition };
        
        if (specialEntityTypes.includes(entityTypeLC)) {
          console.log(`[DataLoader] ${entityTypeLC} using direct position: x:${absolutePosition.x}, y:${absolutePosition.y}, z:${absolutePosition.z}`);
        }
      }
    } else {
      // Normal case: Add this entity's relative position to parent's absolute position
      absolutePosition = addVectors(parentAbsolutePosition, relativePosition);
    }
    
    // Create the processed entity
    const processedEntity: ProcessedEntity = {
      id: entityId,
      name: entity.name,
      display_name: entity.display_name || entity.name,
      type: entityTypeLC,
      parent: parentId,
      relativePosition: { ...relativePosition },
      absolutePosition,
      arrivalRadius: entity.arrivalRadius,
      atmoHeight: entity.atmoHeight,
      obstructionRadius: entity.obstructionRadius,
      size: entity.size,
      jurisdiction: entity.jurisdiction,
      description: entity.description,
      habitable: entity.habitable,
      children: []
    };
    
    // Add the entity to the system data
    systemData.entities[entityId] = processedEntity;
    
    // Add to the type index
    if (!systemData.entityByType[entityTypeLC]) {
      systemData.entityByType[entityTypeLC] = [];
    }
    systemData.entityByType[entityTypeLC].push(entityId);
    
    // Process children recursively
    if (entity.children && entity.children.length > 0) {
      for (const child of entity.children) {
        const childId = this.processEntity(child, entityId, absolutePosition, systemData);
        if (childId) {
          processedEntity.children.push(childId);
        }
      }
    }
    
    return entityId;
  }

  /**
   * Get entity by ID
   * @param id Entity ID
   * @returns The entity or null if not found
   */
  public getEntityById(id: string): ProcessedEntity | null {
    if (!this.cachedSystemData) {
      return null;
    }
    return this.cachedSystemData.entities[id] || null;
  }

  /**
   * Get all entities of a specific type
   * @param type Entity type
   * @returns Array of entities of the specified type
   */
  public getEntitiesByType(type: string): ProcessedEntity[] {
    if (!this.cachedSystemData || !this.cachedSystemData.entityByType[type.toLowerCase()]) {
      return [];
    }
    
    const entityIds = this.cachedSystemData.entityByType[type.toLowerCase()];
    return entityIds.map(id => this.cachedSystemData!.entities[id]);
  }
  
  /**
   * Get all children of a specific entity
   * @param entityId The ID of the parent entity
   * @returns Array of child entities
   */
  public getChildrenOfEntity(entityId: string): ProcessedEntity[] {
    if (!this.cachedSystemData) {
      return [];
    }
    
    const entity = this.cachedSystemData.entities[entityId];
    if (!entity || !entity.children || entity.children.length === 0) {
      return [];
    }
    
    return entity.children
      .map(childId => this.cachedSystemData!.entities[childId])
      .filter(child => child !== undefined);
  }
  
  /**
   * Get the chain of parent entities for a given entity
   * @param entityId The ID of the entity
   * @returns Array of parent entities, from immediate parent to ultimate ancestor
   */
  public getParentChain(entityId: string): ProcessedEntity[] {
    const parentChain: ProcessedEntity[] = [];
    
    if (!this.cachedSystemData) {
      return parentChain;
    }
    
    let currentEntity = this.cachedSystemData.entities[entityId];
    
    while (currentEntity && currentEntity.parent) {
      const parentEntity = this.cachedSystemData.entities[currentEntity.parent];
      if (parentEntity) {
        parentChain.push(parentEntity);
        currentEntity = parentEntity;
      } else {
        break;
      }
    }
    
    return parentChain;
  }
  
  /**
   * Clear the cached system data
   */
  public clearCache(): void {
    this.cachedSystemData = null;
  }
}

// Export a default instance for easy imports
export default DataLoader.getInstance(); 