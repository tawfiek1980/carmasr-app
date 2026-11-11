import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg.exe");
const BUILD = path.resolve("videos/build");
const FONT_DIR = path.join(BUILD, "fonts");
const ALL_FONTS = path.join(BUILD, "fonts-all");

fs.mkdirSync(ALL_FONTS, { recursive: true });
for (const f of ["DUBAI-BOLD.TTF", "DUBAI-REGULAR.TTF", "tahomabd.ttf", "arialbd.ttf", "segoeuib.ttf", "segoeui.ttf"]) {
  const src = path.join("C:\\Windows\\Fonts", f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(ALL_FONTS, f));
}

const TEXT = "أهلاً بيك في تطبيق كار مصر 3950000 جنيه";

function ass(font, size, extraStyle = "") {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 780
PlayResY: 200
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: T,${font},${size},&H00FFFFFF,&H00FFFFFF,&H00202020,&HB4000000,-1,0,0,0,100,100,0,0,3,10,0,5,40,40,40,1${extraStyle}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,T,,0,0,0,,${TEXT}
`;
}

function render(font, size, fontsRel, extraStyle = "") {
  const assPath = path.join(BUILD, "fonttest.ass");
  fs.writeFileSync(assPath, ass(font, size, extraStyle), "utf8");
  const r = spawnSync(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "info",
    "-f", "lavfi", "-i", "color=c=black:s=780x200",
    "-vf", `subtitles=videos/build/fonttest.ass:fontsdir=${fontsRel}`,
    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { encoding: "buffer", maxBuffer: 1024 * 1024 * 50 });
  return r.stdout;
}

function art(buf, w = 780, h = 200, cols = 150) {
  if (!buf || buf.length < w * h) return "(no pixels)";
  const rows = 34;
  const out = [];
  const step = Math.floor(w / cols);
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    const y0 = Math.floor((ry * h) / rows);
    const y1 = Math.floor(((ry + 1) * h) / rows);
    for (let rx = 0; rx < cols; rx++) {
      const x0 = Math.floor((rx * w) / cols);
      const x1 = Math.floor(((rx + 1) * w) / cols);
      let max = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const v = buf[y * w + x];
          if (v > max) max = v;
        }
      }
      line += max > 170 ? "#" : max > 90 ? "+" : max > 40 ? "." : " ";
    }
    out.push(line);
  }
  return out.join("\n");
}

const cases = [
  ["Dubai", 40, "videos/build/fonts"],
  ["Dubai", 40, "videos/build/fonts-all"],
  ["Tahoma", 40, "videos/build/fonts-all"],
  ["Arial", 40, "videos/build/fonts-all"],
  ["Segoe UI", 40, "videos/build/fonts-all"],
];

for (const [font, size, dir] of cases) {
  const buf = render(font, size, dir);
  console.log(`\n===== Fontname="${font}"  fontsdir=${dir}`);
  console.log(art(buf));
}