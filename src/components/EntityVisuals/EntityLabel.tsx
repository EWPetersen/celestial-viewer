import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EntityLabelProps } from './types';

// Constants for label scaling
const BASE_LABEL_SIZE = 0.08; // Reduced base size
// const DISTANCE_COEFFICIENT = 0.1; // No longer needed if size is constant

/**
 * Label component that renders text at a world position with constant screen size.
 */
const EntityLabel: React.FC<EntityLabelProps> = ({
  text,
  position, // Now expects a THREE.Vector3 world position
  size, // May not be needed
  distance = 0.55, // Vertical offset from the world position
  // visualScale = 1.0, // Removed, size is constant
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
  
  // State for tracking value changes
  const [lastLoggedPosition, setLastLoggedPosition] = useState<THREE.Vector3>(new THREE.Vector3());
  const [lastLoggedDistance, setLastLoggedDistance] = useState<number>(0);
  const [lastLoggedAngle, setLastLoggedAngle] = useState<number>(0);
  const [lastLoggedFontSize, setLastLoggedFontSize] = useState<number>(0);
  
  // Recalculate worldPositionVec whenever the position prop changes
  const worldPositionVec = useMemo(() => {
    // Ensure position is a valid Vector3
    if (position instanceof THREE.Vector3) {
      return position;
    } else if (position && typeof position.x === 'number' && typeof position.y === 'number' && typeof position.z === 'number') {
      return new THREE.Vector3(position.x, position.y, position.z);
    } else {
      console.warn(`[Label-${safeText}] Received invalid position prop:`, position);
      return new THREE.Vector3(0, 0, 0); // Fallback
    }
  }, [position, safeText]);

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

    // Set the group's position to the entity's world position + vertical offset
    groupRef.current.position.set(worldPositionVec.x, worldPositionVec.y + distance, worldPositionVec.z);
    
    // --- Billboarding Logic (remains mostly the same, uses group's world position) ---
    const cameraPos = camera.position;
    const groupPos = groupRef.current.position; // Use the group's already calculated world position
    const entityToCam = new THREE.Vector3().subVectors(cameraPos, groupPos).normalize();
    const xzProjection = new THREE.Vector3(entityToCam.x, 0, entityToCam.z).normalize();
    let rotationAngle = 0;
    if (xzProjection.length() > 0.01) {
      rotationAngle = Math.atan2(xzProjection.x, xzProjection.z);
      groupRef.current.rotation.y = rotationAngle;
    }
    // --- End Billboarding --- 
    
    const distanceToCamera = cameraPos.distanceTo(groupPos);
    
    // --- Font Size Calculation (reduced base size, removed planet/star boost initially) ---
    let typeSizeFactor = 1.0; 
    if (type === 'star') typeSizeFactor = 1.2;
    else if (type === 'planet') typeSizeFactor = 1.1; // Slightly smaller boost
    // Moons and others use 1.0
    
    const screenSpaceFontSize = BASE_LABEL_SIZE * typeSizeFactor;
    if (textRef.current.fontSize !== screenSpaceFontSize) {
      textRef.current.fontSize = screenSpaceFontSize;
    }
    
    // --- Opacity Calculation (remains the same) ---
    let opacity = 1.0;
    const maxVisibleDistance = type === 'star' ? 15.0 : 
                              type === 'planet' ? 10.0 : 
                              type === 'moon' ? 5.0 : 3.0;
    const minVisibleDistance = type === 'star' ? 0.2 : 
                              type === 'planet' ? 0.15 : 
                              type === 'moon' ? 0.1 : 0.05;
    if (distanceToCamera > maxVisibleDistance) {
      opacity = Math.max(0, 1.0 - (distanceToCamera - maxVisibleDistance) / 2.0);
    } else if (distanceToCamera < minVisibleDistance) {
      opacity = Math.max(0, distanceToCamera / minVisibleDistance);
    }
    if (textRef.current.material) {
      textRef.current.material.opacity = opacity;
      // Ensure material is transparent if opacity is less than 1
      textRef.current.material.transparent = opacity < 1.0;
    }
    // --- End Opacity --- 
    
    // --- Logging (remains the same, uses groupPos for world position) ---
    if (isSelected && (type === 'planet' || type === 'moon' || type === 'star')) {
      const worldPos = groupPos; // Use the already calculated group world position
      const positionChanged = worldPos.distanceTo(lastLoggedPosition) > 0.01;
      const distanceChanged = Math.abs(distanceToCamera - lastLoggedDistance) > 0.05;
      const angleChanged = Math.abs(rotationAngle - lastLoggedAngle) > 0.1;
      const fontSizeChanged = Math.abs(screenSpaceFontSize - lastLoggedFontSize) > 0.01;
      if (positionChanged || distanceChanged || angleChanged || fontSizeChanged) {
        console.log(`[Label-${safeText}] WorldPos=[${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}], FontSize=${screenSpaceFontSize.toFixed(4)}, Opacity=${opacity.toFixed(2)}`);
        setLastLoggedPosition(worldPos.clone());
        setLastLoggedDistance(distanceToCamera);
        setLastLoggedAngle(rotationAngle);
        setLastLoggedFontSize(screenSpaceFontSize);
      }
    }
  });
  
  try {
    return (
      // Group is now positioned directly in world space
      <group ref={groupRef}>
        <Text
          ref={textRef}
          position={[0, 0, 0]} // Position relative to the group's world origin
          fontSize={BASE_LABEL_SIZE} // Initial size
          color={color}
          anchorX="center"
          anchorY="bottom"
          renderOrder={getRenderPriority()}
          outlineWidth={0.02}
          outlineColor="#000000"
          material-depthTest={false} // Ensure text renders on top
        >
          {safeText}
        </Text>
      </group>
    );
  } catch (error) {
    console.error(`[Label] Error for "${safeText}":`, error);
    return null; // Render nothing on error
  }
};

export default EntityLabel; 