// Web Audio API Synthesizer — âm thanh vi mô êm dịu, không cần file MP3 ngoài.
// Hoạt động offline 100%, tự động giải phóng tài nguyên.

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled() {
  return localStorage.getItem("quitz_sound_enabled") !== "0";
}

export function setSoundEnabled(enabled) {
  localStorage.setItem("quitz_sound_enabled", enabled ? "1" : "0");
}

export function triggerHaptic(pattern = 15) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
}

/**
 * Âm thanh khi chọn đúng: Hợp âm chuông trong trẻo (C5 -> G5)
 */
export function playCorrectSound() {
  if (!isSoundEnabled()) return;
  triggerHaptic(15);
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + idx * 0.05);

    gain.gain.setValueAtTime(0, now + idx * 0.05);
    gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.05 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.05);
    osc.stop(now + idx * 0.05 + 0.36);
  });
}

/**
 * Âm thanh khi chọn sai: Âm thud trầm nhẹ, không gây ức chế
 */
export function playWrongSound() {
  if (!isSoundEnabled()) return;
  triggerHaptic([30, 40, 30]);
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.26);
}

/**
 * Âm thanh khi hoàn thành bài thi: Chuỗi giai điệu vui tươi
 */
export function playCompleteSound() {
  if (!isSoundEnabled()) return;
  triggerHaptic([20, 50, 20, 50, 40]);
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const melody = [
    { freq: 523.25, time: 0, dur: 0.12 },     // C5
    { freq: 659.25, time: 0.1, dur: 0.12 },    // E5
    { freq: 783.99, time: 0.2, dur: 0.14 },    // G5
    { freq: 1046.5, time: 0.32, dur: 0.4 }     // C6
  ];

  melody.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0, now + time);
    gain.gain.linearRampToValueAtTime(0.15, now + time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + time);
    osc.stop(now + time + dur + 0.02);
  });
}

/**
 * Âm thanh lật thẻ 3D (Card Flip Swoosh)
 */
export function playFlipSound() {
  if (!isSoundEnabled()) return;
  triggerHaptic(10);
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(450, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.11);
}

/**
 * Âm thanh đếm ngược những giây cuối (Tick)
 */
export function playTickSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(880, now);

  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}

