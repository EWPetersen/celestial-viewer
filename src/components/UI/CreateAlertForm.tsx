import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../App';
import RouteAlertService from '../../services/RouteAlertService';
import useAppStore from '../../stores/useAppStore';
import { AlertType, DistanceUnit, Region } from '../../models/RouteAlert';
import './CreateAlertForm.css';

interface FormData {
  type: AlertType;
  region: Region;
  shard: number;
  originId: string;
  destinationId: string;
  locationId: string;
  distanceTraveled: number;
  distanceUnit: DistanceUnit;
}

const CreateAlertForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext);
  const celestialSystem = useAppStore(state => state.celestialSystem);
  
  // Initialize alert type from URL query parameter
  const initialType = searchParams.get('type') === 'pvp' ? 'pvp' : 'interdiction';
  
  const [formData, setFormData] = useState<FormData>({
    type: initialType,
    region: 'us',
    shard: 10,
    originId: '',
    destinationId: '',
    locationId: '',
    distanceTraveled: 0,
    distanceUnit: 'km'
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celestialBodies, setCelestialBodies] = useState<{ id: string; name: string; }[]>([]);
  
  // Check authentication and redirect if not logged in
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);
  
  // Extract celestial bodies for dropdowns
  useEffect(() => {
    if (celestialSystem) {
      const bodies = celestialSystem.celestialBodies.map(body => ({
        id: body.id,
        name: body.name
      }));
      
      // Add points of interest
      const pois = celestialSystem.pointsOfInterest.map(poi => ({
        id: poi.id,
        name: poi.name
      }));
      
      setCelestialBodies([...bodies, ...pois]);
    }
  }, [celestialSystem]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'shard') {
      setFormData({ ...formData, [name]: parseInt(value, 10) || 10 });
    } else if (name === 'distanceTraveled') {
      // Parse the value and ensure it's not NaN
      const numericValue = parseFloat(value);
      setFormData({ 
        ...formData, 
        [name]: isNaN(numericValue) ? 0 : numericValue 
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  const handleTypeChange = (type: AlertType) => {
    setFormData({ ...formData, type });
  };
  
  const validateForm = (): boolean => {
    if (formData.type === 'interdiction') {
      if (!formData.originId || !formData.destinationId) {
        setError('Please select both origin and destination');
        return false;
      }
      
      if (formData.originId === formData.destinationId) {
        setError('Origin and destination cannot be the same');
        return false;
      }
      
      if (formData.distanceTraveled <= 0) {
        setError('Distance traveled must be greater than 0');
        return false;
      }
    } else {
      if (!formData.locationId) {
        setError('Please select a location');
        return false;
      }
    }
    
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const alertData = formData.type === 'interdiction' 
        ? {
            type: formData.type,
            region: formData.region,
            shard: formData.shard,
            originId: formData.originId,
            destinationId: formData.destinationId,
            distanceTraveled: formData.distanceTraveled,
            distanceUnit: formData.distanceUnit
          }
        : {
            type: formData.type as 'pvp',
            region: formData.region,
            shard: formData.shard,
            locationId: formData.locationId,
            originId: '',
            destinationId: formData.locationId,
            distanceTraveled: undefined,
            distanceUnit: undefined
          };
      
      const createdAlert = await RouteAlertService.createAlert(alertData);
      
      // Navigate to the alert detail page
      navigate(`/alert/${createdAlert.id}`);
    } catch (err) {
      setError('Failed to create alert. Please try again.');
      console.error('Error creating alert:', err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <div className="create-alert-container">
      <div className="create-alert-card">
        <h2>Create {formData.type === 'interdiction' ? 'Interdiction' : 'PvP'} Alert</h2>
        
        {error && (
          <div className="alert-error-message">
            {error}
          </div>
        )}
        
        <div className="alert-type-selector">
          <button 
            className={`type-button ${formData.type === 'interdiction' ? 'active' : ''}`}
            onClick={() => handleTypeChange('interdiction')}
            type="button"
          >
            Interdiction Alert
          </button>
          <button 
            className={`type-button ${formData.type === 'pvp' ? 'active' : ''}`}
            onClick={() => handleTypeChange('pvp')}
            type="button"
          >
            PvP Alert
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="alert-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="region">Region</label>
              <select
                id="region"
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              >
                <option value="us">US</option>
                <option value="eu">EU</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="shard">Shard</label>
              <select
                id="shard"
                name="shard"
                value={formData.shard}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              >
                {Array.from({ length: 30 }, (_, i) => (i + 1) * 10).map(shard => (
                  <option key={shard} value={shard}>
                    {shard.toString().padStart(3, '0')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {formData.type === 'interdiction' ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="originId">Origin</label>
                  <select
                    id="originId"
                    name="originId"
                    value={formData.originId}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Select Origin</option>
                    {celestialBodies.map(body => (
                      <option key={body.id} value={body.id}>
                        {body.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="destinationId">Destination</label>
                  <select
                    id="destinationId"
                    name="destinationId"
                    value={formData.destinationId}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    required
                  >
                    <option value="">Select Destination</option>
                    {celestialBodies.map(body => (
                      <option key={body.id} value={body.id}>
                        {body.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="distanceTraveled">Distance Traveled</label>
                  <div className="distance-input-group">
                    <input
                      type="number"
                      id="distanceTraveled"
                      name="distanceTraveled"
                      value={isNaN(formData.distanceTraveled) ? '' : formData.distanceTraveled}
                      onChange={handleInputChange}
                      min="0"
                      step="0.1"
                      disabled={isSubmitting}
                      required
                    />
                    <select
                      id="distanceUnit"
                      name="distanceUnit"
                      value={formData.distanceUnit}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                    >
                      <option value="m">m</option>
                      <option value="km">km</option>
                      <option value="Mm">Mm</option>
                      <option value="Gm">Gm</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="locationId">Location</label>
              <select
                id="locationId"
                name="locationId"
                value={formData.locationId}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              >
                <option value="">Select Location</option>
                {celestialBodies.map(body => (
                  <option key={body.id} value={body.id}>
                    {body.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-button"
              onClick={() => navigate('/')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Alert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAlertForm; 