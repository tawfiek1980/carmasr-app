import { initAdmin, getDb, verifyUser } from './_lib/db.js';
import { allowCors, isPreflight } from './_lib/cors.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  allowCors(res);
  if (isPreflight(req)) return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { productId, exhibitionId } = req.body || {};
  if (!productId) {
    return res.status(400).json({ success: false, message: 'productId مطلوب' });
  }

  try {
    const db = getDb();
    const auth = initAdmin().auth();

    const productRef = db.doc(`products/${productId}`);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      return res.status(200).json({ success: true, alreadyGone: true, productId });
    }
    const product = productSnap.data();

    // الهوية: فقط عبر Firebase ID Token — لا نثق أبدًا في x-uid من الـ client
    const ctx = await verifyUser(req);
    if (!ctx) {
      return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول' });
    }
    const uid = ctx.uid;

    let allowed = product.userId === uid;
    if (!allowed) {
      const userSnap = await db.doc(`users/${uid}`).get();
      if (userSnap.exists && userSnap.data().type === 'admin') allowed = true;
    }
    if (!allowed && product.exhibitionId) {
      const exhSnap = await db.doc(`exhibitions/${product.exhibitionId}`).get();
      if (exhSnap.exists && exhSnap.data().userId === uid) allowed = true;
    }

    if (!allowed) {
      return res.status(403).json({ success: false, message: 'غير مصرح' });
    }

    // 2) الحذف: العلوية + نسخ الـ subcollection (بمعرف المستند أو حقل id)
    await productRef.delete();
    const paths = new Set([product.exhibitionId, exhibitionId].filter(Boolean));
    for (const exhId of paths) {
      const subRef = db.doc(`exhibitions/${exhId}/products/${productId}`);
      const subSnap = await subRef.get();
      if (subSnap.exists) await subRef.delete();
    }
    for (const exhId of paths) {
      const byField = await db.collection(`exhibitions/${exhId}/products`).where('id', '==', productId).get();
      for (const d of byField.docs) await d.ref.delete();
    }

    return res.status(200).json({ success: true, productId, deleted: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: String((err && err.message) || err) });
  }
}
