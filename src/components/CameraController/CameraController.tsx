import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import useAppStore from '../../stores/useAppStore';
import { Vector3 } from '../../utils/coordinateUtils';

interface CameraControllerProps {
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
}

// Simple Camera Controller that enables orbit controls
const CameraController: React.FC<CameraControllerProps> = ({
  enablePan = true,
  enableZoom = true,
  enableRotate = true,
  autoRotate = false,
  autoRotateSpeed = 1,
  minDistance = 1,
  maxDistance = 1000
}) => {
  const { camera } = useThree();
  const {
    celestialSystem,
    selectedCelestialBodyId,
    selectedPointOfInterestId,
    selectedJumpPointId,
    setCameraPosition,
    setCameraTarget
  } = useAppStore();

  // Update camera position when selection changes
  useEffect(() => {
    if (!celestialSystem) return;

    let targetPosition: Vector3 | null = null;
    let focusDistance = 10;

    // Check for selected celestial body
    if (selectedCelestialBodyId) {
      const body = celestialSystem.celestialBodies.find(
        (body) => body.id === selectedCelestialBodyId
      );
      
      if (body) {
        targetPosition = body.position;
        // Adjust focus distance based on body radius
        focusDistance = Math.max(5, body.radius * 0.000000025);
      } else {
        // Check if it's a moon
        for (const planet of celestialSystem.celestialBodies) {
          if (planet.moons) {
            const moon = planet.moons.find((moon) => moon.id === selectedCelestialBodyId);
            if (moon) {
              // This is simplified - in a real app we would calculate the actual position
              const angle = Math.random() * Math.PI * 2;
              const x = planet.position.x + moon.orbit.semiMajorAxis * Math.cos(angle);
              const z = planet.position.z + moon.orbit.semiMajorAxis * Math.sin(angle);
              targetPosition = { x, y: planet.position.y, z };
              focusDistance = Math.max(2, moon.radius * 0.0000005);
            }
          }
        }
      }
    }
    // Check for selected point of interest
    else if (selectedPointOfInterestId) {
      const poi = celestialSystem.pointsOfInterest.find(
        (poi) => poi.id === selectedPointOfInterestId
      );
      if (poi) {
        targetPosition = poi.position;
        focusDistance = 2;
      }
    }
    // Check for selected jump point
    else if (selectedJumpPointId) {
      const jumpPoint = celestialSystem.jumpPoints.find(
        (jp) => jp.id === selectedJumpPointId
      );
      if (jumpPoint) {
        targetPosition = jumpPoint.position;
        focusDistance = 5;
      }
    }

    // Move camera to look at the target
    if (targetPosition) {
      // Convert to scene scale
      const scaledPos = {
        x: targetPosition.x * 0.0000000001,
        y: targetPosition.y * 0.0000000001,
        z: targetPosition.z * 0.0000000001
      };
      
      // Set the camera position with an offset
      const offset = new THREE.Vector3(focusDistance, focusDistance / 2, focusDistance);
      camera.position.set(
        scaledPos.x + offset.x,
        scaledPos.y + offset.y,
        scaledPos.z + offset.z
      );
      
      // Update the store
      setCameraPosition({
        x: targetPosition.x + offset.x * 10000000000,
        y: targetPosition.y + offset.y * 10000000000,
        z: targetPosition.z + offset.z * 10000000000
      });
      setCameraTarget(targetPosition);
    }
  }, [
    celestialSystem,
    selectedCelestialBodyId,
    selectedPointOfInterestId, 
    selectedJumpPointId
  ]);

  return (
    <OrbitControls
      makeDefault
      enablePan={enablePan}
      enableZoom={enableZoom}
      enableRotate={enableRotate}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      minDistance={minDistance}
      maxDistance={maxDistance}
    />
  );
};

export default CameraController; 