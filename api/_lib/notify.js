// api/_lib/notify.js — إرسال الإشعارات (in-app + FCM + Web Push) للمستخدم
import admin from 'firebase-admin';
import webPush from 'web-push';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'push@carmasr-app.vercel.app';
const vapidReady = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);

if (vapidReady) webPush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE);

function buildSubscription(data) {
  return { endpoint: data.endpoint || '', keys: { auth: data.auth || '', p256dh: data.p256dh || '' } };
}

/**
 * يرسل إشعاراً لمستخدم: يُكتب في كوليكشن notifications + FCM + Web Push.
 */
export async function notifyUser(db, userId, { title, body, url = '/', type = 'system', listingId = null }) {
  await db.collection('notifications').add({
    userId,
    type,
    title,
    body,
    read: false,
    listingId: listingId || (url && String(url).startsWith('/listing/') ? String(url).split('/')[2] || null : null),
    url,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const fcm = admin.messaging();
  const deviceSnap = await db.collection('deviceTokens').where('userId', '==', userId).get();
  const tokens = deviceSnap.docs.map((d) => d.data().token).filter(Boolean);
  const message = {
    notification: { title, body },
    android: { priority: 'high', notification: { title, body, icon: 'ic_stat_icon', color: '#FF8A1A' } },
    data: { title, body, url },
  };
  await Promise.allSettled(tokens.map((t) => fcm.send({ token: t, ...message }).catch(() => {})));

  if (vapidReady) {
    const subs = await db.collection('pushSubscriptions').where('userId', '==', userId).get();
    const payload = JSON.stringify({ title, body, icon: '/tareeq-logo.png', url });
    await Promise.allSettled(subs.docs.map((d) => webPush.sendNotification(buildSubscription(d.data()), payload).catch(() => {})));
  }
}

/**
 * يبلّغ كل الأدمن عن إعلان/وظيفة جديدة بانتظار الموافقة.
 * kind: 'listing' | 'job' — يحدد الوجهة عند الضغط على الإشعار.
 */
export async function notifyAdminsNewPost(db, { kind = 'listing', id = '', title = '', userName = '' } = {}) {
  const url = kind === 'job' ? '/jobs' : (id ? `/listing/${id}` : '/');
  const label = kind === 'job' ? '📢 وظيفة جديدة' : '📢 إعلان جديد';
  const body = `${userName || 'مستخدم'} • ${title || ''}`.trim() || 'بانتظار الموافقة';
  try {
    const snap = await db.collection('users').where('type', '==', 'admin').get();
    await Promise.allSettled(snap.docs.map((d) => notifyUser(db, d.id, {
      title: label,
      body: `${body} — بانتظار الموافقة`,
      url,
      type: 'new_listing_admin',
      listingId: id || null,
    })));
  } catch (e) {
    console.error('notifyAdminsNewPost error:', String((e && e.message) || e));
  }
}