// Quiz engine — state machine của một phiên làm bài, không đụng DOM.
// Hỗ trợ 2 chế độ: quiz thường (đếm câu đúng, xáo trộn) và đề thi THPT 2026
// (giữ nguyên thứ tự Phần, chấm điểm thang 10 theo cấu trúc chuẩn).

import { trueFalsePoints, numericAnswersEqual } from "./exam-config.js";

export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export class QuizEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.quizId = null;
    this.label = "";
    this.questions = [];
    this.index = 0;
    this.score = 0;
    this.pointsScored = 0;
    this.maxPoints = 0;
    this.wrongAnswers = [];
    this.results = []; // kết quả từng câu { id, part, type, ok, earned, maxPoints, your, correct }
    this.exam = null; // metadata đề thi THPT 2026 (subject, structure, validation)
    this.answered = false;
    this.finished = false;
  }

  start({ quizId = null, label = "", questions, exam = null }) {
    this.reset();
    this.quizId = quizId;
    this.label = label;
    this.exam = exam || null;
    const isExam = !!this.exam;
    // Đề thi: giữ nguyên thứ tự Phần để đúng cấu trúc; quiz thường xáo trộn chống học vẹt
    this.questions = (isExam ? [...questions] : shuffleArray([...questions])).map((q) =>
      !isExam && q.options && q.options.length > 0
        ? { ...q, options: shuffleArray([...q.options]) }
        : { ...q }
    );
    this.maxPoints = this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    return this;
  }

  /** Định danh SRS của câu hiện tại (quizId:questionId) */
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

  /** Trả về true nếu chọn đúng (trắc nghiệm 4 lựa chọn) */
  answer(selectedOption) {
    if (this.answered || this.finished) return null;
    this.answered = true;
    const question = this.current;
    const correct = selectedOption === question.answer;
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
    this.results.push({
      id: question.id,
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
   * Phần II Đúng/Sai: 4 ý a–d, mỗi ý chọn Đúng(true)/Sai(false).
   * choices: { [itemIndex]: boolean } — ý bỏ trống tính là sai.
   * Điểm theo luật: 1 ý → 0.1, 2 ý → 0.25, 3 ý → 0.5, 4 ý → 1.0, 0 ý → 0.
   * @returns {{ ok, correctCount, earned, maxPoints, choices }} | null
   */
  answerTrueFalse(choices = {}) {
    if (this.answered || this.finished) return null;
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
    this.results.push({
      id: question.id,
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
   * Phần III trả lời ngắn: so khớp con số thuần túy (bỏ qua đơn vị, dấu phẩy/chấm).
   * @returns {{ ok, earned, maxPoints }} | null
   */
  answerShortAnswer(text) {
    if (this.answered || this.finished) return null;
    this.answered = true;
    const question = this.current;
    const ok = numericAnswersEqual(question.answer, text);
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
    this.results.push({
      id: question.id,
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

  next() {
    this.index++;
    this.answered = false;
    if (this.index >= this.total) {
      this.finished = true;
      return false;
    }
    return true;
  }

  prev() {
    if (this.index > 0) {
      this.index--;
      this.answered = false;
    }
  }

  /** Restore phiên đang làm dở (không shuffle lại) */
  restore({ quizId, label, questions, index, score, pointsScored, maxPoints, wrongAnswers, results, exam }) {
    this.reset();
    this.quizId = quizId || null;
    this.label = label || "";
    this.questions = questions;
    this.index = Math.min(index, Math.max(questions.length - 1, 0));
    this.score = score || 0;
    this.pointsScored = pointsScored || 0;
    this.maxPoints =
      maxPoints ?? this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    this.wrongAnswers = wrongAnswers || [];
    this.results = results || [];
    this.exam = exam || null;
    return this;
  }

  serialize() {
    return {
      quizId: this.quizId,
      label: this.label,
      questions: this.questions,
      index: this.index,
      score: this.score,
      pointsScored: this.pointsScored,
      maxPoints: this.maxPoints,
      wrongAnswers: this.wrongAnswers,
      results: this.results,
      exam: this.exam,
      at: Date.now()
    };
  }
}

export const engine = new QuizEngine();
