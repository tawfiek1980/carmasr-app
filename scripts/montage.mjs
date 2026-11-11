import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FPS = 30, W = 1080, H = 1920;
const BUILD = path.resolve('videos/build');
const PHONE = path.resolve('scripts/mockup/phone.png');
const BG = path.resolve('scripts/mockup/bg.png');
const LOGO = path.resolve('public/tareeq-logo.png');
const SCREEN = { x: 190, y: 230, w: 700, h: 1500 };

// سيناريوهات الڤيديو — نفس الموسيقى ونفس الشكل لكل السيناريوهات
const SCENARIOS = {
  truck: {
    raw: 'ad-raw.mp4', timeline: 'ad-timeline.json',
    intro1: 'إزاي تنشر إعلان على كار مصر', intro2: 'شرح كامل خطوة بخطوة',
    outro1: 'سجّل إعلانك على كار مصر دلوقتي', outro2: 'بيع واشتري في سوق النقل الثقيل',
    final: 'tareeq-ad-zil-80.mp4',
  },
  seeker: {
    raw: 'job-seeker-raw.mp4', timeline: 'job-seeker-timeline.json',
    intro1: 'إزاي تنشر إنك بتدور على شغل', intro2: 'كار مصر — خطوة بخطوة',
    outro1: 'اعرض خبرتك على كار مصر', outro2: 'خلي الشركات تلاقيك',
    final: 'tareeq-job-seeker.mp4',
  },
  company: {
    raw: 'job-company-raw.mp4', timeline: 'job-company-timeline.json',
    intro1: 'إزاي تعلن عن وظيفة على كار مصر', intro2: 'توصلك العمال المناسبين',
    outro1: 'أعلن وظيفتك على كار مصر', outro2: 'العمال مستنيينك عندك',
    final: 'tareeq-job-company.mp4',
  },
  load: {
    raw: 'load-raw.mp4', timeline: 'load-timeline.json',
    intro1: 'إزاي تنشر حمولة على كار مصر', intro2: 'وصّلها للسواقين في دقيقة',
    outro1: 'انشر حمولتك على كار مصر', outro2: 'سواقين جاهزين يستلموا شغلك',
    final: 'tareeq-load.mp4',
  },
  spare: {
    raw: 'spare-raw.mp4', timeline: 'spare-timeline.json',
    intro1: 'إزاي تنشر قطع غيار على كار مصر', intro2: 'اعرضها بالصور والسعر',
    outro1: 'بيع قطع غيارك على كار مصر', outro2: 'معارض وعملاء في مكان واحد',
    final: 'tareeq-spare-parts.mp4',
  },
  showroom: {
    raw: 'exhibition-raw.mp4', timeline: 'exhibition-timeline.json',
    intro1: 'إزاي تعمل معرض مجاني على كار مصر', intro2: 'وخطوة بخطوة',
    outro1: 'اعمل معرضك المجاني على كار مصر', outro2: 'اعرض عربياتك لعملاء جاهزين',
    final: 'tareeq-showroom.mp4',
  },
};

const SC = process.argv[2] || 'truck';
const S = SCENARIOS[SC];
if (!S) { console.error('unknown scenario:', SC); process.exit(1); }

const FRAMES_DIR = path.join(BUILD, `montage-frames-${SC}`);
const CAPS_DIR = path.join(BUILD, `captions-${SC}`);
const RAW = path.join(BUILD, S.raw);
const TIMELINE = path.join(BUILD, S.timeline);
const MAIN = path.join(BUILD, `main-${SC}.mp4`);
const INTRO = path.join(BUILD, `intro-${SC}.mp4`);
const OUTRO = path.join(BUILD, `outro-${SC}.mp4`);
const MUSIC = path.join(BUILD, 'music.wav');
const OUTDIR = 'E:/ابلكشين كار مصر/APP CarMasr/tareeq-production-ready/adds';
const FINAL = path.join(OUTDIR, S.final);

const CRF = '16';
const INTRO_DUR = 2.5, OUTRO_DUR = 3.0;
const MUSIC_A = 'uplift', MUSIC_B = 'celebrate';

const ff = (args) => execFileSync(ffmpegPath, args, { stdio: 'inherit' });
const pad = (n) => String(n).padStart(4, '0');
const b64 = (f) => fs.readFileSync(f).toString('base64');

function duration(f) {
  try { execFileSync(ffmpegPath, ['-i', f], { stdio: ['ignore', 'ignore', 'pipe'] }); }
  catch (e) {
    const m = (e.stderr || '').toString().match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
  }
  return 0;
}

function composeMain() {
  if (fs.existsSync(MAIN)) fs.rmSync(MAIN, { force: true });
  const { x, y, w, h } = SCREEN;
  ff(['-y', '-i', RAW, '-loop', '1', '-i', BG, '-loop', '1', '-i', PHONE,
    '-filter_complex',
    `[0:v]scale=${w}:${h}:flags=lanczos,setsar=1[rec];` +
    `[1:v][rec]overlay=${x}:${y}:shortest=1[bgrec];` +
    `[bgrec][2:v]overlay=0:0:shortest=1,format=yuv420p[v]`,
    '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium',
    '-crf', CRF, '-movflags', '+faststart', MAIN]);
}

function grabFrame(src, t, out) {
  ff(['-y', '-ss', String(t), '-i', src, '-frames:v', '1', out]);
}

function html(baseData, logoData, t1, t2, kind) {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000;font-family:Cairo,sans-serif}
    .stage{position:relative;width:${W}px;height:${H}px;overflow:hidden}
    .base{position:absolute;inset:0;width:${W}px;height:${H}px;object-fit:cover;transform-origin:center}
    .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,8,18,.86) 0%,rgba(3,8,18,.35) 30%,rgba(3,8,18,.12) 50%,rgba(3,8,18,.55) 74%,rgba(3,8,18,.94) 100%)}
    .logo{position:absolute;top:70px;left:50%;transform:translateX(-50%);height:150px;object-fit:contain}
    .mid{position:absolute;top:300px;left:0;right:0;padding:0 90px;text-align:center;color:#fff}
    .t1{font-weight:900;font-size:96px;line-height:1.18;text-shadow:0 6px 34px rgba(0,0,0,.6)}
    .t2{margin-top:26px;font-weight:700;font-size:46px;color:#ffd27a;text-shadow:0 4px 20px rgba(0,0,0,.6)}
    .cta{margin-top:40px;display:inline-block;background:#ff7a00;color:#08131f;font-weight:800;font-size:44px;padding:22px 60px;border-radius:999px;box-shadow:0 12px 40px rgba(255,122,0,.45)}
  </style></head>
  <body><div class="stage">
    <img class="base" id="base" src="data:image/png;base64,${baseData}">
    <div class="scrim"></div>
    <img class="logo" id="logo" src="data:image/png;base64,${logoData}">
    <div class="mid" id="mid">
      <div class="t1">${t1}</div>
      <div class="t2" id="sub">${t2}</div>
      ${kind === 'outro' ? '<div class="cta" id="cta">كار مصر</div>' : ''}
    </div>
  </div>
  <script>
    const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
    window.__setT=(t)=>{
      document.getElementById('base').style.transform='scale('+(1+t*0.05)+')';
      document.getElementById('logo').style.opacity=sm(0.0,0.18,t);
      const mid=document.getElementById('mid');
      mid.style.opacity=${kind === 'intro' ? 'sm(0.05,0.32,t)' : 'sm(0.08,0.34,t)'};
      mid.style.transform='translateY('+(1-sm(0.05,0.42,t))*26+'px)';
      document.getElementById('sub').style.opacity=sm(0.2,0.46,t);
      const cta=document.getElementById('cta'); if(cta) cta.style.opacity=sm(0.3,0.6,t);
    };
  </script></body></html>`;
}

async function renderClip(name, basePng, t1, t2, dur, kind, browser) {
  const dir = path.join(FRAMES_DIR, name);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setContent(html(b64(basePng), b64(LOGO), t1, t2, kind), { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(async () => {
    try { await Promise.race([document.fonts.load('900 96px Cairo'), new Promise(r => setTimeout(r, 6000))]); } catch { }
    try { await document.fonts.ready; } catch { }
  });
  const N = Math.round(dur * FPS);
  for (let i = 0; i < N; i++) {
    await page.evaluate((t) => window.__setT(t), i / (N - 1));
    await page.screenshot({ path: path.join(dir, `f_${pad(i + 1)}.png`) });
  }
  await page.close();
  const out = kind === 'intro' ? INTRO : OUTRO;
  if (fs.existsSync(out)) fs.rmSync(out, { force: true });
  ff(['-y', '-framerate', String(FPS), '-i', path.join(dir, 'f_%04d.png'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', CRF, '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-movflags', '+faststart', out]);
  console.log(name, 'done:', N, 'frames');
}

// يرندر صور التعليق (شفافة) لكل جملة فريدة، ويرجع خريطة النص -> {file, w}
async function renderCaptions(uniq, browser) {
  if (fs.existsSync(CAPS_DIR)) fs.rmSync(CAPS_DIR, { recursive: true, force: true });
  fs.mkdirSync(CAPS_DIR, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 420, deviceScaleFactor: 1 });
  const css = `<style>
    html,body{margin:0;background:transparent;font-family:Cairo,sans-serif}
    body{display:flex;justify-content:center;align-items:center;height:420px}
    #pill{background:rgba(3,10,20,.82);border:2px solid rgba(255,255,255,.16);border-radius:40px;
      padding:30px 56px;box-shadow:0 18px 50px rgba(0,0,0,.5);direction:rtl;max-width:1010px;box-sizing:border-box}
    #txt{color:#fff;font-weight:800;font-size:52px;line-height:1.16;text-align:center}
  </style>`;
  await page.setContent(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    ${css}</head><body><div id="pill"><div id="txt"></div></div></body></html>`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(async () => { try { await document.fonts.load('800 56px Cairo'); await document.fonts.ready; } catch { } });
  const map = {};
  let i = 0;
  for (const cap of uniq) {
    await page.evaluate((c) => { document.getElementById('txt').textContent = c; }, cap);
    const el = await page.$('#pill');
    const box = await el.boundingBox();
    const file = path.join(CAPS_DIR, `cap_${pad(++i)}.png`);
    await el.screenshot({ path: file, omitBackground: true });
    map[cap] = { file, w: Math.round(box.width) };
  }
  await page.close();
  return map;
}

function buildMusic() {
  const a = path.join(BUILD, `music-${MUSIC_A}-40.wav`);
  const b = path.join(BUILD, `music-${MUSIC_B}-40.wav`);
  if (fs.existsSync(MUSIC)) fs.rmSync(MUSIC, { force: true });
  ff(['-y', '-i', a, '-i', b, '-filter_complex',
    '[0:a][1:a]acrossfade=d=2:c1=tri:c2=tri[a]', '-map', '[a]', '-c:a', 'pcm_s16le', MUSIC]);
}

function segments() {
  const tl = JSON.parse(fs.readFileSync(TIMELINE, 'utf8'));
  const segs = [];
  for (let i = 0; i < tl.length; i++) {
    if (!tl[i].caption) continue;
    const start = tl[i].frame / FPS;
    const end = (i + 1 < tl.length ? tl[i + 1].frame : Infinity) / FPS;
    segs.push({ cap: tl[i].caption, start, end });
  }
  return segs;
}

async function main() {
  fs.mkdirSync(BUILD, { recursive: true });

  console.log(`scenario: ${SC} -> ${S.final}`);
  console.log('1) compose main (clean) ...');
  composeMain();
  const mainDur = duration(MAIN) || 73.2;

  console.log('2) grab base frames + music ...');
  const f0 = path.join(BUILD, 'intro-frame.png');
  const fl = path.join(BUILD, 'outro-frame.png');
  grabFrame(MAIN, 0.05, f0);
  grabFrame(MAIN, Math.max(0.1, mainDur - 0.6), fl);
  buildMusic();

  const segs = segments();
  console.log('3) captions:', segs.length, 'segments ...');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'] });
  try {
    const uniq = [...new Set(segs.map((s) => s.cap))];
    const caps = await renderCaptions(uniq, browser);
    for (const s of segs) { s.file = caps[s.cap].file; s.w = caps[s.cap].w; }

    console.log('4) render intro/outro ...');
    await renderClip('intro', f0, S.intro1, S.intro2, INTRO_DUR, 'intro', browser);
    await renderClip('outro', fl, S.outro1, S.outro2, OUTRO_DUR, 'outro', browser);

    console.log('5) assemble final ...');
    const args = ['-y', '-i', INTRO, '-i', MAIN, '-i', OUTRO];
    for (const s of segs) args.push('-loop', '1', '-i', s.file);
    const musicIdx = 3 + segs.length;
    args.push('-stream_loop', '-1', '-i', MUSIC);

    let fc = `[0:v][1:v][2:v]concat=n=3:v=1:a=0[base]`;
    let last = 'base';
    segs.forEach((s, i) => {
      const inIdx = 3 + i;
      const st = (INTRO_DUR + s.start).toFixed(3);
      const en = (INTRO_DUR + Math.min(s.end, mainDur)).toFixed(3);
      const cx = Math.round((W - s.w) / 2);
      const out = `v${i}`;
      fc += `;[${last}][${inIdx}:v]overlay=${cx}:50:enable='between(t,${st},${en})':shortest=1[${out}]`;
      last = out;
    });
    fc += `;[${last}]format=yuv420p[v]`;

    const total = INTRO_DUR + mainDur + OUTRO_DUR;
    const fout = Math.max(0.5, total - 2.4).toFixed(2);

    args.push('-filter_complex', fc, '-map', '[v]', '-map', `${musicIdx}:a`,
      '-af', `volume=0.18,afade=t=in:st=0:d=1.6,afade=t=out:st=${fout}:d=2.2`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', CRF, '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', '-movflags', '+faststart', FINAL);

    if (fs.existsSync(FINAL)) fs.rmSync(FINAL, { force: true });
    ff(args);
    const size = fs.statSync(FINAL).size;
    console.log(`\nDONE: ${FINAL}\nsize: ${(size / 1048576).toFixed(1)} MB | ${total.toFixed(1)}s`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
