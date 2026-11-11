import admin from 'firebase-admin';
import { config } from 'dotenv';
config();

const key = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
};

admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

import { DEFAULT_IMAGES } from '../api-handlers/_lib/listings.js';

async function main() {
  const snap = await db.collection('listings').get();
  let updated = 0;
  let skipped = 0;
  const batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const hasImages = Array.isArray(d.images) && d.images.some(Boolean);
    if (hasImages) { skipped++; continue; }
    const img = DEFAULT_IMAGES[d.category] || DEFAULT_IMAGES.vehicles;
    batch.update(doc.ref, { images: [img] });
    ops++;
    updated++;
    if (ops === 450) {
      await batch.commit();
      ops = 0;
    }
    console.log(`🔵 ${doc.id} (${d.category || '-'}) → ${img}`);
  }
  if (ops) await batch.commit();
  console.log(`\n✅ تم: ${updated} إعلان اتحطت ليه صورة افتراضية — أسكوتب: ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });