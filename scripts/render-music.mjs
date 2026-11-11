import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const BUILD = path.resolve('videos/build');
const BUNDLE = path.join(BUILD, 'tutorial-bundle.js');

(async () => {
  const bundle = fs.readFileSync(BUNDLE, 'utf8');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: bundle });
    const ok = await page.evaluate(() => !!window.__tut);
    if (!ok) throw new Error('bundle did not expose window.__tut');
    const track = process.argv[2] || 'calm';
    const sec = Number(process.argv[3] || 40);
    const b64 = await page.evaluate(async (t, s) => window.__tut.renderWav(t, s), track, sec);
    const out = path.join(BUILD, `music-${track}-${sec}.wav`);
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log('wrote', out, (fs.statSync(out).size / 1048576).toFixed(1), 'MB');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
