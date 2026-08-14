// UI đăng nhập/đăng ký — modal + nút trên topbar.
import {
  friendlyAuthError,
  isAuthAvailable,
  logOut,
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

  // Luôn gắn nút đóng / backdrop để modal KHÔNG BAO GIỜ bị kẹt mở
  // (kể cả khi Firebase chưa cấu hình và initAuthUI return sớm)
  document.getElementById("authClose").addEventListener("click", closeAuthModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAuthModal();
  });

  if (!isAuthAvailable()) {
    // Chưa cấu hình Firebase: ẩn toàn bộ khu vực auth
    authBtn.hidden = true;
    logoutBtn.hidden = true;
    profileAuthBtn.hidden = true;
    return;
  }
  // Firebase đã cấu hình: đảm bảo nút đăng nhập hiện ra
  // (phòng trường hợp hidden còn sót từ lần khởi tạo trước)
  authBtn.hidden = false;

  authBtn.addEventListener("click", () => {
    if (getState().user) {
      showTab("profileScreen");
      return;
    }
    openAuthModal();
  });
  profileAuthBtn.addEventListener("click", openAuthModal);

  logoutBtn.addEventListener("click", async () => {
    await logOut();
    toast("Đã đăng xuất. Dữ liệu cloud vẫn được giữ an toàn.", { type: "info" });
  });

  document.getElementById("tabLogin").addEventListener("click", () => setMode("login"));
  document.getElementById("tabSignup").addEventListener("click", () => setMode("signup"));

  document.getElementById("authForm").addEventListener("submit", async (e) => {
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

  document.getElementById("googleBtn").addEventListener("click", async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      toastSuccess("Đăng nhập với Google thành công!");
      closeAuthModal();
    } catch (err) {
      showAuthError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  });

  // Cập nhật header + thẻ profile theo trạng thái user
  subscribe("user", (user) => renderUser(user));
}

export function openAuthModal() {
  clearAuthError();
  document.getElementById("authModal").classList.add("open");
}

function closeAuthModal() {
  document.getElementById("authModal").classList.remove("open");
}

function setMode(newMode) {
  mode = newMode;
  document.getElementById("tabLogin").classList.toggle("active", mode === "login");
  document.getElementById("tabSignup").classList.toggle("active", mode === "signup");
  document.getElementById("authTitle").textContent = mode === "login" ? "Đăng nhập" : "Đăng ký";
  document.getElementById("authSubmit").textContent = mode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  document.getElementById("authPassword").autocomplete =
    mode === "login" ? "current-password" : "new-password";
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById("authError");
  el.textContent = msg;
  el.hidden = false;
}

function clearAuthError() {
  document.getElementById("authError").hidden = true;
}

function setSubmitting(busy) {
  document.getElementById("authSubmit").disabled = busy;
  document.getElementById("googleBtn").disabled = busy;
}

function renderUser(user) {
  const authBtn = document.getElementById("authBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const avatar = document.getElementById("profileAvatar");
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const profileAuthBtn = document.getElementById("profileAuthBtn");

  if (user) {
    const name = user.displayName || (user.email ? user.email.split("@")[0] : "Người dùng");
    const initial = name.charAt(0).toUpperCase();
    authBtn.hidden = false;
    authBtn.innerHTML = `<span class="avatar-letter">${initial}</span>`;
    authBtn.setAttribute("aria-label", `Tài khoản: ${name}`);
    avatar.textContent = initial;
    nameEl.textContent = name;
    emailEl.textContent = user.email || "Đã đăng nhập";
    profileAuthBtn.hidden = true;
    logoutBtn.hidden = false;
  } else {
    authBtn.hidden = false;
    authBtn.innerHTML = iconSvg("User", 18);
    authBtn.setAttribute("aria-label", "Đăng nhập");
    avatar.innerHTML = iconSvg("User", 22);
    nameEl.textContent = "Khách";
    emailEl.textContent = "Đăng nhập để đồng bộ cloud";
    profileAuthBtn.hidden = false;
    logoutBtn.hidden = true;
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
