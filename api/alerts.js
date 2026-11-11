// api/alerts.js — تنبيهات البحث المحفوظ وسعر الهدف
// save / unsave / list (بحاجة تسجيل دخول) + match (كرون أو CRON_SECRET)
import admin from 'firebase-admin';
import { initAdmin, getDb, verifyUser, verifyAdmin } from './_lib/db.js';
import { notifyUser } from './_lib/notify.js';
import { rateLimit } from './_lib/rateLimit.js';

const CRON_SECRET = process.env.CRON_SECRET || '';
const MAX_PER_USER = 30;
const NOTIFY_CAP = 5;          // أقصى إشعارات لكل بحث في الجولة الواحدة
const KEEP_IDS = 60;           // عدد غرامات الإعلانات المحفوظة لتجنّب التكرار
const WINDOW_MS = 26 * 3600000; // نبحث في إعلانات آخر 26 ساعة (الكرون يعمل يومياً)

function listingMatches(l, s) {
  if (!l || !l.title) return false;
  if (s.category && l.category !== s.category) return false;
  if (s.governorate && l.governorate !== s.governorate) return false;
  const price = Number(l.price);
  if (s.maxPrice && Number.isFinite(price) && l.listingType !== 'rent' && price > Number(s.maxPrice)) return false;
  if (s.query) {
    const terms = String(s.query).toLowerCase().split(/\s+/).filter(Boolean);
    const hay = [l.title, l.brand, l.model, l.subcategory, l.description || ''].join(' ').toLowerCase();
    if (!terms.every((t) => hay.includes(t))) return false;
  }
  return true;
}

function searchLabel(s) {
  const parts = [];
  if (s.name) parts.push(s.name);
  else if (s.query) parts.push(`"${s.query}"`);
  if (s.category) parts.push(s.category);
  if (s.governorate) parts.push(s.governorate);
  return parts.join(' — ') || 'بحثك المحفوظ';
}

function sanitizeText(v, max = 120) {
  return String(v || '').trim().slice(0, max);
}

function cairoDayKey(d = new Date()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d); }
  catch {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}

function lastDaysKeys(n, end = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(cairoDayKey(new Date(end.getFullYear(), end.getMonth(), end.getDate() - i)));
  }
  return keys;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const ctr = (i, c) => (i > 0 ? Math.round((c / i) * 1000) / 10 : 0);

// ── إجراءات البائع (action=contact-click | action=listing-delete) ──
// داخل alerts.js لتقليص عدد serverless functions ضمن حد خطة Hobby.
const SELLER_CHANNELS = new Set(['whatsapp', 'phone', 'tasehil']);
const CONTACT_THROTTLE_MS = 5 * 60 * 1000; // إشعار واحد لكل إعلان/قناة كل 5 دقائق

const contactCopy = {
  whatsapp: { title: '📩  تواصل واتساب على إعلانك', body: 'تواصل معك أحد الزوار عبر واتساب' },
  phone:    { title: '📞  اتصال مباشر على إعلانك', body: 'اتصل بك أحد الزوار عبر اتصال مباشر' },
  tasehil:  { title: '💳  طلب تقسيط على إعلانك', body: 'طلب أحد الزوار تقسيط العربية عبر تساهيل' },
};

async function deleteWhere(db, collectionName, listingId) {
  const snaps = await db.collection(collectionName).where('listingId', '==', listingId).get();
  const docs = snaps.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

async function handleContactClick(db, req, res) {
  const { listingId = '', channel = '' } = req.body || {};
  if (!listingId || !SELLER_CHANNELS.has(channel)) {
    return res.status(400).json({ ok: false, message: 'بيانات غير صالحة' });
  }

  const snap = await db.collection('listings').doc(String(listingId)).get();
  if (!snap.exists) return res.json({ ok: false, message: 'الإعلان غير موجود' });

  const listing = snap.data();
  const ownerId = listing.userId || '';
  if (!ownerId || String(listingId).startsWith('sample-') || listing.status !== 'active') {
    return res.json({ ok: true }); // لا مالك حقيقي أو غير نشط — نتجاهل بهدوء
  }

  const lastAt = Number(listing.lastContactNotifiedAt) || 0;
  if (Date.now() - lastAt < CONTACT_THROTTLE_MS) return res.json({ ok: true, throttled: true });

  const copy = contactCopy[channel] || contactCopy.whatsapp;
  const title = channel === 'whatsapp'
    ? copy.title
    : `${copy.title} — ${listing.title || ''}`.trim();

  await notifyUser(db, ownerId, {
    title,
    body: `${(listing.title || 'إعلانك').slice(0, 80)} — ${copy.body}`,
    url: `/listing/${listingId}`,
    listingId,
    type: 'contact',
  });

  await snap.ref.update({
    lastContactNotifiedAt: Date.now(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.json({ ok: true });
}

async function handleListingDelete(db, req, res, decoded) {
  if (!decoded) return res.status(401).json({ ok: false, message: 'سجّل الدخول أولاً' });

  const { listingId = '' } = req.body || {};
  if (!listingId) return res.status(400).json({ ok: false, message: 'معرّف الإعلان مطلوب' });

  if (String(listingId).startsWith('sample-')) {
    return res.status(400).json({ ok: false, message: 'لا يمكن حذف إعلان تجريبي' });
  }

  const snap = await db.collection('listings').doc(String(listingId)).get();
  if (!snap.exists) return res.status(404).json({ ok: false, message: 'الإعلان غير موجود' });

  const listing = snap.data();
  const adminOk = await verifyAdmin(req);
  if (listing.userId !== decoded.uid && !adminOk) {
    return res.status(403).json({ ok: false, message: 'غير مصرح لك بحذف هذا الإعلان' });
  }

  const [analyticsCleaned, notificationsCleaned] = await Promise.all([
    deleteWhere(db, 'adAnalytics', String(listingId)),
    deleteWhere(db, 'notifications', String(listingId)),
  ]);

  await snap.ref.delete();

  return res.json({ ok: true, analyticsCleaned, notificationsCleaned });
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'https://carmasr-app.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });
  if (req.method === 'POST' && !rateLimit(req, res, { max: 40, windowMs: 60000 })) return;

  try {
    initAdmin();
    const db = getDb();
    const action = req.query.action || req.body?.action || '';
    const decoded = await verifyUser(req);

    if (action === 'contact-click') return handleContactClick(db, req, res);
    if (action === 'listing-delete') return handleListingDelete(db, req, res, decoded);

    if (action === 'save') {
      if (!decoded) return res.status(401).json({ ok: false, message: 'سجّل الدخول أولاً' });
      const { query = '', category = '', governorate = '', maxPrice = '', name = '', brand = '', model = '' } = req.body || {};
      if (!query && !category && !governorate && !brand && !model) {
        return res.status(400).json({ ok: false, message: 'اختر معايير البحث أولاً' });
      }
      const countSnap = await db.collection('savedSearches').where('userId', '==', decoded.uid).get();
      if (countSnap.size >= MAX_PER_USER) {
        return res.status(200).json({ ok: false, message: `الحد الأقصى ${MAX_PER_USER} بحثاً محفوظاً` });
      }
      const data = {
        userId: decoded.uid,
        query: sanitizeText(query, 200),
        category: sanitizeText(category, 40),
        governorate: sanitizeText(governorate, 80),
        brand: sanitizeText(brand, 40),
        model: sanitizeText(model, 40),
        maxPrice: /^\d+$/.test(String(maxPrice).replace(/[^\d]/g, '')) ? Number(String(maxPrice).replace(/[^\d]/g, '')) : null,
        name: sanitizeText(name, 60),
        active: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const same = countSnap.docs.find((d) => {
        const x = d.data();
        return x.query === data.query && x.category === data.category && x.governorate === data.governorate && (x.maxPrice || 0) === (data.maxPrice || 0);
      });
      const ref = same ? same.ref : db.collection('savedSearches').doc();
      await ref.set({ ...(same ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }), ...data });
      return res.status(200).json({ ok: true, id: ref.id });
    }

    if (action === 'unsave') {
      if (!decoded) return res.status(401).json({ ok: false, message: 'سجّل الدخول أولاً' });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ ok: false, message: 'معرّف البحث مطلوب' });
      const ref = db.collection('savedSearches').doc(String(id));
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ ok: false, message: 'غير موجود' });
      if (snap.data().userId !== decoded.uid) return res.status(403).json({ ok: false, message: 'غير مصرح' });
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    if (action === 'list') {
      if (!decoded) return res.status(401).json({ ok: false, message: 'سجّل الدخول أولاً' });
      const snaps = await db.collection('savedSearches').where('userId', '==', decoded.uid).get();
      const items = snaps.docs.map((d) => {
        const x = d.data();
        return { id: d.id, query: x.query || '', category: x.category || '', governorate: x.governorate || '', brand: x.brand || '', model: x.model || '', maxPrice: x.maxPrice || null, name: x.name || '', active: !!x.active };
      }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return res.status(200).json({ ok: true, items });
    }

    if (action === 'match') {
      const isCron = req.headers['x-vercel-cron'] === '1';
      const secretOk = !!CRON_SECRET && (req.query.secret || req.body?.secret) === CRON_SECRET;
      if (!isCron && !secretOk) return res.status(401).json({ ok: false, message: 'غير مصرح' });

      const since = Date.now() - WINDOW_MS;
      const [searchesSnap, recentSnap] = await Promise.all([
        db.collection('savedSearches').where('active', '==', true).get(),
        db.collection('listings').where('status', '==', 'active').orderBy('createdAt', 'desc').limit(80).get(),
      ]);

      const recent = recentSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((l) => {
          const t = l.createdAt?.toDate?.() || new Date(l.createdAt || 0);
          return t.getTime() >= since;
        });
      if (!recent.length) return res.status(200).json({ ok: true, matched: 0, mentions: 0 });

      const batch = db.batch();
      let notified = 0;
      let mentions = 0;

      for (const snap of searchesSnap.docs) {
        const s = snap.data();
        const prevIds = Array.isArray(s.notifiedListingIds) ? s.notifiedListingIds : [];
        const seen = new Set(prevIds);
        const hits = recent.filter((l) => !seen.has(l.id) && listingMatches(l, s)).slice(0, NOTIFY_CAP);
        if (!hits.length) continue;

        const label = searchLabel(s);
        for (const h of hits) {
          const title = '🔔 إعلان جديد يناسب بحثك';
          const body = `${h.title || 'إعلان جديد'}${Number(h.price) ? ` — ${Number(h.price).toLocaleString('ar-EG')} جنيه` : ''} (${label.slice(0, 80)})`;
          const url = `/listing/${h.id}`;
          try {
            await notifyUser(db, s.userId, { title, body, url, type: 'saved-search' });
            mentions += 1;
          } catch { /* تجاهل الأخطاء */ }
        }
        notified += 1;
        const nextIds = [...hits.map((x) => x.id), ...seen].slice(0, KEEP_IDS);
        batch.update(snap.ref, { notifiedListingIds: nextIds, lastCheckedAt: admin.firestore.FieldValue.serverTimestamp() });
      }

      if (notified > 0) await batch.commit();

      await db.collection('cronRuns').add({
        job: 'alerts-match',
        windowMs: WINDOW_MS,
        recent: recent.length,
        searches: searchesSnap.size,
        notified,
        mentions,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ ok: true, recent: recent.length, searches: searchesSnap.size, searched: notified, mentions });
    }

    if (action === 'stats') {
      if (!decoded) return res.status(401).json({ ok: false, message: 'سجّل الدخول أولاً' });

      // إعلانات المستخدم (كل الحالات)
      const listingsSnap = await db.collection('listings').where('userId', '==', decoded.uid).get();
      const listingMap = listingsSnap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, title: x.title || d.id, brand: x.brand || '', model: x.model || '', status: x.status || '', createdAt: x.createdAt };
      });
      const ids = listingMap.map((l) => l.id);

      const perListing = {};
      listingMap.forEach((l) => { perListing[l.id] = { impressions: 0, clicks: 0, today: 0, whatsapp: 0, call: 0, tasehil: 0, link: 0 }; });

      // نقرأ سجلات الإحصائيات الخاصة بهذه الإعلانات فقط
      const days7 = lastDaysKeys(7);
      const weekly = {};
      listingMap.forEach((l) => { weekly[l.id] = { impressions: 0, clicks: 0 }; });

      const keyed = ids.map((id) => `total_${id}`);
      const totalDocs = [];
      for (const group of chunk([...ids, ...keyed], 10)) {
        let snaps;
        try { snaps = await db.collection('adAnalytics').where('listingId', 'in', group).get(); }
        catch { snaps = { docs: [] }; }
        for (const s of snaps.docs) totalDocs.push(s);
      }

      for (const s of totalDocs) {
        const data = s.data();
        const listingId = data.listingId || '';
        const p = perListing[listingId];
        if (!p) continue;
        const day = data.day || '';
        if (s.id.startsWith('total_')) {
          p.impressions += Number(data.totalImpressions) || 0;
          p.clicks += Number(data.totalClicks) || 0;
          p.whatsapp += Number(data.whatsappClicks) || 0;
          p.call += Number(data.callClicks) || 0;
          p.tasehil += Number(data.tasehilClicks) || 0;
          p.link += Number(data.linkClicks) || 0;
        } else {
          p.impressions += Number(data.impressions) || 0;
          p.clicks += Number(data.clicks) || 0;
          if (day && days7.includes(day)) {
            weekly[listingId].impressions += Number(data.impressions) || 0;
            weekly[listingId].clicks += Number(data.clicks) || 0;
          }
          if (day && day === days7[days7.length - 1]) p.today += (Number(data.impressions) || 0) + (Number(data.clicks) || 0);
        }
      }

      // الاتجاه اللحظي: إجمالي آخر 7 أيام عبر كل الإعلانات
      const days = new Map(days7.map((d) => [d, { impressions: 0, clicks: 0 }]));
      for (const s of totalDocs) {
        const data = s.data();
        if (s.id.startsWith('total_')) continue;
        const d = days.get(data.day || '');
        if (!d) continue;
        d.impressions += Number(data.impressions) || 0;
        d.clicks += Number(data.clicks) || 0;
      }
      const trend = [...days.entries()].map(([day, v]) => ({ day, ...v }));

      const items = listingMap.map((l) => {
        const p = perListing[l.id];
        const w = weekly[l.id];
        return {
          id: l.id,
          slug: l.slug,
          title: l.title,
          brand: l.brand,
          model: l.model,
          status: l.status,
          impressions: p.impressions,
          clicks: p.clicks,
          ctr: ctr(p.impressions, p.clicks),
          weeklyImpressions: w.impressions,
          weeklyClicks: w.clicks,
          today: p.today,
          channels: { whatsapp: p.whatsapp, call: p.call, tasehil: p.tasehil, link: p.link },
        };
      });

      const totalImpressions = items.reduce((s, x) => s + x.impressions, 0);
      const totalClicks = items.reduce((s, x) => s + x.clicks, 0);
      const channels = items.reduce((s, x) => {
        s.whatsapp += x.channels.whatsapp;
        s.call += x.channels.call;
        s.tasehil += x.channels.tasehil;
        s.link += x.channels.link;
        return s;
      }, { whatsapp: 0, call: 0, tasehil: 0, link: 0 });

      return res.json({
        ok: true,
        totals: {
          listings: items.length,
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: ctr(totalImpressions, totalClicks),
          weeklyImpressions: items.reduce((s, x) => s + x.weeklyImpressions, 0),
          weeklyClicks: items.reduce((s, x) => s + x.weeklyClicks, 0),
          channels,
        },
        items: items.sort((a, b) => (b.impressions + b.clicks) - (a.impressions + a.clicks)).slice(0, 50),
        trend,
      });
    }

    return res.status(400).json({ ok: false, message: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message || 'خطأ غير متوقع' });
  }
}