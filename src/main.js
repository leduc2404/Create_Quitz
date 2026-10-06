// Bootstrap app: khởi tạo store, 4 tab + overlays, auth, PWA.
import "./styles/styles.css";
import { perf } from "./core/perf.js";
import { registerSW } from "virtual:pwa-register";
import { initQuizzes, getState } from "./core/store.js";
import { engine, shuffleArray } from "./core/quiz-engine.js";
import { loadSession, clearSession } from "./core/storage/local.js";
import { dueEntries } from "./core/srs.js";
import { importantEntries } from "./core/flags.js";
import { readIncomingShare, clearShareFromUrl } from "./core/share.js";
import { showTab, initBottomNav } from "./ui/router.js";
import { hydrateIcons } from "./ui/icons.js";
import { initTheme } from "./ui/theme.js";
import { toast, toastSuccess } from "./ui/toast.js";
import { initHomeView, renderStats } from "./ui/views/home.js";
import { initLibraryView } from "./ui/views/library.js";
import { initCreateView, importJSON } from "./ui/views/create.js";
import { initProfileView } from "./ui/views/profile.js";
import { initTopicsView, showTopicSelection } from "./ui/views/topics.js";
import { initQuizView, enterQuizScreen } from "./ui/views/quiz.js";
import { initResultView, showResult } from "./ui/views/result.js";
import { initAuthUI, syncAfterLogin } from "./auth/auth-ui.js";
import { watchAuth } from "./auth/auth.js";
import { initInstallPrompt } from "./pwa/install.js";

// ---- Service worker: autoUpdate — bản mới tự kích hoạt khi tải lại ----
registerSW({
  onOfflineReady() {
    toast("Quitz đã sẵn sàng chạy offline.", { type: "success" });
  }
});

// ---- Khởi tạo state ----
initQuizzes();
initTheme();
initBottomNav();
hydrateIcons();

// Context của phiên quiz gần nhất (phục vụ "Làm lại")
let lastStart = null;

function beginQuiz(quiz, questions, label, mode = "practice") {
  lastStart = { quiz, questions, label, mode };
  engine.start({ quizId: quiz?.id ?? null, label, questions, exam: quiz?.exam || null, mode });
  enterQuizScreen();
}

function startQuizFlow(quiz) {
  showTopicSelection(quiz);
}

/** Gom câu hỏi từ tất cả quiz, gắn srsKey để SRS theo dõi được */
function collectAllQuestions(limit = 0) {
  const all = [];
  for (const quiz of getState().quizzes) {
    quiz.questions.forEach((q) => all.push({ ...q, srsKey: `${quiz.id}:${q.id}` }));
  }
  shuffleArray(all);
  return limit ? all.slice(0, limit) : all;
}

function startQuickReview(n) {
  const questions = collectAllQuestions(n);
  if (questions.length === 0) {
    toast("Chưa có câu hỏi nào để ôn. Hãy tạo bộ đề trước nhé!", { type: "info" });
    return;
  }
  beginQuiz(null, questions, `Ôn nhanh ${questions.length} câu`);
}

/** Ôn các câu đến hạn theo lịch lặp lại ngắt quãng */
function startDueReview() {
  const questions = dueEntries().map((e) => ({ ...e.q, srsKey: e.key }));
  if (questions.length === 0) return;
  beginQuiz(null, questions, "Ôn câu yếu");
}

/** Ôn các câu đã đánh dấu quan trọng (bookmark) */
function startImportantReview() {
  const questions = importantEntries().map((e) => ({ ...e.q, srsKey: e.key }));
  if (questions.length === 0) return;
  beginQuiz(null, questions, "Câu quan trọng");
}

function resumeSession() {
  const session = loadSession();
  if (!session || !session.questions || session.questions.length === 0) return;
  engine.restore(session);
  enterQuizScreen();
}

// ---- Khởi tạo các tab views ----
initHomeView({
  onResumeSession: resumeSession,
  onReviewDue: startDueReview,
  onImportant: startImportantReview,
  onQuick: startQuickReview
});

initLibraryView({ onStart: startQuizFlow });
initCreateView();
initProfileView();

initTopicsView({
  onAllTopics: (quiz, limit, mode) => {
    const questions = limit
      ? shuffleArray([...quiz.questions]).slice(0, limit)
      : quiz.questions;
    beginQuiz(
      quiz,
      questions,
      limit ? `${quiz.fileName} — ${questions.length} câu` : quiz.fileName,
      mode
    );
  },
  onSelectTopic: (quiz, topicIndex, mode) => {
    const topic = quiz.topics ? quiz.topics[topicIndex] : null;
    const questions = topic ? topic.questions : quiz.questions;
    const label = topic ? `${quiz.fileName} — ${topic.topic}` : quiz.fileName;
    beginQuiz(quiz, questions, label, mode);
  },
  onBack: () => showTab("libraryScreen")
});

initQuizView({
  onExit: () => {
    renderStats();
    showTab("homeScreen");
  },
  onFinish: () => {
    clearSession();
    showResult();
    renderStats();
  }
});

initResultView({
  onRestart: () => {
    if (lastStart) beginQuiz(lastStart.quiz, lastStart.questions, lastStart.label, lastStart.mode);
  },
  onRetryWrong: () => {
    const wrongQuestions = engine.wrongAnswers.map((w) => ({
      id: w.id,
      topic: w.topic,
      question: w.question,
      part: w.part,
      options: w.options,
      items: w.items,
      answer: w.correctAnswer,
      type: w.type || (w.options && w.options.length > 0 ? "multiple_choice" : "essay"),
      points: w.points,
      explanation: w.explanation,
      srsKey: w.srsKey
    }));
    beginQuiz(null, wrongQuestions, "Ôn tập câu sai");
  },
  onHome: () => {
    renderStats();
    showTab("homeScreen");
  }
});

// ---- Quiz được chia sẻ qua link (?s=... hoặc #q=...) ----
async function handleIncomingShare() {
  const incoming = await readIncomingShare();
  if (!incoming) return;
  clearShareFromUrl();

  const modal = document.getElementById("shareModal");
  document.getElementById("shareModalInfo").textContent =
    `"${incoming.name}" — ${incoming.data.questions.length} câu hỏi. Thêm vào thư viện của bạn?`;
  modal.classList.add("open");

  document.getElementById("shareAcceptBtn").addEventListener(
    "click",
    () => {
      const quiz = importJSON(incoming.data, `${incoming.name} (chia sẻ)`);
      modal.classList.remove("open");
      if (quiz) {
        toastSuccess(`Đã thêm "${quiz.fileName}" vào thư viện.`);
        showTab("libraryScreen");
      }
    },
    { once: true }
  );
  document.getElementById("shareCancelBtn").addEventListener(
    "click",
    () => modal.classList.remove("open"),
    { once: true }
  );
}
handleIncomingShare();

// ---- Auth + PWA + Onboarding ----
initAuthUI();
watchAuth((user) => {
  if (user) syncAfterLogin(user);
});
initInstallPrompt();

showTab("homeScreen");
