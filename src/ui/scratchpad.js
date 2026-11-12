// Digital Scratchpad Studio — giấy nháp điện tử đa màu sắc, lưới tọa độ, Undo & ghi chú tính toán.
import { iconSvg } from "./icons.js";

let modal = null;
let canvas = null;
let ctx = null;
let isDrawing = false;
let mode = "draw"; // 'draw' | 'erase'
let currentStrokeColor = "#818CF8";
let currentLineWidth = 2.8;
let historyStack = [];

const COLORS = [
  { color: "#818CF8", label: "Tím Indigo" },
  { color: "#06B6D4", label: "Xanh Cyan" },
  { color: "#10B981", label: "Xanh Ngọc" },
  { color: "#F59E0B", label: "Vàng Hổ phách" },
  { color: "#F43F5E", label: "Đỏ Hồng" },
  { color: "#F8FAFC", label: "Trắng phấn" }
];

export function initScratchpad() {
  createScratchpadModal();
}

export function openScratchpad() {
  if (!modal) initScratchpad();
  modal.classList.add("open");
  requestAnimationFrame(() => resizeCanvas());
}

export function closeScratchpad() {
  if (modal) modal.classList.remove("open");
}

function createScratchpadModal() {
  modal = document.createElement("div");
  modal.id = "scratchpadModal";
  modal.className = "modal-overlay";

  const swatchesHtml = COLORS.map(
    (c, idx) =>
      `<button type="button" class="sp-color-dot ${idx === 0 ? "active" : ""}" data-color="${c.color}" title="${c.label}" style="--dot-color:${c.color}"></button>`
  ).join("");

  modal.innerHTML = `
    <div class="modal sheet-modal wide scratchpad-sheet" role="dialog" aria-modal="true" aria-label="Giấy nháp điện tử">
      <div class="modal-head sp-header">
        <div class="scratch-tools">
          <button class="tool-btn active" id="spPenBtn" title="Bút vẽ">${iconSvg("PenTool", 15)} <span>Bút</span></button>
          <button class="tool-btn" id="spEraserBtn" title="Tẩy">${iconSvg("Trash2", 15)} <span>Tẩy</span></button>
          <button class="tool-btn" id="spUndoBtn" title="Hoàn tác nét vừa vẽ">${iconSvg("Undo2", 15)} <span>Hoàn tác</span></button>
          <button class="tool-btn active" id="spGridBtn" title="Bật/tắt giấy kẻ ô vuông">${iconSvg("LayoutGrid", 15)} <span>Lưới ô</span></button>
          <button class="tool-btn danger" id="spClearBtn" title="Xóa toàn bộ">${iconSvg("RotateCw", 15)} <span>Xóa nháp</span></button>
        </div>
        <div class="sp-color-bar" id="spColorBar">
          ${swatchesHtml}
        </div>
        <button class="icon-btn" id="spCloseBtn" aria-label="Đóng">${iconSvg("X", 20)}</button>
      </div>
      <div class="scratch-canvas-wrap grid-bg" id="spCanvasWrap">
        <canvas id="spCanvas"></canvas>
      </div>
      <textarea id="spNotes" class="input scratch-notes" placeholder="Gõ nhanh công thức, số liệu trung gian hoặc dàn ý tại đây..."></textarea>
    </div>
  `;

  document.body.appendChild(modal);

  canvas = document.getElementById("spCanvas");
  ctx = canvas.getContext("2d", { desynchronized: true });

  document.getElementById("spCloseBtn").addEventListener("click", closeScratchpad);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeScratchpad();
  });

  const penBtn = document.getElementById("spPenBtn");
  const eraserBtn = document.getElementById("spEraserBtn");
  const undoBtn = document.getElementById("spUndoBtn");
  const gridBtn = document.getElementById("spGridBtn");
  const clearBtn = document.getElementById("spClearBtn");
  const wrap = document.getElementById("spCanvasWrap");

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

  undoBtn.addEventListener("click", () => {
    if (historyStack.length > 0) {
      const prev = historyStack.pop();
      ctx.putImageData(prev, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });

  gridBtn.addEventListener("click", () => {
    const hasGrid = wrap.classList.toggle("grid-bg");
    gridBtn.classList.toggle("active", hasGrid);
  });

  clearBtn.addEventListener("click", () => {
    saveSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("spNotes").value = "";
  });

  document.getElementById("spColorBar").addEventListener("click", (e) => {
    const dot = e.target.closest(".sp-color-dot");
    if (!dot) return;
    currentStrokeColor = dot.dataset.color || "#818CF8";
    mode = "draw";
    penBtn.classList.add("active");
    eraserBtn.classList.remove("active");
    modal.querySelectorAll(".sp-color-dot").forEach((d) => d.classList.toggle("active", d === dot));
  });

  setupDrawingEvents();
}

function saveSnapshot() {
  if (!canvas || !canvas.width || !canvas.height) return;
  try {
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyStack.push(snap);
    if (historyStack.length > 15) historyStack.shift();
  } catch {}
}

function resizeCanvas() {
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (!wrap) return;

  const rect = wrap.getBoundingClientRect();
  if (rect.width && rect.height) {
    let temp = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        temp = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {}
    }
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (temp) ctx.putImageData(temp, 0, 0);
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
    saveSnapshot();
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
      ctx.lineWidth = 22;
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
