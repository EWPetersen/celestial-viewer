import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../App';
import './Header.css';

interface HeaderProps {
  activeRegion: 'us' | 'eu' | null;
  activeShard: number | null;
  onRegionChange: (region: 'us' | 'eu' | null) => void;
  onShardChange: (shard: number | null) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  activeRegion, 
  activeShard, 
  onRegionChange, 
  onShardChange 
}) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useContext(AuthContext);
  
  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Available shards - 010-300 in increments of 10
  const shards = Array.from({ length: 30 }, (_, i) => (i + 1) * 10).map(n => n.toString().padStart(3, '0'));
  
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };
  
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onRegionChange(value === '' ? null : value as 'us' | 'eu');
  };
  
  const handleShardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onShardChange(value === '' ? null : parseInt(value, 10));
  };
  
  const toggleDropdown = (dropdown: string) => {
    if (activeDropdown === dropdown) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(dropdown);
    }
  };
  
  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown && !(event.target as Element).closest('.dropdown')) {
        setActiveDropdown(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeDropdown]);
  
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-logo">
          <Link to="/">
            <h1>Celestial Viewer</h1>
          </Link>
        </div>
        
        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="region-select">Region:</label>
            <select 
              id="region-select" 
              value={activeRegion || ''} 
              onChange={handleRegionChange}
            >
              <option value="">All Regions</option>
              <option value="us">US</option>
              <option value="eu">EU</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="shard-select">Shard:</label>
            <select 
              id="shard-select" 
              value={activeShard?.toString() || ''} 
              onChange={handleShardChange}
              disabled={!activeRegion}
            >
              <option value="">All Shards</option>
              {shards.map(shard => (
                <option key={shard} value={parseInt(shard, 10)}>{shard}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="auth-controls">
          {isAuthenticated ? (
            <Link to="/profile" className="profile-link">
              <div className="profile-icon">
                {user && user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}
              </div>
              {user && user.displayName ? user.displayName : 'Profile'}
            </Link>
          ) : (
            <>
              <Link to="/login" className="login-link">Login</Link>
              <Link to="/register" className="register-link">Register</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header; 