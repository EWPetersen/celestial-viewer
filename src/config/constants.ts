/**
 * Shared constants for the celestial viewer application.
 */

// Scale factor for converting astronomical coordinates (e.g., kilometers or Gm) 
// into the smaller scale used by the Three.js scene.
export const SCENE_SCALE = 0.0000000001; 

// --- Visual Scaling Constants ---
export const MIN_VISUAL_SIZE = 0.1;     // Smallest visual size for any object

// --- Camera View Constants ---
export const SYSTEM_VIEW_DISTANCE = 6;  // Default system view camera distance
export const DETAIL_VIEW_THRESHOLD = 0.1; // Camera distance below this value triggers detail view mode

// --- Focus View Diameter Constants ---
export const TARGET_FOCUS_DIAMETER_KM = 450000; // Target view diameter in km for planet views
export const MOON_TARGET_FOCUS_DIAMETER_KM = 5000; // Target view diameter in km for moon detail views (reduced from 50000)
export const STATION_TARGET_FOCUS_DIAMETER_KM = 2000; // Target view diameter in km for station detail views (reduced from 20000)

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

// Get adjusted size multiplier for detail view
export const getDetailViewSizeMultiplier = (type: string): number => {
  switch (type.toLowerCase()) {
    case 'moon':          return 2.5;  // Enhanced visibility in detail view
    case 'station':       return 2.0;  // Enhanced visibility in detail view
    case 'reststop':      return 2.0;  // Enhanced visibility in detail view
    case 'landingzone':   return 2.0;  // Enhanced visibility in detail view
    case 'commarray':     return 2.0;  // Enhanced visibility in detail view
    case 'outpost':       return 2.0;  // Enhanced visibility in detail view
    case 'jumppoint':     return 2.0;  // Enhanced visibility in detail view
    default:              return 1.5;  // Default enhancement
  }
};

// Get whether entity type is eligible for detail view
export const isDetailViewEntityType = (type: string): boolean => {
  const detailViewTypes = [
    'moon', 
    'station', 
    'reststop', 
    'landingzone', 
    'commarray', 
    'outpost', 
    'jumppoint'
  ];
  return detailViewTypes.includes(type.toLowerCase());
};

// Add other shared constants here as needed...
// export const ANIMATION_SPEED = 0.05; 
// export const POSITION_THRESHOLD = 0.1; 