import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { EntityRendererProps, EntityType } from './types';
import CelestialMeshFactory from './CelestialMeshFactory';
import EntityLabel from './EntityLabel';
import OrbitPath from './OrbitPath';
import useAppStore from '../../stores/useAppStore';
import { SCENE_SCALE, MIN_VISUAL_SIZE, getBaseIconSizeByType } from '../../config/constants'; // Import shared constants

// --- Constants for Dynamic Scaling ---
const FAR_THRESHOLD = 5.0;  // Distance beyond which objects use FAR_SCALE
const CLOSE_THRESHOLD = 0.001; //Distance within which objects use CLOSE_SCALE

// Type-specific scale factors for default system view
const TYPE_SCALE_FACTORS = {
  star: 0.75,           // Larger star in system view
  planet: 30.0,         // Much larger planets in system view
  moon: 1.5,           // Larger moons for better visibility
  station: 1.0,        // Increased station visibility
  reststop: 1.0,       // Increased reststop visibility
  landingzone: 1.0,    // Increased landing zone visibility
  commarray: 1.0,      // Increased comm array visibility
  outpost: 1.0,        // Increased outpost visibility
  jumppoint: 1.0,      // Increased jump point visibility
  lagrangepoint: 1.5,  // Increased lagrange point visibility
  unknown: 1.0         // Increased default for unknown types
};

// Type-specific label distances (how far labels are placed from entity center)
const LABEL_DISTANCES = {
  star: 0.4,         // Further from the surface for stars
  planet: 0.003,  // Further for planets
  moon: 0.005,        // Default for moons
  station: 0.005,    // Closer for stations
  reststop: 0.0050,    // Closer for reststops
  landingzone: 0.001, // Closer for landing zones
  commarray: 0.001,   // Closer for comm arrays
  outpost: 0.001,     // Closer for outposts
  jumppoint: 0.9,   // Default for jump points
  lagrangepoint: 0.1,// Default for lagrange points
  unknown: 0.55      // Default for unknown types
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
  lagrangepoint: 0.9,  // Slightly smaller
  outpost: 0.9,        // Slightly smaller
  unknown: 1.0         // Default sizing
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
  relativePosition = null
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
  
  // Dynamic Scaling Logic within useFrame
  useFrame(() => {
    if (!groupRef.current) return;
    const distance = camera.position.distanceTo(groupRef.current.position);

    // --- Select parameters based on type --- 
    let closeMultiplier = CLOSE_SCALE_MULTIPLIER;
    let farThreshold = FAR_THRESHOLD;
    let closeThreshold = CLOSE_THRESHOLD;
    
    // Get type-specific scale factor from the lookup table
    const typeScaleFactor = TYPE_SCALE_FACTORS[type as keyof typeof TYPE_SCALE_FACTORS] || 
      TYPE_SCALE_FACTORS.unknown;

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
    
    // Log only when selected AND values have changed significantly
    if (isCurrentlySelected && (name === 'Crusader' || name === 'Stanton' || type === 'lagrangepoint' || type === 'jumppoint')) {
      const scaleChanged = Math.abs(finalScale - lastLoggedScale) > 0.001;
      const distanceChanged = Math.abs(distance - lastLoggedDistance) > 0.01;
      
      if (scaleChanged || distanceChanged) {
        console.log(`[Scale Update] ${name}: distance=${distance.toFixed(4)}, meshScale=${finalScale.toFixed(4)}`);
        
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
    return Math.sqrt(x*x + y*y + z*z) * SCENE_SCALE;
  }, [relativePosition]);
  
  // Check if orbit should be shown
  const shouldShowOrbit = useMemo(() => {
    // Only show orbits if the feature is enabled
    if (!showOrbits) return false;
    
    // Don't show orbit for the root object (Stanton) or for entities without parents
    if (!parentPosition) return false;
    
    // Don't show orbit for entities with zero relative position
    if (!orbitRadius || orbitRadius <= 0) return false;
    
    return true;
  }, [showOrbits, parentPosition, orbitRadius]);

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
    const baseLabelDistance = LABEL_DISTANCES[type as keyof typeof LABEL_DISTANCES] || LABEL_DISTANCES.unknown;
    
    // Get the radius multiplier for this entity type
    const radiusMultiplier = ENTITY_RADIUS_MULTIPLIERS[type as keyof typeof ENTITY_RADIUS_MULTIPLIERS] || 
      ENTITY_RADIUS_MULTIPLIERS.unknown;
    
    // Get the label scale factor based on entity type
    const labelScaleFactor = LABEL_SCALE_FACTORS[type as keyof typeof LABEL_SCALE_FACTORS] || LABEL_SCALE_FACTORS.unknown;
    
    // Calculate final label scale based on visual scale and type-specific factor
    const finalLabelScale = currentVisualScale * labelScaleFactor;

    // Calculate object radius based on type
    const objectRadius = radiusMultiplier * 0.5; // Base size of 0.5 units
    
    // Calculate distance to camera
    const cameraDistance = camera.position.distanceTo(new THREE.Vector3(scenePosition.x, scenePosition.y, scenePosition.z));
    
    // Calculate distance ratio for label positioning
    // This makes labels move further away when very close to avoid occlusion
    let distanceRatio = 0.5;
    
    // Only adjust distance for nearby large objects (planets, stars, moons)
    if ((type === 'planet' || type === 'star' || type === 'moon') && cameraDistance < 1.0) {
      // Exponential increase in distance as we get very close
      // Use a more aggressive scaling for very close distances
      if (cameraDistance < 0.1) {
        // At extremely close distances (< 0.1), use an even more aggressive scaling
        distanceRatio = Math.max(5.0, Math.pow(0.05 / Math.max(0.001, cameraDistance), 0.8));
      } else {
        distanceRatio = Math.max(1.0, Math.pow(0.1 / Math.max(0.001, cameraDistance), 0.5));
      }
    }
    
    // Calculate final adjusted label distance
    const adjustedLabelDistance = baseLabelDistance * distanceRatio;
    
    // Build debug info string - only include necessary info
    const debugInfo = `distanceRatio=${distanceRatio.toFixed(2)}`;

    // --- Debug Logging for Planets/Moons ---
    if (type === 'planet' || type === 'moon') {
        console.log(`[EntityRenderer Debug - ${name}] 
          Type: ${type}, 
          BaseLabelDist: ${baseLabelDistance.toFixed(4)}, 
          CamDist: ${cameraDistance.toFixed(4)}, 
          DistRatio: ${distanceRatio.toFixed(4)}, 
          AdjLabelDist: ${adjustedLabelDistance.toFixed(4)}, 
          ParentScale(finalScale): ${currentVisualScale.toFixed(4)}, 
          LabelScaleFactor: ${labelScaleFactor.toFixed(4)}, 
          FinalLabelScale: ${finalLabelScale.toFixed(4)}`);
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
        {shouldShowOrbit && parentPosition && (
          <OrbitPath
            center={{ 
              x: parentPosition.x * SCENE_SCALE - scenePosition.x, 
              y: parentPosition.y * SCENE_SCALE - scenePosition.y, 
              z: parentPosition.z * SCENE_SCALE - scenePosition.z 
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