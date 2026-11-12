// Command Palette (Ctrl+K / Cmd+K) — trung tâm điều khiển & tìm kiếm tức thì phong cách Raycast / Linear.
import { getState, setTheme } from "../core/store.js";
import { importantCount } from "../core/flags.js";
import { isSoundEnabled, setSoundEnabled } from "./sound.js";
import { showTab } from "./router.js";
import { iconSvg } from "./icons.js";
import { toast } from "./toast.js";

let modalEl = null;
let inputEl = null;
let listEl = null;
let activeIndex = 0;
let currentItems = [];
let hooksRef = {};

export function initCommandPalette(hooks = {}) {
  hooksRef = hooks;
  ensureModal();

  // Nút mở trên Header & Sidebar
  document.querySelectorAll("[data-open-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => openCommandPalette());
  });

  // Phím tắt toàn cục Ctrl+K hoặc Cmd+K
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (modalEl?.classList.contains("open")) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
      return;
    }

    // Alt+1..4 chuyển nhanh giữa 4 tab chính khi không ở trong phòng thi
    if (e.altKey && !document.body.classList.contains("in-overlay")) {
      const tabMap = {
        "1": "homeScreen",
        "2": "libraryScreen",
        "3": "createScreen",
        "4": "profileScreen"
      };
      if (tabMap[e.key]) {
        e.preventDefault();
        showTab(tabMap[e.key]);
      }
    }
  });
}

function ensureModal() {
  if (modalEl) return;
  modalEl = document.getElementById("cmdPaletteModal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "cmdPaletteModal";
    modalEl.className = "modal-overlay cmd-overlay";
    modalEl.innerHTML = `
      <div class="cmd-dialog" role="dialog" aria-modal="true" aria-label="Tìm kiếm và Lệnh nhanh">
        <div class="cmd-search-bar">
          <span class="cmd-search-ic">${iconSvg("Search", 18)}</span>
          <input type="text" id="cmdSearchInput" class="cmd-input" placeholder="Tìm bộ đề, chủ đề hoặc gõ lệnh nhanh..." autocomplete="off" />
          <kbd class="cmd-esc-badge">ESC</kbd>
        </div>
        <div class="cmd-results" id="cmdResultsList"></div>
        <div class="cmd-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Di chuyển</span>
          <span><kbd>↵</kbd> Chọn</span>
          <span><kbd>ESC</kbd> Đóng</span>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  inputEl = modalEl.querySelector("#cmdSearchInput");
  listEl = modalEl.querySelector("#cmdResultsList");

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeCommandPalette();
  });

  inputEl.addEventListener("input", () => {
    activeIndex = 0;
    renderList(inputEl.value.trim());
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCommandPalette();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentItems.length > 0) {
        activeIndex = (activeIndex + 1) % currentItems.length;
        syncActiveItem();
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentItems.length > 0) {
        activeIndex = (activeIndex - 1 + currentItems.length) % currentItems.length;
        syncActiveItem();
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = currentItems[activeIndex];
      if (picked && picked.action) {
        closeCommandPalette();
        picked.action();
      }
    }
  });
}

export function openCommandPalette() {
  ensureModal();
  activeIndex = 0;
  inputEl.value = "";
  renderList("");
  modalEl.classList.add("open");
  setTimeout(() => inputEl.focus(), 40);
}

export function closeCommandPalette() {
  if (modalEl) modalEl.classList.remove("open");
}

function buildItems(query) {
  const q = query.toLowerCase();
  const quizzes = getState().quizzes || [];
  const imp = importantCount();
  const items = [];

  // 1. Danh sách bộ đề khớp tìm kiếm
  quizzes.forEach((quiz) => {
    const title = quiz.fileName || "Bộ đề";
    const sub = `${quiz.totalQuestions} câu · ${quiz.mainTopic || "Tổng hợp"}`;
    if (!q || title.toLowerCase().includes(q) || sub.toLowerCase().includes(q)) {
      items.push({
        group: "Bộ đề trong Thư viện",
        icon: quiz.settings?.icon || "BookOpen",
        title,
        meta: `${quiz.totalQuestions} câu`,
        action: () => hooksRef.onStartQuiz && hooksRef.onStartQuiz(quiz)
      });
    }
  });

  // 2. Các hành động nhanh & điều hướng
  const actions = [
    {
      group: "Ôn tập thông minh",
      icon: "Zap",
      title: "Ôn nhanh 10 câu ngẫu nhiên",
      meta: "Khởi động",
      keywords: "on nhanh 10 cau quick start",
      action: () => hooksRef.onQuick && hooksRef.onQuick(10)
    },
    ...(imp > 0
      ? [
          {
            group: "Ôn tập thông minh",
            icon: "Bookmark",
            title: `Ôn câu quan trọng đã lưu (${imp} câu)`,
            meta: "Bookmark",
            keywords: "on cau quan trong bookmark",
            action: () => hooksRef.onImportant && hooksRef.onImportant()
          }
        ]
      : []),
    {
      group: "Không gian làm việc",
      icon: "SquarePlus",
      title: "Tạo bộ đề mới (Dán JSON / Văn bản / File)",
      meta: "Alt+3",
      keywords: "tao bo de moi create import json",
      action: () => showTab("createScreen")
    },
    {
      group: "Không gian làm việc",
      icon: "WandSparkles",
      title: "Mở AI Prompt Studio (Tạo đề bằng Gemini/ChatGPT)",
      meta: "AI Studio",
      keywords: "ai prompt gemini chatgpt tao de",
      action: () => {
        showTab("createScreen");
        document.getElementById("openAiBtn")?.click();
      }
    },
    {
      group: "Không gian làm việc",
      icon: "Sparkles",
      title: "Nạp bộ đề mẫu chuẩn 2026 & TOEIC",
      meta: "Starter Decks",
      keywords: "bo de mau sample demo thpt toeic",
      action: () => hooksRef.onLoadSamples && hooksRef.onLoadSamples()
    },
    {
      group: "Không gian làm việc",
      icon: "Library",
      title: "Mở Thư viện bộ đề",
      meta: "Alt+2",
      keywords: "thu vien library",
      action: () => showTab("libraryScreen")
    },
    {
      group: "Không gian làm việc",
      icon: "BarChart3",
      title: "Xem Hồ sơ & Phân tích năng lực",
      meta: "Alt+4",
      keywords: "ho so ca nhan profile thong ke",
      action: () => showTab("profileScreen")
    },
    {
      group: "Cài đặt nhanh",
      icon: getState().theme === "dark" ? "Sun" : "Moon",
      title: `Chuyển sang Giao diện ${getState().theme === "dark" ? "Sáng (Paper)" : "Tối (Obsidian)"}`,
      meta: "Theme",
      keywords: "giao dien sang toi dark light theme",
      action: () => {
        const next = getState().theme === "dark" ? "light" : "dark";
        setTheme(next);
        toast(`Đã chuyển sang giao diện ${next === "dark" ? "Tối" : "Sáng"}.`, { duration: 1400 });
      }
    },
    {
      group: "Cài đặt nhanh",
      icon: isSoundEnabled() ? "VolumeX" : "Volume2",
      title: `${isSoundEnabled() ? "Tắt" : "Bật"} âm thanh hiệu ứng`,
      meta: "Audio",
      keywords: "am thanh sound mute",
      action: () => {
        const next = !isSoundEnabled();
        setSoundEnabled(next);
        const toggle = document.getElementById("soundToggle");
        if (toggle) toggle.checked = next;
        toast(next ? "Đã bật âm thanh." : "Đã tắt âm thanh.", { duration: 1400 });
      }
    }
  ];

  actions.forEach((act) => {
    if (!q || act.title.toLowerCase().includes(q) || (act.keywords && act.keywords.includes(q))) {
      items.push(act);
    }
  });

  return items.slice(0, 14);
}

function renderList(query) {
  currentItems = buildItems(query);
  listEl.innerHTML = "";

  if (currentItems.length === 0) {
    listEl.innerHTML = `<div class="cmd-empty">Không tìm thấy bộ đề hoặc lệnh nào khớp với "${query}".</div>`;
    return;
  }

  let lastGroup = "";
  currentItems.forEach((item, idx) => {
    if (item.group !== lastGroup) {
      lastGroup = item.group;
      const groupHeader = document.createElement("div");
      groupHeader.className = "cmd-group-label";
      groupHeader.textContent = item.group;
      listEl.appendChild(groupHeader);
    }

    const row = document.createElement("button");
    row.type = "button";
    row.className = `cmd-item ${idx === activeIndex ? "active" : ""}`;
    row.dataset.index = idx;

    const ic = document.createElement("span");
    ic.className = "cmd-item-ic";
    ic.innerHTML = iconSvg(item.icon, 18);

    const text = document.createElement("span");
    text.className = "cmd-item-title";
    text.textContent = item.title;

    const meta = document.createElement("span");
    meta.className = "cmd-item-meta";
    meta.textContent = item.meta || "";

    row.append(ic, text, meta);
    row.addEventListener("mouseenter", () => {
      activeIndex = idx;
      syncActiveItem();
    });
    row.addEventListener("click", () => {
      closeCommandPalette();
      item.action();
    });
    listEl.appendChild(row);
  });
}

function syncActiveItem() {
  listEl.querySelectorAll(".cmd-item").forEach((el) => {
    const idx = Number(el.dataset.index);
    const isAct = idx === activeIndex;
    el.classList.toggle("active", isAct);
    if (isAct) {
      el.scrollIntoView({ block: "nearest" });
    }
  });
}

