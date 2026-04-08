import { createContext, useContext, useEffect, useState } from 'react';
import { getMemberByEmail } from '../api/api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'fc_email';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);  // { email }
  const [member, setMember]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      getMemberByEmail(saved)
        .then((m) => {
          setUser({ email: saved });
          setMember(m);
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_KEY);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function loginWithEmail(email) {
    const m = await getMemberByEmail(email.trim().toLowerCase());
    if (!m) throw new Error('NO_MEMBER');
    localStorage.setItem(STORAGE_KEY, email.trim().toLowerCase());
    setUser({ email: email.trim().toLowerCase() });
    setMember(m);
    return m;
  }

  // kept for compatibility — not used on Android
  async function loginWithGoogle() { throw new Error('Google login not available'); }
  async function registerWithEmail() { throw new Error('Use email login'); }
  async function resetPassword() {}

  async function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setMember(null);
  }

  async function refreshMember() {
    if (user?.email) {
      const m = await getMemberByEmail(user.email);
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
