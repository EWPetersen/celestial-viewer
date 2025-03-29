import React, { useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 as ThreeVector3 } from 'three';
import { EntityLabelProps } from './types';

/**
 * Component for rendering a billboard-style label above a celestial entity
 */
const EntityLabel: React.FC<EntityLabelProps> = ({
  text,
  position,
  size,
  distance,
  color = 'white'
}) => {
  const textRef = useRef<any>(null);
  const { camera } = useThree();
  
  // Ensure we have valid values
  const safeText = text || 'Unnamed';
  const safeSize = Math.max(0.001, size || 0.1); // Prevent zero size
  const safePosition = {
    x: position?.x || 0,
    y: position?.y || 0,
    z: position?.z || 0
  };
  
  // Scale factor for the label size based on entity size
  const fontSize = Math.max(0.05, safeSize * 0.8);
  
  // Position label above the entity
  const labelPosition = new ThreeVector3(
    safePosition.x,
    safePosition.y + (safeSize * 1.5), // Position above the entity
    safePosition.z
  );
  
  // Make label always face the camera
  useFrame(() => {
    if (textRef.current && camera) {
      try {
        // Billboard effect - always face the camera
        textRef.current.lookAt(camera.position);
        
        // Dynamic scaling based on distance to camera
        const distanceToCamera = camera.position.distanceTo(
          new ThreeVector3(safePosition.x, safePosition.y, safePosition.z)
        );
        
        // Scale text based on distance (prevents text from becoming too small)
        // Use a more conservative approach to prevent NaN values
        const scaleFactor = Math.max(0.5, Math.min(2, distanceToCamera > 0 ? 10 / distanceToCamera : 1));
        textRef.current.scale.setScalar(scaleFactor);
      } catch (error) {
        console.error('Error updating label:', error);
      }
    }
  });

  // Safe rendering with error handling
  try {
    return (
      <group position={[labelPosition.x, labelPosition.y, labelPosition.z]}>
        <Text
          ref={textRef}
          color={color}
          fontSize={fontSize}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="black"
          maxWidth={5}
        >
          {safeText}
        </Text>
      </group>
    );
  } catch (error) {
    console.error('Error rendering label:', error);
    // Return an empty group instead of null which could cause Three.js issues
    return <group />;
  }
};

export default EntityLabel; 