import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getTaskGroups, addTaskGroup } from '../api/api';
import styles from './SelectGroup.module.css';

const DEFAULT_ICONS = { 'morning-preparation': '🌅', 'evening-routine': '🌇', bedtime: '🌙', homework: '📚' };

const ICON_OPTIONS = ['📋','🌅','🌇','🌙','📚','🛒','🏃','🍽️','🧹','💊','🎯','🎨','🏋️','🚿','👕'];

export default function SelectGroup() {
  const { familyId, memberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const memberName = location.state?.memberName || 'Member';
  const familyName = location.state?.familyName || '';
  const memberEmail = location.state?.memberEmail || '';

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('📋');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  function loadGroups() {
    setLoading(true);
    getTaskGroups()
      .then((data) => setGroups(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  function handleSelect(group) {
    navigate(`/family/${familyId}/member/${memberId}/assign`, {
      state: { memberName, familyName, memberEmail, groupId: group.id, groupName: group.name, groupIcon: group.icon || DEFAULT_ICONS[group.id] || '📋' },
    });
  }

  async function handleCreateGroup() {
    setCreateError('');
    if (!newGroupName.trim()) { setCreateError('Enter a group name.'); return; }
    setCreating(true);
    try {
      const id = await addTaskGroup(newGroupName, newGroupIcon);
      const newGroup = { id, name: newGroupName.trim(), icon: newGroupIcon };
      setGroups((prev) => [...prev, newGroup].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreate(false);
      setNewGroupName('');
      setNewGroupIcon('📋');
    } catch (err) {
      console.error(err);
      setCreateError('Failed: ' + (err.message || 'check console'));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className={styles.center}><p className={styles.loadingText}>Loading groups…</p></div>;
  }

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={() => navigate(`/family/${familyId}`)}>
        ‹ Back
      </button>

      <div className={styles.header}>
        <div className={styles.icon}>📋</div>
        <h2 className={styles.title}>Select Task Group</h2>
        <p className={styles.subtitle}>Assigning to <strong>{memberName}</strong></p>
        {memberEmail ? <p className={styles.email}>{memberEmail}</p> : null}
      </div>

      <div className={styles.list}>
        {groups.map((group) => (
          <button key={group.id} className={styles.card} onClick={() => handleSelect(group)}>
            <span className={styles.groupIcon}>{group.icon || DEFAULT_ICONS[group.id] || '📋'}</span>
            <div className={styles.groupInfo}>
              <span className={styles.groupName}>{group.name}</span>
            </div>
            <span className={styles.arrow}>›</span>
          </button>
        ))}

        {/* Create new group */}
        {showCreate ? (
          <div className={styles.createCard}>
            <div className={styles.iconPicker}>
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  className={`${styles.iconOption} ${newGroupIcon === ic ? styles.iconSelected : ''}`}
                  onClick={() => setNewGroupIcon(ic)}
                >
                  {ic}
                </button>
              ))}
            </div>
            <input
              className={styles.createInput}
              type="text"
              placeholder="Group name e.g. Grocery"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              autoFocus
              maxLength={40}
              disabled={creating}
            />
            {createError && <p className={styles.createError}>{createError}</p>}
            <div className={styles.createActions}>
              <button className={styles.createSave} onClick={handleCreateGroup} disabled={creating}>
                {creating ? '…' : 'Create Group'}
              </button>
              <button className={styles.createCancel} onClick={() => { setShowCreate(false); setNewGroupName(''); setCreateError(''); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.addGroupBtn} onClick={() => setShowCreate(true)}>
            + Create New Group
          </button>
        )}
      </div>
    </div>
  );
}
