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
  private dataPath: string = '/rc/stanton_extract.json';
  private cachedSystemData: SystemData | null = null;
  
  // Special entity types that should always use absolute positions
  private readonly ABSOLUTE_POSITION_TYPES = ['landingzone', 'reststop'];

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
    if (!isValidRootEntity(entity)) {
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
    
    if (rootEntity.type !== 'star' || rootEntity.name !== 'Stanton') {
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
    
    // Generate an ID for the root entity
    const rootId = uuidv4();
    
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
    
    // Generate a unique ID for this entity
    const entityId = uuidv4();
    
    // Compute the absolute position
    let absolutePosition: Position;
    
    // Special case: landingzone and reststop types always have absolute positions
    if (this.ABSOLUTE_POSITION_TYPES.includes(entity.type)) {
      absolutePosition = { ...entity.position };
    } else {
      // Normal case: Add this entity's relative position to parent's absolute position
      absolutePosition = addVectors(parentAbsolutePosition, entity.position);
    }
    
    // Create the processed entity
    const processedEntity: ProcessedEntity = {
      id: entityId,
      name: entity.name,
      type: entity.type,
      parent: parentId,
      relativePosition: { ...entity.position },
      absolutePosition,
      arrivalRadius: entity.arrivalRadius,
      atmoHeight: entity.atmoHeight,
      obstructionRadius: entity.obstructionRadius,
      size: entity.size,
      system_entity_name: entity.system_entity_name,
      children: []
    };
    
    // Add the entity to the system data
    systemData.entities[entityId] = processedEntity;
    
    // Add to the type index
    if (!systemData.entityByType[entity.type]) {
      systemData.entityByType[entity.type] = [];
    }
    systemData.entityByType[entity.type].push(entityId);
    
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
    if (!this.cachedSystemData || !this.cachedSystemData.entityByType[type]) {
      return [];
    }
    
    return this.cachedSystemData.entityByType[type].map(
      id => this.cachedSystemData!.entities[id]
    );
  }

  /**
   * Get all children of a specific entity
   * @param entityId Parent entity ID
   * @returns Array of child entities
   */
  public getChildrenOfEntity(entityId: string): ProcessedEntity[] {
    const entity = this.getEntityById(entityId);
    if (!entity || !entity.children.length) {
      return [];
    }
    
    return entity.children.map(
      childId => this.cachedSystemData!.entities[childId]
    ).filter(Boolean);
  }

  /**
   * Get the parent chain of an entity
   * @param entityId Entity ID
   * @returns Array of entities in the parent chain, from root to the entity
   */
  public getParentChain(entityId: string): ProcessedEntity[] {
    const result: ProcessedEntity[] = [];
    let currentEntity = this.getEntityById(entityId);
    
    while (currentEntity) {
      result.unshift(currentEntity); // Add to the beginning
      
      if (!currentEntity.parent) {
        break;
      }
      
      currentEntity = this.getEntityById(currentEntity.parent);
    }
    
    return result;
  }

  /**
   * Clear the cached data
   */
  public clearCache(): void {
    this.cachedSystemData = null;
  }
}

// Export a default instance for easy imports
export default DataLoader.getInstance(); 