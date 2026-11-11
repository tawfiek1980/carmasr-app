import { isAIEnabled, aiChat, aiJson, aiVisionJson, handleAIError } from '../_lib/ai.js';
import { getDb, initAdmin, verifyUser, verifyAdmin } from '../_lib/db.js';
import { appDownloadUrl, FACEBOOK_PAGE_URL } from '../_lib/listings.js';
import { notifyAdminsNewPost } from '../_lib/notify.js';
import { rateLimit } from '../_lib/rateLimit.js';
import { allowCors, isPreflight } from '../_lib/cors.js';

const SYSTEM_PROMPT = `أنت "مساعد كار مصر" — مساعد ذكي ودي لموقع "كار مصر CarMasr" (carmasr-app.vercel.app)، أكبر سوق إلكتروني مصري للشاحنات والمعدات الثقيلة والمقطورات والحافلات وقطع الغيار، وأيضاً الحمولات والوظائف والتمويل والمعارض.

معرفتك بالمنصة:
- نشر إعلان: من زر "نشر إعلان" أو /post-listing، الإعلان يمر بمراجعة قبل النشر.
- أنواع الإعلانات: شاحنة/معدة (بيع أو إيجار)، حمولة، وظيفة، قطعة غيار، معرض.
- الحمولات: السائق ينشر الحمولة بنقطة البداية والنهاية ونوع العربية والوزن والأجرة، والمستخدم يجد الشاحنات المناسبة بميزة المطابقة بالذكاء الاصطناعي.
- التمويل: طلب تمويل من صفحة /finance بالتواصل مع شركات التمويل المعتمدة.
- المعارض: باقات (مجاني/أساسي/متقدم/VIP) بحدود منتجات مختلفة.
- الحساب: تسجيل بالهاتف، التحقق، حذف الحساب من /delete-account.
- الأمان: لا نطلب أبداً تحويل مسبق، ويجب التعامل في مكان آمن والتحقق من المستندات.
- الدفع للترقية: فودافون كاش ${process.env.VODAFONE_CASH_NUMBER || '01018870145'} ثم تأكيد من الأدمن.

أجب دائماً باللغة العربية المصرية بأسلوب ودّي ومختصر (2-4 جمل). إذا لم تعرف الإجابة، أرشد المستخدم لمركز المساعدة /help أو صفحة الدعم /support، ولا تختلق معلومات.`;

const TRIAGE_PROMPT = `أنت نظام تصنيف تذاكر الدعم الفني لموقع "كار مصر CarMasr" — سوق إلكتروني مصري للشاحنات والمعدات الثقيلة.

قم بتصنيف تذكرة الدعم المقدمة حسب:
1. **التصنيف الرئيسي**: حساب، إعلانات، حمولات، تمويل، معارض، دفع، أمان، تقني، أخرى
2. **الأولوية**: عالية ( مشكلة أمان / حساب مفقود / احتيال / خسائر مالية)، متوسطة (مشكلة في وظيفة / تأخير / خطأ)، منخفضة (استفسار / اقتراح / سؤال عام)
3. **الاقتراح الأولي**: رد سريع مناسب للتذكرة (جملة أو جملتين)
4. **هل يحتاج تدخل بشري**: true إذا كان يحتاج مراجعة إدارية، false إذا يمكن حل آلي`;

const TRUCK_CATEGORIES = ['trucks', 'trailers', 'buses'];

function compactTruck(t) {
  return { id: t.id, title: t.title || '', brand: t.brand || '', model: t.model || '', year: t.year || '', price: t.price || 0, governorate: t.governorate || '', subcategory: t.subcategory || '', condition: t.condition === 'new' ? 'جديد' : 'مستعمل' };
}

function compactLoad(l) {
  return { id: l.id, origin: l.origin || '', destination: l.destination || '', cargoType: l.cargoType || '', vehicleType: l.vehicleType || '', weight: l.weight || '', price: l.price || 0, isReturnLoad: !!l.isReturnLoad, international: !!l.international, originCountry: l.originCountry || '', destinationCountry: l.destinationCountry || '' };
}

// ── إحصائيات السوق (سعر مقترح من متوسط إعلانات المنصة) ──────
const CATEGORY_LABELS = {
  trucks: 'شاحنات', equipment: 'معدات ثقيلة', trailers: 'مقطورات', buses: 'حافلات', 'spare-parts': 'قطع غيار',
};

const FORM_SUBS = {
  trucks: ['tractor-heads', 'dump-trucks', 'flatbeds', 'tankers', 'refrigerated'],
  equipment: ['excavators', 'loaders', 'cranes', 'bulldozers', 'forklifts'],
  trailers: ['semi-trailers', 'tankers', 'flatbeds', 'refrigerated'],
  buses: ['passenger', 'tourism', 'minibus', 'school'],
  'spare-parts': ['engine', 'transmission', 'brakes', 'tires', 'electrical', 'body', 'filters', 'oils'],
};

const FORM_SUBS_LABELS = {
  trucks: { 'tractor-heads': 'رؤوس جرارات', 'dump-trucks': 'قلابات', flatbeds: 'سطيحات', tankers: 'تانكرات', refrigerated: 'برادات' },
  equipment: { excavators: 'حفارات', loaders: 'لودر', cranes: 'كرينات', bulldozers: 'بلدوزرات', forklifts: 'رافعات شوكية' },
  trailers: { 'semi-trailers': 'نصف مقطورات', tankers: 'تانكرات', flatbeds: 'سطيحات', refrigerated: 'برادات' },
  buses: { passenger: 'أتوبيس ركاب', tourism: 'أتوبيس سياحي', minibus: 'ميني باص', school: 'أتوبيس مدرسة' },
  'spare-parts': { engine: 'محركات', transmission: 'فتيس', brakes: 'فرامل', tires: 'إطارات', electrical: 'كهربائيات', body: 'بدي وكبائن', filters: 'فلاتر', oils: 'زيوت' },
};

// متوسط السعر الحقيقي على المنصة من أحدث الإعلانات النشطة (بيع فقط)
async function marketProfile(category) {
  try {
    const db = getDb();
    const snaps = await db.collection('listings')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    const buckets = {};
    snaps.forEach((s) => {
      const d = s.data();
      const price = Number(d.price);
      if (!d.category || d.listingType === 'rent') return;
      if (!Number.isFinite(price) || price <= 0) return;
      (buckets[d.category] = buckets[d.category] || []).push(price);
    });
    const lines = [];
    for (const cat of Object.keys(buckets)) {
      const prices = buckets[cat].sort((a, b) => a - b);
      const n = prices.length;
      if (n < 3) continue;
      const median = n % 2 ? prices[(n - 1) / 2] : Math.round((prices[n / 2 - 1] + prices[n / 2]) / 2);
      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / n);
      lines.push(`${CATEGORY_LABELS[cat] || cat}${cat === category ? ' (فئتك)' : ''}: المتوسط ~${avg.toLocaleString('en')} ج، الوسيط ${median.toLocaleString('en')} ج (${n} إعلان)`);
    }
    return lines.length ? lines.join('\n') : '';
  } catch {
    return '';
  }
}

function keywordScore(text, keywords) {
  if (!text || !keywords) return 0;
  let score = 0;
  for (const kw of keywords) { if (kw && text.includes(kw)) score += 1; }
  return score;
}

function fallbackMatch(candidates, targetDoc, mode) {
  const score = (item) => {
    let s = 0;
    if (mode === 'load') {
      const truckText = `${item.subcategory} ${item.brand} ${item.model} ${item.title}`;
      if (targetDoc.vehicleType) s += keywordScore(truckText, [targetDoc.vehicleType]) * 3;
      if (targetDoc.cargoType && truckText.includes('براد')) s += targetDoc.cargoType === 'مبردة' ? 4 : 0;
      if (item.governorate && targetDoc.origin && item.governorate === targetDoc.origin) s += 3;
      if (item.governorate && targetDoc.destination && item.governorate === targetDoc.destination) s += 1;
      if (item.condition === 'جديد') s += 1;
    } else {
      const loadText = `${targetDoc.vehicleType} ${targetDoc.cargoType} ${targetDoc.origin} ${targetDoc.destination}`;
      if (item.subcategory) s += keywordScore(loadText, [item.subcategory]) * 3;
      if (item.brand) s += keywordScore(loadText, [item.brand]) * 2;
      if (item.model) s += keywordScore(loadText, [item.model]) * 2;
      if (item.governorate && targetDoc.origin && item.governorate === targetDoc.origin) s += 3;
      if (item.governorate && targetDoc.destination && item.governorate === targetDoc.destination) s += 1;
    }
    return s;
  };
  return candidates.map(c => ({ id: c.id, score: score(c) })).filter(m => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
}

// ── handler ───────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  allowCors(res);
  if (isPreflight(req)) return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  // الإجراء ممكن ييجي في الـ body أو في الـ query (?action=...) — الاتنين شغالين
  const action = String(
    (req.query && req.query.action)
      || (req.body && req.body.action)
      || 'assistant'
  );

  if (!rateLimit(req, res, { max: 60, windowMs: 60000 })) return;

  try {
    if (action === 'assistant')    return await handleAssistant(req, res);
    if (action === 'triage')       return await handleTriage(req, res);
    if (action === 'describe')     return await handleDescribe(req, res);
    if (action === 'moderate')     return await handleModerateV2(req, res);
    if (action === 'moderate-v2')  return await handleModerateV2(req, res);
    if (action === 'auto-publish') return await handleAutoPublish(req, res);
    if (action === 'match')        return await handleMatch(req, res);
    if (action === 'extract-ad')   return await handleExtractAd(req, res);
    if (action === 'fix-ad')       return await handleFixAd(req, res);
    if (action === 'promo-draft')  return await handlePromoDraft(req, res);
  if (action === 'marketing-post') return await handleMarketingPost(req, res);
  if (action === 'marketing-lead-score') return await handleMarketingLeadScore(req, res);
  if (action === 'marketing-wa-message') return await handleMarketingWaMessage(req, res);
  if (action === 'marketing-review') return await handleMarketingReview(req, res);
  if (action === 'marketing-summary') return await handleMarketingSummary(req, res);
  if (action === 'marketing-variants') return await handleMarketingVariants(req, res);
    return res.status(400).json({ ok: false, message: 'Unknown action' });
  } catch (error) {
    return res.status(200).json(handleAIError(error));
  }
}

// ── assistant ─────────────────────────────────────────────────
async function handleAssistant(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'المساعد الذكي غير مفعّل بعد' });
  const { question = '', history = [] } = req.body || {};
  const q = String(question).trim().slice(0, 500);
  if (!q) return res.status(400).json({ ok: false, message: 'اكتب سؤالك أولاً' });
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (Array.isArray(history)) {
    for (const h of history.slice(-6)) {
      if (h?.role === 'user' || h?.role === 'assistant') messages.push({ role: h.role, content: String(h.content).slice(0, 1000) });
    }
  }
  messages.push({ role: 'user', content: q });
  const answer = await aiChat({ messages, temperature: 0.5, maxTokens: 500 });
  return res.status(200).json({ ok: true, answer: answer.trim() });
}

// ── triage ────────────────────────────────────────────────────
async function handleTriage(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: true, category: 'أخرى', priority: 'متوسطة', suggestedReply: 'شكراً لتواصلك معنا. سيتواصل معك فريق الدعم قريباً.', needsHuman: true });
  const { subject = '', message = '', category: userCategory = '' } = req.body || {};
  const text = `${subject}\n${message}`.trim().slice(0, 800);
  if (!text) return res.status(400).json({ ok: false, message: 'أدخل نص التذكرة أولاً' });
  const result = await aiJson({
    system: TRIAGE_PROMPT,
    prompt: `صنّف تذكرة الدعم التالية:\n\nالتصنيف المختار من المستخدم: ${userCategory || 'لم يحدد'}\nالموضوع: ${subject}\nالرسالة: ${message}`,
    schema: { category: 'string', priority: 'string', suggestedReply: 'string', needsHuman: 'boolean', keywords: 'string[]' },
    maxTokens: 600,
  });
  return res.status(200).json({ ok: true, category: result.category || 'أخرى', priority: result.priority || 'متوسطة', suggestedReply: result.suggestedReply || 'شكراً لتواصلكم.', needsHuman: result.needsHuman ?? true, keywords: result.keywords || [] });
}

// ── describe ──────────────────────────────────────────────────
const DESCRIBE_SYSTEM = `أنت كاتب إعلانات محترف في "كار مصر CarMasr" — أكبر سوق إلكتروني مصري للشاحنات والمعدات الثقيلة والمقطورات والحمولات وقطع الغيار والوظائف.

قد تُرفق مع الطلب صور السلعة — افحصها جيداً أولاً ووصف ما ظاهر فيها فعلاً (نوع الهيكل، اللون، الكابينة، الحالة، الشعارات والماركة إن ظهرت)، ولا تخترع تفاصيل غير موجودة بالصور.

قواعد الكتابة الإلزامية:
1. العنوان: قصير وواضح وجذاب (أقل من 60 حرفاً). يبدأ بالماركة أو النوع. لا علامات تعجب أو رموز تعبيرية.
2. الوصف: منظم ومحترف. ابدأ بأقوى نقطة، ثم المواصفات التقنية، ثم الحالة، ثم المزايا. لا تكرار.
3. ممنوع كتابة: أرقام تليفونات، أسماء أشخاص، كلمات دعائية مبالغ فيها ("أفضل"، "رخيص"، "عرض خاص").
4. استخدم أرقاماً عربية-هندية (٠١٢٣) في العنوان والوصف.
5. السعر: اقترح سعراً واقعياً بالجنيه المصري بناءً على نوع المنتج وسنه وحالته، مع مراعاة بيانات السوق المرفقة.
6. الكلمات المفتاحية: اختر 3-5 كلمات يبحث عنها المشترون في Google.
7. اللغة: عربية فصحى مبسطة يفهمها الجميع. لا عامية مفرطة.
8. التنسيق: الوصف يحتوي على جمل قصيرة محددة. لا فقرات طويلة.`;

const DESCRIBE_SCHEMA = {
  title: 'string', description: 'string', highlights: ['string'],
  suggestedPrice: 0, priceNote: 'string', keywords: ['string'], qualityScore: 0,
  category: 'string', subcategory: 'string', brand: 'string', model: 'string', year: 'string', condition: 'string',
};

const CAT_RULES = [
  { id: 'trucks', en: ['trucks'], ar: ['شاحنات', 'تريلا', 'تريلة', 'قلابات', 'رؤوس جرارات'] },
  { id: 'equipment', en: ['equipment'], ar: ['معدات'] },
  { id: 'trailers', en: ['trailers', 'trailer'], ar: ['مقطورات'] },
  { id: 'buses', en: ['buses', 'bus'], ar: ['حافلات', 'باصات', 'أتوبيس', 'باص'] },
  { id: 'spare-parts', en: ['spare', 'parts'], ar: ['قطع غيار', 'قطع'] },
];

function normalizeCategory(raw) {
  const r = String(raw || '').toLowerCase();
  const ar = arNorm(raw).replace(/\s/g, '');
  for (const { id, en, ar: arWords } of CAT_RULES) {
    if (en.some((w) => r.includes(w))) return id;
    if (arWords.some((w) => { const n = arNorm(w).replace(/\s/g, ''); return n && (ar === n || ar.includes(n)); })) return id;
  }
  return '';
}

function normalizeSubcategory(category, raw) {
  if (!category || !FORM_SUBS[category]) return '';
  const subs = FORM_SUBS[category];
  const labels = FORM_SUBS_LABELS[category] || {};
  const r = String(raw || '').toLowerCase();
  const ar = arNorm(raw).replace(/\s/g, '');
  for (const s of subs) {
    if (r.includes(s)) return s;
    const lbl = arNorm(labels[s] || '').replace(/\s/g, '');
    if (lbl && (ar === lbl || (lbl.length > 2 && ar.includes(lbl)))) return s;
  }
  return '';
}

async function handleDescribe(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل بعد' });
  const { type = 'vehicle', category = '', subcategory = '', brand = '', model = '', year = '', condition = '', listingType = '', price, governorate = '', location = '', notes = '', specs = '', origin = '', destination = '', cargoType = '', vehicleType = '', weight = '', salary = '', company = '', jobType = '', experience = '' } = req.body || {};
  if (!category && !brand && !model && !subcategory && !type) return res.status(400).json({ ok: false, message: 'أدخل على الأقل نوع السلعة أو الماركة' });

  let typeLabel = 'مركبة';
  let userContext = '';

  if (type === 'load' || (category && ['حمولات', 'loads'].includes(category))) {
    typeLabel = 'حمولة';
    userContext = [
      origin ? `نقطة البداية: ${origin}` : '',
      destination ? `نقطة النهاية: ${destination}` : '',
      cargoType ? `نوع الحمولة: ${cargoType}` : '',
      vehicleType ? `نوع العربية المطلوبة: ${vehicleType}` : '',
      weight ? `الوزن: ${weight} طن` : '',
      price ? `الأجرة المطلوبة: ${price} جنيه` : '',
      notes ? `ملاحظات إضافية: ${notes}` : '',
    ].filter(Boolean).join('\n');
  } else if (type === 'job' || (category && ['وظائف', 'jobs'].includes(category))) {
    typeLabel = 'وظيفة';
    userContext = [
      company ? `اسم الشركة: ${company}` : '',
      jobType ? `نوع الوظيفة: ${jobType}` : '',
      subcategory ? `المسمى الوظيفي: ${subcategory}` : '',
      governorate ? `المحافظة: ${governorate}` : '',
      location ? `الموقع: ${location}` : '',
      salary ? `الراتب: ${salary}` : '',
      experience ? `الخبرة المطلوبة: ${experience}` : '',
      notes ? `متطلبات إضافية: ${notes}` : '',
    ].filter(Boolean).join('\n');
  } else {
    typeLabel = 'مركبة/قطعة غيار';
    userContext = [
      category ? `الفئة المختارة: ${category}` : '',
      subcategory ? `النوع الفرعي: ${subcategory}` : '',
      brand ? `الماركة: ${brand}` : '',
      model ? `الموديل: ${model}` : '',
      year ? `سنة الصنع: ${year}` : '',
      condition ? `الحالة: ${condition === 'new' ? 'جديد' : 'مستعمل'}` : '',
      listingType ? `طريقة العرض: ${listingType === 'rent' ? 'إيجار' : 'بيع'}` : '',
      price ? `السعر المطلوب الحالي: ${price} جنيه` : '',
      governorate ? `المحافظة: ${governorate}` : '',
      location ? `المكان: ${location}` : '',
      specs ? `المواصفات: ${specs}` : '',
      notes ? `ملاحظات المستخدم: ${notes}` : '',
    ].filter(Boolean).join('\n');
  }

  const images = Array.isArray(req.body.images) ? req.body.images.filter(u => u && typeof u === 'string').slice(0, 4) : [];

  // سعر السوق المقترح من إعلانات المنصة نفسها
  let market = '';
  if (typeLabel === 'مركبة/قطعة غيار') {
    market = await marketProfile(type === 'spare-part' ? 'spare-parts' : category);
  }

  const marketText = market ? `\n\nبيانات السوق على المنصة الآن — اجعل السعر المقترح قريباً من هذه الأرقام ولا تبتعد عنها كثيراً:\n${market}` : '';
  const visionHint = images.length ? '\n\nانظر إلى الصور المرفقة أولاً: استخرج منها المواصفات والحالة والفئة والماركة والموديل والسنة واللون كما تظهر فعلاً، واكتب الإعلان بناءً على ما ظاهر فيها، مع اقتراح "category" و"subcategory" من قائمة التصانيف الصحيحة.' : '';

  const promptBody = `اكتب إعلاناً احترافياً لـ ${typeLabel}${visionHint} بهذه البيانات:

${userContext || '(لا توجد بيانات إضافية)'}${marketText}

تعليمات الإخراج: أرجع JSON يحتوي قيماً حقيقية (وليس أسماء حقول) لكل من:
- "title": عنوان الإعلان (نص قصير أقل من 60 حرفاً)
- "description": وصف الإعلان (نص منظم 4-8 أسطر)
- "highlights": مصفوفة من 3-5 جمل تميز الإعلان
- "suggestedPrice": رقم السعر المقترح بالجنيه
- "priceNote": ملاحظة عن السعر (نص)
- "keywords": مصفوفة من 3-5 كلمات مفتاحية
- "qualityScore": رقم من 0 إلى 100
- "category": الفئة المقترحة (trucks | equipment | trailers | buses | spare-parts)
- "subcategory": النوع الفرعي المقترح (مثال: dump-trucks / excavators / semi-trailers / minibus / engine)
- "brand": الماركة (إن لم تكن مختارة)
- "model": الموديل (إن لم يكن مختاراً)
- "year": سنة الصنع (إن لم تكن مختارة)
- "condition": "new" أو "used" (إن لم تكن مختارة)`;

  let result;
  if (images.length) {
    result = await aiVisionJson({ system: DESCRIBE_SYSTEM, schema: DESCRIBE_SCHEMA, images, prompt: promptBody, maxTokens: 1000 });
  } else {
    result = await aiJson({ system: DESCRIBE_SYSTEM, schema: DESCRIBE_SCHEMA, prompt: promptBody, maxTokens: 1200 });
  }

  const safeHighlights = Array.isArray(result.highlights) ? result.highlights.filter(h => h && typeof h === 'string').slice(0, 5) : [];
  const safeKeywords = Array.isArray(result.keywords) ? result.keywords.filter(k => k && typeof k === 'string').slice(0, 5) : [];

  const suggestedCategory = normalizeCategory(result.category);
  const suggestedSubcategory = normalizeSubcategory(suggestedCategory, result.subcategory);
  const yearRaw = String(result.year || '').replace(/\D/g, '').slice(0, 4);
  const suggestedYear = /^(19|20)\d{2}$/.test(yearRaw) && +yearRaw >= 1960 && +yearRaw <= 2027 ? yearRaw : '';
  const condRaw = String(result.condition || '').toLowerCase();
  const suggestedCondition = /new|جديد|زيرو/.test(condRaw) ? 'new' : /used|مستعمل|مستعم/.test(condRaw) ? 'used' : '';

  return res.status(200).json({
    ok: true,
    title: String(result.title || '').slice(0, 120),
    description: String(result.description || ''),
    highlights: safeHighlights,
    suggestedPrice: Math.max(0, Number(result.suggestedPrice) || 0),
    priceNote: String(result.priceNote || ''),
    keywords: safeKeywords,
    qualityScore: Math.min(100, Math.max(0, Number(result.qualityScore) || 0)),
    category: suggestedCategory,
    subcategory: suggestedSubcategory,
    brand: String(result.brand || '').trim().slice(0, 30),
    model: String(result.model || '').trim().slice(0, 40),
    year: suggestedYear,
    condition: suggestedCondition,
    hasMarket: !!market,
  });
}

// ── moderate v2 ───────────────────────────────────────────────
const REVIEW_SCHEMA = {
  verdict: 'string(approved|rejected|undetermined)',
  score: 0,
  relevance: 'string(transport|general_services|other)',
  onTopic: true,
  reasons: ['string'],
  imageIssues: ['string'],
  // تصحيح إملائي تلقائي: أعد نسخة مصححة من النصوص (وإن لم يوجد خطأ أعدها كما هي)
  correctedTitle: 'string',
  correctedDescription: 'string',
};

const REVIEW_SYSTEM = `أنت مشرف محتوى لسوق "كار مصر CarMasr" — أكبر سوق إلكتروني مصري للشاحنات والمعدات الثقيلة والمقطورات والحافلات وقطع الغيار، وكذلك الحمولات والوظائف وشركات التمويل والمعارض.

المهمة: مراجعة إعلان جديد وتقرير ما إذا يُنشر فورياً أو يُرسل للمراجعة الإدارية.

ما هو مُرحَّب به في الموقع (لا يُعتبر مخالفة):
- إعلانات شاحنات ومعدات ثقيلة ومقطورات وحافلات وقطع غيار، بيعاً أو إيجاراً، محلية أو دولية.
- إعلانات حمولات (نقل بضائع بين المحافظات أو دولياً) ووظائف مرتبطة بمجال النقل والشاحنات.
- أي خدمة أو سلعة مرتبطة بمجال النقل والمركبات الثقيلة وحرفها (صيانة، فحص، قطع غيار، امتحان رخص، تدريب سائقين، تمويل المركبات، تأمين النقل، بيع معدات مستعملة).
- ذكر رقم الهاتف والأسعار كوسيلة تواصل طبيعية مسموحة.
- صيغ الإيجار أو البيع، التجديد، التفاوض على السعر، طلبات البحث عن شاحنة أو معدات.

ما يُعتبر رفضاً صريحاً أو يرسل للمراجعة الإدارية:
- محتوى غير لائق: إباحي، عنيف، مسيء، ترويج مخدرات أو تطرف أو أسلحة.
- خداع أو احتيال: طلب تحويل أموال مسبق، انتحال شخصية جهة رسمية، عروض وهمية.
- محتوى لا يخص الموقع إطلاقاً (عقارات، أطعمة، أزياء، سيارات ركوب عادية لا علاقة لها بالنقل والشحن...).
- صور لا تمت للإعلان أو مخالفة للمحتوى المكتوب، أو محتوى الصور غير مناسب.
- عند الشك بين الرفض والقبول: اختر "undetermined" ليُراجعها الأدمن وليست "approved".

قيّم درجة الثقة 0-100، ثم:
- "verdict": "approved" للنشر الفوري، "rejected" لمخالفة صريحة، أو "undetermined" عند الشك.
- "relevance": "transport" إن كان مرتبطاً مباشرة بالنقل والشاحنات، "general_services" لخدمة عامة ذات صلة، "other" لغير ذي صلة.
- "onTopic": صحيح إن كان الإعلان داخل النطاق المسموح أعلاه.
- "reasons": أسباب قرارك باختصار بالعربية (مصفوفة جمل قصيرة).
- "imageIssues": ملاحظات الصور إن وُجدت، وإلا مصفوفة فارغة.
- "correctedTitle" و"correctedDescription": نصّا العنوان والوصف بعد تصحيح أخطائهما الإملائية والنحوية والهمزات وعلامات الترقيم والأرقام (مثلاً: "الرصيل" → "المرسيدس"، "سناره" → "سنارة"، "مقطورة/مقطورة" → "مقطورة"). لا تغيّر المعنى ولا السعر ولا رقم الهاتف ولا بيانات الإعلان. إن لم يوجد أي خطأ أعد النص كما هو بالضبط. إن كانا غير قابلين للتصحيح أعد "".
- لا تختلق حواراً أو تفاصيل غير موجودة في النص الأصلي.`;

function normalizeReview(review) {
  if (!review || typeof review !== 'object') {
    return { verdict: 'undetermined', score: 0, relevance: 'other', onTopic: false, reasons: ['تعذرت المراجعة الآلية'], imageIssues: [] };
  }
  const verdict = ['approved', 'rejected', 'undetermined'].includes(review.verdict) ? review.verdict : 'undetermined';
  const relevance = ['transport', 'general_services', 'other'].includes(review.relevance) ? review.relevance : 'other';
  return {
    verdict,
    score: Math.min(100, Math.max(0, Number(review.score) || 0)),
    relevance,
    onTopic: typeof review.onTopic === 'boolean' ? review.onTopic : verdict === 'approved',
    reasons: Array.isArray(review.reasons) ? review.reasons.filter(r => r && typeof r === 'string').slice(0, 4) : [],
    imageIssues: Array.isArray(review.imageIssues) ? review.imageIssues.filter(r => r && typeof r === 'string').slice(0, 4) : [],
  };
}

// ── تعلم من أخطاء سابقة (feedback) ────────────────────────
// يحمّل آخر التصحيحات الإدارية التي خالف فيها قرار الآلة، ويحقنها
// في قواعد المراجعة كأمثلة موجهة (few-shot) حتى لا تتكرر نفس الأخطاء.
async function reviewSystemWithLessons() {
  try {
    const db = getDb();
    const snaps = await db.collection('ai_feedback').where('aiCorrect', '==', false).limit(50).get();
    const records = [];
    snaps.forEach((s) => records.push(s.data()));
    const lessons = records
      .sort((a, b) => ((b.tsMs || 0) - (a.tsMs || 0)))
      .slice(0, 8)
      .map((i) => {
        const aiVerdictText = i.aiVerdict === 'approved' ? 'وافقت الآلة فوراً' : 'رفضت الآلة';
        const correctText = i.adminDecision === 'approved' ? 'الصحيح: نشر الإعلان' : 'الصحيح: رفض الإعلان';
        return `- إعلان: ${String(i.title || '').slice(0, 70)} | ${aiVerdictText} | ${correctText} | السبب: ${(i.aiReasons && i.aiReasons[0]) || ''}`;
      });
    if (!lessons.length) return REVIEW_SYSTEM;
    return `${REVIEW_SYSTEM}\n\nدروس من مراجعات سابقة صُححت يدوياً بواسطة الإدارة — اعتمدها في قرارك ولا تكرر نفس الخطأ:\n${lessons.join('\n')}`;
  } catch {
    return REVIEW_SYSTEM;
  }
}

async function handleModerateV2(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل بعد' });
  const { title = '', description = '', category = '', price, userName = '', contactPhone = '', images = [] } = req.body || {};
  const prompt = `الإعلان:\nالعنوان: ${title}\nالوصف: ${description}\nالفئة: ${category}\nالسعر: ${price || 'غير محدد'} جنيه\nاسم الناشر: ${userName}\nهاتف التواصل: ${contactPhone} (مسموح)\n\nحدد ما إذا كان ينشر فوراً أم يحتاج مراجعة إدارية أم رفض.`;
  const reviewSystem = await reviewSystemWithLessons();
  const review = await (Array.isArray(images) && images.length
    ? aiVisionJson({ system: reviewSystem, prompt, images, schema: REVIEW_SCHEMA, maxTokens: 1100 })
    : aiJson({ system: reviewSystem, prompt, schema: REVIEW_SCHEMA, maxTokens: 1100 }));
  const safe = normalizeReview(review);
  return res.status(200).json({ ok: true, verdict: safe.verdict, score: safe.score, relevance: safe.relevance, onTopic: safe.onTopic, reasons: safe.reasons, imageIssues: safe.imageIssues });
}

// ── auto-publish ──────────────────────────────────────────────
// ينشئ الإعلان من السيرفر، ويمر أولاً بمراجعة ذكية (نص + صور):
// approved → يُنشر فورياً | undetermined → pending (مراجعة إدارية) | rejected → مرفوض
// مسار الأدمن: نشر فوري بدون مراجعة.
function kindTable(kind) {
  if (kind === 'load') return { collection: 'loads', active: 'available' };
  if (kind === 'job') return { collection: 'jobs', active: 'active' };
  return { collection: 'listings', active: 'active' };
}

function statusFor(kind, verdict) {
  if (verdict === 'approved') return kindTable(kind).active;
  if (verdict === 'rejected') return 'rejected';
  return 'pending';
}

// ── التصحيح الإملائي التلقائي ───────────────────────────────
function applyCorrections(data, correct) {
  const out = { ...data };
  const changes = [];
  const clean = (raw) => (typeof raw === 'string' ? raw.trim() : '');
  const fix = (field, key, label, maxLen) => {
    const src = clean(String(data[field] || ''));
    const v = clean(correct && correct[key]);
    if (!v || v === src || v.length > maxLen) return;
    if (/[\w\u0600-\u06FF]{2}/u.test(v)) {
      out[field] = v;
      changes.push({ field, label, from: src.slice(0, 100), to: v.slice(0, 100) });
    }
  };
  fix('title', 'correctedTitle', 'العنوان', 120);
  fix('description', 'correctedDescription', 'الوصف', 3000);
  return { data: out, changes };
}

async function handleAutoPublish(req, res) {
  const { kind = 'listing', data = {}, images = [] } = req.body || {};
  if (!['listing', 'load', 'job'].includes(kind)) return res.status(400).json({ ok: false, message: 'نوع الإعلان غير معروف' });
  if (!data || typeof data !== 'object') return res.status(400).json({ ok: false, message: 'بيانات غير صالحة' });

  const db = getDb();
  const decoded = await verifyUser(req);
  if (!decoded) return res.status(401).json({ ok: false, message: 'يجب تسجيل الدخول لنشر إعلان' });

  // تحقق إلزامي من الحقول الأساسية حسب النوع
  if (kind === 'listing' && (!data.title || !data.governorate)) return res.status(400).json({ ok: false, message: 'اكتمل العنوان والمحافظة' });
  if (kind === 'load' && (!data.origin || !data.destination)) return res.status(400).json({ ok: false, message: 'اكتمل نقطتا البداية والنهاية' });
  if (kind === 'job' && (!data.title || !data.governorate)) return res.status(400).json({ ok: false, message: 'اكتمل عنوان الوظيفة والمحافظة' });

  // مسار الأدمن السريع: نشر مباشر بدون مراجعة
  const admin = await verifyAdmin(req);
  if (admin) {
    const ref = await db.collection(kindTable(kind).collection).add({
      ...data,
      userId: decoded.uid,
      status: kindTable(kind).active,
      aiModeration: null,
      createdAt: initAdmin().firestore.FieldValue.serverTimestamp(),
      updatedAt: initAdmin().firestore.FieldValue.serverTimestamp(),
    });
    return res.status(200).json({ ok: true, id: ref.id, status: kindTable(kind).active, moderated: false });
  }

  // الوظائف تتطلب موافقة إدارية قبل النشر: تُكتب بحالة pending دائماً، مع تصحيح إملائي
  // تلقائي (best-effort)، ثم يُبلّغ الأدمن ليراجع ويوافق أو يرفض.
  if (kind === 'job') {
    let jobData = { ...data };
    let jobChanges = [];
    if (isAIEnabled()) {
      try {
        const corr = await aiJson({
          system: `أنت محرر نصوص عربي متخصص في تصحيح الأخطاء الإملائية والنحوية والهمزات وعلامات الترقيم دون تغيير المعنى. لا تختلق تفاصيل، واحتفظ برقم الهاتف والسعر وأسماء الشركات كما هي.`,
          schema: { correctedTitle: 'string', correctedDescription: 'string' },
          prompt: `صحّح الأخطاء الإملائية في هذا الإعلان فقط:\nالعنوان: ${String((data.title || '')).slice(0, 300)}\nالوصف: ${String((data.description || '')).slice(0, 1500)}`,
          maxTokens: 600,
        });
        const r = applyCorrections(jobData, corr);
        jobData = r.data;
        jobChanges = r.changes;
      } catch { /* النص الأصلي */ }
    }
    const ref = await db.collection('jobs').add({
      ...jobData,
      userId: decoded.uid,
      status: 'pending',
      spellCorrected: jobChanges.length > 0,
      ...(jobChanges.length > 0 ? { aiCorrections: jobChanges.slice(0, 4) } : {}),
      aiModeration: null,
      createdAt: initAdmin().firestore.FieldValue.serverTimestamp(),
      updatedAt: initAdmin().firestore.FieldValue.serverTimestamp(),
    });
    await notifyAdminsNewPost(db, { kind: 'job', id: ref.id, title: jobData.title || data.title || '', userName: data.userName || '' }).catch(() => {});
    return res.status(200).json({ ok: true, id: ref.id, status: 'pending', moderated: true, spellCorrected: jobChanges.length > 0 });
  }

  // مراجعة ذكية (نص + صور إن وُجدت)
  let review;
  if (isAIEnabled()) {
    const title = data.title || '';
    const text = [
      `نوع: ${kind === 'load' ? 'حمولة' : kind === 'job' ? 'وظيفة' : 'إعلان'}`,
      title ? `العنوان: ${title}` : '',
      data.description ? `الوصف: ${String(data.description)}` : '',
      data.category ? `الفئة: ${data.category}` : '',
      data.price ? `السعر: ${data.price} جنيه` : '',
      data.governorate ? `المحافظة: ${data.governorate}` : '',
      data.contactPhone ? `هاتف التواصل: ${data.contactPhone} (مسموح)` : '',
      kind === 'load' ? `الرحلة: ${data.origin || ''} → ${data.destination || ''} — الحمولة: ${data.cargoType || ''} — الوزن: ${data.weight || ''}` : '',
    ].filter(Boolean).join('\n');

    const basePrompt = `مراجعة هذا الإعلان قبل نشره على المنصة، وتصحيح أي أخطاء إملائية فيه:\n\n${text}\n\nحدد: هل يُنشر فورياً أم يُرسل للمراجعة الإدارية أم يُرفض؟ أعطِ في "correctedTitle" و"correctedDescription" النسخة المصححة (وإن لم يوجد خطأ أعد النص كما هو).`;
    try {
      const reviewSystem = await reviewSystemWithLessons();
      review = Array.isArray(images) && images.length
        ? await aiVisionJson({ system: reviewSystem, prompt: `${basePrompt}\n\nالصور المرفقة بالإعلان — تأكد أنها مطابقة للمحتوى ومناسبة.`, images, schema: REVIEW_SCHEMA, maxTokens: 1100 })
        : await aiJson({ system: reviewSystem, prompt: basePrompt, schema: REVIEW_SCHEMA, maxTokens: 1100 });
    } catch {
      try { review = await aiJson({ system: await reviewSystemWithLessons(), prompt: basePrompt, schema: REVIEW_SCHEMA, maxTokens: 1100 }); }
      catch { review = null; }
    }
  }
  const safe = review
    ? normalizeReview(review)
    : // فول-باك ذكي: لو المراجعة الآلية معطّلة أو فشلت، يُنشر مباشرة بدل تعليقه pending
      // حيث أن 'undetermined' كان يرسله للمراجعة الإدارية ثم لا يظهر أبداً.
      { verdict: 'approved', score: 50, relevance: 'transport', onTopic: true, reasons: ['نُشر تلقائياً — المراجعة الآلية غير متاحة'], imageIssues: [] };
  // الإعلانات (عربيات/قطع غيار) تتطلب موافقة إدارية قبل النشر → pending دائماً.
  // الحمولات تبقى على المراجعة الذكية (تنشر فوراً لو مقبولة).
  const status = kind === 'load' ? statusFor(kind, safe.verdict) : 'pending';

  // تطبيق التصحيح الإملائي العائد من الآلة على بيانات الإعلان قبل الكتابة
  const corrected = applyCorrections(data, review || {});
  const finalData = corrected.data;

  const ref = await db.collection(kindTable(kind).collection).add({
    ...finalData,
    userId: decoded.uid,
    status,
    spellCorrected: corrected.changes.length > 0,
    ...(corrected.changes.length > 0 ? { aiCorrections: corrected.changes.slice(0, 4) } : {}),
    aiModeration: review
      ? {
          checkedAt: new Date().toISOString(),
          verdict: safe.verdict,
          score: safe.score,
          relevance: safe.relevance,
          onTopic: safe.onTopic,
          reasons: safe.reasons,
          imageIssues: safe.imageIssues,
          source: 'auto',
        }
      : null,
    createdAt: initAdmin().firestore.FieldValue.serverTimestamp(),
    updatedAt: initAdmin().firestore.FieldValue.serverTimestamp(),
  });

  if (kind === 'listing') {
    await notifyAdminsNewPost(db, { kind: 'listing', id: ref.id, title: finalData.title || data.title || '', userName: data.userName || '' }).catch(() => {});
  }

  return res.status(200).json({ ok: true, id: ref.id, status, moderated: Boolean(review), verdict: safe.verdict, score: safe.score, reasons: safe.reasons, imageIssues: safe.imageIssues, spellCorrected: corrected.changes.length > 0 });
}

// ── match ─────────────────────────────────────────────────────
async function handleMatch(req, res) {
  const { target, id } = req.body || {};
  if (!['load', 'truck'].includes(target) || !id) return res.status(400).json({ ok: false, message: 'target و id مطلوبان' });
  const db = getDb();
  let targetDoc, candidates;
  if (target === 'load') {
    const snap = await db.collection('loads').doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, message: 'الحمولة غير موجودة' });
    targetDoc = compactLoad({ id: snap.id, ...snap.data() });
    const trucksSnap = await db.collection('listings').limit(50).get();
    candidates = trucksSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => TRUCK_CATEGORIES.includes(t.category) && t.status === 'active').map(compactTruck);
  } else {
    const snap = await db.collection('listings').doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, message: 'الإعلان غير موجود' });
    targetDoc = compactTruck({ id: snap.id, ...snap.data() });
    const loadsSnap = await db.collection('loads').limit(50).get();
    candidates = loadsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.status === 'available').map(compactLoad);
  }
  const pool = candidates.slice(0, 15);
  if (pool.length === 0) return res.status(200).json({ ok: true, matches: [] });
  let matches = [];
  if (isAIEnabled()) {
    try {
      const mode = target === 'load' ? 'load' : 'truck';
      const targetDesc = mode === 'load'
        ? `حمولة: ${targetDoc.origin} ← ${targetDoc.destination}${targetDoc.international ? ` (دولي: ${targetDoc.originCountry} ← ${targetDoc.destinationCountry})` : ''}، نوع الحمولة: ${targetDoc.cargoType}، العربية المطلوبة: ${targetDoc.vehicleType}، الوزن: ${targetDoc.weight} طن، الأجرة: ${targetDoc.price} جنيه${targetDoc.isReturnLoad ? '، حمولة رجعة' : ''}`
        : `شاحنة: ${targetDoc.title}، ${targetDoc.brand} ${targetDoc.model} ${targetDoc.year}، الحالة: ${targetDoc.condition}، المحافظة: ${targetDoc.governorate}، السعر: ${targetDoc.price} جنيه`;
      const listDesc = pool.map(c => mode === 'load'
        ? `[${c.id}] ${c.title} — ${c.brand} ${c.model} ${c.year} — ${c.governorate} — ${c.price} جنيه (${c.condition})`
        : `[${c.id}] ${c.origin} ← ${c.destination} — ${c.cargoType} ${c.vehicleType} ${c.weight} طن — ${c.price} جنيه`).join('\n');
      const result = await aiJson({
        system: `أنت نظام مطابقة في "كار مصر CarMasr". اختر أفضل النتائج المناسبة. رتب من الأنسب.`,
        schema: { matches: [{ id: 'string', score: 0, reasons: ['string'] }] },
        prompt: `${targetDesc}\n\nالقائمة:\n${listDesc}\n\nأرجع أفضل 5 نتائج مع score 0-100.`,
      });
      if (Array.isArray(result.matches)) {
        const ids = new Set(pool.map(p => p.id));
        matches = result.matches.filter(m => m && ids.has(m.id)).map(m => ({ id: m.id, score: Math.min(100, Math.max(0, Number(m.score) || 0)), reasons: Array.isArray(m.reasons) ? m.reasons.slice(0, 2) : [] })).sort((a, b) => b.score - a.score).slice(0, 5);
      }
    } catch { /* fallback below */ }
  }
  if (matches.length === 0) {
    const fallback = fallbackMatch(pool, targetDoc, target);
    matches = fallback.map(m => ({ id: m.id, score: m.score * 10, reasons: [] }));
  }
  const byId = new Map(pool.map(p => [p.id, p]));
  const enriched = matches.map(m => ({ ...m, item: byId.get(m.id) }));
  return res.status(200).json({ ok: true, mode: target === 'load' ? 'load' : 'truck', matches: enriched });
}

// ── extract-ad ────────────────────────────────────────────────
// يحول أي نص حر (لصقة/جملة/إعلان قديم) إلى حقول إعلان كاملة للنشر السريع
const EXTRACT_GOVS = ['القاهرة','الجيزة','الإسكندرية','الدقهلية','البحر الأحمر','البحيرة','الفيوم','الغربية','الإسماعيلية','المنوفية','المنيا','القليوبية','الوادي الجديد','السويس','أسوان','أسيوط','بني سويف','بورسعيد','دمياط','الشرقية','جنوب سيناء','كفر الشيخ','مطروح','الأقصر','قنا','شمال سيناء','سوهاج'];

const EXTRACT_BRANDS = ['مرسيدس','مان','فولفو','افيكو','ايفيكو','دايو','ميتسوبيشي','تويوتا','هيونداي','اسكوريا','سكانيا','اسكانيا','رينو','ماز','فوتون','جاك'];

const arNorm = (s) => String(s || '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\u0600-\u06FF\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const EXTRACT_SYSTEM = `أنت مُعرّف بيانات إعلانات في "كار مصر CarMasr" — أكبر سوق إلكتروني مصري للشاحنات والمعدات الثقيلة والمقطورات والحمولات وقطع الغيار والوظائف.

مهمتك: استخرج من نص حر (عربي / إنجليزي / أرقام إنجليزية أو هندية / عامية مخلوطة / إعلان قديم لصقه المستخدم) كل حقول الإعلان الجاهز للنشر.

اقرأ النص كله أولاً، ثم أرجِع JSON دقيق بهذه المعاني:
1. "title": عنوان إعلان واضح يعبر عن السلعة (النوع + الماركة + الموديل + أهم صفة) بأقل من 60 حرف. إن لم يوجد عنوان واضح كوّن من ما ذكر. لا تنقص الجوهر.
2. "brand": ماركة المركبة المعروضة للبيع نفسها (مثل: إسكانيا، فولفو، مرسيدس، مان). انتبه: أسماء قطع الغيار لا تحدد الماركة — "دفرنس مرسيدس" أو "كردان أكتروس" قطع غيار وليست ماركة المركبة. الماركة هي المرتبطة بكلمة "للبيع" أو الأشهر كمركبة في الإعلان. إن وردت ضمن الماركات المعروفة اطبعها كما هي من القائمة. غير المعروفة اطبعها بتهجئتها الشائعة.
3. "model": طراز المركبة نفسه (مثل: أكتروس، كوستر، بوكسر). لا تعتبر أسماء قطع الغيار (كردان، فتيس، دفرنس، محور، مكنة، ريداتير، كوتش) أو قوة المكنة (مثل 112) أو أرقام المقاسات (مثل 40.5) موديلاً. بشكل خاص: لا تأخذ الكلمة التي تلي مباشرة كلمة من كلمات قطع الغيار (كردان/دفرنس/فتيس/محور/كوتش) كموديل — مثل "كردان أكتروس" أو "دفرنس مرسيدس" دي قطع غيار مش موديل المركبة. لا تكرر الماركة في الموديل ولا تعكس الماركة والموديل. إن لم يُذكر الطراز صراحةً للمركبة نفسها اطبع نص فارغ.
4. "year": سنة الصنع رقمًا بين 1960 و2027. إن لم توجد بدقة اطبع نص فارغ ولا تخمن.
5. "condition": "new" إن ذكرت "جديد/زيرو/كالصورة/بالكرتونة"، وإلا "used".
6. "governorate": المحافظة المصرية من قائمة المحافظات المسموحة أدناه (وحّد الأسماء المماثلة). إن لم تُذكر اطبع نص فارغ.
7. "price": السعر رقمًا صحيحًا بالجنيه المصري (حوّل الصياغات: "750 ألف" = 750000، "m750" = 750000، "k500" = 500000). إن لم يُذكر أي سعر اطبع null ولا تخترع.
8. "phone": رقم موبايل مصري 11 رقم يبدأ بـ 01 (إن وُجد أكثر من رقم خُذ الأول). غير ذلك نص فارغ.
9. "facebook": رابط http(s) لواحد إن ذكر. غيره نص فارغ.
10. "description": انسخ نص الإعلان كاملاً كما هو دون حذف أي تفاصيل (الموديل والطراز والمواصفات بالأرقام والحروف)، أنقّي فقط الأخطاء الإملائية والتكرار الواضح دون اختصار المعنى أو حذف بنود. إن ورد النص كقائمة بنود احتفظ بكل البنود في أسطر منفصلة. إن لم يذكر نص أصلاً اطبع نص فارغ.
11. "missing": مصفوفة بأسماء الحقول المهمة الناقصة من بين: "title","brand","model","year","price","governorate","phone".
12. "category": تصنيف المركبة من: "trucks" (شاحنات نقل)، "equipment" (معدات ثقيلة)، "buses" (حافلات). ابحث عن أي من هذه الإشارات:
    - trucks: تريلا/تريلة/رأس تريلا/جرار/قلاب/هيفو/براد/مبرد/تانكر/صهريج/تنكة/سطحة/سطوح/لوبد/دينا/نصف مقطورة/كونتينر/شاحنة/مقطورة/مقطورات/نقل ثقيل/بضاعة/شحن/كردان/دفرنس/محور/فتيس
    - إن كانت الماركة من ماركات الشاحنات الشهيرة (إسكانيا، فولفو، مان، إيفيكو، رينو، فوتون، جاك، ماز) ولم توجد إشارة أخرى اطبع "trucks".
    - equipment: حفار/كاتربيلر/لودر/كرين/كران/بلدوزر/جرافة/رافعة شوكية/جريدر/معدة/معدات ثقيلة/حفر/بناء
    - buses: باص/حافلة/كوستر/ميكروباص
    - إن لم يتضح من السياق اطبع نص فارغ "".
13. "subcategory": النوع الفرعي حسب التصنيف:
    trucks → "tractor-heads" (رأس تريلا/جرار/MCU) | "dump-trucks" (قلاب/هيفو/نقل تراب) | "flatbeds" (سطحة/سطوح/لوبد) | "refrigerated" (براد/مبرد/تبريد/ثلاجة) | "tankers" (تانكر/صهريج/تنكة/نقل وقود/ Hankotanker) | "trailers" (مقطورة/نصف مقطورة/كبينة) | "" (دينا/شاحنة عامة/نقل خفيف)
    equipment → "excavators" (حفار/كاتربيلر) | "loaders" (لودر/لوودر) | "cranes" (كرين/كران/رافعة ثقيلة) | "bulldozers" (بلدوزر/جرافة) | "forklifts" (رافعة شوكية/فوركليفت) | "" (معدات أخرى)
    buses → ""
    إن لم يتضح اطبع نص فارغ "".

قواعد صارمة للغاية:
- لا تخترع أي قيمة لم تُذكر صراحةً في النص.
- التليفون والسعر موقعهما غالبًا بين الرقمين المتجاورين للنص — انتبه لالتباس السعر مع السنة والعكس.
- رقم مكوّن من 4-6 أرقام منفصل غالبًا سعر (إلا أن يكون سنة ضمن 1960-2027).
- المحافظات المسموحة فقط: ${EXTRACT_GOVS.join('، ')}.
- الماركات المعروفة: ${EXTRACT_BRANDS.join('، ')}.`;

async function handleExtractAd(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل بعد' });
  const { text = '' } = req.body || {};
  const raw = String(text).trim().slice(0, 6000);
  if (!raw) return res.status(400).json({ ok: false, message: 'اكتب أو ألصق نص الإعلان أولاً' });

  const result = await aiJson({
    system: EXTRACT_SYSTEM,
    schema: {
      title: 'string',
      brand: 'string',
      model: 'string',
      year: 'string',
      condition: 'string("new" أو "used")',
      governorate: 'string',
      price: 'number أو null',
      phone: 'string',
      facebook: 'string',
      description: 'string',
      missing: ['string'],
      category: 'string',
      subcategory: 'string',
    },
    prompt: `النص:\n${raw}`,
    maxTokens: 2200,
  });

  const yearRaw = String(result.year || '').replace(/\D/g, '').slice(0, 4);
  const year = /^(19|20)\d{2}$/.test(yearRaw) && +yearRaw >= 1960 && +yearRaw <= 2027 ? yearRaw : '';

  const priceNum = Number(result.price);
  const price = Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum) : 0;

  const phoneRaw = String(result.phone || '').replace(/\D/g, '').slice(0, 11);
  const phone = /^01[0125]/.test(phoneRaw) ? phoneRaw : '';

  const govRaw = arNorm(result.governorate);
  const govCanon = EXTRACT_GOVS.find((g) => arNorm(g) === govRaw) || EXTRACT_GOVS.find((g) => govRaw && (arNorm(g).includes(govRaw) || govRaw.includes(arNorm(g))));
  const governorate = govCanon || '';

  const brandRaw = arNorm(result.brand);
  const brandCanon = EXTRACT_BRANDS.find((b) => arNorm(b) === brandRaw) || EXTRACT_BRANDS.find((b) => brandRaw && (arNorm(b).includes(brandRaw) || brandRaw.includes(arNorm(b))));
  const brand = brandCanon || '';

  const condition = /^(new|جديد|زيرو)$/i.test(String(result.condition || '')) ? 'new' : 'used';
  const facebookRaw = String(result.facebook || '').trim();
  const facebook = /^https?:\/\/\S+/i.test(facebookRaw) ? facebookRaw : '';
  const missing = Array.isArray(result.missing) ? result.missing.filter((m) => typeof m === 'string').slice(0, 8) : [];

  const CATEGORIES = ['trucks', 'equipment', 'buses'];
  const TRUCK_SUBS = ['tractor-heads', 'dump-trucks', 'flatbeds', 'refrigerated', 'tankers', 'trailers'];
  const EQUIP_SUBS = ['excavators', 'loaders', 'cranes', 'bulldozers', 'forklifts'];

  const catRaw = arNorm(result.category).replace(/\s/g, '');
  let category = CATEGORIES.find((c) => catRaw.includes(c)) || '';
  // لو الـ AI ساب التصنيف فاضي والماركة ماركة شاحنات معروفة — صنّفه شاحنة (منعًا لسؤال نوع المركبة بلا داعي)
  const TRUCK_BRANDS = ['سكانيا', 'اسكانيا', 'فولفو', 'مان', 'افيكو', 'ايفيكو', 'رينو', 'فوتون', 'جاك', 'ماز'];
  if (!category && TRUCK_BRANDS.some((b) => arNorm(b) === brandRaw)) category = 'trucks';
  const subRaw = arNorm(result.subcategory).replace(/\s/g, '');
  const subcategory = category === 'trucks' ? (TRUCK_SUBS.find((s) => subRaw.includes(s)) || '')
    : category === 'equipment' ? (EQUIP_SUBS.find((s) => subRaw.includes(s)) || '') : '';

  const title = String(result.title || '').trim().slice(0, 90) || raw.split('\n')[0].trim().slice(0, 90);
  // الوصف: النص الأصلي المُلصق هو المرجع — لو الـ AI رجّع نسخة أقصر أو حذف بنود، خذ النص الكامل كما هو
  const aiDesc = String(result.description || '').trim();
  const description = aiDesc.length >= raw.length ? aiDesc.slice(0, 4000) : raw.slice(0, 4000);

  // حراسة: لو الموديل مأخوذ من سياق قطع غيار (كردان أكتروس / دفرنس مرسيدس) فهو ليس موديل المركبة
  let model = String(result.model || '').trim().slice(0, 60);
  const modelNorm = arNorm(model);
  if (modelNorm) {
    const partsWords = ['كردان', 'دفرنس', 'فتيس', 'محور', 'كوتش', 'رداتير', 'مكنة', 'مكنه'].map(arNorm);
    const esc = modelNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const partsRe = new RegExp(`(?:${partsWords.join('|')})\\s+${esc}`);
    if (partsRe.test(arNorm(raw))) model = '';
  }

  return res.status(200).json({
    ok: true,
    draft: {
      title,
      brand,
      model,
      year,
      condition,
      governorate,
      price,
      phone,
      facebook,
      description,
      category,
      subcategory,
    },
    missing,
  });
}

// ── fix-ad ────────────────────────────────────────────────────
// يولّد إصلاحات عملية جاهزة للتطبيق على إعلان مرفوض/غير واضح:
// يعبّي الحقول الناقصة من بيانات المالك، يصحح الأخطاء، ويعيد كتابة الوصف السيئ
const FIX_SYSTEM = `أنت محرر إعلانات في "كار مصر CarMasr" — أكبر سوق إلكتروني مصري للشاحنات والمعدات الثقيلة والمقطورات والحمولات.

مهمتك: استلم إعلاناً يحتاج مراجعة إدارية (رفض أو غير واضح) مع أسباب المشاكل، وأعدّ قائمة إصلاحات عملية جاهزة للتطبيق الفوري. كل إصلاح له حقل واحد.

الحقول المدعومة فقط: "title", "description", "price", "currency", "governorate", "location", "brand", "model", "year", "condition", "contactPhone", "advertiserName", "category", "subcategory".

قواعد الصياغة لكل إصلاح:
- "field": اسم الحقل من القائمة أعلاه بالضبط.
- "value": القيمة الجديدة الصحيحة (نص جاهز للتطبيق كما هو، بدون ترقيم آلاف للسعر).
- "reason": سبب الإصلاح بجملة عربية قصيرة توضح للمشرف ماذا تغيّر ولماذا.

تعليمات ذكية حسب السبب الوارد:
1. سعر سالب أو غير منطقي (أقل من 1000 جنيه لشاحنة/معدة): اكتب سعراً واقعياً منطقياً للموديل والسنة أو 0 للتفاوض — واضح أن النص الرقمي اعتُبر سعراً غلطاً.
2. "Missing contact phone number": استخدم هاتف المالك (UserPhone/contactPhone) وارد في البيانات كحقل contactPhone إن كان ناقصاً.
3. وصف غير واضح/سئ/مختصر جداً: أعد صياغته لوصف بيعي منظم من 4-7 أسطر واضحة بلا أخطاء، مع الحفاظ على كل الحقائق المذكورة ولا تخترع.
4. عنوان مبتور/عناوين ركيكة: حسّن العنوان لأقل من 60 حرفاً واضحاً (النوع+الماركة+الموديل+السنة).
5. محافظة/علامة/موديل غير معروفة: استخرجها من النص إن وُجدت، وإلا اطبع القيمة المكتوبة كما هي.
6. "condition": حوّل إلى "new" أو "used" ويتطابق مع النص.

قواعد صارمة:
- لا تضف أي حقل غير مذكور في الأسباب أو الناقص فعلاً. الحقول السليمة فعلًا لا تُدرج في القائمة.
- لا تختلق أرقام هواتف أو أسعاراً غير معقولة. سعر التفاوض 0 مسموح.
- صيغة الإخراج: مصفوفة "fixes" كل عنصر منها object بالحقول أعلاه. لازم كل سبب وارد في الأسباب يكون له حل، وأقصى 6 إصلاحات.`;

async function handleFixAd(req, res) {
  const { title = '', description = '', price, category = '', subcategory = '', governorate = '', location = '', brand = '', model = '', year = '', condition = '', contactPhone = '', userPhone = '', advertiserName = '', reasons = [] } = req.body || {};

  const priceNum = Number(price);
  const isBadPrice = Number.isFinite(priceNum) && priceNum < 0;
  const hasPhone = /01[0125]\d{8}/.test(String(contactPhone || '').replace(/[^\d]/g, ''));
  const contactOrOwner = hasPhone ? String(contactPhone || '') : String(userPhone || '');
  const ownerPhone = /01[0125]\d{8}/.test(String(contactOrOwner).replace(/[^\d]/g, '')) ? contactOrOwner : '';

  // fallback دقيق بدون AI: إصلاحات مضمونة تعالج أسباب الرفض المنشورة تلقائياً
  const fallbackFixes = [];
  if (isBadPrice) fallbackFixes.push({ field: 'price', value: '0', reason: 'السعر السالب مرفوض — حددناه بالاتفاق (0) ليتفاوض المشتري مع البائع' });
  if (!hasPhone) {
    const phone = ownerPhone.replace(/[^\d]/g, '');
    if (phone.length >= 10) fallbackFixes.push({ field: 'contactPhone', value: phone, reason: 'رقم التواصل ناقص — استخدمنا رقم هاتف صاحب الإعلان المسجل' });
  }
  if (String(description).trim().length < 30) {
    const parts = [title, brand ? `الماركة: ${brand}` : '', model ? `الموديل: ${model}` : '', year ? `سنة الصنع: ${year}` : '', category ? `الفئة: ${category}` : '', governorate ? `المحافظة: ${governorate}` : '', Number.isFinite(priceNum) && priceNum > 0 ? `السعر: ${priceNum} جنيه` : 'السعر: بالاتفاق'];
    const newDesc = parts.filter(Boolean).join('\n') + '\nالتواصل عبر الهاتف الموجود بالإعلان. المعاينة والفحص متاحان للجادين فقط.';
    fallbackFixes.push({ field: 'description', value: newDesc, reason: 'الوصف قصير/غير واضح — أعيدت صياغته من بيانات الإعلان ليكون بيعياً منظمًا' });
  }

  if (!isAIEnabled()) {
    return res.status(200).json({ ok: true, fixes: fallbackFixes, source: 'rules' });
  }

  try {
    const reasonsText = Array.isArray(reasons) && reasons.length ? reasons.join('؛ ') : 'لا توجد أسباب واضحة — راجع البيانات';
    const priceText = Number.isFinite(priceNum) ? `${priceNum} جنيه` : 'غير محدد';
    const result = await aiJson({
      system: FIX_SYSTEM,
      schema: { fixes: [{ field: 'string', value: 'string', reason: 'string' }] },
      prompt: `الإعلان الحالي:
العنوان: ${title}
الوصف: ${description}
السعر: ${priceText}
الفئة: ${category}${subcategory ? ' / ' + subcategory : ''}
المحافظة: ${governorate}${location ? ' — المكان: ' + location : ''}
الماركة: ${brand} — الموديل: ${model}${year ? ' — سنة: ' + year : ''}${condition ? ' — الحالة: ' + condition : ''}
هاتف المالك المسجل: ${userPhone || 'غير متوفر'} — هاتف التواصل الحالي: ${contactPhone || 'غائب'}
اسم المعلن: ${advertiserName || ''}

أسباب المشاكل (يجب معالجة كل منها):
${reasonsText}

أعدّ قائمة إصلاحات عملية جاهزة للتطبيق الفوري لحل هذه الأسباب كلها.`,
      maxTokens: 1400,
    });
    const aiFixes = Array.isArray(result.fixes) ? result.fixes.filter((f) => f && typeof f === 'object' && f.field && f.value != null).slice(0, 6) : [];
    const merged = [...aiFixes, ...fallbackFixes.filter((f) => !aiFixes.some((a) => a.field === f.field))].slice(0, 6);
    return res.status(200).json({ ok: true, fixes: merged, source: 'ai' });
  } catch {
    return res.status(200).json({ ok: true, fixes: fallbackFixes, source: 'rules' });
  }
}

// ── promo-draft ───────────────────────────────────────────────
// يولّد رسالة دعاية مصرية ودية للأدمن يبعتها لصاحب الإعلان (تجديد/ترقية/بيع أسرع)
const PROMO_SYSTEM = `أنت مساعد التسويق الذكي في "كار مصر CarMasr" — أكبر سوق إلكتروني مصري للشاحنات والمعدات الثقيلة والمقطورات والحمولات وقطع الغيار والوظائف.

مهمتك: من بيانات إعلان واحد، جهّز ثلاث رسائل دعاية جاهزة (كل واحدة أسلوب مختلف) يبعتُها مدير المنصة لصاحب الإعلان على واتساب/مسنجر:
1. "تجديد رعاية": رسالة ودية تضيف قيمة (مثلاً تجديد ظهور الإعلان أو إضافة صورة أفضل) بلا طلب مباشر محرج.
2. "ترقية مميزة": رسالة تعرض ترقية الإعلان إلى مميز أعلى في نتائج البحث وتوضيح فائدتها.
3. "بيع أسرع": رسالة بها نصيحتان بسيطتان لبيع أسرع (تحديث السعر، صورة أوضح، رد سريع على العملاء) بأسلوب مساعد لا مفتش.

قواعد صارمة:
- كل رسالة قصيرة ومركّزة: نص العرض 60–120 حرفاً، والرسالة كلها (بمناسبة الإعلان عن المنصة تذييلها) بين 180 و 280 حرفاً فقط.
- "الإعلان عن المنصة" إجباري في كل رسالة: سطر ترويجي قصير باسم المنصة وخدماتها + "حمّل التطبيق: {لينك التحميل}" + سطر متابعة: "تابعنا: {لينك الفيس}" — كل ده كسطر أو سطرين مختصرين جداً في نهاية الرسالة، قبل التوقيع.
- استخدم اسم المعلن (إن ذُكر) بتحية مناسبة (أستاذ/حاج/أخ) وسلعة الإعلان (العنوان/الماركة/الموديل/السنة) — لا تذكره إن لم يذكر.
- في نهاية كل رسالة سطر توقيع: "فريق كار مصر CarMasr — 01277177710 (واتساب)".
- "recommended": label للرسالة الأفضل لمعدل الاستجابة بناءً على الإعلان.
- لا تذكر أرقاماً أو روابط غير اللينكات المعروضة في الرسالة.`;

async function handlePromoDraft(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل بعد' });
  const { name = '', listing = {} } = req.body || {};
  const title = listing?.title || '';
  const brand = listing?.brand || '';
  const model = listing?.model || '';
  const year = listing?.year || '';
  const governorate = listing?.governorate || '';
  const rawPrice = Number(listing?.price);
  const priceText = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice.toLocaleString('ar-EG') + ' جنيه' : 'غير محدد';
  if (!title && !brand && !model) return res.status(400).json({ ok: false, message: 'بيانات الإعلان غير كافية' });

  const result = await aiJson({
    system: PROMO_SYSTEM,
    schema: {
      variants: [{ label: 'string', text: 'string' }],
      recommended: 'string',
    },
    prompt: `اسم المعلن: ${name || 'غير مذكور'}\nالإعلان: ${[title, brand, model].filter(Boolean).join(' ')}\nسنة: ${year || 'غير محدد'} — المحافظة: ${governorate || 'غير محدد'} — السعر: ${priceText}\nمنصة CarMasr — لا يفوّتك "الإعلان عن المنصة": نزّل التطبيق: ${appDownloadUrl()} — تابعنا: ${FACEBOOK_PAGE_URL}`,
    maxTokens: 1600,
  });

  const variants = Array.isArray(result.variants)
    ? result.variants.filter((v) => v && (v.label || v.text)).slice(0, 3)
        .map((v) => ({ label: String(v.label || 'رسالة').trim().slice(0, 40), text: String(v.text || '').trim().slice(0, 1000) }))
    : [];
  const recommended = String(result.recommended || '').trim().slice(0, 40);

  return res.status(200).json({ ok: true, variants, recommended });
}

// ── marketing-post ───────────────────────────────────────────────
// يولّد بوست تسويقي (عربي) مخصص لمجموعة فيسبوك (للنشر اليدوي/مسودة)
const MARKETING_POST_SYSTEM = `أنت "كاتب محتوى" في منصة "كار مصر CarMasr" — أكبر سوق إلكتروني مصري للشاحنات والمعدات الثقيلة والمقطورات والحمولات وقطع الغيار والوظائف.

مهمتك: كتابة بوست Facebook (عربي) مخصص لمجموعة معينة (اسم الجروب + المحافظة) لجذب أعضاء المجموعة للمنصة.

قواعد صارمة:
- طول البوست: 80–160 كلمة (لا أكثر).
- أسلوب ودّي، محلي (لهجة عراقية/خليجية أو مصرية حسب السياق — here Egyptian Arabic).
- اذكر اسم المجموعة أو المحافظة (إن ذُكرا) naturally.
- اذكر 2–3 مزايا للمنصة (بيع/شراء، حمولات، وظائف، قطع غيار، معارض، تمويل).
- "التسجيل ورفع الإعلانات مجاني 100%" إجباري.
- أضف 1–2 emoji مناسبة (لا إفراط).
- أضف 4–8 hashtags في النهاية.
- لا تذكر أرقام هاتف أو روابط (سوى رابط المنصة: carmasr-app.vercel.app).
- لا تطلب تحويل مسبق أو معلومات حساسة.
- أرجع JSON: { "text": "..." }`;

async function handleMarketingPost(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل — أضف GROQ_API_KEY في Vercel' });
  const { groupName = '', governorate = '', topic = '' } = req.body || {};
  if (!groupName && !governorate) return res.status(400).json({ ok: false, message: 'اسم الجروب أو المحافظة مطلوب' });

  try {
    const result = await aiJson({
      system: MARKETING_POST_SYSTEM,
      schema: { text: 'string' },
      prompt: `اسم الجروب: ${groupName || 'غير مذكور'}\nالمحافظة: ${governorate || 'غير مذكورة'}\nالموضوع (اختياري): ${topic || 'عام'}\n\nاكتب بوست Facebook فريد (80–160 كلمة) مخصص لهذا الجروب.`,
      maxTokens: 600,
    });
    const text = String(result?.text || '').trim().slice(0, 1500);
    if (!text) throw new Error('AI_EMPTY_RESPONSE');
    return res.status(200).json({ ok: true, text, source: 'ai' });
  } catch (e) {
    const err = handleAIError(e);
    return res.status(200).json({ ok: false, error: err.error, message: err.message });
  }
}

// ── marketing-lead-score ─────────────────────────────────────────
const LEAD_SCORE_SYSTEM = `أنت "صياد العملاء" في منصة "كار مصر CarMasr". مهمتك: تقييم عميل محتمل (lead) وتحديد أولويته (hot/warm/cold) + اقتراح أسلوب التواصل.

أرجع JSON: { "score": "hot|warm|cold", "reason": "string (≤80 chars)", "approach": "string (≤120 chars)" }`;

async function handleMarketingLeadScore(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل' });
  const { name = '', phone = '', governorate = '', serviceType = '', notes = '' } = req.body || {};
  if (!name && !phone) return res.status(400).json({ ok: false, message: 'اسم أو رقم مطلوب' });
  try {
    const result = await aiJson({
      system: LEAD_SCORE_SYSTEM,
      schema: { score: 'string', reason: 'string', approach: 'string' },
      prompt: `العميل: ${name}\nالهاتف: ${phone}\nالمحافظة: ${governorate || 'غير مذكورة'}\nالخدمة: ${serviceType || 'غير محددة'}\nملاحظات: ${notes || 'لا توجد'}`,
      maxTokens: 300,
    });
    return res.status(200).json({ ok: true, score: result?.score || 'warm', reason: result?.reason || '', approach: result?.approach || '', source: 'ai' });
  } catch (e) {
    const err = handleAIError(e);
    return res.status(200).json({ ok: false, error: err.error, message: err.message });
  }
}

// ── marketing-wa-message ─────────────────────────────────────────
const WA_MESSAGE_SYSTEM = `أنت "كاتب المبيعات" في منصة "كار مصر CarMasr". مهمتك: كتابة رسالة واتساب مخصصة (عربي) لعميل محتمل، بأسلوب ودّي ومختصر (3-5 جمل). 

قواعد:
- اذكر اسم العميل (إن ذُكر).
- اذكر خدمة/حاجة العميل (إن ذُكرت).
- اذكر 1-2 ميزة للمنصة (مجانية، بيع/شراء، حمولات، وظائف).
- "التسجيل مجاني" إجباري.
- لا تطلب تحويل مسبق أو معلومات حساسة.
- أرجع JSON: { "text": "..." }`;

async function handleMarketingWaMessage(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل' });
  const { name = '', governorate = '', serviceType = '', adLink = '' } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'اسم العميل مطلوب' });
  try {
    const result = await aiJson({
      system: WA_MESSAGE_SYSTEM,
      schema: { text: 'string' },
      prompt: `العميل: ${name}\nالمحافظة: ${governorate || 'غير مذكورة'}\nالخدمة: ${serviceType || 'غير محددة'}\nرابط الإعلان (إن وجد): ${adLink || 'لا يوجد'}`,
      maxTokens: 400,
    });
    const text = String(result?.text || '').trim().slice(0, 1000);
    if (!text) throw new Error('AI_EMPTY_RESPONSE');
    return res.status(200).json({ ok: true, text, source: 'ai' });
  } catch (e) {
    const err = handleAIError(e);
    return res.status(200).json({ ok: false, error: err.error, message: err.message });
  }
}

// ── marketing-review ─────────────────────────────────────────────
const MARKETING_REVIEW_SYSTEM = `أنت "المراجع" في منصة "كار مصر CarMasr". مهمتك: فحص مسودة (بوست/رسالة) وتحديد مشاكل (أرقام هاتف، روابط، طول، تكرار، محتوى غير مناسب). 

أرجع JSON: { "issues": ["string", ...], "ok": boolean, "suggestion": "string (≤120 chars)" }`;

async function handleMarketingReview(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل' });
  const { text = '', kind = 'post' } = req.body || {};
  if (!text || text.trim().length < 10) return res.status(400).json({ ok: false, message: 'النص قصير جداً' });
  try {
    const result = await aiJson({
      system: MARKETING_REVIEW_SYSTEM,
      schema: { issues: ['string'], ok: 'boolean', suggestion: 'string' },
      prompt: `نوع المسودة: ${kind}\nالنص:\n${text.slice(0, 1500)}`,
      maxTokens: 400,
    });
    return res.status(200).json({ ok: true, issues: Array.isArray(result?.issues) ? result.issues.slice(0, 8) : [], pass: !!result?.ok, suggestion: result?.suggestion || '', source: 'ai' });
  } catch (e) {
    const err = handleAIError(e);
    return res.status(200).json({ ok: false, error: err.error, message: err.message });
  }
}

// ── marketing-summary ─────────────────────────────────────────────
const SUMMARY_SYSTEM = `أنت "المدير" في منصة "كار مصر CarMasr". مهمتك: جمع خلاصة يومية (3-5 جمل) من بيانات النشر/العملاء/المسودات، مع آخر سطر "مستني موافقتك".

أرجع JSON: { "summary": "string (≤200 chars)", "lastLine": "string (≤80 chars)" }`;

async function handleMarketingSummary(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل' });
  const { postsCount = 0, leadsCount = 0, draftsCount = 0, governorates = [] } = req.body || {};
  try {
    const result = await aiJson({
      system: SUMMARY_SYSTEM,
      schema: { summary: 'string', lastLine: 'string' },
      prompt: `بيانات اليوم:\n- بوستات مُجهّزة: ${postsCount}\n- عملاء: ${leadsCount}\n- مسودات: ${draftsCount}\n- محافظات: ${Array.isArray(governorates) ? governorates.join(', ') : 'غير محدد'}`,
      maxTokens: 300,
    });
    return res.status(200).json({ ok: true, summary: result?.summary || '', lastLine: result?.lastLine || 'مستني موافقتك', source: 'ai' });
  } catch (e) {
    const err = handleAIError(e);
    return res.status(200).json({ ok: false, error: err.error, message: err.message });
  }
}

// ── marketing-variants ───────────────────────────────────────────
// نسخة مختلفة من نفس البوست لكل جروب (عشان فيسبوك ميشوفهاش نسخ مكرر)
const VARIANTS_SYSTEM = `أنت "كاتب محتوى" في منصة "كار مصر CarMasr" — سوق مصري للشاحنات والمعدات الثقيلة والمقطورات والحمولات وقطع الغيار والوظائف.

مهمتك: تاخد بوست تسويقي واحد وتعمل منه نسخة مختلفة لكل جروب فيسبوك، بنفس الفكرة وبصياغة مختلفة تمامًا.

قواعد صارمة:
- كل نسخة مستقلة: افتتاحية مختلفة، ترتيب مختلف للمزايا، نداء (CTA) مختلف — ممنوع تكرر نفس الجُمل بين النسخ.
- اذكر اسم الجروب أو المحافظة بشكل طبيعي لو متاح (مرة واحدة، بدون مبالغة).
- طول كل نسخة 50–90 كلمة (قصيرة ومؤثرة).
- "التسجيل ورفع الإعلانات مجاني 100%" لازم تكون موجودة في كل نسخة.
- 3–5 هاشتاجات في نهاية كل نسخة.
- ممنوع أي أرقام هواتف. مسموح برابط واحد فقط: carmasr-app.vercel.app
- لهجة مصرية ودّية + 1–2 إيموجي فقط.
- أرجع JSON: { "variants": [{ "id": "معرّف الجروب كما وصلك", "text": "..." }] }
- لازم ترجع نسخة واحدة لكل جروب مرسل، بنفس الـ id بالظبط، بدون أي نسخة ناقصة أو زيادة.`;

async function handleMarketingVariants(req, res) {
  if (!isAIEnabled()) return res.status(200).json({ ok: false, error: 'AI_NOT_CONFIGURED', message: 'الذكاء الاصطناعي غير مفعّل — أضف GROQ_API_KEY في Vercel' });
  const { text = '', groups = [] } = req.body || {};
  const base = String(text || '').trim();
  if (!base) return res.status(400).json({ ok: false, message: 'نص البوست مطلوب' });
  const list = (Array.isArray(groups) ? groups : [])
    .filter((g) => g && g.id)
    .slice(0, 10)
    .map((g) => ({ id: String(g.id), name: String(g.name || '').slice(0, 120), governorate: String(g.governorate || '').slice(0, 60) }));
  if (!list.length) return res.status(400).json({ ok: false, message: 'لازم جروب واحد على الأقل' });

  const groupLines = list
    .map((g, i) => `${i + 1}. id=${g.id} | الجروب: ${g.name || 'غير معروف'} | المحافظة: ${g.governorate || 'غير معروفة'}`)
    .join('\n');

  try {
    const result = await aiJson({
      system: VARIANTS_SYSTEM,
      schema: { variants: [{ id: 'string', text: 'string' }] },
      prompt: `البوست الأصلي:\n"""\n${base.slice(0, 1600)}\n"""\n\nالجروبات (${list.length}):\n${groupLines}\n\nاكتب نسخة مختلفة لكل جروب بنفس الـ id.`,
      maxTokens: 3000,
    });
    const raw = Array.isArray(result?.variants) ? result.variants : [];
    const byId = new Map();
    for (const v of raw) {
      const id = String(v?.id || '').trim();
      const body = String(v?.text || '').trim().slice(0, 1500);
      if (!id || !body || byId.has(id)) continue;
      byId.set(id, body);
    }
    const variants = list
      .filter((g) => byId.has(g.id))
      .map((g) => ({ id: g.id, text: byId.get(g.id) }));
    if (!variants.length) throw new Error('AI_EMPTY_RESPONSE');
    return res.status(200).json({ ok: true, variants, requested: list.length, source: 'ai' });
  } catch (e) {
    const err = handleAIError(e);
    return res.status(200).json({ ok: false, error: err.error, message: err.message });
  }
}
