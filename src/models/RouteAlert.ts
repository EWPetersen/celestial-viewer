import { Vector3 } from '../utils/coordinateUtils';

export type Region = 'us' | 'eu';
export type DistanceUnit = 'km' | 'm';
export type AlertType = 'interdiction' | 'pvp';

export interface RouteAlert {
  id: string;
  type: AlertType;
  region: Region;
  shard: number; // 010-300 in increments of 10
  originId: string;
  destinationId?: string; // Optional for PvP alerts which might be at a specific location
  locationId?: string; // Specific location ID for PvP alerts
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

// Convert meters to kilometers
export const metersToKilometers = (meters: number): number => {
  return meters / 1000;
};

// Convert kilometers to meters
export const kilometersToMeters = (kilometers: number): number => {
  return kilometers * 1000;
};

// Convert any distance to meters (standard unit for calculations)
export const convertToMeters = (distance: number, unit: DistanceUnit): number => {
  if (unit === 'km') {
    return kilometersToMeters(distance);
  }
  return distance;
};

// Convert meters to a specified unit
export const convertFromMeters = (meters: number, unit: DistanceUnit): number => {
  if (unit === 'km') {
    return metersToKilometers(meters);
  }
  return meters;
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
  if (unit === 'km') {
    return `${distance.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;
  }
  return `${distance.toLocaleString(undefined, { maximumFractionDigits: 0 })} m`;
}; 