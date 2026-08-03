import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "saged-8b825.firebaseapp.com",
  projectId: "saged-8b825",
  storageBucket: "saged-8b825.firebasestorage.app",
  messagingSenderId: "896367815064",
  appId: "1:896367815064:web:f2f29489bdbdb46025a3ed",
  measurementId: "G-E5KCT5RW2V"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Enable offline persistence
// Note: enableIndexedDbPersistence is for Web. For React Native, 
// Firestore enables persistence automatically by default.
