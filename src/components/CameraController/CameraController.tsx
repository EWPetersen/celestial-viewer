import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js'; // Import TWEEN correctly
import useAppStore from '../../stores/useAppStore';
import { Vector3 as AppVector3 } from '../../utils/coordinateUtils'; // Rename to avoid clash with THREE.Vector3
import { 
  SCENE_SCALE, 
  MIN_VISUAL_SIZE, 
  SYSTEM_VIEW_DISTANCE,
  TARGET_FOCUS_DIAMETER_KM,
  MOON_TARGET_FOCUS_DIAMETER_KM,
  STATION_TARGET_FOCUS_DIAMETER_KM,
  isDetailViewEntityType
} from '../../config/constants'; // Import shared constants
import { validatePosition } from '../../utils/scene';

// --- Constants ---
const ANIMATION_DURATION = 1200; // Duration in milliseconds for smooth transitions
const POSITION_THRESHOLD = 0.001; // Threshold to stop animation (smaller for Tween)

// --- Focus View Constants ---
const TARGET_FOCUS_DIAMETER_SCALED = TARGET_FOCUS_DIAMETER_KM * 1000 * SCENE_SCALE; // Convert to meters, then scale

// --- Detail View Constants ---
const MOON_TARGET_FOCUS_DIAMETER_SCALED = MOON_TARGET_FOCUS_DIAMETER_KM * 1000 * SCENE_SCALE;
const STATION_TARGET_FOCUS_DIAMETER_SCALED = STATION_TARGET_FOCUS_DIAMETER_KM * 1000 * SCENE_SCALE;

// Factors for zoom range *relative to calculated focus distance*
const MIN_DISTANCE_FACTOR_REL = 0.0001; // How close can we get relative to calculated distance? (reduced from 0.0005)
const MAX_DISTANCE_FACTOR_REL = 100;  // How far can we zoom out relative to calculated distance?

// Default zoom limits (used for system view or if calculations fail)
const DEFAULT_MIN_DISTANCE = 0.000001; // Allow very close system zoom if needed (reduced)
const DEFAULT_MAX_DISTANCE = 1000; 

// Default focus distance calculation constants
const BASE_DISTANCE_FACTOR = 1.0; // Base multiplier for entity size (reduced from 1.5)
const MIN_FOCUS_DISTANCE = 0.01; // Minimum distance to prevent clipping
const MAX_FOCUS_DISTANCE_FACTOR = 5; // Max distance relative to entity size
const POINT_LIKE_DISTANCE = 0.35; // Reduced from 0.5 for closer view of points
const MIN_FOCUS_DISTANCE_POINTS = 0.001; // Minimum distance for point-like objects
const MIN_DETAIL_FOCUS_DISTANCE = 0.0001; // Even closer minimum distance for detail view (reduced)

interface CameraControllerProps {
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  setPos: (pos: THREE.Vector3) => void;
  setTarget: (target: THREE.Vector3) => void;
}

const CameraController: React.FC<CameraControllerProps> = ({
  enablePan = true,
  enableZoom = true,
  enableRotate = true,
  autoRotate = false,
  autoRotateSpeed = 1,
  setPos,
  setTarget,
}) => {
  const { camera, gl } = useThree(); // Get gl renderer for OrbitControls
  const controlsRef = useRef<any>(null); // Initialize with null
  const {
    celestialSystem,
    selectedCelestialBodyId,
    selectedPointOfInterestId,
    selectedJumpPointId,
    selectCelestialBody,
    selectPointOfInterest,
    selectJumpPoint,
  } = useAppStore();

  // State for dynamic zoom limits
  const [currentMinDistance, setCurrentMinDistance] = useState(DEFAULT_MIN_DISTANCE);
  const [currentMaxDistance, setCurrentMaxDistance] = useState(DEFAULT_MAX_DISTANCE);

  // Ref to store the current animation tween
  const animationTweenRef = useRef<TWEEN.Tween<{ camX: number, camY: number, camZ: number, lookX: number, lookY: number, lookZ: number }> | null>(null);
  // Ref to prevent starting new animation while one is running
  const isAnimatingRef = useRef(false); 
  // Track right clicks for double-click detection
  const lastRightClickTimeRef = useRef<number>(0);

  // --- State for frame-based updates ---
  const lastPos = useRef(new THREE.Vector3());
  const lastTarget = useRef(new THREE.Vector3());
  const threshold = 0.01; // Only update if changed by more than this amount
  // -------------------------------------

  // Memoize getScaledPosition
  const getScaledPosition = useCallback((pos: AppVector3): THREE.Vector3 => {
    return new THREE.Vector3(
      pos.x * SCENE_SCALE,
      pos.y * SCENE_SCALE,
      pos.z * SCENE_SCALE
    );
  }, []);

  // Memoize startAnimation
  const startAnimation = useCallback((targetPos: THREE.Vector3, targetLookAt: THREE.Vector3) => {
    if (isAnimatingRef.current) {
       console.log("CameraController: Animation already in progress. Skipping new animation.");
       return; // Don't start a new animation if one is running
    }
    
    const controls = controlsRef.current;
    if (!controls) return;

    // Stop any existing tween
    if (animationTweenRef.current) {
      animationTweenRef.current.stop();
    }

    isAnimatingRef.current = true; // Set animating flag

    const startCamPos = camera.position.clone();
    const startLookAt = controls.target.clone();

    console.log(`CameraController: Starting Tween Animation. From Pos: [${startCamPos.toArray().map((v: number) => v.toFixed(10)).join(', ')}], LookAt: [${startLookAt.toArray().map((v: number) => v.toFixed(10)).join(', ')}] To Pos: [${targetPos.toArray().map((v: number) => v.toFixed(10)).join(', ')}], LookAt: [${targetLookAt.toArray().map((v: number) => v.toFixed(10)).join(', ')}]`);

    animationTweenRef.current = new TWEEN.Tween({ 
      camX: startCamPos.x, camY: startCamPos.y, camZ: startCamPos.z,
      lookX: startLookAt.x, lookY: startLookAt.y, lookZ: startLookAt.z
    })
      .to({ 
        camX: targetPos.x, camY: targetPos.y, camZ: targetPos.z,
        lookX: targetLookAt.x, lookY: targetLookAt.y, lookZ: targetLookAt.z
      }, ANIMATION_DURATION)
      .easing(TWEEN.Easing.Quadratic.InOut) // Use Quadratic easing for smooth start/end
      .onUpdate((coords) => {
        camera.position.set(coords.camX, coords.camY, coords.camZ);
        controls.target.set(coords.lookX, coords.lookY, coords.lookZ);
        controls.update(); // Important: Update controls during tween
      })
      .onComplete(() => {
        console.log("CameraController: Tween Animation Completed.");
        isAnimatingRef.current = false; // Reset animating flag
        animationTweenRef.current = null;
        // Optional: Snap to exact final position after tween
        camera.position.copy(targetPos);
        controls.target.copy(targetLookAt);
        controls.update();
      })
      .start(); // Start the tween
  }, [camera, controlsRef, isAnimatingRef, animationTweenRef]);

  // Memoize resetToSystemView
  const resetToSystemView = useCallback((triggeredByDeselect = false) => {
    console.log(`[DEBUG] resetToSystemView called. Triggered by deselect: ${triggeredByDeselect}`);
    const systemLookAt = new THREE.Vector3(0, 0, 0);
    const systemViewPos = new THREE.Vector3(0, 0, SYSTEM_VIEW_DISTANCE); 
    
    startAnimation(systemViewPos, systemLookAt); // Use startAnimation

    setCurrentMinDistance(DEFAULT_MIN_DISTANCE);
    setCurrentMaxDistance(DEFAULT_MAX_DISTANCE);
    
    // Update store with final target (system center)
    setPos(systemViewPos);
    setTarget(systemLookAt);
    
    // If not triggered by a deselect action already in progress, clear all selections
    // This prevents loops if a deselect action itself causes this reset
    if (!triggeredByDeselect) {
       console.log("[DEBUG] resetToSystemView clearing all selections.");
       // Assumes these setters accept null
       if (selectCelestialBody) selectCelestialBody(null);
       if (selectPointOfInterest) selectPointOfInterest(null);
       if (selectJumpPoint) selectJumpPoint(null);
    }
  }, [startAnimation, setCurrentMinDistance, setCurrentMaxDistance, setPos, setTarget, selectCelestialBody, selectPointOfInterest, selectJumpPoint]);

  // --- Effect to determine target and trigger animation ---
  useEffect(() => {
    if (!celestialSystem) return;
    
    let targetLookAtVec: THREE.Vector3 | null = null;
    let targetEntityPosition: AppVector3 | null = null;
    let foundEntityType = 'none'; // Track the type of entity found
    let currentSelectionId: string | null = null;

    // --- Determine Target Based on WHICH ID is set --- 
    if (selectedCelestialBodyId) {
        currentSelectionId = selectedCelestialBodyId;
        const body = celestialSystem.celestialBodies.find(b => b.id === currentSelectionId);
        if (body) {
            targetEntityPosition = body.position;
            foundEntityType = body.type || 'celestialBody';
            console.log(`[MOON-DEBUG] Found celestial body: ${body.name}, type: ${body.type}, position:`, 
              JSON.stringify({
                x: body.position.x.toFixed(10),
                y: body.position.y.toFixed(10),
                z: body.position.z.toFixed(10)
              })
            );
        } else {
            // Search moons only if not found as a main body
            let foundMoon = false;
            for (const planet of celestialSystem.celestialBodies) {
                if (!planet.moons || planet.moons.length === 0) continue;
                const moon = planet.moons?.find(m => m.id === currentSelectionId);
                if (moon) {
                    foundMoon = true;
                    foundEntityType = 'moon'; // Assign type directly
                    const angle = 0;
                    // Calculate moon position from orbit parameters
                    targetEntityPosition = {
                        x: planet.position.x + moon.orbit.semiMajorAxis * Math.cos(angle),
                        y: planet.position.y,
                        z: planet.position.z + moon.orbit.semiMajorAxis * Math.sin(angle),
                    };
                    console.log(`[MOON-DEBUG] Found Moon: ${moon.name} of Planet: ${planet.name}`);
                    console.log(`[MOON-DEBUG] Moon orbit params: semiMajorAxis=${moon.orbit.semiMajorAxis.toFixed(10)}, angle=${angle}`);
                    console.log(`[MOON-DEBUG] Planet position:`, 
                      JSON.stringify({
                        x: planet.position.x.toFixed(10),
                        y: planet.position.y.toFixed(10),
                        z: planet.position.z.toFixed(10)
                      })
                    );
                    console.log(`[MOON-DEBUG] Calculated Moon position:`, 
                      JSON.stringify({
                        x: targetEntityPosition.x.toFixed(10),
                        y: targetEntityPosition.y.toFixed(10),
                        z: targetEntityPosition.z.toFixed(10)
                      })
                    );
                    
                    // Setup custom diameter for moon focus - USING MUCH SMALLER VALUE
                    // 5,000 km instead of 50,000 km for closer zoom
                    const CLOSER_MOON_DIAMETER = 5000 * 1000 * SCENE_SCALE;
                    (window as any).currentTargetDiameter = CLOSER_MOON_DIAMETER;
                    console.log(`[MOON-DEBUG] Using smaller moon focus diameter: ${CLOSER_MOON_DIAMETER.toFixed(16)} (was ${MOON_TARGET_FOCUS_DIAMETER_SCALED.toFixed(16)})`);
                    break;
                }
            }
            if (!targetEntityPosition && !foundMoon) {
                 console.warn(`Could not find CelestialBody/Moon with ID: ${currentSelectionId}`);
            }
        }
    } else if (selectedPointOfInterestId) {
        currentSelectionId = selectedPointOfInterestId;
        const poi = celestialSystem.pointsOfInterest.find(p => p.id === currentSelectionId);
        if (poi) {
            targetEntityPosition = poi.position;
            foundEntityType = poi.type || 'poi'; // Use POI type (e.g., 'lagrangepoint')
            console.log(`[DEBUG] Found Target: POI ID=${currentSelectionId}, Type=${foundEntityType}, Raw Pos=`, 
              JSON.stringify({
                x: targetEntityPosition.x.toFixed(10),
                y: targetEntityPosition.y.toFixed(10),
                z: targetEntityPosition.z.toFixed(10)
              })
            );
            
            // Setup custom diameter for stations and other POIs
            if (['station', 'outpost', 'reststop', 'landingzone', 'commarray'].includes(foundEntityType)) {
                (window as any).currentTargetDiameter = STATION_TARGET_FOCUS_DIAMETER_SCALED;
            }
        } else {
            console.warn(`Could not find POI with ID: ${currentSelectionId}`);
        }
    } else if (selectedJumpPointId) {
        currentSelectionId = selectedJumpPointId;
        const jp = celestialSystem.jumpPoints.find(j => j.id === currentSelectionId);
        if (jp) {
            targetEntityPosition = jp.position;
            foundEntityType = 'jumpPoint';
            console.log(`[DEBUG] Found Target: JumpPoint ID=${currentSelectionId}, Type=${foundEntityType}, Raw Pos=`, 
              JSON.stringify({
                x: targetEntityPosition.x.toFixed(10),
                y: targetEntityPosition.y.toFixed(10),
                z: targetEntityPosition.z.toFixed(10)
              })
            );
            
            // Setup custom diameter for jump points
            (window as any).currentTargetDiameter = STATION_TARGET_FOCUS_DIAMETER_SCALED;
        } else {
             console.warn(`Could not find JumpPoint with ID: ${currentSelectionId}`);
        }
    }
    // --- End Determine Target ---

    if (targetEntityPosition) { 
      // Ensure position is valid
      if (isNaN(targetEntityPosition.x) || isNaN(targetEntityPosition.y) || isNaN(targetEntityPosition.z)) {
        console.error("[DEBUG] Invalid targetEntityPosition (contains NaN):", targetEntityPosition);
        resetToSystemView(true); // Reset if position is bad
        return;
      }
      
      targetLookAtVec = getScaledPosition(targetEntityPosition);
      // Check scaled position too
       if (isNaN(targetLookAtVec.x) || isNaN(targetLookAtVec.y) || isNaN(targetLookAtVec.z)) {
        console.error("[DEBUG] Invalid targetLookAtVec after scaling (contains NaN):", targetLookAtVec.toArray());
        resetToSystemView(true); // Reset if scaled position is bad
        return;
      }
      console.log(`[DEBUG] Calculated LookAt Vector (Scene Coords):`, targetLookAtVec.toArray().map(v => v.toFixed(12)));

      const perspectiveCamera = camera as THREE.PerspectiveCamera;
      const fovRad = THREE.MathUtils.degToRad(perspectiveCamera.fov);
      const usedDefaultDiameter = !(window as any).currentTargetDiameter;
      const targetDiameter = (window as any).currentTargetDiameter || TARGET_FOCUS_DIAMETER_SCALED;
      console.log(`[DEBUG] Using Target Diameter: ${targetDiameter.toFixed(12)}, Used Default: ${usedDefaultDiameter}`);

      // --- Minimum Distance Check Logic --- 
      let calculatedDistance = (targetDiameter * 0.5) / Math.tan(fovRad * 0.5);
      // Use the foundEntityType determined earlier
      const isPointLike = ['poi', 'jumpPoint', 'lagrangepoint'].includes(foundEntityType); 
      const isDetailViewType = ['moon', 'station', 'outpost', 'reststop', 'landingzone', 'commarray', 'jumpPoint'].includes(foundEntityType);

      console.log(`[MOON-DEBUG] Initial Calculated Distance: ${calculatedDistance.toFixed(16)}`);
      console.log(`[MOON-DEBUG] FOV: ${perspectiveCamera.fov.toFixed(6)}, FOV Radians: ${fovRad.toFixed(6)}`);
      console.log(`[MOON-DEBUG] Target Diameter: ${targetDiameter.toFixed(16)}, Entity Type: ${foundEntityType}`);
      console.log(`[MOON-DEBUG] Camera current position:`, camera.position.toArray().map((v: number) => v.toFixed(16)).join(', '));
      
      // Apply different minimum distance based on entity type
      if (isDetailViewType) {
        console.log(`[MOON-DEBUG] Using detail view settings, min distance: ${MIN_DETAIL_FOCUS_DISTANCE}`);
        
        // Special treatment for moons - force a much closer distance
        if (foundEntityType === 'moon') {
          // Reduce the calculated distance for moons by 80% to get much closer
          calculatedDistance *= 0.2;
          console.log(`[MOON-DEBUG] SPECIAL HANDLING: Reducing moon distance by 80% to ${calculatedDistance.toFixed(16)}`);
        }
        
        if (calculatedDistance < MIN_DETAIL_FOCUS_DISTANCE) {
          calculatedDistance = MIN_DETAIL_FOCUS_DISTANCE;
          console.log(`[MOON-DEBUG] Applied Min Detail Distance. Final distance: ${calculatedDistance.toFixed(16)}`);
        }
      } else if (isPointLike && calculatedDistance < MIN_FOCUS_DISTANCE_POINTS) {
        calculatedDistance = MIN_FOCUS_DISTANCE_POINTS;
        console.log(`[MOON-DEBUG] Applied Min Distance for Point-Like. Final distance: ${calculatedDistance.toFixed(16)}`);
      } else if (isNaN(calculatedDistance)) {
        console.error("[MOON-DEBUG] Calculated distance is NaN! Resetting.");
        resetToSystemView(true);
        return;
      }
      const distance = calculatedDistance;
      // --- End Minimum Distance Check --- 

      if ((window as any).currentTargetDiameter) delete (window as any).currentTargetDiameter;
      
      // Use a different offset direction based on entity type for detail views
      let offsetDirection;
      if (isDetailViewType) {
        if (foundEntityType === 'moon') {
          // For moons, use an even more dramatic angle to better see the surface
          offsetDirection = new THREE.Vector3(0.7, 0.4, 0.6).normalize();
          console.log(`[MOON-DEBUG] Using SPECIAL moon camera angle, normalized: [${offsetDirection.x.toFixed(6)}, ${offsetDirection.y.toFixed(6)}, ${offsetDirection.z.toFixed(6)}]`);
        } else {
          // For other stations/POIs, use the standard detail view angle
          offsetDirection = new THREE.Vector3(0.5, 0.3, 1).normalize();
          console.log(`[MOON-DEBUG] Using detail view camera angle, normalized: [${offsetDirection.x.toFixed(6)}, ${offsetDirection.y.toFixed(6)}, ${offsetDirection.z.toFixed(6)}]`);
        }
      } else {
        offsetDirection = new THREE.Vector3(0, 0, 1);
        console.log(`[MOON-DEBUG] Using standard camera angle: [0, 0, 1]`);
      }
      
      const targetCamPos = targetLookAtVec.clone().add(offsetDirection.multiplyScalar(distance));
      console.log(`[MOON-DEBUG] Final camera position calculation:`);
      console.log(`[MOON-DEBUG] - Target look-at: [${targetLookAtVec.x.toFixed(16)}, ${targetLookAtVec.y.toFixed(16)}, ${targetLookAtVec.z.toFixed(16)}]`);
      console.log(`[MOON-DEBUG] - Distance: ${distance.toFixed(16)}`);
      console.log(`[MOON-DEBUG] - Final camera position: [${targetCamPos.x.toFixed(16)}, ${targetCamPos.y.toFixed(16)}, ${targetCamPos.z.toFixed(16)}]`);

      startAnimation(targetCamPos, targetLookAtVec);
      
      // Adjust min/max distance factors for detail view
      let minDistanceFactor = MIN_DISTANCE_FACTOR_REL;
      let maxDistanceFactor = MAX_DISTANCE_FACTOR_REL;
      
      if (isDetailViewType) {
        if (foundEntityType === 'moon') {
          // Moon-specific distance factors - allow MUCH closer zoom but limited pull-back
          minDistanceFactor = 0.0001; // Allow extremely close zoom for moons
          maxDistanceFactor = 10;     // Limit how far you can zoom out from moon view
          console.log(`[MOON-DEBUG] Using SPECIAL moon zoom limits - min factor: ${minDistanceFactor}, max factor: ${maxDistanceFactor}`);
        } else {
          // Standard detail view factors for other objects
          minDistanceFactor = 0.002;
          maxDistanceFactor = 20;
        }
      }
      
      const minD = distance * minDistanceFactor;
      const maxD = distance * maxDistanceFactor;
      const finalMinD = Math.max(minD, isDetailViewType ? MIN_DETAIL_FOCUS_DISTANCE : DEFAULT_MIN_DISTANCE); 
      const finalMaxD = Math.max(maxD, DEFAULT_MAX_DISTANCE); 
      console.log(`[DEBUG] useEffect (Focus): Setting distances: min=${finalMinD.toFixed(12)}, max=${finalMaxD.toFixed(12)}`);
      setCurrentMinDistance(finalMinD); 
      setCurrentMaxDistance(finalMaxD);
      setPos(targetCamPos);
      setTarget(targetLookAtVec);
    } else {
      // No selection ID set, or target position could not be determined for the set ID
      if (currentSelectionId) {
        console.log(`[DEBUG] Entity not found for ID: ${currentSelectionId}. Resetting view.`);
      }
      resetToSystemView(false); 
    }
  }, [
    // Keep existing dependencies
    celestialSystem, selectedCelestialBodyId, selectedPointOfInterestId, 
    selectedJumpPointId, camera, getScaledPosition, setPos, setTarget, startAnimation, resetToSystemView 
  ]);

  // --- Animation Loop (for TWEEN) ---
  useFrame((state, delta) => {
    TWEEN.update(); // Update TWEEN animations
    const controls = controlsRef.current;
    if (!controls) return;
    
    // Update store only if not animating and camera has moved manually
    if (!isAnimatingRef.current) {
      // Basic check if camera/target moved slightly
      // You might need more robust checks depending on interaction types
      // Update store with current camera state
      const currentPos = camera.position;
      const currentTarget = controls.target;
      
      if (currentPos.distanceTo(lastPos.current) > threshold || 
          currentTarget.distanceTo(lastTarget.current) > threshold) {
        
        const clonedPos = currentPos.clone();
        const clonedTarget = currentTarget.clone();
        
        setPos(clonedPos);
        setTarget(clonedTarget);
        
        lastPos.current.copy(clonedPos);
        lastTarget.current.copy(clonedTarget);
      }
    }
  });

  // --- Click Handling ---
  useEffect(() => {
    const controlsElement = gl.domElement;

    // Prevent default double-click zoom behavior
    const handleDoubleClick = (event: MouseEvent) => {
      event.preventDefault(); 
      // We handle focus via single click on mesh, so double-click does nothing here
      console.log("CameraController: Double click prevented.");
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault(); // Prevent browser context menu
      
      const now = performance.now();
      const timeSinceLastClick = now - lastRightClickTimeRef.current;

      if (timeSinceLastClick < 300) { // 300ms threshold for double click
        console.log("CameraController: Double Right Click Detected - Resetting View");
        resetToSystemView(false); // Not triggered by deselect action itself
      }
      
      lastRightClickTimeRef.current = now;
    };

    controlsElement.addEventListener('dblclick', handleDoubleClick);
    controlsElement.addEventListener('contextmenu', handleContextMenu);

    return () => {
      controlsElement.removeEventListener('dblclick', handleDoubleClick);
      controlsElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gl, resetToSystemView]); // Add resetToSystemView as dependency if it clears state

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={enablePan}
      enableZoom={enableZoom}
      enableRotate={enableRotate}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      minDistance={currentMinDistance} // Use dynamic min distance
      maxDistance={currentMaxDistance} // Use dynamic max distance
      // Disable damping for Tween-controlled animation
      // enableDamping={!isAnimatingRef.current} 
      // dampingFactor={0.1}
    />
  );
};

export default CameraController; 