// Đánh dấu câu hỏi quan trọng (bookmark) — lưu kèm snapshot để ôn riêng.
const KEY = "quitz_important";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function save(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Bật/tắt đánh dấu. Trả về true nếu vừa đánh dấu. */
export function toggleImportant(key, questionSnapshot) {
  if (!key) return false;
  const map = load();
  if (map[key]) {
    delete map[key];
    save(map);
    return false;
  }
  map[key] = { q: questionSnapshot, at: Date.now() };
  save(map);
  return true;
}

export function isImportant(key) {
  return !!load()[key];
}

export function importantCount() {
  return Object.keys(load()).length;
}

/** Danh sách câu quan trọng để mở phiên ôn riêng */
export function importantEntries() {
  return Object.entries(load())
    .filter(([, e]) => e.q)
    .map(([key, e]) => ({ key, ...e }));
}
