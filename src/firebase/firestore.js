import {
  collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, where, serverTimestamp, doc, onSnapshot,
} from "firebase/firestore";
import { db } from "./config";

export const ROLES = { CREATOR: 1, RECEIVER: 2 };

export const STATES = {
  ASSIGNED:  "assigned",
  SNOOZED:   "snoozed",
  COMPLETED: "completed",
  APPROVED:  "approved",
  DENIED:    "denied",
};

export const MAX_SNOOZES = 3;

// Families
export async function getFamily(familyId) {
  const snap = await getDoc(doc(db, "families", familyId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export async function getFamilies() {
  const q = query(collection(db, "families"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addFamily(familyName) {
  return await addDoc(collection(db, "families"), { familyName, createdAt: serverTimestamp() });
}

// Members
export async function getMembersByFamily(familyId) {
  const q = query(collection(db, "members"), where("familyId", "==", familyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function getMembers() {
  const q = query(collection(db, "members"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addMember({ member, role, familyId, email }) {
  return await addDoc(collection(db, "members"), { member, role, familyId, email: email || "", createdAt: serverTimestamp() });
}
export async function getMemberByEmail(email) {
  const q = query(collection(db, "members"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}
export async function createFamilyWithCreator({ familyName, creatorName, email }) {
  const familyRef = await addFamily(familyName);
  await addMember({ member: creatorName, role: ROLES.CREATOR, familyId: familyRef.id, email });
  return familyRef.id;
}

// Task Groups
export async function getTaskGroups() {
  const snap = await getDocs(collection(db, "taskGroups"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addTaskGroup(name, icon) {
  const ref = await addDoc(collection(db, "taskGroups"), { name: name.trim(), icon });
  return ref.id;
}

// Group Tasks
export async function getGroupTasks(groupId) {
  const q = query(collection(db, "groupTasks"), where("groupId", "==", groupId));
  const snap = await getDocs(q);
  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // sort by order client-side — no composite index needed
  return tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export async function addGroupTask(groupId, taskName, order) {
  return await addDoc(collection(db, "groupTasks"), { groupId, taskName, order });
}

// Seed Morning Preparation
const MORNING_TASKS = ["Dress", "Shoes", "Socks", "Pen", "Glasses", "ID Card", "Belt"];

const EVENING_TASKS = ["Homework", "Bag Pack", "Uniform", "Water Bottle", "Snack Box", "Diary Sign"];

const BEDTIME_TASKS = ["Brush Teeth", "Wash Face", "Change Clothes", "Set Alarm", "Lights Off"];

const HOMEWORK_TASKS = ["Math", "English", "Science", "Social Studies", "Drawing", "Reading"];

export async function seedAllGroups() {
  // Morning Preparation
  await setDoc(
    doc(db, "taskGroups", "morning-preparation"),
    { name: "Morning Preparation", icon: "🌅", startHour: 6, endHour: 8, days: [1,2,3,4,5,6] },
    { merge: true }
  );
  for (let i = 0; i < MORNING_TASKS.length; i++) {
    await setDoc(
      doc(db, "groupTasks", "mp-" + i),
      { groupId: "morning-preparation", taskName: MORNING_TASKS[i], order: i },
      { merge: true }
    );
  }
  // Evening Routine
  await setDoc(
    doc(db, "taskGroups", "evening-routine"),
    { name: "Evening Routine", icon: "🌇", startHour: 17, endHour: 19, days: [1,2,3,4,5,6] },
    { merge: true }
  );
  for (let i = 0; i < EVENING_TASKS.length; i++) {
    await setDoc(
      doc(db, "groupTasks", "ev-" + i),
      { groupId: "evening-routine", taskName: EVENING_TASKS[i], order: i },
      { merge: true }
    );
  }
  // Bedtime
  await setDoc(
    doc(db, "taskGroups", "bedtime"),
    { name: "Bedtime", icon: "🌙", startHour: 21, endHour: 22, days: [0,1,2,3,4,5,6] },
    { merge: true }
  );
  for (let i = 0; i < BEDTIME_TASKS.length; i++) {
    await setDoc(
      doc(db, "groupTasks", "bt-" + i),
      { groupId: "bedtime", taskName: BEDTIME_TASKS[i], order: i },
      { merge: true }
    );
  }
  // Homework
  await setDoc(
    doc(db, "taskGroups", "homework"),
    { name: "Homework", icon: "📚", startHour: 16, endHour: 18, days: [1,2,3,4,5] },
    { merge: true }
  );
  for (let i = 0; i < HOMEWORK_TASKS.length; i++) {
    await setDoc(
      doc(db, "groupTasks", "hw-" + i),
      { groupId: "homework", taskName: HOMEWORK_TASKS[i], order: i },
      { merge: true }
    );
  }
}

export async function seedMorningPreparation() {
  // Only seed if taskGroups collection is empty
  const snap = await getDocs(collection(db, "taskGroups"));
  if (!snap.empty) return; // already seeded
  return seedAllGroups();
}

// Assignments
export async function createAssignment({
  memberId, memberName, memberEmail, familyId, groupId, groupName,
  assignType, assignedDate, weekStart, weekEnd,
  timeStart, timeEnd, voiceEnabled, alarmInterval,
  selectedTaskIds, selectedTaskNames, trackerGroupId,
}) {
  const assignRef = await addDoc(collection(db, "assignments"), {
    memberId, memberName, memberEmail: memberEmail || "", familyId, groupId, groupName, assignType,
    assignedDate: assignedDate || null,
    weekStart: weekStart || null,
    weekEnd: weekEnd || null,
    timeStart: timeStart || null,
    timeEnd: timeEnd || null,
    voiceEnabled: voiceEnabled !== false,
    alarmInterval: alarmInterval || 5,
    trackerGroupId: trackerGroupId || null,
    state: STATES.ASSIGNED,
    snoozeCount: 0,
    photoUrl: null,
    createdAt: serverTimestamp(),
  });
  for (let i = 0; i < selectedTaskIds.length; i++) {
    await addDoc(collection(db, "assignmentTasks"), {
      assignmentId: assignRef.id,
      taskId: selectedTaskIds[i],
      taskName: selectedTaskNames[i],
      completed: false,
    });
  }
  return assignRef.id;
}
export async function getAssignmentsByMember(memberId) {
  const q = query(collection(db, "assignments"), where("memberId", "==", memberId));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}
export async function getAssignmentsByFamily(familyId) {
  const q = query(collection(db, "assignments"), where("familyId", "==", familyId));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}
export function subscribeToAssignmentsByMember(memberId, callback) {
  const q = query(collection(db, "assignments"), where("memberId", "==", memberId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
  });
}
export function subscribeToAssignmentsByFamily(familyId, callback) {
  const q = query(collection(db, "assignments"), where("familyId", "==", familyId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
  });
}
export async function updateAssignmentState(assignmentId, state) {
  return await updateDoc(doc(db, "assignments", assignmentId), { state });
}
export async function updateAssignment(assignmentId, data) {
  return await updateDoc(doc(db, "assignments", assignmentId), data);
}
export async function deleteAssignment(assignmentId) {
  // delete assignment tasks first
  const q = query(collection(db, "assignmentTasks"), where("assignmentId", "==", assignmentId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return await deleteDoc(doc(db, "assignments", assignmentId));
}
export async function snoozeAssignment(assignmentId, newSnoozeCount) {
  return await updateDoc(doc(db, "assignments", assignmentId), { state: STATES.SNOOZED, snoozeCount: newSnoozeCount });
}
export async function completeAssignment(assignmentId, photoUrl) {
  return await updateDoc(doc(db, "assignments", assignmentId), {
    state: STATES.COMPLETED, photoUrl, completedAt: serverTimestamp(),
  });
}

// Assignment Tasks
export async function getAssignmentTasks(assignmentId) {
  const q = query(collection(db, "assignmentTasks"), where("assignmentId", "==", assignmentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addAssignmentTask(assignmentId, taskName) {
  const ref = await addDoc(collection(db, "assignmentTasks"), {
    assignmentId,
    taskName,
    completed: false,
  });
  return { id: ref.id, assignmentId, taskName, completed: false };
}
export async function deleteAssignmentTask(taskId) {
  return await deleteDoc(doc(db, "assignmentTasks", taskId));
}
export async function toggleAssignmentTask(taskDocId, done) {
  return await updateDoc(doc(db, "assignmentTasks", taskDocId), { completed: done });
}
