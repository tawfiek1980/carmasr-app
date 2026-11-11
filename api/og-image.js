import satori from 'satori';
import sharp from 'sharp';
import { CAIRO_B64 } from '../shared/font-cairo-b64.js';
import { allowCors } from './_lib/cors.js';
import { safeFetch } from './_lib/ssrf.js';

const WIDTH = 1200;
const HEIGHT = 630;
const BG_COLOR = '#0a1628';
const ACCENT_COLOR = '#f97316';
const TEXT_WHITE = '#ffffff';
const TEXT_LIGHT = '#e5e7eb';
const TEXT_MUTED = '#9ca3af';

const CATEGORY_LABELS = {
  trucks: 'شاحنات',
  equipment: 'معدات ثقيلة',
  trailers: 'مقطورات',
  buses: 'حافلات',
  'spare-parts': 'قطع غيار',
};

const JOB_TYPE_LABELS = {
  driver: 'سائق',
  mechanic: 'ميكانيكي',
  technician: 'تقني',
  logistics: 'لوجستيات',
  warehouse: 'مستودعات',
  sales: 'مبيعات',
  'heavy-equip': 'معدات ثقيلة',
  electrician: 'كهربائي',
  welder: 'لحام',
  craftsman: 'صنايعي',
  tinsmith: 'سمكري',
  carpenter: 'نجار',
  other: 'أخرى',
};

function truncate(str, max) {
  if (!str || str.length <= max) return str || '';
  return str.slice(0, max) + '…';
}

function splitTitle(title, maxLen = 38) {
  const lines = [];
  if (title) {
    const words = String(title).split(/\s+/);
    let current = '';
    for (const w of words) {
      if ((current + ' ' + w).trim().length > maxLen) {
        if (current.trim()) lines.push(current.trim());
        current = w;
      } else {
        current = current ? current + ' ' + w : w;
      }
    }
    if (current.trim()) lines.push(current.trim());
  }
  return lines.slice(0, 3);
}

const fontData = Buffer.from(CAIRO_B64, 'base64');

export async function buildSatoriImage({
  title = '',
  subtitle = '',
  price = '',
  location = '',
  brand = 'كار مصر CarMasr',
  phone = '',
  type = 'ad',
  bgColor = BG_COLOR,
  accentColor = ACCENT_COLOR,
  adImageUrl = null,
}) {
  const titleLines = splitTitle(title);

  const accent = accentColor || ACCENT_COLOR;
  const titleFontSize = titleLines.length > 2 ? 40 : titleLines.length > 1 ? 46 : 52;

  const badgeChildren = [];
  if (price) badgeChildren.push({ type: 'span', props: { style: { display: 'flex', background: accent, color: '#fff', padding: '0 18px', height: '38px', borderRadius: '19px', alignItems: 'center', fontSize: '16px', fontWeight: 700 }, children: price } });
  if (location) badgeChildren.push({ type: 'span', props: { style: { display: 'flex', background: 'rgba(255,255,255,0.08)', color: TEXT_LIGHT, padding: '0 18px', height: '38px', borderRadius: '19px', alignItems: 'center', fontSize: '16px', fontWeight: 700 }, children: '📍 ' + location } });
  if (subtitle) badgeChildren.push({ type: 'span', props: { style: { display: 'flex', background: 'rgba(255,255,255,0.08)', color: TEXT_LIGHT, padding: '0 18px', height: '38px', borderRadius: '19px', alignItems: 'center', fontSize: '16px', fontWeight: 700 }, children: subtitle } });

  const typeIcon = type === 'job' ? '💼' : type === 'load' ? '🚛' : '🚛';

  let adImageElement = null;
  if (adImageUrl) {
    adImageElement = {
      type: 'img',
      props: {
        src: adImageUrl,
        style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
      },
    };
  }

  const overlayStyle = adImageUrl
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, ${BG_COLOR}CC 0%, ${BG_COLOR}B3 50%, ${BG_COLOR}E6 100%)`,
      }
    : {};

  const jsx = {
    type: 'div',
    props: {
      style: {
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        background: bgColor,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Cairo',
        overflow: 'hidden',
        direction: 'rtl',
      },
      children: [
        adImageElement,
        adImageUrl ? { type: 'div', props: { style: overlayStyle } } : null,
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '8px', background: accent },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '40px',
              left: '40px',
              right: '40px',
              bottom: '40px',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '24px',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: '55px', right: '60px', display: 'flex', gap: '16px', alignItems: 'center' },
            children: [
              {
                type: 'div',
                props: { style: { background: accent, color: '#fff', padding: '8px 20px', borderRadius: '8px', fontSize: '18px', fontWeight: 700, direction: 'ltr' }, children: phone ? '📞 ' + phone : 'CarMasr' },
              },
              {
                type: 'div',
                props: { style: { color: TEXT_MUTED, fontSize: '16px' }, children: phone ? 'تواصل مع المعلن مباشرة' : `${typeIcon} ${brand}` },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '140px',
              right: '80px',
              left: '80px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            },
            children: titleLines.map(line => ({
              type: 'div',
              props: {
                style: { color: TEXT_WHITE, fontSize: `${titleFontSize}px`, fontWeight: 700, lineHeight: 1.3, textAlign: 'right' },
                children: line,
              },
            })),
          },
        },
        badgeChildren.length > 0
          ? {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: `${230 + titleLines.length * 20}px`,
                  right: '80px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                },
                children: badgeChildren,
              },
            }
          : null,
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: '80px',
              right: '80px',
              bottom: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '18px',
            },
            children: [
              { type: 'div', props: { style: { color: TEXT_MUTED, fontSize: '18px' }, children: 'carmasr-app.vercel.app' } },
              { type: 'div', props: { style: { color: accent, fontSize: '18px', fontWeight: 700 }, children: 'سوق النقل الثقيل في مصر' } },
            ],
          },
        },
      ].filter(Boolean),
    },
  };

  return satori(jsx, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: 'Cairo', data: fontData, weight: 700, style: 'normal' }],
  });
}

const PROXY_ALLOWED_HOSTS = new Set([
  'res.cloudinary.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'lh3.googleusercontent.com',
  'images.unsplash.com',
]);

export default async function handler(req, res) {
  // إعادة توجيه: /api/og-image?...&image=<url> → الصورة الأصلية (بدون نص overlay)
  // لضمان that FB/WhatsApp يحصل على صورة نظيفة even if old cached URL
  if (req.query && req.query.image && !req.query.proxy && !req.query.audio) {
    try {
      const target = new URL(String(req.query.image));
      if (target.protocol === 'https:' && PROXY_ALLOWED_HOSTS.has(target.hostname)) {
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.redirect(302, target.toString());
      }
    } catch { /* fall through to generation */ }
  }
  // وضع البروكسي: /api/og-image?proxy=<url> — يجلب صورة من نفس الأصل لإعادة الختم (بدون CORS)
  if (req.query && req.query.proxy) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    let target;
    try {
      target = new URL(String(req.query.proxy));
    } catch {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(400).send('url غير صالح');
    }
    if (target.protocol !== 'https:' || !PROXY_ALLOWED_HOSTS.has(target.hostname)) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(403).send('المصدر غير مسموح');
    }
    try {
      const upstream = await safeFetch(target.toString());
      if (!upstream.ok) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(upstream.status).send('فشل جلب الصورة');
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      if (!/^image\//i.test(contentType)) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(415).send('المحتوى ليس صورة');
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).send(buf);
    } catch {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(502).send('خطأ في جلب الصورة');
    }
  }

  // وضع الصوت: /api/og-image?audio=<url> — يجلب ملف صوتي من نفس الأصل لتجاوز CORS (حد ~4 م.ب)
  if (req.query && req.query.audio) {
    allowCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    const AUDIO_MAX = 4 * 1024 * 1024;
    const isPrivateHost = (host) => {
      const h = String(host || '').toLowerCase();
      if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
        const p = h.split('.').map(Number);
        return p[0] === 0 || p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254)
          || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
      }
      return h === '[::1]' || h.includes(':');
    };
    let target;
    try {
      target = new URL(String(req.query.audio));
    } catch {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(400).send('url غير صالح');
    }
    if (target.protocol !== 'https:' || isPrivateHost(target.hostname)) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(403).send('المصدر غير مسموح');
    }
    try {
      const upstream = await safeFetch(target.toString());
      if (!upstream.ok) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(upstream.status).send('فشل جلب الصوت');
      }
      try {
        if (isPrivateHost(new URL(upstream.url || target.toString()).hostname)) {
          res.setHeader('Content-Type', 'text/plain');
          return res.status(403).send('المصدر غير مسموح');
        }
      } catch { /* ignore */ }
      const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
      if (!/^audio\//i.test(contentType) && !/octet-stream/i.test(contentType) && !/mpegurl/i.test(contentType)) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(415).send('المحتوى ليس صوتًا');
      }
      const declared = Number(upstream.headers.get('content-length') || 0);
      if (declared > AUDIO_MAX) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(413).send('الملف أكبر من الحد المسموح — نزّله وارفعه');
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > AUDIO_MAX) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(413).send('الملف أكبر من الحد المسموح — نزّله وارفعه');
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      return res.status(200).send(buf);
    } catch {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(502).send('خطأ في جلب الصوت');
    }
  }

  try {
    const { title, subtitle, price, location, image, type, accent, phone } = req.query;

    const accentColor = accent || ACCENT_COLOR;
    let adImageUrl = image || null;

    // نزّل الصورة وحوّلها إلى JPEG مدمج (data URI) — يضمن أن satori يرسمها دائمًا
    // وأن الناتج 1200×630 JPEG صالح لفيسبوك/واتساب مهما كان نوع الصورة الأصلية
    if (adImageUrl) {
      try {
        const r = await safeFetch(adImageUrl, { signal: AbortSignal.timeout(6000) });
        const ct = r.headers.get('content-type') || '';
        if (r.ok && /^image\//i.test(ct)) {
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > 0 && buf.length < 15 * 1024 * 1024) {
            const normalized = await sharp(buf)
              .rotate()
              .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
              .jpeg({ quality: 82 })
              .toBuffer();
            adImageUrl = 'data:image/jpeg;base64,' + normalized.toString('base64');
          } else {
            adImageUrl = null;
          }
        } else {
          adImageUrl = null;
        }
      } catch {
        adImageUrl = null;
      }
    }

    const svg = await buildSatoriImage({
      title: title || 'إعلان على كار مصر',
      subtitle: subtitle || '',
      price: price || '',
      location: location || '',
      type: type || 'ad',
      phone: phone || '',
      accentColor,
      adImageUrl,
    });

    let pipeline = sharp(Buffer.from(svg)).resize(WIDTH, HEIGHT);
    const output = await pipeline.jpeg({ quality: 90 }).toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('Content-Length', output.length);
    res.status(200).send(output);
  } catch (err) {
    console.error('OG image error:', err);
    res.status(500).send('Error generating image');
  }
}

export const config = {
  runtime: 'nodejs',
};
