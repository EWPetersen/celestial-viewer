/**
 * Shared constants for the celestial viewer application.
 */

// Scale factor for converting astronomical coordinates (e.g., kilometers or Gm) 
// into the smaller scale used by the Three.js scene.
export const SCENE_SCALE = 0.0000000001; 

// --- Visual Scaling Constants ---
export const MIN_VISUAL_SIZE = 0.1;     // Smallest visual size for any object

// Base visual sizes for different entity types
export const getBaseIconSizeByType = (type: string): number => {
  switch (type.toLowerCase()) {
    case 'star':          return 1.5;  // Base sizes restored
    case 'planet':        return 0.8;  
    case 'moon':          return 0.4;  
    case 'station':       return 0.4;  
    case 'reststop':      return 0.4;  
    case 'landingzone':   return 0.35; 
    case 'jumppoint':     return 0.5;  
    case 'lagrangepoint': return 0.3;  
    case 'commarray':     return 0.2;  
    case 'outpost':       return 0.25; 
    default:              return 0.2;
  }
};

// Add other shared constants here as needed...
// export const ANIMATION_SPEED = 0.05; 
// export const POSITION_THRESHOLD = 0.1; 