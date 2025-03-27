import { Vector3 } from './coordinateUtils';

/**
 * Checks if a value is a valid number
 */
export function isValidNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Validates that a value is within a specified range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return isValidNumber(value) && value >= min && value <= max;
}

/**
 * Validates a Vector3 object
 */
export function isValidVector3(vector: any): boolean {
  if (!vector || typeof vector !== 'object') return false;
  
  return (
    isValidNumber(vector.x) &&
    isValidNumber(vector.y) &&
    isValidNumber(vector.z)
  );
}

/**
 * Validates orbital parameters
 */
export interface OrbitParams {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  longitudeOfAscendingNode?: number;
  argumentOfPeriapsis?: number;
}

export function isValidOrbit(orbit: any): boolean {
  if (!orbit || typeof orbit !== 'object') return false;
  
  // Required parameters
  if (!isValidNumber(orbit.semiMajorAxis) || orbit.semiMajorAxis <= 0) return false;
  if (!isValidNumber(orbit.eccentricity) || orbit.eccentricity < 0 || orbit.eccentricity >= 1) return false;
  if (!isValidNumber(orbit.inclination)) return false;
  
  // Optional parameters
  if (orbit.longitudeOfAscendingNode !== undefined && !isValidNumber(orbit.longitudeOfAscendingNode)) return false;
  if (orbit.argumentOfPeriapsis !== undefined && !isValidNumber(orbit.argumentOfPeriapsis)) return false;
  
  return true;
}

/**
 * Validates a celestial body object
 */
export function isValidCelestialBody(body: any): boolean {
  if (!body || typeof body !== 'object') return false;
  
  // Required fields
  if (typeof body.id !== 'string' || !body.id) return false;
  if (typeof body.name !== 'string' || !body.name) return false;
  if (typeof body.type !== 'string' || !body.type) return false;
  
  // Position
  if (body.position && !isValidVector3(body.position)) return false;
  
  // Orbit
  if (body.orbit && !isValidOrbit(body.orbit)) return false;
  
  // Physical properties
  if (body.radius !== undefined && (!isValidNumber(body.radius) || body.radius <= 0)) return false;
  if (body.mass !== undefined && (!isValidNumber(body.mass) || body.mass <= 0)) return false;
  
  return true;
}

/**
 * Validates a route between celestial bodies
 */
export interface RoutePoint {
  position: Vector3;
  timestamp: number;
}

export function isValidRoute(route: any): boolean {
  if (!Array.isArray(route) || route.length < 2) return false;
  
  for (const point of route) {
    if (!point || typeof point !== 'object') return false;
    if (!isValidVector3(point.position)) return false;
    if (!isValidNumber(point.timestamp)) return false;
  }
  
  // Check that timestamps are in ascending order
  for (let i = 1; i < route.length; i++) {
    if (route[i].timestamp <= route[i - 1].timestamp) return false;
  }
  
  return true;
}

/**
 * Clamp a number to a specified range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validates a URL string
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Checks if a string is a valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Sanitize a string for display (prevent XSS)
 */
export function sanitizeString(str: string): string {
  // Basic sanitization to prevent XSS
  return str.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#x27;';
      default: return char;
    }
  });
} 