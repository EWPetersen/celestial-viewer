import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { EntityType, CelestialMeshProps, EntityMaterialProps } from './types';

// --- Visual Scaling Factors per Entity Type ---
// Adjusted for holographic look - smaller core objects, rely on glow/effects
const entityVisualScaleFactors: Record<EntityType | 'unknown', number> = {
  star: 0.02,          // Smaller core, larger corona
  planet: 0.015,      // Slightly smaller core for atmosphere effect
  moon: 0.04,        // Slightly smaller core
  station: 0.004,     // Larger for better visibility
  commarray: 0.02,   // Keep small
  landingzone: 0.01, // Keep small
  lagrangepoint: 0.1, // Smaller core, rely on glow
  jumppoint: 0.05,     // Torus base size
  reststop: 0.0015,   // Consistent with station
  outpost: 0.0012,    // Slightly smaller than station
  unknown: 0.001,     // Default small size
};

// --- Helper function for default colors ---
const getDefaultColor = (type: EntityType): string => {
  switch (type) {
    case 'star': return '#FFF4E5'; // Warm white
    case 'planet': return '#87CEEB'; // Sky blue default
    case 'moon': return '#B0C4DE'; // Light steel blue
    case 'station': return '#FF6347'; // Tomato red
    case 'commarray': return '#FFA500'; // Orange
    case 'landingzone': return '#98FB98'; // Pale green
    case 'lagrangepoint': return '#44FF44'; // Bright green
    case 'jumppoint': return '#AA44FF'; // Bright purple
    case 'reststop': return '#FFD700'; // Gold
    case 'outpost': return '#DAA520'; // Goldenrod
    default: return '#FFFFFF'; // White for unknown
  }
};

/**
 * Factory component that creates different mesh geometries based on the entity type
 */
const CelestialMeshFactory: React.FC<CelestialMeshProps> = ({ 
  type, 
  size, // Base size (usually 1, scaling happens dynamically later)
  isSelected = false, 
  color // Allow overriding default color
}) => {
  
  // Normalize the type
  const normalizedType = useMemo(() => {
    const validTypes: EntityType[] = [
      'star', 'planet', 'moon', 'station', 'commarray', 
      'landingzone', 'lagrangepoint', 'jumppoint', 'reststop', 'outpost'
    ];
    const isValid = validTypes.includes(type as EntityType);
    return isValid ? (type as EntityType) : 'unknown';
  }, [type]);

  // Log warning for unknown types
  useEffect(() => {
    if (normalizedType === 'unknown') {
      console.warn(`[CMFactory] Unknown entity type encountered: ${type}. Using default wireframe cube.`);
    }
  }, [normalizedType, type]);

  // Refs for animation or effects if needed later
  const meshRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Get material properties based on type
  const getMaterialProps = (isAtmosphere = false): EntityMaterialProps => {
    const entityColor = color || getDefaultColor(normalizedType);
    const baseMaterial: Partial<EntityMaterialProps> = {
      color: entityColor,
      metalness: 0.2, // Less metallic for holographic feel
      roughness: 0.6,
    };

    let resultProps: EntityMaterialProps;

    switch (normalizedType) {
      case 'star':
        resultProps = {
          color: entityColor,
          emissive: entityColor,
          emissiveIntensity: 1.0,
        };
        break;
      
      case 'planet':
        resultProps = {
          ...baseMaterial,
          color: entityColor,
          metalness: isAtmosphere ? 0.0 : 0.1,
          roughness: isAtmosphere ? 0.9 : 0.8,
          emissive: isSelected ? entityColor : '#000000',
          emissiveIntensity: isSelected ? 0.2 : 0,
          transparent: isAtmosphere,
          opacity: isAtmosphere ? 0.2 : 1.0,
          side: isAtmosphere ? THREE.BackSide : THREE.FrontSide, // Render inside for atmosphere
        };
        break;
      
      case 'moon':
        resultProps = {
          ...baseMaterial,
           color: entityColor,
          metalness: isAtmosphere ? 0.0 : 0.2,
          roughness: isAtmosphere ? 0.95 : 0.9,
          emissive: isSelected ? entityColor : '#000000',
          emissiveIntensity: isSelected ? 0.15 : 0,
          transparent: isAtmosphere,
          opacity: isAtmosphere ? 0.15 : 1.0,
          side: isAtmosphere ? THREE.BackSide : THREE.FrontSide,
        };
        break;
      
      case 'station':
      case 'reststop':
        resultProps = {
          color: entityColor,
          emissive: entityColor,
          emissiveIntensity: 0.6, // Brighter emissive for holographic markers
          metalness: 0.4,
          roughness: 0.3,
          wireframe: true, // Use wireframe for a techy look
        };
        break;
      
      case 'commarray':
      case 'outpost':
        resultProps = {
          color: entityColor,
          emissive: entityColor,
          emissiveIntensity: 0.5,
          metalness: 0.5,
          roughness: 0.4,
          wireframe: true, 
        };
        break;
      
      case 'landingzone':
        resultProps = {
          color: entityColor,
          emissive: entityColor,
          emissiveIntensity: 0.4,
          metalness: 0.3,
          roughness: 0.6,
          transparent: true,
          opacity: 0.6, // Semi-transparent marker
        };
        break;

      case 'lagrangepoint':
         resultProps = {
          color: entityColor,
          emissive: entityColor,
          emissiveIntensity: 0.8, // Strong glow
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        };
        break;

      case 'jumppoint':
        resultProps = {
          color: entityColor,
          emissive: entityColor,
          emissiveIntensity: 0.9, // Very bright glow
          metalness: 0.1,
          roughness: 0.2,
        };
        break;

      default: // unknown
        resultProps = {
          color: entityColor,
          wireframe: true, // Default to wireframe for unknown
        };
    }
    // Ensure required properties always exist
    return {
        color: resultProps.color || '#ffffff', 
        emissive: resultProps.emissive,
        emissiveIntensity: resultProps.emissiveIntensity,
        metalness: resultProps.metalness,
        roughness: resultProps.roughness,
        transparent: resultProps.transparent,
        opacity: resultProps.opacity,
        wireframe: resultProps.wireframe,
        side: resultProps.side,
    };
  };

  // Create geometry based on entity type
  const getGeometry = (geometryBaseSize: number) => {
    const safeBaseSize = Math.max(0.001, geometryBaseSize);
    const scaleFactor = entityVisualScaleFactors[normalizedType] ?? 1.0;
    const finalSize = safeBaseSize * scaleFactor;
    
    switch (normalizedType) {
      case 'star':        return <sphereGeometry args={[finalSize, 32, 32]} />;
      case 'planet':      return <sphereGeometry args={[finalSize, 32, 32]} />;
      case 'moon':        return <sphereGeometry args={[finalSize, 24, 24]} />;
      // Use Torus for Stations and Rest Stops for a distinct look
      case 'station':     return <torusKnotGeometry args={[finalSize * 0.8, finalSize * 0.2, 64, 8]} />; 
      case 'reststop':    return <torusGeometry args={[finalSize, finalSize * 0.3, 8, 32]} />;
      // Keep Comm Arrays as cylinders, maybe add cones?
      case 'commarray':   return <cylinderGeometry args={[finalSize * 0.5, finalSize * 0.8, finalSize * 2, 16]} />;
      // Landing zones as flat cylinders (markers)
      case 'landingzone': return <cylinderGeometry args={[finalSize, finalSize, finalSize * 0.1, 32]} />;
      // Lagrange points as glowing spheres
      case 'lagrangepoint': return <sphereGeometry args={[finalSize, 16, 16]} />;
      // Jump points as Torus (like old vis)
      case 'jumppoint':   return <torusGeometry args={[finalSize, finalSize * 0.2, 16, 64]} />;
      // Outposts as boxes
      case 'outpost':     return <boxGeometry args={[finalSize * 1.5, finalSize, finalSize * 1.5]} />;
      case 'unknown':
      default:          return <boxGeometry args={[finalSize, finalSize, finalSize]} />;
    }
  };

  // --- Additional Visual Elements --- 

  // Star Corona Effect
  const getStarCorona = () => {
    if (normalizedType !== 'star') return null;
    const scaleFactor = entityVisualScaleFactors.star ?? 1.0;
    const baseSize = size * scaleFactor;
    const coronaColor = color || getDefaultColor('star');

    return (
      <>
        {/* Single Corona Layer */}
        <mesh>
          <sphereGeometry args={[baseSize * 3.0, 32, 32]} />
          <meshBasicMaterial 
            color={coronaColor}
            transparent={true} 
            opacity={0.3}
            side={THREE.BackSide} 
            depthWrite={false}
          />
        </mesh>
      </>
    );
  };

  // Planet/Moon Atmosphere Effect
  const getAtmosphere = () => {
    if (normalizedType !== 'planet' && normalizedType !== 'moon') return null;
    
    const scaleFactor = entityVisualScaleFactors[normalizedType] ?? 1.0;
    const baseSize = size * scaleFactor;
    const atmosphereSize = baseSize * 1.05; // Slightly larger than the core
    const materialProps = getMaterialProps(true); // Get atmosphere material props

    return (
      <mesh>
        <sphereGeometry args={[atmosphereSize, normalizedType === 'planet' ? 32 : 24, normalizedType === 'planet' ? 32 : 24]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
    );
  };

  // Selection Highlight (Wireframe sphere)
  const getSelectionHighlight = () => {
    if (!isSelected) return null;
    const scaleFactor = entityVisualScaleFactors[normalizedType] ?? 1.0;
    // Make highlight slightly larger than the object + atmosphere
    const highlightSize = size * scaleFactor * (normalizedType === 'planet' || normalizedType === 'moon' ? 1.1 : 1.2);
    
    return (
      <mesh>
        <sphereGeometry args={[highlightSize, 32, 32]} />
        <meshBasicMaterial color="#ffffff" wireframe={true} transparent={true} opacity={0.5} />
      </mesh>
    );
  };

  // --- Render --- 
  const coreMaterialProps = getMaterialProps(false); // Get core object material props

  return (
    <group ref={meshRef}>
      {/* Core Mesh */} 
      <mesh>
        {getGeometry(size)}
        <meshStandardMaterial {...coreMaterialProps} />
      </mesh>

      {/* Additional Effects */} 
      {getStarCorona()}
      {getAtmosphere()}
      {getSelectionHighlight()}

      {/* Optional: Point Light for Stars */} 
      {normalizedType === 'star' && (
         <pointLight 
            position={[0, 0, 0]} 
            color={coreMaterialProps.color} 
            intensity={1.5} 
            distance={50} // Adjust distance based on system scale
          />
      )}
    </group>
  );
};

export default CelestialMeshFactory; 