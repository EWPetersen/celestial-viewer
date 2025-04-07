import { Vector3 } from '../../utils/coordinateUtils';
import * as THREE from 'three';

/**
 * Supported entity types for visualization
 */
export type EntityType = 
  | 'star'
  | 'planet'
  | 'moon'
  | 'station'
  | 'commarray'
  | 'landingzone'
  | 'lagrangepoint'
  | 'jumppoint'
  | 'reststop'
  | 'outpost'
  | 'unknown';

/**
 * Props for the EntityLabel component
 */
export interface EntityLabelProps {
  text: string;
  position: Vector3;
  size: number;
  distance?: number;
  visualScale?: number;
  color?: string;
  type?: string;
  renderPriority?: number;
  isSelected?: boolean;
  debugInfo?: string;
}

/**
 * Props for the CelestialMesh component
 */
export interface CelestialMeshProps {
  type: string;
  size: number;
  isSelected?: boolean;
  color?: string;
  name?: string;
}

/**
 * Props for the EntityRenderer component
 */
export interface EntityRendererProps {
  id: string;
  name: string;
  position: Vector3;
  size: number;
  type: string;
  isSelected?: boolean;
  selectable?: boolean;
  color?: string;
  showLabel?: boolean;
  showOrbits?: boolean;
  parentPosition?: Vector3 | null;
  relativePosition?: Vector3 | null;
  labelDistanceScale?: number;
}

/**
 * Material properties for entity visualization
 */
export interface EntityMaterialProps {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  transparent?: boolean;
  opacity?: number;
  wireframe?: boolean;
  side?: THREE.Side;
} 