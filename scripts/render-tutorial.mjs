import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FPS = 30;
const DURATION = 27; // يجب أن يطابق TUTORIAL_DURATION
const CHUNK = 15;
const BUILD = path.resolve('videos/build');
const FRAMES = path.resolve('videos/build/tutorial-frames');
const WAV = path.join(BUILD, 'tutorial-audio.wav');
const BUNDLE = path.join(BUILD, 'tutorial-bundle.js');
const OUT = path.resolve('E:/ابلكشين كار مصر/APP CarMasr/tareeq-video-guide.mp4');

const pad = (n) => String(n).padStart(4, '0');

(async () => {
  fs.mkdirSync(BUILD, { recursive: true });
  if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });

  const bundleJs = fs.readFileSync(BUNDLE, 'utf8');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      </head><body style="margin:0;background:#000">
      <canvas id="c" width="1080" height="1920"></canvas>
      </body></html>`, { waitUntil: 'networkidle0', timeout: 60000 });

    await page.evaluate(async () => {
      try { await Promise.race([document.fonts.load('900 120px Cairo'), new Promise(r => setTimeout(r, 8000))]); } catch { /* */ }
      try { await document.fonts.ready; } catch { /* */ }
    });
    await page.addScriptTag({ content: bundleJs });

    const ready = await page.evaluate(() => !!window.__tut);
    if (!ready) throw new Error('bundle did not expose window.__tut');

    const dur = await page.evaluate(() => window.__tut.TUTORIAL_DURATION);
    console.log('duration:', dur, 'fps:', FPS, 'frames:', Math.round(dur * FPS));

    // 1) الموسيقى (WAV)
    const track = await page.evaluate(() => window.__tut.TUTORIAL_TRACK);
    const b64 = await page.evaluate(async (t, s) => window.__tut.renderWav(t, s), track, dur);
    fs.writeFileSync(WAV, Buffer.from(b64, 'base64'));
    console.log('audio.wav:', (fs.statSync(WAV).size / 1024).toFixed(0), 'KB  (track', track + ')');

    // 2) الإطارات
    const N = Math.round(dur * FPS);
    for (let start = 0; start < N; start += CHUNK) {
      const count = Math.min(CHUNK, N - start);
      const arr = await page.evaluate((args) => {
        const { start, count, fps } = args;
        const t = window.__tut;
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        const total = Math.round(t.TUTORIAL_DURATION * fps);
        const out = [];
        for (let i = start; i < start + count; i++) {
          t.drawTutorial(ctx, t.TUTORIAL_W, t.TUTORIAL_H, i / total);
          out.push(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
        }
        return out;
      }, { start, count, fps: FPS });
      for (let j = 0; j < arr.length; j++) {
        fs.writeFileSync(path.join(FRAMES, `f_${pad(start + j)}.jpg`), Buffer.from(arr[j], 'base64'));
      }
      process.stdout.write(`\r frames ${start + count}/${N}`);
    }
    process.stdout.write('\n');

    // 3) التجميع إلى MP4 (x264 + AAC)
    console.log('encoding mp4 ...');
    execFileSync(ffmpegPath, [
      '-y',
      '-framerate', String(FPS), '-i', path.join(FRAMES, 'f_%04d.jpg'),
      '-i', WAV,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
      '-shortest', '-movflags', '+faststart', '-r', String(FPS),
      OUT,
    ], { stdio: 'inherit' });

    const size = fs.statSync(OUT).size;
    console.log(`\nDONE: ${OUT}`);
    console.log(`size: ${(size / 1048576).toFixed(1)} MB | ${dur}s @ ${FPS}fps`);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
