import React, { useRef, useState, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { EntityRendererProps } from './types';
import CelestialMeshFactory from './CelestialMeshFactory';
import EntityLabel from './EntityLabel';
import useAppStore from '../../stores/useAppStore';

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
    : 100000; // Default size if invalid
  
  // Calculate scaled size for visualization
  // This uses a logarithmic scale to keep objects visible while maintaining relative size
  const scaledSize = Math.max(
    0.1,
    safeSize * 0.000000005
  );
  
  // Handle click on the celestial body
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    try {
      e.stopPropagation();
      if (selectable) {
        selectCelestialBody(id);
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
  const scenePosition = {
    x: safePosition.x * 0.0000000001,
    y: safePosition.y * 0.0000000001,
    z: safePosition.z * 0.0000000001
  };
  
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
    return (
      <group 
        ref={groupRef}
        position={[scenePosition.x, scenePosition.y, scenePosition.z]}
        onClick={handleClick}
      >
        {/* Render the appropriate mesh based on entity type */}
        <CelestialMeshFactory 
          type={type || 'unknown'}
          size={scaledSize}
          isSelected={isSelected}
          color={color}
        />
        
        {/* Render the label above the entity */}
        <EntityLabel 
          text={name || 'Unnamed'}
          position={{ x: 0, y: 0, z: 0 }} // Position is relative to group
          size={scaledSize}
          color={getLabelColor()}
        />
      </group>
    );
  } catch (error) {
    console.error(`[EntityRenderer] Error during rendering entity ${name}:`, error);
    // Return a minimal valid object that won't cause Three.js to crash
    return <group position={[0, 0, 0]} />; // Return fallback group on render error
  }
};

// Add Text component to avoid reference issues
const Text = ({ children, ...props }: any) => {
  // Import Text dynamically to avoid module not found errors during error state
  // Note: This dynamic import might cause issues. Consider a static import if possible.
  const { Text: DreiText } = require('@react-three/drei');
  return <DreiText {...props}>{children}</DreiText>;
};

export default EntityRenderer; 