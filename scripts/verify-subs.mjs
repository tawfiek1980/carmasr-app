import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg.exe");
const BUILD = path.resolve("videos/build");
const W = 780;
const H = 1688;

function renderAss(assRel, timeSec) {
  const r = spawnSync(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=black:s=780x1688",
    "-vf", `subtitles=${assRel}:fontsdir=videos/build/fonts`,
    "-ss", String(timeSec), "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { encoding: "buffer", maxBuffer: 1024 * 1024 * 50 });
  return r.stdout;
}

function stats(buf, w, h) {
  let ink = 0, minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (buf[y * w + x] > 100) {
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

function connectedRatio(buf, w, h, box) {
  let total = 0, joined = 0;
  for (let y = box.minY; y <= box.maxY; y++) {
    let run = 0;
    for (let x = box.minX; x <= box.maxX; x++) {
      if (buf[y * w + x] > 100) { run++; total++; } else { if (run >= 6) joined += run; run = 0; }
    }
    if (run >= 6) joined += run;
  }
  return total ? joined / total : 0;
}

const assFiles = fs.readdirSync(BUILD).filter((f) => /^seg-\d\d\.ass$/.test(f)).sort();
const mode = process.argv[2] || "quick";
const problems = [];

for (const f of assFiles) {
  const rel = `videos/build/${f}`;
  const times = mode === "full" ? [1, 4, 8, 14, 20] : [4, 12];
  let best = { ink: 0 };
  for (const t of times) {
    const buf = renderAss(rel, t);
    if (!buf || buf.length < 780 * 1688) { problems.push(`${f}: مفيش إطار في الثانية ${t}`); continue; }
    const s = stats(buf, 780, 1688);
    if (s.ink > best.ink) best = { ...s, t, buf };
  }
  if (!best.ink) { problems.push(`${f}: مفيش حروف مرسومة (إطار فاضي)`); continue; }
  const cr = connectedRatio(best.buf, 780, 1688, best);
  const arabicShaped = best.ink > 900 && best.w > 150 && cr > 0.25;
  const status = arabicShaped ? "سليم" : "مشكلة";
  console.log(
    `${f}  حبر=${String(best.ink).padStart(5)}  عرض=${String(best.w).padStart(4)}  ارتفاع=${String(best.h).padStart(3)}  اتصال=${(cr * 100).toFixed(0)}%  ->  ${status}`
  );
  if (!arabicShaped) problems.push(`${f}: الحروف مش متصلة (حبر=${best.ink} عرض=${best.w} اتصال=${(cr * 100).toFixed(0)}%)`);
}

console.log(problems.length ? "\n>>> مشاكل:\n" + problems.join("\n") : "\n>>> كل ملفات الترجمة سليمة الحروف متصلة");