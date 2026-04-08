import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../api/api';
import styles from './Login.module.css';

export default function Login() {
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Enter your email.'); return; }
    setLoading(true);
    try {
      const member = await loginWithEmail(email.trim());
      // Navigate directly based on role — no RoleRedirect, no race condition
      if (member && member.role === ROLES.RECEIVER) {
        navigate(`/receiver/${member.id}`, { replace: true });
      } else if (member && member.familyId) {
        navigate(`/family/${member.familyId}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      if (err.message === 'NO_MEMBER') {
        setError('Email not found. Ask your family creator to add you first.');
      } else {
        setError('Login failed. Check your internet and try again.');
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
        <p className={styles.subtitle}>Enter your email to sign in</p>

        <form className={styles.emailForm} onSubmit={handleSubmit} noValidate>
          <input
            className={styles.input}
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            disabled={loading}
          />
          <button className={styles.emailBtn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
