import React, { useRef, useEffect, useState } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EntityLabelProps } from './types';

// Minimum font size to ensure text is always visible
const MIN_FONT_SIZE = 0.05;

/**
 * Simplified label component that renders text directly attached to celestial bodies
 */
const EntityLabel: React.FC<EntityLabelProps> = ({
  text,
  position,
  size,
  distance = 0.55,
  visualScale = 1.0,
  color = 'white',
  type = 'unknown',
  renderPriority = 2000,
  isSelected = false,
  debugInfo = ''
}) => {
  const safeText = text || 'Unnamed';
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // State for tracking value changes - only log when these change significantly
  const [lastLoggedPosition, setLastLoggedPosition] = useState<THREE.Vector3>(new THREE.Vector3());
  const [lastLoggedDistance, setLastLoggedDistance] = useState<number>(0);
  const [lastLoggedAngle, setLastLoggedAngle] = useState<number>(0);
  const [lastLoggedFontSize, setLastLoggedFontSize] = useState<number>(0);
  
  // Text size is now influenced by visualScale but has a minimum size
  // For planets, we'll ensure a slightly larger minimum size
  const minFontSize = type === 'planet' || type === 'star' ? MIN_FONT_SIZE * 1.2 : MIN_FONT_SIZE;
  const fontSize = Math.max(minFontSize, 0.15 * visualScale);
  
  // Get render priority based on entity type
  const getRenderPriority = (): number => {
    switch (type) {
      case 'planet': return 3000; // Highest priority
      case 'star': return 2800;
      case 'moon': return 2500;
      case 'station': return 2200;
      default: return renderPriority;
    }
  };

  // Billboard effect - make labels always face the camera
  useFrame(() => {
    if (!groupRef.current) return;
    
    // Get vector from entity to camera
    const cameraPos = new THREE.Vector3().copy(camera.position);
    const groupPos = new THREE.Vector3();
    groupRef.current.parent?.getWorldPosition(groupPos);
    const entityToCam = new THREE.Vector3().subVectors(cameraPos, groupPos).normalize();
    
    // Project camera direction onto xz plane for partial billboarding
    // This keeps the y-offset but rotates the label to face the camera horizontally
    const xzProjection = new THREE.Vector3(entityToCam.x, 0, entityToCam.z).normalize();
    
    // Calculate rotation angle
    let rotationAngle = 0;
    
    // Only apply horizontal rotation if there's a significant xz component
    if (xzProjection.length() > 0.01) {
      // Calculate angle in the XZ plane
      rotationAngle = Math.atan2(xzProjection.x, xzProjection.z);
      groupRef.current.rotation.y = rotationAngle;
    }
    
    // Position the group at the correct height from the entity
    groupRef.current.position.set(0, distance, 0);
    
    // Determine if entity is likely occluding the label from camera's view
    const distanceToCamera = cameraPos.distanceTo(groupPos);
    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);
    
    // Only log when selected AND values have changed significantly
    if (isSelected) {
      const positionChanged = worldPos.distanceTo(lastLoggedPosition) > 0.01;
      const distanceChanged = Math.abs(distanceToCamera - lastLoggedDistance) > 0.05;
      const angleChanged = Math.abs(rotationAngle - lastLoggedAngle) > 0.1;
      const fontSizeChanged = Math.abs(fontSize - lastLoggedFontSize) > 0.01;
      
      if (positionChanged || distanceChanged || angleChanged || fontSizeChanged) {
        console.log(`[Label Update] ${safeText}: pos=[${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}], 
          dist=${distanceToCamera.toFixed(4)}, angle=${rotationAngle.toFixed(2)}, 
          fontSize=${fontSize.toFixed(4)}, ${debugInfo}`);
        
        // Update last logged values
        setLastLoggedPosition(worldPos.clone());
        setLastLoggedDistance(distanceToCamera);
        setLastLoggedAngle(rotationAngle);
        setLastLoggedFontSize(fontSize);
      }
    }
  });
  
  try {
    return (
      <group ref={groupRef}>
        <Text
          position={[0, 0, 0]} // Position at group origin
          fontSize={fontSize}
          color={color}
          anchorX="center"
          anchorY="bottom"
          renderOrder={getRenderPriority()}
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {safeText}
        </Text>
      </group>
    );
  } catch (error) {
    console.error(`[Label] Error for "${safeText}":`, error);
    return <group />;
  }
};

export default EntityLabel; 