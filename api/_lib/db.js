import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export function getKey() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) return JSON.parse(raw);
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    };
  }
  return null;
}

export function initAdmin() {
  const key = getKey();
  if (!key) throw new Error('Firebase service account missing');
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(key) });
  return admin.app();
}

export function getDb() {
  return getFirestore(initAdmin(), 'default');
}

export async function verifyUser(req) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return null;
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

export async function verifyAdmin(req) {
  const decoded = await verifyUser(req);
  if (!decoded) return null;
  const snap = await getDb().doc(`users/${decoded.uid}`).get();
  if (!snap.exists) return null;
  return snap.data().type === 'admin' ? decoded : null;
}
