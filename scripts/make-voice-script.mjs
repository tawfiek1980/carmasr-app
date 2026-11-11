import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg.exe");
const BUILD = path.resolve("videos/build");
const VOICE = path.resolve("videos/voice");
const OUT = path.resolve("videos/output");

const TITLES = {
  1: "الشاشة الرئيسية",
  2: "إنشاء حساب جديد",
  3: "تسجيل الدخول",
  4: "استكمال بيانات الشركة أو المعرض",
  5: "نشر إعلان بيع شاحنة",
  6: "رفع صور الإعلان",
  7: "نشر الإعلان وإدارته",
  8: "نشر إعلان إيجار",
  9: "تفاصيل الإعلان",
  10: "التواصل مع المعلن",
  11: "الرسائل داخل التطبيق",
  12: "طلب حمولة ونقل",
  13: "إضافة وظيفة",
};

function dur(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = (r.stderr || "").match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]) : 0;
}

const p = (s) => String(s).padStart(2, "0");
const tc = (s) => `${p(Math.floor(s / 60))}:${p(Math.floor(s % 60))}`;
const srtTc = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${p(h)}:${p(m)}:${p(sec)},${String(ms).padStart(3, "0")}`;
};

const segments = [];
let offset = 0;

const introDur = fs.existsSync(path.join(BUILD, "seg-00.mp4")) ? dur(path.join(BUILD, "seg-00.mp4")) : 4;
segments.push({ kind: "card", name: "كارت البداية", start: 0, end: introDur, lines: ["تطبيق كار مصر", "جولة سريعة في التطبيق"] });
offset = introDur;

for (let i = 1; i <= 13; i++) {
  const n = String(i).padStart(2, "0");
  const mp4 = path.join(BUILD, `seg-${n}.mp4`);
  const ass = path.join(BUILD, `seg-${n}.ass`);
  if (!fs.existsSync(mp4) || !fs.existsSync(ass)) continue;
  const d = dur(mp4);
  const t = (x) => { const a = x.split(":"); return +a[0] * 3600 + +a[1] * 60 + parseFloat(a[2]); };
  const events = fs.readFileSync(ass, "utf8").split("\n")
    .filter((l) => l.startsWith("Dialogue:"))
    .map((l) => {
      const f = l.split(",");
      return { style: f[3], start: t(f[1]), end: t(f[2]), text: f.slice(9).join(",").replace(/\{\\[^}]*\}/g, "").replace(/\\N/g, " ") };
    })
    .filter((e) => e.text.trim());

  segments.push({
    kind: "clip",
    index: i,
    name: TITLES[i],
    start: offset,
    end: offset + d,
    lines: events.filter((e) => e.style === "Sub").map((e) => ({ ...e, gStart: e.start + offset, gEnd: e.end + offset })),
    titleEvent: events.find((e) => e.style === "Title") || null,
  });
  offset += d;
}

const outroDur = fs.existsSync(path.join(BUILD, "seg-99.mp4")) ? dur(path.join(BUILD, "seg-99.mp4")) : 4;
segments.push({ kind: "card", name: "كارت النهاية", start: offset, end: offset + outroDur, lines: ["حمّل التطبيق وابدأ دلوقتي", "كار مصر CarMasr"] });

fs.mkdirSync(VOICE, { recursive: true });

const md = [];
const json = [];
const srt = [];
let n = 0;

md.push("# سكربت التعليق الصوتي - متوافق مع التوقيت الفعلي للفيديو");
md.push("");
md.push(`مدة الفيديو: ${tc(offset + outroDur)} (${Math.round(offset + outroDur)} ثانية)`);
md.push("");
md.push("## طريقة التسجيل");
md.push("");
md.push("- سجّل كل كليب في ملف منفصل بالاسم ده: `01.mp3` … `13.mp3`");
md.push("- كل سطر ليه وقت محدد — ابدأه في التوقيت ده بالظبط");
md.push("- سيب فاصل صمت بين السطور (0.3 – 0.6 ثانية)");
md.push("- السرعة المستهدفة: 2.2 – 2.6 كلمة في الثانية");
md.push("");
md.push("| الكليب | التوقيت | المدة | السطر | الكلمات | السرعة المطلوبة |");
md.push("|---|---|---|---|---|---|");

const fast = [];

for (const s of segments) {
  if (s.kind === "card") {
    for (const line of s.lines) {
      n++;
      const words = line.trim().split(/\s+/).length;
      const avail = Math.max(1, s.end - s.start) / s.lines.length;
      const speed = words / avail;
      md.push(`| كارت | ${tc(s.start)} | ${avail.toFixed(1)}s | ${line} | ${words} | ${speed.toFixed(1)} كلمة/ث |`);
      srt.push(`${n}\n${srtTc(s.start)} --> ${srtTc(s.end)}\n${line}\n`);
    }
    continue;
  }

  json.push({ index: s.index, name: s.name, start: s.start, end: s.end, lines: s.lines.map((l) => ({ start: l.gStart, end: l.gEnd, text: l.text })) });

  const clipMd = [`# ${String(s.index).padStart(2, "0")} - ${s.name}`, "", `بداية الكليب في الفيديو: ${tc(s.start)}  |  المدة: ${(s.end - s.start).toFixed(1)} ثانية`, ""];
  const perFile = [];

  s.lines.forEach((l, i) => {
    const words = l.text.trim().split(/\s+/).length;
    const avail = l.end - l.start;
    const speed = words / avail;
    md.push(`| ${String(s.index).padStart(2, "0")} | ${tc(l.gStart)} → ${tc(l.gEnd)} | ${avail.toFixed(1)}s | ${l.text} | ${words} | ${speed.toFixed(1)} كلمة/ث |`);
    clipMd.push(`- [${tc(l.start)} → ${tc(l.end)}]  (${avail.toFixed(1)} ثانية)  ${l.text}`);
    perFile.push({ relStart: +l.start.toFixed(2), relEnd: +l.end.toFixed(2), text: l.text, words });
    if (speed > 2.9) fast.push(`كليب ${s.index}: "${l.text.slice(0, 40)}..." تحتاج ${speed.toFixed(1)} كلمة/ث (سريع)`);
  });

  clipMd.push("");
  fs.writeFileSync(path.join(VOICE, `${String(s.index).padStart(2, "0")}.txt`), clipMd.join("\n"), "utf8");
  fs.writeFileSync(path.join(VOICE, `${String(s.index).padStart(2, "0")}.json`), JSON.stringify({ index: s.index, name: s.name, startInVideo: s.start, lines: perFile }, null, 2), "utf8");

  s.lines.forEach((l) => {
    n++;
    srt.push(`${n}\n${srtTc(l.gStart)} --> ${srtTc(l.gEnd)}\n${l.text}\n`);
  });
}

md.push("");
md.push("## الكارتان");
md.push("");
md.push(`- كارت البداية: ${tc(0)} → ${tc(introDur)}`);
md.push(`- كارت النهاية: ${tc(offset)} → ${tc(offset + outroDur)}`);

fs.writeFileSync(path.resolve("videos/voice-script-timed.md"), md.join("\n"), "utf8");
fs.writeFileSync(path.join(VOICE, "timing.json"), JSON.stringify({ totalDuration: +(offset + outroDur).toFixed(2), segments }, null, 2), "utf8");
fs.writeFileSync(path.join(OUT, "Tareeq-test-v1.srt"), srt.join("\n"), "utf8");

console.log(`مدة الفيديو: ${tc(offset + outroDur)}`);
console.log(`عدد السطور: ${n}`);
console.log("الملفات:");
console.log("  videos/voice-script-timed.md");
console.log("  videos/voice/timing.json");
console.log("  videos/voice/01.txt … 13.txt + 01.json … 13.json");
console.log("  videos/output/Tareeq-test-v1.srt");
if (fast.length) console.log("\nسطور محتاجة سرعة عالية:\n" + fast.join("\n"));
else console.log("\nكل السطور ضمن السرعة المقبولة");