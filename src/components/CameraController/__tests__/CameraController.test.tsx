import React from 'react';
import { render, act } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import CameraController from '../CameraController';
import useAppStore from '../../../stores/useAppStore';

// Mock the Three.js objects
jest.mock('three', () => {
  const actualThree = jest.requireActual('three');
  return {
    ...actualThree,
    Vector3: jest.fn().mockImplementation(() => ({
      copy: jest.fn().mockReturnThis(),
      add: jest.fn().mockReturnThis(),
      sub: jest.fn().mockReturnThis(),
      normalize: jest.fn().mockReturnThis(),
      multiplyScalar: jest.fn().mockReturnThis(),
      x: 0,
      y: 0,
      z: 0
    })),
    Raycaster: jest.fn().mockImplementation(() => ({
      setFromCamera: jest.fn()
    })),
    Vector2: jest.fn(),
    TOUCH: {
      ROTATE: 0,
      DOLLY_PAN: 1
    }
  };
});

// Mock OrbitControls
jest.mock('@react-three/drei', () => ({
  OrbitControls: jest.fn().mockImplementation(() => null)
}));

// Mock useAppStore
jest.mock('../../../stores/useAppStore');

describe('CameraController', () => {
  const mockSetCameraPosition = jest.fn();
  const mockSetCameraTarget = jest.fn();
  const mockSetCameraZoom = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock store
    (useAppStore as unknown as jest.Mock).mockReturnValue({
      celestialSystem: {
        bodies: [
          { 
            id: 'planet1', 
            name: 'Earth', 
            type: 'planet', 
            radius: 6371000, 
            position: { x: 0, y: 0, z: 0 } 
          }
        ],
        poi: [
          { 
            id: 'poi1', 
            name: 'Space Station', 
            type: 'station', 
            position: { x: 10000, y: 0, z: 0 } 
          }
        ],
        jumpPoints: [
          { 
            id: 'jump1', 
            name: 'Jump Gate', 
            type: 'jumppoint', 
            position: { x: 0, y: 20000, z: 0 } 
          }
        ]
      },
      selectedCelestialBodyId: null,
      selectedPointOfInterestId: null,
      selectedJumpPointId: null,
      cameraPosition: { x: 0, y: 0, z: 100 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      cameraZoom: 1,
      setCameraPosition: mockSetCameraPosition,
      setCameraTarget: mockSetCameraTarget,
      setCameraZoom: mockSetCameraZoom
    });
  });

  test('renders without crashing', () => {
    const { container } = render(
      <Canvas>
        <CameraController />
      </Canvas>
    );
    expect(container).toBeTruthy();
  });

  test('focuses on a celestial body when selected', async () => {
    // Setup with a selected body
    (useAppStore as unknown as jest.Mock).mockReturnValue({
      celestialSystem: {
        bodies: [
          { 
            id: 'planet1', 
            name: 'Earth', 
            type: 'planet', 
            radius: 6371000, 
            position: { x: 0, y: 0, z: 0 } 
          }
        ],
        poi: [],
        jumpPoints: []
      },
      selectedCelestialBodyId: 'planet1',
      selectedPointOfInterestId: null,
      selectedJumpPointId: null,
      cameraPosition: { x: 0, y: 0, z: 100 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      cameraZoom: 1,
      setCameraPosition: mockSetCameraPosition,
      setCameraTarget: mockSetCameraTarget,
      setCameraZoom: mockSetCameraZoom
    });

    render(
      <Canvas>
        <CameraController defaultTransitionDuration={0.1} />
      </Canvas>
    );

    // Wait for the animation to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Verify camera position was updated after animation
    expect(mockSetCameraPosition).toHaveBeenCalled();
    expect(mockSetCameraTarget).toHaveBeenCalled();
    expect(mockSetCameraZoom).toHaveBeenCalled();
  });

  test('focuses on a POI when selected', async () => {
    // Setup with a selected POI
    (useAppStore as unknown as jest.Mock).mockReturnValue({
      celestialSystem: {
        bodies: [],
        poi: [
          { 
            id: 'poi1', 
            name: 'Space Station', 
            type: 'station', 
            position: { x: 10000, y: 0, z: 0 } 
          }
        ],
        jumpPoints: []
      },
      selectedCelestialBodyId: null,
      selectedPointOfInterestId: 'poi1',
      selectedJumpPointId: null,
      cameraPosition: { x: 0, y: 0, z: 100 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      cameraZoom: 1,
      setCameraPosition: mockSetCameraPosition,
      setCameraTarget: mockSetCameraTarget,
      setCameraZoom: mockSetCameraZoom
    });

    render(
      <Canvas>
        <CameraController defaultTransitionDuration={0.1} />
      </Canvas>
    );

    // Wait for the animation to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Verify camera position was updated after animation
    expect(mockSetCameraPosition).toHaveBeenCalled();
    expect(mockSetCameraTarget).toHaveBeenCalled();
    expect(mockSetCameraZoom).toHaveBeenCalled();
  });

  test('applies the correct props to OrbitControls', () => {
    const { OrbitControls } = require('@react-three/drei');
    
    render(
      <Canvas>
        <CameraController
          enablePan={false}
          enableZoom={false}
          enableRotate={false}
          minDistance={10}
          maxDistance={500}
        />
      </Canvas>
    );

    // Check that OrbitControls was called with the correct props
    const lastCall = OrbitControls.mock.calls[OrbitControls.mock.calls.length - 1][0];
    expect(lastCall).toMatchObject({
      enablePan: false,
      enableZoom: false,
      enableRotate: false,
      minDistance: 10,
      maxDistance: 500
    });
  });
}); 