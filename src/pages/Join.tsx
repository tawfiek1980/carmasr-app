import { Link } from 'react-router-dom';
import {
  Building2, CheckCircle, ChevronLeft, Crown, Star, Store, Package,
  Share2, Phone, ArrowLeft, MapPin, UserPlus, Camera,
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { trackEvent } from '../lib/analytics';

const steps = [
  { n: '1', title: 'أنشئ حسابك', desc: 'سجّل برقم موبايلك في أقل من دقيقة', icon: UserPlus },
  { n: '2', title: 'أنشئ معرضك', desc: 'أضف اسم معرضك وشعاره وبيانات التواصل', icon: Building2 },
  { n: '3', title: 'أضف منتجاتك', desc: 'ارفع صور سياراتك وقطع الغيار للبيع', icon: Package },
];

const benefits = [
  { icon: Building2, title: 'معرض رقمي خاص', desc: 'صفحة كاملة لمعرضك: غلاف وشعار ووصف وساعات عمل' },
  { icon: Package, title: 'عرض منتجاتك', desc: 'أضف كل سياراتك وقطع غيارك بالصور والأسعار' },
  { icon: Share2, title: 'رابط مشاركة', desc: 'شارك معرضك على واتساب وفيسبوك بضغطة واحدة' },
  { icon: Phone, title: 'اتصال مباشر', desc: 'العميل يوصلك بالهاتف أو واتساب مباشرة' },
  { icon: MapPin, title: 'ظهور حسب المحافظة', desc: 'الزوار في محافظتك يلاقوك بسهولة' },
  { icon: Star, title: 'باقات ترقي قدرها', desc: 'أساسي / متقدم / VIP ترفع ترتيب وظهور معرضك' },
];

const plans = [
  { id: 'free', name: 'مجاني', price: 0, icon: CheckCircle, badge: 'جديد', highlight: false, features: ['معرض رقمي', 'ظهور في صفحة المعارض', 'رابط مشاركة', 'بيانات التواصل', 'حتى 5 منتجات'] },
  { id: 'basic', name: 'أساسي', price: 200, icon: Store, badge: null, highlight: 'simple', features: ['كل مزايا المجاني', 'حتى 20 منتج', 'شعار المعرض', 'زر اتصال مباشر', 'زر واتساب', 'تمييز بسيط في المعارض'] },
  { id: 'premium', name: 'متقدم', price: 400, icon: Star, badge: 'الأكثر طلباً', highlight: 'strong', features: ['كل مزايا الأساسي', 'حتى 50 منتج', 'صورة غلاف للمعرض', 'روابط تواصل اجتماعي', 'تمييز واضح', 'وسام متقدم'] },
  { id: 'vip', name: 'VIP', price: 600, icon: Crown, badge: 'الأعلى قيمة', highlight: 'top', features: ['كل مزايا المتقدم', 'حتى 100 منتج', 'صورة غلاف مميزة', 'ظهور أول في الصفحة', 'وسام VIP الذهبي', 'أولوية في البحث'] },
];

export default function Join() {
  return (
    <div className="min-h-screen bg-bg">
      <SeoHead
        title="انضم إلى كار مصر - معرضك الرقمي لسيارات وقطع غيار النقل الثقيل"
        description="أنشئ معرضك المجاني على منصة كار مصر. اعرض سياراتك وقطع غيارك على آلاف العملاء في مصر. اشترك في باقة المعارض خلال دقيقة."
      />

      {/* Hero */}
      <section className="relative bg-navy overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          <img src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1600&q=80" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 py-14 sm:py-20 text-center">
          <span className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5">
            <Store className="w-3.5 h-3.5" /> منصة كار مصر للنقل الثقيل
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            معرضك الرقمي على <span className="text-orange">كار مصر</span>
          </h1>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            اعرض سياراتك وقطع غيارك وخدماتك على آلاف العملاء في مصر.
            أنشئ معرضك مجاناً في دقيقة وخلّي الناس توصلك مباشرة.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/register"
              onClick={() => trackEvent('cta_click', { cta: 'register', page: 'join', placement: 'hero' })}
              className="inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white px-8 py-3.5 rounded-2xl font-bold transition-colors">
              أنشئ معرضك مجاناً <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link to="/exhibitions"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-2xl font-bold text-sm transition-colors">
              تصفح المعارض <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-gray-400 text-xs mt-4">بدون بطاقة دفع • المعرض المجاني نشط فوراً</p>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <h2 className="text-xl sm:text-2xl font-extrabold text-navy text-center mb-8">3 خطوات وتبدأ البيع</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map(s => (
            <div key={s.n} className="bg-surface rounded-2xl border border-border p-5 text-center relative">
              <div className="w-10 h-10 rounded-xl bg-orange/10 text-orange flex items-center justify-center mx-auto mb-3">
                <s.icon className="w-5 h-5" />
              </div>
              <span className="absolute top-4 left-4 text-4xl font-black text-gray-100">{s.n}</span>
              <h3 className="font-bold text-text">{s.title}</h3>
              <p className="text-text-light text-sm mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white py-10">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy text-center mb-8">ليه تنشئ معرضك على كار مصر؟</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map(b => (
              <div key={b.title} className="bg-bg rounded-2xl border border-border p-5">
                <div className="w-11 h-11 rounded-xl bg-orange/10 text-orange flex items-center justify-center mb-3">
                  <b.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-text text-sm mb-1">{b.title}</h3>
                <p className="text-text-light text-xs leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <h2 className="text-xl sm:text-2xl font-extrabold text-navy text-center mb-2">باقات المعارض</h2>
        <p className="text-text-light text-sm text-center mb-8">ابدأ مجاناً ورقِّ لاحقاً لمزيد من الظهور</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(p => {
            const isVip = p.id === 'vip';
            const isPremium = p.id === 'premium';
            const isHighlighted = p.highlight === 'strong' || p.highlight === 'top';
            return (
            <div key={p.id} className={`relative rounded-2xl border-2 p-5 ${
              isVip
                ? 'bg-gradient-to-br from-navy to-navy-light text-white border-amber-300/60 shadow-lg shadow-amber-400/10'
                : isHighlighted ? 'bg-surface border-orange shadow-lg shadow-orange/10' : 'bg-surface border-border'
            }`}>
              {p.badge && (
                <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap ${
                  isVip ? 'bg-amber-400 text-navy' : 'bg-orange text-white'
                }`}>
                  {p.badge}
                </span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isVip ? 'bg-amber-400 text-navy' : isHighlighted ? 'bg-orange text-white' : p.id === 'free' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  <p.icon className="w-4 h-4" />
                </div>
                <p className={`font-bold ${isVip ? 'text-white' : 'text-text'}`}>{p.name}</p>
              </div>
              <p className={`font-black text-lg ${isVip ? 'text-amber-300' : isHighlighted ? 'text-orange' : p.id === 'free' ? 'text-green-600' : 'text-text'}`}>
                {p.price === 0 ? 'مجاني' : `${p.price} ج`}
                <span className="text-xs font-bold ml-1 text-text-light/70">دفعة واحدة</span>
              </p>
              <div className="space-y-1.5 mt-3">
                {p.features.map(f => (
                  <div key={f} className={`flex items-center gap-1.5 text-xs ${isVip ? 'text-gray-200' : 'text-text-light'}`}>
                    <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${isVip ? 'text-amber-300' : 'text-success'}`} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/exhibitions/subscribe"
                className={`mt-4 block text-center py-2.5 rounded-xl font-bold text-sm transition-colors ${
                  isVip
                    ? 'bg-amber-400 hover:bg-amber-300 text-navy'
                    : isHighlighted ? 'bg-orange hover:bg-orange-dark text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}>
                {isVip ? 'اختيار VIP' : isPremium ? 'اختيار المتقدم' : p.id === 'free' ? 'ابدأ مجاناً' : 'اختيار الباقة'}
              </Link>
            </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Camera className="w-10 h-10 text-orange mx-auto mb-3" />
          <h2 className="text-2xl font-extrabold text-white mb-3">جهّز معرضك وهات منتجاتك</h2>
          <p className="text-gray-300 text-sm mb-6">التسجيل مجاني ويستغرق دقيقة واحدة. بعدها تضيف منتجاتك بالصور والأسعار مباشرة.</p>
          <Link to="/register"
            onClick={() => trackEvent('cta_click', { cta: 'register', page: 'join', placement: 'bottom' })}
            className="inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white px-8 py-3.5 rounded-2xl font-bold transition-colors">
            ابدأ الآن مجاناً <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
