// Canvas Confetti — hiệu ứng pháo hoa hạt giấy 3D nổ tung chúc mừng (0 dependency).
// Siêu nhẹ, mượt mà 60fps, tự động dọn dẹp canvas khi kết thúc.
// Tự động thích ứng giảm hạt và tải GPU trên thiết bị yếu / điện thoại.
import { perf } from "../core/perf.js";

const COLORS = [
  "#7C3AED", "#06B6D4", "#F472B6", "#34D399", "#FBBF24",
  "#60A5FA", "#A78BFA", "#F87171", "#FFFFFF"
];

export function launchConfetti(customDurationMs = null) {
  const isEco = perf.isLowPerf();
  const durationMs = customDurationMs || (isEco ? 2200 : 3500);

  const existing = document.getElementById("confettiCanvas");
  if (existing) existing.remove();

  const canvas = document.createElement("canvas");
  canvas.id = "confettiCanvas";
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d", { desynchronized: true });
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const resizeHandler = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", resizeHandler);

  const maxParticles = isEco ? 35 : 120;
  const particleCount = Math.min(Math.floor(width / (isEco ? 25 : 10)), maxParticles);
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height * 0.4 + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 1.2) * 16,
      size: Math.random() * 8 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rSpeed: (Math.random() - 0.5) * 10,
      wobble: Math.random() * 10,
      wobbleSpeed: Math.random() * 0.1 + 0.05,
      opacity: 1
    });
  }

  const startTime = Date.now();
  let animId = null;

  function loop() {
    const elapsed = Date.now() - startTime;
    if (elapsed > durationMs) {
      window.removeEventListener("resize", resizeHandler);
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const progress = elapsed / durationMs;
    const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // trọng lực
      p.vx *= 0.98; // lực cản
      p.rotation += p.rSpeed;
      p.wobble += p.wobbleSpeed;

      const scaleX = Math.cos(p.wobble);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.scale(scaleX, 1);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, fadeOut);

      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);
}
