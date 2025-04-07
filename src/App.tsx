import React, { useEffect, useState } from 'react';
import './App.css';
import StarMap from './components/StarMap';
import useAppStore from './stores/useAppStore';
import DataLoader from './services/DataLoaderService';
import InterdictionService from './services/InterdictionService';
import { AuthContainer } from './components/UI/Auth';
import { RouteAlertCreator, RouteAlertViewer } from './components/UI/RouteAlerts';

function App() {
  const { 
    setCelestialSystem, 
    setIsLoading, 
    setError,
    selectedCelestialBodyId,
    isAuthenticated,
    isGuest,
    showAuthPanel,
    showRouteAlertCreator,
    showRouteAlertViewer,
    setShowAuthPanel,
    setShowRouteAlertCreator,
    setShowRouteAlertViewer,
    setAuthState
  } = useAppStore();
  const [isInitialized, setIsInitialized] = useState(false);

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
        
        setIsInitialized(true);
        console.log('App initialization complete');
      } catch (error) {
        console.error('Failed to initialize application:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [setCelestialSystem, setIsLoading, setError]);

  // Handle authentication state changes
  const handleAuthStateChanged = (isAuthenticated: boolean, isGuest: boolean) => {
    console.log('Auth state changed:', { isAuthenticated, isGuest });
    setAuthState(isAuthenticated, isGuest);
    
    // Only hide the auth panel if user successfully authenticated
    if (isAuthenticated) {
      setShowAuthPanel(false);
    }
  };

  // Toggle UI panels
  const toggleAuthPanel = () => {
    console.log('Toggle Auth Panel clicked. Current state:', { showAuthPanel, showRouteAlertCreator, showRouteAlertViewer });
    
    // Toggle auth panel and hide other panels
    setShowAuthPanel(!showAuthPanel);
    if (!showAuthPanel) { // Only hide other panels if we're showing this one
      setShowRouteAlertCreator(false);
      setShowRouteAlertViewer(false);
    }
    console.log('New Auth Panel state should be:', !showAuthPanel);
  };

  const toggleRouteAlertCreator = () => {
    console.log('Toggle Route Alert Creator clicked. Current state:', { isAuthenticated, isGuest, showRouteAlertCreator });
    // Only authenticated non-guest users can create alerts
    if (!isAuthenticated || isGuest) {
      console.log('User not authenticated or is guest, showing auth panel instead');
      setShowAuthPanel(true);
      setShowRouteAlertCreator(false);
      setShowRouteAlertViewer(false);
      return;
    }
    
    // Toggle route alert creator and hide other panels
    setShowRouteAlertCreator(!showRouteAlertCreator);
    if (!showRouteAlertCreator) { // Only hide other panels if we're showing this one
      setShowAuthPanel(false);
      setShowRouteAlertViewer(false);
    }
    console.log('New Route Alert Creator state should be:', !showRouteAlertCreator);
  };

  const toggleRouteAlertViewer = () => {
    console.log('Toggle Route Alert Viewer clicked. Current state:', { showRouteAlertViewer });
    
    // Toggle route alert viewer and hide other panels
    setShowRouteAlertViewer(!showRouteAlertViewer);
    if (!showRouteAlertViewer) { // Only hide other panels if we're showing this one
      setShowAuthPanel(false);
      setShowRouteAlertCreator(false);
    }
    console.log('New Route Alert Viewer state should be:', !showRouteAlertViewer);
  };

  console.log('App rendering with state:', { 
    showAuthPanel, 
    showRouteAlertCreator, 
    showRouteAlertViewer, 
    isAuthenticated, 
    isGuest 
  });

  return (
    <div className="App">
      <header className="App-header">
        <h1>Celestial Viewer</h1>
        <div className="header-controls">
          <button 
            className={`control-button ${showAuthPanel ? 'active' : ''}`} 
            onClick={toggleAuthPanel}
          >
            {isAuthenticated ? 'Profile' : 'Sign In'}
          </button>
          <button 
            className={`control-button ${showRouteAlertCreator ? 'active' : ''}`} 
            onClick={toggleRouteAlertCreator}
          >
            Create Alert
          </button>
          <button 
            className={`control-button ${showRouteAlertViewer ? 'active' : ''}`} 
            onClick={toggleRouteAlertViewer}
          >
            View Alerts
          </button>
        </div>
      </header>
      
      <main className="App-content">
        {/* UI Panels */}
        <div className="ui-panels">
          {showAuthPanel && (
            <div className="ui-panel">
              <AuthContainer onAuthStateChanged={handleAuthStateChanged} />
            </div>
          )}
          
          {showRouteAlertCreator && (
            <div className="ui-panel">
              <RouteAlertCreator />
            </div>
          )}
          
          {showRouteAlertViewer && (
            <div className="ui-panel">
              <RouteAlertViewer celestialBodyId={selectedCelestialBodyId || undefined} />
            </div>
          )}
        </div>
        
        {/* 3D Celestial Map - ensure it takes 100% of available space */}
        <div className="star-map-container">
          <StarMap />
        </div>
      </main>
      
      <footer className="App-footer">
        <p>© 2025 Celestial Viewer - Powered by Viber3D</p>
      </footer>
    </div>
  );
}

export default App;
