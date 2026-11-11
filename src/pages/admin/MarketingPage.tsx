import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, Users, FileText, ShieldCheck, Copy, CheckCircle2, AlertTriangle,
  Download, Upload, Trash2, ExternalLink, Plus, RefreshCw, Send, Sparkles,
  ClipboardPaste, Link2, Phone, ListChecks, Image as ImageIcon, ChevronLeft, ChevronDown,
  Loader2,
} from 'lucide-react';
import { copyText, formatDateDMY, getWhatsAppLink } from '../../lib/utils';
import { getApiUrl } from '../../lib/config';
import { firebaseAuth } from '../../firebase';
import { listingsService } from '../../lib/firestoreService';

/* ────────────────────────────────────────────────────────────────────────
   مركز التسويق — نسخة مدمجة من ورشة «موظفين كار مصر»
   الفكرة: نفس أدوار الورشة (hunter / sales-writer / content-writer /
   support / reviewer) لكن جوه المنصة، والنتيجة مسودات بس.
   مفيش إرسال ولا نشر تلقائي — توفيق هو اللي يوافق وينشر بنفسه.
   ──────────────────────────────────────────────────────────────────────── */

type Props = {
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
};

type Lead = {
  id: string;
  name: string;
  phone: string;
  governorate: string;
  serviceType: string;
  adLink?: string;
  notes?: string;
  contactedAt?: string;
};

type MktGroup = {
  id: string;
  name: string;
  governorate: string;
  url?: string;
};

type Draft = {
  id: string;
  kind: 'post' | 'message';
  targetId: string;
  targetName: string;
  governorate: string;
  text: string;
  createdAt: string;
  doneAt?: string;
};

const LS_TERMS = 'mkt_terms_v1';
const LS_LEADS = 'mkt_leads_v1';
const LS_GROUPS = 'mkt_groups_v1';
const LS_DRAFTS = 'mkt_drafts_v1';
const LS_FB_GROUPS = 'fbGroups_local';
const PLATFORM = 'https://carmasr-app.vercel.app';


const MARKETING_IMAGES = [
  { key: 'post-1', src: '/marketing/post-1.png', label: 'صورة ١' },
  { key: 'post-2', src: '/marketing/post-2.png', label: 'صورة ٢' },
  { key: 'post-3', src: '/marketing/post-3.png', label: 'صورة ٣' },
  { key: 'post-4', src: '/marketing/post-4.png', label: 'صورة ٤' },
  { key: 'post-5', src: '/marketing/post-5.png', label: 'صورة ٥' },
  { key: 'post-6', src: '/marketing/post-6.png', label: 'صورة ٦' },
  { key: 'post-7', src: '/marketing/post-7.png', label: 'صورة ٧' },
  { key: 'post-8', src: '/marketing/post-8.png', label: 'صورة ٨' },
  { key: 'post-9', src: '/marketing/post-9.png', label: 'صورة ٩' },
  { key: 'post-10', src: '/marketing/post-10.jpeg', label: 'صورة ١٠' },
];

const DEFAULT_TERMS = `# شروط وأرقام معتمدة (ممنوع استخدام أي رقم غيرها)

## منصة كار مصر
- التسجيل مجاني (رقم تليفون واسم، أو جيميل)
- الإعلانات على المنصة مجانية
- لينك المنصة: ${PLATFORM}

## تقسيط النقل الثقيل والمعدات
- دفعة مقدمة تبدأ من 20%
- فايدة 22%
- مدة التقسيط لحد 48 شهر
- الأوراق: بطاقة العميل، ضامنين (واحد قريب من الدرجة الأولى وواحد غريب)، وإثبات دخل للعميل (عربية نقل باسمه، أو أرض زراعية، أو سجل تجاري وبطاقة ضريبية)`;

const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية',
  'الغربية', 'المنوفية', 'كفر الشيخ', 'البحيرة', 'دمياط', 'بورسعيد',
  'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'الفيوم', 'بني سويف',
  'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر',
  'الوادي الجديد', 'مطروح',
];

const SERVICES = ['بيع وشراء', 'نقل', 'ميكانيكا', 'وظائف'];

const POST_HOOKS = [
  (gov: string) => `يا أهل ${gov} 👋 عندك عربية نقل أو معدات وعايز تبيعها؟`,
  (gov: string) => `في ${gov} وعندك شغل نقل أو معدات محتاجة زبون؟`,
  (gov: string) => `أصحاب النقل الثقيل في ${gov}، الكلام ده ليكم.`,
  (gov: string) => `بتدور على عربية نقل أو معدات في ${gov}؟ تعالى هنا.`,
  (gov: string) => `يا أهل ${gov}، سوق النقل الثقيل بقى في مكان واحد.`,
  (gov: string) => `عندك خدمة ميكانيكا أو وظيفة في ${gov}؟ اعرضها مجاناً.`,
  (gov: string) => `${gov} فيها شغل كتير — وعربيات كتير بتدور على شغل.`,
  (gov: string) => `من ${gov}؟ عندنا ليك سوق بيع وشراء ونقل ووظائف.`,
  (gov: string) => `عايز تشتري أو تبيع معدات في ${gov} من غير وسيط؟`,
  (gov: string) => `أصحاب العربيات والمعدات في ${gov}، الفرصة قدامكم.`,
];

const POST_BODIES = [
  'منصة كار مصر مجانية لنقل الثقيل: بيع وشراء، خدمات نقل، وظائف، وخدمات ميكانيكية.',
  'على منصة كار مصر تلاقي عربيات ومعدات وخدمات نقل ووظائف في كل محافظات مصر.',
  'بيع واشتري، اعرض خدمة نقل، أو انشر وظيفة — كله في منصة واحدة.',
  'منصة كار مصر بتجمع أصحاب المعدات وأصحاب الشغل في مكان واحد.',
  'عربيات للبيع، حمولات، وظائف، وميكانيكا — كل ده على كار مصر.',
  'لو عندك عربية أو معدات أو خدمة، اعرضها واللي محتاجها هيلاقيك.',
  'منصة كار مصر مجانية بالكامل وبتخدم كل محافظات مصر.',
  'مش محتاج وسيط — اعرض إعلانك بنفسك ووصّل للي بيدور عليك.',
];

const POST_CLOSERS = [
  'التسجيل مجاني باسمك ورقمك أو بجيميل.',
  'سجّل مجاناً وابدأ تعرض إعلانك في دقايق.',
  'التسجيل والإعلانات مجانية — من غير أي رسوم.',
  'اعمل حساب مجاني واعرض عربيتك أو خدمتك النهاردة.',
  'افتح اللينك وسجّل مجاناً، وخلّي الناس تلاقيك.',
];

/* قوالب جاهزة كتبها توفيق — للنسخ المباشر على فيسبوك أو للموقع */
const PLATFORM_SHORT_POST = `📣 عندك شاحنة؟ حمولة؟ معدة؟ خدمة؟ وظيفة؟

مكانك على كار مصر | CarMasr 🚛

كار مصر منصة متخصصة في سوق النقل الثقيل في مصر، وهدفها تجمع أطراف السوق في مكان واحد:

🚛 البائعين والمشترين
📦 أصحاب الحمولات وأصحاب الشاحنات
💼 أصحاب العمل والباحثين عن وظائف
🔧 الورش ومقدمي الخدمات
🔩 تجار قطع الغيار
💰 جهات التمويل
🆘 خدمات الطوارئ

والتسجيل ورفع الإعلانات مجاني 100%.

🌐 منصة كار مصر:
${PLATFORM}
https://www.facebook.com/TareeqEG/

🚛 كار مصر | CarMasr
نكبر سوق النقل مع بعض.

#كار_مصر #CarMasr #النقل_الثقيل #سوق_النقل_الثقيل #شاحنات #حمولات #معدات_ثقيلة #نقل_بضائع #وظائف_نقل #قطع_غيار #تمويل_شاحنات #خدمات_النقل #شاحنات_مصر`;

const PLATFORM_OVERVIEW = `# 🚛 كار مصر | CarMasr
### أكبر سوق إلكتروني متخصص في مركبات النقل الثقيل والمعدات في مصر

كار مصر هو منصة إلكترونية متخصصة في قطاع النقل الثقيل في مصر، هدفها جمع كل ما يحتاجه أصحاب الشاحنات والمعدات، والتجار، والمشترين، وأصحاب الحمولات في مكان واحد.

من خلال كار مصر، تقدر تستعرض إعلانات الشاحنات ومركبات النقل الثقيل والمقطورات والمعدات، وتبحث عن الحمولات المتاحة، وتتابع فرص العمل، وتصل إلى قطع الغيار والورش والخدمات المتخصصة، بالإضافة إلى حلول تمويل المركبات وخدمات الطوارئ على الطريق.

## 🔹 إيه اللي هتلاقيه على كار مصر؟

🚛 **الشاحنات والمركبات:** بيع وشراء مركبات النقل الثقيل بمختلف أنواعها وموديلاتها.

🏗️ **المعدات الثقيلة:** إعلانات المعدات والآلات المستخدمة في مواقع العمل والإنشاءات.

📦 **الحمولات وبورصة الشحن:** ربط أصحاب الشاحنات بأصحاب البضائع والحمولات لزيادة فرص التشغيل.

💼 **الوظائف:** فرص عمل في قطاع النقل الثقيل والسائقين والمهن المرتبطة به.

🔧 **قطع الغيار والورش والخدمات:** الوصول إلى قطع الغيار ومقدمي الخدمات المتخصصة في النقل.

💰 **تمويل المركبات:** الوصول إلى فرص وحلول تمويلية مناسبة وفقًا للشروط المتاحة.

🆘 **طوارئ الطريق:** المساعدة في الوصول إلى خدمات مثل الونش والميكانيكي المتنقل وخدمات الإطارات.

## 🎯 هدفنا

نربط البائعين والمشترين وأصحاب الحمولة في بيئة منظمة تسهّل الوصول إلى الفرص والإعلانات والتواصل المباشر، وتساعد على توفير الوقت والجهد وتوسيع شبكة العلاقات داخل سوق النقل الثقيل.

**كار مصر | CarMasr — كل احتياجات النقل الثقيل في مكان واحد.**

🌐 ${PLATFORM}

📘 تابعنا على فيسبوك: https://www.facebook.com/TareeqEG/`;

const PLATFORM_ALT_POST = `🚛 عندك عربية نقل؟ أو شغال في مجال النقل الثقيل?

كار مصر CarMasr… مكانك في سوق النقل الثقيل!

بدل ما تلف بين جروبات الفيسبوك وتدور على اللي محتاجه، كار مصر بتجمع أهل المجال في مكان واحد.

تقدر من خلال كار مصر:

🚚 تبيع أو تشتري شاحنات وجرارات ومقطورات.

🏗️ تعرض معداتك الثقيلة للبيع أو للإيجار.

📦 تنشر حمولاتك أو تلاقي عربية تنقل بضاعتك.

💼 تدور على سائقين أو فنيين أو فرص عمل.

🔧 تلاقي ورش وميكانيكية وكهربائية وخدمات كار مصر.

🔩 تبيع وتشتري قطع غيار وكاوتش وزيوت.

🏢 تعرض نشاط معرضك أو شركتك أو ورشتك.

📢 انشر إعلانك مجانًا 100%

سواء كنت صاحب عربية، سائق، تاجر، صاحب معرض، شركة نقل أو صاحب نشاط يخدم المجال… مكانك معانا.

🌐 ادخل منصة كار مصر:
${PLATFORM}

📱 حمّل تطبيق كار مصر:
${PLATFORM}/download-page/

🤝 كار مصر بتكبر بيك… وبمشاركة أهل المجال.

انضم لينا، وانشر إعلانك، وعرّف غيرك بكار مصر.

كار مصر CarMasr — كل ما يخص النقل الثقيل في مكان واحد.`;

const SHORT_FORM_CAPTIONS: { key: string; title: string; text: string }[] = [
  {
    key: 'sf-trucks',
    title: '١. بيع/شراء شاحنات (١٥–٣٠ ثانية)',
    text: `🚛 عندك شاحنة؟ وعايز بيعها أو بتدور على عربية نقل؟

كار مصر CarMasr — سوق النقل الثقيل في مكان واحد.

📸 صور + مواصفات + مكان + تواصل مباشر.
🌐 ${PLATFORM}

#كار_مصر #CarMasr #شاحنات #بيع_وشراء_شاحنات #نقل_ثقيل #شاحنات_مصر`,
  },
  {
    key: 'sf-loads',
    title: '٢. حمولات وبورصة شحن (١٥–٣٠ ثانية)',
    text: `📦 عندك حمولة؟ أو عندك عربية وبتدور على شغل؟

كار مصر CarMasr يقرّب المسافة بين صاحب الحمولة وصاحب العربية.

🚛 نوع حمولة • 📍 تحميل/وصول • 📞 تواصل مباشر.
🌐 ${PLATFORM}

#كار_مصر #CarMasr #حمولات #بورصة_الشحن #نقل_بضائع #فرص_نقل`,
  },
  {
    key: 'sf-jobs',
    title: '٣. وظائف نقل (١٥–٣٠ ثانية)',
    text: `💼 بتدور على شغل في مجال النقل؟

كار مصر CarMasr يجمع فرص العمل في قطاع النقل الثقيل.

👨‍🔧 سائقين • 🔧 فنيين • 🏢 شركات نقل.
🌐 ${PLATFORM}

#كار_مصر #CarMasr #وظائف_نقل #وظائف_سائقين #سائق_شاحنة #فرص_عمل`,
  },
];


const SERVICE_SCRIPTS: { key: string; title: string; text: string }[] = [
  {
    key: 'intro',
    title: '١. التعريف بمنصة كار مصر',
    text: `🚛 كار مصر | CarMasr

أكبر سوق إلكتروني متخصص في مركبات النقل الثقيل والمعدات في مصر 🇪🇬

لو شغلك في النقل، كار مصر معمول علشان يجمع لك أهم الخدمات والفرص في مكان واحد.

📌 بيع وشراء الشاحنات والمعدات
📦 حمولات وفرص تشغيل
💼 وظائف في قطاع النقل
🔧 ورش وقطع غيار وخدمات
💰 تمويل المركبات
🆘 طوارئ الطريق

هدفنا إننا نسهّل التواصل بين أصحاب الشاحنات والمشترين والبائعين وأصحاب الحمولات، ونساعد في خلق فرص أكتر داخل سوق النقل الثقيل.

🌐 جرّب كار مصر:
${PLATFORM}

كار مصر | CarMasr — كل احتياجات النقل الثقيل في مكان واحد.

#كار_مصر #CarMasr #النقل_الثقيل #نقل #شاحنات #مصر`,
  },
  {
    key: 'vehicles',
    title: '٢. الشاحنات والمعدات',
    text: `🚛 الشاحنات والمعدات على كار مصر | CarMasr

بتدور على عربية نقل أو معدة؟
أو عندك شاحنة أو معدة وعايز تعرضها للبيع؟

كار مصر بيوفر لك مكان متخصص لعرض ومتابعة إعلانات مركبات النقل الثقيل والمعدات في مصر.

🚚 شاحنات
🚛 جرارات
🛻 مقطورات
🏗️ معدات ثقيلة

📸 اعرض صور ومواصفات مركبتك
📍 حدد مكانها
📞 وخلي العميل يتواصل معاك مباشرة.

والتسجيل ورفع الإعلانات مجاني 100%.

🌐 ${PLATFORM}

#كار_مصر #CarMasr #شاحنات #سيارات_نقل #نقل_ثقيل #معدات_ثقيلة #جرارات #مقطورات #بيع_وشراء_شاحنات #سوق_النقل_الثقيل #شاحنات_مصر #معدات_مصر`,
  },
  {
    key: 'loads',
    title: '٣. الحمولات وبورصة الشحن',
    text: `📦 عندك حمولة؟ أو عندك عربية وبتدور على شغل؟

من خلال الحمولات على كار مصر | CarMasr تقدر توصل لفرص تشغيل أكتر داخل مصر وخارجها.

أصحاب الحمولات يقدروا يعرضوا احتياجاتهم، وأصحاب الشاحنات يقدروا يبحثوا عن الحمولات المناسبة لهم.

🚛 نوع الحمولة
📍 مكان التحميل والوصول
📦 نوع البضاعة
📅 تفاصيل الشحنة
📞 تواصل مباشر

هدفنا إننا نقرّب المسافة بين صاحب الحمولة وصاحب العربية ونساعد في زيادة فرص التشغيل.

🌐 ${PLATFORM}

كار مصر | CarMasr — نربط النقل بالحمولة.

#كار_مصر #CarMasr #حمولات #بورصة_الشحن #شحن_ونقل #نقل_بضائع #شحن_بري #نقل_ثقيل #شاحنات #أصحاب_الحمولات #فرص_نقل #حمولات_مصر`,
  },
  {
    key: 'jobs',
    title: '٤. الوظائف',
    text: `💼 بتدور على شغل في مجال النقل؟

كار مصر مش بس لبيع وشراء الشاحنات.

منصة كار مصر بتجمع كمان فرص العمل المرتبطة بقطاع النقل الثقيل.

👨‍🔧 سائقين
🚛 وظائف نقل
🔧 فنيين وحرفيين
🏢 فرص داخل شركات ومؤسسات النقل

لو بتدور على فرصة أو عندك وظيفة وعايز توصل للناس المناسبة، كار مصر بيساعدك توصل بشكل أسهل.

🌐 ${PLATFORM}

#كار_مصر #CarMasr #وظائف_نقل #وظائف_سائقين #سائقين #سائق_شاحنة #وظائف_سائقين_مصر #فرص_عمل #وظائف_النقل #النقل_الثقيل #شركات_النقل`,
  },
  {
    key: 'parts',
    title: '٥. قطع الغيار والورش والخدمات',
    text: `🔧 عربيتك محتاجة صيانة؟ محتاج قطعة غيار أو خدمة؟

كار مصر بيجمع لك خدمات واحتياجات النقل الثقيل في مكان واحد.

🛠️ ورش
🔩 قطع غيار
🚛 خدمات متخصصة
🔧 فنيين ومقدمي خدمات

لو بتقدم خدمة مرتبطة بالنقل الثقيل، تقدر تعرض خدمتك وتوصل لعملاء محتاجينها.

ولو بتدور على خدمة، كار مصر يساعدك توصل لمقدم الخدمة المناسب.

🌐 ${PLATFORM}

كار مصر | CarMasr — خدمات النقل في مكان واحد.

#كار_مصر #CarMasr #قطع_غيار #قطع_غيار_شاحنات #ورش_شاحنات #صيانة_شاحنات #ميكانيكا_شاحنات #خدمات_النقل #معدات_النقل #النقل_الثقيل #شاحنات_مصر`,
  },
  {
    key: 'finance',
    title: '٦. تمويل المركبات',
    text: `💰 محتاج تمويل لمركبة أو معدات؟

كار مصر بيجمع أيضًا خدمات التمويل المرتبطة بقطاع النقل الثقيل والمعدات.

🚛 تمويل شاحنات
🏗️ تمويل معدات
💼 حلول تمويلية
📋 تعرف على الخيارات والشروط المتاحة

الهدف إن صاحب المشروع أو صاحب النشاط يقدر يوصل للمعلومة والجهة المناسبة بشكل أسهل.

🌐 ${PLATFORM}

#كار_مصر #CarMasr #تمويل_سيارات_نقل #تمويل_شاحنات #تمويل_معدات #تمويل_النقل_الثقيل #تقسيط_شاحنات #تمويل_مشروعات #حلول_تمويلية #شاحنات_مصر #النقل_الثقيل`,
  },
  {
    key: 'emergency',
    title: '٧. طوارئ الطريق',
    text: `🆘 حصلت مشكلة على الطريق؟

كار مصر بيهتم كمان بخدمات الطوارئ الخاصة بالنقل.

لو عربيتك تعطلت، تقدر تبحث عن الخدمات المرتبطة بالطوارئ مثل:

🚛 ونش
🔧 ميكانيكي
🛞 إطارات
⚙️ خدمات إصلاح
📍 خدمات قريبة منك

لأن في شغل النقل، الوقت مهم… ووجود الخدمة المناسبة في الوقت المناسب ممكن يفرق كتير.

🌐 ${PLATFORM}

كار مصر | CarMasr — معاك في الطريق.

#كار_مصر #CarMasr #طوارئ_الطريق #ونش #ونش_شاحنات #ميكانيكي_شاحنات #إصلاح_شاحنات #خدمات_طوارئ #إطارات_شاحنات #مساعدة_على_الطريق #النقل_الثقيل`,
  },
];

const PAIRED_TEMPLATES: { key: string; title: string; image: string; text: string }[] = [
  { key: 'p-1', title: '١. تعريف المنصة (أولًا)', image: '/marketing/post-1.png', text: PLATFORM_OVERVIEW },
  { key: 'p-2', title: '٢. فيديو: التعريف بمنصة كار مصر', image: '/marketing/post-2.png', text: SERVICE_SCRIPTS[0].text },
  { key: 'p-3', title: '٣. فيديو: الشاحنات والمعدات', image: '/marketing/post-3.png', text: SERVICE_SCRIPTS[1].text },
  { key: 'p-4', title: '٤. فيديو: الحمولات وبورصة الشحن', image: '/marketing/post-4.png', text: SERVICE_SCRIPTS[2].text },
  { key: 'p-5', title: '٥. فيديو: الوظائف', image: '/marketing/post-5.png', text: SERVICE_SCRIPTS[3].text },
  { key: 'p-6', title: '٦. فيديو: قطع الغيار والورش', image: '/marketing/post-6.png', text: SERVICE_SCRIPTS[4].text },
  { key: 'p-7', title: '٧. فيديو: تمويل المركبات', image: '/marketing/post-7.png', text: SERVICE_SCRIPTS[5].text },
  { key: 'p-8', title: '٨. فيديو: طوارئ الطريق', image: '/marketing/post-8.png', text: SERVICE_SCRIPTS[6].text },
  { key: 'p-9', title: '٩. المنشور الختامي الشامل (ثالثًا)', image: '/marketing/post-9.png', text: PLATFORM_SHORT_POST },
  { key: 'p-10', title: '١٠. بوست بديل (مع لينك تحميل)', image: '/marketing/post-10.jpeg', text: PLATFORM_ALT_POST },
];

/** نسخة نظيفة من الماركداون — جاهزة للصق على فيسبوك أو واتساب */
function stripMarkdown(text: string) {
  return String(text || '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const MESSAGE_OPENER = [
  (name: string, gov: string) => `أهلاً ${name}، أنا توفيق من منصة كار مصر — بنشتغل في ${gov} وكل مصر.`,
  (name: string) => `أهلاً ${name}، معاك توفيق من منصة كار مصر.`,
  (name: string, gov: string) => `أهلاً ${name}، توفيق من منصة كار مصر — بنشتغل في ${gov}.`,
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function downloadText(name: string, text: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

function normalizePhone(phone: string) {
  let n = String(phone || '').replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('0')) n = '20' + n.slice(1);
  else if (n && !n.startsWith('20')) n = '20' + n;
  return n;
}

function guessGovernorate(name: string) {
  for (const gov of GOVERNORATES) {
    if (name.includes(gov)) return gov;
  }
  return 'مصر';
}

/** CSV بسيط: يدعم الفاصلة أو Tab، ويتعامل مع العناوين */
function parseCsv(raw: string): string[][] {
  return String(raw || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(/\t|,|;/).map(cell => cell.trim().replace(/^"|"$/g, '')));
}

function csvEscape(value: unknown) {
  const v = String(value ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function buildPost(group: MktGroup, index: number) {
  const pool = [
    PLATFORM_SHORT_POST,
    PLATFORM_ALT_POST,
    stripMarkdown(PLATFORM_OVERVIEW),
    ...SERVICE_SCRIPTS.map(s => s.text),
  ];
  const base = pool[index % pool.length];
  // append group-specific line to ensure uniqueness (avoid FB spam flag)
  const suffix = `\n\n📌 ${group.name}`;
  return base + suffix;
}

function buildMessage(lead: Lead, index: number) {
  const gov = lead.governorate || 'مصر';
  const opener = MESSAGE_OPENER[index % MESSAGE_OPENER.length](lead.name || 'صاحب الإعلان', gov);
  const service = lead.serviceType || 'خدمات النقل';
  const pitch = lead.adLink
    ? `إعلانك مجهّز عندنا ومستنيك، ودي اللينك: ${lead.adLink}`
    : `سجّل مجاناً واعرض ${service} بتاعتك على المنصة: ${PLATFORM}`;
  const help = `التسجيل مجاني باسمك ورقمك أو بجيميل، وكل إعلاناتك على كار مصر مجانية.`;
  const outro = `لو مش حابب الإعلان يفضل أو مش عايز رسايل، قولّي وأنا أشيله فوراً.`;
  return `${opener}\n${pitch}\n${help}\n${outro}`;
}

/** مراجع الجودة — نفس شروط ورشة الموظفين لكن بشكل آلي */
function reviewText(text: string, kind: 'post' | 'message', terms: string, duplicates: number) {
  const issues: string[] = [];
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);

  if (kind === 'message') {
    if (lines.length > 6) issues.push(`الرسالة أطول من 6 سطور (${lines.length})`);
    if (!/(حذف|إيقاف|مش عايز|مش حابب|قولّي|قولي)/.test(text)) {
      issues.push('ناقص سطر حذف الإعلان/إيقاف الرسايل');
    }
  } else if (lines.length > 7) {
    issues.push(`البوست طويل (${lines.length} سطور) — يفضّل أقصر`);
  }

  // أرقام غير معتمدة — مع تجاهل اللينكات
  const withoutUrls = text.replace(/https?:\/\/\S+/g, ' ');
  const foundNumbers = withoutUrls.match(/\d{2,}(?:[.,]\d+)?/g) || [];
  const allowed = new Set((terms.match(/\d{2,}(?:[.,]\d+)?/g) || []).map(n => n.replace(/[.,]$/, '')));
  for (const n of foundNumbers) {
    if (!allowed.has(n.replace(/[.,]$/, ''))) {
      issues.push(`رقم غير معتمد: ${n}`);
    }
  }

  if (/مضمون|أكيد هتبيع|هتكسب|أرباح|مليون|مليارد/.test(text)) {
    issues.push('فيه وعد مبالغ فيه أو كلام غير مضمون');
  }
  if (/رقم بطاقة|بطاقة رقم|عنوان تفصيلي/.test(text)) {
    issues.push('فيه بيانات شخصية زيادة');
  }
  if (duplicates > 1) {
    issues.push('نفس النص متكرر أكتر من مرة — فيسبوك بيعتبره سبام');
  }
  return issues;
}

export default function MarketingPage({ toast }: Props) {
  const [terms, setTerms] = useState<string>(() => {
    try { return localStorage.getItem(LS_TERMS) || DEFAULT_TERMS; } catch { return DEFAULT_TERMS; }
  });
  const [leads, setLeads] = useState<Lead[]>(() => loadJson<Lead[]>(LS_LEADS, []));
  const [groups, setGroups] = useState<MktGroup[]>(() => loadJson<MktGroup[]>(LS_GROUPS, []));
  const [drafts, setDrafts] = useState<Draft[]>(() => loadJson<Draft[]>(LS_DRAFTS, []));
  const [aiGenerating, setAiGenerating] = useState(false);

  const [tab, setTab] = useState<'posts' | 'leads' | 'review' | 'templates' | 'shorts' | 'rules'>('posts');
  const [overviewMd, setOverviewMd] = useState(false);

  const [leadCsv, setLeadCsv] = useState('');
  const [groupCsv, setGroupCsv] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({});
  const [selectedLeads, setSelectedLeads] = useState<Record<string, boolean>>({});
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', governorate: 'القاهرة', serviceType: SERVICES[0], adLink: '' });
  const [showAddLead, setShowAddLead] = useState(false);

  // تتبّع حالة النشر على فيسبوك (نفس مفاتيح صفحة النشر)
  const [groupStatusFilter, setGroupStatusFilter] = useState<'all' | 'todo' | 'done' | 'batch'>('all');
  const [draftFilter, setDraftFilter] = useState<'all' | 'ready' | 'done'>('all');
  const [fbPosted, setFbPosted] = useState<Record<string, string>>(
    () => loadJson<Record<string, string>>('fb_pub_posted_v1', {})
  );
  const [fbQueued, setFbQueued] = useState<string[]>(() => {
    const q = loadJson<{ ids?: string[] }>('fb_pub_queue_v1', {});
    return Array.isArray(q.ids) ? q.ids : [];
  });

  const leadFileRef = useRef<HTMLInputElement | null>(null);
  const groupFileRef = useRef<HTMLInputElement | null>(null);
  const postsRef = useRef<HTMLElement | null>(null);
  const messagesRef = useRef<HTMLElement | null>(null);

  /* ── الحفظ التلقائي ─────────────────────────────────────────────────── */
  useEffect(() => { try { localStorage.setItem(LS_TERMS, terms); } catch { /* ignore */ } }, [terms]);
  useEffect(() => { saveJson(LS_LEADS, leads); }, [leads]);
  useEffect(() => { saveJson(LS_GROUPS, groups); }, [groups]);
  useEffect(() => { saveJson(LS_DRAFTS, drafts); }, [drafts]);

  // نحدّث حالة النشر لما نرجع من تاب فيسبوك أو من صفحة النشر
  useEffect(() => {
    const refresh = () => {
      setFbPosted(loadJson<Record<string, string>>('fb_pub_posted_v1', {}));
      const q = loadJson<{ ids?: string[] }>('fb_pub_queue_v1', {});
      setFbQueued(Array.isArray(q.ids) ? q.ids : []);
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // أول ما الجروبات/العملاء يتحمّلوا، نحدد أول 10 جروبات وأول 20 عميل تلقائيًا
  // عشان زرار «جهّز» يشتغل من أول ضغطة من غير ما تحتار.
  useEffect(() => {
    setSelectedGroups(prev => {
      if (Object.keys(prev).length || !groups.length) return prev;
      return Object.fromEntries(groups.slice(0, 10).map(g => [g.id, true]));
    });
  }, [groups]);

  useEffect(() => {
    setSelectedLeads(prev => {
      if (Object.keys(prev).length || !leads.length) return prev;
      const fresh = leads.filter(l => !l.contactedAt).slice(0, 20);
      const base = fresh.length ? fresh : leads.slice(0, 20);
      return Object.fromEntries(base.map(l => [l.id, true]));
    });
  }, [leads]);

  const posts = useMemo(() => drafts.filter(d => d.kind === 'post'), [drafts]);
  const messages = useMemo(() => drafts.filter(d => d.kind === 'message'), [drafts]);
  const pending = drafts.filter(d => !d.doneAt).length;
  const contactedCount = leads.filter(l => l.contactedAt).length;

  // عدّادات وحالة كل جروب في مركز التسويق (نفس اللي في صفحة النشر)
  const fbQueuedSet = useMemo(() => new Set(fbQueued), [fbQueued]);
  const mktPostedCount = groups.filter(g => !!fbPosted[g.id]).length;
  const mktRemaining = groups.length - mktPostedCount;
  const visibleMktGroups = groups.filter(g => {
    if (groupStatusFilter === 'todo') return !fbPosted[g.id];
    if (groupStatusFilter === 'done') return !!fbPosted[g.id];
    if (groupStatusFilter === 'batch') return fbQueuedSet.has(g.id);
    return true;
  });

  // فلتر وعدّادات المسودات
  const postsReady = posts.filter(d => !d.doneAt).length;
  const postsDone = posts.filter(d => !!d.doneAt).length;
  const messagesReady = messages.filter(d => !d.doneAt).length;
  const messagesDone = messages.filter(d => !!d.doneAt).length;
  const filterDrafts = (list: Draft[]) => list.filter(d => {
    if (draftFilter === 'ready') return !d.doneAt;
    if (draftFilter === 'done') return !!d.doneAt;
    return true;
  });
  const visiblePosts = filterDrafts(posts);
  const visibleMessages = filterDrafts(messages);

  /* ── الجروبات ───────────────────────────────────────────────────────── */
  const importGroupsFromPublish = useCallback(() => {
    type Stored = { id: string; name: string; url: string };
    const stored = loadJson<Stored[]>(LS_FB_GROUPS, []);
    if (!stored.length) {
      toast('مفيش جروبات محفوظة في صفحة النشر — اجمعهم الأول من تبويب «النشر على فيسبوك»', 'info');
      return;
    }
    const existing = new Set(groups.map(g => g.id));
    const added = stored
      .filter(g => !existing.has(g.id))
      .map(g => ({
        id: g.id,
        name: g.name || `جروب ${g.id}`,
        governorate: guessGovernorate(g.name || ''),
        url: g.url,
      }));
    if (added.length) setGroups(prev => [...prev, ...added]);
    setSelectedGroups(prev => {
      const next = { ...prev };
      for (const g of stored.slice(0, 10)) next[g.id] = true;
      return next;
    });
    toast(
      added.length
        ? `تم استيراد ${added.length} جروب وتحديد أول 10 ✓`
        : 'الجروبات موجودة بالفعل — تم تحديد أول 10 ✓',
      'success'
    );
  }, [groups, toast]);

  // ── تخطيط الدفعات بالذكاء: يختار ١٠ جروبات بالأولوية ─────────────────────
  // جروب جديد أولوية، جروب بعيد عن آخر نشر أولوية، وجروب من نفس محافظة البوست أولوية —
  // وبيدور على الجروبات بالترتيب (cursor) عشان كل دفعة تبقى جروبات مختلفة.
  const planSmartBatch = useCallback((governorate: string) => {
    type Stored = { id: string; name: string; url?: string; enabled?: boolean };
    const stored = loadJson<Stored[]>(LS_FB_GROUPS, [])
      .filter(g => g && g.enabled !== false && /^\d+$/.test(String(g.id)));
    if (!stored.length) return null;
    const postedMap = loadJson<Record<string, string>>('fb_pub_posted_v1', {});
    const rawCursor = Number(localStorage.getItem('fb_pub_cursor_v1') || '0');
    let cursor = Number.isFinite(rawCursor) && rawCursor > 0 ? rawCursor : 0;
    if (cursor >= stored.length) cursor = 0;
    const rotated = [...stored.slice(cursor), ...stored.slice(0, cursor)];
    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const rank = (g: Stored) => {
      const stamp = postedMap[g.id] ? Date.parse(postedMap[g.id]) : 0;
      let s = 0;
      if (!stamp) s += 4;                        // جروب لسه متنشرش
      else if (now - stamp > WEEK) s += 2;        // عدّى أسبوع
      else s -= 6;                                // اتنشر قريب — أجّله
      if (governorate && g.name && g.name.includes(governorate)) s += 5;
      return s;
    };
    const batch = rotated
      .map((g, i) => ({ g, i, s: rank(g) }))
      .sort((a, b) => (b.s - a.s) || (a.i - b.i))
      .slice(0, 10)
      .map(x => x.g);
    const lastIdx = stored.findIndex(g => g.id === batch[batch.length - 1].id);
    const nextCursor = lastIdx < 0 || lastIdx + 1 >= stored.length ? 0 : lastIdx + 1;
    const fresh = batch.filter(g => !postedMap[g.id]).length;
    return { stored, batch, nextCursor, fresh, total: stored.length };
  }, []);

  const setCursor = useCallback((next: number) => {
    try { localStorage.setItem('fb_pub_cursor_v1', JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const openFirstGroup = useCallback((id: string) => {
    try {
      const win = window.open(`https://www.facebook.com/groups/${id}/?tareeq=1`, '_blank');
      if (win) win.opener = null;
    } catch { /* ignore */ }
  }, []);

  // دفعة إعلان (صور فقط) — بيفتح جروب ١ فورًا وبعدها كل «نشرت» بيفتح اللي بعده
  const startFbBatch = useCallback(() => {
    const plan = planSmartBatch('');
    if (!plan) {
      toast('مفيش جروبات محفوظة — ضيفهم الأول من صفحة «النشر على فيسبوك»', 'info');
      window.open('/admin?tab=fbpublish', '_blank');
      return;
    }
    setCursor(plan.nextCursor);
    try {
      localStorage.setItem('fb_pub_queue_v1', JSON.stringify({
        ids: plan.batch.map(g => g.id),
        idx: 0,
        images: [],
        text: '',
        texts: {},
        mode: 'image',
        draftId: '',
        startedAt: new Date().toISOString(),
      }));
      localStorage.setItem('fb_pub_running_v1', '1');
      // وضع الإعلان (صور فقط) — نمسح أي بوست نصي قديم
      localStorage.removeItem('fb_pub_text_v1');
      localStorage.removeItem('fb_pub_mode_v1');
      localStorage.setItem('fb_pub_mode_v1', 'image');
      localStorage.removeItem('fb_pub_draft_v1');
      localStorage.removeItem('fb_pub_variants_v1');
    } catch { /* ignore */ }
    openFirstGroup(plan.batch[0].id);
    toast(`دفعة ${plan.batch.length} جروب (${plan.fresh} جديد) — جروب ١ بيفتح دلوقتي`, 'success');
    window.location.href = '/admin?tab=fbpublish';
  }, [planSmartBatch, setCursor, openFirstGroup, toast]);

  // نشر بوست جاهز (نص) على ١٠ جروبات — نفس النص لكل جروب
  const launchTextBatch = useCallback((d: Draft, batch: Array<{ id: string }>, texts: Record<string, string>) => {
    try {
      localStorage.setItem('fb_pub_text_v1', d.text);
      localStorage.setItem('fb_pub_mode_v1', 'text');
      localStorage.setItem('fb_pub_draft_v1', d.id);
      if (Object.keys(texts).length) saveJson('fb_pub_variants_v1', texts);
      else { try { localStorage.removeItem('fb_pub_variants_v1'); } catch { /* ignore */ } }
      localStorage.setItem('fb_pub_queue_v1', JSON.stringify({
        ids: batch.map(g => g.id),
        idx: 0,
        images: [],
        text: d.text,
        texts,
        mode: 'text',
        draftId: d.id,
        startedAt: new Date().toISOString(),
      }));
      localStorage.setItem('fb_pub_running_v1', '1');
    } catch { /* ignore */ }
    openFirstGroup(batch[0].id);
    window.location.href = '/admin?tab=fbpublish';
  }, [openFirstGroup]);

  const startDraftBatch = useCallback((d: Draft) => {
    if (!d.text.trim()) { toast('البوست فاضي — اكتب نص الأول', 'error'); return; }
    const plan = planSmartBatch(d.governorate);
    if (!plan) {
      toast('مفيش جروبات فيسبوك محفوظة — ضيفهم الأول من صفحة «النشر على فيسبوك»', 'info');
      window.open('/admin?tab=fbpublish', '_blank');
      return;
    }
    setCursor(plan.nextCursor);
    launchTextBatch(d, plan.batch, {});
    toast(`بدأنا ${plan.batch.length} جروب ببوست «${d.targetName}» — جروب ١ بيفتح دلوقتي`, 'success');
  }, [planSmartBatch, setCursor, launchTextBatch, toast]);

  // ✨ نسخة مختلفة لكل جروب — الذكاء يكتب ١٠ صيغ لنفس البوست (فيسبوك ميشوفهاش تكرار)
  const [smartBusyId, setSmartBusyId] = useState('');
  const startSmartDraftBatch = useCallback(async (d: Draft) => {
    if (!d.text.trim()) { toast('البوست فاضي — اكتب نص الأول', 'error'); return; }
    const plan = planSmartBatch(d.governorate);
    if (!plan) {
      toast('مفيش جروبات فيسبوك محفوظة — ضيفهم الأول من صفحة «النشر على فيسبوك»', 'info');
      window.open('/admin?tab=fbpublish', '_blank');
      return;
    }
    setSmartBusyId(d.id);
    const texts: Record<string, string> = {};
    const targets = plan.batch.map(g => ({
      id: g.id,
      name: g.name,
      governorate: guessGovernorate(g.name || '') || d.governorate || '',
    }));
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      // على دفعتين (٥ + ٥) عشان الرد يخلص بسرعة وميعدّيش وقت حدود السيرفر
      for (let i = 0; i < targets.length; i += 5) {
        const chunk = targets.slice(i, i + 5);
        try {
          const res = await fetch(`${getApiUrl()}/ai?action=marketing-variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ action: 'marketing-variants', text: d.text, groups: chunk }),
          });
          const data = await res.json().catch(() => null);
          if (data?.ok && Array.isArray(data.variants)) {
            for (const v of data.variants) {
              if (v && v.id && v.text) texts[String(v.id)] = String(v.text);
            }
          }
        } catch { /* كمّل الدفعة اللي بعدها */ }
      }
    } catch { /* fallback: same text */ }
    finally { setSmartBusyId(''); }
    const count = Object.keys(texts).length;
    setCursor(plan.nextCursor);
    toast(
      count
        ? `جهّزنا ${count} نسخة مختلفة من البوست ✓ — جروب ١ بيفتح دلوقتي`
        : 'الذكاء مش متاح دلوقتي — هننشر نفس النص على الجروبات',
      count ? 'success' : 'info'
    );
    launchTextBatch(d, plan.batch, texts);
  }, [planSmartBatch, setCursor, launchTextBatch, toast]);

  const addGroupsFromCsv = useCallback(() => {
    const rows = parseCsv(groupCsv);
    if (!rows.length) { toast('الصق أسماء الجروبات الأول', 'error'); return; }
    const existingNames = new Set(groups.map(g => g.name));
    const nextGroups: MktGroup[] = [];
    let i = 0;
    for (const cells of rows) {
      if (i === 0 && /group|اسم|جروب/i.test(cells[0] || '')) { i++; continue; }
      const name = (cells[0] || '').slice(0, 140).trim();
      i++;
      if (!name || existingNames.has(name)) continue;
      existingNames.add(name);
      nextGroups.push({
        id: `g-${uid()}`,
        name,
        governorate: (cells[1] || guessGovernorate(name)).trim() || 'مصر',
      });
    }
    if (!nextGroups.length) {
      setGroupCsv('');
      toast('كل الجروبات دي موجودة بالفعل', 'info');
      return;
    }
    setGroups(prev => [...prev, ...nextGroups]);
    setSelectedGroups(prev => {
      const next = { ...prev };
      for (const g of nextGroups.slice(0, 10)) next[g.id] = true;
      return next;
    });
    setGroupCsv('');
    toast(`تمت إضافة ${nextGroups.length} جروب وتحديد أول 10 ✓`, 'success');
  }, [groupCsv, groups, toast]);

  const removeGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    setSelectedGroups(s => { const c = { ...s }; delete c[id]; return c; });
  };

  const generateAIPosts = async () => {
    let chosen = groups.filter(g => selectedGroups[g.id]);
    if (!chosen.length && groups.length) {
      chosen = groups.slice(0, 5);
      toast('مفيش جروب محدد — اخترتلك أول 5 جروبات تلقائيًا', 'info');
    }
    if (!chosen.length) {
      toast('مفيش جروبات — اضغط «استيراد من صفحة النشر» أو الصق أسماءهم فوق', 'error');
      return;
    }
    chosen = chosen.slice(0, 5);
    setAiGenerating(true);
    let added = 0;
    try {
      for (const g of chosen) {
        try {
          const token = await firebaseAuth.currentUser?.getIdToken();
          const res = await fetch(`${getApiUrl()}/ai?action=marketing-post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ action: 'marketing-post', groupName: g.name, governorate: g.governorate }),
          });
          const data = await res.json().catch(() => null);
          if (data?.ok && data.text) {
            const fresh: Draft = {
              id: uid(),
              kind: 'post' as const,
              targetId: g.id,
              targetName: g.name,
              governorate: g.governorate,
              text: data.text,
              createdAt: new Date().toISOString(),
            };
            setDrafts(prev => [fresh, ...prev]);
            added += 1;
          } else {
            toast(data?.message || 'فشل التوليد لـ ' + g.name, 'error');
          }
        } catch (e: any) {
          toast('خطأ: ' + (e?.message || e), 'error');
        }
        // small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 800));
      }
      toast(added ? `تم توليد ${added} بوست بـ AI — مسودات مستنية موافقتك` : 'مفيش بوستات تم توليدها', added ? 'success' : 'info');
      setTimeout(() => postsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } finally {
      setAiGenerating(false);
    }
  };
  const generatePosts = () => {
    let chosen = groups.filter(g => selectedGroups[g.id]);
    if (!chosen.length && groups.length) {
      chosen = groups.slice(0, 10);
      toast('مفيش جروب محدد — اخترتلك أول 10 جروبات تلقائيًا', 'info');
    }
    if (!chosen.length) {
      toast('مفيش جروبات — اضغط «استيراد من صفحة النشر» أو الصق أسماءهم فوق', 'error');
      return;
    }
    chosen = chosen.slice(0, 10);
    const fresh: Draft[] = chosen.map((g, i) => ({
      id: uid(),
      kind: 'post' as const,
      targetId: g.id,
      targetName: g.name,
      governorate: g.governorate,
      text: buildPost(g, i),
      createdAt: new Date().toISOString(),
    }));
    setDrafts(prev => [...fresh, ...prev]);
    toast(`تم تجهيز ${fresh.length} بوست — مسودات مستنية موافقتك`, 'success');
    setTimeout(() => postsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };

  /* ── العملاء ────────────────────────────────────────────────────────── */
  const importLeadsFromListings = async () => {
    try {
      const all = await listingsService.getAll();
      const sorted = [...(all || [])].sort((a: any, b: any) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta; // newest first
      });
      const taken = new Set(leads.map(l => normalizePhone(l.phone)).filter(Boolean));
      let added = 0;
      setLeads(prev => {
        const next = [...prev];
        for (const l of sorted) {
          const phone = (l.contactPhone || l.whatsappPhone || l.userPhone || '').trim();
          const key = normalizePhone(phone);
          if (!key || taken.has(key)) continue;
          taken.add(key);
          next.push({
            id: uid(),
            name: (l.advertiserName || l.userName || 'صاحب إعلان').trim() || 'صاحب إعلان',
            phone,
            governorate: (l.governorate || 'مصر').trim(),
            serviceType: (l.category || 'بيع وشراء').trim(),
            adLink: l.id ? `${window.location.origin}/listing/${l.id}` : undefined,
            notes: l.title || undefined,
          });
          added += 1;
          if (added >= 50) break; // cap
        }
        return next;
      });
      toast(added ? `تمت إضافة ${added} رقم من الإعلانات ✓ (الأحدث أولاً)` : 'مفيش أرقام جديدة', added ? 'success' : 'info');
    } catch (e: any) {
      toast('خطأ: ' + (e?.message || e), 'error');
    }
  };

  // Auto-import on page load: pull any new ad owners' numbers not already in leads
  useEffect(() => {
    const timer = setTimeout(() => { void importLeadsFromListings(); }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const addLeadsFromCsv = useCallback(() => {
    const rows = parseCsv(leadCsv);
    if (!rows.length) { toast('الصق بيانات العملاء الأول', 'error'); return; }
    let added = 0;
    setLeads(prev => {
      const taken = new Set(prev.map(l => normalizePhone(l.phone)).filter(Boolean));
      const next = [...prev];
      let i = 0;
      for (const cells of rows) {
        if (i === 0 && /name|اسم|تليفون|phone/i.test(cells.join(' '))) { i++; continue; }
        const [name, phone, governorate, serviceType, adLink, notes] = cells;
        const key = normalizePhone(phone || '');
        if (!name || !key || taken.has(key)) { i++; continue; }
        taken.add(key);
        next.push({
          id: uid(),
          name: name.trim(),
          phone: phone.trim(),
          governorate: (governorate || 'مصر').trim(),
          serviceType: (serviceType || 'بيع وشراء').trim(),
          adLink: (adLink || '').trim() || undefined,
          notes: (notes || '').trim() || undefined,
        });
        added += 1;
        i++;
      }
      return next;
    });
    setLeadCsv('');
    toast(added ? `تمت إضافة ${added} عميل ✓` : 'مفيش صفوف جديدة (أرقام مكررة أو ناقصة)', added ? 'success' : 'info');
  }, [leadCsv, toast]);

  const addLeadManually = () => {
    const name = leadForm.name.trim();
    const phone = leadForm.phone.trim();
    if (!name || normalizePhone(phone).length < 10) { toast('اكتب اسم ورقم تليفون صحيح', 'error'); return; }
    if (leads.some(l => normalizePhone(l.phone) === normalizePhone(phone))) {
      toast('الرقم ده موجود بالفعل', 'info'); return;
    }
    setLeads(prev => [{
      id: uid(),
      name,
      phone,
      governorate: leadForm.governorate,
      serviceType: leadForm.serviceType,
      adLink: leadForm.adLink.trim() || undefined,
    }, ...prev]);
    setLeadForm({ name: '', phone: '', governorate: 'القاهرة', serviceType: SERVICES[0], adLink: '' });
    setShowAddLead(false);
    toast('تمت إضافة العميل ✓', 'success');
  };

  const removeLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelectedLeads(s => { const c = { ...s }; delete c[id]; return c; });
  };

  const generateMessages = () => {
    let chosen = leads.filter(l => selectedLeads[l.id]);
    if (!chosen.length && leads.length) {
      const fresh = leads.filter(l => !l.contactedAt);
      chosen = (fresh.length ? fresh : leads).slice(0, 20);
      toast('مفيش عميل محدد — اخترتلك أول 20 عميل تلقائيًا', 'info');
    }
    if (!chosen.length) {
      toast('مفيش عملاء — الصق CSV أو أضف عميل يدوي', 'error');
      return;
    }
    chosen = chosen.slice(0, 20);
    const messageDrafts: Draft[] = chosen.map((l, i) => ({
      id: uid(),
      kind: 'message' as const,
      targetId: l.id,
      targetName: l.name,
      governorate: l.governorate,
      text: buildMessage(l, i),
      createdAt: new Date().toISOString(),
    }));
    setDrafts(prev => [...messageDrafts, ...prev]);
    toast(`تم تجهيز ${messageDrafts.length} رسالة — مسودات مستنية موافقتك`, 'success');
    setTimeout(() => messagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };

  const generateAIMessages = async () => {
    let chosen = leads.filter(l => selectedLeads[l.id]);
    if (!chosen.length && leads.length) {
      const fresh = leads.filter(l => !l.contactedAt);
      chosen = (fresh.length ? fresh : leads).slice(0, 5);
      toast('مفيش عميل محدد — اخترتلك أول 5 عملاء تلقائيًا', 'info');
    }
    if (!chosen.length) {
      toast('مفيش عملاء — الصق CSV أو أضف عميل يدوي', 'error');
      return;
    }
    chosen = chosen.slice(0, 5);
    setAiGenerating(true);
    let added = 0;
    try {
      for (const l of chosen) {
        try {
          const token = await firebaseAuth.currentUser?.getIdToken();
          const res = await fetch(`${getApiUrl()}/ai?action=marketing-wa-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ action: 'marketing-wa-message', name: l.name, governorate: l.governorate, serviceType: l.serviceType, adLink: l.adLink }),
          });
          const data = await res.json().catch(() => null);
          if (data?.ok && data.text) {
            const fresh: Draft = {
              id: uid(),
              kind: 'message' as const,
              targetId: l.id,
              targetName: l.name,
              governorate: l.governorate,
              text: data.text,
              createdAt: new Date().toISOString(),
            };

            setDrafts(prev => [fresh, ...prev]);
            added += 1;
          } else {
            toast(data?.message || 'فشل التوليد لـ ' + l.name, 'error');
          }
        } catch (e: any) {
          toast('خطأ: ' + (e?.message || e), 'error');
        }
        await new Promise(r => setTimeout(r, 800));
      }
      toast(added ? `تم توليد ${added} رسالة بـ AI — مسودات مستنية موافقتك` : 'مفيش رسائل تم توليدها', added ? 'success' : 'info');
      setTimeout(() => messagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } finally {
      setAiGenerating(false);
    }
  };

  const generateAISummary = async () => {
    setAiGenerating(true);
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      const res = await fetch(`${getApiUrl()}/ai?action=marketing-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          action: 'marketing-summary',
          postsCount: posts.length,
          leadsCount: leads.length,
          draftsCount: drafts.length,
          governorates: [...new Set(drafts.map(d => d.governorate).filter(Boolean))],
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        toast((data.summary || '') + (data.lastLine ? ' — ' + data.lastLine : ''), 'success');
      } else {
        toast(data?.message || 'فشل توليد الخلاصة', 'error');
      }
    } catch (e: any) {
      toast('خطأ: ' + (e?.message || e), 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  /* ── حالة المسودات ──────────────────────────────────────────────────── */
  const markDone = (draft: Draft) => {
    const now = new Date().toISOString();
    setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, doneAt: now } : d));
    if (draft.kind === 'message') {
      setLeads(prev => prev.map(l => l.id === draft.targetId ? { ...l, contactedAt: now } : l));
    }
    toast(draft.kind === 'message' ? 'تم تسجيل التواصل ✓' : 'تم تسجيل النشر ✓', 'success');
  };

  const removeDraft = (id: string) => setDrafts(prev => prev.filter(d => d.id !== id));

  const copyDraft = async (text: string) => {
    const ok = await copyText(text);
    toast(ok ? 'تم النسخ ✓' : 'تعذر النسخ — حدد النص وانسخه يدوي', ok ? 'success' : 'error');
  };

  /* ── المراجعة ───────────────────────────────────────────────────────── */
  const duplicatesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of drafts) {
      const key = d.text.trim();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [drafts]);

  const reviewRows = useMemo(() => drafts.map(d => ({
    draft: d,
    issues: reviewText(d.text, d.kind, terms, duplicatesMap.get(d.text.trim()) || 0),
  })), [drafts, terms, duplicatesMap]);

  const readyCount = reviewRows.filter(r => !r.issues.length && !r.draft.doneAt).length;
  const problemCount = reviewRows.filter(r => r.issues.length).length;

  const summaryText = useMemo(() => {
    const lines = [
      `# خلاصة التسويق — ${new Date().toLocaleDateString('ar-EG')}`,
      '',
      `- عملاء محتملون: ${leads.length} (اتواصلنا مع ${contactedCount})`,
      `- جروبات: ${groups.length}`,
      `- بوستات جاهزة: ${posts.filter(p => !p.doneAt).length} (اتنشر ${posts.filter(p => p.doneAt).length})`,
      `- رسائل جاهزة: ${messages.filter(m => !m.doneAt).length} (اتواصل ${messages.filter(m => m.doneAt).length})`,
      `- مسودات سليمة جاهزة للموافقة: ${readyCount}`,
      `- مسودات فيها ملاحظات: ${problemCount}`,
      '',
      '## محتاج قرار من توفيق',
      ...(problemCount
        ? reviewRows.filter(r => r.issues.length).slice(0, 12).map(r => `- ${r.draft.targetName}: ${r.issues.join(' / ')}`)
        : ['- مفيش ملاحظات — كل المسودات سليمة.']),
      '',
      '**لم يُرسل أو يُنشر أي شيء. كله مستني موافقتك.**',
    ];
    return lines.join('\n');
  }, [leads.length, contactedCount, groups.length, posts, messages, readyCount, problemCount, reviewRows]);

  /* ── تصدير ──────────────────────────────────────────────────────────── */
  const exportLeads = () => {
    const rows = [
      ['name', 'phone', 'governorate', 'service_type', 'ad_link', 'notes', 'contacted_at'],
      ...leads.map(l => [l.name, l.phone, l.governorate, l.serviceType, l.adLink || '', l.notes || '', l.contactedAt || '']),
    ];
    downloadText(`tareeq-leads-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(r => r.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
    toast('تم تنزيل ملف العملاء ✓', 'success');
  };

  const exportDrafts = (kind: 'post' | 'message') => {
    const list = kind === 'post' ? posts : messages;
    const lines = list.map((d, i) => `## ${i + 1}. ${d.targetName} — ${d.governorate}\n${d.text}\n`);
    downloadText(
      `tareeq-${kind === 'post' ? 'posts' : 'messages'}-${new Date().toISOString().slice(0, 10)}.md`,
      lines.join('\n') || 'لا توجد مسودات',
      'text/markdown;charset=utf-8'
    );
    toast('تم تنزيل المسودات ✓', 'success');
  };

  const readFile = (file: File, cb: (text: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result || ''));
    reader.readAsText(file, 'utf-8');
  };

  const stat = (label: string, value: number | string, color: string, icon: React.ReactNode) => (
    <div className="rounded-xl bg-white dark:bg-[#0b1626] border border-[#e2e8f0] dark:border-[#26374d] p-3 flex items-center gap-2.5">
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>{icon}</span>
      <div>
        <p className="text-lg font-extrabold leading-none text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-[10px] font-bold text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );

  const tabBtn = (id: typeof tab, label: string, icon: React.ReactNode) => (
    <button onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold transition-colors ${tab === id
        ? 'bg-orange text-white shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#13243a]'}`}>
      {icon}{label}
    </button>
  );

  const draftCard = (d: Draft) => {
    const row = reviewRows.find(r => r.draft.id === d.id);
    const issues = row?.issues || [];
    return (
      <div key={d.id} className="rounded-xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-gray-800 dark:text-gray-100 truncate">{d.targetName}</p>
            <p className="text-[10px] text-gray-400 font-bold">{d.governorate} • {formatDateDMY(d.createdAt)}</p>
          </div>
          <span className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${d.doneAt
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            : issues.length
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'}`}>
            {d.doneAt ? 'تم' : issues.length ? 'مراجعة' : 'جاهز'}
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-[#081220] rounded-lg px-2.5 py-2 mb-2">{d.text}</p>

        {issues.length > 0 && (
          <ul className="mb-2 space-y-0.5">
            {issues.map((issue, i) => (
              <li key={i} className="text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{issue}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => copyDraft(d.text)}
            className="flex items-center gap-1 text-[10px] font-extrabold bg-sky-600 text-white hover:bg-sky-700 px-2.5 py-1.5 rounded-lg">
            <Copy className="w-3 h-3" /> نسخ
          </button>
          {d.kind === 'post' && (
            <button onClick={() => startDraftBatch(d)}
              className="flex items-center gap-1 text-[10px] font-extrabold bg-orange text-white hover:bg-orange/90 px-2.5 py-1.5 rounded-lg">
              <ExternalLink className="w-3 h-3" /> انشر على ١٠ جروبات
            </button>
          )}
          {d.kind === 'post' && (
            <button onClick={() => void startSmartDraftBatch(d)} disabled={smartBusyId === d.id}
              className="flex items-center gap-1 text-[10px] font-extrabold bg-gradient-to-l from-indigo-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-60 px-2.5 py-1.5 rounded-lg">
              {smartBusyId === d.id
                ? <><Loader2 className="w-3 h-3 animate-spin" /> بيكتب نسخ…</>
                : <><Sparkles className="w-3 h-3" /> ذكاء: نسخة لكل جروب</>}
            </button>
          )}
          {d.kind === 'message' && (
            <a href={getWhatsAppLink(leads.find(l => l.id === d.targetId)?.phone || '', d.text)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg">
              <Phone className="w-3 h-3" /> واتساب
            </a>
          )}
          {d.kind === 'post' && groups.find(g => g.id === d.targetId)?.url && (
            <a href={groups.find(g => g.id === d.targetId)?.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg">
              <ExternalLink className="w-3 h-3" /> فتح الجروب
            </a>
          )}
          {!d.doneAt ? (
            <button onClick={() => markDone(d)}
              className="flex items-center gap-1 text-[10px] font-extrabold border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3 h-3" /> {d.kind === 'message' ? 'تم التواصل' : 'تم النشر'}
            </button>
          ) : (
            <button onClick={() => setDrafts(prev => prev.map(x => x.id === d.id ? { ...x, doneAt: undefined } : x))}
              className="text-[10px] font-bold text-gray-500 hover:text-orange px-2 py-1.5">تراجع</button>
          )}
          <button onClick={() => removeDraft(d.id)} className="text-[10px] font-bold text-red-500 hover:text-red-600 px-2 py-1.5">حذف</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── رأس الصفحة ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-orange/20 bg-gradient-to-l from-orange/10 via-white to-white dark:from-orange/10 dark:via-[#0b1626] dark:to-[#0b1626] p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-xl bg-orange text-white flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">مركز التسويق والمحتوى</h2>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 max-w-2xl leading-relaxed">
                ورشة «موظفين كار مصر» جوه المنصة: عملاء محتملين، رسائل واتساب، بوستات جروبات، ومراجعة جودة.
                كل حاجة مسودة — <b>مفيش إرسال أو نشر تلقائي</b>. توفيق هو اللي يوافق وينشر بنفسه.
              </p>
            </div>
          </div>
          <a href="/admin?tab=fbpublish"
            className="flex items-center gap-1.5 text-[11px] font-extrabold bg-white dark:bg-[#13243a] border border-[#e2e8f0] dark:border-[#26374d] text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg hover:border-orange">
            <ImageIcon className="w-3.5 h-3.5" /> نشر إعلانات العملاء
            <ChevronLeft className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* ── إحصائيات ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stat('عملاء محتملون', leads.length, 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300', <Users className="w-4 h-4" />)}
        {stat('جروبات', groups.length, 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300', <Link2 className="w-4 h-4" />)}
        {stat('مسودات مستنية', pending, 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300', <FileText className="w-4 h-4" />)}
        {stat('اتواصلنا معاهم', contactedCount, 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300', <CheckCircle2 className="w-4 h-4" />)}
      </div>

      {/* ── التبويبات ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 bg-gray-50 dark:bg-[#081220] border border-[#e2e8f0] dark:border-[#26374d] rounded-xl p-1">
        {tabBtn('posts', 'بوستات المحتوى', <Megaphone className="w-3.5 h-3.5" />)}
        {tabBtn('leads', 'العملاء والرسائل', <Users className="w-3.5 h-3.5" />)}
        {tabBtn('review', `المراجعة${problemCount ? ` (${problemCount})` : ''}`, <ShieldCheck className="w-3.5 h-3.5" />)}
        {tabBtn('templates', 'قوالب جاهزة', <FileText className="w-3.5 h-3.5" />)}
        {tabBtn('shorts', 'تيك توك / يوتيوب', <FileText className="w-3.5 h-3.5" />)}
        {tabBtn('rules', 'القواعد والأرقام', <ListChecks className="w-3.5 h-3.5" />)}
      </div>

      {/* ══ تبويب: بوستات المحتوى ══════════════════════════════════════ */}
      {tab === 'posts' && (
        <>
          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">١. جروبات النشر</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">اختار لحد 10 جروبات في اليوم — كل جروب بياخد بوست بصياغة مختلفة.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={startFbBatch}
                  className="flex items-center gap-1 text-[10px] font-extrabold bg-orange text-white hover:bg-orange/90 px-3 py-1.5 rounded-lg">
                  <ExternalLink className="w-3 h-3" /> نشر على جروبات FB (١٠)
                </button>
                <button onClick={importGroupsFromPublish}
                  className="flex items-center gap-1 text-[10px] font-extrabold border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1.5 rounded-lg">
                  <Download className="w-3 h-3" /> استيراد من صفحة النشر
                </button>
                <button onClick={() => groupFileRef.current?.click()}
                  className="flex items-center gap-1 text-[10px] font-extrabold border border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg">
                  <Upload className="w-3 h-3" /> ملف CSV
                </button>
                <input ref={groupFileRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f, setGroupCsv); e.target.value = ''; }} />
              </div>
            </div>

            <div className="grid sm:grid-cols-[1fr_auto] gap-2 mb-3">
              <textarea value={groupCsv} onChange={e => setGroupCsv(e.target.value)} rows={2}
                placeholder={'الصق أسماء الجروبات — كل جروب في سطر\nمثال: بيع وشراء نقل ثقيل القاهرة, القاهرة'}
                className="w-full text-xs border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2 bg-white dark:bg-[#081220] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange" />
              <button onClick={addGroupsFromCsv}
                className="flex items-center justify-center gap-1 text-xs font-extrabold bg-gray-800 dark:bg-[#13243a] text-white px-4 py-2 rounded-xl">
                <Plus className="w-3.5 h-3.5" /> إضافة
              </button>
            </div>

            {groups.length ? (
              <>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <p className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5 flex-wrap">
                    محدد {Object.values(selectedGroups).filter(Boolean).length} من {groups.length}
                    <span className="text-gray-300">|</span>
                    <span className="text-orange">متبقي {mktRemaining}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">اتنشر {mktPostedCount}</span>
                    <span className="text-indigo-600 dark:text-indigo-400">في الدفعة {fbQueued.length}</span>
                  </p>
                  <button onClick={() => setSelectedGroups(
                    Object.values(selectedGroups).filter(Boolean).length === groups.length
                      ? {}
                      : Object.fromEntries(groups.map(g => [g.id, true]))
                  )} className="text-[10px] font-extrabold text-orange hover:underline">
                    {Object.values(selectedGroups).filter(Boolean).length === groups.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                </div>

                {/* فلتر حالة النشر — تعرف خلّصت مين وفاضل مين */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {([
                    ['all', `الكل ${groups.length}`],
                    ['todo', `لسه ${mktRemaining}`],
                    ['done', `اتنشر ✓ ${mktPostedCount}`],
                    ['batch', `في الدفعة ${fbQueued.length}`],
                  ] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setGroupStatusFilter(key)}
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border transition-colors ${groupStatusFilter === key
                        ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                        : 'bg-white dark:bg-[#0b1626] text-gray-600 dark:text-gray-300 border-[#e2e8f0] dark:border-[#26374d] hover:border-orange'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {visibleMktGroups.length === 0 && (
                    <p className="text-[11px] font-bold text-gray-400 text-center py-3">مفيش جروبات في الفلتر ده.</p>
                  )}
                  {visibleMktGroups.map(g => {
                    const postedAt = fbPosted[g.id];
                    const inBatch = fbQueuedSet.has(g.id);
                    return (
                    <div key={g.id} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#26374d] px-2.5 py-1.5">
                      <input type="checkbox" checked={!!selectedGroups[g.id]}
                        onChange={() => setSelectedGroups(s => ({ ...s, [g.id]: !s[g.id] }))}
                        className="w-3.5 h-3.5 accent-orange" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-extrabold text-gray-800 dark:text-gray-100 truncate">{g.name}</p>
                        <p className="text-[9px] text-gray-400 font-bold">{g.governorate}</p>
                      </div>
                      {inBatch ? (
                        <span className="shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          في الدفعة
                        </span>
                      ) : postedAt ? (
                        <span className="shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          اتنشر ✓ {formatDateDMY(postedAt)}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          لسه
                        </span>
                      )}
                      <button onClick={() => removeGroup(g.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-[#e2e8f0] dark:border-[#26374d] bg-gray-50 dark:bg-[#081220] px-3 py-4 text-center space-y-2">
                <p className="text-[11px] font-bold text-gray-500">مفيش جروبات بعد. اختار طريقة الإضافة:</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button onClick={importGroupsFromPublish}
                    className="flex items-center gap-1 text-[10px] font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg">
                    <Download className="w-3 h-3" /> استيراد من صفحة النشر
                  </button>
                  <span className="text-[10px] font-bold text-gray-400">أو الصق أسماءهم في الخانة فوق</span>
                </div>
              </div>
            )}

            <button onClick={generatePosts}
              className="mt-3 w-full flex items-center justify-center gap-2 text-sm font-extrabold bg-orange text-white hover:bg-orange/90 py-2.5 rounded-xl">
              <Sparkles className="w-4 h-4" /> جهّز بوستات (بحد أقصى 10)
            </button>
            <button onClick={generateAIPosts} disabled={aiGenerating}
              className="mt-2 w-full flex items-center justify-center gap-2 text-sm font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 py-2.5 rounded-xl disabled:opacity-50">
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiGenerating ? 'جاري التوليد بـ AI...' : 'توليد بـ AI (Groq) — بحد أقصى 5'}
            </button>
            <p className="text-[10px] font-bold text-gray-400 text-center mt-1.5">
              لو مفيش جروب محدد، هنختار أول 10 جروبات تلقائيًا.
            </p>
          </section>

          <section ref={postsRef} className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">٢. المسودات ({posts.length})</h3>
              <button onClick={() => exportDrafts('post')} className="flex items-center gap-1 text-[10px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-2.5 py-1.5 rounded-lg">
                <Download className="w-3 h-3" /> تنزيل الكل
              </button>
              <button onClick={() => { if (confirm('مسح كل المسودات؟')) { setDrafts([]); toast('تم مسح المسودات ✓', 'success'); } }}
                className="flex items-center gap-1 text-[10px] font-extrabold text-red-500 border border-red-200 dark:border-red-800 px-2.5 py-1.5 rounded-lg">
                <Trash2 className="w-3 h-3" /> مسح الكل
              </button>
            </div>
            {posts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {([
                  ['all', `الكل ${posts.length}`],
                  ['ready', `جاهز ${postsReady}`],
                  ['done', `اتنشر ✓ ${postsDone}`],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setDraftFilter(key)}
                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border transition-colors ${draftFilter === key
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                      : 'bg-white dark:bg-[#0b1626] text-gray-600 dark:text-gray-300 border-[#e2e8f0] dark:border-[#26374d] hover:border-orange'}`}>
                    {label}
                  </button>
                ))}
                <span className="text-[10px] font-bold text-gray-400 mr-auto">كل بوست ليه زر «انشر على ١٠ جروبات»</span>
              </div>
            )}
            {posts.length ? (
              <div className="grid lg:grid-cols-2 gap-2.5">{visiblePosts.map(draftCard)}</div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm text-gray-400">مفيش مسودات لسه — محتاج خطوتين بس:</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button onClick={importGroupsFromPublish}
                    className="flex items-center gap-1 text-[10px] font-extrabold border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg">
                    <Download className="w-3 h-3" /> ١. استيراد الجروبات
                  </button>
                  <button onClick={generatePosts} disabled={!groups.length}
                    className="flex items-center gap-1 text-[10px] font-extrabold bg-orange text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                    <Sparkles className="w-3 h-3" /> ٢. جهّز البوستات
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">لو الجروبات موجودة بالفعل، اضغط «جهّز البوستات» وهنختار أول 10 تلقائيًا.</p>
              </div>
            )}
          </section>
        </>
      )}

      {/* ══ تبويب: العملاء والرسائل ═════════════════════════════════════ */}
      {tab === 'leads' && (
        <>
          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">١. العملاء المحتملون ({leads.length})</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">نفس أعمدة leads.csv: الاسم، التليفون، المحافظة، نوع الخدمة، لينك الإعلان، ملاحظات.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setShowAddLead(v => !v)}
                  className="flex items-center gap-1 text-[10px] font-extrabold border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1.5 rounded-lg">
                  <Plus className="w-3 h-3" /> عميل جديد
                </button>
                <button onClick={() => leadFileRef.current?.click()}
                  className="flex items-center gap-1 text-[10px] font-extrabold border border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg">
                  <Upload className="w-3 h-3" /> ملف CSV
                </button>
                <button onClick={exportLeads}
                  className="flex items-center gap-1 text-[10px] font-extrabold border border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg">
                  <Download className="w-3 h-3" /> تصدير
                </button>
                <button onClick={importLeadsFromListings}
                  className="flex items-center gap-1 text-[10px] font-extrabold border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1.5 rounded-lg">
                  <Download className="w-3 h-3" /> استيراد أرقام من الإعلانات
                </button>
                <input ref={leadFileRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f, setLeadCsv); e.target.value = ''; }} />
              </div>
            </div>

            {showAddLead && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10 p-2.5">
                <input value={leadForm.name} onChange={e => setLeadForm(f => ({ ...f, name: e.target.value }))} placeholder="الاسم"
                  className="text-xs border border-[#e2e8f0] dark:border-[#26374d] rounded-lg px-2.5 py-2 bg-white dark:bg-[#081220] text-gray-800 dark:text-gray-100" />
                <input value={leadForm.phone} onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value }))} placeholder="01xxxxxxxxx" inputMode="tel"
                  className="text-xs border border-[#e2e8f0] dark:border-[#26374d] rounded-lg px-2.5 py-2 bg-white dark:bg-[#081220] text-gray-800 dark:text-gray-100" />
                <select value={leadForm.governorate} onChange={e => setLeadForm(f => ({ ...f, governorate: e.target.value }))}
                  className="text-xs border border-[#e2e8f0] dark:border-[#26374d] rounded-lg px-2.5 py-2 bg-white dark:bg-[#081220] text-gray-800 dark:text-gray-100">
                  {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={leadForm.serviceType} onChange={e => setLeadForm(f => ({ ...f, serviceType: e.target.value }))}
                  className="text-xs border border-[#e2e8f0] dark:border-[#26374d] rounded-lg px-2.5 py-2 bg-white dark:bg-[#081220] text-gray-800 dark:text-gray-100">
                  {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <input value={leadForm.adLink} onChange={e => setLeadForm(f => ({ ...f, adLink: e.target.value }))} placeholder="لينك الإعلان (اختياري)"
                    className="min-w-0 flex-1 text-xs border border-[#e2e8f0] dark:border-[#26374d] rounded-lg px-2.5 py-2 bg-white dark:bg-[#081220] text-gray-800 dark:text-gray-100" />
                  <button onClick={addLeadManually} className="shrink-0 text-[10px] font-extrabold bg-emerald-600 text-white px-2.5 rounded-lg">حفظ</button>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-[1fr_auto] gap-2 mb-3">
              <textarea value={leadCsv} onChange={e => setLeadCsv(e.target.value)} rows={2}
                placeholder={'name,phone,governorate,service_type,ad_link,notes\nمحمد,01000000000,القاهرة,نقل,,محتاج عربية'}
                className="w-full text-xs border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2 bg-white dark:bg-[#081220] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange" />
              <button onClick={addLeadsFromCsv}
                className="flex items-center justify-center gap-1 text-xs font-extrabold bg-gray-800 dark:bg-[#13243a] text-white px-4 py-2 rounded-xl">
                <ClipboardPaste className="w-3.5 h-3.5" /> استيراد
              </button>
            </div>

            {leads.length ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-gray-500">
                    محدد {Object.values(selectedLeads).filter(Boolean).length} من {leads.length}
                  </p>
                  <button onClick={() => setSelectedLeads(
                    Object.values(selectedLeads).filter(Boolean).length === leads.length
                      ? {}
                      : Object.fromEntries(leads.map(l => [l.id, true]))
                  )} className="text-[10px] font-extrabold text-orange hover:underline">
                    {Object.values(selectedLeads).filter(Boolean).length === leads.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {leads.map(l => (
                    <div key={l.id} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#26374d] px-2.5 py-2">
                      <input type="checkbox" checked={!!selectedLeads[l.id]}
                        onChange={() => setSelectedLeads(s => ({ ...s, [l.id]: !s[l.id] }))}
                        className="w-3.5 h-3.5 accent-orange" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-extrabold text-gray-800 dark:text-gray-100 truncate">
                          {l.name}
                          {l.contactedAt && <span className="text-[9px] font-bold text-emerald-600 mr-1">✓ تم التواصل</span>}
                        </p>
                        <p className="text-[9px] text-gray-400 font-bold">{l.phone} • {l.governorate} • {l.serviceType}</p>
                      </div>
                      {l.adLink && <a href={l.adLink} target="_blank" rel="noopener noreferrer" className="text-sky-500"><ExternalLink className="w-3.5 h-3.5" /></a>}
                      <button onClick={() => removeLead(l.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[11px] font-bold text-gray-400 bg-gray-50 dark:bg-[#081220] rounded-lg px-3 py-2">
                مفيش عملاء بعد — الصق CSV أو أضف عميل يدوي.
              </p>
            )}

            <button onClick={generateMessages}
              className="mt-3 w-full flex items-center justify-center gap-2 text-sm font-extrabold bg-orange text-white hover:bg-orange/90 py-2.5 rounded-xl">
              <Send className="w-4 h-4" /> جهّز رسائل واتساب (بحد أقصى 20)
            </button>
            <button onClick={generateAIMessages} disabled={aiGenerating}
              className="mt-2 w-full flex items-center justify-center gap-2 text-sm font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 py-2.5 rounded-xl disabled:opacity-50">
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiGenerating ? 'جاري التوليد بـ AI...' : 'توليد رسائل بـ AI (Groq) — بحد أقصى 5'}
            </button>
            <p className="text-[10px] font-bold text-gray-400 text-center mt-1.5">
              لو مفيش عميل محدد، هنختار أول 20 عميل تلقائيًا.
            </p>
          </section>

          <section ref={messagesRef} className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">٢. رسائل واتساب ({messages.length})</h3>
              <button onClick={() => exportDrafts('message')} className="flex items-center gap-1 text-[10px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-2.5 py-1.5 rounded-lg">
                <Download className="w-3 h-3" /> تنزيل الكل
              </button>
            </div>
            {messages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {([
                  ['all', `الكل ${messages.length}`],
                  ['ready', `جاهز ${messagesReady}`],
                  ['done', `اتواصلنا ✓ ${messagesDone}`],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setDraftFilter(key)}
                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border transition-colors ${draftFilter === key
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                      : 'bg-white dark:bg-[#0b1626] text-gray-600 dark:text-gray-300 border-[#e2e8f0] dark:border-[#26374d] hover:border-orange'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {messages.length ? (
              <div className="grid lg:grid-cols-2 gap-2.5">{visibleMessages.map(draftCard)}</div>
            ) : (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm text-gray-400">مفيش رسائل لسه — اختار عملاء أو اضغط الزرار وهنختارهم تلقائيًا.</p>
                <button onClick={generateMessages} disabled={!leads.length}
                  className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-orange text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                  <Send className="w-3 h-3" /> جهّز رسائل واتساب
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {/* ══ تبويب: المراجعة ═════════════════════════════════════════════ */}
      {tab === 'review' && (
        <>
          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">مراجعة الجودة الآلية</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">نفس شروط reviewer: أرقام معتمدة، سطر الحذف، الطول، التكرار، والوعود.</p>
              </div>
              <button onClick={async () => {
                const ok = await copyText(summaryText);
                toast(ok ? 'تم نسخ الخلاصة ✓' : 'تعذر النسخ', ok ? 'success' : 'error');
              }} className="flex items-center gap-1 text-[10px] font-extrabold bg-gray-800 dark:bg-[#13243a] text-white px-3 py-1.5 rounded-lg">
                <Copy className="w-3 h-3" /> نسخ الخلاصة
              </button>
              <button onClick={generateAISummary} disabled={aiGenerating}
                className="flex items-center gap-1 text-[10px] font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {aiGenerating ? '...' : 'AI خلاصة'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5 text-center">
                <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-300">{readyCount}</p>
                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">جاهز للموافقة</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5 text-center">
                <p className="text-lg font-extrabold text-amber-600 dark:text-amber-300">{problemCount}</p>
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">محتاج تعديل</p>
              </div>
              <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 p-2.5 text-center">
                <p className="text-lg font-extrabold text-sky-600 dark:text-sky-300">{posts.length}</p>
                <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300">بوست</p>
              </div>
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-2.5 text-center">
                <p className="text-lg font-extrabold text-indigo-600 dark:text-indigo-300">{messages.length}</p>
                <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">رسالة</p>
              </div>
            </div>

            <div className="rounded-xl bg-gray-900 text-gray-100 p-3 max-h-64 overflow-y-auto">
              <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono">{summaryText}</pre>
            </div>

            <button onClick={() => downloadText(`tareeq-summary-${new Date().toISOString().slice(0, 10)}.md`, summaryText, 'text/markdown;charset=utf-8')}
              className="mt-2 flex items-center gap-1 text-[10px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-3 py-1.5 rounded-lg">
              <Download className="w-3 h-3" /> تنزيل 00-الخلاصة.md
            </button>
          </section>

          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 mb-3">كل المسودات ({drafts.length})</h3>
            {drafts.length ? (
              <div className="grid lg:grid-cols-2 gap-2.5">{drafts.slice(0, 40).map(draftCard)}</div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">مفيش مسودات للمراجعة.</p>
            )}
          </section>
        </>
      )}

      {/* ══ تبويب: قوالب جاهزة ══════════════════════════════════════════ */}
      {tab === 'templates' && (
        <>
          <section className="rounded-2xl border border-orange/25 bg-orange/5 dark:bg-orange/10 p-4">
            <div className="flex items-start gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-orange text-white flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">قوالب كار مصر الجاهزة</h3>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                  الصياغات الرسمية للمنصة والتطبيق — انسخها زي ما هي، أو خُد نسخة الماركداون للموقع.
                  <br />
                  <b>بوستات الإعلانات تفضل صور فقط</b> — النص هنا للتعريف بالمنصة، مش لنشر الإعلانات.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-2.5">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">٠. صورة + نص (١٠)</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">الصور اللي أرسلتها. انسخ رابطها أو نزّلها — واستخدمها مع القوالب.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {MARKETING_IMAGES.map(img => (
                <div key={img.key} className="rounded-xl border border-[#e2e8f0] dark:border-[#26374d] bg-gray-50 dark:bg-[#081220] overflow-hidden">
                  <a href={img.src} target="_blank" rel="noopener noreferrer">
                    <img src={img.src} alt={img.label} loading="lazy" className="w-full h-28 object-cover" />
                  </a>
                  <div className="p-1.5 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold text-gray-500">{img.label}</span>
                    <div className="flex gap-1">
                      <button onClick={async () => {
                        const ok = await copyText(`${PLATFORM}${img.src}`);
                        toast(ok ? 'تم نسخ رابط الصورة ✓' : 'تعذر النسخ', ok ? 'success' : 'error');
                      }} className="text-[9px] font-extrabold bg-sky-600 text-white px-1.5 py-0.5 rounded">نسخ</button>
                      <a href={img.src} download className="text-[9px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-1.5 py-0.5 rounded">تنزيل</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-2">
              💡 أخبرني أي صورة (١–١٠) تتناسب مع أي قالب، وسأربطها تلقائياً.
            </p>
          </section>

          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-2.5">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">١. تعريف المنصة (أولًا)</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">لصفحة «من نحن» أو مقال أو منشور طويل.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setOverviewMd(v => !v)}
                  className={`flex items-center gap-1 text-[10px] font-extrabold px-3 py-1.5 rounded-lg border ${overviewMd
                    ? 'bg-gray-800 dark:bg-[#13243a] text-white border-transparent'
                    : 'text-gray-600 dark:text-gray-300 border-[#e2e8f0] dark:border-[#26374d]'}`}>
                  <FileText className="w-3 h-3" /> {overviewMd ? 'عرض نص عادي' : 'عرض ماركداون'}
                </button>
                <button onClick={async () => {
                  const ok = await copyText(overviewMd ? PLATFORM_OVERVIEW : stripMarkdown(PLATFORM_OVERVIEW));
                  toast(ok ? 'تم نسخ تعريف المنصة ✓' : 'تعذر النسخ', ok ? 'success' : 'error');
                }} className="flex items-center gap-1 text-[10px] font-extrabold bg-sky-600 text-white hover:bg-sky-700 px-3 py-1.5 rounded-lg">
                  <Copy className="w-3 h-3" /> {overviewMd ? 'نسخ الماركداون' : 'نسخ النص'}
                </button>
                <button onClick={() => { downloadText('tareeq-platform-overview.md', PLATFORM_OVERVIEW, 'text/markdown;charset=utf-8'); toast('تم تنزيل التعريف ✓', 'success'); }}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-3 py-1.5 rounded-lg">
                  <Download className="w-3 h-3" /> تنزيل .md
                </button>
              </div>
            </div>
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-[#081220] rounded-xl px-3 py-2.5 max-h-80 overflow-y-auto text-gray-700 dark:text-gray-200 font-sans">{overviewMd ? PLATFORM_OVERVIEW : stripMarkdown(PLATFORM_OVERVIEW)}</pre>
          </section>

          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">٢. نصوص فيديوهات الخدمات (٧)</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">كل نص جاهز للنسخ على فيسبوك أو استعماله في فيديو.</p>
              </div>
            </div>
            {SERVICE_SCRIPTS.map(s => (
              <details key={s.key} className="group rounded-xl border border-[#e2e8f0] dark:border-[#26374d] bg-gray-50 dark:bg-[#081220] overflow-hidden">
                <summary className="flex items-center justify-between gap-2 cursor-pointer px-3 py-2.5 text-[11px] font-extrabold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#13243a]">
                  <span>{s.title}</span>
                  <span className="flex items-center gap-1.5">
                    <button onClick={async (e) => {
                      e.preventDefault(); e.stopPropagation();
                      const ok = await copyText(s.text);
                      toast(ok ? `تم نسخ ${s.title} ✓` : 'تعذر النسخ', ok ? 'success' : 'error');
                    }} className="flex items-center gap-1 text-[9px] font-extrabold bg-sky-600 text-white hover:bg-sky-700 px-2 py-1 rounded-md">
                      <Copy className="w-3 h-3" /> نسخ
                    </button>
                    <button onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      downloadText(`tareeq-script-${s.key}.txt`, s.text);
                      toast('تم تنزيل النص ✓', 'success');
                    }} className="flex items-center gap-1 text-[9px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-2 py-1 rounded-md">
                      <Download className="w-3 h-3" /> تنزيل
                    </button>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-open:rotate-180 transition-transform" />
                  </span>
                </summary>
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap px-3 py-2.5 text-gray-700 dark:text-gray-200 font-sans border-t border-[#e2e8f0] dark:border-[#26374d]">{s.text}</pre>
              </details>
            ))}
          </section>

          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-2.5">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">٣. المنشور الختامي الشامل (ثالثًا)</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">بوست فيسبوك شامل — جاهز للنشر على الجروبات.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={async () => {
                  const ok = await copyText(PLATFORM_SHORT_POST);
                  toast(ok ? 'تم نسخ المنشور ✓' : 'تعذر النسخ', ok ? 'success' : 'error');
                }} className="flex items-center gap-1 text-[10px] font-extrabold bg-sky-600 text-white hover:bg-sky-700 px-3 py-1.5 rounded-lg">
                  <Copy className="w-3 h-3" /> نسخ المنشور
                </button>
                <button onClick={() => { downloadText('tareeq-final-post.txt', PLATFORM_SHORT_POST); toast('تم تنزيل المنشور ✓', 'success'); }}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-3 py-1.5 rounded-lg">
                  <Download className="w-3 h-3" /> تنزيل .txt
                </button>
              </div>
            </div>
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-[#081220] rounded-xl px-3 py-2.5 max-h-72 overflow-y-auto text-gray-700 dark:text-gray-200 font-sans">{PLATFORM_SHORT_POST}</pre>
          </section>

          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-2.5">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">٤. بوست بديل (مع لينك تحميل التطبيق)</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">نسخة أقصر — مع لينك منصة + تحميل تطبيق.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={async () => {
                  const ok = await copyText(PLATFORM_ALT_POST);
                  toast(ok ? 'تم نسخ البوست ✓' : 'تعذر النسخ', ok ? 'success' : 'error');
                }} className="flex items-center gap-1 text-[10px] font-extrabold bg-sky-600 text-white hover:bg-sky-700 px-3 py-1.5 rounded-lg">
                  <Copy className="w-3 h-3" /> نسخ البوست
                </button>
                <button onClick={() => { downloadText('tareeq-alt-post.txt', PLATFORM_ALT_POST); toast('تم تنزيل البوست ✓', 'success'); }}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-3 py-1.5 rounded-lg">
                  <Download className="w-3 h-3" /> تنزيل .txt
                </button>
              </div>
            </div>
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-[#081220] rounded-xl px-3 py-2.5 max-h-72 overflow-y-auto text-gray-700 dark:text-gray-200 font-sans">{PLATFORM_ALT_POST}</pre>
          </section>
        </>
      )}
      {tab === 'shorts' && (
        <>
          <section className="rounded-2xl border border-orange/25 bg-orange/5 dark:bg-orange/10 p-4">
            <div className="flex items-start gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-orange text-white flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">تيك توك / يوتيوب / ريلز</h3>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                  قوالب قصيرة (١٥–٣٠ ثانية) جاهزة للنسخ. نصوص الفيديوهات في تبويب «قوالب جاهزة → ٢» تُستخدم أيضًا هنا.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4 space-y-2">
            {SHORT_FORM_CAPTIONS.map(s => (
              <details key={s.key} className="group rounded-xl border border-[#e2e8f0] dark:border-[#26374d] bg-gray-50 dark:bg-[#081220] overflow-hidden">
                <summary className="flex items-center justify-between gap-2 cursor-pointer px-3 py-2.5 text-[11px] font-extrabold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#13243a]">
                  <span>{s.title}</span>
                  <span className="flex items-center gap-1.5">
                    <button onClick={async (e) => {
                      e.preventDefault(); e.stopPropagation();
                      const ok = await copyText(s.text);
                      toast(ok ? `تم نسخ ${s.title} ✓` : 'تعذر النسخ', ok ? 'success' : 'error');
                    }} className="flex items-center gap-1 text-[9px] font-extrabold bg-sky-600 text-white hover:bg-sky-700 px-2 py-1 rounded-md">
                      <Copy className="w-3 h-3" /> نسخ
                    </button>
                    <button onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      downloadText(`tareeq-short-${s.key}.txt`, s.text);
                      toast('تم تنزيل النص ✓', 'success');
                    }} className="flex items-center gap-1 text-[9px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-2 py-1 rounded-md">
                      <Download className="w-3 h-3" /> تنزيل
                    </button>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-open:rotate-180 transition-transform" />
                  </span>
                </summary>
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap px-3 py-2.5 text-gray-700 dark:text-gray-200 font-sans border-t border-[#e2e8f0] dark:border-[#26374d]">{s.text}</pre>
              </details>
            ))}
          </section>
        </>
      )}

      {tab === 'rules' && (
        <>
          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">الأرقام والشروط المعتمدة</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">المراجع بيستخدم الأرقام اللي هنا. أي رقم براها بيطلع تحذير فوراً.</p>
              </div>
              <button onClick={() => { setTerms(DEFAULT_TERMS); toast('تم استرجاع الشروط الأصلية', 'success'); }}
                className="flex items-center gap-1 text-[10px] font-extrabold text-gray-600 dark:text-gray-300 border border-[#e2e8f0] dark:border-[#26374d] px-2.5 py-1.5 rounded-lg">
                <RefreshCw className="w-3 h-3" /> استرجاع الأصل
              </button>
            </div>
            <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={14}
              className="w-full text-xs leading-relaxed font-mono border border-[#e2e8f0] dark:border-[#26374d] rounded-xl px-3 py-2 bg-gray-50 dark:bg-[#081220] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange" />
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-2">✓ الحفظ تلقائي — أي تعديل هنا بيأثر على المراجعة فوراً.</p>
          </section>

          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 mb-3">قواعد الشغل (من AGENTS.md)</h3>
            <ol className="space-y-2 text-[11px] leading-relaxed text-gray-700 dark:text-gray-200 list-decimal pr-4">
              <li><b>مفيش حاجة تطلع لأي عميل أو تتنشر من غير موافقة توفيق.</b> كل الأدوات هنا بتنتج مسودات بس.</li>
              <li>ممنوع تأليف أي رقم أو سعر أو نسبة أو شرط — الأرقام من تبويب «القواعد والأرقام» بس.</li>
              <li>عربي مصري بسيط ومحترم، وكل رسالة للعملاء فيها سطر حذف/إيقاف الرسايل.</li>
              <li>الرسالة مش أطول من 6 سطور، والبوسط قصير ومختلف عن التاني.</li>
              <li>حافظ على المحافظة: الصياغة والجروبات بتناسب المحافظة.</li>
              <li>مفيش بيانات شخصية زيادة (بطاقة، عنوان تفصيلي).</li>
            </ol>
            <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              آخر سطر في أي خلاصة: «لم يُرسل أو يُنشر أي شيء. كله مستني موافقتك.»
            </div>
          </section>

          <section className="rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1626] p-4">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 mb-3">أدوار الورشة جوه المنصة</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                ['hunter', 'صياد العملاء', 'بيجهّز قائمة العملاء من leads.csv ويستبعد اللي اتواصلنا معاهم.'],
                ['sales-writer', 'كاتب المبيعات', 'بيكتب رسالة واتساب مخصوصة لكل عميل — مسودة بس.'],
                ['content-writer', 'كاتب المحتوى', 'بيكتب بوست مختلف لكل جروب (بحد أقصى 10 في اليوم).'],
                ['support', 'الدعم', 'ردود مسودة على ردود العملاء + تنبيه طلب الحذف.'],
                ['reviewer', 'المراجع', 'بيفحص الأرقام والحذف والطول والتكرار قبل الموافقة.'],
                ['manager', 'المدير', 'بيجمع الخلاصة اليومية وآخر سطر «مستني موافقتك».'],
              ].map(([code, name, desc]) => (
                <div key={code} className="rounded-xl border border-[#e2e8f0] dark:border-[#26374d] p-2.5">
                  <p className="text-[11px] font-extrabold text-gray-800 dark:text-gray-100">{name} <span className="text-[9px] text-gray-400 font-mono">{code}</span></p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <p className="text-center text-[10px] font-bold text-gray-400 pb-2">
        كل حاجة هنا مسودة داخلية — مفيش إرسال أو نشر تلقائي. توفيق هو اللي يوافق وينشر بنفسه.
      </p>
    </div>
  );
}
