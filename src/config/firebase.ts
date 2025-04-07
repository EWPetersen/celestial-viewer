import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDJFneL-OHaJ-3-VFTbHneHT-z7gykJYRU",
  authDomain: "kittizen-a029e.firebaseapp.com",
  projectId: "kittizen-a029e",
  storageBucket: "kittizen-a029e.firebasestorage.app",
  messagingSenderId: "116335381342",
  appId: "1:116335381342:web:369bbff3f889c49c51ddcf",
  measurementId: "G-4YK1LT1MFD"
};

console.log("Firebase config initialized with:", 
  {
    apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 5)}...` : 'missing', 
    projectId: firebaseConfig.projectId
  }
);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Track initialization state
let isInitialized = false;

// Function to ensure Firebase is initialized
const ensureFirebaseInitialized = () => {
  if (!isInitialized) {
    try {
      // Test connection by trying to get auth state
      const currentUser = auth.currentUser;
      console.log("Firebase connection verified:", currentUser ? "User logged in" : "No user");
      isInitialized = true;
    } catch (error) {
      console.error("Firebase initialization error:", error);
      throw new Error("Firebase failed to initialize properly");
    }
  }
  return isInitialized;
};

console.log("Firebase auth and firestore initialized");

export { app, auth, db, ensureFirebaseInitialized }; 