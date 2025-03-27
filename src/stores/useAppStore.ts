import { create } from 'zustand';
import { Vector3 } from '../utils/coordinateUtils';

// Define types for our celestial data
export interface CelestialSystem {
  systemName: string;
  description: string;
  starType: string;
  coordinates: Vector3;
  celestialBodies: CelestialBody[];
  jumpPoints: JumpPoint[];
  pointsOfInterest: PointOfInterest[];
}

export interface CelestialBody {
  id: string;
  name: string;
  type: string;
  classification?: string;
  parent?: string;
  radius: number;
  mass?: number;
  temperature?: number;
  position: Vector3;
  orbit?: Orbit;
  rotation?: number;
  atmosphere?: boolean;
  hasRings?: boolean;
  moons?: Moon[];
}

export interface Moon {
  id: string;
  name: string;
  radius: number;
  orbit: {
    semiMajorAxis: number;
    period: number;
  };
}

export interface Orbit {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  period: number;
}

export interface JumpPoint {
  id: string;
  name: string;
  destinationSystem: string;
  position: Vector3;
  size: string;
}

export interface PointOfInterest {
  id: string;
  name: string;
  type: string;
  parent: string;
  position: Vector3;
}

export interface Route {
  id: string;
  name: string;
  waypoints: RouteWaypoint[];
  distance: number;
  estimatedTravelTime: number;
  fuelRequired?: number;
  riskLevel?: string;
}

export interface RouteWaypoint {
  id: string;
  name: string;
  position: Vector3;
  type: 'celestial' | 'jump' | 'poi' | 'custom';
  referencedObjectId?: string;
}

// Define the app state
export interface AppState {
  // System data
  celestialSystem: CelestialSystem | null;
  isLoading: boolean;
  error: string | null;
  
  // UI state
  selectedCelestialBodyId: string | null;
  selectedPointOfInterestId: string | null;
  selectedJumpPointId: string | null;
  selectedRouteId: string | null;
  
  // Camera state
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  cameraZoom: number;
  
  // Route planning
  routes: Route[];
  currentRoute: Route | null;
  
  // Time controls
  simulationTime: number;
  timeMultiplier: number;
  
  // Functions
  setCelestialSystem: (system: CelestialSystem) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  selectCelestialBody: (id: string | null) => void;
  selectPointOfInterest: (id: string | null) => void;
  selectJumpPoint: (id: string | null) => void;
  selectRoute: (id: string | null) => void;
  
  setCameraPosition: (position: Vector3) => void;
  setCameraTarget: (target: Vector3) => void;
  setCameraZoom: (zoom: number) => void;
  
  addRoute: (route: Route) => void;
  updateRoute: (route: Route) => void;
  deleteRoute: (id: string) => void;
  setCurrentRoute: (route: Route | null) => void;
  
  setSimulationTime: (time: number) => void;
  setTimeMultiplier: (multiplier: number) => void;
}

// Create the store
const useAppStore = create<AppState>((set) => ({
  // Initial state
  celestialSystem: null,
  isLoading: false,
  error: null,
  
  selectedCelestialBodyId: null,
  selectedPointOfInterestId: null,
  selectedJumpPointId: null,
  selectedRouteId: null,
  
  cameraPosition: { x: 0, y: 0, z: 100 },
  cameraTarget: { x: 0, y: 0, z: 0 },
  cameraZoom: 1,
  
  routes: [],
  currentRoute: null,
  
  simulationTime: Date.now(),
  timeMultiplier: 1,
  
  // Functions
  setCelestialSystem: (system) => set({ celestialSystem: system }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  selectCelestialBody: (id) => set({ 
    selectedCelestialBodyId: id,
    // Deselect other selections when selecting a celestial body
    selectedPointOfInterestId: null,
    selectedJumpPointId: null
  }),
  
  selectPointOfInterest: (id) => set({ 
    selectedPointOfInterestId: id,
    // Deselect other selections when selecting a POI
    selectedCelestialBodyId: null,
    selectedJumpPointId: null
  }),
  
  selectJumpPoint: (id) => set({ 
    selectedJumpPointId: id,
    // Deselect other selections when selecting a jump point
    selectedCelestialBodyId: null,
    selectedPointOfInterestId: null
  }),
  
  selectRoute: (id) => set({ selectedRouteId: id }),
  
  setCameraPosition: (position) => set({ cameraPosition: position }),
  setCameraTarget: (target) => set({ cameraTarget: target }),
  setCameraZoom: (zoom) => set({ cameraZoom: zoom }),
  
  addRoute: (route) => set((state) => ({ 
    routes: [...state.routes, route] 
  })),
  
  updateRoute: (route) => set((state) => ({ 
    routes: state.routes.map(r => r.id === route.id ? route : r),
    currentRoute: state.currentRoute?.id === route.id ? route : state.currentRoute
  })),
  
  deleteRoute: (id) => set((state) => ({ 
    routes: state.routes.filter(r => r.id !== id),
    currentRoute: state.currentRoute?.id === id ? null : state.currentRoute,
    selectedRouteId: state.selectedRouteId === id ? null : state.selectedRouteId
  })),
  
  setCurrentRoute: (route) => set({ currentRoute: route }),
  
  setSimulationTime: (time) => set({ simulationTime: time }),
  setTimeMultiplier: (multiplier) => set({ timeMultiplier: multiplier })
}));

export default useAppStore; 