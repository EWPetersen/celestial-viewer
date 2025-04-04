import React, { useRef, useEffect, useState } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EntityLabelProps } from './types';

// Minimum font size to ensure text is always visible
const MIN_FONT_SIZE = 0.05;

// Constants for label scaling
const BASE_LABEL_SIZE = 0.08; // Reduced from 0.15 to make labels smaller
const DISTANCE_COEFFICIENT = 0.1; // Controls how much distance affects the label size

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
  const textRef = useRef<any>(null);
  const { camera } = useThree();
  
  // State for tracking value changes - only log when these change significantly
  const [lastLoggedPosition, setLastLoggedPosition] = useState<THREE.Vector3>(new THREE.Vector3());
  const [lastLoggedDistance, setLastLoggedDistance] = useState<number>(0);
  const [lastLoggedAngle, setLastLoggedAngle] = useState<number>(0);
  const [lastLoggedFontSize, setLastLoggedFontSize] = useState<number>(0);
  
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

  // Billboard effect and screen-space sizing
  useFrame(() => {
    if (!groupRef.current || !textRef.current) return;
    
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
    
    // Calculate distance to camera (for screen-space sizing)
    const distanceToCamera = cameraPos.distanceTo(groupPos);
    
    // Get label size factors based on entity type - MODIFIED FOR PLANETS/MOONS
    let typeSizeFactor = 1.0;
    if (type === 'star') typeSizeFactor = 1.2;        // Reduced from 1.5
    else if (type === 'planet') typeSizeFactor = 0.9; // Reduced from 1.3
    else if (type === 'moon') typeSizeFactor = 0.7;   // Reduced from 1.0 
    else if (type === 'station') typeSizeFactor = 0.7; // Reduced from 0.9
    else if (type === 'jumppoint') typeSizeFactor = 0.9; // Reduced from 1.1
    
    // Calculate constant screen-space size (similar to how Stanton label works)
    // This maintains visual size regardless of camera distance
    const screenSpaceFontSize = BASE_LABEL_SIZE * typeSizeFactor;
    
    // Apply the font size 
    if (textRef.current.fontSize !== screenSpaceFontSize) {
      textRef.current.fontSize = screenSpaceFontSize;
    }
    
    // Calculate visibility based on distance
    // Hide labels when too close to avoid cluttering or too far to be relevant
    let opacity = 1.0;
    
    // Different object types have different visibility distances
    const maxVisibleDistance = type === 'star' ? 15.0 : 
                              type === 'planet' ? 10.0 : 
                              type === 'moon' ? 5.0 : 3.0;
    
    const minVisibleDistance = type === 'star' ? 0.2 : 
                              type === 'planet' ? 0.15 : 
                              type === 'moon' ? 0.1 : 0.05;
    
    // Fade out when too close or too far
    if (distanceToCamera > maxVisibleDistance) {
      opacity = Math.max(0, 1.0 - (distanceToCamera - maxVisibleDistance) / 2.0);
    } else if (distanceToCamera < minVisibleDistance) {
      opacity = Math.max(0, distanceToCamera / minVisibleDistance);
    }
    
    // Apply opacity 
    if (textRef.current.material) {
      textRef.current.material.opacity = opacity;
    }
    
    // Enhanced debug logging - log more entities
    const isDebugEntity = isSelected || 
                         text === 'Stanton' || 
                         text === 'Crusader' ||
                         text === 'Hurston' ||
                         text === 'ArcCorp' ||
                         text.includes('L1') ||
                         text.includes('Gateway');
                         
    if (isDebugEntity) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      
      const entityPos = new THREE.Vector3();
      if (groupRef.current.parent) {
        groupRef.current.parent.getWorldPosition(entityPos);
      }
      
      const heightAboveEntity = worldPos.y - entityPos.y;
      
      console.log(`[Label Debug] ${text} (${type}): 
        - distance from camera: ${distanceToCamera.toFixed(4)}
        - label size: ${screenSpaceFontSize.toFixed(4)}
        - height above entity: ${heightAboveEntity.toFixed(4)}
        - entity pos: [${entityPos.x.toFixed(2)}, ${entityPos.y.toFixed(2)}, ${entityPos.z.toFixed(2)}]
        - label pos: [${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}]
        - opacity: ${opacity.toFixed(2)}`);
    }
    
    // Only log when selected AND values have changed significantly
    if (isSelected) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      
      const positionChanged = worldPos.distanceTo(lastLoggedPosition) > 0.01;
      const distanceChanged = Math.abs(distanceToCamera - lastLoggedDistance) > 0.05;
      const angleChanged = Math.abs(rotationAngle - lastLoggedAngle) > 0.1;
      const fontSizeChanged = Math.abs(screenSpaceFontSize - lastLoggedFontSize) > 0.01;
      
      if (positionChanged || distanceChanged || angleChanged || fontSizeChanged) {
        console.log(`[Label Update] ${safeText}: pos=[${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}], 
          dist=${distanceToCamera.toFixed(4)}, angle=${rotationAngle.toFixed(2)}, 
          fontSize=${screenSpaceFontSize.toFixed(4)}, opacity=${opacity.toFixed(2)}, ${debugInfo}`);
        
        // Update last logged values
        setLastLoggedPosition(worldPos.clone());
        setLastLoggedDistance(distanceToCamera);
        setLastLoggedAngle(rotationAngle);
        setLastLoggedFontSize(screenSpaceFontSize);
      }
    }
  });
  
  try {
    return (
      <group ref={groupRef}>
        <Text
          ref={textRef}
          position={[0, 0, 0]} // Position at group origin
          fontSize={BASE_LABEL_SIZE} // Initial size, will be updated in useFrame
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