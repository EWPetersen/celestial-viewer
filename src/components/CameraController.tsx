import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Camera control constants
const MIN_DISTANCE = 1;    // Closest zoom (focus on object)
const MAX_DISTANCE = 200;  // Furthest zoom (system view)
const DEFAULT_DISTANCE = 80; // Default system view distance
const ZOOM_SPEED = 0.75;    // Adjust zoom speed

export default function CameraController() {
  const controls = useRef<any>(null);
  const camera = useRef<THREE.PerspectiveCamera>(null);

  useEffect(() => {
    if (!controls.current || !camera.current) return;

    // Handle zoom
    const handleWheel = (event: WheelEvent) => {
      const delta = event.deltaY;
      const currentDistance = camera.current!.position.length();
      
      // Calculate new distance with zoom speed
      let newDistance = currentDistance - delta * ZOOM_SPEED;
      
      // Clamp distance between min and max
      newDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, newDistance));
      
      // Calculate new position while maintaining direction
      const direction = camera.current!.position.clone().normalize();
      const newPosition = direction.multiplyScalar(newDistance);
      
      // Update camera position
      camera.current!.position.copy(newPosition);
      controls.current!.update();
    };

    // Add event listener
    window.addEventListener('wheel', handleWheel);

    // Cleanup
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Reset camera view
  const resetView = () => {
    if (!controls.current || !camera.current) return;

    // Calculate default position (90 units away from center)
    const defaultPosition = new THREE.Vector3(0, 0, DEFAULT_DISTANCE);
    
    // Animate camera movement
    animateCameraMove(defaultPosition, new THREE.Vector3(0, 0, 0));
  };

  // Animate camera movement
  const animateCameraMove = (newPosition: THREE.Vector3, newTarget: THREE.Vector3) => {
    if (!controls.current || !camera.current) return;

    // Store initial positions
    const startPosition = camera.current.position.clone();
    const startTarget = controls.current.target.clone();
    
    // Animation duration in milliseconds
    const duration = 1000;
    const startTime = Date.now();
    
    // Animation function
    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease function (cubic ease in/out)
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      // Interpolate camera position
      camera.current!.position.x = startPosition.x + (newPosition.x - startPosition.x) * ease;
      camera.current!.position.y = startPosition.y + (newPosition.y - startPosition.y) * ease;
      camera.current!.position.z = startPosition.z + (newPosition.z - startPosition.z) * ease;
      
      // Interpolate target position
      controls.current!.target.x = startTarget.x + (newTarget.x - startTarget.x) * ease;
      controls.current!.target.y = startTarget.y + (newTarget.y - startTarget.y) * ease;
      controls.current!.target.z = startTarget.z + (newTarget.z - startTarget.z) * ease;
      
      // Update controls
      controls.current!.update();
      
      // Continue animation if not complete
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    
    // Start animation
    animate();
  };

  return (
    <OrbitControls
      ref={controls}
      camera={camera.current || undefined}
      enableDamping
      dampingFactor={0.05}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      target={[0, 0, 0]}
    />
  );
} 