import React, { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../App';
import RouteAlertService from '../../services/RouteAlertService';
import { RouteAlert, RouteAlertInteraction, formatDistance } from '../../models/RouteAlert';
import useAppStore from '../../stores/useAppStore';
import { createAlertVisualization } from '../../models/RouteVisualization';
import CelestialIdMappingService from '../../services/CelestialIdMappingService';
import './AlertDetail.css';

/**
 * AlertDetail component displays detailed information about a route alert
 */
const AlertDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useContext(AuthContext);
  const { removeRouteVisualization, addRouteVisualization } = useAppStore();
  const celestialSystem = useAppStore(state => state.celestialSystem);
  
  const [alert, setAlert] = useState<RouteAlert | null>(null);
  const [interactions, setInteractions] = useState<RouteAlertInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUserAlert, setIsUserAlert] = useState(false);
  
  // Create a mapping for celestial body names
  const [celestialNameMap, setCelestialNameMap] = useState<Record<string, string>>({});
  
  // Helper function to process IDs and extract names
  const processIdForNameMapping = (id: string, nameMap: Record<string, string>): Record<string, string> => {
    if (!id || nameMap[id]) return nameMap; // Skip if no ID or already mapped
    
    const knownNames = [
      'stanton', 'hurston', 'crusader', 'arccorp', 'microtech',
      'ariel', 'aberdeen', 'magda', 'ita', 
      'cellin', 'daymar', 'yela',
      'lyria', 'wala',
      'calliope', 'clio', 'euterpe'
    ];
    
    const lowerId = id.toLowerCase();
    for (const name of knownNames) {
      if (lowerId.includes(name)) {
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        
        // Create a copy to avoid modifying the input map
        const updatedMap = {...nameMap};
        updatedMap[id] = capitalizedName;
        
        // Also add to service
        CelestialIdMappingService.addAlertIdMapping(id, capitalizedName);
        
        return updatedMap;
      }
    }
    
    return nameMap; // Return unchanged if no match found
  };
  
  // Helper function to get the name from an ID
  const getCelestialName = (id: string | undefined): string => {
    if (!id) return 'Unknown';
    
    // First check our direct map
    if (celestialNameMap[id]) {
      return celestialNameMap[id];
    }
    
    // Check the system map
    if (celestialSystem) {
      const body = celestialSystem.celestialBodies.find(b => b.id === id);
      if (body) {
        // Cache for future
        const updatedMap = {...celestialNameMap};
        updatedMap[id] = body.name;
        setCelestialNameMap(updatedMap);
        return body.name;
      }
      
      const poi = celestialSystem.pointsOfInterest.find(p => p.id === id);
      if (poi) {
        // Cache for future
        const updatedMap = {...celestialNameMap};
        updatedMap[id] = poi.name;
        setCelestialNameMap(updatedMap);
        return poi.name;
      }
    }
    
    // Try the mapping service
    const serviceName = CelestialIdMappingService.getNameFromId(id);
    if (serviceName !== id && !serviceName.includes('...')) {
      return serviceName;
    }
    
    // Try to extract a name from parts of the ID as a last resort
    const lowerId = id.toLowerCase();
    const knownNames = [
      'stanton', 'hurston', 'crusader', 'arccorp', 'microtech',
      'ariel', 'aberdeen', 'magda', 'ita', 
      'cellin', 'daymar', 'yela',
      'lyria', 'wala',
      'calliope', 'clio', 'euterpe'
    ];
    
    for (const name of knownNames) {
      if (lowerId.includes(name)) {
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        
        // Cache this result
        const updatedMap = {...celestialNameMap};
        updatedMap[id] = capitalizedName;
        setCelestialNameMap(updatedMap);
        
        return capitalizedName;
      }
    }
    
    // Return truncated ID as last resort
    return id.length > 8 ? id.substring(0, 8) + '...' : id;
  };
  
  useEffect(() => {
    if (!id) return;
    
    const fetchAlertData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch alert details
        const alertData = await RouteAlertService.getAlertById(id);
        
        if (!alertData) {
          setError('Alert not found');
          setIsLoading(false);
          return;
        }
        
        setAlert(alertData);
        
        // Check if the alert belongs to the current user
        if (isAuthenticated && user && alertData.authorId === user.id) {
          setIsUserAlert(true);
        }
        
        // Only try to fetch interactions if the user is authenticated
        // This prevents the "Missing or insufficient permissions" error
        if (isAuthenticated && user) {
          try {
            const interactionsData = await RouteAlertService.getAlertInteractions(id);
            setInteractions(interactionsData);
          } catch (interactionErr) {
            console.warn('Unable to load alert interactions:', interactionErr);
            // Don't set the error state here, as we can still show the alert without interactions
          }
        }
        
        // Visualize the alert on the map
        const visualization = createAlertVisualization(alertData);
        removeRouteVisualization(); // Clear previous visualizations
        addRouteVisualization(visualization);
        
        // Process alert IDs for name mapping
        let updatedNameMap = {...celestialNameMap};
        
        // Process origin ID
        if (alertData.originId) {
          // First try direct mapping from celestial system
          if (celestialSystem) {
            const body = celestialSystem.celestialBodies.find(b => b.id === alertData.originId);
            if (body) {
              updatedNameMap[alertData.originId] = body.name;
              CelestialIdMappingService.addAlertIdMapping(alertData.originId, body.name);
            } else {
              // Try extracting name from ID
              const lowerId = alertData.originId.toLowerCase();
              const knownNames = [
                'stanton', 'hurston', 'crusader', 'arccorp', 'microtech',
                'ariel', 'aberdeen', 'magda', 'ita', 
                'cellin', 'daymar', 'yela',
                'lyria', 'wala',
                'calliope', 'clio', 'euterpe'
              ];
              
              for (const name of knownNames) {
                if (lowerId.includes(name)) {
                  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                  updatedNameMap[alertData.originId] = capitalizedName;
                  CelestialIdMappingService.addAlertIdMapping(alertData.originId, capitalizedName);
                  break;
                }
              }
            }
          }
        }
        
        // Process destination ID
        if (alertData.destinationId) {
          // First try direct mapping from celestial system
          if (celestialSystem) {
            const body = celestialSystem.celestialBodies.find(b => b.id === alertData.destinationId);
            if (body) {
              updatedNameMap[alertData.destinationId] = body.name;
              CelestialIdMappingService.addAlertIdMapping(alertData.destinationId, body.name);
            } else {
              // Try extracting name from ID
              const lowerId = alertData.destinationId.toLowerCase();
              const knownNames = [
                'stanton', 'hurston', 'crusader', 'arccorp', 'microtech',
                'ariel', 'aberdeen', 'magda', 'ita', 
                'cellin', 'daymar', 'yela',
                'lyria', 'wala',
                'calliope', 'clio', 'euterpe'
              ];
              
              for (const name of knownNames) {
                if (lowerId.includes(name)) {
                  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                  updatedNameMap[alertData.destinationId] = capitalizedName;
                  CelestialIdMappingService.addAlertIdMapping(alertData.destinationId, capitalizedName);
                  break;
                }
              }
            }
          }
        }
        
        // Process location ID
        if (alertData.locationId) {
          // First try direct mapping from celestial system
          if (celestialSystem) {
            const body = celestialSystem.celestialBodies.find(b => b.id === alertData.locationId);
            if (body) {
              updatedNameMap[alertData.locationId] = body.name;
              CelestialIdMappingService.addAlertIdMapping(alertData.locationId, body.name);
            } else {
              // Try extracting name from ID
              const lowerId = alertData.locationId.toLowerCase();
              const knownNames = [
                'stanton', 'hurston', 'crusader', 'arccorp', 'microtech',
                'ariel', 'aberdeen', 'magda', 'ita', 
                'cellin', 'daymar', 'yela',
                'lyria', 'wala',
                'calliope', 'clio', 'euterpe'
              ];
              
              for (const name of knownNames) {
                if (lowerId.includes(name)) {
                  const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                  updatedNameMap[alertData.locationId] = capitalizedName;
                  CelestialIdMappingService.addAlertIdMapping(alertData.locationId, capitalizedName);
                  break;
                }
              }
            }
          }
        }
        
        // Update name map
        if (Object.keys(updatedNameMap).length > Object.keys(celestialNameMap).length) {
          console.log('[AlertDetail] Updated celestial name map:', updatedNameMap);
          setCelestialNameMap(updatedNameMap);
        }
        
      } catch (err) {
        setError('Failed to load alert data. Please try again.');
        console.error('Error fetching alert data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAlertData();
    
    // Clean up visualization when component unmounts
    return () => {
      removeRouteVisualization();
    };
  }, [id, user, isAuthenticated, addRouteVisualization, removeRouteVisualization]);
  
  const handleConfirmAlert = async () => {
    if (!isAuthenticated || !alert) {
      // Prompt to login if not authenticated
      if (!isAuthenticated) {
        navigate('/login');
      }
      return;
    }
    
    try {
      const updatedAlert = await RouteAlertService.confirmAlert(alert.id);
      setAlert(updatedAlert);
      
      // Refresh interactions after confirming
      const updatedInteractions = await RouteAlertService.getAlertInteractions(alert.id);
      setInteractions(updatedInteractions);
    } catch (err) {
      console.error('Error confirming alert:', err);
    }
  };
  
  const handleDisputeAlert = async () => {
    if (!isAuthenticated || !alert) {
      // Prompt to login if not authenticated
      if (!isAuthenticated) {
        navigate('/login');
      }
      return;
    }
    
    try {
      const updatedAlert = await RouteAlertService.disputeAlert(alert.id);
      setAlert(updatedAlert);
      
      // Refresh interactions after disputing
      const updatedInteractions = await RouteAlertService.getAlertInteractions(alert.id);
      setInteractions(updatedInteractions);
    } catch (err) {
      console.error('Error disputing alert:', err);
    }
  };
  
  const handleDeleteAlert = async () => {
    if (!alert || !isUserAlert) return;
    
    if (window.confirm('Are you sure you want to delete this alert?')) {
      try {
        await RouteAlertService.deleteAlert(alert.id);
        navigate('/');
      } catch (err) {
        console.error('Error deleting alert:', err);
      }
    }
  };
  
  const handleShareAlert = () => {
    if (!alert) return;
    
    // Get shareable URL for this alert
    const shareUrl = RouteAlertService.getShareableUrl(alert.id, 'alert');
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        window.alert('Link copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
      });
  };
  
  if (isLoading) {
    return (
      <div className="alert-detail-container">
        <div className="alert-detail-loading">
          <span className="loading-spinner"></span>
          <p>Loading alert details...</p>
        </div>
      </div>
    );
  }
  
  if (error || !alert) {
    return (
      <div className="alert-detail-container">
        <div className="alert-detail-error">
          <h2>Error</h2>
          <p>{error || 'Alert not found'}</p>
          <Link to="/" className="back-button">Back to Home</Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="alert-detail-container">
      <div className="alert-detail-header">
        <div className="alert-title">
          <h2>{alert.type === 'interdiction' ? 'Interdiction Alert' : 'PvP Alert'}</h2>
          <div className="alert-meta">
            <span className="region-shard">{alert.region.toUpperCase()}-{alert.shard}</span>
            <span className="timestamp">
              {new Date(alert.timestamp).toLocaleString()}
            </span>
          </div>
        </div>
        
        <div className="alert-actions">
          <button 
            className="share-button"
            onClick={handleShareAlert}
          >
            Share Alert
          </button>
          
          {isUserAlert && (
            <button 
              className="delete-button"
              onClick={handleDeleteAlert}
            >
              Delete Alert
            </button>
          )}
          
          <Link to="/" className="back-button">Back</Link>
        </div>
      </div>
      
      <div className="alert-detail-content">
        <div className="alert-info">
          <div className="alert-location">
            <h3>Location Information</h3>
            
            {alert.type === 'interdiction' ? (
              <div className="route-details">
                <div className="location-item">
                  <span className="label">From:</span>
                  <span className="value">{alert.originName || getCelestialName(alert.originId)}</span>
                </div>
                
                <div className="location-item">
                  <span className="label">To:</span>
                  <span className="value">{alert.destinationName || getCelestialName(alert.destinationId)}</span>
                </div>
                
                {alert.distanceTraveled && alert.distanceUnit && (
                  <div className="location-item">
                    <span className="label">Distance Traveled:</span>
                    <span className="value">
                      {formatDistance(alert.distanceTraveled, alert.distanceUnit)}
                    </span>
                  </div>
                )}
                
                {alert.nearestCelestialId && (
                  <div className="location-item">
                    <span className="label">Nearest Object:</span>
                    <span className="value">{alert.locationName || getCelestialName(alert.nearestCelestialId)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="location-details">
                <div className="location-item">
                  <span className="label">Location:</span>
                  <span className="value">
                    {getCelestialName(alert.locationId || alert.destinationId)}
                  </span>
                </div>
                
                {alert.nearestCelestialId && (
                  <div className="location-item">
                    <span className="label">Nearest Object:</span>
                    <span className="value">{getCelestialName(alert.nearestCelestialId)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="alert-status">
            <h3>Alert Status</h3>
            
            <div className="status-details">
              <div className="status-item">
                <span className="label">Reported by:</span>
                <span className="value">{alert.authorName}</span>
              </div>
              
              <div className="status-item">
                <span className="label">Safety Score:</span>
                <span className="value">
                  <span className={`safety-score safety-score-${Math.floor(alert.safetyScore / 20)}`}>
                    {alert.safetyScore}%
                  </span>
                </span>
              </div>
              
              <div className="status-item">
                <span className="label">Last Activity:</span>
                <span className="value">
                  {new Date(alert.lastActivity).toLocaleString()}
                </span>
              </div>
            </div>
            
            <div className="verification-actions">
              <button 
                className="confirm-button"
                onClick={handleConfirmAlert}
                disabled={!isAuthenticated}
                title={isAuthenticated ? 'Confirm this alert' : 'Login to confirm'}
              >
                <span className="confirm-count">{alert.confirmations}</span>
                <span className="btn-label">Confirm Alert</span>
              </button>
              
              <button 
                className="dispute-button"
                onClick={handleDisputeAlert}
                disabled={!isAuthenticated}
                title={isAuthenticated ? 'Dispute this alert' : 'Login to dispute'}
              >
                <span className="dispute-count">{alert.disputes}</span>
                <span className="btn-label">Dispute Alert</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="alert-interactions">
          <h3>Recent Activity</h3>
          
          {interactions.length === 0 ? (
            <div className="no-interactions">
              <p>No interactions yet. Be the first to confirm or dispute this alert.</p>
            </div>
          ) : (
            <ul className="interaction-list">
              {interactions.map(interaction => (
                <li key={interaction.id} className={`interaction-item interaction-${interaction.action}`}>
                  <span className="interaction-user">{interaction.userName}</span>
                  <span className="interaction-action">
                    {interaction.action === 'confirm' ? 'confirmed' : 'disputed'}
                  </span>
                  <span className="interaction-time">
                    {new Date(interaction.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertDetail; 