// Router: 4 tab chính (bottom nav) + 3 màn overlay (topic/quiz/result).
const TABS = ["homeScreen", "libraryScreen", "createScreen", "profileScreen"];
const OVERLAYS = ["topicSelection", "quizScreen", "resultScreen"];

export function showTab(id) {
  for (const t of TABS) {
    const el = document.getElementById(t);
    if (el) el.hidden = t !== id;
  }
  for (const o of OVERLAYS) {
    const el = document.getElementById(o);
    if (el) el.hidden = true;
  }
  document.body.classList.remove("in-overlay");
  setNavActive(id);
  window.scrollTo({ top: 0 });
}

export function showScreen(id) {
  if (TABS.includes(id)) {
    showTab(id);
    return;
  }
  // Overlay: che toàn bộ tab + ẩn bottom nav để tập trung (deep work)
  for (const t of TABS) {
    const el = document.getElementById(t);
    if (el) el.hidden = true;
  }
  for (const o of OVERLAYS) {
    const el = document.getElementById(o);
    if (el) el.hidden = o !== id;
  }
  document.body.classList.add("in-overlay");
  window.scrollTo({ top: 0 });
}

function setNavActive(id) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === id);
  });
  // Báo cho views nào cần refresh khi tab hiện ra (vd: stats ở Profile)
  window.dispatchEvent(new CustomEvent("quitz:tab", { detail: id }));
}

export function initBottomNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });
}
