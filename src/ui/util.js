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
 * Format đáp án tự luận ("- Ý 1..." / "+ ý phụ") thành nút DOM an toàn.
 * Viết lại từ bản gốc: không dùng regex nối chuỗi HTML dễ vỡ.
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
