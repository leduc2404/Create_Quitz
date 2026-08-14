// Storage layer (local) — giao diện save/load để swap sang Firestore mà không đụng UI.
const PREFIX = "quitz_";
export const KEYS = {
  quizzes: `${PREFIX}quizzes`,
  theme: `${PREFIX}theme`,
  session: `${PREFIX}session`,
  onboarded: `${PREFIX}onboarded`,
  wrongs: `${PREFIX}wrong_ids`,
  pasteCounter: `${PREFIX}paste_counter`
};

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("localStorage đầy hoặc bị chặn:", e);
  }
}

export function genId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

export function loadQuizzes() {
  const quizzes = safeGet(KEYS.quizzes, []);
  // Đảm bảo quiz cũ (từ bản 1 file HTML) vẫn có id ổn định
  return quizzes.map((q) => {
    if (!q.id) q.id = genId();
    if (!q.createdAt) q.createdAt = Date.now();
    return q;
  });
}

export function saveQuizzes(quizzes) {
  safeSet(KEYS.quizzes, quizzes);
}

export function loadSession() {
  return safeGet(KEYS.session, null);
}

export function saveSession(session) {
  safeSet(KEYS.session, session);
}

export function clearSession() {
  localStorage.removeItem(KEYS.session);
}

export function isOnboarded() {
  return localStorage.getItem(KEYS.onboarded) === "1";
}

export function setOnboarded() {
  localStorage.setItem(KEYS.onboarded, "1");
}

// Theo dõi danh sách câu sai gần đây (tối đa 200) để ôn tập nhanh
export function recordWrongIds(ids) {
  const set = new Set(safeGet(KEYS.wrongs, []));
  ids.forEach((id) => set.add(id));
  const list = [...set].slice(-200);
  safeSet(KEYS.wrongs, list);
}

export function getWrongIds() {
  return safeGet(KEYS.wrongs, []);
}

export function nextPasteName() {
  const n = safeGet(KEYS.pasteCounter, 1);
  safeSet(KEYS.pasteCounter, n + 1);
  return `Pasted_${n}`;
}

export function getTheme() {
  return localStorage.getItem(KEYS.theme) === "light" ? "light" : "dark";
}

export function saveTheme(theme) {
  localStorage.setItem(KEYS.theme, theme);
}
