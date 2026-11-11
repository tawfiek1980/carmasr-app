import { Tag, Star, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
const steps = [
  { title: 'تجهيز المركبة', desc: 'نظّف المركبة جيداً من الداخل والخارج قبل التصوير. الانطباع الأول يؤثر بشكل كبير على رغبة المشترين في التواصل.' },
  { title: 'التصوير الاحترافي', desc: 'التقط صوراً واضحة من جميع الزوايا (الأمام، الخلف، الجانبان، الداخل، المحرك). الإضاءة الطبيعية في الخارج تُعطي أفضل نتيجة. لا تخفِ أي عيوب — الصدق يبني الثقة ويُسرّع البيع.' },
  { title: 'كتابة وصف دقيق', desc: 'اذكر الماركة، الموديل، سنة الصنع، قراءة العداد، الحالة الفعلية، أي إصلاحات أو تجديدات، وسبب البيع. الوصف التفصيلي الصادق يجذب مشترين جادين ويُقلل من الأسئلة المتكررة.' },
  { title: 'تسعير صحيح', desc: 'ابحث في المنصة عن مركبات مماثلة لتحديد السعر العادل. السعر المنطقي يُسرّع البيع ويُجنّبك المساومات المُضيعة للوقت. يمكنك الإشارة إلى إمكانية التفاوض.' },
  { title: 'إدارة الاستفسارات', desc: 'رد على الرسائل والمكالمات بسرعة واحترافية. الردود السريعة تدل على الجدية وتُحافظ على اهتمام المشتري المحتمل.' },
  { title: 'إتمام الصفقة بأمان', desc: 'حدد موعد المعاينة في مكان مناسب. تحقق من هوية المشتري. لا تُسلّم المستندات إلا بعد استلام كامل المبلغ. أكمل نقل الملكية رسمياً.' },
];
export default function SellingGuide() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">دليل البيع</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <Tag className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">دليل البيع</h1>
          </div>
          <p className="text-gray-300">كيف تبيع مركبتك أو سياراتك بأعلى سعر وأسرع وقت</p>
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
        <div className="bg-navy text-white rounded-2xl p-6 text-center">
          <Star className="w-10 h-10 text-orange mx-auto mb-3" />
          <h2 className="font-bold text-lg mb-2">ابدأ البيع الآن</h2>
          <p className="text-gray-300 text-sm mb-4">انضم لأكثر من 50,000 إعلان نشط على كار مصر</p>
          <Link to="/post-listing" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">نشر إعلان جديد</Link>
        </div>
      </div>
    </div>
  );
}
