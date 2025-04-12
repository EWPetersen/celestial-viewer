import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../App';
import RouteAlertService from '../../services/RouteAlertService';
import { RouteAlert } from '../../models/RouteAlert';
import CelestialIdMappingService from '../../services/CelestialIdMappingService';
import './UserProfile.css';

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useContext(AuthContext);
  const [userAlerts, setUserAlerts] = useState<RouteAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add cache ref to prevent stuttering during data fetch
  const cachedAlertsRef = useRef<RouteAlert[]>([]);
  const fetchingRef = useRef(false);
  
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }
    
    const fetchUserData = async () => {
      // Return immediately if already fetching to prevent multiple parallel requests
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      
      // Only show loading state if we don't have cached data yet
      if (cachedAlertsRef.current.length === 0) {
        setIsLoading(true);
      }
      setError(null);
      
      try {
        console.log('[UserProfile] Fetching user alerts...');
        
        // Fetch alerts created by the user
        const alerts = await RouteAlertService.getUserAlerts(user.id);
        
        // Update cache and state
        cachedAlertsRef.current = alerts;
        setUserAlerts(alerts);
        
        console.log('[UserProfile] Successfully fetched user alerts:', alerts.length);
        
        // Update user profile ranking based on alerts
        await RouteAlertService.updateUserRanking(user.id);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data. Please try again.');
        
        // If we have cached data, continue showing it despite the error
        if (cachedAlertsRef.current.length > 0) {
          setUserAlerts(cachedAlertsRef.current);
        }
      } finally {
        setIsLoading(false);
        fetchingRef.current = false;
      }
    };
    
    fetchUserData();
  }, [user, isAuthenticated, navigate]);
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };
  
  if (!isAuthenticated || !user) {
    return null;
  }
  
  return (
    <div className="user-profile-container">
      <div className="profile-header">
        <h2>Your Profile</h2>
        <button 
          onClick={handleLogout}
          className="logout-button"
        >
          Logout
        </button>
      </div>
      
      <div className="profile-content">
        <div className="profile-info">
          <div className="profile-avatar">
            {/* Display first letter of username or email as avatar */}
            {user.username?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
          </div>
          
          <div className="profile-details">
            <h3>{user.username || user.email}</h3>
            <p className="profile-email">{user.email}</p>
            
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="stat-label">Alerts Created</span>
                <span className="stat-value">{userAlerts.length}</span>
              </div>
              
              <div className="profile-stat">
                <span className="stat-label">Safety Rating</span>
                <span className="stat-value">
                  <span className={`safety-level safety-level-${Math.floor((user.profileRanking || 50) / 20)}`}>
                    {user.profileRanking || 50}%
                  </span>
                </span>
              </div>
              
              <div className="profile-stat">
                <span className="stat-label">Member Since</span>
                <span className="stat-value">
                  {user.createdAt?.toLocaleDateString() || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="profile-activity">
          <h3>Your Activity</h3>
          
          {isLoading ? (
            <div className="activity-loading">
              <span className="loading-spinner"></span>
              <p>Loading your activity...</p>
            </div>
          ) : error ? (
            <div className="activity-error">
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : userAlerts.length === 0 ? (
            <div className="activity-empty">
              <p>You haven't created any alerts yet.</p>
              <button 
                onClick={() => navigate('/create-alert')}
                className="create-alert-button"
              >
                Create Your First Alert
              </button>
            </div>
          ) : (
            <div className="activity-list">
              <h4>Your Alerts</h4>
              <ul>
                {userAlerts.map(alert => (
                  <li key={alert.id} className={`alert-item alert-type-${alert.type}`}>
                    <div className="alert-summary">
                      <span className="alert-type">
                        {alert.type === 'interdiction' ? 'Interdiction Alert' : 'PvP Alert'}
                      </span>
                      <span className="alert-date">
                        {new Date(alert.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="alert-details">
                      {alert.type === 'interdiction' ? (
                        <p>
                          From: {CelestialIdMappingService.getNameFromId(alert.originId || '')} to: {CelestialIdMappingService.getNameFromId(alert.destinationId || '')}
                        </p>
                      ) : (
                        <p>
                          At: {CelestialIdMappingService.getNameFromId((alert.locationId || alert.destinationId || ''))}
                        </p>
                      )}
                      
                      <div className="alert-interactions">
                        <span className="confirmations">
                          {alert.confirmations} confirmation{alert.confirmations !== 1 ? 's' : ''}
                        </span>
                        <span className="disputes">
                          {alert.disputes} dispute{alert.disputes !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    
                    <div className="alert-actions">
                      <button 
                        className="edit-button"
                        onClick={() => navigate(`/edit-alert/${alert.id}`)}
                      >
                        Edit
                      </button>
                      <button 
                        className="delete-button"
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to delete this alert?')) {
                            try {
                              await RouteAlertService.deleteAlert(alert.id);
                              setUserAlerts(alerts => alerts.filter(a => a.id !== alert.id));
                            } catch (err) {
                              console.error('Failed to delete alert:', err);
                            }
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 