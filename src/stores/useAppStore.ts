import { create } from 'zustand';
import { Vector3 } from '../utils/coordinateUtils';
import { RouteVisualization } from '../models/RouteVisualization';
import RouteAlertService from '../services/RouteAlertService';
import CelestialIdMappingService from '../services/CelestialIdMappingService';
import { Region } from '../models/RouteAlert';

// Define types for our celestial data
export interface CelestialSystem {
  systemName: string;
  description: string;
  starType: string;
  rootId: string;
  coordinates: Vector3;
  celestialBodies: CelestialBody[];
  jumpPoints: JumpPoint[];
  pointsOfInterest: PointOfInterest[];
}

export interface CelestialBody {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  classification?: string;
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
  type: 'jumppoint';
  parentId: string | null;
  position: Vector3;
  destinationSystem: string;
  size: number;
}

export interface PointOfInterest {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  position: Vector3;
  size: number;
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
  showOrbits: boolean;
  
  // Camera state
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  cameraZoom: number;
  
  // Route planning
  routes: Route[];
  currentRoute: Route | null;
  
  // Route visualizations
  routeVisualizations: RouteVisualization[];
  unsubscribeRoutesVisualization?: () => void;
  
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
  
  // New methods for route visualizations
  addRouteVisualization: (visualization: RouteVisualization) => void;
  updateRouteVisualization: (visualization: RouteVisualization) => void;
  removeRouteVisualization: (id?: string) => void;
  
  setSimulationTime: (time: number) => void;
  setTimeMultiplier: (multiplier: number) => void;
  
  setShowOrbits: (show: boolean) => void;
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
  showOrbits: true,
  
  cameraPosition: { x: 0, y: 0, z: 100 },
  cameraTarget: { x: 0, y: 0, z: 0 },
  cameraZoom: 1,
  
  routes: [],
  currentRoute: null,
  
  // Initialize route visualizations
  routeVisualizations: [],
  
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
  
  // New methods for route visualizations
  addRouteVisualization: (visualization) => set((state) => ({
    routeVisualizations: [...state.routeVisualizations, visualization]
  })),
  
  updateRouteVisualization: (visualization) => set((state) => ({
    routeVisualizations: state.routeVisualizations.map(v => 
      v.id === visualization.id ? visualization : v
    )
  })),
  
  removeRouteVisualization: (id) => set((state) => ({
    routeVisualizations: id 
      ? state.routeVisualizations.filter(v => v.id !== id)
      : [] // If no ID is provided, clear all visualizations
  })),
  
  setSimulationTime: (time) => set({ simulationTime: time }),
  setTimeMultiplier: (multiplier) => set({ timeMultiplier: multiplier }),
  
  setShowOrbits: (show) => set({ showOrbits: show })
}));

// Initialize visualization subscription after store is ready
const initVisualizationSubscription = () => {
  // Return if the store isn't initialized yet
  const store = useAppStore.getState();
  if (!store) return;
  
  console.log('[useAppStore] Initializing route visualization subscription');
  
  // Subscribe to route alerts for visualization
  const unsubscribe = RouteAlertService.subscribeToRouteVisualizations(
    (visualizations) => {
      // Filter out invalid visualizations (missing origin or destination IDs)
      const validVisualizations = visualizations.filter(viz => viz.originId && viz.destinationId);
      
      // Log skipped visualizations once
      if (validVisualizations.length < visualizations.length) {
        console.info(`[useAppStore] Filtered out ${visualizations.length - validVisualizations.length} invalid route visualizations with missing origin/destination IDs`);
      }
      
      console.log(`[useAppStore] Received ${visualizations.length} route visualizations (${validVisualizations.length} valid)`);
      
      // Store valid visualizations in state - using original IDs without any transformation
      useAppStore.setState((state) => ({
        ...state,
        routeVisualizations: validVisualizations
      }));
    }
    // Don't pass any filters to show all alerts regardless of region/shard
  );
  
  // Store the unsubscribe function for cleanup
  useAppStore.setState((state) => ({
    ...state,
    unsubscribeRoutesVisualization: unsubscribe
  }));
  
  return unsubscribe;
};

// Initialize the subscription when importing the store
initVisualizationSubscription();

export default useAppStore;