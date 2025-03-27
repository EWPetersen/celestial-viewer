import { v4 as uuidv4 } from 'uuid';
import { Vector3 } from '../../utils/coordinateUtils';
import { calculateDistance } from '../../utils/distanceUtils';
import { Route, RouteWaypoint } from '../../stores/useAppStore';

/**
 * Service for calculating routes between celestial bodies
 */
export class RouteCalculationService {
  private static instance: RouteCalculationService;
  
  // Default speed in m/s for travel time calculations
  private defaultSpeed: number = 1000000; // 1,000 km/s

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of the RouteCalculationService
   */
  public static getInstance(): RouteCalculationService {
    if (!RouteCalculationService.instance) {
      RouteCalculationService.instance = new RouteCalculationService();
    }
    return RouteCalculationService.instance;
  }

  /**
   * Set the default travel speed
   * @param speed Speed in meters per second
   */
  public setDefaultSpeed(speed: number): void {
    this.defaultSpeed = speed;
  }

  /**
   * Calculate a direct route between two points
   * @param start Starting point
   * @param end Ending point
   * @param speed Optional speed in m/s (defaults to the service's defaultSpeed)
   * @returns Route object with distance and estimated travel time
   */
  public calculateDirectRoute(
    startWaypoint: RouteWaypoint,
    endWaypoint: RouteWaypoint,
    speed: number = this.defaultSpeed
  ): Route {
    const distance = calculateDistance(startWaypoint.position, endWaypoint.position);
    const estimatedTravelTime = distance / speed;

    const routeId = uuidv4();
    return {
      id: routeId,
      name: `${startWaypoint.name} to ${endWaypoint.name}`,
      waypoints: [startWaypoint, endWaypoint],
      distance,
      estimatedTravelTime,
      riskLevel: 'low'
    };
  }

  /**
   * Calculate a route with multiple waypoints
   * @param waypoints Array of waypoints in sequence
   * @param speed Optional speed in m/s (defaults to the service's defaultSpeed)
   * @returns Route object with total distance and estimated travel time
   */
  public calculateMultiPointRoute(
    waypoints: RouteWaypoint[],
    routeName: string,
    speed: number = this.defaultSpeed
  ): Route {
    if (waypoints.length < 2) {
      throw new Error('A route requires at least 2 waypoints');
    }

    let totalDistance = 0;

    // Calculate the total distance by summing the distances between consecutive waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
      const segment = calculateDistance(
        waypoints[i].position,
        waypoints[i + 1].position
      );
      totalDistance += segment;
    }

    const estimatedTravelTime = totalDistance / speed;
    const routeId = uuidv4();

    return {
      id: routeId,
      name: routeName,
      waypoints: [...waypoints],
      distance: totalDistance,
      estimatedTravelTime,
      riskLevel: this.calculateRiskLevel(waypoints)
    };
  }

  /**
   * Find the shortest path between multiple points using a simple greedy algorithm
   * Note: This is not optimal for many points, but works for simple routes
   * @param startPoint Starting point
   * @param intermediatePoints Points to visit (in any order)
   * @param endPoint Ending point
   * @param speed Optional speed in m/s
   * @returns Route object with optimized waypoint order
   */
  public findShortestPath(
    startWaypoint: RouteWaypoint,
    intermediateWaypoints: RouteWaypoint[],
    endWaypoint: RouteWaypoint,
    routeName: string,
    speed: number = this.defaultSpeed
  ): Route {
    // Start with the starting point
    const orderedWaypoints: RouteWaypoint[] = [startWaypoint];
    let currentPoint = startWaypoint.position;
    
    // Clone the intermediate points so we can modify the array
    const remainingWaypoints = [...intermediateWaypoints];
    
    // Greedy algorithm: always pick the closest next point
    while (remainingWaypoints.length > 0) {
      let closestIndex = 0;
      let closestDistance = calculateDistance(
        currentPoint,
        remainingWaypoints[0].position
      );
      
      // Find the closest remaining point
      for (let i = 1; i < remainingWaypoints.length; i++) {
        const distance = calculateDistance(
          currentPoint,
          remainingWaypoints[i].position
        );
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }
      
      // Add the closest point to our route
      const nextWaypoint = remainingWaypoints[closestIndex];
      orderedWaypoints.push(nextWaypoint);
      currentPoint = nextWaypoint.position;
      
      // Remove the point from the remaining list
      remainingWaypoints.splice(closestIndex, 1);
    }
    
    // Add the ending point
    orderedWaypoints.push(endWaypoint);
    
    // Calculate the route with the ordered waypoints
    return this.calculateMultiPointRoute(
      orderedWaypoints,
      routeName,
      speed
    );
  }

  /**
   * Find intermediate waypoints to avoid obstacles (simple implementation)
   * In a real system, this would use a more sophisticated algorithm
   * @param start Starting point
   * @param end Ending point
   * @param obstacles Array of obstacle positions and radii to avoid
   * @returns Array of waypoints that avoid the obstacles
   */
  public findSafeRoute(
    startWaypoint: RouteWaypoint,
    endWaypoint: RouteWaypoint,
    obstacles: Array<{ position: Vector3, radius: number }>,
    routeName: string,
    safetyMargin: number = 1.5, // Safety multiplier for obstacle avoidance
    speed: number = this.defaultSpeed
  ): Route {
    const waypoints: RouteWaypoint[] = [startWaypoint];
    const startPos = startWaypoint.position;
    const endPos = endWaypoint.position;
    
    // Vector from start to end
    const direction: Vector3 = {
      x: endPos.x - startPos.x,
      y: endPos.y - startPos.y,
      z: endPos.z - startPos.z
    };
    
    // For each obstacle, check if it intersects with the direct path
    for (const obstacle of obstacles) {
      // This is a simplified obstacle avoidance algorithm
      // In a real application, you would use more sophisticated path finding
      
      // Calculate the closest point on the line segment to the obstacle
      const t = this.closestPointOnLine(startPos, endPos, obstacle.position);
      
      if (t < 0 || t > 1) {
        // Obstacle is not in the path, skip to next
        continue;
      }
      
      // Calculate the closest point on the line
      const closestPoint: Vector3 = {
        x: startPos.x + t * direction.x,
        y: startPos.y + t * direction.y,
        z: startPos.z + t * direction.z
      };
      
      // Distance from the obstacle to the line
      const distToLine = calculateDistance(closestPoint, obstacle.position);
      
      // If the path goes through the obstacle (with safety margin)
      if (distToLine < obstacle.radius * safetyMargin) {
        // Create a waypoint to go around the obstacle
        // Simple solution: move perpendicular to the path
        
        // Find a perpendicular direction (cross product with up vector)
        const up: Vector3 = { x: 0, y: 1, z: 0 };
        const perpendicular: Vector3 = {
          x: direction.y * up.z - direction.z * up.y,
          y: direction.z * up.x - direction.x * up.z,
          z: direction.x * up.y - direction.y * up.x
        };
        
        // Normalize perpendicular vector
        const length = Math.sqrt(
          perpendicular.x * perpendicular.x +
          perpendicular.y * perpendicular.y +
          perpendicular.z * perpendicular.z
        );
        
        if (length === 0) {
          // If we have a problem with the perpendicular, try a different approach
          // Just offset in the x direction
          perpendicular.x = 1;
          perpendicular.y = 0;
          perpendicular.z = 0;
        } else {
          perpendicular.x /= length;
          perpendicular.y /= length;
          perpendicular.z /= length;
        }
        
        // Create waypoint offset from the obstacle
        // Position it at a safe distance from the obstacle
        const avoidanceDistance = obstacle.radius * safetyMargin * 1.5;
        const waypointPos: Vector3 = {
          x: obstacle.position.x + perpendicular.x * avoidanceDistance,
          y: obstacle.position.y + perpendicular.y * avoidanceDistance,
          z: obstacle.position.z + perpendicular.z * avoidanceDistance
        };
        
        // Add the avoidance waypoint
        const avoidanceWaypoint: RouteWaypoint = {
          id: uuidv4(),
          name: `Avoidance point near ${obstacle.position.x.toFixed(0)},${obstacle.position.y.toFixed(0)},${obstacle.position.z.toFixed(0)}`,
          position: waypointPos,
          type: 'custom'
        };
        
        waypoints.push(avoidanceWaypoint);
      }
    }
    
    // Add the end waypoint
    waypoints.push(endWaypoint);
    
    // Calculate the route with all the waypoints
    return this.calculateMultiPointRoute(
      waypoints,
      routeName,
      speed
    );
  }

  /**
   * Calculate the closest point on a line segment to a point
   * @param lineStart Start of the line segment
   * @param lineEnd End of the line segment
   * @param point Point to find closest position to
   * @returns Parameter t (0-1) representing position on the line segment
   */
  private closestPointOnLine(
    lineStart: Vector3,
    lineEnd: Vector3,
    point: Vector3
  ): number {
    const line: Vector3 = {
      x: lineEnd.x - lineStart.x,
      y: lineEnd.y - lineStart.y,
      z: lineEnd.z - lineStart.z
    };
    
    const lineLength = Math.sqrt(
      line.x * line.x + line.y * line.y + line.z * line.z
    );
    
    if (lineLength === 0) {
      return 0; // Start and end are the same point
    }
    
    // Normalize the line vector
    const normalizedLine: Vector3 = {
      x: line.x / lineLength,
      y: line.y / lineLength,
      z: line.z / lineLength
    };
    
    // Vector from line start to point
    const startToPoint: Vector3 = {
      x: point.x - lineStart.x,
      y: point.y - lineStart.y,
      z: point.z - lineStart.z
    };
    
    // Project startToPoint onto the line
    const projection = 
      startToPoint.x * normalizedLine.x +
      startToPoint.y * normalizedLine.y +
      startToPoint.z * normalizedLine.z;
    
    // Parameter t represents position on line segment (0 at start, 1 at end)
    const t = projection / lineLength;
    
    return t;
  }

  /**
   * Estimate the risk level of a route based on waypoints
   * This is a placeholder implementation
   */
  private calculateRiskLevel(waypoints: RouteWaypoint[]): string {
    // For now, we'll just use a simple heuristic based on distance
    const totalDistance = this.calculateTotalDistance(waypoints);
    
    if (totalDistance > 1e12) { // > 1 billion km
      return 'high';
    } else if (totalDistance > 1e11) { // > 100 million km
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate the total distance of a route
   */
  private calculateTotalDistance(waypoints: RouteWaypoint[]): number {
    let totalDistance = 0;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalDistance += calculateDistance(
        waypoints[i].position,
        waypoints[i + 1].position
      );
    }
    
    return totalDistance;
  }
}

// Export a default instance for easy imports
export default RouteCalculationService.getInstance(); 