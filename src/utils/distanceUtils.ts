import { Vector3, subtractVectors } from './coordinateUtils';

/**
 * Calculates the Euclidean distance between two 3D points
 */
export function calculateDistance(point1: Vector3, point2: Vector3): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z - point1.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculates the squared distance between two 3D points
 * (more efficient when only comparing distances)
 */
export function calculateSquaredDistance(point1: Vector3, point2: Vector3): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z - point1.z;
  
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Convert astronomical units (AU) to meters
 */
export function auToMeters(au: number): number {
  // 1 AU = 149,597,870,700 meters
  return au * 149597870700;
}

/**
 * Convert meters to astronomical units (AU)
 */
export function metersToAu(meters: number): number {
  return meters / 149597870700;
}

/**
 * Convert light years to meters
 */
export function lightYearsToMeters(ly: number): number {
  // 1 light year = 9,460,730,472,580,800 meters
  return ly * 9460730472580800;
}

/**
 * Convert meters to light years
 */
export function metersToLightYears(meters: number): number {
  return meters / 9460730472580800;
}

/**
 * Calculate scale factor for rendering objects at different distances
 * to maintain visibility while preserving relative sizes
 */
export function calculateScaleFactor(
  distanceFromCamera: number,
  minScale: number = 0.001,
  maxScale: number = 1,
  referenceDistance: number = 1000000000 // 1,000,000 km
): number {
  // Logarithmic scaling to make distant objects visible while maintaining scale for closer objects
  const normalizedDistance = Math.max(1, distanceFromCamera / referenceDistance);
  const logScale = 1 / Math.log10(normalizedDistance + 1);
  
  // Clamp to min/max scale
  return Math.min(maxScale, Math.max(minScale, logScale));
}

/**
 * Calculates travel time between two points given a constant speed
 * @param startPosition Starting position
 * @param endPosition End position
 * @param speed Speed in meters per second
 * @returns Travel time in seconds
 */
export function calculateTravelTime(
  startPosition: Vector3,
  endPosition: Vector3,
  speed: number
): number {
  const distance = calculateDistance(startPosition, endPosition);
  return distance / speed;
}

/**
 * Calculate the relative velocity between two objects
 * @param position1 Position of first object
 * @param velocity1 Velocity of first object
 * @param position2 Position of second object
 * @param velocity2 Velocity of second object
 * @returns Relative velocity vector
 */
export function calculateRelativeVelocity(
  velocity1: Vector3,
  velocity2: Vector3
): Vector3 {
  return subtractVectors(velocity2, velocity1);
}

/**
 * Format a large distance to a human-readable string with appropriate units
 */
export function formatDistance(meters: number): string {
  if (meters >= lightYearsToMeters(0.1)) {
    // For very large distances, use light years
    const ly = metersToLightYears(meters);
    return `${ly.toFixed(2)} ly`;
  } else if (meters >= auToMeters(0.1)) {
    // For large distances, use AU
    const au = metersToAu(meters);
    return `${au.toFixed(2)} AU`;
  } else if (meters >= 1000000) {
    // For medium distances, use millions of kilometers
    return `${(meters / 1000000).toFixed(2)} Mkm`;
  } else if (meters >= 1000) {
    // For small distances, use kilometers
    return `${(meters / 1000).toFixed(2)} km`;
  } else {
    // For very small distances, use meters
    return `${meters.toFixed(2)} m`;
  }
} 