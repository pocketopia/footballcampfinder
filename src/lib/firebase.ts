import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDPKMPU0aF4m2Zm7DKYETCreZM20QcIJGg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'football-camp-finder-840b8.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'football-camp-finder-840b8',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'football-camp-finder-840b8.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '188700989738',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:188700989738:web:9ca7e544c3deb06df1e653',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

