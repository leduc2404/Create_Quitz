// Tab Create — dán/file JSON → modal đặt tên + chọn icon + cài timer.
import { parseQuizData } from "../../core/quiz-parser.js";
import { addQuiz } from "../../core/store.js";
import { genId } from "../../core/storage/local.js";
import { iconSvg } from "../icons.js";
import { showTab } from "../router.js";
import { toast, toastError, toastSuccess } from "../toast.js";

export const ICON_OPTIONS = [
  "BookOpen", "Brain", "FlaskConical", "Languages", "Calculator", "History",
  "Music", "Code", "HeartPulse", "Globe", "GraduationCap", "PenLine"
];

// Trạng thái modal tạo bộ đề
let pendingParsed = null; // parsed quiz đang chờ lưu
let pickedIcon = "BookOpen";
let timerMode = "question";
let mins = 0;
let secs = 30;

export function initCreateView() {
  const textarea = document.getElementById("jsonTextarea");

  document.getElementById("importPasteBtn").addEventListener("click", () => {
    const text = textarea.value.trim();
    if (!text) {
      toastError("Vui lòng dán nội dung JSON vào ô nhập liệu!");
      return;
    }
    tryParseAndOpen(JSON.parse.bind(null, text), nextName());
  });

  setupFileInput();
  setupAiModal();
  setupCreateModal();
  setupGlobalPaste();
}

/** Import trực tiếp (không qua modal) — dùng cho link chia sẻ */
export function importJSON(data, fileName, extra = {}) {
  const parsed = parseQuizData(data, fileName);
  if (!parsed) {
    toastError(`Không tìm thấy câu hỏi trong "${fileName}". Kiểm tra lại định dạng JSON.`);
    return null;
  }
  return addQuiz({
    ...parsed,
    id: genId(),
    createdAt: Date.now(),
    settings: extra.settings || { icon: extra.icon || defaultIconFor(parsed), timer: { enabled: false } }
  });
}

// ---------- Paste / file → mở modal ----------
function nextName() {
  return "Bộ đề mới";
}

function tryParseAndOpen(parseFn, suggestedName) {
  let data;
  try {
    data = parseFn();
  } catch (error) {
    toastError(`JSON không hợp lệ: ${error.message}`);
    return;
  }
  const parsed = parseQuizData(data, suggestedName);
  if (!parsed) {
    toastError("Không tìm thấy câu hỏi. Kiểm tra lại định dạng JSON.");
    return;
  }
  openCreateModal(parsed);
}

function setupFileInput() {
  const uploadCard = document.getElementById("uploadCard");
  const fileInput = document.getElementById("fileInput");

  uploadCard.addEventListener("click", () => fileInput.click());
  uploadCard.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadCard.classList.add("dragover");
  });
  uploadCard.addEventListener("dragleave", () => uploadCard.classList.remove("dragover"));
  uploadCard.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadCard.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  });
}

async function handleFiles(files) {
  for (const file of files) {
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const parsed = parseQuizData(data, file.name.replace(/\.json$/i, ""));
        if (!parsed) {
          toastError(`Không tìm thấy câu hỏi trong ${file.name}.`);
          continue;
        }
        openCreateModal(parsed);
      } catch (error) {
        toastError(`Lỗi đọc file ${file.name}: ${error.message}`);
      }
    }
  }
}

// Ctrl+V ở bất kỳ đâu → mở modal tạo bộ đề
function setupGlobalPaste() {
  document.addEventListener("paste", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input") return;
    if (document.getElementById("createScreen").hidden) return;

    const pastedText = e.clipboardData.getData("text");
    if (!pastedText || !pastedText.trim()) return;
    tryParseAndOpen(JSON.parse.bind(null, pastedText), nextName());
  });
}

// ---------- Modal "Bộ đề mới" ----------
function defaultIconFor(parsed) {
  if (parsed.quizType === "thpt2026") return "GraduationCap";
  return parsed.quizType === "essay" ? "PenLine" : "ListChecks";
}

function openCreateModal(parsed) {
  pendingParsed = parsed;

  const nameInput = document.getElementById("quizNameInput");
  const suggested = parsed.mainTopic && parsed.mainTopic !== parsed.fileName
    ? parsed.mainTopic
    : parsed.fileName;
  nameInput.value = suggested.replace(/\.json$/i, "");

  // Badge nhận diện đề thi THPT 2026
  const badge = document.getElementById("examBadge");
  if (parsed.exam) {
    const v = parsed.exam.validation;
    badge.hidden = false;
    badge.textContent =
      v.status === "complete"
        ? `${parsed.exam.subject || "Đề 2026"} · Đề chuẩn 2026 · Hoàn chỉnh`
        : `${parsed.exam.subject || "Đề 2026"} · Trích đoạn · Chưa đủ cấu trúc chuẩn`;
  } else {
    badge.hidden = true;
  }

  pickedIcon = defaultIconFor(parsed);
  renderIconGrid();

  // Reset timer về mặc định: tắt, 0:30 mỗi câu
  document.getElementById("timerToggle").checked = false;
  document.getElementById("timerBody").hidden = true;
  timerMode = "question";
  mins = 0;
  secs = 30;
  syncTimerUi();

  document.getElementById("createModal").classList.add("open");
  setTimeout(() => {
    nameInput.focus();
    nameInput.select();
  }, 80);
}

function closeCreateModal() {
  pendingParsed = null;
  document.getElementById("createModal").classList.remove("open");
}

function renderIconGrid() {
  const grid = document.getElementById("iconGrid");
  grid.innerHTML = "";
  for (const name of ICON_OPTIONS) {
    const btn = document.createElement("button");
    btn.className = "icon-opt" + (name === pickedIcon ? " active" : "");
    btn.innerHTML = iconSvg(name, 20);
    btn.setAttribute("aria-label", name);
    btn.addEventListener("click", () => {
      pickedIcon = name;
      grid.querySelectorAll(".icon-opt").forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
    });
    grid.appendChild(btn);
  }
}

function setupCreateModal() {
  const modal = document.getElementById("createModal");
  document.getElementById("createClose").addEventListener("click", closeCreateModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeCreateModal();
  });

  // Timer toggle
  document.getElementById("timerToggle").addEventListener("change", (e) => {
    document.getElementById("timerBody").hidden = !e.target.checked;
  });

  // Segmented: mỗi câu / toàn bài
  document.querySelectorAll("#timerModeSeg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      timerMode = btn.dataset.mode;
      document.querySelectorAll("#timerModeSeg .seg-btn").forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
    });
  });

  // Picker phút / giây
  document.getElementById("minPlus").addEventListener("click", () => {
    mins = Math.min(mins + 1, 99);
    syncTimerUi();
  });
  document.getElementById("minMinus").addEventListener("click", () => {
    mins = Math.max(mins - 1, 0);
    syncTimerUi();
  });
  document.getElementById("secPlus").addEventListener("click", () => {
    secs = secs + 5 >= 60 ? 0 : secs + 5;
    syncTimerUi();
  });
  document.getElementById("secMinus").addEventListener("click", () => {
    secs = secs - 5 < 0 ? 55 : secs - 5;
    syncTimerUi();
  });

  document.getElementById("createSaveBtn").addEventListener("click", saveQuiz);
}

function syncTimerUi() {
  document.getElementById("minValue").textContent = mins;
  document.getElementById("secValue").textContent = String(secs).padStart(2, "0");
}

function saveQuiz() {
  if (!pendingParsed) return;

  const name = document.getElementById("quizNameInput").value.trim();
  if (!name) {
    toastError("Hãy đặt tên cho bộ đề của bạn.");
    document.getElementById("quizNameInput").focus();
    return;
  }

  const timerOn = document.getElementById("timerToggle").checked;
  const seconds = mins * 60 + secs;
  if (timerOn && seconds === 0) {
    toastError("Chọn thời gian cho timer (phút hoặc giây).");
    return;
  }

  const quiz = addQuiz({
    ...pendingParsed,
    fileName: name,
    id: genId(),
    createdAt: Date.now(),
    settings: {
      icon: pickedIcon,
      timer: { enabled: timerOn, mode: timerMode, seconds }
    }
  });

  document.getElementById("jsonTextarea").value = "";
  closeCreateModal();
  toastSuccess(`Đã tạo "${quiz.fileName}" (${quiz.totalQuestions} câu).`);
  showTab("libraryScreen");
}

// ---------- Modal AI prompt ----------
function setupAiModal() {
  const modal = document.getElementById("aiModal");
  document.getElementById("openAiBtn").addEventListener("click", () => {
    modal.classList.add("open");
  });
  document.getElementById("aiClose").addEventListener("click", () => {
    modal.classList.remove("open");
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });

  document.querySelectorAll("#promptSeg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.prompt;
      document.querySelectorAll("#promptSeg .seg-btn").forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
      document.getElementById("promptTracNghiem").classList.toggle("active", type === "tracnghiem");
      document.getElementById("promptTuLuan").classList.toggle("active", type === "tuluan");
      document.getElementById("promptThpt2026").classList.toggle("active", type === "thpt2026");
    });
  });

  document.getElementById("copyBtnTN").addEventListener("click", () => copyPrompt("tracnghiem"));
  document.getElementById("copyBtnTL").addEventListener("click", () => copyPrompt("tuluan"));
  document.getElementById("copyBtnTHPT").addEventListener("click", () => copyPrompt("thpt2026"));
}

function copyPrompt(type) {
  const boxId =
    type === "tuluan" ? "promptBoxEssay" : type === "thpt2026" ? "promptBoxThpt" : "promptBox";
  const btnText = document.getElementById(
    type === "tuluan" ? "copyBtnTextTL" : type === "thpt2026" ? "copyBtnTextTHPT" : "copyBtnTextTN"
  );
  const promptText = document.getElementById(boxId).textContent;

  navigator.clipboard
    .writeText(promptText)
    .then(() => {
      const original = btnText.textContent;
      btnText.textContent = "Đã copy!";
      setTimeout(() => (btnText.textContent = original), 2000);
    })
    .catch(() => toastError("Không thể copy tự động. Hãy bôi đen và copy thủ công."));
}
