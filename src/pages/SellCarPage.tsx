import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Tag, Camera, PhoneCall, BadgeCheck, ShieldCheck, Clock, Users,
  ChevronDown, ChevronLeft, Car, Smartphone, MessageCircle, FileCheck, Sparkles,
} from 'lucide-react';
import SeoHead from '../components/SeoHead';

const benefits = [
  { icon: Tag, title: 'نشر مجاني', desc: 'أضف إعلان عربيتك بدون رسوم وابدأ استقبال اهتمام المشترين.' },
  { icon: Camera, title: 'اعرض عربيتك بصور واضحة', desc: 'ارفع صور وتفاصيل دقيقة علشان تعزز ثقة المشتري وتسرّع البيع.' },
  { icon: PhoneCall, title: 'تواصل مباشر', desc: 'المشتري يتواصل معاك مباشرة بدون وسيط أو مكالمات مزعجة من المنصة.' },
  { icon: BadgeCheck, title: 'تحكم كامل في السعر', desc: 'أنت اللي تحدد السعر ونوعه (ثابت/قابل للتفاوض/عند التواصل).' },
  { icon: Users, title: 'وصول لمشترين مهتمين', desc: 'إعلانك بيظهر للباحثين حسب الماركة والموديل والسعر والمحافظة.' },
  { icon: ShieldCheck, title: 'نصائح للبيع الآمن', desc: 'إرشادات تساعدك تتفق وتكمل البيع بوضوح وأمان.' },
];

const steps = [
  { n: '1', title: 'سجّل بيانات عربيتك', desc: 'في دقائق، أدخل الماركة والموديل والسنة والحالة والسعر والمحافظة وبيانات التواصل.' },
  { n: '2', title: 'أضف صور وتفاصيل واضحة', desc: 'صور جيدة ووصف صادق (الكيلومترات، حالة العربية، أي ملاحظات) بتزود فرص البيع.' },
  { n: '3', title: 'انشر إعلانك واستقبل التواصل', desc: 'بعد النشر، المشترين المهتمين يقدروا يشوفوا إعلانك ويتواصلوا معاك مباشرة.' },
  { n: '4', title: 'عاين واتفق وأكمل البيع', desc: 'رتّب المعاينة، اتفق على السعر والشروط، وأكمل إجراءات نقل الملكية بينكما وفق القوانين.' },
];

const faqs = [
  { q: 'هل نشر الإعلان على كار مصر مجاني؟', a: 'نعم، يمكنك إضافة إعلانك مجانًا وعرض عربيتك للمشترين المهتمين.' },
  { q: 'هل المنصة بتتواصل مع المشترين بدالي؟', a: 'كار مصر سوق إعلانات مباشر: المشترون يتواصلون معك أنت مباشرة عبر وسائل التواصل التي تضيفها في الإعلان.' },
  { q: 'إزاي أزوّد فرصة بيع عربيتي بسرعة؟', a: 'استخدم عنوان واضح، أضف صور متعددة بجودة جيدة، اكتب تفاصيل دقيقة (السنة، الكيلومترات، الحالة)، وحدد سعر مناسب للسوق.' },
  { q: 'هل يمكن تعديل الإعلان بعد النشر؟', a: 'نعم، يمكنك تعديل إعلانك من صفحة "إعلاناتي" في أي وقت (قد تخضع بعض التعديلات للمراجعة حسب السياسة).' },
  { q: 'هل كار مصر بتستلم العربية أو تضمن الدفع؟', a: 'كار مصر منصة لعرض الإعلانات والتواصل بين البائع والمشتري. المعاينة والاتفاق والدفع ونقل الملكية تتم مباشرة بين الطرفين.' },
  { q: 'إيه المطلوب لنقل الملكية؟', a: 'إجراءات نقل الملكية تتم وفق القوانين والجهات المختصة. ننصح بالاتفاق الموثق والتأكد من سلامة الأوراق قبل إتمام البيع.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-2xl bg-surface overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-right">
        <span className="font-bold text-text text-sm sm:text-base">{q}</span>
        <ChevronDown className={`w-5 h-5 text-orange shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm text-text-muted leading-relaxed border-t border-border pt-3">{a}</div>}
    </div>
  );
}

export default function SellCarPage() {
  return (
    <div className="min-h-screen bg-bg pb-16">
      <SeoHead title="بيع عربيتك — كار مصر" description="بيع عربيتك بسهولة على كار مصر. أضف إعلانك مجانًا، اعرض صور وتفاصيل عربيتك، وتواصل مباشرة مع المشترين." />

      <section className="bg-gradient-to-br from-[#07172d] via-[#0b2748] to-[#123a63] text-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-orange" /> بيع سيارتك على كار مصر
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
              أسهل طريقة لعرض وبيع عربيتك
              <span className="block text-orange mt-1">بإعلان مجاني وتواصل مباشر</span>
            </h1>
            <p className="mt-3 text-white/80 text-sm sm:text-base max-w-xl leading-relaxed">
              انشر إعلان عربيتك في دقائق، اعرض الصور والتفاصيل والسعر، ووصل للمشترين المهتمين في محافظتك — بدون وسيط.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link to="/post-listing" className="inline-flex items-center justify-center gap-2 bg-orange hover:bg-orange-600 text-white px-6 py-3.5 rounded-xl font-extrabold shadow-lg shadow-orange/30 transition-colors">
                أضف إعلانك الآن <ChevronLeft className="w-4 h-4" />
              </Link>
              <Link to="/help/selling-guide" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3.5 rounded-xl font-bold transition-colors">
                دليل البيع
              </Link>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur">
            <h2 className="font-extrabold text-lg mb-4">مزايا البيع على كار مصر</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Tag, t: 'إعلان مجاني' },
                { icon: Camera, t: 'صور وتفاصيل كاملة' },
                { icon: PhoneCall, t: 'تواصل مباشر مع المشتري' },
                { icon: BadgeCheck, t: 'تحكم في السعر' },
                { icon: Clock, t: 'نشر سريع في دقائق' },
                { icon: Users, t: 'وصول لمشترين مهتمين' },
              ].map((m) => (
                <div key={m.t} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-3">
                  <m.icon className="w-5 h-5 text-orange shrink-0" />
                  <span className="text-sm font-semibold">{m.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
        <h2 className="text-xl sm:text-2xl font-extrabold text-text text-center mb-6">ليه تبيع عربيتك على كار مصر؟</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((b, i) => (
            <motion.div key={b.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }} className="bg-surface border border-border rounded-2xl p-5">
              <div className="w-11 h-11 rounded-xl bg-orange/10 flex items-center justify-center mb-3"><b.icon className="w-5 h-5 text-orange" /></div>
              <h3 className="font-extrabold text-text">{b.title}</h3>
              <p className="text-sm text-text-muted mt-1 leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4">
        <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-text text-center mb-2">خطوة عليك والباقي عليك</h2>
          <p className="text-text-muted text-center text-sm mb-8">خطوات بسيطة لنشر وبيع عربيتك على كار مصر</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((s) => (
              <div key={s.n} className="bg-bg border border-border rounded-2xl p-5 relative">
                <div className="w-9 h-9 rounded-full bg-orange text-white font-extrabold flex items-center justify-center mb-3">{s.n}</div>
                <h3 className="font-extrabold text-text mb-1.5">{s.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/post-listing" className="inline-flex items-center justify-center gap-2 bg-orange hover:bg-orange-600 text-white px-8 py-3.5 rounded-xl font-extrabold transition-colors">
              بيع عربيتك دلوقتي <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h2 className="text-xl sm:text-2xl font-extrabold text-text text-center mb-6">الأسئلة الشائعة</h2>
        <div className="space-y-3">
          {faqs.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-orange/10 flex items-center justify-center"><Smartphone className="w-7 h-7 text-orange" /></div>
            <div>
              <p className="font-extrabold text-text">بيع وشراء أسهل من التطبيق</p>
              <p className="text-sm text-text-muted">حمّل تطبيق كار مصر وتابع إعلاناتك وتواصل أسرع.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/download-app" className="bg-[#0B1E3A] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90">تحميل التطبيق</Link>
            <Link to="/post-listing" className="bg-orange text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 inline-flex items-center gap-1.5"><Car className="w-4 h-4" /> أضف إعلانك</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
