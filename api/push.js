import admin from 'firebase-admin';
import webPush from 'web-push';
import { rateLimit } from './_lib/rateLimit.js';
import { initAdmin } from './_lib/db.js';
import { runGroupCampaignTick } from './_lib/listings.js';

import { allowCors, isPreflight } from "./_lib/cors.js";
// ── Facebook auto-posting helpers ───────────────────────────────────
const FB_PAGE_ID = process.env.FB_PAGE_ID || '61591300694672';
const FB_PAGE_LINK = 'https://www.facebook.com/TareeqEG';
const SITE = 'https://carmasr-app.vercel.app';
const FB_HASHTAGS = '#كار_مصر #Tareeq #نقل_ثقيل #مصر';

const FB_CATEGORIES = {
  trucks: 'شاحنات', equipment: 'معدات ثقيلة', trailers: 'نقل (مقطورات)',
  buses: 'أتوبيسات', 'spare-parts': 'قطع غيار',
};

function fbFormatPrice(p) {
  if (!p) return '';
  return `${Math.round(Number(p)).toLocaleString('en-US')} ج`;
}

function fbTruncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

function fbListingPost(l) {
  return `🚛 *${l.title || 'إعلان جديد'}*\n\n${FB_CATEGORIES[l.category] || 'عرض'} | ${l.governorate || 'مصر'}${l.price ? `\n💰 السعر: ${fbFormatPrice(l.price)}` : ''}${l.description ? `\n📋 ${fbTruncate(l.description, 120)}` : ''}\n\n👇 للتفاصيل والصور: ${SITE}/listing/${l.id}\n\n🔔 تابعنا على صفحتنا الرسمية ليصلك كل جديد\n📱 حمّل التطبيق: ${SITE}/download/\n\n${FB_HASHTAGS}`;
}

function fbLoadPost(x) {
  return `📦 حمولة متاحة: ${x.origin} ← ${x.destination}\n\n${x.cargoType ? `🧱 النوع: ${x.cargoType}\n` : ''}${x.weight ? `⚖️ الوزن: ${x.weight}\n` : ''}${x.price ? `💰 السعر: ${fbFormatPrice(x.price)}\n` : ''}${x.isReturnLoad ? '🔄 حمولة عودة\n' : ''}\n👇 التفاصيل: ${SITE}/loads\n\n🔔 تابعنا على صفحتنا الرسمية ليصلك كل جديد\n📱 حمّل التطبيق: ${SITE}/download/\n\n#حمولات #نقل_بضائع #مصر`;
}

function fbJobPost(j) {
  return `💼 فرصة عمل\n\n${j.title || 'وظيفة'}${j.company ? `\n🏢 ${j.company}` : ''}${j.governorate ? `\n📍 ${j.governorate}` : ''}${j.salary ? `\n💰 الراتب: ${j.salary}` : ''}\n\n👇 قدم الآن: ${SITE}/jobs\n\n🔔 تابعنا على صفحتنا الرسمية ليصلك كل جديد\n📱 حمّل التطبيق: ${SITE}/download/\n\n#وظائف #سائقين #مصر`;
}

const FB_BRAND_POSTS = [
  () => `🚛 *مرحباً بكم في كار مصر CarMasr!*\n\nأكبر سوق إلكتروني متخصص في النقل الثقيل في مصر 🇪🇬\n\n✅ بيع وشراء شاحنات ومعدات ثقيلة\n✅ حمولات وطلبات نقل\n✅ وظائف القيادة والميكانيكا\n✅ تمويل وطوارئ على الطريق\n\n📱 حمّل التطبيق: ${SITE}/download/\n\n${FB_HASHTAGS}`,
  () => `🚛 عندك شاحنة وبتدور على مشتري؟\n\nانشر إعلانك مجاناً على كار مصر CarMasr ووصّل لآلاف المهتمين في كل مصر! 🇪🇬\n\n💡 أضف إعلانك: ${SITE}\n\n#بيع_شاحنة #معدات_ثقيلة #مصر`,
  () => `📦 صاحب حمولة وعايز شاحنة بكرة؟\n\nعلى كار مصر CarMasr توصل لأكبر شبكة سائقين وشاحنات في مصر — نشر حمولة مجاني وسريع! 💨\n\n📱 حمّل التطبيق: ${SITE}/download/\n\n#حمولات #نقل_بضائع #مصر`,
  () => `💼 بتدور على شغل في عالم النقل؟\n\nقسم الوظائف في كار مصر CarMasr فيه كل حاجة: سائقين، ميكانيكا، كهربائيين، فنيين، لوجستيات والمزيد! 🔧\n\n👷 استكشف الوظائف: ${SITE}/jobs\n\n#وظائف #توظيف #مصر`,
  () => `🔥 محتاج تمويل؟ أو سيارة عطلانة على الطريق؟\n\nكار مصر CarMasr بيوفرلك:\n💰 تمويل الشاحنات\n🛠️ طوارئ الطريق 24/7\n\n👇 كل الخدمات: ${SITE}\n\n#تمويل #طوارئ_الطريق #مصر`,
];

async function fbPostToPage(message, imageUrl, imageOnly = false) {
  const token = String(process.env.FB_PAGE_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || process.env.MESSENGER_PAGE_ACCESS_TOKEN || '').trim();
  if (!token) throw new Error('FB_PAGE_TOKEN غير مضبوط في بيئة Vercel');

  // 1) نشر الصورة نفسها — بوستات الإعلانات صور فقط (بدون كابشن/لينك)
  if (imageUrl) {
    try {
      const photoUrl = `https://graph.facebook.com/v26.0/${FB_PAGE_ID}/photos`;
      const photoBody = new URLSearchParams({ url: imageUrl, access_token: token });
      if (!imageOnly && message) photoBody.set('caption', message);
      const photoResp = await fetch(photoUrl, { method: 'POST', body: photoBody });
      const photoData = await photoResp.json();
      if (photoResp.ok && !photoData.error) return photoData.post_id || photoData.id;
    } catch { /* نكمل للنشر النصي */ }
  }

  // إعلان مطلوب صور فقط: ممنوع ننشر نسخة نصية بدون صورة
  if (imageOnly) throw new Error('فشل نشر صورة الإعلان على فيسبوك — لم يتم نشر نص بديل');

  const url = `https://graph.facebook.com/v26.0/${FB_PAGE_ID}/feed`;
  const body = new URLSearchParams({ message, access_token: token });
  const resp = await fetch(url, { method: 'POST', body });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(`فشل النشر على فيسبوك: ${data.error?.message || resp.statusText}`);
  return data.id;
}

async function fbBuildMessage(db, mode) {
  if (mode === 'brand') {
    const idx = Number(reqQueryI) % FB_BRAND_POSTS.length;
    return FB_BRAND_POSTS[idx]();
  }
  if (mode === 'listing') {
    const snap = await db.collection('listings').doc(reqQueryId).get();
    if (!snap.exists) throw new Error('إعلان غير موجود');
    const data = snap.data();
    reqQueryImage = Array.isArray(data.images) ? (data.images.find(Boolean) || '') : '';
    if (!reqQueryImage) throw new Error('الإعلان مفيش فيه صور — بوست الإعلان على فيسبوك صور فقط');
    return fbListingPost({ id: reqQueryId, ...data });
  }
  if (mode === 'load') {
    const snap = await db.collection('loads').doc(reqQueryId).get();
    if (!snap.exists) throw new Error('حمولة غير موجودة');
    return fbLoadPost({ id: reqQueryId, ...snap.data() });
  }
  if (mode === 'job') {
    const snap = await db.collection('jobs').doc(reqQueryId).get();
    if (!snap.exists) throw new Error('وظيفة غير موجودة');
    return fbJobPost({ id: reqQueryId, ...snap.data() });
  }
  // auto: مميز → أحدث → تسويقي — لازم إعلان فيه صور (البوست صور فقط)
  const withImage = (docs) => docs.find(d => Array.isArray(d.data().images) && d.data().images.some(Boolean)) || null;
  const featured = await db.collection('listings').where('featured', '==', true).orderBy('createdAt', 'desc').limit(10).get();
  const featuredWithImage = withImage(featured.docs);
  if (featuredWithImage) {
    reqQueryImage = featuredWithImage.data().images.find(Boolean);
    return fbListingPost({ id: featuredWithImage.id, ...featuredWithImage.data() });
  }
  const latest = await db.collection('listings').orderBy('createdAt', 'desc').limit(20).get();
  const latestWithImage = withImage(latest.docs);
  if (latestWithImage) {
    reqQueryImage = latestWithImage.data().images.find(Boolean);
    return fbListingPost({ id: latestWithImage.id, ...latestWithImage.data() });
  }
  const idx = new Date().getDay() % FB_BRAND_POSTS.length;
  return FB_BRAND_POSTS[idx]();
}

// محددات مؤقتة تُضبط قبل الاستدعاء
let reqQueryI = 0;
let reqQueryId = '';
let reqQueryImage = '';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'push@carmasr-app.vercel.app';
const CRON_SECRET = process.env.CRON_SECRET || '';
const vapidReady = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);

if (vapidReady) webPush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE);

function buildSubscription(data) {
  return {
    endpoint: data.endpoint || '',
    keys: { auth: data.auth || '', p256dh: data.p256dh || '' },
  };
}

async function sendFcm(db, { tokens, title, body, url }) {
  if (!tokens || !tokens.length) return 0;
  const messaging = admin.messaging();
  const message = {
    notification: { title, body },
    android: { priority: 'high', notification: { title, body, icon: 'ic_stat_icon', color: '#FF8A1A' } },
    data: { title, body, url: url || '/' },
  };
  const results = await Promise.allSettled(
    tokens.map(t => messaging.send({ token: t, ...message }).catch(() => {}))
  );
  return results.length;
}

async function getDeviceTokens(db, targetUserId) {
  const snap = targetUserId
    ? await db.collection('deviceTokens').where('userId', '==', targetUserId).get()
    : await db.collection('deviceTokens').get();
  return snap.docs.map(d => d.data().token).filter(Boolean);
}

// بث إشعار جماعي: in-app لكل المستخدمين + push (web + FCM)
async function broadcastAll(db, { title, body, url, type = 'system', exhibitionId = null, excludeUserId = '' }) {
  const usersSnap = await db.collection('users').get();
  let written = 0;
  for (let i = 0; i < usersSnap.docs.length; i += 400) {
    const chunk = usersSnap.docs.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach(u => {
      if (excludeUserId && u.id === excludeUserId) return;
      batch.set(db.collection('notifications').doc(), {
        userId: u.id, type, title, body, url,
        exhibitionId: exhibitionId || null, read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    written += chunk.length;
  }

  const payload = JSON.stringify({ title, body, icon: '/tareeq-logo.png', url });
  let pushSent = 0;
  if (vapidReady) {
    const allSubs = await db.collection('pushSubscriptions').get();
    await Promise.allSettled(
      allSubs.docs.map(d => webPush.sendNotification(buildSubscription(d.data()), payload).catch(() => {}))
    );
    pushSent = allSubs.size;
  }
  const deviceTokens = await getDeviceTokens(db, null);
  const fcmSent = await sendFcm(db, { tokens: deviceTokens, title, body, url });
  return { inApp: written, sent: pushSent + fcmSent, totalUsers: usersSnap.size };
}

// ── دليل التجار: تجميع + فلترة + إرسال ─────────────────────────────────
function toIso(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v.toMillis === 'function') return new Date(v.toMillis()).toISOString();
  return String(v);
}

function toTs(v) {
  if (!v) return 0;
  const t = Date.parse(toIso(v));
  return Number.isNaN(t) ? 0 : t;
}

function normalizePhone(p) {
  if (!p) return '';
  let d = String(p).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '2' + d.slice(1);
  else if (d.startsWith('1') && d.length === 10) d = '2' + d;
  else if (d.startsWith('2') && d.length !== 12) d = '20' + d;
  return d;
}

async function requireAdminRole(req, db) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  let decoded;
  try { decoded = await admin.auth().verifyIdToken(idToken); } catch { return null; }
  const snap = await db.doc(`users/${decoded.uid}`).get();
  const caller = snap.data();
  if (!caller || caller.type !== 'admin') return null;
  return decoded;
}

async function aggregateMerchants(db) {
  const [usersSnap, listingsSnap, tokensSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('listings').get(),
    db.collection('deviceTokens').get(),
  ]);

  const tokensByUser = new Map();
  tokensSnap.docs.forEach(d => {
    const userId = d.data().userId;
    if (userId) tokensByUser.set(userId, (tokensByUser.get(userId) || 0) + 1);
  });

  const rows = new Map();
  const upsert = (phone, fn) => {
    const key = normalizePhone(phone);
    if (!key) return;
    if (!rows.has(key)) {
      rows.set(key, {
        id: key, name: '', phones: [], governorate: '', categories: [],
        adCount: 0, memberSince: '', lastAdAt: '', advertiser: false,
        member: false, hasPush: false, optOut: false, userIds: [],
      });
    }
    fn(rows.get(key));
  };

  listingsSnap.docs.forEach(d => {
    const ad = d.data();
    if (ad.status && ad.status !== 'active') return;
    const phone = ad.contactPhone || ad.userPhone || '';
    upsert(phone, (row) => {
      row.advertiser = true;
      row.adCount += 1;
      const cand = String(ad.advertiserName || ad.userName || '').trim();
      if (!row.name && cand) row.name = cand;
      if (ad.governorate && !row.governorate) row.governorate = ad.governorate;
      if (ad.category && !row.categories.includes(ad.category)) row.categories.push(ad.category);
      if (phone && !row.phones.includes(phone)) row.phones.push(phone);
      if (ad.userId && !row.userIds.includes(ad.userId)) row.userIds.push(ad.userId);
      const t = toTs(ad.createdAt);
      if (t && (!row.lastAdAt || t > toTs(row.lastAdAt))) row.lastAdAt = toIso(ad.createdAt);
    });
  });

  usersSnap.docs.forEach(d => {
    const u = d.data();
    if (u.type === 'admin') return;
    upsert(u.phone, (row) => {
      row.member = true;
      const cand = String(u.name || u.businessName || '').trim();
      if (!row.name && cand) row.name = cand;
      if (!row.governorate) row.governorate = u.governorate || '';
      if (u.phone && !row.phones.includes(u.phone)) row.phones.push(u.phone);
      if (!row.userIds.includes(u.id)) row.userIds.push(u.id);
      if (u.marketingOptOut === true) row.optOut = true;
      const t = toTs(u.createdAt);
      if (!row.memberSince || t < toTs(row.memberSince)) row.memberSince = toIso(u.createdAt);
    });
  });

  rows.forEach(row => {
    row.hasPush = row.userIds.some(id => tokensByUser.get(id));
  });

  const list = Array.from(rows.values());
  list.sort((a, b) => (b.adCount - a.adCount) || (Number(b.hasPush) - Number(a.hasPush)));

  return {
    rows: list,
    stats: {
      total: list.length,
      advertisers: list.filter(r => r.advertiser).length,
      members: list.filter(r => r.member).length,
      withPush: list.filter(r => r.hasPush).length,
      optedOut: list.filter(r => r.optOut).length,
    },
  };
}

async function collectMerchantTokens(db, userIds) {
  const set = new Set(userIds);
  const snap = await db.collection('deviceTokens').get();
  const out = [];
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.token && set.has(data.userId)) out.push({ token: data.token, ref: d.ref });
  });
  return out;
}

async function sendMerchantFcm(db, { tokens, title, body, url }) {
  const messaging = admin.messaging();
  const message = {
    notification: { title, body },
    android: { priority: 'high', notification: { title, body, icon: 'ic_stat_icon', color: '#FF8A1A' } },
    data: { title, body, url: url || '/' },
  };
  let delivered = 0;
  let failed = 0;
  let staleRemoved = 0;
  const CHUNK = 50;
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map(t => messaging.send({ token: t.token, ...message }))
    );
    results.forEach((r, idx) => {
      const t = chunk[idx];
      if (r.status === 'fulfilled') { delivered += 1; return; }
      const code = (r.reason && r.reason.code) || (r.reason && r.reason.errorInfo && r.reason.errorInfo.code) || '';
      const isStale = /not-registered|invalid-registration-token|UNREGISTERED/i.test(code);
      if (isStale) {
        staleRemoved += 1;
        if (t.ref) t.ref.delete().catch(() => {});
      } else {
        failed += 1;
      }
    });
  }
  return { delivered, failed, staleRemoved };
}

const MERCHANT_CRON_AUDIENCE = { staleDays: 7, newMemberDays: 7, cap: 100 };

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // CORS
  allowCors(res);
  if (isPreflight(req)) return res.status(204).end();

  if (req.method === 'POST' && !rateLimit(req, res)) return;
  if (req.method === 'GET') {
    if (req.query.action === 'fbPost') {
      if (!CRON_SECRET || req.headers['x-vercel-cron'] !== '1') {
        return res.status(401).json({ error: 'غير مصرح' });
      }
      req.body = { action: 'fbPost', mode: req.query.mode, i: req.query.i, id: req.query.id, secret: CRON_SECRET };
      req.method = 'POST';
      return fbRunAction(req, res);
    }
    if (req.query.action === 'merchantCron') {
      if (!CRON_SECRET || req.headers['x-vercel-cron'] !== '1') {
        return res.status(401).json({ error: 'غير مصرح' });
      }
      req.body = { action: 'merchantCron', secret: CRON_SECRET };
      req.method = 'POST';
      return fbRunAction(req, res);
    }
    if (req.query.action === 'fbCampaign') {
      if (!CRON_SECRET || req.headers['x-vercel-cron'] !== '1') {
        return res.status(401).json({ error: 'غير مصرح' });
      }
      try {
        initAdmin();
        const out = await runGroupCampaignTick();
        return res.status(200).json({ success: true, ...out });
      } catch (e) {
        return res.status(500).json({ error: String((e && e.message) || e) });
      }
    }
    if (req.query.action === 'merchantList') {
      try {
        initAdmin();
        const db = admin.firestore();
        const auth = await requireAdminRole(req, db);
        if (!auth) return res.status(401).json({ error: 'غير مصرح — سجل دخول كأدمن' });
        const { rows, stats } = await aggregateMerchants(db);
        return res.status(200).json({ ok: true, rows, stats });
      } catch (err) {
        console.error('merchantList error:', err);
        return res.status(500).json({ error: 'فشل تحميل دليل التجار' });
      }
    }
    return res.status(200).json({ publicKey: VAPID_PUBLIC, vapidReady });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  return fbRunAction(req, res);
}

async function fbRunAction(req, res) {

  try {
    initAdmin();

    const { action: bodyAction, subscription: rawSub, userId, title, body, url, targetUserId } = req.body;
    const action = bodyAction || req.query.action;

    if (action === 'subscribe') {
      if (!rawSub || !userId) return res.status(400).json({ error: 'subscription and userId required' });
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try { decodedToken = await admin.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: 'يجب تسجيل الدخول' }); }
        if (decodedToken.uid !== userId) return res.status(403).json({ error: 'Forbidden' });
      } else {
        return res.status(401).json({ error: 'يجب تسجيل الدخول' });
      }
      const ref = admin.firestore().collection('pushSubscriptions');
      const existing = await ref.where('userId', '==', userId).get();
      if (!existing.empty) {
        const doc = existing.docs[0];
        await doc.ref.update({
          endpoint: rawSub.endpoint,
          auth: rawSub.keys?.auth || '',
          p256dh: rawSub.keys?.p256dh || '',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await ref.add({
          userId,
          endpoint: rawSub.endpoint,
          auth: rawSub.keys?.auth || '',
          p256dh: rawSub.keys?.p256dh || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'unsubscribe') {
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try { decodedToken = await admin.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: 'يجب تسجيل الدخول' }); }
        if (decodedToken.uid !== userId) return res.status(403).json({ error: 'Forbidden' });
      } else {
        return res.status(401).json({ error: 'يجب تسجيل الدخول' });
      }
      const existing = await admin.firestore().collection('pushSubscriptions').where('userId', '==', userId).get();
      const deletes = existing.docs.map(d => d.ref.delete());
      await Promise.all(deletes);
      return res.status(200).json({ success: true });
    }

    if (action === 'subscribeDevice') {
      const token = (rawSub && rawSub.token) || req.body.token;
      if (!token || !userId) return res.status(400).json({ error: 'رمز الجهاز والمستخدم مطلوبان' });
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try { decodedToken = await admin.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: 'يجب تسجيل الدخول' }); }
        if (decodedToken.uid !== userId) return res.status(403).json({ error: 'Forbidden' });
      } else {
        return res.status(401).json({ error: 'يجب تسجيل الدخول' });
      }

      const db = admin.firestore();
      const existing = await db.collection('deviceTokens').where('userId', '==', userId).where('token', '==', token).get();
      if (existing.empty) {
        const olds = await db.collection('deviceTokens').where('userId', '==', userId).get();
        const deletes = olds.docs.map(d => d.ref.delete());
        await Promise.all(deletes);
        await db.collection('deviceTokens').add({
          userId,
          token,
          platform: rawSub?.platform || 'android',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'unsubscribeDevice') {
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try { decodedToken = await admin.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: 'يجب تسجيل الدخول' }); }
        if (decodedToken.uid !== userId) return res.status(403).json({ error: 'Forbidden' });
      } else {
        return res.status(401).json({ error: 'يجب تسجيل الدخول' });
      }
      const existing = await admin.firestore().collection('deviceTokens').where('userId', '==', userId).get();
      const deletes = existing.docs.map(d => d.ref.delete());
      await Promise.all(deletes);
      return res.status(200).json({ success: true });
    }

    if (action === 'sendCron') {
      const { cronSecret } = req.body;
      if (!CRON_SECRET || cronSecret !== CRON_SECRET) return res.status(401).json({ error: 'Invalid cron secret' });
      if (!vapidReady) return res.status(200).json({ success: true, sent: 0, note: 'VAPID not configured' });
      const payload = JSON.stringify({
        title: title || 'كار مصر CarMasr',
        body: body || 'رسالة جديدة',
        icon: '/tareeq-logo.png',
        url: url || '/',
      });
      const allSubs = await admin.firestore().collection('pushSubscriptions').get();
      const results = await Promise.allSettled(
        allSubs.docs.map(d => webPush.sendNotification(buildSubscription(d.data()), payload).catch(() => {}))
      );
      const deviceTokens = await getDeviceTokens(admin.firestore(), null);
      const fcmSent = await sendFcm(admin.firestore(), { tokens: deviceTokens, title: title || 'كار مصر CarMasr', body: body || 'رسالة جديدة', url });
      return res.status(200).json({ success: true, sent: allSubs.size + fcmSent });
    }

    if (action === 'send') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try { decodedToken = await admin.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: 'يجب تسجيل الدخول' }); }
      const callerSnap = await admin.firestore().doc(`users/${decodedToken.uid}`).get();
      const caller = callerSnap.data();
      if (!caller || caller.type !== 'admin') return res.status(403).json({ error: 'فقط الأدمن يمكنه إرسال الإشعارات' });

      const payload = JSON.stringify({
        title: title || 'كار مصر CarMasr',
        body: body || 'رسالة جديدة',
        icon: '/tareeq-logo.png',
        url: url || '/',
      });

      const db = admin.firestore();

      const usersSnap = await db.collection('users').get();
      const notificationPromises = usersSnap.docs.map(u =>
        db.collection('notifications').add({
          userId: u.id,
          type: 'system',
          title: title || 'كار مصر CarMasr',
          body: body || 'رسالة جديدة',
          read: false,
          listingId: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {})
      );
      await Promise.allSettled(notificationPromises);

      let pushSent = 0;
      if (vapidReady) {
        const allSubs = targetUserId
          ? await db.collection('pushSubscriptions').where('userId', '==', targetUserId).get()
          : await db.collection('pushSubscriptions').get();
        pushSent = allSubs.size;
        await Promise.allSettled(
          allSubs.docs.map(d => webPush.sendNotification(buildSubscription(d.data()), payload).catch(() => {}))
        );
      }
      const deviceTokens = await getDeviceTokens(db, targetUserId);
      const fcmSent = await sendFcm(db, { tokens: deviceTokens, title: title || 'كار مصر CarMasr', body: body || 'رسالة جديدة', url });

      return res.status(200).json({
        success: true,
        sent: pushSent + fcmSent,
        totalUsers: usersSnap.size,
        inAppNotifs: usersSnap.size,
        pushNotifs: pushSent + fcmSent,
      });
    }

    // بث إشعار جماعي عند إضافة المعرض لمنتج/إعلان جديد (in-app لكل المستخدمين + push)
    // بحد أقصى يومي لكل معرض (EXH_BROADCAST_DAILY_CAP، افتراضي 3)
    if (action === 'exhibitionAd') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try { decodedToken = await admin.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: 'يجب تسجيل الدخول' }); }

      const db = admin.firestore();
      const productId = String(req.body.productId || req.body.id || '').trim();
      if (!productId) return res.status(400).json({ error: 'productId required' });

      const pSnap = await db.collection('products').doc(productId).get();
      if (!pSnap.exists) return res.status(404).json({ error: 'المنتج غير موجود' });
      const product = pSnap.data() || {};
      const exhibitionId = product.exhibitionId;
      if (!exhibitionId) return res.status(400).json({ error: 'المنتج غير مرتبط بمعرض' });

      const [eSnap, callerSnap] = await Promise.all([
        db.collection('exhibitions').doc(exhibitionId).get(),
        db.collection('users').doc(decodedToken.uid).get(),
      ]);
      const ex = eSnap.exists ? (eSnap.data() || {}) : {};
      const caller = callerSnap.data() || {};
      if (ex.userId !== decodedToken.uid && caller.type !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

      const DAILY_CAP = Number(process.env.EXH_BROADCAST_DAILY_CAP || 3) || 3;
      const day = new Date().toISOString().slice(0, 10);
      const counterRef = db.collection('exhibitionBroadcasts').doc(exhibitionId);
      const counterSnap = await counterRef.get();
      const c = counterSnap.exists ? (counterSnap.data() || {}) : {};
      const usedToday = c.day === day ? Number(c.count || 0) : 0;
      if (usedToday >= DAILY_CAP) {
        return res.status(200).json({ success: false, skipped: true, reason: 'daily_cap', sent: 0, cap: DAILY_CAP });
      }
      await counterRef.set({ day, count: usedToday + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      const exName = String(ex.name || product.exhibitionName || 'معرض').trim();
      const priceNum = Number(String(product.price || '').replace(/[^\d]/g, ''));
      const title = `🆕 معرض ${exName}`;
      const body = `${product.name || 'منتج جديد'}${priceNum > 0 ? ` — ${product.price} جنيه` : ''}`;
      const url = `/product/${productId}`;
      const ownerId = ex.userId || '';
      const ownerTitle = '✅ تم نشر منتج في معرضك';
      const ownerBody = `${product.name || 'منتج جديد'} — أصبح ظاهراً للعملاء الآن`;

      const usersSnap = await db.collection('users').get();
      const recipients = usersSnap.docs;
      let written = 0;
      for (let i = 0; i < recipients.length; i += 400) {
        const chunk = recipients.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach(u => {
          const isOwner = u.id === ownerId;
          batch.set(db.collection('notifications').doc(), {
            userId: u.id, type: 'exhibition_product',
            title: isOwner ? ownerTitle : title,
            body: isOwner ? ownerBody : body,
            exhibitionId, listingId: productId, url, read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
        written += chunk.length;
      }

      const payload = JSON.stringify({ title, body, icon: '/tareeq-logo.png', url });
      let pushSent = 0;
      if (vapidReady) {
        const allSubs = await db.collection('pushSubscriptions').get();
        await Promise.allSettled(
          allSubs.docs.map(d => webPush.sendNotification(buildSubscription(d.data()), payload).catch(() => {}))
        );
        pushSent = allSubs.size;
      }
      const deviceTokens = await getDeviceTokens(db, null);
      const fcmSent = await sendFcm(db, { tokens: deviceTokens, title, body, url });

      return res.status(200).json({
        success: true,
        sent: pushSent + fcmSent,
        inApp: written,
        totalUsers: usersSnap.size,
        cap: DAILY_CAP,
        remaining: Math.max(0, DAILY_CAP - (usedToday + 1)),
      });
    }

    // بث إشعار جماعي عند إنشاء معرض جديد (in-app لكل المستخدمين + push) — مرة واحدة لكل معرض
    if (action === 'exhibitionCreated') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try { decodedToken = await admin.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: 'يجب تسجيل الدخول' }); }

      const db = admin.firestore();
      const exhibitionId = String(req.body.exhibitionId || req.body.id || '').trim();
      if (!exhibitionId) return res.status(400).json({ error: 'exhibitionId required' });

      const [eSnap, callerSnap] = await Promise.all([
        db.collection('exhibitions').doc(exhibitionId).get(),
        db.collection('users').doc(decodedToken.uid).get(),
      ]);
      if (!eSnap.exists) return res.status(404).json({ error: 'المعرض غير موجود' });
      const ex = eSnap.data() || {};
      const caller = callerSnap.data() || {};
      if (ex.userId !== decodedToken.uid && caller.type !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

      const markerRef = db.collection('exhibitionBroadcasts').doc('create_' + exhibitionId);
      const markerSnap = await markerRef.get();
      if (markerSnap.exists) return res.status(200).json({ success: true, skipped: true, reason: 'already_broadcast', sent: 0 });
      await markerRef.set({ kind: 'create', exhibitionId, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      const exName = String(ex.name || 'معرض جديد').trim();
      const title = '🏪 معرض جديد على كار مصر';
      const body = `${exName}${ex.governorate ? ` — ${ex.governorate}` : ''} — تصفّح منتجاته الآن`;
      const url = `/exhibitions/${exhibitionId}`;

      const out = await broadcastAll(db, { title, body, url, type: 'system', exhibitionId, excludeUserId: ex.userId || '' });
      return res.status(200).json({ success: true, ...out, url });
    }

    if (action === 'sendChat') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try { decodedToken = await admin.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: 'يجب تسجيل الدخول' }); }

      if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
      if (!vapidReady) return res.status(200).json({ success: true, sent: 0, note: 'VAPID not configured' });

      const payload = JSON.stringify({
        title: title || 'رسالة جديدة',
        body: body || 'لديك رسالة جديدة',
        icon: '/tareeq-logo.png',
        url: url || '/',
      });

      const subs = await admin.firestore().collection('pushSubscriptions').where('userId', '==', targetUserId).get();
      await Promise.allSettled(
        subs.docs.map(d => webPush.sendNotification(buildSubscription(d.data()), payload).catch(() => {}))
      );
      const deviceTokens = await getDeviceTokens(admin.firestore(), targetUserId);
      const fcmSent = await sendFcm(admin.firestore(), { tokens: deviceTokens, title: title || 'رسالة جديدة', body: body || 'لديك رسالة جديدة', url });
      return res.status(200).json({ success: true, sent: subs.size + fcmSent });
    }

    if (action === 'fbPost') {
      const isCron = req.headers['x-vercel-cron'] === '1';
      const secretOk = !!CRON_SECRET && (req.query.secret || req.body?.secret) === CRON_SECRET;
      if (!isCron && !secretOk) return res.status(401).json({ error: 'غير مصرح' });

      const mode = String(req.query.mode || req.body?.mode || 'auto');
      reqQueryI = Number(req.query.i || req.body?.i || 0);
      reqQueryId = String(req.query.id || req.body?.id || '');

      const db = admin.firestore();
      reqQueryImage = '';
      const message = await fbBuildMessage(db, mode);
      // إعلانات (listing/auto): صور فقط بدون كابشن. البوستات التسويقية النصية تفضل زي ما هي.
      const imageOnly = Boolean(reqQueryImage) && (mode === 'listing' || mode === 'auto');
      const postId = await fbPostToPage(message, reqQueryImage, imageOnly);

      await db.collection('fbPosts').add({
        postId, mode,
        message: imageOnly ? '' : fbTruncate(message, 300),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ success: true, postId, page: FB_PAGE_LINK });
    }

    if (action === 'merchantList') {
      const auth = await requireAdminRole(req, admin.firestore());
      if (!auth) return res.status(401).json({ error: 'غير مصرح — سجل دخول كأدمن' });
      const { rows, stats } = await aggregateMerchants(admin.firestore());
      return res.status(200).json({ ok: true, rows, stats });
    }

    if (action === 'merchantBroadcast') {
      const auth = await requireAdminRole(req, admin.firestore());
      if (!auth) return res.status(401).json({ error: 'غير مصرح — سجل دخول كأدمن' });
      const { title, body, url, ids } = req.body;
      if (!title || !body) return res.status(400).json({ error: 'العنوان والنص مطلوبان' });
      if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'اختر صفوفاً للإرسال' });

      const db = admin.firestore();
      const { rows } = await aggregateMerchants(db);
      const wanted = new Set(ids);
      const targets = rows.filter(r => wanted.has(r.id) && !r.optOut);
      const optedOut = rows.filter(r => wanted.has(r.id) && r.optOut);

      const userIds = Array.from(new Set(targets.flatMap(r => r.userIds)));
      const tokens = await collectMerchantTokens(db, userIds);
      const summary = await sendMerchantFcm(db, { tokens, title, body, url });

      await db.collection('merchantCampaigns').add({
        type: 'manual', title, body, url: url || '',
        audienceCount: targets.length,
        tokenCount: tokens.length,
        delivered: summary.delivered, failed: summary.failed, staleRemoved: summary.staleRemoved,
        optedOutSkipped: optedOut.length,
        createdBy: auth.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ ok: true, ...summary, audience: targets.length, optedOutSkipped: optedOut.length });
    }

    if (action === 'merchantCron') {
      const isCron = req.headers['x-vercel-cron'] === '1';
      const secretOk = !!CRON_SECRET && (req.query.secret || req.body?.secret) === CRON_SECRET;
      if (!isCron && !secretOk) return res.status(401).json({ error: 'غير مصرح' });

      const db = admin.firestore();
      const { rows } = await aggregateMerchants(db);
      const now = Date.now();
      const staleAfter = now - MERCHANT_CRON_AUDIENCE.staleDays * 86400000;
      const memberAfter = now - MERCHANT_CRON_AUDIENCE.newMemberDays * 86400000;

      const audience = rows
        .filter(r => !r.optOut && r.hasPush)
        .filter(r => {
          if (r.advertiser && !r.lastAdAt) return true;
          if (r.advertiser && toTs(r.lastAdAt) < staleAfter) return true;
          if (!r.advertiser && r.memberSince && toTs(r.memberSince) > memberAfter) return true;
          return false;
        })
        .slice(0, MERCHANT_CRON_AUDIENCE.cap);

      const userIds = Array.from(new Set(audience.flatMap(r => r.userIds)));
      const tokens = await collectMerchantTokens(db, userIds);

      const title = 'كار مصر CarMasr';
      const body = 'بعت إعلان مدّة وأنت مش لقّيت طلبك؟ أضف إعلانك الجديد مجاناً أو راجع آخر المعروضات الآن 🚛';
      const url = '/';
      const summary = await sendMerchantFcm(db, { tokens, title, body, url });

      await db.collection('merchantCampaigns').add({
        type: 'cron', criteria: MERCHANT_CRON_AUDIENCE,
        title, body, url,
        audienceCount: audience.length,
        tokenCount: tokens.length,
        delivered: summary.delivered, failed: summary.failed, staleRemoved: summary.staleRemoved,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ ok: true, ...summary, audience: audience.length });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
