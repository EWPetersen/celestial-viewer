import { Vector3 } from '../../utils/coordinateUtils';
import { calculateDistance } from '../../utils/distanceUtils';
import { RouteWaypoint } from '../../stores/useAppStore';

/**
 * Interface for an interdiction zone
 */
export interface InterdictionZone {
  id: string;
  name: string;
  position: Vector3;
  radius: number;
  threatLevel: 'low' | 'medium' | 'high';
  faction?: string;
  description?: string;
  active: boolean;
  detectionRange: number;
}

/**
 * Interface for interdiction check result
 */
export interface InterdictionCheckResult {
  isInZone: boolean;
  zone?: InterdictionZone;
  distance?: number;
  timeToReachZone?: number;
}

/**
 * Service for handling interdiction zones and threat assessment
 */
export class InterdictionService {
  private static instance: InterdictionService;
  private interdictionZones: InterdictionZone[] = [];

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of the InterdictionService
   */
  public static getInstance(): InterdictionService {
    if (!InterdictionService.instance) {
      InterdictionService.instance = new InterdictionService();
    }
    return InterdictionService.instance;
  }

  /**
   * Add an interdiction zone
   * @param zone The interdiction zone to add
   */
  public addInterdictionZone(zone: InterdictionZone): void {
    this.interdictionZones.push(zone);
  }

  /**
   * Add multiple interdiction zones
   * @param zones Array of interdiction zones to add
   */
  public addInterdictionZones(zones: InterdictionZone[]): void {
    this.interdictionZones.push(...zones);
  }

  /**
   * Remove an interdiction zone by ID
   * @param id ID of the zone to remove
   * @returns boolean indicating if a zone was removed
   */
  public removeInterdictionZone(id: string): boolean {
    const initialLength = this.interdictionZones.length;
    this.interdictionZones = this.interdictionZones.filter(zone => zone.id !== id);
    return this.interdictionZones.length < initialLength;
  }

  /**
   * Update an existing interdiction zone
   * @param updatedZone The updated zone data
   * @returns boolean indicating if a zone was updated
   */
  public updateInterdictionZone(updatedZone: InterdictionZone): boolean {
    const index = this.interdictionZones.findIndex(zone => zone.id === updatedZone.id);
    
    if (index === -1) {
      return false;
    }
    
    this.interdictionZones[index] = updatedZone;
    return true;
  }

  /**
   * Get all interdiction zones
   */
  public getAllInterdictionZones(): InterdictionZone[] {
    return [...this.interdictionZones];
  }

  /**
   * Get active interdiction zones
   */
  public getActiveInterdictionZones(): InterdictionZone[] {
    return this.interdictionZones.filter(zone => zone.active);
  }

  /**
   * Check if a position is within any interdiction zone
   * @param position The position to check
   * @returns Result indicating if the position is in an interdiction zone
   */
  public checkPosition(position: Vector3): InterdictionCheckResult {
    const activeZones = this.getActiveInterdictionZones();
    
    for (const zone of activeZones) {
      const distance = calculateDistance(position, zone.position);
      
      if (distance <= zone.radius) {
        return {
          isInZone: true,
          zone,
          distance
        };
      }
    }
    
    return { isInZone: false };
  }

  /**
   * Check if a route passes through any interdiction zones
   * @param waypoints The route waypoints to check
   * @returns Array of interdiction check results for each segment of the route
   */
  public checkRoute(waypoints: RouteWaypoint[]): InterdictionCheckResult[] {
    if (waypoints.length < 2) {
      return [];
    }
    
    const results: InterdictionCheckResult[] = [];
    const activeZones = this.getActiveInterdictionZones();
    
    // Check each segment of the route
    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i].position;
      const end = waypoints[i + 1].position;
      
      for (const zone of activeZones) {
        // Check if the line segment from start to end intersects with the zone
        const intersects = this.doesLineIntersectSphere(
          start,
          end,
          zone.position,
          zone.radius
        );
        
        if (intersects) {
          // Calculate the closest point on the line segment to the zone center
          const t = this.closestPointOnLine(start, end, zone.position);
          
          // Calculate the vector from start to end
          const direction = {
            x: end.x - start.x,
            y: end.y - start.y,
            z: end.z - start.z
          };
          
          // Calculate the closest point on the line segment
          const closestPoint = {
            x: start.x + t * direction.x,
            y: start.y + t * direction.y,
            z: start.z + t * direction.z
          };
          
          // Calculate distance from closest point to zone center
          const distance = calculateDistance(closestPoint, zone.position);
          
          results.push({
            isInZone: distance <= zone.radius,
            zone,
            distance
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Calculate the risk level of a route based on interdiction zones
   * @param waypoints The route waypoints to assess
   * @returns Risk level as a string ('low', 'medium', or 'high')
   */
  public calculateRouteRisk(waypoints: RouteWaypoint[]): string {
    const interdictionChecks = this.checkRoute(waypoints);
    
    if (interdictionChecks.some(check => check.isInZone && check.zone?.threatLevel === 'high')) {
      return 'high';
    } else if (interdictionChecks.some(check => check.isInZone && check.zone?.threatLevel === 'medium')) {
      return 'medium';
    } else if (interdictionChecks.some(check => check.isInZone)) {
      return 'low';
    } else {
      return 'safe';
    }
  }

  /**
   * Calculate if a line segment intersects with a sphere
   * @param lineStart Start point of the line segment
   * @param lineEnd End point of the line segment
   * @param sphereCenter Center of the sphere
   * @param sphereRadius Radius of the sphere
   * @returns Boolean indicating if there is an intersection
   */
  private doesLineIntersectSphere(
    lineStart: Vector3,
    lineEnd: Vector3,
    sphereCenter: Vector3,
    sphereRadius: number
  ): boolean {
    // Calculate the parameter t for the closest point on the line
    const t = this.closestPointOnLine(lineStart, lineEnd, sphereCenter);
    
    // If t is outside [0,1], closest point is one of the endpoints
    const closestT = Math.max(0, Math.min(1, t));
    
    // Calculate the position of the closest point on the line segment
    const closestPoint = {
      x: lineStart.x + closestT * (lineEnd.x - lineStart.x),
      y: lineStart.y + closestT * (lineEnd.y - lineStart.y),
      z: lineStart.z + closestT * (lineEnd.z - lineStart.z)
    };
    
    // Calculate the distance from the closest point to the sphere center
    const distance = calculateDistance(closestPoint, sphereCenter);
    
    // Intersection occurs if the distance is less than or equal to the radius
    return distance <= sphereRadius;
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
    const line = {
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
    const normalizedLine = {
      x: line.x / lineLength,
      y: line.y / lineLength,
      z: line.z / lineLength
    };
    
    // Vector from line start to point
    const startToPoint = {
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
    return projection / lineLength;
  }

  /**
   * Generate sample interdiction zones for development/testing
   * @returns Array of sample interdiction zones
   */
  public generateSampleInterdictionZones(systemName: string): InterdictionZone[] {
    if (systemName === 'Stanton') {
      return [
        {
          id: 'stanton_pirate_zone_1',
          name: 'Pirate Activity Near Yela',
          position: {
            x: -19485000000,
            y: 500000,
            z: -11270500000
          },
          radius: 5000000,
          threatLevel: 'medium',
          faction: 'Pirates',
          description: 'Known pirate activity near Yela. Approach with caution.',
          active: true,
          detectionRange: 7500000
        },
        {
          id: 'stanton_uee_checkpoint',
          name: 'UEE Security Checkpoint',
          position: {
            x: 28000000000,
            y: 4000000000,
            z: 1500000000
          },
          radius: 10000000,
          threatLevel: 'low',
          faction: 'UEE',
          description: 'UEE security forces monitor this area. Legal cargo only.',
          active: true,
          detectionRange: 15000000
        },
        {
          id: 'stanton_vanduul_incursion',
          name: 'Reported Vanduul Activity',
          position: {
            x: -25000000000,
            y: -2500000000,
            z: 7000000000
          },
          radius: 8000000,
          threatLevel: 'high',
          faction: 'Vanduul',
          description: 'Dangerous Vanduul raider activity reported. Extreme caution advised.',
          active: true,
          detectionRange: 12000000
        }
      ];
    }
    
    // Default empty array for other systems
    return [];
  }
}

// Export a default instance for easy imports
export default InterdictionService.getInstance(); 