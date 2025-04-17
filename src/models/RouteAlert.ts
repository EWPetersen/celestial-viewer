import { Vector3 } from '../utils/coordinateUtils';

export type Region = 'us' | 'eu';
export type DistanceUnit = 'Gm' | 'Mm' | 'km' | 'm';
export type AlertType = 'interdiction' | 'pvp';

export interface RouteAlert {
  id: string;
  type: AlertType;
  region: Region;
  shard: number; // 010-300 in increments of 10
  originId: string;
  originName?: string; // Name of the origin for direct display
  destinationId?: string; // Optional for PvP alerts which might be at a specific location
  destinationName?: string; // Name of the destination for direct display
  locationId?: string; // Specific location ID for PvP alerts
  locationName?: string; // Name of the location for direct display
  position?: Vector3; // Specific position for alerts
  distanceTraveled?: number; // Distance traveled when interdiction occurred
  distanceUnit?: DistanceUnit;
  timestamp: Date;
  authorId: string;
  authorName?: string;
  confirmations: number;
  disputes: number;
  safetyScore: number; // Calculated based on confirmations vs disputes
  lastActivity: Date; // Updated when someone confirms or disputes
  nearestCelestialId?: string; // Nearest celestial body to the alert
  nearestCelestialDistance?: number; // Distance to the nearest celestial body
}

export interface RouteAlertInteraction {
  id: string;
  alertId: string;
  userId: string;
  userName?: string;
  action: 'confirm' | 'dispute';
  timestamp: Date;
}

// Convert any distance to meters (standard unit for calculations)
export const convertToMeters = (distance: number, unit: DistanceUnit): number => {
  switch(unit) {
    case 'Gm':
      return distance * 1000000000; // 1 Gm = 1,000,000,000 meters
    case 'Mm':
      return distance * 1000000; // 1 Mm = 1,000,000 meters
    case 'km':
      return distance * 1000; // 1 km = 1,000 meters
    case 'm':
    default:
      return distance;
  }
};

// Convert meters to a specified unit
export const convertFromMeters = (meters: number, unit: DistanceUnit): number => {
  switch(unit) {
    case 'Gm':
      return meters / 1000000000;
    case 'Mm':
      return meters / 1000000;
    case 'km':
      return meters / 1000;
    case 'm':
    default:
      return meters;
  }
};

// Calculate safety score based on confirmations and disputes
export const calculateSafetyScore = (confirmations: number, disputes: number): number => {
  if (confirmations === 0 && disputes === 0) {
    return 50; // Neutral if no interactions
  }
  
  const total = confirmations + disputes;
  const score = (confirmations / total) * 100;
  
  return Math.round(score);
};

// Check if an alert is still active based on its last activity timestamp
export const isAlertActive = (lastActivity: Date): boolean => {
  const now = new Date();
  const timeDiff = now.getTime() - lastActivity.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  return hoursDiff <= 24; // Active if less than 24 hours old
};

// Format a distance with appropriate unit
export const formatDistance = (distance: number, unit: DistanceUnit): string => {
  switch(unit) {
    case 'Gm':
      return `${distance.toLocaleString(undefined, { maximumFractionDigits: 2 })} Gm`;
    case 'Mm':
      return `${distance.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mm`;
    case 'km':
      return `${distance.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;
    case 'm':
    default:
      return `${distance.toLocaleString(undefined, { maximumFractionDigits: 0 })} m`;
  }
}; 