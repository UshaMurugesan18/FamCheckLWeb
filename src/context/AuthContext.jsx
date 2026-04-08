import { createContext, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { getMemberByEmail } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [member, setMember]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const m = await getMemberByEmail(firebaseUser.email);
        setMember(m);
      } else {
        setMember(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function loginWithGoogle() {
    return await signInWithPopup(auth, googleProvider);
  }

  async function loginWithEmail(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
  }

  async function registerWithEmail(email, password) {
    return await createUserWithEmailAndPassword(auth, email, password);
  }

  async function resetPassword(email) {
    return await sendPasswordResetEmail(auth, email);
  }

  async function logout() {
    await signOut(auth);
  }

  async function refreshMember() {
    if (auth.currentUser) {
      const m = await getMemberByEmail(auth.currentUser.email);
      setMember(m);
      return m;
    }
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, member, loading, loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, logout, refreshMember }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
