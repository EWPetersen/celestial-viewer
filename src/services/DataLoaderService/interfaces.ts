import { Vector3 } from '../../utils/coordinateUtils';

/**
 * Interface representing the position coordinates from the JSON
 */
export interface Position {
  x: number;
  y: number;
  z: number;
}

/**
 * Interface representing the rotation quaternion from the JSON
 */
export interface Rotation {
  w: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Interface representing orbital markers from the JSON
 */
export interface OrbitalMarkers {
  om1: Position | null;
  om2: Position | null;
  om3: Position | null;
  om4: Position | null;
  om5: Position | null;
  om6: Position | null;
}

/**
 * Base interface for all celestial entities
 */
export interface CelestialEntity {
  name: string;
  type: string;
  position: Position;
  arrivalRadius: number;
  atmoHeight: number;
  obstructionRadius: number;
  orbitalMarkers: OrbitalMarkers;
  rotation: Rotation;
  size: number;
  system_entity_name: string;
  children?: CelestialEntity[];
  absolutePosition?: Position; // Computed absolute position property
}

/**
 * Processed entity with absolute position and other metadata
 */
export interface ProcessedEntity {
  id: string;
  name: string;
  type: string;
  parent: string | null;
  relativePosition: Position;
  absolutePosition: Position;
  arrivalRadius: number;
  atmoHeight: number;
  obstructionRadius: number;
  size: number;
  system_entity_name: string;
  children: string[]; // Array of child entity IDs
}

/**
 * Main system data structure with processed entities
 */
export interface SystemData {
  root: string; // ID of the root entity
  entities: Record<string, ProcessedEntity>;
  entityByType: Record<string, string[]>; // Type to entity IDs mapping
} 