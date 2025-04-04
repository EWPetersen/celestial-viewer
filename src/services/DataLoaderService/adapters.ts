import { v4 as uuidv4 } from 'uuid';
import { CelestialBody, CelestialSystem, JumpPoint, PointOfInterest } from '../../stores/useAppStore';
import { ProcessedEntity, SystemData } from './interfaces';

/**
 * Converts a ProcessedEntity to a CelestialBody for the application store
 * @param entity The processed entity
 * @param systemData The complete system data
 * @returns A CelestialBody object
 */
export function entityToCelestialBody(
  entity: ProcessedEntity,
  systemData: SystemData
): CelestialBody {
  const celestialBody: CelestialBody = {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    parentId: entity.parent,
    radius: entity.size / 2, // Convert diameter to radius
    position: {
      x: entity.absolutePosition.x,
      y: entity.absolutePosition.y,
      z: entity.absolutePosition.z
    },
    // Add other properties as needed
    atmosphere: entity.atmoHeight > 0
  };
  
  return celestialBody;
}

/**
 * Converts a ProcessedEntity to a PointOfInterest for the application store
 * @param entity The processed entity
 * @param systemData The complete system data
 * @returns A PointOfInterest object
 */
export function entityToPointOfInterest(
  entity: ProcessedEntity,
  systemData: SystemData
): PointOfInterest {
  const poi: PointOfInterest = {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    parentId: entity.parent,
    size: entity.size,
    position: {
      x: entity.absolutePosition.x,
      y: entity.absolutePosition.y,
      z: entity.absolutePosition.z
    }
  };
  
  return poi;
}

/**
 * Converts a ProcessedEntity to a JumpPoint for the application store
 * @param entity The processed entity
 * @returns A JumpPoint object
 */
export function entityToJumpPoint(entity: ProcessedEntity): JumpPoint {
  const jumpPoint: JumpPoint = {
    id: entity.id,
    name: entity.name,
    type: 'jumppoint',
    parentId: entity.parent,
    destinationSystem: 'Unknown', // Would need additional data to determine this
    position: {
      x: entity.absolutePosition.x,
      y: entity.absolutePosition.y,
      z: entity.absolutePosition.z
    },
    size: entity.size
  };
  
  return jumpPoint;
}

/**
 * Converts the processed system data to the CelestialSystem format expected by the application
 * @param systemData The processed system data from the DataLoader
 * @returns A CelestialSystem object for the application store
 */
export function systemDataToCelestialSystem(systemData: SystemData): CelestialSystem {
  // Validate the system data structure
  if (!systemData || typeof systemData !== 'object') {
    throw new Error('Invalid system data: data is not an object');
  }
  
  if (!systemData.root) {
    throw new Error('Invalid system data: missing root ID');
  }
  
  if (!systemData.entities || Object.keys(systemData.entities).length === 0) {
    throw new Error('Invalid system data: no entities found');
  }
  
  console.log('Converting system data to CelestialSystem format', {
    rootId: systemData.root,
    totalEntities: Object.keys(systemData.entities).length
  });

  // Get the root entity
  const rootEntity = systemData.entities[systemData.root];
  if (!rootEntity) {
    console.error('System data structure:', {
      rootId: systemData.root,
      entityIds: Object.keys(systemData.entities),
      entityCount: Object.keys(systemData.entities).length
    });
    throw new Error('Root entity not found in system data');
  }
  
  // Validate root entity is the Stanton star
  if (rootEntity.type !== 'star' || rootEntity.name !== 'Stanton') {
    throw new Error(`Root entity must be Stanton (star), found ${rootEntity.name} (${rootEntity.type})`);
  }
  
  // Initialize collections
  const celestialBodies: CelestialBody[] = [];
  const pointsOfInterest: PointOfInterest[] = [];
  const jumpPoints: JumpPoint[] = [];
  
  // Process all entities and sort them into the appropriate collections
  Object.values(systemData.entities).forEach(entity => {
    switch (entity.type) {
      case 'star':
      case 'planet':
      case 'moon':
        celestialBodies.push(entityToCelestialBody(entity, systemData));
        break;
        
      case 'jumppoint':
        jumpPoints.push(entityToJumpPoint(entity));
        break;
        
      case 'station':
      case 'outpost':
      case 'landingzone':
      case 'reststop':
      case 'commarray':
        pointsOfInterest.push(entityToPointOfInterest(entity, systemData));
        break;
        
      default:
        // Treat unknown types as points of interest
        pointsOfInterest.push(entityToPointOfInterest(entity, systemData));
    }
  });
  
  // Log the results for debugging
  console.log('Processed entities:', {
    celestialBodies: celestialBodies.length,
    pointsOfInterest: pointsOfInterest.length,
    jumpPoints: jumpPoints.length
  });
  
  // Create the CelestialSystem object
  const celestialSystem: CelestialSystem = {
    systemName: rootEntity.name,
    description: `The ${rootEntity.name} system`,
    rootId: systemData.root,
    starType: 'G-type', // This would need to come from additional data
    coordinates: {
      x: rootEntity.absolutePosition.x,
      y: rootEntity.absolutePosition.y,
      z: rootEntity.absolutePosition.z
    },
    celestialBodies,
    jumpPoints,
    pointsOfInterest
  };
  
  return celestialSystem;
} 