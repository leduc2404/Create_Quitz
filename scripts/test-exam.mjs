// Kiểm thử nhanh (node scripts/test-exam.mjs) cho nâng cấp đề THPT 2026.
import {
  resolveSubject,
  validateExamQuiz,
  trueFalsePoints,
  normalizeNumericAnswer,
  numericAnswersEqual,
  fmtScore
} from "../src/core/exam-config.js";
import { parseQuizData } from "../src/core/quiz-parser.js";
import { QuizEngine, shuffleArray } from "../src/core/quiz-engine.js";

let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

// ---------- Dữ liệu mẫu ----------
function mc(i, answer = "A") {
  return {
    question: `Câu trắc nghiệm ${i}`,
    options: ["A. đúng", "B. sai", "C. sai", "D. sai"],
    answer: "A. đúng",
    explanation: `Lời giải câu ${i}`
  };
}
function tf(i, pattern) {
  return {
    question: `Câu đúng/sai ${i}`,
    items: [
      { text: "ý a", correct: pattern[0] },
      { text: "ý b", correct: pattern[1] },
      { text: "ý c", correct: pattern[2] },
      { text: "ý d", correct: pattern[3] }
    ],
    explanation: `Lời giải đúng/sai ${i}`
  };
}
function sa(i, answer) {
  return { question: `Câu trả lời ngắn ${i}`, answer, explanation: `Lời giải số ${i}` };
}
function examData(subject, counts) {
  const parts = [];
  if (counts[0]) {
    parts.push({
      part: "I",
      type: "multiple_choice",
      questions: Array.from({ length: counts[0] }, (_, i) => mc(i + 1))
    });
  }
  if (counts[1]) {
    parts.push({
      part: "II",
      type: "true_false",
      questions: Array.from({ length: counts[1] }, (_, i) => tf(i + 1, [true, false, true, false]))
    });
  }
  if (counts[2]) {
    parts.push({
      part: "III",
      type: "short_answer",
      questions: Array.from({ length: counts[2] }, (_, i) => sa(i + 1, String(i + 1)))
    });
  }
  return { examFormat: "thpt2026", subject, parts };
}

console.log("== resolveSubject (alias + bỏ dấu) ==");
check("Toán", resolveSubject("Toán") === "Toán");
check("Vật lý -> Vật lí", resolveSubject("Vật lý") === "Vật lí");
check("Ly (đề thi môn Ly)", resolveSubject("Đề thi môn Lý") === "Vật lí");
check("Hóa học 12", resolveSubject("Hóa Học 12") === "Hóa học");
check("Sử", resolveSubject("Lịch Sử") === "Lịch sử");
check("Địa", resolveSubject("Địa lí") === "Địa lí");
check("GDCD", resolveSubject("GDCD") === "Giáo dục kinh tế và pháp luật");
check("Tin học", resolveSubject("Tin học") === "Tin học");
check("Công nghệ", resolveSubject("Công nghệ") === "Công nghệ");
check("không nhận diện: công suất", resolveSubject("Công suất") === null);
check("không nhận diện: rỗng", resolveSubject("") === null);

console.log("== Luật chấm Phần II (Đúng/Sai) ==");
check("0 ý -> 0", trueFalsePoints(0) === 0);
check("1 ý -> 0.1", trueFalsePoints(1) === 0.1);
check("2 ý -> 0.25", trueFalsePoints(2) === 0.25);
check("3 ý -> 0.5", trueFalsePoints(3) === 0.5);
check("4 ý -> 1.0", trueFalsePoints(4) === 1);
check("clamp > 4 ý", trueFalsePoints(6) === 1);

console.log("== Chuẩn hóa số Phần III ==");
check("1,5 == 1.5", numericAnswersEqual("1,5", "1.5"));
check("-2 == -2.0", numericAnswersEqual("-2", "-2.0"));
check("3 kg == 3", numericAnswersEqual("3 kg", "3"));
check("2.5 m/s == 2,5", numericAnswersEqual("2.5 m/s", "2,5"));
check("khác số -> false", !numericAnswersEqual("1.5", "2"));
check("rỗng -> false", !numericAnswersEqual("", "1"));
check("null -> false", !numericAnswersEqual(null, "1"));
check("normalize '0,25' -> 0.25", normalizeNumericAnswer("0,25") === 0.25);
check("fmtScore 7.5", fmtScore(7.5) === "7.5");
check("fmtScore 10", fmtScore(10) === "10");

console.log("== Parser: đề hoàn chỉnh ==");
const toan = parseQuizData(examData("Toán", [12, 4, 6]), "toan.json");
check("Toán: quizType thpt2026", toan.quizType === "thpt2026");
check("Toán: 22 câu", toan.totalQuestions === 22);
check("Toán: status complete", toan.exam.validation.status === "complete");
check("Toán: subject", toan.exam.subject === "Toán");
check("Toán: group 1", toan.exam.group === 1);
check("Toán: maxPoints 10", toan.questions.reduce((s, q) => s + q.points, 0) === 10);
check("Toán: MC 0.25đ", toan.questions[0].points === 0.25);
check("Toán: TF 1.0đ", toan.questions[12].points === 1);
check("Toán: SA 0.5đ", toan.questions[16].points === 0.5);
check("Toán: items 4 ý", toan.questions[12].items.length === 4);
check("Toán: part label", toan.questions[12].part === "Phần II");
check("Toán: explanation giữ nguyên", toan.questions[0].explanation.includes("Lời giải"));

const ly = parseQuizData(examData("Lý", [18, 4, 6]), "ly.json");
check("Lý: resolve + complete", ly.exam.subject === "Vật lí" && ly.exam.validation.status === "complete");
check("Lý: SA 0.25đ", ly.questions[22].points === 0.25);

const su = parseQuizData(examData("Sử", [24, 4]), "su.json");
check("Sử: complete, không Phần III", su.exam.validation.status === "complete" && su.totalQuestions === 28);
check("Sử: maxPoints 10", su.questions.reduce((s, q) => s + q.points, 0) === 10);

console.log("== Parser: đề trích đoạn ==");
const partial = parseQuizData(examData("Toán", [12, 4, 3]), "toan-doan.json");
check("Trích đoạn: status partial", partial.exam.validation.status === "partial");
check("Trích đoạn: counts III = 3", partial.exam.validation.counts.III === 3);
check("Trích đoạn: maxPoints 8.5", partial.questions.reduce((s, q) => s + q.points, 0) === 8.5);

console.log("== Backward compat: JSON cũ ==");
const legacy = parseQuizData(
  {
    type: "multiple_choice",
    topic: "Chương 1",
    questions: [
      { id: "1", question: "Hỏi?", options: ["A", "B", "C"], answer: "A" },
      { id: "2", question: "Hỏi 2?", options: ["A", "B"], answer: "B" }
    ]
  },
  "cu.json"
);
check("legacy: quizType", legacy.quizType === "multiple_choice");
check("legacy: không exam metadata", !legacy.exam);
check("legacy: 2 câu", legacy.totalQuestions === 2);
check("legacy: không part/points", legacy.questions[0].part === undefined && legacy.questions[0].points === undefined);

console.log("== Engine: chế độ đề thi ==");
const engine = new QuizEngine();
engine.start({ quizId: "q1", label: "Toán 2026", questions: toan.questions, exam: toan.exam });
check("không xáo trộn câu (đề thi)", engine.questions[0].id === toan.questions[0].id && engine.questions[21].id === toan.questions[21].id);
check("maxPoints = 10", engine.maxPoints === 10);

// Phần I: 11 câu MC đúng + 1 câu sai (0.25đ/câu)
for (let i = 0; i < 11; i++) {
  engine.answer("A. đúng");
  engine.next();
}
engine.answer("B. sai"); // câu 12 sai
engine.next();
// Phần II: câu 13 — đúng 3/4 ý → 0.5
engine.answerTrueFalse({ 0: true, 1: false, 2: true, 3: true }); // d sai → 3/4 → 0.5
engine.next();
// Phần II: câu 14 — đúng cả 4 ý → 1.0
engine.answerTrueFalse({ 0: true, 1: false, 2: true, 3: false }); // 1.0
engine.next();
check("TF đúng 3/4 ý -> 0.5đ", engine.pointsScored === 11 * 0.25 + 0.5 + 1);
check("results dài 14", engine.results.length === 14);
check("score đếm câu full điểm", engine.score === 12);
check("wrongAnswers 2 câu (MC sai + TF thiếu)", engine.wrongAnswers.length === 2);

// Phần III: câu 7 — nhập "1,5" cho đáp án "1.5"? Đáp án là "1" nên dùng numericAnswersEqual trực tiếp
const saEngine = new QuizEngine();
saEngine.start({
  quizId: "q2",
  label: "SA test",
  questions: toan.questions.slice(16, 17).map((q) => ({ ...q, answer: "1.5" })),
  exam: { validation: { status: "complete" } }
});
check("SA: '1,5' khớp '1.5'", saEngine.answerShortAnswer("1,5").ok === true);
check("SA: '+0.5đ'... thực tế 0.5đ", saEngine.pointsScored === 0.5);

const saEngine2 = new QuizEngine();
saEngine2.start({
  quizId: "q3",
  label: "SA test2",
  questions: toan.questions.slice(16, 17).map((q) => ({ ...q, answer: "-2.0" })),
  exam: { validation: { status: "complete" } }
});
check("SA: '-2' khớp '-2.0'", saEngine2.answerShortAnswer("-2").ok === true);

// serialize/restore roundtrip
const restored = new QuizEngine();
restored.restore(engine.serialize());
check("restore: pointsScored", restored.pointsScored === engine.pointsScored);
check("restore: maxPoints", restored.maxPoints === engine.maxPoints);
check("restore: exam", restored.exam?.validation?.status === engine.exam.validation.status);
check("restore: results", restored.results.length === engine.results.length);

console.log("== Engine: quiz thường vẫn xáo trộn + đếm câu ==");
const legacyEngine = new QuizEngine();
legacyEngine.start({ quizId: "old", label: "Cũ", questions: legacy.questions });
const shuffledIds = shuffleArray([...Array.from({ length: 10 }, (_, i) => i)]);
check("shuffleArray: là hoán vị", shuffledIds.slice().sort((a, b) => a - b).join(",") === "0,1,2,3,4,5,6,7,8,9");
check("maxPoints = 0 (không phải đề thi)", legacyEngine.maxPoints === 0);
legacyEngine.answer(legacyEngine.current.answer);
check("MC thường: score 1", legacyEngine.score === 1);
check("MC thường: không pointsScored", legacyEngine.pointsScored === 0);

console.log("== validateExamQuiz ==");
check("validate complete", validateExamQuiz({ subject: "Toán", questions: toan.questions }).status === "complete");
check("validate partial", validateExamQuiz({ subject: "Toán", questions: partial.questions }).status === "partial");
check("validate không môn", validateExamQuiz({ subject: "", questions: toan.questions }).status === "partial");

console.log(`\nKết quả: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
