// Theme dark/light — mặc định dark (Obsidian Studio), lưu preference.
import { getTheme, saveTheme } from "../core/storage/local.js";
import { getState, setTheme, subscribe } from "../core/store.js";
import { iconSvg } from "./icons.js";

export function initTheme() {
  apply(getTheme());

  subscribe("theme", (theme) => {
    apply(theme);
    saveTheme(theme);
  });

  // Switch checkbox trong Profile: checked = dark
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("change", (e) => {
      setTheme(e.target.checked ? "dark" : "light");
    });
  }

  // Nút đổi nhanh trên Header (Mobile) & Sidebar (Desktop)
  const toggleFn = () => {
    const current = getState().theme || document.documentElement.dataset.theme || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  };

  document.getElementById("headerThemeBtn")?.addEventListener("click", toggleFn);
  document.getElementById("sidebarThemeBtn")?.addEventListener("click", toggleFn);
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.checked = theme === "dark";

  const iconHtml = theme === "dark" ? iconSvg("Sun", 16) : iconSvg("Moon", 16);
  const headerBtn = document.getElementById("headerThemeBtn");
  const sidebarBtn = document.getElementById("sidebarThemeBtn");
  if (headerBtn) headerBtn.innerHTML = iconHtml;
  if (sidebarBtn) {
    sidebarBtn.innerHTML = `${iconHtml}<span>${theme === "dark" ? "Sáng" : "Tối"}</span>`;
  }

  // Đồng bộ màu thanh địa chỉ trên mobile
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#07090E" : "#F8F7F4";
}
