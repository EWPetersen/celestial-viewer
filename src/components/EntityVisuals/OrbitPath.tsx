import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface OrbitPathProps {
  center: { x: number; y: number; z: number };
  radius: number;
  color?: string;
  segments?: number;
  visible?: boolean;
}

/**
 * Component that renders a circular orbit path in the XY plane
 */
const OrbitPath: React.FC<OrbitPathProps> = ({
  center,
  radius,
  color = '#334455',
  segments = 128,
  visible = true
}) => {
  // Generate circle points for the orbit
  const points = useMemo(() => {
    const points = [];
    // Ensure valid radius and segments
    const validRadius = isFinite(radius) && radius > 0 ? radius : 0;
    const validSegments = isFinite(segments) && segments > 8 ? segments : 32;
    
    if (validRadius <= 0) return [];
    
    // Create points for circle in XY plane (Z is depth in Three.js)
    for (let i = 0; i <= validSegments; i++) {
      const angle = (i / validSegments) * Math.PI * 2;
      const x = Math.cos(angle) * validRadius;
      const y = Math.sin(angle) * validRadius;
      points.push(new THREE.Vector3(x, y, 0));
    }
    
    return points;
  }, [radius, segments]);
  
  // If radius is invalid or zero, don't render anything
  if (!points.length || !visible) return null;
  
  // Convert center to Three.js vector
  const centerVector = new THREE.Vector3(center.x, center.y, center.z);
  
  return (
    <group position={centerVector}>
      <Line
        points={points}
        color={color}
        lineWidth={2}
        opacity={0.8}
        transparent
      />
    </group>
  );
};

export default OrbitPath; 