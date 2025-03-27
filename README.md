# Celestial Viewer

A high-performance, modular, and scalable 3D celestial visualization web application powered by Viber3D.

## Features

- Interactive 3D star map with realistic celestial body rendering
- Orbit visualization for planets and moons
- Camera controls for navigation and focus
- Jump point visualization
- Points of interest
- Route planning and calculation
- Interdiction zone awareness

## Technology Stack

- React (with TypeScript)
- Three.js for 3D rendering
- React Three Fiber & Drei for React/Three.js integration
- Zustand for state management
- WebGL for broad compatibility

## Project Structure

The application follows a modular architecture with clear separation of concerns:

```
src/
  components/
    StarMap/            # Main 3D visualization component
    EntityViewer/       # Detailed view of selected entities
    OrbitRenderer/      # Visualizes orbital paths
    CameraController/   # Handles camera movement and focus
    RoutePlanner/       # UI for planning routes
  services/
    DataLoaderService/  # Handles loading celestial data
    AuthService/        # Authentication and user management
    RouteCalculationService/ # Route planning algorithms
    InterdictionService/     # Handles danger zones
  stores/               # Zustand-based state management
  utils/
    coordinateUtils.ts  # Coordinate transformations
    distanceUtils.ts    # Distance calculations
    validationUtils.ts  # Data validation
```

## Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm start
```

## Development

The application is set up with a modern React workflow using TypeScript for type safety. The main 3D rendering is done using Three.js via React Three Fiber, which allows for a component-based approach to 3D rendering.

### Configuration

Configuration is managed through environment variables in `.env` files:

- `REACT_APP_API_BASE_URL`: Base URL for API calls (if applicable)
- `REACT_APP_DATA_PATH`: Path to the celestial data JSON file
- `REACT_APP_DEFAULT_SYSTEM`: Default star system to load
- `REACT_APP_VERSION`: Application version
- `REACT_APP_TITLE`: Application title

### Global State Management

State is managed using Zustand, providing a simple and efficient way to handle global state without the boilerplate of Redux.

Key state elements include:
- Celestial system data
- UI state (selected objects, etc.)
- Camera state
- Route planning state

## Deployment

The application can be built for production using:

```bash
npm run build
```

This creates a `build` directory with optimized production-ready files that can be served from any static file server.

## Cross-Platform Support

The application is designed to work on multiple platforms:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Android Chrome)
- Tablet browsers

Responsive design ensures proper functionality across various screen sizes.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Viber3D for the 3D game engine capabilities
- Three.js for the 3D rendering library
- React ecosystem for the UI framework
