// Tính năng Highlight văn bản đã được gỡ bỏ theo yêu cầu của người dùng.
export function initHighlighter() {
  document.getElementById("hlToolbar")?.remove();
  document.querySelectorAll("mark.q-hl").forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      mark.remove();
    }
  });
}
