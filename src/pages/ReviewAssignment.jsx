import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  subscribeToAssignmentsByFamily,
  getAssignmentTasks,
  updateAssignmentState,
  updateAssignment,
  deleteAssignment,
  addAssignmentTask,
  deleteAssignmentTask,
  STATES,
} from '../api/api';
import styles from './ReviewAssignment.module.css';

function to12h(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const STATE_LABEL = {
  [STATES.ASSIGNED]:  { label: 'Assigned',  color: '#4f63d2', bg: '#eef0fd' },
  [STATES.SNOOZED]:   { label: 'Snoozed',   color: '#d97706', bg: '#fef3c7' },
  [STATES.COMPLETED]: { label: 'Completed',  color: '#059669', bg: '#d1fae5' },
  [STATES.APPROVED]:  { label: 'Approved ✅', color: '#059669', bg: '#d1fae5' },
  [STATES.DENIED]:    { label: 'Denied ❌',   color: '#dc2626', bg: '#fee2e2' },
};

export default function ReviewAssignment() {
  const { familyId } = useParams();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editInterval, setEditInterval] = useState(5);
  const [editVoice, setEditVoice] = useState(true);
  const [newTaskName, setNewTaskName] = useState('');
  const [editingTrackerId, setEditingTrackerId] = useState(null);
  const [expandedDayId, setExpandedDayId] = useState(null);
  const [expandedDayTasks, setExpandedDayTasks] = useState([]);
  const [expandedDayLoading, setExpandedDayLoading] = useState(false);
  const [expandedTrackers, setExpandedTrackers] = useState(new Set());

  function toggleTracker(tgId) {
    setExpandedTrackers((prev) => {
      const next = new Set(prev);
      if (next.has(tgId)) next.delete(tgId); else next.add(tgId);
      return next;
    });
  }

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToAssignmentsByFamily(familyId, (list) => {
      setAssignments(list);
      setLoading(false);
    });
    return () => unsub();
  }, [familyId]);

  async function handleExpand(a) {
    if (expanded === a.id) { setExpanded(null); return; }
    setExpanded(a.id);
    const t = await getAssignmentTasks(a.id);
    setExpandedTasks(t);
  }

  async function handleAction(assignmentId, state) {
    setActing(true);
    try {
      await updateAssignmentState(assignmentId, state);
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, state } : a))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setActing(false);
    }
  }

  function startEdit(a) {
    setEditingId(a.id);
    setEditStart(a.timeStart || '08:00');
    setEditEnd(a.timeEnd || '09:00');
    setEditInterval(a.alarmInterval || 5);
    setEditVoice(a.voiceEnabled !== false);
    setNewTaskName('');
    setExpanded(a.id);
  }

  async function handleAddTask(assignmentId) {
    const name = newTaskName.trim();
    if (!name) return;
    const task = await addAssignmentTask(assignmentId, name);
    setExpandedTasks((prev) => [...prev, task]);
    setNewTaskName('');
  }

  async function handleDeleteTask(taskId) {
    await deleteAssignmentTask(taskId);
    setExpandedTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  async function handleSaveEdit(assignmentId) {
    setActing(true);
    try {
      await updateAssignment(assignmentId, {
        timeStart: editStart,
        timeEnd: editEnd,
        alarmInterval: editInterval,
        voiceEnabled: editVoice,
      });
      setAssignments((prev) =>
        prev.map((a) => a.id === assignmentId
          ? { ...a, timeStart: editStart, timeEnd: editEnd, alarmInterval: editInterval, voiceEnabled: editVoice }
          : a)
      );
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActing(false);
    }
  }

  async function handleDeleteTrackerGroup(days) {
    if (!window.confirm(`Delete all ${days.length} days of this tracker?`)) return;
    setActing(true);
    try {
      await Promise.all(days.map((d) => deleteAssignment(d.id)));
      const ids = new Set(days.map((d) => d.id));
      setAssignments((prev) => prev.filter((a) => !ids.has(a.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setActing(false);
    }
  }

  async function handleSaveTrackerEdit(days) {
    setActing(true);
    try {
      await Promise.all(days.map((d) => updateAssignment(d.id, {
        timeStart: editStart,
        timeEnd: editEnd,
        alarmInterval: editInterval,
        voiceEnabled: editVoice,
      })));
      const ids = new Set(days.map((d) => d.id));
      setAssignments((prev) => prev.map((a) => ids.has(a.id)
        ? { ...a, timeStart: editStart, timeEnd: editEnd, alarmInterval: editInterval, voiceEnabled: editVoice }
        : a));
      setEditingTrackerId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActing(false);
    }
  }

  async function handleDelete(assignmentId) {
    if (!window.confirm('Delete this assignment?')) return;
    setActing(true);
    try {
      await deleteAssignment(assignmentId);
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      if (expanded === assignmentId) setExpanded(null);
    } catch (err) {
      console.error(err);
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return <div className={styles.center}><p>Loading assignments…</p></div>;
  }

  // Split tracker vs normal assignments
  const trackerAssignments = assignments.filter((a) => a.trackerGroupId);
  const normalAssignments = assignments.filter((a) => !a.trackerGroupId);

  // Group tracker assignments by trackerGroupId
  const trackerGroups = {};
  for (const a of trackerAssignments) {
    if (!trackerGroups[a.trackerGroupId]) trackerGroups[a.trackerGroupId] = [];
    trackerGroups[a.trackerGroupId].push(a);
  }

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function dayLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return DAY_LABELS[d.getDay()];
  }
  function shortDate(dateStr) {
    const [, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  }
  const dayStateIcon = {
    [STATES.ASSIGNED]: '🔲', [STATES.SNOOZED]: '⏸️',
    [STATES.COMPLETED]: '🟡', [STATES.APPROVED]: '✅', [STATES.DENIED]: '❌',
  };

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={() => navigate(`/family/${familyId}`)}>
        ‹ Back
      </button>

      <div className={styles.header}>
        <div className={styles.icon}>📋</div>
        <h2 className={styles.title}>Assignments</h2>
        <p className={styles.subtitle}>Review & approve member tasks</p>
      </div>

      {assignments.length === 0 ? (
        <p className={styles.empty}>No assignments yet.</p>
      ) : (
        <div className={styles.list}>

          {/* ── Daily Tracker groups ── */}
          {Object.entries(trackerGroups).map(([tgId, days]) => {
            const sorted = [...days].sort((a, b) => a.assignedDate.localeCompare(b.assignedDate));
            const first = sorted[0];
            const approved = sorted.filter((d) => d.state === STATES.APPROVED).length;
            const total = sorted.length;
            const pct = Math.round((approved / total) * 100);
            const _d = new Date();
            const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
            const stateColors = {
              [STATES.ASSIGNED]:  { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b', label: 'Pending' },
              [STATES.SNOOZED]:   { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', label: 'Snoozed' },
              [STATES.COMPLETED]: { bg: '#fef9c3', border: '#fbbf24', text: '#713f12', label: 'Awaiting' },
              [STATES.APPROVED]:  { bg: '#dcfce7', border: '#4ade80', text: '#14532d', label: 'Approved' },
              [STATES.DENIED]:    { bg: '#fee2e2', border: '#f87171', text: '#7f1d1d', label: 'Missed'   },
            };
            return (
              <div key={tgId} className={styles.trackerCard}>
                {/* Header — tappable to collapse */}
                <button
                  className={styles.trackerCardHeader}
                  onClick={() => toggleTracker(tgId)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', padding: '1rem' }}
                >
                  <div className={styles.trackerAvatar}>{first.memberName?.charAt(0).toUpperCase()}</div>
                  <div className={styles.trackerInfo}>
                    <div className={styles.trackerMember}>{first.memberName}</div>
                    <div className={styles.trackerGroup}>📊 {first.groupName} — Daily Tracker</div>
                    <div className={styles.trackerDateRange}>
                      {sorted[0].assignedDate} → {sorted[sorted.length - 1].assignedDate}
                    </div>
                  </div>
                  <div className={styles.trackerScoreBadge}>
                    <span className={styles.trackerScoreNum}>{approved}/{total}</span>
                    <span className={styles.trackerScoreLabel}>approved</span>
                  </div>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>{expandedTrackers.has(tgId) ? '▲' : '▼'}</span>
                </button>

                {expandedTrackers.has(tgId) && (<>

                {/* Progress bar */}
                <div className={styles.trackerProgressWrap}>
                  <div className={styles.trackerProgressBar}>
                    <div className={styles.trackerProgressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.trackerProgressPct}>{pct}%</span>
                </div>

                {/* Tracker Edit/Delete controls */}
                {editingTrackerId === tgId ? (
                  <div className={styles.editForm}>
                    <div className={styles.editRow}>
                      <div className={styles.editField}>
                        <label className={styles.editLabel}>⏰ Start</label>
                        <input type="time" className={styles.editInput} value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                      </div>
                      <div className={styles.editField}>
                        <label className={styles.editLabel}>🏁 End</label>
                        <input type="time" className={styles.editInput} value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                      </div>
                    </div>
                    <div className={styles.editRow}>
                      <span className={styles.editLabel}>⏱ Remind every</span>
                      <div className={styles.intervalBtns}>
                        {[2,5,10,15].map((m) => (
                          <button key={m} className={`${styles.intervalBtn} ${editInterval === m ? styles.intervalActive : ''}`} onClick={() => setEditInterval(m)}>{m}m</button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.editRow}>
                      <span className={styles.editLabel}>🔊 Voice</span>
                      <button className={`${styles.toggleBtn} ${editVoice ? styles.toggleOn : styles.toggleOff}`} onClick={() => setEditVoice((v) => !v)}>
                        {editVoice ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.saveBtn} disabled={acting} onClick={() => handleSaveTrackerEdit(sorted)}>💾 Save All Days</button>
                      <button className={styles.cancelBtn} onClick={() => setEditingTrackerId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.metaRow}>
                    <span className={styles.metaChip}>⏱ {first.alarmInterval || 5} min alarm</span>
                    <span className={styles.metaChip}>{first.voiceEnabled !== false ? '🔊 Voice ON' : '🔇 Voice OFF'}</span>
                    <button className={styles.editBtn} onClick={() => { setEditingTrackerId(tgId); setEditStart(first.timeStart || '08:00'); setEditEnd(first.timeEnd || '09:00'); setEditInterval(first.alarmInterval || 5); setEditVoice(first.voiceEnabled !== false); }}>✏️ Edit</button>
                    <button className={styles.deleteBtn} disabled={acting} onClick={() => handleDeleteTrackerGroup(sorted)}>🗑</button>
                  </div>
                )}

                {/* Day rows */}
                <div className={styles.trackerRows}>
                  {(() => {
                    const _yd2 = new Date(); _yd2.setDate(_yd2.getDate() - 1);
                    const yesterday2 = `${_yd2.getFullYear()}-${String(_yd2.getMonth()+1).padStart(2,'0')}-${String(_yd2.getDate()).padStart(2,'0')}`;
                    const hasTodayExact = sorted.some((d) => d.assignedDate === today && d.state !== STATES.DENIED);
                    const activeDay = sorted.find((d) => d.assignedDate === today && d.state !== STATES.DENIED) ||
                      (!hasTodayExact ? sorted.find((d) => d.assignedDate === yesterday2 && d.state !== STATES.DENIED) : null) ||
                      null;
                    return sorted.map((day) => {
                      const sc = stateColors[day.state] || stateColors[STATES.ASSIGNED];
                      const isToday = activeDay ? day.id === activeDay.id : false;
                      const displayDate = isToday ? today : day.assignedDate;
                      return (
                        <React.Fragment key={day.id}>
                        <div
                          className={styles.trackerRow}
                          style={{ background: sc.bg, borderLeft: `4px solid ${sc.border}` }}
                        >
                          <div className={styles.trackerRowLeft}>
                            <span className={styles.trackerRowDay}>
                              {dayLabel(displayDate)}
                              {isToday && <span className={styles.todayBadge}>Today</span>}
                            </span>
                            <span className={styles.trackerRowDate}>{displayDate}</span>
                          </div>
                          <span className={styles.trackerRowStatus} style={{ color: sc.text }}>
                            {sc.label}
                          </span>
                          <button
                              className={styles.trackerApproveBtn}
                              style={{ background: '#e0e7ff', color: '#3730a3' }}
                              onClick={async () => {
                                if (expandedDayId === day.id) { setExpandedDayId(null); return; }
                                setExpandedDayTasks([]);
                                setExpandedDayLoading(true);
                                setExpandedDayId(day.id);
                                const t = await getAssignmentTasks(day.id);
                                setExpandedDayTasks(t);
                                setExpandedDayLoading(false);
                              }}
                            >👁 View</button>
                          {day.state === STATES.COMPLETED && (
                            <button
                              className={styles.trackerApproveBtn}
                              disabled={acting}
                              onClick={() => handleAction(day.id, STATES.APPROVED)}
                            >✅ Approve</button>
                          )}
                          {day.state === STATES.APPROVED && (
                            <button
                              className={styles.trackerDenyBtn}
                              disabled={acting}
                              onClick={() => handleAction(day.id, STATES.DENIED)}
                            >❌ Deny</button>
                          )}
                        </div>
                        {expandedDayId === day.id && (
                          <div className={styles.expanded} style={{ margin: '0 0 8px', borderRadius: '8px' }}>
                            {expandedDayLoading ? (
                              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Loading tasks…</p>
                            ) : (
                              <div className={styles.taskList}>
                                {expandedDayTasks.length === 0
                                  ? <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No tasks found.</p>
                                  : expandedDayTasks.map((t) => (
                                    <div key={t.id} className={styles.taskRow}>
                                      <span>{t.completed ? '✅' : '☐'}</span>
                                      <span className={styles.tName}>{t.taskName}</span>
                                    </div>
                                  ))
                                }
                              </div>
                            )}
                            {day.photoUrl && (
                              <div className={styles.photoWrap}>
                                <p className={styles.photoLabel}>📸 Photo Proof</p>
                                <img className={styles.photo} src={day.photoUrl} alt="proof" />
                              </div>
                            )}
                          </div>
                        )}
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              </>)}
              </div>
            );
          })}

          {/* ── Normal assignments ── */}
          {normalAssignments.map((a) => {
            const meta = STATE_LABEL[a.state] || STATE_LABEL[STATES.ASSIGNED];
            const isExpanded = expanded === a.id;
            return (
              <div key={a.id} className={styles.card}>
                <button className={styles.cardHeader} onClick={() => handleExpand(a)}>
                  <div className={styles.cardLeft}>
                    <div className={styles.avatar}>
                      {a.memberName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.memberName}>{a.memberName}</div>
                      {a.memberEmail ? <div className={styles.memberEmail}>{a.memberEmail}</div> : null}
                      <div className={styles.groupName}>{a.groupName}</div>
                      <div className={styles.dateRow}>
                        {a.assignType === 'daily'
                          ? `📅 ${a.assignedDate}`
                          : `📆 ${a.weekStart} – ${a.weekEnd}`}
                        {a.timeStart && a.timeEnd
                          ? `  ⏰ ${to12h(a.timeStart)} – ${to12h(a.timeEnd)}`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <span
                    className={styles.stateBadge}
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {meta.label}
                  </span>
                </button>

                {isExpanded && (
                  <div className={styles.expanded}>
                    {/* Edit form */}
                    {editingId === a.id ? (
                      <div className={styles.editForm}>
                        <div className={styles.editRow}>
                          <div className={styles.editField}>
                            <label className={styles.editLabel}>⏰ Start</label>
                            <input type="time" className={styles.editInput} value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                          </div>
                          <div className={styles.editField}>
                            <label className={styles.editLabel}>🏁 End</label>
                            <input type="time" className={styles.editInput} value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                          </div>
                        </div>
                        <div className={styles.editRow}>
                          <span className={styles.editLabel}>⏱ Remind every</span>
                          <div className={styles.intervalBtns}>
                            {[2,5,10,15].map((m) => (
                              <button key={m} className={`${styles.intervalBtn} ${editInterval === m ? styles.intervalActive : ''}`} onClick={() => setEditInterval(m)}>{m}m</button>
                            ))}
                          </div>
                        </div>
                        <div className={styles.editRow}>
                          <span className={styles.editLabel}>🔊 Voice</span>
                          <button className={`${styles.toggleBtn} ${editVoice ? styles.toggleOn : styles.toggleOff}`} onClick={() => setEditVoice((v) => !v)}>
                            {editVoice ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        <div className={styles.editActions}>
                          <button className={styles.saveBtn} disabled={acting} onClick={() => handleSaveEdit(a.id)}>💾 Save</button>
                          <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
                        </div>

                        {/* Task list with add/delete */}
                        <div className={styles.editTaskSection}>
                          <p className={styles.editLabel}>📋 Tasks</p>
                          <div className={styles.editTaskList}>
                            {expandedTasks.map((t) => (
                              <div key={t.id} className={styles.editTaskRow}>
                                <span className={styles.editTaskName}>{t.taskName}</span>
                                <button
                                  className={styles.deleteTaskBtn}
                                  onClick={() => handleDeleteTask(t.id)}
                                >🗑</button>
                              </div>
                            ))}
                          </div>
                          <div className={styles.addTaskRow}>
                            <input
                              className={styles.addTaskInput}
                              placeholder="New task name…"
                              value={newTaskName}
                              onChange={(e) => setNewTaskName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddTask(a.id)}
                            />
                            <button
                              className={styles.addTaskBtn}
                              onClick={() => handleAddTask(a.id)}
                            >+ Add</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.metaRow}>
                        <span className={styles.metaChip}>⏱ {a.alarmInterval || 5} min alarm</span>
                        <span className={styles.metaChip}>{a.voiceEnabled !== false ? '🔊 Voice ON' : '🔇 Voice OFF'}</span>
                        <button className={styles.editBtn} onClick={() => startEdit(a)}>✏️ Edit</button>
                        <button className={styles.deleteBtn} disabled={acting} onClick={() => handleDelete(a.id)}>🗑</button>
                      </div>
                    )}

                    {/* Tasks */}
                    <div className={styles.taskList}>
                      {expandedTasks.map((t) => (
                        <div key={t.id} className={styles.taskRow}>
                          <span>{t.completed ? '✅' : '☐'}</span>
                          <span className={styles.tName}>{t.taskName}</span>
                        </div>
                      ))}
                    </div>

                    {/* Photo proof */}
                    {a.photoUrl && (
                      <div className={styles.photoWrap}>
                        <p className={styles.photoLabel}>📸 Photo Proof</p>
                        <img
                          className={styles.photo}
                          src={a.photoUrl}
                          alt="proof"
                        />
                      </div>
                    )}

                    {/* Actions — only for completed */}
                    {a.state === STATES.COMPLETED && (
                      <div className={styles.actions}>
                        <button
                          className={styles.approveBtn}
                          disabled={acting}
                          onClick={() => handleAction(a.id, STATES.APPROVED)}
                        >
                          ✅ Approve
                        </button>
                        <button
                          className={styles.denyBtn}
                          disabled={acting}
                          onClick={() => handleAction(a.id, STATES.DENIED)}
                        >
                          ❌ Deny
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
