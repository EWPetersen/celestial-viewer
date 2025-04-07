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
  jumppoint: 0.1,     // Torus base size
  reststop: 0.0015,   // Consistent with station
  outpost: 0.0012,    // Slightly smaller than station
  unknown: 0.001,     // Default small size
};

// --- Helper function for default colors ---
const getDefaultColor = (type: EntityType, name?: string): string => {
  // For moons, generate a slight variation based on the name
  if (type === 'moon' && name) {
    // Create a consistent but varied moon color based on the moon's name
    // This ensures each moon has a slightly different color tone
    const moonColors = [
      '#B0C4DE', // Light steel blue (default)
      '#CCCCDD', // Light lavender
      '#CDC0B0', // Light tan/beige
      '#C0D0CC', // Light teal
      '#C2A894', // Light brown
      '#D3C5BB', // Light sand
      '#B5B8B1', // Light gray-green
      '#B2A3A3'  // Light mauve
    ];
    
    // Use name to deterministically select a color
    const nameHash = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const colorIndex = nameHash % moonColors.length;
    return moonColors[colorIndex];
  }
  
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
  color, // Allow overriding default color
  name // Add name for entity-specific customization
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
    const entityColor = color || getDefaultColor(normalizedType, name);
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
          <sphereGeometry args={[baseSize * 1.5, 32, 32]} />
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
    
    // Return null to remove the wireframe selection highlight completely
    return null;
    
    /* Original code commented out:
    return (
      <mesh>
        <sphereGeometry args={[highlightSize, 32, 32]} />
        <meshBasicMaterial color="#ffffff" wireframe={true} transparent={true} opacity={0.5} />
      </mesh>
    );
    */
  };

  // Jump Point Glow Effect
  const getJumpPointGlow = () => {
    if (normalizedType !== 'jumppoint') return null;
    
    const scaleFactor = entityVisualScaleFactors.jumppoint ?? 1.0;
    const baseSize = size * scaleFactor;
    const glowColor = color || getDefaultColor('jumppoint');
    
    return (
      <group>
        {/* Inner glow */}
        <mesh rotation={jumpPointRotation}>
          <torusGeometry args={[baseSize, baseSize * 0.3, 16, 64]} />
          <meshBasicMaterial 
            color={glowColor}
            transparent={true} 
            opacity={0.3}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        
        {/* Outer glow */}
        <mesh rotation={jumpPointRotation}>
          <torusGeometry args={[baseSize * 1.2, baseSize * 0.15, 16, 64]} />
          <meshBasicMaterial 
            color={glowColor}
            transparent={true} 
            opacity={0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  };

  // --- Render --- 
  const coreMaterialProps = getMaterialProps(false); // Get core object material props

  // Deterministic rotation for jump points based on entity size
  // This ensures each jump point has a unique orientation, but it stays consistent between renders
  const jumpPointRotation = useMemo(() => {
    if (normalizedType !== 'jumppoint') return undefined;
    
    // Create a deterministic but seemingly random rotation based on size
    // This ensures each jump point has a different orientation but remains consistent
    const hash = Math.abs(size * 1000) % 1000; // Use size as a hash seed
    const xRot = (hash % 90) * Math.PI / 180;
    const yRot = ((hash * 31) % 90) * Math.PI / 180;
    const zRot = ((hash * 73) % 90) * Math.PI / 180;
    
    return [xRot, yRot, zRot] as [number, number, number];
  }, [normalizedType, size]);

  return (
    <group ref={meshRef}>
      {/* Core Mesh */} 
      <mesh rotation={jumpPointRotation}>
        {getGeometry(size)}
        <meshStandardMaterial {...coreMaterialProps} />
      </mesh>

      {/* Additional Effects */} 
      {getStarCorona()}
      {getAtmosphere()}
      {getJumpPointGlow()}
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