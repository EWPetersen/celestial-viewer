import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import useAppStore, { CelestialBody as CelestialBodyType, JumpPoint as JumpPointType, PointOfInterest as PointOfInterestType } from '../../stores/useAppStore';
import { calculateOrbitPosition, degreesToRadians, Vector3 } from '../../utils/coordinateUtils';
import { calculateScaleFactor } from '../../utils/distanceUtils';

interface CelestialBodyProps {
  id: string;
  name: string;
  position: Vector3;
  radius: number;
  type: string;
  color?: string;
  selectable?: boolean;
}

// Planet component
const CelestialBody: React.FC<CelestialBodyProps> = ({ 
  id, 
  name, 
  position, 
  radius, 
  type, 
  color = '#ffffff',
  selectable = true 
}) => {
  const { selectedCelestialBodyId, selectCelestialBody } = useAppStore();
  const isSelected = selectedCelestialBodyId === id;
  
  // Calculate scaled radius for visualization
  // We use a logarithmic scale to make small objects visible while keeping relative sizes somewhat accurate
  const scaledRadius = Math.max(
    0.1,
    radius * 0.000000005
  );

  // Ref to the mesh
  const meshRef = useRef<THREE.Mesh>(null);

  // Handle click on the celestial body
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (selectable) {
      selectCelestialBody(id);
    }
  };

  // Determine the color based on type
  const getBodyColor = () => {
    if (type === 'star') return '#ffff00';
    if (type === 'planet') {
      if (name === 'microTech') return '#00ffff';
      if (name === 'Crusader') return '#a0a0ff';
      if (name === 'Hurston') return '#a05030';
      if (name === 'ArcCorp') return '#ff6060';
      return '#60a060';
    }
    if (type === 'moon') return '#a0a0a0';
    return color;
  };

  // Create material based on type
  const getMaterial = () => {
    const bodyColor = getBodyColor();
    
    if (type === 'star') {
      return (
        <meshBasicMaterial 
          color={bodyColor}
        />
      );
    }
    
    return (
      <meshStandardMaterial 
        color={bodyColor} 
        emissive={isSelected ? '#ffffff' : bodyColor}
        emissiveIntensity={isSelected ? 0.3 : 0}
        metalness={0.3}
        roughness={0.7}
      />
    );
  };

  return (
    <mesh
      ref={meshRef}
      position={[position.x * 0.0000000001, position.y * 0.0000000001, position.z * 0.0000000001]}
      onClick={handleClick}
    >
      <sphereGeometry args={[scaledRadius, 32, 32]} />
      {getMaterial()}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[scaledRadius * 1.2, 16, 16]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </mesh>
  );
};

interface OrbitLineProps {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  color?: string;
}

// OrbitLine component
const OrbitLine: React.FC<OrbitLineProps> = ({ 
  semiMajorAxis, 
  eccentricity, 
  inclination, 
  color = '#444444' 
}) => {
  // Create an elliptical orbit path
  const points = [];
  const segments = 64;
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const position = calculateOrbitPosition(
      semiMajorAxis,
      eccentricity,
      degreesToRadians(inclination),
      0, // longitude of ascending node
      0, // argument of periapsis
      angle
    );
    
    points.push(new THREE.Vector3(
      position.x * 0.0000000001,
      position.y * 0.0000000001,
      position.z * 0.0000000001
    ));
  }
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  
  return (
    <primitive object={new THREE.Line(
      lineGeometry,
      new THREE.LineBasicMaterial({ color, opacity: 0.5, transparent: true })
    )} />
  );
};

interface JumpPointProps {
  id: string;
  name: string;
  position: Vector3;
  destinationSystem: string;
}

// JumpPoint component
const JumpPoint: React.FC<JumpPointProps> = ({ 
  id, 
  name, 
  position, 
  destinationSystem 
}) => {
  const { selectedJumpPointId, selectJumpPoint } = useAppStore();
  const isSelected = selectedJumpPointId === id;
  
  // Animation for the jump point
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.5;
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.3;
    }
  });
  
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectJumpPoint(id);
  };
  
  return (
    <group
      position={[position.x * 0.0000000001, position.y * 0.0000000001, position.z * 0.0000000001]}
      onClick={handleClick}
    >
      <mesh ref={meshRef}>
        <torusGeometry args={[0.5, 0.2, 16, 32]} />
        <meshStandardMaterial 
          color="#4080ff" 
          emissive="#4080ff" 
          emissiveIntensity={isSelected ? 1 : 0.5}
          opacity={0.7} 
          transparent 
        />
      </mesh>
      {isSelected && (
        <mesh>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

interface PointOfInterestProps {
  id: string;
  name: string;
  position: Vector3;
  type: string;
}

// PointOfInterest component
const PointOfInterest: React.FC<PointOfInterestProps> = ({ 
  id, 
  name, 
  position, 
  type 
}) => {
  const { selectedPointOfInterestId, selectPointOfInterest } = useAppStore();
  const isSelected = selectedPointOfInterestId === id;
  
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Animation for the POI
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime();
    }
  });
  
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectPointOfInterest(id);
  };
  
  return (
    <group
      position={[position.x * 0.0000000001, position.y * 0.0000000001, position.z * 0.0000000001]}
      onClick={handleClick}
    >
      <mesh ref={meshRef}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial 
          color="#80ff80" 
          emissive="#80ff80" 
          emissiveIntensity={isSelected ? 1 : 0.5}
        />
      </mesh>
      {isSelected && (
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

// Scene component
const SceneContent: React.FC = () => {
  const { celestialSystem } = useAppStore();
  
  if (!celestialSystem) {
    return null;
  }
  
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={1} color="#ffffff" />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} />

      {/* Render celestial bodies */}
      {celestialSystem.celestialBodies.map((body) => (
        <React.Fragment key={body.id}>
          <CelestialBody
            id={body.id}
            name={body.name}
            position={body.position}
            radius={body.radius}
            type={body.type}
          />
          
          {/* Render orbit if available */}
          {body.orbit && body.parent && (
            <OrbitLine
              semiMajorAxis={body.orbit.semiMajorAxis}
              eccentricity={body.orbit.eccentricity}
              inclination={body.orbit.inclination}
            />
          )}
          
          {/* Render moons */}
          {body.moons?.map((moon) => {
            // Calculate moon's position relative to its parent
            // In a real app, this would be more sophisticated
            const angle = Math.random() * Math.PI * 2; // Random position for now
            const x = body.position.x + moon.orbit.semiMajorAxis * Math.cos(angle);
            const z = body.position.z + moon.orbit.semiMajorAxis * Math.sin(angle);
            
            return (
              <CelestialBody
                key={moon.id}
                id={moon.id}
                name={moon.name}
                position={{ x, y: body.position.y, z }}
                radius={moon.radius}
                type="moon"
              />
            );
          })}
        </React.Fragment>
      ))}
      
      {/* Render jump points */}
      {celestialSystem.jumpPoints.map((jumpPoint) => (
        <JumpPoint
          key={jumpPoint.id}
          id={jumpPoint.id}
          name={jumpPoint.name}
          position={jumpPoint.position}
          destinationSystem={jumpPoint.destinationSystem}
        />
      ))}
      
      {/* Render points of interest */}
      {celestialSystem.pointsOfInterest.map((poi) => (
        <PointOfInterest
          key={poi.id}
          id={poi.id}
          name={poi.name}
          position={poi.position}
          type={poi.type}
        />
      ))}
    </>
  );
};

// Main StarMap component
const StarMap: React.FC = () => {
  const { celestialSystem, isLoading, error } = useAppStore();
  
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
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        style={{ background: '#000' }}
        camera={{ position: [0, 10, 50], fov: 60 }}
      >
        <SceneContent />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
};

export default StarMap; 