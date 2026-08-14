// Storage layer (cloud) — Firestore. App vẫn chạy khi chưa cấu hình Firebase.
import { db, isFirebaseEnabled } from "../../config/firebase.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  addDoc
} from "firebase/firestore";
import { genId } from "./local.js";

export function isCloudAvailable() {
  return isFirebaseEnabled && !!db;
}

function toLocalQuiz(docSnap) {
  const d = docSnap.data();
  return {
    id: d.localId || genId(),
    cloudId: docSnap.id,
    fileName: d.name,
    mainTopic: d.mainTopic || d.name,
    quizType: d.quizType || "multiple_choice",
    topics: d.topics || null,
    questions: d.questions || [],
    totalQuestions: d.totalQuestions || (d.questions || []).length,
    createdAt: d.createdAt?.toMillis?.() || Date.now(),
    updatedAt: d.updatedAt?.toMillis?.() || d.createdAt?.toMillis?.() || Date.now(),
    syncedAt: d.updatedAt?.toMillis?.() || Date.now()
  };
}

export async function loadUserQuizzes(uid) {
  if (!isCloudAvailable()) return [];
  // KHÔNG dùng orderBy ở đây: where + orderBy yêu cầu composite index trên Firestore.
  // Chỉ where theo ownerId, rồi sort phía client — tránh phải tạo index thủ công.
  const q = query(collection(db, "quizzes"), where("ownerId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(toLocalQuiz).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveQuizToCloud(quiz, uid) {
  if (!isCloudAvailable()) throw new Error("Firebase chưa được cấu hình");
  const ref = quiz.cloudId ? doc(db, "quizzes", quiz.cloudId) : doc(collection(db, "quizzes"));
  const payload = {
    ownerId: uid,
    localId: quiz.id,
    name: quiz.fileName,
    mainTopic: quiz.mainTopic,
    quizType: quiz.quizType,
    topics: quiz.topics,
    questions: quiz.questions,
    totalQuestions: quiz.totalQuestions,
    updatedAt: serverTimestamp()
  };
  if (!quiz.cloudId) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  return ref.id;
}

export async function deleteCloudQuiz(cloudId) {
  if (!isCloudAvailable() || !cloudId) return;
  await deleteDoc(doc(db, "quizzes", cloudId));
}

/** Đánh dấu quiz là công khai — ai có link cũng đọc được (dùng cho nút Share) */
export async function makeCloudQuizPublic(cloudId) {
  if (!isCloudAvailable() || !cloudId) throw new Error("Quiz chưa được lưu trên cloud");
  await setDoc(doc(db, "quizzes", cloudId), { isPublic: true }, { merge: true });
}

/** Đọc quiz công khai theo cloudId (bất kể đăng nhập) */
export async function loadPublicQuiz(cloudId) {
  if (!isCloudAvailable() || !cloudId) return null;
  const snap = await getDoc(doc(db, "quizzes", cloudId));
  if (!snap.exists()) return null;
  if (!snap.data().isPublic) return null;
  return toLocalQuiz(snap);
}

export async function saveResult(uid, { quizId, quizName, score, total, wrongIds }) {
  if (!isCloudAvailable()) return;
  await addDoc(collection(db, "users", uid, "results"), {
    quizId,
    quizName,
    score,
    total,
    wrongIds,
    at: serverTimestamp()
  });
}
