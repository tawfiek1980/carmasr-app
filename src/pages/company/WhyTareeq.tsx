import { CheckCircle, Shield, TrendingUp, HeadphonesIcon, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const reasons = [
  { icon: Shield, title: 'الأمان أولاً', desc: 'نُطبّق أعلى معايير التحقق من هوية المستخدمين وحماية البيانات لضمان بيئة تداول آمنة.' },
  { icon: TrendingUp, title: 'سوق حقيقي نشط', desc: 'أكثر من 50,000 إعلان نشط يجعل العثور على ما تبحث عنه سهلاً وسريعاً.' },
  { icon: CheckCircle, title: 'مجانية التسجيل', desc: 'التسجيل ونشر الإعلانات الأساسية مجانية تماماً بلا قيود.' },
  { icon: HeadphonesIcon, title: 'دعم متخصص', desc: 'فريق دعم يفهم قطاع السيارات ومستعد للمساعدة 6 أيام في الأسبوع.' },
];

export default function WhyTareeq() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">لماذا كار مصر</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">لماذا كار مصر؟</h1>
          <p className="text-gray-300">ما يميزنا عن غيرنا ويجعلنا الخيار الأفضل لك</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {reasons.map((r) => (
            <div key={r.title} className="bg-surface rounded-2xl border border-border p-6 card-hover">
              <r.icon className="w-10 h-10 text-orange mb-4" />
              <h3 className="font-bold text-text text-lg mb-2">{r.title}</h3>
              <p className="text-text-light text-sm leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
        <div className="bg-navy text-white rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">ابدأ مجاناً الآن</h2>
          <p className="text-gray-300 mb-6">لا تحتاج بطاقة ائتمان • لا رسوم خفية</p>
          <Link to="/register" className="inline-block bg-orange hover:bg-orange-dark text-white px-10 py-3 rounded-xl font-bold transition-colors">
            إنشاء حساب مجاني
          </Link>
        </div>
      </div>
    </div>
  );
}
