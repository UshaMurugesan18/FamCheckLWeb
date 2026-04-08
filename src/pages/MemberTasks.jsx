import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getDefaultTasks,
  getTasksByMember,
  assignTask,
} from '../api/api';
import styles from './MemberTasks.module.css';

export default function MemberTasks() {
  const { familyId, memberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const memberName = location.state?.memberName || 'Member';
  const familyName = location.state?.familyName || '';

  const [defaultTasks, setDefaultTasks] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [defaults, assigned] = await Promise.all([
          getDefaultTasks(),
          getTasksByMember(memberId),
        ]);
        setDefaultTasks(defaults);
        setAssignedTasks(assigned);

        // Pre-select already assigned tasks
        const alreadyAssigned = {};
        assigned.forEach((t) => {
          alreadyAssigned[t.taskName.toLowerCase()] = true;
        });
        setSelected(alreadyAssigned);
      } catch (err) {
        console.error(err);
        setError('Failed to load tasks.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [memberId]);

  function toggleTask(taskName) {
    const key = taskName.toLowerCase();
    // Don't allow un-selecting already assigned tasks
    const isAlreadyAssigned = assignedTasks.some(
      (t) => t.taskName.toLowerCase() === key
    );
    if (isAlreadyAssigned) return;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleAssign() {
    setError('');
    const alreadyAssignedKeys = new Set(
      assignedTasks.map((t) => t.taskName.toLowerCase())
    );

    const toAssign = defaultTasks.filter(
      (t) =>
        selected[t.taskName.toLowerCase()] &&
        !alreadyAssignedKeys.has(t.taskName.toLowerCase())
    );

    if (toAssign.length === 0) {
      setError('No new tasks selected.');
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        toAssign.map((t) =>
          assignTask({
            taskName: t.taskName,
            memberId,
            memberName,
            familyId,
          })
        )
      );
      navigate(`/family/${familyId}`);
    } catch (err) {
      console.error(err);
      setError('Failed to assign tasks. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.center}>
        <p className={styles.loadingText}>Loading tasks…</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button
        className={styles.back}
        onClick={() => navigate(`/family/${familyId}`)}
      >
        ‹ Back
      </button>

      <div className={styles.header}>
        <div className={styles.avatar}>
          {memberName.charAt(0).toUpperCase()}
        </div>
        <h2 className={styles.title}>{memberName}</h2>
        {familyName && <p className={styles.subtitle}>{familyName}</p>}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Assign Tasks</h3>
        <p className={styles.hint}>Tap a task to select it</p>

        <div className={styles.taskGrid}>
          {defaultTasks.map((task) => {
            const key = task.taskName.toLowerCase();
            const isAssigned = assignedTasks.some(
              (t) => t.taskName.toLowerCase() === key
            );
            const isSelected = selected[key];

            return (
              <button
                key={task.id}
                className={`${styles.taskCard} ${
                  isAssigned
                    ? styles.taskAssigned
                    : isSelected
                    ? styles.taskSelected
                    : ''
                }`}
                onClick={() => toggleTask(task.taskName)}
                disabled={isAssigned}
              >
                <span className={styles.taskIcon}>
                  {isAssigned ? '✅' : isSelected ? '☑️' : '☐'}
                </span>
                <span className={styles.taskName}>{task.taskName}</span>
                {isAssigned && (
                  <span className={styles.assignedBadge}>Done</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.assignBtn}
        onClick={handleAssign}
        disabled={saving}
      >
        {saving ? 'Assigning…' : 'Assign Tasks'}
      </button>
    </div>
  );
}
