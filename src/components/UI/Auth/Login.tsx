import React, { useState } from 'react';
import AuthService, { AuthCredentials } from '../../../services/AuthService';
import './AuthStyles.css';

interface LoginProps {
  onLoginSuccess: () => void;
  onSignUpClick: () => void;
  onContinueAsGuest: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSignUpClick, onContinueAsGuest }) => {
  const [credentials, setCredentials] = useState<AuthCredentials>({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await AuthService.login(credentials);
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await AuthService.continueAsGuest();
      if (result.success) {
        onContinueAsGuest();
      } else {
        setError(result.message || 'Failed to continue as guest');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-container">
        <h2>Login to Celestial Viewer</h2>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={credentials.email}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="auth-options">
          <p>
            Don't have an account?{' '}
            <button 
              type="button" 
              className="link-button" 
              onClick={onSignUpClick}
              disabled={loading}
            >
              Sign Up
            </button>
          </p>
          <p>
            <button 
              type="button" 
              className="guest-button" 
              onClick={handleContinueAsGuest}
              disabled={loading}
            >
              Continue as Guest
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 