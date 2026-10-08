// Màn hình làm quiz — EdTech Suite: 3 chế độ học (Practice, Exam, Flashcard 3D), SAT tools (Highlighter, Scratchpad, Flag, Zen Mode), Timer, Palette, phím tắt & audio.
import { engine } from "../../core/quiz-engine.js";
import { saveSession, clearSession, getFontSize, saveFontSize, recordStudyActivity } from "../../core/storage/local.js";
import { getQuiz } from "../../core/store.js";
import { recordReview } from "../../core/srs.js";
import { toggleImportant, isImportant } from "../../core/flags.js";
import { iconSvg } from "../icons.js";
import { confirmDialog } from "../confirm.js";
import { showScreen } from "../router.js";
import { toast } from "../toast.js";
import {
  buildEssayAnswerNodes,
  formatRichText,
  cleanOptionPrefix,
  splitPassageAndPrompt,
  formatPassageWithClozeAndParagraphs,
  escapeHtml
} from "../util.js";
import { perf } from "../../core/perf.js";
import { fmtScore } from "../../core/exam-config.js";
import { getQuestionType } from "../../core/quiz-parser.js";
import {
  playCorrectSound,
  playWrongSound,
  playCompleteSound,
  playFlipSound,
  playTickSound,
  isSoundEnabled,
  setSoundEnabled
} from "../sound.js";
import { initHighlighter } from "../highlighter.js";
import { initScratchpad, openScratchpad } from "../scratchpad.js";

let finishCallback = null;

const LEVEL_LABELS = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
  van_dung_cao: "Vận dụng cao",
  easy: "Cơ bản",
  medium: "Trung bình",
  hard: "Nâng cao"
};

// ---- Timer state ----
let timerInterval = null;
let remaining = 0;
let timerCfg = null;

export function initQuizView({ onExit, onFinish }) {
  finishCallback = onFinish;

  // Khởi tạo công cụ SAT Digital
  initHighlighter();
  initScratchpad();

  // Thoát quiz
  document.getElementById("exitQuizBtn").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Thoát bài thi?",
      message: "Tiến độ hiện tại sẽ được giữ lại — bạn có thể tiếp tục sau.",
      okText: "Thoát",
      cancelText: "Ở lại"
    });
    if (!ok) return;
    stopTimer();
    persistSession();
    onExit();
  });

  // Nút câu tiếp theo
  document.getElementById("nextBtn").addEventListener("click", () => {
    goNext(onFinish);
  });

  // Nút câu trước
  const prevBtn = document.getElementById("prevQuestionBtn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (engine.prev()) {
        renderQuestion();
      }
    });
  }

  // Nút nộp bài thi (Exam Mode)
  document.getElementById("submitExamBtn")?.addEventListener("click", async () => {
    const unanswered = engine.questions.length - Object.keys(engine.userAnswers).filter(k => engine.userAnswers[k]?.value != null).length;
    const flagged = engine.flags.size;
    let msg = "Bạn có chắc chắn muốn nộp bài thi?";
    if (unanswered > 0 || flagged > 0) {
      msg += ` (Còn ${unanswered} câu chưa làm, ${flagged} câu đã gắn cờ)`;
    }
    const ok = await confirmDialog({
      title: "Nộp bài thi?",
      message: msg,
      okText: "Nộp bài",
      cancelText: "Làm tiếp"
    });
    if (!ok) return;

    engine.submitExam();
    stopTimer();
    clearSession();
    playCompleteSound();
    if (finishCallback) finishCallback();
  });

  // Đánh dấu câu quan trọng (Bookmark)
  document.getElementById("bookmarkBtn").addEventListener("click", () => {
    const key = engine.currentKey();
    if (!key) return;
    const nowMarked = toggleImportant(key, { ...engine.current });
    syncBookmarkUi(nowMarked);
    toast(
      nowMarked ? "Đã đánh dấu câu quan trọng." : "Đã bỏ đánh dấu.",
      { duration: 1400 }
    );
  });

  // Gắn cờ phân vân (Flag)
  document.getElementById("flagBtn")?.addEventListener("click", () => {
    const isFlag = engine.toggleFlag();
    syncFlagUi(isFlag);
    toast(
      isFlag ? "Đã gắn cờ câu này để xem lại." : "Đã bỏ cờ phân vân.",
      { duration: 1400 }
    );
  });

  // Giấy nháp điện tử (Scratchpad)
  document.getElementById("scratchpadToggleBtn")?.addEventListener("click", openScratchpad);

  // Toàn màn hình tập trung (Zen Mode)
  document.getElementById("fullscreenToggleBtn")?.addEventListener("click", () => {
    const isZen = document.body.classList.toggle("zen-mode");
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    toast(
      isZen ? "Đã bật chế độ toàn màn hình tập trung." : "Đã tắt chế độ tập trung.",
      { duration: 1500 }
    );
  });

  // Bật/tắt âm thanh trực tiếp trong phòng thi
  document.getElementById("quizSoundBtn")?.addEventListener("click", () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    syncQuizSoundUi();
    const soundToggle = document.getElementById("soundToggle");
    if (soundToggle) soundToggle.checked = next;
    toast(next ? "Đã bật âm thanh." : "Đã tắt âm thanh.", { duration: 1200 });
  });

  // Cỡ chữ A- / A+
  setupFontResizer();

  // Bảng câu hỏi (Palette Modal)
  setupPaletteModal();

  // Thu gọn / mở rộng đoạn trích đọc hiểu
  setupPassageToggle();

  // Ghim câu hỏi khi cuộn sâu
  setupStickyPrompt();

  // 3D Flashcard listeners
  setupFlashcard3D();

  // Chuyển đổi tab xem Bài đọc / Câu hỏi trên điện thoại
  setupMobilePassageTabs();

  // Bật/tắt chế độ máy nhẹ (Low-Perf / Eco mode)
  setupPerfToggle();

  // Phím tắt bàn phím
  setupKeyboardShortcuts();
}

function syncQuizSoundUi() {
  const btn = document.getElementById("quizSoundBtn");
  if (!btn) return;
  const on = isSoundEnabled();
  btn.innerHTML = iconSvg(on ? "Volume2" : "VolumeX", 18);
  btn.title = on ? "Tắt âm thanh hiệu ứng (Phím M)" : "Bật âm thanh hiệu ứng (Phím M)";
  btn.classList.toggle("muted-sound", !on);
}

function syncBookmarkUi(marked) {
  document.getElementById("bookmarkBtn").classList.toggle("active", marked);
}

function syncFlagUi(flagged) {
  const flagBtn = document.getElementById("flagBtn");
  const flagBadge = document.getElementById("flagBadge");
  if (flagBtn) flagBtn.classList.toggle("active-flag", flagged);
  if (flagBadge) flagBadge.hidden = !flagged;
}

export function persistSession() {
  if (engine.finished || engine.total === 0) {
    clearSession();
  } else {
    engine.remainingTimer = remaining;
    saveSession(engine.serialize());
  }
}

export function enterQuizScreen() {
  showScreen("quizScreen");
  syncQuizSoundUi();
  lastRenderedPassage = null;
  switchToMobileTab("question");
  timerCfg = engine.quizId ? (getQuiz(engine.quizId) || {}).settings?.timer || null : null;

  if (timerCfg && timerCfg.enabled && timerCfg.seconds > 0) {
    if (engine.remainingTimer != null && engine.remainingTimer > 0) {
      remaining = engine.remainingTimer;
    } else {
      remaining = timerCfg.seconds;
    }
    if (timerCfg.mode === "total") startTimer();
  }

  renderQuestion();
}

export function renderQuestion() {
  const question = engine.current;
  if (!question) return;
  const type = questionType(question);
  const isExam = engine.studyMode === "exam";
  const isFlashcard = engine.studyMode === "flashcard";

  // Progress
  document.getElementById("progressFill").style.width = `${engine.progress}%`;
  document.getElementById("questionCounter").textContent = `${engine.index + 1}/${engine.total}`;

  document.getElementById("questionId").textContent = question.id ? `#${question.id}` : "";
  document.getElementById("topicBadge").textContent = question.topic || "Quiz";
  document.getElementById("questionTypeBadge").textContent =
    isFlashcard ? "Flashcard 3D" : TYPE_LABELS[type] || "Trắc nghiệm";

  // Nút Câu trước
  const prevBtn = document.getElementById("prevQuestionBtn");
  if (prevBtn) {
    prevBtn.disabled = engine.index === 0;
  }

  // Nút Nộp bài thi trong Exam Mode
  const submitExamBtn = document.getElementById("submitExamBtn");
  if (submitExamBtn) {
    submitExamBtn.hidden = !isExam;
  }

  // Đồng bộ trạng thái Bookmark & Flag
  syncBookmarkUi(!!engine.currentKey() && isImportant(engine.currentKey()));
  syncFlagUi(engine.isFlagged());

  // Level badge
  const levelBadge = document.getElementById("levelBadge");
  if (levelBadge) {
    if (question.level) {
      levelBadge.textContent = LEVEL_LABELS[question.level] || question.level;
      levelBadge.hidden = false;
    } else {
      levelBadge.hidden = true;
    }
  }

  // Hint button
  const hintBtn = document.getElementById("hintBtn");
  if (hintBtn) {
    hintBtn.hidden = !question.hint;
    hintBtn.onclick = () => {
      toast(`💡 Gợi ý: ${question.hint}`, { duration: 4500 });
    };
  }

  // 3D Flashcard mode vs Normal mode
  const fcScene = document.getElementById("fc3dScene");
  const normalView = document.getElementById("qNormalView");
  const passageEl = document.getElementById("questionPassage");

  if (isFlashcard) {
    fcScene.hidden = false;
    normalView.hidden = true;
    passageEl.hidden = true;
    hideQuestionExplanation();
    renderFlashcard3D(question);
  } else {
    fcScene.hidden = true;
    normalView.hidden = false;
    hideQuestionExplanation();
    renderPassageAndPrompt(question);
    updateStickyBarText(question);

    const optionsContainer = document.getElementById("optionsContainer");
    optionsContainer.innerHTML = "";

    if (type === "essay") {
      renderEssay(optionsContainer, question, isExam);
    } else if (type === "true_false") {
      renderTrueFalse(optionsContainer, question, isExam);
    } else if (type === "short_answer") {
      renderShortAnswer(optionsContainer, question, isExam);
    } else {
      renderMultipleChoice(optionsContainer, question, isExam);
    }
  }

  // Nút Next CTA
  const nextBtn = document.getElementById("nextBtn");
  if (isExam || isFlashcard) {
    nextBtn.classList.add("show");
    nextBtn.textContent = engine.index === engine.total - 1 ? "Xem lại bài" : "Câu tiếp theo";
  } else {
    if (engine.answered) showNextCta();
    else nextBtn.classList.remove("show");
  }

  // Replay animation
  const questionCard = document.getElementById("questionCard");
  questionCard.style.animation = "none";
  void questionCard.offsetHeight;
  questionCard.style.animation = "fadeUp 0.35s ease";

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Timer mỗi câu
  if (timerCfg && timerCfg.enabled && timerCfg.mode === "question" && !engine.answered) {
    remaining = timerCfg.seconds;
    startTimer();
  }

  persistSession();
}

let lastRenderedPassage = null;

/**
 * Hiển thị đoạn trích đọc hiểu & câu hỏi với Rich Text & Interactive Cloze Gaps
 */
function renderPassageAndPrompt(question) {
  const card = document.getElementById("questionCard");
  const passageEl = document.getElementById("questionPassage");
  const passageBody = document.getElementById("passageBody");
  const promptEl = document.getElementById("questionText");
  const passageBadge = document.getElementById("passageBadge");
  const mobileTabs = document.getElementById("mobilePassageTabs");
  const qContentSplit = document.getElementById("qContentSplit");
  const peekBanner = document.getElementById("passagePeekBanner");

  let passageText = question.passage || "";
  let promptText = question.question || "";

  // Bóc tách tiền tố ngữ cảnh (Context Lead-in) như "Based on the... :"
  const leadMatch = promptText.match(/^(?:Based\s+on\s+(?:the\s+)?([^\:\n]+)\:?\s*\n+|According\s+to\s+(?:the\s+)?([^\:\n]+)\:?\s*\n+)([\s\S]*)$/i);
  let contextLead = "";
  if (leadMatch) {
    contextLead = (leadMatch[1] || leadMatch[2] || "").trim();
    if (leadMatch[3].trim()) {
      promptText = leadMatch[3].trim();
    }
  }

  if (!passageText) {
    const split = splitPassageAndPrompt(promptText);
    if (split.hasPassage) {
      passageText = split.passage;
      promptText = split.prompt || "Dựa vào đoạn trích trên, hãy trả lời câu hỏi sau:";
    }
  }

  // Xác định vị trí đục lỗ tương ứng (nếu có)
  const activeGap = question.blankIndex != null
    ? question.blankIndex
    : (question.id ? parseInt(String(question.id).replace(/\D/g, ""), 10) : null);

  if (passageText) {
    passageEl.hidden = false;
    card.classList.add("has-passage");
    if (mobileTabs) mobileTabs.hidden = false;
    if (peekBanner) peekBanner.hidden = false;

    if (passageBadge) {
      const bTitle = question.passageTitle || contextLead;
      passageBadge.textContent = bTitle
        ? `BÀI ĐỌC · ${bTitle.toUpperCase()}`
        : "VĂN BẢN / NGỮ CẢNH ĐỌC HIỂU";
    }

    // Hiệu năng cao: Nếu câu hỏi này dùng chung passage với câu trước, không re-render toàn bộ DOM!
    if (lastRenderedPassage === passageText) {
      // Chỉ cập nhật class active-gap
      passageBody.querySelectorAll(".cloze-gap").forEach((gap) => {
        const gNum = Number(gap.dataset.gap);
        gap.classList.toggle("active-gap", activeGap !== null && gNum === activeGap);
      });
    } else {
      lastRenderedPassage = passageText;
      passageBody.innerHTML = formatPassageWithClozeAndParagraphs(passageText, activeGap);

      // Gắn click handler cho tất cả chỗ trống trong bài đọc
      passageBody.querySelectorAll(".cloze-gap").forEach((gap) => {
        gap.addEventListener("click", () => {
          const targetGap = Number(gap.dataset.gap);
          const targetIndex = engine.questions.findIndex(
            (q) => q.blankIndex === targetGap || parseInt(String(q.id).replace(/\D/g, ""), 10) === targetGap
          );
          if (targetIndex !== -1 && targetIndex !== engine.index) {
            engine.goTo(targetIndex);
            renderQuestion();
            switchToMobileTab("question");
          }
        });
      });
    }

    // Thêm nút nhảy nhanh về câu hỏi ở cuối bài đọc (rất tiện khi đọc hết bài trên mobile)
    let passageFooter = passageEl.querySelector(".passage-footer");
    if (!passageFooter) {
      passageFooter = document.createElement("div");
      passageFooter.className = "passage-footer";
      passageFooter.innerHTML = `<button type="button" class="primary-btn passage-back-btn"><span>← Quay lại làm câu hỏi</span></button>`;
      passageFooter.querySelector(".passage-back-btn").addEventListener("click", () => {
        switchToMobileTab("question");
        const qText = document.getElementById("questionText");
        if (qText) qText.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      passageEl.appendChild(passageFooter);
    }

    // Tự động cuộn chỗ trống đục lỗ active vào trung tâm khung nhìn
    if (activeGap !== null) {
      const activeEl = passageBody.querySelector(`.cloze-gap[data-gap="${activeGap}"]`);
      if (activeEl) {
        setTimeout(() => {
          activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
      }
    }

    const formattedPrompt = formatRichText(promptText);
    promptEl.innerHTML = contextLead
      ? `<div class="q-context-lead"><span class="q-context-tag">📌 Ngữ cảnh</span> <span class="q-context-name">${escapeHtml(contextLead)}</span></div><div class="q-stem">${formattedPrompt}</div>`
      : formattedPrompt;
  } else {
    lastRenderedPassage = null;
    passageEl.hidden = true;
    passageBody.innerHTML = "";
    card.classList.remove("has-passage");
    if (mobileTabs) mobileTabs.hidden = true;
    if (peekBanner) peekBanner.hidden = true;
    if (qContentSplit) qContentSplit.classList.remove("mobile-show-passage");
    const formattedPrompt = formatRichText(promptText);
    promptEl.innerHTML = contextLead
      ? `<div class="q-context-lead"><span class="q-context-tag">📌 Ngữ cảnh</span> <span class="q-context-name">${escapeHtml(contextLead)}</span></div><div class="q-stem">${formattedPrompt}</div>`
      : formattedPrompt;
  }
}

// ---------- Trắc nghiệm 4 lựa chọn & Đúng/Sai 2 lựa chọn (Practice & Exam Mode) ----------
function renderMultipleChoice(container, question, isExam = false) {
  const currentAnswer = engine.userAnswers[engine.index];

  const isBinaryTf =
    question.options.length === 2 &&
    question.options.some((o) => /đúng|true/i.test(o)) &&
    question.options.some((o) => /sai|false/i.test(o));
  if (isBinaryTf) {
    container.classList.add("binary-tf-container");
  } else {
    container.classList.remove("binary-tf-container");
  }

  question.options.forEach((option, idx) => {
    const cleaned = cleanOptionPrefix(option);
    const keyLetter = "ABCD"[idx] || String.fromCharCode(65 + idx);

    const btn = document.createElement("button");
    btn.className = "option-btn";
    if (isBinaryTf) {
      const isTrueOpt = /đúng|true/i.test(cleaned.text || option);
      btn.classList.add(isTrueOpt ? "btn-binary-true" : "btn-binary-false");
    }
    btn.type = "button";

    const keySpan = document.createElement("span");
    keySpan.className = "option-key";
    keySpan.textContent = keyLetter;

    const labelSpan = document.createElement("span");
    labelSpan.className = "option-label";
    labelSpan.innerHTML = formatRichText(cleaned.text || option);

    const strikeBtn = document.createElement("button");
    strikeBtn.className = "option-strike-btn";
    strikeBtn.type = "button";
    strikeBtn.title = "Gạch loại trừ đáp án này";
    strikeBtn.innerHTML = "&times;";
    strikeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      btn.classList.toggle("eliminated");
    });

    btn.append(keySpan, labelSpan, strikeBtn);

    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      btn.classList.toggle("eliminated");
    });

    if (isExam) {
      // Trong chế độ Thi thử: Người dùng có thể đổi đáp án tự do, không lộ đúng/sai
      if (currentAnswer && currentAnswer.value === option) {
        btn.classList.add("active");
      }
      btn.addEventListener("click", () => {
        container.querySelectorAll(".option-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        engine.answer(option);
        persistSession();
      });
    } else {
      // Trong chế độ Luyện tập: Hiện đúng/sai ngay
      if (currentAnswer) {
        btn.classList.add("disabled");
        const isThisAnswer = option === question.answer || cleaned.text === question.answer;
        if (isThisAnswer) btn.classList.add("correct");
        if (currentAnswer.value === option) {
          btn.classList.add(currentAnswer.ok ? "correct" : "incorrect");
        }
      } else {
        btn.addEventListener("click", () => selectOption(btn, option));
      }
    }

    container.appendChild(btn);
  });

  // Trong chế độ Luyện tập: Nếu câu đã được trả lời trước đó, hiển thị thẻ giải thích
  if (!isExam && currentAnswer) {
    showQuestionExplanation({
      question,
      userChoice: currentAnswer.value,
      isCorrect: currentAnswer.ok,
      animate: false
    });
  }
}

function selectOption(btn, selectedOption) {
  const srsKey = engine.currentKey();
  const result = engine.answer(selectedOption);
  if (result === null) return;

  if (result) playCorrectSound();
  else playWrongSound();
  recordStudyActivity(1);

  if (timerCfg && timerCfg.enabled && timerCfg.mode === "question") stopTimer();
  recordReview(srsKey, result, { ...engine.current });

  const question = engine.current;
  document.querySelectorAll(".option-btn").forEach((b) => {
    b.classList.add("disabled");
    const label = b.querySelector(".option-label")?.textContent?.trim() || b.textContent.trim();
    const isCorrect =
      b.textContent === question.answer ||
      label === question.answer ||
      cleanOptionPrefix(label).text === cleanOptionPrefix(question.answer).text;
    if (isCorrect) b.classList.add("correct");
  });
  btn.classList.add(result ? "correct" : "incorrect");

  // Hiển thị thẻ gợi ý / giải thích phía dưới đẹp mắt chuẩn phong cách Flashcard 3D
  showQuestionExplanation({
    question,
    userChoice: selectedOption,
    isCorrect: result,
    animate: true
  });

  showNextCta();
  persistSession();
}

/**
 * Trợ giúp giải mã chi tiết lựa chọn (chữ cái A-D và nội dung)
 */
function resolveOptionDetails(question, val) {
  if (val == null) return { letter: "", text: "", full: "" };
  const rawVal = String(val).trim();
  const cleanedVal = cleanOptionPrefix(rawVal);
  const valTextLower = (cleanedVal.text || rawVal).toLowerCase();

  const options = Array.isArray(question.options) ? question.options : [];
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const cleanedOpt = cleanOptionPrefix(opt);
    const optTextLower = (cleanedOpt.text || String(opt)).toLowerCase();
    const optKeyUpper = (cleanedOpt.key || "ABCD"[i] || "").toUpperCase();

    if (
      String(opt).trim().toLowerCase() === rawVal.toLowerCase() ||
      optTextLower === valTextLower ||
      (cleanedVal.key && cleanedVal.key === optKeyUpper) ||
      (rawVal.length === 1 && rawVal.toUpperCase() === optKeyUpper)
    ) {
      const letter = optKeyUpper || "ABCD"[i] || String.fromCharCode(65 + i);
      const displayText = cleanedOpt.text || String(opt).trim();
      return { letter, text: displayText, full: `[${letter}] ${displayText}` };
    }
  }

  if (cleanedVal.key && cleanedVal.text) {
    return { letter: cleanedVal.key, text: cleanedVal.text, full: `[${cleanedVal.key}] ${cleanedVal.text}` };
  }
  return { letter: "", text: rawVal, full: rawVal };
}

/**
 * Ẩn và dọn dẹp thẻ gợi ý / giải thích
 */
export function hideQuestionExplanation() {
  const wrap = document.getElementById("qExplanationCardWrap");
  if (!wrap) return;
  wrap.hidden = true;
  wrap.innerHTML = "";
  wrap.classList.remove("animate-reveal");
}

/**
 * Hiển thị ô giải thích / gợi ý đơn giản, đẹp mắt dưới câu hỏi
 */
export function showQuestionExplanation({
  question,
  userChoice = null,
  isCorrect = false,
  animate = true,
  customAnswerSummary = ""
}) {
  // Không làm lộ đáp án trong chế độ Thi thử (Exam Mode)
  if (engine.studyMode === "exam") return;

  const wrap = document.getElementById("qExplanationCardWrap");
  if (!wrap) return;

  const explanation = question.explanation ? String(question.explanation).trim() : "";
  const hint = question.hint ? String(question.hint).trim() : "";

  // 1. Xác định Trạng thái (Status Badge & Theme màu)
  let statusTheme = "theme-correct";
  let statusPillClass = "is-ok";
  let statusIcon = iconSvg("CircleCheck", 15);
  let statusLabel = "Chính xác";

  if (userChoice === "(Đã tự xem đáp án)") {
    statusTheme = "theme-info";
    statusPillClass = "is-info";
    statusIcon = iconSvg("Lightbulb", 15);
    statusLabel = "Lời giải chi tiết";
  } else if (userChoice === null && !customAnswerSummary) {
    statusTheme = "theme-incorrect";
    statusPillClass = "is-bad";
    statusIcon = iconSvg("Clock", 15);
    statusLabel = "Hết thời gian";
  } else if (customAnswerSummary && userChoice === null) {
    if (isCorrect) {
      statusTheme = "theme-correct";
      statusPillClass = "is-ok";
      statusIcon = iconSvg("CircleCheck", 15);
      statusLabel = "Chính xác";
    } else {
      statusTheme = "theme-info";
      statusPillClass = "is-info";
      statusIcon = iconSvg("Info", 15);
      statusLabel = "Đối chiếu kết quả";
    }
  } else if (!isCorrect) {
    statusTheme = "theme-incorrect";
    statusPillClass = "is-bad";
    statusIcon = iconSvg("CircleX", 15);
    statusLabel = "Chưa chính xác";
  }

  // 2. Xác định Đáp án đúng chính xác để hiển thị nổi bật
  let answerBadgeHtml = "";
  if (customAnswerSummary) {
    answerBadgeHtml = `
      <div class="q-exp-answer-pill">
        <span class="q-exp-answer-label">Đáp án:</span>
        <span class="q-exp-key-badge no-letter">
          <span class="q-exp-key-text">${escapeHtml(customAnswerSummary)}</span>
        </span>
      </div>
    `;
  } else {
    const resolvedAns = resolveOptionDetails(question, question.answer);
    if (resolvedAns.letter) {
      answerBadgeHtml = `
        <div class="q-exp-answer-pill">
          <span class="q-exp-answer-label">Đáp án đúng:</span>
          <span class="q-exp-key-badge">
            <span class="q-exp-letter-char">${escapeHtml(resolvedAns.letter)}</span>
            <span class="q-exp-key-text">${escapeHtml(resolvedAns.text || resolvedAns.full)}</span>
          </span>
        </div>
      `;
    } else {
      const ansVal = resolvedAns.full || question.answer || "";
      if (ansVal) {
        answerBadgeHtml = `
          <div class="q-exp-answer-pill">
            <span class="q-exp-answer-label">Đáp án đúng:</span>
            <span class="q-exp-key-badge no-letter">
              <span class="q-exp-key-text">${escapeHtml(ansVal)}</span>
            </span>
          </div>
        `;
      }
    }
  }

  // 3. Nội dung giải thích & gợi ý
  let bodyContentHtml = "";
  if (explanation) {
    bodyContentHtml += `<div class="q-exp-text">${formatRichText(explanation)}</div>`;
    if (hint && hint !== explanation) {
      bodyContentHtml += `
        <div class="q-exp-hint-note">
          <span class="q-exp-hint-tag">${iconSvg("Sparkles", 13)} Mẹo ghi nhớ:</span>
          <span class="q-exp-hint-content">${formatRichText(hint)}</span>
        </div>
      `;
    }
  } else if (hint) {
    bodyContentHtml += `
      <div class="q-exp-hint-note standalone">
        <span class="q-exp-hint-tag">${iconSvg("Sparkles", 13)} Gợi ý:</span>
        <span class="q-exp-hint-content">${formatRichText(hint)}</span>
      </div>
    `;
  } else {
    const resolvedAns = resolveOptionDetails(question, question.answer);
    const ansFallback = resolvedAns.full || question.answer || "";
    if (ansFallback) {
      bodyContentHtml += `
        <div class="q-exp-empty-note">
          Lựa chọn chính xác cho câu này là <strong>${escapeHtml(ansFallback)}</strong>.
        </div>
      `;
    }
  }

  if (!answerBadgeHtml && !bodyContentHtml) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  if (animate) {
    wrap.classList.remove("animate-reveal");
    void wrap.offsetWidth;
    wrap.classList.add("animate-reveal");
  } else {
    wrap.classList.remove("animate-reveal");
  }

  wrap.innerHTML = `
    <div class="q-explanation-card ${statusTheme}">
      <div class="q-exp-topbar">
        <div class="q-exp-status-pill ${statusPillClass}">
          ${statusIcon}
          <span>${statusLabel}</span>
        </div>
        ${answerBadgeHtml}
      </div>
      ${bodyContentHtml ? `<div class="q-exp-body">${bodyContentHtml}</div>` : ""}
    </div>
  `;

  // Tự động cuộn mượt đến ô giải thích nếu bị khuất một phần
  if (animate) {
    setTimeout(() => {
      const card = wrap.querySelector(".q-explanation-card");
      if (card) {
        const rect = card.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) {
          card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }, 100);
  }
}

// ---------- Chế độ Flashcard 3D ----------
function setupFlashcard3D() {
  const card = document.getElementById("fc3dCard");
  if (!card) return;

  card.addEventListener("click", () => {
    card.classList.toggle("flipped");
    playFlipSound();
  });

  const grade = (correct) => {
    recordReview(engine.currentKey(), correct, { ...engine.current });
    recordStudyActivity(1);
    if (correct) playCorrectSound();
    else playWrongSound();

    toast(
      correct
        ? "Đã thuộc! Câu này sẽ dãn cách ôn lại sau."
        : "Đã lên lịch ôn lại sau 10 phút.",
      { duration: 1500 }
    );
    goNext(finishCallback);
  };

  document.getElementById("fcAgainBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    grade(false);
  });

  document.getElementById("fcGoodBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    grade(true);
  });
}

function renderFlashcard3D(question) {
  const card = document.getElementById("fc3dCard");
  if (card) card.classList.remove("flipped");

  const frontText = document.getElementById("fcFrontText");
  const backText = document.getElementById("fcBackText");

  if (frontText) frontText.innerHTML = formatRichText(question.question);
  if (backText) {
    let sol = question.answer;
    if (question.explanation) {
      sol += `\n\n**Lời giải chi tiết:**\n${question.explanation}`;
    }
    backText.innerHTML = formatRichText(sol);
  }
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
  document.getElementById("timerChip").classList.toggle("danger", remaining <= 10);

  // Âm thanh cảnh báo 10s cuối (Tick-tock)
  if (remaining <= 10 && remaining > 0 && timerCfg?.mode === "total") {
    playTickSound();
  }
}

function onTimeout() {
  if (timerCfg && timerCfg.mode === "total") {
    toast("Hết giờ làm bài! Hệ thống tự động nộp bài.", { type: "info", duration: 2500 });
    if (engine.studyMode === "exam") {
      engine.submitExam();
    }
    finishNow();
    return;
  }

  const question = engine.current;
  if (!question) return;
  const type = questionType(question);

  if (type === "essay" || engine.studyMode === "flashcard") {
    toast("Hết giờ cho câu này.", { duration: 1400 });
    goNext(finishCallback);
    return;
  }

  if (engine.answered) return;
  const key = engine.currentKey();
  const container = document.getElementById("optionsContainer");

  playWrongSound();

  if (type === "true_false") {
    const result = engine.answerTrueFalse({});
    recordReview(key, false, { ...question });
    showTfFeedback(container, question, result.choices, result);
  } else if (type === "short_answer") {
    const result = engine.answerShortAnswer("");
    recordReview(key, false, { ...question });
    showShortFeedback(container, question, result);
  } else {
    engine.answer(null);
    recordReview(key, false, { ...question });
    document.querySelectorAll(".option-btn").forEach((b) => {
      b.classList.add("disabled");
      if (b.textContent === question.answer) b.classList.add("correct");
    });
    showQuestionExplanation({
      question,
      userChoice: null,
      isCorrect: false,
      animate: true
    });
  }

  showNextCta();
  toast("Hết giờ! Đáp án đúng đã được tô sáng.", { type: "error", duration: 2000 });
  persistSession();
}

function finishNow() {
  while (!engine.finished) engine.next();
  persistSession();
  playCompleteSound();
  if (finishCallback) finishCallback();
}

// ---------- Essay flashcard / Câu hỏi tự luận ----------
function renderEssay(container, question, isExam = false) {
  const currentAnswer = engine.userAnswers[engine.index];

  if (isExam) {
    const row = document.createElement("div");
    row.className = "essay-exam-wrap";

    const textarea = document.createElement("textarea");
    textarea.className = "input essay-exam-input";
    textarea.placeholder = "Nhập bài làm / dàn ý câu trả lời tự luận của bạn (sẽ đối chiếu đáp án khi nộp bài)...";
    textarea.rows = 5;
    if (currentAnswer) {
      textarea.value = currentAnswer.value ?? "";
    }
    textarea.addEventListener("input", (e) => {
      engine.userAnswers[engine.index] = { value: e.target.value.trim(), ok: Boolean(e.target.value.trim()) };
      persistSession();
    });

    row.appendChild(textarea);
    container.appendChild(row);
    return;
  }

  const hint = document.createElement("p");
  hint.className = "flashcard-hint";
  hint.textContent = "Tự trả lời trong đầu trước, sau đó lật thẻ để kiểm tra.";

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

  if (question.explanation) {
    const expDiv = document.createElement("div");
    expDiv.className = "short-reveal-explanation";
    expDiv.style.marginTop = "12px";
    expDiv.innerHTML = `<strong>Hướng dẫn chấm:</strong> ${formatRichText(question.explanation)}`;
    answerDiv.appendChild(expDiv);
  }

  const gradeDiv = document.createElement("div");
  gradeDiv.className = "flashcard-grade";
  gradeDiv.hidden = true;

  const grade = (correct) => {
    gradeDiv.style.display = "none";
    const result = engine.answerEssay(correct);
    recordReview(engine.currentKey(), correct, { ...question });
    recordStudyActivity(1);
    if (correct) playCorrectSound();
    else playWrongSound();

    const statusPill = document.createElement("div");
    statusPill.className = `short-feedback ${correct ? "ok" : "bad"}`;
    statusPill.textContent = correct
      ? "Đã tự xác nhận: Bạn đã nhớ / Đạt yêu cầu!"
      : "Đã tự xác nhận: Đánh dấu cần ôn tập lại.";
    answerDiv.appendChild(statusPill);

    toast(
      correct
        ? `Tuyệt vời! +${fmtScore(result?.earned || question.points || 1)}đ`
        : "Đã lưu vào danh sách câu cần ôn tập.",
      { duration: 1600 }
    );
    showNextCta();
    persistSession();
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

  if (currentAnswer) {
    hint.hidden = true;
    flipBtn.hidden = true;
    answerDiv.hidden = false;
    gradeDiv.hidden = true;
    const statusPill = document.createElement("div");
    statusPill.className = `short-feedback ${currentAnswer.ok ? "ok" : "bad"}`;
    statusPill.textContent = currentAnswer.ok
      ? "Đã tự xác nhận: Bạn đã nhớ / Đạt yêu cầu!"
      : "Đã tự xác nhận: Đánh dấu cần ôn tập lại.";
    answerDiv.appendChild(statusPill);
    container.append(hint, flipBtn, answerDiv);
    return;
  }

  flipBtn.addEventListener("click", () => {
    hint.hidden = true;
    flipBtn.hidden = true;
    answerDiv.hidden = false;
    gradeDiv.hidden = false;
  });

  container.append(hint, flipBtn, answerDiv, gradeDiv);
}

// ---------- Phần II: Đúng/Sai ----------
function renderTrueFalse(container, question, isExam = false) {
  const currentAnswer = engine.userAnswers[engine.index];
  const choices = isExam && currentAnswer?.value ? { ...currentAnswer.value } : {};
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
    text.innerHTML = formatRichText(item.text);

    const toggle = document.createElement("div");
    toggle.className = "tf-toggle";
    const pick = (value, btn) => {
      if (!isExam && engine.answered) return;
      choices[i] = value;
      toggle.querySelectorAll(".tf-btn").forEach((b) =>
        b.classList.remove("active", "active-true", "active-false")
      );
      btn.classList.add("active", value ? "active-true" : "active-false");
      if (isExam) {
        engine.answerTrueFalse(choices);
        persistSession();
      }
    };

    for (const [value, labelText] of [[true, "Đúng"], [false, "Sai"]]) {
      const btn = document.createElement("button");
      btn.className = "tf-btn";
      btn.type = "button";
      btn.dataset.value = String(value);
      btn.textContent = labelText;
      if (choices[i] === value) {
        btn.classList.add("active", value ? "active-true" : "active-false");
      }
      btn.addEventListener("click", () => pick(value, btn));
      toggle.appendChild(btn);
    }

    row.append(label, text, toggle);
    wrap.appendChild(row);
  });

  container.appendChild(wrap);

  if (!isExam) {
    const submit = document.createElement("button");
    submit.className = "primary-btn submit-answer-btn";
    submit.textContent = "Xác nhận";
    submit.addEventListener("click", () => submitTrueFalse(container, question, choices));
    container.appendChild(submit);

    if (currentAnswer) {
      showTfFeedback(container, question, currentAnswer.value, {
        earned: currentAnswer.earned,
        maxPoints: question.points || 0
      });
    }
  }
}

function submitTrueFalse(container, question, choices) {
  const srsKey = engine.currentKey();
  const result = engine.answerTrueFalse(choices);
  if (!result) return;

  if (result.ok) playCorrectSound();
  else playWrongSound();
  recordStudyActivity(1);

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

  const tfSummary = (question.items || [])
    .map((item, idx) => `${"abcd"[idx] || idx + 1}) ${item.correct ? "Đúng" : "Sai"}`)
    .join(" · ");

  showQuestionExplanation({
    question,
    userChoice: null,
    isCorrect: result.ok,
    animate: true,
    customAnswerSummary: tfSummary
  });
}

// ---------- Phần III: Trả lời ngắn & Chế độ nhập / xem đáp án ----------
function renderShortAnswer(container, question, isExam = false) {
  const box = document.createElement("div");
  box.className = "short-container";

  const isNumericOnly = question.examFormat === "thpt2026" || /^-?\d+([.,]\d+)?$/.test(String(question.answer || "").trim());
  const currentAnswer = engine.userAnswers[engine.index];

  const inputWrap = document.createElement("div");
  inputWrap.className = "short-input-wrap";

  const input = document.createElement("input");
  input.className = "short-input";
  input.type = "text";
  input.inputMode = isNumericOnly ? "decimal" : "text";
  input.autocomplete = "off";
  input.placeholder = isNumericOnly
    ? "Nhập đáp án số (VD: -1.5 hoặc 0.25)..."
    : "Nhập câu trả lời của bạn...";

  if (currentAnswer) {
    input.value = currentAnswer.value ?? "";
  }

  inputWrap.appendChild(input);

  if (isExam) {
    input.addEventListener("input", (e) => {
      engine.answerShortAnswer(e.target.value.trim());
      persistSession();
    });
    box.appendChild(inputWrap);
  } else {
    const submitBtn = document.createElement("button");
    submitBtn.className = "short-submit-btn";
    submitBtn.type = "button";
    submitBtn.innerHTML = `<span>Gửi</span><span class="short-kbd-hint">↵</span>`;
    submitBtn.addEventListener("click", () => submitShortAnswer(container, question, input.value));

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitBtn.click();
      }
    });

    inputWrap.appendChild(submitBtn);
    box.appendChild(inputWrap);

    const actionsBar = document.createElement("div");
    actionsBar.className = "short-actions-bar";

    const hint = document.createElement("span");
    hint.className = "short-hint-text";
    hint.innerHTML = `Nhấn <kbd>Enter ↵</kbd> để kiểm tra đáp án`;

    const revealBtn = document.createElement("button");
    revealBtn.className = "short-reveal-btn";
    revealBtn.type = "button";
    revealBtn.textContent = "Xem đáp án";
    revealBtn.addEventListener("click", () => revealShortAnswer(container, question));

    actionsBar.append(hint, revealBtn);
    box.appendChild(actionsBar);

    if (currentAnswer) {
      input.disabled = true;
      submitBtn.disabled = true;
      revealBtn.disabled = true;
      inputWrap.classList.add(currentAnswer.ok ? "is-correct" : "is-incorrect");
      showShortFeedback(container, question, { ok: currentAnswer.ok });
    }
  }

  container.appendChild(box);
  if (!currentAnswer && !isExam) {
    setTimeout(() => input.focus(), 60);
  }
}

function revealShortAnswer(container, question) {
  if (engine.answered) return;

  const input = container.querySelector(".short-input");
  const inputWrap = container.querySelector(".short-input-wrap");
  const actionsBar = container.querySelector(".short-actions-bar");
  if (input) input.disabled = true;
  if (inputWrap) inputWrap.style.opacity = "0.7";
  if (actionsBar) actionsBar.style.display = "none";

  const card = document.createElement("div");
  card.className = "short-reveal-card";

  const head = document.createElement("div");
  head.className = "short-reveal-head";
  const label = document.createElement("span");
  label.className = "short-reveal-label";
  label.textContent = "ĐÁP ÁN CHUẨN";
  head.appendChild(label);

  const ans = document.createElement("div");
  ans.className = "short-reveal-answer";
  ans.textContent = question.answer;

  card.append(head, ans);

  if (Array.isArray(question.acceptableAnswers) && question.acceptableAnswers.length > 0) {
    const acc = document.createElement("div");
    acc.className = "short-reveal-acceptable";
    acc.textContent = `Chấp nhận các cách viết: ${question.acceptableAnswers.join(", ")}`;
    card.appendChild(acc);
  }

  // Hàng nút tự đánh giá cho người học (tự nhận diện đúng / cần ôn lại)
  const gradeRow = document.createElement("div");
  gradeRow.className = "short-grade-row";

  const badBtn = document.createElement("button");
  badBtn.className = "short-grade-btn bad";
  badBtn.type = "button";
  badBtn.innerHTML = `<span>✖ Cần ôn lại</span>`;

  const okBtn = document.createElement("button");
  okBtn.className = "short-grade-btn ok";
  okBtn.type = "button";
  okBtn.innerHTML = `<span>✔ Đã nhớ đúng</span>`;

  const finalize = (isCorrect) => {
    gradeRow.remove();
    const srsKey = engine.currentKey();
    const result = engine.answerShortAnswer(isCorrect ? question.answer : "");
    recordStudyActivity(1);
    if (isCorrect) {
      playCorrectSound();
      toast(`Tuyệt vời! +${fmtScore(result?.earned || question.points || 1)}đ`, { type: "success", duration: 1800 });
    } else {
      playWrongSound();
      toast("Đã lưu vào danh sách câu cần ôn tập.", { type: "info", duration: 1800 });
    }
    if (timerCfg && timerCfg.enabled && timerCfg.mode === "question") stopTimer();
    recordReview(srsKey, isCorrect, { ...question });

    const acceptable = Array.isArray(question.acceptableAnswers) && question.acceptableAnswers.length > 0
      ? ` (chấp nhận: ${question.acceptableAnswers.join(", ")})`
      : "";

    showQuestionExplanation({
      question,
      userChoice: isCorrect ? question.answer : "(Đã tự xem đáp án)",
      isCorrect,
      animate: true,
      customAnswerSummary: question.answer + acceptable
    });

    showNextCta();
    persistSession();
  };

  badBtn.addEventListener("click", () => finalize(false));
  okBtn.addEventListener("click", () => finalize(true));

  gradeRow.append(badBtn, okBtn);
  card.appendChild(gradeRow);

  container.appendChild(card);
}

function submitShortAnswer(container, question, text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    toast("Vui lòng nhập câu trả lời trước khi gửi!", { type: "info" });
    const input = container.querySelector(".short-input");
    if (input) input.focus();
    return;
  }
  const srsKey = engine.currentKey();
  const result = engine.answerShortAnswer(trimmed);
  if (!result) return;

  if (result.ok) playCorrectSound();
  else playWrongSound();
  recordStudyActivity(1);

  if (timerCfg && timerCfg.enabled && timerCfg.mode === "question") stopTimer();
  recordReview(srsKey, result.ok, { ...question });
  showShortFeedback(container, question, result);
  toast(
    result.ok
      ? `Chính xác! +${fmtScore(result.earned)}đ`
      : `Chưa chính xác. Đáp án: ${question.answer}`,
    { duration: 1800 }
  );
  showNextCta();
  persistSession();
}

function showShortFeedback(container, question, result) {
  const input = container.querySelector(".short-input");
  const inputWrap = container.querySelector(".short-input-wrap");
  const submitBtn = container.querySelector(".short-submit-btn");
  const actionsBar = container.querySelector(".short-actions-bar");
  if (input) input.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  if (actionsBar) actionsBar.style.display = "none";
  if (inputWrap) {
    inputWrap.classList.remove("is-correct", "is-incorrect");
    inputWrap.classList.add(result.ok ? "is-correct" : "is-incorrect");
  }

  const acceptable = Array.isArray(question.acceptableAnswers) && question.acceptableAnswers.length > 0
    ? ` (chấp nhận: ${question.acceptableAnswers.join(", ")})`
    : "";

  showQuestionExplanation({
    question,
    userChoice: input ? input.value : null,
    isCorrect: result.ok,
    animate: true,
    customAnswerSummary: question.answer + acceptable
  });
}

// ---------- Tiện ích chung ----------
const TYPE_LABELS = {
  multiple_choice: "Trắc nghiệm",
  true_false: "Đúng – Sai",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận"
};

function questionType(question) {
  return getQuestionType(question);
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
    if (engine.studyMode === "exam") {
      // Trong Exam Mode: bấm tiếp câu cuối cùng sẽ đưa đến bảng câu hỏi hoặc nhắc nộp bài
      document.getElementById("submitExamBtn")?.click();
      return;
    }
    stopTimer();
    persistSession();
    playCompleteSound();
    if (cb) cb();
  } else {
    renderQuestion();
  }
}

// ---------- Font Resizer ----------
function setupFontResizer() {
  const card = document.getElementById("questionCard");
  const currentSize = getFontSize();
  card.dataset.fontSize = currentSize;

  const sizes = ["small", "medium", "large"];

  document.getElementById("fontDecBtn")?.addEventListener("click", () => {
    const curIdx = sizes.indexOf(card.dataset.fontSize || "medium");
    if (curIdx > 0) {
      const nextSize = sizes[curIdx - 1];
      card.dataset.fontSize = nextSize;
      saveFontSize(nextSize);
    }
  });

  document.getElementById("fontIncBtn")?.addEventListener("click", () => {
    const curIdx = sizes.indexOf(card.dataset.fontSize || "medium");
    if (curIdx < sizes.length - 1) {
      const nextSize = sizes[curIdx + 1];
      card.dataset.fontSize = nextSize;
      saveFontSize(nextSize);
    }
  });
}

// ---------- Passage Toggle ----------
function setupPassageToggle() {
  const btn = document.getElementById("passageToggleBtn");
  const passageEl = document.getElementById("questionPassage");
  if (!btn || !passageEl) return;

  btn.addEventListener("click", () => {
    const isCollapsed = passageEl.classList.toggle("collapsed");
    btn.textContent = isCollapsed ? "Mở rộng ▾" : "Thu gọn ▴";
  });
}

// ---------- Sticky Mini-Bar ----------
function setupStickyPrompt() {
  const bar = document.getElementById("stickyQBar");
  const card = document.getElementById("questionCard");
  if (!bar || !card) return;

  // Nhấp vào sticky bar cuộn mượt trở lại đầu câu hỏi
  bar.addEventListener("click", () => {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  window.addEventListener("scroll", () => {
    if (document.getElementById("quizScreen").hidden) return;
    const rect = card.getBoundingClientRect();
    if (rect.top < -120 && rect.bottom > 180) {
      bar.hidden = false;
    } else {
      bar.hidden = true;
    }
  });
}

function updateStickyBarText(question) {
  const counter = document.getElementById("stickyCounter");
  const text = document.getElementById("stickyText");
  if (counter) counter.textContent = `Câu ${engine.index + 1}`;
  if (text) {
    const raw = (question.question || "").replace(/\n+/g, " ").trim();
    text.textContent = raw.length > 95 ? `${raw.slice(0, 95)}...` : raw;
  }
}

// ---------- Bảng câu hỏi (Question Palette) ----------
function setupPaletteModal() {
  const modal = document.getElementById("paletteModal");
  const toggleBtn = document.getElementById("paletteToggleBtn");
  const closeBtn = document.getElementById("paletteCloseBtn");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      renderPaletteGrid();
      modal.classList.add("open");
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });
}

function renderPaletteGrid() {
  const grid = document.getElementById("paletteGrid");
  const modal = document.getElementById("paletteModal");
  if (!grid) return;
  grid.innerHTML = "";

  const isExam = engine.studyMode === "exam";

  for (let i = 0; i < engine.total; i++) {
    const btn = document.createElement("button");
    btn.className = "palette-chip";
    btn.type = "button";
    btn.textContent = i + 1;

    if (i === engine.index) {
      btn.classList.add("current");
    }

    const ans = engine.userAnswers[i];
    if (ans) {
      if (isExam) {
        btn.classList.add("answered");
      } else {
        if (ans.ok === true) btn.classList.add("answered-correct");
        else if (ans.ok === false) btn.classList.add("answered-wrong");
        else btn.classList.add("answered");
      }
    }

    if (engine.isFlagged(i)) {
      btn.classList.add("flagged");
    }

    const q = engine.questions[i];
    const key = q.srsKey || (engine.quizId ? `${engine.quizId}:${q.id}` : null);
    if (key && isImportant(key)) {
      btn.classList.add("marked");
    }

    btn.addEventListener("click", () => {
      engine.goTo(i);
      renderQuestion();
      modal.classList.remove("open");
    });

    grid.appendChild(btn);
  }
}

// ---------- Phím tắt Bàn phím (Pro Mode) ----------
function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    const quizScreen = document.getElementById("quizScreen");
    if (!quizScreen || quizScreen.hidden) return;

    const tag = (e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    const modal = document.getElementById("paletteModal");
    if (modal?.classList.contains("open")) {
      if (e.key === "Escape") modal.classList.remove("open");
      return;
    }

    // Space trong chế độ 3D Flashcard: Lật thẻ
    if (engine.studyMode === "flashcard") {
      if (e.key === " ") {
        e.preventDefault();
        document.getElementById("fc3dCard")?.click();
        return;
      }
      if (e.key === "1") {
        document.getElementById("fcAgainBtn")?.click();
        return;
      }
      if (e.key === "2") {
        document.getElementById("fcGoodBtn")?.click();
        return;
      }
    }

    // Phím chọn đáp án 1-4 hoặc A-D
    const key = e.key.toUpperCase();
    const keyToIndex = { "1": 0, "2": 1, "3": 2, "4": 3, "A": 0, "B": 1, "C": 2, "D": 3 };
    if (keyToIndex[key] !== undefined && (engine.studyMode === "exam" || !engine.answered)) {
      const idx = keyToIndex[key];
      const buttons = document.querySelectorAll("#optionsContainer .option-btn");
      if (buttons[idx] && !buttons[idx].classList.contains("disabled")) {
        e.preventDefault();
        buttons[idx].click();
        return;
      }
    }

    // Phím Enter hoặc Space
    if (e.key === "Enter" || (e.key === " " && engine.studyMode !== "flashcard")) {
      const nextBtn = document.getElementById("nextBtn");
      if (nextBtn && nextBtn.classList.contains("show")) {
        e.preventDefault();
        nextBtn.click();
        return;
      }
    }

    // Phím Bookmark (B)
    if (key === "B") {
      e.preventDefault();
      document.getElementById("bookmarkBtn")?.click();
      return;
    }

    // Phím Flag (F)
    if (key === "F") {
      e.preventDefault();
      document.getElementById("flagBtn")?.click();
      return;
    }

    // Phím Mute/Unmute (M)
    if (key === "M") {
      e.preventDefault();
      document.getElementById("quizSoundBtn")?.click();
      return;
    }

    // Phím Scratchpad (S)
    if (key === "S") {
      e.preventDefault();
      document.getElementById("scratchpadToggleBtn")?.click();
      return;
    }

    // Phím Focus/Zen mode (Z)
    if (key === "Z") {
      e.preventDefault();
      document.getElementById("fullscreenToggleBtn")?.click();
      return;
    }

    // Phím Palette (P hoặc G)
    if (key === "P" || key === "G") {
      e.preventDefault();
      document.getElementById("paletteToggleBtn")?.click();
      return;
    }

    // Mũi tên trái / phải
    if (e.key === "ArrowLeft") {
      const prevBtn = document.getElementById("prevQuestionBtn");
      if (prevBtn && !prevBtn.disabled) {
        e.preventDefault();
        prevBtn.click();
      }
    } else if (e.key === "ArrowRight") {
      const nextBtn = document.getElementById("nextBtn");
      if (nextBtn && nextBtn.classList.contains("show")) {
        e.preventDefault();
        nextBtn.click();
      }
    }
  });
}

// ---------- Mobile Passage Tabs (Màn hình điện thoại) ----------
function setupMobilePassageTabs() {
  document.getElementById("mpTabQuestion")?.addEventListener("click", () => switchToMobileTab("question"));
  document.getElementById("mpTabPassage")?.addEventListener("click", () => switchToMobileTab("passage"));
  document.getElementById("passagePeekBanner")?.addEventListener("click", () => {
    switchToMobileTab("passage");
  });
}

function switchToMobileTab(tab) {
  const qContentSplit = document.getElementById("qContentSplit");
  const tabQ = document.getElementById("mpTabQuestion");
  const tabP = document.getElementById("mpTabPassage");
  if (!qContentSplit || !tabQ || !tabP) return;

  if (tab === "passage") {
    qContentSplit.classList.add("mobile-show-passage");
    tabP.classList.add("active");
    tabQ.classList.remove("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    qContentSplit.classList.remove("mobile-show-passage");
    tabQ.classList.add("active");
    tabP.classList.remove("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// ---------- Chế độ máy nhẹ / Tiết kiệm pin (Adaptive Performance) ----------
function setupPerfToggle() {
  const btn = document.getElementById("perfToggleBtn");
  if (!btn) return;

  const syncUi = () => {
    const isEco = perf.isLowPerf();
    btn.classList.toggle("active-eco", isEco);
    btn.title = isEco
      ? "Đang bật chế độ máy nhẹ (Tiết kiệm pin). Nhấp để bật chất lượng cao (Phím Zap)"
      : "Chế độ máy nhẹ (Tiết kiệm pin & mượt mà trên máy yếu)";
  };

  btn.addEventListener("click", () => {
    const next = !perf.isLowPerf();
    perf.setLowPerfMode(next);
    syncUi();
    toast(
      next
        ? "⚡ Đã bật Chế độ máy nhẹ (Tối ưu 60fps & tiết kiệm pin)."
        : "✨ Đã bật Chế độ đồ họa cao cấp (Đầy đủ hiệu ứng).",
      { duration: 1800 }
    );
  });

  syncUi();
}
