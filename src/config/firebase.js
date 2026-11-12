// Firebase bootstrap. Nếu chưa có config trong .env → app chạy chế độ local,
// các tính năng auth/cloud tự tắt thay vì crash.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

export const isFirebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app = null;
let auth = null;
let db = null;

if (isFirebaseEnabled) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Offline-first: cache Firestore trong IndexedDB, hỗ trợ nhiều tab.
  // Nếu trình duyệt chặn (ẩn danh / in-app) thì chuyển về cache tạm.
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (err) {
    console.warn("[Quitz] Firestore offline cache không khả dụng, dùng cache tạm:", err?.code);
    db = getFirestore(app);
  }
} else {
  console.info(
    "[Quitz] Firebase chưa cấu hình (thiếu .env). Chạy chế độ local: đăng nhập & cloud bị tắt."
  );
}

export { app, auth, db };
