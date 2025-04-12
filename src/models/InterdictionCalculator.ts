import { Vector3 } from '../utils/coordinateUtils';
import { DistanceUnit, Region } from './RouteAlert';

export interface InterdictionCalculation {
  id: string;
  name?: string;
  region: Region;
  shard: number;
  authorId: string;
  authorName?: string;
  timestamp: Date;
  originId: string;
  destinationId: string;
  optimalInterdictionPoints: InterdictionPoint[];
  isPublic: boolean;
  likes: number;
  shares: number;
}

export interface InterdictionPoint {
  id: string;
  position: Vector3;
  distanceFromOrigin: number;
  distanceUnit: DistanceUnit;
  successProbability: number; // 0-100 percentage
  nearestCelestialId?: string;
  nearestCelestialDistance?: number;
}

// Constants for interdiction calculations
export const SNARE_DIAMETER_KM = 20; // 20 km diameter for snare
export const SNARE_RADIUS_M = 10000; // 10,000 meters radius

// Calculate optimal interdiction points between two celestial bodies
export const calculateOptimalInterdictionPoints = (
  origin: { id: string; position: Vector3; obstructionRadius: number; arrivalRadius: number },
  destination: { id: string; position: Vector3; obstructionRadius: number; arrivalRadius: number },
  numPoints: number = 3
): InterdictionPoint[] => {
  // Calculate direct vector from origin to destination
  const direction = {
    x: destination.position.x - origin.position.x,
    y: destination.position.y - origin.position.y,
    z: destination.position.z - origin.position.z
  };
  
  // Calculate total distance
  const totalDistance = Math.sqrt(
    direction.x * direction.x + 
    direction.y * direction.y + 
    direction.z * direction.z
  );
  
  // Normalize direction vector
  const normalizedDirection = {
    x: direction.x / totalDistance,
    y: direction.y / totalDistance,
    z: direction.z / totalDistance
  };
  
  const points: InterdictionPoint[] = [];
  
  // Calculate minimum and maximum distance for interdiction
  // Account for obstructionRadius (minimum distance from origin to use QT)
  // and arrivalRadius (distance at which QT ends at destination)
  const minDistance = origin.obstructionRadius + SNARE_RADIUS_M;
  const maxDistance = totalDistance - (destination.arrivalRadius + SNARE_RADIUS_M);
  
  // Calculate usable distance range
  const usableDistance = maxDistance - minDistance;
  
  // If usable distance is too small, return empty array
  if (usableDistance <= 0) {
    return points;
  }
  
  // Calculate optimal points along the route
  for (let i = 0; i < numPoints; i++) {
    // Calculate position along route (distribute evenly)
    const fraction = (i + 1) / (numPoints + 1);
    const distance = minDistance + (usableDistance * fraction);
    
    // Calculate position
    const position = {
      x: origin.position.x + (normalizedDirection.x * distance),
      y: origin.position.y + (normalizedDirection.y * distance),
      z: origin.position.z + (normalizedDirection.z * distance)
    };
    
    // Calculate success probability
    // Higher in the middle of the route, lower near endpoints
    const successProbability = calculateSuccessProbability(fraction);
    
    points.push({
      id: `interdiction-${i}`,
      position,
      distanceFromOrigin: distance,
      distanceUnit: 'm',
      successProbability
    });
  }
  
  return points;
};

// Calculate success probability based on position along route
const calculateSuccessProbability = (fraction: number): number => {
  // Highest probability in the middle of the route (around 0.5)
  // Lower near the endpoints
  const deviation = Math.abs(fraction - 0.5);
  const baseProbability = 90; // Base probability percentage
  const reductionFactor = 60; // Maximum reduction percentage
  
  return Math.round(baseProbability - (deviation * reductionFactor));
}; 