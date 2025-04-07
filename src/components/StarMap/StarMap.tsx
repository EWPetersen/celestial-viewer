import React, { useRef, useState, useEffect, Suspense, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import useAppStore, { CelestialBody as CelestialBodyType, JumpPoint as JumpPointType, PointOfInterest as PointOfInterestType } from '../../stores/useAppStore';
import { calculateOrbitPosition, degreesToRadians, Vector3 } from '../../utils/coordinateUtils';
import { calculateScaleFactor } from '../../utils/distanceUtils';
import { EntityRenderer, EntityType } from '../EntityVisuals';
import { configureRenderer, validatePosition } from '../../utils/scene';
import SceneControls from '../UI/SceneControls';
import CameraController from '../CameraController/CameraController';
import { 
  SCENE_SCALE, 
  SYSTEM_VIEW_THRESHOLD, 
  DETAIL_VIEW_THRESHOLD 
} from '../../config/constants';

// Set to false for production
const DEBUG_VISIBILITY = false;

// Fallback component for loading state or errors
const FallbackObject = ({ name = "Loading..." }: { name?: string }) => (
  <group>
    <mesh>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshBasicMaterial color="#444444" wireframe={true} />
    </mesh>
    <Text 
      position={[0, 0.3, 0]} 
      color="#888888"
      fontSize={0.1}
      anchorX="center"
      anchorY="middle"
    >
      {name}
    </Text>
  </group>
);

// Orbit line component
const OrbitLine: React.FC<{
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  color?: string;
}> = ({ semiMajorAxis, eccentricity, inclination, color = '#334455' }) => {
  try {
    const points = [];
    const segments = 64;
    
    // Validate inputs to prevent NaN errors
    const validSemiMajorAxis = isFinite(semiMajorAxis) && semiMajorAxis > 0 ? semiMajorAxis : 1000000;
    const validEccentricity = isFinite(eccentricity) ? Math.min(0.99, Math.max(0, eccentricity)) : 0;
    const validInclination = isFinite(inclination) ? inclination : 0;
    
    // Calculate points for elliptical orbit
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const point = calculateOrbitPosition(
        validSemiMajorAxis,
        validEccentricity,
        degreesToRadians(validInclination),
        0,
        0,
        angle
      );
      
      // Scale down for visualization
      points.push(new THREE.Vector3(
        point.x * 0.0000000001,
        point.y * 0.0000000001,
        point.z * 0.0000000001
      ));
    }
    
    // Create a smooth curve from the points
    const curve = new THREE.CatmullRomCurve3(points, true);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      curve.getPoints(segments)
    );
    
    return (
      <line>
        <bufferGeometry attach="geometry" {...geometry} />
        <lineBasicMaterial attach="material" color={color} opacity={0.5} transparent={true} />
      </line>
    );
  } catch (error) {
    return null;
  }
};

// Jump point component
const JumpPoint: React.FC<{
  id: string;
  name: string;
  position: Vector3;
  destinationSystem: string;
  showOrbits: boolean;
  parentPosition: Vector3 | null;
  relativePosition: Vector3 | null;
  labelDistanceScale: number;
}> = ({ id, name, position, destinationSystem, showOrbits, parentPosition, relativePosition, labelDistanceScale }) => {
  const { selectedJumpPointId, selectJumpPoint } = useAppStore();
  const isSelected = selectedJumpPointId === id;
  
  // Validate inputs
  if (!position || 
      typeof position.x !== 'number' || 
      typeof position.y !== 'number' || 
      typeof position.z !== 'number' ||
      !isFinite(position.x) || 
      !isFinite(position.y) || 
      !isFinite(position.z)) {
    return <FallbackObject name={`Error: ${name}`} />;
  }
  
  // Use validated position
  const safePosition = validatePosition(position);
  
  // Scale for visualization
  const size = 0.2;
  
  return (
    <Suspense fallback={<FallbackObject name={name} />}>
      <EntityRenderer
        id={id}
        name={name}
        position={safePosition}
        size={size * 200000000} // Convert to appropriate scale
        type="jumppoint"
        isSelected={isSelected}
        color="#ff00ff"
        showOrbits={showOrbits}
        parentPosition={parentPosition}
        relativePosition={relativePosition}
      />
    </Suspense>
  );
};

// Point of interest component
const PointOfInterest: React.FC<{
  id: string;
  name: string;
  position: Vector3;
  type: string;
  showOrbits: boolean;
  parentPosition: Vector3 | null;
  relativePosition: Vector3 | null;
  labelDistanceScale: number;
}> = ({ id, name, position, type, showOrbits, parentPosition, relativePosition, labelDistanceScale }) => {
  const { selectedPointOfInterestId, selectPointOfInterest } = useAppStore();
  const isSelected = selectedPointOfInterestId === id;
  
  // Validate inputs
  if (!position || 
      typeof position.x !== 'number' || 
      typeof position.y !== 'number' || 
      typeof position.z !== 'number' ||
      !isFinite(position.x) || 
      !isFinite(position.y) || 
      !isFinite(position.z)) {
    return <FallbackObject name={`Error: ${name}`} />;
  }
  
  // Use validated position
  const safePosition = validatePosition(position);
  
  // Scale for visualization based on type
  const getSize = () => {
    switch (type) {
      case 'station': return 0.15 * 200000000;
      case 'outpost': return 0.12 * 200000000;
      case 'commarray': return 0.1 * 200000000;
      case 'landingzone': return 0.15 * 200000000;
      case 'reststop': return 0.15 * 200000000;
      case 'lagrangepoint': return 0.2 * 200000000;
      default: return 0.1 * 200000000;
    }
  };
  
  return (
    <Suspense fallback={<FallbackObject name={name} />}>
      <EntityRenderer
        id={id}
        name={name}
        position={safePosition}
        size={getSize()}
        type={type || 'unknown'}
        isSelected={isSelected}
        showOrbits={showOrbits}
        parentPosition={parentPosition}
        relativePosition={relativePosition}
        labelDistanceScale={labelDistanceScale}
      />
    </Suspense>
  );
};

// Props for SceneContent
interface SceneContentProps {
  hiddenTypes: Set<EntityType>;
  showLabels: boolean;
  showOrbits: boolean;
  labelDistanceScale: number;
}

// Scene component
const SceneContent: React.FC<SceneContentProps> = ({ 
  hiddenTypes, 
  showLabels,
  showOrbits,
  labelDistanceScale
}) => {
  const { camera } = useThree();
  const { 
    celestialSystem, 
    selectedCelestialBodyId, 
    selectedPointOfInterestId,
    selectedJumpPointId
  } = useAppStore();
  
  // Debug visibility issues
  const lastCameraDistance = useRef(0);
  const lastObjectVisibility = useRef<{[key: string]: boolean}>({});
  
  // Get camera distance from center to scale orbit paths appropriately
  const cameraDistance = camera.position.length();

  // State to store nearest planet info
  const [manualZoomContext, setManualZoomContext] = useState<string | null>(null);
  
  // --- Determine the current visibility context --- 
  let contextId: string | null = null;
  let isSystemView = cameraDistance > SYSTEM_VIEW_THRESHOLD;
  let isDetailView = cameraDistance < DETAIL_VIEW_THRESHOLD;
  
  // Find the current camera focus point (where the camera is looking)
  const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  
  // Create a raycaster for detecting what the camera is looking at
  const raycaster = new THREE.Raycaster();
  const rayOrigin = camera.position.clone();
  const rayDirection = cameraDirection.clone();
  raycaster.set(rayOrigin, rayDirection);

  // Track camera zoom change for manual context detection
  useEffect(() => {
    // Only run this if we don't have a selected entity but are zoomed in
    if (!selectedCelestialBodyId && !selectedPointOfInterestId && !selectedJumpPointId && cameraDistance < 5.0) {
      // We're zoomed in without a selection - find the closest planet
      if (celestialSystem) {
        let closestPlanet: CelestialBodyType | null = null;
        let closestDistance = Infinity;
        let closestAngle = Infinity;
        
        // Convert celestial bodies to intersection test objects
        const testObjects: THREE.Object3D[] = [];
        const objectMap = new Map<THREE.Object3D, CelestialBodyType>();
        
        celestialSystem.celestialBodies.forEach(body => {
          if (body.type === 'planet') {
            // Create a temporary sphere for intersection testing
            const sphere = new THREE.Mesh(
              new THREE.SphereGeometry(body.radius * SCENE_SCALE * 1.5), // Make the collision sphere a bit larger
              new THREE.MeshBasicMaterial({ visible: false })
            );
            sphere.position.set(
              body.position.x * SCENE_SCALE,
              body.position.y * SCENE_SCALE,
              body.position.z * SCENE_SCALE
            );
            testObjects.push(sphere);
            objectMap.set(sphere, body);
          }
        });
        
        // Cast a ray from the camera to see if it hits any planets
        const intersects = raycaster.intersectObjects(testObjects);
        
        // If we hit a planet directly with the ray, use it regardless of distance
        if (intersects.length > 0 && intersects[0].distance < 10.0) {
          const hitObject = intersects[0].object;
          const hitPlanet = objectMap.get(hitObject);
          
          if (hitPlanet) {
            const planetId = hitPlanet.id;
            if (manualZoomContext !== planetId) {
              if (DEBUG_VISIBILITY) {
                console.log(`[DEBUG-VISIBILITY] Ray hit planet: ${hitPlanet.name} (${planetId}), distance: ${intersects[0].distance.toFixed(2)}`);
              }
              setManualZoomContext(planetId);
              return;
            }
          }
        }
        
        // Fallback to angle-based detection if ray doesn't hit anything
        celestialSystem.celestialBodies.forEach(body => {
          if (body.type === 'planet') {
            // Get planet position in scene coords
            const bodyPos = new THREE.Vector3(
              body.position.x * SCENE_SCALE,
              body.position.y * SCENE_SCALE,
              body.position.z * SCENE_SCALE
            );
            
            // Calculate distance from camera to planet
            const distanceToBody = camera.position.distanceTo(bodyPos);
            
            // Calculate angle between camera forward vector and direction to planet
            const dirToBody = new THREE.Vector3().subVectors(bodyPos, camera.position).normalize();
            const angleToBody = dirToBody.angleTo(cameraDirection);
            
            // Check if this planet is in the camera's field of view (angle < 60 degrees)
            const inFieldOfView = angleToBody < Math.PI/3;
            
            // We prioritize planets in the field of view, but also consider distance
            if (inFieldOfView && (angleToBody < closestAngle || 
                               (Math.abs(angleToBody - closestAngle) < 0.1 && distanceToBody < closestDistance))) {
              closestDistance = distanceToBody;
              closestAngle = angleToBody;
              closestPlanet = body;
            } else if (!inFieldOfView && !closestPlanet && distanceToBody < closestDistance) {
              // Fallback to closest planet if none are in field of view
              closestDistance = distanceToBody;
              closestAngle = angleToBody;
              closestPlanet = body;
            }
          }
        });
        
        // If we found a planet in our view that's close enough
        if (closestPlanet && (closestDistance < 4.0 || (closestDistance < 10.0 && closestAngle < Math.PI/6))) {
          const planetId = (closestPlanet as any).id;
          if (manualZoomContext !== planetId) {
            if (DEBUG_VISIBILITY) {
              console.log(`[DEBUG-VISIBILITY] Setting manual zoom context to: ${(closestPlanet as any).name} (${planetId}), distance: ${closestDistance.toFixed(2)}, angle: ${(closestAngle * 180/Math.PI).toFixed(1)}°`);
            }
            setManualZoomContext(planetId);
          }
        } else if (manualZoomContext) {
          // Reset context if we're not close to any planet anymore
          setManualZoomContext(null);
        }
      }
    } else if (manualZoomContext && (selectedCelestialBodyId || cameraDistance >= 5.0)) {
      // Reset manual context if we select something or zoom out
      setManualZoomContext(null);
    }
  }, [cameraDistance, selectedCelestialBodyId, selectedPointOfInterestId, selectedJumpPointId, celestialSystem, cameraDirection, manualZoomContext, raycaster]);
  
  // Determine visibility context from selection or manual zoom
  if (selectedCelestialBodyId) {
    contextId = selectedCelestialBodyId;
    
    // Check if the selected body is a moon, which means we're in detail view
    const selectedBody = celestialSystem?.celestialBodies.find(b => b.id === selectedCelestialBodyId);
    if (selectedBody && selectedBody.type === 'moon') {
      isDetailView = true;
    }
    
  } else if (selectedPointOfInterestId) {
    const selectedPOI = celestialSystem?.pointsOfInterest.find(p => p.id === selectedPointOfInterestId);
    
    // If the POI has a parent, we're in its context 
    contextId = selectedPOI?.parentId || null;
    
    // All POI selections automatically trigger detail view
    isDetailView = true;
    isSystemView = false;
  } else if (selectedJumpPointId) {
    const selectedJP = celestialSystem?.jumpPoints.find(j => j.id === selectedJumpPointId);
    
    // If JP has a parent, we're in its context
    contextId = selectedJP?.parentId || null;
    
    // All jump point selections automatically trigger detail view
    isDetailView = true;
    isSystemView = false;
  } else if (manualZoomContext && cameraDistance < 5.0) {
    // Use manual zoom context if we're zoomed in
    contextId = manualZoomContext;
    isSystemView = false;
    
    if (DEBUG_VISIBILITY) {
      console.log(`[DEBUG-VISIBILITY] Using manual zoom context: ${manualZoomContext}`);
    }
  }
  
  // If no selection or selected item has no parent, context is the root (star)
  if (isSystemView || !contextId) {
    contextId = celestialSystem?.rootId || null;
  }
  
  // Debug when camera distance changes significantly
  useFrame(() => {
    if (DEBUG_VISIBILITY) {
      const currentDistance = camera.position.length();
      if (Math.abs(currentDistance - lastCameraDistance.current) > 0.3) {
        const forwardPoint = new THREE.Vector3().copy(camera.position).add(
          cameraDirection.clone().multiplyScalar(currentDistance)
        );
        
        console.log(`[DEBUG-VISIBILITY] Camera distance: ${currentDistance.toFixed(3)}, ` +
                   `isSystemView: ${isSystemView}, manualContext: ${manualZoomContext || 'none'}, ` +
                   `contextId: ${contextId || 'none'}, ` +
                   `camera forward: [${forwardPoint.x.toFixed(2)}, ${forwardPoint.y.toFixed(2)}, ${forwardPoint.z.toFixed(2)}]`);
        
        lastCameraDistance.current = currentDistance;
      }
    }
  });
  
  // Add debug flag to the filter function
  const debugFilter = DEBUG_VISIBILITY && cameraDistance >= 1.0 && cameraDistance <= 4.0;
  
  if (!celestialSystem) {
    return null;
  }
  
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={3} color="#ffffff" distance={100} decay={2} />
      <directionalLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} />

      {/* Render celestial bodies (Planets/Stars) */}
      {celestialSystem.celestialBodies
        // Filter based on context AND hiddenTypes
        .filter(body => {
          if (hiddenTypes.has(body.type as EntityType)) return false; // Check hidden first
          
          // Always show the root star
          if (body.id === celestialSystem.rootId) return true;
          
          // In system view, show direct children of the star
          if (isSystemView && body.parentId === celestialSystem.rootId) return true;
          
          if (!isSystemView) {
            // Show the focused body itself
            if (body.id === contextId) return true;
            
            // Show the parent of the focused body (if focusing on a moon)
            const selectedBody = celestialSystem.celestialBodies.find(b => b.id === contextId);
            if (selectedBody && selectedBody.parentId && body.id === selectedBody.parentId) return true;
            
            // ALSO show the parent's parent (e.g., show star when focusing on a moon)
            if (selectedBody && selectedBody.parentId) {
              const parentBody = celestialSystem.celestialBodies.find(b => b.id === selectedBody.parentId);
              if (parentBody && parentBody.parentId && body.id === parentBody.parentId) return true;
            }
            
            // In detail view, only show siblings (other moons of the same parent) if moon is selected
            if (isDetailView && selectedCelestialBodyId) {
              const selectedBody = celestialSystem.celestialBodies.find(b => b.id === selectedCelestialBodyId);
              if (selectedBody && selectedBody.type === 'moon' && selectedBody.parentId && 
                  body.parentId === selectedBody.parentId && body.type === 'moon') {
                return true;
              }
            } else {
              // In planet view, show siblings (other moons of the same parent)
              if (selectedBody && selectedBody.parentId && body.parentId === selectedBody.parentId) return true;
            }
            
            // In detail view for a station/POI, only show the parent planet
            if (isDetailView && (selectedPointOfInterestId || selectedJumpPointId)) {
              // Already showing the parent planet via contextId check above
              return false;
            }
            
            // Always show child objects of the current context planet
            // This is the CRITICAL check for showing moons when zoomed in on a planet
            if (body.parentId === contextId) {
              if (debugFilter && body.type === 'moon') {
                console.log(`[DEBUG-VISIBILITY-MOON] ${body.name} (child of context ${contextId}) is visible`);
              }
              return true;
            }
          }
          
          // Hide other planets/moons
          if (debugFilter && body.type === 'moon') {
            const parentBody = body.parentId ? 
              celestialSystem.celestialBodies.find(b => b.id === body.parentId) : null;
            
            console.log(`[DEBUG-VISIBILITY-MOON] ${body.name} filtered out: isSystemView=${isSystemView}, contextId=${contextId}, parentId=${body.parentId}, parentName=${parentBody?.name}`);
          }
          
          return false;
        })
        .map((body) => {
          // Find parent entity for relative position calculations
          const parentBody = body.parentId ? 
            celestialSystem.celestialBodies.find(b => b.id === body.parentId) : 
            null;
            
          // Get relative position if parent exists
          const relativePosition = parentBody ? {
            x: body.position.x - parentBody.position.x,
            y: body.position.y - parentBody.position.y,
            z: body.position.z - parentBody.position.z
          } : null;
          
          // Calculate orbit radius for planet/moon orbits
          const orbitRadius = relativePosition ? 
            Math.sqrt(relativePosition.x * relativePosition.x + 
                    relativePosition.y * relativePosition.y + 
                    relativePosition.z * relativePosition.z) : 0;
          
          // Update the visibility tracker for debugging
          if (DEBUG_VISIBILITY) {
            lastObjectVisibility.current[body.id] = true;
          }
              
          return (
            <React.Fragment key={body.id || Math.random().toString()}>
              <Suspense fallback={<FallbackObject name={body.name} />}>
                <EntityRenderer
                  id={body.id}
                  name={body.name}
                  position={validatePosition(body.position)}
                  size={body.radius * 2} // Convert radius to diameter
                  type={body.type}
                  isSelected={useAppStore.getState().selectedCelestialBodyId === body.id}
                  showLabel={showLabels}
                  showOrbits={showOrbits && (body.type === 'planet' || body.type === 'moon')} // Only show orbits for planets/moons
                  parentPosition={parentBody ? parentBody.position : null}
                  relativePosition={relativePosition}
                  labelDistanceScale={labelDistanceScale}
                />
              </Suspense>
              
              {/* Render orbital paths for planets and moons when orbits are enabled */}
              {showOrbits && body.parentId && (body.type === 'planet' || body.type === 'moon') && (
                <mesh 
                  position={[
                    parentBody ? parentBody.position.x * SCENE_SCALE : 0,
                    parentBody ? parentBody.position.y * SCENE_SCALE : 0,
                    parentBody ? parentBody.position.z * SCENE_SCALE : 0
                  ]}
                  renderOrder={-1} // Negative renderOrder ensures orbit paths render behind celestial objects
                >
                  {(() => {
                    // Calculate appropriate orbit thickness based on camera distance and selection state
                    const isSelected = body.id === selectedCelestialBodyId;
                    
                    // Determine if this object is currently in focus view
                    const isFocusedObject = !isSystemView && contextId === body.id;
                    
                    // Determine if this is a parent orbit of the selected body for thickness calculation
                    let isParentOrbit = false;
                    if (selectedCelestialBodyId) {
                      const selectedBody = celestialSystem.celestialBodies.find(b => b.id === selectedCelestialBodyId);
                      if (selectedBody && selectedBody.parentId === body.id) {
                        isParentOrbit = true;
                      }
                    }
                    
                    // Base thickness values (will be divided by distanceFactor later)
                    let baseThickness;
                    if (isSelected) {
                      baseThickness = 0.005; // Selected orbit - significantly increased for better visibility
                    } else if (isParentOrbit) {
                      baseThickness = 0.004; // Parent orbit - increased for better visibility
                    } else if (!isSystemView && body.type === 'planet') {
                      baseThickness = 0.0005; // Planet orbits in focused view - kept thin
                    } else if (!isSystemView && body.type === 'moon') {
                      baseThickness = 0.004; // Moon orbits in focused view - increased significantly for better visibility
                    } else {
                      baseThickness = 0.0045; // Default thickness - significantly increased for better visibility at system view
                    }
                    
                    // Calculate final thickness with exponential scaling based on camera distance
                    // Use a different exponential factor for system view vs focus view
                    let exponent = isSystemView ? 1.2 : 3.5; // Reduced exponent for system view to keep orbits thicker
                    
                    // Special case for moons in focus view - use lower exponent for better visibility
                    if (!isSystemView && body.type === 'moon') {
                      exponent = 2.0; // Lower exponent for moons in focus view
                    }
                    
                    // FIXED: Adjust distance factor based on actual camera distance to prevent
                    // orbits from being too large when zooming in manually
                    const adjustedDistance = Math.max(0.5, cameraDistance);
                    const distanceFactor = Math.max(1, Math.pow(adjustedDistance, exponent) / 10); // Reduced division factor
                    
                    // Calculate initial thickness
                    let thickness = baseThickness / distanceFactor;
                    
                    // Scale thickness based on entity size to ensure orbits aren't larger than entities
                    const entityRadius = body.radius * SCENE_SCALE || 0.1;
                    
                    // For system view, use a min thickness to ensure visibility
                    let minThickness = isSystemView ? 0.0012 : 0.00001; // Increased minimum thickness for system view
                    
                    // Special case for moons - higher minimum thickness to ensure visibility
                    if (body.type === 'moon') {
                      minThickness = isSystemView ? 0.0015 : 0.0008; // Higher min thickness for moons
                    }
                    
                    // Check if we should hide this orbit because we're focused on a different object
                    // and this orbit would draw through the system
                    const shouldHideOrbit = !isSystemView && 
                                          !isSelected && 
                                          !isParentOrbit && 
                                          body.type === 'planet' && 
                                          contextId !== celestialSystem.rootId;
                    
                    // For focused view, use entity radius to constrain max thickness
                    let maxThicknessRatio = isSystemView ? 0.8 : 0.1; // Percentage of entity radius - increased for system view
                    
                    // Special case for moons - higher max thickness ratio
                    if (body.type === 'moon') {
                      maxThicknessRatio = isSystemView ? 1.0 : 0.5; // Higher ratio for moons
                    }
                    
                    // FIXED: Apply maximum thickness constraint based on camera distance to prevent
                    // orbits from being too large when zooming in manually
                    const maxThickness = Math.min(
                      Math.max(minThickness, entityRadius / (orbitRadius * SCENE_SCALE) * maxThicknessRatio),
                      // Add a distance-based maximum constraint
                      0.2 / Math.max(0.1, adjustedDistance)
                    );
                    
                    // Apply additional dynamic scaling for very close views
                    if (cameraDistance < 0.5) {
                      // Extremely close - make orbits very thin
                      thickness *= 0.001;
                    } else if (cameraDistance < 1) {
                      // Very close - make orbits thin
                      thickness *= 0.01;
                    } else if (cameraDistance < 3) {
                      // Close - reduce thickness
                      thickness *= 0.1;
                    } else if (cameraDistance > 8) {
                      // Far away - increase thickness for system view
                      thickness *= Math.min(3, cameraDistance / 6);
                    }
                    
                    // Skip rendering this orbit if it should be hidden
                    if (shouldHideOrbit) {
                      return null;
                    }
                    
                    // Apply the entity size constraint
                    const finalThickness = Math.min(Math.max(thickness, minThickness), maxThickness);
                    
                    // Increase segments for smoother orbit paths
                    const segments = 128;
                    
                    return (
                      <ringGeometry args={[
                        orbitRadius * SCENE_SCALE * (1 - finalThickness), 
                        orbitRadius * SCENE_SCALE * (1 + finalThickness),
                        segments
                      ]} />
                    );
                  })()}
                  <meshStandardMaterial 
                    color={(() => {
                      // Determine if this is a parent orbit of the selected body
                      let isParentOrbit = false;
                      if (selectedCelestialBodyId) {
                        const selectedBody = celestialSystem.celestialBodies.find(b => b.id === selectedCelestialBodyId);
                        if (selectedBody && selectedBody.parentId === body.id) {
                          isParentOrbit = true;
                        }
                      }
                      
                      // Return appropriate color based on selection and relationship
                      return body.id === selectedCelestialBodyId 
                        ? '#FFFFFF' 
                        : isParentOrbit 
                          ? '#AADDFF'  // Brighter blue for parent orbit 
                          : body.type === 'planet' 
                            ? isSystemView ? '#55AAFF' : '#4488DD' // Brighter blue for planets in system view
                            : body.type === 'moon' 
                              ? !isSystemView ? '#99EEFF' : '#77CCFF' // Extra bright blue for moons in focus view
                              : '#88AAEE'; // Brighter default
                    })()} 
                    emissive={(() => {
                      // Return emissive color for glow effect
                      return body.id === selectedCelestialBodyId 
                        ? '#FFFFFF' // Strong glow for selected
                        : isSystemView && body.type === 'planet'
                          ? '#66AAFF' // Stronger glow for planets in system view
                          : body.type === 'moon' && !isSystemView
                            ? '#77DDFF' // Strong glow for moons in focus view
                            : body.type === 'planet'
                              ? '#335577' // Subtle glow for planets in focus view
                              : '#224466'; // Subtle glow for others
                    })()}
                    emissiveIntensity={(() => {
                      // Return appropriate emissive intensity
                      return body.id === selectedCelestialBodyId 
                        ? 0.7 // Strong emission for selected
                        : body.type === 'moon' && !isSystemView
                          ? 0.6 // Strong emission for moons in focus view
                          : isSystemView && body.type === 'planet'
                            ? 0.5 // Higher emission for planets in system view
                            : 0.2; // Subtle for others
                    })()}
                    transparent={true} 
                    opacity={(() => {
                      // Determine if this is a parent orbit of the selected body
                      let isParentOrbit = false;
                      if (selectedCelestialBodyId) {
                        const selectedBody = celestialSystem.celestialBodies.find(b => b.id === selectedCelestialBodyId);
                        if (selectedBody && selectedBody.parentId === body.id) {
                          isParentOrbit = true;
                        }
                      }
                      
                      // Return appropriate opacity based on selection and relationship
                      return body.id === selectedCelestialBodyId 
                        ? 1.0 // Full opacity for selected object
                        : isParentOrbit
                          ? 0.9 // Higher opacity for parent
                          : body.type === 'moon' && !isSystemView
                            ? 0.95 // Very high opacity for moons in focus view
                            : isSystemView && body.type === 'planet'
                              ? 0.9 // Higher opacity for planets in system view
                              : !isSystemView && body.type === 'planet'
                                ? 0.5 // Medium opacity for planets in focused view
                                : 0.8; // Higher default opacity
                    })()}
                    side={THREE.DoubleSide}
                    depthWrite={false} // Disable depth writing so orbits don't block objects
                    metalness={isSystemView && body.type === 'planet' ? 0.8 : (body.id === selectedCelestialBodyId ? 0.7 : 0.5)}
                    roughness={isSystemView && body.type === 'planet' ? 0.1 : (body.id === selectedCelestialBodyId ? 0.2 : 0.3)}
                  />
                </mesh>
              )}
            </React.Fragment>
          );
        })}
      
      {/* Render jump points */}
      {celestialSystem.jumpPoints
        .filter(jump => {
          if (hiddenTypes.has('jumppoint')) return false;
          
          // Always show all jump points regardless of view context
          return true;
        })
        .map((jump) => {
          // Find parent entity for relative position calculations
          const parentBody = jump.parentId ? 
            celestialSystem.celestialBodies.find(b => b.id === jump.parentId) : 
            null;
            
          // Get relative position if parent exists
          const relativePosition = parentBody ? {
            x: jump.position.x - parentBody.position.x,
            y: jump.position.y - parentBody.position.y,
            z: jump.position.z - parentBody.position.z
          } : null;
          
          return (
            <JumpPoint
              key={jump.id || Math.random().toString()}
              id={jump.id}
              name={jump.name}
              position={jump.position}
              destinationSystem={jump.destinationSystem}
              showOrbits={false} // Don't show orbits for jump points
              parentPosition={parentBody ? parentBody.position : null}
              relativePosition={relativePosition}
              labelDistanceScale={labelDistanceScale}
            />
          );
        })}
      
      {/* Render points of interest */}
      {celestialSystem.pointsOfInterest
        // Filter based on context AND hiddenTypes
        .filter(poi => {
          const type = poi.type as EntityType;
          if (hiddenTypes.has(type)) return false;
          
          // Always show lagrange points regardless of view context
          if (type === 'lagrangepoint') return true;
          
          // For other POI types, follow standard filtering rules
          // In system view, show POIs parented to the root
          if (isSystemView && poi.parentId === celestialSystem.rootId) return true;
          
          // In focused view, show POIs parented to the context ID
          if (!isSystemView && poi.parentId === contextId) return true;
          
          return false;
        })
        .map((poi) => {
          // Find parent entity for relative position calculations
          const parentBody = poi.parentId ? 
            celestialSystem.celestialBodies.find(b => b.id === poi.parentId) : 
            null;
            
          // Get relative position if parent exists
          const relativePosition = parentBody ? {
            x: poi.position.x - parentBody.position.x,
            y: poi.position.y - parentBody.position.y,
            z: poi.position.z - parentBody.position.z
          } : null;
          
          return (
            <PointOfInterest
              key={poi.id || Math.random().toString()}
              id={poi.id}
              name={poi.name}
              position={poi.position}
              type={poi.type}
              showOrbits={false} // Don't show orbits for points of interest
              parentPosition={parentBody ? parentBody.position : null}
              relativePosition={relativePosition}
              labelDistanceScale={labelDistanceScale}
            />
          );
        })}
      
    </>
  );
};

// Main StarMap component
const StarMap: React.FC = () => {
  const { celestialSystem, isLoading, error, selectCelestialBody, showOrbits, setShowOrbits } = useAppStore();
  const [hiddenTypes, setHiddenTypes] = useState<Set<EntityType>>(new Set());
  // Add state for camera info
  const [currentCameraPosition, setCurrentCameraPosition] = useState<THREE.Vector3>(new THREE.Vector3());
  const [currentCameraTarget, setCurrentCameraTarget] = useState<THREE.Vector3>(new THREE.Vector3());
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [labelDistanceScale, setLabelDistanceScale] = useState(1.0); // New state for label distance scaling
  
  // Ref for container element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Debug logging for dimensions - useLayoutEffect runs after DOM updates but before browser paint
  useLayoutEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
    }
  }, []);
  
  // Debug logging for dimensions
  useEffect(() => {
    const logDimensions = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
      }
    };
    
    // Log on mount
    logDimensions();
    
    // Log on resize
    window.addEventListener('resize', logDimensions);
    return () => window.removeEventListener('resize', logDimensions);
  }, []);
  
  const resetCameraView = () => {
    selectCelestialBody(null); 
  };

  // Callback for SceneControls
  const handleFilterChange = (newHiddenTypes: Set<EntityType>) => {
    setHiddenTypes(newHiddenTypes);
  };
  
  // New callbacks for focus/reset to pass to SceneControls
  const handleFocusEntity = (entityId: string) => {
    selectCelestialBody(entityId); // Select first - CameraController will react
  };

  const handleResetView = () => {
    resetCameraView(); // Call our updated reset function
  };

  const handleToggleLabels = () => {
    setLabelsVisible(!labelsVisible);
  };
  
  const handleToggleOrbits = () => {
    setShowOrbits(!showOrbits);
  };
  
  const handleLabelDistanceChange = (scale: number) => {
    setLabelDistanceScale(scale);
  };
  
  if (isLoading) {
    return <div>Loading celestial data...</div>;
  }
  
  if (error) {
    return <div>Error: {error}</div>;
  }
  
  if (!celestialSystem) {
    return <div>No celestial system data available.</div>;
  }
  
  return (
    <div className="star-map" ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Scene Controls */}
      <SceneControls 
        onFilterChange={handleFilterChange}
        onResetView={handleResetView}
        onFocusEntity={handleFocusEntity}
        onToggleLabels={handleToggleLabels}
        onToggleOrbits={handleToggleOrbits}
        onLabelDistanceChange={handleLabelDistanceChange}
        labelsVisible={labelsVisible}
        orbitsVisible={showOrbits}
        cameraPosition={currentCameraPosition}
        cameraTarget={currentCameraTarget}
      />

      {/* 3D Scene Canvas */}
      <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        <Canvas 
          style={{ width: '100%', height: '100%', display: 'block', background: 'black' }}
          gl={{ antialias: true, logarithmicDepthBuffer: true, alpha: true }}
          onCreated={({ gl, size, camera }) => {
            configureRenderer(gl);
          }}
          resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
          camera={{ position: [0, 0, 5], near: 0.00001, far: 1000 }}
        >
          <CameraController 
            setPos={setCurrentCameraPosition}
            setTarget={setCurrentCameraTarget}
          />
          <ErrorBoundary>
            {celestialSystem ? (
              <SceneContent 
                hiddenTypes={hiddenTypes} 
                showLabels={labelsVisible}
                showOrbits={showOrbits}
                labelDistanceScale={labelDistanceScale}
              />
            ) : (
              <FallbackObject name="Loading star system..." />
            )}
          </ErrorBoundary>
        </Canvas>
      </div>
    </div>
  );
};

// Helper component to read camera state within Canvas context
const CameraStateReader: React.FC<{ 
  setPos: (pos: THREE.Vector3) => void, 
  setTarget: (target: THREE.Vector3) => void 
}> = ({ setPos, setTarget }) => {
  const { camera } = useThree();
  const controls = (useThree().controls as any); // Access controls contextually
  const lastPos = useRef(new THREE.Vector3());
  const lastTarget = useRef(new THREE.Vector3());
  const threshold = 0.01; // Only update if changed by more than this amount

  useFrame(() => {
    const currentPos = camera.position;
    const currentTarget = controls?.target;

    if (!currentTarget) {
        return;
    }
    
    if (currentPos.distanceTo(lastPos.current) > threshold || 
        currentTarget.distanceTo(lastTarget.current) > threshold) {
      
      const clonedPos = currentPos.clone();
      const clonedTarget = currentTarget.clone();
      
      setPos(clonedPos); 
      setTarget(clonedTarget);
      
      lastPos.current.copy(clonedPos);
      lastTarget.current.copy(clonedTarget);
    }
  });

  return null; // This component doesn't render anything itself
};

// Simple error boundary component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
  }

  render() {
    if (this.state.hasError) {
      return <div style={{color: 'white', padding: '20px'}}>Something went wrong with the 3D rendering.</div>;
    }

    return this.props.children;
  }
}

export default StarMap; 