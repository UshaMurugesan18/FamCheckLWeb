import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFamily, getMembersByFamily, ROLES } from '../api/api';
import styles from './FamilyDetail.module.css';

export default function FamilyDetail() {
  const { familyId } = useParams();
  const navigate = useNavigate();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [fam, mems] = await Promise.all([
        getFamily(familyId),
        getMembersByFamily(familyId),
      ]);
      setFamily(fam);
      setMembers(mems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => { load(); }, [load]);

  // Pull-to-refresh
  const startY = useRef(0);
  const pulling = useRef(false);
  useEffect(() => {
    function onTouchStart(e) {
      if (window.scrollY === 0) { startY.current = e.touches[0].clientY; pulling.current = true; }
    }
    function onTouchEnd(e) {
      if (!pulling.current) return;
      const dy = e.changedTouches[0].clientY - startY.current;
      pulling.current = false;
      if (dy > 70) {
        setRefreshing(true);
        load().finally(() => setRefreshing(false));
      }
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [load]);

  const receivers = members.filter((m) => m.role === ROLES.RECEIVER);
  const creator = members.find((m) => m.role === ROLES.CREATOR);

  if (loading) {
    return (
      <div className={styles.center}>
        <p className={styles.loadingText}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {refreshing && <div className={styles.pullRefresh}>↻ Refreshing…</div>}
      <button className={styles.back} onClick={() => navigate('/')}>
        ‹ Back
      </button>

      <div className={styles.header}>
        <div className={styles.icon}>👨‍👩‍👧‍👦</div>
        <h2 className={styles.title}>{family?.familyName}</h2>
        {creator && (
          <p className={styles.subtitle}>
            Created by <strong>{creator.member}</strong>
          </p>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Members</h3>

        {receivers.length === 0 ? (
          <div className={styles.emptyCard}>
            <p>No members yet.</p>
            <button
              className={styles.addMemberBtn}
              onClick={() => navigate('/add-member')}
            >
              + Add Member
            </button>
          </div>
        ) : (
          <div className={styles.memberList}>
            {receivers.map((m) => (
              <button
                key={m.id}
                className={styles.memberCard}
                onClick={() =>
                  navigate(`/family/${familyId}/member/${m.id}/groups`, {
                    state: { memberName: m.member, familyName: family?.familyName, memberEmail: m.email },
                  })
                }
              >
                <span className={styles.avatar}>
                  {m.member.charAt(0).toUpperCase()}
                </span>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{m.member}</span>
                  <span className={styles.memberEmail}>{m.email}</span>
                  <span className={styles.memberRole}>Receiver</span>
                </div>
                <span className={styles.arrowIcon}>›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className={styles.addMemberFab}
        onClick={() => navigate('/add-member')}
      >
        + Add Member
      </button>

      <button
        className={styles.reviewBtn}
        onClick={() => navigate(`/family/${familyId}/review`)}
      >
        📋 Review Assignments
      </button>
    </div>
  );
}
