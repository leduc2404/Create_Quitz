// Chia sẻ quiz bằng 1 link duy nhất.
// Chiến lược:
// 1. Quiz đã sync cloud → đánh dấu isPublic → link ngắn ?s=<cloudId> (gọn, mở được mọi nơi).
// 2. Quiz chỉ ở local → nén JSON bằng deflate-raw → base64url nhúng vào hash #q=...
//    (không cần server, người nhận mở link là import được ngay).
// Lưu ý: chỉ người đã đăng nhập mới dùng được tính năng chia sẻ.
import { isCloudAvailable, makeCloudQuizPublic, loadPublicQuiz } from "./storage/cloud.js";
import { toastSuccess, toast } from "../ui/toast.js";
import { getState } from "./store.js";

const MAX_URL_LEN = 8000;

// ---------- copy an toàn (fallback khi clipboard API bị chặn/mất focus) ----------
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    /* ignore */
  }
  ta.remove();
  return ok;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return fallbackCopy(text);
  }
}

// ---------- base64url ----------
function bytesToB64url(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ---------- nén / giải nén (browser-native, không cần thư viện) ----------
async function compress(str) {
  const input = new TextEncoder().encode(str);
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

function baseUrl() {
  return location.origin + location.pathname;
}

function toExportPayload(quiz) {
  return { type: quiz.quizType, topic: quiz.mainTopic, questions: quiz.questions };
}

/** Tạo link chia sẻ cho một quiz */
export async function buildShareUrl(quiz) {
  if (quiz.cloudId && isCloudAvailable()) {
    await makeCloudQuizPublic(quiz.cloudId);
    return `${baseUrl()}?s=${quiz.cloudId}`;
  }
  const json = JSON.stringify(toExportPayload(quiz));
  if (typeof CompressionStream === "undefined") {
    // Trình duyệt cũ: fallback không nén
    return `${baseUrl()}#q=${encodeURIComponent(json)}`;
  }
  return `${baseUrl()}#q=${bytesToB64url(await compress(json))}`;
}

/** Chia sẻ: luôn copy link vào clipboard (đơn giản, không mở share sheet của máy) */
export async function shareQuiz(quiz) {
  // Gate: chỉ người đã đăng nhập mới chia sẻ được
  if (!getState().user) {
    if (isCloudAvailable()) {
      toast("Đăng nhập để sử dụng tính năng chia sẻ nhé!", { type: "info", duration: 3500 });
      const modal = document.getElementById("authModal");
      if (modal) modal.classList.add("open");
    } else {
      toast("Chia sẻ cần Firebase. Xem README để cấu hình.", { type: "info", duration: 3500 });
    }
    return false;
  }

  let url;
  try {
    url = await buildShareUrl(quiz);
  } catch (e) {
    toast(`Không tạo được link: ${e.message}`, { type: "error" });
    return false;
  }

  const copied = await copyText(url);
  if (!copied) {
    // Cách cuối: hiện link để người dùng tự bôi đen copy
    window.prompt("Copy link chia sẻ bên dưới:", url);
    return true;
  }
  if (url.length > MAX_URL_LEN) {
    toast(`Đã copy link (${url.length} ký tự). Quiz lớn nên link hơi dài — lưu cloud để có link ngắn hơn ☁️`, {
      type: "info",
      duration: 4000
    });
  } else {
    toastSuccess("Đã copy link chia sẻ! Gửi cho bạn bè để cùng ôn tập 🔗");
  }
  return true;
}

/** Đọc quiz được chia sẻ từ URL hiện tại (nếu có) */
export async function readIncomingShare() {
  const cloudId = new URLSearchParams(location.search).get("s");
  if (cloudId) {
    try {
      const quiz = await loadPublicQuiz(cloudId);
      if (!quiz) return null;
      return {
        data: toExportPayload(quiz),
        name: quiz.fileName,
        via: "cloud"
      };
    } catch {
      return null;
    }
  }

  if (location.hash.startsWith("#q=")) {
    const packed = location.hash.slice(3);
    try {
      const json = packed.startsWith("%")
        ? decodeURIComponent(packed)
        : await decompress(b64urlToBytes(packed));
      const data = JSON.parse(json);
      if (!data || !Array.isArray(data.questions) || data.questions.length === 0) return null;
      return { data, name: data.topic || "Quiz chia sẻ", via: "url" };
    } catch {
      return null;
    }
  }
  return null;
}

/** Xóa tham số share khỏi URL để không bị import lại khi reload */
export function clearShareFromUrl() {
  history.replaceState(null, "", location.pathname);
}
