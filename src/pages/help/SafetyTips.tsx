import { Shield, AlertTriangle, CheckCircle, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
const buyerTips = [
  'لا تدفع أي مبلغ قبل معاينة المركبة شخصياً والتحقق من مستنداتها الرسمية.',
  'حدد مواعيد المعاينة في أماكن عامة ومضاءة خلال ساعات النهار.',
  'اصطحب شخصاً متخصصاً أو مهندساً لفحص المركبة قبل الشراء.',
  'تحقق من سجل المركبة لدى الجهات الرسمية (المرور).',
  'لا تقبل الشيكات كوسيلة دفع من أطراف مجهولة.',
  'ابتعد عن الأسعار التي تبدو أقل بكثير من سعر السوق الحقيقي.',
];
const sellerTips = [
  'تحقق من هوية المشتري قبل السماح بتجربة المركبة.',
  'لا تُسلّم المستندات الأصلية إلا بعد استكمال الدفع بالكامل.',
  'استخدم التحويل البنكي الموثَّق بدلاً من النقد في الصفقات الكبيرة.',
  'احتفظ بسجل لجميع الاتصالات والمحادثات المتعلقة بالصفقة.',
  'لا تشارك معلومات بنكية أو بيانات شخصية عبر الرسائل.',
];
export default function SafetyTips() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">نصائح الأمان</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">نصائح الأمان</h1>
          </div>
          <p className="text-gray-300">دليلك الشامل لإجراء صفقات آمنة ومحمية على منصة كار مصر</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text text-lg mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-success" />نصائح للمشترين</h2>
          <ul className="space-y-3">
            {buyerTips.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-text-light">
                <span className="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i+1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text text-lg mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-orange" />نصائح للبائعين</h2>
          <ul className="space-y-3">
            {sellerTips.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-text-light">
                <span className="w-6 h-6 rounded-full bg-orange/10 text-orange flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i+1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6">
          <h2 className="font-bold text-danger text-lg mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />علامات التحذير من الاحتيال</h2>
          <ul className="space-y-2 text-sm text-text-light">
            {['سعر أقل بكثير من سعر السوق دون تفسير منطقي.','البائع يرفض المقابلة الشخصية أو تأخير المعاينة.','طلب دفعة مقدمة كبيرة قبل رؤية المركبة.','المعلومات المُقدَّمة غير متسقة أو متغيرة من رسالة لأخرى.','صور مسروقة من الإنترنت أو لا تتطابق مع الوصف.'].map((t,i)=>(
              <li key={i} className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" /><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <div className="bg-navy text-white rounded-2xl p-6 text-center">
          <h2 className="font-bold text-lg mb-2">واجهت موقفاً مريباً؟</h2>
          <p className="text-gray-300 text-sm mb-4">لا تتردد في الإبلاغ — سلامتك أهم من أي صفقة</p>
          <Link to="/report-abuse" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">أبلغ الآن</Link>
        </div>
      </div>
    </div>
  );
}
