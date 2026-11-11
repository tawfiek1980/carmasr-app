import { Link } from 'react-router-dom';
import {
  Truck, Gauge, Package, Briefcase, Wrench, DollarSign, Siren,
  Store, ShoppingBag, Shield, Search, UserPlus, Smartphone, User,
  Rocket, CheckCircle, ArrowLeft, ChevronLeft, Heart, MapPin, Phone,
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { trackEvent } from '../lib/analytics';

const registerSteps = [
  { n: '1', title: 'اضغط إنشاء حساب', desc: 'من الهيدر أو صفحة التسجيل', icon: UserPlus },
  { n: '2', title: 'سجّل برقم موبايلك', desc: 'أو بحساب جوجل — من غير أوراق', icon: Smartphone },
  { n: '3', title: 'كمّل بياناتك', desc: 'الاسم والمحافظة ورقم التواصل', icon: User },
  { n: '4', title: 'ابدأ فوراً', desc: 'أضف إعلانك أو تصفح وتواصل', icon: Rocket },
];

const benefits = [
  { icon: CheckCircle, title: 'تسجيل ونشر مجاني', desc: 'اعمل حساب ونشر الإعلانات الأساسية من غير أي رسوم' },
  { icon: Phone, title: 'تواصل مباشر', desc: 'كلم البائع على التليفون أو واتساب على طول — من غير وسيط' },
  { icon: Search, title: 'بحث وتصفية متقدم', desc: 'فلتر حسب الفئة والمحافظة والسعر وسنة الصنع' },
  { icon: Heart, title: 'مفضلة وإشعارات', desc: 'احفظ اللي يعجبك واعرف فوراً لما إعلان جديد ينزل' },
  { icon: Shield, title: 'أمان وثقة', desc: 'سياسات واضحة ضد الاحتيال وإرشادات للشراء الآمن' },
  { icon: MapPin, title: 'مصري 100%', desc: 'مبني لسوق السيارات الملاكي في كل محافظات مصر' },
];

const services = [
  { name: 'سيارات', desc: 'بيع وإيجار السيارات والمركبات الثقيلة', path: '/vehicles', icon: Truck },
  { name: 'سيارات', desc: 'لوادر، حفارات، أوناش وكل السيارات', path: '/equipment', icon: Wrench },
  { name: 'قطع غيار', desc: 'قطع أصلية للسيارات والسيارات', path: '/spare-parts', icon: Gauge },
  { name: 'سيارات', desc: 'إعلانات حمولة وشحن من وإلى كل المحافظات', path: '/loads', icon: Package },
  { name: 'وظائف النقل', desc: 'سواقين وميكانيكية وفرص عمل بالمجال', path: '/jobs', icon: Briefcase },
  { name: 'خدمات الصيانة', desc: 'صيانة، تأمين، فحص قبل الشراء، تخلصيات', path: '/services', icon: Wrench },
  { name: 'تمويل', desc: 'تمويل شراء السيارات والسيارات', path: '/finance', icon: DollarSign },
  { name: 'طوارئ الطريق', desc: 'أعطال وحوادث — مساعدة على الطريق', path: '/emergency', icon: Siren },
  { name: 'معارض تجارية', desc: 'معارض رقمية لأصحاب السيارات والورش', path: '/exhibitions', icon: Store },
  { name: 'منتجات المعارض', desc: 'سيارات وقطع غيار من كل المعارض', path: '/products', icon: ShoppingBag },
];

export default function PlatformLanding() {
  return (
    <div className="min-h-screen bg-bg">
      <SeoHead
        title="كار مصر CarMasr - سوق السيارات الملاكي في مصر | سجّل مجاناً"
        description="كار مصر أكبر سوق إلكتروني للنقل الثقيل في مصر. سيارات، سيارات، قطع غيار، سيارات، وظائف، تمويل وخدمات طوارئ. سجّل مجاناً وابدأ في دقيقة."
      />

      {/* Hero */}
      <section className="relative bg-navy overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img src="https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1600&q=80" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 py-14 sm:py-20 text-center">
          <span className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5">
            <Truck className="w-3.5 h-3.5" /> أول سوق إلكتروني للنقل الثقيل في مصر
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            كل حاجة للنقل الثقيل في <span className="text-orange">مكان واحد</span>
          </h1>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            سيارات وسيارات وقطع غيار وسيارات ووظائف وتمويل وطوارئ.
            سجّل مجاناً في دقيقة وابدأ تشتري وتبيع وتتواصل مباشرة مع السوق كله.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/register"
              onClick={() => trackEvent('cta_click', { cta: 'register', page: 'platform', placement: 'hero' })}
              className="inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white px-8 py-3.5 rounded-2xl font-bold transition-colors">
              سجّل مجاناً <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link to="/vehicles"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-2xl font-bold text-sm transition-colors">
              تصفح الأقسام <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
          <p className="text-gray-400 text-xs mt-4">بدون بطاقة دفع • الإعلانات الأساسية مجانية</p>
        </div>
      </section>

      {/* Register steps */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <h2 className="text-xl sm:text-2xl font-extrabold text-navy text-center mb-8">إزاي تسجّل؟</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {registerSteps.map(s => (
            <div key={s.n} className="bg-surface rounded-2xl border border-border p-5 text-center relative">
              <div className="w-10 h-10 rounded-xl bg-orange/10 text-orange flex items-center justify-center mx-auto mb-3">
                <s.icon className="w-5 h-5" />
              </div>
              <span className="absolute top-4 left-4 text-4xl font-black text-gray-100">{s.n}</span>
              <h3 className="font-bold text-text text-sm">{s.title}</h3>
              <p className="text-text-light text-xs mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits for customers */}
      <section className="bg-white py-10">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy text-center mb-2">مميزات هتحصل عليها كعميل</h2>
          <p className="text-text-light text-sm text-center mb-8">كل حاجة معمولة تريّحك وتوفّر عليك</p>
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

      {/* Services */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-xl sm:text-2xl font-extrabold text-navy text-center mb-2">الخدمات المتوفرة على التطبيق</h2>
        <p className="text-text-light text-sm text-center mb-8">عشر أقسام كاملة تغطي كل احتياجات مجال السيارات الملاكي</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map(s => (
            <Link key={s.name} to={s.path}
              className="group bg-surface rounded-2xl border border-border p-4 flex items-start gap-3 hover:border-orange hover:shadow-lg transition-all">
              <div className="w-11 h-11 rounded-xl bg-orange/10 text-orange flex items-center justify-center flex-shrink-0 group-hover:bg-orange group-hover:text-white transition-colors">
                <s.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-text text-sm flex items-center gap-1">
                  {s.name}
                  <ArrowLeft className="w-3.5 h-3.5 text-gray-300 group-hover:text-orange transition-colors" />
                </h3>
                <p className="text-text-light text-xs mt-0.5">{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Free exhibition strip */}
      <section className="max-w-4xl mx-auto px-4 pb-10">
        <div className="bg-gradient-to-l from-orange to-orange-dark rounded-2xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Store className="w-7 h-7" />
          </div>
          <div className="flex-1 text-center sm:text-right">
            <h3 className="text-lg font-extrabold mb-1">عندك معرض سيارات أو ورشة؟ اعمل معرضك الرقمي مجاناً</h3>
            <p className="text-white/90 text-sm">عرض سياراتك وقطع غيارك على آلاف العملاء — الباقة المجانية متاحة دائماً.</p>
          </div>
          <Link to="/exhibitions/subscribe"
            className="flex-shrink-0 bg-white text-orange px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-bg transition-colors">
            أنشئ معرضك مجاناً
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-navy py-10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Rocket className="w-10 h-10 text-orange mx-auto mb-3" />
          <h2 className="text-2xl font-extrabold text-white mb-3">جاهز تبدأ؟</h2>
          <p className="text-gray-300 text-sm mb-6">التسجيل مجاني وياخد دقيقة واحدة بس.</p>
          <Link to="/register"
            onClick={() => trackEvent('cta_click', { cta: 'register', page: 'platform', placement: 'bottom' })}
            className="inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white px-8 py-3.5 rounded-2xl font-bold transition-colors">
            أنشئ حسابك الآن <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
