// Quitz Adaptive Performance Engine — tối ưu hóa 60fps cho thiết bị cấu hình yếu & điện thoại.
// Tự động nhận diện phần cứng (CPU cores, RAM, GPU, Pin, Reduced Motion)
// và áp dụng chế độ siêu nhẹ (No backdrop-filter, reduced canvas particles, throttled animations).

const STORAGE_KEY = "quitz_low_perf_mode";

class PerformanceEngine {
  constructor() {
    this._manualOverride = null; // null: auto | true: always low-perf | false: high quality
    this._isLowEnd = false;
    this._init();
  }

  _init() {
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "true") this._manualOverride = true;
        else if (saved === "false") this._manualOverride = false;
      }
    } catch {
      // Ignore localStorage security errors in private browsing
    }

    this._detectHardware();
    this.applyTheme();
  }

  _detectHardware() {
    let score = 0;

    const nav = typeof navigator !== "undefined" ? navigator : {};
    const win = typeof window !== "undefined" ? window : {};

    // 1. Số nhân CPU (Hardware Concurrency)
    const cores = nav.hardwareConcurrency || 4;
    if (cores <= 4) score += 2;
    if (cores <= 2) score += 3;

    // 2. Bộ nhớ thiết bị (Device Memory API, Chrome/Edge/Android)
    const ram = nav.deviceMemory || 8;
    if (ram <= 4) score += 2;
    if (ram <= 2) score += 3;

    // 3. Thiết bị di động / Màn hình cảm ứng
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        nav.userAgent || ""
      ) || (win.innerWidth && win.innerWidth < 768);
    if (isMobile) score += 1;

    // 4. Reduced motion preference
    if (
      win.matchMedia &&
      win.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      score += 2;
    }

    // Nếu điểm số >= 3 thì tự động đánh giá là thiết bị cần tối ưu hiệu năng
    this._isLowEnd = score >= 3;
  }

  /**
   * Trả về true nếu đang chạy ở chế độ tiết kiệm tài nguyên
   */
  isLowPerf() {
    if (this._manualOverride !== null) return this._manualOverride;
    return this._isLowEnd;
  }

  /**
   * Bật / tắt thủ công chế độ tiết kiệm hiệu năng
   */
  setLowPerfMode(enable) {
    this._manualOverride = enable;
    try {
      if (enable === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, String(enable));
      }
    } catch {}
    this.applyTheme();
  }

  /**
   * Đồng bộ class lên body để CSS tự động tắt hiệu ứng nặng
   */
  applyTheme() {
    const active = this.isLowPerf();
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.toggle("low-perf", active);
      document.body.dataset.perfMode = active ? "eco" : "high";
    }
  }

  /**
   * Khuyến nghị số lượng hạt cho Canvas Confetti
   */
  getConfettiCount(defaultCount = 120) {
    return this.isLowPerf() ? Math.min(35, defaultCount) : defaultCount;
  }

  /**
   * Khuyến nghị thời lượng hiệu ứng (ms)
   */
  getAnimationDuration(defaultMs = 3500) {
    return this.isLowPerf() ? Math.min(2000, defaultMs) : defaultMs;
  }
}

export const perf = new PerformanceEngine();
