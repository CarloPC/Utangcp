import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBlRFG9abKDXh62o45fCS8gADypNTfO4_o',
  authDomain: 'creditmanagement-e7a13.firebaseapp.com',
  projectId: 'creditmanagement-e7a13',
  storageBucket: 'creditmanagement-e7a13.firebasestorage.app',
  messagingSenderId: '780956564638',
  appId: '1:780956564638:web:6f3c22bc99c158bf748f8f',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
