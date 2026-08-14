// Màn hình chọn chủ đề (khi quiz có nhiều topic) + chọn độ dài phiên ôn.
import { showScreen } from "../router.js";
import { iconSvg } from "../icons.js";

let currentQuiz = null;
let currentLimit = 0; // 0 = tất cả

export function initTopicsView({ onAllTopics, onSelectTopic, onBack }) {
  document.getElementById("topicBackBtn").addEventListener("click", onBack);
  document.getElementById("startAllTopicsBtn").addEventListener("click", () => {
    const quiz = currentQuiz;
    if (quiz) onAllTopics(quiz, currentLimit);
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
    onSelectTopic(currentQuiz, Number(card.dataset.topicIndex));
  });
}

export function showTopicSelection(quiz) {
  currentQuiz = quiz;
  currentLimit = 0;
  document.getElementById("subjectTitle").textContent = quiz.mainTopic;

  // Reset chips về "Tất cả", ẩn chip khi quiz ít câu hơn mốc
  document.querySelectorAll(".limit-chip").forEach((chip) => {
    const limit = Number(chip.dataset.limit);
    chip.hidden = limit > 0 && quiz.questions.length <= limit;
    chip.classList.toggle("active", limit === 0);
  });

  document.getElementById("startAllTopicsBtn").innerHTML =
    `${iconSvg("Play", 18)} Bắt đầu (${quiz.questions.length} câu)`;

  const topicGrid = document.getElementById("topicGrid");
  topicGrid.innerHTML = "";

  quiz.topics.forEach((topic, index) => {
    const card = document.createElement("div");
    card.className = "topic-card";
    card.dataset.topicIndex = index;
    card.setAttribute("role", "button");
    card.tabIndex = 0;

    const h3 = document.createElement("h3");
    h3.textContent = topic.topic;
    const p = document.createElement("p");
    p.className = "question-count";
    p.textContent = `${topic.questions.length} câu hỏi`;
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
