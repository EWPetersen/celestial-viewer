import React, { useEffect, useState } from 'react';
import './App.css';
import StarMap from './components/StarMap';
import useAppStore from './stores/useAppStore';
import DataLoader from './services/DataLoaderService';
import InterdictionService from './services/InterdictionService';

function App() {
  const { setCelestialSystem, setIsLoading, setError } = useAppStore();
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
      } catch (error) {
        console.error('Failed to initialize application:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [setCelestialSystem, setIsLoading, setError]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Celestial Viewer</h1>
      </header>
      <main className="App-content">
        {/* 3D Celestial Map */}
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
