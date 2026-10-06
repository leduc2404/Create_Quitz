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

  // Quyết định dạng bài từ root field "format", "examFormat", "type", "quizType"
  const rootFormat = (data && typeof data === "object")
    ? (data.format || data.examFormat || data.type || data.quizType || "")
    : "";

  let quizType = rootFormat || "multiple_choice";

  // Case 0: Đề thi Tốt nghiệp THPT 2026 (cấu trúc Phần I/II/III)
  if (data && typeof data === "object" && (rootFormat === "thpt2026" || (data.parts && Array.isArray(data.parts)))) {
    return parseThpt2026(data, fileName);
  }

  if (rootFormat === "essay") {
    quizType = "essay";
  } else if (rootFormat === "multiple_choice") {
    quizType = "multiple_choice";
  } else if (rootFormat === "short_answer") {
    quizType = "short_answer";
  } else if (rootFormat === "flashcard") {
    quizType = "flashcard";
  } else if (rootFormat === "mixed") {
    quizType = "mixed";
  } else if (rootFormat === "english") {
    quizType = "multiple_choice";
  }

  // Case 1: Array of items (topics with questions OR direct questions OR flashcards)
  if (Array.isArray(data)) {
    const firstItem = data[0];

    if (firstItem && (firstItem.front || firstItem.term || firstItem.word)) {
      quizType = "flashcard";
    } else if (firstItem && firstItem.questions && Array.isArray(firstItem.questions)) {
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
      } else if (item.question || item.front || item.term || item.word) {
        const itemType =
          item.type ||
          (item.options && item.options.length > 0 ? "multiple_choice" : "essay");
        questions.push(normalizeQuestion(item, item.topic || mainTopic, index, itemType));
      }
    });
  }
  // Case 2: Single object with questions or cards array
  else if (
    (data.questions && Array.isArray(data.questions)) ||
    (data.cards && Array.isArray(data.cards))
  ) {
    const rawList = data.questions || data.cards;
    mainTopic = data.topic || data.title || mainTopic;
    quizType = data.type || (data.cards ? "flashcard" : quizType);

    if (rawList[0] && !rawList[0].options && !data.type && !data.format) {
      quizType = rawList[0].front || rawList[0].term || rawList[0].word ? "flashcard" : "essay";
    }

    const normalized = normalizeQuestions(rawList, mainTopic, quizType);
    topics.push({ topic: mainTopic, questions: normalized });
    questions = normalized;
  }
  // Case 3: Object with nested structure
  else if (typeof data === "object" && data !== null) {
    for (const key in data) {
      if (Array.isArray(data[key])) {
        const items = data[key];
        if (items.length > 0 && (items[0].question || items[0].front || items[0].term)) {
          const itemType = items[0].options ? "multiple_choice" : "essay";
          const normalized = normalizeQuestions(items, key, itemType);
          topics.push({ topic: key, questions: normalized });
          questions.push(...normalized.map((q) => ({ ...q })));
        }
      }
    }
  }

  if (questions.length === 0) return null;

  // Tự động nhận diện quizType nếu có nhiều loại câu hỏi kết hợp (mixed format)
  const distinctTypes = new Set(questions.map((q) => q.type).filter(Boolean));
  if (rootFormat === "mixed" || distinctTypes.size > 1) {
    quizType = "mixed";
  } else if (distinctTypes.size === 1 && !rootFormat) {
    quizType = Array.from(distinctTypes)[0];
  }

  return {
    fileName,
    mainTopic,
    format: rootFormat || quizType,
    quizType,
    topics: topics.length > 1 ? topics : null,
    questions,
    totalQuestions: questions.length
  };
}

export function canonicalQuestionType(rawType) {
  if (!rawType) return "";
  const t = String(rawType).trim().toLowerCase().replace(/[\s\-_]+/g, "");
  if (t === "multiplechoice" || t === "mcq" || t === "choice" || t === "tracnghiem" || t === "tn") return "multiple_choice";
  if (t === "shortanswer" || t === "short" || t === "fill" || t === "dientu" || t === "traloingan" || t === "tln") return "short_answer";
  if (t === "essay" || t === "tuluan" || t === "tl" || t === "writing") return "essay";
  if (t === "truefalse" || t === "dungsai" || t === "tf" || t === "boolean") return "true_false";
  if (t === "flashcard" || t === "card") return "flashcard";
  return rawType;
}

export function normalizeQuestions(questions, topic, type = "multiple_choice") {
  return questions.map((q, index) => normalizeQuestion(q, topic, index, type));
}

export function normalizeQuestion(q, topic, index, type = "multiple_choice") {
  const isFlashcard = (q.front && q.back) || (q.term && q.definition) || (q.word && q.meaning);
  const questionText = q.question || q.text || q.content || q.front || q.term || q.word || "";
  const answerVal = q.answer || q.correct || q.correctAnswer || q.back || q.definition || q.meaning || "";

  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  let rawQType = q.type || q.format;
  let questionType = canonicalQuestionType(rawQType);

  if (!questionType) {
    if (Array.isArray(q.items) && q.items.length > 0) {
      questionType = "true_false";
    } else if (hasOptions) {
      questionType = "multiple_choice";
    } else if (isFlashcard) {
      questionType = "essay";
    } else if (q.acceptableAnswers || q.tolerance != null || /^-?\d+([.,]\d+)?$/.test(String(answerVal).trim())) {
      questionType = "short_answer";
    } else {
      questionType = type === "mixed"
        ? (hasOptions ? "multiple_choice" : "essay")
        : (canonicalQuestionType(type) || type);
    }
  }

  if (Array.isArray(q.items) && q.items.length > 0) {
    questionType = "true_false";
  }

  if (questionType === "mixed") {
    questionType = hasOptions
      ? "multiple_choice"
      : (Array.isArray(q.items) && q.items.length > 0)
      ? "true_false"
      : (q.acceptableAnswers || q.tolerance != null || /^-?\d+([.,]\d+)?$/.test(String(answerVal).trim()))
      ? "short_answer"
      : "essay";
  }

  // Tự động nhận diện chỉ số chỗ trống đục lỗ (blankIndex) nếu câu hỏi chưa khai báo
  let blankIndex = q.blankIndex != null ? Number(q.blankIndex) : null;
  if (blankIndex === null) {
    const blankMatch = questionText.match(/(?:chỗ\s+trống|vị\s+trí|blank|gap)\s*(?:số\s*)?\(?(\d+)\)?/i);
    if (blankMatch) {
      blankIndex = Number(blankMatch[1]);
    }
  }

  const res = {
    id: q.id || `Q${index + 1}`,
    question: questionText,
    options: q.options || q.choices || q.answers || [],
    answer: answerVal,
    topic: q.topic || topic,
    type: questionType,
    explanation: q.explanation || q.solution || q.loiGiai || q.explain || q.example || "",
    hint: q.hint || q.goiY || "",
    level: q.level || q.difficulty || q.bloom || "",
    passage: q.passage || q.readingText || q.context || "",
    passageTitle: q.passageTitle || q.readingTitle || "",
    blankIndex,
    acceptableAnswers: q.acceptableAnswers || q.alternatives || q.accepted || [],
    tolerance: Number(q.tolerance) || 0,
    points: q.points != null ? Number(q.points) : fallbackPoints(questionType)
  };

  if (q.items) {
    res.items = q.items;
  }
  return res;
}

/**
 * Trình phân tích văn bản thô đa năng (Universal Smart Raw Text Parser).
 * Tự động nhận diện câu hỏi từ văn bản Word, PDF, ChatGPT không cần định dạng JSON.
 * Hỗ trợ chuyên sâu bài đọc hiểu (Reading Comprehension) & bài tập đục lỗ (Cloze Test).
 */
export function parseRawTextQuiz(rawText = "", suggestedName = "Bộ đề từ văn bản") {
  if (!rawText || typeof rawText !== "string") return null;

  const text = rawText.replace(/\r\n/g, "\n").trim();
  if (text.length < 10) return null;

  const questions = [];

  let mainTopic = suggestedName;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (
    lines.length > 0 &&
    !/^(?:Câu|Question|Bài|\d+[\.\)])/i.test(lines[0]) &&
    lines[0].length < 100
  ) {
    mainTopic = lines[0].replace(/^[\#\*\-\s]+/, "").trim();
  }

  // 1. Nhận diện dạng Flashcard: "Term: ... \n Definition: ..."
  const termDefRegex =
    /(?:^|\n)(?:Term|Thuật ngữ|Từ vựng|Từ)\s*[\:\-]\s*([^\n]+)[\s\S]*?(?:Definition|Định nghĩa|Ý nghĩa|Nghĩa)\s*[\:\-]\s*([^\n]+(?:\n(?!(?:Term|Thuật ngữ|Từ)[\:\-]).*)*)/gi;
  let termMatch;
  while ((termMatch = termDefRegex.exec(text)) !== null) {
    const term = termMatch[1].trim();
    const def = termMatch[2].trim();
    if (term && def) {
      questions.push({
        id: `FC_${questions.length + 1}`,
        question: term,
        answer: def,
        topic: mainTopic,
        type: "essay",
        explanation: ""
      });
    }
  }

  if (questions.length > 0) {
    return {
      fileName: suggestedName,
      mainTopic,
      quizType: "flashcard",
      questions,
      totalQuestions: questions.length,
      topics: null
    };
  }

  // 2. Kiểm tra xem có đoạn văn bản đọc hiểu / đục lỗ mở đầu (Preamble / Shared Passage) không
  let currentSharedPassage = "";
  const firstQIdx = text.search(/(?:^|\n)(?:(?:Câu|Question|Bài|Item)\s*\d+[\.\:\-\)]|\b\d+[\.\:\-\)])/i);
  if (firstQIdx > 20) {
    const preamble = text.slice(0, firstQIdx).trim();
    // Bỏ qua dòng tiêu đề ngắn nếu có
    const pLines = preamble.split("\n").map((l) => l.trim()).filter(Boolean);
    if (pLines.length > 1 || preamble.length > 80) {
      // Nếu dòng đầu là tên đề thi/chủ đề thì lấy các dòng sau làm bài đọc
      if (pLines[0].length < 80 && !/^(?:Read|Questions|Đọc)/i.test(pLines[0])) {
        currentSharedPassage = pLines.slice(1).join("\n\n").trim();
      } else {
        currentSharedPassage = preamble;
      }
    }
  }

  // 3. Nhận diện câu hỏi có đánh số: "Câu 1.", "Câu 1:", "Question 1:", "1.", "1)"
  const blockRegex =
    /(?:^|\n)(?:(?:Câu|Question|Bài|Item)\s*(\d+)[\.\:\-\)]|\b(\d+)[\.\:\-\)])\s*([\s\S]*?)(?=(?:\n(?:(?:Câu|Question|Bài|Item)\s*\d+[\.\:\-\)]|\d+[\.\:\-\)]))|$)/gi;
  let blockMatch;
  let autoId = 1;

  while ((blockMatch = blockRegex.exec(text)) !== null) {
    const qNumStr = blockMatch[1] || blockMatch[2] || String(autoId++);
    const qNum = parseInt(qNumStr, 10);
    const body = (blockMatch[3] || "").trim();
    if (!body) continue;

    let questionAndOpts = body;
    let explanation = "";
    const expMatch = body.match(
      /(?:^|\n)(?:Giải thích|Lời giải|Explanation|HD|Gợi ý)\s*[\:\-\=]\s*([\s\S]*)$/i
    );
    if (expMatch) {
      explanation = expMatch[1].trim();
      questionAndOpts = body.slice(0, expMatch.index).trim();
    }

    let correctAnswer = "";
    const ansMatch = questionAndOpts.match(
      /(?:^|\n)(?:Đáp án|Đ\/a|Answer|Key|Đúng)\s*[\:\-\=]?\s*([^\n]+)/i
    );
    if (ansMatch) {
      correctAnswer = ansMatch[1].trim();
      questionAndOpts = questionAndOpts.slice(0, ansMatch.index).trim();
    }

    const options = [];
    const optRegex = /(?:^|\n)\s*([A-Da-d])[\.\)\:\-\]]\s*([^\n]+)/g;
    let optMatch;
    let firstOptIndex = -1;

    while ((optMatch = optRegex.exec(questionAndOpts)) !== null) {
      if (firstOptIndex === -1) firstOptIndex = optMatch.index;
      options.push(`${optMatch[1].toUpperCase()}. ${optMatch[2].trim()}`);
    }

    const promptText =
      firstOptIndex !== -1 ? questionAndOpts.slice(0, firstOptIndex).trim() : questionAndOpts;

    // Kiểm tra xem câu hỏi có đoạn trích riêng không
    let passage = "";
    const passageMatch = promptText.match(
      /(?:^|\n)(?:Đoạn trích|Văn bản|Passage|Context)\s*[\:\-]\s*([\s\S]*?)(?=\n[A-Z0-9]|\nCâu hỏi|$)/i
    );
    if (passageMatch) {
      passage = passageMatch[1].trim();
    } else if (currentSharedPassage) {
      passage = currentSharedPassage;
    }

    // Nhận diện vị trí đục lỗ (blankIndex) nếu bài có dạng Cloze
    let blankIndex = null;
    if (passage && (passage.includes(`(${qNum})`) || passage.includes(`[${qNum}]`))) {
      blankIndex = qNum;
    }

    const hasOptions = options.length >= 2;
    let type = hasOptions ? "multiple_choice" : "essay";
    if (!hasOptions && correctAnswer && /^-?\d+([.,]\d+)?$/.test(correctAnswer.trim())) {
      type = "short_answer";
    }

    if (hasOptions && correctAnswer) {
      const cleanKey = correctAnswer
        .replace(/^([A-Da-d])[\.\)\:\-\s].*$/s, "$1")
        .trim()
        .toUpperCase();
      if (/^[A-D]$/.test(cleanKey)) {
        const found = options.find((opt) => opt.startsWith(`${cleanKey}.`));
        if (found) correctAnswer = found;
      }
    }

    questions.push({
      id: `Q${qNum}`,
      question: promptText,
      options,
      answer: correctAnswer || (hasOptions ? options[0] : ""),
      topic: mainTopic,
      type,
      explanation,
      passage,
      blankIndex
    });
  }

  if (questions.length === 0) return null;

  const distinctTypes = new Set(questions.map((q) => q.type).filter(Boolean));
  const finalQuizType = distinctTypes.size > 1 ? "mixed" : (Array.from(distinctTypes)[0] || "multiple_choice");

  return {
    fileName: suggestedName,
    mainTopic,
    format: finalQuizType,
    quizType: finalQuizType,
    questions,
    totalQuestions: questions.length,
    topics: null
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
