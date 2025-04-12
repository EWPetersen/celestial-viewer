import { Vector3 } from '../utils/coordinateUtils';
import { DistanceUnit, Region } from './RouteAlert';

export interface SmartRoute {
  id: string;
  name: string;
  region: Region;
  shard: number;
  authorId: string;
  authorName?: string;
  timestamp: Date;
  waypoints: RouteWaypoint[];
  totalDistance: number;
  distanceUnit: DistanceUnit;
  estimatedTravelTime: number; // In seconds
  fuelRequired: number; // In mSCU
  fuelTankSize: number; // In mSCU
  fuelConsumptionRate: number; // mSCU per distance unit
  avoidDanger: boolean;
  isPublic: boolean;
  likes: number;
  shares: number;
}

export interface RouteWaypoint {
  id: string;
  name: string;
  entityId: string;
  entityType: string;
  position: Vector3;
  isRefuelStop: boolean;
  isRequired: boolean; // If true, user must stop here
  distanceFromPrevious?: number; // Distance from previous waypoint
  isOrigin: boolean;
  isDestination: boolean;
}

// Calculate fuel required for a route based on distance and consumption rate
export const calculateFuelRequired = (
  totalDistance: number, 
  fuelConsumptionRate: number,
  distanceUnit: DistanceUnit
): number => {
  // Convert distance to meters if needed
  const distanceInMeters = distanceUnit === 'km' 
    ? totalDistance * 1000 
    : totalDistance;
  
  // Calculate fuel required in mSCU
  return distanceInMeters * fuelConsumptionRate;
};

// Calculate if refuel stops are needed and insert them into the route
export const calculateRefuelStops = (
  waypoints: RouteWaypoint[],
  fuelTankSize: number,
  fuelConsumptionRate: number,
  refuelStations: { id: string; name: string; position: Vector3; entityType: string }[]
): RouteWaypoint[] => {
  if (waypoints.length < 2) return waypoints;
  
  const result: RouteWaypoint[] = [waypoints[0]]; // Start with origin
  let currentFuel = fuelTankSize;
  
  for (let i = 1; i < waypoints.length; i++) {
    const prevWaypoint = waypoints[i - 1];
    const currentWaypoint = waypoints[i];
    
    // Calculate distance to next waypoint
    const distance = calculateDistance(prevWaypoint.position, currentWaypoint.position);
    
    // Calculate fuel required for this leg
    const fuelForLeg = distance * fuelConsumptionRate;
    
    // Check if we need to refuel
    if (currentFuel < fuelForLeg) {
      // Find closest refuel station
      const closestStation = findClosestRefuelStation(
        prevWaypoint.position,
        currentWaypoint.position,
        refuelStations
      );
      
      if (closestStation) {
        // Add refuel stop
        const refuelWaypoint: RouteWaypoint = {
          id: `refuel-${closestStation.id}`,
          name: `Refuel at ${closestStation.name}`,
          entityId: closestStation.id,
          entityType: closestStation.entityType,
          position: closestStation.position,
          isRefuelStop: true,
          isRequired: false,
          isOrigin: false,
          isDestination: false,
          distanceFromPrevious: calculateDistance(prevWaypoint.position, closestStation.position)
        };
        
        result.push(refuelWaypoint);
        currentFuel = fuelTankSize;
        
        // Calculate remaining distance after refuel
        const remainingDistance = calculateDistance(closestStation.position, currentWaypoint.position);
        currentWaypoint.distanceFromPrevious = remainingDistance;
        
        // Update fuel
        currentFuel -= remainingDistance * fuelConsumptionRate;
      } else {
        // No refuel station found, might need to handle this case
        currentWaypoint.distanceFromPrevious = distance;
        currentFuel -= fuelForLeg;
      }
    } else {
      // Enough fuel for this leg
      currentWaypoint.distanceFromPrevious = distance;
      currentFuel -= fuelForLeg;
    }
    
    result.push(currentWaypoint);
  }
  
  return result;
};

// Helper function to calculate distance between two points
const calculateDistance = (point1: Vector3, point2: Vector3): number => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z - point1.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

// Helper function to find closest refuel station between two points
const findClosestRefuelStation = (
  from: Vector3,
  to: Vector3,
  stations: { id: string; name: string; position: Vector3; entityType: string }[]
): { id: string; name: string; position: Vector3; entityType: string } | null => {
  if (stations.length === 0) return null;
  
  // Calculate midpoint between from and to
  const midpoint: Vector3 = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
    z: (from.z + to.z) / 2
  };
  
  // Find station closest to midpoint
  let closestStation = stations[0];
  let closestDistance = calculateDistance(midpoint, stations[0].position);
  
  for (let i = 1; i < stations.length; i++) {
    const station = stations[i];
    const distance = calculateDistance(midpoint, station.position);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestStation = station;
    }
  }
  
  return closestStation;
}; 