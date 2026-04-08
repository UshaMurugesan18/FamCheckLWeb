import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../api/api';

export default function RoleRedirect() {
  const { user, member, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login', { replace: true }); return; }

    if (!member) {
      // New user — never added to any family yet → go to Home to create family
      navigate('/', { replace: true });
      return;
    }

    if (member.role === ROLES.CREATOR) {
      navigate(`/family/${member.familyId}`, { replace: true });
    } else if (member.role === ROLES.RECEIVER) {
      navigate(`/receiver/${member.id}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [loading, user, member, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--color-text-muted)' }}>Redirecting…</p>
    </div>
  );
}
