import admin from 'firebase-admin';
import { initAdmin } from './_lib/db.js';

initAdmin();

const adminDb = admin.firestore();
const adminAuth = admin.auth();
const BATCH_SIZE = 10;

async function deleteUserData(userId) {
  const collections = ['listings', 'loads', 'jobs', 'notifications', 'financeRequests', 'pushSubscriptions'];
  const allDeletes = [];

  for (const colName of collections) {
    const snaps = await adminDb.collection(colName).where('userId', '==', userId).get();
    const ids = snaps.docs.map(d => d.id);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      ids.slice(i, i + BATCH_SIZE).forEach(id => batch.delete(adminDb.collection(colName).doc(id)));
      allDeletes.push(batch.commit());
    }
  }

  const convSnaps = await adminDb.collection('conversations').get();
  for (const convDoc of convSnaps.docs) {
    const data = convDoc.data();
    if (data.participants?.includes(userId)) {
      const msgSnaps = await adminDb.collection('conversations').doc(convDoc.id).collection('messages').get();
      const batch = adminDb.batch();
      msgSnaps.docs.forEach(m => batch.delete(m.ref));
      batch.delete(convDoc.ref);
      allDeletes.push(batch.commit());
    }
  }

  const favSnaps = await adminDb.collection('favorites').where('userId', '==', userId).get();
  const favIds = favSnaps.docs.map(d => d.id);
  for (let i = 0; i < favIds.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    favIds.slice(i, i + BATCH_SIZE).forEach(id => batch.delete(adminDb.collection('favorites').doc(id)));
    allDeletes.push(batch.commit());
  }

  const paySnaps = await adminDb.collection('payments').where('userId', '==', userId).get();
  const payIds = paySnaps.docs.map(d => d.id);
  for (let i = 0; i < payIds.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    payIds.slice(i, i + BATCH_SIZE).forEach(id => batch.delete(adminDb.collection('payments').doc(id)));
    allDeletes.push(batch.commit());
  }

  await Promise.all(allDeletes);
  await adminDb.collection('users').doc(userId).delete();
  await adminAuth.deleteUser(userId);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || 'https://carmasr-app.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    await deleteUserData(decoded.uid);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
