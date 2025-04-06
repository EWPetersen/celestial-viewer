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
  showOrbits: boolean;
  parentPosition: Vector3 | null;
  relativePosition: Vector3 | null;
}> = ({ id, name, position, destinationSystem, showOrbits, parentPosition, relativePosition }) => {
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
}> = ({ id, name, position, type, showOrbits, parentPosition, relativePosition }) => {
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
      />
    </Suspense>
  );
};

// Props for SceneContent
interface SceneContentProps {
  hiddenTypes: Set<EntityType>;
  showLabels: boolean;
  showOrbits: boolean;
}

// Scene component
const SceneContent: React.FC<SceneContentProps> = ({ 
  hiddenTypes, 
  showLabels,
  showOrbits
}) => {
  const { 
    celestialSystem, 
    selectedCelestialBodyId, 
    selectedPointOfInterestId, 
    selectedJumpPointId 
  } = useAppStore();
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
  
  // --- Determine the current visibility context --- 
  let contextId: string | null = null;
  let isSystemView = true; // Assume system view by default

  if (selectedCelestialBodyId) {
    contextId = selectedCelestialBodyId;
    isSystemView = false;
  } else if (selectedPointOfInterestId) {
    const selectedPOI = celestialSystem.pointsOfInterest.find(p => p.id === selectedPointOfInterestId);
    // If POI has a parent, focus on the parent body's context
    contextId = selectedPOI?.parentId || null; 
    isSystemView = !contextId; // If POI has no parent, might still be system view
  } else if (selectedJumpPointId) {
    const selectedJP = celestialSystem.jumpPoints.find(j => j.id === selectedJumpPointId);
    // If JP has a parent, focus on the parent body's context
    contextId = selectedJP?.parentId || null; 
    isSystemView = !contextId; // If JP has no parent, might still be system view
  }

  // If no selection or selected item has no parent, context is the root (star)
  if (isSystemView) {
    contextId = celestialSystem.rootId;
  }
  // -------------------------------------------
  
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={2} color="#ffffff" />
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
            
            // Show siblings (other moons of the same parent) if focusing on a moon
            if (selectedBody && selectedBody.parentId && body.parentId === selectedBody.parentId) return true;
            
            // Show children of the focused body (moons)
            if (body.parentId === contextId) return true;
          }
          
          // Hide other planets/moons
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
                  showOrbits={showOrbits}
                  parentPosition={parentBody ? parentBody.position : null}
                  relativePosition={relativePosition}
                />
              </Suspense>
              
              {/* Render orbit if available and parent is not hidden */}
              {body.orbit && body.parentId && (
                // TODO: Check if parent type is hidden? Might be complex.
                <OrbitLine
                  semiMajorAxis={body.orbit.semiMajorAxis}
                  eccentricity={body.orbit.eccentricity}
                  inclination={body.orbit.inclination}
                />
              )}
            </React.Fragment>
          );
        })}
      
      {/* Render jump points */}
      {celestialSystem.jumpPoints
        .filter(jump => {
          if (hiddenTypes.has('jumppoint')) return false;
          // In system view, show JPs parented to the root (if any)
          if (isSystemView && jump.parentId === celestialSystem.rootId) return true;
          // In focused view, show JPs parented to the context ID
          if (!isSystemView && jump.parentId === contextId) return true;
          return false;
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
              showOrbits={showOrbits}
              parentPosition={parentBody ? parentBody.position : null}
              relativePosition={relativePosition}
            />
          );
        })}
      
      {/* Render points of interest */}
      {celestialSystem.pointsOfInterest
        // Filter based on context AND hiddenTypes
        .filter(poi => {
          const type = poi.type as EntityType;
          if (hiddenTypes.has(type)) return false;
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
              showOrbits={showOrbits}
              parentPosition={parentBody ? parentBody.position : null}
              relativePosition={relativePosition}
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
  
  // Ref for container element
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Debug logging for dimensions - useLayoutEffect runs after DOM updates but before browser paint
  useLayoutEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      console.log('[DEBUG-LAYOUT] StarMap container dimensions on layout:', {
        width: containerRect.width,
        height: containerRect.height
      });
      
      // Log DOM hierarchy
      let parent = container.parentElement;
      let hierarchy = [];
      
      while (parent) {
        const rect = parent.getBoundingClientRect();
        hierarchy.push({
          tagName: parent.tagName,
          className: parent.className,
          width: rect.width,
          height: rect.height,
          position: window.getComputedStyle(parent).position
        });
        parent = parent.parentElement;
      }
      
      console.log('[DEBUG-LAYOUT] DOM hierarchy:', hierarchy);
    }
  }, []);
  
  // Debug logging for dimensions
  useEffect(() => {
    const logDimensions = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        
        console.log('[DEBUG] StarMap container dimensions:', {
          width: containerRect.width,
          height: containerRect.height,
          offsetWidth: container.offsetWidth,
          offsetHeight: container.offsetHeight,
          clientWidth: container.clientWidth, 
          clientHeight: container.clientHeight,
          style: container.style.cssText,
          computedStyle: {
            width: window.getComputedStyle(container).width,
            height: window.getComputedStyle(container).height,
            position: window.getComputedStyle(container).position,
            display: window.getComputedStyle(container).display
          }
        });
        
        // Also log parent dimensions
        if (container.parentElement) {
          const parentRect = container.parentElement.getBoundingClientRect();
          console.log('[DEBUG] StarMap parent dimensions:', {
            width: parentRect.width,
            height: parentRect.height,
            className: container.parentElement.className,
            computedStyle: {
              width: window.getComputedStyle(container.parentElement).width,
              height: window.getComputedStyle(container.parentElement).height,
              position: window.getComputedStyle(container.parentElement).position,
              display: window.getComputedStyle(container.parentElement).display
            }
          });
        }
        
        // Check canvas element 
        const canvasElement = container.querySelector('canvas');
        if (canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          console.log('[DEBUG] Canvas dimensions:', {
            width: canvasRect.width,
            height: canvasRect.height,
            style: canvasElement.style.cssText,
            computedStyle: {
              width: window.getComputedStyle(canvasElement).width,
              height: window.getComputedStyle(canvasElement).height,
              position: window.getComputedStyle(canvasElement).position,
              display: window.getComputedStyle(canvasElement).display
            }
          });
        }
      }
    };
    
    // Log on mount
    logDimensions();
    
    // Log on resize
    window.addEventListener('resize', logDimensions);
    return () => window.removeEventListener('resize', logDimensions);
  }, []);
  
  const resetCameraView = () => {
    console.log("StarMap: Resetting view via state update.");
    // CameraController will handle the reset when selectedCelestialBodyId becomes null
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
            // Log initial canvas size
            console.log('[DEBUG] Canvas initial size:', size);
            
            // Log camera aspect ratio
            if (camera instanceof THREE.PerspectiveCamera) {
              console.log('[DEBUG] Camera FOV:', camera.fov, 'Aspect:', camera.aspect);
            }
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
    console.log('[CameraStateReader] useFrame running.');
    const currentPos = camera.position;
    const currentTarget = controls?.target;

    if (!currentTarget) {
        console.log('[CameraStateReader] Controls or target not found.');
        return;
    }
    
    console.log('[CameraStateReader] Current Pos:', currentPos.x, 'Target:', currentTarget.x);

    if (currentPos.distanceTo(lastPos.current) > threshold || 
        currentTarget.distanceTo(lastTarget.current) > threshold) {
      
      console.log('[CameraStateReader] Change threshold exceeded. Attempting update.');
      const clonedPos = currentPos.clone();
      const clonedTarget = currentTarget.clone();
      
      console.log('[CameraStateReader] Updating camera state:', clonedPos, clonedTarget);
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