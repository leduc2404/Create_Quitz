// Cấu hình đề thi Tốt nghiệp THPT 2026 — cấu trúc 3 nhóm môn, luật chấm, chuẩn hóa đáp án.
// Không đụng DOM; dùng chung cho parser, engine và màn hình kết quả.

// Cấu trúc chuẩn (thang 10) của 9 môn theo Bộ GD&ĐT 2026
export const EXAM_STRUCTURES = {
  "Toán": {
    group: 1,
    parts: {
      I: { count: 12, points: 0.25, type: "multiple_choice" },
      II: { count: 4, points: 1.0, type: "true_false" },
      III: { count: 6, points: 0.5, type: "short_answer" }
    }
  },
  "Vật lí": { group: 2, parts: STRUCT_GROUP2() },
  "Hóa học": { group: 2, parts: STRUCT_GROUP2() },
  "Sinh học": { group: 2, parts: STRUCT_GROUP2() },
  "Địa lí": { group: 2, parts: STRUCT_GROUP2() },
  "Lịch sử": { group: 3, parts: STRUCT_GROUP3() },
  "Giáo dục kinh tế và pháp luật": { group: 3, parts: STRUCT_GROUP3() },
  "Tin học": { group: 3, parts: STRUCT_GROUP3() },
  "Công nghệ": { group: 3, parts: STRUCT_GROUP3() }
};

function STRUCT_GROUP2() {
  return {
    I: { count: 18, points: 0.25, type: "multiple_choice" },
    II: { count: 4, points: 1.0, type: "true_false" },
    III: { count: 6, points: 0.25, type: "short_answer" }
  };
}

function STRUCT_GROUP3() {
  return {
    I: { count: 24, points: 0.25, type: "multiple_choice" },
    II: { count: 4, points: 1.0, type: "true_false" }
  };
}

export const GROUP_NAMES = {
  1: "Toán",
  2: "Vật lí, Hóa học, Sinh học, Địa lí",
  3: "Lịch sử, GD Kinh tế & Pháp luật, Tin học, Công nghệ"
};

// ---------- Nhận diện môn ----------
const ALIASES = {
  "toan": "Toán",
  "toan hoc": "Toán",
  "vat li": "Vật lí",
  "vat ly": "Vật lí",
  "ly": "Vật lí",
  "hoa": "Hóa học",
  "hoa hoc": "Hóa học",
  "chemistry": "Hóa học",
  "sinh": "Sinh học",
  "sinh hoc": "Sinh học",
  "lich su": "Lịch sử",
  "su": "Lịch sử",
  "dia": "Địa lí",
  "dia li": "Địa lí",
  "dia ly": "Địa lí",
  "giao duc kinh te va phap luat": "Giáo dục kinh tế và pháp luật",
  "gdcd": "Giáo dục kinh tế và pháp luật",
  "giao duc cong dan": "Giáo dục kinh tế và pháp luật",
  "kinh te va phap luat": "Giáo dục kinh tế và pháp luật",
  "tin": "Tin học",
  "tin hoc": "Tin học",
  "cong nghe": "Công nghệ"
};

export function normalizeSubjectName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Keyword ngắn (< 4 ký tự) chỉ khớp ở biên từ để tránh false positive ("su" trong "cong suat")
function matches(text, key) {
  if (key.length >= 4) return text.includes(key);
  return new RegExp(`(^|[^a-z])${key}($|[^a-z])`).test(text);
}

/** Quy về tên môn chuẩn trong EXAM_STRUCTURES, null nếu không nhận diện được */
export function resolveSubject(value) {
  const text = normalizeSubjectName(value);
  if (!text) return null;
  for (const [name] of Object.entries(EXAM_STRUCTURES)) {
    if (normalizeSubjectName(name) === text) return name;
  }
  const keys = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (matches(text, key)) return ALIASES[key];
  }
  return null;
}

// ---------- Validate cấu trúc đề ----------
/**
 * BƯỚC 1 (Quét đề): đếm số câu từng phần.
 * BƯỚC 2 (Định tuyến): khớp 100% cấu trúc chuẩn → "complete", ngược lại → "partial".
 */
export function validateExamQuiz({ subject, questions = [] }) {
  const resolved = resolveSubject(subject);
  const structure = resolved ? EXAM_STRUCTURES[resolved] : null;
  const counts = { I: 0, II: 0, III: 0 };
  for (const q of questions) {
    const raw = String(q.part || "");
    const roman = raw.match(/[ivx]+/i);
    const part = roman ? roman[0].toUpperCase() : raw.replace(/\D/g, "");
    if (counts[part] !== undefined) counts[part]++;
  }
  let status = "partial";
  if (structure) {
    const allPartsMatch = Object.entries(structure.parts).every(
      ([part, cfg]) => counts[part] === cfg.count
    );
    const noExtraPart = !(counts.III > 0 && !structure.parts.III);
    if (allPartsMatch && noExtraPart) status = "complete";
  }
  return {
    status,
    subject: resolved,
    rawSubject: subject,
    group: structure ? structure.group : null,
    structure: structure || null,
    counts
  };
}

// ---------- Luật chấm ----------
// Phần II Đúng/Sai: đúng 1 ý → 0.1, 2 ý → 0.25, 3 ý → 0.5, 4 ý → 1.0; sai/bỏ trống → 0
const TRUE_FALSE_POINTS = [0, 0.1, 0.25, 0.5, 1.0];

export function trueFalsePoints(correctCount) {
  const n = Math.max(0, Math.min(4, Number(correctCount) || 0));
  return TRUE_FALSE_POINTS[n] || 0;
}

/** Phần III trả lời ngắn: chỉ so khớp con số thuần túy, bỏ qua đơn vị (kg, m/s) và lỗi dấu phẩy/chấm */
export function normalizeNumericAnswer(text) {
  if (text == null) return null;
  const match = String(text).trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Chuẩn hóa chuỗi văn bản để so khớp: gọt dấu câu, khoảng trắng thừa, chữ thường */
export function normalizeTextAnswer(str = "") {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ");
}

/** So sánh đáp án ngắn / điền khuyết đa năng (hỗ trợ cả chữ, số, danh sách đáp án chấp nhận, sai số tolerance) */
export function matchShortAnswer(correctAnswer, userAnswer, options = {}) {
  if (userAnswer == null || userAnswer === "") return false;

  const tolerance = Number(options.tolerance) || 0;
  const acceptable = Array.isArray(options.acceptableAnswers)
    ? options.acceptableAnswers
    : Array.isArray(options.acceptable)
      ? options.acceptable
      : [];

  const targets = [correctAnswer, ...acceptable].filter((v) => v != null && v !== "");
  if (targets.length === 0) return false;

  const uNum = normalizeNumericAnswer(userAnswer);
  const uNorm = normalizeTextAnswer(userAnswer);

  for (const target of targets) {
    // 1. So khớp số học nếu cả 2 đều là số (hỗ trợ cả phần trăm: 90% vs 0.9)
    const tNum = normalizeNumericAnswer(target);
    if (uNum !== null && tNum !== null) {
      if (Math.abs(uNum - tNum) <= Math.max(1e-9, tolerance)) {
        return true;
      }
      // Hỗ trợ tỷ lệ phần trăm: VD 90% (90) vs 0.9, hoặc 0.81 vs 81%
      if (
        Math.abs(uNum * 100 - tNum) <= Math.max(1e-4, tolerance) ||
        Math.abs(uNum - tNum * 100) <= Math.max(1e-4, tolerance)
      ) {
        return true;
      }
    }

    // 2. So khớp chuỗi văn bản thông minh (không phân biệt hoa thường, dấu câu, khoảng trắng)
    const tNorm = normalizeTextAnswer(target);
    if (uNorm && tNorm && uNorm === tNorm) {
      return true;
    }

    // 3. So khớp không dấu tiếng Việt (ví dụ học sinh gõ 'tu tuong quan' cho 'tự tương quan')
    const tNonAccent = tNorm.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    const uNonAccent = uNorm.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (uNonAccent && tNonAccent && uNonAccent === tNonAccent) {
      return true;
    }

    // 4. So khớp từ khóa trọng tâm (VD: target "Hiện tượng tự tương quan" vs user "tự tương quan")
    if (uNonAccent && tNonAccent && uNonAccent.length >= 4) {
      if (tNonAccent.includes(uNonAccent) || uNonAccent.includes(tNonAccent)) {
        return true;
      }
    }
  }

  return false;
}

export function numericAnswersEqual(a, b) {
  return matchShortAnswer(a, b);
}

/** Điểm mặc định cho từng loại câu khi không xác định được môn */
export function fallbackPoints(type) {
  if (type === "true_false") return 1.0;
  if (type === "short_answer") return 0.25;
  return 0.25;
}

/** Hiển thị điểm gọn: 7.25, 10, 0.5 — không kéo theo số 0 thừa */
export function fmtScore(value) {
  return Number((Number(value) || 0).toFixed(2)).toString();
}
