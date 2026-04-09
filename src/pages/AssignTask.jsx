import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getGroupTasks,
  addGroupTask,
  createAssignment,
  STATES,
} from '../api/api';
import styles from './AssignTask.module.css';

function getWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const sat = new Date(mon);
  sat.setDate(mon.getDate() + 5);
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  return { weekStart: fmt(mon), weekEnd: fmt(sat) };
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AssignTask() {
  const { familyId, memberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const memberName = location.state?.memberName || 'Member';
  const familyName = location.state?.familyName || '';
  const memberEmail = location.state?.memberEmail || '';
  const groupId = location.state?.groupId || 'morning-preparation';
  const groupName = location.state?.groupName || 'Morning Preparation';
  const groupIcon = location.state?.groupIcon || '🌅';

  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState({});
  const [assignType, setAssignType] = useState('daily'); // 'daily' | 'weekly' | 'tracker'
  const [assignedDate, setAssignedDate] = useState(todayStr());
  const [trackerStart, setTrackerStart] = useState(todayStr());
  const [trackerEnd, setTrackerEnd] = useState(todayStr());
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState('09:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [alarmInterval, setAlarmInterval] = useState(5);
  const [newTaskName, setNewTaskName] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const { weekStart, weekEnd } = getWeekRange();

  useEffect(() => {
    getGroupTasks(groupId)
      .then(setTasks)
      .catch(() => setError('Failed to load tasks.'))
      .finally(() => setLoading(false));
  }, [groupId]);

  function toggleTask(id) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAll() {
    const all = {};
    tasks.forEach((t) => (all[t.id] = true));
    setSelected(all);
  }

  async function handleAddTask() {
    const name = newTaskName.trim();
    if (!name) return;
    setAddingTask(true);
    try {
      const ref = await addGroupTask(groupId, name, tasks.length);
      const newTask = { id: ref.id, groupId, taskName: name, order: tasks.length };
      setTasks((prev) => [...prev, newTask]);
      setSelected((prev) => ({ ...prev, [ref.id]: true }));
      setNewTaskName('');
      setShowAddTask(false);
    } catch (err) {
      console.error(err);
      setError('Failed to add task.');
    } finally {
      setAddingTask(false);
    }
  }

  async function handleAssign() {
    setError('');
    const selectedIds = tasks.filter((t) => selected[t.id]).map((t) => t.id);
    const selectedNames = tasks.filter((t) => selected[t.id]).map((t) => t.taskName);

    if (selectedIds.length === 0) {
      setError('Please select at least one task.');
      return;
    }
    if (!timeStart || !timeEnd) {
      setError('Please set a start and end time.');
      return;
    }
    if (timeEnd <= timeStart) {
      setError('End time must be after start time.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (assignType === 'tracker') {
        // Create one assignment per day in the range
        const trackerGroupId = `tracker-${memberId}-${groupId}-${trackerStart}`;
        const start = new Date(trackerStart + 'T00:00:00');
        const end = new Date(trackerEnd + 'T00:00:00');
        if (end < start) { setError('End date must be after start date.'); setSaving(false); return; }
        const days = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
        }
        for (const day of days) {
          await createAssignment({
            memberId, memberName, memberEmail, familyId, groupId, groupName,
            assignType: 'tracker',
            assignedDate: day,
            weekStart: null, weekEnd: null,
            timeStart, timeEnd, voiceEnabled, alarmInterval,
            selectedTaskIds: selectedIds, selectedTaskNames: selectedNames,
            trackerGroupId,
          });
        }
      } else {
        await createAssignment({
          memberId, memberName, memberEmail, familyId, groupId, groupName,
          assignType,
          assignedDate: assignType === 'daily' ? assignedDate : null,
          weekStart: assignType === 'weekly' ? weekStart : null,
          weekEnd: assignType === 'weekly' ? weekEnd : null,
          timeStart, timeEnd, voiceEnabled, alarmInterval,
          selectedTaskIds: selectedIds, selectedTaskNames: selectedNames,
        });
      }
      navigate(`/family/${familyId}`);
    } catch (err) {
      console.error('Assign error:', err);
      setError(`Failed: ${err.code || ''} ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className={styles.center}><p className={styles.loadingText}>Loading tasks…</p></div>;
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={() => navigate(`/family/${familyId}`)}>
        ‹ Back
      </button>

      <div className={styles.header}>
        <div className={styles.groupIcon}>{groupIcon}</div>
        <h2 className={styles.title}>{groupName}</h2>
        <p className={styles.subtitle}>Assigning to <strong>{memberName}</strong></p>
        {memberEmail ? <p className={styles.subtitle}>{memberEmail}</p> : null}
      </div>

      {/* Assign type toggle */}
      <div className={styles.typeToggle}>
        <button
          className={`${styles.typeBtn} ${assignType === 'daily' ? styles.typeActive : ''}`}
          onClick={() => setAssignType('daily')}
        >
          📅 Daily
        </button>
        <button
          className={`${styles.typeBtn} ${assignType === 'weekly' ? styles.typeActive : ''}`}
          onClick={() => setAssignType('weekly')}
        >
          📆 Weekly
        </button>
        <button
          className={`${styles.typeBtn} ${assignType === 'tracker' ? styles.typeActive : ''}`}
          onClick={() => setAssignType('tracker')}
        >
          📊 Daily Tracker
        </button>
      </div>

      {/* Date picker for daily */}
      {assignType === 'daily' && (
        <div className={styles.datePicker}>
          <label className={styles.dateLabel}>Select Day</label>
          <input
            type="date"
            className={styles.dateInput}
            value={assignedDate}
            min={todayStr()}
            onChange={(e) => setAssignedDate(e.target.value)}
          />
        </div>
      )}

      {/* Week range for weekly */}
      {assignType === 'weekly' && (
        <div className={styles.weekInfo}>
          <span>📅 Mon {weekStart}</span>
          <span>→</span>
          <span>Sat {weekEnd}</span>
        </div>
      )}

      {/* Date range for tracker */}
      {assignType === 'tracker' && (
        <div className={styles.trackerRange}>
          <p className={styles.trackerHint}>📊 Receiver must complete tasks <strong>every day</strong> in this range</p>
          <div className={styles.trackerDates}>
            <div className={styles.timeField}>
              <label className={styles.dateLabel}>From Date</label>
              <input type="date" className={styles.dateInput} value={trackerStart} min={todayStr()} onChange={(e) => setTrackerStart(e.target.value)} />
            </div>
            <div className={styles.timeField}>
              <label className={styles.dateLabel}>To Date</label>
              <input type="date" className={styles.dateInput} value={trackerEnd} min={trackerStart} onChange={(e) => setTrackerEnd(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Voice toggle */}
      <div className={styles.voiceToggle}>
        <span className={styles.voiceLabel}>🔊 Voice Alarm</span>
        <button
          className={`${styles.toggleBtn} ${voiceEnabled ? styles.toggleOn : styles.toggleOff}`}
          onClick={() => setVoiceEnabled((v) => !v)}
        >
          {voiceEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Alarm interval */}
      {voiceEnabled && (
        <div className={styles.alarmRow}>
          <span className={styles.alarmLabel}>⏱ Remind every</span>
          <div className={styles.alarmBtns}>
            {[1, 2, 5, 10, 15].map((min) => (
              <button
                key={min}
                className={`${styles.alarmBtn} ${alarmInterval === min ? styles.alarmActive : ''}`}
                onClick={() => setAlarmInterval(min)}
              >
                {min} min
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time limit */}
      <div className={styles.timePicker}>
        <div className={styles.timeField}>
          <label className={styles.dateLabel}>⏰ Start Time</label>
          <input
            type="time"
            className={styles.dateInput}
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
          />
        </div>
        <div className={styles.timeField}>
          <label className={styles.dateLabel}>🏁 End Time (Deadline)</label>
          <input
            type="time"
            className={styles.dateInput}
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
          />
        </div>
      </div>

      {/* Task list */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Select Tasks</h3>
          <button className={styles.selectAllBtn} onClick={selectAll}>
            Select All
          </button>
        </div>

        <div className={styles.taskList}>
          {tasks.map((task) => (
            <button
              key={task.id}
              className={`${styles.taskCard} ${selected[task.id] ? styles.taskSelected : ''}`}
              onClick={() => toggleTask(task.id)}
            >
              <span className={styles.checkbox}>
                {selected[task.id] ? '✅' : '☐'}
              </span>
              <span className={styles.taskName}>{task.taskName}</span>
            </button>
          ))}
        </div>

        {/* Add custom task */}
        {showAddTask ? (
          <div className={styles.addTaskRow}>
            <input
              className={styles.addTaskInput}
              type="text"
              placeholder="Task name…"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              autoFocus
              maxLength={60}
              disabled={addingTask}
            />
            <button
              className={styles.addTaskSave}
              onClick={handleAddTask}
              disabled={addingTask || !newTaskName.trim()}
            >
              {addingTask ? '…' : 'Add'}
            </button>
            <button
              className={styles.addTaskCancel}
              onClick={() => { setShowAddTask(false); setNewTaskName(''); }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button className={styles.addTaskBtn} onClick={() => setShowAddTask(true)}>
            + Add Custom Task
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.assignBtn}
        onClick={handleAssign}
        disabled={saving || selectedCount === 0}
      >
        {saving ? 'Assigning…' : `Assign ${selectedCount > 0 ? selectedCount + ' Task' + (selectedCount > 1 ? 's' : '') : 'Tasks'}`}
      </button>
    </div>
  );
}
