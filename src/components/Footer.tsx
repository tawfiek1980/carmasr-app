import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, Phone, Mail, MapPin,
  Facebook, Twitter, Instagram, Linkedin, Youtube, MessageCircle, Loader2,
} from 'lucide-react';
import { getPhoneLink } from '../lib/utils';
import type { SocialLink, ContactNumber } from '../types';

// Social links و contact numbers هنجيبهم من Firestore في المستقبل
// دلوقتي هنستخدم بيانات ثابتة عشان منكسرش الـ Footer
const defaultSocialLinks: SocialLink[] = [
  { id: 'fb', name: 'فيسبوك', url: 'https://www.facebook.com/TareeqEG', icon: 'Facebook', color: '#1877F2', active: true } as any,
];
const defaultContactNumbers: ContactNumber[] = [
  { id: '1', title: 'الدعم الفني', phone: '01018870145', whatsapp: '201018870145', active: true } as any,
  { id: '2', title: 'المبيعات',    phone: '01277177710', whatsapp: '201277177710', active: true } as any,
];

const iconMap: Record<string, React.ElementType> = {
  Facebook, Twitter, Instagram, Linkedin, Youtube,
};

const footerLinks = {
  marketplace: [
    { name: 'سيارات للبيع', path: '/vehicles' },
    { name: 'سيارات', path: '/equipment' },
    { name: 'طلبات سيارات', path: '/loads' },
    { name: 'وظائف النقل', path: '/jobs' },
    { name: 'قطع الغيار', path: '/spare-parts' },
    { name: 'خدمات متخصصة', path: '/services' },
  ],
  services: [
    { name: 'التمويل', path: '/finance' },
    { name: 'طوارئ الطريق', path: '/emergency' },
    { name: 'دليل الشراء', path: '/help/buying-guide' },
    { name: 'دليل البيع', path: '/help/selling-guide' },
    { name: 'دليل التمويل', path: '/help/financing-guide' },
    { name: 'مركز المساعدة', path: '/help' },
  ],
  company: [
    { name: 'من نحن', path: '/about' },
    { name: 'رسالتنا ورؤيتنا', path: '/mission' },
    { name: 'لماذا كار مصر؟', path: '/why-carmasr' },
    { name: 'شركاؤنا', path: '/partners' },
    { name: 'انضم لفريقنا', path: '/careers' },
    { name: 'اتصل بنا', path: '/contact' },
  ],
  legal: [
    { name: 'سياسة الخصوصية', path: '/privacy-policy' },
    { name: 'شروط الاستخدام', path: '/terms' },
    { name: 'سياسة الكوكيز', path: '/cookies' },
    { name: 'إرشادات المجتمع', path: '/community-guidelines' },
    { name: 'سياسة المحتوى', path: '/content-policy' },
    { name: 'سياسة الاسترداد', path: '/refund-policy' },
  ],
};

export default function Footer() {
  const [socialLinks, setSocialLinks]       = useState<SocialLink[]>(defaultSocialLinks);
  const [contactNumbers, setContactNumbers] = useState<ContactNumber[]>(defaultContactNumbers);
  const [loading, setLoading]               = useState(false);

  useEffect(() => {
    // هنربط بـ Firestore لاحقاً لجلب روابط السوشيال وأرقام التواصل
  }, []);

  const renderSocialIcon = (iconName?: string) => {
    const Icon = iconMap[iconName || ''] || MessageCircle;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <footer className="bg-navy text-white pt-14 pb-24 sm:pb-10" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src="/app-icon-128.png" alt="كار مصر" className="h-12 w-12 object-contain" />
              <div className="flex flex-col">
                <span className="text-white font-bold text-2xl leading-none">كار مصر</span>
                <span className="text-orange text-sm font-semibold leading-none">CarMasr</span>
              </div>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-5 max-w-xs">
              أكبر سوق إلكتروني متخصص في مركبات النقل الثقيل والسيارات في مصر. نربط البائعين والمشترين وأصحاب الحمولة في بيئة آمنة وموثوقة.
            </p>
            {/* Social */}
            <div className="flex items-center gap-2 flex-wrap mb-5">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              ) : (
                socialLinks.map((link) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-orange flex items-center justify-center transition-colors"
                    title={link.name} style={{ color: link.color || 'white' }}>
                    {renderSocialIcon(link.icon)}
                  </a>
                ))
              )}
            </div>
            {/* Contact */}
            <div className="space-y-2">
              {loading ? (
                <span className="text-gray-500 text-xs">جاري التحميل…</span>
              ) : contactNumbers.slice(0, 3).map((c) => (
                <a key={c.id} href={getPhoneLink(c.phone)}
                  className="flex items-center gap-2 text-gray-400 hover:text-orange text-sm transition-colors">
                  <Phone className="w-4 h-4 text-orange flex-shrink-0" />
                  <span>{c.title}: {c.phone}</span>
                </a>
              ))}
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Mail className="w-4 h-4 text-orange flex-shrink-0" />
                <a href="mailto:tawfiek.fayez@gmail.com" className="hover:text-orange transition-colors">tawfiek.fayez@gmail.com</a>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <MapPin className="w-4 h-4 text-orange flex-shrink-0" />
                <span>القاهرة، جمهورية مصر العربية</span>
              </div>
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="font-bold text-white mb-4 text-sm">السوق</h4>
            <ul className="space-y-2">
              {footerLinks.marketplace.map((l) => (
                <li key={l.path}><Link to={l.path} className="text-gray-400 hover:text-orange text-sm transition-colors">{l.name}</Link></li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold text-white mb-4 text-sm">الخدمات</h4>
            <ul className="space-y-2">
              {footerLinks.services.map((l) => (
                <li key={l.path}><Link to={l.path} className="text-gray-400 hover:text-orange text-sm transition-colors">{l.name}</Link></li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-white mb-4 text-sm">الشركة</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((l) => (
                <li key={l.path}><Link to={l.path} className="text-gray-400 hover:text-orange text-sm transition-colors">{l.name}</Link></li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-white mb-4 text-sm">قانوني</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((l) => (
                <li key={l.path}><Link to={l.path} className="text-gray-400 hover:text-orange text-sm transition-colors">{l.name}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        {/* More legal links */}
        <div className="border-t border-white/10 pt-6 pb-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4">
            {[
              { name: 'حماية البيانات', path: '/data-protection' },
              { name: 'منع الاحتيال', path: '/fraud-prevention' },
              { name: 'سياسة الإدراج', path: '/vehicle-listing-policy' },
              { name: 'الاستخدام المقبول', path: '/acceptable-use' },
              { name: 'حذف الحساب', path: '/account-deletion-policy' },
              { name: 'الملكية الفكرية', path: '/copyright-policy' },
              { name: 'سياسة السوق', path: '/marketplace-policy' },
              { name: 'سلامة المستخدم', path: '/user-safety' },
              { name: 'نصائح الأمان', path: '/safety-tips' },
              { name: 'المجموعة الإعلامية', path: '/press' },
              { name: 'الإبلاغ عن مشكلة', path: '/report-problem' },
              { name: 'الإبلاغ عن إساءة', path: '/report-abuse' },
            ].map((l) => (
              <Link key={l.path} to={l.path} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
                {l.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-500 text-xs">© 2025 كار مصر CarMasr. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <Truck className="w-4 h-4 text-orange" />
            <span>أكبر سوق للنقل الثقيل في مصر</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
