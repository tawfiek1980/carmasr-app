import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const BASE = 'https://carmasr-app.vercel.app';
const OUT = path.resolve('videos/clips');
const FRAMES = path.resolve('videos/.frames');
const FPS = 15;
const SLOW = 8; // مضاعف الزمن لشرح أبطأ ومريح
const W = 390, H = 844;

const DEMO_PHONE = '01000000099';
const DEMO_PASS = 'TareeqDemo2026!';
const DEMO_EMAIL = `phone_1000000099@tareeq.app`; // normalizePhone تحذف الصفر الأول

const CREDS = (() => {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const roots = [path.resolve('secrets-backup'), path.resolve('secrets-backup/2026-09-15')];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    const json = fs.readdirSync(r).find((f) => /tareeq-d4dcc-.*\.json|service.?account.*\.json/i.test(f));
    if (json) return path.join(r, json);
  }
  return path.resolve('secrets-backup/tareeq-d4dcc-d3d46f52373a.json');
})();

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(CREDS) });
}
const db = admin.firestore();
const auth = admin.auth();

const pad = (n) => String(n).padStart(4, '0');

function clearDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  fs.mkdirSync(p, { recursive: true });
}

class Recorder {
  constructor(page, id) {
    this.page = page;
    this.dir = path.join(FRAMES, id);
    this.n = 0;
    clearDir(this.dir);
  }
  async shot() {
    this.n += 1;
    await this.page.screenshot({ path: path.join(this.dir, `f_${pad(this.n)}.png`) });
  }
  async pause(sec) {
    const frames = Math.max(1, Math.round(sec * SLOW * FPS));
    const ms = Math.round(1000 / FPS);
    for (let i = 0; i < frames; i++) await this.shot();
    return ms;
  }
  async scrollSmooth(sec, distancePx = null) {
    const page = this.page;
    const steps = Math.max(2, Math.round(sec * SLOW * FPS));
    const ms = Math.round(1000 / FPS);
    const dist = distancePx ?? (await page.evaluate(() => {
      const el = document.scrollingElement || document.body;
      return Math.max(0, el.scrollHeight - el.clientHeight);
    }));
    const step = dist / steps;
    for (let i = 0; i < steps; i++) {
      await page.evaluate((s) => {
        const el = document.scrollingElement || document.body;
        el.scrollBy({ top: s, behavior: 'instant' });
      }, step);
      await sleep(ms / 2);
      await this.shot();
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function goAndWait(page, url, need = []) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  } catch (e) {
    console.log('  goto note:', e.message.split('\n')[0]);
  }
  for (const sel of need) {
    try {
      await page.waitForSelector(sel, { timeout: 15000 });
    } catch {
      console.log(`  ⚠️ element missing after load: ${sel}`);
    }
  }
  await sleep(1000);
}

async function setInput(page, selector, value, delay = 60) {
  try {
    await page.waitForSelector(selector, { timeout: 15000 });
    await page.click(selector);
    await page.type(selector, value, { delay });
  } catch (e) {
    await sleep(800); // بعض الريموندات تعيد الرندر بعد فترة
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.click(selector);
      await page.type(selector, value, { delay });
    } catch (e2) {
      console.log('  ⚠️ typing failed, fallback native set:', e2.message.split('\n')[0]);
      try {
        return page.evaluate((sel, val) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }, selector, value);
      } catch { return false; }
    }
  }
  await sleep(600);
  return true;
}

async function clickByText(page, text) {
  const ok = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button')];
    const b = els.find((x) => (x.textContent || '').trim() === t);
    if (!b) return false;
    b.click();
    return true;
  }, text);
  if (!ok) console.log(`  [click] button "${text}" not found`);
  return ok;
}

// اختيار قيمة من أي <select> يحتوي خيارًا بنفس النص
async function setSelectValue(page, optionText) {
  return page.evaluate((label) => {
    const sels = document.querySelectorAll('select');
    for (const s of sels) {
      const opt = [...s.options].find((o) => (o.textContent || '').trim() === label);
      if (opt) {
        s.value = opt.value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, optionText);
}

// اختيار نوع الإعلان (شاحنة أو معدات / حمولة / وظيفة / قطعة غيار)
async function pickType(page, name) {
  const ok = await clickByText(page, name);
  if (!ok) console.log(`  [type] "${name}" not found`);
  await sleep(700);
  return ok;
}

// سنة الصنع: تعيين مباشر بمقاومة الرندر المتكرر (بدون click/type بطيئين)
async function setYear(page, year) {
  for (let i = 0; i < 3; i++) {
    const ok = await page.evaluate((v) => {
      const el = document.querySelector('input[placeholder="2020"]');
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, year);
    if (ok) { await sleep(400); return true; }
    await sleep(1200);
  }
  console.log('  [year] skipped');
  return false;
}

// انتظار عنصر بدون فشل قاتل
async function waitSel(page, sel, ms = 10000) {
  try { await page.waitForSelector(sel, { timeout: ms }); return true; } catch { return false; }
}

// توليد صور (تحاول صور توليد حقيقية من روابط مشروعية موجودة في الكود، وإلا ألوان صلبة)
async function makeSampleImages(dir) {
  const urls = [
    'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1000&q=80',
    'https://images.unsplash.com/photo-1603814744247-ca3e77714471?w=1000&q=80',
    'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1000&q=80',
  ];
  const files = [];
  for (let i = 0; i < urls.length; i++) {
    const out = path.join(dir, `sample_${i + 1}.jpg`);
    let ok = false;
    try {
      const res = await Promise.race([
        fetch(urls[i]).catch(() => null),
        sleep(20000).then(() => null),
      ]);
      if (res && res.ok) {
        fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
        ok = true;
      }
    } catch { /* fall back */ }
    if (!ok && ffmpegPath) {
      try {
        execFileSync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', `color=c=${['orange', 'teal', 'slate'][i]}:s=1000x600`, '-frames:v', '1', '-q:v', '6', out], { stdio: 'pipe' });
        ok = true;
      } catch { /* ignore */ }
    }
    if (ok) files.push(out);
  }
  console.log('  sample images:', files.length);
  return files;
}

async function encode(id, name) {
  const dir = path.join(FRAMES, id);
  const out = path.join(OUT, name);
  if (!ffmpegPath) { console.log('  🔴 ffmpeg-static missing'); return false; }
  const args = ['-y', '-framerate', String(FPS), '-i', path.join(dir, 'f_%04d.png'),
    '-vf', `scale=${W}:${H}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out];
  execFileSync(ffmpegPath, args, { stdio: 'pipe' });
  return true;
}

async function fetchListingId() {
  try {
    const snap = await db.collection('listings').orderBy('createdAt', 'desc').limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  } catch (e) { console.log('  fetch listing note:', e.message.split('\n')[0]); }
  return 'uQbh0Q5CRejK';
}

async function ensureOrCreateDemo() {
  let user;
  try { user = await auth.getUserByEmail(DEMO_EMAIL); }
  catch {
    user = await auth.createUser({ email: DEMO_EMAIL, password: DEMO_PASS, displayName: 'مستخدم تجريبي' });
    console.log('  demo user created:', user.uid);
  }
  return user.uid;
}
async function deleteDemo() {
  try {
    const user = await auth.getUserByEmail(DEMO_EMAIL);
    await db.collection('users').doc(user.uid).delete().catch(() => {});
    await auth.deleteUser(user.uid);
    console.log('  demo user deleted ✓');
  } catch {}
}

async function deleteListingByToken(token) {
  try {
    const snap = await db.collection('listings').where('title', '>=', token).where('title', '<=', token + '\uf8ff').get();
    let n = 0;
    for (const d of snap.docs) {
      if ((d.data().title || '').includes(token)) { await d.ref.delete().catch(() => {}); n++; }
    }
    console.log('  cleanup listings deleted:', n);
  } catch (e) { console.log('  cleanup note:', e.message.split('\n')[0]); }
}

async function run() {
  const id = await fetchListingId();
  console.log('listing id for detail clip:', id);
  const demoUid = await ensureOrCreateDemo();

  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--lang=ar', '--force-device-scale-factor=2'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36');
  // الوضع النهاري دائمًا (التطبيق يتبع prefers-color-scheme)
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tareeq_theme', 'light'); } catch {} });
  // إحداثيات القاهرة لإظهار "استخدام موقعي الحالي"
  try { await page.setGeolocation({ latitude: 30.0444, longitude: 31.2357 }); } catch {}
  try { await browser.defaultBrowserContext().overridePermissions('https://carmasr-app.vercel.app', ['geolocation']); } catch {}

  const clips = [
    { id: '01-home', file: '01-الرئيسية.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/`, ['a[href*="/listing/"]']);
      await r.pause(1.0);
      await r.scrollSmooth(1.4);
      await r.pause(0.7);
    }},
    { id: '02-register', file: '02-إنشاء-حساب.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/register`, ['input[placeholder="الاسم الثلاثي"]']);
      await r.pause(1.0);
      await setInput(page, 'input[placeholder="الاسم الثلاثي"]', 'علي محمد السيد');
      await r.pause(0.9);
      await setInput(page, 'input[placeholder="01xxxxxxxxx"]', DEMO_PHONE);
      await r.pause(0.9);
      // توضيح اختيار نوع الحساب: فرد ← سائق ← شركة نقل
      for (const t of ['فرد', 'سائق', 'شركة نقل']) {
        await page.evaluate((label) => {
          const sel = [...document.querySelectorAll('select')].find((s) =>
            [...s.options].some((o) => (o.textContent || '').trim() === 'شركة نقل'));
          if (!sel) return;
          const opt = [...sel.options].find((o) => (o.textContent || '').trim() === label);
          if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        }, t);
        await r.pause(0.7);
      }
      // المحافظة → القاهرة
      await page.evaluate(() => {
        const sel = [...document.querySelectorAll('select')].find((s) =>
          (s.options[0]?.textContent || '').trim() === 'اختر المحافظة');
        const opt = sel && [...sel.options].find((o) => (o.textContent || '').trim() === 'القاهرة');
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      await r.pause(0.7);
      await setInput(page, 'input[type="password"]', 'كلمة مرور آمنة');
      await r.pause(0.9);
      await r.pause(0.6);
    }},
    { id: '03-login', file: '03-تسجيل-الدخول.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/login`, ['input[placeholder="01xxxxxxxxx"]']);
      await r.pause(1.0);
      // توضيح خيار الدخول بحساب Google
      await clickByText(page, 'Google');
      await r.pause(1.4);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /Google/.test((x.textContent || '').trim()));
        if (b) b.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      await r.pause(1.2);
      // الرجوع لدخول الموبايل وتنفيذه
      await clickByText(page, 'الموبايل');
      await r.pause(0.9);
      await setInput(page, 'input[placeholder="01xxxxxxxxx"]', DEMO_PHONE);
      await r.pause(0.7);
      await setInput(page, 'input[type="password"]', DEMO_PASS);
      await r.pause(0.6);
      const clicked = await clickByText(page, 'دخول بالموبايل');
      if (clicked) {
        try { await page.waitForFunction(() => location.pathname === '/', { timeout: 18000 }); } catch {}
        const p = await page.evaluate(() => location.pathname);
        console.log('  login → pathname=' + p);
      } else {
        console.log('  ⚠️ login button not found');
      }
      await r.pause(1.5);
    }},
    { id: '04-profile', file: '04-استكمال-البيانات-شركة-معرض.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/complete-profile`, ['input[placeholder="أدخل اسمك الكامل"]']);
      await r.pause(1.0);
      await setInput(page, 'input[placeholder="أدخل اسمك الكامل"]', 'علي محمد السيد', 25);
      await r.pause(0.9);
      // نوع الحساب → شركة نقل (يُظهر أنه اختيار واضح)
      await page.evaluate(() => {
        for (const s of document.querySelectorAll('select')) {
          const opts = [...s.options].map((o) => (o.textContent || '').trim());
          if (opts.includes('شركة نقل')) { s.value = 'company'; s.dispatchEvent(new Event('change', { bubbles: true })); break; }
        }
      });
      await r.pause(0.8);
      // المحافظة → القاهرة
      await page.evaluate(() => {
        for (const s of document.querySelectorAll('select')) {
          if ((s.options[0]?.textContent || '').trim() === 'اختر المحافظة') {
            s.value = 'القاهرة'; s.dispatchEvent(new Event('change', { bubbles: true })); break;
          }
        }
      });
      await r.pause(0.8);
      await setInput(page, 'input[placeholder="أدخل المركز أو المدينة"]', 'مدينة نصر', 25);
      await r.pause(0.9);
      await setInput(page, 'input[placeholder="أدخل اسم الشركة"]', 'معرض النور للشاحنات', 25);
      await r.pause(0.9);
      await page.evaluate(() => { window.alert = () => {}; });
      if (await clickByText(page, 'حفظ البيانات')) {
        try { await page.waitForFunction(() => location.pathname === '/profile', { timeout: 15000 }); } catch {}
        console.log('  profile saved →', await page.evaluate(() => location.pathname));
      }
      await r.pause(1.5);
    }},
    { id: '05-post-sell', file: '05-بيع-شاحنة.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/post-listing`, ['input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]']);
      await r.pause(0.9);
      await setInput(page, 'input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]', 'شاحنة فولفو FH16 سنة 2020 للبيع', 45);
      await r.pause(0.9);
      await setInput(page, 'input[placeholder="مثال: Volvo"]', 'فولفو', 45);
      await r.pause(0.6);
      await setInput(page, 'input[placeholder="مثال: FH16"]', 'FH16', 45);
      await r.pause(0.6);
      await setYear(page, '2020');
      await r.pause(0.6);
      // المحافظة → القاهرة (تُفتح مراكز المحافظة في حقل المنطقة) — ظاهرة على الشاشة
      await page.evaluate(() => {
        const sel = [...document.querySelectorAll('select')].find((s) =>
          [...s.options].some((o) => (o.textContent || '').trim() === 'القاهرة'));
        if (sel) sel.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      await r.pause(0.8);
      await setSelectValue(page, 'القاهرة');
      await r.pause(1.0);
      await page.evaluate(() => {
        const sel = [...document.querySelectorAll('select')].find((s) =>
          [...s.options].some((o) => (o.textContent || '').trim() === 'مدينة نصر'));
        if (sel) { sel.scrollIntoView({ block: 'center', behavior: 'instant' }); sel.focus(); }
      });
      await r.pause(0.9);
      await setSelectValue(page, 'مدينة نصر');
      await r.pause(1.0);
      // زر تحديد الموقع الحالي ظاهر للشرح
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('استخدام موقعي'));
        if (b) b.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      await r.pause(1.0);
      if (await waitSel(page, 'input[placeholder="مثال: 1,000,000"]', 8000)) {
        await setInput(page, 'input[placeholder="مثال: 1,000,000"]', '1500000', 45);
        await r.pause(0.9);
      } else {
        console.log('  [05] price input missing after form re-render');
      }
      await r.scrollSmooth(1.4);
      await r.pause(0.8);
    }},
    { id: '06-post-rent', file: '06-إيجار-شاحنة.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/post-listing`, ['input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]']);
      await r.pause(0.9);
      await setInput(page, 'input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]', 'شاحنة فولفو FH16 للإيجار', 45);
      await r.pause(0.8);
      await clickByText(page, 'إيجار');
      await r.pause(0.8);
      await setInput(page, 'input[placeholder="مثال: Volvo"]', 'فولفو', 45);
      await r.pause(0.6);
      await setInput(page, 'input[placeholder="مثال: FH16"]', 'FH16', 45);
      await r.pause(0.6);
      await setYear(page, '2024');
      await r.pause(0.6);
      await setSelectValue(page, 'القاهرة');
      await r.scrollSmooth(0.9, 500);
      await r.pause(0.7);
      // أسعار الإيجار (يومي / أسبوعي / شهري / تأمين)
      await page.evaluate(() => {
        const empties = [...document.querySelectorAll('input[placeholder="0"]')];
        const vals = ['1500', '9000', '35000', '5000'];
        for (let i = 0; i < Math.min(vals.length, empties.length); i++) {
          const el = empties[i];
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, vals[i]);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await r.pause(1.2);
      await r.scrollSmooth(1.2);
      await r.pause(0.8);
    }},
    { id: '07-post-equipment', file: '07-معدات-ثقيلة.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/post-listing`, ['input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]']);
      await r.pause(0.9);
      await setSelectValue(page, 'معدات ثقيلة');
      await r.pause(0.8);
      await setInput(page, 'input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]', 'لودر كوماتسو WA380 سنة 2021', 45);
      await r.pause(0.9);
      await setInput(page, 'input[placeholder="مثال: Volvo"]', 'كوماتسو', 45);
      await r.pause(0.6);
      await setInput(page, 'input[placeholder="مثال: FH16"]', 'WA380', 45);
      await r.pause(0.6);
      await setYear(page, '2021');
      await r.pause(0.6);
      // استخدم "تحديد موقعك الحالي" (يحقن إحداثيات بدل GPS افتراضي)
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('استخدام موقعي'));
        if (b) b.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      await r.pause(0.9);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('استخدام موقعي'));
        if (b) { b.click(); return true; }
        return false;
      });
      await sleep(2500);
      const gov = await page.$$eval('select', (ss) => ss.filter((s) => [...s.options].some((o) => (o.textContent || '').trim() === 'مدينة نصر')).map((s) => s.value).join('|'));
      console.log('  [gps] governorate fill →', gov);
      await r.pause(1.2);
      if (await waitSel(page, 'input[placeholder="مثال: 1,000,000"]', 8000)) {
        await setInput(page, 'input[placeholder="مثال: 1,000,000"]', '2500000', 45);
        await r.pause(0.9);
      } else {
        console.log('  [07] price input missing after GPS');
      }
      await r.scrollSmooth(1.3);
      await r.pause(0.8);
    }},
    { id: '08-post-part', file: '08-قطعة-غيار.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/post-listing`, ['input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]']);
      await r.pause(0.9);
      await pickType(page, 'قطعة غيار');
      await goAndWait(page, `${BASE}/post-listing?type=spare-part`, ['input[placeholder="مثال: طقم فرامل مرسيدس أكتروس أصلي"]']);
      await r.pause(0.8);
      await setInput(page, 'input[placeholder="مثال: طقم فرامل مرسيدس أكتروس أصلي"]', 'طقم فرامل مرسيدس أكتروس أصلي', 45);
      await r.pause(0.9);
      await setInput(page, 'input[placeholder="مثال: Mercedes"]', 'مرسيدس', 45);
      await r.pause(0.6);
      await setInput(page, 'input[placeholder="مثال: رقم القطعة أو الموديل"]', 'أكتروس MP4', 45);
      await r.pause(0.6);
      await setYear(page, '2023');
      await r.pause(0.6);
      // إظهار الفرعيات الكثيرة: تمرير التصنيف الفرعي على عدة خيارات
      await r.scrollSmooth(0.5, 500);
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'التصنيف الفرعي');
        if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      await r.pause(0.8);
      for (const sub of ['محركات', 'فرامل', 'إطارات', 'كهربائيات', 'فلاتر']) {
        await setSelectValue(page, sub);
        await r.pause(0.6);
      }
      await setSelectValue(page, 'فرامل');
      await r.pause(0.5);
      await setSelectValue(page, 'القاهرة');
      await r.scrollSmooth(0.9, 500);
      await r.pause(0.7);
      if (await waitSel(page, 'input[placeholder="مثال: 1,000,000"]', 8000)) {
        await setInput(page, 'input[placeholder="مثال: 1,000,000"]', '4500', 45);
        await r.pause(0.9);
      } else {
        console.log('  [08] price input missing');
      }
      await r.scrollSmooth(1.4);
      await r.pause(0.8);
    }},
    { id: '09-post-load', file: '09-إضافة-حمولة.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/post-listing`, ['input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]']);
      await r.pause(0.9);
      await pickType(page, 'حمولة');
      await goAndWait(page, `${BASE}/post-listing?type=load`, ['input[placeholder="القاهرة"]']);
      await r.pause(0.8);
      await setInput(page, 'input[placeholder="القاهرة"]', 'القاهرة', 45);
      await r.pause(0.7);
      await setInput(page, 'input[placeholder="الإسكندرية"]', 'الإسكندرية', 45);
      await r.pause(0.7);
      await setInput(page, 'input[placeholder="20"]', '20', 45);
      await r.pause(0.7);
      await setInput(page, 'input[placeholder="5000"]', '5000', 45);
      await r.pause(0.9);
      await r.scrollSmooth(1.4);
      await r.pause(0.8);
    }},
    { id: '10-post-job', file: '10-إضافة-وظيفة.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/post-listing`, ['input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]']);
      await r.pause(0.9);
      await pickType(page, 'وظيفة');
      await goAndWait(page, `${BASE}/post-listing?type=job`, ['input[placeholder="سائق شاحنة ثقيلة"]']);
      await r.pause(0.8);
      await setInput(page, 'input[placeholder="سائق شاحنة ثقيلة"]', 'سائق شاحنة ثقيلة', 45);
      await r.pause(0.7);
      await setSelectValue(page, 'شركة تطلب موظفين');
      await r.pause(0.7);
      await setInput(page, 'input[placeholder="اسم الشركة أو اسمك"]', 'شركة النور للنقل', 45);
      await r.pause(0.7);
      await setInput(page, 'input[placeholder="4000 جنيه + عمولة"]', '15000 جنيه', 45);
      await r.pause(0.7);
      await setInput(page, 'input[placeholder="3 سنوات فأكثر"]', '5 سنوات', 45);
      await r.pause(0.9);
      await r.scrollSmooth(1.3);
      await r.pause(0.8);
    }},
    { id: '11-upload-photos', file: '11-رفع-الصور.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/post-listing`, ['input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]']);
      await r.pause(0.9);
      await setInput(page, 'input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]', 'مرسيدس أكتروس 2023 للبيع', 45);
      await r.pause(0.7);
      await setSelectValue(page, 'القاهرة');
      await r.scrollSmooth(1.2, 800);
      await r.pause(0.7);
      await page.evaluate(() => {
        const add = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'إضافة');
        if (add) add.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      await r.pause(0.8);
      const tmp = path.join(FRAMES, 'samples');
      fs.mkdirSync(tmp, { recursive: true });
      const files = await makeSampleImages(tmp);
      if (files.length) {
        const input = await page.$('input[type="file"]');
        if (input) {
          await input.uploadFile(...files);
          console.log('  uploaded sample images for preview');
          try { await page.waitForFunction(() => document.querySelectorAll('img[src*="cloudinary"]').length >= 2, { timeout: 45000 }); } catch {}
          await sleep(2000);
          await r.pause(2.0);
          await r.scrollSmooth(0.8, 400);
          await r.pause(1.0);
        }
      } else {
        await r.pause(1.2);
      }
    }},
    { id: '12-contact', file: '12-التواصل-مع-المعلن.mp4', scene: async (r) => {
      await goAndWait(page, `${BASE}/listing/${id}`);
      await r.pause(1.0);
      await r.scrollSmooth(1.0, 700);
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('a')].filter((a) => /رسالة|واتساب|اتصال مباشر/.test((a.textContent || '')));
        if (btns[0]) btns[0].scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      await r.pause(1.0);
      const mes = await page.evaluate(() => {
        const m = [...document.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === 'رسالة');
        if (m) { m.click(); return true; }
        return false;
      });
      if (mes) {
        try { await page.waitForFunction(() => location.pathname.startsWith('/inbox'), { timeout: 15000 }); } catch {}
        console.log('  contact →', await page.evaluate(() => location.pathname));
      }
      await r.pause(1.8);
      await r.scrollSmooth(0.7, 300);
      await r.pause(0.8);
    }},
    {
      id: '13-full-publish',
      file: '13-نشر-إعلان-بالصور-وإدارته-من-البروفايل.mp4',
      scene: async (r) => {
        const TOKEN = 'تجريبية 2026';
        const TITLE = 'شاحنة فولفو تجريبية 2026 للبيع';
        // إنشاء الإعلان كاملًا بحقول ومعلومات (price placeholder مثال: 1,000,000)
        await goAndWait(page, `${BASE}/post-listing`, ['input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]']);
        await r.pause(0.6);
        await setInput(page, 'input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]', TITLE, 25);
        await r.pause(0.5);
        await setInput(page, 'input[placeholder="مثال: فولفو"]', 'فولفو', 45);
        await r.pause(0.4);
        await setInput(page, 'input[placeholder="مثال: FH16"]', 'FH16', 45);
        await r.pause(0.4);
        await setYear(page, '2026');
        await r.pause(0.4);
        await setSelectValue(page, 'القاهرة');
        await r.pause(0.6);
        await setSelectValue(page, 'مدينة نصر');
        await r.pause(0.5);
        const price = await waitSel(page, 'input[placeholder*="1,000,000"]');
        if (price) { await setInput(page, 'input[placeholder*="1,000,000"]', '1500000', 45); await r.pause(0.5); }
        await r.scrollSmooth(1.2, 800);
        await r.pause(0.5);
        // رفع صور حقيقية
        const tmp = path.join(FRAMES, 'samples13');
        fs.mkdirSync(tmp, { recursive: true });
        const files = await makeSampleImages(tmp);
        if (files.length) {
          const input = await page.$('input[type="file"]');
          if (input) {
            await input.uploadFile(...files);
            try { await page.waitForFunction(() => document.querySelectorAll('img[src*="cloudinary"]').length >= 2, { timeout: 60000 }); } catch {}
            await sleep(1500);
            await r.pause(1.6);
          }
        }
        await r.scrollSmooth(1.0, 600);
        await r.pause(0.6);
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'نشر الإعلان');
          if (b) b.scrollIntoView({ block: 'center', behavior: 'instant' });
        });
        await r.pause(0.9);
        const pub = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'نشر الإعلان');
          if (b) { b.click(); return true; }
          return false;
        });
        console.log('  publish clicked:', pub);
        await r.pause(1.2);
        try {
          await page.waitForFunction(() => /نشر|مراجعة|خطأ/.test(document.body.innerText), { timeout: 50000 });
          await sleep(1200);
        } catch {}
        await r.pause(1.6);
        // تفعيل إن كان قيد المراجعة حتى يظهر في الرئيسية
        try {
          const snap = await db.collection('listings').where('userId', '==', demoUid).get();
          if (!snap.empty) {
            snap.docs.sort((a, b) => ((b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0)));
            await db.collection('listings').doc(snap.docs[0].id).update({ status: 'active' });
            console.log('  listing-set-active:', snap.docs[0].id);
          } else { console.log('  no listing found for user'); }
        } catch (e) { console.log('  set-active note:', e.message.split('\n')[0]); }
        // ظهوره في الصفحة الرئيسية
        await goAndWait(page, `${BASE}/`, ['a[href*="/listing/"]']);
        await sleep(1800);
        const found = await page.evaluate((t) => document.body.innerText.includes(t), TITLE);
        console.log('  found-on-home:', found);
        await r.pause(1.1);
        if (found) {
          await page.evaluate((t) => {
            const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.textContent || '').includes(t));
            if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }, TITLE);
          await r.pause(1.8);
        }
        // إدارة الإعلان من حساب العميل (تعديل → تم البيع → إلغاء → حذف)
        await goAndWait(page, `${BASE}/profile`, ['h1, a[href="/my-listings"], button']);
        await r.pause(1.1);
        await goAndWait(page, `${BASE}/my-listings`, ['a[href*="/listing/"]']);
        await r.pause(0.8);
        const hasCard = await page.evaluate((t) => document.body.innerText.includes(t), TITLE);
        console.log('  found-in-my-listings:', hasCard);
        if (hasCard) {
          await r.pause(1.0);
          // تعديل الإعلان
          const editClick = await page.evaluate(() => {
            const el = [...document.querySelectorAll('a')].find((a) => (a.textContent || '').includes('تعديل'));
            if (el) { el.click(); return true; }
            return false;
          });
          if (editClick) {
            try { await page.waitForFunction(() => location.pathname.includes('/edit'), { timeout: 15000 }); } catch {}
            await r.pause(1.4);
          }
          await goAndWait(page, `${BASE}/my-listings`, ['a[href*="/listing/"]']);
          await r.pause(0.6);
          // فتح الإعلان ﻹظهار تم البيع
          await page.evaluate(() => {
            const el = [...document.querySelectorAll('a')].find((a) => (a.textContent || '').includes('عرض'));
            if (el) el.click();
          });
          try { await page.waitForFunction(() => (document.body.innerText || '').includes('تم البيع'), { timeout: 15000 }); } catch {}
          await r.pause(0.9);
          await page.evaluate(() => {
            const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('تم البيع'));
            if (b) b.click();
          });
          await r.pause(1.1);
          await page.evaluate(() => {
            const c = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'نعم، عبر كار مصر');
            if (c) c.click();
          });
          try { await page.waitForFunction(() => /إلغاء (البيع|الإيجار)/.test(document.body.innerText), { timeout: 15000 }); } catch {}
          await r.pause(1.3);
          await page.evaluate(() => {
            const u = [...document.querySelectorAll('button')].find((x) => /إلغاء (البيع|الإيجار)/.test(x.textContent || ''));
            if (u) u.click();
          });
          await r.pause(1.0);
          // حذف الإعلان من إعلاناتي
          await goAndWait(page, `${BASE}/my-listings`, ['a[href*="/listing/"]']);
          await r.pause(0.6);
          await page.evaluate(() => { window.confirm = () => true; });
          await page.evaluate(() => {
            const d = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('حذف'));
            if (d) d.click();
          });
          await sleep(2500);
          const gone = await page.evaluate((t) => !document.body.innerText.includes(t), TITLE);
          console.log('  deleted-from-list:', gone);
          await r.pause(1.2);
        } else {
          await r.pause(1.2);
        }
      },
    },
  ];

  const only = process.argv[2];
  let runClips = clips;
  if (only) {
    const postDeps = ['05-post-sell','06-post-rent','07-post-equipment','08-post-part','09-post-load','10-post-job','11-upload-photos','12-contact','13-full-publish'];
    const targets = postDeps.includes(only) ? ['03-login','04-profile', only] : [only];
    runClips = clips.filter((c) => targets.includes(c.id));
    console.log('only →', targets.join(', '));
  }

  for (const clip of runClips) {
    try {
      console.log(`--- clip ${clip.id} (${clip.file})`);
      const r = new Recorder(page, clip.id);
      await Promise.race([
        clip.scene(r),
        sleep(600000).then(() => { throw new Error('scene timeout 600s'); }),
      ]);
      const frames = fs.readdirSync(r.dir).filter((f) => f.endsWith('.png')).length;
      if (frames < 5) { console.log(`  ⚠️ only ${frames} frames`); continue; }
      const out = await encode(clip.id, clip.file);
      console.log(`  ✅ ${clip.file} — ${frames} frames (${Math.round(frames / FPS)}s)`);
    } catch (e) {
      console.log(`  🔴 ${clip.id} failed:`, e.message.split('\n')[0]);
    }
  }

  await browser.close();
  await deleteDemo();
  await deleteListingByToken('تجريبية 2026');
  clearDir(FRAMES);
  console.log('\nDONE — clips in:', OUT);
}

run().catch((e) => { console.error('run error:', e); process.exit(1); });