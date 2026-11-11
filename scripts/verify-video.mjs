import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg.exe");
const file = process.argv[2] || "videos/output/Tareeq-test-v1.mp4";
const W = 780;
const H = 1688;

const samples = [6, 30, 70, 110, 160, 220, 290, 350, 420, 470, 530, 600, 660, 720, 780, 830];

function frameAt(sec) {
  const r = spawnSync(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", String(sec), "-i", file, "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { encoding: "buffer", maxBuffer: 1024 * 1024 * 50 });
  return r.stdout;
}

function band(buf) {
  const y0 = Math.floor(H * 0.78);
  let ink = 0, minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = y0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (buf[y * W + x] > 190) {
        ink++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { ink, minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function connected(buf) {
  let total = 0, joined = 0;
  for (let y = 1300; y < H; y++) {
    let run = 0;
    for (let x = 0; x < W; x++) {
      if (buf[y * W + x] > 190) { run++; total++; } else { if (run >= 6) joined += run; run = 0; }
    }
    if (run >= 6) joined += run;
  }
  return total ? joined / total : 0;
}

console.log(`فحص: ${file}`);
let ok = 0;
let bad = 0;

for (const s of samples) {
  const buf = frameAt(s);
  if (!buf || buf.length < W * H) { console.log(`  ${String(s).padStart(4)}s قراءة فشل`); bad++; continue; }
  const b = band(buf);
  const cr = connected(buf);
  const hasText = b.ink > 700 && b.w > 140 && cr > 0.2;
  if (hasText) ok++; else bad++;
  console.log(
    `  ${String(s).padStart(4)}s  حبر=${String(b.ink).padStart(5)}  عرض=${String(b.w).padStart(4)}  ارتفاع=${String(b.h).padStart(3)}  اتصال=${(cr * 100).toFixed(0)}%  ->  ${hasText ? "ترجمة سليمة" : "مفيش ترجمة (إطار عادي)"}`
  );
}

console.log(`\n>>> فيه ترجمة مظبوطة في ${ok}/${samples.length} عينة، ومش مظبوطة في ${bad}`);