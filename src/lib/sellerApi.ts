import { firebaseAuth } from '../firebase';
import { getApiUrl, getSiteUrl } from './config';

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch { /* ignore */ }
  return headers;
}

/** حذف إعلان من السيرفر (يتأكد من الملكية وينضّف analytics + الإشعارات المرتبطة) */
export async function deleteListingServerSide(listingId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const resp = await fetch(`${getApiUrl()}/seller-actions`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ action: 'listing-delete', listingId }),
    });
    const data = await resp.json().catch(() => null);
    return data?.ok ? { ok: true } : { ok: false, message: data?.message || 'تعذّر الحذف، حاول مرة أخرى' };
  } catch {
    return { ok: false, message: 'تعذّر الاتصال بالخادم' };
  }
}

/** إبلاغ السيرفر بضغطة تواصل (واتساب/اتصال/تساهيل) ليتنبّه المعلن — fire-and-forget */
export async function reportContactClick(listingId: string, channel: 'whatsapp' | 'phone' | 'tasehil'): Promise<void> {
  try {
    await fetch(`${getApiUrl()}/seller-actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'contact-click', listingId, channel }),
    });
  } catch { /* تجاهل — التحليلات مطلقة/الإنترنت مشكلة */ }
}

/** الروابط المتعقّبة (utm) لكل منصة — قصيرة عبر /ad/:id وهي بيعدّي ع الـ OG تلقائياً */
export interface TrackedLink {
  id: string;
  label: string;
  url: string;
}

export function trackedLinks(listingId: string): TrackedLink[] {
  const base = `${getSiteUrl()}/ad/${listingId}`;
  return [
    { id: 'facebook', label: 'فيسبوك', url: `${base}?utm_source=facebook` },
    { id: 'whatsapp', label: 'واتساب', url: `${base}?utm_source=whatsapp` },
    { id: 'twitter', label: 'تويتر / X', url: `${base}?utm_source=twitter` },
    { id: 'direct', label: 'رابط مباشر', url: `${getSiteUrl()}/listing/${listingId}` },
  ];
}