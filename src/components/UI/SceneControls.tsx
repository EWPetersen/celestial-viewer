import React, { useState, useEffect, useCallback } from 'react';
import useAppStore, { CelestialBody, JumpPoint, PointOfInterest } from '../../stores/useAppStore';
import { EntityType } from '../EntityVisuals';
import * as THREE from 'three'; // Import THREE for Vector3 type

// Define the props for SceneControls
interface SceneControlsProps {
  onFilterChange: (hiddenTypes: Set<EntityType>) => void;
  onResetView: () => void;
  onFocusEntity: (entityId: string) => void;
  onToggleLabels: () => void;
  onToggleOrbits: () => void;
  onLabelDistanceChange: (scale: number) => void;
  labelsVisible: boolean;
  orbitsVisible: boolean;
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
}

// TODO: Implement camera focus logic in StarMap component
// import { focusCameraOnEntity } from '../StarMap/cameraUtils'; // Assuming camera logic utility exists

const SceneControls: React.FC<SceneControlsProps> = ({ 
  onFilterChange, 
  onFocusEntity,
  onResetView,
  onToggleLabels,
  onToggleOrbits,
  onLabelDistanceChange,
  labelsVisible,
  orbitsVisible,
  cameraPosition,
  cameraTarget
}) => {
  const { celestialSystem, selectedCelestialBodyId, selectCelestialBody, selectedPointOfInterestId, selectPointOfInterest, selectedJumpPointId, selectJumpPoint } = useAppStore();
  const [hiddenTypes, setHiddenTypes] = useState<Set<EntityType>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [labelDistance, setLabelDistance] = useState(1.0);

  // Define all callbacks at the top level
  const handleFocusEntity = useCallback((entityId: string) => {
    if (!entityId) return; // Skip empty selections
    
    // Determine the entity type and select the appropriate one
    if (celestialSystem) {
      const entity = celestialSystem.celestialBodies.find(e => e.id === entityId) ||
                    celestialSystem.jumpPoints.find(e => e.id === entityId) ||
                    celestialSystem.pointsOfInterest.find(e => e.id === entityId);
      
      if (entity) {
        if ('type' in entity && entity.type === 'jumppoint') {
          // It's a jump point
          selectJumpPoint(entityId);
        } else if ('type' in entity && ['station', 'outpost', 'reststop', 'lagrangepoint', 'landingzone', 'commarray'].includes(entity.type as string)) {
          // It's a point of interest
          selectPointOfInterest(entityId);
        } else {
          // Default to celestial body
          selectCelestialBody(entityId);
        }
      }
    }
    
    if (onFocusEntity) {
      onFocusEntity(entityId);
    }
  }, [onFocusEntity, celestialSystem, selectJumpPoint, selectPointOfInterest, selectCelestialBody]);

  const handleFilterChange = useCallback((type: EntityType) => {
    setHiddenTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      
      if (onFilterChange) {
        onFilterChange(newSet);
      }
      
      return newSet;
    });
  }, [onFilterChange]);

  const handleResetView = useCallback(() => {
    if (onResetView) {
      onResetView();
    }
  }, [onResetView]);

  const handleResetFilters = useCallback(() => {
    setHiddenTypes(new Set<EntityType>());
    
    if (onFilterChange) {
      onFilterChange(new Set<EntityType>());
    }
  }, [onFilterChange]);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const handleLabelDistanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setLabelDistance(value);
    onLabelDistanceChange(value);
  }, [onLabelDistanceChange]);

  // Call onFilterChange whenever hiddenTypes changes
  useEffect(() => {
    onFilterChange(hiddenTypes);
  }, [hiddenTypes, onFilterChange]);

  if (!celestialSystem) {
    return null; // Don't render controls if no system data
  }

  // Combine all entities for the dropdown
  const allEntities = [
    ...celestialSystem.celestialBodies,
    ...celestialSystem.jumpPoints,
    ...celestialSystem.pointsOfInterest,
    // Add moons if they are rendered separately and selectable
    ...celestialSystem.celestialBodies.flatMap(body => body.moons || []),
  ];

  // Filter entities based on search term
  const filteredEntities = allEntities.filter(entity => 
    entity.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Styles --- (Inline for simplicity, consider CSS modules or styled-components)
  const controlPanelStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '20px', 
    right: '20px', 
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    color: '#ccc',
    padding: isCollapsed ? '8px' : '10px', // Less padding when collapsed
    borderRadius: '6px', 
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif'",
    fontSize: '12px', 
    zIndex: 100, 
    maxWidth: '220px', 
    maxHeight: isCollapsed ? '40px' : 'calc(100vh - 40px)', // Limited height when collapsed
    overflow: isCollapsed ? 'hidden' : 'auto', // Hide overflow when collapsed
    backdropFilter: 'blur(5px)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)', 
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'max-height 0.3s ease, padding 0.3s ease', // Animate collapse/expand
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px', // Reduced padding
    marginBottom: '8px', // Reduced margin
    backgroundColor: 'rgba(50, 50, 50, 0.9)', // Slightly different input background
    color: '#eee',
    border: '1px solid #444', // Darker border
    borderRadius: '4px',
    fontSize: '12px', // Match panel font size
  };

  const inputStyle: React.CSSProperties = {
    width: 'calc(100% - 12px)', // Account for reduced padding
    padding: '6px',
    marginBottom: '8px',
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    color: '#eee',
    border: '1px solid #444',
    borderRadius: '4px',
    fontSize: '12px',
  };
  
  const buttonStyle: React.CSSProperties = {
    padding: '5px 8px', // Reduced padding
    margin: '3px', // Reduced margin
    backgroundColor: '#555', // Slightly darker button
    color: '#ddd', // Slightly lighter button text
    border: '1px solid #777',
    borderRadius: '3px', // Smaller radius
    cursor: 'pointer',
    fontSize: '11px', // Smaller font for buttons
    transition: 'background-color 0.2s ease', // Add transition
  };
  
  const filterButtonStyle = (isActive: boolean): React.CSSProperties => ({
      ...buttonStyle,
      backgroundColor: isActive ? '#484' : '#844', // Adjusted active/inactive colors
      textDecoration: 'none', // Remove line-through for simplicity
      border: isActive ? '1px solid #6a6' : '1px solid #a66',
  });

  const headingStyle: React.CSSProperties = {
    marginTop: '0',
    marginBottom: isCollapsed ? '0' : '8px', // No margin below heading when collapsed
    borderBottom: isCollapsed ? 'none' : '1px solid #555', // No border when collapsed
    paddingBottom: isCollapsed ? '0' : '4px', 
    fontSize: '14px', 
    fontWeight: '600', 
    display: 'flex', // Use flexbox for alignment
    justifyContent: 'space-between', // Space out title and button
    alignItems: 'center', // Align items vertically
    cursor: 'pointer', // Indicate clickable header
  };

  const sectionStyle: React.CSSProperties = {
      marginBottom: '10px', // Reduced margin
      paddingBottom: '5px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)', // Subtle separator
  };

  const infoTextStyle: React.CSSProperties = {
    fontSize: '11px', // Smaller info text
    color: '#999', // Lighter grey
    margin: '2px 0',
    fontFamily: "'Consolas', 'Monaco', 'Lucida Console', 'Courier New', monospace'", // Monospace font
  };

  const collapseButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#aaa',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0 5px',
  };

  // --- Render --- 
  
  const entityTypes: EntityType[] = [
    'star', 'planet', 'moon', 'station', 'commarray', 
    'landingzone', 'lagrangepoint', 'jumppoint', 'reststop', 'outpost'
  ];

  return (
    <div style={controlPanelStyle}>
      <h4 style={headingStyle} onClick={handleToggleCollapse} title={isCollapsed ? 'Expand' : 'Collapse'}>
        Scene Controls
        <button style={collapseButtonStyle} onClick={(e) => { e.stopPropagation(); handleToggleCollapse(); }}>
          {isCollapsed ? '+' : '−'} {/* Change icon based on state */}
        </button>
      </h4>
      
      {/* Conditionally render the content */}
      {!isCollapsed && (
        <>
          {/* Focus Entity Section */}
          <div style={sectionStyle}>
            <label htmlFor="entity-select">Focus Entity:</label>
            <input
              type="text"
              placeholder="Search entities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={inputStyle}
            />
            <select 
              id="entity-select" 
              style={selectStyle}
              value={selectedCelestialBodyId || selectedPointOfInterestId || selectedJumpPointId || ''}
              onChange={(e) => handleFocusEntity(e.target.value)}
            >
              <option value="">-- Select Entity --</option>
              {filteredEntities
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(entity => {
                  // Determine the display type string safely
                  let displayType = 'unknown';
                  if ('type' in entity && typeof entity.type === 'string') {
                      displayType = entity.type;
                  } else if ('destinationSystem' in entity) { // Identify JumpPoints
                      displayType = 'jumppoint';
                  } else if ('radius' in entity && !('parent' in entity)) { // Identify Planets/Stars
                       // This check might need refinement based on your exact types
                       // Assuming CelestialBody has 'type'
                       displayType = (entity as CelestialBody).type || 'celestial body'; 
                  } else if ('radius' in entity) { // Identify Moons
                      displayType = 'moon'; // Explicitly set type for moons if not directly present
                  }
                  
                  return (
                    <option key={entity.id} value={entity.id}>
                      {entity.name} ({displayType})
                    </option>
                  );
              })}
            </select>
          </div>

          {/* Filter Entity Types Section */}
          <div style={sectionStyle}>
            <label>Toggle Visibility:</label>
            <div>
              {entityTypes.map(type => (
                <button 
                  key={type}
                  style={filterButtonStyle(!hiddenTypes.has(type))}
                  onClick={() => handleFilterChange(type)}
                  title={`Toggle ${type}`}
                >
                  {type}
                </button>
              ))}
              {/* Add Labels toggle button */}
              <button 
                style={filterButtonStyle(labelsVisible)}
                onClick={onToggleLabels}
                title="Toggle labels visibility"
              >
                labels
              </button>
              {/* Add Orbits toggle button */}
              <button 
                style={filterButtonStyle(orbitsVisible)}
                onClick={onToggleOrbits}
                title="Toggle orbit paths visibility"
              >
                orbits
              </button>
            </div>
            <button 
                style={{...buttonStyle, backgroundColor: '#663', width: 'calc(100% - 6px)' }}
                onClick={handleResetFilters}
              >
                Reset Filters
            </button>
          </div>

          {/* View Reset Section */}
          <div style={sectionStyle}>
            <button 
              style={{...buttonStyle, width: 'calc(100% - 6px)'}}
              onClick={handleResetView}
            >
              Reset View
            </button>
          </div>
        
          {/* Camera Info Section */}
          <div style={sectionStyle}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Camera Info:</label>
              <div style={infoTextStyle}>
                  <span>
                      Position: {cameraPosition ? `X:${cameraPosition.x.toFixed(6)}, Y:${cameraPosition.y.toFixed(6)}, Z:${cameraPosition.z.toFixed(6)}` : 'N/A'}
                  </span>
                  <span style={{ display: 'block' }}>
                      Target:   {cameraTarget ? `X:${cameraTarget.x.toFixed(6)}, Y:${cameraTarget.y.toFixed(6)}, Z:${cameraTarget.z.toFixed(6)}` : 'N/A'}
                  </span>
              </div>
          </div>

          {/* Toggles Section */}
          <h4 style={{color: '#ffffff', margin: '5px 0'}}>Display Options</h4>
          <div style={{marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '5px'}}>
            <label style={{color: '#ffffff', display: 'flex', alignItems: 'center'}}>
              <input 
                type="checkbox" 
                checked={labelsVisible} 
                onChange={onToggleLabels}
                style={{marginRight: '5px'}}
              />
              Show Labels
            </label>
            <label style={{color: '#ffffff', display: 'flex', alignItems: 'center'}}>
              <input 
                type="checkbox" 
                checked={orbitsVisible} 
                onChange={onToggleOrbits}
                style={{marginRight: '5px'}}
              />
              Show Orbits
            </label>
          </div>
          
          {/* Label Distance Control */}
          <div style={{marginBottom: '10px'}}>
            <label style={{color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '5px'}}>
              Label Distance: {labelDistance.toFixed(1)}x
              <input 
                type="range" 
                min="0.5" 
                max="5.0" 
                step="0.1" 
                value={labelDistance} 
                onChange={handleLabelDistanceChange}
                style={{width: '100%'}}
              />
            </label>
          </div>
          
          {/* Entity Selector */}
          <h4 style={{color: '#ffffff', margin: '5px 0'}}>Focus on Entity</h4>
        </>
      )}
      
    </div>
  );
};

export default SceneControls;