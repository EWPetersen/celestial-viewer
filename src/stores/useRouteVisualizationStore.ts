import { create } from 'zustand';

interface RouteVisualizationStore {
  visualization: any | null;
  addRouteVisualization: (visualization: any) => void;
  removeRouteVisualization: () => void;
}

const useRouteVisualizationStore = create<RouteVisualizationStore>((set) => ({
  visualization: null,
  
  addRouteVisualization: (visualization: any) => {
    set({ visualization });
  },
  
  removeRouteVisualization: () => {
    set({ visualization: null });
  }
}));

export default useRouteVisualizationStore; 