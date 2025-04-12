import React, { useRef, useState, useEffect, Suspense, useLayoutEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import useAppStore, { CelestialBody as CelestialBodyType, JumpPoint as JumpPointType, PointOfInterest as PointOfInterestType } from '../../stores/useAppStore';
import { RouteVisualization } from '../../models/RouteVisualization';
import { calculateOrbitPosition, degreesToRadians, Vector3 } from '../../utils/coordinateUtils';
import { calculateDistance, calculateScaleFactor } from '../../utils/distanceUtils';
import { EntityRenderer, EntityType } from '../EntityVisuals';
import { configureRenderer, validatePosition } from '../../utils/scene';
import SceneControls from '../UI/SceneControls';
import CameraController from '../CameraController/CameraController';
import { 
  SCENE_SCALE, 
  SYSTEM_VIEW_THRESHOLD, 
  DETAIL_VIEW_THRESHOLD 
} from '../../config/constants';
import { convertToMeters, DistanceUnit } from '../../models/RouteAlert';
import CelestialIdMappingService from '../../services/CelestialIdMappingService';
import MappingDiscoveryService from '../../services/MappingDiscoveryService';

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

// Multiple Route Visualizer Component - renders all route visualizations
const MultipleRouteVisualizer: React.FC = () => {
  const { routeVisualizations } = useAppStore();
  
  if (!routeVisualizations || routeVisualizations.length === 0) return null;
  
  // Filter out visualizations with missing/invalid IDs to avoid repeated errors
  const validVisualizations = routeVisualizations.filter(viz => 
    viz.originId && viz.destinationId
  );
  
  // Log once about skipped visualizations if any were filtered out
  if (validVisualizations.length < routeVisualizations.length) {
    console.info(`[StarMap] Skipped ${routeVisualizations.length - validVisualizations.length} route visualizations with missing IDs`);
  }
  
  return (
    <>
      {validVisualizations.map((viz) => (
        <SingleRouteVisualizer key={viz.id || `route-${viz.originId}-${viz.destinationId}`} visualization={viz} />
      ))}
    </>
  );
};

// Single Route Visualizer Component
const SingleRouteVisualizer: React.FC<{ visualization: RouteVisualization }> = ({ visualization }) => {
  const { celestialSystem, selectCelestialBody } = useAppStore();
  const [pathPoints, setPathPoints] = useState<THREE.Vector3[]>([]);
  const [splinePath, setSplinePath] = useState<THREE.CatmullRomCurve3 | null>(null);
  const [initializedRef] = useState({ current: false });
  
  // Use refs for animation values
  const progressRef = useRef(0);
  const cameraProgressRef = useRef(0);
  const animationTimeRef = useRef(0);
  const particlesGroupRef = useRef<THREE.Group>(null);
  const lineGroupRef = useRef<THREE.Group>(null);
  const plumeGroupRef = useRef<THREE.Group>(null);
  
  // Track whether we've logged an error for this visualization to prevent duplicate logs
  const hasLoggedErrorRef = useRef(false);
  
  // Debug tracking for position data
  const [originPosition, setOriginPosition] = useState<THREE.Vector3 | null>(null);
  const [destinationPosition, setDestinationPosition] = useState<THREE.Vector3 | null>(null);
  
  // Animation settings
  const PARTICLES_COUNT = 50;
  const ANIMATION_SPEED = 0.5;
  const CAMERA_ANIMATION_SPEED = 0.4;
  
  const { camera, scene, clock } = useThree();
  
  // Helper function to compare path points
  const pathPointsEqual = (a: THREE.Vector3[], b: THREE.Vector3[]): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].distanceToSquared(b[i]) > 0.001) return false;
    }
    return true;
  };
  
  // Update plume size based on camera distance for visibility
  const updatePlumeSize = useCallback((distance: number, activityLevel: number) => {
    if (!plumeGroupRef.current) return;
    
    // Base size that increases with activity level
    const baseSize = 0.2 + (activityLevel * 0.3);
    
    // More aggressive scaling to ensure visibility at all distances
    let scaleFactor = 1.0;
    
    if (distance > 10) {
      // System view - increase size significantly
      scaleFactor = Math.min(distance * 0.12, 12.0); 
    } else if (distance > 5) {
      // Medium distance - more aggressive scaling
      scaleFactor = 1.5 + ((distance - 5) * 0.4); 
    } else {
      // Close up, maintain visibility
      scaleFactor = 1.5;
    }
    
    // Apply the scaled size
    const finalSize = baseSize * scaleFactor;
    plumeGroupRef.current.scale.set(finalSize, finalSize, finalSize);
    
    // Update light intensity based on distance
    plumeGroupRef.current.traverse((child) => {
      if ((child as THREE.Light).isLight) {
        const light = child as THREE.Light;
        light.intensity = 12 + (scaleFactor * 8);
        if (light.type === 'PointLight') {
          (light as THREE.PointLight).distance = 1.2 * scaleFactor;
        }
      }
    });
  }, []);
  
  // Update plume color based on activity level
  const updatePlumeColor = useCallback((activityLevel: number) => {
    if (!plumeGroupRef.current) return;
    
    // Always use red color values
    const r = 1.0;
    const g = 0.1;
    const b = 0.0;
    
    // Update all plume materials
    plumeGroupRef.current.traverse((child) => {
      if (child.type === 'Mesh' && (child as THREE.Mesh).material) {
        const mesh = child as THREE.Mesh;
        
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.color.setRGB(r, g, b);
          mesh.material.emissive.setRGB(r * 0.8, g * 0.0, b * 0.0);
        } else if (mesh.material instanceof THREE.MeshBasicMaterial) {
          mesh.material.color.setRGB(r, g, b);
        }
      }
    });
    
    // Update point lights color
    plumeGroupRef.current.traverse((child) => {
      if ((child as THREE.Light).isLight) {
        const light = child as THREE.Light;
        light.color.setRGB(r, g, b);
      }
    });
  }, []);
  
  // Set highest rendering priority for route visualizations
  useEffect(() => {
    if (lineGroupRef.current) {
      // Set high renderOrder value for our group
      lineGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          // Use high values to ensure they render on top of other objects
          child.renderOrder = 9999;
        }
      });
    }
    
    if (particlesGroupRef.current) {
      particlesGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.renderOrder = 9998;
        }
      });
    }
    
    if (plumeGroupRef.current) {
      // Set high renderOrder for plume group and all children
      plumeGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.renderOrder = 10000; // Even higher than route lines
        }
      });
    }
  }, [pathPoints]);
  
  // Create and animate the route visualization
  useEffect(() => {
    // Reset the animation state when route visualization changes
    // Skip if route visualization is invalid
    if (!visualization) {
      return;
    }
    
    // Origin and destination must have valid IDs
    const originId = visualization.originId;
    const destinationId = visualization.destinationId;
    
    if (!originId || !destinationId) {
      console.error(`[StarMap] Route visualization missing required IDs: originId=${originId}, destinationId=${destinationId}`);
      return;
    }

    // Check if celestialSystem is available
    if (!celestialSystem) {
      console.error(`[StarMap] Cannot visualize route: celestialSystem is not available`);
      return;
    }
 
    // Find the celestial bodies for origin and destination
    const originBody = celestialSystem.celestialBodies.find(body => body.id === originId);
    const destinationBody = celestialSystem.celestialBodies.find(body => body.id === destinationId);
    
    // Try alternative lookup methods if direct ID match fails
    let finalOriginBody = originBody;
    let finalDestinationBody = destinationBody;
    
    // Emergency mapping for known problematic IDs
    const knownUuidMappings: Record<string, string> = {
      // Based on logs - map problematic alert IDs to actual system IDs
      '8af309da-4560-48df-8223-ddd02c016fb3': 'a8f25b76-f1dc-422f-ac6d-04360f720817', // Stanton
      '52a77839-4e55-4cdd-bdd3-ac7bb9626b03': '141e4d71-edc6-4778-936b-a36d078de623', // Hurston
      '20f3f4d3-d6fb-4f8d-9e56-df6308fce7a5': '0e0d020f-83a4-4ef6-885e-a568e451352f', // Crusader 
      'a6e9252e-4c72-4e51-adbe-5e2222cc79c2': '50a987c9-cbf5-4eb8-937e-b36bcf35c807', // ArcCorp
      'd6fc1705-6aba-4dbe-ba24-1ea80cb8d00d': '03b20c59-7445-4898-be57-0e9eca86d79a', // microTech
      'd191779b-ac62-4c84-90a5-7721aefb97c4': '141e4d71-edc6-4778-936b-a36d078de623', // Hurston PvP Area
      'b3557a17-1d2d-4b7b-92ef-5e20445b10ea': '03b20c59-7445-4898-be57-0e9eca86d79a', // MicroTech Orbit
      '8e38ba99-f1cd-49df-bc4e-5ef9309b511f': '50a987c9-cbf5-4eb8-937e-b36bcf35c807'  // ArcCorp City
    };
    
    // Handle missing origin body
    if (!finalOriginBody) {
      console.warn(`[StarMap] No exact ID match for: ${originId}. Trying mapping service...`);
      
      // Try emergency mapping first
      if (knownUuidMappings[originId]) {
        const emergencyMappedId = knownUuidMappings[originId];
        finalOriginBody = celestialSystem.celestialBodies.find(body => body.id === emergencyMappedId);
        
        if (finalOriginBody) {
          console.log(`[StarMap] 🔥 EMERGENCY MAPPING: ${originId} → ${emergencyMappedId} (${finalOriginBody.name})`);
          
          // Store this mapping for future use
          CelestialIdMappingService.addDirectUuidMapping(originId, emergencyMappedId);
        }
      }
      
      // If emergency mapping didn't work, try the regular mapping service
      if (!finalOriginBody) {
        const mappedOriginId = CelestialIdMappingService.convertAlertIdToSystemId(originId);
        if (mappedOriginId) {
          finalOriginBody = celestialSystem.celestialBodies.find(body => body.id === mappedOriginId);
          if (finalOriginBody) {
            console.log(`[StarMap] Found origin through mapping service: ${originId} -> ${mappedOriginId}`);
            
            // Record successful mapping - use addDirectUuidMapping as a workaround until recordSuccessfulUse is fully implemented
            CelestialIdMappingService.addDirectUuidMapping(originId, mappedOriginId);
          }
        }
      }
    }
    
    // Handle missing destination body
    if (!finalDestinationBody) {
      console.warn(`[StarMap] No exact ID match for: ${destinationId}. Trying mapping service...`);
      
      // Try emergency mapping first
      if (knownUuidMappings[destinationId]) {
        const emergencyMappedId = knownUuidMappings[destinationId];
        finalDestinationBody = celestialSystem.celestialBodies.find(body => body.id === emergencyMappedId);
        
        if (finalDestinationBody) {
          console.log(`[StarMap] 🔥 EMERGENCY MAPPING: ${destinationId} → ${emergencyMappedId} (${finalDestinationBody.name})`);
          
          // Store this mapping for future use
          CelestialIdMappingService.addDirectUuidMapping(destinationId, emergencyMappedId);
        }
      }
      
      // If emergency mapping didn't work, try the regular mapping service
      if (!finalDestinationBody) {
        const mappedDestinationId = CelestialIdMappingService.convertAlertIdToSystemId(destinationId);
        if (mappedDestinationId) {
          finalDestinationBody = celestialSystem.celestialBodies.find(body => body.id === mappedDestinationId);
          if (finalDestinationBody) {
            console.log(`[StarMap] Found destination through mapping service: ${destinationId} -> ${mappedDestinationId}`);
            
            // Record successful mapping - use addDirectUuidMapping as a workaround until recordSuccessfulUse is fully implemented
            CelestialIdMappingService.addDirectUuidMapping(destinationId, mappedDestinationId);
          }
        }
      }
    }
    
    // If we couldn't find bodies, we can't visualize
    if (!finalOriginBody || !finalDestinationBody) {
      console.error(`[StarMap] Failed to find celestial bodies for route visualization. Origin: ${originId}, Destination: ${destinationId}`);
      return;
    }
    
    // Log the final route we're visualizing
    console.log(`Route visualization changed: \n{origin: '${finalOriginBody.name}', destination: '${finalDestinationBody.name}', animate: ${visualization.animate}}`);
    
    // Calculate positions for the origin and destination
    // Scale down for visualization (apply universal scene scale factor)
    const originPos = new THREE.Vector3(
      finalOriginBody.position.x * SCENE_SCALE,
      finalOriginBody.position.y * SCENE_SCALE,
      finalOriginBody.position.z * SCENE_SCALE
    );
    
    const destinationPos = new THREE.Vector3(
      finalDestinationBody.position.x * SCENE_SCALE,
      finalDestinationBody.position.y * SCENE_SCALE,
      finalDestinationBody.position.z * SCENE_SCALE
    );
    
    // Check if positions have changed before updating state to prevent infinite loops
    const positionsChanged = 
      !originPosition || 
      !destinationPosition ||
      originPosition.distanceToSquared(originPos) > 0.001 ||
      destinationPosition.distanceToSquared(destinationPos) > 0.001;
    
    // Only update positions if they've changed
    if (positionsChanged) {
      setOriginPosition(originPos);
      setDestinationPosition(destinationPos);
    }
    
    // Debug log actual positions
    console.log(`[StarMap] Visualization positions: Origin(${finalOriginBody.name}): ${JSON.stringify(finalOriginBody.position)}, Destination(${finalDestinationBody.name}): ${JSON.stringify(finalDestinationBody.position)}`);
    console.log(`[StarMap] Visualization scaled positions: Origin: ${JSON.stringify(originPos)}, Destination: ${JSON.stringify(destinationPos)}`);
    
    // Create a straight line path
    const allPoints = [originPos, destinationPos];
    const straightPath = new THREE.CatmullRomCurve3(allPoints, false);
    
    // Only update path if it's different to prevent infinite loops
    const shouldUpdatePath = 
      !splinePath || 
      pathPoints.length === 0 ||
      !pathPointsEqual(straightPath.getPoints(100), pathPoints);
    
    if (shouldUpdatePath) {
      // Store path for animations
      setSplinePath(straightPath);
      
      // Get points for rendering
      const pathPointsArray = straightPath.getPoints(100);
      setPathPoints(pathPointsArray);
    }
    
    // Calculate total route distance in real units
    // Both bodies are now guaranteed to exist due to our checks above
    const routeDistance = calculateDistance(finalOriginBody.position, finalDestinationBody.position);
    
    // Generate particle objects
    if (particlesGroupRef.current && straightPath) {
      // Create multiple particles along the path
      for (let i = 0; i < PARTICLES_COUNT; i++) {
        // Create particle geometry
        const particleGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        const particleMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#80dfff'),
          transparent: true,
          opacity: 0,
          depthTest: false
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
        
        // Set random initial position along the path
        const initialT = Math.random();
        const position = straightPath.getPoint(initialT);
        particle.position.copy(position);
        
        // Store speed and initial offset for animation
        particle.userData = {
          speed: 0.2 + Math.random() * 0.3,
          offset: initialT,
          baseSize: 0.02,
          glowSize: 0.05
        };
        
        particlesGroupRef.current.add(particle);
        
        // Add a glow effect for larger particles
        if (i % 3 === 0) {
          const glowGeometry = new THREE.SphereGeometry(0.05, 8, 8);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#ffffff'),
            transparent: true,
            opacity: 0,
            depthTest: false
          });
          
          const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
          particle.add(glowSphere);
        }
      }
    }
    
    // If we have a distance value, position the plume
    if (visualization.distanceValue !== null && visualization.distanceValue !== undefined && plumeGroupRef.current && straightPath) {
      // Convert distance to meters for calculation
      const distanceInMeters = convertToMeters(
        visualization.distanceValue !== undefined && visualization.distanceValue !== null 
          ? visualization.distanceValue 
          : 0,
        visualization.distanceUnit || 'km' as DistanceUnit
      );
      
      // Calculate position along the path as a ratio of total distance
      const routeType = visualization.routeType || 'interdiction';
      
      // For interdiction alerts, properly position based on distance traveled
      let ratio = 0;
      if (routeType === 'interdiction') {
        // Calculate distance as a fraction of total route length
        ratio = Math.min(distanceInMeters / (routeDistance || 1), 1.0);
        
        // Add some basic validation to ensure ratio is valid
        if (isNaN(ratio) || !isFinite(ratio)) {
          console.warn(`[StarMap] Invalid ratio calculated for alert position: ${ratio}, using default 0.5`);
          ratio = 0.5; // Use a default mid-point
        }
        
        console.log(`[StarMap] Positioning interdiction alert at distance ${visualization.distanceValue} ${visualization.distanceUnit} (ratio: ${ratio.toFixed(2)}) of total distance ${(routeDistance / 1000).toFixed(1)}km`);
      } else {
        // For other alert types, use midpoint if no specific position
        ratio = 0.5;
      }
      
      // Position plume at the specified distance along the straight path
      const plumePosition = straightPath.getPoint(ratio);
      plumeGroupRef.current.position.copy(plumePosition);
      
      // Calculate the tangent direction for plume orientation
      const tangent = straightPath.getTangent(ratio);
      
      // Orient plume to follow path direction
      if (tangent.length() > 0) {
        const lookAtPoint = new THREE.Vector3().addVectors(plumePosition, tangent);
        const upVector = new THREE.Vector3(0, 1, 0);
        
        // Create a temporary matrix for orientation
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.lookAt(plumePosition, lookAtPoint, upVector);
        
        // Set rotation from matrix
        const tempQuaternion = new THREE.Quaternion();
        tempQuaternion.setFromRotationMatrix(tempMatrix);
        plumeGroupRef.current.quaternion.copy(tempQuaternion);
      }
      
      // Set plume size based on activity level and camera distance
      updatePlumeSize(
        camera.position.distanceTo(plumePosition), 
        visualization.activityLevel !== undefined ? visualization.activityLevel : 0.5
      );
      
      // Visibility of plume
      plumeGroupRef.current.visible = true;
      
      // Update plume material color based on activity level
      updatePlumeColor(visualization.activityLevel !== undefined ? visualization.activityLevel : 0.5);
    } else if (plumeGroupRef.current) {
      // No distance specified, hide the plume
      plumeGroupRef.current.visible = false;
    }
    
    // Clean up animation on unmount
    return () => {
      initializedRef.current = false;
    };
  }, [visualization, celestialSystem, camera, updatePlumeSize, updatePlumeColor, selectCelestialBody]);
  
  // Handle animations in the main frame loop
  useFrame((state, delta) => {
    // First time initialization
    if (!initializedRef.current && visualization) {
      initializedRef.current = true;
      progressRef.current = 0;
      cameraProgressRef.current = 0;
      animationTimeRef.current = 0;
    }
    
    // Only run animations if we have route visualization and a path
    if (visualization && splinePath && initializedRef.current) {
      // Increment animation time
      animationTimeRef.current += delta;
      
      // Path animation - animate particles along the path
      if (particlesGroupRef.current && pathPoints.length > 0) {
        particlesGroupRef.current.children.forEach((particle, i) => {
          if (particle instanceof THREE.Mesh && splinePath) {
            // Get particle data
            const { speed, offset } = particle.userData;
            
            // Calculate current position along the path (0-1)
            const time = (animationTimeRef.current * speed * ANIMATION_SPEED + offset) % 1;
            
            // Position particle along the curve
            const position = splinePath.getPoint(time);
            particle.position.copy(position);
            
            // Fade in during first 20% of animation
            const fadeInProgress = Math.min(1, progressRef.current * 5);
            
            // Calculate pulse effect
            const pulseEffect = Math.sin(animationTimeRef.current * 5 + i * 0.2) * 0.3 + 0.7;
            
            // Apply opacity based on animation progress
            if (particle.material instanceof THREE.Material) {
              particle.material.opacity = fadeInProgress * 0.7 * pulseEffect;
            }
            
            // Scale base on animation and pulse
            const baseSize = particle.userData.baseSize || 0.02;
            const particleSize = baseSize * (0.8 + pulseEffect * 0.4);
            particle.scale.set(particleSize, particleSize, particleSize);
            
            // Handle child glow effects
            if (particle.children.length > 0) {
              const glowSphere = particle.children[0] as THREE.Mesh;
              if (glowSphere.material instanceof THREE.Material) {
                glowSphere.material.opacity = fadeInProgress * 0.4 * pulseEffect;
              }
              
              const glowSize = (particle.userData.glowSize || 0.05) * (0.7 + pulseEffect * 0.5);
              glowSphere.scale.set(glowSize, glowSize, glowSize);
            }
          }
        });
        
        // Update global animation progress for fading effects
        progressRef.current = Math.min(1, progressRef.current + delta * ANIMATION_SPEED);
      }
      
      // Update path line materials based on progress
      if (lineGroupRef.current && progressRef.current < 1.0) {
        lineGroupRef.current.children.forEach((child, index) => {
          if (child instanceof THREE.Line && child.material instanceof THREE.LineBasicMaterial) {
            // Adjust opacity based on line type and progress
            if (index === 0) { // Main line
              child.material.opacity = 0.95 * progressRef.current;
            } else if (index === 1) { // Glow line
              child.material.opacity = 0.6 * progressRef.current;
            } else if (index === 2) { // Core line
              child.material.opacity = 0.8 * progressRef.current;
            }
          }
        });
      }
      
      // Camera animation along the route if requested
      if (visualization.animate && cameraProgressRef.current < 1.0) {
        // Update camera progress
        cameraProgressRef.current = Math.min(cameraProgressRef.current + delta * CAMERA_ANIMATION_SPEED, 1.0);
        
        // Handle camera movement
        if (cameraProgressRef.current < 1.0 && celestialSystem && splinePath) {
          // We already have a valid splinePath, so we can use it directly
          // without rechecking if the bodies exist
          
          // Use ease-in-out curve for smooth animation
          const t = cameraProgressRef.current < 0.5 
            ? 2 * cameraProgressRef.current * cameraProgressRef.current 
            : 1 - Math.pow(-2 * cameraProgressRef.current + 2, 2) / 2;
          
          // Get position along the spline path for smoother camera movement
          const cameraTargetPosition = splinePath.getPoint(t);
          
          // Convert back to world coordinates for camera target
          const worldPos = new THREE.Vector3(
            cameraTargetPosition.x / SCENE_SCALE,
            cameraTargetPosition.y / SCENE_SCALE,
            cameraTargetPosition.z / SCENE_SCALE
          );
          
          // Update camera target
          if (!isNaN(worldPos.x) && !isNaN(worldPos.y) && !isNaN(worldPos.z)) {
            useAppStore.getState().setCameraTarget({
              x: worldPos.x,
              y: worldPos.y,
              z: worldPos.z
            });
          }
        } else if (cameraProgressRef.current >= 1.0 && visualization.destinationId) {
          // Only select the destination if we know it exists already
          // Since we've already verified destinationBody exists earlier, we can just use it directly
          console.log("Camera animation complete, selecting destination:", visualization.destinationId);
          selectCelestialBody(visualization.destinationId);
        }
      }
      
      // Update plume animation effects
      if (plumeGroupRef.current && plumeGroupRef.current.visible && 
          visualization.distanceValue !== null && visualization.distanceValue !== undefined) {        
        // Update plume size based on camera distance
        const distance = camera.position.distanceTo(plumeGroupRef.current.position);
        updatePlumeSize(
          distance, 
          visualization.activityLevel !== undefined ? visualization.activityLevel : 0.5
        );
        
        // Animate pulse effects on plume
        const pulseTime = animationTimeRef.current * 3;
        plumeGroupRef.current.children.forEach((child, i) => {
          if (child.name === 'pulse' && child instanceof THREE.Mesh) {
            // Calculate pulse scale using sine wave
            const pulseScale = 1 + 0.3 * Math.sin(pulseTime + i * 1.5);
            child.scale.set(pulseScale, pulseScale, pulseScale);
            
            // Adjust opacity with the pulse
            if (child.material instanceof THREE.MeshBasicMaterial) {
              child.material.opacity = 0.3 + 0.2 * Math.sin(pulseTime * 0.5 + i);
            }
          }
        });
        
        // Rotate the plume decorative elements for effect
        plumeGroupRef.current.children.forEach(child => {
          if (child.name === 'rotator') {
            child.rotation.y += delta * 0.5;
            child.rotation.z += delta * 0.3;
          }
        });
      }
    }
  });
  
  // Calculate path width based on camera distance to stay visible at all distances
  const cameraDistance = camera.position.length();
  const pathWidth = Math.max(3, Math.min(10, cameraDistance * 0.25));
  
  return (
    <group>
      {/* Particles Group for flowing particles along the route */}
      <group ref={particlesGroupRef} />
      
      {/* Holographic Route Path */}
      {pathPoints.length > 0 && (
        <group ref={lineGroupRef}>
          {/* Main route line */}
          <line>
            <bufferGeometry attach="geometry">
              <float32BufferAttribute 
                attach="attributes-position" 
                args={[new Float32Array(pathPoints.flatMap(p => [p.x, p.y, p.z])), 3]} 
              />
            </bufferGeometry>
            <lineBasicMaterial 
              attach="material"
              color="#4cc9f0" 
              opacity={0.0} // Start transparent, animation will handle opacity
              transparent={true}
              linewidth={pathWidth}
              depthTest={false}
            />
          </line>
          
          {/* Secondary glow line */}
          <line>
            <bufferGeometry attach="geometry">
              <float32BufferAttribute 
                attach="attributes-position" 
                args={[new Float32Array(pathPoints.flatMap(p => [p.x, p.y, p.z])), 3]} 
              />
            </bufferGeometry>
            <lineBasicMaterial 
              attach="material"
              color="#80dfff" 
              opacity={0.0} // Start transparent, animation will handle opacity
              transparent={true}
              linewidth={pathWidth * 2.0}
              depthTest={false}
            />
          </line>
          
          {/* Additional bright core line for visibility */}
          <line>
            <bufferGeometry attach="geometry">
              <float32BufferAttribute 
                attach="attributes-position" 
                args={[new Float32Array(pathPoints.flatMap(p => [p.x, p.y, p.z])), 3]} 
              />
            </bufferGeometry>
            <lineBasicMaterial 
              attach="material"
              color="#ffffff" 
              opacity={0.0} // Start transparent, animation will handle opacity
              transparent={true}
              linewidth={pathWidth * 0.5}
              depthTest={false}
            />
          </line>
        </group>
      )}
      
      {/* Enhanced Alert Plume with multiple visual elements */}
      <group ref={plumeGroupRef}>
        {/* Core plume sphere */}
        <mesh>
          <sphereGeometry args={[0.12, 24, 24]} />
          <meshStandardMaterial 
            color="#ff1500"
            emissive="#ff0000"
            emissiveIntensity={1.2}
            transparent={true}
            opacity={0.9}
            depthTest={false}
          />
        </mesh>
        
        {/* Outer glow spheres */}
        <mesh>
          <sphereGeometry args={[0.2, 24, 24]} />
          <meshBasicMaterial 
            color="#ff3300"
            transparent={true}
            opacity={0.5}
            depthTest={false}
          />
        </mesh>
        
        <mesh>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial 
            color="#ff5500"
            transparent={true}
            opacity={0.3}
            depthTest={false}
          />
        </mesh>
        
        {/* Glow light */}
        <pointLight 
          distance={1.2} 
          intensity={20} 
          color="#ff2200"
          decay={2}
        />
        
        {/* Pulse animation spheres */}
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={i} name="pulse">
            <sphereGeometry args={[0.15 + i * 0.05, 12, 12]} />
            <meshBasicMaterial 
              color="#ff3300"
              transparent={true}
              opacity={0.25 - i * 0.05}
              depthTest={false}
            />
          </mesh>
        ))}
        
        {/* Decorative rotating elements */}
        <group name="rotator">
          {/* Rings */}
          <mesh rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.25, 0.02, 8, 24]} />
            <meshBasicMaterial 
              color="#ff4400" 
              transparent={true}
              opacity={0.5}
              depthTest={false}
            />
          </mesh>
          
          <mesh rotation={[0, Math.PI/2, Math.PI/4]}>
            <torusGeometry args={[0.22, 0.01, 8, 20]} />
            <meshBasicMaterial 
              color="#ff2200" 
              transparent={true}
              opacity={0.4}
              depthTest={false}
            />
          </mesh>
        </group>
        
        {/* Direction indicators */}
        <mesh rotation={[0, 0, Math.PI/2]}>
          <coneGeometry args={[0.06, 0.15, 8]} />
          <meshBasicMaterial 
            color="#ffffff"
            transparent={true}
            opacity={0.7}
            depthTest={false}
          />
        </mesh>
        
        {/* Small warning beacons */}
        {Array.from({ length: 4 }).map((_, i) => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <pointLight 
              key={i}
              position={[
                Math.cos(angle) * 0.25,
                Math.sin(angle) * 0.25,
                0
              ]}
              distance={0.5}
              intensity={5}
              color="#ff0000"
            />
          );
        })}
      </group>
    </group>
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
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} />

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
            
            // When focusing on a jump point or lagrange point, always show the root star and planets
            if ((selectedJumpPointId || 
                (selectedPointOfInterestId && 
                 celestialSystem.pointsOfInterest.find(p => p.id === selectedPointOfInterestId)?.type === 'lagrangepoint'))) {
              // Show parent planet of the jump point/lagrange point
              if (contextId && body.id === contextId) return true;
              
              // Show the star
              if (body.id === celestialSystem.rootId) return true;
              
              // Show planets (direct children of star)
              if (body.parentId === celestialSystem.rootId && body.type === 'planet') return true;
              
              // Show moons of the parent planet (if the parent is a planet)
              if (contextId) {
                const contextBody = celestialSystem.celestialBodies.find(b => b.id === contextId);
                if (contextBody && contextBody.type === 'planet' && body.parentId === contextId) {
                  return true;
                }
                
                // If the jump point's context is a moon, also show its parent planet and sibling moons
                if (contextBody && contextBody.type === 'moon' && contextBody.parentId) {
                  // Show the parent planet
                  if (body.id === contextBody.parentId) return true;
                  
                  // Show sibling moons
                  if (body.parentId === contextBody.parentId && body.type === 'moon') return true;
                }
              }
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
                    // Apply zoom-adaptive base thickness that reduces dramatically at the start of zooming in
                    let baseThickness;
                    
                    // Calculate a zoom scaling factor that reduces thickness early in zoom transitions
                    const zoomScaleFactor = Math.min(1.0, Math.max(0.1, 
                      Math.pow(cameraDistance / SYSTEM_VIEW_THRESHOLD, 2))); // Square the ratio for faster reduction
                    
                    if (isSelected) {
                      baseThickness = 0.005 * zoomScaleFactor; // Selected orbit - reduce quickly when zooming in
                    } else if (isParentOrbit) {
                      baseThickness = 0.004 * zoomScaleFactor; // Parent orbit - reduce quickly when zooming in
                    } else if (!isSystemView && body.type === 'planet') {
                      baseThickness = 0.0005 * zoomScaleFactor; // Planet orbits in focused view - reduce quickly
                    } else if (!isSystemView && body.type === 'moon') {
                      baseThickness = 0.004 * zoomScaleFactor; // Moon orbits in focused view - reduce quickly
                    } else {
                      baseThickness = 0.0045 * zoomScaleFactor; // Default thickness - reduce quickly when zooming in
                    }
                    
                    // Calculate final thickness with exponential scaling based on camera distance
                    // Use a different exponential factor for system view vs focus view
                    let isTransitioning = false;
                    
                    // SYSTEM_VIEW_THRESHOLD is defined as 5.0 in constants.ts
                    // Define a MUCH wider transition zone around it for gradual exponent changes
                    // This should capture the entire animation range from system view to detail view
                    const SYSTEM_TRANSITION_START = 0.5;  // Start transition much earlier
                    const SYSTEM_TRANSITION_END = 10.0;   // End transition much later
                    
                    // Use a blend of exponents during the transition
                    let exponent;
                    
                    if (cameraDistance <= SYSTEM_TRANSITION_START) {
                      // Focused view exponent - higher value makes orbits thinner faster when zooming in
                      exponent = body.type === 'moon' ? 2.0 : 3.5;
                    } else if (cameraDistance >= SYSTEM_TRANSITION_END) {
                      // System view exponent - lower value keeps orbits thicker
                      exponent = 1.2;
                    } else {
                      // Smoothly transition between exponents using a progressive formula
                      isTransitioning = true;
                      
                      // Create a non-linear transition that changes more rapidly at the beginning
                      // and more slowly toward the end for better visual results during animation
                      const t = (cameraDistance - SYSTEM_TRANSITION_START) / 
                                (SYSTEM_TRANSITION_END - SYSTEM_TRANSITION_START);
                      
                      // Use a front-loaded curve that transitions much more aggressively at the start
                      // This makes orbits get thin very early in the zoom animation
                      const smoothT = Math.pow(t, 3); // Front-loaded curve - cube the t value to make early changes more dramatic
                      
                      const focusExponent = body.type === 'moon' ? 2.0 : 3.5;
                      const systemExponent = 1.2;
                      
                      // Use weighted blend between focus and system exponents
                      exponent = focusExponent * (1 - smoothT) + systemExponent * smoothT;
                    }
                    
                    // FIXED: Adjust distance factor based on actual camera distance to prevent
                    // orbits from being too large when zooming in manually
                    const adjustedDistance = Math.max(0.5, cameraDistance);
                    
                    // Add smooth transitions between distance thresholds to prevent abrupt changes
                    // during camera animations by using a weighted blend of the neighboring calculations
                    let distanceFactor: number = Math.max(1, Math.pow(adjustedDistance, exponent) / 10); // Initialize with standard calculation
                    
                    // Define distance transition regions for smooth blending
                    const transitionZones = [
                      { min: 0.45, max: 0.55 },   // 0.5 transition zone
                      { min: 0.9, max: 1.1 },     // 1.0 transition zone
                      { min: 2.8, max: 3.2 },     // 3.0 transition zone
                      { min: 7.8, max: 8.2 }      // 8.0 transition zone
                    ];
                    
                    // Calculate standard distance factor
                    const standardDistanceFactor = Math.max(1, Math.pow(adjustedDistance, exponent) / 10);
                    
                    // Add smoothing for transitions between distance zones
                    let smoothingApplied = false;
                    
                    for (const zone of transitionZones) {
                      if (adjustedDistance >= zone.min && adjustedDistance <= zone.max) {
                        // We're in a transition zone - calculate both sides and blend
                        const lowerDistance = zone.min * 0.9; // Just below zone
                        const upperDistance = zone.max * 1.1; // Just above zone
                        
                        // Calculate factors for both sides of the transition
                        const lowerFactor = Math.max(1, Math.pow(lowerDistance, exponent) / 10);
                        const upperFactor = Math.max(1, Math.pow(upperDistance, exponent) / 10);
                        
                        // Calculate the blend weight (0-1)
                        const weight = (adjustedDistance - zone.min) / (zone.max - zone.min);
                        
                        // Apply smoothstep function for more natural transitions
                        const smoothWeight = weight * weight * (3 - 2 * weight); // Smoothstep
                        
                        // Blend the two factors
                        distanceFactor = lowerFactor * (1 - smoothWeight) + upperFactor * smoothWeight;
                        smoothingApplied = true;
                        break;
                      }
                    }
                    
                    // If not in a transition zone, use the standard calculation
                    if (!smoothingApplied) {
                      distanceFactor = standardDistanceFactor;
                    }
                    
                    // Calculate initial thickness
                    let thickness = baseThickness / distanceFactor;
                    
                    // Scale thickness based on entity size to ensure orbits aren't larger than entities
                    const entityRadius = body.radius * SCENE_SCALE || 0.1;
                    
                    // --- Smooth minThickness transitions ---
                    let systemViewMinThickness = 0.0012; // System view minimum thickness
                    let focusViewMinThickness = 0.00001; // Focus view minimum thickness
                    
                    // Special case for moons - higher minimum thickness to ensure visibility
                    if (body.type === 'moon') {
                      systemViewMinThickness = 0.0015; // Higher min thickness for moons in system view
                      focusViewMinThickness = 0.0008; // Higher min thickness for moons in focus view
                    }
                    
                    // Blend minThickness values during system view transitions
                    let minThickness;
                    
                    if (cameraDistance <= SYSTEM_TRANSITION_START) {
                      // Use focus view minimum thickness
                      minThickness = focusViewMinThickness;
                    } else if (cameraDistance >= SYSTEM_TRANSITION_END) {
                      // Use system view minimum thickness
                      minThickness = systemViewMinThickness;
                    } else {
                      // Smoothly interpolate using the same transition parameters as the exponent
                      const t = (cameraDistance - SYSTEM_TRANSITION_START) / 
                                (SYSTEM_TRANSITION_END - SYSTEM_TRANSITION_START);
                      // Use front-loaded transition to get to focus view thickness quickly
                      const smoothT = Math.pow(t, 3); // Front-loaded curve - matches exponent transition
                      
                      minThickness = focusViewMinThickness * (1 - smoothT) + systemViewMinThickness * smoothT;
                    }
                    
                    // Check if we should hide this orbit because we're focused on a different object
                    // and this orbit would draw through the system
                    const shouldHideOrbit = !isSystemView && 
                                          !isSelected && 
                                          !isParentOrbit && 
                                          body.type === 'planet' && 
                                          contextId !== celestialSystem.rootId;
                    
                    // For focused view, use entity radius to constrain max thickness
                    // Apply smoothed thickness ratio based on view state
                    let maxThicknessRatio;
                    
                    // System view uses thicker orbits
                    const systemViewRatio = body.type === 'moon' ? 1.0 : 0.8;
                    
                    // Focus view uses thinner orbits
                    const focusViewRatio = body.type === 'moon' ? 0.5 : 0.1;
                    
                    // Apply the same transition logic used for exponents
                    if (cameraDistance <= SYSTEM_TRANSITION_START) {
                      // When in focus view, use the focus view ratio
                      maxThicknessRatio = focusViewRatio;
                    } else if (cameraDistance >= SYSTEM_TRANSITION_END) {
                      // When in system view, use the system view ratio
                      maxThicknessRatio = systemViewRatio;
                    } else {
                      // In the transition zone, smoothly interpolate with the same parameters
                      const t = (cameraDistance - SYSTEM_TRANSITION_START) / 
                                (SYSTEM_TRANSITION_END - SYSTEM_TRANSITION_START);
                      // Use front-loaded transition to get to focus view ratio quickly
                      const smoothT = Math.pow(t, 3); // Front-loaded curve - matches other transitions
                      
                      // Blend between focus and system view ratios
                      maxThicknessRatio = focusViewRatio * (1 - smoothT) + systemViewRatio * smoothT;
                    }
                    
                    // Use a much more aggressive distance-based constraint that transitions 
                    // more quickly at the beginning of the zoom for better visual appearance
                    const distanceBasedConstraint = body.type === 'moon' 
                      ? 0.15 / (0.5 + Math.pow(Math.max(0.1, adjustedDistance), 0.25)) // Even more gradual for moons
                      : 0.1 / (0.4 + Math.pow(Math.max(0.1, adjustedDistance), 0.3));  // More aggressive power curve for quick transitions
                    
                    // FIXED: Apply maximum thickness constraint based on camera distance to prevent
                    // orbits from being too large when zooming in manually
                    const maxThickness = Math.min(
                      Math.max(minThickness, entityRadius / (orbitRadius * SCENE_SCALE) * maxThicknessRatio),
                      // Use the smoothed distance-based constraint
                      distanceBasedConstraint
                    );
                    
                    // Apply additional dynamic scaling for very close views with smooth transitions
                    let dynamicScaleFactor = 1.0; // Default scaling factor (no change)
                    
                    // Define scaling factors for different distance ranges
                    const veryCloseScaleFactor = 0.001;  // When distance < 0.5
                    const closeScaleFactor = 0.01;       // When 0.5 <= distance < 1.0
                    const midRangeScaleFactor = 0.1;     // When 1.0 <= distance < 3.0
                    const farScaleFactor = (d: number) => Math.min(3, d / 6); // When distance >= 8.0
                    
                    // Define much wider transition zones for smoother animations that cover the entire zoom range
                    const VERY_CLOSE_TRANSITION = { start: 0.3, end: 0.8 };    // Wider transition
                    const CLOSE_TRANSITION = { start: 0.7, end: 1.3 };         // Wider transition
                    const MID_TRANSITION = { start: 1.2, end: 3.5 };           // Wider transition
                    const FAR_TRANSITION = { start: 3.0, end: 10.0 };          // Much wider transition
                    
                    // Apply smooth transitions between distance ranges with improved logic
                    if (cameraDistance < VERY_CLOSE_TRANSITION.start) {
                      // Very close range - thin orbits
                      dynamicScaleFactor = veryCloseScaleFactor;
                    } else if (cameraDistance < VERY_CLOSE_TRANSITION.end) {
                      // Transition from very close to close with improved smoothing
                      const t = (cameraDistance - VERY_CLOSE_TRANSITION.start) / 
                                (VERY_CLOSE_TRANSITION.end - VERY_CLOSE_TRANSITION.start);
                      // Use front-loaded transition for more aggressive early changes
                      const smoothT = Math.pow(t, 3); // Front-loaded curve consistent with other transitions
                      dynamicScaleFactor = veryCloseScaleFactor * (1 - smoothT) + closeScaleFactor * smoothT;
                    } else if (cameraDistance < CLOSE_TRANSITION.start) {
                      // Close range
                      dynamicScaleFactor = closeScaleFactor;
                    } else if (cameraDistance < CLOSE_TRANSITION.end) {
                      // Transition from close to mid range
                      const t = (cameraDistance - CLOSE_TRANSITION.start) / 
                                (CLOSE_TRANSITION.end - CLOSE_TRANSITION.start);
                      // Use front-loaded transition for more aggressive early changes
                      const smoothT = Math.pow(t, 3); // Front-loaded curve consistent with other transitions
                      dynamicScaleFactor = closeScaleFactor * (1 - smoothT) + midRangeScaleFactor * smoothT;
                    } else if (cameraDistance < MID_TRANSITION.start) {
                      // Mid range
                      dynamicScaleFactor = midRangeScaleFactor;
                    } else if (cameraDistance < MID_TRANSITION.end) {
                      // Transition from mid range to standard (1.0)
                      const t = (cameraDistance - MID_TRANSITION.start) / 
                                (MID_TRANSITION.end - MID_TRANSITION.start);
                      // Use front-loaded transition for more aggressive early changes
                      const smoothT = Math.pow(t, 3); // Front-loaded curve consistent with other transitions
                      dynamicScaleFactor = midRangeScaleFactor * (1 - smoothT) + 1.0 * smoothT;
                    } else if (cameraDistance < FAR_TRANSITION.start) {
                      // Standard range - no scaling
                      dynamicScaleFactor = 1.0;
                    } else if (cameraDistance < FAR_TRANSITION.end) {
                      // Transition from standard to far
                      const t = (cameraDistance - FAR_TRANSITION.start) / 
                                (FAR_TRANSITION.end - FAR_TRANSITION.start);
                      // Use front-loaded transition for more aggressive early changes
                      const smoothT = Math.pow(t, 3); // Front-loaded curve consistent with other transitions
                      dynamicScaleFactor = 1.0 * (1 - smoothT) + farScaleFactor(cameraDistance) * smoothT;
                    } else {
                      // Far away - increase thickness for system view
                      dynamicScaleFactor = farScaleFactor(cameraDistance);
                    }
                    
                    // Apply the dynamic scaling factor
                    thickness *= dynamicScaleFactor;
                    
                    // Skip rendering this orbit if it should be hidden
                    if (shouldHideOrbit) {
                      return null;
                    }
                    
                    // Apply the entity size constraint
                    let finalThickness = Math.min(Math.max(thickness, minThickness), maxThickness);
                    
                    // Extra scaling to ensure thin lines as soon as zooming starts
                    // This makes orbit lines get thin very early in the zoom when camera is moving
                    if (cameraDistance < SYSTEM_VIEW_THRESHOLD && cameraDistance > SYSTEM_TRANSITION_START) {
                      // Calculate how far into the zoom we are - 0 = just started zooming in, 1 = fully zoomed in
                      const zoomProgress = 1.0 - ((cameraDistance - SYSTEM_TRANSITION_START) / 
                                               (SYSTEM_VIEW_THRESHOLD - SYSTEM_TRANSITION_START));
                      
                      // Apply an extra aggressive reduction during early zoom
                      // This ensures orbits are thin almost immediately when zooming in starts
                      if (zoomProgress > 0.01 && zoomProgress < 0.5) {
                        const earlyZoomScaleFactor = Math.pow(1.0 - zoomProgress, 4) + 0.1; // Very aggressive early reduction
                        finalThickness *= earlyZoomScaleFactor;
                      }
                    }
                    
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
      
      {/* Add the RouteVisualizer component LAST to ensure highest render priority */}
      <MultipleRouteVisualizer />
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