import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'adAnalytics';

/** مفتاح اليوم بتوقيت القاهرة (YYYY-MM-DD) — لأن اليوم UTC كان بيقلب الداتا */
function dayKey(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d);
  } catch {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}

export interface AdClickEvent {
  listingId: string;
  source: string;
  medium: string;
  campaign: string;
  timestamp: Date;
  userAgent: string;
  referrer: string;
}

/** قراءة معاملات UTM من الرابط الحالي في أي مكان */
export function currentUtm() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      source: p.get('utm_source') || 'direct',
      medium: p.get('utm_medium') || '',
      campaign: p.get('utm_campaign') || '',
    };
  } catch {
    return { source: 'direct', medium: '', campaign: '' };
  }
}

/** تصنيف القناة حسب medium عشان نحصيها كل واحدة لوحدها في الـ totals */
export function channelKey(medium: string): string {
  switch (medium) {
    case 'whatsapp': return 'whatsappClicks';
    case 'phone': return 'callClicks';
    case 'tasehil': return 'tasehilClicks';
    default: return 'linkClicks';
  }
}

const CHANNEL_FIELDS: Record<string, 1> = {
  whatsappClicks: 1,
  callClicks: 1,
  tasehilClicks: 1,
  linkClicks: 1,
};

export async function trackAdClick(
  listingId: string,
  source: string = 'direct',
  medium: string = 'link',
  campaign: string = ''
) {
  try {
    const day = dayKey();
    const docId = `${listingId}_${source}_${day}`;
    const ref = doc(db, COLLECTION, docId);

    const channelField = channelKey(medium);

    await setDoc(ref, {
      listingId,
      source,
      medium,
      campaign,
      clicks: increment(1),
      lastClick: serverTimestamp(),
      day,
    }, { merge: true });

    // Also track totals per listing (شامل عدّاد القناة) — السيرفر بيجمعها في تقرير المُعلن
    const totalRef = doc(db, COLLECTION, `total_${listingId}`);
    await setDoc(totalRef, {
      listingId,
      totalClicks: increment(1),
      [channelField]: increment(1),
      lastClick: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.error('Analytics tracking failed:', err);
  }
}

/** مشاهدة — مرة واحدة لكل جهاز/إعلان/يوم (sessionStorage guard) عشان المحدثات ميحسبوهاش */
export async function trackAdImpression(listingId: string, source: string = 'direct', medium: string = '', campaign: string = '') {
  try {
    const day = dayKey();
    const guardKey = `tareeq_imp_${listingId}_${day}`;
    try {
      if (sessionStorage.getItem(guardKey)) return;
    } catch { /* ignore */ }

    const docId = `${listingId}_${source}_${day}`;
    const ref = doc(db, COLLECTION, docId);

    await setDoc(ref, {
      listingId,
      source,
      medium,
      campaign,
      impressions: increment(1),
      lastImpression: serverTimestamp(),
      day,
    }, { merge: true });

    const totalRef = doc(db, COLLECTION, `total_${listingId}`);
    await setDoc(totalRef, {
      listingId,
      totalImpressions: increment(1),
      lastImpression: serverTimestamp(),
    }, { merge: true });

    try { sessionStorage.setItem(guardKey, '1'); } catch { /* ignore */ }
  } catch (err) {
    console.error('Impression tracking failed:', err);
  }
}
