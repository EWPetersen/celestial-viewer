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
 * Base interface for all celestial entities in the new format
 */
export interface CelestialEntity {
  id: string;
  name: string;
  display_name: string;
  type: string;
  parent?: string;
  size: number;
  arrivalRadius: number;
  obstructionRadius: number;
  atmoHeight?: number;
  jurisdiction?: string;
  adoptionRadius?: number;
  position_x?: number;
  position_y?: number;
  position_z?: number;
  rotation_x?: number;
  rotation_y?: number;
  rotation_z?: number;
  rotation_w?: number;
  description?: string;
  habitable?: boolean;
  minimum_orbit_alt?: number;
  maximum_orbit_alt?: number;
  qt_travel_alt?: number;
  position_source?: string;
  children?: CelestialEntity[];
}

/**
 * Processed entity with absolute position and other metadata
 */
export interface ProcessedEntity {
  id: string;
  name: string;
  display_name: string;
  type: string;
  parent: string | null;
  relativePosition: Position;
  absolutePosition: Position;
  arrivalRadius: number;
  atmoHeight?: number;
  obstructionRadius: number;
  size: number;
  jurisdiction?: string;
  description?: string;
  habitable?: boolean;
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