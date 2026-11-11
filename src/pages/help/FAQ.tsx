import { ChevronDown, HelpCircle, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const faqs = [
  { q: 'هل التسجيل في كار مصر مجاني؟', a: 'نعم، التسجيل ونشر الإعلانات الأساسية مجانيان تماماً. نوفر أيضاً باقات مميزة للمُعلنين الراغبين في زيادة الظهور.' },
  { q: 'كيف أنشر إعلان بيع شاحنة؟', a: 'بعد التسجيل وتسجيل الدخول، اضغط على "أضف إعلان" من أعلى الصفحة، اختر الفئة المناسبة، أدخل التفاصيل والصور، ثم اضغط "نشر الإعلان". يُنشر الإعلان فور المراجعة خلال ساعات.' },
  { q: 'ما هي المستندات المطلوبة للتمويل؟', a: 'تحتاج بطاقة رقم قومي، شهادة دخل أو كشف حساب بنكي، وبطاقة ضريبية للشركات. تحدد جهة التمويل المستندات الإضافية بعد التقديم.' },
  { q: 'هل يمكنني التحقق من صحة إعلان معين؟', a: 'ننصح بالفحص الفني الشخصي وطلب مستند الملكية من البائع. يمكنك أيضاً التحقق من تاريخ المستخدم عبر ملفه الشخصي وتقييمات المتعاملين معه.' },
  { q: 'كم مدة بقاء الإعلان؟', a: 'تبقى الإعلانات نشطة 60 يوماً قابلة للتجديد. بعد بيع المركبة، يجب تحديث الإعلان في غضون 48 ساعة.' },
  { q: 'ماذا أفعل إذا تعرضت للاحتيال؟', a: 'أبلغ فريق كار مصر فوراً عبر tawfiek.fayez@gmail.com مع توثيق الأدلة. في الحالات الجنائية، قدّم بلاغاً للشرطة (122) مع الاحتفاظ بكل التواصل.' },
  { q: 'هل يمكنني نشر إعلانات معدات غير مركبات؟', a: 'نعم، المنصة تقبل جميع معدات البناء والحفر والرفع والزراعة الثقيلة بالإضافة لشاحنات النقل ومقطوراتها.' },
  { q: 'كيف أتواصل مع البائع؟', a: 'يمكنك الاتصال مباشرة برقم الهاتف المُعلَن، أو إرسال رسالة عبر نظام المراسلة الداخلي في المنصة.' },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button className="w-full flex items-center justify-between py-4 text-right" onClick={() => setOpen(!open)}>
        <span className="font-semibold text-text text-sm">{q}</span>
        <ChevronDown className={`w-5 h-5 text-orange flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-text-light text-sm leading-relaxed pb-4">{a}</p>}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <Link to="/help" className="hover:text-orange">المساعدة</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الأسئلة الشائعة</span>
          </nav>
          <HelpCircle className="w-12 h-12 text-orange mb-4" />
          <h1 className="text-3xl font-bold mb-3">الأسئلة الشائعة</h1>
          <p className="text-gray-300">إجابات سريعة لأكثر الأسئلة شيوعاً</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
          {faqs.map((f) => <FAQItem key={f.q} {...f} />)}
        </div>
        <div className="text-center">
          <p className="text-text-light text-sm mb-3">لم تجد إجابتك؟</p>
          <Link to="/support" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">تواصل مع فريق الدعم</Link>
        </div>
      </div>
    </div>
  );
}
