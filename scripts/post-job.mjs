import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://carmasr-app.vercel.app';
const W = 360, H = 772, DSF = 3, FPS = 30;
const BUILD = path.resolve('videos/build');
const DEMO_PHONE = '01000000099';
const DEMO_PASS = 'TareeqDemo2026!';

const SLOW = 1.8;
const AFTER = 1.0;

const SC = process.argv[2] || 'seeker';
const JOBS = {
  seeker: {
    title: 'سائق شاحنة ثقيلة خبرة 12 سنة',
    jobPostType: 'فرد يبحث عن عمل',
    jobType: 'سائق',
    company: 'أحمد عبد الرحمن',
    gov: 'أسيوط',
    salary: '12,000 - 15,000 جنيه',
    experience: '12 سنة خبرة',
    desc: [
      'سائق شاحنات ثقيلة خبرة 12 سنة',
      'رخصة أولى + خبرة طرق صحراوية',
      'مرتاح في السرعات الطويلة',
      'جاهز للسفر بين المحافظات',
      'متاح للبدء فورًا',
    ].join('\n'),
    phone: '01008033414',
    capType: '٥) نوع الإعلان: «فرد يبحث عن عمل»',
    capSkill: '٦) التخصص: «سائق»',
    capName: '٧) اكتب اسمك كمُقدِّم على الشغل',
    capEnd: 'تم! بحثك عن شغل ظهر على الموقع ✅',
  },
  company: {
    title: 'مطلوب ميكانيكيين وسائقين نقل ثقيل',
    jobPostType: 'شركة أو مؤسسة تطلب موظفين',
    jobType: 'ميكانيكي',
    company: 'مركز صيانة النقل الآمن',
    gov: 'أسيوط',
    salary: '10,000 - 16,000 جنيه',
    experience: 'خبرة 3 سنوات فأكثر',
    desc: [
      'مطلوب ميكانيكيين وسائقين للعمل',
      'خبرة في موتور وفتيس الشاحنات',
      'دوام كامل + راتب مجزي',
      'بيئة عمل منظمة وضمانات',
    ].join('\n'),
    phone: '01008033414',
    capType: '٥) نوع الإعلان: «شركة تطلب موظفين»',
    capSkill: '٦) التخصص: «ميكانيكي»',
    capName: '٧) اكتب اسم الشركة',
    capEnd: 'تم! الوظيفة ظهرت على الموقع ✅',
  },
};
const J = JOBS[SC];
if (!J) { console.error('unknown scenario:', SC); process.exit(1); }

const FRAMES = path.join(BUILD, `job-${SC}-frames`);
const RAW = path.join(BUILD, `job-${SC}-raw.mp4`);
const TIMELINE = path.join(BUILD, `job-${SC}-timeline.json`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(4, '0');

let R = null;
const timeline = [];

const ANNO_CSS = [
  '#__anno_tap{position:fixed;z-index:2147483646;width:30px;height:30px;border:3px solid #ff7a00;border-radius:9999px;background:rgba(255,122,0,.22);box-sizing:border-box;pointer-events:none;transform:translate(-50%,-50%);box-shadow:0 0 0 5px rgba(255,122,0,.16)}',
].join('');

async function ensureAnno(page) {
  await page.evaluate((css) => {
    if (window.__annoReady) return;
    window.__annoReady = true;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }, ANNO_CSS);
}

async function annotate(page, rect, caption) {
  if (typeof caption === 'string') timeline.push({ frame: R ? R.n : 0, caption });
  await ensureAnno(page);
  await page.evaluate((rc) => {
    let tap = document.getElementById('__anno_tap');
    if (!rc) { if (tap) tap.remove(); return; }
    if (!tap) { tap = document.createElement('div'); tap.id = '__anno_tap'; document.body.appendChild(tap); }
    const cx = Math.min(Math.max(rc.left + rc.width / 2, 24), window.innerWidth - 24);
    const cy = Math.min(Math.max(rc.top + rc.height / 2, 24), window.innerHeight - 24);
    tap.style.left = cx + 'px';
    tap.style.top = cy + 'px';
  }, rect);
}

async function clearAnno(page) {
  await page.evaluate(() => { document.getElementById('__anno_tap')?.remove(); });
}

class Recorder {
  constructor(page) { this.page = page; this.n = 0; }
  async shot() { this.n += 1; await this.page.screenshot({ path: path.join(FRAMES, `f_${pad(this.n)}.png`) }); }
  async pause(sec) { const f = Math.max(1, Math.round(sec * FPS)); for (let i = 0; i < f; i++) await this.shot(); }
}

async function goAndWait(page, url, need = []) {
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
  catch (e) { console.log('  goto note:', e.message.split('\n')[0]); }
  for (const sel of need) {
    try { await page.waitForSelector(sel, { timeout: 20000 }); } catch { console.log(`  ⚠️ missing: ${sel}`); }
  }
  await sleep(900);
}

async function rectOfText(page, text) {
  return page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === t);
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, text);
}

async function clickEl(page, text) {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === t);
    if (!b) return false;
    b.click();
    return true;
  }, text);
  if (!ok) console.log(`  [click] "${text}" not found`);
  return ok;
}

async function step(page, r, text, caption) {
  const rect = await rectOfText(page, text);
  await annotate(page, rect, caption);
  await r.pause(rect ? SLOW : 0.8);
  const ok = await clickEl(page, text);
  await r.pause(AFTER);
  return ok;
}

async function rectOfSelect(page, label) {
  return page.evaluate((label) => {
    for (const s of document.querySelectorAll('select')) {
      const opt = [...s.options].find((o) => (o.textContent || '').trim() === label);
      if (opt) { s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
    }
    return null;
  }, label);
}

async function setSelect(page, label) {
  const ok = await page.evaluate((label) => {
    for (const s of document.querySelectorAll('select')) {
      const opt = [...s.options].find((o) => (o.textContent || '').trim() === label);
      if (opt) { s.value = opt.value; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    }
    return false;
  }, label);
  if (!ok) console.log(`  [select] "${label}" not found`);
  return ok;
}

async function stepSelect(page, r, label, caption) {
  const rect = await rectOfSelect(page, label);
  await annotate(page, rect, caption);
  await r.pause(rect ? SLOW : 0.8);
  await setSelect(page, label);
  await r.pause(AFTER);
}

async function rectOfField(page, label) {
  return page.evaluate((label) => {
    const lab = [...document.querySelectorAll('label')].find((l) => (l.textContent || '').trim().replace(/\s*\*$/, '') === label);
    if (!lab) return null;
    const el = lab.parentElement.querySelector('input,textarea,select');
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, label);
}

async function focusField(page, label) {
  return page.evaluate((label) => {
    const lab = [...document.querySelectorAll('label')].find((l) => (l.textContent || '').trim().replace(/\s*\*$/, '') === label);
    if (!lab) return false;
    const el = lab.parentElement.querySelector('input,textarea');
    if (!el) return false;
    el.focus();
    return true;
  }, label);
}

async function typeInto(page, value, perChar, r, shots) {
  for (const ch of value) {
    if (ch === '\n') await page.keyboard.press('Enter');
    else await page.keyboard.type(ch);
    for (let i = 0; i < (shots ?? 1); i++) await r.shot();
    await sleep(perChar * 1000);
  }
}

async function stepType(page, r, label, value, caption, { perChar = 0.09, shots = 2 } = {}) {
  const ok = await focusField(page, label);
  if (!ok) { console.log(`  [type] "${label}" not found`); return; }
  await sleep(350);
  const rect = await rectOfField(page, label);
  await sleep(250);
  await annotate(page, rect, caption);
  await r.pause(SLOW);
  await typeInto(page, value, perChar, r, shots);
  await r.pause(AFTER);
}

async function setValueSel(page, selector, value) {
  await page.evaluate(({ sel, value }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { sel: selector, value });
}

async function encode(outFile) {
  if (fs.existsSync(outFile)) fs.rmSync(outFile, { force: true });
  execFileSync(ffmpegPath, [
    '-y', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f_%04d.png'),
    '-vf', `scale=${W * DSF}:${H * DSF}`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile,
  ], { stdio: 'inherit' });
}

async function main() {
  console.log('scenario:', SC, '→', J.title);
  fs.mkdirSync(BUILD, { recursive: true });
  if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--lang=ar', '--force-device-scale-factor=3'],
  });
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.setViewport({ width: W, height: H, deviceScaleFactor: DSF, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36');
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tareeq_theme', 'light'); } catch {} });
    try {
      await page.setCookie(
        { name: 'tareeq_chat_disabled', value: '1', domain: 'carmasr-app.vercel.app', path: '/' },
        { name: 'tareeq_whatsapp_disabled', value: '1', domain: 'carmasr-app.vercel.app', path: '/' },
      );
    } catch (e) { console.log('cookie note:', e.message); }

    const r = new Recorder(page);
    R = r;

    // 1) الرئيسية
    console.log('• home');
    await goAndWait(page, `${BASE}/`, ['header']);
    await annotate(page, null, '١) نبدأ من الموقع: كار مصر — سوق النقل الثقيل');
    await r.pause(1.6);

    // 2) دخول
    console.log('• login');
    await goAndWait(page, `${BASE}/login`, ['input[placeholder="01xxxxxxxxx"]']);
    {
      await page.evaluate(() => { const el = document.querySelector('input[placeholder="01xxxxxxxxx"]'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } });
      await sleep(400);
      const rect = await rectOfField(page, 'رقم الموبايل').catch(() => null);
      const rect2 = rect || await page.evaluate(() => { const el = document.querySelector('input[placeholder="01xxxxxxxxx"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; });
      await sleep(150);
      await annotate(page, rect2, '٢) سجّل الدخول بحسابك');
      await r.pause(SLOW);
      await typeInto(page, DEMO_PHONE, 0.1, r, 2);
      await r.pause(AFTER);
    }
    {
      const rect = await page.evaluate(() => { const el = document.querySelector('input[type="password"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; });
      await sleep(150);
      await annotate(page, rect);
      await r.pause(SLOW);
      await setValueSel(page, 'input[type="password"]', DEMO_PASS);
      await r.pause(AFTER);
    }
    await step(page, r, 'دخول بالموبايل', 'واضغط «دخول بالموبايل»');
    try { await page.waitForFunction(() => !/login|register/.test(location.pathname), { timeout: 20000 }); } catch {}
    await r.pause(1.0);

    // 3) صفحة نشر وظيفة
    console.log('• post job');
    await goAndWait(page, `${BASE}/post-listing?type=job`, ['input[placeholder="سائق شاحنة ثقيلة"]']);
    const path0 = await page.evaluate(() => location.pathname + location.search);
    console.log('  path =', path0);
    await annotate(page, null, '٣) صفحة نشر وظيفة — خطوة بخطوة');
    await r.pause(1.4);

    // 4) المسمى الوظيفي
    await stepType(page, r, 'المسمى الوظيفي', J.title, '٤) اكتب المسمى الوظيفي', { perChar: 0.1, shots: 2 });

    // 5) نوع الإعلان
    await stepSelect(page, r, J.jobPostType, J.capType);

    // 6) التخصص
    await stepSelect(page, r, J.jobType, J.capSkill);

    // 7) الشركة / اسم المتقدم
    await stepType(page, r, 'الشركة / اسم المتقدم', J.company, J.capName, { perChar: 0.11, shots: 2 });

    // 8) المحافظة
    await stepSelect(page, r, J.gov, `٨) اختار المحافظة: «${J.gov}»`);

    // 9) الراتب
    await stepType(page, r, 'الراتب / المرتب', J.salary, '٩) اكتب الراتب أو المرتب', { perChar: 0.06, shots: 1 });

    // 10) سنوات الخبرة
    await stepType(page, r, 'سنوات الخبرة', J.experience, '١٠) حدّد سنوات الخبرة', { perChar: 0.06, shots: 1 });

    // 11) التفاصيل
    await stepType(page, r, 'تفاصيل', J.desc, '١١) اكتب تفاصيل الوظيفة والمتطلبات', { perChar: 0.035, shots: 1 });

    // 12) رقم التواصل
    await stepType(page, r, 'رقم هاتف التواصل (اختياري)', J.phone, '١٢) رقم التواصل عشان ينادوكي', { perChar: 0.07, shots: 1 });

    // 13) مراجعة + نشر
    await clearAnno(page);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await annotate(page, null, '١٣) راجع البيانات ثم اضغط «نشر الإعلان»');
    await r.pause(1.5);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await sleep(300);
    await step(page, r, 'نشر الإعلان', 'اضغط «نشر الإعلان»');
    try {
      await page.waitForFunction(() => /تم إرسال إعلانك|إعلاناتي|قيد المراجعة/.test(document.body.innerText), { timeout: 40000 });
      console.log('    published ✓');
    } catch { console.log('    ⚠️ success screen not detected'); }
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await annotate(page, null, J.capEnd);
    await r.pause(2.4);

    console.log('frames:', r.n, '≈', (r.n / FPS).toFixed(1), 's');
    fs.writeFileSync(TIMELINE, JSON.stringify(timeline));
    console.log('timeline entries:', timeline.length);
    console.log('encoding raw ...');
    await encode(RAW);
    console.log(`\nDONE: ${RAW}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
