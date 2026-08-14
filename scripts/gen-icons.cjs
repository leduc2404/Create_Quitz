/* Generates PNG PWA icons — pure JS, no native deps. Run: npm run icons */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------- Minimal PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba /* Uint8Array w*h*4 */) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter none
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- Drawing helpers ----------
function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
const STOPS = [
  { t: 0, c: hex("#667eea") },
  { t: 0.5, c: hex("#764ba2") },
  { t: 1, c: hex("#f5576c") }
];

function gradientAt(t) {
  let a = STOPS[0];
  let b = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t >= STOPS[i].t && t <= STOPS[i + 1].t) {
      a = STOPS[i];
      b = STOPS[i + 1];
      break;
    }
  }
  const f = (t - a.t) / (b.t - a.t || 1);
  return [
    Math.round(a.c[0] + (b.c[0] - a.c[0]) * f),
    Math.round(a.c[1] + (b.c[1] - a.c[1]) * f),
    Math.round(a.c[2] + (b.c[2] - a.c[2]) * f)
  ];
}

// 5x7 pixel font for letter "Q" (1 = pixel on)
const Q_FONT = ["01110", "10001", "10001", "10001", "10001", "10010", "01101"];

function drawIcon(size, { maskable = false } = {}) {
  const px = new Uint8Array(size * size * 4);
  const r = maskable ? 0 : size * (112 / 512); // rounded corner radius
  const glyphScale = maskable ? 0.44 : 0.58; // letter size relative to icon
  const glyph = size * glyphScale;
  const gx = (size - glyph) / 2;
  const gy = (size - glyph) / 2 - size * 0.02;
  const cell = glyph / 5;

  function insideRoundedRect(x, y) {
    if (maskable) return true;
    // Check rounded square
    const inside = x >= 0 && x < size && y >= 0 && y < size;
    if (!inside) return false;
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r || (x >= r && x <= size - r) || (y >= r && y <= size - r);
  }

  function isLetter(x, y) {
    const lx = (x - gx) / cell;
    const ly = (y - gy) / cell;
    if (lx < 0 || ly < 0 || lx >= 5 || ly >= 7) return false;
    return Q_FONT[Math.floor(ly)][Math.floor(lx)] === "1";
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!insideRoundedRect(x, y)) {
        px[i + 3] = 0; // transparent
        continue;
      }
      const t = (x + y) / (2 * size);
      let [cr, cg, cb] = gradientAt(t);
      if (isLetter(x, y)) {
        cr = cg = cb = 255;
      }
      px[i] = cr;
      px[i + 1] = cg;
      px[i + 2] = cb;
      px[i + 3] = 255;
    }
  }
  return encodePNG(size, size, px);
}

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180 }
];

for (const t of targets) {
  fs.writeFileSync(path.join(OUT_DIR, t.file), drawIcon(t.size, t));
  console.log("✓", t.file, `${t.size}x${t.size}`);
}
console.log("Icons saved to public/icons/");
