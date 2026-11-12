// Màn hình chọn chủ đề (Launchpad) + chọn độ dài phiên ôn + chọn chế độ học (Practice / Exam / Flashcard 3D)
// + Lọc dạng câu hỏi (Trắc nghiệm, Trả lời ngắn, Tự luận) + Thứ tự làm bài (Tuần tự / Xáo trộn).
import { showScreen } from "../router.js";
import { iconSvg } from "../icons.js";
import { toast } from "../toast.js";
import { getQuestionType, filterQuestionsByType } from "../../core/quiz-parser.js";
import { escapeHtml } from "../util.js";

let currentQuiz = null;
let currentLimit = 0; // 0 = tất cả
let currentMode = "practice"; // 'practice' | 'exam' | 'flashcard'
let currentQType = "all"; // 'all' | 'multiple_choice' | 'short_answer' | 'essay'
let currentOrder = "sequential"; // 'sequential' | 'shuffle' (mặc định là tuần tự)

const MODE_DESCRIPTIONS = {
  practice: "Chấm đáp án và hiển thị lời giải ngay sau từng câu. Phù hợp để học hiểu sâu.",
  exam: "Làm toàn bộ bài thi, tự do chuyển câu và chỉ công bố điểm + đáp án khi nhấn Nộp bài.",
  flashcard: "Thẻ ghi nhớ 3D lật mặt trước/sau trực quan kết hợp tự đánh giá mức độ thuộc bài."
};

export function initTopicsView({ onAllTopics, onSelectTopic, onBack }) {
  document.getElementById("topicBackBtn")?.addEventListener("click", onBack);

  // 1. Chọn chế độ học tập
  document.querySelectorAll("#studyModeSeg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#studyModeSeg .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode || "practice";
      updateModeDesc();
    });
  });

  // 2. Lọc dạng câu hỏi
  document.querySelectorAll("#qTypeChips .limit-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#qTypeChips .limit-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentQType = chip.dataset.qtype || "all";
      updateCountsAndUI();
    });
  });

  // 3. Thứ tự làm bài (Tuần tự / Xáo trộn - mặc định tuần tự)
  document.querySelectorAll("#orderModeSeg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#orderModeSeg .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentOrder = btn.dataset.order || "sequential";
    });
  });

  // 4. Giới hạn số câu ôn
  document.querySelectorAll("#limitChipsGroup .limit-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      currentLimit = Number(chip.dataset.limit);
      document.querySelectorAll("#limitChipsGroup .limit-chip").forEach((c) =>
        c.classList.toggle("active", c === chip)
      );
    });
  });

  // 5. Bắt đầu toàn bộ đề
  document.getElementById("startAllTopicsBtn")?.addEventListener("click", () => {
    const quiz = currentQuiz;
    if (!quiz) return;
    const pool = filterQuestionsByType(quiz.questions || [], currentQType);
    if (pool.length === 0) {
      toast("Không có câu hỏi nào thuộc dạng bài đã chọn.", { type: "info" });
      return;
    }
    onAllTopics(quiz, currentLimit, currentMode, currentQType, currentOrder);
  });

  // 6. Chọn chủ đề riêng lẻ
  document.getElementById("topicGrid")?.addEventListener("click", (e) => {
    const card = e.target.closest(".topic-card");
    if (!card || !currentQuiz) return;
    if (card.classList.contains("disabled")) {
      toast("Chủ đề này không có câu hỏi thuộc dạng bài đã chọn.", { type: "info" });
      return;
    }
    onSelectTopic(currentQuiz, Number(card.dataset.topicIndex), currentMode, currentQType, currentOrder);
  });
}

function updateModeDesc() {
  const descEl = document.getElementById("studyModeDesc");
  if (descEl) {
    descEl.textContent = MODE_DESCRIPTIONS[currentMode] || MODE_DESCRIPTIONS.practice;
  }
}

function updateCountsAndUI() {
  if (!currentQuiz) return;
  const filtered = filterQuestionsByType(currentQuiz.questions || [], currentQType);
  const qCount = filtered.length;

  // Cập nhật nút Bắt đầu
  const startBtn = document.getElementById("startAllTopicsBtn");
  if (startBtn) {
    startBtn.innerHTML = `${iconSvg("Play", 18)} Bắt đầu toàn bộ đề (${qCount} câu)`;
    startBtn.disabled = qCount === 0;
  }

  // Cập nhật limit chips
  document.querySelectorAll("#limitChipsGroup .limit-chip").forEach((chip) => {
    const limit = Number(chip.dataset.limit);
    chip.hidden = limit > 0 && qCount <= limit;
    if (limit === currentLimit && chip.hidden) {
      currentLimit = 0;
    }
    chip.classList.toggle("active", limit === currentLimit);
  });

  // Cập nhật số câu trên từng topic card
  const topicsList = Array.isArray(currentQuiz.topics) ? currentQuiz.topics : [];
  const topicGrid = document.getElementById("topicGrid");
  if (!topicGrid) return;

  topicGrid.querySelectorAll(".topic-card").forEach((card) => {
    const idx = Number(card.dataset.topicIndex);
    const topic = topicsList[idx];
    const tQuestions = topic?.questions || [];
    const tFiltered = filterQuestionsByType(tQuestions, currentQType);
    const count = tFiltered.length;

    const countEl = card.querySelector(".question-count");
    if (countEl) countEl.textContent = `${count} câu hỏi`;

    if (count === 0) {
      card.classList.add("disabled");
      card.setAttribute("aria-disabled", "true");
    } else {
      card.classList.remove("disabled");
      card.removeAttribute("aria-disabled");
    }
  });
}

function renderTopicCards(quiz) {
  const topicGrid = document.getElementById("topicGrid");
  if (!topicGrid) return;
  topicGrid.innerHTML = "";
  const topicHint = document.getElementById("topicHint");
  const topicsList = Array.isArray(quiz.topics) ? quiz.topics : [];

  if (topicHint) {
    topicHint.hidden = topicsList.length === 0;
  }

  topicsList.forEach((topic, index) => {
    const card = document.createElement("div");
    card.className = "topic-card";
    card.dataset.topicIndex = index;
    card.setAttribute("role", "button");
    card.tabIndex = 0;

    const numStr = String(index + 1).padStart(2, "0");
    card.innerHTML = `
      <div class="topic-card-top">
        <span class="topic-index-badge">CHỦ ĐỀ ${numStr}</span>
        <span class="topic-arrow">${iconSvg("ArrowRight", 15)}</span>
      </div>
      <h3>${escapeHtml(topic.topic || `Chủ đề ${index + 1}`)}</h3>
      <p class="question-count">...</p>
    `;

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
    topicGrid.appendChild(card);
  });
}

export function showTopicSelection(quiz) {
  currentQuiz = quiz;
  currentLimit = 0;
  currentMode = "practice";
  currentQType = "all";
  currentOrder = "sequential"; // Luôn mặc định là tuần tự

  // Reset mode seg về 'practice'
  document.querySelectorAll("#studyModeSeg .seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === "practice");
  });
  updateModeDesc();

  // Reset order seg về 'sequential' (tuần tự)
  document.querySelectorAll("#orderModeSeg .seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.order === "sequential");
  });

  // Tiêu đề môn học / bộ đề
  const title = quiz.mainTopic || quiz.fileName || "Bộ đề";
  const subTitleEl = document.getElementById("subjectTitle");
  if (subTitleEl) subTitleEl.textContent = title.replace(/\.json$/i, "");

  // Nhận diện tự động các dạng câu hỏi có trong bộ đề
  const allQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];
  let countChoice = 0;
  let countShort = 0;
  let countEssay = 0;

  for (const q of allQuestions) {
    const t = getQuestionType(q);
    if (t === "multiple_choice" || t === "true_false") countChoice++;
    else if (t === "short_answer") countShort++;
    else if (t === "essay") countEssay++;
  }

  const availableCategories = [];
  if (countChoice > 0) availableCategories.push("multiple_choice");
  if (countShort > 0) availableCategories.push("short_answer");
  if (countEssay > 0) availableCategories.push("essay");

  const qTypeFilterGroup = document.getElementById("qTypeFilterGroup");
  const chipAll = document.getElementById("qTypeChipAll");
  const chipChoice = document.getElementById("qTypeChipChoice");
  const chipShort = document.getElementById("qTypeChipShort");
  const chipEssay = document.getElementById("qTypeChipEssay");

  // Tự động nhận diện: Nếu bộ đề chỉ có 1 dạng câu hỏi (hoặc không có) thì tự động ẩn thanh lọc
  if (availableCategories.length <= 1) {
    if (qTypeFilterGroup) qTypeFilterGroup.hidden = true;
  } else {
    if (qTypeFilterGroup) qTypeFilterGroup.hidden = false;

    if (chipAll) {
      chipAll.textContent = `Tất cả (${allQuestions.length})`;
      chipAll.classList.add("active");
    }
    if (chipChoice) {
      chipChoice.hidden = countChoice === 0;
      chipChoice.textContent = `Trắc nghiệm (${countChoice})`;
      chipChoice.classList.remove("active");
    }
    if (chipShort) {
      chipShort.hidden = countShort === 0;
      chipShort.textContent = `Trả lời ngắn (${countShort})`;
      chipShort.classList.remove("active");
    }
    if (chipEssay) {
      chipEssay.hidden = countEssay === 0;
      chipEssay.textContent = `Tự luận (${countEssay})`;
      chipEssay.classList.remove("active");
    }
  }

  // Render các thẻ chủ đề
  renderTopicCards(quiz);

  // Cập nhật số câu hiển thị trên các nút và thẻ
  updateCountsAndUI();

  showScreen("topicSelection");
}
