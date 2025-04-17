import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import FloatingPanel from './FloatingPanel';
import CreateAlertForm from './CreateAlertForm';
import './ControlPanel.css';

const ControlPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'routes'>('alerts');
  const [showAlertForm, setShowAlertForm] = useState(false);

  const toggleAlertForm = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowAlertForm(!showAlertForm);
  };

  return (
    <FloatingPanel title="Controls" className="left-menu-panel" defaultCollapsed={false}>
      <div className="control-panel-container">
        <div className="control-panel-tabs">
          <button 
            className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            Alerts
          </button>
          <button 
            className={`tab-button ${activeTab === 'routes' ? 'active' : ''}`}
            onClick={() => setActiveTab('routes')}
          >
            Routes
          </button>
        </div>
        
        <div className="control-panel-content">
          {activeTab === 'alerts' && (
            <div className="alerts-controls">
              <h4>Alert Options</h4>
              <div className="control-actions">
                <button className="action-button" onClick={toggleAlertForm}>
                  <span className="icon">⚠️</span>
                  {showAlertForm ? 'Close Form' : 'Create Alert'}
                </button>
              </div>
              
              {showAlertForm && (
                <div className="inline-form-container">
                  <CreateAlertForm onComplete={() => setShowAlertForm(false)} isInline={true} />
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'routes' && (
            <div className="routes-controls">
              <h4>Route Options</h4>
              <div className="control-actions">
                <Link to="/create-route" className="action-button">
                  <span className="icon">🗺️</span>
                  Create Route
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </FloatingPanel>
  );
};

export default ControlPanel; 