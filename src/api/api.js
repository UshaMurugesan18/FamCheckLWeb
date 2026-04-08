// Spring Boot API client — replaces firebase/firestore.js
// Switch BASE_URL to your Railway URL when deployed

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const ROLES = { CREATOR: 1, RECEIVER: 2 };
export const STATES = {
  ASSIGNED:  "assigned",
  SNOOZED:   "snoozed",
  COMPLETED: "completed",
  APPROVED:  "approved",
  DENIED:    "denied",
};
export const MAX_SNOOZES = 3;

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

// ── Families ────────────────────────────────────────────────────────────────
export const getFamily = (id) => api(`/api/families/${id}`);
export const getFamilies = () => api(`/api/families`);
export const addFamily = (familyName) => api(`/api/families`, { method: "POST", body: JSON.stringify({ familyName }) });
export const createFamilyWithCreator = ({ familyName, creatorName, email }) =>
  api(`/api/families/setup`, { method: "POST", body: JSON.stringify({ familyName, creatorName, email }) });

// ── Members ─────────────────────────────────────────────────────────────────
export const getMembersByFamily = (familyId) => api(`/api/families/${familyId}/members`);
export const getMembers = () => api(`/api/members`);
export const getMemberByEmail = (email) => api(`/api/members/by-email?email=${encodeURIComponent(email)}`);
export const addMember = ({ member, role, familyId, email }) =>
  api(`/api/members`, { method: "POST", body: JSON.stringify({ member, role, familyId, email }) });

// ── Task Groups ──────────────────────────────────────────────────────────────
export const getTaskGroups = () => api(`/api/task-groups`);
export const addTaskGroup = (name, icon) =>
  api(`/api/task-groups`, { method: "POST", body: JSON.stringify({ name, icon }) });

// ── Group Tasks ──────────────────────────────────────────────────────────────
export const getGroupTasks = (groupId) => api(`/api/task-groups/${groupId}/tasks`);
export const addGroupTask = (groupId, taskName, order) =>
  api(`/api/task-groups/${groupId}/tasks`, { method: "POST", body: JSON.stringify({ taskName, order }) });

// ── Assignments ──────────────────────────────────────────────────────────────
export const getAssignmentsByMember = (memberId) => api(`/api/assignments/member/${memberId}`);
export const getAssignmentsByFamily = (familyId) => api(`/api/assignments/family/${familyId}`);

export async function createAssignment({
  memberId, memberName, memberEmail, familyId, groupId, groupName,
  assignType, assignedDate, weekStart, weekEnd, trackerGroupId,
  timeStart, timeEnd, voiceEnabled, alarmInterval,
  selectedTaskIds, selectedTaskNames,
}) {
  const tasks = (selectedTaskIds || []).map((id, i) => ({
    taskId: id,
    taskName: selectedTaskNames[i],
  }));
  return api(`/api/assignments`, {
    method: "POST",
    body: JSON.stringify({
      memberId, memberName, memberEmail, familyId, groupId, groupName,
      assignType, assignedDate, weekStart, weekEnd, trackerGroupId,
      timeStart, timeEnd, voiceEnabled, alarmInterval, tasks,
    }),
  });
}

export const updateAssignmentState = (id, state) =>
  api(`/api/assignments/${id}/state`, { method: "PATCH", body: JSON.stringify({ state }) });

export const updateAssignment = (id, data) =>
  api(`/api/assignments/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteAssignment = (id) =>
  api(`/api/assignments/${id}`, { method: "DELETE" });

export const snoozeAssignment = (id, snoozeCount) =>
  api(`/api/assignments/${id}`, { method: "PATCH", body: JSON.stringify({ state: "snoozed", snoozeCount }) });

export const completeAssignment = (id, photoUrl) =>
  api(`/api/assignments/${id}`, { method: "PATCH", body: JSON.stringify({ state: "completed", photoUrl, completedAt: true }) });

// ── Assignment Tasks ─────────────────────────────────────────────────────────
export const getAssignmentTasks = (assignmentId) => api(`/api/assignments/${assignmentId}/tasks`);
export const addAssignmentTask = (assignmentId, taskName) =>
  api(`/api/assignments/${assignmentId}/tasks`, { method: "POST", body: JSON.stringify({ taskName }) });
export const deleteAssignmentTask = (taskId) =>
  api(`/api/assignments/tasks/${taskId}`, { method: "DELETE" });
export const toggleAssignmentTask = (taskId, completed) =>
  api(`/api/assignments/tasks/${taskId}/toggle`, { method: "PATCH", body: JSON.stringify({ completed }) });

// ── Real-time subscriptions via SSE (replaces onSnapshot) ───────────────────
export function subscribeToAssignmentsByMember(memberId, callback, onError) {
  // Initial load
  getAssignmentsByMember(memberId).then(callback).catch((e) => {
    console.error(e);
    if (onError) onError(e);
  });

  // Poll every 30s instead of SSE (SSE on Railway/mobile is unreliable)
  const intervalId = setInterval(() => {
    getAssignmentsByMember(memberId).then(callback).catch(console.error);
  }, 30000);

  return () => clearInterval(intervalId);
}

export function subscribeToAssignmentsByFamily(familyId, callback) {
  getAssignmentsByFamily(familyId).then(callback).catch(console.error);

  const es = new EventSource(`${BASE_URL}/api/sse/family/${familyId}`);
  es.addEventListener("update", () => {
    getAssignmentsByFamily(familyId).then(callback).catch(console.error);
  });
  es.onerror = () => es.close();
  return () => es.close();
}

// ── Local Notifications (Capacitor) + Web Push fallback ─────────────────────
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/** Call once when receiver opens app. Requests permission. */
export async function registerPushSubscription(memberId) {
  if (Capacitor.isNativePlatform()) {
    // Native Android — use local notifications (no server needed)
    try {
      const { display } = await LocalNotifications.requestPermissions();
      console.log('[LocalNotif] Permission:', display);
    } catch (e) {
      console.warn('[LocalNotif] Permission request failed:', e);
    }
    return null; // scheduling done separately via scheduleAlarms()
  }

  // Web fallback — keep web push for browser users
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const vapidKey = 'BPqk3hp1RogRajnyOcwzAtKKM7vrpdVNW_sATZQoyEIJrbr1lcwcKkhaW-qDPEVE4hQuEArzfOuzYVF4EWvFbFU';
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    const subJson = subscription.toJSON();
    await api(`/api/push/subscribe`, {
      method: 'POST',
      body: JSON.stringify({ memberId, subscription: subJson }),
    });
    console.log('[Push] Web push subscription saved ✓');
    return subscription;
  } catch (err) {
    console.error('[Push] Web push failed:', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Schedule local notification alarms for all active assignments.
 * Called every time assignments reload. Cancels old ones and reschedules.
 * Works on Android even when phone is locked.
 */
export async function scheduleAlarms(assignments) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Cancel all previously scheduled alarms
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const notifications = [];
    const now = new Date();

    for (const a of assignments) {
      if (!a.timeStart || !a.timeEnd || !a.alarmInterval) continue;
      if (a.state !== 'assigned' && a.state !== 'snoozed') continue;

      const interval = a.alarmInterval || 5;

      // Build schedule: from timeStart to timeEnd, every interval minutes, for today
      const [sh, sm] = a.timeStart.split(':').map(Number);
      const [eh, em] = a.timeEnd.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins   = eh * 60 + em;

      let slot = startMins;
      let notifId = Math.abs(hashStr(a.id + slot)) % 2000000; // stable numeric id

      while (slot <= endMins) {
        const fireAt = new Date();
        fireAt.setHours(Math.floor(slot / 60), slot % 60, 0, 0);

        // Only schedule future alarms
        if (fireAt > now) {
          notifications.push({
            id: notifId,
            title: `🔔 ${a.groupName}`,
            body: `Hi ${a.memberName}! Time to complete your tasks.`,
            schedule: { at: fireAt, allowWhileIdle: true },
            sound: null,
            actionTypeId: '',
            extra: { memberId: a.memberId },
          });
        }
        slot += interval;
        notifId++;
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      console.log('[LocalNotif] Scheduled', notifications.length, 'alarms');
    }
  } catch (e) {
    console.warn('[LocalNotif] Schedule failed:', e);
  }
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

// ── Seed (no-op — seeding done by DataSeeder on backend startup) ─────────────
export const seedMorningPreparation = () => Promise.resolve();
