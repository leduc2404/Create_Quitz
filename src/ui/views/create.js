// Tab Create — Studio tạo đề: Live Parser Preview, dán/file JSON hoặc văn bản thuần (Word/PDF), AI Prompt Library.
import { parseQuizData, parseRawTextQuiz } from "../../core/quiz-parser.js";
import { addQuiz } from "../../core/store.js";
import { genId } from "../../core/storage/local.js";
import { SAMPLE_DECKS } from "../../core/sample-decks.js";
import { iconSvg } from "../icons.js";
import { showTab } from "../router.js";
import { toast, toastError, toastSuccess } from "../toast.js";

export const ICON_OPTIONS = [
  "BookOpen", "Brain", "FlaskConical", "Languages", "Calculator", "History",
  "Music", "Code", "HeartPulse", "Globe", "GraduationCap", "PenLine", "Layers"
];

// Trạng thái modal tạo bộ đề
let pendingParsed = null; // parsed quiz đang chờ lưu
let pickedIcon = "BookOpen";
let timerMode = "question";
let mins = 0;
let secs = 30;
let previewDebounce = null;

export function initCreateView() {
  const textarea = document.getElementById("jsonTextarea");

  document.getElementById("importPasteBtn")?.addEventListener("click", () => {
    const text = textarea ? textarea.value.trim() : "";
    if (!text) {
      toastError("Vui lòng dán nội dung JSON hoặc văn bản câu hỏi vào ô nhập liệu!");
      return;
    }
    tryParseTextAndOpen(text, nextName());
  });

  // Live Parser Preview khi gõ hoặc dán vào textarea
  if (textarea) {
    textarea.addEventListener("input", () => {
      clearTimeout(previewDebounce);
      previewDebounce = setTimeout(() => updateLiveParsePreview(textarea.value), 180);
    });
  }

  // Nút chèn JSON mẫu nhanh
  document.getElementById("loadSampleJsonBtn")?.addEventListener("click", () => {
    if (!textarea) return;
    const sample = SAMPLE_DECKS[0]?.payload || {
      type: "mixed",
      topic: "Bộ đề mẫu Quitz Studio",
      questions: [
        {
          type: "multiple_choice",
          topic: "Kiến thức nền tảng",
          question: "Thủ đô của Việt Nam là thành phố nào?",
          options: ["A. Hà Nội", "B. Đà Nẵng", "C. TP. Hồ Chí Minh", "D. Huế"],
          answer: "A. Hà Nội",
          explanation: "Hà Nội là thủ đô của nước Cộng hòa Xã hội chủ nghĩa Việt Nam."
        }
      ]
    };
    textarea.value = JSON.stringify(sample, null, 2);
    updateLiveParsePreview(textarea.value);
    toast("Đã chèn cấu trúc JSON mẫu. Nhấn 'Phân tích & Tạo bộ đề' để thử ngay!", { duration: 2200 });
  });

  // Nút xóa nhanh ô nhập
  document.getElementById("clearJsonBtn")?.addEventListener("click", () => {
    if (!textarea) return;
    textarea.value = "";
    updateLiveParsePreview("");
    textarea.focus();
  });

  setupFileInput();
  setupAiModal();
  setupAiGeneratorModal();
  setupCreateModal();
  setupGlobalPaste();
}

function updateLiveParsePreview(rawText) {
  const badge = document.getElementById("liveParseStatus");
  if (!badge) return;

  const text = (rawText || "").trim();
  if (!text) {
    badge.className = "live-parse-bar";
    badge.innerHTML = `<span class="lp-dot"></span><span class="lp-text">Mẹo: Nhấn <kbd>Ctrl + V</kbd> ở bất kỳ đâu để dán &amp; nhận diện tự động.</span>`;
    return;
  }

  let parsed = null;
  try {
    const data = JSON.parse(text);
    parsed = parseQuizData(data, "Preview");
  } catch {
    parsed = parseRawTextQuiz(text, "Preview");
  }

  if (!parsed && !text.startsWith("{") && !text.startsWith("[")) {
    parsed = parseRawTextQuiz(text, "Preview");
  }

  if (parsed && parsed.questions && parsed.questions.length > 0) {
    const topicCount = parsed.topics ? Object.keys(parsed.topics).length : 1;
    badge.className = "live-parse-bar is-valid";
    badge.innerHTML = `<span class="lp-dot"></span><span class="lp-text">✓ Đã nhận diện <strong>${parsed.questions.length} câu hỏi</strong> (${topicCount} chủ đề) — Sẵn sàng tạo đề!</span>`;
  } else {
    badge.className = "live-parse-bar is-warn";
    badge.innerHTML = `<span class="lp-dot"></span><span class="lp-text">Chưa nhận diện được cấu trúc câu hỏi hợp lệ. Kiểm tra lại JSON hoặc văn bản.</span>`;
  }
}

/** Import trực tiếp (không qua modal) — dùng cho link chia sẻ */
export function importJSON(data, fileName, extra = {}) {
  const parsed = parseQuizData(data, fileName);
  if (!parsed) {
    toastError(`Không tìm thấy câu hỏi trong "${fileName}". Kiểm tra lại định dạng JSON.`);
    return null;
  }
  return addQuiz({
    ...parsed,
    id: genId(),
    createdAt: Date.now(),
    settings: extra.settings || { icon: extra.icon || defaultIconFor(parsed), timer: { enabled: false } }
  });
}

// ---------- Paste / file → mở modal ----------
function nextName() {
  return "Bộ đề mới";
}

function tryParseTextAndOpen(rawText, suggestedName) {
  if (!rawText || !rawText.trim()) {
    toastError("Vui lòng dán nội dung vào ô nhập liệu!");
    return;
  }

  const text = rawText.trim();
  let parsed = null;

  // Thử parse JSON trước
  try {
    const data = JSON.parse(text);
    parsed = parseQuizData(data, suggestedName);
  } catch {
    // Nếu không phải JSON hợp lệ -> kích hoạt Universal Smart Raw Text Parser
    parsed = parseRawTextQuiz(text, suggestedName);
  }

  if (!parsed && !text.startsWith("{") && !text.startsWith("[")) {
    parsed = parseRawTextQuiz(text, suggestedName);
  }

  if (!parsed) {
    toastError("Không tìm thấy câu hỏi. Hãy kiểm tra lại định dạng JSON hoặc văn bản trắc nghiệm.");
    return;
  }

  toastSuccess(`Đã nhận diện thành công ${parsed.questions.length} câu hỏi!`);
  openCreateModal(parsed);
}

function setupFileInput() {
  const uploadCard = document.getElementById("uploadCard");
  const fileInput = document.getElementById("fileInput");
  if (!uploadCard || !fileInput) return;

  uploadCard.addEventListener("click", () => fileInput.click());
  uploadCard.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadCard.classList.add("dragover");
  });
  uploadCard.addEventListener("dragleave", () => uploadCard.classList.remove("dragover"));
  uploadCard.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadCard.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  });
}

async function handleFiles(files) {
  for (const file of files) {
    try {
      const text = await file.text();
      const baseName = file.name.replace(/\.(json|txt|md)$/i, "");
      let parsed = null;

      try {
        const data = JSON.parse(text);
        parsed = parseQuizData(data, baseName);
      } catch {
        parsed = parseRawTextQuiz(text, baseName);
      }

      if (!parsed) {
        toastError(`Không tìm thấy câu hỏi trong ${file.name}.`);
        continue;
      }
      toastSuccess(`Đã nhận diện ${parsed.questions.length} câu hỏi từ "${file.name}".`);
      openCreateModal(parsed);
    } catch (error) {
      toastError(`Lỗi đọc file ${file.name}: ${error.message}`);
    }
  }
}

// Ctrl+V ở bất kỳ đâu → mở modal tạo bộ đề
function setupGlobalPaste() {
  document.addEventListener("paste", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input") return;
    if (document.getElementById("createScreen")?.hidden) return;

    const pastedText = e.clipboardData.getData("text");
    if (!pastedText || !pastedText.trim()) return;
    tryParseTextAndOpen(pastedText, nextName());
  });
}

// ---------- Modal "Bộ đề mới" ----------
function defaultIconFor(parsed) {
  if (parsed.quizType === "thpt2026") return "GraduationCap";
  if (parsed.quizType === "mixed") return "Layers";
  if (parsed.quizType === "short_answer") return "Brain";
  if (parsed.quizType === "flashcard") return "Brain";
  return parsed.quizType === "essay" ? "PenLine" : "ListChecks";
}

function openCreateModal(parsed) {
  pendingParsed = parsed;

  const nameInput = document.getElementById("quizNameInput");
  const suggested = parsed.mainTopic && parsed.mainTopic !== parsed.fileName
    ? parsed.mainTopic
    : parsed.fileName;
  if (nameInput) nameInput.value = suggested.replace(/\.json$/i, "");

  // Badge nhận diện đề thi THPT 2026 hoặc bộ đề hỗn hợp đa dạng
  const badge = document.getElementById("examBadge");
  if (badge) {
    if (parsed.exam) {
      const v = parsed.exam.validation;
      badge.hidden = false;
      badge.textContent =
        v.status === "complete"
          ? `${parsed.exam.subject || "Đề 2026"} · Đề chuẩn 2026 · Hoàn chỉnh`
          : `${parsed.exam.subject || "Đề 2026"} · Trích đoạn · Chưa đủ cấu trúc chuẩn`;
    } else if (parsed.quizType === "mixed") {
      badge.hidden = false;
      const typesPresent = [...new Set(parsed.questions.map((q) => q.type))].map((t) => {
        if (t === "multiple_choice") return "Trắc nghiệm";
        if (t === "true_false") return "Đúng/Sai";
        if (t === "short_answer") return "Trả lời ngắn";
        if (t === "essay") return "Tự luận";
        return t;
      }).join(" + ");
      badge.textContent = `Bộ đề tích hợp đa năng · ${parsed.questions.length} câu (${typesPresent})`;
    } else {
      badge.hidden = true;
    }
  }

  pickedIcon = defaultIconFor(parsed);
  renderIconGrid();

  // Reset timer về mặc định: tắt, 0:30 mỗi câu
  const timerToggle = document.getElementById("timerToggle");
  const timerBody = document.getElementById("timerBody");
  if (timerToggle) timerToggle.checked = false;
  if (timerBody) timerBody.hidden = true;
  timerMode = "question";
  mins = 0;
  secs = 30;
  syncTimerUi();

  document.getElementById("createModal")?.classList.add("open");
  setTimeout(() => {
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  }, 80);
}

function closeCreateModal() {
  pendingParsed = null;
  document.getElementById("createModal")?.classList.remove("open");
}

function renderIconGrid() {
  const grid = document.getElementById("iconGrid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const name of ICON_OPTIONS) {
    const btn = document.createElement("button");
    btn.className = "icon-opt" + (name === pickedIcon ? " active" : "");
    btn.innerHTML = iconSvg(name, 20);
    btn.setAttribute("aria-label", name);
    btn.addEventListener("click", () => {
      pickedIcon = name;
      grid.querySelectorAll(".icon-opt").forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
    });
    grid.appendChild(btn);
  }
}

function setupCreateModal() {
  const modal = document.getElementById("createModal");
  document.getElementById("createClose")?.addEventListener("click", closeCreateModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeCreateModal();
  });

  // Timer toggle
  document.getElementById("timerToggle")?.addEventListener("change", (e) => {
    const body = document.getElementById("timerBody");
    if (body) body.hidden = !e.target.checked;
  });

  // Segmented: mỗi câu / toàn bài
  document.querySelectorAll("#timerModeSeg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      timerMode = btn.dataset.mode;
      document.querySelectorAll("#timerModeSeg .seg-btn").forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
    });
  });

  // Picker phút / giây
  document.getElementById("minPlus")?.addEventListener("click", () => {
    mins = Math.min(mins + 1, 99);
    syncTimerUi();
  });
  document.getElementById("minMinus")?.addEventListener("click", () => {
    mins = Math.max(mins - 1, 0);
    syncTimerUi();
  });
  document.getElementById("secPlus")?.addEventListener("click", () => {
    secs = secs + 5 >= 60 ? 0 : secs + 5;
    syncTimerUi();
  });
  document.getElementById("secMinus")?.addEventListener("click", () => {
    secs = secs - 5 < 0 ? 55 : secs - 5;
    syncTimerUi();
  });

  document.getElementById("createSaveBtn")?.addEventListener("click", saveQuiz);
}

function syncTimerUi() {
  const minEl = document.getElementById("minValue");
  const secEl = document.getElementById("secValue");
  if (minEl) minEl.textContent = mins;
  if (secEl) secEl.textContent = String(secs).padStart(2, "0");
}

function saveQuiz() {
  if (!pendingParsed) return;

  const nameInput = document.getElementById("quizNameInput");
  const name = nameInput ? nameInput.value.trim() : "";
  if (!name) {
    toastError("Hãy đặt tên cho bộ đề của bạn.");
    nameInput?.focus();
    return;
  }

  const timerOn = document.getElementById("timerToggle")?.checked || false;
  const seconds = mins * 60 + secs;
  if (timerOn && seconds === 0) {
    toastError("Chọn thời gian cho timer (phút hoặc giây).");
    return;
  }

  const quiz = addQuiz({
    ...pendingParsed,
    fileName: name,
    id: genId(),
    createdAt: Date.now(),
    settings: {
      icon: pickedIcon,
      timer: { enabled: timerOn, mode: timerMode, seconds }
    }
  });

  const textarea = document.getElementById("jsonTextarea");
  if (textarea) {
    textarea.value = "";
    updateLiveParsePreview("");
  }
  closeCreateModal();
  toastSuccess(`Đã tạo "${quiz.fileName}" (${quiz.totalQuestions} câu).`);
  showTab("libraryScreen");
}

// ---------- Modal AI prompt ----------
function setupAiModal() {
  const modal = document.getElementById("aiModal");
  document.getElementById("openAiBtn")?.addEventListener("click", () => {
    modal?.classList.add("open");
  });
  document.getElementById("aiClose")?.addEventListener("click", () => {
    modal?.classList.remove("open");
  });
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });

  const PROMPT_MAP = {
    master: { contentId: "promptMaster", boxId: "promptBoxMaster", btnTextId: "copyBtnTextMaster" },
    thpt2026: { contentId: "promptThpt2026", boxId: "promptBoxThpt", btnTextId: "copyBtnTextTHPT" },
    tn_ngan: { contentId: "promptTnNgan", boxId: "promptBoxTnNgan", btnTextId: "copyBtnTextTnNgan" },
    tn_ngan_tuluan: { contentId: "promptTnNganTuLuan", boxId: "promptBoxTnNganTuLuan", btnTextId: "copyBtnTextTnNganTuLuan" },
    tienganh: { contentId: "promptTiengAnh", boxId: "promptBoxTiengAnh", btnTextId: "copyBtnTextTiengAnh" },
    tracnghiem: { contentId: "promptTracNghiem", boxId: "promptBox", btnTextId: "copyBtnTextTN" },
    flashcard: { contentId: "promptFlashcard", boxId: "promptBoxFlashcard", btnTextId: "copyBtnTextFC" }
  };

  document.querySelectorAll("#promptSeg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.prompt;
      document.querySelectorAll("#promptSeg .seg-btn").forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
      Object.entries(PROMPT_MAP).forEach(([key, cfg]) => {
        const el = document.getElementById(cfg.contentId);
        if (el) el.classList.toggle("active", key === type);
      });
    });
  });

  document.getElementById("copyBtnMaster")?.addEventListener("click", () => copyPrompt("master", PROMPT_MAP));
  document.getElementById("copyBtnTHPT")?.addEventListener("click", () => copyPrompt("thpt2026", PROMPT_MAP));
  document.getElementById("copyBtnTnNgan")?.addEventListener("click", () => copyPrompt("tn_ngan", PROMPT_MAP));
  document.getElementById("copyBtnTnNganTuLuan")?.addEventListener("click", () => copyPrompt("tn_ngan_tuluan", PROMPT_MAP));
  document.getElementById("copyBtnTiengAnh")?.addEventListener("click", () => copyPrompt("tienganh", PROMPT_MAP));
  document.getElementById("copyBtnTN")?.addEventListener("click", () => copyPrompt("tracnghiem", PROMPT_MAP));
  document.getElementById("copyBtnFC")?.addEventListener("click", () => copyPrompt("flashcard", PROMPT_MAP));
}

function copyPrompt(type, map) {
  const cfg = map[type];
  if (!cfg) return;
  const box = document.getElementById(cfg.boxId);
  const btnText = document.getElementById(cfg.btnTextId);
  if (!box) return;

  const promptText = box.textContent;
  navigator.clipboard
    .writeText(promptText)
    .then(() => {
      if (btnText) {
        const original = btnText.textContent;
        btnText.textContent = "Đã copy!";
        setTimeout(() => (btnText.textContent = original), 2000);
      }
      toastSuccess("Đã sao chép prompt AI vào Clipboard.");
    })
    .catch(() => toastError("Không thể copy tự động. Hãy bôi đen và copy thủ công."));
}

// ---------- Modal AI Studio Generator (Tạo đề trực tiếp / Smart Prompt) ----------
function setupAiGeneratorModal() {
  const modal = document.getElementById("aiGeneratorModal");
  if (!modal) return;

  const openBtn = document.getElementById("openAiGeneratorBtn");
  const closeBtn = document.getElementById("aiGeneratorClose");
  const keyInput = document.getElementById("aiApiKeyInput");
  const topicInput = document.getElementById("aiTopicInput");
  const submitBtn = document.getElementById("aiGenerateSubmitBtn");
  const statusEl = document.getElementById("aiGeneratorStatus");
  const statusText = document.getElementById("aiStatusText");
  const errorEl = document.getElementById("aiGeneratorError");

  let aiCount = 10;
  let aiType = "mixed";
  let aiDiff = "medium";

  try {
    const savedKey = localStorage.getItem("quitz_gemini_api_key");
    if (savedKey && keyInput) keyInput.value = savedKey;
  } catch {}

  openBtn?.addEventListener("click", () => {
    if (errorEl) errorEl.hidden = true;
    modal.classList.add("open");
    setTimeout(() => topicInput?.focus(), 80);
  });

  closeBtn?.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });

  const bindSeg = (id, setter) => {
    document.querySelectorAll(`#${id} .seg-btn`).forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(`#${id} .seg-btn`).forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        setter(btn);
      });
    });
  };

  bindSeg("aiCountSeg", (btn) => {
    aiCount = Number(btn.dataset.count) || 10;
  });
  bindSeg("aiTypeSeg", (btn) => {
    aiType = btn.dataset.type || "mixed";
  });
  bindSeg("aiDifficultySeg", (btn) => {
    aiDiff = btn.dataset.diff || "medium";
  });

  submitBtn?.addEventListener("click", async () => {
    const topic = (topicInput?.value || "").trim();
    if (!topic) {
      if (errorEl) {
        errorEl.textContent = "Vui lòng nhập chủ đề hoặc dán nội dung bài học.";
        errorEl.hidden = false;
      }
      topicInput?.focus();
      return;
    }

    if (errorEl) errorEl.hidden = true;
    const apiKey = (keyInput?.value || "").trim();

    if (apiKey) {
      try {
        localStorage.setItem("quitz_gemini_api_key", apiKey);
      } catch {}

      submitBtn.disabled = true;
      if (statusEl) statusEl.hidden = false;
      if (statusText) statusText.textContent = `AI đang biên soạn ${aiCount} câu hỏi về "${topic.slice(0, 32)}..."`;

      try {
        const prompt = buildCustomAiPrompt(topic, aiCount, aiType, aiDiff);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.4, responseMimeType: "application/json" }
            })
          }
        );
        if (!res.ok) {
          throw new Error(`API trả về mã lỗi ${res.status}`);
        }
        const json = await res.json();
        const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const data = JSON.parse(cleaned);
        const parsed = parseQuizData(data, topic.slice(0, 40));
        if (!parsed) throw new Error("Dữ liệu AI trả về không đúng cấu trúc câu hỏi.");

        modal.classList.remove("open");
        toastSuccess(`AI đã tạo thành công ${parsed.questions.length} câu hỏi!`);
        openCreateModal(parsed);
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = `Lỗi gọi Gemini API: ${err.message}. Đã tự động copy Prompt thông minh vào Clipboard để bạn dán sang ChatGPT/Gemini!`;
          errorEl.hidden = false;
        }
        const fallbackPrompt = buildCustomAiPrompt(topic, aiCount, aiType, aiDiff);
        navigator.clipboard?.writeText(fallbackPrompt).catch(() => {});
      } finally {
        submitBtn.disabled = false;
        if (statusEl) statusEl.hidden = true;
      }
    } else {
      // Chế độ không cần API Key: Tạo Prompt thông minh cá nhân hóa theo đúng chủ đề, số câu, độ khó & copy vào clipboard
      const customPrompt = buildCustomAiPrompt(topic, aiCount, aiType, aiDiff);
      navigator.clipboard
        ?.writeText(customPrompt)
        .then(() => {
          modal.classList.remove("open");
          toastSuccess(
            `Đã tạo & copy Prompt AI (${aiCount} câu) cho chủ đề của bạn! Hãy dán vào ChatGPT/Gemini rồi copy JSON trả về vào ô nhập.`,
            { duration: 3800 }
          );
        })
        .catch(() => {
          if (errorEl) {
            errorEl.textContent = "Hãy nhập Gemini API Key hoặc mở Thư viện Prompt để copy thủ công.";
            errorEl.hidden = false;
          }
        });
    }
  });
}

function buildCustomAiPrompt(topic, count, type, diff) {
  const diffLabel =
    diff === "easy"
      ? "Cơ bản & Nhận biết - Thông hiểu"
      : diff === "hard"
      ? "Vận dụng & Vận dụng cao (Phân loại sâu)"
      : "Cân bằng từ Thông hiểu đến Vận dụng";

  const typeInstruction =
    type === "multiple_choice"
      ? "Tất cả câu hỏi đều thuộc dạng Trắc nghiệm 4 lựa chọn (type: 'multiple_choice')."
      : type === "thpt2026"
      ? "Kết hợp chuẩn cấu trúc THPT 2026 gồm Trắc nghiệm 4 lựa chọn (multiple_choice), Đúng/Sai 4 mệnh đề (true_false) và Trả lời ngắn (short_answer)."
      : type === "reading"
      ? "Tạo bài đọc hiểu chuyên sâu có trường 'passage' và 'passageTitle' kèm các câu hỏi đọc hiểu (multiple_choice)."
      : "Kết hợp đa dạng Trắc nghiệm (multiple_choice), Đúng/Sai (true_false), Trả lời ngắn (short_answer) và Tự luận (essay).";

  return `Bạn là chuyên gia biên soạn đề khảo thí học thuật. Hãy tạo bộ đề gồm đúng ${count} câu hỏi dựa trên chủ đề/tài liệu sau:
"""
${topic}
"""
- Mức độ khó: ${diffLabel}.
- Yêu cầu dạng câu hỏi: ${typeInstruction}
- BẮT BUỘC trả về DUY NHẤT 1 khối JSON hợp lệ (không giải thích ngoài JSON) theo cấu trúc:
{
  "type": "mixed",
  "topic": "Tên bộ đề ngắn gọn",
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "topic": "Chủ đề con",
      "level": "thong_hieu",
      "question": "Nội dung câu hỏi...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A. ...",
      "hint": "Gợi ý ngắn...",
      "explanation": "Lời giải chi tiết..."
    }
  ]
}`;
}

