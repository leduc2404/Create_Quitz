// Theme dark/light — mặc định dark, lưu preference.
import { getTheme, saveTheme } from "../core/storage/local.js";
import { setTheme, subscribe } from "../core/store.js";

export function initTheme() {
  apply(getTheme());

  subscribe("theme", (theme) => {
    apply(theme);
    saveTheme(theme);
  });

  // Switch checkbox: checked = dark
  document.getElementById("themeToggle").addEventListener("change", (e) => {
    setTheme(e.target.checked ? "dark" : "light");
  });
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  const toggle = document.getElementById("themeToggle");
  toggle.checked = theme === "dark";
  // Đồng bộ màu thanh địa chỉ trên mobile
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#06080F" : "#F4F6FC";
}
