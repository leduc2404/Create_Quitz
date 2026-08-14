// Màn hình làm quiz — deep work: 1 câu hỏi, timer, bookmark câu quan trọng.
import { engine } from "../../core/quiz-engine.js";
import { saveSession, clearSession } from "../../core/storage/local.js";
import { getQuiz } from "../../core/store.js";
import { recordReview } from "../../core/srs.js";
import { toggleImportant, isImportant } from "../../core/flags.js";
import { iconSvg } from "../icons.js";
import { confirmDialog } from "../confirm.js";
import { showScreen } from "../router.js";
import { toast } from "../toast.js";
import { buildEssayAnswerNodes } from "../util.js";
import { fmtScore } from "../../core/exam-config.js";

let finishCallback = null;

// ---- Timer state ----
let timerInterval = null;
let remaining = 0; // giây còn lại
let timerCfg = null; // { enabled, mode: 'question'|'total', seconds } | null

export function initQuizView({ onExit, onFinish }) {
  finishCallback = onFinish;
  document.getElementById("exitQuizBtn").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Thoát quiz?",
      message: "Tiến độ hiện tại sẽ được giữ lại — bạn có thể tiếp tục sau.",
      okText: "Thoát",
      cancelText: "Ở lại"
    });
    if (!ok) return;
    stopTimer();
    persistSession();
    onExit();
  });

  document.getElementById("nextBtn").addEventListener("click", () => {
    goNext(onFinish);
  });

  document.getElementById("bookmarkBtn").addEventListener("click", () => {
    const key = engine.currentKey();
    if (!key) return;
    const nowMarked = toggleImportant(key, { ...engine.current });
    syncBookmarkUi(nowMarked);
    toast(
      nowMarked ? "Đã đánh dấu câu quan trọng." : "Đã bỏ đánh dấu.",
      { duration: 1500 }
    );
  });
}

function syncBookmarkUi(marked) {
  document.getElementById("bookmarkBtn").classList.toggle("active", marked);
}

export function persistSession() {
  if (engine.finished || engine.total === 0) {
    clearSession();
  } else {
    saveSession(engine.serialize());
  }
}

export function enterQuizScreen() {
  showScreen("quizScreen");
  // Cài đặt timer lấy từ quiz trong thư viện (phiên trộn lẫn không có timer)
  timerCfg = engine.quizId ? (getQuiz(engine.quizId) || {}).settings?.timer || null : null;
  if (timerCfg && timerCfg.enabled && timerCfg.seconds > 0) {
    remaining = timerCfg.seconds;
    if (timerCfg.mode === "total") startTimer(); // toàn bài: chạy 1 lần
  }
  renderQuestion();
}

export function renderQuestion() {
  const question = engine.current;
  if (!question) return;
  const type = questionType(question);

  // Progress
  document.getElementById("progressFill").style.width = `${engine.progress}%`;
  document.getElementById("questionCounter").textContent = `${engine.index + 1}/${engine.total}`;

  document.getElementById("questionId").textContent = question.id ? `#${question.id}` : "";
  document.getElementById("topicBadge").textContent = question.topic || "Quiz";
  document.getElementById("questionText").textContent = question.question;

  document.getElementById("questionTypeBadge").textContent =
    TYPE_LABELS[type] || "Trắc nghiệm";

  // Bookmark state của câu hiện tại
  syncBookmarkUi(!!engine.currentKey() && isImportant(engine.currentKey()));

  const optionsContainer = document.getElementById("optionsContainer");
  optionsContainer.innerHTML = "";

  if (type === "essay") {
    renderEssay(optionsContainer, question);
  } else if (type === "true_false") {
    renderTrueFalse(optionsContainer, question);
  } else if (type === "short_answer") {
    renderShortAnswer(optionsContainer, question);
  } else {
    question.options.forEach((option) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = option;
      btn.addEventListener("click", () => selectOption(btn, option));
      optionsContainer.appendChild(btn);
    });
  }
  document.getElementById("nextBtn").classList.remove("show");

  // Replay animation
  const questionCard = document.getElementById("questionCard");
  questionCard.style.animation = "none";
  void questionCard.offsetHeight;
  questionCard.style.animation = "fadeUp 0.35s ease";

  // Timer mỗi câu: reset khi sang câu mới
  if (timerCfg && timerCfg.enabled && timerCfg.mode === "question") {
    remaining = timerCfg.seconds;
    startTimer();
  }

  persistSession();
}

// ---------- Timer ----------
function startTimer() {
  stopTimer();
  updateTimerUi();
  document.getElementById("timerChip").hidden = false;
  timerInterval = setInterval(() => {
    remaining--;
    updateTimerUi();
    if (remaining <= 0) {
      stopTimer();
      onTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  const chip = document.getElementById("timerChip");
  if (chip) {
    chip.hidden = true;
    chip.classList.remove("danger");
  }
}

function updateTimerUi() {
  const m = Math.floor(Math.max(remaining, 0) / 60);
  const s = Math.max(remaining, 0) % 60;
  document.getElementById("timerText").textContent = `${m}:${String(s).padStart(2, "0")}`;
  document.getElementById("timerChip").classList.toggle("danger", remaining <= 5);
}

/** Hết giờ: trắc nghiệm tính là sai + hiện đáp án; tự luận chuyển câu; toàn bài kết thúc */
function onTimeout() {
  if (timerCfg && timerCfg.mode === "total") {
    toast("Hết giờ! Xem kết quả nhé.", { type: "info", duration: 2000 });
    finishNow();
    return;
  }

  const question = engine.current;
  if (!question) return;
  const type = questionType(question);

  if (type === "essay") {
    toast("Hết giờ cho câu này.", { duration: 1400 });
    goNext(finishCallback);
    return;
  }

  if (engine.answered) return;
  const key = engine.currentKey();
  const container = document.getElementById("optionsContainer");

  if (type === "true_false") {
    const result = engine.answerTrueFalse({}); // bỏ trống → 0 điểm
    recordReview(key, false, { ...question });
    showTfFeedback(container, question, result.choices, result);
  } else if (type === "short_answer") {
    const result = engine.answerShortAnswer("");
    recordReview(key, false, { ...question });
    showShortFeedback(container, question, result);
  } else {
    engine.answer(null); // tính là sai
    recordReview(key, false, { ...question });
    document.querySelectorAll(".option-btn").forEach((b) => {
      b.classList.add("disabled");
      if (b.textContent === question.answer) b.classList.add("correct");
    });
  }

  showNextCta();
  toast("Hết giờ! Đáp án đúng đã được tô sáng.", { type: "error", duration: 2000 });
  persistSession();
}

/** Kết thúc ngay (total timer hết giờ) */
function finishNow() {
  while (!engine.finished) engine.next();
  persistSession();
  if (finishCallback) finishCallback();
}

// ---------- Essay flashcard ----------
// Flashcard tự chấm cho câu tự luận — active recall + metacognition:
// người học phải tự gợi nhớ TRƯỚC khi xem đáp án, rồi tự đánh giá.
function renderEssay(container, question) {
  const hint = document.createElement("p");
  hint.className = "flashcard-hint";
  hint.textContent = "Tự trả lời trong đầu (hoặc ra giấy) trước, sau đó lật thẻ để kiểm tra.";

  const flipBtn = document.createElement("button");
  flipBtn.className = "toggle-answer-btn";
  flipBtn.innerHTML = `${iconSvg("RotateCw", 17)} Lật thẻ xem đáp án`;

  const answerDiv = document.createElement("div");
  answerDiv.className = "essay-answer";
  answerDiv.hidden = true;

  const label = document.createElement("div");
  label.className = "essay-answer-label";
  label.textContent = "ĐÁP ÁN GỢI Ý";
  const content = document.createElement("div");
  content.className = "essay-answer-content";
  content.appendChild(buildEssayAnswerNodes(question.answer));
  answerDiv.append(label, content);

  const gradeDiv = document.createElement("div");
  gradeDiv.className = "flashcard-grade";
  gradeDiv.hidden = true;

  const grade = (correct) => {
    recordReview(engine.currentKey(), correct, { ...question });
    toast(
      correct
        ? "Tuyệt! Câu này sẽ quay lại sau vài ngày để chống quên."
        : "Đã lên lịch ôn lại sau 10 phút.",
      { duration: 1600 }
    );
    goNext(finishCallback);
  };

  const againBtn = document.createElement("button");
  againBtn.className = "grade-btn again";
  againBtn.innerHTML = `${iconSvg("X", 17)} Chưa thuộc`;
  againBtn.addEventListener("click", () => grade(false));

  const goodBtn = document.createElement("button");
  goodBtn.className = "grade-btn good";
  goodBtn.innerHTML = `${iconSvg("CircleCheck", 17)} Đã thuộc`;
  goodBtn.addEventListener("click", () => grade(true));

  gradeDiv.append(againBtn, goodBtn);

  flipBtn.addEventListener("click", () => {
    hint.hidden = true;
    flipBtn.hidden = true;
    answerDiv.hidden = false;
    gradeDiv.hidden = false;
  });

  const navDiv = document.createElement("div");
  navDiv.className = "essay-navigation";

  const prevBtn = document.createElement("button");
  prevBtn.className = "essay-nav-btn";
  prevBtn.textContent = "Câu trước";
  prevBtn.disabled = engine.index === 0;
  prevBtn.addEventListener("click", () => {
    engine.prev();
    renderQuestion();
  });

  const nextBtn = document.createElement("button");
  nextBtn.className = "essay-nav-btn";
  nextBtn.textContent = engine.index === engine.total - 1 ? "Xem kết quả" : "Bỏ qua";
  nextBtn.addEventListener("click", () => goNext(finishCallback));

  navDiv.append(prevBtn, nextBtn);
  container.append(hint, flipBtn, answerDiv, gradeDiv, navDiv);
}

function selectOption(btn, selectedOption) {
  const srsKey = engine.currentKey();
  const result = engine.answer(selectedOption);
  if (result === null) return;

  // Trả lời xong dừng timer của câu (chế độ mỗi câu)
  if (timerCfg && timerCfg.enabled && timerCfg.mode === "question") stopTimer();

  // Ghi vào lịch lặp lại ngắt quãng ngay khi vừa trả lời
  recordReview(srsKey, result, { ...engine.current });

  const question = engine.current;
  document.querySelectorAll(".option-btn").forEach((b) => {
    b.classList.add("disabled");
    if (b.textContent === question.answer) b.classList.add("correct");
  });
  btn.classList.add(result ? "correct" : "incorrect");

  showNextCta();
  persistSession();
}

// ---------- Phần II: Đúng/Sai 4 ý a–d ----------
function renderTrueFalse(container, question) {
  const choices = {}; // index ý -> true (Đúng) / false (Sai)
  const wrap = document.createElement("div");
  wrap.className = "tf-wrap";

  (question.items || []).forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "tf-item";

    const label = document.createElement("span");
    label.className = "tf-label";
    label.textContent = `${"abcd"[i] || i + 1})`;

    const text = document.createElement("span");
    text.className = "tf-text";
    text.textContent = item.text;

    const toggle = document.createElement("div");
    toggle.className = "tf-toggle";
    const pick = (value, btn) => {
      if (engine.answered) return;
      choices[i] = value;
      toggle.querySelectorAll(".tf-btn").forEach((b) =>
        b.classList.remove("active", "active-true", "active-false")
      );
      btn.classList.add("active", value ? "active-true" : "active-false");
    };
    for (const [value, labelText] of [[true, "Đúng"], [false, "Sai"]]) {
      const btn = document.createElement("button");
      btn.className = "tf-btn";
      btn.type = "button";
      btn.dataset.value = String(value);
      btn.textContent = labelText;
      btn.addEventListener("click", () => pick(value, btn));
      toggle.appendChild(btn);
    }

    row.append(label, text, toggle);
    wrap.appendChild(row);
  });

  container.appendChild(wrap);

  const submit = document.createElement("button");
  submit.className = "primary-btn submit-answer-btn";
  submit.textContent = "Xác nhận";
  submit.addEventListener("click", () => submitTrueFalse(container, question, choices));
  container.appendChild(submit);
}

function submitTrueFalse(container, question, choices) {
  const srsKey = engine.currentKey();
  const result = engine.answerTrueFalse(choices);
  if (!result) return;

  if (timerCfg && timerCfg.enabled && timerCfg.mode === "question") stopTimer();
  recordReview(srsKey, result.ok, { ...question });
  showTfFeedback(container, question, result.choices, result);
  toast(
    result.ok
      ? `Chính xác! +${fmtScore(result.earned)}đ`
      : `Đúng ${result.correctCount}/${question.items.length} ý · +${fmtScore(result.earned)}đ`,
    { duration: 1800 }
  );
  showNextCta();
  persistSession();
}

/** Tô xanh/đỏ từng ý theo đáp án + chip điểm đạt được */
function showTfFeedback(container, question, chosen, result) {
  const rows = container.querySelectorAll(".tf-item");
  const items = question.items || [];
  rows.forEach((row, i) => {
    const toggles = row.querySelectorAll(".tf-btn");
    toggles.forEach((b) => (b.disabled = true));
    if (chosen[i] === undefined) {
      row.classList.add("unanswered");
    } else {
      row.classList.toggle("correct-item", chosen[i] === Boolean(items[i]?.correct));
      row.classList.toggle("incorrect-item", chosen[i] !== Boolean(items[i]?.correct));
    }
    // Tô sáng nút tương ứng đáp án đúng
    toggles.forEach((b) => {
      if (b.dataset.value === String(Boolean(items[i]?.correct))) {
        b.classList.add("reveal-correct");
      }
    });
  });

  const submit = container.querySelector(".submit-answer-btn");
  if (submit) submit.disabled = true;

  const chip = document.createElement("div");
  chip.className = "tf-score";
  chip.textContent = `Điểm câu này: +${fmtScore(result.earned)}đ / ${fmtScore(result.maxPoints)}đ`;
  container.appendChild(chip);
}

// ---------- Phần III: Trả lời ngắn ----------
function renderShortAnswer(container, question) {
  const row = document.createElement("div");
  row.className = "short-row";

  const input = document.createElement("input");
  input.className = "input short-input";
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.placeholder = "Nhập đáp án số (VD: -1.5 hoặc 0,25)";

  const submit = document.createElement("button");
  submit.className = "primary-btn";
  submit.textContent = "Trả lời";
  submit.addEventListener("click", () => submitShortAnswer(container, question, input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit.click();
  });

  row.append(input, submit);
  container.appendChild(row);
}

function submitShortAnswer(container, question, text) {
  const srsKey = engine.currentKey();
  const result = engine.answerShortAnswer(text);
  if (!result) return;

  if (timerCfg && timerCfg.enabled && timerCfg.mode === "question") stopTimer();
  recordReview(srsKey, result.ok, { ...question });
  showShortFeedback(container, question, result);
  toast(
    result.ok
      ? `Chính xác! +${fmtScore(result.earned)}đ`
      : `Sai. Đáp án đúng: ${question.answer}`,
    { duration: 1800 }
  );
  showNextCta();
  persistSession();
}

function showShortFeedback(container, question, result) {
  const input = container.querySelector(".short-input");
  const btn = container.querySelector(".short-row .primary-btn");
  if (input) input.disabled = true;
  if (btn) btn.disabled = true;

  const fb = document.createElement("div");
  fb.className = `short-feedback ${result.ok ? "ok" : "bad"}`;
  fb.textContent = result.ok
    ? `Chính xác! Đáp án: ${question.answer}`
    : `Sai. Đáp án đúng: ${question.answer}`;
  container.appendChild(fb);
}

// ---------- Tiện ích chung ----------
const TYPE_LABELS = {
  multiple_choice: "Trắc nghiệm",
  true_false: "Đúng – Sai",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận"
};

function questionType(question) {
  return (
    question.type ||
    (question.options && question.options.length > 0 ? "multiple_choice" : "essay")
  );
}

function showNextCta() {
  const nextBtn = document.getElementById("nextBtn");
  nextBtn.textContent = engine.index === engine.total - 1 ? "Xem kết quả" : "Câu tiếp theo";
  nextBtn.classList.add("show");
}

function goNext(onFinish) {
  const cb = onFinish || finishCallback;
  const hasNext = engine.next();
  if (!hasNext) {
    stopTimer();
    persistSession(); // sẽ clear vì finished
    if (cb) cb();
  } else {
    renderQuestion();
  }
}
