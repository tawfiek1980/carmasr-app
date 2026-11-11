import admin from 'firebase-admin';
import { initAdmin } from './_lib/db.js';
import { allowCors, isPreflight } from './_lib/cors.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  allowCors(res);
  if (isPreflight(req)) return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    initAdmin();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول أولاً' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول أولاً' });
    }

    const callerUid = decodedToken.uid;
    const callerSnap = await admin.firestore().doc(`users/${callerUid}`).get();
    const caller = callerSnap.data();

    if (!caller || caller.type !== 'admin') {
      return res.status(403).json({ success: false, message: 'فقط الأدمن يمكنه تنفيذ هذا الإجراء' });
    }

    const { email, phone, newPassword } = req.body || {};

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة مطلوبة' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور يجب ألا تقل عن 6 أحرف' });
    }

    let uid;
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
    } catch {
      if (phone) {
        const usersSnap = await admin.firestore()
          .collection('users')
          .where('phone', '==', phone)
          .get();
        if (!usersSnap.empty) {
          uid = usersSnap.docs[0].id;
        }
      }
    }

    if (!uid) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على مستخدم بهذا الرقم. قد يكون سجّل بحساب جوجل أو فيسبوك.' });
    }

    await admin.auth().updateUser(uid, { password: newPassword });
    return res.status(200).json({ success: true, message: 'تم تغيير كلمة السر بنجاح', uid });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'خطأ غير متوقع' });
  }
}
