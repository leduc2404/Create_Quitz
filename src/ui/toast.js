// Toast system — thay thế alert() toàn app.
import { iconSvg } from "./icons.js";

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Hiện toast.
 * @param {string} message
 * @param {object} opts { type: 'success'|'error'|'info', duration, actionText, onAction }
 */
export function toast(message, opts = {}) {
  const { type = "info", duration = 3000, actionText, onAction } = opts;
  const root = ensureContainer();

  const el = document.createElement("div");
  el.className = `toast toast-${type}`;

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  const iconName = type === "success" ? "CircleCheck" : type === "error" ? "TriangleAlert" : "Info";
  icon.innerHTML = iconSvg(iconName, 18);

  const text = document.createElement("span");
  text.className = "toast-text";
  text.textContent = message;

  el.append(icon, text);

  if (actionText && onAction) {
    const btn = document.createElement("button");
    btn.className = "toast-action";
    btn.textContent = actionText;
    btn.onclick = () => {
      dismiss();
      onAction();
    };
    el.appendChild(btn);
  }

  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));

  let timer = duration > 0 ? setTimeout(dismiss, duration) : null;

  function dismiss() {
    if (timer) clearTimeout(timer);
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }

  el.addEventListener("click", (e) => {
    if (e.target === el || e.target === text) dismiss();
  });

  return { dismiss };
}

export const toastSuccess = (msg, opts) => toast(msg, { ...opts, type: "success" });
export const toastError = (msg, opts) => toast(msg, { ...opts, type: "error", duration: 4500 });
