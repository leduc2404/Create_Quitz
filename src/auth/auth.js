// Auth service — bọc Firebase Auth, map lỗi sang tiếng Việt.
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { auth } from "../config/firebase.js";
import { isCloudAvailable } from "../core/storage/cloud.js";
import { setUser } from "../core/store.js";

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

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
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
      "Domain này chưa được thêm vào Firebase Auth (Authorized domains)."
  };
  return map[err?.code] || `Lỗi đăng nhập: ${err?.code || err?.message || "không xác định"}`;
}
