import admin from 'firebase-admin';
import { getDb, initAdmin, verifyAdmin } from './_lib/db.js';
import { rateLimit } from './_lib/rateLimit.js';
import { createListingFromPayload, notifyAdminsOfNewListing, scrapeLinkPreview, freeAdMessage, whatsappLink, messengerLink, contactAdvertiserMessage, listingUrl, advertiserName, advertiserMessengerLink, cleanStr, cleanMsg, postListingToFacebookPage, facebookPageToken, validFbProfile, publishAdToFacebook, loadFbGroups, saveFbGroups, fbGroupLinkId, guessGroupName, resolveFbGroupId, extractFbGroupLinks, FB_GROUP_LIMITS, getFbConnection, saveFbConnection, clearFbConnection, effectiveFbToken,
  facebookProfileUsername, facebookPageUsername, fbUserToken, diagnoseFacebook,
  startGroupCampaign, getGroupCampaign, stopGroupCampaign, runGroupCampaignTick, resumeGroupCampaign,
  prepareFbGroupPost, markFbGroupPosted, importMyFbGroups, parseFbGroupsPaste } from
           './_lib/listings.js';
import { stampRemoteImage, migrateImage, detectWatermark } from './_lib/watermark.js';
import { allowCors, isPreflight } from './_lib/cors.js';
import { safeFetch } from './_lib/ssrf.js';

function initAdminDb() {
  try {
    initAdmin();
    return admin.firestore();
  } catch {}
  return null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://carmasr-app.vercel.app';

/* ══════════════════════════════════════════════════════
   1) ماجستير الويب (Messenger Bot) — للتفعيل من فيسبوك
   ══════════════════════════════════════════════════════ */
const VERIFY_TOKEN       = process.env.MESSENGER_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN  = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
const CLOUD_NAME         = process.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET      = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;

async function sendText(senderId, text, tokenOverride) {
  const token = tokenOverride || facebookPageToken();
  if (!token) return false;
  try {
    const r = await fetch(`https://graph.facebook.com/v26.0/me/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderId }, messaging_type: 'RESPONSE', message: { text } }),
    });
    return r.ok;
  } catch { return false; }
}

async function uploadToCloudinary(imageUrl) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) return imageUrl;
  try {
    // روابط lookaside بتاعت الفيسبوك بتدي الصورة لـ Googlebot/bingbot بس — وإلا ترجع صفحة HTML
    const isFbCrawler = /lookaside\.fbsbx\.com\/lookaside\/crawler\//i.test(imageUrl);
    const img = await safeFetch(imageUrl, {
      headers: isFbCrawler ? {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'image/*,*/*;q=0.8',
      } : {},
    });
    const buf = Buffer.from(await img.arrayBuffer());
    const ct = (img.headers.get('content-type') || '').toLowerCase();
    if (!ct || ct.indexOf('image') === -1) return imageUrl;
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'image/jpeg' }), 'ad.jpg');
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', 'tareeq/listings');
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
    const data = await r.json();
    return (data && data.secure_url) || imageUrl;
  } catch { return imageUrl; }
}

async function getSession(db, senderId) {
  const ref = db.collection('botSessions').doc(senderId);
  const snap = await ref.get();
  const session = snap.exists ? snap.data() : { step: 'welcome', data: {}, images: [], createdAt: new Date() };
  session.ref = ref;
  return session;
}

async function saveSession(session) {
  await session.ref.set({ step: session.step, data: session.data || {}, images: session.images || [], updatedAt: new Date() }, { merge: true });
}

function previewText(s) {
  const d = s.data || {};
  return `🖼️ معاينة إعلانك:\n━━━━━━━━━━━━\n🚛 ${d.title || '-'}\n📍 ${d.governorate || '-'}\n💰 ${d.price && d.price !== 0 ? d.price.toLocaleString('ar-EG') + ' جنيه' : '⚠️ السعر = 0 (مطلوب!)'}\n📞 ${d.phone || '-'}\n🖼️ الصور: ${(s.images || []).length}\n━━━━━━━━━━━━\nرد بكلمة "نشر" لتأكيد الإعلان ✍️`;
}

async function handleMessenger(req, res) {
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'];
    // أي طلب تحقق من فيسبوك (أي وضع/توكن) ينجح دائماً — واجهة فيسبوك العربية تختصر المدخلات أحياناً.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(challenge || 'ok');
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const db = getDb();
  const body = req.body || {};
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender && event.sender.id;
      const message = event.message || {};
      if (!senderId || !message) continue;

      const text = (message.text || '').trim();
      const attachments = message.attachments || [];
      const imageAttachments = attachments.filter(a => a.type === 'image' && a.payload && (a.payload.url || a.payload.attachment_id));
      const session = await getSession(db, senderId);

      try {
        if (imageAttachments.length) {
          const urls = [];
          for (const a of imageAttachments) {
            let u = a.payload.url;
            if (!u && a.payload.attachment_id && PAGE_ACCESS_TOKEN) {
              try {
                const r = await fetch(`https://graph.facebook.com/v26.0/${a.payload.attachment_id}?access_token=${PAGE_ACCESS_TOKEN}`, { redirect: 'follow' });
                u = r.url;
              } catch {}
            }
            if (u) urls.push(u);
          }
          if (urls.length) {
            for (const u of urls) session.images.push(u);
            session.images = session.images.slice(0, 10);
            if (session.step === 'images' || session.step === 'welcome') {
              session.step = 'images';
              await saveSession(session);
              const m = `تم استلام ${session.images.length} صور ✅\n${session.images.length >= 10 ? 'وصلنا للحد الأقصى (10 صور). اكتب رقم التليفون أو "نشر".' : 'كمل صور أو اكتب "نشر".'}`;
              await sendText(senderId, m);
              continue;
            }
          }
        }

        const d = session.data || {};
        switch (session.step) {
          case 'welcome':
            session.data = {}; session.images = [];
            session.step = 'title';
            await sendText(senderId, 'أهلاً بك في كار مصر CarMasr 🚛\n\nأعطني تفاصيل عربيتك ونحن ننشر إعلانك مباشرة على الموقع.\n\nأولاً: اكتب اسم/نوع العربية\nمثال: رأس تريلا مرسيدس أكتروس 2018');
            await saveSession(session);
            break;

          case 'title':
            if (text.length < 3) { await sendText(senderId, 'اكتب اسم العربية بشكل أوضح من فضلك'); break; }
            d.title = text;
            session.step = 'governorate';
            await sendText(senderId, `تمام: "${d.title}"\nالمحافظة: اكتبها\nمثال: القاهرة`);
            await saveSession(session);
            break;

          case 'governorate':
            d.governorate = text;
            session.step = 'price';
            await sendText(senderId, 'طيب 📌 السعر: اكتبه بالجنيه\n(لو غير متأكد اكتب 0 وسنأخذه لاحقاً في المعاينة)');
            await saveSession(session);
            break;

          case 'price': {
            const price = parseInt(text.replace(/[^\d]/g, ''), 10);
            if (Number.isNaN(price)) { await sendText(senderId, 'اكتب رقم — مثال: 350000'); break; }
            d.price = price;
            await sendText(senderId, price === 0
              ? '⚠️ السعر = 0 محفوظ مؤقتاً، سنطلب السعر الحقيقي في المعاينة.\n\nرقم التليفون: اكتبه'
              : `السعر ${price.toLocaleString('ar-EG')} جنيه 💰\nرقم التليفون: اكتبه`);
            session.step = 'phone';
            await saveSession(session);
            break;
          }

          case 'phone': {
            const phone = text.replace(/[^\d+]/g, '');
            if (phone.length < 10) { await sendText(senderId, 'اكتب رقم تليفون صحيح (10-14 رقم)'); break; }
            d.phone = phone;
            session.step = 'images';
            await sendText(senderId, '✅ ممتاز\n\n📷 أرسل صور العربية الآن (حتى 10 صور).\nثم اكتب "نشر" للمعاينة');
            await saveSession(session);
            break;
          }

          case 'images':
            if (/نشر|تم|خلاص|انشر/i.test(text)) {
              session.step = 'preview';
              await saveSession(session);
              await sendText(senderId, previewText(session));
            } else if (!/^\d+$/.test(text)) {
              await sendText(senderId, `📷 مستعد للصور (${session.images.length}/10). اكتب "نشر" لمعاينة إعلانك`);
            } else {
              const phone = text.replace(/[^\d+]/g, '');
              if (phone.length >= 10) {
                d.phone = phone;
                session.step = 'preview';
                await saveSession(session);
                await sendText(senderId, '✅ تم تحديث الرقم\n' + previewText(session));
              } else {
                await sendText(senderId, 'الرقم قصير، اكتب رقم تليفون صحيح');
              }
            }
            break;

          case 'preview':
            if (/نشر|تأكيد|تأكيد|نعم|إرسال/i.test(text)) {
              if (d.price === 0) {
                await sendText(senderId, '⚠️ السعر لسه 0 — اكتب السعر الحقيقي علشان ننشر إعلانك:');
                session.step = 'price_fix';
                await saveSession(session);
                break;
              }
              const uploaded = [];
              for (const u of session.images) uploaded.push(await uploadToCloudinary(u));
              const listing = await createListingFromPayload({
                title: d.title,
                price: d.price,
                governorate: d.governorate,
                location: d.location || '',
                images: uploaded,
                contactPhone: d.phone,
                userPhone: d.phone,
                userName: d.phone,
                category: 'vehicles',
                listingType: 'sell',
                source: 'messenger',
              });
              await notifyAdminsOfNewListing(listing).catch(() => {});
              await sendText(senderId, `🎉 تم استلام إعلانك!\n\n🔗 الرابط:\n${listing.url}\n\nسيظهر بعد مراجعة سريعة. شكراً لاستخدامك كار مصر CarMasr 🚛`);
              session.step = 'welcome'; session.data = {}; session.images = [];
              await saveSession(session);
            } else if (/إلغاء|cancel/i.test(text)) {
              session.step = 'welcome'; session.data = {}; session.images = [];
              await saveSession(session);
              await sendText(senderId, 'تم الإلغاء — اكتب "مرحبا" لبدء إعلان جديد 😊');
            } else {
              await sendText(senderId, 'رد بكلمة "نشر" لتأكيد الإعلان، أو "إلغاء" للمراجعة');
            }
            break;

          case 'price_fix': {
            const price = parseInt(text.replace(/[^\d]/g, ''), 10);
            if (Number.isNaN(price) || price === 0) { await sendText(senderId, 'اكتب السعر الحقيقي بالأرقام'); break; }
            d.price = price;
            session.step = 'preview';
            await saveSession(session);
            await sendText(senderId, `✅ السعر أصبح ${price.toLocaleString('ar-EG')} جنيه\n` + previewText(session));
            break;
          }

          default:
            session.step = 'welcome'; session.data = {}; session.images = [];
            await saveSession(session);
            await sendText(senderId, 'اكتب "مرحبا" لبدء إعلان جديد 😊');
        }
      } catch {
        await sendText(senderId, 'حصل خطأ — حاول مرة أخرى 🙏');
        session.ref.set({ step: 'welcome', data: {}, images: [], updatedAt: new Date() }, { merge: true }).catch(() => {});
      }
    }
  }
  return res.status(200).json({ success: true });
}

/* ══════════════════════════════════════════════════════
   2) استقبال إعلان من النموذج/الواتساب (send-ad)
   ══════════════════════════════════════════════════════ */

// حفظ/تحديث عنوان مسحوب من رابط في الحافظة (reference) — تُعرض في الكنترول بانل
async function savedTitlesCollection(req, body) {
  const db = initAdminDb();
  if (!db) return false;
  if (!body || !body.url) return true; // بدون بيانات لا يلزم حفظ
  const url = String(body.url).trim().slice(0, 500);
  const title = String(body.title || '').trim().slice(0, 200);
  const description = String(body.description || '').trim().slice(0, 4000);
  const images = Array.isArray(body.images) ? body.images.slice(0, 8) : [];
  if (!title && !description) return true;
  const ref = db.collection('saved_titles').doc(Buffer.from(url).toString('base64url').slice(0, 128));
  const existing = await ref.get();
  const payload = {
    url,
    title,
    description,
    images,
    pulledAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (existing.exists) {
    await ref.update({ ...payload, pulledCount: admin.firestore.FieldValue.increment(1) });
  } else {
    await ref.set({ ...payload, pulledCount: 1 });
  }
  return true;
}

async function handleSendAd(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const body = req.body || {};

  // ── جلب معاينة من رابط (فيسبوك/واتساب) أو نص مُلصق يحوي روابط صور ──
  if (body.action === 'preview') {
    const url = String(body.url || '').trim();
    const rawText = String(body.text || '').trim();
    let data = null;
    if (rawText) {
      const imgLinks = rawText.match(/https?:\/\/\S+\.(?:jpe?g|png|webp|gif)(?:\?[^\s"']*)?/gi) || [];
      data = {
        ok: true,
        title: rawText.split('\n')[0].slice(0, 60),
        description: rawText.slice(0, 4000),
        images: [...new Set(imgLinks)].slice(0, 20),
      };
    } else if (url && /^https?:\/\//i.test(url)) {
      data = await scrapeLinkPreview(url);
    } else {
      return res.status(400).json({ success: false, error: 'رابط أو نص غير صحيح' });
    }
    // إعادة استضافة الصور على Cloudinary حتى تظهر للمستخدم وتُرسل كروابط مستقرة
    if (data.ok && Array.isArray(data.images) && data.images.length) {
      const hosted = [];
      for (const img of data.images.slice(0, 8)) {
        hosted.push(await uploadToCloudinary(img).catch(() => img));
      }
      data.images = hosted;
    }
    // حفظ العنوان المسحوب تلقائياً في الحافظة (مرجع للأدمن في الكنترول بانل)
    if (data.ok && url && data.title) {
      try {
        savedTitlesCollection(null, { url, title: String(data.title || '').slice(0, 200), description: String(data.description || '').slice(0, 4000), images: Array.isArray(data.images) ? data.images.slice(0, 8) : [] });
      } catch { /* فشل الحفظ لا يوقف السحب */ }
    }
    return res.status(200).json({ success: data.ok, ...data });
  }

  // ── ختم الصور بالسيرفر (sharp + خط عربي) — بيشتغل من غير CORS ولا canvas ──
  if (body.action === 'watermark') {
    const phone = String(body.phone || '').trim();
    const urls = Array.isArray(body.images) ? body.images : [];
    const out = await Promise.all(
      urls.slice(0, 8).map((u) => stampRemoteImage(String(u || '').trim(), phone)),
    );
    return res.status(200).json({ success: true, images: out });
  }

  // ── فحص عيّنة للتحقق من حالة الصور (من غير تعديل) ──
  if (body.action === 'wm-status') {
    const db = getDb();
    const sample = Math.min(Math.max(Number(body.sample) || 12, 1), 40);
    const snap = await db.collection('listings').orderBy('createdAt', 'desc').limit(sample).get();
    const counts = { new: 0, old: 0, plain: 0, fail: 0, totalImgs: 0 };
    const samples = [];
for (const doc of snap.docs) {
      const img = ((doc.data().images || [])[0]);
      if (!img) continue;
      counts.totalImgs++;
      try {
        const u = String(img).trim();
        if (/\/tareeq\/wm2\//i.test(u)) { counts.new++; if (samples.length < 3) samples.push({ id: doc.id, url: u.slice(0, 110), det: 'wm2' }); continue; }
        const res = await safeFetch(u, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', Accept: 'image/*,*/*;q=0.8' } });
        if (!res.ok) { counts.fail++; continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const det = await detectWatermark(buf);
        if (det.watermarked && det.isNew) counts.new++;
        else if (det.watermarked) counts.old++;
        else counts.plain++;
        if (samples.length < 3) samples.push({ id: doc.id, url: u.slice(0, 110), det });
      } catch { counts.fail++; }
    }
    const stateDoc = await db.collection('migrationState').doc('watermark-migrate-v1').get();
    return res.status(200).json({ success: true, counts, state: stateDoc.exists ? stateDoc.data() : null, samples });
  }

  // ── ميجريشن: إعادة ختم صور الإعلانات القديمة بالتصميم الجديد (دفعات + مؤشر تقدم) ──
  if (body.action === 'watermark-migrate') {
    const db = getDb();
    const STATE_COLL = 'migrationState';
    const stateRef = db.collection(STATE_COLL).doc('watermark-migrate-v1');
    const chunk = Math.min(Math.max(Number(body.chunk) || 5, 1), 20);
    const force = !!body.force;

    const stateDoc = await stateRef.get();
    const state = stateDoc.exists ? (stateDoc.data() || {}) : { done: false };

    if (body.reset) {
      await stateRef.set({ done: false, reset: true, at: admin.firestore.FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true, reset: true });
    }

    if (state.done) return res.status(200).json({ success: true, done: true, processed: state.processed || 0, upgraded: state.upgraded || 0 });

    let q = db.collection('listings').orderBy('createdAt', 'asc').limit(chunk);
    if (state.lastCreatedAt) {
      const ts = admin.firestore.Timestamp.fromDate(new Date(state.lastCreatedAt));
      q = q.startAfter(ts);
    }
    const snap = await q.get();
    if (snap.empty) {
      await stateRef.set({ done: true, processed: state.processed || 0, upgraded: state.upgraded || 0, at: admin.firestore.FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true, done: true, processed: state.processed || 0, upgraded: state.upgraded || 0 });
    }

    let upgraded = 0;
    let cursors = [];
    const processListing = async (doc) => {
      const data = doc.data();
      const phone = String(data.contactPhone || data.userPhone || '').replace(/[^\d+]/g, '');
      const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
      let changed = false;
      const updated = [];
      for (const img of images) {
        const r = await migrateImage(String(img || '').trim(), phone, { force });
        updated.push(r.url);
        if (r.upgraded) changed = true;
      }
      let patchImages = null;
      if (changed) patchImages = updated;
      if (typeof data.image === 'string') {
        const r = await migrateImage(String(data.image).trim(), phone, { force });
        if (r.upgraded) {
          patchImages = patchImages || updated;
          const imgIdx = updated.indexOf(data.image);
          if (imgIdx >= 0) updated[imgIdx] = r.url;
          await db.collection('listings').doc(doc.id).update({ image: r.url });
          changed = true;
        }
      }
      if (patchImages && changed) {
        await db.collection('listings').doc(doc.id).update({ images: patchImages, wmMigratedAt: admin.firestore.FieldValue.serverTimestamp() });
        return 1;
      }
      return 0;
    };
    const PAR = 3;
    const results = [];
    for (let i = 0; i < snap.docs.length; i += PAR) {
      const slice = await Promise.all(snap.docs.slice(i, i + PAR).map((d) => processListing(d).catch((e) => { console.error('wm-migrate listing error:', String(e && e.message || e).slice(0, 160)); return 0; })));
      results.push(...slice);
    }
    upgraded = results.reduce((a, b) => a + b, 0);

    const last = snap.docs[snap.docs.length - 1];
    const lastCreatedAt = last.createTime ? new Date(last.createTime.toDate()).toISOString() : null;
    const nextState = { lastCreatedAt, processed: (state.processed || 0) + snap.size, upgraded: (state.upgraded || 0) + upgraded, at: admin.firestore.FieldValue.serverTimestamp() };
    await stateRef.set(nextState);

    return res.status(200).json({ success: true, done: false, processed: nextState.processed, upgraded: nextState.upgraded, chunk: snap.size });
  }

  const title = String(body.title || '').trim();
  const phone = String(body.phone || '').trim();
  const governorate = String(body.governorate || '').trim();

  if (!title) return res.status(400).json({ success: false, message: 'اسم الإعلان مطلوب' });
  if (!phone) return res.status(400).json({ success: false, message: 'رقم التليفون مطلوب' });
  if (!governorate) return res.status(400).json({ success: false, message: 'المحافظة مطلوبة' });

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, message: 'السعر غير صحيح' });
  // السعر 0 مسموح به: معناه "السعر عند المعاينة/حسب التفاوض"

  try {
    // رفع صور الرابط الخارجية (من فيسبوك/مواقع) إلى Cloudinary حتى لا تختفي
    const remoteImages = Array.isArray(body.images) ? body.images : [];
    const uploaded = [];
    for (const u of remoteImages) {
      const s = String(u || '').trim();
      if (!s) continue;
      if (/res\.cloudinary\.com/i.test(s)) { uploaded.push(s); continue; }
      uploaded.push(await uploadToCloudinary(s).catch(() => s));
    }
    const isAdmin = !!(await verifyAdmin(req).catch(() => null));
    const directActive = body.status === 'active';
    if (directActive && !isAdmin) return res.status(403).json({ success: false, message: 'ممنوع — النشر المباشر للأدمن فقط' });

    const listing = await createListingFromPayload({
      title,
      description: body.description,
      price,
      category: body.category || 'vehicles',
      subcategory: body.subcategory,
      listingType: body.listingType || 'sell',
      governorate,
      location: body.location,
      images: uploaded,
      userName: body.userName,
      userPhone: phone,
      contactPhone: phone,
      brand: body.brand,
      model: body.model,
      year: body.year,
      condition: body.condition,
      facebook: validFbProfile(body.facebook) || undefined,
      advertiserName: body.advertiserName,
      source: 'send-ad',
    }, directActive ? { status: 'active' } : {});
    const notify = await notifyAdminsOfNewListing(listing).catch(() => ({}));
    // زر إرسال "عملنا لك إعلان مجاني" — للأدمن فقط (التحقق من التوكن)
    const message = freeAdMessage(listing.url);
    const waLink = whatsappLink(phone, message);
    const fbProfile = validFbProfile(body.facebook);
    const msLink = advertiserMessengerLink(fbProfile, '', message);
    return res.status(200).json({
      success: true,
      message: directActive ? 'تم نشر إعلانك مباشرة ✅' : 'تم استلام إعلانك وسيظهر بعد مراجعة الأدمن',
      listing: { id: listing.id, url: listing.url, title: listing.title, price: listing.price, status: listing.status },
      contact: isAdmin ? { message, waLink, msLink } : null,
      notify,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: String((e && e.message) || e) });
  }
}

/* ══════════════════════════════════════════════════════
   3) الإشعارات (الأدمن + واتساب CallMeBot) — الحالي
   ══════════════════════════════════════════════════════ */
function fmtPhone(p) {
  if (!p) return '-';
  return String(p).replace(/^0/, '+2');
}

/**
 * يحوّل أي رابط (كامل أو نسبي) لمسار داخلي في التطبيق.
 * الإشعار لازم يفتح صفحة الإعلان نفسها — مش لوحة التحكم.
 */
function toAppPath(raw, fallback = '/admin') {
  const s = String(raw || '').trim();
  if (!s) return fallback;
  if (s.startsWith('/')) return s;
  if (s.startsWith('//')) return fallback;
  try {
    const u = new URL(s);
    const p = (u.pathname || '') + (u.search || '');
    return p && p !== '/' ? p : fallback;
  } catch {
    return fallback;
  }
}

/** يستخرج رقم الإعلان من مسار زي /listing/<id>/<slug> */
function listingIdFromPath(path) {
  const m = String(path || '').match(/^\/listing\/([^/?#]+)/);
  return m ? m[1] : null;
}

async function handleNotify(req, res) {
  const { event, data } = req.body || {};
  if (!event) return res.status(400).json({ success: false, message: 'event مطلوب' });

  const db = initAdminDb();
  if (db) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول' });
    try {
      await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      return res.status(401).json({ success: false, message: 'توكن غير صالح' });
    }
  }

  let pushTitle = 'كار مصر CarMasr';
  let pushBody = '';
  let waText = '';
  /** الوجهة اللي هتفتح لما الأدمن يدوس على الإشعار */
  let targetUrl = '/admin';

  if (event === 'ad') {
    const typeLabel = data?.type || '';
    const title = data?.title || '';
    targetUrl = toAppPath(data?.link || data?.url, '/admin');
    pushTitle = '📢 إعلان جديد على كار مصر';
    pushBody = `${data?.userName || '-'} • ${typeLabel}${title ? ': ' + title : ''}`;
    waText = `📢 إعلان جديد على كار مصر\n👤 ${data?.userName || '-'}\n📞 ${fmtPhone(data?.phone)}\n`
      + (typeLabel ? `📋 ${typeLabel}${title ? `: ${title}` : ''}\n` : '')
      + (data?.governorate ? `📍 ${data.governorate}\n` : '')
      + (data?.price ? `💰 ${data.price}\n` : '')
      + (data?.link ? `🔗 ${data.link}` : '');
  } else if (event === 'new-user') {
    pushTitle = '👤 عميل جديد سجّل';
    pushBody = `${data?.name || '-'} • ${fmtPhone(data?.phone)}`;
    waText = `👤 عميل جديد سجّل على كار مصر\n`
      + `الاسم: ${data?.name || '-'}\n`
      + `التليفون: ${fmtPhone(data?.phone)}\n`
      + `النوع: ${data?.type || '-'}\n`
      + (data?.governorate ? `المحافظة: ${data.governorate}` : '');
  } else if (event === 'load') {
    const title = data?.title || '';
    targetUrl = toAppPath(data?.link, '/loads');
    pushTitle = '🚛 حمولة جديدة على كار مصر';
    pushBody = `${data?.userName || '-'}${title ? ' • ' + title : ''}`;
    waText = `🚛 حمولة جديدة على كار مصر\n👤 ${data?.userName || '-'}\n📞 ${fmtPhone(data?.phone)}\n`
      + (title ? `📦 ${title}\n` : '')
      + (data?.governorate ? `📍 ${data.governorate}\n` : '')
      + (data?.price ? `💰 ${data.price}\n` : '')
      + (data?.link ? `🔗 ${data.link}` : '');
  } else {
    return res.status(400).json({ success: false, message: 'event غير معروف' });
  }

  let pushSent = 0, notified = 0;
  const pushErrors = [];
  if (db) {
    try {
      const adminSnap = await db.collection('users').where('type', '==', 'admin').get();
      const seenTokens = new Set();
      for (const doc of adminSnap.docs) {
        const uid = doc.id;
        const tokens = await db.collection('deviceTokens').where('userId', '==', uid).get();
        for (const t of tokens.docs) {
          const token = t.data().token;
          if (!token || seenTokens.has(token)) continue;
          seenTokens.add(token);
          try {
            await admin.messaging().send({
              token,
              notification: { title: pushTitle, body: pushBody },
              android: { priority: 'high', notification: { title: pushTitle, body: pushBody, icon: 'ic_stat_icon', color: '#FF8A1A' } },
              data: { url: targetUrl },
            });
            pushSent += 1;
          } catch (e) { pushErrors.push(String((e && e.message) || e)); }
        }
        await db.collection('notifications').add({
          userId: uid, type: 'system', title: pushTitle, body: pushBody, read: false,
          listingId: listingIdFromPath(targetUrl), url: targetUrl,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
        notified += 1;
      }
    } catch (err) { pushErrors.push('loop: ' + String((err && err.message) || err)); }
  }

  const callmeKey = process.env.WHATSAPP_CALLMEBOT_KEY;
  const to = process.env.WHATSAPP_TO || '201018870145';
  let waSent = false, waError = null;
  if (callmeKey) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(to)}&text=${encodeURIComponent(waText)}&apikey=${encodeURIComponent(callmeKey)}`;
      const r = await fetch(url, { method: 'GET' });
      const text = (await r.text()).trim() || '';
      waSent = /Message Sent|sent/i.test(text);
      if (!waSent) waError = text.slice(0, 200) || `HTTP ${r.status}`;
    } catch (err) { waError = String((err && err.message) || err); }
  }

  return res.status(200).json({ success: true, pushSent, inAppNotified: notified, waConfigured: !!callmeKey, waSent, waError, pushErrors });
}

/* ══════════════════════════════════════════════════════
   4) تواصل الأدمن مع المعلن بعد الموافقة — واتساب + ماسنجر
   ══════════════════════════════════════════════════════ */
async function handleContactAdvertiser(req, res) {
  const { listingId, facebook, phone, name, save, message: customMessage } = req.body || {};
  if (!listingId) return res.status(400).json({ success: false, message: 'listingId مطلوب' });

  // للأدمن فقط
  const adminDecoded = await verifyAdmin(req);
  if (!adminDecoded) return res.status(401).json({ success: false, message: 'غير مصرح' });

  try {
    const db = getDb();
    const doc = await db.collection('listings').doc(listingId).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'إعلان غير موجود' });

    const l = doc.data();
    const listing = { id: doc.id, ...l };
    listing.url = listingUrl(listing.slug, doc.id);

    // تنظيف اللينك من الرموز التالفة/الأنترول
    const cleanFb = (v) => String(v || '').replace(/[\uFFFD\u0000-\u001F\u200B-\u200F]/g, '').trim();

    // بيانات المعلن: القيم المرسلة من الأدمن لها الأولوية، وإلا فالبيانات المخزنة
    const fb = (facebook !== undefined ? cleanFb(facebook) : listing.facebook) || '';
    const ph = (phone !== undefined ? cleanStr(phone) : (listing.contactPhone || listing.userPhone || '')) || '';
    const givenName = name !== undefined ? cleanStr(name) : '';

    // حفظ بيانات المعلن على الإعلان نفسه (لينك الفيس + الهاتف + الاسم)
    if (save) {
      const patch = {};
      if (facebook !== undefined) patch.facebook = String(facebook).trim();
      if (phone !== undefined) patch.contactPhone = String(phone).trim();
      if (name !== undefined) patch.advertiserName = String(name).trim();
      if (Object.keys(patch).length) {
        await db.collection('listings').doc(listingId).update(patch).catch(() => {});
        Object.assign(listing, patch);
      }
    }

    const contactListing = { ...listing, facebook: fb, contactPhone: ph, advertiserName: givenName || listing.advertiserName };
    const custom = cleanMsg(customMessage || '').slice(0, 800);
    const message = custom || contactAdvertiserMessage(contactListing, listing.url);
    const waLink = whatsappLink(ph, message);
    // بدون fallback لصفحة كار مصر نفسها — لو مفيش حساب صحيح للمعلن الرابط null والزرار يُعطَّل
    const msLink = advertiserMessengerLink(fb, '', message);

    return res.status(200).json({
      success: true,
      advertiser: {
        name: advertiserName(contactListing) || listing.userName || '',
        phone: ph,
        facebook: fb,
        message,
        waLink,
        msLink,
        needPhone: !waLink,
        needMessenger: !msLink,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر: ' + String((e && e.message) || e) });
  }
}

/* ══════════════════════════════════════════════════════
   5) نشر إعلان على صفحة فيسبوك (بعد الموافقة من الأدمن)
   ══════════════════════════════════════════════════════ */
async function handlePostListingToPage(req, res) {
  const { listingId, force } = req.body || {};
  if (!listingId) return res.status(400).json({ success: false, message: 'listingId مطلوب' });

  const adminDecoded = await verifyAdmin(req);
  if (!adminDecoded) return res.status(401).json({ success: false, message: 'غير مصرح' });

  try {
    const db = getDb();
    const doc = await db.collection('listings').doc(listingId).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'إعلان غير موجود' });

    const l = doc.data();
    const listing = { id: doc.id, ...l };

    // ممنوع التكرار تلقائيًا — لو منشور قبل كده لازم force صريحة من الأدمن
    if (l.fbPostedAt && !force) {
      return res.status(200).json({ success: true, alreadyPosted: true, postId: l.fbPostId || null });
    }

    const result = await postListingToFacebookPage(listing, await effectiveFbToken(db));
    if (!result.ok) {
      return res.status(200).json({ success: false, message: result.error });
    }

    await db.collection('listings').doc(listingId).update({
      fbPostId: result.postId,
      fbPostedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'الإعلان اتنشر على صفحة فيسبوك ✓',
      postId: result.postId,
      images: result.images || 0,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر: ' + String((e && e.message) || e) });
  }
}

/* ══════════════════════════════════════════════════════
   5.1) النشر الموحّد (الصفحة + الجروبات + إشعار المعلن) — أداة النشر بالضغطة الواحدة
   ══════════════════════════════════════════════════════ */
async function handlePublishAd(req, res) {
  const { listingId, force, groupIds } = req.body || {};
  if (!listingId) return res.status(400).json({ success: false, message: 'listingId مطلوب' });

  const adminDecoded = await verifyAdmin(req);
  if (!adminDecoded) return res.status(401).json({ success: false, message: 'غير مصرح' });

  try {
    const db = getDb();
    const doc = await db.collection('listings').doc(listingId).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'إعلان غير موجود' });

    const l = doc.data();
    const listing = { id: doc.id, ...l };
    listing.url = listingUrl(listing.slug, doc.id);

    const result = await publishAdToFacebook(listing, { force: !!force, groupIds });

    // حفظ بيانات النشر على الصفحة عند نجاحه (لتفادي التكرار بعد كده)
    if (result.page && result.page.ok && !result.page.alreadyPosted && result.page.postId) {
      await db.collection('listings').doc(listingId).update({
        fbPostId: result.page.postId,
        fbPostedAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      listing: { id: doc.id, url: listing.url, title: listing.title },
      page: result.page,
      groups: result.groups,
      contact: result.contact,
      source: result.source || 'page',
      sourceUsername: result.sourceUsername || null,
      sourceUrl: result.sourceUrl || null,
      reasons: result.reasons || [],
      error: result.error || null,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر: ' + String((e && e.message) || e) });
  }
}

/* ══════════════════════════════════════════════════════
   5.1-b) ربط فيسبوك من الموقع (بدون Explorer): الحالة + حفظ التوكن + حذف الربط
   ══════════════════════════════════════════════════════ */
async function handleFbConnect(req, res) {
  const adminDecoded = await verifyAdmin(req);
  if (!adminDecoded) return res.status(401).json({ success: false, message: 'غير مصرح' });

  const sub = String(req.body?.sub || 'status');
  const db = getDb();

  try {
    if (sub === 'status') {
      const conn = await getFbConnection(db);
      const envTok = facebookPageToken();
      return res.status(200).json({
        success: true,
        connected: !!(conn && conn.accessToken && !/^#/.test(conn.accessToken)),
        fbPageId: conn?.fbPageId || '',
        fbPageName: conn?.fbPageName || '',
        tokenType: conn?.tokenType || '',
        connectedAt: conn?.connectedAt || null,
        envTokenExists: !!envTok,
        oauthReady: !!process.env.FB_APP_SECRET,
      });
    }

    if (sub === 'diag') {
      return res.status(200).json({ success: true, diag: await diagnoseFacebook(db) });
    }

    if (sub === 'save-token') {
      const { accessToken, fbPageId, fbPageName } = req.body || {};
      const token = String(accessToken || '').trim();
      if (!token || token.length < 50) return res.status(200).json({ success: false, message: 'التوكن قصير جدًا / فاضي — انسخ التوكن الكامل من فيسبوك' });

      // تحقق أن التوكن مفعّل وأنه Page token مش User token
      let debugData;
      try {
        const dr = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`);
        debugData = (await dr.json())?.data;
      } catch {}
      if (!debugData || debugData.is_valid === false) {
        return res.status(200).json({ success: false, message: 'التوكن مش مفعّل في فيسبوك — جدّده من Graph API Explorer' });
      }
      // بنقبل توكن حساب شخصي (user) أو توكن صفحة (page) — الحساب الشخصي هو الأفضل للنشر في الجروبات
      const isUserToken = debugData.type === 'USER';

      // تأكد من أسماء الصلاحيات (publish_pages)
      const scopes = Array.isArray(debugData.scopes) ? debugData.scopes : [];
      const granular = Array.isArray(debugData.granular_scopes) ? debugData.granular_scopes : [];
      const allScopes = [...scopes, ...granular.flatMap((g) => Array.isArray(g?.scopes) ? g.scopes : [])];
      if (!allScopes.some((s) => {
        const v = String(s).toLowerCase();
        return v.includes('pages_manage_posts') || v.includes('publish_pages') || v.includes('publish_to_groups');
      })) {
        return res.status(200).json({ success: false, message: 'التوكن ناقصه صلاحية النشر — من Graph Explorer اختار publish_to_groups (للنشر في الجروبات) أو pages_manage_posts (للصفحة) وولّده تاني' });
      }

      // تأكد أن المعرّف فعلاً صفحة (لو fbPageId مرسل، اقارنه بـ me)
      let confirmedPageId = String(fbPageId || '');
      let confirmedPageName = String(fbPageName || '');
      if (!confirmedPageId) {
        try {
          const mr = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
          const md = await mr.json();
          if (md?.id) confirmedPageId = String(md.id);
          if (md?.name) confirmedPageName = String(md.name);
        } catch {}
      }

      await saveFbConnection(db, { accessToken: token, fbPageId: confirmedPageId, fbPageName: confirmedPageName, tokenType: isUserToken ? 'user' : 'page' });
      return res.status(200).json({
        success: true,
        message: isUserToken
          ? `تم ربط حسابك «${confirmedPageName || confirmedPageId}» بنجاح ✓`
          : `تم ربط الصفحة «${confirmedPageName || confirmedPageId}» بنجاح ✓`,
        fbPageId: confirmedPageId,
        fbPageName: confirmedPageName,
        tokenType: isUserToken ? 'user' : 'page',
      });
    }

    if (sub === 'disconnect') {
      await clearFbConnection(db);
      return res.status(200).json({ success: true, message: 'تم فصل الربط — هيرجع يستخدم التوكن القديم من إعدادات Vercel' });
    }

    return res.status(400).json({ success: false, message: 'sub غير معروف' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر: ' + String((e && e.message) || e) });
  }
}

/* ══════════════════════════════════════════════════════
   5.1-b2) اختبار توكن فيسبوك يدويًا
   ══════════════════════════════════════════════════════ */
async function handleFbTestToken(req, res) {
  const token = String(req.body?.token || req.query?.token || '').trim();
  if (!token) return res.status(400).json({ success: false, message: 'الصق التوكن الأول' });

  const result = { valid: false, type: '', pageId: '', pageName: '', scopes: [], error: '' };

  try {
    const dr = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`);
    const dd = (await dr.json().catch(() => ({})))?.data || {};
    result.valid = !!dd.is_valid;
    result.type = dd.type || '';
    result.scopes = [...(dd.scopes || []), ...(dd.granular_scopes || []).flatMap(g => g?.scopes || [])];
    if (!dd.is_valid) { result.error = dd.error?.message || 'invalid token'; return res.status(200).json(result); }

    const mr = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
    const md = await mr.json().catch(() => ({}));
    result.pageId = md?.id || '';
    result.pageName = md?.name || '';

    if (dd.type === 'USER' || !result.pageId) {
      const pr = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(token)}`);
      const pd = await pr.json().catch(() => ({}));
      result.pages = (pd?.data || []).map(p => ({ id: p.id, name: p.name, hasToken: !!p.access_token }));
    }
  } catch (e) {
    result.error = String(e?.message || e);
  }

  return res.status(200).json(result);
}

/* ══════════════════════════════════════════════════════
   5.1-c) ربط فيسبوك بالطريقة النهائية: redirect سيرفر-سايد
   — GET fb-connect: يحوّل المتصفح لفيسبوك (باب العودة على / = اللي مضاف في Redirect URIs)
   — POST fb-callback: الصفحة الرئيسية بتلقط code وتبعته هنا للاستبدال + تمديد + حفظ توكن الصفحة
   ══════════════════════════════════════════════════════ */
async function handleFbConnectRedirect(req, res) {
  const FB_APP_ID = process.env.FB_APP_ID || '1054431216953800';
  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: `${SITE_URL}/`,
    scope: 'public_profile,publish_to_groups',
    state: Math.random().toString(36).slice(2) + Date.now().toString(36),
    response_type: 'code',
  });
  try {
    res.redirect('https://www.facebook.com/v21.0/dialog/oauth?' + params.toString());
  } catch {
    res.status(500).json({ success: false, message: 'فشل التحويل لفيسبوك' });
  }
}

async function handleFbCallback(req, res) {
  const code = String(req.body?.code || '').trim();
  if (!code) return res.status(400).json({ success: false, message: 'مفيش code من فيسبوك' });

  const FB_APP_ID = process.env.FB_APP_ID || '1054431216953800';
  const FB_APP_SECRET = process.env.FB_APP_SECRET || '';
  if (!FB_APP_SECRET) return res.status(500).json({ success: false, message: 'مفيش FB_APP_SECRET في إعدادات Vercel' });

  try {
    const db = getDb();

    // 1) استبدال code بتوكن مستخدم قصير
    const tok = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&redirect_uri=${encodeURIComponent(`${SITE_URL}/`)}&code=${encodeURIComponent(code)}`);
    const tokData = await tok.json().catch(() => ({}));
    const userToken = tokData?.access_token;
    if (!userToken) {
      return res.status(200).json({ success: false, message: `فيسبوك رفض استبدال الكود: ${String(tokData?.error?.message || tokData?.error?.code || 'خطأ')}` });
    }

    // 2) تمديد التوكن لـ 60 يومًا
    let ltToken = userToken;
    try {
      const ext = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(userToken)}`);
      const extd = await ext.json().catch(() => ({}));
      if (extd?.access_token) ltToken = extd.access_token;
    } catch {}

    // 3) قائمة الصفحات اللي على الحساب
    const pagesResp = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(ltToken)}`);
    const pagesData = await pagesResp.json().catch(() => ({}));
    const pages = pagesData?.data || [];
    if (!pages.length) {
      return res.status(200).json({ success: false, message: 'مفيش صفحات بإدارة على الحساب ده — اتأكد إن الحساب Admin على صفحة TareeqEG' });
    }

    // 4) اختيار صفحة تريق/كار مصر (أو الأولى)
    const match = pages.find(p => /تريق|كار مصر|tareeq/i.test(String(p.name || ''))) || pages[0];
    const pageToken = String(match?.access_token || '');
    if (!pageToken) {
      return res.status(200).json({ success: false, message: 'تعذّر جلب توكن الصفحة من فيسبوك' });
    }

    await saveFbConnection(db, {
      accessToken: pageToken,
      fbPageId: String(match.id || ''),
      fbPageName: String(match.name || ''),
    });

    return res.status(200).json({
      success: true,
      message: `تم ربط صفحة «${String(match.name || '')}» للنشر ✓`,
      fbPageId: String(match.id || ''),
      fbPageName: String(match.name || ''),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر: ' + String((e && e.message) || e) });
  }
}

/* ══════════════════════════════════════════════════════
   5.2) إدارة جروبات النشر المحفوظة (list / save / delete)
   ══════════════════════════════════════════════════════ */
async function handleFbGroups(req, res) {
  const adminDecoded = await verifyAdmin(req);
  if (!adminDecoded) return res.status(401).json({ success: false, message: 'غير مصرح' });

  const sub = String(req.body?.sub || 'list');
  const db = getDb();

  try {
    if (sub === 'list') {
      const hasUser = !!fbUserToken();
      return res.status(200).json({
        success: true,
        groups: await loadFbGroups(db),
        limits: FB_GROUP_LIMITS,
        source: hasUser ? 'profile' : 'page',
        sourceUsername: hasUser ? facebookProfileUsername() : facebookPageUsername(),
      });
    }

    if (sub === 'save') {
      // دعم اللصق الجماعي: لينك/أكثر، أو سطور "اسم الجروب<TAB>اللينك" من أداة سحب الجروبات
      const rawInputs = Array.isArray(req.body?.urls) ? req.body.urls : (req.body?.url ? [req.body.url] : []);
      const parsed = [];
      const seenLink = new Set();
      for (const r of rawInputs) {
        for (const item of parseFbGroupsPaste(String(r || ''))) {
          if (!seenLink.has(item.url)) { seenLink.add(item.url); parsed.push(item); }
        }
      }
      if (!parsed.length) {
        return res.status(200).json({ success: false, message: 'مفيش لينك جروب فيسبوك اتلقط — الصق لينك جروب أو أكثر (سطر لكل جروب)' });
      }
      if (parsed.length > 2000) {
        return res.status(200).json({ success: false, message: `العدد كبير (${parsed.length}) — الصق لحد 2000 جروب في المرة` });
      }

      const token = facebookPageToken();
      const groups = await loadFbGroups(db);
      const added = [], skipped = [], failed = [];
      let renamed = 0;
      for (const item of parsed) {
        const link = item.url;
        let id = fbGroupLinkId(link);
        if (!id && token) id = await resolveFbGroupId(link, token);
        if (!id) { failed.push(link); continue; }
        const existing = groups.find(g => String(g.id) === id);
        if (existing) {
          const curName = String(existing.name || '');
          if (item.name && item.name !== curName && (!curName || curName === id || /^\d+$/.test(curName))) {
            existing.name = item.name;
            renamed++;
          }
          skipped.push(link);
          continue;
        }
        groups.push({ id, url: link, name: item.name || guessGroupName(link) || id, enabled: true, createdAt: Date.now() });
        added.push(link);
      }
      await saveFbGroups(db, groups);

      const bits = [];
      if (added.length) bits.push(`اتضاف ${added.length} جروب ✓`);
      if (renamed) bits.push(`اسم اتظبط لـ ${renamed}`);
      if (skipped.length) bits.push(`موجود قبل كده: ${skipped.length}`);
      if (failed.length) bits.push(`غير متعرف عليه: ${failed.length}`);
      return res.status(200).json({
        success: true,
        message: bits.length ? bits.join(' — ') : 'مفيش جروبات جديدة — كلها موجودة فعلًا',
        groups, added: added.length, skipped: skipped.length, renamed, failed: failed.length,
      });
    }

    if (sub === 'delete') {
      const id = String(req.body?.id || '');
      const groups = (await loadFbGroups(db)).filter(g => String(g.id) !== id);
      await saveFbGroups(db, groups);
      return res.status(200).json({ success: true, message: 'تم حذف الجروب', groups });
    }

    if (sub === 'tag') {
      const id = String(req.body?.id || '');
      const tag = String(req.body?.tag || '').trim();
      const groups = await loadFbGroups(db);
      const target = groups.find(g => String(g.id) === id);
      if (!target) return res.status(200).json({ success: false, message: 'الجروب مش موجود' });
      target.tag = tag;
      await saveFbGroups(db, groups);
      return res.status(200).json({ success: true, message: tag ? 'تم تحديث التاج ✓' : 'تم إزالة التاج', groups });
    }

    if (sub === 'toggle') {
      const id = String(req.body?.id || '');
      const groups = (await loadFbGroups(db)).map(g => String(g.id) === id ? { ...g, enabled: g.enabled === false } : g);
      const target = groups.find(g => String(g.id) === id);
      if (!target) return res.status(200).json({ success: false, message: 'الجروب مش موجود' });
      await saveFbGroups(db, groups);
      const on = target.enabled !== false;
      return res.status(200).json({ success: true, message: on ? 'الجروب اتفعّل ✓' : 'الجروب اتعطّل — مش هينشر فيه', groups });
    }

    if (sub === 'campaign-status') {
      return res.status(200).json({ success: true, campaign: await getGroupCampaign() });
    }

    if (sub === 'campaign-start') {
      const listingId = String(req.body?.listingId || '');
      const groupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds : null;
      const dailyCap = Number(req.body?.dailyCap) || undefined;
      const r = await startGroupCampaign({ listingId, groupIds, dailyCap });
      if (!r.ok) return res.status(200).json({ success: false, message: r.error });
      return res.status(200).json({ success: true, message: `الطابور بدأ — ${r.campaign.remainingCount} جروب هيتنشروا تلقائيًا على مراحل`, campaign: r.campaign });
    }

    if (sub === 'campaign-stop') {
      return res.status(200).json({ success: true, message: 'تم إيقاف الطابور', campaign: await stopGroupCampaign() });
    }

    if (sub === 'campaign-resume') {
      const campaign = await resumeGroupCampaign();
      if (!campaign) return res.status(200).json({ success: false, message: 'مفيش طابور شغال' });
      return res.status(200).json({ success: true, message: `الطابور استأنف — ${campaign.remainingCount} جروب في الدور`, campaign });
    }

    if (sub === 'campaign-tick') {
      const result = await runGroupCampaignTick();
      return res.status(200).json({ success: true, result, campaign: await getGroupCampaign() });
    }

    if (sub === 'post-text') {
      const r = await prepareFbGroupPost(String(req.body?.listingId || ''));
      return res.status(200).json(r);
    }

    if (sub === 'mark') {
      const r = await markFbGroupPosted(String(req.body?.id || ''));
      return res.status(200).json(r);
    }

    if (sub === 'import-groups') {
      const r = await importMyFbGroups(db, String(req.body?.token || '').trim());
      return res.status(200).json(r);
    }

    return res.status(400).json({ success: false, message: 'إجراء غير معروف' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر: ' + String((e && e.message) || e) });
  }
}

/* ══════════════════════════════════════════════════════
   6) إدارة البوت من لوحة الأدمن (status / sessions / reply / reset)
   ══════════════════════════════════════════════════════ */
async function handleBotAdmin(req, res) {
  const adminDecoded = await verifyAdmin(req);
  if (!adminDecoded) return res.status(401).json({ success: false, message: 'غير مصرح' });

  const sub = String(req.body?.sub || 'status');
  const db = getDb();

  try {
    if (sub === 'status') {
      const token = facebookPageToken();
      let page = null;
      if (token) {
        try {
          const r = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
          const j = await r.json();
          if (j && j.id) page = { id: j.id, name: j.name || '' };
          else if (j && j.error) page = { error: String(j.error.message || j.error.type || 'توكن غير صالح') };
          else page = { error: `HTTP ${r.status}` };
        } catch { page = { error: 'تعذر الاتصال بفيسبوك' }; }
      }

      const sessions = [];
      try {
        const snap = await db.collection('botSessions').orderBy('updatedAt', 'desc').limit(15).get();
        for (const s of snap.docs) {
          const raw = s.data() || {};
          sessions.push({ id: s.id, ...raw, updatedAt: raw.updatedAt ? (raw.updatedAt.toDate ? raw.updatedAt.toDate().toISOString() : raw.updatedAt) : '' });
        }
      } catch {}

      return res.status(200).json({
        success: true,
        bot: {
          webhookUrl: `${SITE_URL}/api/messenger-webhook`,
          verifyTokenSet: !!String(process.env.MESSENGER_VERIFY_TOKEN || '').trim(),
          pageTokenSet: !!token,
          page: page || { error: token ? 'تعذر التحقق' : 'مفيش توكن صفحة فيسبوك (MESSENGER_PAGE_ACCESS_TOKEN أو FB_PAGE_ACCESS_TOKEN) في إعدادات Vercel' },
        },
        sessions,
      });
    }

    if (sub === 'reply') {
      const { senderId, text } = req.body || {};
      const clean = String(text || '').trim();
      if (!senderId || !clean) return res.status(400).json({ success: false, message: 'senderId والنص مطلوبين' });
      const token = facebookPageToken();
      if (!token) return res.status(200).json({ success: false, message: 'مفيش توكن صفحة فيسبوك — جدّده في إعدادات Vercel' });
      const ok = await sendText(String(senderId), clean, token);
      if (!ok) return res.status(200).json({ success: false, message: 'فيسبوك رفض إرسال الرسالة (توكن منتهي أو نافذة الـ 24 ساعة مقفولة)' });
      return res.status(200).json({ success: true, message: 'تم إرسال الرسالة ✓' });
    }

    if (sub === 'reset') {
      const { senderId } = req.body || {};
      if (!senderId) return res.status(400).json({ success: false, message: 'senderId مطلوب' });
      await db.collection('botSessions').doc(String(senderId)).delete().catch(() => {});
      return res.status(200).json({ success: true, message: 'تم مسح جلسة البوت ✓' });
    }

    return res.status(400).json({ success: false, message: 'إجراء غير معروف' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر: ' + String((e && e.message) || e) });
  }
}

/* ══════════════════════════════════════════════════════
   7) استيراد إعلان من بوست فيسبوك (الأدمن): سحب الصور والكلام ثم نشر مباشر
   ══════════════════════════════════════════════════════ */
async function handleImportFbPost(req, res) {
  const adminDecoded = await verifyAdmin(req);
  if (!adminDecoded) return res.status(401).json({ success: false, message: 'غير مصرح' });

  const sub = String(req.body?.sub || '');
  const url = String(req.body?.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, message: 'رابط غير صحيح' });

  try {
    if (sub === 'preview') {
      const data = await scrapeLinkPreview(url);
      if (!data.ok && !(data.images && data.images.length)) {
        return res.status(200).json({ success: false, message: data.error || 'تعذر قراءة البوست (رابط خاص/محذوف أو فيسبوك منع الوصول)' });
      }
      const hosted = [];
      for (const img of (data.images || []).slice(0, 10)) hosted.push(await uploadToCloudinary(img).catch(() => img));
      return res.status(200).json({ success: data.ok, title: data.title || '', description: data.description || '', images: hosted, phone: data.phone || '', author: data.author || '', source: url });
    }

    if (sub === 'publish') {
      const data = await scrapeLinkPreview(url);
      const hosted = [];
      for (const img of (data.images || []).slice(0, 10)) hosted.push(await uploadToCloudinary(img).catch(() => img));

      const b = req.body || {};
      const clean = (v) => String(v === undefined || v === null ? '' : v).trim();
      const title = clean(b.title) || clean(data.title);
      if (!title) return res.status(200).json({ success: false, message: 'مفيش عنوان اتسحب — اكتب العنوان يدويًا' });

      const rawPrice = String(b.price ?? '').trim();
      const price = rawPrice === '' ? 0 : Number(rawPrice);
      const listing = await createListingFromPayload({
        title,
        description: clean(b.description) || clean(data.description),
        price: Number.isFinite(price) ? price : 0,
        category: clean(b.category) || 'vehicles',
        listingType: b.listingType === 'rent' ? 'rent' : 'sell',
        governorate: clean(b.governorate),
        location: clean(b.location),
        images: hosted,
        contactPhone: clean(b.phone) || clean(data.phone),
        userPhone: clean(b.phone) || clean(data.phone),
        userName: clean(b.userName) || 'إدارة الموقع',
        brand: clean(b.brand),
        model: clean(b.model),
        year: clean(b.year) ? Number(clean(b.year)) : undefined,
        condition: clean(b.condition) || undefined,
        facebook: validFbProfile(clean(b.facebook) || clean(data.author)) || undefined,
        source: 'fb-import',
      }, { status: 'active' });

      const out = { id: listing.id, url: listing.url, title: listing.title };
      let fb = null;
      if (b.postToPage !== false) {
        fb = await postListingToFacebookPage(listing).catch(() => ({ ok: false, error: 'خطأ غير متوقع' }));
        if (fb && fb.ok) {
          const db = getDb();
          await db.collection('listings').doc(listing.id).update({ fbPostId: fb.postId, fbPostedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
        }
      }
      return res.status(200).json({ success: true, message: 'الإعلان اتنشر مباشرة ✓', listing: out, fb: fb || null });
    }

    return res.status(400).json({ success: false, message: 'إجراء غير معروف' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر: ' + String((e && e.message) || e) });
  }
}

/* ══════════════════════════════════════════════════════
   Router — حسب action في الـ query
   ══════════════════════════════════════════════════════ */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  allowCors(res);
  if (isPreflight(req)) return res.status(204).end();
  const origin = req.headers.origin;
  const allowedOrigins = ['https://carmasr-app.vercel.app', 'https://www.carmasr-app.vercel.app', 'https://localhost', 'http://localhost', 'capacitor://localhost'];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.removeHeader('Access-Control-Allow-Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-uid');

  if (req.method === 'POST' && !rateLimit(req, res)) return;

  const action = req.query?.action;

  if (action === 'bot') return handleMessenger(req, res);
  if (action === 'send-ad') return handleSendAd(req, res);
  if (action === 'contactAdvertiser') return handleContactAdvertiser(req, res);
  if (action === 'postListingToPage') return handlePostListingToPage(req, res);
  if (action === 'publish-ad') return handlePublishAd(req, res);
  if (action === 'fb-connect') return req.method === 'GET' ? handleFbConnectRedirect(req, res) : handleFbConnect(req, res);
  if (action === 'fb-callback') return handleFbCallback(req, res);
  if (action === 'fb-groups') return handleFbGroups(req, res);
  if (action === 'fb-test-token') return handleFbTestToken(req, res);
  if (action === 'bot-admin') return handleBotAdmin(req, res);
  if (action === 'importFbPost') return handleImportFbPost(req, res);
  return handleNotify(req, res);
}