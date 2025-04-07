import { Vector3 } from '../utils/coordinateUtils';

export type Region = 'us' | 'eu';
export type Shard = '010' | '020' | '030' | '040' | '050' | '060' | '070' | '080' | '090' | '100' | 
                   '110' | '120' | '130' | '140' | '150' | '160' | '170' | '180' | '190' | '200';
export type DistanceUnit = 'km' | 'Mm' | 'Gm';

export interface RouteAlert {
  id: string;
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  authorId: string;
  authorName: string;
  
  // Route info
  region: Region;
  shard: Shard;
  originCelestialBodyId: string;
  originCelestialBodyName: string;
  destinationCelestialBodyId: string;
  destinationCelestialBodyName: string;
  
  // Distance info
  distance: number;
  distanceUnit: DistanceUnit;
  
  // Calculated values
  absoluteDistance: number; // Calculated distance in meters between bodies
  
  // Safety score
  safetyScore: number;
  
  // Confirmations and disputes
  confirmations: string[]; // Array of user IDs who confirmed
  disputes: string[]; // Array of user IDs who disputed
}

export interface RouteAlertCreationData {
  region: Region;
  shard: Shard;
  originCelestialBodyId: string;
  destinationCelestialBodyId: string;
  distance: number;
  distanceUnit: DistanceUnit;
}

/**
 * Calculate the absolute distance between two Vector3 positions
 */
export const calculateDistance = (position1: Vector3, position2: Vector3): number => {
  const dx = position2.x - position1.x;
  const dy = position2.y - position1.y;
  const dz = position2.z - position1.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/**
 * Convert distance from unit to meters
 */
export const convertToMeters = (distance: number, unit: DistanceUnit): number => {
  switch (unit) {
    case 'km':
      return distance * 1000;
    case 'Mm':
      return distance * 1000000;
    case 'Gm':
      return distance * 1000000000;
    default:
      return distance;
  }
};

/**
 * Convert distance from meters to specified unit
 */
export const convertFromMeters = (meters: number, unit: DistanceUnit): number => {
  switch (unit) {
    case 'km':
      return meters / 1000;
    case 'Mm':
      return meters / 1000000;
    case 'Gm':
      return meters / 1000000000;
    default:
      return meters;
  }
}; 