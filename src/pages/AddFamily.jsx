import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFamilyWithCreator } from '../api/api';
import { useAuth } from '../context/AuthContext';
import styles from './AddFamily.module.css';

export default function AddFamily() {
  const navigate = useNavigate();
  const { user, refreshMember } = useAuth();
  const [familyName, setFamilyName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmedFamily = familyName.trim();
    const trimmedCreator = creatorName.trim();
    if (!trimmedFamily || !trimmedCreator) {
      setError('Please fill in both fields.');
      return;
    }

    setLoading(true);
    try {
      const { familyId: newFamilyId } = await createFamilyWithCreator({
        familyName: trimmedFamily,
        creatorName: trimmedCreator,
        email: user?.email || '',
      });
      await refreshMember();
      navigate(`/family/${newFamilyId}`);
    } catch (err) {
      console.error('❌ Firebase error:', err.code, err.message);
      setError(`Failed to save: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={() => navigate('/')}>
        ‹ Back
      </button>

      <div className={styles.header}>
        <div className={styles.icon}>👨‍👩‍👧‍👦</div>
        <h2 className={styles.title}>Add Family</h2>
        <p className={styles.subtitle}>Create a new family group</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="familyName">
            Family Name
          </label>
          <input
            id="familyName"
            className={styles.input}
            type="text"
            placeholder="e.g. The Sharma Family"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            autoComplete="off"
            maxLength={60}
            disabled={loading}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="creatorName">
            Your Name <span className={styles.roleBadge}>Creator</span>
          </label>
          <input
            id="creatorName"
            className={styles.input}
            type="text"
            placeholder="e.g. Rahul"
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            autoComplete="off"
            maxLength={60}
            disabled={loading}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="creatorEmail">
            Mail ID
          </label>
          <input
            id="creatorEmail"
            className={`${styles.input} ${styles.inputReadonly}`}
            type="email"
            value={user?.email || ''}
            readOnly
            tabIndex={-1}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Create Family'}
        </button>
      </form>
    </div>
  );
}

