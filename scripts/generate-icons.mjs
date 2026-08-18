/**
 * Generates placeholder PNG icons for the Teams app manifest.
 * Usage: npm run icons
 *
 * The output replaces manifest/color.png (192x192) and manifest/outline.png (32x32).
 * Replace them with real brand icons before publishing the app to Teams.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'manifest');

// ---- Minimal PNG encoder (no external dependencies) ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

/** Builds a PNG from a pixel function returning [r, g, b, a]. */
function createPng(width, height, pixelAt) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      const offset = (y * width + x) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = a;
    }
  }

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Icons ----

const TEAMS_PURPLE = [98, 100, 167];

// Color icon: 192x192 purple rounded square with a white ring.
const COLOR_SIZE = 192;
const colorIcon = createPng(COLOR_SIZE, COLOR_SIZE, (x, y) => {
  const margin = COLOR_SIZE * 0.06;
  const inside = x >= margin && x < COLOR_SIZE - margin && y >= margin && y < COLOR_SIZE - margin;

  const cx = COLOR_SIZE / 2;
  const cy = COLOR_SIZE / 2;
  const distance = Math.hypot(x - cx, y - cy);
  const ring = distance >= COLOR_SIZE * 0.3 && distance <= COLOR_SIZE * 0.42;

  if (ring) return [255, 255, 255, 255];
  if (inside) return [...TEAMS_PURPLE, 255];
  return [0, 0, 0, 0];
});

// Outline icon: 32x32 transparent with a white border (2px).
const OUTLINE_SIZE = 32;
const outlineIcon = createPng(OUTLINE_SIZE, OUTLINE_SIZE, (x, y) => {
  const thickness = 2;
  const onBorder =
    (x < thickness || x >= OUTLINE_SIZE - thickness || y < thickness || y >= OUTLINE_SIZE - thickness) &&
    x > 0 && x < OUTLINE_SIZE - 1 && y > 0 && y < OUTLINE_SIZE - 1;
  return onBorder ? [255, 255, 255, 255] : [0, 0, 0, 0];
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'color.png'), colorIcon);
writeFileSync(join(OUT_DIR, 'outline.png'), outlineIcon);
console.log('Icons generated: manifest/color.png and manifest/outline.png');
