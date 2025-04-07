import React from 'react';
import AuthService from '../../../services/AuthService';
import './AuthStyles.css';

interface UserProfileProps {
  onLogout: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onLogout }) => {
  const user = AuthService.getCurrentUser();

  const handleLogout = async () => {
    await AuthService.logout();
    onLogout();
  };

  if (!user) return null;

  return (
    <div className="user-profile">
      <div className="user-info">
        <div className="user-avatar">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div className="user-details">
          <h3>{user.username}</h3>
          <p className="user-type">
            {user.isAnonymous ? 'Guest User' : user.email}
          </p>
        </div>
      </div>
      <button className="logout-button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default UserProfile; 