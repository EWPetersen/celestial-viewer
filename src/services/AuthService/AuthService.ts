import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../../config/firebase';

/**
 * Authentication service that integrates with Firebase
 */
export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  isAnonymous: boolean;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends AuthCredentials {
  username: string;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
  error?: string;
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private isAuthenticated: boolean = false;

  private constructor() {
    // Set up auth state listener
    this.setupAuthStateListener();
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
   * Set up Firebase auth state listener
   */
  private setupAuthStateListener(): void {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.setCurrentUser(this.mapFirebaseUserToUser(user));
      } else {
        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem('celestial_viewer_user');
      }
    });
  }

  /**
   * Map Firebase user to our User interface
   */
  private mapFirebaseUserToUser(firebaseUser: FirebaseUser): User {
    return {
      id: firebaseUser.uid,
      username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      email: firebaseUser.email || '',
      roles: ['user'], // Default role
      isAnonymous: firebaseUser.isAnonymous
    };
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
   * Set current user and save to storage
   */
  private setCurrentUser(user: User): void {
    this.currentUser = user;
    this.isAuthenticated = true;
    localStorage.setItem('celestial_viewer_user', JSON.stringify(user));
  }

  /**
   * Sign up a new user
   */
  public async signUp(email: string, password: string, username: string): Promise<AuthResult> {
    try {
      console.log('Attempting to sign up user with email:', email);
      
      // Validate password strength
      if (password.length < 6) {
        console.error('Password validation failed: must be at least 6 characters');
        return {
          success: false,
          error: 'Password must be at least 6 characters long'
        };
      }
      
      // Attempt to create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('User created successfully with Firebase uid:', user.uid);
      
      // Update profile with username
      await updateProfile(userCredential.user, {
        displayName: username,
      });
      
      // Create a proper user object that matches our User interface
      const userProfile: User = {
        id: user.uid,
        email: user.email || email,
        username: username,
        roles: ['user'],
        isAnonymous: false
      };
      
      // Save user to local storage
      this.setCurrentUser(userProfile);
      
      return {
        success: true,
        user: userProfile
      };
    } catch (error: any) {
      console.error('Error during signup:', error.code, error.message);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        return {
          success: false,
          error: 'This email is already in use. Try logging in instead.'
        };
      } else if (error.code === 'auth/invalid-email') {
        return {
          success: false,
          error: 'Please enter a valid email address.'
        };
      } else if (error.code === 'auth/weak-password') {
        return {
          success: false,
          error: 'Password is too weak. It should be at least 6 characters.'
        };
      } else if (error.code === 'auth/operation-not-allowed') {
        return {
          success: false,
          error: 'Sign up is currently disabled. Please try again later.'
        };
      } else {
        return {
          success: false,
          error: `Sign up failed: ${error.message || 'Unknown error'}`
        };
      }
    }
  }

  /**
   * Login with email and password
   */
  public async login(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      );
      
      const user = this.mapFirebaseUserToUser(userCredential.user);
      this.setCurrentUser(user);
      
      return {
        success: true,
        user
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Invalid email or password'
      };
    }
  }

  /**
   * Continue as guest (anonymous) user
   */
  public async continueAsGuest(): Promise<AuthResult> {
    // Create a guest user object
    const guestUser: User = {
      id: 'guest-' + Math.random().toString(36).substring(2, 9),
      username: 'Guest User',
      email: '',
      roles: ['guest'],
      isAnonymous: true
    };
    
    this.setCurrentUser(guestUser);
    
    return {
      success: true,
      user: guestUser
    };
  }

  /**
   * Logout the current user
   */
  public async logout(): Promise<void> {
    try {
      // Only sign out if not anonymous
      if (this.currentUser && !this.currentUser.isAnonymous) {
        await signOut(auth);
      }
      
      this.currentUser = null;
      this.isAuthenticated = false;
      localStorage.removeItem('celestial_viewer_user');
    } catch (error) {
      console.error('Error signing out:', error);
    }
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
   * Check if user is a guest
   */
  public isGuest(): boolean {
    return this.currentUser?.isAnonymous || false;
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