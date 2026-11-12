// Auth service — bọc Firebase Auth, map lỗi sang tiếng Việt.
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  signOut
} from "firebase/auth";
import { auth } from "../config/firebase.js";
import { isCloudAvailable } from "../core/storage/cloud.js";
import { setUser } from "../core/store.js";

// Giữ phiên đăng nhập bền vững (không mất khi tải lại / đóng mở tab)
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("[Quitz] Không đặt được persistence:", err?.code);
  });
}

export function isAuthAvailable() {
  return isCloudAvailable();
}

export function watchAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (fbUser) => {
    const user = fbUser
      ? {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL
        }
      : null;
    setUser(user);
    callback(user);
  });
}

export async function signUpWithEmail(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signInWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Các lỗi popup mà ở đó nên chuyển sang luồng redirect (mobile, in-app browser, popup bị chặn)
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/internal-error",
  "auth/web-storage-unsupported",
  "auth/operation-not-supported-in-this-environment"
]);

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    if (POPUP_FALLBACK_CODES.has(err?.code)) {
      // Redirect sẽ điều hướng cả trang; kết quả được xử lý khi tải lại (resolveRedirectResult)
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

// Gọi khi khởi động để hoàn tất đăng nhập Google bằng redirect (nếu có)
export async function resolveRedirectResult() {
  if (!auth) return null;
  const cred = await getRedirectResult(auth);
  return cred?.user || null;
}

export async function logOut() {
  await signOut(auth);
}

export function friendlyAuthError(err) {
  const map = {
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/user-not-found": "Không tìm thấy tài khoản với email này.",
    "auth/wrong-password": "Mật khẩu không đúng.",
    "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
    "auth/email-already-in-use": "Email này đã được đăng ký. Hãy đăng nhập.",
    "auth/weak-password": "Mật khẩu phải có ít nhất 6 ký tự.",
    "auth/too-many-requests": "Thử quá nhiều lần. Vui lòng thử lại sau.",
    "auth/network-request-failed": "Lỗi mạng. Kiểm tra kết nối internet.",
    "auth/popup-closed-by-user": "Cửa sổ đăng nhập đã bị đóng.",
    "auth/operation-not-allowed":
      "Phương thức đăng nhập chưa được bật trong Firebase Console.",
    "auth/unauthorized-domain":
      "Domain này chưa được cấp phép. Hãy mở bằng http://localhost:5173 hoặc thêm domain vào Firebase Console → Authentication → Settings → Authorized domains.",
    "auth/popup-blocked":
      "Trình duyệt chặn cửa sổ đăng nhập. Đang chuyển sang cách khác...",
    "auth/web-storage-unsupported":
      "Trình duyệt chặn lưu trữ đăng nhập (ẩn danh / in-app). Hãy mở bằng trình duyệt thường.",
    "auth/operation-not-supported-in-this-environment":
      "Môi trường này không hỗ trợ đăng nhập popup. Đang chuyển hướng..."
  };
  return map[err?.code] || `Lỗi đăng nhập: ${err?.code || err?.message || "không xác định"}`;
}
