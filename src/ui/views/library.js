// Tab Library — danh sách quiz tối giản: icon + tên + số câu + menu "...".
import { getState, removeQuiz, subscribe, updateQuiz } from "../../core/store.js";
import { isCloudAvailable, saveQuizToCloud, deleteCloudQuiz } from "../../core/storage/cloud.js";
import { shareQuiz } from "../../core/share.js";
import { iconSvg } from "../icons.js";
import { showSheet } from "../sheet.js";
import { showTab } from "../router.js";
import { confirmDialog, promptDialog } from "../confirm.js";
import { toast, toastError, toastSuccess } from "../toast.js";

export function initLibraryView({ onStart }) {
  document.getElementById("emptyCreateBtn").addEventListener("click", () => {
    showTab("createScreen");
  });

  subscribe("quizzes", () => renderLibrary(onStart));
  renderLibrary(onStart);
}

function defaultIcon(quiz) {
  if (quiz.settings && quiz.settings.icon) return quiz.settings.icon;
  if (quiz.quizType === "thpt2026") return "GraduationCap";
  return quiz.quizType === "essay" ? "PenLine" : "ListChecks";
}

function renderLibrary(onStart) {
  const quizzes = getState().quizzes;
  const list = document.getElementById("filesList");
  const emptyState = document.getElementById("emptyState");

  document.getElementById("libraryCount").textContent =
    quizzes.length > 0 ? `${quizzes.length} bộ đề` : "";
  emptyState.hidden = quizzes.length > 0;
  list.innerHTML = "";

  quizzes.forEach((quiz) => {
    const row = document.createElement("div");
    row.className = "quiz-row";
    row.setAttribute("role", "button");
    row.tabIndex = 0;

    const iconWrap = document.createElement("div");
    iconWrap.className = "quiz-row-icon";
    iconWrap.innerHTML = iconSvg(defaultIcon(quiz), 22);

    const info = document.createElement("div");
    info.className = "quiz-row-info";

    const name = document.createElement("div");
    name.className = "quiz-row-name";
    name.textContent = quiz.fileName;

    const sub = document.createElement("div");
    sub.className = "quiz-row-sub";
    sub.textContent = `${quiz.totalQuestions} câu · ${quiz.quizType === "essay" ? "Tự luận" : quiz.quizType === "thpt2026" ? "Đề THPT 2026" : "Trắc nghiệm"}`;

    info.append(name, sub);

    const more = document.createElement("button");
    more.className = "icon-btn quiz-row-more";
    more.innerHTML = iconSvg("MoreHorizontal", 20);
    more.setAttribute("aria-label", `Tùy chọn cho ${quiz.fileName}`);
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      openQuizSheet(quiz, onStart);
    });

    row.append(iconWrap, info, more);
    const start = () => onStart(quiz);
    row.addEventListener("click", start);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        start();
      }
    });
    list.appendChild(row);
  });
}

function openQuizSheet(quiz, onStart) {
  const actions = [
    { icon: "Play", label: "Bắt đầu", onClick: () => onStart(quiz) },
    { icon: "Share2", label: "Chia sẻ bằng link", onClick: () => shareQuiz(quiz) },
    { icon: "PenLine", label: "Đổi tên", onClick: () => renameQuiz(quiz) },
    { icon: "CloudUpload", label: quiz.cloudId ? "Đã lưu cloud — cập nhật" : "Lưu lên cloud", onClick: () => syncOne(quiz) },
    { icon: "Download", label: "Xuất JSON", onClick: () => exportQuiz(quiz) },
    { icon: "Trash2", label: "Xóa bộ đề", danger: true, onClick: () => deleteQuiz(quiz) }
  ];
  showSheet(quiz.fileName, actions);
}

async function renameQuiz(quiz) {
  const newName = await promptDialog({
    title: "Đổi tên bộ đề",
    placeholder: "Tên bộ đề",
    value: quiz.fileName,
    okText: "Lưu"
  });
  if (!newName || newName === quiz.fileName) return;
  updateQuiz(quiz.id, { fileName: newName });
  toastSuccess("Đã đổi tên bộ đề.");
}

async function syncOne(quiz) {
  const user = getState().user;
  if (!isCloudAvailable()) {
    toastError("Firebase chưa được cấu hình. Xem README để bật lưu trữ cloud.");
    return;
  }
  if (!user) {
    toast("Đăng nhập để lưu quiz lên cloud.", { type: "info" });
    document.getElementById("authModal").classList.add("open");
    return;
  }
  try {
    toast(`Đang lưu "${quiz.fileName}" lên cloud...`, { duration: 1500 });
    const cloudId = await saveQuizToCloud(quiz, user.uid);
    updateQuiz(quiz.id, { cloudId, syncedAt: Date.now() });
    toastSuccess(`Đã lưu "${quiz.fileName}" trên cloud.`);
  } catch (e) {
    toastError(`Lưu cloud thất bại: ${e.message}`);
  }
}

async function deleteQuiz(quiz) {
  const ok = await confirmDialog({
    title: "Xóa bộ đề?",
    message: `Xóa "${quiz.fileName}" (${quiz.totalQuestions} câu hỏi)?${
      quiz.cloudId ? " Bộ đề cũng sẽ bị xóa trên cloud." : ""
    }`,
    okText: "Xóa",
    danger: true
  });
  if (!ok) return;

  if (quiz.cloudId) {
    deleteCloudQuiz(quiz.cloudId).catch(() => {});
  }
  removeQuiz(quiz.id);
  toastSuccess(`Đã xóa "${quiz.fileName}".`);
}

function exportQuiz(quiz) {
  const payload = {
    type: quiz.quizType,
    topic: quiz.mainTopic,
    questions: quiz.questions
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${quiz.fileName.replace(/\.json$/i, "")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toastSuccess("Đã xuất bộ đề ra file JSON.");
}
