import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../api/api';
import styles from './Home.module.css';

export default function Home() {
  const navigate = useNavigate();
  const { member, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!member) return; // new user — show the cards below
    if (member.role === ROLES.CREATOR) {
      navigate(`/family/${member.familyId}`, { replace: true });
    } else if (member.role === ROLES.RECEIVER) {
      navigate(`/receiver/${member.id}`, { replace: true });
    }
  }, [loading, member, navigate]);

  if (loading || member) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.icon}>🏠</div>
        <h1 className={styles.title}>Family Checklist</h1>
        <p className={styles.subtitle}>Manage your family & members</p>
      </div>

      <div className={styles.cardGrid}>
        <button
          className={`${styles.card} ${styles.cardFamily}`}
          onClick={() => navigate('/add-family')}
        >
          <span className={styles.cardIcon}>👨‍👩‍👧‍👦</span>
          <span className={styles.cardLabel}>Add Family</span>
          <span className={styles.cardDesc}>Create a new family group</span>
          <span className={styles.arrow}>›</span>
        </button>

        <button
          className={`${styles.card} ${styles.cardMember}`}
          onClick={() => navigate('/add-member')}
        >
          <span className={styles.cardIcon}>👤</span>
          <span className={styles.cardLabel}>Add Member</span>
          <span className={styles.cardDesc}>Add a member to a family</span>
          <span className={styles.arrow}>›</span>
        </button>
      </div>
    </div>
  );
}
