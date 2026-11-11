import { ShoppingBag, CheckCircle, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
const steps = [
  { title: 'البحث والتصفية', desc: 'استخدم فلاتر البحث المتقدمة لتحديد الفئة (سيارة، سيارة، سيارة)، المحافظة، نطاق السعر، وسنة الصنع. كلما كنت أكثر دقة في الفلترة، وجدت ما تحتاجه أسرع.' },
  { title: 'مراجعة الإعلان', desc: 'اقرأ الوصف بعناية. تحقق من تاريخ النشر وعدد مرات المشاهدة. راجع ملف المستخدم وتقييماته السابقة. صور متعددة وواضحة علامة جيدة على بائع موثوق.' },
  { title: 'التواصل مع البائع', desc: 'تواصل عبر نظام الرسائل أو بالاتصال برقم الهاتف المُعلَن. اسأل عن حالة المركبة، سبب البيع، وتاريخ الصيانة. البائع الموثوق سيجيب بشفافية.' },
  { title: 'المعاينة الشخصية', desc: 'لا تُتم أي صفقة بدون معاينة شخصية. حدد موعداً في مكان عام. اصطحب متخصصاً لفحص المركبة فحصاً دقيقاً شاملاً.' },
  { title: 'التحقق من الأوراق', desc: 'تأكد من استمارة السير، بطاقة الكود، التأمين الساري، وخلو المركبة من أي حجوزات أو مطلوبات قانونية لدى الجهات الرسمية.' },
  { title: 'إتمام الصفقة بأمان', desc: 'استخدم التحويل البنكي الموثَّق. احتفظ بإيصال الدفع. أكمل نقل الملكية رسمياً لدى الجهات المختصة فور إتمام الصفقة.' },
];
export default function BuyingGuide() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">دليل الشراء</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">دليل الشراء</h1>
          </div>
          <p className="text-gray-300">خطوات مدروسة لإتمام صفقة شراء ناجحة وآمنة</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-4 mb-8">
          {steps.map((s, i) => (
            <div key={s.title} className="bg-surface rounded-2xl border border-border p-6 flex gap-4">
              <div className="w-10 h-10 rounded-full bg-orange flex items-center justify-center text-white font-bold flex-shrink-0">{i + 1}</div>
              <div>
                <h3 className="font-bold text-text mb-1">{s.title}</h3>
                <p className="text-text-light text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text mb-3 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-success" />قائمة التحقق قبل الشراء</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-text-light">
            {['فحص المحرك والهيكل','التحقق من العداد','مراجعة استمارة السير','التأكد من خلو المركبة من حجوزات','فحص نظام الكهرباء والإضاءة','اختبار قيادة (حيثما أمكن)','التحقق من بطاقة الكود','نقل الملكية رسمياً'].map(c=>(
              <li key={c} className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success flex-shrink-0" />{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
