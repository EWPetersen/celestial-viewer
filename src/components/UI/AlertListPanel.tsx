import React from 'react';
import FloatingPanel from './FloatingPanel';
import AlertList from './AlertList';
import './AlertListPanel.css';

interface AlertListPanelProps {
  activeRegion: 'us' | 'eu' | null;
  activeShard: number | null;
}

const AlertListPanel: React.FC<AlertListPanelProps> = ({ activeRegion, activeShard }) => {
  return (
    <FloatingPanel title="Alert Stream" className="alerts-panel" defaultCollapsed={false}>
      <div className="alert-stream-container">
        <AlertList activeRegion={activeRegion} activeShard={activeShard} />
      </div>
    </FloatingPanel>
  );
};

export default AlertListPanel; 