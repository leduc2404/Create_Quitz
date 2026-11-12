// Tab Home — Trung tâm điều hành học tập (Bento Grid, Starter Decks, Daily Goal).
import { addQuiz, getState, subscribe, unsyncedQuizzes, updateQuiz } from "../../core/store.js";
import { saveQuizToCloud } from "../../core/storage/cloud.js";
import { loadSession, clearSession, getStudyStats, getAttemptsForQuiz, genId, getDailyGoal } from "../../core/storage/local.js";
import { importantCount } from "../../core/flags.js";
import { parseQuizData } from "../../core/quiz-parser.js";
import { SAMPLE_DECKS, countDeckQuestions } from "../../core/sample-decks.js";
import { showTab } from "../router.js";
import { iconSvg } from "../icons.js";
import { toast, toastError, toastSuccess } from "../toast.js";
import { escapeHtml } from "../util.js";

let startQuizHandler = null;

/**
 * Nạp toàn bộ bộ đề mẫu vào thư viện nếu chưa tồn tại
 */
export function loadAllSampleDecks() {
  const existingNames = new Set(getState().quizzes.map((q) => q.fileName));
  let added = 0;
  let firstAdded = null;

  for (const sample of SAMPLE_DECKS) {
    if (existingNames.has(sample.title)) continue;
    try {
      const parsed = parseQuizData(sample.payload, sample.title);
      if (!parsed) continue;
      const saved = addQuiz({
        ...parsed,
        fileName: sample.title,
        id: genId(),
        createdAt: Date.now(),
        settings: { icon: sample.icon || "GraduationCap", timer: { enabled: false } }
      });
      if (!firstAdded) firstAdded = saved;
      added++;
    } catch (err) {
      console.warn("Lỗi nạp đề mẫu:", err);
    }
  }

  if (added > 0) {
    toastSuccess(`Đã nạp ${added} bộ đề mẫu vào Thư viện!`);
  } else {
    toast("Tất cả bộ đề mẫu đã có sẵn trong Thư viện của bạn.", { type: "info" });
  }
  return firstAdded;
}

/**
 * @param {object} hooks
 *  - onResumeSession(): tiếp tục phiên dở (engine.restore + enterQuizScreen)
 *  - onImportant(): ôn câu quan trọng (bookmark)
 *  - onQuick(n): ôn nhanh n câu
 *  - onStartQuiz(quiz): mở màn chọn chủ đề của bộ đề
 */
export function initHomeView({ onResumeSession, onImportant, onQuick, onStartQuiz }) {
  startQuizHandler = onStartQuiz;

  document.getElementById("quickStartBtn")?.addEventListener("click", () => {
    const session = loadSession();
    if (session && session.questions && session.questions.length > 0) {
      onResumeSession();
      return;
    }
    if (getState().quizzes.length > 0) {
      onQuick(10);
      return;
    }
    // Chưa có dữ liệu — tự động nạp bộ đề mẫu đầu tiên và vào học ngay
    const first = loadAllSampleDecks();
    if (first && startQuizHandler) {
      startQuizHandler(first);
      return;
    }
    showTab("createScreen");
  });

  document.getElementById("quickExploreLibBtn")?.addEventListener("click", () => {
    showTab("libraryScreen");
  });

  document.getElementById("quickTenBtn")?.addEventListener("click", () => onQuick(10));
  document.getElementById("importantBtn")?.addEventListener("click", onImportant);

  document.getElementById("homeAiStudioBtn")?.addEventListener("click", () => {
    showTab("createScreen");
    setTimeout(() => {
      document.getElementById("openAiBtn")?.click();
    }, 60);
  });

  document.getElementById("homeLoadSamplesBtn")?.addEventListener("click", () => {
    loadAllSampleDecks();
  });

  document.getElementById("sidebarSampleBtn")?.addEventListener("click", () => {
    loadAllSampleDecks();
    showTab("libraryScreen");
  });

  document.getElementById("streakBtn")?.addEventListener("click", () => {
    const { streak, todayCount } = getStudyStats();
    const goal = getDailyGoal();
    toast(
      streak > 0
        ? `Chuỗi ${streak} ngày học liên tục! Hôm nay đã ôn ${todayCount}/${goal} câu.`
        : `Hôm nay bạn đã ôn ${todayCount}/${goal} câu. Hãy tiếp tục để tích lũy chuỗi ngày học!`,
      { duration: 2600 }
    );
  });

  setupResumeBanner(onResumeSession);
  setupSyncBanner();
  updateGreeting();

  subscribe("quizzes", renderStats);
  window.addEventListener("quitz:goal", renderStats);
  window.addEventListener("quitz:tab", (e) => {
    if (e.detail === "homeScreen") {
      updateGreeting();
      renderStats();
    }
  });
  renderStats();
}

function updateGreeting() {
  const hour = new Date().getHours();
  const titleEl = document.getElementById("greetTitle") || document.getElementById("homeGreetingTitle");
  if (!titleEl) return;
  if (hour >= 5 && hour < 12) {
    titleEl.textContent = "Chào buổi sáng, sẵn sàng bứt phá?";
  } else if (hour >= 12 && hour < 18) {
    titleEl.textContent = "Chào buổi chiều, giữ vững nhịp độ!";
  } else if (hour >= 18 && hour < 22) {
    titleEl.textContent = "Chào buổi tối, củng cố trí nhớ nào";
  } else {
    titleEl.textContent = "Đêm muộn rồi, ôn tập nhẹ nhàng nhé";
  }
}

// ---------- Stats + Starter Decks ----------
export function renderStats() {
  const quizzes = getState().quizzes;
  const flagged = importantCount();
  const { streak, todayCount } = getStudyStats();
  const DAILY_TARGET = getDailyGoal();

  // Cập nhật badge số đề trên sidebar
  const sidebarBadge = document.getElementById("sidebarLibBadge");
  if (sidebarBadge) {
    sidebarBadge.textContent = quizzes.length;
    sidebarBadge.hidden = quizzes.length === 0;
  }

  // Streak pill trên topbar
  const streakPill = document.getElementById("streakPill");
  if (streakPill) {
    if (streak > 0) {
      streakPill.textContent = `${streak} ngày (${todayCount} câu)`;
    } else if (todayCount > 0) {
      streakPill.textContent = `${todayCount} câu hôm nay`;
    } else {
      streakPill.textContent = `Chuỗi 0 ngày`;
    }
  }

  // Tiến độ mục tiêu ngày (Home Hero & Sidebar)
  const pct = Math.min(100, Math.round((todayCount / DAILY_TARGET) * 100));
  const dailyGoalText = document.getElementById("dailyGoalText");
  const dailyGoalFill = document.getElementById("dailyGoalFill");
  if (dailyGoalText) dailyGoalText.textContent = `${todayCount} / ${DAILY_TARGET} câu`;
  if (dailyGoalFill) dailyGoalFill.style.width = `${pct}%`;
  const goalTrack = dailyGoalFill?.parentElement;
  if (goalTrack) goalTrack.title = `Tiến độ mục tiêu ${DAILY_TARGET} câu mỗi ngày`;

  const sidebarGoalVal = document.getElementById("sidebarGoalVal");
  const sidebarGoalFill = document.getElementById("sidebarGoalFill");
  if (sidebarGoalVal) sidebarGoalVal.textContent = `${todayCount}/${DAILY_TARGET} câu`;
  if (sidebarGoalFill) sidebarGoalFill.style.width = `${pct}%`;

  const importantBtn = document.getElementById("importantBtn");
  if (importantBtn) {
    importantBtn.hidden = flagged === 0;
    const impPill = document.getElementById("importantPill");
    if (impPill) impPill.textContent = flagged;
  }

  // Hero subtitle — câu khích lệ học tập
  const quickSub = document.getElementById("quickSub");
  if (quickSub) {
    quickSub.textContent =
      quizzes.length > 0
        ? `Đã sẵn sàng với ${quizzes.length} bộ đề trong thư viện. Chọn lộ trình hoặc nhấn Bắt đầu ngay.`
        : "Khám phá ngay với 3 bộ đề mẫu chuẩn THPT 2026 & TOEIC hoặc tự tạo đề bằng AI.";
  }

  renderStarterAndRecentDecks();
}

function renderStarterAndRecentDecks() {
  const container = document.getElementById("homeStarterList");
  if (!container) return;

  const quizzes = getState().quizzes;
  container.innerHTML = "";

  // Nếu người dùng đã có bộ đề trong kho, hiển thị tối đa 3 bộ đề gần nhất trước
  const recentQuizzes = quizzes.slice(0, 3);
  recentQuizzes.forEach((quiz) => {
    const attempts = getAttemptsForQuiz(quiz.id);
    const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
    const card = document.createElement("div");
    card.className = "starter-deck-card is-user-deck";
    card.setAttribute("role", "button");
    card.tabIndex = 0;

    const badgeText =
      quiz.quizType === "thpt2026"
        ? "THPT 2026"
        : quiz.quizType === "mixed"
        ? "Đề tổng hợp"
        : quiz.quizType === "essay"
        ? "Tự luận"
        : "Bộ đề của bạn";

    card.innerHTML = `
      <div class="starter-deck-top">
        <span class="starter-deck-badge">${escapeHtml(badgeText)}</span>
        <span class="starter-deck-count">${quiz.totalQuestions} câu</span>
      </div>
      <h4 class="starter-deck-title">${escapeHtml(quiz.fileName)}</h4>
      <p class="starter-deck-desc">${escapeHtml(quiz.mainTopic || "Sẵn sàng luyện tập hoặc thi thử bấm giờ.")}</p>
      <div class="starter-deck-foot">
        <span class="starter-deck-meta">
          ${lastAttempt ? `Điểm gần nhất: <strong>${lastAttempt.percentage}%</strong>` : "Chưa làm lần nào"}
        </span>
        <span class="starter-deck-cta">Vào học ${iconSvg("ArrowRight", 14)}</span>
      </div>
    `;

    const launch = () => {
      if (startQuizHandler) startQuizHandler(quiz);
      else showTab("libraryScreen");
    };
    card.addEventListener("click", launch);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        launch();
      }
    });
    container.appendChild(card);
  });

  // Hiển thị thêm các bộ đề mẫu chưa được nạp (để tổng cộng có 3 thẻ trên Home)
  const existingNames = new Set(quizzes.map((q) => q.fileName));
  const remainingSlots = Math.max(0, 3 - recentQuizzes.length);
  const samplesToShow = SAMPLE_DECKS.filter((s) => !existingNames.has(s.title)).slice(
    0,
    remainingSlots || (quizzes.length === 0 ? 3 : 1)
  );

  samplesToShow.forEach((sample) => {
    const card = document.createElement("div");
    card.className = "starter-deck-card is-sample-deck";
    card.setAttribute("role", "button");
    card.tabIndex = 0;

    card.innerHTML = `
      <div class="starter-deck-top">
        <span class="starter-deck-badge sample">${escapeHtml(sample.badge)}</span>
        <span class="starter-deck-count">${countDeckQuestions(sample.payload)} câu mẫu</span>
      </div>
      <h4 class="starter-deck-title">${escapeHtml(sample.title)}</h4>
      <p class="starter-deck-desc">${escapeHtml(sample.subtitle)}</p>
      <div class="starter-deck-foot">
        <span class="starter-deck-meta">Đề chuẩn dựng sẵn</span>
        <span class="starter-deck-cta">Nạp & Học ngay ${iconSvg("ArrowRight", 14)}</span>
      </div>
    `;

    const importAndStart = () => {
      try {
        const parsed = parseQuizData(sample.payload, sample.title);
        if (!parsed) throw new Error("Dữ liệu mẫu không hợp lệ");
        const saved = addQuiz({
          ...parsed,
          fileName: sample.title,
          id: genId(),
          createdAt: Date.now(),
          settings: { icon: sample.icon || "GraduationCap", timer: { enabled: false } }
        });
        toastSuccess(`Đã nạp "${sample.title}"!`);
        if (startQuizHandler) startQuizHandler(saved);
      } catch (err) {
        toastError("Không thể nạp đề mẫu: " + err.message);
      }
    };

    card.addEventListener("click", importAndStart);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        importAndStart();
      }
    });
    container.appendChild(card);
  });
}

// ---------- Phiên đang dở ----------
function setupResumeBanner(onResumeSession) {
  const banner = document.getElementById("resumeBanner");
  if (!banner) return;
  const session = loadSession();
  if (!session || !session.questions || session.questions.length === 0) return;

  banner.hidden = false;
  const meta = document.getElementById("resumeMeta");
  if (meta) {
    meta.textContent = `${session.label || "Quiz"} — câu ${Math.min(
      session.index + 1,
      session.questions.length
    )}/${session.questions.length}`;
  }

  document.getElementById("resumeBtn")?.addEventListener("click", () => {
    banner.hidden = true;
    onResumeSession();
  });
  document.getElementById("discardSessionBtn")?.addEventListener("click", () => {
    clearSession();
    banner.hidden = true;
  });
}

// ---------- Đồng bộ cloud ----------
function setupSyncBanner() {
  document.getElementById("syncAllBtn")?.addEventListener("click", async () => {
    const user = getState().user;
    if (!user) return;
    const pending = unsyncedQuizzes();
    let ok = 0;
    for (const quiz of pending) {
      try {
        const cloudId = await saveQuizToCloud(quiz, user.uid);
        updateQuiz(quiz.id, { cloudId, syncedAt: Date.now() });
        ok++;
      } catch (e) {
        console.warn(e);
      }
    }
    if (ok > 0) toastSuccess(`Đã đồng bộ ${ok}/${pending.length} quiz lên cloud.`);
    else toastError("Đồng bộ thất bại. Kiểm tra kết nối mạng.");
  });

  const refresh = () => renderSyncBanner(getState().user);
  subscribe("user", refresh);
  subscribe("quizzes", refresh);
  refresh();
}

function renderSyncBanner(user) {
  const banner = document.getElementById("syncBanner");
  if (!banner) return;
  const pending = unsyncedQuizzes();
  const shouldShow = !!user && pending.length > 0;
  banner.hidden = !shouldShow;
  if (shouldShow) {
    const txt = document.getElementById("syncBannerText");
    if (txt) {
      txt.textContent = `${pending.length} quiz đang lưu trên máy. Đồng bộ lên cloud để giữ vĩnh viễn?`;
    }
  }
}
