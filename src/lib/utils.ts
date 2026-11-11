export const formatPrice = (price: number): string => {
  const n = Math.round(Number(price) || 0);
  return `${n.toLocaleString('en-US')} جنيه`;
};

/** أنواع حالة السعر في الإعلان */
export type PriceType = "fixed" | "negotiable" | "call" | "sold";

/**
 * عرض السعر بعبارة واضحة بدل "0 جنيه".
 * - call: السعر عند الاتصال
 * - sold: تم البيع
 * - price<=0 بدون نوع: السعر عند الاتصال
 */
export const displayPrice = (price?: number, priceType?: string): string => {
  if (priceType === "sold") return "تم البيع";
  if (priceType === "call") return "السعر عند الاتصال";
  const n = Number(price) || 0;
  if (n <= 0) return priceType === "negotiable" ? "قابل للتفاوض" : "السعر عند الاتصال";
  return formatPrice(n);
};

/** يُعتبر الإعلان مباعًا لو نوع السعر أو الحالة إشارة إلى sold */
export const isSold = (priceType?: string, status?: string): boolean =>
  priceType === "sold" || status === "sold";

/** أقل سعر مقبول — صفر معناها «غير معلن» فلازم يتحوّل لنوع سعر مش رقم */
export const MIN_LISTING_PRICE = 1;

/** يحوّل أي إدخال (نص/رقم) لرقم، ويشيل الفواصل والمسافات */
export function priceToNumber(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const n = Number(String(raw ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** رسالة خطأ للسعر حسب نوعه — «عند التواصل» و«تم البيع» مش بيطلبوا رقم */
export function priceInputError(raw: unknown, priceType?: string): string {
  if (priceType === "call" || priceType === "sold") return "";
  const n = priceToNumber(raw);
  if (!n) return "اكتب السعر بالجنيه، أو اختار «السعر عند التواصل»";
  if (n < MIN_LISTING_PRICE) return `أقل سعر ${MIN_LISTING_PRICE} جنيه`;
  return "";
}

/** السعر اللي يتحفظ في الإعلان: 0 مع «عند التواصل» و«تم البيع» */
export function listingPriceValue(raw: unknown, priceType?: string): number {
  if (priceType === "call" || priceType === "sold") return 0;
  return Math.max(0, priceToNumber(raw));
}

/** رقم الاتصال في الإعلان: رقم التواصل الخاص بالإعلان ثم رقم صاحب الحساب */
export const listingCallPhone = (l?: {
  contactPhone?: string | null;
  userPhone?: string | null;
} | null): string => l?.contactPhone || l?.userPhone || "";

/**
 * رقم الواتساب الخاص بالإعلان:
 * رقم واتساب سجّله صاحب الإعلان في الإعلان → رقم تواصل الإعلان → رقم صاحب الإعلان.
 * ملاحظة مهمة: ما بنستخدمش رقم البروفايل بتاع اللي فاتح الإعلان أبدًا —
 * الرقم لازم يكون بتاع صاحب الإعلان نفسه.
 */
export const listingWhatsApp = (l?: {
  whatsappPhone?: string | null;
  contactPhone?: string | null;
  userPhone?: string | null;
} | null): string => l?.whatsappPhone || l?.contactPhone || l?.userPhone || "";

/** توحيد العناوين المكوّنة من أجزاء، ويمنع ظهور -- بين الحقول الفاضية */
export const formatTitle = (parts: (string | undefined | null)[]): string => {
  return sanitizeTitle(
    parts
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean)
      .join(' - ')
      .replace(/\s*-\s*-\s*/g, ' - ')
      .trim() || 'إعلان'
  );
};

/** عنوان الإعلان: بنضيف الماركة/الموديل/السنة بس لو مش موجودة في نص المعلن — عشان ميتكررش ويبان الإعلان كقطعتين */
export const adTitle = (l: {
  title?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
}): string => {
  const raw = (l.title || '').replace(/\s+/g, ' ').trim();
  if (!raw) return formatTitle([l.brand, l.model, l.year?.toString()]);
  const extras = [l.year?.toString(), l.brand, l.model]
    .filter(Boolean)
    .filter((part) => !raw.includes(String(part)))
    .map((p) => String(p).trim());
  const head = extras.join(' ').trim();
  return head ? `${head} - ${raw}` : raw;
};

/** يحوّل أي شكل تاريخ (نص / Date / Firestore Timestamp / رقم) إلى Date صالح */
export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

export const formatDate = (dateString: unknown): string => {
  const date = toDate(dateString);
  if (!date) return '—';
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'منذ دقائق';
  if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
  if (diffInHours < 48) return 'منذ يوم';
  if (diffInHours < 168) return `منذ ${Math.floor(diffInHours / 24)} أيام`;
  
  return formatDateDMY(dateString);
};

export const formatDateDMY = (dateString: unknown): string => {
  const date = toDate(dateString);
  if (!date) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export const formatDateTime = (dateValue: any): string => {
  if (!dateValue) return '';
  let d: Date;
  if (typeof dateValue === 'object' && typeof dateValue.toDate === 'function') {
    d = dateValue.toDate();
  } else {
    d = new Date(dateValue);
  }
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const getWhatsAppLink = (phone: string, message?: string): string => {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);
  const text = message ? encodeURIComponent(message) : '';
  const number = cleanPhone.startsWith('20') ? cleanPhone : '20' + cleanPhone;
  return `https://wa.me/${number}?text=${text}`;
};

export const getPhoneLink = (phone: string): string => {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);
  return `tel:${cleanPhone.startsWith('20') ? '+' + cleanPhone : '+20' + cleanPhone}`;
};

export const formatPhone = (phone: string): string => {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) return `0${clean}`;
  if (clean.length === 11 && clean.startsWith('0')) return clean;
  if (clean.length === 12 && clean.startsWith('20')) return `0${clean.slice(2)}`;
  return phone;
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// ── Search History ──────────────────────────────────────────────
const SEARCH_KEY = "tareeq_recent_searches";

export function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(SEARCH_KEY) || "[]"); }
  catch { return []; }
}

export function addRecentSearch(term: string): void {
  const list = getRecentSearches().filter((s) => s !== term);
  list.unshift(term);
  localStorage.setItem(SEARCH_KEY, JSON.stringify(list.slice(0, 8)));
}

export function clearRecentSearches(): void {
  localStorage.removeItem(SEARCH_KEY);
}

// ── Basic XSS Sanitization ─────────────────────────────────────
export function sanitize(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/** إزالة علامات التحكم المخفية (RTL/LRM/ALM) اللي بتلزق في النصوص */
export function cleanText(str: string | undefined | null): string {
  if (!str) return "";
  return String(str).replace(/[\u200e\u200f\u061c]/g, "").replace(/\u200d/g, "").replace(/\u200c/g, "").trim();
}

const PHONE_LABEL_RE = /(?:اتصل|واتساب|واتس اب|whatsapp|call|phone|تليفون|محمول|موبايل)\s*(?:على|رقم)?\s*[:-]?\s*/gi;
const PHONE_NUM_RE = /(?:\+?20|0020|0)?1[0125]\d{8}/g;

/**
 * تنظيف عنوان الإعلان:
 * إزالة أرقام الهواتف، منع تكرار "للبيع" أو أي كلمة مكررة،
 * منع المسافات والرموز المكررة، وتوحيد الفواصل.
 */
export function sanitizeTitle(raw: string | undefined | null, maxLen = 120): string {
  let t = cleanText(raw);
  if (!t) return "";

  t = t.replace(PHONE_LABEL_RE, " ");
  t = t.replace(PHONE_NUM_RE, " ");
  t = t.replace(/[٠-٩]{7,}/g, " ");
  t = t.replace(/(?:\d[\s-]?){9,}/g, " ");
  t = t.replace(/\.{3,}|…{2,}|[-–—_]{2,}|\*{2,}/g, " ");
  t = t.replace(/\s{2,}/g, " ").trim();

  // "للبيع للبيع" → "للبيع"
  t = t.replace(/(?:للبيع\s*){2,}/g, "للبيع ");
  // كلمة مكررة ورا بعض
  t = t.replace(/(\S+)(\s+\1)+/g, "$1");

  t = t.replace(/(\s*[-–—|/]+\s*){2,}/g, " - ");
  t = t.replace(/^[\s\-–—|/]+|[\s\-–—|/]+$/g, "").replace(/\s{2,}/g, " ").trim();

  if (t.length > maxLen) t = t.slice(0, maxLen).replace(/[\s\-–—|/]+$/, "").trim();
  return t;
}

/** هل العنوان يحتوي رقم هاتف؟ (لمنع إدخال الرقم في العنوان) */
export function hasPhoneInText(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const t = cleanText(raw);
  if (PHONE_NUM_RE.test(t)) { PHONE_NUM_RE.lastIndex = 0; return true; }
  PHONE_NUM_RE.lastIndex = 0;
  return /[٠-٩]{7,}/.test(t);
}

const ARABIC_TO_LATIN: Record<string, string> = {
  'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's',
  'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'أ': 'a', 'إ': 'i', 'آ': 'a', 'ة': 'a', 'ى': 'a', 'ء': 'a',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function generateSlug(title: string): string {
  let slug = title.toLowerCase().trim();
  slug = slug.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFa-z0-9\s-]/g, '');
  slug = slug.replace(/\s+/g, '-').replace(/-+/g, '-');
  slug = slug.replace(/^-|-$/g, '');
  return slug || 'listing';
}

export function listingUrl(id: string, slug?: string): string {
  return slug ? `/listing/${id}/${slug}` : `/listing/${id}`;
}

export function exhibitionUrl(id: string, name?: string): string {
  return name ? `/exhibitions/${id}/${generateSlug(name)}` : `/exhibitions/${id}`;
}

/** رابط مشاركة جاهز للـ OG (الصورة تظهر في فيسبوك/واتساب) — الإعلان يمر عبر /listing القصير، والباقي عبر /share
 *  v3: كسر كاش فيسبوك/واتساب القديم الذي حفظ صفحات بلا صورة قبل إصلاح الـ OG */
const SHARE_CACHE_VERSION = 'v3';
export function shareUrl(type: string, id: string): string {
  const base = type === 'listing'
    ? `https://carmasr-app.vercel.app/listing/${id}`
    : `https://carmasr-app.vercel.app/share/${type}/${id}`;
  return `${base}?v=${SHARE_CACHE_VERSION}`;
}

/** صورة افتراضية لكل قسم — تُستخدم لو الإعلان بدون صور */
export const DEFAULT_IMAGES: Record<string, string> = {
  trucks: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=900&q=80',
  equipment: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80',
  trailers: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?w=900&q=80',
  buses: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=900&q=80',
  'spare-parts': 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=900&q=80',
  vehicles: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=900&q=80',
};

export function getDefaultImage(category?: string): string {
  const c = (category || 'vehicles').toLowerCase();
  return DEFAULT_IMAGES[c] || DEFAULT_IMAGES.vehicles;
}

/** لو الإعلان معندهوش صور نرجع صورة القسم الافتراضية */
export function ensureImages(images: unknown, category?: string): string[] {
  if (Array.isArray(images) && images.some(Boolean)) return images.filter(Boolean);
  return [getDefaultImage(category)];
}

/** رابط قصير سوبر /s/<رمز> — يُطلب مرة واحدة ويُخزَّن في Firestore */
export async function getShortLink(id: string): Promise<string> {
  try {
    const r = await fetch(`https://carmasr-app.vercel.app/api/shortlink?type=listing&id=${encodeURIComponent(id)}`);
    const d = await r.json();
    if (d && d.success && d.url) return `${d.url}?v=${SHARE_CACHE_VERSION}`;
    return shareUrl('listing', id);
  } catch {
    return shareUrl('listing', id);
  }
}

/** نص إعلان جاهز للصق في جروبات فيسبوك / واتساب */
export function buildAdShareText(l: {
  title?: string; brand?: string; model?: string; year?: string | number;
  condition?: string; governorate?: string; price?: number;
  contactPhone?: string; userPhone?: string; description?: string; facebook?: string;
  url: string; images?: string[];
}, opts?: { withLink?: boolean; withImages?: boolean }): string {
  const price = Number(l.price) ? formatPrice(Number(l.price)) : 'السعر عند المعاينة';
  const phone = l.contactPhone || l.userPhone || '';
  const title = l.title?.trim() || 'متاح في سوق كار مصر CarMasr';
  const spec = [l.brand, l.model].filter(Boolean).join(' ');
  const cond = l.condition ? (l.condition === 'new' ? 'جديد' : 'مستعمل') : '';
  const details = [spec, l.year ? `سنة ${l.year}` : '', cond].filter(Boolean).map(s => `   ▫️ ${s}`).join('\n');
  const lines = [
    `🚛 ${title}`,
    (spec || l.year || cond) ? `مواصفات الإعلان:\n${details}` : '',
    l.governorate ? `📍 المحافظة: ${l.governorate}` : '',
    `💰 السعر: ${price}`,
    l.description ? `📝 ${l.description}` : '',
    phone ? `📞 للاستفسار: ${phone}${l.facebook ? `\n📘 أو فيسبوك: ${l.facebook}` : ''}` : (l.facebook ? `📘 تواصل عبر فيسبوك: ${l.facebook}` : ''),
    // افتراضيًا لا نضع روابط الصور في النص: أول رابط في الرسالة لازم يكون رابط الإعلان
    // حتى يختار واتساب/فيسبوك معاينة الإعلان بالصورة الصحيحة (وليس صورة خام)
    l.images?.length && opts?.withImages === true ? `🖼️ صور المعاينة:\n${l.images.slice(0, 5).map(u => `   ${u}`).join('\n')}` : '',
    opts?.withLink === false ? '' : `🔗 شاهد الإعلان كاملًا على كار مصر CarMasr:\n${l.url}`,
  ];
  return lines.filter(Boolean).join('\n\n');
}

/** تحويل رابط/اسم حساب فيسبوك إلى صيغة @ذكر — بدون رابط (حتى لا يختاره فيسبوك كصورة للبوست) */
export function fbMention(facebook?: string | null | undefined): string {
  const f = String(facebook || '').trim();
  if (!f) return '';
  if (/^@[\w.-]+$/.test(f)) return f;
  const m = f.match(/facebook\.com\/([A-Za-z0-9.-]+)/i);
  if (!m) return '';
  const u = m[1];
  if (/^(profile\.php|people|pages|messages|groups|events|marketplace|watch|reel|photo|video|stories|share)/i.test(u)) return '';
  return '@' + u;
}

/** صيغة بوست صفحة كار مصر الاحترافية — مطابقة لـ facebookPostText في الـ API: نص الإعلان أولاً ثم
    لينك الموقع في آخر سطر (اللينك الوحيد = كارت بصورة العربية)، ومنشن المعلن @ من غير رابط، بدون رقم واتساب */
export function buildAdPageText(l: {
  title?: string; brand?: string; model?: string; year?: string | number;
  governorate?: string; price?: number; advertiserName?: string; facebook?: string;
  url: string;
}): string {
  const title = l.title?.trim() || 'إعلان جديد على كار مصر';
  const price = Number(l.price) ? formatPrice(Number(l.price)) : 'اتصل بنا لمعرفة السعر';
  const specs = [
    l.brand ? `🏷️ ${l.brand}${l.model ? ' ' + l.model : ''}` : '',
    l.year ? `📅 سنة الصنع: ${l.year}` : '',
    l.governorate ? `📍 ${l.governorate}` : '',
    `💰 ${price}`,
  ].filter(Boolean).join('\n');
  const owner = (l.advertiserName || '').trim();
  const mention = fbMention(l.facebook);
  const ownerLine = owner
    ? `👤 المعلن/البائع: ${owner}${mention ? ' ' + mention : ''}`
    : mention ? `👤 المعلن/البائع: ${mention}` : '';
  const parts = [
    `🚛 ${title}`,
    specs,
    '',
    ownerLine,
    '',
    '📲 متاح على تطبيق كار مصر CarMasr',
    '',
    '✨ سوق كار مصر — أكبر سوق للمعدات الثقيلة والنقل في مصر 🇪🇬',
    '',
    '#كار_مصر #سوق_كار_مصر #معدات_ثقيلة #نقل_ثقيل #شاحنات #مقطورات #قطع_غيار #مصر',
    '',
    l.url,
  ];
  return parts.filter(Boolean).join('\n');
}

/** نص تيزر قصير وجذاب يُحَمَّل في منشور/رسالة فيسبوك مع رابط الإعلان */
export function buildAdTeaser(l: {
  title?: string; brand?: string; model?: string; year?: string | number;
  condition?: string; governorate?: string; price?: number;
}): string {
  const title = l.title?.trim() || 'متاح في سوق كار مصر CarMasr';
  const price = Number(l.price) ? formatPrice(Number(l.price)) : 'السعر عند المعاينة';
  const spec = [l.brand, l.model, l.year ? `سنة ${l.year}` : ''].filter(Boolean).join(' ');
  const cond = l.condition ? (l.condition === 'new' ? 'جديد' : 'مستعمل') : '';
  const lead = [title, spec, cond].filter(Boolean).join(' — ');
  return `${lead}\n${l.governorate ? `📍 ${l.governorate} • ` : ''}💰 ${price}`;
}

/** نسخ نص للحافظة مع fallback للجوالات القديمة */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* حالات الرفض — نكمل لـ fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.padding = '0';
    ta.style.border = 'none';
    ta.style.outline = 'none';
    ta.style.boxShadow = 'none';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** مشاركة رابط + نص مع محاولة إرفاق صورة الإعلان كملف حقيقي (واتساب/جوال).
 *  ترجع true لو تمت المشاركة، وfalse لو المتصفح لا يدعم إرفاق الملفات — عندها استخدم رابط wa.me. */
export async function shareWithImage(opts: {
  title?: string;
  text?: string;
  url?: string;
  imageUrl?: string;
}): Promise<boolean> {
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (typeof navigator.share !== 'function' || !opts.imageUrl) return false;
  try {
    const res = await fetch(opts.imageUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (!/^image\//i.test(blob.type)) return false;
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    const file = new File([blob], `tareeq-ad.${ext}`, { type: blob.type });
    if (nav.canShare && !nav.canShare({ files: [file] })) return false;
    // صور فقط: لو مفيش نص/لينك منبعتش الحقول دي عشان البوست يطلع صورة بدون كابشن
    const data: ShareData = { files: [file] };
    if (opts.title) data.title = opts.title;
    if (opts.text) data.text = opts.text;
    if (opts.url) data.url = opts.url;
    try {
      await navigator.share(data);
      return true;
    } catch (err) {
      // المستخدم قفل نافذة المشاركة بنفسه — مانفتحش بديل تلقائيًا
      return (err as Error)?.name === 'AbortError';
    }
  } catch {
    return false;
  }
}

/** فتح منشئ فيسبوك لاختيار الحائط أو الجروب بالرابط جاهز (نافذة منبثقة سريعة الاستجابة) */
export function shareOnFacebook(url: string, quote?: string): void {
  const href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}${quote ? `&quote=${encodeURIComponent(quote)}` : ''}`;
  window.open(href, '_blank', 'noopener');
}

const FB_NON_ACCOUNT_SEG = new Set(['profile.php', 'share', 'sharer', 'groups', 'photo', 'photos', 'reel', 'reels', 'watch', 'events', 'stories', 'people', 'menus', 'pages', 'messages', 'permalink.php', 'php', 'search', 'me', 'home', 'marketplace', 'watchparty', 'checkpoint', 'login.php', 'signup']);

/** استخراج معرّف حساب فيسبوك (اسم مستخدم أو رقم) من أي لينك — منشورات story/permalink/ألبومات تُحل أيضًا لصاحبها */
export function fbAccountId(facebook: string): string {
  const url = String(facebook || '').trim();
  if (!url) return '';
  let m;
  if ((m = url.match(/facebook\.com\/profile\.php\?id=(\d+)/i))) return m[1];
  if ((m = url.match(/facebook\.com\/people\/[^/]+\/(\d+)/i))) return m[1];
  if ((m = url.match(/(?:story|permalink)\.php[^'"?\s]*[?&]id=(\d{6,})/i))) return m[1];
  if ((m = url.match(/[?&]set=a\.(\d{6,})/i))) return m[1];
  if ((m = url.match(/(?:facebook\.com|m\.facebook\.com)\/([A-Za-z0-9._-]+)(?:\/|\?|$)/i))) {
    const seg = m[1];
    return FB_NON_ACCOUNT_SEG.has(seg.toLowerCase()) ? '' : seg;
  }
  if ((m = url.match(/(?:m\.me|messenger\.com\/t)\/([\w.-]+)/i))) return m[1];
  return '';
}

/** رابط محادثة ماسنجر (messages/t يحافظ على الـ emojis) — أو null لو مفيش حساب صالح */
export function messengerMessageTarget(facebook: string, message?: string): string | null {
  const id = fbAccountId(facebook);
  if (!id) return null;
  const txt = message ? encodeURIComponent(message) : '';
  return `https://www.facebook.com/messages/t/${encodeURIComponent(id)}${txt ? '?text=' + txt : ''}`;
}

/** هل اللينك فيسبوك بس (منشور/جروب/روابط تواصل) — للوزر البديل "فتح المعلن على فيسبوك" */
export function isFacebookLink(value: string): boolean {
  return /(?:facebook\.com|fb\.com|m\.facebook\.com)/i.test(String(value || ''));
}
