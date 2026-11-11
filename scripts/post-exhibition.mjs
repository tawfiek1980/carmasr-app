import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://carmasr-app.vercel.app';
const W = 360, H = 772, DSF = 3, FPS = 30;
const BUILD = path.resolve('videos/build');
const IMGDIR = path.join(BUILD, 'truck-imgs');
const DEMO_PHONE = '01000000099';
const DEMO_PASS = 'TareeqDemo2026!';
const KEY = 'AIzaSyBCl9kOWTqWx2emPhi_tAfhwzjXz53B3jo';
const PROJECT = 'tareeq-d4dcc';
const DEMO_EMAIL = 'phone_1000000099@tareeq.app';

const SLOW = 1.8;
const AFTER = 1.0;

const EX = {
  name: 'معرض النور للشاحنات',
  gov: 'القاهرة',
  city: 'مدينة نصر',
  phone: '01008033414',
  whatsapp: '01008033414',
  hours: '٩ ص - ٩ م',
  desc: ['معرض متخصص في بيع وشراء الشاحنات الثقيلة والمقطورات', 'عربيات بحالة ممتازة وأسعار منافسة'].join('\n'),
};

const V = {
  title: 'شاحنة فولفو FH 460 موديل 2016',
  subcategory: 'رؤوس جرارات',
  brand: 'Volvo',
  model: 'FH 460',
  year: '2016',
  gov: 'القاهرة',
  price: '1800000',
  desc: [
    'شاحنة فولفو FH 460 موديل 2016',
    'عداد 850 ألف كم — صيانة دورية كاملة',
    'رخصة سارية وتأمين شامل',
    'معروضة من معرض النور للشاحنات',
  ].join('\n'),
  advertiser: EX.name,
  phone: '01008033414',
  images: ['volvo1.jpg', 'volvo2.jpg', 'volvo3.jpg', 'volvo4.jpg'],
};

const FRAMES = path.join(BUILD, 'exhibition-frames');
const RAW = path.join(BUILD, 'exhibition-raw.mp4');
const TIMELINE = path.join(BUILD, 'exhibition-timeline.json');

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

async function rectOfEl(page, text) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a')].find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === t);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, text);
}

async function clickEl(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a')].find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === t);
    if (!el) return false;
    el.click();
    return true;
  }, text);
  if (!ok) console.log(`  [click] "${text}" not found`);
  return ok;
}

async function step(page, r, text, caption) {
  const rect = await rectOfEl(page, text);
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

async function addPhotos(page, r, files, caption) {
  const abs = files.map((f) => path.join(IMGDIR, f));
  const rect = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'إضافة');
    if (b) b.scrollIntoView({ block: 'center' });
    const r = b ? b.getBoundingClientRect() : null;
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
  });
  await annotate(page, rect, caption);
  await r.pause(SLOW);

  let usedChooser = false;
  try {
    const handle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'إضافة'));
    const el = handle.asElement();
    if (!el) throw new Error('add button lost');
    const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 8000 }), el.click()]);
    await chooser.accept(abs);
    usedChooser = true;
    console.log('    file chooser accepted');
  } catch (e) {
    console.log('    chooser fallback:', e.message.split('\n')[0]);
  }
  if (!usedChooser) {
    const input = await page.$('input[type=file]');
    if (input) await input.uploadFile(...abs);
    else console.log('  [upload] no file input');
  }

  try {
    await page.waitForFunction((n) => document.querySelectorAll('img[alt^="صورة"]').length >= n, { timeout: 90000, polling: 500 }, abs.length);
    console.log('    images uploaded ✓');
  } catch { console.log('    ⚠️ uploaded images not detected'); }
  await r.pause(2.2);
}

async function findExhibitionId(name) {
  const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASS, returnSecureToken: true }),
  }).then((r) => r.json());
  if (!auth.idToken) throw new Error('auth for REST failed');
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const q = await fetch(`${base}:runQuery`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.idToken}` },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'exhibitions' }], where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: auth.localId } } } } }),
    }).then((r) => r.json());
    const docs = (Array.isArray(q) ? q : []).filter((x) => x.document);
    const matches = docs.filter((d) => {
      const f = d.document.fields || {};
      return (f.name?.stringValue || '') === name && (f.status?.stringValue || 'active') === 'active';
    });
    if (matches.length) {
      matches.sort((a, b) => {
        const av = a.document.fields?.createdAt?.timestampValue || '';
        const bv = b.document.fields?.createdAt?.timestampValue || '';
        return bv.localeCompare(av);
      });
      return matches[0].document.name.split('/').pop();
    }
    await sleep(1000);
  }
  return null;
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
  console.log('scenario: exhibition (showroom) →', EX.name);
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
      const rect2 = await page.evaluate(() => { const el = document.querySelector('input[placeholder="01xxxxxxxxx"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; });
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

    // 3) قسم المعارض
    console.log('• exhibitions list');
    await goAndWait(page, `${BASE}/exhibitions`, ['a[href="/exhibitions/subscribe"]']);
    await annotate(page, null, '٣) قسم المعارض — اعمل معرضك الخاص');
    await r.pause(1.6);

    // 4) اضغط اشترك في معرض
    await step(page, r, 'اشترك في معرض', '٤) اضغط «اشترك في معرض»');
    try { await page.waitForSelector('input[placeholder="اسم معرضك التجاري"]', { timeout: 20000 }); } catch {}
    await r.pause(1.2);
    await annotate(page, null, '٥) اختر الباقة المجانية — نشطة فورًا بدون دفع');
    await r.pause(1.8);

    // 6) اسم المعرض
    await stepType(page, r, 'اسم المعرض', EX.name, '٦) اسم المعرض', { perChar: 0.07, shots: 2 });

    // 7) المحافظة
    await stepSelect(page, r, EX.gov, `٧) المحافظة: «${EX.gov}»`);

    // 8) المدينة
    await stepType(page, r, 'المدينة', EX.city, '٨) المدينة', { perChar: 0.1, shots: 2 });

    // 9) رقم التواصل
    await stepType(page, r, 'رقم التواصل', EX.phone, '٩) رقم التواصل', { perChar: 0.09, shots: 1 });

    // 10) واتساب
    await stepType(page, r, 'واتساب', EX.whatsapp, '١٠) رقم الواتساب', { perChar: 0.09, shots: 1 });

    // 11) ساعات العمل
    await stepType(page, r, 'ساعات العمل', EX.hours, '١١) ساعات العمل', { perChar: 0.12, shots: 1 });

    // 12) وصف المعرض
    await stepType(page, r, 'وصف المعرض', EX.desc, '١٢) وصف المعرض', { perChar: 0.03, shots: 1 });

    // 13) إنشاء المعرض مجاناً
    await clearAnno(page);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await r.pause(1.2);
    await step(page, r, 'إنشاء المعرض مجاناً', '١٣) اضغط «إنشاء المعرض مجاناً»');
    try {
      await page.waitForFunction(() => /تم إنشاء معرضك بنجاح|تم بنجاح/.test(document.body.innerText), { timeout: 30000 });
      console.log('    showroom created ✓');
    } catch { console.log('    ⚠️ showroom success not detected'); }
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await annotate(page, null, 'تم! معرضك اتفتح على كار مصر فورًا ✅');
    await r.pause(2.2);

    // resolve id + open showroom
    const exId = await findExhibitionId(EX.name);
    console.log('  exhibition id =', exId);
    if (exId) {
      console.log('• showroom page');
      await goAndWait(page, `${BASE}/exhibitions/${exId}`, []);
      await annotate(page, null, 'ده معرضك — دلوقتي هننشر إعلان عربية جواه');
      await r.pause(1.8);
    }

    // 14) صفحة نشر إعلان عربية
    console.log('• post vehicle');
    await goAndWait(page, `${BASE}/post-listing?type=vehicle`, ['input[placeholder="مثال: شاحنة فولفو 2020"]']);
    await annotate(page, null, '١٤) صفحة نشر إعلان عربية');
    await r.pause(1.4);

    // 15) عنوان الإعلان
    await stepType(page, r, 'عنوان الإعلان', V.title, '١٥) عنوان الإعلان', { perChar: 0.06, shots: 2 });

    // 16) التصنيف الفرعي
    await stepSelect(page, r, V.subcategory, `١٦) التصنيف: «${V.subcategory}»`);

    // 17) الماركة
    await stepType(page, r, 'الماركة', V.brand, '١٧) الماركة (Volvo)', { perChar: 0.13, shots: 2 });

    // 18) الموديل
    await stepType(page, r, 'الموديل', V.model, '١٨) الموديل', { perChar: 0.13, shots: 2 });

    // 19) سنة الصنع
    await stepType(page, r, 'سنة الصنع', V.year, '١٩) سنة الصنع', { perChar: 0.14, shots: 1 });

    // 20) المحافظة
    await stepSelect(page, r, V.gov, `٢٠) المحافظة: «${V.gov}»`);

    // 21) السعر
    await stepType(page, r, 'السعر (جنيه)', V.price, '٢١) السعر بالجنيه', { perChar: 0.09, shots: 1 });

    // 22) الصور
    await addPhotos(page, r, V.images, '٢٢) ارفع صور العربية من الإنترنت');

    // 23) الوصف
    await stepType(page, r, 'وصف الإعلان', V.desc, '٢٣) وصف الإعلان', { perChar: 0.03, shots: 1 });

    // 24) اسم المعلن
    await stepType(page, r, 'اسم المعلن (معرض أو فرد)', V.advertiser, '٢٤) اسم المعلن = اسم معرضك', { perChar: 0.07, shots: 1 });

    // 25) رقم التواصل
    await stepType(page, r, 'رقم هاتف التواصل (اختياري)', V.phone, '٢٥) رقم التواصل', { perChar: 0.07, shots: 1 });

    // 26) مراجعة + نشر
    await clearAnno(page);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await annotate(page, null, '٢٦) راجع البيانات ثم اضغط «نشر الإعلان»');
    await r.pause(1.5);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await sleep(300);
    await step(page, r, 'نشر الإعلان', 'اضغط «نشر الإعلان»');
    try {
      await page.waitForFunction(() => /تم إرسال إعلانك|إعلاناتي|قيد المراجعة/.test(document.body.innerText), { timeout: 40000 });
      console.log('    listing published ✓');
    } catch { console.log('    ⚠️ listing success not detected'); }
    await r.pause(2.0);

    // 27) رجوع للمعرض لعرض الإعلان جواه
    if (exId) {
      console.log('• back to showroom');
      await goAndWait(page, `${BASE}/exhibitions/${exId}`, []);
      try {
        await page.waitForFunction(() => /إعلانات صاحب المعرض/.test(document.body.innerText), { timeout: 20000 });
      } catch {}
      await page.evaluate(() => {
        const h = [...document.querySelectorAll('h3')].find(x => x.textContent && x.textContent.includes('إعلانات صاحب المعرض'));
        if (h) h.scrollIntoView({ block: 'center' });
      });
      await r.pause(1.5);
      await annotate(page, null, 'تم! الإعلان ظهر جوه معرضك ✅');
      await r.pause(2.6);
    }

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
