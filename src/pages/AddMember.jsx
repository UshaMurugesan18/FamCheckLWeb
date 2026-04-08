import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFamilies, addMember, ROLES } from '../api/api';
import styles from './AddMember.module.css';

export default function AddMember() {
  const navigate = useNavigate();
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [families, setFamilies] = useState([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getFamilies()
      .then((data) => {
        setFamilies(data);
        if (data.length > 0) setFamilyId(data[0].id);
      })
      .catch(() => setError('Could not load families.'))
      .finally(() => setLoadingFamilies(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmedName = memberName.trim();
    const trimmedEmail = memberEmail.trim().toLowerCase();
    if (!trimmedName) { setError('Please enter a member name.'); return; }
    if (!trimmedEmail) { setError("Please enter the member's email."); return; }
    if (!familyId) { setError('Please select a family.'); return; }

    setLoading(true);
    try {
      await addMember({
        member: trimmedName,
        email: trimmedEmail,
        role: ROLES.RECEIVER,
        familyId,
      });
      navigate('/');
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
        <div className={styles.icon}>👤</div>
        <h2 className={styles.title}>Add Member</h2>
        <p className={styles.subtitle}>Add a member to a family</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="memberName">
            Member Name
          </label>
          <input
            id="memberName"
            className={styles.input}
            type="text"
            placeholder="e.g. Priya"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            autoComplete="off"
            maxLength={60}
            disabled={loading}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="memberEmail">
            Member Email
          </label>
          <input
            id="memberEmail"
            className={styles.input}
            type="email"
            placeholder="e.g. priya@gmail.com"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            autoComplete="off"
            disabled={loading}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="familyId">
            Family Name
          </label>
          {loadingFamilies ? (
            <div className={styles.loadingText}>Loading families…</div>
          ) : families.length === 0 ? (
            <div className={styles.emptyText}>
              No families found. Please{' '}
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => navigate('/add-family')}
              >
                create a family
              </button>{' '}
              first.
            </div>
          ) : (
            <select
              id="familyId"
              className={styles.select}
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              disabled={loading}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.familyName}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={styles.roleRow}>
          <span className={styles.roleLabel}>Role</span>
          <span className={styles.roleBadge}>Receiver</span>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.submit}
          type="submit"
          disabled={loading || loadingFamilies || families.length === 0}
        >
          {loading ? 'Saving…' : 'Add Member'}
        </button>
      </form>
    </div>
  );
}

