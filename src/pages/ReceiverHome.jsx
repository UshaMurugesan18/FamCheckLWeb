import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import {
  subscribeToAssignmentsByMember,
  getAssignmentTasks,
  toggleAssignmentTask,
  snoozeAssignment,
  completeAssignment,
  updateAssignmentState,
  registerPushSubscription,
  scheduleAlarms,
  STATES,
  MAX_SNOOZES,
} from '../api/api';
import styles from './ReceiverHome.module.css';

const ALARM_INTERVAL_MS = 5 * 60 * 1000;

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function to12h(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function isInActiveWindow(timeStart, timeEnd) {
  if (!timeStart || !timeEnd) return true;
  const now = new Date();
  const [sh, sm] = timeStart.split(':').map(Number);
  const [eh, em] = timeEnd.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
}

function isPastDeadline(timeEnd) {
  if (!timeEnd) return false;
  const now = new Date();
  const [eh, em] = timeEnd.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= eh * 60 + em;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  // Small delay so cancel() completes before new utterance starts
  setTimeout(() => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.85;
    utt.volume = 1;
    // Use en-IN if available, otherwise fall back to any English voice or default
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.lang === 'en-IN')
      || voices.find((v) => v.lang.startsWith('en'))
      || null;
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.speak(utt);
  }, 100);
}

const GROUP_ICONS = {
  'morning-preparation': '🌅',
  'evening-routine': '🌇',
  bedtime: '🌙',
  homework: '📚',
};

function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Alarm Popup Overlay ────────────────────────────────────────────────────
function AlarmPopup({ popup, onSnooze, onClose, onSpeak }) {
  if (!popup) return null;
  const { assignment, pendingTasks } = popup;
  const snoozesLeft = MAX_SNOOZES - (assignment.snoozeCount || 0);

  return (
    <div className={styles.popupOverlay}>
      <div className={styles.popupBox}>
        <div className={styles.popupIcon}>{assignment.groupIcon || '🔔'}</div>
        <h2 className={styles.popupTitle}>Time to complete your tasks!</h2>
        <p className={styles.popupGroup}>{assignment.groupName}</p>
        <div className={styles.popupTaskList}>
          {pendingTasks.map((t) => (
            <div key={t.id} className={styles.popupTask}>
              <span>⬜</span>
              <span>{t.taskName}</span>
            </div>
          ))}
        </div>
        <div className={styles.popupActions}>
          <button className={styles.popupSpeak} onClick={() => onSpeak(popup)}>
            🔊 Read aloud
          </button>
          {snoozesLeft > 0 && (
            <button className={styles.popupSnooze} onClick={() => onSnooze(popup)}>
              😴 Snooze {assignment.alarmInterval || 5} min ({snoozesLeft} left)
            </button>
          )}
          <button className={styles.popupClose} onClick={onClose}>
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Receiver Tracker Group Card ─────────────────────────────────────────────
function ReceiverTrackerCard({ trackerDays, alarmUnlocked, onAlarm }) {
  const today = todayStr();
  const [expanded, setExpanded] = useState(true);

  const sorted = [...trackerDays].sort((a, b) => a.assignedDate.localeCompare(b.assignedDate));
  const first = sorted[0];
  const approved = sorted.filter((a) => a.state === STATES.APPROVED).length;
  const total = sorted.length;
  const pct = Math.round((approved / total) * 100);
  const icon = first.groupIcon || GROUP_ICONS[first.groupId] || '📊';

  // Active day: non-denied day for today; fall back to yesterday only if no exact match (UTC-stored date bug)
  const _yd = new Date(); _yd.setDate(_yd.getDate() - 1);
  const yesterday = `${_yd.getFullYear()}-${String(_yd.getMonth()+1).padStart(2,'0')}-${String(_yd.getDate()).padStart(2,'0')}`;
  const hasTodayExact = sorted.some((a) => a.assignedDate === today && a.state !== STATES.DENIED);
  const activeDay = sorted.find((a) => a.assignedDate === today && a.state !== STATES.DENIED) ||
    (!hasTodayExact ? sorted.find((a) => a.assignedDate === yesterday && a.state !== STATES.DENIED) : null) ||
    null;

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const rowColors = {
    [STATES.APPROVED]:  { bg: '#dcfce7', border: '#4ade80', text: '#16a34a', label: 'Approved ✅' },
    [STATES.COMPLETED]: { bg: '#fef9c3', border: '#fbbf24', text: '#92400e', label: 'Submitted 🟡' },
    [STATES.DENIED]:    { bg: '#fee2e2', border: '#f87171', text: '#dc2626', label: 'Missed ❌' },
    [STATES.SNOOZED]:   { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', label: 'Snoozed ⏸' },
    [STATES.ASSIGNED]:  { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b', label: 'Pending' },
  };

  return (
    <div className={styles.receiverTrackerCard}>
      {/* Header — tappable to collapse */}
      <button className={styles.receiverTrackerHeader} onClick={() => setExpanded((v) => !v)}>
        <span className={styles.receiverTrackerIcon}>{icon}</span>
        <div className={styles.receiverTrackerInfo}>
          <span className={styles.receiverTrackerTitle}>{first.groupName}</span>
          <span className={styles.receiverTrackerSub}>📊 Daily Tracker · {approved}/{total} days done</span>
        </div>
        <span className={styles.receiverTrackerPct}>{pct}%</span>
        <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (<>
      {/* Progress bar */}
      <div className={styles.rtProgressWrap}>
        <div className={styles.rtProgressBar}>
          <div className={styles.rtProgressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Day rows */}
      <div className={styles.rtRows}>
        {sorted.map((day) => {
          const isActive = activeDay ? day.id === activeDay.id : false;
          const isFuture = day.assignedDate > today;
          const rc = rowColors[day.state] || rowColors[STATES.ASSIGNED];
          // If this is today's row but was stored with wrong UTC date, show real today date
          const displayDate = isActive ? today : day.assignedDate;
          const dayName = DAY_LABELS[new Date(displayDate + 'T00:00:00').getDay()];

          return (
            <div key={day.id}>
              <div
                className={styles.rtRow}
                style={{ background: rc.bg, borderLeft: `4px solid ${isActive ? '#4f63d2' : rc.border}` }}
              >
                <div className={styles.rtRowLeft}>
                  <span className={styles.rtRowDay}>
                    {dayName}
                    {isActive && <span className={styles.rtTodayBadge}>Today</span>}
                    {isFuture && <span className={styles.rtFutureBadge}>Upcoming</span>}
                  </span>
                  <span className={styles.rtRowDate}>{displayDate}</span>
                </div>
                <span className={styles.rtRowStatus} style={{ color: rc.text }}>{rc.label}</span>
              </div>

              {/* Today's task area — embedded inline */}
              {isActive && (
                <AssignmentCard
                  assignment={day}
                  alarmUnlocked={alarmUnlocked}
                  onAlarm={onAlarm}
                  allAssignments={trackerDays}
                  embedded
                />
              )}
            </div>
          );
        })}
      </div>
      </>)}
    </div>
  );
}

// ── Single Assignment Card ──────────────────────────────────────────────────
function AssignmentCard({ assignment: initAssignment, alarmUnlocked, onAlarm, allAssignments, embedded }) {
  const TASKS_KEY = `fc_tasks_${initAssignment.id}`;

  // Load tasks from cache synchronously — no loading flash
  function getCachedTasks() {
    try {
      const c = localStorage.getItem(TASKS_KEY);
      return c ? JSON.parse(c) : [];
    } catch (_) { return []; }
  }

  const [assignment, setAssignment] = useState(initAssignment);
  const [tasks, setTasks] = useState(getCachedTasks);
  const [loadingTasks, setLoadingTasks] = useState(tasks.length === 0); // only show spinner if nothing cached
  const [expanded, setExpanded] = useState(true);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [alarmActive, setAlarmActive] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const alarmRef = useRef(null);
  const alarmFiredRef = useRef(false); // prevent re-firing after dismiss

  useEffect(() => {
    getAssignmentTasks(assignment.id)
      .then((t) => {
        try { localStorage.setItem(TASKS_KEY, JSON.stringify(t)); } catch (_) {}
        setTasks(t);
      })
      .finally(() => setLoadingTasks(false));
  }, [assignment.id]);

  // Auto-deny
  useEffect(() => {
    if (!assignment || assignment.state === STATES.COMPLETED || assignment.state === STATES.APPROVED) return;
    const today = todayStr();
    // Weekly: only deny if the entire week has passed
    if (assignment.assignType === 'weekly') {
      if (!assignment.weekEnd || today <= assignment.weekEnd) return;
      updateAssignmentState(assignment.id, STATES.DENIED)
        .then(() => setAssignment((a) => ({ ...a, state: STATES.DENIED })));
      return;
    }
    // Tracker: only deny if more than 1 day in the past
    if (assignment.assignType === 'tracker') {
      if (!assignment.assignedDate) return;
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (assignment.assignedDate >= yesterday) return;
      if (isPastDeadline(assignment.timeEnd)) {
        updateAssignmentState(assignment.id, STATES.DENIED)
          .then(() => setAssignment((a) => ({ ...a, state: STATES.DENIED })));
      }
      return;
    }
    // Daily: never auto-deny on client side — server handles expiry
  }, [assignment]);

  // Alarm — only depends on assignment+tasks, NOT alarmUnlocked
  // Voice is triggered by user gesture in ReceiverHome, not here
  useEffect(() => {
    alarmFiredRef.current = false; // reset on new assignment/tasks
    if (!assignment || !tasks.length) return;
    if (
      isInActiveWindow(assignment.timeStart, assignment.timeEnd) &&
      (assignment.state === STATES.ASSIGNED || assignment.state === STATES.SNOOZED)
    ) {
      const pending = tasks.filter((t) => !t.completed);
      if (pending.length > 0 && !alarmFiredRef.current) {
        alarmFiredRef.current = true;
        onAlarm({ assignment, pendingTasks: pending });
        setAlarmActive(true);
        setExpanded(true); // auto-expand card so tasks visible after popup closes
      }
      alarmRef.current = setInterval(() => {
        const p = tasks.filter((t) => !t.completed);
        if (p.length === 0) { clearInterval(alarmRef.current); return; }
        alarmFiredRef.current = true;
        onAlarm({ assignment, pendingTasks: p });
        setAlarmActive(true);
        setExpanded(true);
      }, (assignment.alarmInterval || 5) * 60 * 1000);
    }
    return () => clearInterval(alarmRef.current);
  // Use primitive values so 30-second poll (which creates new object refs) doesn't restart the timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment.id, assignment.state, assignment.alarmInterval, assignment.timeStart, assignment.timeEnd, tasks]);

  async function handleToggle(task) {
    const newDone = !task.completed;
    await toggleAssignmentTask(task.id, newDone);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: newDone } : t)));
    if (newDone && assignment.voiceEnabled !== false && alarmUnlocked) speak(`${task.taskName}, done! Great job ${assignment.memberName}!`);
  }

  async function handleSnooze() {
    const newCount = (assignment.snoozeCount || 0) + 1;
    if (newCount > MAX_SNOOZES) { setError(`Max ${MAX_SNOOZES} snoozes used.`); return; }
    window.speechSynthesis.cancel();
    setAlarmActive(false);
    clearInterval(alarmRef.current);
    await snoozeAssignment(assignment.id, newCount);
    setAssignment((a) => ({ ...a, state: STATES.SNOOZED, snoozeCount: newCount }));
  }

  async function handleSubmit() {
    setError('');
    if (!tasks.every((t) => t.completed)) { setError('Complete all tasks first.'); return; }
    // photo is optional — allow submit without it
    setSubmitting(true);
    try {
      let compressed = null;
      if (photoFile) {
        compressed = await compressImage(photoFile, 400, 0.4);
      }
      await completeAssignment(assignment.id, compressed);
      window.speechSynthesis.cancel();
      clearInterval(alarmRef.current);
      if (assignment.voiceEnabled !== false && alarmUnlocked) {
        speak(`Well done ${assignment.memberName}! All things are ready and sent to your creator.`);
      }
      setAssignment((a) => ({ ...a, state: STATES.COMPLETED }));
    } catch (err) {
      setError('Submit failed: ' + (err.message || 'please try again'));
    } finally {
      setSubmitting(false);
    }
  }

  const icon = assignment.groupIcon || GROUP_ICONS[assignment.groupId] || '📋';
  const completedCount = tasks.filter((t) => t.completed).length;
  const snoozesLeft = MAX_SNOOZES - (assignment.snoozeCount || 0);

  // Tracker context
  const isTracker = assignment.assignType === 'tracker';
  const trackerSiblings = isTracker
    ? [...(allAssignments || [])]
        .filter((a) => a.trackerGroupId === assignment.trackerGroupId)
        .sort((a, b) => a.assignedDate.localeCompare(b.assignedDate))
    : [];
  const trackerDayIndex = isTracker ? trackerSiblings.findIndex((a) => a.id === assignment.id) + 1 : 0;
  const trackerTotal = trackerSiblings.length;
  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const trackerDayName = isTracker
    ? DAY_LABELS[new Date(assignment.assignedDate + 'T00:00:00').getDay()]
    : '';

  const stateColor = {
    [STATES.ASSIGNED]: '#4f63d2',
    [STATES.SNOOZED]: '#d97706',
    [STATES.COMPLETED]: '#059669',
    [STATES.APPROVED]: '#059669',
    [STATES.DENIED]: '#dc2626',
  }[assignment.state] || '#4f63d2';

  const stateLabel = {
    [STATES.ASSIGNED]: 'Assigned',
    [STATES.SNOOZED]: 'Snoozed',
    [STATES.COMPLETED]: 'Submitted ✅',
    [STATES.APPROVED]: 'Approved ✅',
    [STATES.DENIED]: 'Denied ❌',
  }[assignment.state] || assignment.state;

  // In embedded mode (inside ReceiverTrackerCard) — show only the task body, always expanded
  if (embedded) {
    return (
      <div className={styles.embeddedBody}>
        {loadingTasks ? <p className={styles.loadingText}>Loading…</p> : (
          <>
            <div className={styles.progressRow}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%` }} />
              </div>
              <span className={styles.progressText}>{completedCount}/{tasks.length}</span>
            </div>
            <div className={styles.taskList}>
              {tasks.map((task) => (
                <button key={task.id}
                  className={`${styles.taskCard} ${task.completed ? styles.taskDone : ''}`}
                  onClick={() => handleToggle(task)}
                  disabled={assignment.state === STATES.COMPLETED || assignment.state === STATES.APPROVED || assignment.state === STATES.DENIED}
                >
                  <span className={styles.taskCheck}>{task.completed ? '✅' : '☐'}</span>
                  <span className={styles.taskName}>{task.taskName}</span>
                </button>
              ))}
            </div>
            {(assignment.state === STATES.ASSIGNED || assignment.state === STATES.SNOOZED) && (
              <>
                <div className={styles.photoSection}>
                  <p className={styles.photoLabel}>📸 Take a photo of all items</p>
                  <button className={styles.photoBtn} onClick={() => fileRef.current?.click()}>
                    {photoPreview ? 'Retake Photo' : 'Take / Upload Photo'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files[0]; if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); } }}
                  />
                  {photoPreview && <img className={styles.photoPreview} src={photoPreview} alt="proof" />}
                </div>
                {error && <p className={styles.error}>{error}</p>}
                <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit to Creator ›'}
                </button>
              </>
            )}
            {assignment.state === STATES.COMPLETED && <p className={styles.doneMsg}>🎉 Submitted! Waiting for review.</p>}
            {assignment.state === STATES.APPROVED && <p className={styles.doneMsg}>✅ Approved by creator!</p>}
            {assignment.state === STATES.DENIED && <p className={styles.doneMsg} style={{ color: 'var(--color-danger)' }}>❌ Deadline passed.</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      {/* Card header */}
      <button className={styles.cardHeader} onClick={() => setExpanded((v) => !v)}>
        <span className={styles.cardIcon}>{icon}</span>
        <div className={styles.cardMeta}>
          <span className={styles.cardTitle}>
            {assignment.groupName}
          </span>
          {assignment.timeStart && assignment.timeEnd && (
            <span className={styles.cardTime}>⏰ {to12h(assignment.timeStart)} – {to12h(assignment.timeEnd)}</span>
          )}
          {(assignment.state === STATES.ASSIGNED || assignment.state === STATES.SNOOZED) ? (
            <span className={styles.cardProgress}>{completedCount}/{tasks.length} done</span>
          ) : null}
        </div>
        <span className={styles.cardBadge} style={{ color: stateColor }}>{stateLabel}</span>
        <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Alarm strip */}
      {alarmActive && (assignment.state === STATES.ASSIGNED || assignment.state === STATES.SNOOZED) && (
        <div className={styles.alarmStrip}>
          <span>🔔 {snoozesLeft} snooze{snoozesLeft !== 1 ? 's' : ''} left</span>
          {snoozesLeft > 0 && (
            <button className={styles.snoozeBtn} onClick={handleSnooze}>Snooze 5 min</button>
          )}
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className={styles.cardBody}>
          {loadingTasks ? (
            <p className={styles.loadingText}>Loading…</p>
          ) : (
            <>
              {/* Tracker day strip */}
              {isTracker && trackerSiblings.length > 0 && (
                <div className={styles.trackerStrip}>
                  {trackerSiblings.map((s) => {
                    const isThis = s.id === assignment.id;
                    const dotColor =
                      s.state === STATES.APPROVED ? '#22c55e' :
                      s.state === STATES.COMPLETED ? '#f59e0b' :
                      s.state === STATES.DENIED   ? '#ef4444' :
                      isThis                      ? '#4f63d2' : '#cbd5e1';
                    return (
                      <div key={s.id} className={styles.trackerDot} title={s.assignedDate}>
                        <div className={styles.trackerDotCircle} style={{ background: dotColor, border: isThis ? '2.5px solid #1e3a8a' : 'none' }} />
                        <span className={styles.trackerDotLabel}>{DAY_LABELS[new Date(s.assignedDate + 'T00:00:00').getDay()].slice(0,2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Progress bar */}
              <div className={styles.progressRow}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%` }}
                  />
                </div>
                <span className={styles.progressText}>{completedCount}/{tasks.length}</span>
              </div>

              {/* Tasks */}
              <div className={styles.taskList}>
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    className={`${styles.taskCard} ${task.completed ? styles.taskDone : ''}`}
                    onClick={() => handleToggle(task)}
                    disabled={assignment.state === STATES.COMPLETED || assignment.state === STATES.APPROVED || assignment.state === STATES.DENIED}
                  >
                    <span className={styles.taskCheck}>{task.completed ? '✅' : '☐'}</span>
                    <span className={styles.taskName}>{task.taskName}</span>
                  </button>
                ))}
              </div>

              {/* Photo + submit — only for active */}
              {(assignment.state === STATES.ASSIGNED || assignment.state === STATES.SNOOZED) && (
                <>
                  <div className={styles.photoSection}>
                    <p className={styles.photoLabel}>📸 Take a photo of all items</p>
                    <button className={styles.photoBtn} onClick={() => fileRef.current?.click()}>
                      {photoPreview ? 'Retake Photo' : 'Take / Upload Photo'}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files[0];
                        if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); }
                      }}
                    />
                    {photoPreview && <img className={styles.photoPreview} src={photoPreview} alt="proof" />}
                  </div>

                  {error && <p className={styles.error}>{error}</p>}

                  <button
                    className={styles.submitBtn}
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting…' : 'Submit to Creator ›'}
                  </button>
                </>
              )}

              {assignment.state === STATES.COMPLETED && (
                <p className={styles.doneMsg}>🎉 Submitted! Waiting for review.</p>
              )}
              {assignment.state === STATES.APPROVED && (
                <p className={styles.doneMsg}>✅ Approved by creator!</p>
              )}
              {assignment.state === STATES.DENIED && (
                <p className={styles.doneMsg} style={{ color: 'var(--color-danger)' }}>❌ Deadline passed.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ReceiverHome ───────────────────────────────────────────────────────
export default function ReceiverHome() {
  const { memberId } = useParams();

  // Read cache SYNCHRONOUSLY inside useState initializer — loading is false instantly if cache exists
  const CACHE_KEY = `fc_assignments_${memberId}`;
  const [assignments, setAssignments] = useState(() => {
    try { const c = localStorage.getItem(`fc_assignments_${memberId}`); return c ? JSON.parse(c).active : []; } catch (_) { return []; }
  });
  const [allAssignments, setAllAssignments] = useState(() => {
    try { const c = localStorage.getItem(`fc_assignments_${memberId}`); return c ? JSON.parse(c).all : []; } catch (_) { return []; }
  });
  const [loading, setLoading] = useState(() => {
    try { return !localStorage.getItem(`fc_assignments_${memberId}`); } catch (_) { return true; }
  });
  const [apiLoaded, setApiLoaded] = useState(false); // true after first API response — prevents premature "No tasks"
  const initialLoadDone = useRef(!loading); // already loaded if cache hit
  const [alarmUnlocked, setAlarmUnlocked] = useState(false);
  const [alarmPopup, setAlarmPopup] = useState(null);

  // Register for background push notifications (delayed so it doesn't block initial render)
  useEffect(() => {
    const t = setTimeout(() => registerPushSubscription(memberId), 3000);
    return () => clearTimeout(t);
  }, [memberId]);

  // Unlock voice on first tap anywhere — required by Android/iOS
  useEffect(() => {
    function unlock() {
      if (window.speechSynthesis && !alarmUnlocked) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(' ');
        utt.volume = 0;
        window.speechSynthesis.speak(utt);
        setAlarmUnlocked(true);
      }
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    }
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, [alarmUnlocked]);

  // When app comes to foreground (user tapped notification), re-speak active alarm
  useEffect(() => {
    let handle;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && alarmPopup) {
        const { assignment, pendingTasks } = alarmPopup;
        // Small delay to ensure audio context is ready
        setTimeout(() => {
          speak(`Hi ${assignment.memberName}, you have pending tasks: ${pendingTasks.map((t) => t.taskName).join(', ')}`);
        }, 500);
      }
    }).then((h) => { handle = h; });
    return () => { handle?.remove(); };
  }, [alarmPopup]);

  function unlockVoice() {
    if (alarmUnlocked) return;
    // Speak directly inside a user-gesture handler — required by iOS/Android
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(' ');
      utt.volume = 0;
      window.speechSynthesis.speak(utt);
    }
    // Notification API is undefined in Android WebView — guard required
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setAlarmUnlocked(true);
  }

  function showAlarm(popup) {
    setAlarmPopup(popup);
    // Auto-speak when alarm fires (works if user has already interacted with the page)
    if (window.speechSynthesis) {
      const { assignment, pendingTasks } = popup;
      speak(`Hi ${assignment.memberName}, time to complete your tasks: ${pendingTasks.map((t) => t.taskName).join(', ')}`);
    }
    // Browser Notification for background/lock-screen (NOT available in Android WebView)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification(`🔔 ${popup.assignment.groupName}`, {
        body: popup.pendingTasks.map((t) => `• ${t.taskName}`).join('\n'),
        icon: '/icon-192.png',
        tag: popup.assignment.id,
        renotify: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
    }
  }

  function handlePopupSpeak(popup) {
    unlockVoice();
    if (popup && window.speechSynthesis) {
      const { assignment, pendingTasks } = popup;
      speak(`Hi ${assignment.memberName}, today you have to get ready these things: ${pendingTasks.map((t) => t.taskName).join(', ')}`);
    }
  }

  async function handlePopupSnooze(popup) {
    const { assignment } = popup;
    setAlarmPopup(null);
    unlockVoice();
    const newCount = (assignment.snoozeCount || 0) + 1;
    speak(`Snoozed. Alarm will ring again in ${assignment.alarmInterval || 5} minutes.`);
    if (newCount <= MAX_SNOOZES) {
      await snoozeAssignment(assignment.id, newCount);
    }
  }

  function handlePopupClose() {
    const popup = alarmPopup;
    setAlarmPopup(null);
    unlockVoice();
    if (popup) {
      const { assignment, pendingTasks } = popup;
      speak(`Hi ${assignment.memberName}, please complete: ${pendingTasks.map((t) => t.taskName).join(', ')}`);
    }
  }

  useEffect(() => {
    const today = todayStr();
    const d2 = new Date(); d2.setDate(d2.getDate() - 1);
    const yesterday = `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`;
    const d3 = new Date(); d3.setDate(d3.getDate() - 2);
    const twoDaysAgo = `${d3.getFullYear()}-${String(d3.getMonth()+1).padStart(2,'0')}-${String(d3.getDate()).padStart(2,'0')}`;

    const CACHE_KEY = `fc_assignments_${memberId}`;

    function filterActive(all) {
      return all.filter(
        (a) =>
          [STATES.ASSIGNED, STATES.SNOOZED, STATES.COMPLETED, STATES.APPROVED, STATES.DENIED].includes(a.state) &&
          (
            a.assignType === 'tracker' ||
            a.assignedDate === today ||
            a.assignedDate === yesterday ||
            a.assignedDate === twoDaysAgo ||
            (a.weekStart && a.weekEnd && a.weekStart <= today && a.weekEnd >= today)
          )
      );
    }

    // ── Cache read now done in useState initializer above ──

    const unsub = subscribeToAssignmentsByMember(memberId, (all) => {
      const active = filterActive(all);
      setAssignments(active);
      setAllAssignments(all);
      scheduleAlarms(active);
      // Save to cache for next open
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ active, all })); } catch (_) {}
      setApiLoaded(true);
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }, () => {
      setApiLoaded(true);
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    });
    return () => unsub();
  }, [memberId]);

  if (loading) {
    return (
      <div className={styles.center}>
        <p className={styles.loadingText}>Loading your tasks…</p>
      </div>
    );
  }

  // Don't show "No tasks" until API has confirmed — avoids blank flash on slow Railway cold start
  if (assignments.length === 0 && !apiLoaded) {
    return (
      <div className={styles.center}>
        <p className={styles.loadingText}>Loading your tasks…</p>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className={styles.center}>
        <div className={styles.noTask}>
          <div className={styles.noTaskIcon}>✅</div>
          <h2>No tasks today!</h2>
          <p>You are all caught up.</p>
        </div>
      </div>
    );
  }

  // Group tracker assignments by trackerGroupId (fallback key if field missing)
  const trackerGroups = {};
  const normalAssignments = [];
  for (const a of assignments) {
    if (a.assignType === 'tracker') {
      const tgKey = a.trackerGroupId || `${a.memberId}-${a.groupId}-tracker`;
      if (!trackerGroups[tgKey]) trackerGroups[tgKey] = [];
      trackerGroups[tgKey].push(a);
    } else {
      normalAssignments.push(a);
    }
  }

  return (
    <div className={styles.container}>
      <AlarmPopup popup={alarmPopup} onSnooze={handlePopupSnooze} onClose={handlePopupClose} onSpeak={handlePopupSpeak} />
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>My Tasks</h2>
        <p className={styles.pageSubtitle}>Tap a group to expand</p>
      </div>
      <div className={styles.cardList}>
        {/* Tracker group cards */}
        {Object.entries(trackerGroups).map(([tgId, days]) => (
          <ReceiverTrackerCard key={tgId} trackerDays={days} alarmUnlocked={alarmUnlocked} onAlarm={showAlarm} />
        ))}
        {/* Normal daily/weekly cards */}
        {normalAssignments.map((a) => (
          <AssignmentCard key={a.id} assignment={a} alarmUnlocked={alarmUnlocked} onAlarm={showAlarm} allAssignments={allAssignments} />
        ))}
      </div>
    </div>
  );
}
