import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FFMPEG = path.resolve("node_modules/ffmpeg-static/ffmpeg.exe");
const FONT_DIR = "videos/build/fonts";
const W = 780;
const H = 1688;
const FPS = 30;
const BUILD = path.resolve("videos/build");
const CLIPS_DIR = path.resolve("videos/clips");
const OUT_DIR = path.resolve("videos/output");
const FONT = "Tahoma";
const ORANGE = "&H002F8CFF";
const WHITE = "&H00FFFFFF";

const CLIPS = [
  {
    file: "01-الرئيسية.mp4",
    title: "الشاشة الرئيسية",
    lines: [
      "أهلاً بيك في تطبيق كار مصر",
      "كل اللي محتاجه عشان تشتري أو تبيع شاحنة أو معدة ثقيلة كله في مكان واحد",
      "أحدث الإعلانات وأقسام التطبيق وبحث سريع",
    ],
  },
  {
    file: "02-إنشاء-حساب.mp4",
    title: "إنشاء حساب جديد",
    lines: [
      "أول خطوة تعمل حساب جديد",
      "اسمك ورقمك وتخصصك في أقل من دقيقة",
    ],
  },
  {
    file: "03-تسجيل-الدخول.mp4",
    title: "تسجيل الدخول",
    lines: [
      "بعد كده تسجل دخول برقمك أو بحساب جوجل",
      "وبكده تبقى جاهز تستخدم التطبيق",
    ],
  },
  {
    file: "04-استكمال-البيانات-شركة-معرض.mp4",
    title: "استكمال بيانات الشركة أو المعرض",
    lines: [
      "لو شركة أو معرض بتكمل بياناتك",
      "الاسم التجاري ونشاطك والمحافظة وبيانات التواصل",
      "وبكده إعلانك يوصل للناس الصح",
    ],
  },
  {
    file: "05-بيع-شاحنة.mp4",
    title: "نشر إعلان بيع شاحنة",
    lines: [
      "عايز تبيع اضغط زر أضف إعلان",
      "اختار بيع وحدد نوع الشاحنة وسعرها ومكانها",
      "وكمان الحالة والسنة والمسافة المقطوعة",
    ],
  },
  {
    file: "11-رفع-الصور.mp4",
    title: "رفع صور الإعلان",
    lines: [
      "الصور أهم حاجة في أي إعلان",
      "ارفع صور الشاحنة من جوالك من بره ومن جوا",
      "كل ما الصورة أوضح الإعلان بيجيب مكالمات أكتر",
    ],
  },
  {
    file: "13-نشر-إعلان-بالصور-وإدارته-من-البروفايل.mp4",
    title: "نشر الإعلان وإدارته",
    lines: [
      "اضغط زر نشر الإعلان وهيظهر في ثواني",
      "وتقدر تعدل عليه أو توقفه أو تمسحه في أي وقت",
      "كل إعلاناتك مرتبة في البروفايل",
    ],
  },
  {
    file: "06-إيجار-شاحنة.mp4",
    title: "نشر إعلان إيجار",
    lines: [
      "محتاج شاحنة إيجار اختار إيجار",
      "وحدد المدة والسعر يومي أو أسبوعي أو شهري",
    ],
  },
  {
    file: "07-تفاصيل-إعلان.mp4",
    title: "تفاصيل الإعلان",
    lines: [
      "المشتري بيفتح الإعلان ويشوف الصور والمواصفات والسعر",
      "ويقرا كل التفاصيل من غير ما يتصل",
    ],
  },
  {
    file: "12-التواصل-مع-المعلن.mp4",
    title: "التواصل مع المعلن",
    lines: [
      "عجبك الإعلان اضغط واتساب أو اتصال مباشر",
      "والرسالة بتروح جاهزة فيها السعر والتفاصيل ورابط الإعلان",
    ],
  },
  {
    file: "08-الرسائل.mp4",
    title: "الرسائل داخل التطبيق",
    lines: [
      "كمان في رسايل جوه التطبيق",
      "تقدر تتكلم مع المعلن من غير ما تطلع واتساب",
    ],
  },
  {
    file: "09-إضافة-حمولة.mp4",
    title: "طلب حمولة ونقل",
    lines: [
      "عندك شغانة محتاجة نقل",
      "من قسم إضافة حمولة اطلب نقل من غير ما تدور على حد",
    ],
  },
  {
    file: "10-إضافة-وظيفة.mp4",
    title: "إضافة وظيفة",
    lines: [
      "لو بتدور على سواق",
      "من قسم إضافة وظيفة حدد نوع الشاحنة والمنطقة والراتب",
    ],
  },
];

function probe(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const s = r.stderr || "";
  const d = s.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const v = s.match(/(\d+)x(\d+)/);
  return {
    duration: d ? +d[1] * 3600 + +d[2] * 60 + parseFloat(d[3]) : 0,
    width: v ? +v[1] : W,
    height: v ? +v[2] : H,
  };
}

function t(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function assHeader() {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,${FONT},52,${WHITE},${WHITE},&H00101010,&H00000000,-1,0,0,0,100,100,0,0,1,4,2,8,60,60,140,1
Style: Sub,${FONT},40,${WHITE},${WHITE},&H00202020,&HB4000000,-1,0,0,0,100,100,0,0,3,14,0,2,70,70,300,1
Style: Note,${FONT},34,${ORANGE},${ORANGE},&H00101010,&H00000000,-1,0,0,0,100,100,0,0,1,3,2,8,60,60,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function buildAss(title, lines, duration) {
  let out = assHeader();
  out += `Dialogue: 0,${t(0)},${t(3.4)},Title,,0,0,0,,{\\fad(300,300)}${title}\n`;
  const usable = Math.max(1, duration - 1.2);
  const step = usable / lines.length;
  lines.forEach((line, i) => {
    const start = 0.5 + i * step;
    const end = Math.min(duration - 0.3, start + Math.max(3.2, step - 0.5));
    const wrapped = line.replace(/(.{34,54})(?=\s)/g, "$1\\N");
    out += `Dialogue: 0,${t(start)},${t(end)},Sub,,0,0,0,,{\\fad(250,250)}${wrapped}\n`;
  });
  return out;
}

function run(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error((r.stderr || "").split("\n").slice(-25).join("\n"));
    process.exit(1);
  }
  return r.stderr || "";
}

function main() {
  fs.mkdirSync(BUILD, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const fontsDir = path.join(BUILD, "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });
  for (const f of ["tahoma.ttf", "tahomabd.ttf", "arial.ttf", "arialbd.ttf", "segoeui.ttf", "segoeuib.ttf"]) {
    const src = path.join("C:\\Windows\\Fonts", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(fontsDir, f));
  }

  const script = ["# تعليق صوتي - تطبيق كار مصر CarMasr", "", "| # | اللقطة | التعليق |", "|---|---|---|"];
  const segments = [];
  let total = 0;

  CLIPS.forEach((clip, i) => {
    const src = path.join(CLIPS_DIR, clip.file);
    if (!fs.existsSync(src)) {
      console.error("Missing clip: " + clip.file);
      process.exit(1);
    }
    const info = probe(src);
    total += info.duration;
    const n = String(i + 1).padStart(2, "0");
    const assPath = path.join(BUILD, `seg-${n}.ass`);
    const assRel = `videos/build/seg-${n}.ass`;
    fs.writeFileSync(assPath, buildAss(clip.title, clip.lines, info.duration), "utf8");
    const seg = path.join(BUILD, `seg-${n}.mp4`);
    segments.push(seg);
    script.push(`| ${n} | ${clip.title} | ${clip.lines.join(" ")} |`);
    process.stdout.write(`[${n}] ${clip.file} (${info.duration.toFixed(1)}s)\n`);
    run([
      "-i", src,
      "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${FPS},subtitles=${assRel}:fontsdir=${FONT_DIR}`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
      "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
      "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "2",
      "-shortest", "-movflags", "+faststart", seg,
    ]);
  });

  const introAss = path.join(BUILD, "intro.ass");
  fs.writeFileSync(
    introAss,
    assHeader() +
      `Dialogue: 0,${t(0)},${t(3.6)},Title,,0,0,0,,{\\fad(400,400)}تطبيق كار مصر\\NCarMasr\n` +
      `Dialogue: 0,${t(1.2)},${t(3.6)},Note,,0,0,0,,{\\fad(400,400)}جولة سريعة في التطبيق\n`,
    "utf8"
  );
  const outroAss = path.join(BUILD, "outro.ass");
  fs.writeFileSync(
    outroAss,
    assHeader() +
      `Dialogue: 0,${t(0)},${t(2.6)},Title,,0,0,0,,{\\fad(400,400)}حمّل التطبيق وابدأ دلوقتي\\Nكار مصر CarMasr\n` +
      `Dialogue: 0,${t(0.8)},${t(2.6)},Note,,0,0,0,,{\\fad(400,400)}بيع واشتري واستأجر وانقل\n`,
    "utf8"
  );

  const intro = path.join(BUILD, "seg-00.mp4");
  run([
    "-f", "lavfi", "-i", `color=c=0x0B0B0B:s=${W}x${H}:d=4:r=${FPS}`,
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf", `subtitles=videos/build/intro.ass:fontsdir=${FONT_DIR}`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-shortest", intro,
  ]);

  const outro = path.join(BUILD, "seg-99.mp4");
  run([
    "-f", "lavfi", "-i", `color=c=0x0B0B0B:s=${W}x${H}:d=4:r=${FPS}`,
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf", `subtitles=videos/build/outro.ass:fontsdir=${FONT_DIR}`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-shortest", outro,
  ]);

  const ordered = [intro, ...segments, outro];
  const listPath = path.join(BUILD, "list.txt");
  fs.writeFileSync(listPath, ordered.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"), "utf8");

  const outFile = path.join(OUT_DIR, "Tareeq-test-v1.mp4");
  run(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outFile]);

  script.push("", `المدة الإجمالية: ${Math.round(total)} ثانية (بدون الكارتين).`);
  fs.writeFileSync(path.resolve("videos/script.md"), script.join("\n"), "utf8");

  const size = fs.statSync(outFile).size;
  console.log(`\nDONE: ${outFile}`);
  console.log(`size: ${(size / 1048576).toFixed(1)}MB | clips total: ${Math.round(total)}s`);
}

main();