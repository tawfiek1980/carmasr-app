/**
 * re-watermark.js — ميجريشن لختم صور إعلانات قديمة بالووترمارك الجديد «كار مصر / CarMasr-EG»
 *
 * لك صورة في listings/images:
 *  - لو من غير ووترمارك  → يختمها عادي.
 *  - لو مختومة بالتصميم القديم («كار مصر CarMasr» مختلط) → يقصّ الأشرطة القديمة ثم يختم من جديد.
 *  - لو مختومة بالجديد → يعدّيها (ميكررر/مخزنة).
 *
 * الاستخدام:
 *   npm run re-watermark -- --dry            # تشغيل تجريبي (نتائج بدون حفظ)
 *   npm run re-watermark -- --limit 50       # أول 50 إعلان
 *   npm run re-watermark -- --limit 500 --concurrency 6 --commit
 */
import admin from 'firebase-admin';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config();

const key = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.findIndex((a) => a === f);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = !has('--commit');
const LIMIT = Number(val('--limit') || 0);
const CONCURRENCY = Number(val('--concurrency') || 5);
const ONLY_PHONE = val('--phone');

const { stampImageBuffer, uploadStampedBuffer } = await import('../api/_lib/watermark.js');

const ORANGE_STRIP_OK = true;

/** فحص ما إذا كانت الصورة مختومة، ونوع الختم (قديم/جديد) */
async function detectWatermark(buf) {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: C } = info;
  const scale = w / 800;
  const barH = Math.round(40 * scale);
  const strip = Math.round(3 * scale);
  const stripY = Math.max(0, barH - Math.round(strip / 2));

  let orange = 0;
  const x0 = Math.round(w * 0.2), x1 = Math.round(w * 0.8);
  for (let x = x0; x < x1; x += 14) {
    const i = (stripY * w + x) * C;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 200 && g > 80 && g < 150 && b < 80) orange++;
  }
  if (!orange) return { watermarked: false, isNew: false };

  const padR = Math.round(20 * scale);
  let leftBright = 0;
  const y0 = Math.round(barH * 0.35), y1 = Math.round(barH * 0.85);
  for (let y = y0; y < y1; y += 3) {
    for (let x = padR; x < Math.round(w * 0.4); x += 6) {
      const i = (y * w + x) * C;
      if (data[i] > 210 && data[i + 1] > 210 && data[i + 2] > 210) leftBright++;
    }
  }
  return { watermarked: true, isNew: leftBright > 100, barH, strip, w, h };
}

/** قص أشرطة ووترمارك قديم من الصورة ثم الختم من جديد */
async function reprocessImage(buf, phone, det) {
  const sharp = (await import('sharp')).default;
  const cut = (det?.barH ?? Math.round((det.w / 800) * 40)) + (det?.strip ?? Math.round((det.w / 800) * 3)) + 2;
  const meta = await sharp(buf).metadata();
  const topCut = Math.min(cut, Math.floor(meta.height / 2) - 8);
  const bottomCut = Math.min(cut, Math.floor(meta.height / 2) - 8);
  const cropped = await sharp(buf)
    .extract({ left: 0, top: topCut, width: meta.width, height: meta.height - topCut - bottomCut })
    .jpeg({ quality: 88 })
    .toBuffer();
  return stampImageBuffer(cropped, phone);
}

/** معالجة صورة واحدة → رابط جديد أو null للخطأ */
async function processImage(url, phone) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u) || !/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(u)) return { url: u, skipped: true };
  const sharp = (await import('sharp')).default;
  const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(25000) });
  if (!res.ok) return { url: u, failed: true };
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) return { url: u, failed: true };
  const det = await detectWatermark(buf);
  let stamped;
  if (det.watermarked && det.isNew) {
    return { url: u, skipped: true };
  }
  if (det.watermarked) {
    stamped = await reprocessImage(buf, phone, det);
  } else {
    stamped = await stampImageBuffer(buf, phone);
  }
  const { secure_url } = await uploadStampedBuffer(stamped);
  return { url: secure_url, upgraded: true, wasOld: !!det.watermarked };
}

async function processListing(doc) {
  const data = doc.data();
  const phone = String(data.contactPhone || data.userPhone || '').replace(/[^\d+]/g, '');
  if (ONLY_PHONE && phone !== ONLY_PHONE) return { id: doc.id, skipped: 'filter' };

  const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  let changed = false;
  const updated = [];
  for (const img of images) {
    const r = await processImage(img, phone);
    updated.push(r.url);
    if (r.upgraded) changed = true;
  }

  let imageField = typeof data.image === 'string' ? String(data.image) : null;
  let imageUpgraded = null;
  if (imageField) {
    const r = await processImage(imageField, phone);
    imageUpgraded = r.url;
    if (r.upgraded) changed = true;
  }

  if (!changed) return { id: doc.id, unchanged: true };

  const patch = { images: updated };
  if (imageField && imageUpgraded) patch.image = imageUpgraded;

  if (!DRY) {
    await db.collection('listings').doc(doc.id).update(patch);
  }
  return { id: doc.id, images: updated.length, changed: true };
}

// ── تجميع المستندات (paginated) ──
const COLL = 'listings';
const snap = await db.collection(COLL).get();
let docs = snap.docs;
if (LIMIT) docs = docs.slice(0, LIMIT);
console.log(`[re-watermark] ${DRY ? 'نموذج تجريبي (––commit)' : 'تنفيذ فعلي'} | إعلانات: ${docs.length} | concurrency=${CONCURRENCY}${ONLY_PHONE ? ' | phone=' + ONLY_PHONE : ''}`);

let done = 0, upgraded = 0, unchanged = 0, failed = 0;
const queue = [...docs];
async function worker() {
  while (queue.length) {
    const doc = queue.shift();
    try {
      const r = await processListing(doc);
      if (r.skipped) { /* filter */ }
      else if (r.changed) upgraded++;
      else if (r.unchanged) unchanged++;
      done++;
      if (done % 25 === 0 || done === docs.length) {
        console.log(`  … ${done}/${docs.length} | تمت الترقية: ${upgraded} | بدون تغيير: ${unchanged}`);
      }
    } catch (e) {
      failed++;
      console.error(`  ✗ ${doc.id}: ${String(e && e.message || e).slice(0, 160)}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, docs.length) }, worker));

console.log(`\n✅ تم الانتهاء\n  إجمالي: ${docs.length}\n  تمت الترقية: ${upgraded}\n  بدون تغيير: ${unchanged}\n  أخطاء: ${failed}`);
if (DRY) console.log('ملاحظة: هذا نموذج تجريبي — لم يُحفظ شيء. للتطبيق الفعلي أضف --commit.');
process.exit(0);