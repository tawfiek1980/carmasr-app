import { DollarSign, CheckCircle, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
export default function FinancingGuide() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">دليل التمويل</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">دليل التمويل</h1>
          </div>
          <p className="text-gray-300">كل ما تحتاج معرفته لتمويل مركبتك أو معداتك بسهولة</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text text-lg mb-4">كيف تعمل خدمة التمويل؟</h2>
          <div className="space-y-4">
            {[
              { n: '١', t: 'تقديم الطلب', d: 'املأ نموذج طلب التمويل ببياناتك الأساسية وتفاصيل المركبة المطلوبة.' },
              { n: '٢', t: 'مراجعة الطلب', d: 'يراجع فريقنا طلبك ويحيله إلى شركاء التمويل المعتمدين المناسبين.' },
              { n: '٣', t: 'التواصل معك', d: 'يتواصل معك ممثل التمويل خلال 48 ساعة لاستكمال الإجراءات.' },
              { n: '٤', t: 'إتمام التمويل', d: 'بعد الموافقة، يُحدَّد جدول السداد ويُسلَّم مبلغ التمويل.' },
            ].map(s => (
              <div key={s.n} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-orange text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{s.n}</div>
                <div><h3 className="font-semibold text-text text-sm">{s.t}</h3><p className="text-text-light text-sm">{s.d}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-success" />المستندات المطلوبة</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-text-light">
            {['بطاقة الرقم القومي سارية','صورة شخصية حديثة','إثبات الدخل (راتب/كشف حساب)','عقد عمل أو سجل تجاري','إيصال مرافق حديث (كهرباء/مياه)','صورة المركبة المراد تمويلها'].map(d=>(
              <li key={d} className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success flex-shrink-0" />{d}</li>
            ))}
          </ul>
        </div>
        <div className="bg-navy text-white rounded-2xl p-6 text-center">
          <h2 className="font-bold text-lg mb-2">هل أنت مستعد للتقديم؟</h2>
          <p className="text-gray-300 text-sm mb-4">احصل على موافقة مبدئية خلال 48 ساعة</p>
          <Link to="/finance" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">تقديم طلب التمويل</Link>
        </div>
      </div>
    </div>
  );
}
