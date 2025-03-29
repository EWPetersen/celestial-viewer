import * as THREE from 'three';

/**
 * Scene initialization utilities to help prevent uniform errors
 */

/**
 * Configures WebGL renderer with optimal settings for celestial visualization
 * to prevent uniform and material errors
 */
export const configureRenderer = (renderer: THREE.WebGLRenderer): void => {
  // Set clear color for better contrast with space objects
  renderer.setClearColor('#000000');
  
  // Enable physically correct lighting
  (renderer as any).physicallyCorrectLights = true;
  
  // Enable logarithmic depth buffer to handle astronomical scales
  (renderer as any).logarithmicDepthBuffer = true;
  
  // Set pixel ratio for better quality (but limit for performance)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Enable tone mapping for better visual appearance
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  // Set output color space
  renderer.outputColorSpace = THREE.SRGBColorSpace;
};

/**
 * Creates a default material that won't cause uniform errors
 * Can be used as a fallback for any mesh
 */
export const createSafeMaterial = (color = '#ff0000'): THREE.Material => {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.75,
    wireframe: false,
    side: THREE.DoubleSide,
  });
};

/**
 * Safely disposes of Three.js objects to prevent memory leaks
 */
export const disposeObject = (object: THREE.Object3D): void => {
  try {
    if (!object) return;

    // Recursively dispose of all children
    if (object.children.length > 0) {
      // Create a copy of the children array to avoid modification during iteration
      const children = [...object.children];
      for (const child of children) {
        disposeObject(child);
      }
    }

    // Dispose of geometries
    if ((object as THREE.Mesh).geometry) {
      (object as THREE.Mesh).geometry.dispose();
    }

    // Dispose of materials
    if ((object as THREE.Mesh).material) {
      const material = (object as THREE.Mesh).material;
      
      // Handle array of materials
      if (Array.isArray(material)) {
        material.forEach(mat => {
          if (!mat) return;
          
          // Dispose of material textures
          if (mat && typeof mat === 'object') {
            Object.values(mat).forEach(value => {
              if (value instanceof THREE.Texture) {
                value.dispose();
              }
            });
          }
          
          mat.dispose();
        });
      } 
      // Handle single material
      else if (material) {
        // Dispose of material textures
        if (typeof material === 'object') {
          Object.values(material).forEach(value => {
            if (value instanceof THREE.Texture) {
              value.dispose();
            }
          });
        }
        
        material.dispose();
      }
    }
  } catch (error) {
    console.error('Error disposing Three.js object:', error);
  }
};

/**
 * Helper to create a safe animation frame hook that properly
 * cleans up to prevent memory leaks and errors
 */
export const createSafeAnimationFrame = (
  callback: (time: number) => void
): { start: () => void; stop: () => void } => {
  let animationFrameId: number | null = null;
  let isRunning = false;

  const animate = (time: number) => {
    try {
      if (!isRunning) return;
      callback(time);
      animationFrameId = requestAnimationFrame(animate);
    } catch (error) {
      console.error('Animation frame error:', error);
      stop(); // Stop on error to prevent infinite error loops
    }
  };

  const start = () => {
    if (isRunning) return;
    isRunning = true;
    animationFrameId = requestAnimationFrame(animate);
  };

  const stop = () => {
    isRunning = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  return { start, stop };
};

/**
 * Safely validates a position Vector3 to ensure it won't cause rendering errors
 */
export const validatePosition = (position: THREE.Vector3 | any): THREE.Vector3 => {
  // Create a default position
  const safePosition = new THREE.Vector3(0, 0, 0);
  
  if (!position) return safePosition;
  
  // Check if position has valid x, y, z properties
  if (typeof position.x === 'number' && 
      typeof position.y === 'number' && 
      typeof position.z === 'number') {
    
    // Ensure values are finite
    safePosition.x = isFinite(position.x) ? position.x : 0;
    safePosition.y = isFinite(position.y) ? position.y : 0;
    safePosition.z = isFinite(position.z) ? position.z : 0;
  }
  
  return safePosition;
}; 