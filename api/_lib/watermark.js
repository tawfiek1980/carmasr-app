/**
 * watermark.js — ختم الصور بالسيرفر (satori → sharp + خط Cairo مضمّن في الريبو)
 * نفس تصميم الووترمارك بتاع الرفع العادي:
 * شريط علوي «كار مصر CarMasr» + خط برتقالي + شريط سفلي برقم المعلن + خط برتقالي.
 * satori بتحوّل النص (عربي/إنجليزي) لـ vector paths — فمفيش اعتماد على بيانات الخط
 * أو librsvg، وده نفس الأسلوب المتعامل معاه صور الـ OG في الإنتاج.
 * بيمشي على أي صورة من أي مكان — من غير CORS ولا canvas في المتصفح.
 */
import satori from 'satori';
import sharp from 'sharp';
import { safeFetch } from './ssrf.js';
import { CAIRO_B64 } from '../../shared/font-cairo-b64.js';
import { CAIRO_900_B64 } from '../../shared/cairo-900-b64.js';

const fontData = Buffer.from(CAIRO_B64, 'base64');
const fontBlack900 = Buffer.from(CAIRO_900_B64, 'base64');

const ORANGE = '#f97316';
const DARK = '#0a1628';

/** حساب أبعاد الووترمارك من عرض الصورة — مصدر واحد لـ satori و detect */
export function wmLayout(w) {
  const scale = w / 800;
  const smallAr = Math.round(Math.max(12 * scale, 19)); // العربية أعلى حد أدنى (خطوط أدق)
  const smallEn = Math.round(Math.max(12 * scale, 13));
  const mainSize = Math.round(Math.max(20 * scale, 22));
  const needH = Math.max(
    Math.round(40 * scale),          // الشريط القديم بنفس النسبة
    Math.round(smallAr * 2.2),       // الشريط العلوي يكفي العربية
    Math.round(smallEn * 2.2),
    Math.round(mainSize * 1.7),      // الشريط السفلي يكفي رقم التليفون
  );
  return {
    scale,
    padR: Math.max(12, Math.round(20 * scale)),
    barH: needH,
    smallSize: smallEn,
    smallAr,
    mainSize,
    strip: Math.max(2, Math.round(3 * scale)),
    letterSp: Math.max(1, Math.round(1.5 * scale)),
  };
}

/** بناء أشرطة الووترمارك + النصوص كـ satori SVG بأبعاد الصورة */
export async function buildWatermarkSvg(w, h, phone) {
  const { padR, barH, mainSize, smallSize, smallAr, strip, letterSp } = wmLayout(w);
  const yBot = h - barH;
  const phoneText = String(phone || '').replace(/[^\d+]/g, '');
  const arBrand = 'كار مصر';
  const enBrand = 'CarMasr-EG';

  const jsx = {
    type: 'div',
    props: {
      style: {
        width: `${w}px`,
        height: `${h}px`,
        position: 'relative',
        display: 'flex',
        fontFamily: 'Cairo',
        overflow: 'hidden',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: `${barH}px`,
              background: 'rgba(10, 22, 40, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              direction: 'rtl',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                color: '#ffffff',
                fontSize: `${smallAr}px`,
                fontWeight: 900,
                paddingRight: `${padR}px`,
              },
                  children: arBrand,
                },
              },
              {
                type: 'div',
                props: {
                  style: { color: '#ffffff', fontSize: `${smallSize}px`, fontWeight: 900, letterSpacing: `${letterSp}px`, paddingLeft: `${padR}px`, direction: 'ltr' },
                  children: enBrand,
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: `${barH - strip}px`, left: 0, right: 0, height: `${strip}px`, background: ORANGE },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${yBot}px`,
              left: 0,
              right: 0,
              height: `${barH}px`,
              background: `linear-gradient(to bottom, rgba(10,22,40,0.35) 0%, rgba(10,22,40,0.92) 50%, rgba(10,22,40,0.98) 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              direction: 'rtl',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { color: '#ffffff', fontSize: `${mainSize}px`, fontWeight: 900, paddingRight: `${padR}px` },
                  children: phoneText || arBrand,
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: `${yBot}px`, left: 0, right: 0, height: `${strip}px`, background: ORANGE },
          },
        },
      ],
    },
  };

  return satori(jsx, {
    width: w,
    height: h,
    fonts: [
      { name: 'Cairo', data: fontData, weight: 700, style: 'normal' },
      { name: 'Cairo', data: fontBlack900, weight: 900, style: 'normal' },
    ],
  });
}

/** ختم buffer صورة مباشرة → buffer jpeg مُختم */
export async function stampImageBuffer(buf, phone) {
  const meta = await sharp(buf).metadata();
  if (!meta || !meta.width || !meta.height) throw new Error('unsupported-image');
  const w = meta.width;
  const h = meta.height;
  const svg = await buildWatermarkSvg(w, h, phone);
  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  return await sharp(buf)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** رفع buffer مُختم على Cloudinary (نفس preset الرفع العادي) */
export async function uploadStampedBuffer(buf) {
  if (!process.env.VITE_CLOUDINARY_CLOUD_NAME || !process.env.VITE_CLOUDINARY_UPLOAD_PRESET) throw new Error('cloud-config-missing');
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'image/jpeg' }), 'stamped.jpg');
  form.append('upload_preset', process.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  // مجلد ثابت للمرفوع بالووترمارك الجديد — علامة موثوقة للتخطي في الميجريشن
  form.append('folder', 'tareeq/wm2');
  const r = await fetch(`https://api.cloudinary.com/v1_1/${process.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
  const data = await r.json();
  if (!data || !data.secure_url) throw new Error('cloud-upload-failed');
  return { secure_url: String(data.secure_url) };
}

/** فحص ختم معلوم على الصورة: متختمة ولا لا، ولو متختمة (قديم/جديد) */
export async function detectWatermark(buf) {
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) return { watermarked: false, isNew: false };
  const w = meta.width;
  const h = meta.height;
  const { barH, strip, padR } = wmLayout(w);
  const stripY = Math.max(0, barH - Math.round(strip / 2));

  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const C = info.channels;
  let orange = 0;
  const x0 = Math.round(w * 0.2), x1 = Math.round(w * 0.8);
  for (let x = x0; x < x1; x += Math.max(4, Math.round(w / 100))) {
    const i = (stripY * w + x) * C;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 200 && g > 80 && g < 150 && b < 80) orange++;
  }
  if (orange === 0) return { watermarked: false, isNew: false, w, h };
  let leftBright = 0;
  const xStep = Math.max(2, Math.round(w / 300));
  const yStep = Math.max(2, Math.round(barH / 15));
  for (let y = Math.round(barH * 0.3); y < Math.round(barH * 0.9); y += yStep) {
    for (let x = padR; x < Math.round(w * 0.4); x += xStep) {
      const i = (y * w + x) * C;
      if (data[i] > 170 && data[i + 1] > 170 && data[i + 2] > 170) leftBright++;
    }
  }
  return { watermarked: true, isNew: leftBright > Math.max(50, Math.round(w / 10)), w, h, barH, strip };
}

/** ترقية صورة واحدة بالتصميم الجديد — تستخدم في الميجريشن والإنتاج */
export async function migrateImage(url, phone, opts = {}) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u) || !/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(u)) return { url: u, skipped: true, upgraded: false };
  // مختومة بالفعل بالتصميم الجديد (مجلد wm2) → تخطي instant بدون جلب (إلا في وضع force)
  if (!opts.force && /\/tareeq\/wm2\//i.test(u)) return { url: u, skipped: true, upgraded: false };

  const isFb = /lookaside\.fbsbx\.com|fbcdn\.net/i.test(u);
  const res = await safeFetch(u, {
    signal: AbortSignal.timeout(15000),
    headers: isFb
      ? { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', Accept: 'image/*,*/*;q=0.8' }
      : { Accept: 'image/*,*/*;q=0.8' },
  });
  if (!res.ok) return { url: u, failed: true, upgraded: false };
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct && !ct.includes('image') && !ct.includes('octet-stream')) return { url: u, failed: true, upgraded: false };
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) return { url: u, failed: true, upgraded: false };

  if (!opts.force) {
    const det = await detectWatermark(buf);
    if (det.watermarked && det.isNew) return { url: u, skipped: true, upgraded: false };
  }

  // الأشرطة مبيّتة تماماً وتغطي أي ختم قديم فوقه — يكفي الختم فوق من غير قص (لا فقد للمحتوى)
  const stamped = await stampImageBuffer(buf, phone);
  const { secure_url } = await uploadStampedBuffer(stamped);
  return { url: secure_url, wasOld: true, upgraded: true };
}

/** ختم صورة من رابط (سيرفر-سايد — لا يهم CORS) ورفعها → رابط جديد، أو الرابط الأصلي عند الفشل */
export async function stampRemoteImage(url, phone) {
  const u = String(url || '').trim();
  if (!u) return u;
  if (!/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(u)) return u;

  try {
    const isFb = /lookaside\.fbsbx\.com|fbcdn\.net/i.test(u);
    const res = await safeFetch(u, {
      signal: AbortSignal.timeout(20000),
      headers: isFb
        ? { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', Accept: 'image/*,*/*;q=0.8' }
        : { Accept: 'image/*,*/*;q=0.8' },
    });
    if (!res.ok) return u;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct && !ct.includes('image') && !ct.includes('octet-stream')) return u;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return u;

    const stamped = await stampImageBuffer(buf, phone);
    const { secure_url } = await uploadStampedBuffer(stamped);
    return secure_url;
  } catch (e) {
    console.error('stampRemoteImage fallback:', String(e && e.message || e).slice(0, 200));
    return u;
  }
}