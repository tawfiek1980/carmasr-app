import { Briefcase, MapPin, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const openings = [
  { title: 'مطور واجهة أمامية', dept: 'التقنية', location: 'القاهرة', type: 'دوام كامل' },
  { title: 'مختص تسويق رقمي', dept: 'التسويق', location: 'القاهرة', type: 'دوام كامل' },
  { title: 'مدير حسابات عملاء', dept: 'المبيعات', location: 'الإسكندرية', type: 'دوام كامل' },
  { title: 'محلل بيانات', dept: 'التقنية', location: 'القاهرة (Remote)', type: 'دوام كامل' },
];

export default function Careers() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الوظائف</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">انضم لفريقنا</h1>
          </div>
          <p className="text-gray-300">اعمل في شركة ناشئة تبني مستقبل قطاع السيارات في مصر</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-surface rounded-2xl border border-border p-6 mb-8">
          <h2 className="font-bold text-text text-lg mb-3">لماذا تعمل معنا؟</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-text-light">
            <div className="flex flex-col gap-1"><span className="font-semibold text-text">🚀 تأثير حقيقي</span><span>عملك يؤثر مباشرة على مئات الآلاف من المهنيين</span></div>
            <div className="flex flex-col gap-1"><span className="font-semibold text-text">📈 نمو مسرّع</span><span>فرص تطور وظيفي في بيئة ناشئة سريعة النمو</span></div>
            <div className="flex flex-col gap-1"><span className="font-semibold text-text">💪 فريق متميز</span><span>اعمل مع أفضل العقول في التقنية والتسويق واللوجستيات</span></div>
          </div>
        </div>
        <h2 className="font-bold text-text text-lg mb-4">الشواغر الحالية</h2>
        <div className="space-y-4 mb-8">
          {openings.map((job) => (
            <div key={job.title} className="bg-surface rounded-2xl border border-border p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-bold text-text">{job.title}</h3>
                <div className="flex items-center gap-3 text-sm text-text-light mt-1">
                  <span>{job.dept}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                  <span>•</span>
                  <span>{job.type}</span>
                </div>
              </div>
              <a href="mailto:tawfiek.fayez@gmail.com" className="bg-orange hover:bg-orange-dark text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
                تقدّم الآن
              </a>
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <p className="text-text-light text-sm mb-3">لا تجد الوظيفة المناسبة؟ أرسل سيرتك الذاتية وسنتواصل معك عند توفر فرصة مناسبة.</p>
          <a href="mailto:tawfiek.fayez@gmail.com" className="text-orange hover:underline font-semibold text-sm">tawfiek.fayez@gmail.com</a>
        </div>
      </div>
    </div>
  );
}
