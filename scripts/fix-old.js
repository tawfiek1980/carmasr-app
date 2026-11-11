import admin from 'firebase-admin';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');
const candidates = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.join(repo, 'secrets-backup', 'tareeq-d4dcc-d3d46f52373a.json'),
  path.join(repo, 'secrets-backup', 'tareeq-d4dcc-firebase-adminsdk-fbsvc-1cb72bfd3b.json'),
  path.join(repo, 'secrets-backup', 'tareeq-d4dcc-firebase-adminsdk-fbsvc-c5adf9ad70.json'),
].filter(Boolean);

const credPath = candidates.find((p) => p && fs.existsSync(p));

if (!credPath) {
  console.error('❌ مش لاقي service-account JSON. حُطه في secrets-backup/ أو فعّل GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(credPath) });
const db = admin.firestore();
const apply = process.argv.includes('--apply');
const doRelink = process.argv.includes('--relink');
const preferArg = process.argv.find(a => a.startsWith('--prefer='));
const prefer = preferArg ? preferArg.split('=')[1] : '';
const FLAG = apply ? '🟢 APPLY' : '🔎 DRY-RUN (مافيش تغيير)';
console.log(`\n${FLAG} — بناءً على ${path.basename(credPath)}\n`);

function normPhone(raw) {
  if (!raw) return '';
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0020')) p = p.slice(4);
  if (p.startsWith('20') && p.length === 12) p = p.slice(2);
  if (p.startsWith('0') && p.length === 11) p = p.slice(1);
  return p;
}
function normEmail(v) { return typeof v === 'string' ? v.trim().toLowerCase() : ''; }

const usersSnap = await db.collection('users').get();
const phoneIdx = new Map();
const emailIdx = new Map();
const nameIdx = new Map();
for (const u of usersSnap.docs) {
  const d = u.data() || {};
  const ph = normPhone(d.phone);
  if (ph) {
    if (!phoneIdx.has(ph)) phoneIdx.set(ph, []);
    phoneIdx.get(ph).push(u.id);
  }
  const em = normEmail(d.email);
  if (em) {
    if (!emailIdx.has(em)) emailIdx.set(em, []);
    emailIdx.get(em).push(u.id);
  }
  const nm = typeof d.name === 'string' ? d.name.trim() : '';
  if (nm) {
    if (!nameIdx.has(nm)) nameIdx.set(nm, []);
    nameIdx.get(nm).push(u.id);
  }
}
console.log(`👤 المستخدمون: ${usersSnap.size} (أرقام: ${phoneIdx.size}, إيميلات: ${emailIdx.size}, أسماء: ${nameIdx.size})\n`);

const listingsSnap = await db.collection('listings').get();
let missing = 0, fixed = 0, unresolved = [];
const batch = db.batch();
for (const doc of listingsSnap.docs) {
  const d = doc.data() || {};
  if (d.userId && usersSnap.docs.some(u => u.id === d.userId)) continue;
  missing++;

  const phones = [d.phone, d.contactPhone, d.userPhone];
  const emails = [d.email, d.contactEmail];
  const names = [d.userName, d.ownerName, d.contactName, d.name];

  function pick(list) { return prefer && list.includes(prefer) ? prefer : list[0]; }

  let uid = null, how = '';
  for (const p of phones) {
    const ph = normPhone(p);
    if (ph && phoneIdx.has(ph)) { uid = pick(phoneIdx.get(ph)); how = 'هاتف'; break; }
  }
  if (!uid) for (const e of emails) {
    const em = normEmail(e);
    if (em && emailIdx.has(em)) { uid = pick(emailIdx.get(em)); how = 'إيميل'; break; }
  }
  if (!uid) for (const n of names) {
    const nm = typeof n === 'string' ? n.trim() : '';
    if (nm && nameIdx.has(nm) && nameIdx.get(nm).length === 1) { uid = nameIdx.get(nm)[0]; how = `اسم (${nm})`; break; }
  }

  if (uid) {
    if (apply) {
      batch.update(doc.ref, { userId: uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    fixed++;
    console.log(`  ✅ ${doc.id.length > 20 ? doc.id.slice(0, 20) + '…' : doc.id} → ${uid.slice(0, 8)}… (${how})`);
  } else {
    unresolved.push({ id: doc.id, phone: phones.find(Boolean) || '', title: d.title || '' });
  }
}
if (apply && fixed > 0) await batch.commit();
console.log(`\nإعلانات بدون مالِك: ${missing} → رُبط ${fixed}، مفيش حل: ${unresolved.length}`);
for (const u of unresolved) console.log(`  ⚠️ ${u.id} | هاتف: ${u.phone} | ${(u.title || '').slice(0, 40)}`);

const A = '1TfrfQNTnhMtYeVtLWKMYCUV0103';
const B = '6mXtsrajzAPmgN43yyKpMQMVqfG3';
const OW = 'ow1UDMS6VfhIJ5KjgQgCYoyaZog1';
if (doRelink) {
  let moved = 0;
  const rbatch = db.batch();
  for (const doc of listingsSnap.docs) {
    const d = doc.data() || {};
    if (d.userId === A) { rbatch.update(doc.ref, { userId: B, updatedAt: admin.firestore.FieldValue.serverTimestamp() }); moved++; }
  }
  if (apply && moved > 0) await rbatch.commit();
  console.log(`\n🔁 relinkAdmins: إعلانات من A (القديم) إلى B (المعتمد): ${moved} ${apply ? 'تم' : '(يتطلب --apply و--relink)'}`);

  const fromConv = [A, OW].sort().join('_');
  const toConv = [B, OW].sort().join('_');
  const oldSnap = await db.collection('conversations').doc(fromConv).get();
  if (oldSnap.exists) {
    const cd = oldSnap.data();
    if (apply) {
      await db.collection('conversations').doc(toConv).set({
        ...cd, participants: [B, OW], participantsData: cd.participantsData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const msgs = await db.collection('conversations').doc(fromConv).collection('messages').get();
      const mb = db.batch();
      for (const m of msgs.docs) mb.delete(m.ref);
      await mb.commit();
      await db.collection('conversations').doc(fromConv).delete();
    }
    console.log(`   محادثة ${fromConv.slice(0, 12)}… → ${toConv.slice(0, 12)}… ${apply ? 'منقولة' : '(يتطلب --apply و--relink)'}`);
  } else {
    console.log(`   محادثة المقاول القديمة مش موجودة (نُقلت سابقًا?).`);
  }
}

console.log(`\n✓ خلص. ${apply ? 'التغييرات محفوظة في Firebase.' : 'شغّل مع --apply لتنفيذ الباتش.'}`);