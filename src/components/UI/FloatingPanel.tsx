import React, { useState, ReactNode } from 'react';

interface FloatingPanelProps {
  title: string;
  className?: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  title,
  className = '',
  children,
  defaultCollapsed = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`floating-panel ${className} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header" onClick={toggleCollapse}>
        <h3>{title}</h3>
        <button className="panel-toggle">
          {isCollapsed ? '+' : '−'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="panel-content">
          {children}
        </div>
      )}
    </div>
  );
};

export default FloatingPanel; 