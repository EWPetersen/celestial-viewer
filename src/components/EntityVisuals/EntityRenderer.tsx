import React, { useRef, useState, useEffect, useMemo } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { EntityRendererProps } from './types';
import CelestialMeshFactory from './CelestialMeshFactory';
import EntityLabel from './EntityLabel';
import useAppStore from '../../stores/useAppStore';
import { SCENE_SCALE, MIN_VISUAL_SIZE, getBaseIconSizeByType } from '../../config/constants'; // Import shared constants

// --- Constants for Dynamic Scaling ---
const FAR_THRESHOLD = 5.0;  // Distance beyond which objects use FAR_SCALE
const CLOSE_THRESHOLD = 0.01; // Distance within which objects use CLOSE_SCALE

// Type-specific scale factors for default system view
const TYPE_SCALE_FACTORS = {
  star: 1.0,           // Larger star in system view
  planet: 25.0,         // Much larger planets in system view
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

// Updated dynamic scale multipliers
const FAR_SCALE_MULTIPLIER = 1.0; // Base multiplier at far distances (modified by type)
const CLOSE_SCALE_MULTIPLIER = 0.005; // Multiplier at close distances (significantly smaller)

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
  color
}) => {
  
  const { selectCelestialBody } = useAppStore();
  const groupRef = useRef<THREE.Group>(null);
  const [hasError, setHasError] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const textRef = useRef<any>(null);
  const { camera } = useThree();
  const [currentVisualScale, setCurrentVisualScale] = useState(1.0); // State to hold the dynamic scale
  
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
  
  // Handle click on the celestial body
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    try {
      e.stopPropagation();
      if (selectable) {
        console.log(`[EntityRenderer] handleClick: Attempting to select ID: ${id}`);
        selectCelestialBody(id);
        console.log(`[EntityRenderer] Simulating focus call after select for ID: ${id}`);
      }
    } catch (error) {
      console.error('[EntityRenderer] Error in click handler:', error);
    }
  };

  // Get label color based on entity type
  const getLabelColor = (): string => {
    switch (type) {
      case 'star': return '#ffff80';
      case 'planet': return '#80ff80';
      case 'moon': return '#ffffff';
      case 'station': return '#80c0ff';
      case 'jumppoint': return '#ff80ff';
      default: return '#ffffff';
    }
  };
  
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
    groupRef.current.scale.setScalar(finalScale);
    setCurrentVisualScale(finalScale);
  });

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
    // We need the base visual size to position the label correctly
    const baseVisualSizeForLabel = Math.max(MIN_VISUAL_SIZE, getBaseIconSizeByType(type || 'unknown'));

    // Log the current visual scale for debugging this entity
    if (isSelected) {
      console.log(`[EntityRenderer] ${name} (${type}) current visual scale: ${currentVisualScale.toFixed(8)}`);
    }
    
    return (
      <group 
        ref={groupRef}
        position={[scenePosition.x, scenePosition.y, scenePosition.z]}
        onClick={handleClick}
        // Group scale is set dynamically in useFrame
      >
        <CelestialMeshFactory 
          type={type || 'unknown'}
          size={1} // Pass base size 1; Group scale handles the rest
          isSelected={isSelected}
          color={color}
        />
        <EntityLabel 
          text={displayLabel}
          position={{ x: 0, y: 0, z: 0 }} // Position is now relative to group
          size={safeSize} // Pass the actual entity size, not the base visual size
          color={getLabelColor()}
          visualScale={currentVisualScale}
        />
      </group>
    );
  } catch (error) {
    console.error(`[EntityRenderer] Error during rendering entity ${name}:`, error);
    return <group position={[0, 0, 0]} />; // Fallback group
  }
};

export default EntityRenderer; 