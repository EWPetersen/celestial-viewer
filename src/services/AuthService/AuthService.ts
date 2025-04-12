/**
 * Basic authentication service
 * In a real application, this would integrate with a backend authentication system
 */
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  UserCredential,
  User as FirebaseUser,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export interface User {
  id: string;
  email: string;
  username?: string;
  roles: string[];
  createdAt: Date;
  profileRanking?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  username?: string;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private firebaseUser: FirebaseUser | null = null;
  private isAuthenticated: boolean = false;
  private authStateListeners: ((user: User | null) => void)[] = [];

  private constructor() {
    // Set up Firebase auth state listener
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        this.firebaseUser = firebaseUser;
        try {
          // Get user document from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            // User exists in Firestore, use that data
            const userData = userDoc.data() as Omit<User, 'id' | 'createdAt'> & { createdAt: Timestamp };
            this.currentUser = {
              id: firebaseUser.uid,
              ...userData,
              createdAt: userData.createdAt.toDate()
            };
            this.isAuthenticated = true;
          } else {
            // User doesn't exist in Firestore yet, create basic record
            const newUser: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              roles: ['user'],
              createdAt: new Date(),
              profileRanking: 0
            };
            
            // Save to Firestore
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              email: newUser.email,
              roles: newUser.roles,
              createdAt: newUser.createdAt,
              profileRanking: newUser.profileRanking
            });
            
            this.currentUser = newUser;
            this.isAuthenticated = true;
          }
        } catch (error) {
          console.error('Error getting user data:', error);
          this.currentUser = null;
          this.isAuthenticated = false;
        }
      } else {
        // User is signed out
        this.firebaseUser = null;
        this.currentUser = null;
        this.isAuthenticated = false;
      }
      
      // Notify listeners of auth state change
      this.notifyAuthStateListeners();
    });
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
   * Add an auth state change listener
   */
  public addAuthStateListener(listener: (user: User | null) => void): () => void {
    this.authStateListeners.push(listener);
    
    // Call the listener immediately with current state
    listener(this.currentUser);
    
    // Return a function to remove this listener
    return () => {
      this.authStateListeners = this.authStateListeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all auth state listeners
   */
  private notifyAuthStateListeners(): void {
    this.authStateListeners.forEach(listener => {
      listener(this.currentUser);
    });
  }

  /**
   * Register a new user
   */
  public async register(credentials: RegisterCredentials): Promise<AuthResult> {
    try {
      const { email, password, username } = credentials;
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Create user document in Firestore
      const user: User = {
        id: firebaseUser.uid,
        email: email,
        username: username,
        roles: ['user'],
        createdAt: new Date(),
        profileRanking: 0
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        email: user.email,
        username: user.username,
        roles: user.roles,
        createdAt: user.createdAt,
        profileRanking: user.profileRanking
      });
      
      this.currentUser = user;
      this.firebaseUser = firebaseUser;
      this.isAuthenticated = true;
      
      return {
        success: true,
        user
      };
    } catch (error: any) {
      let message = 'Registration failed';
      
      if (error.code === 'auth/email-already-in-use') {
        message = 'Email already in use';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak';
      }
      
      return {
        success: false,
        message
      };
    }
  }

  /**
   * Login with email and password
   */
  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      const { email, password } = credentials;
      
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Get user document from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as Omit<User, 'id' | 'createdAt'> & { createdAt: Timestamp };
        this.currentUser = {
          id: firebaseUser.uid,
          ...userData,
          createdAt: userData.createdAt.toDate()
        };
      } else {
        // This shouldn't normally happen, but if it does, create a new user document
        const newUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          roles: ['user'],
          createdAt: new Date(),
          profileRanking: 0
        };
        
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          email: newUser.email,
          roles: newUser.roles,
          createdAt: newUser.createdAt,
          profileRanking: newUser.profileRanking
        });
        
        this.currentUser = newUser;
      }
      
      this.firebaseUser = firebaseUser;
      this.isAuthenticated = true;
      
      return {
        success: true,
        user: this.currentUser
      };
    } catch (error: any) {
      let message = 'Login failed';
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'Invalid email or password';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      } else if (error.code === 'auth/user-disabled') {
        message = 'User account has been disabled';
      }
      
      return {
        success: false,
        message
      };
    }
  }

  /**
   * Logout the current user
   */
  public async logout(): Promise<void> {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.firebaseUser = null;
      this.isAuthenticated = false;
      this.notifyAuthStateListeners();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
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
   * Update user profile
   */
  public async updateUserProfile(userId: string, profileData: Partial<User>): Promise<User> {
    try {
      // Exclude id from the data to update
      const { id, ...dataToUpdate } = profileData;
      
      // Update user document in Firestore
      await updateDoc(doc(db, 'users', userId), dataToUpdate);
      
      // Update local user object
      if (this.currentUser && this.currentUser.id === userId) {
        this.currentUser = {
          ...this.currentUser,
          ...profileData
        };
        this.notifyAuthStateListeners();
      }
      
      return this.currentUser!;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Check if the current user has a specific role
   */
  public hasRole(role: string): boolean {
    return this.currentUser?.roles.includes(role) || false;
  }

  /**
   * Get user profile by ID
   */
  public async getUserProfile(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as Omit<User, 'id' | 'createdAt'> & { createdAt: Timestamp };
        return {
          id: userId,
          ...userData,
          createdAt: userData.createdAt.toDate()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Subscribe to user profile updates
   */
  public subscribeToUserProfile(userId: string, callback: (user: User | null) => void): () => void {
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() as Omit<User, 'id' | 'createdAt'> & { createdAt: Timestamp };
          const user: User = {
            id: userId,
            ...userData,
            createdAt: userData.createdAt.toDate()
          };
          callback(user);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error subscribing to user profile:', error);
        callback(null);
      }
    );
    
    return unsubscribe;
  }
}

// Export a default instance for easy imports
export default AuthService.getInstance(); 