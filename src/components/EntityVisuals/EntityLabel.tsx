import React, { useRef } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { EntityLabelProps } from './types';

/**
 * Component for rendering text labels that scale directly with the entity mesh
 * Uses Text component from drei instead of Html for better performance and scaling
 */
const EntityLabel: React.FC<EntityLabelProps> = ({
  text,
  position,
  size,
  visualScale = 1.0,
  color = 'white'
}) => {
  // Ensure we have valid values
  const safeText = text || 'Unnamed';
  const groupRef = useRef<THREE.Group>(null);
  
  // Calculate text size relative to the entity size
  // Text size is inversely proportional to entity scale to maintain readability
  const getTextSize = () => {
    // When visualScale is large (far away), text needs to be relatively large
    // When visualScale is small (close up), text can be smaller
    
    // Base size proportional to entity size
    const baseTextSize = size * 0.02;
    
    // The smaller the visualScale, the larger we make the text proportionally
    // This ensures text is readable at close distances
    const scaleFactor = visualScale < 1 ? Math.max(0.5, 1 / (visualScale * 10)) : 0.5;
    
    return baseTextSize * scaleFactor;
  };
  
  // Calculate text position - always below the entity
  const textPosition: [number, number, number] = [0, -size * 1.2, 0];
  
  try {
    return (
      <group ref={groupRef}>
        <Text
          position={textPosition}
          fontSize={getTextSize()}
          color={color}
          anchorX="center"
          anchorY="middle"
          // Ensure text is always visible even at extreme distances
          renderOrder={1000}
          // Add outline for better contrast
          outlineWidth={0.01}
          outlineColor="#000000"
          // Scale text for readability
          maxWidth={size * 2}
          overflowWrap="break-word"
          whiteSpace="overflowWrap"
        >
          {safeText}
        </Text>
      </group>
    );
  } catch (error) {
    console.error(`[EntityLabel] Error rendering label for "${safeText}":`, error);
    return <group />;
  }
};

export default EntityLabel; 