// Spaced repetition kiểu Leitner 5 hộp.
// Mục tiêu: tăng khả năng học thuộc — câu sai quay lại đúng thời điểm cần ôn.

const SRS_KEY = "quitz_srs";

// Hộp 1..5 → ôn lại sau: 10 phút, 1 ngày, 3 ngày, 7 ngày, 14 ngày
const INTERVALS = [
  10 * 60 * 1000,
  24 * 3600 * 1000,
  3 * 24 * 3600 * 1000,
  7 * 24 * 3600 * 1000,
  14 * 24 * 3600 * 1000
];

function loadMap() {
  try {
    return JSON.parse(localStorage.getItem(SRS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMap(map) {
  try {
    localStorage.setItem(SRS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("SRS save failed:", e);
  }
}

/**
 * Ghi nhận một lần ôn tập.
 * @param {string} key định danh câu hỏi (quizId:questionId)
 * @param {boolean} correct
 * @param {object} questionSnapshot bản sao câu hỏi để ôn lại kể cả khi quiz gốc bị xóa
 */
export function recordReview(key, correct, questionSnapshot) {
  if (!key) return;
  const map = loadMap();
  const e = map[key] || { box: 0, due: 0, seen: 0, wrong: 0 };
  e.seen++;
  if (correct) {
    e.box = Math.min(e.box + 1, 5);
    e.due = Date.now() + INTERVALS[e.box - 1];
  } else {
    e.box = 1;
    e.wrong++;
    e.due = Date.now() + INTERVALS[0];
  }
  if (questionSnapshot) e.q = questionSnapshot;
  e.at = Date.now();
  map[key] = e;
  saveMap(map);
}

/** Các câu đến hạn ôn (due), kèm bản sao câu hỏi */
export function dueEntries() {
  const now = Date.now();
  return Object.entries(loadMap())
    .filter(([, e]) => e.q && e.due <= now)
    .map(([key, e]) => ({ key, ...e }));
}

/** Số câu đang theo dõi SRS (chưa thuộc hẳn: box < 5 hoặc còn due) */
export function trackingCount() {
  return Object.values(loadMap()).filter((e) => e.box < 5 || e.due <= Date.now()).length;
}
