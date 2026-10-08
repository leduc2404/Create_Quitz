// Tiện ích render an toàn (chống XSS vì nội dung đến từ JSON người dùng upload).

export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Format markdown/rich text an toàn (sau khi escapeHtml)
 * Hỗ trợ: **in đậm**, *in nghiêng*, `code`, x^2 (số mũ), ngắt đoạn \n\n, danh sách - ...
 */
export function formatRichText(rawText = "") {
  if (!rawText) return "";
  const safe = escapeHtml(String(rawText).replace(/\\n/g, "\n"));

  // Chia theo đoạn văn đôi \n\n
  const paragraphs = safe.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const formattedBlocks = paragraphs.map((para) => {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);

    // Xử lý bảng Markdown nếu các dòng đều chứa ký tự |
    const isTable = lines.length >= 2 && lines.every((l) => l.includes("|"));
    if (isTable) {
      const dataRows = lines.filter((l) => !/^\|?[\s\-:]+(\|[\s\-:]+)+\|?$/.test(l));
      const hasHeaderSep = lines.some((l) => /^\|?[\s\-:]+(\|[\s\-:]+)+\|?$/.test(l));
      const htmlRows = dataRows.map((r, rIdx) => {
        const cells = r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        const isHeader = rIdx === 0 && hasHeaderSep;
        const tag = isHeader ? "th" : "td";
        const rowCells = cells.map((c) => `<${tag}>${formatInline(c)}</${tag}>`).join("");
        return `<tr>${rowCells}</tr>`;
      }).join("");
      return `<div class="q-table-wrap"><table class="q-table"><tbody>${htmlRows}</tbody></table></div>`;
    }

    // Xử lý email header (To: ... / From: ... / Re: ...)
    const isEmailHeader = lines.length >= 2 && lines.some(l => /^(?:To|From|Re|Subject|Date)\s*:/i.test(l));
    if (isEmailHeader) {
      const headerLines = lines.map(l => {
        const colonIdx = l.indexOf(":");
        if (colonIdx > 0 && /^(?:To|From|Re|Subject|Date)$/i.test(l.slice(0, colonIdx).trim())) {
          const key = l.slice(0, colonIdx).trim();
          const val = l.slice(colonIdx + 1).trim();
          return `<div class="passage-email-field"><span class="email-key">${escapeHtml(key)}:</span> <span class="email-val">${formatInline(val)}</span></div>`;
        }
        return `<div>${formatInline(l)}</div>`;
      }).join("");
      return `<div class="passage-email-card">${headerLines}</div>`;
    }

    // Xử lý danh sách gạch đầu dòng nếu có nhiều dòng bắt đầu bằng - hoặc +
    const isList = lines.length > 1 && lines.every((l) => l.startsWith("- ") || l.startsWith("+ ") || l.startsWith("• "));
    if (isList) {
      const items = lines.map((l) => {
        const content = formatInline(l.replace(/^[-+•]\s*/, ""));
        return `<li>${content}</li>`;
      }).join("");
      return `<ul class="q-list">${items}</ul>`;
    }

    // Xử lý trích dẫn blockquote nếu bắt đầu bằng >
    if (para.startsWith("&gt; ") || para.startsWith("> ")) {
      const quoteText = formatInline(para.replace(/^(&gt;|>)\s*/, ""));
      return `<blockquote class="q-quote">${quoteText}</blockquote>`;
    }

    // Đoạn văn thông thường (giữ \n thành <br/>)
    const linesInPara = lines.map((l) => formatInline(l)).join("<br/>");
    return `<p class="q-p">${linesInPara}</p>`;
  });

  return formattedBlocks.join("");
}

/** Format inline: **bold**, *italic*, `code`, x^2, x_2 */
function formatInline(str = "") {
  return str
    // **in đậm**
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // *in nghiêng*
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>")
    // `code / công thức`
    .replace(/`([^`]+?)`/g, "<code class='inline-code'>$1</code>")
    // Số mũ x^2, 10^-3, a^{n+1}
    .replace(/([a-zA-Z0-9\)])\^\{([^}]+)\}/g, "$1<sup>$2</sup>")
    .replace(/([a-zA-Z0-9\)])\^([a-zA-Z0-9\-+]+)/g, "$1<sup>$2</sup>")
    // Chỉ số dưới x_1, H_2O, a_{n}
    .replace(/([a-zA-Z0-9\)])_\{([^}]+)\}/g, "$1<sub>$2</sub>")
    .replace(/([a-zA-Z0-9\)])_([a-zA-Z0-9\-+]+)/g, "$1<sub>$2</sub>");
}

/**
 * Bóc tách tiền tố lựa chọn đáp án:
 * VD: "A. Hà Nội" -> { key: "A", text: "Hà Nội", raw: "A. Hà Nội" }
 *     "B) Đà Nẵng" -> { key: "B", text: "Đà Nẵng", raw: "B) Đà Nẵng" }
 *     "[C] Huế" -> { key: "C", text: "Huế", raw: "[C] Huế" }
 *     "TP. Hồ Chí Minh" -> { key: "", text: "TP. Hồ Chí Minh", raw: "..." }
 */
export function cleanOptionPrefix(str = "") {
  const raw = String(str).trim();
  // Regex bắt tiền tố: A., B., C., D. hoặc a), B), [A], 1., 2.
  const match = raw.match(/^(\[?([A-Da-d0-9])[\.\)\:\-\]]|\(([A-Da-d0-9])\))\s*(.+)$/s);
  if (match) {
    const key = (match[2] || match[3] || "").toUpperCase();
    const text = (match[4] || "").trim();
    return { key, text, raw };
  }
  return { key: "", text: raw, raw };
}

/**
 * Phân tích câu hỏi dài: Tách Đoạn dẫn/Đoạn trích (Passage) và Câu hỏi trọng tâm (Stem).
 * Nhận diện câu dài (> 140 ký tự hoặc có chỉ dẫn đọc hiểu tiếng Anh/tiếng Việt).
 */
export function splitPassageAndPrompt(fullQuestion = "") {
  const text = String(fullQuestion || "").trim();
  if (!text) return { hasPassage: false, passage: "", prompt: "" };

  // Nhận diện chỉ dẫn đề thi Tiếng Anh / tiếng Việt: "Read the following passage...", "Questions 1-5 refer to..."
  const englishIntroMatch = text.match(
    /^(?:(?:Read\s+(?:the\s+following\s+)?passage|Questions?\s+\d+[\s\-\–\to\d]*\s+refer\s+to|Đọc\s+(?:đoạn\s+văn|văn\s+bản)\s+sau)[^\n]*\:\s*)/i
  );
  let cleanText = text;
  let instruction = "";
  if (englishIntroMatch) {
    instruction = englishIntroMatch[0].trim();
    cleanText = text.slice(englishIntroMatch[0].length).trim();
  }

  // Tách theo \n\n (nếu có ít nhất 2 đoạn văn và đoạn đầu làm ngữ cảnh)
  const parts = cleanText.split(/\n{2,}/);
  if (parts.length > 1) {
    const prompt = parts[parts.length - 1].trim();
    const passageContent = parts.slice(0, -1).join("\n\n").trim();
    const isEmail = /^(?:To|From|Re|Subject)\s*:/im.test(passageContent);
    if (passageContent.length > 90 || instruction || isEmail) {
      const passage = instruction ? `${instruction}\n\n${passageContent}` : passageContent;
      return { hasPassage: true, passage, prompt: prompt || "Dựa vào đoạn trích trên, hãy trả lời câu hỏi sau:" };
    }
  }

  if (instruction && cleanText.length > 60) {
    return { hasPassage: true, passage: `${instruction}\n\n${cleanText}`, prompt: "Dựa vào đoạn trích trên, hãy trả lời câu hỏi sau:" };
  }

  // Mặc định: giữ nguyên câu hỏi đầy đủ, không ép buộc tách thành bài đọc
  return { hasPassage: false, passage: "", prompt: text };
}

/**
 * Định dạng đoạn văn bản đọc hiểu & đục lỗ tiếng Anh chuyên sâu:
 * - Đánh số đoạn văn [P1], [P2], [P3]...
 * - Tự động nhận diện chỗ trống (1), (2), [1], [2], ____(1)____, (22)__________
 * - Tô sáng neon chỗ trống đang làm (activeGap) kèm hiệu ứng phát sáng
 * - Biến chỗ trống thành clickable link để học sinh click nhảy đến câu hỏi
 */
export function formatPassageWithClozeAndParagraphs(rawPassage = "", activeGap = null) {
  if (!rawPassage) return "";

  // Tách thành các đoạn văn theo 2 dấu xuống dòng
  const paragraphs = String(rawPassage)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const formattedParagraphs = paragraphs.map((para, pIdx) => {
    // Nếu đoạn văn bắt đầu bằng chỉ dẫn "Read the passage..." thì không đánh số [P]
    const isIntro = /^(?:Read\s+the|Questions?\s+\d+|Đọc\s+đoạn|Attention\:|To\:)/i.test(para);
    const pMarker = !isIntro && paragraphs.length > 1
      ? `<span class="paragraph-marker" title="Đoạn văn ${pIdx + 1}">P${pIdx + 1}</span> `
      : "";

    // 1. Format rich text an toàn (escape HTML, Math x^2, bold/italic, tables)
    let formatted = formatRichText(para);

    // 2. Chuyển đổi các vị trí đục lỗ thành interactive cloze gap spans
    // Hỗ trợ: (1), [1], {1}, ____(1)____, (1)_____, _____ (1), (22)__________, (23) _______
    formatted = formatted.replace(
      /(?:_{2,}\s*\((\d+)\)\s*_{2,}|_{2,}\s*\((\d+)\)|\((\d+)\)\s*_{1,}|\[(\d+)\]|\((\d+)\)|\{(\d+)\})/g,
      (match, g1, g2, g3, g4, g5, g6) => {
        const gapNum = parseInt(g1 || g2 || g3 || g4 || g5 || g6, 10);
        const isActive = activeGap !== null && Number(activeGap) === gapNum;
        return `<span class="cloze-gap ${isActive ? "active-gap" : ""}" data-gap="${gapNum}" title="Vị trí đục lỗ số (${gapNum}) — Nhấp để làm câu này">(${gapNum})</span>`;
      }
    );

    return `<div class="passage-p">${pMarker}${formatted}</div>`;
  });

  return formattedParagraphs.join("");
}

/**
 * Format đáp án tự luận ("- Ý 1..." / "+ ý phụ") thành nút DOM an toàn.
 */
export function buildEssayAnswerNodes(answer) {
  const frag = document.createDocumentFragment();
  if (!answer) return frag;

  const lines = String(answer)
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let list = null;
  const flush = () => {
    list = null;
  };

  for (const line of lines) {
    if (line.startsWith("-") || line.startsWith("+")) {
      const isSub = line.startsWith("+");
      const text = line.slice(1).trim();
      if (!list) {
        list = document.createElement("ul");
        list.className = "essay-answer-list";
        frag.appendChild(list);
      }
      const li = document.createElement("li");
      li.textContent = text;
      if (isSub) li.classList.add("sub");
      list.appendChild(li);
    } else {
      flush();
      const p = document.createElement("p");
      p.textContent = line;
      frag.appendChild(p);
    }
  }
  return frag;
}
