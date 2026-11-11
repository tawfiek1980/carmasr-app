import { Download, FileImage, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
export default function PressKit() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">المجموعة الإعلامية</span>
          </nav>
          <h1 className="text-3xl font-bold mb-3">المجموعة الإعلامية</h1>
          <p className="text-gray-300">موارد العلامة التجارية والأصول الإعلامية لكار مصر</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-bold text-text mb-3 flex items-center gap-2"><FileImage className="w-5 h-5 text-orange" />نبذة عن الشركة</h2>
          <p className="text-text-light text-sm leading-relaxed">
            كار مصر (CarMasr) هي منصة رقمية مصرية متخصصة في سوق مركبات السيارات الملاكي والسيارات. تأسست عام 2023 وتخدم أكثر من 100,000 مستخدم مسجّل عبر 27 محافظة مصرية. توفر المنصة خدمات البيع والشراء والتأجير وطلبات الحمولة والتمويل وقطع الغيار وخدمات الطوارئ في قطاع السيارات.
          </p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-bold text-text mb-4">أرقام رئيسية</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[['٢٠٢٣','تأسست في'],['١٠٠,٠٠٠+','مستخدم مسجّل'],['٢٧','محافظة مغطاة'],['٥٠,٠٠٠+','إعلان نشط']].map(([v,l])=>(
              <div key={l} className="border border-border rounded-xl p-3">
                <div className="text-xl font-bold text-navy">{v}</div>
                <div className="text-xs text-text-light">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text mb-4 flex items-center gap-2"><Download className="w-5 h-5 text-orange" />تحميل أصول العلامة التجارية</h2>
          <p className="text-text-light text-sm mb-4">للحصول على الشعار الرسمي والألوان والخطوط وإرشادات الاستخدام، تواصل معنا مباشرة.</p>
          <a href="mailto:tawfiek.fayez@gmail.com" className="inline-block bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors">
            طلب أصول العلامة التجارية
          </a>
        </div>
      </div>
    </div>
  );
}
