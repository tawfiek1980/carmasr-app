import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg.exe");
const BUILD = path.resolve("videos/build");
const VIDEO = process.argv[2] || "videos/output/Tareeq-test-v1.mp4";
const W = 780;
const H = 1688;

const order = ["seg-00", ...Array.from({ length: 13 }, (_, i) => `seg-${String(i + 1).padStart(2, "0")}`), "seg-99"];

function dur(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]) : 0;
}

function assWindows(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n")
    .filter((l) => l.startsWith("Dialogue:"))
    .map((l) => {
      const p = l.split(",");
      const t = (s) => { const a = s.split(":"); return +a[0] * 3600 + +a[1] * 60 + parseFloat(a[2]); };
      return { style: p[3], start: t(p[1]), end: t(p[2]) };
    });
}

function frameAt(sec) {
  const r = spawnSync(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", sec.toFixed(2), "-i", VIDEO, "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { encoding: "buffer", maxBuffer: 1024 * 1024 * 50 });
  return r.stdout && r.stdout.length >= W * H ? r.stdout : null;
}

function diffStats(a, b) {
  let ink = 0, minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.abs(a[y * W + x] - b[y * W + x]);
      if (d > 60) {
        ink++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  let total = 0, joined = 0;
  for (let y = minY; y <= maxY; y++) {
    let run = 0;
    for (let x = minX; x <= maxX; x++) {
      const d = Math.abs(a[y * W + x] - b[y * W + x]);
      if (d > 60) { run++; total++; } else { if (run >= 5) joined += run; run = 0; }
    }
    if (run >= 5) joined += run;
  }
  return { ink, w: maxX - minX + 1, h: maxY - minY + 1, minY, maxY, cr: total ? joined / total : 0 };
}

let offset = 0;
let pass = 0;
let fail = 0;
const rows = [];

for (const name of order) {
  const segFile = path.join(BUILD, `${name}.mp4`);
  if (!fs.existsSync(segFile)) continue;
  const d = dur(segFile);
  const wins = assWindows(path.join(BUILD, `${name}.ass`));
  const sub = wins.find((w) => w.style === "Sub");
  if (!sub) { offset += d; continue; }
  const mid = (sub.start + sub.end) / 2;
  const gaps = wins.filter((w) => w.end < sub.start || w.start > sub.end);
  const blankLocal = gaps.length
    ? Math.max(0.1, (gaps[0].end + gaps[0].start) / 2)
    : Math.max(0.1, sub.start - 0.4);
  const f1 = frameAt(offset + mid);
  const f2 = frameAt(offset + Math.min(blankLocal, d - 0.2));
  if (!f1 || !f2) { rows.push(`${name}: فشل استخراج الإطار`); fail++; offset += d; continue; }
  const s = diffStats(f1, f2);
  const good = s.ink > 700 && s.w > 140 && s.cr > 0.2 && s.h > 12 && s.h < 200;
  good ? pass++ : fail++;
  rows.push(
    `${name}  فرق=${String(s.ink).padStart(5)}  عرض=${String(s.w).padStart(4)}  ارتفاع=${String(s.h).padStart(3)}  اتصال=${(s.cr * 100).toFixed(0)}%  ->  ${good ? "ترجمة سليمة" : "مشكلة"}`
  );
  offset += d;
}

console.log(rows.join("\n"));
console.log(`\n>>> الترجمة سليمة في ${pass} كليب، وفي ${fail} كليب مشكلة`);