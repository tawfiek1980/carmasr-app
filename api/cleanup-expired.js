// api/cleanup-expired.js — أرشفة الإعلانات المنتهية + طلب التحديث + كشف التكرار (كرون محمي بـ CRON_SECRET)
// default: تنظيف featuredUntil المنتهية
// ?action=renewal : طلب تحديث بعد 30 يوم + تنبيه قبل الانتهاء + أرشفة تلقائية بعد 60 يوم
// ?action=duplicates : كشف الإعلانات المتكررة (?mode=hide لإخفائها تلقائيًا)
import admin from 'firebase-admin';
import { initAdmin } from './_lib/db.js';
import { notifyUser } from './_lib/notify.js';

const AGE_DAYS = 30;          // طلب تحديث بعد 30 يوم بدون تحديث
const EXPIRE_DAYS = 60;       // أرشفة تلقائية بعد 60 يوم
const WARN_BEFORE_EXPIRE = 7; // تنبيه قبل انتهاء المدة
const REMIND_EVERY_DAYS = 30; // لا نكرّر التذكير إلا بعد 30 يوم
const DUP_WINDOW_DAYS = 30;   // نعتبر المكررة داخل هذه المدة
const MAX_SCAN = 1000;
const BATCH_LIMIT = 400;

function daysBetween(from, to) {
  return Math.max(0, (to - from) / 86400000);
}

function normPhone(x) {
  if (!x) return '';
  let s = String(x)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  return s.replace(/[^\d]/g, '');
}

/** مفتاح كشف التكرار: عنوان مطبّع بدون مسافات ورموز وكلمة «للبيع» */
function dupKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/للبيع|بيع|للايجار|ايجار/g, '')
    .replace(/[^؀-ۿa-z0-9]/g, '');
}

async function commitChunks(db, ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    ops.slice(i, i + BATCH_LIMIT).forEach(op => {
      if (op.type === 'delete') batch.delete(op.ref);
      else batch.update(op.ref, op.data);
    });
    await batch.commit();
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // 🔒 حماية: فقط المجدول المزوّد بـ CRON_SECRET الصحيح ينفّذ
  const expected = process.env.CRON_SECRET;
  const provided = req.headers['x-cron-secret'] || req.query.secret || '';
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: 'غير مصرّح' });
  }

  try {
    initAdmin();
    const db = admin.firestore();

    // 🔧 صيانة: إصلاح الإعلانات القديمة التي لا تملك userId (المفتاح مطلوب لزر «رسالة»)
    if (req.query.action === 'fixOwners') {
      const admins = await db.collection('users').where('type', '==', 'admin').get();
      const adminUids = admins.docs.map(d => d.id);
      const adminSet = new Set(adminUids);
      const adminPhones = ['01018870145', '01277177710', '01019362191', '1029023206'].map(normPhone);

      const users = await db.collection('users').get();
      const byPhone = new Map(), byPhone10 = new Map(), emails = new Map(), byName = new Map();
      for (const d of users.docs) {
        const p = normPhone(d.data().phone || '');
        if (p) {
          byPhone.set(p, d.id);
          if (p.length >= 10) { const t = p.slice(-10); if (!byPhone10.has(t)) byPhone10.set(t, d.id); }
        }
        const e = (d.data().email || '').toLowerCase();
        if (e) emails.set(e, d.id);
        const nm = (d.data().name || '').trim().toLowerCase();
        if (nm) {
          if (!byName.has(nm)) byName.set(nm, []);
          byName.get(nm).push(d.id);
        }
      }

      const listings = await db.collection('listings').get();
      const batch = db.batch();
      let scanned = 0, fixedByPhone = 0, fixedAdmin = 0, unresolved = 0;
      const un = [];

      for (const doc of listings.docs) {
        const l = doc.data();
        if (l.userId) continue;
        scanned++;
        let owner = '';
        const phones = [l.userPhone, l.contactPhone, l.advertiserPhone].filter(Boolean);
        for (const ph of phones) {
          const n = normPhone(ph);
          if (n.length >= 10) {
            if (byPhone.has(n)) { owner = byPhone.get(n); break; }
            if (byPhone10.has(n.slice(-10))) { owner = byPhone10.get(n.slice(-10)); break; }
            const em = 'phone_' + n + '@tareeq.app';
            if (emails.has(em)) { owner = emails.get(em); break; }
          }
        }
        if (!owner && adminUids.length) {
          const n = normPhone(l.userPhone || l.contactPhone || '');
          if (n.length >= 10 && adminPhones.includes(n)) owner = adminUids[0];
        }
        if (!owner) {
          const nm = (l.userName || '').trim().toLowerCase();
          if (nm && byName.has(nm)) {
            const ids = byName.get(nm);
            if (ids.length === 1) owner = ids[0];
            else if (ids.every(u => adminSet.has(u))) owner = ids[0];
          }
        }
        if (owner) {
          batch.update(doc.ref, { userId: owner, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          if (phones.some(ph => { const n = normPhone(ph); return n.length >= 10 && byPhone.has(n); })) fixedByPhone++;
          else fixedAdmin++;
        } else {
          unresolved++;
          if (un.length < 10) un.push({ id: doc.id, ph: l.userPhone || l.contactPhone || '', adv: (l.advertiserName || '').slice(0, 24) });
        }
      }

      if (fixedByPhone + fixedAdmin > 0) await batch.commit();

      await db.collection('cronRuns').add({
        job: 'fix-owners',
        scanned, fixedByPhone, fixedAdmin, unresolved,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        success: true, action: 'fixOwners', v: 5, scanned, fixedByPhone, fixedAdmin, unresolved,
        unresolvedSamples: un, adminUids,
      });
    }

    // 🔧 صيانة: نسخ رقم واتساب صاحب الإعلان من بروفايله للإعلان (الإعلانات القديمة)
    if (req.query.action === 'backfillWhatsapp') {
      const waCache = new Map();
      const ops = [];
      let scanned = 0, filled = 0, skipped = 0;

      const listings = await db.collection('listings')
        .where('status', '==', 'active')
        .limit(MAX_SCAN)
        .get();

      for (const doc of listings.docs) {
        const l = doc.data();
        scanned++;
        // لو الإعلان ليه رقم واتساب خاص أو مفيش صاحب، سيبه
        if (l.whatsappPhone || !l.userId) { skipped++; continue; }

        let wa = waCache.get(l.userId);
        if (wa === undefined) {
          const u = await db.collection('users').doc(l.userId).get();
          wa = normPhone(u.exists ? (u.data().whatsapp || '') : '');
          waCache.set(l.userId, wa);
        }
        if (!wa) { skipped++; continue; }

        ops.push({ ref: doc.ref, data: { whatsappPhone: wa } });
        filled++;
      }

      if (ops.length > 0) await commitChunks(db, ops);

      await db.collection('cronRuns').add({
        job: 'backfill-whatsapp',
        scanned, filled, skipped,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ success: true, action: 'backfillWhatsapp', scanned, filled, skipped });
    }

    // 🔧 توحيد حسابات الأدمن المتباعدة: نقل الإعلانات والمحادثة من الحساب القديم للحساب المعتمد
    if (req.query.action === 'relinkAdmins') {
      const FROM = '1TfrfQNTnhMtYeVtLWKMYCUV0103';
      const TO = '6mXtsrajzAPmgN43yyKpMQMVqfG3';

      const listings = await db.collection('listings').get();
      const batch = db.batch();
      let moved = 0;
      for (const doc of listings.docs) {
        const d = doc.data();
        if (d.userId === FROM) {
          batch.update(doc.ref, { userId: TO, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          moved++;
        }
      }
      if (moved > 0) await batch.commit();

      // نقل محادثة المقاول فقط (from→to) مع رسائلها
      const fromConvId = [FROM, 'ow1UDMS6VfhIJ5KjgQgCYoyaZog1'].sort().join('_');
      const toConvId = [TO, 'ow1UDMS6VfhIJ5KjgQgCYoyaZog1'].sort().join('_');
      let convMoved = 0;
      const oldSnap = await db.collection('conversations').doc(fromConvId).get();
      if (oldSnap.exists) {
        const d = oldSnap.data();
        const newConvId = [TO, 'ow1UDMS6VfhIJ5KjgQgCYoyaZog1'].sort().join('_');
        await db.collection('conversations').doc(newConvId).set({
          ...d,
          participants: [TO, 'ow1UDMS6VfhIJ5KjgQgCYoyaZog1'],
          participantsData: d.participantsData,
          lastMessage: d.lastMessage,
          lastMessageAt: d.lastMessageAt,
          createdAt: d.createdAt,
        });
        const msgs = await oldSnap.ref.collection('messages').get();
        const mb = db.batch();
        let n = 0;
        for (const m of msgs.docs) {
          mb.set(db.collection('conversations').doc(newConvId).collection('messages').doc(m.id), m.data());
          n++;
        }
        if (n > 0) await mb.commit();
        const db2 = db.batch();
        const mlist = await oldSnap.ref.collection('messages').get();
        mlist.docs.forEach(m => db2.delete(m.ref));
        db2.delete(oldSnap.ref);
        await db2.commit();
        convMoved = n;
      }

      return res.status(200).json({ success: true, action: 'relinkAdmins', moved, convMoved, fromConvId });
    }

    if (req.query.action === 'renewal') {
      const now = new Date();
      // نمسح الإعلانات النشطة (آخر 1000) ونرشّح الأقدم — يستخدم فهرس (status, createdAt) الموجود
      const active = await db.collection('listings')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(MAX_SCAN)
        .get();

      const ops = [];
      let updateAsked = 0, expiryWarned = 0, archived = 0;

      for (const doc of active.docs) {
        const l = doc.data();
        if (l.featured) continue;                 // الإعلان المميز لا يحتاج تجديداً
        if (!l.createdAt) continue;
        const created = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
        if (isNaN(created.getTime())) continue;

        // آخر نشاط = آخر تعديل (لو اتعدّل فالساعة بترجع من الأول)
        const updated = l.updatedAt?.toDate ? l.updatedAt.toDate() : (l.updatedAt ? new Date(l.updatedAt) : null);
        const lastTouch = updated && !isNaN(updated.getTime()) ? updated : created;
        const age = daysBetween(lastTouch, now);
        const ageFromCreate = daysBetween(created, now);

        // ── أرشفة تلقائية بعد انتهاء المدة ──
        if (ageFromCreate >= EXPIRE_DAYS) {
          ops.push({
            ref: doc.ref,
            data: {
              status: 'expired',
              expiredAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          });
          archived += 1;
          if (l.userId && !l.expiredNotifiedAt) {
            try {
              await notifyUser(db, l.userId, {
                title: 'انتهى مدة إعلانك',
                body: `تم أرشفة إعلانك "${l.title || ''}" لأنه لم يتم تحديثه خلال ${EXPIRE_DAYS} يوم. حدّثه أو انشره من جديد ليستمر ظهوره.`,
                url: `/my-listings`,
                type: 'expired',
              });
            } catch { /* تجاهل */ }
          }
          continue;
        }

        if (age < AGE_DAYS) continue; // لسه جديد

        const userOk = async () => {
          if (!l.userId) return false;
          const userSnap = await db.collection('users').doc(l.userId).get();
          return userSnap.exists && userSnap.data().renewalNotifications !== false;
        };

        // ── تنبيه قبل الانتهاء بـ WARN_BEFORE_EXPIRE يوم ──
        if (ageFromCreate >= EXPIRE_DAYS - WARN_BEFORE_EXPIRE) {
          const warned = l.expiryWarnedAt?.toDate ? l.expiryWarnedAt.toDate() : (l.expiryWarnedAt ? new Date(l.expiryWarnedAt) : null);
          if ((!warned || daysBetween(warned, now) >= REMIND_EVERY_DAYS) && await userOk()) {
            try {
              await notifyUser(db, l.userId, {
                title: '⏳ إعلانك يوشك على الانتهاء',
                body: `إعلانك "${l.title || ''}" يتبقى ${WARN_BEFORE_EXPIRE} أيام على انتهاء مدته. حدّثه الآن حتى لا يختفي من نتائج البحث.`,
                url: `/my-listings`,
                type: 'renewal',
              });
            } catch { /* تجاهل */ }
            ops.push({ ref: doc.ref, data: { expiryWarnedAt: admin.firestore.FieldValue.serverTimestamp() } });
            expiryWarned += 1;
          }
          continue;
        }

        // ── طلب تحديث الإعلان بعد AGE_DAYS ──
        const last = l.renewalRemindedAt?.toDate ? l.renewalRemindedAt.toDate() : (l.renewalRemindedAt ? new Date(l.renewalRemindedAt) : null);
        if (last && daysBetween(last, now) < REMIND_EVERY_DAYS) continue;
        if (!(await userOk())) continue;

        try {
          await notifyUser(db, l.userId, {
            title: '🔄 حدّث إعلانك',
            body: `إعلانك "${l.title || ''}" منشور من أكتر من ${AGE_DAYS} يوم بدون تحديث. حدّثه ليعود لأعلى النتائج ويظهر للباحثين من جديد.`,
            url: `/my-listings`,
            type: 'renewal',
          });
        } catch { /* تجاهل */ }
        ops.push({ ref: doc.ref, data: { renewalRemindedAt: admin.firestore.FieldValue.serverTimestamp() } });
        updateAsked += 1;
      }

      if (ops.length > 0) await commitChunks(db, ops);

      await db.collection('cronRuns').add({
        job: 'renewal-reminder',
        activeScanned: active.size,
        updateAsked,
        expiryWarned,
        archived,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        success: true, activeScanned: active.size,
        updateAsked, expiryWarned, archived,
        action: 'renewal', ageDays: AGE_DAYS, expireDays: EXPIRE_DAYS,
      });
    }

    // 🔎 كشف الإعلانات المتكررة (نفس المالك + نفس العنوان، أو نفس الصورة)
    if (req.query.action === 'duplicates') {
      const hide = req.query.mode === 'hide';
      const snap = await db.collection('listings')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(MAX_SCAN)
        .get();

      const groups = new Map(); // key → [doc]
      for (const doc of snap.docs) {
        const l = doc.data();
        const keys = [];
        const titleKey = dupKey(l.title);
        if (titleKey.length > 6) keys.push(`t:${l.userId || ''}:${titleKey}`);
        const img = (l.images && l.images[0]) || '';
        if (img) keys.push(`i:${img.split('?')[0]}`);
        for (const k of keys) {
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push({ doc, created: l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt || 0) });
        }
      }

      const duplicateIds = new Set();
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        list.sort((a, b) => b.created - a.created); // الأحدث أولًا
        const oldestDays = daysBetween(list[list.length - 1].created, now);
        if (oldestDays > DUP_WINDOW_DAYS && list.length > 2) continue; // مجموع قديم — نسيبه للمعلنين
        for (let i = 1; i < list.length; i++) duplicateIds.add(list[i].doc.id); // نحتفظ بالأقدم
      }

      const ops = [];
      duplicateIds.forEach(id => {
        const doc = snap.docs.find(d => d.id === id);
        if (!doc) return;
        ops.push({
          ref: doc.ref,
          data: hide
            ? { status: 'paused', duplicateOfNote: 'تم إخفاؤه كإعلان مكرر', duplicateHiddenAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }
            : { duplicateFlaggedAt: admin.firestore.FieldValue.serverTimestamp() },
        });
      });

      if (hide && ops.length > 0) await commitChunks(db, ops);

      await db.collection('cronRuns').add({
        job: 'duplicates-scan',
        scanned: snap.size,
        duplicates: duplicateIds.size,
        mode: hide ? 'hide' : 'report',
        at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        success: true, action: 'duplicates', mode: hide ? 'hide' : 'report',
        scanned: snap.size, duplicates: duplicateIds.size,
        samples: Array.from(duplicateIds).slice(0, 20),
      });
    }

    // default: إزالة التميز عن الإعلانات المنتهية
    const now = new Date();
    const expired = await db.collection('listings')
      .where('featured', '==', true)
      .where('featuredUntil', '<', now.toISOString())
      .get();

    let cleaned = 0;
    const batch = db.batch();
    expired.forEach(doc => {
      batch.update(doc.ref, { featured: false, featuredUntil: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      cleaned++;
    });
    if (cleaned > 0) await batch.commit();

    return res.status(200).json({ success: true, cleaned, message: `تم إزالة التميز عن ${cleaned} إعلان منتهي` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'خطأ غير متوقع' });
  }
}