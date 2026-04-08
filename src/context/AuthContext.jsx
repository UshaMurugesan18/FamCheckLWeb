import { createContext, useContext, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { getMemberByEmail } from '../api/api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'fc_email';
const MEMBER_KEY  = 'fc_member';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [member, setMember]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedEmail  = localStorage.getItem(STORAGE_KEY);
    const savedMember = localStorage.getItem(MEMBER_KEY);

    if (!savedEmail) { setLoading(false); return; }

    // Instantly restore from cache — zero wait, no white screen
    if (savedMember) {
      try {
        const m = JSON.parse(savedMember);
        setUser({ email: savedEmail });
        setMember(m);
        setLoading(false); // show UI immediately
      } catch (_) {}
    }

    // Refresh member from API in background (non-blocking)
    getMemberByEmail(savedEmail)
      .then((m) => {
        if (m) {
          localStorage.setItem(MEMBER_KEY, JSON.stringify(m));
          setUser({ email: savedEmail });
          setMember(m);
        } else {
          // Email no longer in system
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(MEMBER_KEY);
          setUser(null);
          setMember(null);
        }
      })
      .catch(() => { /* keep cached data on network error */ })
      .finally(() => setLoading(false));
  }, []);

  async function loginWithEmail(email) {
    const m = await getMemberByEmail(email.trim().toLowerCase());
    if (!m) throw new Error('NO_MEMBER');
    localStorage.setItem(STORAGE_KEY, email.trim().toLowerCase());
    localStorage.setItem(MEMBER_KEY, JSON.stringify(m));
    flushSync(() => {
      setUser({ email: email.trim().toLowerCase() });
      setMember(m);
    });
    return m;
  }

  async function logout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MEMBER_KEY);
    setUser(null);
    setMember(null);
  }

  async function refreshMember() {
    const savedEmail = localStorage.getItem(STORAGE_KEY);
    if (savedEmail) {
      const m = await getMemberByEmail(savedEmail);
      if (m) {
        localStorage.setItem(MEMBER_KEY, JSON.stringify(m));
        setMember(m);
        return m;
      }
    }
    return null;
  }

  // kept for compatibility
  async function loginWithGoogle() { throw new Error('Google login not available'); }
  async function registerWithEmail() {}
  async function resetPassword() {}

  return (
    <AuthContext.Provider value={{ user, member, loading, loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, logout, refreshMember }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
