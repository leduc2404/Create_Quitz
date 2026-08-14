// Tab Home — greeting, Quick Start card duy nhất, quick actions + stats.
import { getState, subscribe, unsyncedQuizzes, updateQuiz } from "../../core/store.js";
import { saveQuizToCloud } from "../../core/storage/cloud.js";
import { loadSession, clearSession } from "../../core/storage/local.js";
import { dueEntries } from "../../core/srs.js";
import { importantCount } from "../../core/flags.js";
import { showTab } from "../router.js";
import { toast, toastError, toastSuccess } from "../toast.js";

/**
 * @param {object} hooks
 *  - onResumeSession(): tiếp tục phiên dở (engine.restore + enterQuizScreen)
 *  - onReviewDue(): ôn câu đến hạn SRS
 *  - onImportant(): ôn câu quan trọng (bookmark)
 *  - onQuick(n): ôn nhanh n câu
 */
export function initHomeView({ onResumeSession, onReviewDue, onImportant, onQuick }) {
  document.getElementById("quickStartBtn").addEventListener("click", () => {
    const session = loadSession();
    if (session && session.questions && session.questions.length > 0) {
      onResumeSession();
      return;
    }
    if (dueEntries().length > 0) {
      onReviewDue();
      return;
    }
    if (getState().quizzes.length > 0) {
      onQuick(10);
      return;
    }
    // Chưa có dữ liệu — đưa sang tab Tạo
    showTab("createScreen");
    toast("Dán JSON hoặc chọn file để tạo bộ đề đầu tiên nhé!", { type: "info" });
  });

  document.getElementById("quickTenBtn").addEventListener("click", () => onQuick(10));
  document.getElementById("reviewDueBtn").addEventListener("click", onReviewDue);
  document.getElementById("importantBtn").addEventListener("click", onImportant);

  setupResumeBanner(onResumeSession);
  setupSyncBanner();

  subscribe("quizzes", renderStats);
  window.addEventListener("quitz:tab", (e) => {
    if (e.detail === "homeScreen") renderStats();
  });
  renderStats();
}

// ---------- Stats + pills ----------
export function renderStats() {
  const due = dueEntries().length;
  const flagged = importantCount();

  const dueBtn = document.getElementById("reviewDueBtn");
  dueBtn.hidden = due === 0;
  document.getElementById("duePill").textContent = due;

  const importantBtn = document.getElementById("importantBtn");
  importantBtn.hidden = flagged === 0;
  document.getElementById("importantPill").textContent = flagged;

  document.getElementById("quickSub").textContent =
    due > 0
      ? `${due} câu đến hạn đang chờ bạn.`
      : getState().quizzes.length > 0
        ? "Bắt đầu phiên ôn tập của bạn."
        : "Tạo bộ đề đầu tiên để bắt đầu hành trình.";
}

// ---------- Phiên đang dở ----------
function setupResumeBanner(onResumeSession) {
  const banner = document.getElementById("resumeBanner");
  const session = loadSession();
  if (!session || !session.questions || session.questions.length === 0) return;

  banner.hidden = false;
  document.getElementById("resumeMeta").textContent =
    `${session.label || "Quiz"} — câu ${Math.min(session.index + 1, session.questions.length)}/${session.questions.length}`;

  document.getElementById("resumeBtn").addEventListener("click", () => {
    banner.hidden = true;
    onResumeSession();
  });
  document.getElementById("discardSessionBtn").addEventListener("click", () => {
    clearSession();
    banner.hidden = true;
  });
}

// ---------- Đồng bộ cloud ----------
function setupSyncBanner() {
  document.getElementById("syncAllBtn").addEventListener("click", async () => {
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
  const pending = unsyncedQuizzes();
  const shouldShow = !!user && pending.length > 0;
  banner.hidden = !shouldShow;
  if (shouldShow) {
    document.getElementById("syncBannerText").textContent =
      `${pending.length} quiz đang lưu trên máy. Đồng bộ lên cloud để giữ vĩnh viễn?`;
  }
}
