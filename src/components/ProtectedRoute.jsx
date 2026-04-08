import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Synchronous check first — never show blank loading screen if logged in
  const savedEmail = localStorage.getItem('fc_email');

  // Only show loading if we have no cached data at all
  if (loading && !savedEmail) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (!user && !savedEmail) return <Navigate to="/login" replace />;

  return children;
}
