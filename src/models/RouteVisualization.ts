import { Vector3 } from '../utils/coordinateUtils';
import { DistanceUnit } from './RouteAlert';
import CelestialIdMappingService from '../services/CelestialIdMappingService';

export type RouteType = 'interdiction' | 'pvp' | 'smartRoute' | 'interdictionCalculator';

export interface RouteVisualization {
  id: string;
  originId: string;
  destinationId: string;
  intermediatePoints?: { id: string; position: Vector3 }[];
  routeType: RouteType;
  color: string;
  animate?: boolean;
  alertData?: any; // Can be RouteAlert, SmartRoute, or InterdictionCalculation
  pathWidth?: number;
  pulsing?: boolean;
  startTime?: number;
  endTime?: number;
  distanceValue?: number | null;
  distanceUnit?: DistanceUnit;
  activityLevel?: number;
  useConstantSize?: boolean;
}

// Define visualization colors for different route types
export const routeTypeColors = {
  interdiction: '#ff0000', // Red
  pvp: '#ff0000', // Red
  smartRoute: '#00ff00', // Green
  interdictionCalculator: '#ff0000' // Red
};

// Helper to create a route visualization from alert data
export const createAlertVisualization = (alert: any): RouteVisualization => {
  // Get origin and destination directly from alert
  const originId = alert.originId || '';
  const destinationId = alert.destinationId || alert.locationId || '';
  
  // Ensure distance value is included for interdiction alerts
  // This is critical for correct positioning of the alert ping
  let distanceValue = null;
  let distanceUnit = 'km' as DistanceUnit;
  
  if (alert.type === 'interdiction') {
    // For interdiction alerts, require distance information
    if (alert.distanceTraveled !== undefined && alert.distanceTraveled !== null) {
      distanceValue = alert.distanceTraveled;
      distanceUnit = alert.distanceUnit || 'km';
    } else {
      // For alerts with missing distance, position at 50% of route by default
      alert.useDefaultPosition = true;
      
      // Set default to 50% along the route
      distanceValue = 0.5;
      distanceUnit = 'km';
    }
  } else {
    // For non-interdiction alerts (like PvP), place at destination
    alert.useDestinationPosition = true;
  }
  
  return {
    id: `alert-${alert.id}`,
    originId: originId,
    destinationId: destinationId,
    routeType: alert.type,
    color: routeTypeColors[alert.type as RouteType],
    pulsing: true,
    alertData: alert,
    pathWidth: 2,
    distanceValue: distanceValue,
    distanceUnit: distanceUnit,
    activityLevel: calculateActivityLevel(alert),
    useConstantSize: true // Enable constant sizing regardless of zoom level
  };
};

// Helper function to calculate activity level based on alert data
function calculateActivityLevel(alert: any): number {
  // Use safety score (higher = more active)
  if (alert.safetyScore) {
    return Math.max(0.3, Math.min(1.0, alert.safetyScore / 100));
  }
  
  // Use confirmations vs disputes if available
  if (typeof alert.confirmations === 'number' && typeof alert.disputes === 'number') {
    const total = alert.confirmations + alert.disputes;
    if (total === 0) return 0.5; // Default neutral value
    
    // Calculate activity level based on confirmations ratio
    return Math.max(0.3, Math.min(1.0, alert.confirmations / total));
  }
  
  return 0.5; // Default activity level
}

// Helper to create a route visualization from smart route data
export const createSmartRouteVisualization = (route: any): RouteVisualization => {
  // Extract origin and destination
  const origin = route.waypoints.find((wp: any) => wp.isOrigin);
  const destination = route.waypoints.find((wp: any) => wp.isDestination);
  
  // Extract waypoints for intermediate points
  const intermediatePoints = route.waypoints
    .filter((wp: any) => !wp.isOrigin && !wp.isDestination)
    .map((wp: any) => ({ id: wp.id, position: wp.position }));
  
  return {
    id: `smartroute-${route.id}`,
    originId: origin?.entityId,
    destinationId: destination?.entityId,
    intermediatePoints,
    routeType: 'smartRoute',
    color: routeTypeColors.smartRoute,
    animate: true,
    alertData: route,
    pathWidth: 2,
    distanceValue: route.distance || null,
    distanceUnit: route.distanceUnit || 'km',
    activityLevel: 0.7 // Default high activity level for smart routes
  };
};

// Helper to create a route visualization from interdiction calculation
export const createInterdictionCalculationVisualization = (calc: any): RouteVisualization => {
  return {
    id: `interdiction-calc-${calc.id}`,
    originId: calc.originId,
    destinationId: calc.destinationId,
    intermediatePoints: calc.optimalInterdictionPoints.map((point: any) => {
      return {
        id: point.id,
        position: point.position
      };
    }),
    routeType: 'interdictionCalculator',
    color: routeTypeColors.interdictionCalculator,
    animate: false,
    alertData: calc,
    pathWidth: 2,
    pulsing: true,
    distanceValue: calc.optimalDistance || null,
    distanceUnit: calc.distanceUnit || 'km',
    activityLevel: 0.9 // High activity level for interdiction points
  };
}; 