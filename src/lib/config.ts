const PROD_URL = 'https://carmasr-app.vercel.app';

export const BUILD_TAG = 'v1.0.0-carmasr-2026-11-11';

/** رابط صفحة تحميل التطبيق — تُستبدل برابط بلاي ستور عند النشر */
export const DOWNLOAD_URL = `${PROD_URL}/download/`;

/** رابط بلاي ستور الرسمي — اجعله في Vercel كـ VITE_PLAY_STORE_URL يوم ما التطبيق ينزل */
export const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL || '';

/** مركز تحميل التطبيق الوحيد: بلاي ستور لو متاح، غير كده صفحة التحميل */
export function appDownloadUrl(): string {
  return PLAY_STORE_URL || `${window.location.origin}/download/`;
}

export const HOME_VERSION: 'v2' | 'original' = (() => {
  try {
    const stored = localStorage.getItem('tareeq_home_version');
    if (stored === 'v2' || stored === 'original') return stored;
  } catch { /* ignore */ }
  return 'v2';
})();

export function isCapacitor(): boolean {
  try {
    const cap = (window as any).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    return window.location.protocol === 'capacitor:';
  } catch { return false; }
}

export function getSiteUrl(): string {
  if (isCapacitor()) return PROD_URL;
  return window.location.origin;
}

export function getShareUrl(path: string): string {
  return `${getSiteUrl()}${path}`;
}

export function getApiUrl(): string {
  if (isCapacitor()) return `${PROD_URL}/api`;
  return '/api';
}
