import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg.exe");
const BUILD = path.resolve("videos/build");
const W = 700;
const H = 160;

function ass(font) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: T,${font},56,&H00FFFFFF,&H00FFFFFF,&H00202020,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,20,20,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,T,,0,0,0,,كار مصر
`;
}

function render(font, fontsRel) {
  fs.writeFileSync(path.join(BUILD, "f2.ass"), ass(font), "utf8");
  const r = spawnSync(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", `color=c=black:s=${W}x${H}`,
    "-vf", `subtitles=videos/build/f2.ass:fontsdir=${fontsRel}`,
    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { encoding: "buffer", maxBuffer: 1024 * 1024 * 50 });
  return r.stdout;
}

function show(label, buf) {
  console.log(`\n########## ${label}`);
  if (!buf || buf.length < W * H) { console.log("  (فاضي)"); return; }
  let minX = W, maxX = 0, minY = H, maxY = 0, ink = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (buf[y * W + x] > 100) {
        ink++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`  ink=${ink}  bbox x:${minX}-${maxX} y:${minY}-${maxY}  size=${maxX - minX + 1}x${maxY - minY + 1}`);
  const step = Math.max(1, Math.ceil((maxY - minY + 1) / 56));
  for (let y = minY; y <= maxY; y += step) {
    let line = "";
    for (let x = minX; x <= maxX; x += 1) line += buf[y * W + x] > 100 ? "#" : " ";
    console.log("  " + line);
  }
}

show("Dubai (videos/build/fonts)", render("Dubai", "videos/build/fonts"));
show("Tahoma (videos/build/fonts-all)", render("Tahoma", "videos/build/fonts-all"));