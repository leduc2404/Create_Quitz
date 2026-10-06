// SAT / IELTS Digital Text Highlighter — bôi màu đoạn trích đọc hiểu & dữ kiện câu hỏi.
// Hỗ trợ 2 màu highlight (vàng, xanh) và xóa highlight, lưu theo từng câu hỏi.

const HL_COLORS = {
  yellow: "rgba(253, 224, 71, 0.4)",
  green: "rgba(134, 239, 172, 0.4)"
};

let activeToolbar = null;
let savedRange = null;

export function initHighlighter() {
  createFloatingToolbar();

  document.addEventListener("mouseup", handleSelectionChange);
  document.addEventListener("touchend", () => {
    setTimeout(handleSelectionChange, 150);
  });

  document.addEventListener("mousedown", (e) => {
    if (activeToolbar && !activeToolbar.contains(e.target)) {
      hideToolbar();
    }
  });
}

function createFloatingToolbar() {
  if (document.getElementById("hlToolbar")) return;

  const bar = document.createElement("div");
  bar.id = "hlToolbar";
  bar.className = "hl-toolbar";
  bar.hidden = true;

  bar.innerHTML = `
    <button class="hl-btn yellow" data-color="yellow" title="Tô màu vàng"><span class="hl-dot y"></span></button>
    <button class="hl-btn green" data-color="green" title="Tô màu xanh"><span class="hl-dot g"></span></button>
    <button class="hl-btn clear" data-color="clear" title="Xóa tô màu">&times;</button>
  `;

  bar.addEventListener("click", (e) => {
    const btn = e.target.closest(".hl-btn");
    if (!btn) return;
    const colorKey = btn.dataset.color;
    applyHighlight(colorKey);
    hideToolbar();
  });

  document.body.appendChild(bar);
  activeToolbar = bar;
}

function handleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return;
  }

  const text = selection.toString().trim();
  if (text.length < 2) {
    hideToolbar();
    return;
  }

  // Chỉ cho phép highlight bên trong câu hỏi hoặc đoạn trích
  const anchorNode = selection.anchorNode;
  const card = anchorNode ? anchorNode.parentElement?.closest("#questionCard") : null;
  if (!card) {
    hideToolbar();
    return;
  }

  const range = selection.getRangeAt(0);
  savedRange = range.cloneRange();
  const rect = range.getBoundingClientRect();

  if (activeToolbar) {
    activeToolbar.style.top = `${window.scrollY + rect.top - 46}px`;
    activeToolbar.style.left = `${window.scrollX + rect.left + rect.width / 2 - 50}px`;
    activeToolbar.hidden = false;
  }
}

function hideToolbar() {
  if (activeToolbar) {
    activeToolbar.hidden = true;
  }
}

function applyHighlight(colorKey) {
  if (!savedRange) return;

  if (colorKey === "clear") {
    // Xóa thẻ mark xung quanh
    const commonAncestor = savedRange.commonAncestorContainer;
    const mark = commonAncestor.nodeType === 1 ? commonAncestor.closest("mark.q-hl") : commonAncestor.parentElement?.closest("mark.q-hl");
    if (mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      mark.remove();
    }
    window.getSelection()?.removeAllRanges();
    return;
  }

  const bg = HL_COLORS[colorKey] || HL_COLORS.yellow;
  const mark = document.createElement("mark");
  mark.className = "q-hl";
  mark.style.backgroundColor = bg;
  mark.style.color = "inherit";
  mark.style.padding = "1px 3px";
  mark.style.borderRadius = "3px";

  try {
    savedRange.surroundContents(mark);
  } catch {
    // Khi bôi đen vắt qua nhiều thẻ, extractContents rồi chèn
    const fragment = savedRange.extractContents();
    mark.appendChild(fragment);
    savedRange.insertNode(mark);
  }

  window.getSelection()?.removeAllRanges();
}
