// Modal xác nhận + modal nhập liệu — thay thế confirm()/prompt() native.
let confirmEls = null;
let promptEls = null;

function els() {
  if (!confirmEls) {
    confirmEls = {
      overlay: document.getElementById("confirmModal"),
      title: document.getElementById("confirmTitle"),
      message: document.getElementById("confirmMessage"),
      ok: document.getElementById("confirmOk"),
      cancel: document.getElementById("confirmCancel")
    };
  }
  return confirmEls;
}

/**
 * Hiện modal xác nhận, trả về Promise<boolean>.
 */
export function confirmDialog({ title = "Xác nhận", message = "", okText = "OK", cancelText = "Hủy", danger = false }) {
  const { overlay, title: titleEl, message: msgEl, ok, cancel } = els();

  titleEl.textContent = title;
  msgEl.textContent = message;
  ok.textContent = okText;
  cancel.textContent = cancelText;
  ok.classList.toggle("danger", danger);

  overlay.classList.add("open");

  return new Promise((resolve) => {
    function close(result) {
      overlay.classList.remove("open");
      ok.onclick = cancel.onclick = overlay.onclick = null;
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    }
    ok.onclick = () => close(true);
    cancel.onclick = () => close(false);
    overlay.onclick = (e) => {
      if (e.target === overlay) close(false);
    };
    document.addEventListener("keydown", onKey);
    ok.focus();
  });
}

/**
 * Hiện modal nhập 1 dòng text (đổi tên...), trả về Promise<string|null>.
 */
export function promptDialog({ title = "Nhập tên", placeholder = "", value = "", okText = "Lưu" }) {
  if (!promptEls) {
    promptEls = {
      overlay: document.getElementById("promptModal"),
      title: document.getElementById("promptTitle"),
      input: document.getElementById("promptInput"),
      ok: document.getElementById("promptOk"),
      cancel: document.getElementById("promptCancel")
    };
  }
  const { overlay, title: titleEl, input, ok, cancel } = promptEls;

  titleEl.textContent = title;
  ok.textContent = okText;
  input.placeholder = placeholder;
  input.value = value;
  overlay.classList.add("open");
  setTimeout(() => {
    input.focus();
    input.select();
  }, 60);

  return new Promise((resolve) => {
    function close(result) {
      overlay.classList.remove("open");
      ok.onclick = cancel.onclick = overlay.onclick = input.onkeydown = null;
      resolve(result);
    }
    ok.onclick = () => close(input.value.trim() || null);
    cancel.onclick = () => close(null);
    overlay.onclick = (e) => {
      if (e.target === overlay) close(null);
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        close(input.value.trim() || null);
      }
      if (e.key === "Escape") close(null);
    };
  });
}
