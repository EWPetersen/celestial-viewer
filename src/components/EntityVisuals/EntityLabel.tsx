import React, { useRef, useEffect, useState } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EntityLabelProps } from './types';

// Minimum font size to ensure text is always visible
const MIN_FONT_SIZE = 1;

// Constants for label scaling
const BASE_LABEL_SIZE = 0.01;
const DISTANCE_COEFFICIENT = 0.1; // Controls how much distance affects the label size

// Minimum visibility distance values for different entity types
const MIN_VISIBLE_DISTANCES = {
  star: 0.02,
  planet: 0.015,
  moon: 0.01,
  default: 0.005
};

// Maximum visibility distance values for different entity types
const MAX_VISIBLE_DISTANCES = {
  star: 15.0,
  planet: 10.0,
  moon: 5.0,
  default: 3.0
};

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
      case 'star': return 3000;
      case 'moon': return 2500;
      case 'station': return 2200;
      case 'lagrangepoint': return 2800;
      case 'jumppoint': return 2900;
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
    
    // Position the label to the left side of the entity
    groupRef.current.position.set(0.0, distance, 0.00);
    
    // Calculate distance to camera (for screen-space sizing)
    const distanceToCamera = cameraPos.distanceTo(groupPos);
    
    // Get label size factors based on entity type
    let typeSizeFactor = 1.0;
    if (type === 'star') typeSizeFactor = 2;
    else if (type === 'planet') typeSizeFactor = 1.0;
    else if (type === 'moon') {
      // Increase moon label size across a wider range of distances (0.8-6.0 units)
      // This covers the specific camera positions in the bug report
      if (distanceToCamera >= 0.8 && distanceToCamera <= 6.0) {
        typeSizeFactor = 2.0; // Double size at planetary view
      } else {
        typeSizeFactor = 1.0;
      }
    }
    else if (type === 'station') typeSizeFactor = 0.9;
    else if (type === 'jumppoint') typeSizeFactor = 4;
    else if (type === 'lagrangepoint') typeSizeFactor = 5; // Increased for better visibility
    
    // Apply additional smoothing for Stanton label specifically
    const isStar = type === 'star';
    const isStanton = text === 'Stanton' && isStar;
    
    // Apply smoothed screen-space font size with extra smoothing for Stanton
    let screenSpaceFontSize = BASE_LABEL_SIZE * typeSizeFactor;
    
    // For Stanton specifically, add extra smoothing based on camera distance
    if (isStanton) {
      // Apply additional distance-based size adjustment for smoother transitions
      const distanceFactor = Math.min(1.0, Math.max(0.85, 1.0 - (distanceToCamera / 10.0) * 0.15));
      screenSpaceFontSize *= distanceFactor;
    }
    
    // Apply the font size 
    if (textRef.current.fontSize !== screenSpaceFontSize) {
      textRef.current.fontSize = screenSpaceFontSize;
    }
    
    // Calculate visibility based on distance
    // Hide labels when too close to avoid cluttering or too far to be relevant
    let opacity = 1.0;
    
    // Different object types have different visibility distances
    const maxVisibleDistance = MAX_VISIBLE_DISTANCES[type as keyof typeof MAX_VISIBLE_DISTANCES] || 
                              MAX_VISIBLE_DISTANCES.default;
    
    const minVisibleDistance = MIN_VISIBLE_DISTANCES[type as keyof typeof MIN_VISIBLE_DISTANCES] || 
                              MIN_VISIBLE_DISTANCES.default;
    
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
    
    // Removed logging when selected
    
    // Removed debug logging for planets/moons
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