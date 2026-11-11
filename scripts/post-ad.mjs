import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://carmasr-app.vercel.app';
const W = 360, H = 772, DSF = 3, FPS = 30;
const BUILD = path.resolve('videos/build');
const FRAMES = path.join(BUILD, 'ad-frames');
const RAW = path.join(BUILD, 'ad-raw.mp4');
const OUT = 'E:/ابلكشين كار مصر/APP CarMasr/tareeq-production-ready/adds/tareeq-ad-zil-80.mp4';
// موك اب الموبايل: الخلفية + طبقة الموبايل مع اليد (شاشة شفافة) وإحداثياتها
const MOCK_BG = path.resolve('scripts/mockup/bg.png');
const MOCK_PHONE = path.resolve('scripts/mockup/phone.png');
const SCREEN = { x: 190, y: 230, w: 700, h: 1500 };
const PHOTOS = 'E:/ابلكشين كار مصر/APP CarMasr/tareeq-production-ready/adds/photo';

const DEMO_PHONE = '01000000099';
const DEMO_PASS = 'TareeqDemo2026!';

// إيقاع الشرح: وقفة ثابتة على كل خطوة قبل التنفيذ وبعدها (بلا أنيميشن)
const SLOW = 1.8;   // ثواني وقفة واليد ثابتة على العنصر قبل الفعل
const AFTER = 1.0;  // ثواني وقفة بعد الفعل

const AD = {
  title: 'عربية زيل موديل 80 كابينة عريضة',
  brand: 'زيل',
  model: '80',
  year: '1980',
  governorate: 'أسيوط',
  description: [
    'عربية زيل موديل 80',
    'قطمة 97',
    'مكنة 44',
    'فتيس 240',
    'عفش 40 أكتروس MP3',
    'محور 450',
    'كابينة عريضة',
    '',
    'للاستفسار: 01008033414',
  ].join('\n'),
  advertiserName: 'Moatz El-Dabaa',
  phone: '01008033414',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(4, '0');

// الجدول الزمني للتعليقات: {frame, caption} — يُكتب بعد التسجيل ليُستخدم في المونتاج
let R = null;
const timeline = [];

/* ── طبقة الشرح: علامة ضغط ثابتة في مكان الفعل بالظبط (بلا يد إيموجي) ── */
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

// يثبّت علامة الضغط على منتصف العنصر (rect = null => يشيلها)
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
  await page.evaluate(() => {
    document.getElementById('__anno_tap')?.remove();
  });
}

/* ── المسجّل ──────────────────────────────────────────────────────── */
class Recorder {
  constructor(page) { this.page = page; this.n = 0; }
  async shot() { this.n += 1; await this.page.screenshot({ path: path.join(FRAMES, `f_${pad(this.n)}.png`) }); }
  async pause(sec) { const f = Math.max(1, Math.round(sec * FPS)); for (let i = 0; i < f; i++) await this.shot(); }
}

/* ── أدوات الصفحة ────────────────────────────────────────────────── */
async function goAndWait(page, url, need = []) {
  try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
  catch (e) { console.log('  goto note:', e.message.split('\n')[0]); }
  for (const sel of need) {
    try { await page.waitForSelector(sel, { timeout: 20000 }); } catch { console.log(`  ⚠️ missing: ${sel}`); }
  }
  await sleep(900);
}

async function scrollTo(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'center' });
  }, selector);
  await sleep(400);
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

// خطوة نقر: ظلّل + وقفة + انقر + وقفة
async function step(page, r, text, caption) {
  const rect = await rectOfText(page, text);
  await annotate(page, rect, caption);
  await r.pause(rect ? SLOW : 0.8);
  const ok = await clickEl(page, text);
  await r.pause(AFTER);
  return ok;
}

async function rectOfSelect(page, optionText, last = false) {
  return page.evaluate(({ label, last }) => {
    const sels = [...document.querySelectorAll('select')];
    const list = last ? [...sels].reverse() : sels;
    for (const s of list) {
      const opt = [...s.options].find((o) => (o.textContent || '').trim() === label);
      if (opt) { s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
    }
    return null;
  }, { label: optionText, last });
}

async function setSelect(page, optionText) {
  const ok = await page.evaluate((label) => {
    for (const s of document.querySelectorAll('select')) {
      const opt = [...s.options].find((o) => (o.textContent || '').trim() === label);
      if (opt) { s.value = opt.value; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    }
    return false;
  }, optionText);
  if (!ok) console.log(`  [select] "${optionText}" not found`);
  return ok;
}

// خطوة اختيار: ظلّل + وقفة + اختار + وقفة
async function stepSelect(page, r, optionText, caption, last = false) {
  const rect = await rectOfSelect(page, optionText, last);
  await annotate(page, rect, caption);
  await r.pause(rect ? SLOW : 0.8);
  await setSelect(page, optionText);
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
    for (let i = 0; i < (shots ?? 2); i++) await r.shot();
    await sleep(perChar * 1000);
  }
}

// خطوة كتابة في حقل (label): ركّز أولاً + ثبّت اليد بعد التمرير + اكتب + وقفة
async function stepType(page, r, label, value, caption, { perChar = 0.1, shots = 2 } = {}) {
  const ok = await focusField(page, label);
  if (!ok) { console.log(`  [type] "${label}" not found`); return; }
  await sleep(350);                                   // ننتظر أي تمرير ناتج عن التركيز
  const rect = await rectOfField(page, label);        // يوسّط الحقل ويقرأ مكانه النهائي
  await sleep(250);
  await annotate(page, rect, caption);                // اليد على المكان الصح بعد ما ثبت
  await r.pause(SLOW);
  await typeInto(page, value, perChar, r, shots);     // التركيز لسه على الحقل
  await r.pause(AFTER);
}

async function rectOfSelector(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, selector);
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
  if (!fs.existsSync(PHOTOS)) throw new Error('photos folder missing: ' + PHOTOS);
  const files = fs.readdirSync(PHOTOS)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !/\(\d+\)\./.test(f))
    .map((f) => path.join(PHOTOS, f));
  console.log('photos:', files.length);

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
    try { await page.setGeolocation({ latitude: 27.1809, longitude: 31.1837 }); } catch {}
    try { await browser.defaultBrowserContext().overridePermissions(BASE, ['geolocation']); } catch {}

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
      const rect = await rectOfSelector(page, 'input[placeholder="01xxxxxxxxx"]');
      await sleep(150);
      await annotate(page, rect, '٢) سجّل الدخول بحسابك');
      await r.pause(SLOW);
      await typeInto(page, DEMO_PHONE, 0.1, r, 2);
      await r.pause(AFTER);
    }
    {
      const rect = await rectOfSelector(page, 'input[type="password"]');
      await sleep(150);
      await annotate(page, rect);
      await r.pause(SLOW);
      await setValueSel(page, 'input[type="password"]', DEMO_PASS);
      await r.pause(AFTER);
    }
    await step(page, r, 'دخول بالموبايل', 'واضغط «دخول بالموبايل»');
    try { await page.waitForFunction(() => !/login|register/.test(location.pathname), { timeout: 20000 }); } catch {}
    await r.pause(1.0);

    // 3) صفحة نشر الإعلان (مع استكمال البروفايل لو اتطلب)
    console.log('• post-listing');
    await goAndWait(page, `${BASE}/post-listing`, []);
    let pn2 = await page.evaluate(() => location.pathname);
    if (/complete-profile/.test(pn2)) {
      console.log('  • complete-profile');
      await annotate(page, null, 'أكمل بياناتك مرة واحدة');
      await r.pause(1.0);
      await setValueSel(page, 'input[placeholder="أدخل اسمك الكامل"]', AD.advertiserName);
      await setSelect(page, 'أسيوط');
      await sleep(300);
      await page.evaluate(() => { const el = [...document.querySelectorAll('input')].find(i => i.placeholder === 'أدخل المركز أو المدينة'); if (el) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, 'أسيوط'); el.dispatchEvent(new Event('input', { bubbles: true })); } });
      await setSelect(page, 'رخصة مهنية أولى');
      await page.evaluate(() => { const el = [...document.querySelectorAll('input')].find(i => i.placeholder === 'عدد سنوات الخبرة'); if (el) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '10'); el.dispatchEvent(new Event('input', { bubbles: true })); } });
      await r.pause(AFTER);
      await step(page, r, 'حفظ البيانات', 'واضغط «حفظ البيانات»');
      try { await page.waitForFunction(() => !/complete-profile/.test(location.pathname), { timeout: 20000 }); } catch {}
      await sleep(1200);
      await goAndWait(page, `${BASE}/post-listing`, ['input[placeholder="مثال: شاحنة فولفو 2020"]']);
      pn2 = await page.evaluate(() => location.pathname);
    }
    console.log('  post path =', pn2);
    await annotate(page, null, '٣) صفحة نشر إعلان جديد — خطوة بخطوة');
    await r.pause(1.2);

    // 4) نوع الإعلان
    await step(page, r, 'شاحنة أو معدات', '٤) اختار نوع الإعلان: «شاحنة أو معدات»');

    // 5) العنوان
    await stepType(page, r, 'عنوان الإعلان', AD.title, '٥) اكتب عنوان واضح (النوع + الماركة)', { perChar: 0.11 });

    // 6) الفئة + التصنيف الفرعي
    await stepSelect(page, r, 'شاحنات', '٦) اختار الفئة: «شاحنات»');
    await stepSelect(page, r, 'قلابات', 'ثم التصنيف الفرعي: «قلابات»');

    // 7) الماركة/الموديل/السنة
    await stepType(page, r, 'الماركة', AD.brand, '٧) اكتب الماركة (مثال: زيل)', { perChar: 0.13 });
    await stepType(page, r, 'الموديل', AD.model, 'والموديل', { perChar: 0.15 });
    await stepType(page, r, 'سنة الصنع', AD.year, 'وسنة الصنع', { perChar: 0.13 });

    // 8) الموقع
    await stepSelect(page, r, AD.governorate, '٨) اختار المحافظة: «أسيوط»');
    {
      // المنطقة = المحافظة نفسها
      const rect = await page.evaluate(() => {
        const sels = [...document.querySelectorAll('select')];
        for (let i = sels.length - 1; i >= 0; i--) {
          const opt = [...sels[i].options].find((o) => (o.textContent || '').includes('(المحافظة)'));
          if (opt) { sels[i].scrollIntoView({ block: 'center' }); const r = sels[i].getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
        }
        return null;
      });
      await annotate(page, rect, 'ثم اختار المنطقة');
      await r.pause(rect ? SLOW : 0.8);
      await page.evaluate(() => {
        const sels = [...document.querySelectorAll('select')];
        for (let i = sels.length - 1; i >= 0; i--) {
          const opt = [...sels[i].options].find((o) => (o.textContent || '').includes('(المحافظة)'));
          if (opt) { sels[i].value = opt.value; sels[i].dispatchEvent(new Event('change', { bubbles: true })); return; }
        }
      });
      await r.pause(AFTER);
    }

    // 9) بيع + عند التواصل
    await step(page, r, 'بيع', '٩) نوع الإعلان: «بيع»');
    await step(page, r, 'عند التواصل', 'ونوع السعر: «عند التواصل»');

    // 10) الصور
    console.log('  • photos upload');
    {
      const rect = await rectOfText(page, 'إضافة');
      await annotate(page, rect, '١٠) ارفع صور العربية (٣ لـ ٦ صور واضحة)');
      await r.pause(rect ? SLOW : 0.8);
      await clearAnno(page);
      const input = await page.$('input[type="file"]');
      if (input) {
        await input.uploadFile(...files);
        for (let t = 0; t < 90; t++) {
          const c = await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => /cloudinary/.test(i.src)).length);
          if (c >= files.length) break;
          await r.shot();
          await sleep(500);
        }
        console.log('    uploaded');
      }
      await r.pause(AFTER);
    }

    // 11) الوصف + التواصل
    await stepType(page, r, 'وصف الإعلان', AD.description, '١١) اكتب وصفاً مفصّلاً للعربية', { perChar: 0.05, shots: 1 });
    await stepType(page, r, 'اسم المعلن (معرض أو فرد)', AD.advertiserName, 'اكتب اسم المعلن', { perChar: 0.09 });
    await stepType(page, r, 'رقم هاتف التواصل (اختياري)', AD.phone, 'ورقم الهاتف للتواصل', { perChar: 0.1 });
    await stepType(page, r, 'رقم واتساب (اختياري)', AD.phone, 'ورقم الواتساب', { perChar: 0.1 });

    // 12) مراجعة + نشر
    await clearAnno(page);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await annotate(page, null, '١٢) راجع الإعلان ثم اضغط «نشر الإعلان»');
    await r.pause(1.6);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await sleep(300);
    await step(page, r, 'نشر الإعلان', 'اضغط «نشر الإعلان»');
    try {
      await page.waitForFunction(() => /إعلاناتي|إعلان جديد|تم نشر/.test(document.body.innerText), { timeout: 40000 });
      console.log('    published ✓');
    } catch { console.log('    ⚠️ success screen not detected'); }
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await annotate(page, null, 'تم! إعلانك ظهر على الموقع ✅');
    await r.pause(2.2);

    console.log('frames:', r.n, '≈', (r.n / FPS).toFixed(1), 's');
    fs.writeFileSync(path.join(BUILD, 'ad-timeline.json'), JSON.stringify(timeline));
    console.log('timeline entries:', timeline.length);
    console.log('encoding raw ...');
    await encode(RAW);
    console.log(`\nDONE (raw): ${RAW}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
