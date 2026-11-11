import { PlusCircle, Camera, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
export default function PostingGuide() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">دليل النشر</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <PlusCircle className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">دليل نشر الإعلانات</h1>
          </div>
          <p className="text-gray-300">كيف تنشر إعلاناً احترافياً يجذب المشترين الجادين</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-orange" />نصائح الصور الاحترافية</h2>
          <ul className="space-y-2 text-sm text-text-light">
            {['التقط الصور في الضوء الطبيعي خارج المبنى.','غطّ جميع الزوايا: أمام، خلف، جانبان، داخل الكابينة، المحرك، الهيكل السفلي.','الحد الأدنى 5 صور، الحد الأقصى 20 صورة.','الدقة المطلوبة: 800×600 بكسل على الأقل.','لا تُخفِ أي أضرار — الصدق يبني الثقة ويُسرّع البيع.','تجنب الخلفيات المشتتة وركّز على المركبة.'].map((t,i)=>(
              <li key={i} className="flex items-start gap-2"><span className="text-orange font-bold">•</span>{t}</li>
            ))}
          </ul>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text mb-4">عناصر الوصف المثالي</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[['الماركة والموديل','Toyota، Volvo، Mercedes...'],['سنة الصنع','2015، 2018، 2022...'],['العداد/ساعات التشغيل','150,000 كم، 5,000 ساعة...'],['الحالة الفعلية','ممتازة، جيدة، تحتاج إصلاح...'],['المنطقة الجغرافية','القاهرة، الإسكندرية...'],['سبب البيع','ترقية الأسطول، إيقاف النشاط...']].map(([k,v])=>(
              <div key={k} className="border border-border rounded-xl p-3">
                <div className="font-semibold text-text">{k}</div>
                <div className="text-text-light">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-navy text-white rounded-2xl p-6 text-center">
          <h2 className="font-bold text-lg mb-2">جاهز للنشر؟</h2>
          <p className="text-gray-300 text-sm mb-4">يصل إعلانك لأكثر من 100,000 مستخدم</p>
          <Link to="/post-listing" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">نشر إعلان الآن</Link>
        </div>
      </div>
    </div>
  );
}
