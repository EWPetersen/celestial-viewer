import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { EntityType, CelestialMeshProps, EntityMaterialProps } from './types';

// --- Visual Scaling Factors per Entity Type ---
// Adjust these values to control the relative visual size of each entity type
const entityVisualScaleFactors: Record<EntityType | 'unknown', number> = {
  star: 0.1, // Keep the star small
  planet: 1.5,
  moon: 0.6, // Make moons slightly smaller than planets visually
  station: 0.8,
  commarray: 0.7,
  landingzone: 0.8,
  lagrangepoint: 0.2,
  jumppoint: 0.5,
  reststop: 0.8,
  outpost: 0.7,
  unknown: 0.5, // Default size for unknown types
};

/**
 * Factory component that creates different mesh geometries based on the entity type
 */
const CelestialMeshFactory: React.FC<CelestialMeshProps> = ({ 
  type, 
  size, 
  isSelected = false, 
  color 
}) => {
  
  // Normalize the type to our known types, or use 'unknown' as fallback
  const normalizedType = useMemo(() => {
    const validTypes: EntityType[] = [
      'star', 'planet', 'moon', 'station', 'commarray', 
      'landingzone', 'lagrangepoint', 'jumppoint', 'reststop', 'outpost'
    ];
    
    const isValid = validTypes.includes(type as EntityType);
    const result = isValid ? (type as EntityType) : 'unknown';
    
    return result;
  }, [type]);

  // Log warning for unknown types
  React.useEffect(() => {
    if (normalizedType === 'unknown') {
      console.warn(`[CMFactory] Unknown entity type encountered: ${type}. Using default wireframe cube.`);
    }
  }, [normalizedType, type]);

  // Refs for animation
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Animate glowing and rotating effects for certain types
  useFrame((state) => {
    if (!meshRef.current) return;

    // Add subtle rotation to some objects
    if (['star', 'planet', 'moon'].includes(normalizedType)) {
      meshRef.current.rotation.y += 0.001;
    }
    
    // Animate glow for stars and lagrange points
    if (glowRef.current && ['star', 'lagrangepoint'].includes(normalizedType)) {
      const time = state.clock.getElapsedTime();
      glowRef.current.scale.setScalar(1 + 0.05 * Math.sin(time));
    }
  });

  // Get default color based on entity type
  const getDefaultColor = (type: EntityType): string => {
    switch (type) {
      case 'star': return '#ffff80';
      case 'planet': return '#60a060';
      case 'moon': return '#a0a0a0';
      case 'station': return '#80c0ff';
      case 'commarray': return '#ffaa00';
      case 'landingzone': return '#00ffaa';
      case 'lagrangepoint': return '#aa00ff';
      case 'jumppoint': return '#ff00ff';
      case 'reststop': return '#00aaff';
      case 'outpost': return '#ffaa80';
      case 'unknown':
      default: return '#ffffff';
    }
  };

  // Get the material properties based on type - ensure all props have valid values
  const getMaterialProps = (): EntityMaterialProps => {
    // Always ensure we have a valid color
    const entityColor = color || getDefaultColor(normalizedType);
    
    // Base material with common valid properties
    const baseMaterial: EntityMaterialProps = {
      color: entityColor,
      metalness: 0.5,
      roughness: 0.5,
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
          metalness: 0.1,
          roughness: 0.8,
          emissive: isSelected ? entityColor : '#000000',
          emissiveIntensity: isSelected ? 0.3 : 0,
        };
        break;
      
      case 'moon':
        resultProps = {
          ...baseMaterial,
          metalness: 0.2,
          roughness: 0.9,
          emissive: isSelected ? entityColor : '#000000',
          emissiveIntensity: isSelected ? 0.3 : 0,
        };
        break;
      
      case 'station':
      case 'reststop':
        resultProps = {
          ...baseMaterial,
          metalness: 0.7,
          roughness: 0.3,
          emissive: entityColor,
          emissiveIntensity: 0.3,
        };
        break;
      
      case 'commarray':
        resultProps = {
          ...baseMaterial,
          metalness: 0.6,
          roughness: 0.4,
          emissive: isSelected ? entityColor : '#000000',
          emissiveIntensity: isSelected ? 0.5 : 0,
        };
        break;
      
      case 'landingzone':
        resultProps = {
          ...baseMaterial,
          metalness: 0.4,
          roughness: 0.6,
          emissive: entityColor,
          emissiveIntensity: 0.4,
          transparent: true,
          opacity: 0.8,
        };
        break;
      
      case 'lagrangepoint':
        resultProps = {
          ...baseMaterial,
          emissive: entityColor,
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.5,
        };
        break;
      
      case 'jumppoint':
        resultProps = {
          ...baseMaterial,
          emissive: entityColor,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.7,
        };
        break;
      
      case 'outpost':
        resultProps = {
          ...baseMaterial,
          metalness: 0.5,
          roughness: 0.5,
          emissive: isSelected ? entityColor : '#000000',
          emissiveIntensity: isSelected ? 0.4 : 0,
        };
        break;
      
      case 'unknown':
      default:
        resultProps = {
          color: entityColor,
          wireframe: true,
          metalness: 0.5,
          roughness: 0.5,
        };
        break;
    }
    
    return resultProps;
  };

  // Create material from properties with safety checks
  const createMaterial = (props: EntityMaterialProps) => {
    // Ensure props has at least a valid color
    const safeProps = {
      ...props,
      color: props.color || '#ffffff', // Fallback color if undefined
    };
    
    // Use basic material for stars, stations, and reststops for simplicity during debugging
    if (normalizedType === 'star' || normalizedType === 'station' || normalizedType === 'reststop') {
      // Basic material only needs color and potentially transparency/opacity
      const basicProps = {
        color: safeProps.color,
        transparent: safeProps.transparent,
        opacity: safeProps.opacity,
      };
      // Clean up undefined props
      if (basicProps.transparent === undefined) delete basicProps.transparent;
      if (basicProps.opacity === undefined) delete basicProps.opacity;
      
      
      return <meshBasicMaterial {...basicProps} />;
    }
    
    // For other standard materials, ensure numerical properties are valid finite numbers
    // to prevent Three.js uniform errors
    const standardProps = {
      ...safeProps,
      // Ensure color is a valid string
      color: typeof safeProps.color === 'string' ? safeProps.color : '#ffffff',
      // Ensure numeric properties are finite numbers, providing defaults otherwise
      metalness: (typeof safeProps.metalness === 'number' && isFinite(safeProps.metalness)) ? safeProps.metalness : 0.5,
      roughness: (typeof safeProps.roughness === 'number' && isFinite(safeProps.roughness)) ? safeProps.roughness : 0.5,
      emissive: typeof safeProps.emissive === 'string' ? safeProps.emissive : '#000000',
      emissiveIntensity: (typeof safeProps.emissiveIntensity === 'number' && isFinite(safeProps.emissiveIntensity)) ? safeProps.emissiveIntensity : 0,
      // Ensure opacity is always defined and finite, defaulting to 1.0
      opacity: (typeof safeProps.opacity === 'number' && isFinite(safeProps.opacity)) ? safeProps.opacity : 1.0,
      // Set transparency based on opacity, ensuring opacity is a valid number
      transparent: (typeof safeProps.opacity === 'number' && isFinite(safeProps.opacity) && safeProps.opacity < 1.0) ? true : (safeProps.transparent ?? false),
    };
    
    // If transparency is ultimately false, remove the opacity property altogether
    // as MeshStandardMaterial might have issues with opacity=1.0 when not transparent.
    if (!standardProps.transparent) {
      delete (standardProps as any).opacity;
    }

    
    return <meshStandardMaterial {...standardProps} />;
  };

  // Get selection highlight if entity is selected
  const getSelectionHighlight = () => {
    if (!isSelected) return null;
    
    // Get the scale factor for the current type
    const scaleFactor = entityVisualScaleFactors[normalizedType] ?? 1.0;
    const highlightBaseSize = size * 1.2;
    const highlightSize = highlightBaseSize * scaleFactor; // Apply scale factor
    
    return (
      <mesh>
        {/* Pass the correctly scaled size */}
        {getGeometryByType(normalizedType, highlightSize / scaleFactor)} {/* Divide by scaleFactor again because getGeometryByType will re-apply it */}
        <meshBasicMaterial color="#ffffff" wireframe={true} transparent={true} opacity={0.3} />
      </mesh>
    );
  };

  // Get glow effect for certain entity types
  const getGlowEffect = () => {
    if (!['star', 'lagrangepoint', 'jumppoint'].includes(normalizedType)) {
      return null;
    }
    
    // Get the scale factor for the current type
    const scaleFactor = entityVisualScaleFactors[normalizedType] ?? 1.0;
    const glowBaseSize = size * 1.5; // Base size for the glow
    const glowSize = glowBaseSize * scaleFactor; // Apply scale factor
    const glowColor = getDefaultColor(normalizedType as EntityType);
    
    return (
      <mesh ref={glowRef}>
        {/* Use the scaled size */}
        <sphereGeometry args={[glowSize, 16, 16]} />
        <meshBasicMaterial 
          color={glowColor} 
          transparent={true} 
          opacity={0.2} 
          side={THREE.BackSide} 
        />
      </mesh>
    );
  };

  // Get geometry based on entity type, applying the type-specific scale factor
  const getGeometryByType = (type: EntityType, geometryBaseSize: number) => {
    const safeBaseSize = Math.max(0.001, geometryBaseSize); // Ensure base size is positive
    // Get the scale factor for the current type
    const scaleFactor = entityVisualScaleFactors[type] ?? 1.0;
    // Apply the scale factor
    const finalSize = safeBaseSize * scaleFactor;
    
    switch (type) {
      // Apply finalSize to all geometry arguments
      case 'star':
        return <sphereGeometry args={[finalSize, 32, 32]} />;
      
      case 'planet':
        return <sphereGeometry args={[finalSize, 32, 32]} />;
      
      case 'moon':
        return <sphereGeometry args={[finalSize, 24, 24]} />;
      
      case 'station':
        return <torusGeometry args={[finalSize, finalSize * 0.3, 16, 32]} />;
      
      case 'commarray': {
        return <cylinderGeometry args={[finalSize * 0.5, finalSize * 0.8, finalSize * 2, 16]} />;
      }
      
      case 'landingzone':
        return <cylinderGeometry args={[finalSize, finalSize, finalSize * 0.2, 32]} />;
      
      case 'lagrangepoint':
        return <boxGeometry args={[finalSize, finalSize, finalSize]} />;
      
      case 'jumppoint':
        return <octahedronGeometry args={[finalSize, 0]} />;
      
      case 'reststop':
        return <capsuleGeometry args={[finalSize * 0.5, finalSize, 16, 16]} />;
      
      case 'outpost':
        return <boxGeometry args={[finalSize * 1.5, finalSize, finalSize * 1.5]} />;
      
      case 'unknown':
      default:
        return <boxGeometry args={[finalSize, finalSize, finalSize]} />;
    }
  };

  // Special case for commarray - create a composite mesh
  if (normalizedType === 'commarray') {
    // Base size before type-specific scaling
    const baseSize = Math.max(0.001, size);
    // Get and apply the commarray scale factor
    const scaleFactor = entityVisualScaleFactors[normalizedType] ?? 1.0;
    const finalSize = baseSize * scaleFactor;
        
    return (
      <group>
        {/* Glow effect already uses scaling internally */}
        {getGlowEffect()} 
        
        {/* Main cylinder - Use finalSize */}
        <mesh ref={meshRef} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[finalSize * 0.3, finalSize * 0.5, finalSize * 2, 16]} />
          {createMaterial(getMaterialProps())}
        </mesh>
        
        {/* Dish on top - Use finalSize */}
        <mesh position={[0, finalSize, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[finalSize * 0.8, 16]} />
          {createMaterial({ 
            ...getMaterialProps(), 
            side: THREE.DoubleSide 
          })}
        </mesh>
        
        {/* Selection highlight already uses scaling internally */}
        {getSelectionHighlight()} 
      </group>
    );
  }

  // Create a fallback mesh for any errors
  const createFallbackMesh = () => {
    
    
    return (
      <mesh>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshBasicMaterial color="#ff0000" wireframe={true} />
      </mesh>
    );
  };

  // Wrap the render in an error boundary
  try {
    // Base size before type-specific scaling
    const baseSize = Math.max(0.001, size);
        
    return (
      <group>
        {/* Glow effect already uses scaling internally */}
        {getGlowEffect()} 
        <mesh ref={meshRef}>
          {/* Pass the base size, getGeometryByType will apply the factor */}
          {getGeometryByType(normalizedType, baseSize)}
          {createMaterial(getMaterialProps())}
        </mesh>
        {/* Selection highlight already uses scaling internally */}
        {getSelectionHighlight()} 
      </group>
    );
  } catch (error) {
    console.error(`[CMFactory] Error rendering mesh for type ${normalizedType}:`, error);
    return createFallbackMesh();
  }
};

export default CelestialMeshFactory; 