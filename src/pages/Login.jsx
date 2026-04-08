import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import styles from './Login.module.css';

const isNative = Capacitor.isNativePlatform();
export default function Login() {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/redirect', { replace: true });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.');
      } else {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEmail(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) { setError('Enter email and password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      if (isRegister) {
        await registerWithEmail(email.trim(), password);
      } else {
        await loginWithEmail(email.trim(), password);
      }
      navigate('/redirect', { replace: true });
    } catch (err) {
      console.error('Email login error code:', err.code, err.message);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Account already exists. Switch to Sign In.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Check your internet connection.');
      } else {
        setError('Failed: ' + (err.code || err.message));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>🏠</div>
        <h1 className={styles.title}>Family Checklist</h1>
        <p className={styles.subtitle}>Sign in to manage your family tasks</p>

        {!isNative && (
          <>
            <button
              className={styles.googleBtn}
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg className={styles.googleIcon} viewBox="0 0 48 48">
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2v6h7.8c4.5-4.2 7.1-10.3 7.1-17.2z"/>
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.8-6c-2.1 1.4-4.8 2.3-8.1 2.3-6.2 0-11.5-4.2-13.4-9.9H2.6v6.2C6.5 42.8 14.7 48 24 48z"/>
                <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6v-6.2H2.6C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l8-6.2z"/>
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.9 2.4 30.5 0 24 0 14.7 0 6.5 5.2 2.6 13.2l8 6.2C12.5 13.7 17.8 9.5 24 9.5z"/>
              </svg>
              {loading ? 'Signing in…' : 'Sign in with Google'}
            </button>
            <div className={styles.divider}><span>or</span></div>
          </>
        )}

        <form className={styles.emailForm} onSubmit={handleEmail} noValidate>
          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            disabled={loading}
          />
          <button className={styles.emailBtn} type="submit" disabled={loading}>
            {loading ? (isRegister ? 'Registering…' : 'Signing in…') : (isRegister ? 'Register' : 'Sign in with Email')}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        <p className={styles.note} style={{cursor:'pointer', textDecoration:'underline'}} onClick={() => { setIsRegister(!isRegister); setError(''); }}>
          {isRegister ? 'Already have an account? Sign In' : 'New user? Register here'}
        </p>
      </div>
    </div>
  );
}
