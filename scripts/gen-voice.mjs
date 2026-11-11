import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const VOICE_DIR = path.resolve("videos/voice");
const BUILD = path.resolve("videos/build");
const OUT = path.resolve("videos/output");
const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg.exe");

const MERGE_ONLY = process.argv.includes("--merge-only");
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

const envTxt = fs.existsSync(path.join(VOICE_DIR, ".env"))
  ? fs.readFileSync(path.join(VOICE_DIR, ".env"), "utf8")
  : "";
const KEY =
  process.env.ELEVENLABS_API_KEY || (envTxt.match(/ELEVENLABS_API_KEY\s*=\s*(\S+)/) || [])[1] || "";
const VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || (envTxt.match(/ELEVENLABS_VOICE_ID\s*=\s*(\S+)/) || [])[1] || "";

const timing = JSON.parse(fs.readFileSync(path.join(VOICE_DIR, "timing.json"), "utf8"));
const clips = timing.segments.filter((s) => s.kind === "clip");

const ff = (args) => {
  const r = spawnSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args]);
  return r.status === 0;
};

function dur(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { stdio: ["ignore", "pipe", "pipe"] });
  const out = String((r && r.stderr) || "");
  const m = out.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]) : NaN;
}

async function tts(text, previous) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      output_format: "mp3_44100_128",
      ...(previous ? { previous_text: previous } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  for (const clip of clips) {
    const n = String(clip.index).padStart(2, "0");
    const clipDur = clip.end - clip.start;
    const segments = [];
    let prevText = null;
    let warns = 0;

    for (let i = 0; i < clip.lines.length; i++) {
      const line = clip.lines[i];
      const raw = path.join(BUILD, `vo-${n}-${i}.mp3`);
      if (!fs.existsSync(raw)) {
        if (MERGE_ONLY) {
          console.log(`[${n}] مفيش ملف صوت للسطر ${i + 1} — تخطي (شغّل من غير --merge-only أول)`);
          break;
        }
        process.stdout.write(`[${n}] سطر ${i + 1}/${clip.lines.length} … generating… `);
        fs.writeFileSync(raw, await tts(line.text, prevText));
        console.log("ok");
      }
      prevText = line.text;

      const relStart = +line.start.toFixed(3);
      const relEnd = +line.end.toFixed(3);
      const slot = Math.max(0.2, relEnd - relStart);
      const audioLen = dur(raw);
      const needed = relStart + (isNaN(audioLen) ? 0 : audioLen);
      if (!isNaN(audioLen) && audioLen > slot + 0.05) {
        warns++;
        console.log(`   ⚠ سطر ${i + 1}: الصوت ${audioLen.toFixed(2)}s أطول من الميعاد ${slot.toFixed(2)}s — سيتجاوز，淡会被下一个行压过去`);
      }

      const seg = path.join(BUILD, `vos-${n}-${i}.mp3`);
      // القص عند نهاية الميعاد (relEnd) مش عند نهاية الكليب — ده اللي كان بيسبب تضخيم 3×
      const ok = ff([
        "-i", raw,
        "-af", `adelay=${Math.round(relStart * 1000)}:all=1,apad`,
        "-t", String(Math.max(relEnd, needed)),
        "-ar", "44100", "-ac", "2", "-b:a", "128k",
        seg,
      ]);
      if (!ok) throw new Error(`ffmpeg فشل في ${n}-${i}`);
      segments.push(seg);
    }

    if (!segments.length) continue;

    const listFile = path.join(BUILD, `vom-${n}.txt`);
    fs.writeFileSync(listFile, segments.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"), "utf8");
    const clipOut = path.join(VOICE_DIR, `${n}.mp3`);
    if (!ff(["-f", "concat", "-safe", "0", "-i", listFile, "-af", "apad", "-t", String(clipDur), "-c:a", "libmp3lame", "-b:a", "128k", clipOut]))
      throw new Error(`دمج الكليب ${n} فشل`);

    const got = dur(clipOut);
    const okDur = Math.abs(got - clipDur) <= 0.2;
    console.log(`${n} | ${clip.name.slice(0, 22).padEnd(22)} | ${got.toFixed(2)}s / ${clipDur.toFixed(2)}s | ${okDur ? "OK" : "✗"}${warns ? ` (${warns} سطر طويل)` : ""}`);
  }

  // الصوت الكامل: 4s صمت + الكليبات + 4s صمت
  const silence = path.join(BUILD, "silence-4s.mp3");
  ff(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "4", "-c:a", "libmp3lame", silence]);
  const parts = [silence, ...clips.map((c) => path.join(VOICE_DIR, `${String(c.index).padStart(2, "0")}.mp3`)), silence];
  const fullList = path.join(BUILD, "voice-full.txt");
  fs.writeFileSync(fullList, parts.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const voiceFull = path.join(BUILD, "voice-full.mp3");
  if (!ff(["-f", "concat", "-safe", "0", "-i", fullList, "-c:a", "libmp3lame", "-b:a", "160k", voiceFull]))
    throw new Error("دمج الصوت الكامل فشل");
  console.log(`\nالصوت الكامل: ${voiceFull} (${dur(voiceFull).toFixed(2)}s)`);

  const video = path.join(OUT, "Tareeq-test-v1.mp4");
  const final = path.join(OUT, "Tareeq-final-v2.mp4");
  const ok = ff([
    "-i", video, "-i", voiceFull,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart", final,
  ]);
  console.log(ok ? `الفيديو النهائي: ${final}` : "فشل دمج الفيديو");
}

main().catch((e) => { console.error("خطأ:", e.message); process.exit(1); });