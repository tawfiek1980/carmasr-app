import admin from 'firebase-admin';
import { config } from 'dotenv';
config();

const key = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

if (!key.projectId || !key.clientEmail || !key.privateKey) {
  console.error('\n❌ متغيرات Firebase غير موجودة في .env — شغّل:\n   npm i\n   ثم أنشئ .env من .env.example مع مفاتيح Firebase\n');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

const CATEGORY_LABELS = {
  trucks: 'شاحنات', equipment: 'معدات ثقيلة', trailers: 'نقل (مقطورات)',
  buses: 'أتوبيسات', 'spare-parts': 'قطع غيار', loads: 'حمولات', jobs: 'وظائف',
};
const GOVERNS = ['القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'القليوبية', 'المنوفية', 'الغربية', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'مرسى مطروح', 'شمال سيناء', 'جنوب سيناء', 'الوادي الجديد', 'البحر الأحمر'];

function formatPrice(p) {
  if (!p) return '';
  if (p >= 1000000) return `${(p / 1000000).toFixed(1).replace(/\.0$/, '')} مليون ج`;
  return `${Number(p).toLocaleString('ar-EG')} ج`;
}

function shortId(id) {
  return (id || '').slice(0, 8).toUpperCase();
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

const PAGE_LINK = 'https://www.facebook.com/TareeqEG';
const SITE = 'https://carmasr-app.vercel.app';
const HASHTAGS = '#كار_مصر #CarMasr #نقل_ثقيل #شاحنات #معدات_ثقيلة #مصر #سوق_النقل #حمولات #وظائف_النقل';

function listingPost(listing, i) {
  const title = listing.title || 'إعلان جديد';
  const price = formatPrice(listing.price);
  const gov = listing.governorate || 'مصر';
  const cat = CATEGORY_LABELS[listing.category] || 'عرض';
  const url = `${SITE}/listing/${listing.id}`;
  return `🚛 *${title}*\n\n${cat} | ${gov}\n${price ? `💰 السعر: ${price}\n` : ''}${listing.description ? `📋 ${truncate(listing.description, 120)}\n` : ''}\n👇 للتفاصيل والصور: ${url}\n\n#تخفيضات #نقل_ثقيل #شاحنات_للبيع #مصر #كار_مصر`;
}

function loadPost(load, i) {
  const price = formatPrice(load.price);
  return `📦 حمولة متاحة: ${load.origin} ← ${load.destination}\n\n${load.cargoType ? `🧱 نوع الحمولة: ${load.cargoType}\n` : ''}${load.vehicleType ? `🚛 نوع الشاحنة: ${load.vehicleType}\n` : ''}${load.weight ? `⚖️ الوزن: ${load.weight}\n` : ''}${price ? `💰 السعر المقترح: ${price}\n` : ''}${load.isReturnLoad ? '🔄 حمولة عودة\n' : ''}${load.international ? '🌍 نقل دولي\n' : ''}\n👇 تفاصيل أكثر على: ${SITE}/loads\n\n#حمولات #نقل_بضائع #شاحنات #لوجستيات #مصر #كار_مصر`;
}

function jobPost(job, i) {
  return `💼 فرصة عمل جديدة\n\n${job.title || 'وظيفة'}\n${job.company ? `🏢 ${job.company}\n` : ''}${job.governorate ? `📍 ${job.governorate}\n` : ''}${job.salary ? `💰 الراتب: ${job.salary}\n` : ''}${job.description ? `📋 ${truncate(job.description, 120)}\n` : ''}\n👇 قدم الآن: ${SITE}/jobs\n\n#وظائف #توظيف #سائقين #ميكانيكا #مصر #كار_مصر`;
}

const BRAND_POSTS = [
  () => `🚛 *مرحباً بكم في كار مصر CarMasr!*\n\nأكبر سوق إلكتروني متخصص في النقل الثقيل في مصر 🇪🇬\n\n✅ بيع وشراء شاحنات ومعدات ثقيلة\n✅ حمولات وطلبات نقل\n✅ وظائف القيادة والميكانيكا\n✅ تمويل وخدمات طوارئ على الطريق\n\n📱 حمل التطبيق مجاناً: ${SITE}/download/\n\n#كار_مصر #CarMasr #نقل_ثقيل #مصر`,
  () => `🚛 عندك شاحنة أو معدة وبتدور على مشتري؟\n\nانشر إعلانك مجاناً على كار مصر CarMasr ووصّل لآلاف المهتمين في كل مصر! 🇪🇬\n\n💡 أضف إعلانك: ${SITE}\n\n#بيع_شاحنة #معدات_ثقيلة #سوق_المعدات #مصر #كار_مصر`,
  () => `📦 صاحب حمولة وعايز شاحنة تمنة بكرة؟\n\nعلى كار مصر CarMasr توصل لأكبر شبكة سائقين وشاحنات في مصر — نشر حمولة مجاني وسريع! 💨\n\n📱 حمّل التطبيق: ${SITE}/download/\n\n#حمولات #نقل_بضائع #لوجستيات #مصر #كار_مصر`,
  () => `💼 بتدور على شغل في عالم النقل؟\n\nقسم الوظائف في كار مصر CarMasr فيه كل حاجة: سائقين، ميكانيكا، كهربائيين، فنيين، لوجستيات والمزيد! 🔧\n\n👷 استكشف الوظائف: ${SITE}/jobs\n\n#وظائف #توظيف #سائقين #ميكانيكا #مصر #كار_مصر`,
  () => `🔥 محتاج تمويل لشاحنتك الجديدة؟ أو سيارة عطلانة على الطريق؟\n\nكار مصر CarMasr بيوفرلك:\n💰 تمويل الشاحنات\n🛠️ طوارئ الطريق 24/7\n\n👇 كل الخدمات: ${SITE}\n\n#تمويل #طوارئ_الطريق #نقل_ثقيل #مصر #كار_مصر`,
];

const VOICE = `🔔 تابعنا على صفحتنا الرسمية ليصلك كل جديد\n\n📱 حمّل التطبيق: ${SITE}/download/\n\n${PAGE_LINK}\n\n${HASHTAGS}`;

async function main() {
  const [,, mode = 'all'] = process.argv;
  const posts = [];

  if (mode === 'brand' || mode === 'all') {
    for (let i = 0; i < BRAND_POSTS.length; i++) posts.push(BRAND_POSTS[i]());
  }

  if (mode === 'listings' || mode === 'all') {
    try {
      const snap = await db.collection('listings').orderBy('createdAt', 'desc').limit(10).get();
      snap.forEach((doc) => posts.push(listingPost({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(`⚠️ تعذر جلب الإعلانات: ${e.message}`);
    }
  }

  if (mode === 'loads' || mode === 'all') {
    try {
      const snap = await db.collection('loads').orderBy('createdAt', 'desc').limit(5).get();
      snap.forEach((doc) => posts.push(loadPost({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(`⚠️ تعذر جلب الحمولات: ${e.message}`);
    }
  }

  if (mode === 'jobs' || mode === 'all') {
    try {
      const snap = await db.collection('jobs').orderBy('createdAt', 'desc').limit(5).get();
      snap.forEach((doc) => posts.push(jobPost({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(`⚠️ تعذر جلب الوظائف: ${e.message}`);
    }
  }

  if (posts.length === 0) {
    console.error('\n⚠️ لا توجد منشورات لتوليدها');
    return;
  }

  const blocks = posts.map((p, i) => `───────────  منشور ${i + 1} / ${posts.length}  ───────────\n\n${p}\n\n${VOICE}`);
  console.log(blocks.join('\n\n'));
  console.log(`\n${'═'.repeat(46)}\nالإجمالي: ${posts.length} منشور جاهز ✅\nالاستخدام: npm run fb-posts [brand|listings|loads|jobs|all]`);
}

main();
