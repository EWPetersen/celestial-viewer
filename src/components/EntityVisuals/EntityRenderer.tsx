import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { EntityRendererProps, EntityType } from './types';
import CelestialMeshFactory from './CelestialMeshFactory';
import EntityLabel from './EntityLabel';
import OrbitPath from './OrbitPath';
import useAppStore from '../../stores/useAppStore';
import { 
  SCENE_SCALE, 
  MIN_VISUAL_SIZE, 
  getBaseIconSizeByType,
  DETAIL_VIEW_THRESHOLD,
  SYSTEM_VIEW_THRESHOLD,
  getDetailViewSizeMultiplier,
  isDetailViewEntityType,
  SYSTEM_VIEW_LABEL_SCALE
} from '../../config/constants'; // Import shared constants

// --- Constants for Dynamic Scaling ---
const FAR_THRESHOLD = 5.0;  // Distance beyond which objects use FAR_SCALE
const CLOSE_THRESHOLD = 0.001; //Distance within which objects use CLOSE_SCALE

// Type-specific scale factors for default system view
const TYPE_SCALE_FACTORS = {
  star: 10,             // Larger star in system view
  planet: 30.0,         // Much larger planets in system view
  moon: 1.5,            // Larger moons for better visibility
  station: 1.0,         // Increased station visibility
  reststop: 1.0,        // Increased reststop visibility
  landingzone: 1.0,     // Increased landing zone visibility
  commarray: 1.0,       // Increased comm array visibility
  outpost: 1.0,         // Increased outpost visibility
  jumppoint: 5.0,       // Increased jump point visibility
  lagrangepoint: 6.0,   // Significantly increased for always-visible lagrange points
  unknown: 1.0          // Increased default for unknown types
};

// Detail view scale factors (used when zoomed in close on a moon or station)
const DETAIL_VIEW_SCALE_FACTORS = {
  moon: 2.5,            // Enhance moon visibility in detail view
  station: 2.0,         // Enhance station visibility in detail view
  reststop: 2.0,        // Enhance reststop visibility in detail view
  landingzone: 2.0,     // Enhance landing zone visibility in detail view
  commarray: 2.0,       // Enhance comm array visibility in detail view
  outpost: 2.0,         // Enhance outpost visibility in detail view
  jumppoint: 2.0,       // Enhance jump point visibility in detail view
  unknown: 1.5          // Default enhancement for detail view
};

// Type-specific label distances (how far labels are placed from entity center)
const LABEL_DISTANCES = {
  star: 0.008,          // Further from the surface for stars
  planet: 0.003,        // Further for planets
  moon: 0.002,          // Default for moons
  station: 0.001,        // Closer for stations
  reststop: 0.0050,     // Closer for reststops
  landingzone: 0.001,   // Closer for landing zones
  commarray: 0.001,      // Closer for comm arrays
  outpost: 0.001,       // Closer for outposts
  jumppoint: 0.09,      // Default for jump points
  lagrangepoint: 0.1,   // Default for lagrange points
  unknown: 0.55         // Default for unknown types
};

// Detail view label distances (override when in detail view)
const DETAIL_VIEW_LABEL_DISTANCES = {
  moon: 0.004,          // Adjusted for detail view of moons
  station: 0.015,       // Adjusted for detail view of stations
  reststop: 0.01,       // Adjusted for detail view of reststops
  landingzone: 0.002,   // Adjusted for detail view of landing zones
  commarray: 0.015,     // Adjusted for detail view of comm arrays
  outpost: 0.002,       // Adjusted for detail view of outposts
  jumppoint: 0.12,      // Adjusted for detail view of jump points
  unknown: 0.6          // Default for detail view
};

// Get object radius multiplier for different entity types
const ENTITY_RADIUS_MULTIPLIERS = {
  star: 1.0,         // Stars have standard radius
  planet: 1.0,       // Planets have standard radius
  moon: 1.0,         // Moons are smaller
  station: 1.0,      // Stations are much smaller
  reststop: 1.0,     // Reststops are smaller
  landingzone: 1.0,  // Landing zones are smaller
  commarray: 1.0,    // Comm arrays are smaller
  outpost: 1.0,      // Outposts are smaller
  jumppoint: 1.0,    // Jump points are smaller
  lagrangepoint: 1.0,// Lagrange points are smaller
  unknown: 1.0      // Unknown types are smaller
};

// Label scaling factors by type - controls how label size changes with distance
const LABEL_SCALE_FACTORS = {
  star: 1.0,           // Normal sizing
  planet: 1.2,         // Larger for planets
  moon: 1.0,           // Normal sizing
  station: 0.9,        // Slightly smaller
  reststop: 0.9,       // Slightly smaller
  landingzone: 0.85,   // Smaller
  commarray: 0.85,     // Smaller
  jumppoint: 1.0,      // Normal sizing
  lagrangepoint: 3,  // Increased from 0.9 for better visibility
  outpost: 0.9,        // Slightly smaller
  unknown: 1.0         // Default sizing
};

// Detail view label scale factors
const DETAIL_VIEW_LABEL_SCALE_FACTORS = {
  moon: 1.3,           // Larger labels for moons in detail view
  station: 1.2,        // Larger labels for stations in detail view
  reststop: 1.2,       // Larger labels for reststops in detail view
  landingzone: 1.2,    // Larger labels for landing zones in detail view
  commarray: 1.2,      // Larger labels for comm arrays in detail view
  outpost: 1.2,        // Larger labels for outposts in detail view
  jumppoint: 1,      // Larger labels for jump points in detail view
  lagrangepoint: 3,  // Larger labels for lagrange points in detail view
  unknown: 1.2         // Default for unknown types in detail view
};

// Updated dynamic scale multipliers
const FAR_SCALE_MULTIPLIER = 1.0; // Base multiplier at far distances (modified by type)
const CLOSE_SCALE_MULTIPLIER = 0.5; // Multiplier at close distances (significantly smaller)

// Smoothstep interpolation function
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Component that renders a celestial entity with a label
 * This is a wrapper that combines CelestialMeshFactory and EntityLabel
 */
const EntityRenderer: React.FC<EntityRendererProps> = ({
  id,
  name,
  position,
  size,
  type,
  isSelected = false,
  selectable = true,
  color,
  showLabel = true,
  showOrbits = false,
  parentPosition = null,
  relativePosition = null,
  labelDistanceScale = 1.0 // Default value if not provided
}) => {
  
  const { 
    selectCelestialBody, 
    selectPointOfInterest,
    selectJumpPoint,
    selectedCelestialBodyId,
    selectedPointOfInterestId,
    selectedJumpPointId
  } = useAppStore();
  const groupRef = useRef<THREE.Group>(null);
  const [hasError, setHasError] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const textRef = useRef<any>(null);
  const { camera } = useThree();
  const [currentVisualScale, setCurrentVisualScale] = useState(1.0); // State to hold the dynamic scale
  const [isInDetailView, setIsInDetailView] = useState(false); // Track if we're in detail view
  
  // Add state for smooth label position transitions
  const [currentLabelDistanceRatio, setCurrentLabelDistanceRatio] = useState(0.5);
  const previousLabelDistanceRatioRef = useRef(0.5);
  const isAnimatingLabelRef = useRef(false);
  const labelAnimationStartTimeRef = useRef(0);
  const LABEL_ANIMATION_DURATION = 500; // ms - how long label position transitions take
  
  // State for tracking scale changes - only log when these change significantly
  const [lastLoggedScale, setLastLoggedScale] = useState<number>(1.0);
  const [lastLoggedDistance, setLastLoggedDistance] = useState<number>(0);
  
  // Normalize type
  const normalizedType = useMemo(() => {
      const validBodyTypes: EntityType[] = ['star', 'planet', 'moon'];
      const validPoiTypes: EntityType[] = ['station', 'commarray', 'landingzone', 'lagrangepoint', 'reststop', 'outpost'];
      const validJpTypes: EntityType[] = ['jumppoint'];

      if (validBodyTypes.includes(type as EntityType)) return 'celestialBody';
      if (validPoiTypes.includes(type as EntityType)) return 'pointOfInterest';
      if (validJpTypes.includes(type as EntityType)) return 'jumpPoint';
      return 'unknown';
  }, [type]);
  
  // Validate props to prevent Three.js errors
  useEffect(() => {
    // Check for valid inputs to avoid runtime errors
    if (!position || 
        typeof position.x !== 'number' || 
        typeof position.y !== 'number' || 
        typeof position.z !== 'number' ||
        !isFinite(position.x) || 
        !isFinite(position.y) || 
        !isFinite(position.z)) {
      console.error(`[EntityRenderer] Invalid position for entity ${name} (${id}):`, position);
      setHasError(true);
    }

    if (typeof size !== 'number' || !isFinite(size) || size <= 0) {
      console.error(`[EntityRenderer] Invalid size for entity ${name} (${id}):`, size);
      setHasError(true);
    }
  }, [id, name, position, size]);
  
  // Use safe default values for required props
  const safePosition = {
    x: position && typeof position.x === 'number' && isFinite(position.x) ? position.x : 0,
    y: position && typeof position.y === 'number' && isFinite(position.y) ? position.y : 0,
    z: position && typeof position.z === 'number' && isFinite(position.z) ? position.z : 0
  };
  
  const safeSize = (typeof size === 'number' && isFinite(size) && size > 0) 
    ? size 
    : 100000;
  
  // --- New Scaling Logic ---
  // 1. Get fixed base icon size based on entity type
  const calculatedSize = getBaseIconSizeByType(type || 'unknown');
  
  // 2. Ensure minimum visibility (Clamp bottom only)
  const scaledSize = Math.max(
     MIN_VISUAL_SIZE, 
     calculatedSize // Remove MAX_VISUAL_SIZE clamping
  );
  
  // Determine if this specific entity is selected based on all selection IDs
  const isCurrentlySelected = useMemo(() => {
      return id === selectedCelestialBodyId || 
             id === selectedPointOfInterestId || 
             id === selectedJumpPointId;
  }, [id, selectedCelestialBodyId, selectedPointOfInterestId, selectedJumpPointId]);

  // Handle click - call the correct selection function
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!selectable) return;

    console.log(`[EntityRenderer] handleClick: Entity ID=${id}, Type Category=${normalizedType}, Prop Type=${type}`);

    // Based on the normalized category, call the appropriate selector
    try {
        switch (normalizedType) {
            case 'celestialBody':
                console.log(`[EntityRenderer] Calling selectCelestialBody(${id})`);
                selectCelestialBody(id);
                break;
            case 'pointOfInterest':
                 if (selectPointOfInterest) {
                    console.log(`[EntityRenderer] Calling selectPointOfInterest(${id})`);
                    selectPointOfInterest(id);
                 } else {
                     console.warn("[EntityRenderer] selectPointOfInterest function not found in store!");
                     selectCelestialBody(id); // Fallback if necessary, though problematic
                 }
                break;
            case 'jumpPoint':
                if (selectJumpPoint) {
                    console.log(`[EntityRenderer] Calling selectJumpPoint(${id})`);
                    selectJumpPoint(id);
                } else {
                    console.warn("[EntityRenderer] selectJumpPoint function not found in store!");
                    selectCelestialBody(id); // Fallback
                }
                break;
            default:
                console.warn(`[EntityRenderer] Click on unhandled type category: ${normalizedType}`);
                // Optionally select as celestial body as a default?
                // selectCelestialBody(id);
                break;
        }
    } catch (error) {
         console.error('[EntityRenderer] Error in click handler selection:', error);
    }

  }, [id, selectable, normalizedType, type, selectCelestialBody, selectPointOfInterest, selectJumpPoint]);

  // Get label color based on entity type
  const getLabelColor = useCallback((): string => {
    switch (type as EntityType) {
      case 'star': return '#ffff80';
      case 'planet': return '#80ff80';
      case 'moon': return '#ffffff';
      case 'station': return '#80c0ff';
      case 'jumppoint': return '#ff80ff';
      default: return '#ffffff';
    }
  }, [type]);
  
  // Convert position from game coordinates to scene coordinates
  const scenePosition = useMemo(() => ({
    x: safePosition.x * SCENE_SCALE, 
    y: safePosition.y * SCENE_SCALE,
    z: safePosition.z * SCENE_SCALE
  }), [safePosition]);
  
  // Debug moon positions during render
  useEffect(() => {
    if (type === 'moon') {
      console.log(`[MOON-DEBUG-RENDER] Moon "${name}" (ID: ${id}) position:`);
      console.log(`[MOON-DEBUG-RENDER] - Original: [${safePosition.x.toFixed(16)}, ${safePosition.y.toFixed(16)}, ${safePosition.z.toFixed(16)}]`);
      console.log(`[MOON-DEBUG-RENDER] - Scaled for scene: [${scenePosition.x.toFixed(16)}, ${scenePosition.y.toFixed(16)}, ${scenePosition.z.toFixed(16)}]`);
      
      if (relativePosition) {
        console.log(`[MOON-DEBUG-RENDER] - Relative to parent: [${relativePosition.x.toFixed(16)}, ${relativePosition.y.toFixed(16)}, ${relativePosition.z.toFixed(16)}]`);
      }
      
      if (isCurrentlySelected) {
        console.log(`[MOON-DEBUG-RENDER] - SELECTED: This moon is currently selected!`);
      }
    }
  }, [type, name, id, safePosition, scenePosition, relativePosition, isCurrentlySelected]);

  // Dynamic Scaling Logic within useFrame
  useFrame((state) => {
    if (!groupRef.current) return;
    const distance = camera.position.distanceTo(groupRef.current.position);

    // Special debug for moons - log camera distance
    if (type === 'moon' && isCurrentlySelected) {
      console.log(`[MOON-DEBUG-CAMERA] Camera distance to selected moon "${name}": ${distance.toFixed(16)}`);
      console.log(`[MOON-DEBUG-CAMERA] Camera position: [${camera.position.toArray().map((v: number) => v.toFixed(16)).join(', ')}]`);
      console.log(`[MOON-DEBUG-CAMERA] Moon position: [${scenePosition.x.toFixed(16)}, ${scenePosition.y.toFixed(16)}, ${scenePosition.z.toFixed(16)}]`);
    }

    // Detect if we're in detail view based on camera distance and entity type
    const isDetailViewCandidateType = isDetailViewEntityType(type as string);
    const newDetailViewState = isDetailViewCandidateType && (distance < DETAIL_VIEW_THRESHOLD || isCurrentlySelected);
    
    if (newDetailViewState !== isInDetailView) {
      setIsInDetailView(newDetailViewState);
      if (isCurrentlySelected && type !== 'star' && type !== 'planet') {
        console.log(`[EntityRenderer] ${name} detail view state changed to: ${newDetailViewState}, distance=${distance.toFixed(12)}`);
      }
    }

    // --- Select parameters based on type --- 
    let closeMultiplier = CLOSE_SCALE_MULTIPLIER;
    let farThreshold = FAR_THRESHOLD;
    let closeThreshold = CLOSE_THRESHOLD;
    
    // Get type-specific scale factor from the lookup table
    // Use detail view scale factors if in detail view
    const typeScaleFactor = isInDetailView && isDetailViewCandidateType
      ? getDetailViewSizeMultiplier(type as string)
      : (TYPE_SCALE_FACTORS[type as keyof typeof TYPE_SCALE_FACTORS] || TYPE_SCALE_FACTORS.unknown);

    switch (type) {
      case 'star':
        closeMultiplier = 0.2; 
        break;
      case 'planet':
        closeMultiplier = 0.2; 
        break;
      case 'moon':
      case 'station':
      case 'reststop':
      case 'landingzone':
      case 'commarray':
      case 'outpost':
        closeMultiplier = 0.1; 
        break;
      case 'jumppoint':
      case 'lagrangepoint':
        closeMultiplier = 0.1;
        break;
    }
    // --- End parameter selection --- 

    const t = smoothstep(farThreshold, closeThreshold, distance);
    
    // Apply the type-specific scale factor to the far scale multiplier
    const adjustedFarScale = FAR_SCALE_MULTIPLIER * typeScaleFactor;
    
    const scaleMultiplier = THREE.MathUtils.lerp(adjustedFarScale, closeMultiplier, t);
    const baseVisualSize = Math.max(MIN_VISUAL_SIZE, getBaseIconSizeByType(type || 'unknown'));
    const dynamicSize = baseVisualSize * scaleMultiplier;
    const finalScale = Math.max(0.01, dynamicSize);
    
    // IMPORTANT: Set the mesh scale
    groupRef.current.scale.setScalar(finalScale);
    
    // Store both the mesh scale and the raw distance for label scaling
    setCurrentVisualScale(finalScale);
    
    // --- Label Distance Ratio Calculation ---
    
    // Define zoom range thresholds for a continuous curve
    const CLOSE_ZOOM_THRESHOLD = 0.1;        // Very close view (detail)
    const MID_ZOOM_THRESHOLD = 1.0;          // Mid-range view
    const FAR_MID_ZOOM_THRESHOLD = 3.0;      // Far-mid range
    const SYSTEM_VIEW_THRESHOLD_START = 4.2; // Start of system view transition
    const SYSTEM_VIEW_THRESHOLD_END = 5.8;   // End of system view transition
    
    // Calculate target distance ratio based on camera distance
    let targetDistanceRatio = 0.5;
    
    // Get base label distance ratio for different zoom ranges
    if (distance <= CLOSE_ZOOM_THRESHOLD) {
      // Very close range - most aggressive scaling
      targetDistanceRatio = Math.max(5.0, Math.pow(0.05 / Math.max(0.001, distance), 0.8));
    } 
    else if (distance <= MID_ZOOM_THRESHOLD) {
      // Close to mid range - less aggressive scaling
      const tZoom = (distance - CLOSE_ZOOM_THRESHOLD) / (MID_ZOOM_THRESHOLD - CLOSE_ZOOM_THRESHOLD);
      const closeRangeRatio = Math.max(5.0, Math.pow(0.05 / Math.max(0.001, CLOSE_ZOOM_THRESHOLD), 0.8));
      
      // For mid-zoom views, use a higher minimum ratio for better visuals
      const midRangeTargetRatio = type === 'planet' ? 2.5 : (type === 'moon' ? 2.0 : 1.5);
      
      // Smooth interpolation between close and mid range
      targetDistanceRatio = closeRangeRatio * (1 - tZoom) + midRangeTargetRatio * tZoom;
    }
    else if (distance <= FAR_MID_ZOOM_THRESHOLD) {
      // Mid to far-mid range
      const tZoom = (distance - MID_ZOOM_THRESHOLD) / (FAR_MID_ZOOM_THRESHOLD - MID_ZOOM_THRESHOLD);
      
      // Start with different mid-range ratios based on entity type
      const midRangeRatio = type === 'planet' ? 2.5 : (type === 'moon' ? 2.0 : 1.5);
      
      // Far-mid range should start transitioning toward system view values
      // Higher values for planets and stars to keep labels clear
      const farMidTargetRatio = type === 'planet' ? 3.0 : (type === 'star' ? 2.5 : 1.8);
      
      // Smooth interpolation between mid and far-mid range
      targetDistanceRatio = midRangeRatio * (1 - tZoom) + farMidTargetRatio * tZoom;
    }
    else if (distance <= SYSTEM_VIEW_THRESHOLD_START) {
      // Far-mid to system view transition start
      const tZoom = (distance - FAR_MID_ZOOM_THRESHOLD) / (SYSTEM_VIEW_THRESHOLD_START - FAR_MID_ZOOM_THRESHOLD);
      
      // Start with different far-mid ratios based on entity type
      const farMidRatio = type === 'planet' ? 3.0 : (type === 'star' ? 2.5 : 1.8);
      
      // Target the initial system view ratio
      const systemInitialRatio = 
        SYSTEM_VIEW_LABEL_SCALE[type as keyof typeof SYSTEM_VIEW_LABEL_SCALE] || 
        SYSTEM_VIEW_LABEL_SCALE.default;
      
      // Smooth interpolation to system view start
      targetDistanceRatio = farMidRatio * (1 - tZoom) + systemInitialRatio * tZoom;
    }
    else if (distance <= SYSTEM_VIEW_THRESHOLD_END) {
      // System view transition zone
      const tZoom = (distance - SYSTEM_VIEW_THRESHOLD_START) / (SYSTEM_VIEW_THRESHOLD_END - SYSTEM_VIEW_THRESHOLD_START);
      // Apply smoothstep for more natural transition
      const smoothTZoom = smoothstep(0, 1, tZoom);
      
      // Get the appropriate system-view scaling factor for this entity type
      const systemScaleFactor = 
        SYSTEM_VIEW_LABEL_SCALE[type as keyof typeof SYSTEM_VIEW_LABEL_SCALE] || 
        SYSTEM_VIEW_LABEL_SCALE.default;
        
      // Calculate the far-mid ratio as the starting point
      const farMidRatio = type === 'planet' ? 3.0 : (type === 'star' ? 2.5 : 1.8);
      
      // Interpolate between far-mid ratio and system scale factor using the smoothed factor
      targetDistanceRatio = farMidRatio * (1 - smoothTZoom) + systemScaleFactor * smoothTZoom;
    }
    else {
      // Fully in system view - use the system view label scale factor
      targetDistanceRatio = 
        SYSTEM_VIEW_LABEL_SCALE[type as keyof typeof SYSTEM_VIEW_LABEL_SCALE] || 
        SYSTEM_VIEW_LABEL_SCALE.default;
    }
    
    // Apply user-controlled scale to the calculated ratio
    targetDistanceRatio *= labelDistanceScale;
    
    // For detail view types, enhance label visibility when selected
    if (isInDetailView && isCurrentlySelected) {
      targetDistanceRatio *= 1.5; // Increase label distance for selected objects in detail view
    }
    
    // --- SMOOTH ANIMATION FOR LABEL POSITIONS ---
    
    // Detect if target ratio is significantly different from current (avoid tiny changes)
    const isDifferent = Math.abs(targetDistanceRatio - previousLabelDistanceRatioRef.current) > 0.03;
    
    // Start animation if the ratio has changed significantly and we're not already animating
    if (isDifferent && !isAnimatingLabelRef.current) {
      isAnimatingLabelRef.current = true;
      labelAnimationStartTimeRef.current = state.clock.elapsedTime * 1000; // Convert to ms
      previousLabelDistanceRatioRef.current = currentLabelDistanceRatio;
    }
    
    // Progress the animation if we're animating
    if (isAnimatingLabelRef.current) {
      const currentTime = state.clock.elapsedTime * 1000;
      const elapsed = currentTime - labelAnimationStartTimeRef.current;
      const progress = Math.min(1.0, elapsed / LABEL_ANIMATION_DURATION);
      
      // Use a smooth easing function for the transition
      const easeProgress = smoothstep(0, 1, progress);
      
      // Interpolate between the previous and target values
      const animatedRatio = THREE.MathUtils.lerp(
        previousLabelDistanceRatioRef.current, 
        targetDistanceRatio, 
        easeProgress
      );
      
      // Update the current value
      setCurrentLabelDistanceRatio(animatedRatio);
      
      // Check if animation is complete
      if (progress >= 1.0) {
        isAnimatingLabelRef.current = false;
        previousLabelDistanceRatioRef.current = targetDistanceRatio;
      }
    } else {
      // If not animating, just update to target directly for small changes
      setCurrentLabelDistanceRatio(targetDistanceRatio);
      previousLabelDistanceRatioRef.current = targetDistanceRatio;
    }
    
    // Log only when selected AND values have changed significantly
    if (isCurrentlySelected && (name === 'Crusader' || name === 'Stanton' || type === 'lagrangepoint' || type === 'jumppoint')) {
      const scaleChanged = Math.abs(finalScale - lastLoggedScale) > 0.001;
      const distanceChanged = Math.abs(distance - lastLoggedDistance) > 0.01;
      
      if (scaleChanged || distanceChanged) {
        console.log(`[Scale Update] ${name}: distance=${distance.toFixed(12)}, meshScale=${finalScale.toFixed(12)}, detailView=${isInDetailView}, camPos=[${camera.position.toArray().map((v: number) => v.toFixed(12)).join(', ')}]`);
        
        // Update last logged values
        setLastLoggedScale(finalScale);
        setLastLoggedDistance(distance);
      }
    }
  });

  // Calculate orbit radius if we have relative position
  const orbitRadius = useMemo(() => {
    if (!relativePosition || 
        !relativePosition.x || 
        !relativePosition.y || 
        !relativePosition.z) {
      return 0;
    }
    
    // Calculate orbit radius using relative position
    const { x, y, z } = relativePosition;
    const radius = Math.sqrt(x*x + y*y + z*z) * SCENE_SCALE;
    console.log(`[DEBUG] Orbit for ${name}: relativePosition=(${x.toFixed(12)}, ${y.toFixed(12)}, ${z.toFixed(12)}), radius=${radius.toFixed(12)}`);
    return radius;
  }, [relativePosition, name]);
  
  // Check if orbit should be shown
  const shouldShowOrbit = useMemo(() => {
    // Only show orbits if the feature is enabled
    if (!showOrbits) return false;
    
    // Don't show orbit for the root object (Stanton) or for entities without parents
    if (!parentPosition) return false;
    
    // Don't show orbit for entities with zero relative position
    if (!orbitRadius || orbitRadius <= 0) return false;
    
    // Only show orbits for specific entity types - now disabled as we use ringGeometry in StarMap
    return false; // We're now using ringGeometry in StarMap, so disable these
  }, [showOrbits, parentPosition, orbitRadius]);

  // Calculate the parent's scene position
  const parentScenePosition = useMemo(() => {
    if (!parentPosition) return null;
    
    return {
      x: parentPosition.x * SCENE_SCALE,
      y: parentPosition.y * SCENE_SCALE,
      z: parentPosition.z * SCENE_SCALE
    };
  }, [parentPosition]);

  // Calculate the angle of the object in the orbital plane
  // This would ideally come from actual orbital parameters or simulation
  const orbitalAngle = useMemo(() => {
    if (!relativePosition) return 0;
    
    // Calculate orbital angle in radians (in XY plane)
    return Math.atan2(relativePosition.y, relativePosition.x);
  }, [relativePosition]);

  // Debug log for parent position if available
  useEffect(() => {
    if (parentPosition) {
      console.log(`[DEBUG] Parent position for ${name}: (${parentPosition.x.toFixed(12)}, ${parentPosition.y.toFixed(12)}, ${parentPosition.z.toFixed(12)})`);
    }
  }, [parentPosition, name]);

  // Create a fallback entity for error cases
  if (hasError) {
    console.error(`[EntityRenderer] Rendering fallback for ${name} (${id}) due to error state.`);
    return (
      <group position={[0, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshBasicMaterial color="#ff0000" wireframe={true} />
        </mesh>
        <Text 
          position={[0, 0.3, 0]} 
          color="#ff0000" 
          fontSize={0.1}
          anchorX="center"
          anchorY="middle"
        >
          Error: {name || 'Unknown'}
        </Text>
      </group>
    );
  }

  try {
    const displayLabel = type === 'jumppoint' ? `${name} Gateway` : (name || 'Unnamed');
    const baseVisualSizeForLabel = Math.max(MIN_VISUAL_SIZE, getBaseIconSizeByType(type || 'unknown'));
    
    // Get the distance for label based on entity type
    // Use detail view label distances if in detail view
    const baseLabelDistance = isInDetailView
      ? (DETAIL_VIEW_LABEL_DISTANCES[type as keyof typeof DETAIL_VIEW_LABEL_DISTANCES] || DETAIL_VIEW_LABEL_DISTANCES.unknown)
      : (LABEL_DISTANCES[type as keyof typeof LABEL_DISTANCES] || LABEL_DISTANCES.unknown);
    
    // Get the radius multiplier for this entity type
    const radiusMultiplier = ENTITY_RADIUS_MULTIPLIERS[type as keyof typeof ENTITY_RADIUS_MULTIPLIERS] || 
      ENTITY_RADIUS_MULTIPLIERS.unknown;
    
    // Get the label scale factor based on entity type
    // Use detail view label scale factors if in detail view
    const labelScaleFactor = isInDetailView
      ? (DETAIL_VIEW_LABEL_SCALE_FACTORS[type as keyof typeof DETAIL_VIEW_LABEL_SCALE_FACTORS] || DETAIL_VIEW_LABEL_SCALE_FACTORS.unknown)
      : (LABEL_SCALE_FACTORS[type as keyof typeof LABEL_SCALE_FACTORS] || LABEL_SCALE_FACTORS.unknown);
    
    // Calculate final label scale based on visual scale and type-specific factor
    const finalLabelScale = currentVisualScale * labelScaleFactor;

    // Calculate object radius based on type
    const objectRadius = radiusMultiplier * 0.5; // Base size of 0.5 units
    
    // Calculate distance to camera
    const cameraDistance = camera.position.distanceTo(new THREE.Vector3(scenePosition.x, scenePosition.y, scenePosition.z));
    
    // Use the smoothly animated distance ratio instead of recalculating it here
    const distanceRatio = currentLabelDistanceRatio;
    
    // Calculate final adjusted label distance
    const adjustedLabelDistance = baseLabelDistance * distanceRatio;
    
    // Build debug info string - only include necessary info
    const debugInfo = `distanceRatio=${distanceRatio.toFixed(6)}, detailView=${isInDetailView}, camDist=${cameraDistance.toFixed(12)}, animating=${isAnimatingLabelRef.current}`;

    // --- Debug Logging for Planets/Moons ---
    if ((type === 'planet' || type === 'moon') && isCurrentlySelected) {
        console.log(`[EntityRenderer Debug - ${name}] 
          Type: ${type}, 
          BaseLabelDist: ${baseLabelDistance.toFixed(12)}, 
          CamDist: ${cameraDistance.toFixed(12)}, 
          DistRatio: ${distanceRatio.toFixed(12)}, 
          AdjLabelDist: ${adjustedLabelDistance.toFixed(12)}, 
          ParentScale(finalScale): ${currentVisualScale.toFixed(12)}, 
          LabelScaleFactor: ${labelScaleFactor.toFixed(12)}, 
          FinalLabelScale: ${finalLabelScale.toFixed(12)},
          DetailView: ${isInDetailView},
          Animating: ${isAnimatingLabelRef.current},
          CamPos: [${camera.position.x.toFixed(12)}, ${camera.position.y.toFixed(12)}, ${camera.position.z.toFixed(12)}]`);
    }
    // --- End Debug Logging ---

    // No debug logging in render function - it would log on every render cycle
    
    return (
      <group 
        ref={groupRef}
        position={[scenePosition.x, scenePosition.y, scenePosition.z]}
        onClick={handleClick}
      >
        <CelestialMeshFactory 
          type={type || 'unknown'}
          size={scaledSize}
          isSelected={isCurrentlySelected}
          color={color}
        />
        {showLabel && (
          <EntityLabel
            text={displayLabel}
            position={{ x: 0, y: 0, z: 0 }}
            size={size}
            color={getLabelColor()}
            visualScale={finalLabelScale}
            distance={adjustedLabelDistance}
            type={type}
            isSelected={isCurrentlySelected}
            debugInfo={debugInfo}
          />
        )}
        
        {/* Render orbit path if conditions are met */}
        {shouldShowOrbit && parentScenePosition && (
          <OrbitPath
            center={{ 
              x: parentScenePosition.x - scenePosition.x, 
              y: parentScenePosition.y - scenePosition.y, 
              z: parentScenePosition.z - scenePosition.z 
            }}
            radius={orbitRadius}
            color={type === 'moon' ? '#4488aa' : '#335577'}
          />
        )}
      </group>
    );
  } catch (error) {
    console.error(`[EntityRenderer] Error rendering entity ${name}:`, error);
    return <group position={[0, 0, 0]} />; // Fallback group
  }
};

export default EntityRenderer; 