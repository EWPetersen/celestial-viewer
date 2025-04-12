import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For more info: https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDJFneL-OHaJ-3-VFTbHneHT-z7gykJYRU",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "kittizen-a029e.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "kittizen-a029e",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "kittizen-a029e.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "116335381342",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:116335381342:web:369bbff3f889c49c51ddcf",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-4YK1LT1MFD"
};

console.log('Firebase config:', { 
  apiKey: firebaseConfig.apiKey ? "Provided" : "Missing",
  authDomain: firebaseConfig.authDomain ? "Provided" : "Missing",
  projectId: firebaseConfig.projectId
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db }; 