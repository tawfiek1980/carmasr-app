import fs from "node:fs";
import { execFileSync } from "node:child_process";

const ff = "node_modules/ffmpeg-static/ffmpeg.exe";

function info(file) {
  let out = "";
  try {
    execFileSync(ff, ["-hide_banner", "-i", file], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    out = String(e.stderr || "");
  }
  const dur = (out.match(/Duration:\s*(\d+):(\d+):([\d.]+)/) || []);
  const seconds = dur.length ? +dur[1] * 3600 + +dur[2] * 60 + parseFloat(dur[3]) : NaN;
  const audio = (out.match(/Audio:\s*([^\n]+)/) || [])[1] || "—";
  const video = (out.match(/Video:\s*([^\n]+)/) || [])[1] || "—";
  const size = (out.match(/bitrate:\s*(\d+ kb\/s)/) || [])[1] || "—";
  return { seconds, audio: audio.trim().slice(0, 60), video: video.trim().slice(0, 60), size };
}

const v = "videos/output/Tareeq-final-v2.mp4";
const vi = info(v);
console.log("=== الفيديو النهائي ===");
console.log("المدة:", vi.seconds.toFixed(2) + "s  |", vi.size);
console.log("Audio:", vi.audio);
console.log("Video:", vi.video);

const t = JSON.parse(fs.readFileSync("videos/voice/timing.json", "utf8"));
const segs = t.segments.filter((s) => s.kind === "clip");
console.log("\n=== مدة كل كليب صوت (المطلوب = مدة الكليب) ===");
let bad = 0;
for (const c of segs) {
  const n = String(c.index).padStart(2, "0");
  const want = c.end - c.start;
  const got = info(`videos/voice/${n}.mp3`).seconds;
  const diff = Math.abs(got - want);
  const ok = diff <= 0.15;
  if (!ok) bad++;
  console.log(
    `${n} | ${c.name.slice(0, 24).padEnd(24)} | المطلوب ${want.toFixed(2)}s | الفعلي ${got.toFixed(2)}s | ${ok ? "OK" : "فرق " + diff.toFixed(2) + "s"}`
  );
}
console.log(`\nمطابقات: ${segs.length - bad}/${segs.length}`);

const total = segs.reduce((a, c) => a + (c.end - c.start), 0);
console.log(`\nإجمالي الكليبات: ${total.toFixed(2)}s + كارت 4s × 2 = ${(total + 8).toFixed(2)}s (الفيديو ${vi.seconds.toFixed(2)}s)`);