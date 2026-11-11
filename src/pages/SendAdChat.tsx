import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Image as ImageIcon, CheckCircle2, Truck, Phone, MapPin, Loader2, X, Copy, Facebook } from 'lucide-react';
import { uploadImages, compressAndWatermark } from '../lib/storageService';
import { buildAdShareText, buildAdTeaser, copyText, shareOnFacebook } from '../lib/utils';
import { getApiUrl } from '../lib/config';
import { optimizeImage } from '../lib/imageUtils';
import { useAuth } from '../contexts/AuthContext';
import { firebaseAuth } from '../firebase';

interface ChatMsg {
  from: 'bot' | 'user';
  text?: string;
  image?: string;
}

type Step =
  | 'welcome' | 'title' | 'titleEdit' | 'type' | 'brand' | 'model' | 'year' | 'condition' | 'governorate'
  | 'price' | 'phone' | 'facebook' | 'advertiser' | 'images' | 'preview' | 'done';

const GOVS = ['القاهرة','الجيزة','الإسكندرية','الدقهلية','البحر الأحمر','البحيرة','الفيوم','الغربية','الإسماعيلية','المنوفية','المنيا','القليوبية','الوادي الجديد','السويس','أسوان','أسيوط','بني سويف','بورسعيد','دمياط','الشرقية','جنوب سيناء','كفر الشيخ','مطروح','الأقصر','قنا','شمال سيناء','سوهاج'];

const BRANDS = ['مرسيدس','مان','فولفو','افيكو','ايفيكو','دايو','ميتسوبيشي','تويوتا','هيونداي','اسكوريا','سكانيا','رينو','ماز','فوتون','جاك'];

type Draft = { title: string; brand: string; model: string; year: string; condition: string; governorate: string; price: number; phone: string; facebook: string; advertiserName: string; description?: string; category?: string; subcategory?: string };

const emptyDraft: Draft = { title: '', brand: '', model: '', year: '', condition: 'used', governorate: '', price: 0, phone: '', facebook: '', advertiserName: '' };

/** نوع المركبة + كلمات الكشف المحلية (سريع بدون AI) */
const TYPE_RULES: { label: string; category: string; subcategory: string; keywords: string[] }[] = [
  { label: 'حفار', category: 'equipment', subcategory: 'excavators', keywords: ['حفار', 'كاتربيلر', 'كات', 'حفاري', 'excavator'] },
  { label: 'لودر', category: 'equipment', subcategory: 'loaders', keywords: ['لودر', 'لوودر', 'ليودر', 'loader', 'شوك'] },
  { label: 'كرين', category: 'equipment', subcategory: 'cranes', keywords: ['كرين', 'كران', 'اوناش', 'رافعة', 'رافعه', 'crane'] },
  { label: 'بلدوزر', category: 'equipment', subcategory: 'bulldozers', keywords: ['بلدوزر', 'بولدوزر', 'جرافة', 'جرافه', 'bulldozer'] },
  { label: 'رافعة شوكية', category: 'equipment', subcategory: 'forklifts', keywords: ['فوركليفت', 'فورك', 'رافعة شوكية', 'رافعة شوكيه', 'forklift'] },
  { label: 'رأس تريلا', category: 'trucks', subcategory: 'tractor-heads', keywords: ['تريلا', 'تريله', 'تريلة', 'جرار', 'راس تريلا', 'رأس تريلا', 'tractor', 'head', 'اكتروس', 'actros', 'اب12', 'اب16'] },
  { label: 'قلاب', category: 'trucks', subcategory: 'dump-trucks', keywords: ['قلاب', 'قلابه', 'هيفو', 'دانغفنغ', 'فاو', 'جاك', 'شاكمان', 'دونغ', 'dump'] },
  { label: 'سطحة', category: 'trucks', subcategory: 'flatbeds', keywords: ['سطحة', 'سطحه', 'سطوح', 'لوبد', 'لو بد', 'flat'] },
  { label: 'براد', category: 'trucks', subcategory: 'refrigerated', keywords: ['براد', 'براده', 'مبرد', 'ثلاجة', 'ثلاجه', 'تبريد', 'refrigerat', 'مجمدة', 'mبرد'] },
  { label: 'تانكر', category: 'trucks', subcategory: 'tankers', keywords: ['تانك', 'تانكر', 'تانكي', 'صهريج', 'تنكة', 'تنكه', 'وقود', 'tank', 'سيارة وقود'] },
  { label: 'مقطورة', category: 'trucks', subcategory: 'trailers', keywords: ['مقطورة', 'مقطوره', 'نصف مقطورة', 'نصف مقطوره', 'عبوة', 'trailer', 'هيكل', 'بضائع', 'مقطوارة'] },
  { label: 'نصف نقل', category: 'trucks', subcategory: 'half-trucks', keywords: ['نصف نقل', 'نص نقل', 'half truck', 'نقل متوسط'] },
  { label: 'ربع نقل', category: 'trucks', subcategory: 'quarter-trucks', keywords: ['ربع نقل', 'quarter truck', 'نقل خفيف'] },
  { label: 'شاحنة / دينا', category: 'trucks', subcategory: '', keywords: ['دينا', 'شاحنة', 'شاحنه', 'نقل', 'بضاعة', 'بضائع', 'لوري', 'لورى', 'نص نقل', 'ربع نقل', 'كونتينر', 'لواري'] },
  { label: 'حافلة', category: 'buses', subcategory: '', keywords: ['باص', 'حافلة', 'حافله', 'كوستر', 'ميكروباص', 'ميني باص', 'bus', 'فان', 'اتوبيس', 'أوتوبيس', 'اتوبيس'] },
];

/** كشف نوع المركبة محلياً من النص (يهدف للسرعة، ولو مش موجود يسأل المستخدم) */
function detectVehicleType(text: string): { category: string; subcategory: string; label: string } | null {
  const n = arNormLight(text);
  for (const rule of TYPE_RULES) {
    if (rule.keywords.some((k) => n.includes(arNormLight(k)))) {
      return { category: rule.category, subcategory: rule.subcategory, label: rule.label };
    }
  }
  return null;
}
function arNormLight(s: string) {
  return String(s || '')
    .replace(/[أإآ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه').replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/** عنوان فيسبوك غالبًا اسم جروب/سوق/صفحة مش محتوى الإعلان */
const GROUP_TITLE_RE = /(?:^|[\s|،,])(?:سوق|جروب|مجموع(?:ة|ه)|بيدج|صفح(?:ة|ه)|معرض|لتجارة|للتجارة|أ?كبر|جميع\s+أنواع|للبيع\s+والشراء|بيع\s+و\s*شرا|market|group|souq|دليل|إعلانات\s+مبوبة)(?:[\s|،,]|$)/i;
function looksLikeGroupTitle(s: string): boolean {
  // eslint-disable-next-line no-misleading-character-class
  const norm = String(s || '').replace(/[\u0640\u064B-\u065F]/g, '').replace(/[^\u0600-\u06FF\s]/g, ' ');
  return GROUP_TITLE_RE.test(norm);
}

/** اختيارات يدوية تظهر للمستخدم لو الذكاء مش متأكد من نوع المركبة */
const TYPE_CHOICES: { label: string; category: string; subcategory: string }[] = [
  { label: 'رأس تريلا', category: 'trucks', subcategory: 'tractor-heads' },
  { label: 'قلاب', category: 'trucks', subcategory: 'dump-trucks' },
  { label: 'سطحة / لوبد', category: 'trucks', subcategory: 'flatbeds' },
  { label: 'براد', category: 'trucks', subcategory: 'refrigerated' },
  { label: 'تانكر', category: 'trucks', subcategory: 'tankers' },
  { label: 'مقطورة / نصف مقطورة', category: 'trucks', subcategory: 'trailers' },
  { label: 'نصف نقل', category: 'trucks', subcategory: 'half-trucks' },
  { label: 'ربع نقل', category: 'trucks', subcategory: 'quarter-trucks' },
  { label: 'دينا / نقل خفيف', category: 'trucks', subcategory: '' },
  { label: 'لوادر', category: 'equipment', subcategory: 'loaders' },
  { label: 'حفارات', category: 'equipment', subcategory: 'excavators' },
  { label: 'كرينات', category: 'equipment', subcategory: 'cranes' },
  { label: 'بلدوزرات', category: 'equipment', subcategory: 'bulldozers' },
  { label: 'رافعات شوكية', category: 'equipment', subcategory: 'forklifts' },
  { label: 'حافلة / باص', category: 'buses', subcategory: 'passenger' },
  { label: 'قطع غيار', category: 'spare-parts', subcategory: '' },
];
const SUB_LABELS: Record<string, string> = {
  'tractor-heads': 'رأس تريلا', 'dump-trucks': 'قلاب', flatbeds: 'سطحة / لوبد',
  refrigerated: 'براد', tankers: 'تانكر', trailers: 'مقطورة',
  'half-trucks': 'نصف نقل', 'quarter-trucks': 'ربع نقل',
  loaders: 'لودر', excavators: 'حفار', cranes: 'كرين', bulldozers: 'بلدوزر',
  forklifts: 'رافعة شوكية',
};
const CAT_LABELS: Record<string, string> = {
  trucks: '🚛 شاحنة', equipment: '🏗️ معدة ثقيلة', buses: '🚌 حافلة', 'spare-parts': '🔧 قطع غيار',
};

const toLatin = (s: string) =>
  s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
   .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

function quickParse(text: string) {
  const t = toLatin(text);
  const out: Partial<Draft> = {
    description: text.trim().slice(0, 6000),
    title: text.split('\n')[0].slice(0, 60),
  };
  const phoneM = t.match(/01[0125]\d{8}/);
  if (phoneM) out.phone = phoneM[0];
  const urlM = t.match(/https?:\/\/\S+/i);
  if (urlM) out.facebook = urlM[0];
  const yearM = [...t.matchAll(/\b(19|20)\d{2}\b/g)].map(m => +m[0]).find(y => y >= 1960 && y <= 2026);
  if (yearM) out.year = String(yearM);
  const nums = [...t.matchAll(/\b\d{4,9}\b(?![\u0640-\u06FF])/g)].map(m => parseInt(m[0], 10)).filter(n => n >= 10000);
  if (nums.length) out.price = Math.max(...nums);
  for (const b of BRANDS) if (text.includes(b)) { out.brand = b; break; }
  for (const g of GOVS) if (text.includes(g)) { out.governorate = g; break; }
  const vt = detectVehicleType(text);
  if (vt) { out.category = vt.category; out.subcategory = vt.subcategory; }
  return out;
}

export default function SendAdChat({ directPublish = false }: { directPublish?: boolean }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState<Step>('welcome');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [images, setImages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; waLink?: string; msLink?: string; message?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [typePending, setTypePending] = useState<{ draft: Draft; minimal: boolean; freshImages: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const botSay = (text: string) => setMsgs(m => [...m, { from: 'bot', text }]);
  const userSay = (text: string) => setMsgs(m => [...m, { from: 'user', text }]);
  const botImages = (urls: string[]) => {
    setMsgs(m => [...m, { from: 'bot', text: `🖼️ ${urls.length} صورة مسحوبة من الرابط:` }]);
    for (const u of urls.slice(0, 4)) setMsgs(m => [...m, { from: 'bot' as const, image: u }]);
  };
  const fit = (t: string) => t.replace(/[^\d]/g, '');

  const aiExtract = async (source: string): Promise<Partial<Draft> | null> => {
    try {
      setError('');
      const api = `${getApiUrl()}/ai/index`;
      const resp = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract-ad', text: String(source).slice(0, 6000) }),
      });
      const data = await resp.json();
      if (!data.ok || !data.draft) return null;
      const d = data.draft;
      return {
        title: typeof d.title === 'string' ? d.title.trim().slice(0, 90) : '',
        brand: typeof d.brand === 'string' ? d.brand.trim() : '',
        model: typeof d.model === 'string' ? d.model.trim() : '',
        year: typeof d.year === 'string' ? d.year.trim().slice(0, 4) : '',
        condition: d.condition === 'new' ? 'new' : 'used',
        governorate: typeof d.governorate === 'string' ? d.governorate.trim() : '',
        price: typeof d.price === 'number' && d.price > 0 ? d.price : 0,
        phone: typeof d.phone === 'string' ? d.phone.trim() : '',
        facebook: typeof d.facebook === 'string' ? d.facebook.trim() : '',
        advertiserName: typeof d.advertiserName === 'string' ? d.advertiserName.trim() : '',
        description: typeof d.description === 'string' ? d.description.trim() : '',
        category: typeof d.category === 'string' ? d.category.trim() : '',
        subcategory: typeof d.subcategory === 'string' ? d.subcategory.trim() : '',
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (step === 'welcome') {
      botSay('أهلاً بك في كار مصر CarMasr 🚛');
      botSay('اكتب إعلان عربيتك في دقيقة وهيظهر على الموقع بعد مراجعة سريعة 💪');
      botSay('⚡ النشر السريع الجديد: اكتب أو ألصق أي حاجة وحدة بس — زي "فولفو 2020 في القاهرة 550000" — والذكاء الاصطناعي يجهّز إعلانك كامل ✨');
      botSay('أولاً: اكتب اسم/نوع العربية\nمثال: رأس تريلا مرسيدس أكتروس 2018');
      setStep('title');
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, step]);

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    try {
      setUploading(true);
      setError('');
      const processed: File[] = [];
      for (const f of Array.from(files).slice(0, 10 - images.length)) {
        processed.push(await compressAndWatermark(f, 1200, draft.phone || undefined));
      }
      const urls = await uploadImages(processed, 'listings', user?.id || 'guest');
      setImages(prev => [...prev, ...urls].slice(0, 10));
      botSay(`تم استلام ${urls.length} صورة ✅ — إجمالي ${Math.min(images.length + urls.length, 10)}`);
      if (step === 'images') {
        botSay(images.length + urls.length >= 10 ? 'وصلنا للحد الأقصى (10 صور).\nتأكيد بالضغط على زر "النشر" أو اكتب رقم التليفون:' : 'كمل صور أو اكتب رقم التليفون:');
      }
    } catch (e: any) {
      setError(e?.message || 'فشل رفع الصور');
    } finally {
      setUploading(false);
    }
  };

  // ختم الصور المسحوبة بالسيرفر (sharp + خط عربي مضمّن) — بيمشي حتى للصور اللي المتصفح ميقدرش يجيبها بسبب CORS
  const watermarkServer = async (urls: string[], phone?: string): Promise<string[]> => {
    if (!urls.length) return urls;
    try {
      const api = `${getApiUrl()}/send-ad`;
      const resp = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'watermark', images: urls.slice(0, 8), phone: phone || '' }),
      });
      const data = await resp.json();
      if (data.success && Array.isArray(data.images)) return data.images;
    } catch {}
    return urls;
  };

  const rehostImages = async (imgUrls: string[], phone?: string): Promise<string[]> => {
    if (!imgUrls.length) return [];
    let hosted: string[] = [];
    try {
      const api = `${getApiUrl()}/send-ad`;
      const resp = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', text: imgUrls.join('\n') }),
      });
      const data = await resp.json();
      if (data.success && Array.isArray(data.images)) hosted = data.images;
    } catch {}
    if (!hosted.length) return [];
    return watermarkServer(hosted, phone);
  };

  const grabFromLink = async (url: string): Promise<{ draft: Draft; images: string[]; walled?: boolean } | null> => {
    try {
      const api = `${getApiUrl()}/send-ad`;
      const resp = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', url }),
      });
      const data = await resp.json();
      if (data.success) {
        // حائط تسجيل دخول من فيسبوك (منشور خاص/جروب): العنوان والوصف هيبقوا صفجة تسجيل الدخول نفسها — ماتتخزنش
        const walled = /تسجيل الدخول|استكشف الأشياء|Log [Ii]n|login|Forgot (?:account|password)|Create New Account|New Account/i.test(`${data.title || ''} ${data.description || ''}`.slice(0, 2500));
        if (walled) return { draft: { ...draft }, images: [], walled: true };
        const srcText = `${data.title || ''}\n${data.description || ''}`;
        const parsed = quickParse(srcText);
        const filled: Draft = {
          ...draft,
          title: data.title && String(data.title).trim().length >= 3 ? String(data.title).trim() : parsed.title || draft.title,
          description: (data.description || parsed.description || '').trim(),
          brand: parsed.brand || draft.brand,
          model: parsed.model || draft.model,
          year: parsed.year || draft.year,
          price: parsed.price || draft.price,
          phone: parsed.phone || draft.phone || (typeof data.phone === 'string' ? data.phone.replace(/[^\d+]/g, '') : ''),
          governorate: parsed.governorate || draft.governorate,
          facebook: (typeof data.author === 'string' && /^https?:\/\/\S+/i.test(data.author) ? data.author.trim() : '') || url,
        };
        setDraft(filled);
        let fresh: string[] = [];
        if (Array.isArray(data.images) && data.images.length) {
          const stamped = await watermarkServer(data.images, filled.phone);
          fresh = [...new Set([...images, ...stamped])].slice(0, 10);
          setImages(fresh);
          botImages(stamped);
        }
        return { draft: filled, images: fresh };
      }
      return null;
    } catch {
      return null;
    }
  };

  const previewText = (imgs: string[] = images) => {
    const d = draft;
    const priceShown = d.price && d.price !== 0
      ? d.price.toLocaleString('ar-EG') + ' جنيه'
      : '⚠️ السعر عند المعاينة (0)';
    const typeLabel = d.category ? `${CAT_LABELS[d.category] || d.category}${d.subcategory ? ` (${SUB_LABELS[d.subcategory] || d.subcategory})` : ''}` : '';
    return `🖼️ معاينة إعلانك:
━━━━━━━━━━━━
🚛 ${d.title || '-'}
${typeLabel ? '🚚 النوع: ' + typeLabel + '\n' : ''}🏷️ ${d.brand || '-'}${d.model ? ' ' + d.model : ''}${d.year ? ' • ' + d.year : ''} • ${d.condition === 'new' ? 'جديد' : 'مستعمل'}
📍 ${d.governorate || '-'}
💰 ${priceShown}
📞 ${d.phone || '-'}
🏪 ${d.advertiserName || '(اسم المعلن اختياري — اكتب: المعلن لإضافته)'}
📘 ${d.facebook ? 'لينك الفيسبوك محفوظ ✓' : '(بدون رابط فيسبوك)'}${d.description ? '\n\n📝 ' + d.description.slice(0, 6000) : ''}
🖼️ الصور: ${imgs.length}
━━━━━━━━━━━━`;
  };

  const submit = async () => {
    setSending(true);
    setError('');
    try {
      const api = `${getApiUrl()}/send-ad`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.type === 'admin') {
        try {
          const cur = firebaseAuth.currentUser;
          const t = await cur?.getIdToken();
          if (t) headers.Authorization = `Bearer ${t}`;
        } catch {}
      }
      const resp = await fetch(api, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || '',
          price: draft.price,
          governorate: draft.governorate,
          location: '',
          images,
          phone: draft.phone,
          contactPhone: draft.phone,
          userName: user?.name || draft.phone,
          brand: draft.brand,
          model: draft.model,
          year: Number(draft.year) || undefined,
          condition: draft.condition,
          facebook: draft.facebook || undefined,
          advertiserName: draft.advertiserName.trim() || undefined,
          category: draft.category || 'trucks',
          subcategory: draft.subcategory || '',
          listingType: 'sell',
          ...(directPublish ? { status: 'active' } : {}),
        }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message);
      setResult({ url: data.listing.url, waLink: data.contact?.waLink, msLink: data.contact?.msLink, message: data.contact?.message });
      setStep('done');
      botSay(directPublish
        ? '🎉 تم نشر إعلانك مباشرة على الموقع!\n\nشكراً لاستخدامك كار مصر CarMasr 🚛'
        : '🎉 تم استلام إعلانك بنجاح!\n\nستظهر بعد مراجعة سريعة من إدارة الموقع.\nشكراً لاستخدامك كار مصر CarMasr 🚛');
    } catch (e: any) {
      setError(e?.message || 'حصل خطأ، حاول مجددًا');
    } finally {
      setSending(false);
    }
  };

  // يُكمل الخطوات: في الوضع اليدوي يسأل كل التفاصيل، وفي وضع اللصق (minimal) يكمل فقط الحرجة:
  // العنوان + السعر + التليفون + المحافظة. الماركة/الموديل/السنة/الحالة اختيارية تُعبى إن وُجدت.
  const goNext = (updated: Draft, minimal = false, freshImages: string[] = images) => {
    setDraft(updated);
    if (!updated.title.trim()) { botSay('اكتب اسم العربية أو الصق رابط الإعلان'); setStep('title'); return; }
    if (!updated.category) {
      setTypePending({ draft: updated, minimal, freshImages });
      botSay('🚛 مش متأكد من نوع المركبة — اختار من الأزرار أو اكتب النوع بنفسك:\nمثال: "رأس تريلا / قلاب / لودر / دينا / أي عربية"');
      setStep('type');
      return;
    }
    if (!minimal) {
      if (!updated.brand.trim()) { botSay('الماركة: اكتبها\nمثال: مرسيدس'); setStep('brand'); return; }
      if (!updated.model.trim()) { botSay('الموديل: اكتبه\nمثال: أكتروس'); setStep('model'); return; }
      if (!updated.year.trim()) { botSay('سنة الصنع: اكتب السنة\nمثال: 2018'); setStep('year'); return; }
    } else {
      const hasBrand = updated.brand.trim();
      const hasModel = updated.model.trim();
      const hasYear = updated.year.trim();
      if (!hasBrand || !hasModel || !hasYear) {
        const missing: string[] = [];
        if (!hasBrand) missing.push('🏷️ الماركة');
        if (!hasModel) missing.push('🚚 الموديل');
        if (!hasYear) missing.push('📅 السنة');
        botSay(`ℹ️ (اختياري) تقدر تكمّل دي لو حابب — أو تخطيها بأي رد:\n${missing.join('\n')}`);
      }
    }
    if (Number.isNaN(Number(updated.price)) || Number(updated.price) < 0) { botSay('السعر بالجنيه 💰\nاكتب السعر، أو اكتب 0 لو حابب تحدد السعر عند المعاينة'); setStep('price'); return; }
    if (updated.phone.replace(/[^\d+]/g, '').length < 10) { botSay('رقم التليفون: اكتبه للتواصل'); setStep('phone'); return; }
    if (!updated.governorate.trim()) { botSay('المحافظة: اكتبها\nمثال: القاهرة'); setStep('governorate'); return; }
    if (images.length === 0 && freshImages.length === 0) {
      botSay('📷 أرسل صور العربية الآن (حتى 10 صور) — بالزر الأزرق تحت، ثم اكتب "معاينة"');
      setStep('images');
      return;
    }
    botSay(previewText(freshImages));
    botSay('اضغط زر "إرسال الإعلان" بالأسفل للتأكيد ✅');
    setStep('preview');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    if (step === 'done') return;

    userSay(text);
    setInput('');

    switch (step) {
      case 'title': {
        if (text.length < 3) { botSay('اكتب اسم العربية أو الصق رابط الإعلان بشكل أوضح'); break; }

        const isLink = /^https?:\/\//i.test(text) || /\bhttps?:\/\/\S+/i.test(text);
        const urlMatch = text.match(/https?:\/\/\S+/i);

        // 1) جلب من الرابط (بيانات + صور) لو النص فيه رابط
        let grabbed: { draft: Draft; images: string[]; walled?: boolean } | null = null;
        if (urlMatch) {
          setError('');
          botSay('🔗 تمام، هسحب بيانات الإعلان والصور من الرابط أوتوماتيك...');
          try {
            grabbed = (await grabFromLink(urlMatch[0]));
            if (grabbed && grabbed.walled && !grabbed.images.length) {
              botSay('🚫 المنشور ده فيسبوك مخبيه ورا تسجيل دخول (منشور خاص/جروب) — مفيش طريقة نجيب صوره أو كلامه من غير تسجيل دخول.\nأسرع حل: ارفع صور العربية بالزر الأزرق واكتب التفاصيل — أو الصق رابط منشور عام من صفحة/بروفايل مفتوح، أو رابط صورة مباشر بينتهي بـ .jpg/.png');
            } else if (grabbed && grabbed.draft.title) {
              botSay(`✅ اتمسكت الإعلان:\n"${grabbed.draft.title.slice(0, 60)}"\n🖼️ صور سحبتها: ${grabbed.images.length}`);
              if (grabbed.draft.description) botSay(grabbed.draft.description.slice(0, 6000));
              if (grabbed.images.length === 0) botSay('⚠️ الفيسبوك بيمنع سحب الصور في أغلب الأحيان — تقدر ترفعها بالزر تحت');
            } else {
              botSay(/facebook\.com|fb\.com|fb\.watch/i.test(text)
                ? '⚠️ فيسبوك رفض يفتح البوست لسيرفر التطبيق دلوقتي (حجب مؤقت من فيسبوك، مش مشكلة عندك).\nالحل الأسرع: انسخ كلام البوست كله والصقه هنا — هجهّزه أوتوماتيك، وارفع صور العربية.'
                : '⚠️ مقدرتش أجيب بيانات من الرابط — هجرب الذكاء الاصطناعي على الكلام المكتوب');
            }
          } catch {
            botSay('⚠️ حصل خطأ في جلب الرابط — هجرب الذكاء الاصطناعي على الكلام المكتوب');
          }
        }

        // 2) صور مذكورة كمباشرة في النص (لو موجودة)
        const imgLinks = text.match(/https?:\/\/\S+\.(?:jpe?g|png|webp|gif)(?:\?[^\s"']*)?/gi) || [];
        let freshImgs: string[] = grabbed && grabbed.images ? [...grabbed.images] : [];
        if (imgLinks.length) {
          botSay(`🖼️ لقيت ${imgLinks.length} رابط صورة في النص — بنرفعها تلقائيًا...`);
          const hosted = await rehostImages([...new Set(imgLinks)].slice(0, 8), draft.phone || undefined);
          if (hosted.length) {
            freshImgs = [...new Set([...images, ...hosted])].slice(0, 10);
            setImages(freshImgs);
            botSay(`✅ اترفعت ${hosted.length} صورة تلقائيًا`);
          } else {
            botSay('⚠️ الروابط موجودة بس مقدرتش أرفعها — ارفعها بالزر الأزرق تحت');
          }
        }

        // 3) ✨ الذكاء الاصطناعي يشتغل على الكلام المكتوب، ولو المستخدم لصق رابط فقط يشتغل على نص الإعلان المسحوب (ليطلع عنوان بنوع العربية)
        const textWithoutLink = urlMatch ? text.replace(urlMatch[0], '') : text;
        const aiSource = textWithoutLink.trim().length >= 8
          ? text
          : (grabbed?.draft?.description || grabbed?.draft?.title || '');
        setAiBusy(true);
        const aiDraft = aiSource.trim().length >= 12 ? await aiExtract(aiSource) : null;
        setAiBusy(false);

        const coreCount = aiDraft
          ? [aiDraft.brand, aiDraft.model, aiDraft.year, aiDraft.price ? aiDraft.price : '', aiDraft.governorate].filter(Boolean).length
          : 0;
        // استخدم بيانات الـ AI لو حققت الحد المطلوب، أو لو الإعلان مسحوب من رابط (وقتها يكمّل الحقول)
        const grabbedTitleWeak = !!grabbed && (!grabbed.draft.title || looksLikeGroupTitle(grabbed.draft.title));
        if (aiDraft && aiDraft.title && aiDraft.title.trim().length >= 3 && (coreCount >= 1 || !!grabbed)) {
          // الوصف: احتفظ بأطول نص بين (نص الرابط / ناتج الـ AI / النص المُلصق الأصلي) حتى لا يختصر الـ AI تفاصيل الإعلان
          const grabbedDesc = grabbed?.draft?.description || '';
          const origDesc = textWithoutLink.trim();
          const merged: Draft = { ...(grabbed?.draft || {}), ...aiDraft } as Draft;
          const longest = [grabbedDesc, aiDraft.description || '', origDesc].filter(Boolean).reduce((a, b) => (b.length > a.length ? b : a), '');
          if (longest) merged.description = longest;
          // العنوان = أول سطر من البوست المسحوب كما هو (بلا تخمين الـ AI)، إلا لو كان اسم جروب/سوق
          if (grabbed && grabbed.draft.title && !grabbedTitleWeak) merged.title = grabbed.draft.title;
          const updated = { ...draft, ...merged } as Draft;
          setDraft(updated);
          const coreLine = [updated.brand, updated.model, updated.year].filter(Boolean).join(' ') || '—';
          if (grabbed) {
            // نص البوست ظهر مرة واحدة فوق — هنا نعرض بس الحقول اللي الـ AI كمّلها (بلا تكرار)
            botSay(`✨ الذكاء الاصطناعي كمّل بيانات الإعلان: ${coreLine}`);
          } else {
            botSay(`✨ الذكاء الاصطناعي جهّز إعلانك:\n🗒️ ${updated.title}\n${coreLine}`);
            if (updated.description) botSay(`📝 ${updated.description}`);
          }
          goNext(updated, true, freshImgs);
          break;
        }

        // 4) بيانات الرابط لو نجح والذكاء ما قربش (ما فيش نص كافي أو النتيجة ضعيفة) — مع تجاهل الحائط
        if (grabbed && !grabbed.walled && grabbed.draft.title) {
          // النص الحقيقي = وصف مختلف عن العنوان. لما يتساووا غالبًا الوصف هو اسم الجروب مش كلام البوست
          const realText = !!grabbed.draft.description && grabbed.draft.description !== grabbed.draft.title;
          // خذ بيانات الرابط مباشرة لو فيه نص حقيقي، أو لو ما فيهاش صور أصلاً (ما فيش نص ولا صور = خلنا الجراب ده ثروة)
          if (realText || !(urlMatch && freshImgs.length)) {
            goNext({ ...draft, ...grabbed.draft } as Draft, true, freshImgs);
            break;
          }
          // صور اتسحبت لكن فيسبوك خبّى نص البوست (بوستات الجروبات/الخاصة محتاجة تسجيل دخول) — كمّل يدوي
          setDraft(d => ({ ...d, title: '', description: '' }));
          botSay(`🖼️ اتسحبت ${freshImgs.length} صورة من البوست، لكن فيسبوك مخبي كلام البوست (منشورات الجروبات والخاصة محتاجة تسجيل دخول) — اكتب بنفسك وصف الإعلان.\nمثال: "رأس تريلا مرسيدس أكتروس 2018"`);
        }

        // 5) لصقة كاملة عادية
        if (text.includes('\n') || text.length > 60) {
          const parsed = quickParse(text);
          const updated = { ...draft, ...parsed } as Draft;
          setDraft(updated);
          const parts: string[] = [];
          if (!updated.governorate) parts.push('📍 المحافظة ناقصة');
          if (!updated.phone) parts.push('📞 التليفون ناقص');
          if (Number.isNaN(Number(updated.price)) || Number(updated.price) < 0) parts.push('💰 السعر ناقص');
          if (!updated.brand) parts.push('🏷️ الماركة ناقصة');
          if (!updated.year) parts.push('📅 السنة ناقصة');
          botSay(`✅ تمام، استخرجت بيانات إعلانك:\n🗒️ العنوان: ${updated.title || '-'}\n${updated.brand ? '🏷️ ' + updated.brand : ''} ${updated.year ? updated.year : ''}\n📍 ${updated.governorate || '(ناقص)'}\n📞 ${updated.phone || '(ناقص)'}\n💰 ${updated.price ? updated.price.toLocaleString('ar-EG') + ' جنيه' : '(ناقص)'}`);
          if (parts.length) botSay('⚠️ المطلوب منك إكماله:\n' + parts.join('\n'));
          goNext(updated, true, freshImgs);
          break;
        }

        // 6) إدخال يدوي قصير
        if (urlMatch) {
          if (/facebook\.com|fb\.com|fb\.watch/i.test(text)) {
            botSay('⚠️ فيسبوك رفض يفتح البوست لسيرفر التطبيق (حجب مؤقت، مش مشكلة عندك).\nانسخ كلام البوست كله والصقه هنا في الشات — هجهّزه أوتوماتيك، أو ارفع صورة العربية واكتب التفاصيل.');
            setStep('title');
            break;
          }
          botSay('الماركة: اكتبها\nمثال: مرسيدس'); setStep('brand'); break;
        }
        setDraft(d => ({ ...d, title: text }));
        botSay(`تمام: "${text}"`);
        botSay('الماركة: اكتبها\nمثال: مرسيدس');
        setStep('brand');
        break;
      }

      case 'titleEdit': {
        const t = text.trim().slice(0, 120);
        if (t.length < 3) { botSay('اكتب عنوان أوضح (3 حروف على الأقل)'); break; }
        setDraft(d => ({ ...d, title: t }));
        botSay(`✅ تم تعديل العنوان:\n"${t}"`);
        botSay(previewText());
        botSay('اضغط زر "إرسال الإعلان" بالأسفل للتأكيد ✅');
        setStep('preview');
        break;
      }

      case 'type': {
        // اختيار يدوي: يطابق النص مع القائمة أو يكتشف محلياً، ثم يكمل من البند المعلّق
        const n = arNormLight(text);
        let cat = '';
        let sub = '';
        const f = TYPE_CHOICES.find(c => n === arNormLight(c.label) || n.includes(arNormLight(c.label)) || arNormLight(c.label).includes(n));
        const ln = detectVehicleType(text);
        if (f) { cat = f.category; sub = f.subcategory; }
        else if (ln) { cat = ln.category; sub = ln.subcategory; }
        else if (/(أي عربية|أى عربية|أي عربيه|اى عربيه|أي|عام|عادي|نقل)/i.test(text)) { cat = 'trucks'; sub = ''; }
        else { botSay('حادد أكثر شوية — اكتب نوع واضح، مثلاً: "رأس تريلا / قلاب / لودر / دينا / أي عربية"'); break; }
        const base = typePending?.draft || draft;
        const updated = { ...base, category: cat, subcategory: sub } as Draft;
        setDraft(updated);
        const label = f ? f.label : (SUB_LABELS[sub] || CAT_LABELS[cat] || ln?.label || 'نوع محدد');
        botSay(`✅ تم تحديد النوع: ${CAT_LABELS[cat] || ''} ${label}\nنكمل بقية البيانات...`);
        const minimal = typePending?.minimal ?? false;
        const freshImgs = typePending?.freshImages ?? images;
        setTypePending(null);
        goNext(updated, minimal, freshImgs);
        break;
      }

      case 'advertiser':
        if (/^(لا|بدون|none|حذف|skipped)/i.test(text)) {
          setDraft(d => ({ ...d, advertiserName: '' }));
          botSay('✅ اتحذف اسم المعلن');
        } else {
          setDraft(d => ({ ...d, advertiserName: text.trim().slice(0, 60) }));
          botSay('✅ تم حفظ اسم المعلن (معرض/فرد)');
        }
        botSay(previewText());
        botSay('اضغط زر "إرسال الإعلان" بالأسفل للتأكيد ✅');
        setStep('preview');
        break;

      case 'brand':
        goNext({ ...draft, brand: text });
        break;

      case 'model':
        goNext({ ...draft, model: text });
        break;

      case 'year': {
        const year = parseInt(fit(text), 10);
        if (Number.isNaN(year) || year < 1960 || year > 2026) { botSay('اكتب سنة صحيحة (مثال: 2018)'); break; }
        goNext({ ...draft, year: String(year) });
        break;
      }

      case 'condition':
        goNext({ ...draft, condition: /جديد|new/i.test(text) ? 'new' : 'used' });
        break;

      case 'governorate':
        goNext({ ...draft, governorate: text });
        break;

      case 'price': {
        const isContact = /اتصال|تفاوض|تواصل/i.test(text);
        const price = isContact ? 0 : parseInt(fit(text), 10);
        if (!isContact && Number.isNaN(price)) { botSay('اكتب رقم — مثال: 350000'); break; }
        if (price === 0) {
          botSay('✅ تمام، مكتوب "السعر عند المعاينة" وسنكمل بقية الخطوات.');
        } else {
          botSay(`السعر ${price.toLocaleString('ar-EG')} جنيه 💰`);
        }
        goNext({ ...draft, price });
        break;
      }

      case 'phone': {
        const phone = text.replace(/[^\d+]/g, '');
        if (phone.length < 10) { botSay('اكتب رقم تليفون صحيح (10-14 رقم)'); break; }
        botSay('✅ ممتاز');
        goNext({ ...draft, phone });
        break;
      }

      case 'facebook':
        if (!/^(مش عندي|لا|skipped|none|بدون)/i.test(text)) {
          setDraft(d => ({ ...d, facebook: text }));
          botSay('📘 تم حفظ الرابط');
        } else {
          botSay('✅ بدون رابط فيسبوك');
        }
        botSay('📷 أرسل صور العربية الآن (حتى 10 صور) — بالزر الأزرق تحت.\nثم اضغط "المعاينة"');
        setStep('images');
        break;

      case 'images':
      case 'preview':
        if (/المعاينة|معاينة|النشر|نشر|تأكيد|نعم|yes/i.test(text)) {
          if (step === 'preview' || images.length > 0 || /المعاينة|معاينة/i.test(text)) {
            botSay(previewText());
            botSay('اضغط زر "إرسال الإعلان" بالأسفل للتأكيد ✅');
            setStep('preview');
          } else {
            botSay('أرسل صورة على الأقل أولاً 📷');
          }
        } else if (step === 'preview') {
          const kws = /(المحافظة|المحافظه)/i.test(text) ? 'governorate'
            : /(تليفون|رقم)/i.test(text) ? 'phone'
            : /(سعر)/i.test(text) ? 'price'
            : /(عنوان|اسم الإعلان|اسم الاعلان|العنوان)/i.test(text) ? 'titleEdit'
            : /(اسم المعلن|المعلن)/i.test(text) ? 'advertiser'
            : /(ماركة|الماركة)/i.test(text) ? 'brand'
            : /(موديل|الموديل)/i.test(text) ? 'model'
            : /(سنة|السنة)/i.test(text) ? 'year'
            : /(رابط|الفيس|فيس)/i.test(text) ? 'facebook'
            : null;
          if (kws) {
            const prompts: Record<string, string> = {
              governorate: 'المحافظة: اكتبها\nمثال: القاهرة',
              phone: 'رقم التليفون: اكتبه للتواصل',
              price: 'السعر بالجنيه 💰\nاكتب السعر، أو اكتب 0 لو حابب تحدد السعر عند المعاينة',
              titleEdit: 'العنوان الجديد: اكتبه — بيظهر وبيتكتب في رابط الإعلان',
              advertiser: 'اسم المعلن (معرض أو فرد): اكتبه\nمثال: معرض النور للشاحنات (أو اكتب "لا" لحذفه)',
              brand: 'الماركة: اكتبها\nمثال: مرسيدس',
              model: 'الموديل: اكتبه\nمثال: أكتروس',
              year: 'سنة الصنع: اكتب السنة\nمثال: 2018',
              facebook: 'رابط فيسبوك صاحب الإعلان: الصقه (أو اكتب "لا")',
            };
            botSay(`🛠️ عدّل الحقل ثم اكتب القيمة الجديدة:\n${prompts[kws]}`);
            setStep(kws);
          } else {
            botSay('اضغط زر "إرسال الإعلان" بالأسفل، أو اكتب اسم الحقل للتعديل 🛠️ (العنوان/المعلن/المحافظة/التليفون/السعر/الماركة/الموديل/السنة)');
          }
        } else {
          botSay('لو خلصت اكتب "معاينة" للعرض النهائي 📋');
        }
        break;

      default:
        break;
    }
  };

  const btnLabel = step === 'preview' || step === 'done' ? 'إرسال الإعلان 📤' : 'المعاينة 👀';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-bg to-[#132a45] flex flex-col" dir="rtl">
      <header className="bg-[#0d1f38]/80 border-b border-white/5 px-4 py-3 flex items-center gap-3 sticky top-0 z-20 backdrop-blur">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange to-orange-600 flex items-center justify-center font-black text-white">ط</div>
        <div className="flex-1">
          <h1 className="text-white font-bold text-sm">كار مصر CarMasr — إرسال إعلان</h1>
          <p className="text-white/40 text-xs">بوت النشر السريع</p>
        </div>
        <Link to="/" className="text-white/50 text-xs hover:text-white px-3 py-1.5 rounded-lg border border-white/10">رجوع</Link>
      </header>

      <div className="flex-1 max-w-xl w-full mx-auto px-4 py-4 space-y-3 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'user' ? 'justify-start flex-row-reverse' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line shadow-sm ${
              m.from === 'user'
                ? 'bg-orange text-white rounded-bl-sm'
                : 'bg-white/5 text-white/90 border border-white/10 rounded-br-sm'
            }`}>
              {m.text}
              {m.image && <img src={optimizeImage(m.image, 'medium')} alt="" className="mt-2 rounded-lg border border-white/10 max-h-48 w-full object-cover" />}
            </div>
          </div>
        ))}

        {uploading && (
          <div className="flex justify-start">
            <div className="bg-white/5 text-white/70 border border-white/10 rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> جاري رفع الصور...
            </div>
          </div>
        )}

        {aiBusy && (
          <div className="flex justify-start">
            <div className="bg-white/5 text-white/70 border border-white/10 rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> ✨ الذكاء الاصطناعي بيحضّر إعلانك...
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-xs px-1">{error}</p>}

        {step === 'images' && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={optimizeImage(img, 'thumb')} alt="" className="w-full h-20 object-cover rounded-lg border border-white/10" />
                <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1 -left-1 bg-red-500 text-white rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {step === 'done' && result ? (
        <div className="max-w-xl w-full mx-auto px-4 pb-6">
          <div className="bg-success/10 border border-success/20 rounded-2xl p-5 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
            <p className="text-white font-bold mb-1">إعلانك اتستلم!</p>
            <a href={result.url} className="text-sm text-orange underline break-all">{result.url}</a>
            {result.waLink && (
              <a href={result.waLink} target="_blank" rel="noopener noreferrer"
                className="mt-4 block bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm">
                إرسال "عملنا لك إعلان مجاني" للمعلن عبر واتساب
              </a>
            )}
            {result.msLink && (
              <a href={result.msLink} target="_blank" rel="noopener noreferrer"
                className="mt-2 block bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm">
                فتح محادثة الماسنجر بالرسالة الجاهزة
              </a>
            )}
            {result.message && (
              <div className="mt-3 bg-black/20 border border-white/10 rounded-xl p-3 text-right">
                <p className="text-white/60 text-xs mb-1">الرسالة الجاهزة:</p>
                <p className="text-white/80 text-xs whitespace-pre-line">{result.message}</p>
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={async () => { const ok = await copyText(buildAdShareText({
                title: draft.title, brand: draft.brand, model: draft.model, year: draft.year,
                condition: draft.condition, governorate: draft.governorate, price: draft.price,
                contactPhone: draft.phone, description: draft.description, facebook: draft.facebook,
                url: result.url, images,
              })); setCopied(ok); setTimeout(() => setCopied(false), 2000); }}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-white text-gray-800 hover:bg-gray-100'}`}>
                <Copy className="w-4 h-4" /> {copied ? 'اتنسخ ✓' : 'نسخ نص الإعلان للجروبات'}
              </button>
              <button onClick={async () => {
                        const shareObj = {
                          title: draft.title, brand: draft.brand, model: draft.model, year: draft.year,
                          condition: draft.condition, governorate: draft.governorate, price: draft.price,
                          contactPhone: draft.phone, description: draft.description, facebook: draft.facebook,
                          url: result.url, images,
                        };
                        window.open('https://www.facebook.com/', '_blank', 'noopener');
                        const ok = await copyText(buildAdShareText(shareObj, { withImages: false }));
                        setCopied(ok); setTimeout(() => setCopied(false), 2000);
                      }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                <Facebook className="w-4 h-4" /> انشر على فيسبوك
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-xl w-full mx-auto px-4 pb-6 space-y-2">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => handleImageUpload(e.target.files)} />
          {step === 'type' && (
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-2xl p-3">
              <p className="text-white/80 text-sm font-semibold">🚛 نوع المركبة / المعدة:</p>
              <div className="flex flex-wrap gap-2">
                {TYPE_CHOICES.map(c => (
                  <button key={c.label} onClick={async () => {
                    userSay(c.label);
                    const base = typePending?.draft || draft;
                    const updated = { ...base, category: c.category, subcategory: c.subcategory } as Draft;
                    setDraft(updated);
                    botSay(`✅ تم تحديد النوع: ${CAT_LABELS[c.category] || ''} ${c.label}`);
                    setTypePending(null);
                    setStep('brand');
                    goNext(updated, typePending?.minimal ?? false, typePending?.freshImages ?? images);
                  }}
                    className="bg-white/10 hover:bg-orange/30 border border-white/15 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-white/40 text-[11px]">أو اكتب النوع بنفسك في الخانة تحت.</p>
            </div>
          )}
          {step === 'images' && (
            <button onClick={() => fileRef.current?.click()} disabled={uploading || images.length >= 10}
              className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
              <ImageIcon className="w-4 h-4" /> {images.length >= 10 ? 'اكتملت الصور (10)' : `رفع صور (${images.length}/10)`}
            </button>
          )}
          {step === 'preview' && (
            <div className="space-y-2">
              <p className="text-white/70 text-sm whitespace-pre-line bg-white/5 border border-white/10 rounded-xl px-4 py-3">{previewText()}</p>
              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, i) => (
                    <img key={i} src={optimizeImage(img, 'thumb')} alt="" className="w-full h-20 object-cover rounded-lg border border-white/10" />
                  ))}
                </div>
              )}
              {images.length === 0 && (
                <p className="text-amber-300 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-center">⚠️ لم ترفع أي صور بعد — اضغط «رفع صور» أولاً، الصور ستُنشر كلها على فيسبوك معاً</p>
              )}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <label className="text-white/80 text-xs font-bold mb-1.5 block">📝 الوصف (عدّله كما تريد — سيُطوّر تلقائياً عند النشر):</label>
                <textarea
                  value={draft.description || ''}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="اكتب وصف الإعلان هنا... مثال: حالة ممتازة، كاوتش جديد، رخصة سارية..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange/50 resize-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const base = (draft.description || '').trim();
                    const enhanced = base
                      ? `✨ ${draft.title || ''}\n${base}\n\n📍 ${draft.governorate || ''} • 💰 ${(draft.price || 0).toLocaleString('ar-EG')} جنيه • 📞 ${draft.phone || ''}\n#كار_مصر #شاحنات`
                      : `🚛 ${draft.title || 'إعلان مميز'}\n🏷️ ${[draft.brand, draft.model, draft.year].filter(Boolean).join(' ')} • ${draft.condition === 'new' ? 'جديد' : 'مستعمل'}\n📍 ${draft.governorate || ''} • 💰 ${(draft.price || 0).toLocaleString('ar-EG')} جنيه\n📝 حالة ممتازة، جاهز للعمل فوراً\n📞 ${draft.phone || ''}\n#كار_مصر #شاحنات`;
                    setDraft(d => ({ ...d, description: enhanced.slice(0, 4000) }));
                    botSay('✨ تم تطوير الوصف — راجعه وعدّله كما تحب ثم اضغط نشر');
                  }}
                  className="mt-2 w-full bg-orange/20 hover:bg-orange/30 border border-orange/30 text-orange-300 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  ✨ طوّر الوصف تلقائياً
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => submit()} disabled={sending || step !== 'preview'}
              className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 ${
                step === 'preview' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-white/5 text-white/30 border border-white/10'
              }`}>
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري...</> : <><Truck className="w-4 h-4" /> نشر سريع</>}
            </button>
            <button onClick={() => { navigator.clipboard?.writeText(previewText()); }}
              disabled={step !== 'preview'}
              className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 ${
                step === 'preview' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white/5 text-white/30 border border-white/10'
              }`}>
              <Copy className="w-4 h-4" /> نسخ الرسالة
            </button>
          </div>
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={step === 'preview' ? 'اكتب "نشر" أو عدّل التفاصيل...' : 'اكتب ردك هنا...'}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange/50"
              disabled={step === 'done'}
            />
            <button type="submit" disabled={sending || step === 'done'}
              className="bg-orange hover:bg-orange-600 text-white rounded-xl p-3 disabled:opacity-50 shadow-lg shadow-orange/20">
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}