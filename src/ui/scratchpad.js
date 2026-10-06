// Digital Scratchpad — giấy nháp điện tử vẽ tay & ghi chú tính toán ngay trong phòng thi.
import { iconSvg } from "./icons.js";

let modal = null;
let canvas = null;
let ctx = null;
let isDrawing = false;
let mode = "draw"; // 'draw' | 'erase'
let currentStrokeColor = "#A78BFA";
let currentLineWidth = 2.5;

export function initScratchpad() {
  createScratchpadModal();
}

export function openScratchpad() {
  if (!modal) initScratchpad();
  modal.classList.add("open");
  resizeCanvas();
}

export function closeScratchpad() {
  if (modal) modal.classList.remove("open");
}

function createScratchpadModal() {
  modal = document.createElement("div");
  modal.id = "scratchpadModal";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal sheet-modal wide scratchpad-sheet" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div class="scratch-tools">
          <button class="tool-btn active" id="spPenBtn" title="Bút vẽ">${iconSvg("PenTool", 16)} <span>Bút</span></button>
          <button class="tool-btn" id="spEraserBtn" title="Tẩy">${iconSvg("Trash2", 16)} <span>Tẩy</span></button>
          <button class="tool-btn danger" id="spClearBtn" title="Xóa toàn bộ">${iconSvg("RotateCw", 16)} <span>Làm mới</span></button>
        </div>
        <button class="icon-btn" id="spCloseBtn" aria-label="Đóng">${iconSvg("X", 20)}</button>
      </div>
      <div class="scratch-canvas-wrap">
        <canvas id="spCanvas"></canvas>
      </div>
      <textarea id="spNotes" class="input scratch-notes" placeholder="Hoặc gõ nhanh nháp công thức, dữ kiện tính toán tại đây..."></textarea>
    </div>
  `;

  document.body.appendChild(modal);

  canvas = document.getElementById("spCanvas");
  ctx = canvas.getContext("2d", { desynchronized: true });

  // Listeners
  document.getElementById("spCloseBtn").addEventListener("click", closeScratchpad);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeScratchpad();
  });

  const penBtn = document.getElementById("spPenBtn");
  const eraserBtn = document.getElementById("spEraserBtn");
  const clearBtn = document.getElementById("spClearBtn");

  penBtn.addEventListener("click", () => {
    mode = "draw";
    penBtn.classList.add("active");
    eraserBtn.classList.remove("active");
  });

  eraserBtn.addEventListener("click", () => {
    mode = "erase";
    eraserBtn.classList.add("active");
    penBtn.classList.remove("active");
  });

  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("spNotes").value = "";
  });

  setupDrawingEvents();
}

function resizeCanvas() {
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (!wrap) return;

  const rect = wrap.getBoundingClientRect();
  if (rect.width && rect.height) {
    // Lưu lại nét vẽ cũ
    const temp = ctx.getImageData(0, 0, canvas.width || 1, canvas.height || 1);
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.putImageData(temp, 0, 0);
  }
}

function setupDrawingEvents() {
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const start = (e) => {
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (mode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = currentStrokeColor;
      ctx.lineWidth = currentLineWidth;
    }

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stop = () => {
    isDrawing = false;
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", draw);
  window.addEventListener("mouseup", stop);

  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  window.addEventListener("touchend", stop);
}
