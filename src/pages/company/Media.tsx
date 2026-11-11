import { Newspaper, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
const news = [
  { date: 'يناير 2025', title: 'كار مصر تتجاوز حاجز 100,000 مستخدم مسجّل', source: 'مصراوي' },
  { date: 'نوفمبر 2024', title: 'كار مصر تطلق خدمة طلبات التمويل للمركبات الثقيلة', source: 'البورصة نيوز' },
  { date: 'سبتمبر 2024', title: 'منصة كار مصر تغطي 27 محافظة مصرية بالكامل', source: 'الشرق' },
];
export default function Media() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الإعلام</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <Newspaper className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">كار مصر في الإعلام</h1>
          </div>
          <p className="text-gray-300">آخر الأخبار والتغطيات الإعلامية عن كار مصر</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-4 mb-10">
          {news.map((n) => (
            <div key={n.title} className="bg-surface rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3 text-xs text-text-light mb-2">
                <span className="bg-orange/10 text-orange px-2 py-0.5 rounded-full font-semibold">{n.source}</span>
                <span>{n.date}</span>
              </div>
              <h3 className="font-bold text-text">{n.title}</h3>
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <h2 className="font-bold text-text mb-2">استفسارات الإعلام</h2>
          <p className="text-text-light text-sm mb-4">للتواصل مع فريق العلاقات الإعلامية في كار مصر</p>
          <a href="mailto:tawfiek.fayez@gmail.com" className="text-orange hover:underline font-semibold">tawfiek.fayez@gmail.com</a>
        </div>
      </div>
    </div>
  );
}
