import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      </div>
    );
  }

  // Check localStorage directly as synchronous fallback — prevents flash
  // redirect during the brief window between setUser() and React commit
  const savedEmail = localStorage.getItem('fc_email');
  if (!user && !savedEmail) return <Navigate to="/login" replace />;

  return children;
}
