import { CelestialEntity, Position } from './interfaces';

/**
 * Validates that a position object has the required x, y, z properties
 * @param position The position object to validate
 * @returns True if the position is valid, false otherwise
 */
export function isValidPosition(position: any): position is Position {
  return (
    position &&
    typeof position === 'object' &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    typeof position.z === 'number'
  );
}

/**
 * Validates that an entity is the root Stanton entity
 * @param entity The entity to validate
 * @returns True if the entity is valid, false otherwise
 */
export function isValidRootEntity(entity: any): entity is CelestialEntity {
  return (
    entity &&
    typeof entity === 'object' &&
    entity.name === 'Stanton' &&
    entity.type === 'star' &&
    isValidPosition(entity.position) &&
    // Must have zero position for the root
    entity.position.x === 0.0 &&
    entity.position.y === 0.0 &&
    entity.position.z === 0.0 &&
    typeof entity.size === 'number' &&
    typeof entity.arrivalRadius === 'number' &&
    typeof entity.obstructionRadius === 'number' &&
    typeof entity.atmoHeight === 'number' &&
    Array.isArray(entity.children)
  );
}

/**
 * Validates that an entity has the basic required properties
 * @param entity The entity to validate
 * @returns True if the entity is valid, false otherwise
 */
export function isValidEntity(entity: any): entity is CelestialEntity {
  return (
    entity &&
    typeof entity === 'object' &&
    typeof entity.name === 'string' &&
    entity.name.length > 0 &&
    typeof entity.type === 'string' &&
    entity.type.length > 0 &&
    isValidPosition(entity.position) &&
    typeof entity.size === 'number' &&
    typeof entity.arrivalRadius === 'number' &&
    typeof entity.obstructionRadius === 'number' &&
    typeof entity.atmoHeight === 'number'
  );
}

/**
 * Helper function to safely traverse the entity hierarchy
 * and collect path information for debugging
 */
export function traverseEntityHierarchy(
  entity: CelestialEntity, 
  path: string[] = [],
  callback: (entity: CelestialEntity, path: string[]) => void
): void {
  if (!entity) return;
  
  const currentPath = [...path, entity.name];
  callback(entity, currentPath);
  
  if (entity.children && Array.isArray(entity.children)) {
    entity.children.forEach(child => {
      if (child) {
        traverseEntityHierarchy(child, currentPath, callback);
      }
    });
  }
}

/**
 * Safely get the value at a path in an object, returning undefined if the path doesn't exist
 */
export function getNestedValue(obj: any, path: string[]): any {
  return path.reduce((prev, curr) => (prev && prev[curr] !== undefined) ? prev[curr] : undefined, obj);
} 