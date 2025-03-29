# Enhanced CameraController

A sophisticated camera control system that provides intuitive, smooth zoom transitions and entity focusing capabilities suitable for large-scale spatial navigation.

## Features

- **Smooth Transitions**: Uses spring physics for natural, smooth camera movements
- **Scale-Aware Navigation**: Intelligently adjusts to different entity scales:
  - System view (~100 Gm)
  - Star view (~10 Gm)
  - Planet view (~1 Gm)
  - Moon view (~10 Mm)
  - Station view (~1 Km)
- **Mobile Support**: 
  - Pinch zoom
  - Pan
  - Rotation gestures
  - Double-tap to focus (requires raycasting implementation)
- **Performance Optimization**: Automatically adjusts detail level for smooth performance

## Usage

```tsx
import { CameraController } from './components/CameraController';

function MyScene() {
  return (
    <>
      {/* Scene elements */}
      
      {/* Camera Controller */}
      <CameraController 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        defaultTransitionDuration={1.2}
        enableTouchSupport={true}
        minDistance={1}
        maxDistance={1000}
      />
    </>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enablePan` | boolean | `true` | Enable camera panning |
| `enableZoom` | boolean | `true` | Enable camera zooming |
| `enableRotate` | boolean | `true` | Enable camera rotation |
| `autoRotate` | boolean | `false` | Enable automatic camera rotation |
| `autoRotateSpeed` | number | `1` | Speed of auto-rotation |
| `minDistance` | number | `1` | Minimum zoom distance |
| `maxDistance` | number | `1000` | Maximum zoom distance |
| `defaultTransitionDuration` | number | `1.2` | Duration of focus animations in seconds |
| `enableTouchSupport` | boolean | `true` | Enable touch gestures for mobile |

## Integration with App Store

The component integrates with the app store to handle entity selection:

- When a celestial body is selected, the camera smoothly transitions to focus on it
- When a point of interest is selected, the camera quickly transitions to it
- When a jump point is selected, the camera focuses on it

## Customization

You can adjust the easing functions in the component to change the feel of transitions:

- `easeOutCubic`: Smooth acceleration/deceleration
- `easeOutElastic`: Slight bounce at the end of movement
- `spring`: Natural spring physics with subtle oscillation

## Scale Constants

The component uses predefined constants for different entity scales to ensure proper zooming:

```ts
const SCALE_CONSTANTS = {
  SYSTEM: 100_000_000_000, // 100 Gm for system view
  STAR: 10_000_000_000,    // 10 Gm for star view
  PLANET: 1_000_000_000,   // 1 Gm for planet view
  MOON: 10_000_000,        // 10 Mm for moon view
  STATION: 1_000,          // 1 Km for station view
  MINIMUM: 10,             // 10m minimum distance
};
``` 