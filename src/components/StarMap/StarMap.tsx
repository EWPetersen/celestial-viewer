import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import useAppStore, { CelestialBody as CelestialBodyType, JumpPoint as JumpPointType, PointOfInterest as PointOfInterestType } from '../../stores/useAppStore';
import { calculateOrbitPosition, degreesToRadians, Vector3 } from '../../utils/coordinateUtils';
import { calculateScaleFactor } from '../../utils/distanceUtils';
import { EntityRenderer, EntityType } from '../EntityVisuals';
import { configureRenderer, validatePosition } from '../../utils/scene';
import SceneControls from '../UI/SceneControls';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

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
    console.error("Error rendering orbit line:", error);
    return null;
  }
};

// Jump point component
const JumpPoint: React.FC<{
  id: string;
  name: string;
  position: Vector3;
  destinationSystem: string;
}> = ({ id, name, position, destinationSystem }) => {
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
    console.error(`Invalid position for jump point ${name}:`, position);
    return <FallbackObject name={`Error: ${name}`} />;
  }
  
  // Use validated position
  const safePosition = validatePosition(position);
  
  // Scale for visualization
  const size = 0.2;
  
  // Handle click on jump point
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    try {
      e.stopPropagation();
      selectJumpPoint(id);
    } catch (error) {
      console.error("Error in jump point click handler:", error);
    }
  };
  
  return (
    <Suspense fallback={<FallbackObject name={name} />}>
      <EntityRenderer
        id={id}
        name={`${name} (Jump to ${destinationSystem || 'Unknown'})`}
        position={safePosition}
        size={size * 200000000} // Convert to appropriate scale
        type="jumppoint"
        isSelected={isSelected}
        color="#ff00ff"
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
}> = ({ id, name, position, type }) => {
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
    console.error(`Invalid position for POI ${name}:`, position);
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
  
  // Handle click on POI
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    try {
      e.stopPropagation();
      selectPointOfInterest(id);
    } catch (error) {
      console.error("Error in POI click handler:", error);
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
      />
    </Suspense>
  );
};

// Props for SceneContent
interface SceneContentProps {
  hiddenTypes: Set<EntityType>;
}

// Scene component
const SceneContent: React.FC<SceneContentProps> = ({ hiddenTypes }) => {
  const { celestialSystem } = useAppStore();
  const [hasError, setHasError] = useState(false);
  
  if (!celestialSystem) {
    return null;
  }
  
  // Wrap in error boundary
  if (hasError) {
    return (
      <>
        <ambientLight intensity={0.3} />
        <FallbackObject name="Error loading scene" />
      </>
    );
  }
  
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={1} color="#ffffff" />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} />

      {/* Render celestial bodies (Planets/Stars) */}
      {celestialSystem.celestialBodies
        .filter(body => !hiddenTypes.has(body.type as EntityType)) // Filter based on hiddenTypes
        .map((body) => (
        <React.Fragment key={body.id || Math.random().toString()}>
          <Suspense fallback={<FallbackObject name={body.name} />}>
            <EntityRenderer
              id={body.id}
              name={body.name}
              position={validatePosition(body.position)}
              size={body.radius * 2} // Convert radius to diameter
              type={body.type}
              isSelected={useAppStore.getState().selectedCelestialBodyId === body.id}
            />
          </Suspense>
          
          {/* Render orbit if available and parent is not hidden */}
          {body.orbit && body.parent && (
            // TODO: Check if parent type is hidden? Might be complex.
            <OrbitLine
              semiMajorAxis={body.orbit.semiMajorAxis}
              eccentricity={body.orbit.eccentricity}
              inclination={body.orbit.inclination}
            />
          )}
          
          {/* Render moons */}
          {body.moons
            ?.filter(moon => !hiddenTypes.has('moon')) // Filter moons
            .map((moon) => {
            try {
              // Calculate moon's position relative to its parent
              const angle = Math.random() * Math.PI * 2; 
              const x = body.position.x + (moon.orbit?.semiMajorAxis || 1000000) * Math.cos(angle);
              const z = body.position.z + (moon.orbit?.semiMajorAxis || 1000000) * Math.sin(angle);
              
              const moonPosition = validatePosition({ x, y: body.position.y, z });
              
              return (
                <Suspense key={moon.id || Math.random().toString()} fallback={<FallbackObject name={moon.name} />}>
                  <EntityRenderer
                    key={moon.id}
                    id={moon.id}
                    name={moon.name}
                    position={moonPosition}
                    size={moon.radius * 2} 
                    type="moon"
                    isSelected={useAppStore.getState().selectedCelestialBodyId === moon.id}
                  />
                </Suspense>
              );
            } catch (error) {
              console.error(`Error rendering moon ${moon.name}:`, error);
              return null;
            }
          })}
        </React.Fragment>
      ))}
      
      {/* Render jump points */}
      {!hiddenTypes.has('jumppoint') && // Check if jump points are hidden
        celestialSystem.jumpPoints.map((jump) => (
          <JumpPoint
            key={jump.id || Math.random().toString()}
            id={jump.id}
            name={jump.name}
            position={jump.position}
            destinationSystem={jump.destinationSystem}
          />
      ))}
      
      {/* Render points of interest */}
      {celestialSystem.pointsOfInterest
        .filter(poi => !hiddenTypes.has(poi.type as EntityType)) // Filter POIs
        .map((poi) => (
          <PointOfInterest
            key={poi.id || Math.random().toString()}
            id={poi.id}
            name={poi.name}
            position={poi.position}
            type={poi.type}
          />
      ))}
    </>
  );
};

// Helper component to read camera state
const CameraTracker: React.FC<{ 
    setCameraPosition: (pos: THREE.Vector3) => void, 
    setCameraTarget: (target: THREE.Vector3) => void,
    // Allow the ref object to potentially hold null 
    controlsRef: React.RefObject<OrbitControlsImpl | null> 
}> = ({ setCameraPosition, setCameraTarget, controlsRef }) => {
  useFrame((state) => {
    // Clone position to avoid modifying the original state object directly if needed elsewhere
    setCameraPosition(state.camera.position.clone());
    // Get target from OrbitControls if available
    if (controlsRef.current) {
        // Clone target as well
        setCameraTarget(controlsRef.current.target.clone());
    }
  });
  return null; // This component doesn't render anything itself
};

// Main StarMap component
const StarMap: React.FC = () => {
  const { celestialSystem, isLoading, error, selectCelestialBody } = useAppStore();
  const [hiddenTypes, setHiddenTypes] = useState<Set<EntityType>>(new Set());
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [cameraPosition, setCameraPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 10, 50)); // Initial position
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 0)); // Initial target

  // Placeholder camera control functions
  const focusCameraOnEntity = (entityId: string) => {
    let targetPosition: THREE.Vector3 | null = null;
    let entityName = 'Unknown';
    // Use a union type that includes CelestialBody for moons
    let entityToFocus: CelestialBodyType | JumpPointType | PointOfInterestType | null = null;
    let parentBodyForMoon: CelestialBodyType | null = null;

    // Function to convert game coords to scene coords
    const toSceneCoords = (pos: Vector3) => new THREE.Vector3(
      pos.x * 0.0000000001,
      pos.y * 0.0000000001,
      pos.z * 0.0000000001
    );

    // --- Find Entity Logic ---
    // Try finding in primary lists first
    entityToFocus = 
        celestialSystem?.celestialBodies.find(e => e.id === entityId) ??
        celestialSystem?.jumpPoints.find(e => e.id === entityId) ??
        celestialSystem?.pointsOfInterest.find(e => e.id === entityId) ??
        null;

    // If not found, search within moons
    if (!entityToFocus && celestialSystem) {
        for (const parentBody of celestialSystem.celestialBodies) {
            const foundMoon = parentBody.moons?.find(m => m.id === entityId);
            if (foundMoon) {
                // Assume Moon structure is compatible enough with CelestialBodyType
                entityToFocus = foundMoon as CelestialBodyType; 
                parentBodyForMoon = parentBody; 
                break; // Exit loop once moon is found
            }
        }
    }

    if (!entityToFocus) {
        console.warn(`Entity with ID ${entityId} not found for focusing.`);
        return;
    }

    entityName = entityToFocus.name; 

    // --- Calculate Target Position --- 
    if (parentBodyForMoon) { 
        // Handle Moon Position Calculation
        const moon = entityToFocus as CelestialBodyType; // Cast necessary for orbit access
        const parentPos = validatePosition(parentBodyForMoon.position);
        const angle = Math.random() * Math.PI * 2; 
        const semiMajorAxis = moon.orbit?.semiMajorAxis || 1000000;
        const x = parentPos.x + semiMajorAxis * Math.cos(angle);
        const z = parentPos.z + semiMajorAxis * Math.sin(angle);
        const moonGamePos = validatePosition({ x, y: parentPos.y, z });
        targetPosition = toSceneCoords(moonGamePos);
        console.warn("Focusing on moon with estimated position.");

    } else { 
        // Handle other entity types (Planet, Star, POI, JumpPoint)
        // Check if the found entity has a 'position' property
        if ('position' in entityToFocus && typeof entityToFocus.position === 'object' && entityToFocus.position !== null) {
            targetPosition = toSceneCoords(validatePosition(entityToFocus.position as Vector3));
        } else {
            console.warn(`Could not determine position for non-moon entity ${entityName} (${entityId})`);
            return; // Cannot focus if position is missing
        }
    }

    // --- Camera Animation --- 
    if (targetPosition && controlsRef.current) {
      console.log(`TODO: Animate camera focus to ${entityName} at`, targetPosition);
      controlsRef.current.target.copy(targetPosition);
      controlsRef.current.update(); 
    } else if (!targetPosition) {
        console.warn(`Failed to calculate target position for ${entityName}`);
    } else {
        console.warn("Could not find controls ref for focusing.");
    }
  };

  const resetCameraView = () => {
    if (controlsRef.current) {
      console.log("TODO: Animate camera reset");
      const camera = controlsRef.current.object as THREE.PerspectiveCamera;
      // Use the same initial position as defined in the Canvas prop
      const initialPosition = new THREE.Vector3(0, 0, 10.5); 
      const initialTarget = new THREE.Vector3(0, 0, 0); 

      controlsRef.current.target.copy(initialTarget);
      camera.position.copy(initialPosition);
      controlsRef.current.update();
    } else {
      console.warn("Could not find controls ref for resetting view.");
    }
  };

  // Callback for SceneControls
  const handleFilterChange = (newHiddenTypes: Set<EntityType>) => {
    setHiddenTypes(newHiddenTypes);
  };
  
  // New callbacks for focus/reset to pass to SceneControls
  const handleFocusEntity = (entityId: string) => {
    selectCelestialBody(entityId); // Select first
    focusCameraOnEntity(entityId);
  };

  const handleResetView = () => {
    selectCelestialBody(null); // Deselect
    resetCameraView();
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
    <div style={{ width: '100%', height: '100%', position: 'relative' }}> 
      <ErrorBoundary>
        {/* Pass camera state to SceneControls */}
        <SceneControls 
          onFilterChange={handleFilterChange} 
          onFocusEntity={handleFocusEntity} 
          onResetView={handleResetView}   
          cameraPosition={cameraPosition} // Pass position state
          cameraTarget={cameraTarget}     // Pass target state
        /> 
        
        <Canvas
          style={{ background: '#000' }}
          camera={{ position: [0, 0, 10.5], fov: 60 }} 
          onCreated={({ gl }) => {
            configureRenderer(gl);
          }}
        >
          <Suspense fallback={<FallbackObject name="Loading scene..." />}>
            <SceneContent hiddenTypes={hiddenTypes} />
            <OrbitControls 
              ref={controlsRef} 
              enablePan={true} 
              enableZoom={true} 
              enableRotate={true} 
              // Set initial target (optional but good practice)
              target={[0, 0, 0]} 
            />
            {/* Add the tracker component */}
            <CameraTracker 
                setCameraPosition={setCameraPosition} 
                setCameraTarget={setCameraTarget} 
                controlsRef={controlsRef} 
            />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
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
    console.error("Error in scene rendering:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{color: 'white', padding: '20px'}}>Something went wrong with the 3D rendering.</div>;
    }

    return this.props.children;
  }
}

export default StarMap; 