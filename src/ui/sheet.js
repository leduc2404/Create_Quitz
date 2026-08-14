// Bottom sheet "..." — menu tùy chọn dạng trượt từ dưới lên (mobile pattern).
import { iconSvg } from "./icons.js";

let sheetEl = null;

function ensureSheet() {
  if (sheetEl) return sheetEl;
  sheetEl = document.createElement("div");
  sheetEl.className = "sheet-overlay";
  sheetEl.innerHTML = `
    <div class="sheet" role="menu">
      <div class="sheet-handle"></div>
      <div class="sheet-title"></div>
      <div class="sheet-actions"></div>
    </div>`;
  document.body.appendChild(sheetEl);
  sheetEl.addEventListener("click", (e) => {
    if (e.target === sheetEl) hideSheet();
  });
  return sheetEl;
}

export function hideSheet() {
  if (sheetEl) sheetEl.classList.remove("open");
}

/**
 * Mở bottom sheet.
 * @param {string} title
 * @param {Array<{icon:string,label:string,danger?:boolean,onClick:Function}>} actions
 */
export function showSheet(title, actions) {
  const sheet = ensureSheet();
  sheet.querySelector(".sheet-title").textContent = title;
  const wrap = sheet.querySelector(".sheet-actions");
  wrap.innerHTML = "";
  for (const action of actions) {
    const btn = document.createElement("button");
    btn.className = "sheet-item" + (action.danger ? " danger" : "");
    btn.innerHTML = `${iconSvg(action.icon, 20)}<span></span>`;
    btn.querySelector("span").textContent = action.label;
    btn.addEventListener("click", () => {
      hideSheet();
      action.onClick();
    });
    wrap.appendChild(btn);
  }
  requestAnimationFrame(() => sheet.classList.add("open"));
}
