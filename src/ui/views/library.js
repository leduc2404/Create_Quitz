// Tab Library — Quản lý kho bộ đề (Grid/List View, Tìm kiếm, Bộ lọc, Sắp xếp, Nạp đề mẫu).
import { getState, removeQuiz, restoreQuiz, getQuizIndex, subscribe, updateQuiz } from "../../core/store.js";
import { isCloudAvailable, saveQuizToCloud, deleteCloudQuiz } from "../../core/storage/cloud.js";
import { getAttemptsForQuiz } from "../../core/storage/local.js";
import { shareQuiz } from "../../core/share.js";
import { loadAllSampleDecks } from "./home.js";
import { iconSvg } from "../icons.js";
import { showSheet } from "../sheet.js";
import { showTab } from "../router.js";
import { confirmDialog, promptDialog } from "../confirm.js";
import { toast, toastError, toastSuccess } from "../toast.js";
import { escapeHtml } from "../util.js";

let currentSearch = "";
let currentFilter = "all";
let currentSort = "newest";
let currentView = "grid"; // 'grid' | 'list'
let startCallback = null;

export function initLibraryView({ onStart }) {
  startCallback = onStart;

  document.getElementById("emptyCreateBtn")?.addEventListener("click", () => {
    showTab("createScreen");
  });

  document.getElementById("libCreateNewBtn")?.addEventListener("click", () => {
    showTab("createScreen");
  });

  document.getElementById("loadSampleDecksBtn")?.addEventListener("click", () => {
    loadAllSampleDecks();
  });

  document.getElementById("emptySampleBtn")?.addEventListener("click", () => {
    loadAllSampleDecks();
  });

  // Tìm kiếm tức thì
  const searchInput = document.getElementById("librarySearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      renderLibrary(startCallback);
    });
  }

  // Sắp xếp
  const sortSelect = document.getElementById("librarySort");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value || "newest";
      renderLibrary(startCallback);
    });
  }

  // Chuyển đổi Grid / List view
  const viewToggle = document.getElementById("libraryViewToggle");
  if (viewToggle) {
    viewToggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".view-btn, .view-mode-btn");
      if (!btn) return;
      viewToggle.querySelectorAll(".view-btn, .view-mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentView = btn.dataset.view || "grid";
      const list = document.getElementById("filesList");
      if (list) {
        list.classList.toggle("grid-view", currentView === "grid");
        list.classList.toggle("list-view", currentView === "list");
      }
    });
  }

  // Bộ lọc thẻ
  const filterChips = document.getElementById("libraryFilters");
  if (filterChips) {
    filterChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".filter-chip");
      if (!chip) return;
      filterChips.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.filter || "all";
      renderLibrary(startCallback);
    });
  }

  subscribe("quizzes", () => renderLibrary(onStart));
  renderLibrary(onStart);
}

function defaultIcon(quiz) {
  if (quiz.settings && quiz.settings.icon) return quiz.settings.icon;
  if (quiz.quizType === "thpt2026") return "GraduationCap";
  if (quiz.quizType === "mixed") return "Layers";
  if (quiz.quizType === "short_answer") return "Brain";
  if (quiz.quizType === "flashcard") return "Brain";
  return quiz.quizType === "essay" ? "PenLine" : "ListChecks";
}

function getTypeLabel(quizType) {
  if (quizType === "essay") return "Tự luận";
  if (quizType === "thpt2026") return "Chuẩn THPT 2026";
  if (quizType === "mixed") return "Tổng hợp";
  if (quizType === "short_answer") return "Trả lời ngắn";
  if (quizType === "flashcard") return "Flashcard";
  return "Trắc nghiệm";
}

function renderLibrary(onStart) {
  const allQuizzes = getState().quizzes;
  const list = document.getElementById("filesList");
  const emptyState = document.getElementById("emptyState");
  if (!list || !emptyState) return;

  // Cập nhật badge trên sidebar
  const sidebarBadge = document.getElementById("sidebarLibBadge");
  if (sidebarBadge) {
    sidebarBadge.textContent = allQuizzes.length;
    sidebarBadge.hidden = allQuizzes.length === 0;
  }

  // Lọc theo từ khóa tìm kiếm và loại đề
  const filtered = allQuizzes.filter((quiz) => {
    if (currentSearch) {
      const name = (quiz.fileName || "").toLowerCase();
      const topic = (quiz.mainTopic || "").toLowerCase();
      if (!name.includes(currentSearch) && !topic.includes(currentSearch)) {
        return false;
      }
    }
    if (currentFilter !== "all") {
      if (quiz.quizType !== currentFilter) return false;
    }
    return true;
  });

  // Sắp xếp
  filtered.sort((a, b) => {
    if (currentSort === "name") {
      return (a.fileName || "").localeCompare(b.fileName || "", "vi");
    }
    if (currentSort === "count") {
      return (b.totalQuestions || 0) - (a.totalQuestions || 0);
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const countEl = document.getElementById("libraryCount");
  if (countEl) {
    countEl.textContent =
      allQuizzes.length > 0 ? `${filtered.length}/${allQuizzes.length} bộ đề` : "0 bộ đề";
  }

  emptyState.hidden = filtered.length > 0;
  list.innerHTML = "";
  list.classList.toggle("grid-view", currentView === "grid");
  list.classList.toggle("list-view", currentView === "list");

  filtered.forEach((quiz) => {
    const row = document.createElement("div");
    row.className = "quiz-row";
    row.setAttribute("role", "button");
    row.tabIndex = 0;

    const topicCount = quiz.topics ? Object.keys(quiz.topics).length : 1;
    const attempts = getAttemptsForQuiz(quiz.id);
    const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
    const typeLabel = getTypeLabel(quiz.quizType);

    row.innerHTML = `
      <div class="quiz-row-header">
        <div class="quiz-row-icon" data-type="${escapeHtml(quiz.quizType || "multiple_choice")}">
          ${iconSvg(defaultIcon(quiz), 20)}
        </div>
        <div class="quiz-row-badges">
          <span class="quiz-type-pill">${escapeHtml(typeLabel)}</span>
          ${quiz.cloudId ? `<span class="quiz-cloud-pill" title="Đã đồng bộ Cloud">${iconSvg("Cloud", 12)}</span>` : ""}
        </div>
        <button class="icon-btn quiz-row-more" type="button" aria-label="Tùy chọn cho ${escapeHtml(quiz.fileName)}">
          ${iconSvg("MoreHorizontal", 18)}
        </button>
      </div>
      <div class="quiz-row-info">
        <div class="quiz-row-name">${escapeHtml(quiz.fileName)}</div>
        <div class="quiz-row-sub">${escapeHtml(quiz.mainTopic || `${topicCount} chủ đề học tập`)}</div>
      </div>
      <div class="quiz-row-footer">
        <div class="quiz-row-metrics">
          <span class="quiz-metric-chip"><strong>${quiz.totalQuestions}</strong> câu</span>
          <span class="quiz-metric-chip">${topicCount} phần</span>
          ${
            lastAttempt
              ? `<span class="quiz-metric-chip score">${lastAttempt.percentage}% gần nhất</span>`
              : ""
          }
        </div>
        <span class="quiz-row-cta">Học ${iconSvg("ArrowRight", 14)}</span>
      </div>
    `;

    const moreBtn = row.querySelector(".quiz-row-more");
    moreBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      openQuizSheet(quiz, onStart);
    });

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
    { icon: "Play", label: "Bắt đầu ôn tập / thi thử", onClick: () => onStart(quiz) },
    { icon: "Share2", label: "Chia sẻ bằng link", onClick: () => shareQuiz(quiz) },
    { icon: "PenLine", label: "Đổi tên bộ đề", onClick: () => renameQuiz(quiz) },
    {
      icon: "CloudUpload",
      label: quiz.cloudId ? "Đã lưu Cloud — Cập nhật" : "Lưu lên Cloud",
      onClick: () => syncOne(quiz)
    },
    { icon: "Download", label: "Xuất file JSON", onClick: () => exportQuiz(quiz) },
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
    document.getElementById("authModal")?.classList.add("open");
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

  const index = getQuizIndex(quiz.id);
  removeQuiz(quiz.id);

  // Trì hoãn xóa cloud để còn kịp hoàn tác; chỉ xóa thật sau khi hết cửa sổ undo
  let undone = false;
  let cloudTimer = null;
  if (quiz.cloudId) {
    cloudTimer = setTimeout(() => {
      if (!undone) deleteCloudQuiz(quiz.cloudId).catch(() => {});
    }, 6500);
  }

  toast(`Đã xóa "${quiz.fileName}".`, {
    type: "info",
    duration: 6000,
    actionText: "Hoàn tác",
    onAction: () => {
      undone = true;
      if (cloudTimer) clearTimeout(cloudTimer);
      restoreQuiz(quiz, index);
      toastSuccess(`Đã khôi phục "${quiz.fileName}".`);
    }
  });
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
