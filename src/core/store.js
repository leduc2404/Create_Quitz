// Reactive store đơn giản: state + subscribe/emit, không global leak.
import { loadQuizzes, saveQuizzes } from "./storage/local.js";

const state = {
  quizzes: [],
  user: null, // { uid, email, displayName, photoURL } | null (null = khách)
  theme: "dark"
};

const listeners = new Map();

export function getState() {
  return state;
}

export function subscribe(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, payload) {
  (listeners.get(event) || []).forEach((fn) => fn(payload));
}

// ---------- Quizzes ----------
export function initQuizzes() {
  state.quizzes = loadQuizzes();
  emit("quizzes", state.quizzes);
}

export function persistQuizzes() {
  saveQuizzes(state.quizzes);
  emit("quizzes", state.quizzes);
}

export function addQuiz(quiz) {
  const existing = state.quizzes.findIndex((q) => q.fileName === quiz.fileName);
  if (existing >= 0) {
    // Giữ trạng thái sync/cloudId nếu đang overwrite bản đã lưu cloud
    quiz.cloudId = state.quizzes[existing].cloudId;
    quiz.syncedAt = state.quizzes[existing].syncedAt;
    state.quizzes[existing] = quiz;
  } else {
    state.quizzes.push(quiz);
  }
  persistQuizzes();
  return quiz;
}

export function removeQuiz(id) {
  state.quizzes = state.quizzes.filter((q) => q.id !== id);
  persistQuizzes();
}

export function updateQuiz(id, patch) {
  const quiz = state.quizzes.find((q) => q.id === id);
  if (!quiz) return;
  Object.assign(quiz, patch);
  persistQuizzes();
}

export function getQuiz(id) {
  return state.quizzes.find((q) => q.id === id) || null;
}

export function getQuizIndex(id) {
  return state.quizzes.findIndex((q) => q.id === id);
}

export function mergeCloudQuizzes(cloudQuizzes) {
  for (const cq of cloudQuizzes) {
    const idx = state.quizzes.findIndex(
      (q) => q.cloudId === cq.cloudId || q.fileName === cq.fileName
    );
    if (idx >= 0) {
      const local = state.quizzes[idx];
      const localTs = local.syncedAt || local.createdAt || 0;
      const cloudTs = cq.updatedAt || cq.createdAt || 0;
      if (cloudTs >= localTs) {
        state.quizzes[idx] = cq;
      } else {
        // Bản local mới hơn: chỉ gắn tham chiếu cloud
        local.cloudId = cq.cloudId;
      }
    } else {
      state.quizzes.push(cq);
    }
  }
  persistQuizzes();
}

export function unsyncedQuizzes() {
  return state.quizzes.filter((q) => !q.cloudId);
}

// ---------- User ----------
export function setUser(user) {
  state.user = user;
  emit("user", user);
}

// ---------- Theme ----------
export function setTheme(theme) {
  state.theme = theme;
  emit("theme", theme);
}
