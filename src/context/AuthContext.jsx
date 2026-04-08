import { createContext, useContext, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { getMemberByEmail } from '../api/api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'fc_email';
const MEMBER_KEY  = 'fc_member';

export function AuthProvider({ children }) {
  // Initialize synchronously from localStorage — no loading flash ever
  const [user, setUser] = useState(() => {
    const email = localStorage.getItem(STORAGE_KEY);
    return email ? { email } : null;
  });
  const [member, setMember] = useState(() => {
    try { const m = localStorage.getItem(MEMBER_KEY); return m ? JSON.parse(m) : null; } catch (_) { return null; }
  });
  const [loading, setLoading] = useState(() => {
    // Only show loading if no cached data at all
    return !localStorage.getItem(STORAGE_KEY) || !localStorage.getItem(MEMBER_KEY);
  });

  useEffect(() => {
    const savedEmail = localStorage.getItem(STORAGE_KEY);
    if (!savedEmail) { setLoading(false); return; }

    // Refresh member from API in background (non-blocking)
    getMemberByEmail(savedEmail)
      .then((m) => {
        if (m) {
          localStorage.setItem(MEMBER_KEY, JSON.stringify(m));
          setUser({ email: savedEmail });
          setMember(m);
        } else {
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
