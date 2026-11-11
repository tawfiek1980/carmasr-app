import admin from 'firebase-admin';
import { initAdmin } from './_lib/db.js';

function esc(t) {
  if (!t) return '';
  return String(t).replace(/[&<>"]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : m === '>' ? '&gt;' : m === '"' ? '&quot;' : m);
}

/** ترميز آمن للنصوص داخل <script> — JSON.stringify + تعطيل </script> */
function jsEsc(t) {
  return JSON.stringify(String(t || '')).replace(/</g, '\\u003c');
}

function formatPrice(price) {
  if (!price) return '';
  return `${Math.round(Number(price)).toLocaleString('en-US')} جنيه`;
}

const CATEGORY_LABELS = { trucks: 'شاحنات', equipment: 'معدات ثقيلة', trailers: 'مقطورات', buses: 'حافلات', 'spare-parts': 'قطع غيار' };

const JOB_TYPE_LABELS = {
  driver: 'سائق', mechanic: 'ميكانيكي', technician: 'تقني',
  logistics: 'لوجستيات', warehouse: 'مستودعات', sales: 'مبيعات',
  'heavy-equip': 'معدات ثقيلة', electrician: 'كهربائي',
  welder: 'لحام', craftsman: 'صنايعي', tinsmith: 'سمكري',
  carpenter: 'نجار', other: 'أخرى',
};

const JOB_ICONS = {
  driver: '🚛', mechanic: '🔧', technician: '💻',
  logistics: '📦', warehouse: '🏭', sales: '📊',
  'heavy-equip': '🏗️', electrician: '⚡',
  welder: '🔥', craftsman: '🛠️', tinsmith: '🔩',
  carpenter: '🪚', other: '📌',
};

const FALLBACK_IMAGE = 'https://carmasr-app.vercel.app/tareeq-logo.png';

/** صورة افتراضية لكل قسم — تُستخدم لو الإعلان من غير صور (مطابقة للعميل لقسم واحد) */
const DEFAULT_IMAGES = {
  trucks: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=900&q=80',
  equipment: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80',
  trailers: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?w=900&q=80',
  buses: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=900&q=80',
  'spare-parts': 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=900&q=80',
  vehicles: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=900&q=80',
};

function defaultImageFor(category) {
  return DEFAULT_IMAGES[(category || '').toLowerCase()] || DEFAULT_IMAGES.vehicles;
}

const sampleListings = [
  { id: 'sample-truck-actros-2020', title: 'مرسيدس أكتروس 1845 موديل 2020 - جرار نظيف', price: 2850000, governorate: 'القاهرة', category: 'trucks', images: ['https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=900&q=80'] },
  { id: 'sample-truck-volvo-2019', title: 'فولفو FH 460 موديل 2019 - استيراد أوروبي', price: 2700000, governorate: 'الإسكندرية', category: 'trucks', images: ['https://images.unsplash.com/photo-1673644306976-a716fd0f3fc9?w=900&q=80'] },
  { id: 'sample-truck-scania-2021', title: 'سكانيا R500 موديل 2021 - وارد أوروبا', price: 3500000, governorate: 'الجيزة', category: 'trucks', images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=900&q=80'] },
  { id: 'sample-truck-dump-howo', title: 'هيفو قلاب 371 موديل 2018 - قوي وشغال', price: 1800000, governorate: 'الشرقية', category: 'trucks', images: ['https://images.unsplash.com/photo-1778066994998-97f74a5bf901?w=900&q=80'] },
  { id: 'sample-truck-isuzu-flatbed', title: 'ايزوزو سطحة نقل خفيف 2021', price: 950000, governorate: 'القليوبية', category: 'trucks', images: ['https://images.unsplash.com/photo-1616432043562-3671ea2e5242?w=900&q=80'] },
  { id: 'sample-truck-tanker-fuel', title: 'تانكر نقل بنزين 30000 لتر - معدات أمان متوفرة', price: 2400000, governorate: 'بورسعيد', category: 'trucks', images: ['https://images.unsplash.com/photo-1696583545294-a0158d7afa63?w=900&q=80'] },
  { id: 'sample-truck-hino-refrigerated', title: 'هينو براد نقل خضار وفاكهة 2020', price: 1650000, governorate: 'الغربية', category: 'trucks', images: ['https://images.unsplash.com/photo-1675889335406-21a0d0048ddb?w=900&q=80'] },
  { id: 'sample-equipment-excavator-cat', title: 'حفار كاتربيلر 320D موديل 2018 - ساعات قليلة', price: 3900000, governorate: 'الجيزة', category: 'equipment', images: ['https://images.unsplash.com/photo-1603814744247-ca3e77714471?w=900&q=80'] },
  { id: 'sample-equipment-loader-komatsu', title: 'لودر كوماتسو WA380 موديل 2017 - وارد اليابان', price: 3200000, governorate: 'الإسكندرية', category: 'equipment', images: ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80'] },
  { id: 'sample-equipment-crane-tadano', title: 'كرين هيدروليكي تادانو 50 طن - وارد اليابان', price: 5500000, governorate: 'الإسماعيلية', category: 'equipment', images: ['https://images.unsplash.com/photo-1756753142680-30c5d975a09d?w=900&q=80'] },
  { id: 'sample-equipment-bulldozer-cat', title: 'بلدوزر كاتربيلر D6T موديل 2016', price: 4200000, governorate: 'السويس', category: 'equipment', images: ['https://images.unsplash.com/photo-1583024011792-b165975b52f5?w=900&q=80'] },
  { id: 'sample-equipment-forklift-toyota', title: 'رافعة شوكية تويوتا 3 طن - جديدة', price: 750000, governorate: 'القاهرة', category: 'equipment', images: ['https://images.unsplash.com/photo-1669516894640-6ca9084195e9?w=900&q=80'] },
  { id: 'sample-trailer-flatbed', title: 'نصف مقطورة سطحة 3 محاور موديل 2021 - وارد', price: 750000, governorate: 'الشرقية', category: 'trailers', images: ['https://images.unsplash.com/photo-1616432043562-3671ea2e5242?w=900&q=80'] },
  { id: 'sample-trailer-refrigerated', title: 'براد نقل مبرد 40 قدم Carrier - ممتاز', price: 1150000, governorate: 'الغربية', category: 'trailers', images: ['https://images.unsplash.com/photo-1591768793355-74d04bb6608f?w=900&q=80'] },
  { id: 'sample-trailer-water-tanker', title: 'صهريج مياه 40000 لتر - مناسب للرى والشرب', price: 1900000, governorate: 'المنيا', category: 'trailers', images: ['https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=900&q=80'] },
  { id: 'sample-trailer-lowbed', title: 'نصف مقطورة منخفضة 40 طن - نقل معدات ثقيلة', price: 1100000, governorate: 'السويس', category: 'trailers', images: ['https://images.unsplash.com/photo-1616432043562-3671ea2e5242?w=900&q=80'] },
  { id: 'sample-bus-tourism-mercedes', title: 'أتوبيس مرسيدس سياحي 50 راكب - مكيف', price: 2800000, governorate: 'القاهرة', category: 'buses', images: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=900&q=80'] },
  { id: 'sample-bus-minibus-hyundai', title: 'ميني باص هيونداي 14 راكب - نظيف', price: 1200000, governorate: 'الجيزة', category: 'buses', images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=900&q=80'] },
  { id: 'sample-bus-school', title: 'أتوبيس مدرسة 40 طفل - موديل 2020', price: 1500000, governorate: 'الإسكندرية', category: 'buses', images: ['https://images.unsplash.com/photo-1675889335406-21a0d0048ddb?w=900&q=80'] },
  { id: 'sample-bus-passenger-man', title: 'أتوبيس ركاب مان 55 راكب - خطوط المحافظات', price: 2200000, governorate: 'الدقهلية', category: 'buses', images: ['https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=900&q=80'] },
  { id: 'sample-spare-engine-man', title: 'موتور MAN D2676 كامل بالملحقات - استيراد', price: 265000, governorate: 'القاهرة', category: 'spare-parts', images: ['https://images.unsplash.com/photo-1635691033744-a1a2a07ba971?w=900&q=80'] },
  { id: 'sample-spare-gearbox-zf', title: 'فتيس ZF 16S2230 كامل - مناسب لأكتروس', price: 85000, governorate: 'القاهرة', category: 'spare-parts', images: ['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=900&q=80'] },
  { id: 'sample-spare-brakes', title: 'طقم فرامل كامل شاحنة - ديسكات وبلاتين', price: 18500, governorate: 'القليوبية', category: 'spare-parts', images: ['https://images.unsplash.com/photo-1696494561430-de087dd0bd69?w=900&q=80'] },
  { id: 'sample-spare-tires', title: 'طقم إطارات بريدجستون 315/80R22.5 - 4 كاوتش', price: 68000, governorate: 'القليوبية', category: 'spare-parts', images: ['https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=900&q=80'] },
  { id: 'sample-spare-alternator', title: 'دينمو شاحن 24 فولت 120 أمبير - جديد', price: 8500, governorate: 'القاهرة', category: 'spare-parts', images: ['https://images.unsplash.com/photo-1635691033744-a1a2a07ba971?w=900&q=80'] },
  { id: 'sample-spare-cabin', title: 'كبينة أكتروس MP4 كاملة - وارد أوروبا', price: 180000, governorate: 'القاهرة', category: 'spare-parts', images: ['https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=900&q=80'] },
  { id: 'sample-spare-filters-set', title: 'طقم فلاتر كامل شاحنة - زيت وهواء ووقود', price: 3200, governorate: 'القاهرة', category: 'spare-parts', images: ['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=900&q=80'] },
  { id: 'sample-spare-oils', title: 'زيت موتور شاحنة 20 لتر Mobil Delvac', price: 2800, governorate: 'القليوبية', category: 'spare-parts', images: ['https://images.unsplash.com/photo-1635691033744-a1a2a07ba971?w=900&q=80'] },
];

function buildOgImageUrl(SITE_URL, params) {
  const qs = new URLSearchParams(params).toString();
  return SITE_URL + '/api/og-image?' + qs;
}

/** صورة غلاف الفيديو (الإطار الأول) من رابط Cloudinary — تُستخدم كـ og:image لإعلان بفيديو بدون صور */
function videoPoster(url) {
  if (!url) return '';
  return String(url)
    .replace('/video/upload/', '/video/upload/so_0/')
    .replace(/\.(mp4|mov|webm|m4v|avi)(\?.*)?$/i, '.jpg');
}

/** مخصص لعناصر الزحف فقط — البشر يُحوَّلون مباشرة لصفحة التطبيق */
function isBot(ua) {
  ua = String(ua || '');
  if (!ua) return false;
  if (/facebookexternalhit|facebot/i.test(ua)) return true;
  if (/WhatsApp\//i.test(ua)) return !/Mozilla/i.test(ua);
  return /Twitterbot|twitterbot|TelegramBot|Slack|Discordbot|LinkedInBot|linkbot|Bingbot|Googlebot|Slurp|DuckDuckBot|Yandex|Baiduspider|pinterest|vkShare|embeds|outbrain|Pingdom|python-requests|curl/i.test(ua);
}

/** مولّد رموز قصيرة آمنة URL */
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function genCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function basePage(title, desc, ogImageUrl, ogImageAlt, ogUrl, pageUrl, body, videoUrl) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}${title.includes('كار مصر') ? '' : ' - كار مصر CarMasr'}</title>
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${esc(ogImageUrl)}" />
  <meta property="og:image:secure_url" content="${esc(ogImageUrl)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:alt" content="${esc(ogImageAlt)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta itemprop="image" content="${esc(ogImageUrl)}" />
  <meta property="og:url" content="${esc(pageUrl || ogUrl)}" />
  <meta property="og:type" content="${videoUrl ? 'video.other' : 'website'}" />
  ${videoUrl ? `<meta property="og:video" content="${esc(videoUrl)}" />
  <meta property="og:video:url" content="${esc(videoUrl)}" />
  <meta property="og:video:secure_url" content="${esc(videoUrl)}" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:video:width" content="1280" />
  <meta property="og:video:height" content="720" />
  <meta property="og:video:tag" content="كار مصر CarMasr" />` : ''}
  <meta property="og:locale" content="ar_EG" />
  <meta property="og:site_name" content="كار مصر CarMasr" />
  <meta property="og:see_also" content="https://www.facebook.com/TareeqEG" />
  <meta name="description" content="${esc(desc)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(ogImageUrl)}" />
  <meta name="twitter:image:alt" content="${esc(ogImageAlt)}" />
  <link rel="canonical" href="${esc(pageUrl || ogUrl)}" />
</head>
<body style="margin:0;background:#0a1628;font-family:sans-serif;direction:rtl;">
  ${body}
</body>
</html>`;
}

export default async function handler(req, res) {
  const SITE_URL = `https://${req.headers['x-forwarded-host'] || req.headers.host || 'carmasr-app.vercel.app'}`;
  let { type, id, s } = req.query;

  if (req.query.action === 'shortlink') {
    try {
      initAdmin();
      const type2 = req.query.type;
      const id2 = req.query.id;
      if (!type2 || !id2) return res.status(400).json({ success: false, error: 'Missing type or id' });
      const col = admin.firestore().collection('shortlinks');
      const existing = await col.where('type', '==', type2).where('id', '==', id2).limit(1).get();
      let code;
      if (!existing.empty) {
        code = existing.docs[0].id;
      } else {
        for (;;) {
          code = genCode();
          try {
            await col.doc(code).create({ type: type2, id: id2, at: Date.now() });
            break;
          } catch (e) { /* collision — retry */ }
        }
      }
      return res.json({ success: true, code, url: `${SITE_URL}/s/${code}` });
    } catch (err) {
      return res.status(500).json({ success: false, error: String((err && err.message) || err) });
    }
  }

  if (s) {
    try {
      initAdmin();
      const doc = await admin.firestore().collection('shortlinks').doc(s).get();
      if (doc.exists) {
        const d = doc.data();
        type = d.type;
        id = d.id;
      } else {
        return res.status(404).send('Short link not found');
      }
    } catch (err) {
      return res.status(500).send('Short link error: ' + String((err && err.message) || err));
    }
  }

  if (type === 'feed') {
    initAdmin();
    try {
      const db = admin.firestore();
      const snap = await db.collection('listings').where('status', 'in', ['approved', 'active']).limit(100).get();
      const SITE = SITE_URL.replace(/\/$/, '');
      const docs = snap.docs
        .map((doc) => ({ doc, createdAt: (doc.data().createdAt || null) }))
        .sort((a, b) => {
          const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return bt - at;
        })
        .slice(0, 30);
      const toRfc = (v) => {
        if (!v) return new Date().toUTCString();
        try { return v.toDate ? v.toDate().toUTCString() : new Date(v).toUTCString(); } catch { return new Date().toUTCString(); }
      };
      const items = docs.map(({ doc }) => {
        const d = doc.data() || {};
        const link = `${SITE}/listing/${doc.id}${d.slug ? '/' + d.slug : ''}`;
        const title = (d.title || 'إعلان جديد').slice(0, 120);
        const price = Number(d.price) ? `${Number(d.price).toLocaleString('ar-EG')} جنيه` : 'السعر عند المعاينة';
        const desc = `${d.governorate ? '📍 ' + d.governorate + ' | ' : ''}💰 ${price} | ${CATEGORY_LABELS[d.category] || d.category || 'إعلان'} — سوق كار مصر CarMasr: ${link}`;
        const img = (d.images && d.images[0]) || '';
        return `<item>
    <title>${esc(title)}</title>
    <link>${esc(link)}</link>
    <guid isPermaLink="false">${esc(doc.id)}</guid>
    <pubDate>${toRfc(d.createdAt || d.updatedAt)}</pubDate>
    <description><![CDATA[${desc}]]></description>
    ${img ? `<enclosure url="${esc(img)}" type="image/jpeg" />` : ''}
  </item>`;
      }).join('\n  ');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>سوق كار مصر CarMasr — أحدث الإعلانات</title>
  <link>${SITE}/</link>
  <description>أحدث إعلانات سوق النقل الثقيل والمعدات في مصر</description>
  <language>ar-EG</language>
  <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
  ${items}
</channel>
</rss>`;
      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=900, s-maxage=900');
      return res.status(200).send(xml);
    } catch (err) {
      console.error('feed error', err);
      return res.status(500).send('Error generating feed');
    }
  }

  if (type === 'sitemap') {
    initAdmin();
    try {
      const db = admin.firestore();
      const [listingsSnap, jobsSnap, exhibitionsSnap] = await Promise.all([
        db.collection('listings').where('status', 'in', ['approved', 'active']).get(),
        db.collection('jobs').where('status', 'in', ['approved', 'active']).get(),
        db.collection('exhibitions').get(),
      ]);
      const SITE = SITE_URL;
      const staticUrls = ['/', '/vehicles', '/equipment', '/loads', '/jobs', '/exhibitions', '/download/'].map(p => `<url><loc>${SITE}${p}</loc></url>`).join('\n  ');
      const toIso = (v) => { if (!v) return ''; if (v.toDate) return v.toDate().toISOString().slice(0, 10); const s = String(v).slice(0, 10); return s.length >= 10 ? s : ''; };
      const listingUrls = listingsSnap.docs.map((doc) => {
        const d = doc.data() || {};
        const lastmod = toIso(d.updatedAt || d.createdAt);
        return `<url><loc>${SITE}/listing/${doc.id}${d.slug ? '/' + d.slug : ''}</loc>${lastmod ? '<lastmod>' + lastmod + '</lastmod>' : ''}</url>`;
      }).join('\n  ');
      const jobUrls = jobsSnap.docs.map((doc) => {
        const d = doc.data() || {};
        const lastmod = toIso(d.updatedAt || d.createdAt);
        return `<url><loc>${SITE}/jobs/${doc.id}</loc>${lastmod ? '<lastmod>' + lastmod + '</lastmod>' : ''}</url>`;
      }).join('\n  ');
      const exhibitionUrls = exhibitionsSnap.docs.map((doc) => {
        const d = doc.data() || {};
        const lastmod = toIso(d.updatedAt || d.createdAt);
        return `<url><loc>${SITE}/exhibitions/${doc.id}</loc>${lastmod ? '<lastmod>' + lastmod + '</lastmod>' : ''}</url>`;
      }).join('\n  ');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticUrls}
  ${listingUrls}
  ${jobUrls}
  ${exhibitionUrls}
</urlset>`;
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      return res.status(200).send(xml);
    } catch (err) {
      console.error('sitemap error', err);
      return res.status(500).send('Error generating sitemap');
    }
  }

  if (!type || !id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send('<h1>Missing type or ID</h1>');
  }

  const TYPES = ['product', 'listing', 'ad', 'load', 'job', 'exhibition'];
  if (!TYPES.includes(type)) return res.status(400).send('Invalid type: ' + type);

  try {
    initAdmin();

    let html;

    if (type === 'exhibition') {
      const snap = await admin.firestore().collection('exhibitions').doc(id).get();
      if (!snap.exists) return res.status(404).send('Exhibition not found');
      const d = snap.data();
      const exhibition = {
        name: (d.name || 'معرض').replace(/[\u200e\u200f\u061c]/g, '').trim(),
        description: d.description || '',
        governorate: d.governorate || '',
        city: d.city || '',
        coverImage: d.coverImage || '',
        logo: d.logo || '',
        plan: d.plan || 'basic',
        productCount: d.productCount || 0,
      };
      const planLabel = exhibition.plan === 'free' ? 'مجاني' : exhibition.plan === 'premium' ? 'متقدم' : exhibition.plan === 'vip' ? 'VIP' : 'أساسي';
      const name = `معرض ${exhibition.name}`;
      const desc = `${exhibition.governorate}${exhibition.city ? ` - ${exhibition.city}` : ''} - باقة ${planLabel}${exhibition.productCount ? ` | ${exhibition.productCount} منتج` : ''}${exhibition.description ? ` | ${exhibition.description.slice(0, 120)}` : ''}`;
      const pageUrl = SITE_URL + '/exhibitions/' + id;
      const rawImage = exhibition.coverImage || exhibition.logo || '';
      const generatedOgImage = buildOgImageUrl(SITE_URL, { title: name, subtitle: planLabel, location: exhibition.governorate || '', type: 'ad', ...(rawImage ? { image: rawImage } : {}) });
      html = basePage(name, desc, generatedOgImage, name, pageUrl, pageUrl, `
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
    ${rawImage ? `<img src="${esc(rawImage)}" alt="${esc(name)}" style="width:100%;height:300px;object-fit:cover;" />` : ''}
    <div style="padding:24px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111;">${esc(name)}</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#666;">${esc(desc)}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#888;">كار مصر CarMasr - سوق النقل الثقيل في مصر</p>
      <a href="${esc(pageUrl)}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:12px;font-weight:bold;text-decoration:none;">عرض المعرض على كار مصر</a>
    </div>
  </div>`);
    } else if (type === 'ad') {
      let listing = null;
      const snap = await admin.firestore().collection('listings').doc(id).get();
      if (snap.exists) {
        const data = snap.data();
        listing = { id: snap.id, title: data.title || 'إعلان', price: data.price || 0, governorate: data.governorate || '', category: data.category || '', images: data.images || [], description: data.description || '', slug: data.slug || '', contactPhone: data.contactPhone || data.userPhone || '', videoUrl: data.videoUrl || '' };
      }
      if (!listing) listing = sampleListings.find(l => l.id === id);
      if (!listing) return res.status(404).send('Listing not found');

      const categoryLabel = CATEGORY_LABELS[listing.category] || listing.category;
      const priceStr = formatPrice(listing.price);
      const pricePart = priceStr ? ` - ${priceStr}` : '';
      const name = `${listing.title}${pricePart}`;
      const desc = `${listing.title}${pricePart ? ' | ' + priceStr : ''} | ${categoryLabel} | ${listing.governorate || ''} — كار مصر CarMasr`;
      const rawImage = (listing.images?.[0]) || videoPoster(listing.videoUrl) || '';
      const slugPart = listing.slug ? '/' + listing.slug : '';
      const pageUrl = SITE_URL + '/listing/' + id + slugPart;
      const ogImageUrl = rawImage || buildOgImageUrl(SITE_URL, { title: listing.title || '', subtitle: categoryLabel, price: priceStr, location: listing.governorate || '', type: 'ad', ...(listing.contactPhone ? { phone: listing.contactPhone } : {}), ...(rawImage ? { image: rawImage } : {}) });
      html = basePage(name, desc, ogImageUrl, listing.title, pageUrl, pageUrl, `
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
    ${rawImage ? `<img src="${esc(rawImage)}" alt="${esc(listing.title)}" style="width:100%;height:300px;object-fit:cover;" />` : ''}
    ${listing.videoUrl ? `<video src="${esc(listing.videoUrl)}" poster="${esc(videoPoster(listing.videoUrl))}" controls playsinline style="width:100%;height:auto;background:#000;display:block;"></video>` : ''}
    <div style="padding:24px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111;">${esc(listing.title)}</h1>
      <p style="margin:0 0 8px;font-size:28px;font-weight:900;color:#f97316;">${esc(priceStr)}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#666;">${esc(categoryLabel)} - ${esc(listing.governorate || '')}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#888;">كار مصر CarMasr - سوق النقل الثقيل في مصر</p>
      <a href="${esc(pageUrl)}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:12px;font-weight:bold;text-decoration:none;">عرض الإعلان على كار مصر</a>
    </div>
  </div>`, listing.videoUrl);
    } else if (type === 'load') {
      const snap = await admin.firestore().collection('loads').doc(id).get();
      if (!snap.exists) return res.status(404).send('Load not found');
      const d = snap.data();
      const load = { origin: d.origin || '', destination: d.destination || '', cargoType: d.cargoType || '', vehicleType: d.vehicleType || '', weight: d.weight || '', price: d.price || 0, date: d.date || '', isReturnLoad: d.isReturnLoad || false, international: d.international || false };
      const priceStr = formatPrice(load.price);
      const title = `🚛 ${load.origin} → ${load.destination}`;
      const desc = `📦 ${load.cargoType}${load.vehicleType ? ' | ' + load.vehicleType : ''} | ${load.weight} طن | ${priceStr}${load.isReturnLoad ? ' | رجعة' : ''}${load.international ? ' | دولي' : ''} — كار مصر CarMasr`;
      const pageUrl = SITE_URL + '/load/' + id;
      const loadUrl = SITE_URL + '/load/' + id;
      const generatedOgImage = buildOgImageUrl(SITE_URL, { title: `${load.origin} → ${load.destination}`, subtitle: load.cargoType || '', price: priceStr, location: load.vehicleType || '', type: 'load' });
      html = basePage(title, desc, generatedOgImage, `${load.origin} → ${load.destination}`, loadUrl, pageUrl, `
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
    <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:40px 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:8px;">🚛</div>
      <h1 style="margin:0;color:#fff;font-size:22px;">${esc(load.origin)} → ${esc(load.destination)}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:16px;">${esc(load.cargoType)} | ${esc(load.weight)} طن</p>
    </div>
    <div style="padding:24px;">
      <div style="background:#fff7ed;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;">
        <div style="color:#999;font-size:13px;">الأجرة</div>
        <div style="color:#f97316;font-size:28px;font-weight:900;">${esc(priceStr)}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        ${load.vehicleType ? `<span style="background:#f3f4f6;color:#374151;padding:4px 12px;border-radius:20px;font-size:13px;">🚚 ${esc(load.vehicleType)}</span>` : ''}
        ${load.isReturnLoad ? '<span style="background:#f0fdf4;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold;">🔄 رجعة</span>' : ''}
        ${load.international ? '<span style="background:#eff6ff;color:#2563eb;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold;">🌍 دولي</span>' : ''}
        ${load.date ? `<span style="background:#f3f4f6;color:#6b7280;padding:4px 12px;border-radius:20px;font-size:13px;">📅 ${esc(load.date)}</span>` : ''}
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#888;">كار مصر CarMasr — سوق النقل الثقيل في مصر</p>
      <a href="${esc(pageUrl)}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:12px;font-weight:bold;text-decoration:none;">عرض الحمولات على كار مصر</a>
    </div>
  </div>`);
    } else if (type === 'job') {
      const snap = await admin.firestore().collection('jobs').doc(id).get();
      if (!snap.exists) return res.status(404).send('Job not found');
      const d = snap.data();
      const job = { title: d.title || 'وظيفة', company: d.company || '', type: d.type || '', governorate: d.governorate || '', salary: d.salary || '', description: d.description || '', jobPostType: d.jobPostType || 'hire' };
      const typeLabel = JOB_TYPE_LABELS[job.type] || job.type;
      const icon = JOB_ICONS[job.type] || '💼';
      const postLabel = job.jobPostType === 'hire' ? 'مطلوب موظف' : 'أبحث عن عمل';
      const title = `${icon} ${job.title}${job.company ? ' - ' + job.company : ''}`;
      const desc = `${postLabel} | ${typeLabel}${job.governorate ? ' | ' + job.governorate : ''}${job.salary ? ' | ' + job.salary : ''} — كار مصر CarMasr`;
      const pageUrl = SITE_URL + '/jobs';
      const jobUrl = SITE_URL + '/job/' + id;
      const generatedOgImage = buildOgImageUrl(SITE_URL, { title: job.title || 'وظيفة', subtitle: typeLabel, price: job.salary || '', location: job.governorate || '', type: 'job' });
      html = basePage(title, desc, generatedOgImage, job.title, jobUrl, pageUrl, `
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:40px 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:8px;">${icon}</div>
      <h1 style="margin:0;color:#fff;font-size:22px;">${esc(job.title)}</h1>
      ${job.company ? `<p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:16px;">${esc(job.company)}</p>` : ''}
    </div>
    <div style="padding:24px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="background:#f0fdf4;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold;">${esc(postLabel)}</span>
        <span style="background:#fff7ed;color:#f97316;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold;">${esc(typeLabel)}</span>
        ${job.governorate ? `<span style="background:#f3f4f6;color:#374151;padding:4px 12px;border-radius:20px;font-size:13px;">📍 ${esc(job.governorate)}</span>` : ''}
        ${job.salary ? `<span style="background:#f0fdf4;color:#16a34a;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold;">💰 ${esc(job.salary)}</span>` : ''}
      </div>
      ${job.description ? `<p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">${esc(job.description.slice(0, 200))}${job.description.length > 200 ? '...' : ''}</p>` : ''}
      <p style="margin:0 0 16px;font-size:14px;color:#888;">كار مصر CarMasr — سوق النقل الثقيل في مصر</p>
      <a href="${esc(pageUrl)}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:12px;font-weight:bold;text-decoration:none;">عرض الوظائف على كار مصر</a>
    </div>
  </div>`);
    } else {
      const COLLECTIONS = { product: 'products', listing: 'listings' };
      const snap = await admin.firestore().collection(COLLECTIONS[type]).doc(id).get();
      if (!snap.exists) return res.status(404).send(type + ' not found');
      const data = snap.data();
      let name, desc, image, pageUrl, extra;

      if (type === 'product') {
        const specs = [data.brand, data.model, data.year ? String(data.year) : ''].filter(Boolean).join(' ');
        name = [data.name || 'منتج', specs].filter(Boolean).join(' ');
        const priceNum = Number(String(data.price || '').replace(/[^\d]/g, ''));
        if (priceNum > 0) name += ` - ${data.price} جنيه`;
        const exhib = String(data.exhibitionName || '').trim();
        desc = data.description ? data.description.slice(0, 200) : (specs || 'منتج على كار مصر');
        extra = [priceNum > 0 ? `${data.price} جنيه` : '', exhib ? `معرض ${exhib}` : ''].filter(Boolean).join(' - ');
        image = (data.images?.[0]) || data.image || defaultImageFor(data.category);
        pageUrl = SITE_URL + '/product/' + id;
      } else {
        name = data.title || 'إعلان';
        if (data.price) name += ` - ${data.price} جنيه`;
        desc = data.description ? data.description.slice(0, 200) : 'إعلان على كار مصر';
        extra = data.price ? `${data.price} جنيه - ` : '';
        if (data.governorate) extra += `${data.governorate} - `;
        image = (data.images?.[0]) || defaultImageFor(data.category);
        pageUrl = SITE_URL + '/listing/' + id;
      }

      const ogImageParams = { title: name, subtitle: extra.replace(/ - $/, ''), type: type };
      if (image && image !== FALLBACK_IMAGE) ogImageParams.image = image;
      const generatedOgImage = buildOgImageUrl(SITE_URL, ogImageParams);
      const ogImageUrl = image || generatedOgImage;
      const apiUrl = `${SITE_URL}/api/og?type=${type}&id=${id}`;

      html = basePage(name, [extra, desc].filter(Boolean).join(' - '), ogImageUrl, name, apiUrl, pageUrl, `
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
    ${image && image !== FALLBACK_IMAGE ? `<img src="${esc(image)}" alt="${esc(name)}" style="width:100%;height:300px;object-fit:cover;" />` : ''}
    <div style="padding:24px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111;">${esc(name)}</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#666;">${esc(extra)}${esc(desc)}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#888;">كار مصر CarMasr - سوق النقل الثقيل في مصر</p>
      <a href="${esc(pageUrl)}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:12px;font-weight:bold;text-decoration:none;">عرض على كار مصر</a>
    </div>
  </div>`);
    }

    const ua = String(req.headers['user-agent'] || '');
    if ((s || req.query.action === 'shortlink') && !isBot(ua)) {
      let redirectTarget = '';
      if (type === 'listing' || type === 'ad') redirectTarget = SITE_URL + '/listing/' + id;
      else if (type === 'load') redirectTarget = SITE_URL + '/load/' + id;
      else if (type === 'job') redirectTarget = SITE_URL + '/job/' + id;
      else if (type === 'exhibition') redirectTarget = SITE_URL + '/exhibitions/' + id;
      else if (type === 'product') redirectTarget = SITE_URL + '/product/' + id;
      if (redirectTarget) {
        res.setHeader('Location', encodeURI(redirectTarget));
        res.setHeader('Cache-Control', 'no-store');
        return res.status(302).send('Redirecting to ' + redirectTarget);
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).send(html);
  } catch (err) {
    return res.status(500).send(err.message);
  }
}

export const config = {
  runtime: 'nodejs',
};
