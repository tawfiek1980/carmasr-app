import admin from 'firebase-admin';
import { initAdmin } from './_lib/db.js';
import { allowCors, isPreflight } from './_lib/cors.js';

// ══════════════════════════════════════════════════════════
//  AI Feedback — تدريب الـ AI من تصحيحات الأدمن
//  ai_feedback: يسجّل قرار الآلة وقرار الأدمن لكل إعلان تم
//  التصحيح عليه، ليتعلم الـ AI من أخطائه (few-shot).
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Custom Claims للمشرفين — مصدر الحقيقة للأدمن في firestore.rules
//  الرقم/الإيميل المُصرّح به مصدره السيرفر (غير قابل للتعديل من العميل).
// ══════════════════════════════════════════════════════════
const ADMIN_EMAILS = ['tawfiek.fayez@gmail.com', 'tawfiek1980@gmail.com'];
const ADMIN_PHONES = ['1018870145', '1277177710'];

function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('0020')) return d.slice(3);
  if (d.startsWith('20') && d.length === 12) return d.slice(2);
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  return d.replace(/^0+/, '');
}

// استرجاع الرقم من إيميل الدخول phone_<digits>@tareeq.app
function phoneFromEmail(email) {
  const m = /^phone_(\d+)@tareeq\.app$/i.exec(String(email || ''));
  return m ? m[1] : '';
}

function isAllowlistedAdmin(decoded, userData) {
  const emails = [decoded.email, userData && userData.email].filter(Boolean).map((e) => String(e).toLowerCase());
  if (emails.some((e) => ADMIN_EMAILS.includes(e))) return true;
  const phones = [
    normPhone(decoded.phone_number || ''),
    normPhone(userData && userData.phone),
    phoneFromEmail(decoded.email),
    phoneFromEmail(userData && userData.email),
  ].filter(Boolean);
  return phones.some((p) => ADMIN_PHONES.includes(p));
}

// مصادقة خفيفة لأي مستخدم مُسجّل (بدون شرط أدمن) — تُستخدم للترقية الذاتية bootstrap
async function verifyAnyUser(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'يجب تسجيل الدخول' });
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    res.status(401).json({ success: false, message: 'يجب تسجيل الدخول' });
    return null;
  }
}

function decisionOfVerdict(verdict) {
  if (verdict === 'approved') return 'approved';
  if (['rejected', 'block'].includes(verdict)) return 'rejected';
  return 'undetermined';
}

async function aiFeedbackRecord(req, res) {
  const { docId, collection = 'listings', decision } = req.body || {};
  if (!docId || !['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'docId و decision مطلوبان (approved|rejected)' });
  }
  const db = admin.firestore();
  const ref = db.collection(collection).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });

  const doc = snap.data();
  const m = doc.aiModeration;
  const verdict = (m && m.verdict) ? decisionOfVerdict(m.verdict) : null;
  if (!verdict) return res.status(200).json({ success: true, recorded: false, message: 'لا توجد مراجعة آلية لتسجيلها' });

  // aiCorrect: null للأحكام المشكوك فيها (undetermined) — لا تحتسب خطأ ولا صواب
  const aiCorrect = verdict === 'undetermined' ? null : verdict === decision;

  const record = {
    kind: collection,
    docId,
    title: String(doc.title || '').slice(0, 120),
    category: doc.category || '',
    governorate: doc.governorate || '',
    adText: String(doc.description || '').slice(0, 400),
    imagesCount: Array.isArray(doc.images) ? doc.images.length : 0,
    aiVerdict: verdict,
    aiScore: Number(m.score) || 0,
    aiReasons: Array.isArray(m.reasons) ? m.reasons.slice(0, 4) : [],
    imageIssues: Array.isArray(m.imageIssues) ? m.imageIssues.slice(0, 3) : [],
    adminDecision: decision,
    aiCorrect,
    recordedBy: (req && req.adminUid) || '',
    tsMs: Date.now(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('ai_feedback').add(record);
  await ref.update({
    status: decision,
    'aiModeration.adminDecision': decision,
    'aiModeration.adminCorrected': aiCorrect,
    'aiModeration.correctedAt': admin.firestore.FieldValue.serverTimestamp(),
  });
  return res.status(200).json({ success: true, recorded: true, aiCorrect });
}

async function aiFeedbackStats(req, res) {
  const db = admin.firestore();
  const snaps = await db.collection('ai_feedback').orderBy('createdAt', 'desc').limit(200).get();
  const items = snaps.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt ? d.data().createdAt.toDate().toISOString() : null }));
  const judged = items.filter((i) => i.aiCorrect === true || i.aiCorrect === false);
  const correct = items.filter((i) => i.aiCorrect === true).length;
  const wrong = items.filter((i) => i.aiCorrect === false).length;
  const byKind = {};
  for (const i of items) byKind[i.kind || 'listings'] = (byKind[i.kind || 'listings'] || 0) + 1;
  const reasonCount = {};
  for (const i of items.filter((x) => x.aiCorrect === false)) {
    for (const r of (i.aiReasons || [])) reasonCount[r] = (reasonCount[r] || 0) + 1;
  }
  return res.status(200).json({
    success: true,
    stats: {
      total: items.length,
      judged: judged.length,
      correct,
      wrong,
      undetermined: items.length - judged.length,
      accuracy: judged.length ? Math.round((correct / judged.length) * 100) : null,
      byKind,
    },
    recent: items.slice(0, 20),
    commonMistakes: Object.entries(reasonCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count })),
  });
}

async function authenticate(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'يجب تسجيل الدخول' });
    return null;
  }
  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userSnap = await admin.firestore().doc(`users/${decodedToken.uid}`).get();
    const userData = userSnap.data();
    // أدمن إذا كان الـclaim موجوداً، أو (مرحلة الانتقال) وثيقة المستخدم type=admin
    const adm = decodedToken.admin === true || (userData && userData.type === 'admin');
    if (!adm) {
      res.status(403).json({ success: false, message: 'غير مصرح' });
      return null;
    }
    return decodedToken;
  } catch {
    res.status(401).json({ success: false, message: 'يجب تسجيل الدخول' });
    return null;
  }
}

const handlers = {
  async 'banner-ads'(req, res) {
    const snaps = await admin.firestore().collection('bannerAds').orderBy('createdAt', 'desc').limit(100).get();
    const bannerAds = snaps.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate()?.toISOString() || null }));
    return res.status(200).json({ success: true, bannerAds });
  },

  async exhibitions(req, res) {
    const snaps = await admin.firestore().collection('exhibitions').orderBy('createdAt', 'desc').limit(100).get();
    const exhibitions = snaps.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate()?.toISOString() || null }));
    return res.status(200).json({ success: true, exhibitions });
  },

  async payments(req, res) {
    const snaps = await admin.firestore().collection('payments').orderBy('createdAt', 'desc').limit(100).get();
    const payments = snaps.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate()?.toISOString() || null }));
    return res.status(200).json({ success: true, payments });
  },

  async stats(req, res) {
    const db = admin.firestore();
    const snapshot = async (col) => {
      try {
        return await db.collection(col).limit(500).get();
      } catch {
        return { size: 0, docs: [] };
      }
    };
    const countBy = (snap, field, val) => snap.docs.filter(d => d.data()[field] === val).length;

    const [users, listings, loads, jobs, finance, payments, exhibitions, bannerAds] = await Promise.all([
      snapshot('users'), snapshot('listings'), snapshot('loads'), snapshot('jobs'),
      snapshot('financeRequests'), snapshot('payments'), snapshot('exhibitions'), snapshot('bannerAds'),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers: users.size,
        totalListings: listings.size,
        activeListings: countBy(listings, 'status', 'active'),
        pendingListings: countBy(listings, 'status', 'pending'),
        featuredListings: countBy(listings, 'featured', true),
        totalLoads: loads.size,
        totalJobs: jobs.size,
        financeRequests: finance.size,
        pendingFinance: countBy(finance, 'status', 'new'),
        pendingPayments: countBy(payments, 'status', 'pending'),
        activeExhibitions: countBy(exhibitions, 'status', 'active'),
        activeBanners: countBy(bannerAds, 'status', 'active'),
      },
    });
  },

  async 'update-doc'(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const { collection: col, docId, data, action } = req.body || {};
    if (!col || !docId) return res.status(400).json({ success: false, message: 'collection, docId مطلوبة' });
    if (action !== 'delete' && !data) return res.status(400).json({ success: false, message: 'data مطلوبة' });

    const allowed = ['exhibitions', 'bannerAds', 'payments', 'listings', 'users'];
    if (!allowed.includes(col)) return res.status(400).json({ success: false, message: 'مجموعة غير مصرح بها' });

    const ref = admin.firestore().collection(col).doc(docId);
    if (action === 'delete') {
      await ref.delete();
      if (col === 'exhibitions') {
        const db = admin.firestore();
        const prodSnap = await db.collection('products').where('exhibitionId', '==', docId).get();
        await Promise.all(prodSnap.docs.map(d => d.ref.delete()));
        const subSnap = await db.collection('exhibitions').doc(docId).collection('products').get();
        await Promise.all(subSnap.docs.map(d => d.ref.delete()));
      }
      return res.status(200).json({ success: true, message: 'تم الحذف' });
    }
    await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.status(200).json({ success: true, message: 'تم التحديث' });
  },

  async 'ai-feedback'(req, res) {
    return aiFeedbackRecord(req, res);
  },

  async 'ai-feedback-stats'(req, res) {
    return aiFeedbackStats(req, res);
  },

  async 'saved-titles'(req, res) {
    const db = admin.firestore();
    const snaps = await db.collection('saved_titles').orderBy('pulledAt', 'desc').limit(200).get();
    const items = snaps.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      pulledAt: d.data().pulledAt ? d.data().pulledAt.toDate().toISOString() : null,
    }));
    return res.status(200).json({ success: true, items });
  },

  async 'delete-saved-title'(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'id مطلوب' });
    await admin.firestore().collection('saved_titles').doc(String(id)).delete();
    return res.status(200).json({ success: true, message: 'تم الحذف من الحافظة' });
  },

  // ── Custom Claims ──────────────────────────────────────────
  // ترقية ذاتية: لو المستخدم الحالي مُصرّح به (إيميل/رقم) → يُمنح claim الأدمن.
  // لا تمنح الصلاحية لأي شخص عشوائي: تعتمد فقط على قائمة السيرفر ومحتوى الإيميل/الرقم الموثّق.
  async 'sync-self'(req, res) {
    const db = admin.firestore();
    const uid = req.decodedUser.uid;
    const snap = await db.doc(`users/${uid}`).get();
    const userData = snap.data() || {};
    const allowed = isAllowlistedAdmin(req.decodedUser, userData);
    const currentClaim = req.decodedUser.admin === true;

    if (allowed) {
      if (!currentClaim) await admin.auth().setCustomUserClaims(uid, { admin: true });
      if (userData.type !== 'admin') await db.doc(`users/${uid}`).set({ type: 'admin' }, { merge: true }).catch(() => {});
      return res.status(200).json({ success: true, admin: true, granted: !currentClaim });
    }
    // إزالة الصلاحية لو كانت مُمنوحة بالخطأ (عكس الترقية)
    if (currentClaim) {
      await admin.auth().setCustomUserClaims(uid, { admin: false });
      if (userData.type === 'admin') await db.doc(`users/${uid}`).set({ type: 'individual' }, { merge: true }).catch(() => {});
      return res.status(200).json({ success: true, admin: false, revoked: true });
    }
    return res.status(200).json({ success: true, admin: false });
  },

  async whoami(req, res) {
    const uid = req.decodedUser.uid;
    const snap = await admin.firestore().doc(`users/${uid}`).get();
    const userData = snap.data() || {};
    return res.status(200).json({ success: true, uid, claimAdmin: req.decodedUser.admin === true, typeAdmin: userData.type === 'admin' });
  },

  // منح/سحب صلاحية أدمن لمستخدم آخر (يتطلب أدمن).
  async 'set-admin-claim'(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const { uid, admin: makeAdmin = true } = req.body || {};
    if (!uid) return res.status(400).json({ success: false, message: 'uid مطلوب' });
    await admin.auth().setCustomUserClaims(uid, { admin: !!makeAdmin });
    await admin.firestore().doc(`users/${uid}`).update({ type: makeAdmin ? 'admin' : 'individual' }).catch(() => {});
    return res.status(200).json({ success: true, uid, admin: !!makeAdmin });
  },

  // ترحيل جماعي: يمنح claim الأدمن لكل مستخدمي type=admin الحاليين.
  async 'sync-admin-claims'(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const db = admin.firestore();
    const snaps = await db.collection('users').where('type', '==', 'admin').get();
    let done = 0;
    for (const d of snaps.docs) {
      try { await admin.auth().setCustomUserClaims(d.id, { admin: true }); done += 1; } catch { /* تجاهل */ }
    }
    return res.status(200).json({ success: true, total: snaps.size, granted: done });
  },
};

const actionMap = {
  'banner-ads': 'banner-ads',
  exhibitions: 'exhibitions',
  payments: 'payments',
  stats: 'stats',
  'update-doc': 'update-doc',
  'ai-feedback': 'ai-feedback',
  'ai-feedback-stats': 'ai-feedback-stats',
  'saved-titles': 'saved-titles',
  'delete-saved-title': 'delete-saved-title',
  'sync-self': 'sync-self',
  whoami: 'whoami',
  'set-admin-claim': 'set-admin-claim',
  'sync-admin-claims': 'sync-admin-claims',
};

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  allowCors(res);
  if (isPreflight(req)) return res.status(204).end();

  // Determine action from query or URL path
  let action = req.query.action || '';

  if (!action || !actionMap[action]) {
    const pathParts = req.url.split('?')[0].split('/').filter(Boolean);
    action = pathParts[pathParts.length - 1];
  }

  const handlerName = actionMap[action];
  if (!handlerName) {
    return res.status(400).json({ success: false, message: 'يجب تحديد action: banner-ads, exhibitions, payments, stats, update-doc' });
  }

  try {
    initAdmin();

    // GET-based endpoints, إلا التي تحتاج POST
    const POST_ONLY = ['update-doc', 'ai-feedback', 'delete-saved-title', 'sync-self', 'set-admin-claim', 'sync-admin-claims'];
    const ANY_AUTH = ['sync-self', 'whoami']; // لا تتطلب أدمن — مصادقة المستخدم فقط
    if (POST_ONLY.includes(handlerName)) {
      if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    } else if (req.method !== 'GET') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    if (ANY_AUTH.includes(handlerName)) {
      const decoded = await verifyAnyUser(req, res);
      if (!decoded) return;
      req.decodedUser = decoded;
      req.adminUid = decoded.uid;
      return await handlers[handlerName](req, res);
    }

    const token = await authenticate(req, res);
    if (!token) return;
    req.adminUid = token.uid;

    return await handlers[handlerName](req, res);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
