import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg.exe");
const BUILD = path.resolve("videos/build");
const CLIPS = path.resolve("videos/clips");
const W = 780;
const H = 1688;

const picks = [
  ["01-الرئيسية.mp4", "seg-01"],
  ["02-إنشاء-حساب.mp4", "seg-02"],
  ["03-تسجيل-الدخول.mp4", "seg-03"],
  ["04-استكمال-البيانات-شركة-معرض.mp4", "seg-04"],
  ["05-بيع-شاحنة.mp4", "seg-05"],
  ["11-رفع-الصور.mp4", "seg-06"],
  ["13-نشر-إعلان-بالصور-وإدارته-من-البروفايل.mp4", "seg-07"],
  ["06-إيجار-شاحنة.mp4", "seg-08"],
  ["07-تفاصيل-إعلان.mp4", "seg-09"],
  ["12-التواصل-مع-المعلن.mp4", "seg-10"],
  ["08-الرسائل.mp4", "seg-11"],
  ["09-إضافة-حمولة.mp4", "seg-12"],
  ["10-إضافة-وظيفة.mp4", "seg-13"],
];

function subWindow(assFile) {
  const txt = fs.readFileSync(assFile, "utf8");
  const t = (s) => { const a = s.split(":"); return +a[0] * 3600 + +a[1] * 60 + parseFloat(a[2]); };
  const line = txt.split("\n").filter((l) => l.startsWith("Dialogue")).map((l) => l.split(",")).find((p) => p[3] === "Sub");
  return line ? (t(line[1]) + t(line[2])) / 2 : 5;
}

function frame(clip, time, withSubs, seg) {
  const vf = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,fps=30` +
    (withSubs ? `,subtitles=videos/build/${seg}.ass:fontsdir=videos/build/fonts` : "");
  const r = spawnSync(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", path.join(CLIPS, clip), "-ss", time.toFixed(2),
    "-vf", vf, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { encoding: "buffer", maxBuffer: 1024 * 1024 * 50 });
  return r.stdout && r.stdout.length >= W * H ? r.stdout : debugFail(r, clip, time, withSubs);
}

function debugFail(r, clip, time, withSubs) {
  console.log(`   [debug] ${clip} t=${time} subs=${withSubs} status=${r.status} bytes=${r.stdout ? r.stdout.length : 0} err=${(r.stderr || "").toString().slice(0, 200)}`);
  return null;
}

function diff(a, b) {
  let ink = 0, minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.abs(a[y * W + x] - b[y * W + x]) > 50) {
      ink++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  let total = 0, joined = 0;
  for (let y = minY; y <= maxY; y++) {
    let run = 0;
    for (let x = minX; x <= maxX; x++) {
      if (Math.abs(a[y * W + x] - b[y * W + x]) > 50) { run++; total++; }
      else { if (run >= 5) joined += run; run = 0; }
    }
    if (run >= 5) joined += run;
  }
  return { ink, w: maxX - minX + 1, h: maxY - minY + 1, cr: total ? joined / total : 0, minY, maxY };
}

let pass = 0, fail = 0;
for (const [clip, seg] of picks) {
  const t = subWindow(path.join(BUILD, `${seg}.ass`));
  const a = frame(clip, t, true, seg);
  const b = frame(clip, t, false, seg);
  if (!a || !b) { console.log(`${seg}: فشل استخراج`); fail++; continue; }
  const s = diff(a, b);
  const bottom = s.minY > H * 0.6;
  const good = s.ink > 700 && s.w > 140 && s.cr > 0.2 && s.h > 12 && s.h < 200 && bottom;
  good ? pass++ : fail++;
  console.log(`${seg}  حبر=${String(s.ink).padStart(5)}  عرض=${String(s.w).padStart(4)}  ارتفاع=${String(s.h).padStart(3)}  اتصال=${(s.cr * 100).toFixed(0)}%  تحت=${bottom ? "نعم" : "لا"}  ->  ${good ? "سليم" : "مشكلة"}`);
}
console.log(`\n>>> ${pass} سليم / ${fail} مشكلة`);