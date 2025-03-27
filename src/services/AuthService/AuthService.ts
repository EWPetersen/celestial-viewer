/**
 * Basic authentication service
 * In a real application, this would integrate with a backend authentication system
 */
export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private isAuthenticated: boolean = false;

  private constructor() {
    // Check for existing session in localStorage
    this.loadUserFromStorage();
  }

  /**
   * Get the singleton instance of the AuthService
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Load user data from localStorage if available
   */
  private loadUserFromStorage(): void {
    const userData = localStorage.getItem('celestial_viewer_user');
    if (userData) {
      try {
        this.currentUser = JSON.parse(userData);
        this.isAuthenticated = true;
      } catch (error) {
        console.error('Failed to parse user data from storage', error);
        localStorage.removeItem('celestial_viewer_user');
      }
    }
  }

  /**
   * Save user data to localStorage
   */
  private saveUserToStorage(user: User): void {
    localStorage.setItem('celestial_viewer_user', JSON.stringify(user));
  }

  /**
   * Simulate login process
   * In a real app, this would make an API call to authenticate
   */
  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    // Simulated login - in a real app, this would call an API
    if (credentials.username === 'demo' && credentials.password === 'password') {
      const user: User = {
        id: '1',
        username: 'demo',
        email: 'demo@example.com',
        roles: ['user']
      };
      
      this.currentUser = user;
      this.isAuthenticated = true;
      this.saveUserToStorage(user);
      
      return {
        success: true,
        user
      };
    }
    
    return {
      success: false,
      message: 'Invalid username or password'
    };
  }

  /**
   * Logout the current user
   */
  public logout(): void {
    this.currentUser = null;
    this.isAuthenticated = false;
    localStorage.removeItem('celestial_viewer_user');
  }

  /**
   * Check if user is authenticated
   */
  public isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get the current user
   */
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if the current user has a specific role
   */
  public hasRole(role: string): boolean {
    return this.currentUser?.roles.includes(role) || false;
  }
}

// Export a default instance for easy imports
export default AuthService.getInstance(); 