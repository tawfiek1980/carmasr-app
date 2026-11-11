/**
 * قاموس موحّد لبيانات الإعلانات: أسماء الأنواع والتصنيفات الفرعية.
 * مصدر واحد لكل الكارتات والصفحات عشان المصطلحات ماتختلفش.
 */

export const CATEGORY_NAMES: Record<string, string> = {
  trucks: 'سيارات',
  'half-trucks': 'نصف نقل',
  'quarter-trucks': 'ربع نقل',
  'tractor-heads': 'رؤوس جرارات',
  equipment: 'سيارات',
  excavators: 'حفارات',
  loaders: 'لوادر',
  cranes: 'كرينات',
  bulldozers: 'بلدوزرات',
  forklifts: 'رافعات شوكية',
  trailers: 'سيارات',
  'semi-trailers': 'نصف سيارات',
  tankers: 'تانكرات',
  refrigerated: 'برادات',
  'dump-trucks': 'قلابات',
  flatbeds: 'سطيحات',
  buses: 'حافلات',
  passenger: 'أتوبيس ركاب',
  tourism: 'أتوبيس سياحي',
  minibus: 'ميني باص',
  school: 'أتوبيس مدرسة',
  'spare-parts': 'قطع غيار',
  engine: 'محركات',
  transmission: 'فتيس الحركة',
  brakes: 'فرامل',
  tires: 'إطارات',
  electrical: 'كهربائيات',
  body: 'بدي وكبائن',
  filters: 'فلاتر',
  oils: 'زيوت وشحن',
  loads: 'سيارات',
  jobs: 'وظائف',
  finance: 'تمويل',
  emergency: 'طوارئ',
  services: 'خدمات',
};

/** لو التصنيف الفرعي معروف في القاموس نعرضه، وإلا نرجع لاسم التصنيف نفسه */
export function listingTypeLabel(category?: string | null, subcategory?: string | null): string {
  if (!category) return '';
  const sub = subcategory ? CATEGORY_NAMES[subcategory] : undefined;
  if (sub) return sub;
  return CATEGORY_NAMES[category] || '';
}

/* ─────────── مراجعة اللغة وتوحيد الكتابة ─────────── */

const SPELLING_FIXES: Array<[RegExp, string]> = [
  [/الأستيراد/g, 'الاستيراد'],
  [/أستيراد/g, 'استيراد'],
  [/الإستيراد/g, 'الاستيراد'],
  [/الأستورد/g, 'الاستورد'],
  [/أستورد/g, 'استورد'],
  [/الأستوردة/g, 'الاستوردة'],
];

/** تصحيحات إملائية شائعة + منع المسافات والرموز المكررة */
export function normalizeArabicText(input: string | undefined | null): string {
  if (!input) return '';
  let t = String(input);
  t = t.replace(/\u200e/g, '').replace(/\u200f/g, '').replace(/\u061c/g, '').replace(/\u200d/g, '').replace(/\u200c/g, '');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/\.{3,}|…{2,}|[-–—_]{2,}|\*{2,}/g, ' ');
  t = t.replace(/[ \t]{2,}/g, ' ').trim();
  for (const [re, to] of SPELLING_FIXES) t = t.replace(re, to);
  return t;
}

/** توحيد كتابة أسماء المحافظات */
const GOVERNORATE_ALIASES: Record<string, string> = {
  'القاهره': 'القاهرة',
  'اسوان': 'أسوان',
  'اسيوط': 'أسيوط',
  'الاقصر': 'الأقصر',
  'اسنا': 'أسنا',
  'الغردقه': 'الغردقة',
  'مرسي مطروح': 'مطروح',
  'البحيره': 'البحيرة',
  'المنوفيه': 'المنوفية',
  'الغربيه': 'الغربية',
  'الشرقيه': 'الشرقية',
  'محافظه': 'محافظة',
};

export function normalizeGovernorate(input: string | undefined | null): string {
  if (!input) return '';
  const t = String(input).replace(/\s{2,}/g, ' ').trim();
  return GOVERNORATE_ALIASES[t] || t;
}