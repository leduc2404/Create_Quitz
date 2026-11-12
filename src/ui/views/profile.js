// Tab Profile — Thẻ tài khoản, Bảng phân tích năng lực EdTech, Lịch sử khảo thí, Sao lưu & Cài đặt.
import { isSoundEnabled, setSoundEnabled } from "../sound.js";
import { getAttempts, clearAttempts, getStudyStats, getDailyGoal, saveDailyGoal, getActivityMap } from "../../core/storage/local.js";
import { getState } from "../../core/store.js";
import { perf } from "../../core/perf.js";
import { fmtScore } from "../../core/exam-config.js";
import { iconSvg, hydrateIcons } from "../icons.js";
import { toast, toastError, toastSuccess } from "../toast.js";

const MODE_LABELS = {
  exam: "Thi thử",
  practice: "Luyện tập",
  flashcard: "Flashcard 3D"
};

export function initProfileView() {
  const soundToggle = document.getElementById("soundToggle");
  if (soundToggle) {
    soundToggle.checked = isSoundEnabled();
    soundToggle.addEventListener("change", (e) => {
      setSoundEnabled(e.target.checked);
      toast(
        e.target.checked ? "Đã bật âm thanh hiệu ứng." : "Đã tắt âm thanh hiệu ứng.",
        { duration: 1400 }
      );
    });
  }

  // Eco Mode (Adaptive Performance 60fps)
  const ecoToggle = document.getElementById("ecoModeToggle");
  if (ecoToggle) {
    ecoToggle.checked = perf.isLowPerf();
    ecoToggle.addEventListener("change", (e) => {
      perf.setLowPerfMode(e.target.checked);
      toast(
        e.target.checked
          ? "Đã bật chế độ Siêu mượt 60fps (Eco Mode)."
          : "Đã bật chế độ Hiệu ứng đồ họa đầy đủ.",
        { duration: 1600 }
      );
    });
  }

  // Mục tiêu mỗi ngày (Daily Goal stepper)
  const goalValue = document.getElementById("goalValue");
  const syncGoal = () => { if (goalValue) goalValue.textContent = getDailyGoal(); };
  const bumpGoal = (delta) => {
    const next = saveDailyGoal(getDailyGoal() + delta);
    syncGoal();
    window.dispatchEvent(new CustomEvent("quitz:goal", { detail: next }));
    toast(`Mục tiêu mới: ${next} câu mỗi ngày.`, { duration: 1400 });
  };
  document.getElementById("goalMinus")?.addEventListener("click", () => bumpGoal(-5));
  document.getElementById("goalPlus")?.addEventListener("click", () => bumpGoal(5));
  syncGoal();

  // Sao lưu toàn bộ kho đề JSON
  const exportAllBtn = document.getElementById("exportAllBtn");
  if (exportAllBtn) {
    exportAllBtn.addEventListener("click", () => {
      const quizzes = getState().quizzes || [];
      if (quizzes.length === 0) {
        toastError("Chưa có bộ đề nào trong thư viện để sao lưu.");
        return;
      }
      const backupPayload = {
        exportedAt: new Date().toISOString(),
        app: "Quitz Studio",
        count: quizzes.length,
        quizzes
      };
      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quitz-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess(`Đã xuất file sao lưu (${quizzes.length} bộ đề).`);
    });
  }

  const clearBtn = document.getElementById("clearAttemptsBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử thi và luyện tập không?")) {
        clearAttempts();
        renderProfileDashboard();
        toast("Đã xóa lịch sử khảo thí.", { duration: 1500 });
      }
    });
  }

  window.addEventListener("quitz:tab", (e) => {
    if (e.detail === "profileScreen") {
      renderProfileDashboard();
    }
  });

  renderProfileDashboard();
}

export function renderProfileDashboard() {
  const attempts = getAttempts();
  const { streak } = getStudyStats();

  renderHeatmap();

  // 1. Cập nhật thẻ chỉ số tổng quan
  const totalAttempts = attempts.length;
  const avgScore = totalAttempts > 0
    ? Math.round(attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / totalAttempts)
    : 0;

  const validPaces = attempts.filter((a) => a.avgPace > 0);
  const avgPace = validPaces.length > 0
    ? Math.round(validPaces.reduce((sum, a) => sum + a.avgPace, 0) / validPaces.length)
    : 0;

  const pTotal = document.getElementById("pTotalAttempts");
  if (pTotal) pTotal.textContent = totalAttempts;

  const pAvg = document.getElementById("pAvgScore");
  if (pAvg) pAvg.textContent = `${avgScore}%`;

  const pPace = document.getElementById("pAvgPace");
  if (pPace) pPace.textContent = avgPace > 0 ? `${avgPace}s` : "--s";

  const pStr = document.getElementById("pStreak");
  if (pStr) pStr.textContent = `${streak} ngày`;

  // 2. Cập nhật danh sách lịch sử làm bài
  const list = document.getElementById("attemptsList");
  const clearBtn = document.getElementById("clearAttemptsBtn");
  if (!list) return;

  list.innerHTML = "";

  if (attempts.length === 0) {
    if (clearBtn) clearBtn.hidden = true;
    const empty = document.createElement("div");
    empty.className = "attempts-empty";
    empty.innerHTML = `${iconSvg("BookOpen", 28)}<span>Chưa có lượt thi nào. Hãy bắt đầu luyện tập hoặc thi thử để xem thống kê chi tiết!</span>`;
    list.appendChild(empty);
    return;
  }

  if (clearBtn) clearBtn.hidden = false;

  attempts.forEach((a) => {
    const card = document.createElement("div");
    card.className = "attempt-card";

    const left = document.createElement("div");
    left.className = "attempt-left";

    const nameRow = document.createElement("div");
    nameRow.className = "attempt-name-row";

    const name = document.createElement("span");
    name.className = "attempt-name";
    name.textContent = a.quizName || "Bài thi";

    const modeBadge = document.createElement("span");
    modeBadge.className = `attempt-mode-badge ${a.studyMode || "practice"}`;
    modeBadge.textContent = MODE_LABELS[a.studyMode] || "Luyện tập";

    nameRow.append(name, modeBadge);

    const meta = document.createElement("div");
    meta.className = "attempt-meta";

    const dateStr = a.date
      ? new Date(a.date).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";

    const paceStr = a.avgPace ? ` · ${a.avgPace}s/câu` : "";
    const wrongStr = a.wrongCount != null ? ` · ${a.wrongCount} câu sai` : "";
    meta.textContent = `${dateStr}${paceStr}${wrongStr}`;

    left.append(nameRow, meta);

    const right = document.createElement("div");
    right.className = "attempt-right";

    const score = document.createElement("div");
    const pct = a.percentage != null ? a.percentage : 0;
    score.className = `attempt-score ${pct >= 80 ? "high" : pct >= 50 ? "mid" : "low"}`;
    score.textContent = a.score != null ? `${fmtScore(a.score)}/${fmtScore(a.total)}` : `${pct}%`;

    const evalText = document.createElement("div");
    evalText.className = "attempt-eval";
    evalText.textContent = `${pct}%`;

    right.append(score, evalText);
    card.append(left, right);
    list.appendChild(card);
  });

  hydrateIcons(list);
}

// ---------- Bản đồ nhiệt hoạt động (15 tuần gần nhất) ----------
function renderHeatmap() {
  const grid = document.getElementById("heatmapGrid");
  if (!grid) return;
  const activity = getActivityMap();
  const goal = getDailyGoal();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Thứ Hai của tuần hiện tại (Mon=0 .. Sun=6)
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - dow);
  const start = new Date(monday);
  start.setDate(start.getDate() - 14 * 7);

  const level = (n) => {
    if (!n) return 0;
    if (n >= goal * 1.5) return 4;
    if (n >= goal) return 3;
    if (n >= goal * 0.5) return 2;
    return 1;
  };

  grid.innerHTML = "";
  let total = 0;
  const WEEKS = 15;
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = date.toISOString().slice(0, 10);
      const count = activity[key] || 0;
      const cell = document.createElement("span");
      if (date > today) {
        cell.className = "hm-cell future";
      } else {
        total += count;
        cell.className = `hm-cell lv${level(count)}`;
        cell.title = `${date.toLocaleDateString("vi-VN")}: ${count} câu`;
      }
      grid.appendChild(cell);
    }
  }

  const badge = document.getElementById("heatmapTotalBadge");
  if (badge) badge.textContent = `${total} câu / 15 tuần`;
}
