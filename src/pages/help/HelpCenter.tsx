import { HelpCircle, Search, Truck, CreditCard, Shield, Settings, ChevronLeft, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { getWhatsAppLink } from '../../lib/utils';

const categories = [
  { icon: Truck, title: 'الإعلانات والمركبات', desc: 'كيفية نشر وإدارة إعلاناتك', path: '/help/posting-guide' },
  { icon: CreditCard, title: 'التمويل', desc: 'أسئلة حول خدمات التمويل', path: '/help/financing-guide' },
  { icon: Shield, title: 'الأمان والخصوصية', desc: 'حماية حسابك وبياناتك', path: '/privacy-policy' },
  { icon: Settings, title: 'إعدادات الحساب', desc: 'إدارة حسابك وتفضيلاتك', path: '/settings' },
];

const popular = [
  { q: 'كيف أنشر إعلاناً؟', path: '/help/posting-guide' },
  { q: 'كيف أتقدم لطلب تمويل؟', path: '/help/financing-guide' },
  { q: 'كيف أتحقق من صحة الإعلان؟', path: '/help/buying-guide' },
  { q: 'كيف أحذف حسابي؟', path: '/delete-account' },
  { q: 'كيف أبلّغ عن إعلان مخالف؟', path: '/report-abuse' },
];

export default function HelpCenter() {
  const [search, setSearch] = useState('');
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <HelpCircle className="w-14 h-14 text-orange mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">مركز المساعدة</h1>
          <p className="text-gray-300 mb-8">كيف يمكننا مساعدتك اليوم؟</p>
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن إجابتك..."
              className="w-full bg-white text-text pr-12 pl-4 py-3.5 rounded-xl text-sm focus:outline-none"
            />
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="font-bold text-text text-lg mb-5">تصفح حسب الموضوع</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {categories.map((c) => (
            <Link key={c.title} to={c.path} className="bg-surface rounded-2xl border border-border p-5 flex items-start gap-4 hover:border-orange transition-colors card-hover">
              <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center flex-shrink-0">
                <c.icon className="w-5 h-5 text-orange" />
              </div>
              <div>
                <h3 className="font-bold text-text">{c.title}</h3>
                <p className="text-text-light text-sm">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-bold text-text mb-4">الأسئلة الأكثر شيوعاً</h2>
          <ul className="space-y-2">
            {popular.map((p) => (
              <li key={p.q}>
                <Link to={p.path} className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:text-orange transition-colors text-sm text-text">
                  <span>{p.q}</span>
                  <ChevronLeft className="w-4 h-4 rtl-flip text-text-light" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-navy text-white rounded-2xl p-6 text-center">
          <h2 className="font-bold text-lg mb-2">لم تجد إجابتك؟</h2>
          <p className="text-gray-300 text-sm mb-4">فريق الدعم متاح للمساعدة</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/support" className="bg-orange hover:bg-orange-dark px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">تواصل مع الدعم</Link>
            <a
              href={getWhatsAppLink('01018870145', 'السلام عليكم، أحتاج مساعدة في تطبيق كار مصر')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1eb958] px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              احصل على دعم فوري
            </a>
            <Link to="/faq" className="border border-white/30 hover:border-orange px-6 py-2.5 rounded-xl text-sm transition-colors">الأسئلة الشائعة</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
