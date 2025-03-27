export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SphericalCoordinate {
  radius: number;
  theta: number; // polar angle in radians
  phi: number; // azimuthal angle in radians
}

/**
 * Converts cartesian coordinates to spherical coordinates
 */
export function cartesianToSpherical(vec: Vector3): SphericalCoordinate {
  const { x, y, z } = vec;
  const radius = Math.sqrt(x * x + y * y + z * z);
  
  // Handle the case where radius is 0 to avoid division by zero
  if (radius === 0) {
    return { radius: 0, theta: 0, phi: 0 };
  }
  
  const theta = Math.acos(z / radius);
  const phi = Math.atan2(y, x);
  
  return { radius, theta, phi };
}

/**
 * Converts spherical coordinates to cartesian coordinates
 */
export function sphericalToCartesian(spherical: SphericalCoordinate): Vector3 {
  const { radius, theta, phi } = spherical;
  
  const x = radius * Math.sin(theta) * Math.cos(phi);
  const y = radius * Math.sin(theta) * Math.sin(phi);
  const z = radius * Math.cos(theta);
  
  return { x, y, z };
}

/**
 * Adds two vectors
 */
export function addVectors(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  };
}

/**
 * Subtracts vector b from vector a
 */
export function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  };
}

/**
 * Scales a vector by a scalar
 */
export function scaleVector(vec: Vector3, scalar: number): Vector3 {
  return {
    x: vec.x * scalar,
    y: vec.y * scalar,
    z: vec.z * scalar
  };
}

/**
 * Calculates the dot product of two vectors
 */
export function dotProduct(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Calculates the cross product of two vectors
 */
export function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

/**
 * Normalizes a vector (makes it unit length)
 */
export function normalizeVector(vec: Vector3): Vector3 {
  const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
  
  // Handle zero-length vectors
  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  
  return {
    x: vec.x / length,
    y: vec.y / length,
    z: vec.z / length
  };
}

/**
 * Converts degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

/**
 * Converts radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

/**
 * Calculates a point on an elliptical orbit given the orbital parameters and a time value
 */
export function calculateOrbitPosition(
  semiMajorAxis: number,
  eccentricity: number,
  inclination: number, // in radians
  longitudeOfAscendingNode: number = 0, // in radians
  argumentOfPeriapsis: number = 0, // in radians
  meanAnomaly: number // in radians, 0 to 2π representing position in orbit
): Vector3 {
  // Eccentric anomaly - solve Kepler's equation using Newton-Raphson iteration
  let E = meanAnomaly;
  for (let i = 0; i < 10; i++) { // Usually converges within a few iterations
    E = E - (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E));
  }
  
  // Calculate position in orbital plane
  const semiMinorAxis = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity);
  const xOrbital = semiMajorAxis * (Math.cos(E) - eccentricity);
  const yOrbital = semiMinorAxis * Math.sin(E);
  
  // Apply orbital elements to transform to reference frame
  const cosLOAN = Math.cos(longitudeOfAscendingNode);
  const sinLOAN = Math.sin(longitudeOfAscendingNode);
  const cosAOP = Math.cos(argumentOfPeriapsis);
  const sinAOP = Math.sin(argumentOfPeriapsis);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  
  const xRef = (cosLOAN * cosAOP - sinLOAN * sinAOP * cosI) * xOrbital + (-cosLOAN * sinAOP - sinLOAN * cosAOP * cosI) * yOrbital;
  const yRef = (sinLOAN * cosAOP + cosLOAN * sinAOP * cosI) * xOrbital + (-sinLOAN * sinAOP + cosLOAN * cosAOP * cosI) * yOrbital;
  const zRef = sinAOP * sinI * xOrbital + cosAOP * sinI * yOrbital;
  
  return { x: xRef, y: yRef, z: zRef };
} 