const KEY = 'tareeq_demo';

/**
 * وضع العرض النضيف — للتصوير بس.
 * بيخلّي القوائم (الرئيسية/البحث/الأقسام/الحمولات/الوظائف) تعرض البيانات التجريبية المرتبة
 * بدل بيانات الإنتاج الحقيقية، عشان الفيديو يبان إن التطبيق لسه نازل ونظيف.
 * التفعيل: افتح الموقع بـ ?demo=1 — الإيقاف: ?demo=0
 */
export function isDemoMode(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** يتنادى مرة واحدة عند فتح التطبيق عشان يقرأ ?demo=1 أو ?demo=0 */
export function applyDemoParam(): void {
  try {
    const flag = new URLSearchParams(window.location.search).get('demo');
    if (flag !== '1' && flag !== '0') return;
    const want = flag === '1';
    const on = window.localStorage.getItem(KEY) === '1';
    if (want) {
      if (!on) window.localStorage.setItem(KEY, '1');
      flash('وضع العرض النضيف مُفعّل — البيانات اللي بتشوفها تجريبية للتصوير');
    } else {
      if (on) window.localStorage.removeItem(KEY);
      flash('وضع العرض اتقفل — البيانات الحقيقية رجعت تاني');
    }
  } catch {}
}

let flashed = false;

function flash(text: string) {
  if (flashed) return;
  flashed = true;
  try {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText =
      'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:99999;' +
      'background:#059669;color:#fff;padding:10px 20px;border-radius:999px;' +
      'font:700 13px/1.4 system-ui,sans-serif;direction:rtl;text-align:center;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.28);transition:opacity .45s;max-width:92vw';
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 600);
    }, 3600);
  } catch {}
}
