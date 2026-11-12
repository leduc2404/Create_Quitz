// UI đăng nhập/đăng ký — modal + nút trên topbar & desktop sidebar.
import {
  friendlyAuthError,
  isAuthAvailable,
  logOut,
  resolveRedirectResult,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail
} from "./auth.js";
import { getState, subscribe } from "../core/store.js";
import { loadUserQuizzes } from "../core/storage/cloud.js";
import { mergeCloudQuizzes } from "../core/store.js";
import { toast, toastError, toastSuccess } from "../ui/toast.js";
import { iconSvg } from "../ui/icons.js";
import { showTab } from "../ui/router.js";

let mode = "login"; // 'login' | 'signup'

export function initAuthUI() {
  const modal = document.getElementById("authModal");
  const authBtn = document.getElementById("authBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const profileAuthBtn = document.getElementById("profileAuthBtn");
  const sidebarUserBtn = document.getElementById("sidebarUserBtn");

  // Luôn gắn nút đóng / backdrop để modal KHÔNG BAO GIỜ bị kẹt mở
  document.getElementById("authClose")?.addEventListener("click", closeAuthModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeAuthModal();
  });

  if (!isAuthAvailable()) {
    // Chưa cấu hình Firebase: ẩn các nút đăng nhập cloud, nhưng sidebar user card dẫn tới Hồ sơ
    if (authBtn) authBtn.hidden = true;
    if (logoutBtn) logoutBtn.hidden = true;
    if (profileAuthBtn) profileAuthBtn.hidden = true;
    sidebarUserBtn?.addEventListener("click", () => showTab("profileScreen"));
    return;
  }

  if (authBtn) authBtn.hidden = false;

  const handleUserAction = () => {
    if (getState().user) {
      showTab("profileScreen");
      return;
    }
    openAuthModal();
  };

  authBtn?.addEventListener("click", handleUserAction);
  sidebarUserBtn?.addEventListener("click", handleUserAction);
  profileAuthBtn?.addEventListener("click", openAuthModal);

  logoutBtn?.addEventListener("click", async () => {
    await logOut();
    toast("Đã đăng xuất. Dữ liệu cloud vẫn được giữ an toàn.", { type: "info" });
  });

  document.getElementById("tabLogin")?.addEventListener("click", () => setMode("login"));
  document.getElementById("tabSignup")?.addEventListener("click", () => setMode("signup"));

  // Hiện / ẩn mật khẩu
  const pwToggle = document.getElementById("pwToggle");
  const pwInput = document.getElementById("authPassword");
  pwToggle?.addEventListener("click", () => {
    const show = pwInput.type === "password";
    pwInput.type = show ? "text" : "password";
    pwToggle.setAttribute("aria-pressed", String(show));
    pwToggle.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
    pwToggle.innerHTML = iconSvg(show ? "EyeOff" : "Eye", 18);
    pwInput.focus();
  });

  document.getElementById("authForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    if (!email || !password) {
      showAuthError("Vui lòng nhập email và mật khẩu.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
        toastSuccess("Tạo tài khoản thành công! Chào mừng bạn.");
      } else {
        await signInWithEmail(email, password);
        toastSuccess("Đăng nhập thành công!");
      }
      closeAuthModal();
    } catch (err) {
      showAuthError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  });

  document.getElementById("googleBtn")?.addEventListener("click", async () => {
    setSubmitting(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        toastSuccess("Đăng nhập với Google thành công!");
        closeAuthModal();
      } else {
        // Đang điều hướng sang Google (redirect); giữ nút ở trạng thái chờ
        toast("Đang chuyển hướng đến Google...", { type: "info", duration: 2500 });
      }
    } catch (err) {
      showAuthError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  });

  // Hoàn tất đăng nhập Google bằng redirect nếu trang vừa quay về từ Firebase
  resolveRedirectResult()
    .then((user) => {
      if (user) toastSuccess("Đăng nhập với Google thành công!");
    })
    .catch((err) => {
      openAuthModal();
      showAuthError(friendlyAuthError(err));
    });

  // Cập nhật header + sidebar + thẻ profile theo trạng thái user
  subscribe("user", (user) => renderUser(user));
}

export function openAuthModal() {
  clearAuthError();
  document.getElementById("authModal")?.classList.add("open");
  setTimeout(() => document.getElementById("authEmail")?.focus(), 60);
}

function closeAuthModal() {
  document.getElementById("authModal")?.classList.remove("open");
}

function setMode(newMode) {
  mode = newMode;
  document.getElementById("tabLogin")?.classList.toggle("active", mode === "login");
  document.getElementById("tabSignup")?.classList.toggle("active", mode === "signup");
  document.getElementById("authTitle").textContent = mode === "login" ? "Đăng nhập" : "Đăng ký";
  document.getElementById("authSubmit").textContent = mode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  document.getElementById("authPassword").autocomplete =
    mode === "login" ? "current-password" : "new-password";
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById("authError");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function clearAuthError() {
  const el = document.getElementById("authError");
  if (el) el.hidden = true;
}

function setSubmitting(busy) {
  const sub = document.getElementById("authSubmit");
  const gBtn = document.getElementById("googleBtn");
  if (sub) {
    sub.disabled = busy;
    sub.classList.toggle("is-loading", busy);
    sub.textContent = busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  }
  if (gBtn) gBtn.disabled = busy;
}

function renderUser(user) {
  const authBtn = document.getElementById("authBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const avatar = document.getElementById("profileAvatar");
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const profileAuthBtn = document.getElementById("profileAuthBtn");

  const sidebarAvatar = document.getElementById("sidebarAvatar");
  const sidebarUserName = document.getElementById("sidebarUserName");
  const sidebarUserSub = document.getElementById("sidebarUserSub");

  if (user) {
    const name = user.displayName || (user.email ? user.email.split("@")[0] : "Người dùng");
    const initial = name.charAt(0).toUpperCase();
    if (authBtn) {
      authBtn.hidden = false;
      authBtn.innerHTML = `<span class="avatar-letter">${initial}</span>`;
      authBtn.setAttribute("aria-label", `Tài khoản: ${name}`);
    }
    if (avatar) avatar.textContent = initial;
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = user.email || "Đã đăng nhập Cloud";
    if (profileAuthBtn) profileAuthBtn.hidden = true;
    if (logoutBtn) logoutBtn.hidden = false;

    if (sidebarAvatar) sidebarAvatar.textContent = initial;
    if (sidebarUserName) sidebarUserName.textContent = name;
    if (sidebarUserSub) sidebarUserSub.textContent = "Đã đồng bộ Cloud";
  } else {
    if (authBtn) {
      authBtn.hidden = !isAuthAvailable();
      authBtn.innerHTML = iconSvg("User", 18);
      authBtn.setAttribute("aria-label", "Đăng nhập");
    }
    if (avatar) avatar.innerHTML = iconSvg("User", 22);
    if (nameEl) nameEl.textContent = "Khách";
    if (emailEl) emailEl.textContent = "Lưu trữ cục bộ • Đăng nhập để đồng bộ Cloud";
    if (profileAuthBtn) profileAuthBtn.hidden = !isAuthAvailable();
    if (logoutBtn) logoutBtn.hidden = true;

    if (sidebarAvatar) sidebarAvatar.innerHTML = iconSvg("User", 16);
    if (sidebarUserName) sidebarUserName.textContent = "Chế độ Khách";
    if (sidebarUserSub) sidebarUserSub.textContent = "Lưu cục bộ trên máy";
  }
}

/** Đồng bộ quiz cloud sau khi đăng nhập */
export async function syncAfterLogin(user) {
  if (!user) return;
  try {
    const cloudQuizzes = await loadUserQuizzes(user.uid);
    if (cloudQuizzes.length > 0) {
      mergeCloudQuizzes(cloudQuizzes);
      toast(`Đã tải ${cloudQuizzes.length} quiz từ cloud.`, { type: "success" });
    }
  } catch (e) {
    toastError("Không tải được dữ liệu cloud: " + e.message);
  }
}
