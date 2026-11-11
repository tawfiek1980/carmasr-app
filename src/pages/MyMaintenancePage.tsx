import { Link } from 'react-router-dom';
import { Wrench, CheckCircle2, Calendar, Bell, Droplets, Gauge, ShieldCheck, ChevronLeft, Car } from 'lucide-react';
import SeoHead from '../components/SeoHead';

const reminders = [
  { icon: Droplets, title: 'تغيير الزيت والفلتر', desc: 'عادةً كل 5,000–10,000 كم أو حسب توصية الشركة المصنعة.' },
  { icon: Gauge, title: 'فحص الفرامل والإطارات', desc: 'راجع تآكل التيل والضغط وحالة الإطارات بانتظام.' },
  { icon: Bell, title: 'فحص البطارية والكهرباء', desc: 'تأكد من كفاءة البطارية والأنوار والتنبيهات.' },
  { icon: Calendar, title: 'صيانة دورية مجدولة', desc: 'التزم بجدول الصيانة الدورية للحفاظ على أداء العربية وقيمتها.' },
];

const checklist = [
  'مستوى زيت المحرك والسوائل (تبريد، فرامل، غسيل)',
  'ضغط الإطارات وحالة المداس والإطار الاحتياطي',
  'الفرامل (صوت/استجابة) وسوائلها',
  'الأنوار والإشارات والمساحات',
  'البطارية والأطراف والتوصيلات',
  'الفلاتر (هواء/زيت/مكيف) حسب الموعد',
  'تكييف الهواء والأداء العام',
  'مراجعة أي لمبات تحذير في الطبلون',
];

export default function MyMaintenancePage() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead title="الصيانة الخاصة بي — كار مصر" description="إدارة وتتبع صيانة سيارتك مع تذكيرات وقائمة فحص أساسية." />
      <div className="bg-gradient-to-br from-[#0F172A] via-[#172554] to-[#1D4ED8] text-white py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-4">
            <Link to="/" className="hover:text-orange">الرئيسية</Link><ChevronLeft className="w-4 h-4" /><span className="text-white">الصيانة الخاصة بي</span>
          </nav>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Wrench className="w-8 h-8 text-orange" /> الصيانة الخاصة بي
          </h1>
          <p className="text-white/80 mt-2 max-w-2xl">إدارة وتتبع صيانة سيارتك — تذكيرات أساسية وقائمة فحص تساعدك تحافظ على عربيتك.</p>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section>
          <h2 className="text-lg sm:text-xl font-extrabold text-text mb-4">تذكيرات صيانة مهمة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {reminders.map((r) => (
              <div key={r.title} className="bg-surface border border-border rounded-2xl p-5">
                <div className="w-11 h-11 rounded-xl bg-orange/10 flex items-center justify-center mb-3"><r.icon className="w-5 h-5 text-orange" /></div>
                <h3 className="font-extrabold text-text">{r.title}</h3>
                <p className="text-sm text-text-muted mt-1 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-lg font-extrabold text-text mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-orange" /> قائمة فحص سريعة</h2>
            <ul className="space-y-3">
              {checklist.map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-orange/10 text-orange text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-sm text-text leading-relaxed">{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="text-lg font-extrabold text-text mb-2 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-orange" /> نصيحة</h2>
              <p className="text-sm text-text-muted leading-relaxed">الالتزام بالصيانة الدورية يقلل الأعطال المفاجئة ويحافظ على قيمة العربية عند إعادة البيع. احتفظ بسجل زيارات الصيانة والفواتير.</p>
            </div>
            <div className="bg-gradient-to-br from-orange to-orange-600 text-white rounded-2xl p-6">
              <h3 className="font-extrabold text-lg mb-1">تحتاج خدمات أو مساعدة؟</h3>
              <p className="text-white/90 text-sm mb-4">تصفح خدمات الصيانة والمعارض والطوارئ المتاحة على كار مصر.</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/services" className="bg-white text-orange px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-50">الخدمات</Link>
                <Link to="/maintenance" className="bg-black/20 border border-white/30 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-black/30">مراكز الصيانة</Link>
                <Link to="/emergency" className="bg-black/20 border border-white/30 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-black/30">طوارئ</Link>
              </div>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center shrink-0"><Car className="w-6 h-6 text-orange" /></div>
              <div>
                <p className="font-extrabold text-text">تفكر تبيع عربيتك؟</p>
                <Link to="/sell-car" className="text-orange text-sm font-bold hover:underline">اعرف خطوات البيع على كار مصر ←</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
