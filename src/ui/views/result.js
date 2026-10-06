import { engine } from "../../core/quiz-engine.js";
import { recordWrongIds, saveAttempt } from "../../core/storage/local.js";
import { saveResult } from "../../core/storage/cloud.js";
import { getState, getQuiz } from "../../core/store.js";
import { shareQuiz } from "../../core/share.js";
import { fmtScore } from "../../core/exam-config.js";
import { iconSvg, hydrateIcons } from "../icons.js";
import { showScreen } from "../router.js";
import { launchConfetti } from "../confetti.js";
import { formatRichText } from "../util.js";

const TYPE_LABELS = {
  multiple_choice: "Trắc nghiệm",
  true_false: "Đúng – Sai",
  short_answer: "Trả lời ngắn"
};

export function initResultView({ onRestart, onRetryWrong, onHome }) {
  document.getElementById("restartBtn").addEventListener("click", onRestart);
  document.getElementById("retryWrongBtn").addEventListener("click", onRetryWrong);
  document.getElementById("homeBtn").addEventListener("click", onHome);
  document.getElementById("shareResultBtn").addEventListener("click", () => {
    const quiz = getQuiz(engine.quizId);
    if (quiz) shareQuiz(quiz);
  });
  document.getElementById("wrongAnswersHeader").addEventListener("click", () => {
    document.getElementById("wrongAnswersHeader").classList.toggle("open");
    document.getElementById("wrongAnswersList").classList.toggle("show");
  });
  document.getElementById("solutionHeader").addEventListener("click", () => {
    document.getElementById("solutionHeader").classList.toggle("open");
    document.getElementById("solutionList").classList.toggle("show");
  });
}

export function showResult() {
  const isExam = !!(engine.exam && engine.maxPoints > 0);
  // Đề hoàn chỉnh khi: môn khớp cấu trúc chuẩn VÀ phiên này đủ 10 điểm
  // (phiên lẻ như "Ôn 10 câu" không được hiển thị thang /10)
  const fullExam =
    isExam &&
    engine.exam.validation?.status === "complete" &&
    Math.abs(engine.maxPoints - 10) < 1e-9;
  const score = isExam ? engine.pointsScored : engine.score;
  const total = isExam ? engine.maxPoints : engine.total;
  const percentage = total ? (score / total) * 100 : 0;

  document.getElementById("finalScore").textContent = fmtScore(score);
  document.getElementById("totalQuestions").textContent = fullExam ? "10" : fmtScore(total);

  let icon, title, message;
  if (percentage >= 90) {
    icon = "Award"; title = "Xuất sắc!"; message = "Bạn đã làm rất tốt! Tiếp tục phát huy nhé!";
  } else if (percentage >= 70) {
    icon = "TrendingUp"; title = "Tuyệt vời!"; message = "Kết quả rất tốt! Chỉ cần cố gắng thêm một chút!";
  } else if (percentage >= 50) {
    icon = "Zap"; title = "Khá tốt!"; message = "Hãy ôn tập thêm để đạt kết quả cao hơn!";
  } else {
    icon = "BookOpen"; title = "Cần cố gắng!"; message = "Đừng nản, hãy ôn tập lại và thử lại nhé!";
  }

  document.getElementById("resultIcon").innerHTML = iconSvg(icon, 56);
  document.getElementById("resultTitle").textContent = title;
  document.getElementById("resultMessage").textContent = message;

  // Hiệu ứng pháo hoa chúc mừng nếu đạt điểm giỏi (>= 80% hoặc >= 8.0)
  if (percentage >= 80 || (fullExam && score >= 8.0)) {
    launchConfetti(4500);
  }

  // Khảo thí EdTech: Nhịp độ làm bài (Pacing)
  const totalSeconds =
    engine.analytics?.totalSeconds ??
    Math.max(1, Math.floor((Date.now() - engine.startTime) / 1000));
  const avgPace =
    engine.analytics?.avgSecondsPerQ ??
    Math.round(totalSeconds / Math.max(1, engine.total));

  const pacingCard = document.getElementById("pacingCard");
  if (pacingCard) {
    pacingCard.hidden = false;
    document.getElementById("avgPaceVal").textContent = `${avgPace}s`;

    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    document.getElementById("totalTimeVal").textContent = `${minutes}:${secs < 10 ? "0" : ""}${secs}`;

    let paceEval = "Tối ưu 🎯";
    if (avgPace <= 25) paceEval = "Nhanh ⚡";
    else if (avgPace > 75) paceEval = "Cần tăng tốc ⏳";
    document.getElementById("paceEvalVal").textContent = paceEval;
  }

  // Khảo thí EdTech: Năng lực theo từng phần thi / chủ đề
  renderTopicBreakdown();

  // Lưu lịch sử bài thi (Attempt History)
  saveAttempt({
    quizId: engine.quizId,
    quizName: engine.label || "Bài kiểm tra",
    studyMode: engine.studyMode || "practice",
    score,
    total,
    percentage: Math.round(percentage),
    totalSeconds,
    avgPace,
    wrongCount: engine.wrongAnswers.length,
    totalQuestions: engine.total
  });

  renderExamSections(isExam);
  renderWrongAnswers();
  renderSolutionList(isExam);

  // Lưu kết quả lên cloud nếu đã đăng nhập (phục vụ thống kê sau này)
  const user = getState().user;
  if (user) {
    saveResult(user.uid, {
      quizId: engine.quizId,
      quizName: engine.label,
      score,
      total,
      wrongIds: engine.wrongAnswers.map((w) => w.id)
    }).catch(() => {});
  }

  // Chỉ hiện nút share khi phiên này thuộc về một quiz trong thư viện
  document.getElementById("shareResultBtn").hidden = !getQuiz(engine.quizId);

  hydrateIcons();
  showScreen("resultScreen");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Khảo thí: Năng lực theo chủ đề / phần thi ----------
function renderTopicBreakdown() {
  const card = document.getElementById("topicBreakdownCard");
  const container = document.getElementById("topicBars");
  if (!card || !container) return;

  const stats = {};
  engine.questions.forEach((q, idx) => {
    const key = q.topic || q.part || "Chung";
    if (!stats[key]) {
      stats[key] = { name: key, total: 0, correct: 0, earned: 0, maxPoints: 0 };
    }
    stats[key].total++;
    stats[key].maxPoints += (q.points || 1);

    const res = engine.results[idx] || (engine.userAnswers[idx]?.ok ? { ok: true, earned: q.points || 1 } : null);
    if (res) {
      if (res.ok) stats[key].correct++;
      stats[key].earned += (res.earned || 0);
    }
  });

  const entries = Object.values(stats);
  if (entries.length === 0) {
    card.hidden = true;
    return;
  }

  container.innerHTML = "";
  entries.forEach((item) => {
    const pct = item.maxPoints > 0
      ? Math.round((item.earned / item.maxPoints) * 100)
      : Math.round((item.correct / item.total) * 100);

    const row = document.createElement("div");
    row.className = "topic-bar-row";

    const labelRow = document.createElement("div");
    labelRow.className = "topic-bar-label";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = item.name;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "muted";
    scoreSpan.textContent = `${item.correct}/${item.total} câu · ${pct}%`;

    labelRow.append(nameSpan, scoreSpan);

    const bg = document.createElement("div");
    bg.className = "topic-bar-bg";

    const fill = document.createElement("div");
    fill.className = "topic-bar-fill";
    fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    if (pct >= 80) {
      fill.style.background = "linear-gradient(90deg, #10B981, #06B6D4)";
    } else if (pct < 50) {
      fill.style.background = "linear-gradient(90deg, #F43F5E, #FB923C)";
    }

    bg.appendChild(fill);
    row.append(labelRow, bg);
    container.appendChild(row);
  });

  card.hidden = false;
}

// ---------- Đề THPT 2026: cảnh báo trích đoạn + bảng điểm ----------
function renderExamSections(isExam) {
  const validation = engine.exam?.validation || null;

  // TRƯỜNG HỢP 2: đề trích đoạn — vô hiệu hóa tổng điểm, cảnh báo nguyên văn
  const warning = document.getElementById("examWarning");
  if (isExam && validation && validation.status === "partial") {
    const subjectName = engine.exam.subject || validation.rawSubject || "chưa xác định";
    warning.hidden = false;
    warning.textContent =
      `⚠️ HỆ THỐNG GHI NHẬN: Đây là đề trích đoạn / chưa đủ cấu trúc chuẩn 2026 ` +
      `của môn ${subjectName}. Chế độ tính tổng điểm (thang 10) bị vô hiệu hóa.`;
  } else {
    warning.hidden = true;
  }

  // TRƯỜNG HỢP 1: đề hoàn chỉnh — bảng điểm theo phần
  const table = document.getElementById("examScoreTable");
  if (isExam) {
    table.hidden = false;
    buildExamTable(table);
  } else {
    table.hidden = true;
    table.innerHTML = "";
  }
}

function buildExamTable(el) {
  el.innerHTML = "";
  const parts = {};
  for (const q of engine.questions) {
    const key = q.part || "Phần I";
    (parts[key] = parts[key] || []).push(q);
  }
  let totalEarned = 0;
  let totalMax = 0;
  for (const [part, qs] of Object.entries(parts)) {
    const res = engine.results.filter((r) => r.part === part);
    const earned = res.reduce((s, r) => s + r.earned, 0);
    const max = qs.reduce((s, q) => s + (q.points || 0), 0);
    totalEarned += earned;
    totalMax += max;
    el.appendChild(examRow(`${part} · ${qs.length} câu`, earned, max));
  }
  const row = document.createElement("div");
  row.className = "exam-row total";
  const name = document.createElement("span");
  name.className = "exam-part";
  name.textContent = "Tổng điểm";
  const pts = document.createElement("span");
  pts.className = "exam-pts";
  pts.textContent = `${fmtScore(totalEarned)} / ${fmtScore(totalMax)} điểm`;
  row.append(name, pts);
  el.appendChild(row);
}

function examRow(part, earned, max) {
  const row = document.createElement("div");
  row.className = "exam-row";
  const name = document.createElement("span");
  name.className = "exam-part";
  name.textContent = part;
  const pts = document.createElement("span");
  pts.className = "exam-pts";
  pts.textContent = `${fmtScore(earned)} / ${fmtScore(max)} điểm`;
  row.append(name, pts);
  return row;
}

// ---------- Đáp án & lời giải từng câu (đề trích đoạn) ----------
function renderSolutionList(isExam) {
  const section = document.getElementById("solutionSection");
  const list = document.getElementById("solutionList");
  const validation = engine.exam?.validation || null;
  const show = isExam && validation && validation.status === "partial";
  section.hidden = !show;
  if (!show) {
    list.innerHTML = "";
    return;
  }
  document.getElementById("solutionHeader").classList.remove("open");
  list.classList.remove("show");
  list.innerHTML = "";

  engine.questions.forEach((q, idx) => {
    const res = engine.results[idx] || null;
    const div = document.createElement("div");
    div.className = "wrong-item";

    const label = document.createElement("div");
    label.className = "question-label";
    label.textContent =
      `Câu ${idx + 1} — ${q.part || "Phần I"} | ${TYPE_LABELS[q.type] || "Trắc nghiệm"}`;

    const question = document.createElement("div");
    question.className = "question";
    question.innerHTML = formatRichText(q.question);
    div.append(label, question);

    const answer = document.createElement("div");
    answer.className = "correct-answer";
    const answerLabel = document.createElement("div");
    answerLabel.className = "answer-label";
    answerLabel.textContent = "Đáp án đúng:";
    answer.appendChild(answerLabel);
    if (q.type === "true_false") {
      answer.appendChild(buildTfAnswer(q.items || []));
    } else {
      answer.appendChild(document.createTextNode(q.answer || "—"));
    }
    div.appendChild(answer);

    if (res) {
      const yours = document.createElement("div");
      yours.className = res.ok ? "correct-answer" : "your-answer";
      const yoursLabel = document.createElement("div");
      yoursLabel.className = "answer-label";
      yoursLabel.textContent = "Bạn trả lời:";
      yours.appendChild(yoursLabel);
      if (q.type === "true_false") {
        yours.appendChild(buildTfChoices(q.items || [], res.your));
      } else {
        yours.appendChild(document.createTextNode(res.your ?? "—"));
      }
      div.appendChild(yours);

      const pts = document.createElement("div");
      pts.className = "solution-pts";
      pts.textContent = `Điểm: +${fmtScore(res.earned)} / ${fmtScore(res.maxPoints)}`;
      div.appendChild(pts);
    } else {
      const skip = document.createElement("div");
      skip.className = "your-answer";
      skip.textContent = "Chưa trả lời";
      div.appendChild(skip);
    }

    if (q.explanation) {
      const sol = document.createElement("div");
      sol.className = "solution-explain";
      const solLabel = document.createElement("div");
      solLabel.className = "answer-label";
      solLabel.textContent = "Lời giải:";
      sol.appendChild(solLabel);
      const content = document.createElement("div");
      content.className = "solution-content";
      content.innerHTML = formatRichText(q.explanation);
      sol.appendChild(content);
      div.appendChild(sol);
    }

    list.appendChild(div);
  });
}

// ---------- Review câu sai ----------
function renderWrongAnswers() {
  const wrongAnswers = engine.wrongAnswers;
  const section = document.getElementById("wrongAnswersSection");
  const retryBtn = document.getElementById("retryWrongBtn");
  const list = document.getElementById("wrongAnswersList");

  document.getElementById("wrongAnswersHeader").classList.remove("open");
  list.classList.remove("show");
  list.innerHTML = "";

  if (wrongAnswers.length > 0) {
    section.hidden = false;
    retryBtn.hidden = false;
    document.getElementById("wrongCount").textContent = wrongAnswers.length;

    wrongAnswers.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "wrong-item";

      const label = document.createElement("div");
      label.className = "question-label";
      label.textContent = `Câu ${idx + 1} - ${item.id} | ${item.topic}`;

      const q = document.createElement("div");
      q.className = "question";
      q.innerHTML = formatRichText(item.question);
      div.append(label, q);

      const yours = document.createElement("div");
      yours.className = "your-answer";
      const yoursLabel = document.createElement("div");
      yoursLabel.className = "answer-label";
      yoursLabel.textContent = "Câu trả lời của bạn:";
      yours.appendChild(yoursLabel);

      const correct = document.createElement("div");
      correct.className = "correct-answer";
      const correctLabel = document.createElement("div");
      correctLabel.className = "answer-label";
      correctLabel.textContent = "Đáp án đúng:";
      correct.appendChild(correctLabel);

      if (item.type === "true_false") {
        yours.appendChild(buildTfChoices(item.items || [], item.yourAnswer));
        correct.appendChild(buildTfAnswer(item.items || []));
      } else {
        yours.appendChild(document.createTextNode(item.yourAnswer ?? "—"));
        correct.appendChild(document.createTextNode(item.correctAnswer ?? "—"));
      }
      div.append(yours, correct);

      if (item.pointsEarned != null) {
        const pts = document.createElement("div");
        pts.className = "solution-pts";
        pts.textContent = `Điểm: +${fmtScore(item.pointsEarned)} / ${fmtScore(item.points)}`;
        div.appendChild(pts);
      }

      if (item.explanation) {
        const sol = document.createElement("div");
        sol.className = "solution-explain";
        const solLabel = document.createElement("div");
        solLabel.className = "answer-label";
        solLabel.textContent = "Lời giải chi tiết:";
        sol.appendChild(solLabel);
        const content = document.createElement("div");
        content.className = "solution-content";
        content.innerHTML = formatRichText(item.explanation);
        sol.appendChild(content);
        div.appendChild(sol);
      }

      list.appendChild(div);
    });

    recordWrongIds(wrongAnswers.map((w) => `${engine.quizId || "?"}:${w.id}`));
  } else {
    section.hidden = true;
    retryBtn.hidden = true;
  }
}

// ---------- Render đáp án Đúng/Sai ----------
function buildTfAnswer(items) {
  const frag = document.createDocumentFragment();
  items.forEach((it, i) => {
    const line = document.createElement("div");
    line.className = "tf-answer-line";
    const mark = document.createElement("span");
    mark.className = it.correct ? "mark-ok" : "mark-bad";
    mark.textContent = it.correct ? "Đúng" : "Sai";
    line.append(document.createTextNode(`${"abcd"[i] || i + 1}) ${it.text} — `), mark);
    frag.appendChild(line);
  });
  return frag;
}

function buildTfChoices(items, chosen) {
  const frag = document.createDocumentFragment();
  items.forEach((it, i) => {
    const line = document.createElement("div");
    line.className = "tf-answer-line";
    const picked = chosen && chosen[i] !== undefined;
    const mark = document.createElement("span");
    mark.className = picked && chosen[i] === Boolean(it.correct) ? "mark-ok" : "mark-bad";
    mark.textContent = picked ? (chosen[i] ? "Đúng" : "Sai") : "bỏ trống";
    line.append(
      document.createTextNode(`${"abcd"[i] || i + 1}) ${it.text} — bạn chọn: `),
      mark
    );
    frag.appendChild(line);
  });
  return frag;
}
