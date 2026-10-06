// Quiz engine — state machine của một phiên làm bài, không đụng DOM.
// Hỗ trợ 3 chế độ học tập chuyên biệt:
// 1. "practice": Luyện tập tức thì (chấm ngay, hiện đáp án & giải thích)
// 2. "exam": Thi thử mô phỏng (tự do đổi câu, gắn cờ, nộp bài mới chấm & phân tích)
// 3. "flashcard": Lật thẻ 3D ghi nhớ ngắt quãng (Spaced Repetition)

import { trueFalsePoints, numericAnswersEqual, matchShortAnswer } from "./exam-config.js";

export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Bóc tách tiền tố lựa chọn (A., B., C., 1., a)...)
 */
export function cleanOptionPrefix(str = "") {
  const raw = String(str || "").trim();
  const match = raw.match(/^(\[?([A-Da-d0-9])[\.\)\:\-\]]|\(([A-Da-d0-9])\))\s*(.+)$/s);
  if (match) {
    const key = (match[2] || match[3] || "").toUpperCase();
    const text = (match[4] || "").trim();
    return { key, text, raw };
  }
  return { key: "", text: raw, raw };
}

/**
 * Chuẩn hóa câu hỏi: Gọt sạch tiền tố A, B, C, D trong options và ánh xạ answer
 */
function prepareQuestion(q, isExam, shuffle = false) {
  if (!q.options || q.options.length === 0) {
    return { ...q };
  }

  const parsedOptions = q.options.map((opt, idx) => {
    const cleaned = cleanOptionPrefix(opt);
    return {
      index: idx,
      key: cleaned.key || String.fromCharCode(65 + idx),
      text: cleaned.text || opt,
      raw: opt
    };
  });

  let resolvedAnswer = q.answer;
  const rawAnswer = String(q.answer || "").trim();
  const rawAnsClean = cleanOptionPrefix(rawAnswer);

  const isSingleLetter = /^[A-Da-d]$/.test(rawAnswer) || (rawAnsClean.key && !rawAnsClean.text);
  if (isSingleLetter) {
    const targetKey = (rawAnsClean.key || rawAnswer).toUpperCase();
    const found = parsedOptions.find(
      (p) => p.key === targetKey || p.index === targetKey.charCodeAt(0) - 65
    );
    if (found) {
      resolvedAnswer = found.text;
    }
  } else if (rawAnsClean.text) {
    resolvedAnswer = rawAnsClean.text;
  }

  let cleanOptions = parsedOptions.map((p) => p.text);
  if (shuffle) {
    cleanOptions = shuffleArray([...cleanOptions]);
  }

  return {
    ...q,
    options: cleanOptions,
    answer: resolvedAnswer,
    originalAnswer: q.answer
  };
}

export class QuizEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.quizId = null;
    this.label = "";
    this.studyMode = "practice"; // 'practice' | 'exam' | 'flashcard'
    this.shuffle = false;
    this.questions = [];
    this.index = 0;
    this.score = 0;
    this.pointsScored = 0;
    this.maxPoints = 0;
    this.wrongAnswers = [];
    this.results = []; // kết quả từng câu
    this.userAnswers = {}; // { [questionIndex]: { value, ok, earned } }
    this.flags = new Set(); // các câu được gắn cờ phân vân
    this.exam = null; // metadata đề thi THPT 2026
    this.remainingTimer = null;
    this.startTime = Date.now();
    this.questionTimes = {}; // { [index]: seconds }
    this.answered = false;
    this.finished = false;
    this.analytics = null; // kết quả phân tích sau khi nộp bài
  }

  start({
    quizId = null,
    label = "",
    questions,
    exam = null,
    timerSeconds = null,
    mode = "practice",
    shuffle = false
  }) {
    this.reset();
    this.quizId = quizId;
    this.label = label;
    this.studyMode = mode;
    this.shuffle = Boolean(shuffle);
    this.exam = exam || null;
    this.remainingTimer = timerSeconds;
    this.startTime = Date.now();
    const isExam = !!this.exam || mode === "exam";

    const baseQuestions = this.shuffle ? shuffleArray([...questions]) : [...questions];
    this.questions = baseQuestions.map((q) => prepareQuestion(q, isExam, this.shuffle));
    this.maxPoints = this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    return this;
  }

  currentKey() {
    const q = this.current;
    if (!q) return null;
    return q.srsKey || (this.quizId ? `${this.quizId}:${q.id}` : null);
  }

  get total() {
    return this.questions.length;
  }

  get current() {
    return this.questions[this.index];
  }

  get progress() {
    return this.total ? (this.index / this.total) * 100 : 0;
  }

  // ---------- Quản lý cờ phân vân (Flag) ----------
  toggleFlag(idx = this.index) {
    if (this.flags.has(idx)) {
      this.flags.delete(idx);
      return false;
    }
    this.flags.add(idx);
    return true;
  }

  isFlagged(idx = this.index) {
    return this.flags.has(idx);
  }

  /**
   * Trả lời trắc nghiệm (Tự động thích ứng theo studyMode)
   */
  answer(selectedOption) {
    if (this.finished) return null;

    // Chế độ Exam: cho phép đổi đáp án tự do trước khi nộp bài
    if (this.studyMode === "exam") {
      this.userAnswers[this.index] = { value: selectedOption };
      this.answered = true;
      return true; // đã ghi nhận câu trả lời
    }

    // Chế độ Practice: Chấm ngay lập tức
    if (this.answered) return null;
    this.answered = true;
    const question = this.current;

    const sClean = cleanOptionPrefix(selectedOption).text.toLowerCase().trim();
    const aClean = cleanOptionPrefix(question.answer).text.toLowerCase().trim();
    const correct = selectedOption === question.answer || (sClean && sClean === aClean);
    const earned = correct ? question.points || 0 : 0;

    if (correct) {
      this.score++;
    } else {
      this.wrongAnswers.push({
        id: question.id,
        topic: question.topic,
        question: question.question,
        part: question.part,
        type: question.type,
        yourAnswer: selectedOption,
        correctAnswer: question.answer,
        options: question.options,
        points: question.points,
        pointsEarned: 0,
        explanation: question.explanation,
        srsKey: question.srsKey || (this.quizId ? `${this.quizId}:${question.id}` : null)
      });
    }

    this.pointsScored += earned;
    this.userAnswers[this.index] = { value: selectedOption, ok: correct, earned };
    this.results.push({
      id: question.id,
      index: this.index,
      part: question.part,
      type: question.type,
      ok: correct,
      earned,
      maxPoints: question.points || 0,
      your: selectedOption,
      correct: question.answer
    });
    return correct;
  }

  /**
   * Phần II Đúng/Sai: 4 ý a–d
   */
  answerTrueFalse(choices = {}) {
    if (this.finished) return null;

    if (this.studyMode === "exam") {
      this.userAnswers[this.index] = { value: choices };
      this.answered = true;
      return { examMode: true, choices };
    }

    if (this.answered) return null;
    this.answered = true;
    const question = this.current;
    const items = question.items || [];
    const chosen = items.map((_, i) => Boolean(choices[i]));
    const correctCount = items.reduce(
      (n, item, i) => n + (chosen[i] === Boolean(item.correct) ? 1 : 0),
      0
    );
    const ok = items.length > 0 && correctCount === items.length;
    const earned = question.points ? trueFalsePoints(correctCount) : ok ? 1 : 0;

    if (ok) {
      this.score++;
    } else {
      this.wrongAnswers.push({
        id: question.id,
        topic: question.topic,
        question: question.question,
        part: question.part,
        type: "true_false",
        items,
        yourAnswer: chosen,
        correctAnswer: items,
        points: question.points,
        pointsEarned: earned,
        explanation: question.explanation,
        srsKey: question.srsKey || (this.quizId ? `${this.quizId}:${question.id}` : null)
      });
    }

    this.pointsScored += earned;
    this.userAnswers[this.index] = { value: chosen, ok, earned };
    this.results.push({
      id: question.id,
      index: this.index,
      part: question.part,
      type: "true_false",
      ok,
      earned,
      maxPoints: question.points || 0,
      your: chosen,
      correct: items
    });
    return { ok, correctCount, earned, maxPoints: question.points || 0, choices: chosen };
  }

  /**
   * Phần III trả lời ngắn
   */
  answerShortAnswer(text) {
    if (this.finished) return null;

    if (this.studyMode === "exam") {
      this.userAnswers[this.index] = { value: text };
      this.answered = true;
      return { examMode: true, text };
    }

    if (this.answered) return null;
    this.answered = true;
    const question = this.current;
    const ok = matchShortAnswer(question.answer, text, question);
    const earned = ok ? question.points || 0 : 0;

    if (ok) {
      this.score++;
    } else {
      this.wrongAnswers.push({
        id: question.id,
        topic: question.topic,
        question: question.question,
        part: question.part,
        type: "short_answer",
        yourAnswer: text,
        correctAnswer: question.answer,
        points: question.points,
        pointsEarned: 0,
        explanation: question.explanation,
        srsKey: question.srsKey || (this.quizId ? `${this.quizId}:${question.id}` : null)
      });
    }

    this.pointsScored += earned;
    this.userAnswers[this.index] = { value: text, ok, earned };
    this.results.push({
      id: question.id,
      index: this.index,
      part: question.part,
      type: "short_answer",
      ok,
      earned,
      maxPoints: question.points || 0,
      your: text,
      correct: question.answer
    });
    return { ok, earned, maxPoints: question.points || 0 };
  }

  /**
   * Tự luận / Câu hỏi mở: người học tự đánh giá đúng / cần ôn lại
   */
  answerEssay(correct = true, note = "") {
    if (this.finished) return null;

    if (this.studyMode === "exam") {
      this.userAnswers[this.index] = { value: note || (correct ? "Đã làm" : "Chưa làm"), ok: correct };
      this.answered = true;
      return { examMode: true, correct };
    }

    if (this.answered) return null;
    this.answered = true;
    const question = this.current;
    const earned = correct ? (question.points || 1.0) : 0;

    if (correct) {
      this.score++;
    } else {
      this.wrongAnswers.push({
        id: question.id,
        topic: question.topic,
        question: question.question,
        part: question.part,
        type: "essay",
        yourAnswer: "Tự đánh giá: Chưa nhớ / Cần ôn lại",
        correctAnswer: question.answer,
        points: question.points,
        pointsEarned: 0,
        explanation: question.explanation,
        srsKey: question.srsKey || (this.quizId ? `${this.quizId}:${question.id}` : null)
      });
    }

    this.pointsScored += earned;
    this.userAnswers[this.index] = { value: correct ? "Đã thuộc" : "Chưa thuộc", ok: correct, earned };
    this.results.push({
      id: question.id,
      index: this.index,
      part: question.part,
      type: "essay",
      ok: correct,
      earned,
      maxPoints: question.points || 1.0,
      your: correct ? "Đã thuộc" : "Chưa thuộc",
      correct: question.answer
    });
    return { ok: correct, earned, maxPoints: question.points || 1.0 };
  }

  /**
   * Nộp bài thi (Exam Mode Submit): Đánh giá toàn bộ câu hỏi và tính toán khảo thí
   */
  submitExam() {
    this.finished = true;
    this.score = 0;
    this.pointsScored = 0;
    this.wrongAnswers = [];
    this.results = [];

    const totalSeconds = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));
    const topicStats = {};

    this.questions.forEach((q, i) => {
      const type = q.type || (q.options && q.options.length > 0 ? "multiple_choice" : "essay");
      const userAns = this.userAnswers[i]?.value;
      const topicKey = q.topic || q.part || "Chung";

      if (!topicStats[topicKey]) {
        topicStats[topicKey] = { correct: 0, total: 0, earned: 0, maxPoints: 0 };
      }
      topicStats[topicKey].total++;
      topicStats[topicKey].maxPoints += q.points || (type === "true_false" ? 1.0 : 0.25);

      if (type === "true_false") {
        const items = q.items || [];
        const choices = userAns || {};
        const chosen = items.map((_, idx) => Boolean(choices[idx]));
        const correctCount = items.reduce(
          (n, item, idx) => n + (chosen[idx] === Boolean(item.correct) ? 1 : 0),
          0
        );
        const ok = items.length > 0 && correctCount === items.length;
        const earned = q.points ? trueFalsePoints(correctCount) : ok ? 1 : 0;

        if (ok) this.score++;
        else {
          this.wrongAnswers.push({
            id: q.id,
            topic: q.topic,
            question: q.question,
            part: q.part,
            type: "true_false",
            items,
            yourAnswer: chosen,
            correctAnswer: items,
            points: q.points,
            pointsEarned: earned,
            explanation: q.explanation
          });
        }
        this.pointsScored += earned;
        topicStats[topicKey].earned += earned;
        if (ok) topicStats[topicKey].correct++;

        this.userAnswers[i] = { value: chosen, ok, earned };
        this.results.push({
          id: q.id,
          index: i,
          part: q.part,
          type: "true_false",
          ok,
          earned,
          maxPoints: q.points || 1.0,
          your: chosen,
          correct: items
        });
      } else if (type === "short_answer") {
        const ok = matchShortAnswer(q.answer, userAns, q);
        const earned = ok ? q.points || 0 : 0;
        if (ok) this.score++;
        else {
          this.wrongAnswers.push({
            id: q.id,
            topic: q.topic,
            question: q.question,
            part: q.part,
            type: "short_answer",
            yourAnswer: userAns ?? "",
            correctAnswer: q.answer,
            points: q.points,
            pointsEarned: 0,
            explanation: q.explanation
          });
        }
        this.pointsScored += earned;
        topicStats[topicKey].earned += earned;
        if (ok) topicStats[topicKey].correct++;

        this.userAnswers[i] = { value: userAns, ok, earned };
        this.results.push({
          id: q.id,
          index: i,
          part: q.part,
          type: "short_answer",
          ok,
          earned,
          maxPoints: q.points || 0.25,
          your: userAns,
          correct: q.answer
        });
      } else if (type === "essay") {
        const isOk = Boolean(this.userAnswers[i]?.ok || (userAns && userAns !== "Chưa trả lời"));
        const earned = isOk ? (q.points || 1.0) : 0;
        if (isOk) this.score++;
        else {
          this.wrongAnswers.push({
            id: q.id,
            topic: q.topic,
            question: q.question,
            part: q.part,
            type: "essay",
            yourAnswer: userAns || "Chưa trả lời",
            correctAnswer: q.answer,
            points: q.points,
            pointsEarned: 0,
            explanation: q.explanation
          });
        }
        this.pointsScored += earned;
        topicStats[topicKey].earned += earned;
        if (isOk) topicStats[topicKey].correct++;

        this.userAnswers[i] = { value: userAns || "Đã nộp", ok: isOk, earned };
        this.results.push({
          id: q.id,
          index: i,
          part: q.part,
          type: "essay",
          ok: isOk,
          earned,
          maxPoints: q.points || 1.0,
          your: userAns || "Chưa trả lời",
          correct: q.answer
        });
      } else {
        // multiple_choice
        const sClean = cleanOptionPrefix(userAns).text.toLowerCase().trim();
        const aClean = cleanOptionPrefix(q.answer).text.toLowerCase().trim();
        const ok = Boolean(userAns) && (userAns === q.answer || (sClean && sClean === aClean));
        const earned = ok ? q.points || 0 : 0;

        if (ok) this.score++;
        else {
          this.wrongAnswers.push({
            id: q.id,
            topic: q.topic,
            question: q.question,
            part: q.part,
            type: "multiple_choice",
            yourAnswer: userAns ?? "Chưa trả lời",
            correctAnswer: q.answer,
            options: q.options,
            points: q.points,
            pointsEarned: 0,
            explanation: q.explanation
          });
        }
        this.pointsScored += earned;
        topicStats[topicKey].earned += earned;
        if (ok) topicStats[topicKey].correct++;

        this.userAnswers[i] = { value: userAns, ok, earned };
        this.results.push({
          id: q.id,
          index: i,
          part: q.part,
          type: "multiple_choice",
          ok,
          earned,
          maxPoints: q.points || 0.25,
          your: userAns,
          correct: q.answer
        });
      }
    });

    // Tổng hợp số liệu khảo thí
    const avgSecondsPerQ = Math.round(totalSeconds / Math.max(1, this.total));
    this.analytics = {
      totalSeconds,
      avgSecondsPerQ,
      topicStats,
      unansweredCount: this.questions.length - Object.keys(this.userAnswers).filter(k => this.userAnswers[k]?.value != null).length,
      flaggedCount: this.flags.size
    };

    return this.analytics;
  }

  next() {
    this.index++;
    this.answered = Boolean(this.userAnswers[this.index]);
    if (this.index >= this.total) {
      if (this.studyMode !== "exam") {
        this.finished = true;
      }
      return false;
    }
    return true;
  }

  prev() {
    if (this.index > 0) {
      this.index--;
      this.answered = Boolean(this.userAnswers[this.index]);
      return true;
    }
    return false;
  }

  goTo(targetIndex) {
    if (targetIndex >= 0 && targetIndex < this.total) {
      this.index = targetIndex;
      this.answered = Boolean(this.userAnswers[this.index]);
      return true;
    }
    return false;
  }

  restore({
    quizId,
    label,
    studyMode = "practice",
    questions,
    index,
    score,
    pointsScored,
    maxPoints,
    wrongAnswers,
    results,
    userAnswers,
    flags,
    exam,
    remainingTimer,
    startTime
  }) {
    this.reset();
    this.quizId = quizId || null;
    this.label = label || "";
    this.studyMode = studyMode || "practice";
    this.shuffle = Boolean(session.shuffle);
    this.questions = questions;
    this.index = Math.min(index, Math.max(questions.length - 1, 0));
    this.score = score || 0;
    this.pointsScored = pointsScored || 0;
    this.maxPoints =
      maxPoints ?? this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    this.wrongAnswers = wrongAnswers || [];
    this.results = results || [];
    this.userAnswers = userAnswers || {};
    this.flags = new Set(flags || []);
    this.exam = exam || null;
    this.remainingTimer = remainingTimer ?? null;
    this.startTime = startTime || Date.now();
    this.answered = Boolean(this.userAnswers[this.index]);
    return this;
  }

  serialize() {
    return {
      quizId: this.quizId,
      label: this.label,
      studyMode: this.studyMode,
      shuffle: this.shuffle,
      questions: this.questions,
      index: this.index,
      score: this.score,
      pointsScored: this.pointsScored,
      maxPoints: this.maxPoints,
      wrongAnswers: this.wrongAnswers,
      results: this.results,
      userAnswers: this.userAnswers,
      flags: Array.from(this.flags),
      exam: this.exam,
      remainingTimer: this.remainingTimer,
      startTime: this.startTime,
      at: Date.now()
    };
  }
}

export const engine = new QuizEngine();
