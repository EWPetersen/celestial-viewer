import React, { useState, useEffect } from 'react';
import useAppStore, { CelestialBody, JumpPoint, PointOfInterest } from '../../stores/useAppStore';
import { EntityType } from '../EntityVisuals';
import * as THREE from 'three'; // Import THREE for Vector3 type

// Props definition for SceneControls
interface SceneControlsProps {
  onFilterChange: (hiddenTypes: Set<EntityType>) => void;
  // Add props for camera control
  onFocusEntity: (entityId: string) => void;
  onResetView: () => void;
  // Add props for camera info
  cameraPosition?: THREE.Vector3;
  cameraTarget?: THREE.Vector3;
}

// TODO: Implement camera focus logic in StarMap component
// import { focusCameraOnEntity } from '../StarMap/cameraUtils'; // Assuming camera logic utility exists

const SceneControls: React.FC<SceneControlsProps> = ({ 
  onFilterChange, 
  onFocusEntity, // Destructure new props
  onResetView,    // Destructure new props
  cameraPosition, // Destructure camera props
  cameraTarget    // Destructure camera props
}) => {
  const { celestialSystem, selectedCelestialBodyId, selectCelestialBody } = useAppStore();
  const [hiddenTypes, setHiddenTypes] = useState<Set<EntityType>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

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

  // --- Event Handlers ---

  const handleEntitySelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const entityId = event.target.value;
    if (entityId) {
      // Use the prop callback for focusing
      onFocusEntity(entityId);
      // console.log(`Focus requested on entity: ${entityId}`);
    }
  };

  const handleToggleEntityType = (type: EntityType) => {
    setHiddenTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      // No longer need to call console.log here, handled by useEffect -> onFilterChange
      // console.log("Hidden types:", Array.from(newSet));
      return newSet;
    });
  };

  const handleResetViewInternal = () => {
    selectCelestialBody(null); // Deselect any entity
    // Use the prop callback for resetting view
    onResetView();
    // console.log("Reset view requested");
  };
  
  const handleResetFilters = () => {
      setHiddenTypes(new Set());
      // useEffect will call onFilterChange with the empty set
      // console.log("Filters reset");
  };

  // --- Styles --- (Inline for simplicity, consider CSS modules or styled-components)
  const controlPanelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#eee',
    padding: '15px',
    borderRadius: '8px',
    fontFamily: 'sans-serif',
    fontSize: '14px',
    zIndex: 100, // Ensure it's above the canvas
    maxWidth: '250px',
    maxHeight: '80vh',
    overflowY: 'auto',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    marginBottom: '10px',
    backgroundColor: '#333',
    color: '#eee',
    border: '1px solid #555',
    borderRadius: '4px',
  };

  const inputStyle: React.CSSProperties = {
    width: 'calc(100% - 16px)', // Account for padding
    padding: '8px',
    marginBottom: '10px',
    backgroundColor: '#333',
    color: '#eee',
    border: '1px solid #555',
    borderRadius: '4px',
  };
  
  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    margin: '5px',
    backgroundColor: '#444',
    color: '#eee',
    border: '1px solid #666',
    borderRadius: '4px',
    cursor: 'pointer',
  };
  
  const filterButtonStyle = (isHidden: boolean): React.CSSProperties => ({
      ...buttonStyle,
      backgroundColor: isHidden ? '#633' : '#363',
      textDecoration: isHidden ? 'line-through' : 'none',
  });

  const headingStyle: React.CSSProperties = {
    marginTop: '0',
    marginBottom: '10px',
    borderBottom: '1px solid #555',
    paddingBottom: '5px',
  };

  const sectionStyle: React.CSSProperties = {
      marginBottom: '15px',
  };

  const infoTextStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#aaa',
    margin: '2px 0',
    fontFamily: 'monospace' // Use monospace for alignment
  };

  // --- Render --- 
  
  const entityTypes: EntityType[] = [
    'star', 'planet', 'moon', 'station', 'commarray', 
    'landingzone', 'lagrangepoint', 'jumppoint', 'reststop', 'outpost'
  ];

  return (
    <div style={controlPanelStyle}>
      <h4 style={headingStyle}>Scene Controls</h4>
      
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
          value={selectedCelestialBodyId || ''}
          onChange={handleEntitySelect}
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
              style={filterButtonStyle(hiddenTypes.has(type))}
              onClick={() => handleToggleEntityType(type)}
              title={`Toggle ${type}`}
            >
              {type}
            </button>
          ))}
        </div>
        <button 
            style={{...buttonStyle, backgroundColor: '#663'}}
            onClick={handleResetFilters}
          >
            Reset Filters
        </button>
      </div>

      {/* View Reset Section */}
      <div style={sectionStyle}>
        <button 
          style={{...buttonStyle, width: 'calc(100% - 10px)'}}
          onClick={handleResetViewInternal} // Use internal handler that calls prop
        >
          Reset View
        </button>
      </div>
      
      {/* Camera Info Section */}
      <div style={sectionStyle}>
          <h5 style={{...headingStyle, fontSize: '14px', marginBottom: '5px'}}>Camera Info</h5>
          <p style={infoTextStyle}> 
            Position: 
            {cameraPosition ? 
              `X: ${cameraPosition.x.toFixed(2)}, Y: ${cameraPosition.y.toFixed(2)}, Z: ${cameraPosition.z.toFixed(2)}` : 
              'N/A'}
          </p>
          {/* Optionally display target/lookAt */}
          <p style={infoTextStyle}>
              Target: 
              {cameraTarget ? 
              `X: ${cameraTarget.x.toFixed(2)}, Y: ${cameraTarget.y.toFixed(2)}, Z: ${cameraTarget.z.toFixed(2)}` : 
              'N/A'}
          </p>
      </div>
      
    </div>
  );
};

export default SceneControls; 