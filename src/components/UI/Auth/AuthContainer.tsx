import React, { useState, useEffect } from 'react';
import AuthService from '../../../services/AuthService';
import Login from './Login';
import SignUp from './SignUp';
import UserProfile from './UserProfile';
import './AuthStyles.css';

interface AuthContainerProps {
  onAuthStateChanged: (isAuthenticated: boolean, isGuest: boolean) => void;
}

const AuthContainer: React.FC<AuthContainerProps> = ({ onAuthStateChanged }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [showLogin, setShowLogin] = useState(true); // Toggle between login and signup

  console.log('AuthContainer rendering with state:', { isAuthenticated, isGuest, showLogin });

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = () => {
      const authStatus = AuthService.isUserAuthenticated();
      const guestStatus = AuthService.isGuest();
      console.log('AuthContainer checking auth status:', { authStatus, guestStatus });
      
      // Only update state if it's different from current state
      if (authStatus !== isAuthenticated || guestStatus !== isGuest) {
        console.log('Auth status changed, updating state');
        setIsAuthenticated(authStatus);
        setIsGuest(guestStatus);
        onAuthStateChanged(authStatus, guestStatus);
      }
    };
    
    checkAuth();
  }, [onAuthStateChanged, isAuthenticated, isGuest]);

  const handleLoginSuccess = () => {
    console.log('Login successful');
    setIsAuthenticated(true);
    setIsGuest(AuthService.isGuest());
    onAuthStateChanged(true, AuthService.isGuest());
  };

  const handleSignUpSuccess = () => {
    console.log('Sign up successful');
    setIsAuthenticated(true);
    setIsGuest(false);
    onAuthStateChanged(true, false);
  };

  const handleLogout = () => {
    console.log('Logout triggered');
    setIsAuthenticated(false);
    setIsGuest(false);
    onAuthStateChanged(false, false);
  };

  const handleContinueAsGuest = () => {
    console.log('Continue as guest triggered');
    setIsAuthenticated(true);
    setIsGuest(true);
    onAuthStateChanged(true, true);
  };

  if (isAuthenticated) {
    return <UserProfile onLogout={handleLogout} />;
  }

  return (
    <div className="auth-container">
      {showLogin ? (
        <Login 
          onLoginSuccess={handleLoginSuccess} 
          onSignUpClick={() => setShowLogin(false)}
          onContinueAsGuest={handleContinueAsGuest}
        />
      ) : (
        <SignUp 
          onSignUpSuccess={handleSignUpSuccess} 
          onLoginClick={() => setShowLogin(true)}
        />
      )}
    </div>
  );
};

export default AuthContainer; 