import admin from 'firebase-admin';
import { initAdmin } from './_lib/db.js';
import { allowCors, isPreflight } from './_lib/cors.js';

async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const snap = await admin.firestore().doc(`users/${decoded.uid}`).get();
    const user = snap.data();
    return user?.type === 'admin' ? decoded : null;
  } catch { return null; }
}

async function verifyUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  try { return await admin.auth().verifyIdToken(idToken); } catch { return null; }
}

const VODAFONE_CASH = process.env.VODAFONE_CASH_NUMBER || '01018870145';

/**
 * تطبيق مزايا الدفع المؤكد: ترقية الإعلان / معرض / بانر.
 * مستخدمة في تأكيد الأدمن وفي الترقية الفورية لو اللي بيدفع أدمن.
 */
async function applyPaidBenefit(db, payment) {
  if (!payment) return;
  if (payment.type === 'featured_listing' && payment.listingId) {
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.collection('listings').doc(payment.listingId).update({
      featured: true,
      featuredUntil: thirtyDays,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  if (payment.type === 'exhibition') {
    const meta = payment.metadata || {};
    await db.collection('exhibitions').add({
      name: meta.name || 'معرض', description: meta.description || '', contactPhone: meta.contactPhone || '',
      whatsapp: meta.whatsapp || '', governorate: meta.governorate || '', city: meta.city || '',
      plan: meta.plan || 'basic', status: 'active', userId: payment.userId || '',
      category: meta.category === 'import' ? 'import' : 'general',
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  if (payment.type === 'banner_ad') {
    const meta = payment.metadata || {};
    await db.collection('bannerAds').add({
      companyName: meta.companyName || '', position: meta.position || 'home_top', price: payment.amount || 0,
      linkUrl: meta.linkUrl || '', status: 'active', userId: payment.userId || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  allowCors(res);
  if (isPreflight(req)) return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    initAdmin();

    const { action } = req.body || {};
    const db = admin.firestore();

    // ── CREATE ──────────────────────────────────────────────────────────
    if (action === 'create') {
      const decoded = await verifyUser(req);
      if (!decoded) return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول أولاً' });

      const { type, amount, listingId, listingTitle, proofImage, metadata } = req.body;
      if (!type || !amount) return res.status(400).json({ success: false, message: 'نوع الدفع والمبلغ مطلوبان' });
      if (!['featured_listing', 'exhibition', 'banner_ad'].includes(type)) return res.status(400).json({ success: false, message: 'نوع دفع غير صالح' });

      // لو اللي بيدفع أدمن → الترقية تتفعل فورًا بدون انتظار مراجعة/إثبات دفع
      const meSnap = await db.collection('users').doc(decoded.uid).get();
      const isAdmin = meSnap.exists && meSnap.data()?.type === 'admin';

      const paymentRef = await db.collection('payments').add({
        userId: decoded.uid, userEmail: decoded.email || '', userName: decoded.name || '',
        type, amount, currency: 'EGP', status: isAdmin ? 'paid' : 'pending',
        paymentMethod: isAdmin ? 'admin_instant' : 'manual',
        listingId: listingId || null, listingTitle: listingTitle || null,
        proofImage: proofImage || null,
        metadata: metadata || {},
        ...(isAdmin ? { paidAt: admin.firestore.FieldValue.serverTimestamp(), adminNote: 'تفعيل فوري بواسطة الأدمن' } : {}),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (isAdmin) {
        await applyPaidBenefit(db, {
          type, amount, listingId: listingId || null, metadata: metadata || {}, userId: decoded.uid,
        });
        return res.status(200).json({
          success: true,
          paymentId: paymentRef.id,
          autoApproved: true,
          message: 'تم تفعيل الترقية فورًا ✅ (صلاحية أدمن)',
        });
      }

      return res.status(200).json({
        success: true, paymentId: paymentRef.id, autoApproved: false,
        message: `تم إنشاء طلب الدفع. قم بتحويل المبلغ على فودافون كاش ${VODAFONE_CASH} وسيتم تأكيد الدفع بعد التحويل.`,
      });
    }

    // ── CONFIRM ─────────────────────────────────────────────────────────
    if (action === 'confirm') {
      const decoded = await verifyAdmin(req);
      if (!decoded) return res.status(403).json({ success: false, message: 'فقط الأدمن يمكنه تأكيد الدفع' });

      const { paymentId, status, adminNote } = req.body;
      if (!paymentId) return res.status(400).json({ success: false, message: 'معرف الدفع مطلوب' });

      const finalStatus = ['paid', 'cancelled', 'refunded'].includes(status) ? status : 'paid';
      const updateData = { status: finalStatus, adminNote: adminNote || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      if (finalStatus === 'paid') updateData.paidAt = admin.firestore.FieldValue.serverTimestamp();

      await db.collection('payments').doc(paymentId).update(updateData);
      const paymentSnap = await db.collection('payments').doc(paymentId).get();
      const payment = paymentSnap.data();

      if (payment && finalStatus === 'paid') {
        await applyPaidBenefit(db, payment);
      }
      return res.status(200).json({ success: true, message: 'تم تحديث حالة الدفع' });
    }

    // ── LIST (admin only) ───────────────────────────────────────────────
    if (action === 'list') {
      const decoded = await verifyAdmin(req);
      if (!decoded) return res.status(403).json({ success: false, message: 'فقط الأدمن' });
      const snaps = await db.collection('payments').orderBy('createdAt', 'desc').limit(200).get();
      const payments = snaps.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate()?.toISOString() || null, paidAt: d.data().paidAt?.toDate()?.toISOString() || null }));
      return res.status(200).json({ success: true, payments });
    }



    return res.status(400).json({ success: false, message: 'إجراء غير معروف' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'خطأ غير متوقع' });
  }
}
