import React, { useState } from 'react';
import useAppStore from '../../../stores/useAppStore';
import RouteAlertService from '../../../services/RouteAlertService';
import AuthService from '../../../services/AuthService';
import { Region, Shard, DistanceUnit, RouteAlertCreationData } from '../../../models/RouteAlert';
import './RouteAlertStyles.css';

const RouteAlertCreator: React.FC = () => {
  const { celestialSystem, selectedCelestialBodyId, selectCelestialBody } = useAppStore();
  
  const [region, setRegion] = useState<Region>('us');
  const [shard, setShard] = useState<Shard>('010');
  const [originCelestialBodyId, setOriginCelestialBodyId] = useState<string>('');
  const [destinationCelestialBodyId, setDestinationCelestialBodyId] = useState<string>('');
  const [distance, setDistance] = useState<string>('');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Generate region options
  const regionOptions: Region[] = ['us', 'eu'];
  
  // Generate shard options
  const shardOptions: Shard[] = [
    '010', '020', '030', '040', '050', '060', '070', '080', '090', '100',
    '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'
  ];
  
  // Distance unit options
  const distanceUnitOptions: DistanceUnit[] = ['km', 'Mm', 'Gm'];
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    switch (name) {
      case 'region':
        setRegion(value as Region);
        break;
      case 'shard':
        setShard(value as Shard);
        break;
      case 'originCelestialBodyId':
        setOriginCelestialBodyId(value);
        // Update the selected celestial body in the app store
        selectCelestialBody(value);
        break;
      case 'destinationCelestialBodyId':
        setDestinationCelestialBodyId(value);
        // Update the selected celestial body in the app store
        selectCelestialBody(value);
        break;
      case 'distance':
        // Only allow numeric input for distance
        if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
          setDistance(value);
        }
        break;
      case 'distanceUnit':
        setDistanceUnit(value as DistanceUnit);
        break;
      default:
        break;
    }
  };
  
  // Create a route alert
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error and success messages
    setError(null);
    setSuccessMessage(null);
    
    // Validate inputs
    if (!region || !shard || !originCelestialBodyId || !destinationCelestialBodyId || !distance || !distanceUnit) {
      setError('Please fill in all fields');
      return;
    }
    
    // Make sure origin and destination are different
    if (originCelestialBodyId === destinationCelestialBodyId) {
      setError('Origin and destination celestial bodies must be different');
      return;
    }
    
    // Make sure distance is a valid number
    const distanceValue = parseFloat(distance);
    if (isNaN(distanceValue) || distanceValue <= 0) {
      setError('Distance must be a positive number');
      return;
    }
    
    // Make sure user is authenticated and not a guest
    if (!AuthService.isUserAuthenticated() || AuthService.isGuest()) {
      setError('You must be logged in to create a route alert');
      return;
    }
    
    setLoading(true);
    
    try {
      // Create the route alert data
      const alertData: RouteAlertCreationData = {
        region,
        shard,
        originCelestialBodyId,
        destinationCelestialBodyId,
        distance: distanceValue,
        distanceUnit
      };
      
      // Create the route alert
      const result = await RouteAlertService.createRouteAlert(alertData);
      
      if (result.success) {
        // Reset the form
        setRegion('us');
        setShard('010');
        setOriginCelestialBodyId('');
        setDestinationCelestialBodyId('');
        setDistance('');
        setDistanceUnit('km');
        
        // Show success message
        setSuccessMessage('Route alert created successfully');
      } else {
        setError(result.error || 'Failed to create route alert');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Get celestial bodies for the dropdown
  const celestialBodies = celestialSystem?.celestialBodies || [];
  
  return (
    <div className="route-alert-creator">
      <h2>Create Route Alert</h2>
      
      {error && <div className="alert-error">{error}</div>}
      {successMessage && <div className="alert-success">{successMessage}</div>}
      
      <form onSubmit={handleSubmit} className="alert-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="region">Region</label>
            <select
              id="region"
              name="region"
              value={region}
              onChange={handleInputChange}
              disabled={loading}
              className="form-select"
            >
              {regionOptions.map(option => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="shard">Shard</label>
            <select
              id="shard"
              name="shard"
              value={shard}
              onChange={handleInputChange}
              disabled={loading}
              className="form-select"
            >
              {shardOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="originCelestialBodyId">Origin Celestial Body</label>
          <select
            id="originCelestialBodyId"
            name="originCelestialBodyId"
            value={originCelestialBodyId}
            onChange={handleInputChange}
            disabled={loading}
            className="form-select"
            required
          >
            <option value="">Select origin celestial body</option>
            {celestialBodies.map(body => (
              <option key={body.id} value={body.id}>
                {body.name} ({body.type})
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="destinationCelestialBodyId">Destination Celestial Body</label>
          <select
            id="destinationCelestialBodyId"
            name="destinationCelestialBodyId"
            value={destinationCelestialBodyId}
            onChange={handleInputChange}
            disabled={loading}
            className="form-select"
            required
          >
            <option value="">Select destination celestial body</option>
            {celestialBodies.map(body => (
              <option key={body.id} value={body.id}>
                {body.name} ({body.type})
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-row">
          <div className="form-group distance-input">
            <label htmlFor="distance">Distance Traveled</label>
            <input
              type="text"
              id="distance"
              name="distance"
              value={distance}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="Enter distance"
              required
              className="form-input"
            />
          </div>
          
          <div className="form-group unit-select">
            <label htmlFor="distanceUnit">Unit</label>
            <select
              id="distanceUnit"
              name="distanceUnit"
              value={distanceUnit}
              onChange={handleInputChange}
              disabled={loading}
              className="form-select"
            >
              {distanceUnitOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Creating...' : 'Create Route Alert'}
        </button>
      </form>
    </div>
  );
};

export default RouteAlertCreator; 