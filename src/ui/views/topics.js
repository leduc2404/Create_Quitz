// Màn hình chọn chủ đề + chọn độ dài phiên ôn + chọn chế độ học (Practice / Exam / Flashcard 3D).
import { showScreen } from "../router.js";
import { iconSvg } from "../icons.js";

let currentQuiz = null;
let currentLimit = 0; // 0 = tất cả
let currentMode = "practice"; // 'practice' | 'exam' | 'flashcard'

export function initTopicsView({ onAllTopics, onSelectTopic, onBack }) {
  document.getElementById("topicBackBtn").addEventListener("click", onBack);

  // Chọn chế độ học tập
  document.querySelectorAll("#studyModeSeg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#studyModeSeg .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode || "practice";
    });
  });

  document.getElementById("startAllTopicsBtn").addEventListener("click", () => {
    const quiz = currentQuiz;
    if (quiz) onAllTopics(quiz, currentLimit, currentMode);
  });

  document.querySelectorAll(".limit-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      currentLimit = Number(chip.dataset.limit);
      document.querySelectorAll(".limit-chip").forEach((c) =>
        c.classList.toggle("active", c === chip)
      );
    });
  });

  document.getElementById("topicGrid").addEventListener("click", (e) => {
    const card = e.target.closest(".topic-card");
    if (!card || !currentQuiz) return;
    onSelectTopic(currentQuiz, Number(card.dataset.topicIndex), currentMode);
  });
}

export function showTopicSelection(quiz) {
  currentQuiz = quiz;
  currentLimit = 0;
  currentMode = "practice";

  // Reset mode seg
  document.querySelectorAll("#studyModeSeg .seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === "practice");
  });

  const title = quiz.mainTopic || quiz.fileName || "Bộ đề";
  document.getElementById("subjectTitle").textContent = title.replace(/\.json$/i, "");

  // Reset chips về "Tất cả", ẩn chip khi quiz ít câu hơn mốc
  const qCount = quiz.questions ? quiz.questions.length : 0;
  document.querySelectorAll(".limit-chip").forEach((chip) => {
    const limit = Number(chip.dataset.limit);
    chip.hidden = limit > 0 && qCount <= limit;
    chip.classList.toggle("active", limit === 0);
  });

  document.getElementById("startAllTopicsBtn").innerHTML =
    `${iconSvg("Play", 18)} Bắt đầu (${qCount} câu)`;

  const topicGrid = document.getElementById("topicGrid");
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

    const h3 = document.createElement("h3");
    h3.textContent = topic.topic || `Chủ đề ${index + 1}`;
    const p = document.createElement("p");
    p.className = "question-count";
    const subCount = topic.questions ? topic.questions.length : 0;
    p.textContent = `${subCount} câu hỏi`;
    card.append(h3, p);

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });
    topicGrid.appendChild(card);
  });

  showScreen("topicSelection");
}
