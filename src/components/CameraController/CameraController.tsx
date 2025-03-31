import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import useAppStore from '../../stores/useAppStore';
import { Vector3 as AppVector3 } from '../../utils/coordinateUtils'; // Rename to avoid clash with THREE.Vector3
import { SCENE_SCALE, MIN_VISUAL_SIZE, getBaseIconSizeByType } from '../../config/constants'; // Import shared constants

// --- Constants ---
const ANIMATION_SPEED = 0.05; // Controls how fast the camera moves (lower is slower)
const POSITION_THRESHOLD = 0.1; // Threshold to stop animation
const SYSTEM_VIEW_DISTANCE = 8; // Set to 8 previously for (0,0,8) default

// --- Focus View Constants ---
const TARGET_FOCUS_DIAMETER_KM = 150000; // Target view diameter in KM (approx 150Mm)
const TARGET_FOCUS_DIAMETER_SCALED = TARGET_FOCUS_DIAMETER_KM * 1000 * SCENE_SCALE; // Convert to meters, then scale

// Factors for zoom range *relative to calculated focus distance*
const MIN_DISTANCE_FACTOR_REL = 0.05; // How close can we get relative to calculated distance?
const MAX_DISTANCE_FACTOR_REL = 100;  // How far can we zoom out relative to calculated distance?

// Default zoom limits (used for system view or if calculations fail)
const DEFAULT_MIN_DISTANCE = 0.0001; // Allow very close system zoom if needed
const DEFAULT_MAX_DISTANCE = 1000; 

interface CameraControllerProps {
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  // min/maxDistance are now dynamic, so removed from props
}

const CameraController: React.FC<CameraControllerProps> = ({
  enablePan = true,
  enableZoom = true,
  enableRotate = true,
  autoRotate = false,
  autoRotateSpeed = 1,
  // minDistance and maxDistance are now managed dynamically
}) => {
  const { camera, gl } = useThree(); // Get gl renderer for OrbitControls
  const controlsRef = useRef<any>(null); // Initialize with null
  const {
    celestialSystem,
    selectedCelestialBodyId,
    selectedPointOfInterestId,
    selectedJumpPointId,
    setCameraPosition,
    setCameraTarget,
  } = useAppStore();

  // State for dynamic zoom limits
  const [currentMinDistance, setCurrentMinDistance] = useState(DEFAULT_MIN_DISTANCE);
  const [currentMaxDistance, setCurrentMaxDistance] = useState(DEFAULT_MAX_DISTANCE);

  // Refs to store animation targets
  const targetPositionRef = useRef<THREE.Vector3 | null>(null);
  const targetLookAtRef = useRef<THREE.Vector3 | null>(null);
  const isAnimatingRef = useRef(false);
  
  // Ref to track click times for preventing double-click
  const lastClickTimeRef = useRef<number>(0);

  // Calculate scaled position
  const getScaledPosition = (pos: AppVector3): THREE.Vector3 => {
    return new THREE.Vector3(
      pos.x * SCENE_SCALE,
      pos.y * SCENE_SCALE,
      pos.z * SCENE_SCALE
    );
  };

  // --- Effect to determine target and trigger animation ---
  useEffect(() => {
    if (!celestialSystem) return;

    let targetLookAtVec: THREE.Vector3 | null = null;
    let targetEntityPosition: AppVector3 | null = null;

    const resetToSystemView = () => {
      targetLookAtVec = new THREE.Vector3(0, 0, 0); // Center of the system
      const systemViewPos = new THREE.Vector3(0, 0, 8); // NEW: (0, 0, 8) for default view
      targetPositionRef.current = systemViewPos;
      targetLookAtRef.current = targetLookAtVec;
      setCurrentMinDistance(DEFAULT_MIN_DISTANCE);
      setCurrentMaxDistance(DEFAULT_MAX_DISTANCE);
      isAnimatingRef.current = true;
      // Update store with final target (system center)
      setCameraPosition({ x: systemViewPos.x / SCENE_SCALE, y: systemViewPos.y / SCENE_SCALE, z: systemViewPos.z / SCENE_SCALE });
      setCameraTarget({ x: 0, y: 0, z: 0 });
    };

    // Find target entity and position (simplified - only need position for lookAt)
    if (selectedCelestialBodyId) {
       console.log(`CameraController: Focusing on celestial body ID: ${selectedCelestialBodyId}`);
       const body = celestialSystem.celestialBodies.find(b => b.id === selectedCelestialBodyId);
       if (body) {
         console.log(`CameraController: Found celestial body: ${body.name}, type: ${body.type}`);
         targetEntityPosition = body.position;
       } else {
         // Check moons
         console.log(`CameraController: Searching for moon with ID: ${selectedCelestialBodyId}`);
         let foundMoon = false;
         
         for (const planet of celestialSystem.celestialBodies) {
           if (!planet.moons || planet.moons.length === 0) continue;
           
           console.log(`CameraController: Checking moons of planet: ${planet.name}, planet position:`, planet.position);
           // Log all moons to see what's available
           planet.moons.forEach(moon => {
             console.log(`CameraController: Moon: ${moon.name}, ID: ${moon.id}, orbit radius: ${moon.orbit.semiMajorAxis}`);
           });
           
           const moon = planet.moons?.find(m => m.id === selectedCelestialBodyId);
           if (moon) {
             console.log(`CameraController: Found moon: ${moon.name} of planet ${planet.name}`);
             foundMoon = true;
             
             // Use a fixed angle for consistent positioning (east of planet)
             const angle = 0; // 0 radians = east direction
             
             // Calculate moon position relative to planet
             // Proper orbital position calculation
             targetEntityPosition = { 
                x: planet.position.x + moon.orbit.semiMajorAxis * Math.cos(angle),
                y: planet.position.y,
                z: planet.position.z + moon.orbit.semiMajorAxis * Math.sin(angle),
             };
             
             // Adjust the target focus diameter based on moon size
             // Moons are typically smaller than planets, so we use a smaller view diameter
             const MOON_TARGET_FOCUS_DIAMETER_KM = 50000; // 50,000 km for moons (1/3 of default)
             const MOON_TARGET_FOCUS_DIAMETER_SCALED = MOON_TARGET_FOCUS_DIAMETER_KM * 1000 * SCENE_SCALE;
             
             // Store the adjusted target diameter for use in distance calculation later
             (window as any).currentTargetDiameter = MOON_TARGET_FOCUS_DIAMETER_SCALED;
             
             console.log(`CameraController: Setting moon position:`, targetEntityPosition);
             console.log(`CameraController: Using adjusted moon focus diameter: ${MOON_TARGET_FOCUS_DIAMETER_KM} km`);
             break;
           }
         }
         
         if (!targetEntityPosition && !foundMoon) {
           console.warn(`Could not find body/moon: ${selectedCelestialBodyId}`);
         }
       }
    } else if (selectedPointOfInterestId) {
      const poi = celestialSystem.pointsOfInterest.find(p => p.id === selectedPointOfInterestId);
      if (poi) targetEntityPosition = poi.position; 
      else console.warn(`Could not find POI: ${selectedPointOfInterestId}`);
    } else if (selectedJumpPointId) {
      const jp = celestialSystem.jumpPoints.find(j => j.id === selectedJumpPointId);
      if (jp) targetEntityPosition = jp.position;
      else console.warn(`Could not find Jump Point: ${selectedJumpPointId}`);
    }

    // --- Set animation targets --- // 
    if (targetEntityPosition) { 
      targetLookAtVec = getScaledPosition(targetEntityPosition);

      // --- Calculate camera distance based on TARGET_FOCUS_DIAMETER_SCALED --- 
      // Assert camera is PerspectiveCamera to access fov
      const perspectiveCamera = camera as THREE.PerspectiveCamera;
      const fovRad = THREE.MathUtils.degToRad(perspectiveCamera.fov);
      
      // Use moon-specific diameter if set earlier
      const targetDiameter = (window as any).currentTargetDiameter || TARGET_FOCUS_DIAMETER_SCALED;
      
      // Approximate distance needed to fit the diameter in the view
      // This uses vertical FOV; adjust if aspect ratio correction is needed
      const distance = (targetDiameter * 0.5) / Math.tan(fovRad * 0.5);
      console.log(`CameraController: Calculated camera distance for target diameter: ${distance}`);

      // Clear the current target diameter after using it
      if ((window as any).currentTargetDiameter) {
        console.log(`CameraController: Used custom target diameter: ${(window as any).currentTargetDiameter}`);
        delete (window as any).currentTargetDiameter;
      }

      // Calculate camera position relative to the target (along Z axis)
      const offsetDirection = new THREE.Vector3(0, 0, 1); 
      const targetCamPos = targetLookAtVec.clone().add(offsetDirection.multiplyScalar(distance));
      console.log(`CameraController: Target LookAt: [${targetLookAtVec.toArray().join(', ')}]`);
      console.log(`CameraController: Target Cam Pos: [${targetCamPos.toArray().join(', ')}]`);

      // Update refs to trigger animation
      targetPositionRef.current = targetCamPos;
      targetLookAtRef.current = targetLookAtVec;

      // --- Set dynamic zoom limits based on calculated distance --- 
      const minD = distance * MIN_DISTANCE_FACTOR_REL;
      const maxD = distance * MAX_DISTANCE_FACTOR_REL;
      const finalMinD = Math.max(minD, DEFAULT_MIN_DISTANCE); // Ensure it doesn't go below absolute min
      const finalMaxD = Math.max(maxD, DEFAULT_MAX_DISTANCE); // Always allow zooming out to at least the default max
      console.log(`CameraController: Setting MinDistance: ${finalMinD}, MaxDistance: ${finalMaxD}`);
      setCurrentMinDistance(finalMinD); 
      setCurrentMaxDistance(finalMaxD);

      console.log("CameraController: Starting animation.");
      isAnimatingRef.current = true;

      // Update store 
      setCameraPosition({ x: targetCamPos.x / SCENE_SCALE, y: targetCamPos.y / SCENE_SCALE, z: targetCamPos.z / SCENE_SCALE });
      setCameraTarget(targetEntityPosition); 

    } else {
      // No selection or target not found, reset to system view
      console.log("CameraController: No selection or target not found. Resetting to system view.");
      resetToSystemView();
    }

  }, [
    celestialSystem,
    selectedCelestialBodyId,
    selectedPointOfInterestId,
    selectedJumpPointId,
    // camera - camera object itself doesn't change, so not needed here
  ]);

  // --- Animation Loop ---
  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isAnimatingRef.current && targetPositionRef.current && targetLookAtRef.current) {
      const camPos = camera.position;
      const ctrlTarget = controls.target;
      const targetPos = targetPositionRef.current;
      const targetLookAt = targetLookAtRef.current;

      // Smoothly interpolate camera position
      camera.position.lerp(targetPositionRef.current, ANIMATION_SPEED);

      // Smoothly interpolate OrbitControls target (lookAt point)
      controls.target.lerp(targetLookAtRef.current, ANIMATION_SPEED);

      const posDist = camera.position.distanceTo(targetPositionRef.current);
      const targetDist = controls.target.distanceTo(targetLookAtRef.current);

      if (posDist < POSITION_THRESHOLD && targetDist < POSITION_THRESHOLD) {
        // Snap to final position/target to avoid tiny drifts
        camera.position.copy(targetPositionRef.current);
        controls.target.copy(targetLookAtRef.current);
        isAnimatingRef.current = false;
        targetPositionRef.current = null; // Clear targets
        targetLookAtRef.current = null;
        console.log(`CameraController: Animation finished naturally. Pos Dist: ${posDist.toFixed(4)}, Target Dist: ${targetDist.toFixed(4)}`);
      }
      controls.update(); // Required after manually changing controls target
    } else if (controls.autoRotate && !isAnimatingRef.current) {
      // Ensure autoRotate works when not animating
      controls.update();
    }
  });

  // Stop animation if user interacts
  const handleInteraction = () => {
    if (isAnimatingRef.current) {
      console.log("CameraController: Animation interrupted by user interaction");
      isAnimatingRef.current = false;
      targetPositionRef.current = null;
      targetLookAtRef.current = null;
    }
  };

  // Function to handle click events and prevent double clicks
  const handleClick = (event: MouseEvent) => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;
    
    // If this is a double-click (typically under 300ms), prevent default behavior
    if (timeSinceLastClick < 300) {
      event.stopPropagation();
      event.preventDefault();
      console.log("CameraController: Double click prevented");
      return;
    }
    
    // Update the last click time
    lastClickTimeRef.current = now;
  };

  useEffect(() => {
    const controls = controlsRef.current;
    const canvas = gl.domElement;
    
    if (controls && canvas) {
      // Add event listeners to detect user interaction
      controls.addEventListener('start', handleInteraction);
      
      // Listen on the canvas element as well for broader interaction detection
      canvas.addEventListener('pointerdown', handleInteraction, { capture: true });
      canvas.addEventListener('wheel', handleInteraction, { capture: true });
      
      // Add click listener to prevent double-click behavior
      canvas.addEventListener('click', handleClick, { capture: true });
      
      return () => {
        controls.removeEventListener('start', handleInteraction);
        canvas.removeEventListener('pointerdown', handleInteraction, { capture: true });
        canvas.removeEventListener('wheel', handleInteraction, { capture: true });
        canvas.removeEventListener('click', handleClick, { capture: true });
      };
    }
  }, [gl]); // Re-attach if gl changes

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={enablePan}
      enableZoom={enableZoom}
      enableRotate={enableRotate}
      autoRotate={autoRotate && !isAnimatingRef.current} // Disable autoRotate during transition
      autoRotateSpeed={autoRotateSpeed}
      minDistance={currentMinDistance} // Use dynamic min distance
      maxDistance={currentMaxDistance} // Use dynamic max distance
      // Disable the doubleClickZoom feature if it exists on OrbitControls
      // @ts-ignore - Property might not exist explicitly in the type definitions
      doubleClickToZoom={false}
      // Damping can make manual control smoother, but interferes with lerp animation
      // enableDamping={!isAnimatingRef.current}
      // dampingFactor={0.1}
    />
  );
};

export default CameraController; 