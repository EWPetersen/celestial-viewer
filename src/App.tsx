import React, { useEffect, useState, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import StarMap from './components/StarMap';
import useAppStore from './stores/useAppStore';
import DataLoader from './services/DataLoaderService';
import InterdictionService from './services/InterdictionService';
import AuthService from './services/AuthService';
import RouteAlertService from './services/RouteAlertService';
import AlertList from './components/UI/AlertList';
import Header from './components/UI/Header';
import LoginForm from './components/UI/LoginForm';
import RegisterForm from './components/UI/RegisterForm';
import UserProfile from './components/UI/UserProfile';
import CreateAlertForm from './components/UI/CreateAlertForm';
import CreateSmartRouteForm from './components/UI/CreateSmartRouteForm';
import InterdictionCalculatorForm from './components/UI/InterdictionCalculatorForm';
import AlertDetail from './components/UI/AlertDetail';
import CelestialIdMappingService from './services/CelestialIdMappingService';

// AuthContext for managing authentication state across components
export const AuthContext = createContext<{
  user: any | null;
  isAuthenticated: boolean;
  login: (credentials: any) => Promise<any>;
  logout: () => Promise<void>;
  register: (credentials: any) => Promise<any>;
}>({
  user: null,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  logout: async () => {},
  register: async () => ({ success: false })
});

// Route guard component for protected routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = React.useContext(AuthContext);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
};

function App() {
  const { setCelestialSystem, setIsLoading, setError, addRouteVisualization, removeRouteVisualization } = useAppStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeRegion, setActiveRegion] = useState<'us' | 'eu' | null>(null);
  const [activeShard, setActiveShard] = useState<number | null>(null);
  const [alertsUnsubscribe, setAlertsUnsubscribe] = useState<(() => void) | null>(null);

  // Authentication functions for context
  const login = async (credentials: any) => {
    const result = await AuthService.login(credentials);
    if (result.success) {
      setUser(result.user);
      setIsAuthenticated(true);
    }
    return result;
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const register = async (credentials: any) => {
    const result = await AuthService.register(credentials);
    if (result.success) {
      setUser(result.user);
      setIsAuthenticated(true);
    }
    return result;
  };

  // Set up auth state listener
  useEffect(() => {
    const unsubscribe = AuthService.addAuthStateListener((user) => {
      setUser(user);
      setIsAuthenticated(!!user);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Load celestial data on component mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        
        // Load celestial data
        const systemData = await DataLoader.loadCelestialSystem();
        
        // Set the celestial system in the global store
        setCelestialSystem(systemData);
        
        // Initialize interdiction zones
        const interdictionZones = InterdictionService.generateSampleInterdictionZones(systemData.systemName);
        InterdictionService.addInterdictionZones(interdictionZones);
        
        // Initialize celestial ID mapping
        CelestialIdMappingService.initialize(systemData);
        
        // Log mapping information for debugging
        setTimeout(() => {
          console.log('[App] Dumping celestial ID mappings for debugging:');
          CelestialIdMappingService.logMappings();
        }, 1000); // Delay to ensure all mappings are loaded
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize application:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [setCelestialSystem, setIsLoading, setError]);

  // Subscribe to route alerts when region/shard filter changes
  useEffect(() => {
    if (!isInitialized) return;
    
    // Clean up previous subscription if it exists
    if (alertsUnsubscribe) {
      alertsUnsubscribe();
      setAlertsUnsubscribe(null);
    }
    
    // Create filter object based on selected region and shard
    const filterOptions: any = {};
    if (activeRegion) filterOptions.region = activeRegion;
    if (activeShard) filterOptions.shard = activeShard;
    
    // Subscribe to route visualizations with the filter
    const unsubscribe = RouteAlertService.subscribeToRouteVisualizations((visualizations) => {
      // Remove all existing route visualizations
      removeRouteVisualization();
      
      // Add new visualizations
      visualizations.forEach(visualization => {
        addRouteVisualization(visualization);
      });
    }, filterOptions);
    
    setAlertsUnsubscribe(unsubscribe);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isInitialized, activeRegion, activeShard, addRouteVisualization, removeRouteVisualization]);

  // Update region and shard filters
  const handleRegionChange = (region: 'us' | 'eu' | null) => {
    setActiveRegion(region);
  };

  const handleShardChange = (shard: number | null) => {
    setActiveShard(shard);
  };

  // Add a debugging hook to periodically dump celestial ID mappings
  useEffect(() => {
    // Only dump mappings if the system is initialized
    if (!isInitialized) return;
    
    // Log mappings once initially for debugging
    console.log('[App] Dumping celestial ID mappings for debugging:');
    CelestialIdMappingService.logMappings();
    
    // Set up a periodic dump every 60 seconds to help debug mapping issues
    const intervalId = setInterval(() => {
      console.log('[App] Dumping celestial ID mappings for debugging:');
      CelestialIdMappingService.logMappings();
    }, 60000); // 60 seconds
    
    return () => clearInterval(intervalId);
  }, [isInitialized]);

  // If the system is still loading, show a loading indicator
  if (!isInitialized) {
    return (
      <div className="app-container loading">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading Celestial Data...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, register }}>
      <Router>
        <div className="App">
          <Header 
            onRegionChange={handleRegionChange}
            onShardChange={handleShardChange}
            activeRegion={activeRegion}
            activeShard={activeShard}
          />
          
          <div className="App-content">
            <Routes>
              <Route path="/" element={
                <div className="main-content">
                  <div className="star-map-container">
                    <StarMap />
                  </div>
                  <div className="alerts-sidebar">
                    <AlertList 
                      activeRegion={activeRegion}
                      activeShard={activeShard}
                    />
                  </div>
                </div>
              } />
              
              <Route path="/login" element={<LoginForm />} />
              <Route path="/register" element={<RegisterForm />} />
              
              <Route path="/profile" element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              } />
              
              <Route path="/create-alert" element={
                <ProtectedRoute>
                  <CreateAlertForm />
                </ProtectedRoute>
              } />
              
              <Route path="/create-route" element={
                <ProtectedRoute>
                  <CreateSmartRouteForm />
                </ProtectedRoute>
              } />
              
              <Route path="/interdiction-calculator" element={
                <ProtectedRoute>
                  <InterdictionCalculatorForm />
                </ProtectedRoute>
              } />
              
              <Route path="/alert/:id" element={<AlertDetail />} />
              
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
          
          <footer className="App-footer">
            <p>© 2025 Celestial Viewer - Powered by Viber3D</p>
          </footer>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
