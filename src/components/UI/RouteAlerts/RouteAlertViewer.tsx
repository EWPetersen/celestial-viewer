import React, { useState, useEffect } from 'react';
import useAppStore from '../../../stores/useAppStore';
import RouteAlertService from '../../../services/RouteAlertService';
import AuthService from '../../../services/AuthService';
import { RouteAlert } from '../../../models/RouteAlert';
import './RouteAlertStyles.css';

interface RouteAlertViewerProps {
  celestialBodyId?: string;
}

const RouteAlertViewer: React.FC<RouteAlertViewerProps> = ({ celestialBodyId }) => {
  const { celestialSystem, selectCelestialBody } = useAppStore();
  const [alerts, setAlerts] = useState<RouteAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<RouteAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  console.log('RouteAlertViewer rendering, celestialBodyId:', celestialBodyId);

  // Load route alerts
  useEffect(() => {
    const loadAlerts = async () => {
      console.log('Loading alerts for celestialBodyId:', celestialBodyId);
      setLoading(true);
      setError(null);
      
      try {
        let alertsData: RouteAlert[];
        
        if (celestialBodyId) {
          // Load alerts for specific celestial body
          console.log('Fetching alerts for specific celestial body:', celestialBodyId);
          alertsData = await RouteAlertService.getRouteAlertsByCelestialBody(celestialBodyId);
        } else {
          // Load all alerts
          console.log('Fetching all alerts');
          alertsData = await RouteAlertService.getRouteAlerts();
        }
        
        console.log('Alerts data received:', alertsData.length, 'alerts');
        setAlerts(alertsData);
        
        // If a specific celestial body is selected, and we found alerts, select the first one
        if (celestialBodyId && alertsData.length > 0) {
          setSelectedAlert(alertsData[0]);
        } else {
          setSelectedAlert(null);
        }
      } catch (err: any) {
        console.error('Error loading route alerts:', err);
        setError(err.message || 'Failed to load route alerts');
      } finally {
        setLoading(false);
      }
    };
    
    loadAlerts();
  }, [celestialBodyId]);

  // Handle clicking on a route alert
  const handleAlertClick = (alert: RouteAlert) => {
    setSelectedAlert(alert);
    
    // Select the origin celestial body in the app store
    selectCelestialBody(alert.originCelestialBodyId);
  };

  // Handle confirming a route alert
  const handleConfirm = async (alertId: string) => {
    if (!AuthService.isUserAuthenticated()) {
      setError('You must be logged in to confirm an alert');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await RouteAlertService.confirmRouteAlert(alertId);
      
      if (result.success) {
        // Reload alerts
        const updatedAlerts = await RouteAlertService.getRouteAlerts();
        setAlerts(updatedAlerts);
        
        // Update selected alert
        const updatedAlert = updatedAlerts.find(alert => alert.id === alertId);
        if (updatedAlert) {
          setSelectedAlert(updatedAlert);
        }
        
        setSuccessMessage('Alert confirmed successfully');
      } else {
        setError(result.error || 'Failed to confirm alert');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle disputing a route alert
  const handleDispute = async (alertId: string) => {
    if (!AuthService.isUserAuthenticated()) {
      setError('You must be logged in to dispute an alert');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await RouteAlertService.disputeRouteAlert(alertId);
      
      if (result.success) {
        // Reload alerts
        const updatedAlerts = await RouteAlertService.getRouteAlerts();
        setAlerts(updatedAlerts);
        
        // Update selected alert
        const updatedAlert = updatedAlerts.find(alert => alert.id === alertId);
        if (updatedAlert) {
          setSelectedAlert(updatedAlert);
        }
        
        setSuccessMessage('Alert disputed successfully');
      } else {
        setError(result.error || 'Failed to dispute alert');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Format date from timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Check if user has already confirmed or disputed the alert
  const hasUserConfirmed = (alert: RouteAlert) => {
    const currentUser = AuthService.getCurrentUser();
    return currentUser ? alert.confirmations.includes(currentUser.id) : false;
  };

  const hasUserDisputed = (alert: RouteAlert) => {
    const currentUser = AuthService.getCurrentUser();
    return currentUser ? alert.disputes.includes(currentUser.id) : false;
  };

  // Get safety score class based on value
  const getSafetyScoreClass = (score: number) => {
    if (score > 5) return 'safety-high';
    if (score >= 0) return 'safety-medium';
    return 'safety-low';
  };

  return (
    <div className="route-alert-viewer">
      <h2>Route Alerts</h2>
      
      {error && <div className="alert-error">{error}</div>}
      {successMessage && <div className="alert-success">{successMessage}</div>}
      
      {loading && !selectedAlert && <div className="loading">Loading route alerts...</div>}
      
      {alerts.length === 0 && !loading ? (
        <div className="no-alerts">No route alerts found</div>
      ) : (
        <div className="alerts-container">
          <div className="alerts-list">
            {alerts.map(alert => (
              <div 
                key={alert.id} 
                className={`alert-item ${selectedAlert?.id === alert.id ? 'selected' : ''}`}
                onClick={() => handleAlertClick(alert)}
              >
                <div className="alert-item-header">
                  <span className="alert-region">{alert.region.toUpperCase()}-{alert.shard}</span>
                  <span className={`alert-safety ${getSafetyScoreClass(alert.safetyScore)}`}>
                    {alert.safetyScore}
                  </span>
                </div>
                <div className="alert-item-route">
                  {alert.originCelestialBodyName} → {alert.destinationCelestialBodyName}
                </div>
                <div className="alert-item-info">
                  {alert.distance} {alert.distanceUnit}
                </div>
              </div>
            ))}
          </div>
          
          {selectedAlert && (
            <div className="alert-details">
              <h3>Route Alert Details</h3>
              
              <div className="detail-section">
                <div className="detail-row">
                  <span className="detail-label">Region/Shard:</span>
                  <span className="detail-value">{selectedAlert.region.toUpperCase()}-{selectedAlert.shard}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Route:</span>
                  <span className="detail-value">
                    <strong>{selectedAlert.originCelestialBodyName}</strong> to <strong>{selectedAlert.destinationCelestialBodyName}</strong>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Distance:</span>
                  <span className="detail-value">{selectedAlert.distance} {selectedAlert.distanceUnit}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Created By:</span>
                  <span className="detail-value">{selectedAlert.authorName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Created On:</span>
                  <span className="detail-value">{formatDate(selectedAlert.createdAt)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Safety Score:</span>
                  <span className={`detail-value safety-score ${getSafetyScoreClass(selectedAlert.safetyScore)}`}>
                    {selectedAlert.safetyScore}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Confirmations:</span>
                  <span className="detail-value">{selectedAlert.confirmations.length}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Disputes:</span>
                  <span className="detail-value">{selectedAlert.disputes.length}</span>
                </div>
              </div>
              
              <div className="alert-actions">
                <button 
                  className={`confirm-button ${hasUserConfirmed(selectedAlert) ? 'active' : ''}`}
                  onClick={() => handleConfirm(selectedAlert.id)}
                  disabled={loading || hasUserConfirmed(selectedAlert)}
                >
                  {hasUserConfirmed(selectedAlert) ? 'Confirmed' : 'Confirm'}
                </button>
                <button 
                  className={`dispute-button ${hasUserDisputed(selectedAlert) ? 'active' : ''}`}
                  onClick={() => handleDispute(selectedAlert.id)}
                  disabled={loading || hasUserDisputed(selectedAlert)}
                >
                  {hasUserDisputed(selectedAlert) ? 'Disputed' : 'Dispute'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RouteAlertViewer; 