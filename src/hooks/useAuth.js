import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

// Where Firebase's hosted "your password has been reset" page sends the
// user after they finish resetting it. Must be an Authorized Domain in
// Firebase Console -> Authentication -> Settings -> Authorized domains.
const RESET_CONTINUE_URL = 'https://utangcp.free.nf';

export function useAuth() {
  // undefined = still loading, null = not logged in, object = logged in
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const signup = (email, password) =>
    createUserWithEmailAndPassword(auth, email, password);

  // Sends a password reset email via Firebase. The user clicks the link,
  // lands on Firebase's hosted reset page, sets a new password, then gets
  // a "Continue" button back to RESET_CONTINUE_URL (our login page).
  const resetPassword = (email) =>
    sendPasswordResetEmail(auth, email, {
      url: RESET_CONTINUE_URL,
      handleCodeInApp: false,
    });

  const logout = () => signOut(auth);

  return { user, login, signup, logout, resetPassword };
}