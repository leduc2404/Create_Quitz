// Tab Profile — Thẻ tài khoản, Bảng phân tích năng lực EdTech, Lịch sử khảo thí và Cài đặt.
import { isSoundEnabled, setSoundEnabled } from "../sound.js";
import { getAttempts, clearAttempts, getStudyStats } from "../../core/storage/local.js";
import { fmtScore } from "../../core/exam-config.js";
import { iconSvg, hydrateIcons } from "../icons.js";
import { toast } from "../toast.js";

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
    empty.innerHTML = `${iconSvg("BookOpen", 32)}<span>Chưa có lượt thi nào. Hãy bắt đầu luyện tập hoặc thi thử nhé!</span>`;
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

    const paceStr = a.avgPace ? ` · ⏱️ ${a.avgPace}s/câu` : "";
    const wrongStr = a.wrongCount != null ? ` · ❌ ${a.wrongCount} sai` : "";
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
