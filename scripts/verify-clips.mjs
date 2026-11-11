import puppeteer from 'puppeteer';
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://carmasr-app.vercel.app';
const DEMO_PHONE = '01000000099';
const DEMO_PASS = 'TareeqDemo2026!';
const DEMO_EMAIL = 'phone_1000000099@tareeq.app'; // normalizePhone تحذف الصفر الأول
const CREDS = path.resolve('secrets-backup/tareeq-d4dcc-d3d46f52373a.json');

admin.initializeApp({ credential: admin.credential.cert(CREDS) });
const auth = admin.auth();
const setInput = async (page, sel, val) => {
  try {
    await page.click(sel);
    await page.type(sel, val, { delay: 20 });
    return true;
  } catch {
    return page.evaluate((s, v) => {
      const el = document.querySelector(s); if (!el) return false;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, sel, val);
  }
};
const clickByText = async (page, t) => page.evaluate((txt) => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === txt);
  if (b) b.click(); return !!b;
}, t);

(async () => {
  try { const u = await auth.getUserByEmail(DEMO_EMAIL); await auth.deleteUser(u.uid); } catch {}
  await auth.createUser({ email: DEMO_EMAIL, password: DEMO_PASS, displayName: 'مستخدم تجريبي' });

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--lang=ar'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  const goto = async (u, need) => {
    try { await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 25000 }); } catch {}
    for (const sel of (need || [])) { try { await page.waitForSelector(sel, { timeout: 15000 }); } catch {} }
    await new Promise(r => setTimeout(r, 800));
  };

  // 1) Login
  await goto(BASE + '/login', ['input[placeholder="01xxxxxxxxx"]']);
  await setInput(page, 'input[placeholder="01xxxxxxxxx"]', DEMO_PHONE);
  await setInput(page, 'input[placeholder*="••••"]', DEMO_PASS);
  await clickByText(page, 'دخول بالموبايل');
  let pathname = '';
  try { await page.waitForFunction(() => location.pathname === '/', { timeout: 15000 }); } catch {}
  pathname = await page.evaluate(() => location.pathname);
  const hasNav = await page.evaluate(() => !!document.querySelector('a[href="/login"], [class*="profile"]'));
  const errText = await page.evaluate(() => document.body.innerText.includes('بيانات الدخول غير صحيحة') ? 'LOGIN ERROR SHOWN' : 'no error');
  console.log('1) LOGIN  -> pathname=' + pathname + ' | ' + errText);

  // 1b) Complete profile (new accounts land on CompleteProfile before protected pages)
  const onCp = await page.evaluate(() => !!document.querySelector('input[placeholder="أدخل اسمك الكامل"]'));
  if (onCp) {
    await page.type('input[placeholder="أدخل اسمك الكامل"]', 'علي محمد السيد', { delay: 20 });
    await page.evaluate(() => {
      for (const s of document.querySelectorAll('select')) {
        const o = [...s.options].map((x) => (x.textContent || '').trim());
        if (o.includes('شركة نقل')) { s.value = 'company'; s.dispatchEvent(new Event('change', { bubbles: true })); break; }
      }
      for (const s of document.querySelectorAll('select')) {
        if ((s.options[0]?.textContent || '').trim() === 'اختر المحافظة') { s.value = 'القاهرة'; s.dispatchEvent(new Event('change', { bubbles: true })); break; }
      }
    });
    await page.type('input[placeholder="أدخل المركز أو المدينة"]', 'مدينة نصر', { delay: 20 });
    await new Promise(r => setTimeout(r, 400));
    await page.type('input[placeholder="أدخل اسم الشركة"]', 'شركة النور', { delay: 20 });
    await page.evaluate(() => { window.alert = () => {}; });
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'حفظ البيانات'); if (b) b.click(); });
    await page.waitForFunction(() => location.pathname === '/profile', { timeout: 15000 }).catch(() => {});
    console.log('1b) PROFILE ->', await page.evaluate(() => location.pathname));
  }

  // 2) Post form
  await goto(BASE + '/post-listing');
  const postOk = await page.evaluate(() => !!document.querySelector('input[placeholder="مثال: شاحنة فولفو 2020 للبيع"]'));
  console.log('2) POST-FORM present title input:', postOk, '| pathname=' + await page.evaluate(() => location.pathname));

  // 3) Search
  await goto(BASE + '/search', ['input[placeholder*="ابحث عن"]']);
  await setInput(page, 'input[placeholder*="ابحث عن"]', 'لودر');
  await new Promise(r => setTimeout(r, 2500));
  const cardCount = await page.evaluate(() => document.querySelectorAll('[class*="card"], a[href*="/listing/"]').length);
  const bodyHas = await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\s+/g, ' '));
  console.log('3) SEARCH -> cards/links=' + cardCount + ' | snippet: ' + bodyHas);

  // 4) Inbox
  await goto(BASE + '/inbox');
  const inboxPath = await page.evaluate(() => location.pathname);
  const inboxText = await page.evaluate(() => document.body.innerText.slice(0, 150).replace(/\s+/g, ' '));
  console.log('4) INBOX  -> pathname=' + inboxPath + ' | text: ' + inboxText);

  await browser.close();
  try { const u = await auth.getUserByEmail(DEMO_EMAIL); await auth.deleteUser(u.uid); } catch {}
  process.exit(0);
})();