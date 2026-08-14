// Parser quiz — giữ nguyên hành vi đa format từ bản gốc:
// hỗ trợ array of topics, array of questions, object { questions }, object nested.
// Tự nhận diện trắc nghiệm / tự luận dựa trên field `type` hoặc sự có mặt của `options`.
// Riêng examFormat "thpt2026" theo cấu trúc đề thi Tốt nghiệp THPT 2026 (Phần I/II/III).

import {
  EXAM_STRUCTURES,
  resolveSubject,
  validateExamQuiz,
  fallbackPoints
} from "./exam-config.js";

export function parseQuizData(data, fileName) {
  let questions = [];
  let topics = [];
  let mainTopic = fileName.replace(/\.json$/i, "");
  let quizType = "multiple_choice";

  // Case 0: Đề thi Tốt nghiệp THPT 2026 (cấu trúc Phần I/II/III)
  if (data && typeof data === "object" && data.examFormat === "thpt2026") {
    return parseThpt2026(data, fileName);
  }

  if (data.type === "essay") {
    quizType = "essay";
  } else if (data.type === "multiple_choice") {
    quizType = "multiple_choice";
  }

  // Case 1: Array of items (topics with questions OR direct questions)
  if (Array.isArray(data)) {
    const firstItem = data[0];

    if (firstItem && firstItem.questions && Array.isArray(firstItem.questions)) {
      const firstQuestion = firstItem.questions[0];
      if (firstQuestion) {
        quizType =
          firstQuestion.options && firstQuestion.options.length > 0
            ? "multiple_choice"
            : "essay";
      }
    } else if (firstItem && firstItem.question) {
      quizType =
        firstItem.options && firstItem.options.length > 0
          ? "multiple_choice"
          : "essay";
    }

    data.forEach((item, index) => {
      if (item.questions && Array.isArray(item.questions)) {
        const topicName = item.topic || `Phần ${index + 1}`;
        const firstQ = item.questions[0];
        const itemType =
          item.type ||
          (firstQ && firstQ.options && firstQ.options.length > 0
            ? "multiple_choice"
            : "essay");
        const normalized = normalizeQuestions(item.questions, topicName, itemType);
        topics.push({ topic: topicName, questions: normalized });
        questions.push(...normalized.map((q) => ({ ...q })));
      } else if (item.question) {
        const itemType =
          item.options && item.options.length > 0 ? "multiple_choice" : "essay";
        questions.push(normalizeQuestion(item, item.topic || mainTopic, index, itemType));
      }
    });
  }
  // Case 2: Single object with questions array
  else if (data.questions && Array.isArray(data.questions)) {
    mainTopic = data.topic || mainTopic;
    quizType = data.type || quizType;

    if (data.questions[0] && !data.questions[0].options) {
      quizType = "essay";
    }

    const normalized = normalizeQuestions(data.questions, mainTopic, quizType);
    topics.push({ topic: mainTopic, questions: normalized });
    questions = normalized;
  }
  // Case 3: Object with nested structure
  else if (typeof data === "object" && data !== null) {
    for (const key in data) {
      if (Array.isArray(data[key])) {
        const items = data[key];
        if (items.length > 0 && items[0].question) {
          const itemType = items[0].options ? "multiple_choice" : "essay";
          const normalized = normalizeQuestions(items, key, itemType);
          topics.push({ topic: key, questions: normalized });
          questions.push(...normalized.map((q) => ({ ...q })));
        }
      }
    }
  }

  if (questions.length === 0) return null;

  return {
    fileName,
    mainTopic,
    quizType,
    topics: topics.length > 1 ? topics : null,
    questions,
    totalQuestions: questions.length
  };
}

export function normalizeQuestions(questions, topic, type = "multiple_choice") {
  return questions.map((q, index) => normalizeQuestion(q, topic, index, type));
}

export function normalizeQuestion(q, topic, index, type = "multiple_choice") {
  const hasOptions = Array.isArray(q.options)
    ? q.options.length > 0
    : Boolean(q.options);
  const questionType = hasOptions
    ? "multiple_choice"
    : type === "essay"
      ? "essay"
      : "essay";

  return {
    id: q.id || `Q${index + 1}`,
    question: q.question || q.text || q.content || "",
    options: q.options || q.choices || q.answers || [],
    answer: q.answer || q.correct || q.correctAnswer || "",
    topic: q.topic || topic,
    type: questionType
  };
}

// ---------- Đề thi Tốt nghiệp THPT 2026 ----------

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function parseThpt2026(data, fileName) {
  const rawSubject = String(data.subject || "").trim();
  const subject = resolveSubject(rawSubject) || rawSubject || "";
  const structure = resolveSubject(rawSubject) ? EXAM_STRUCTURES[subject] : null;
  const questions = [];
  const topics = [];

  (data.parts || []).forEach((part, pIndex) => {
    const rawPart = String(part.part || pIndex + 1);
    const roman = rawPart.match(/[ivx]+/i);
    const partKey = roman ? roman[0].toUpperCase() : String(pIndex + 1);
    const partLabel = `Phần ${ROMAN[Number(partKey) - 1] || partKey}`;
    const type = part.type || inferPartType(part);
    const cfg = structure?.parts[partKey] || null;
    const points =
      cfg?.points ??
      (part.points != null ? part.points : fallbackPoints(type));

    const normalized = (part.questions || []).map((q, index) =>
      normalizeExamQuestion(q, partLabel, type, index, points, subject || partLabel)
    );
    topics.push({ topic: partLabel, questions: normalized });
    questions.push(...normalized.map((q) => ({ ...q })));
  });

  if (questions.length === 0) return null;

  const validation = validateExamQuiz({ subject, questions });
  return {
    fileName,
    mainTopic: subject || "Đề THPT 2026",
    quizType: "thpt2026",
    subject,
    topics: topics.length > 1 ? topics : null,
    questions,
    totalQuestions: questions.length,
    exam: {
      subject,
      group: validation.group,
      structure,
      validation
    }
  };
}

function inferPartType(part) {
  const first = (part.questions || [])[0];
  if (!first) return "multiple_choice";
  if (Array.isArray(first.items) && first.items.length > 0) return "true_false";
  if (Array.isArray(first.options) && first.options.length > 0) return "multiple_choice";
  return "short_answer";
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  return s === "true" || s === "1" || s === "d" || s === "đ" || s === "dung" || s === "đúng";
}

function normalizeExamQuestion(q, partLabel, type, index, points, topic) {
  const base = {
    id: q.id || `${partLabel.replace(/\s/g, "")}_${index + 1}`,
    question: q.question || q.text || q.content || "",
    topic: q.topic || topic,
    part: partLabel,
    type,
    points,
    explanation: q.explanation || q.solution || q.loiGiai || ""
  };

  if (type === "multiple_choice") {
    base.options = q.options || q.choices || [];
    base.answer = q.answer || q.correct || q.correctAnswer || "";
  } else if (type === "true_false") {
    const corrects = q.correctAnswers || q.answers || null;
    base.items = (q.items || []).map((item, i) => {
      if (typeof item === "string") {
        return {
          text: item,
          correct: Array.isArray(corrects) ? toBool(corrects[i]) : false
        };
      }
      return { text: item.text || "", correct: toBool(item.correct) };
    });
    base.answer = base.items.map((it) => (it.correct ? "Đ" : "S")).join("");
  } else {
    // short_answer: giữ nguyên dạng thô (số, có thể kèm dấu phẩy/chấm) để so khớp chuẩn hóa
    base.answer = q.answer != null ? String(q.answer) : "";
  }
  return base;
}
