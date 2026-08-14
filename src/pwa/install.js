// PWA install flow — bắt beforeinstallprompt, hướng dẫn iOS.
import { toast } from "../ui/toast.js";

let deferredPrompt = null;

export function initInstallPrompt() {
  const installBtn = document.getElementById("installBtn");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      installBtn.hidden = true;
    }
    deferredPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
    toast("Đã cài đặt Quitz! Mở app từ màn hình chính nhé 🎉", { type: "success" });
  });

  // Đang chạy trong app đã cài → ẩn nút
  if (window.matchMedia("(display-mode: standalone)").matches) {
    installBtn.hidden = true;
  }

  // iOS Safari: không có beforeinstallprompt → hướng dẫn Add to Home Screen
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  if (isIOS && !isStandalone) {
    setTimeout(() => {
      toast('Để cài app trên iPhone/iPad: nhấn nút Chia sẻ ⬆ rồi chọn "Thêm vào Màn hình chính".', {
        duration: 8000
      });
    }, 3000);
  }
}
