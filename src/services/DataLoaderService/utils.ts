import { CelestialEntity, Position } from './interfaces';

/**
 * Validates that a position is defined using the new coordinate fields
 * @param entity The entity to validate position coordinates for
 * @returns True if the entity has valid position coordinates
 */
export function hasValidPositionCoordinates(entity: any): boolean {
  return (
    entity &&
    typeof entity === 'object' &&
    typeof entity.position_x === 'number' &&
    typeof entity.position_y === 'number' &&
    typeof entity.position_z === 'number'
  );
}

/**
 * Validates that an entity is the root Stanton entity in the new format
 * @param entity The entity to validate
 * @returns True if the entity is valid, false otherwise
 */
export function isValidRootEntity(entity: any): entity is CelestialEntity {
  return (
    entity &&
    typeof entity === 'object' &&
    typeof entity.id === 'string' &&
    entity.name === 'Stanton' &&
    typeof entity.display_name === 'string' &&
    entity.type.toLowerCase() === 'star' &&
    typeof entity.size === 'number' &&
    typeof entity.arrivalRadius === 'number' &&
    typeof entity.obstructionRadius === 'number' &&
    Array.isArray(entity.children)
  );
}

/**
 * Validates that an entity has the basic required properties in the new format
 * @param entity The entity to validate
 * @returns True if the entity is valid, false otherwise
 */
export function isValidEntity(entity: any): entity is CelestialEntity {
  // Check essential fields
  if (!entity || typeof entity !== 'object') return false;
  if (typeof entity.id !== 'string' || !entity.id) return false;
  if (typeof entity.name !== 'string' || !entity.name) return false;
  if (typeof entity.type !== 'string' || !entity.type) return false;
  
  // Check numeric properties if present
  if (entity.size !== undefined && typeof entity.size !== 'number') return false;
  if (entity.arrivalRadius !== undefined && typeof entity.arrivalRadius !== 'number') return false;
  if (entity.obstructionRadius !== undefined && typeof entity.obstructionRadius !== 'number') return false;
  
  // Position can be inferred from parent or derived, so it's okay if coordinates are missing
  // as long as there's a parent reference or position_source indicating where to get positions
  const hasPositionData = 
    hasValidPositionCoordinates(entity) || 
    typeof entity.parent === 'string' || 
    typeof entity.position_source === 'string';
  
  return hasPositionData;
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