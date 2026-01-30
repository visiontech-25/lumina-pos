/**
 * Firebase Configuration
 * 
 * This file initializes Firebase with credentials from google-services.json
 * Firebase credentials are secure and can be included in the code (unlike API keys for AI services)
 * 
 * Firebase Security:
 * - Firebase uses security rules to protect data, not API keys
 * - The API key in google-services.json is public and safe to include
 * - Data access is controlled by Firestore Security Rules
 * - Authentication is handled separately
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase configuration from google-services.json
// Project: aquasavvy-cde64
const firebaseConfig = {
  apiKey: "AIzaSyBq3sQiXnia76YK8SOEARmEuvDkdJvnICs",
  authDomain: "aquasavvy-cde64.firebaseapp.com",
  projectId: "aquasavvy-cde64",
  storageBucket: "aquasavvy-cde64.firebasestorage.app",
  messagingSenderId: "853455182622",
  appId: "1:853455182622:android:8f0bb88136497b5638470f",
  databaseURL: "https://aquasavvy-cde64-default-rtdb.europe-west1.firebasedatabase.app"
};

// Initialize Firebase (singleton pattern - only initialize once)
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  // Offline resilience: enable IndexedDB persistence for Firestore
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence: multiple tabs open. Only one tab can use persistence.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence: not supported in this browser.');
    }
  });
} else {
  app = getApps()[0];
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

export { app, db, auth, storage };
export default { app, db, auth, storage };
