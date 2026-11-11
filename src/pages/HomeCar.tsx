import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, User, Sun, Moon, ChevronLeft, ChevronDown, Menu, X,
  Car, Sparkles, Zap, Wrench, ShieldCheck, Scale, Gauge, Tag, Building2,
  Siren, Star, Calendar, Landmark, MapPin, Fuel, Settings2, BadgeCheck, Phone,
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import OptimizedImage from '../components/OptimizedImage';
import { listingsService } from '../lib/firestoreService';
import { formatPrice, listingUrl } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { trackEvent } from '../lib/analytics';
import type { Listing } from '../types';

/* ────────────────────────── Data ────────────────────────── */
const EGYPT_GOV = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية',
  'المنوفية', 'الغربية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد',
  'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'الفيوم', 'بني سويف',
  'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر',
  'مطروح', 'الوادي الجديد',
];

const BRANDS = [
  'Toyota', 'Nissan', 'Hyundai', 'Kia', 'MG', 'Chevrolet', 'Ford', 'Mitsubishi',
  'Mercedes', 'BMW', 'Volkswagen', 'Renault', 'Peugeot', 'Mazda', 'Honda',
  'Jeep', 'Land Rover', 'Audi', 'Skoda', 'Chery', 'Geely', 'BYD', 'Haval',
];

const BRAND_LOGOS: { name: string; slug: string | null; domain: string | null }[] = [
  { name: 'Toyota', slug: 'toyota', domain: null },
  { name: 'Nissan', slug: 'nissan', domain: null },
  { name: 'Hyundai', slug: 'hyundai', domain: null },
  { name: 'Kia', slug: 'kia', domain: null },
  { name: 'Chevrolet', slug: 'chevrolet', domain: null },
  { name: 'Ford', slug: 'ford', domain: null },
  { name: 'Mitsubishi', slug: 'mitsubishi', domain: null },
  { name: 'Mercedes', slug: null, domain: 'mercedes-benz.com' },
  { name: 'BMW', slug: 'bmw', domain: null },
  { name: 'Volkswagen', slug: 'volkswagen', domain: null },
  { name: 'Renault', slug: 'renault', domain: null },
  { name: 'Peugeot', slug: 'peugeot', domain: null },
  { name: 'Mazda', slug: 'mazda', domain: null },
  { name: 'Honda', slug: 'honda', domain: null },
  { name: 'MG', slug: 'mg', domain: null },
  { name: 'Jeep', slug: 'jeep', domain: null },
  { name: 'Audi', slug: 'audi', domain: null },
  { name: 'Chery', slug: null, domain: 'cheryauto.com' },
  { name: 'Skoda', slug: 'skoda', domain: null },
  { name: 'BYD', slug: null, domain: 'byd.com' },
  { name: 'Haval', slug: null, domain: 'haval-global.com' },
  { name: 'Geely', slug: null, domain: 'geely.com' },
  { name: 'Land Rover', slug: null, domain: 'landrover.com' },
];

function optimizeImage(src: string, _size?: string) { return src; }

/* ────────────────────────── Header ────────────────────────── */
function HomeHeader() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { to: '/listings', label: 'كل السيارات' },
    { to: '/listings?condition=new', label: 'جديد' },
    { to: '/listings?condition=used', label: 'مستعمل' },
    { to: '/listings?listingType=rent', label: 'إيجار' },
    { to: '/prices', label: 'الأسعار' },
    { to: '/services', label: 'الخدمات' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-border">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between h-[68px] px-4 sm:px-6 gap-3">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-bg border border-border text-text"
            onClick={() => setOpen(v => !v)}
            aria-label="القائمة"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/app-icon-128.png" alt="كار مصر" className="h-10 w-10 rounded-xl object-cover logo-gloss" />
            <span className="text-text font-extrabold text-lg sm:text-xl leading-none">كار مصر</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(l => (
            <Link key={l.label} to={l.to} className="px-3 py-2 rounded-lg text-sm font-semibold text-text-muted hover:text-orange hover:bg-orange/5 transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/listings"
            className="hidden sm:flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text-muted hover:border-orange/50 transition-colors"
          >
            <Search className="w-4 h-4 text-orange" />
            <span>بحث</span>
          </Link>
          <Link
            to="/post-listing"
            onClick={() => trackEvent('cta_add_listing', { source: 'home_header' })}
            className="flex items-center gap-1.5 bg-orange hover:bg-orange-600 text-white px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm shadow-orange/30 transition-colors btn-press"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>بيع عربيتك</span>
          </Link>
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-bg border border-border text-text hover:bg-orange hover:text-white transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={isDark ? 'sun' : 'moon'} initial={{ rotate: -90, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.6 }} transition={{ duration: 0.2 }} className="flex items-center justify-center">
                {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </motion.span>
            </AnimatePresence>
          </button>
          {user ? (
            <Link to="/profile" className="flex items-center justify-center w-10 h-10 rounded-xl bg-bg border border-border text-text hover:bg-orange hover:text-white transition-colors overflow-hidden" title={user.name}>
              {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
            </Link>
          ) : (
            <Link to="/login" className="hidden sm:flex items-center gap-1.5 text-text font-semibold text-sm px-2 py-2 hover:text-orange">
              <User className="w-4 h-4" /> دخول
            </Link>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden border-t border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 flex flex-col gap-1">
              {navLinks.map(l => (
                <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-text hover:bg-orange/5 hover:text-orange">
                  {l.label}
                </Link>
              ))}
              {!user && <Link to="/login" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-text hover:bg-orange/5 hover:text-orange">تسجيل الدخول</Link>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ────────────────────────── Hero Search ────────────────────────── */
function HeroSearch() {
  const navigate = useNavigate();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [gov, setGov] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (brand) params.set('brand', brand);
    if (model.trim()) params.set('model', model.trim());
    if (gov) params.set('governorate', gov);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    trackEvent('home_search', { brand, model, gov });
    navigate(`/listings?${params.toString()}`);
  };

  const quick = [
    { label: 'مستعملة', to: '/listings?condition=used' },
    { label: 'جديدة', to: '/listings?condition=new' },
    { label: 'للإيجار', to: '/listings?listingType=rent' },
    { label: 'كهربائية', to: '/listings?q=electric' },
    { label: 'قطع غيار', to: '/spare-parts' },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#07172d] via-[#0b2748] to-[#123a63] text-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-orange/30 blur-3xl" />
        <div className="absolute -bottom-20 left-0 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl" />
      </div>
      <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-8 sm:pb-10">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-orange" /> سوق السيارات في مصر
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
            اشترِ وبيع عربيتك بسهولة
            <span className="block text-orange mt-1">ابحث، قارن، واختر أفضل سعر</span>
          </h1>
          <p className="mt-3 text-white/80 text-sm sm:text-base max-w-2xl">
            آلاف الإعلانات الموثوقة — جديد ومستعمل وإيجار وقطع غيار — في كل المحافظات.
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 bg-white rounded-2xl shadow-2xl p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            <div className="relative">
              <select value={brand} onChange={e => setBrand(e.target.value)} className="w-full appearance-none bg-bg text-text rounded-xl px-3 py-3 text-sm border border-border focus:outline-none focus:border-orange pr-8">
                <option value="">الماركة</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <input value={model} onChange={e => setModel(e.target.value)} placeholder="الموديل (مثال: Corolla)" className="bg-bg text-text rounded-xl px-3 py-3 text-sm border border-border focus:outline-none focus:border-orange" />
            <div className="relative">
              <select value={gov} onChange={e => setGov(e.target.value)} className="w-full appearance-none bg-bg text-text rounded-xl px-3 py-3 text-sm border border-border focus:outline-none focus:border-orange pr-8">
                <option value="">المحافظة</option>
                {EGYPT_GOV.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <input type="number" inputMode="numeric" placeholder="أقل سعر" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="bg-bg text-text rounded-xl px-3 py-3 text-sm border border-border focus:outline-none focus:border-orange" />
            <input type="number" inputMode="numeric" placeholder="أعلى سعر" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="bg-bg text-text rounded-xl px-3 py-3 text-sm border border-border focus:outline-none focus:border-orange" />
            <button type="submit" className="bg-orange hover:bg-orange-600 text-white rounded-xl px-4 py-3 text-sm font-extrabold flex items-center justify-center gap-2 transition-colors btn-press shadow-md shadow-orange/30">
              <Search className="w-4 h-4" /> ابحث الآن
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-text-muted">بحث سريع:</span>
            {quick.map(q => (
              <Link key={q.label} to={q.to} className="text-xs font-bold text-orange bg-orange/10 hover:bg-orange/20 px-3 py-1.5 rounded-full transition-colors">
                {q.label}
              </Link>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}

/* ────────────────────────── ليه كار مصر ────────────────────────── */
function WhyCarMasr() {
  const items = [
    { icon: Search, title: 'بحث سهل وسريع', desc: 'فلتر بالماركة والموديل والسعر والمحافظة للوصول لعربيتك بسرعة.' },
    { icon: BadgeCheck, title: 'إعلانات مباشرة', desc: 'تواصل مباشر مع البائع أو المعلن بدون وسطاء.' },
    { icon: Scale, title: 'أدوات تساعدك تقرر', desc: 'قارن، قيّم، وتابع أسعار السوق قبل الشراء.' },
    { icon: ShieldCheck, title: 'نصائح وفحص', desc: 'إرشادات فحص وخدمات مساعدة لاتخاذ قرار أوضح.' },
    { icon: Tag, title: 'تنوع في الأسعار', desc: 'جديد ومستعمل وإيجار وقطع غيار — اختيارات تناسب ميزانيتك.' },
    { icon: Plus, title: 'بيع مجاني وبسيط', desc: 'أضف إعلانك في دقائق ووصّل لمشترين مهتمين.' },
  ];
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-text">ليه كار مصر؟</h2>
        <p className="text-text-muted mt-1 text-sm sm:text-base">تجربة أبسط لبيع وشراء السيارات في مصر</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.title} className="bg-surface border border-border rounded-2xl p-4 flex gap-3 items-start hover:border-orange/40 transition-colors">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-orange/10 flex items-center justify-center">
              <it.icon className="w-5 h-5 text-orange" />
            </div>
            <div>
              <p className="font-extrabold text-text text-sm sm:text-base">{it.title}</p>
              <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────── ازاي تشتري/تبيع ────────────────────────── */
function HowItWorks() {
  const stepsBuy = [
    { n: '1', title: 'ابحث عن العربية المناسبة', desc: 'استخدم الفلاتر أو تصفح حسب الماركة والفئة والسعر.' },
    { n: '2', title: 'قارن وتواصل', desc: 'راجع التفاصيل والصور، قارن الأسعار، وتواصل مع المعلن مباشرة.' },
    { n: '3', title: 'اتفق وأتمم الشراء', desc: 'عاين العربية، اتفق على السعر، وأكمل الإجراءات بينكما بكل وضوح.' },
  ];
  const stepsSell = [
    { n: '1', title: 'أضف إعلانك مجانًا', desc: 'سجّل تفاصيل العربية والصور والسعر في دقائق.' },
    { n: '2', title: 'استقبل اهتمام المشترين', desc: 'إعلانك يظهر للباحثين في محافظتك وحسب الماركة.' },
    { n: '3', title: 'تواصل وأكمل البيع', desc: 'رد على الاستفسارات واتفق مع المشتري المناسب.' },
  ];
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-text">ازاي تشتري أو تبيع على كار مصر؟</h2>
        <p className="text-text-muted mt-1 text-sm sm:text-base">خطوات بسيطة وواضحة</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-text text-lg">شراء عربية</h3>
            <Link to="/listings" className="text-orange text-sm font-bold hover:underline">تصفح العربيات</Link>
          </div>
          <div className="space-y-4">
            {stepsBuy.map(s => (
              <div key={s.n} className="flex gap-3 items-start">
                <div className="w-8 h-8 shrink-0 rounded-full bg-orange text-white font-extrabold flex items-center justify-center text-sm">{s.n}</div>
                <div>
                  <p className="font-bold text-text text-sm sm:text-base">{s.title}</p>
                  <p className="text-xs sm:text-sm text-text-muted mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-text text-lg">بيع عربيتك</h3>
            <Link to="/post-listing" className="text-orange text-sm font-bold hover:underline">أضف إعلانك</Link>
          </div>
          <div className="space-y-4">
            {stepsSell.map(s => (
              <div key={s.n} className="flex gap-3 items-start">
                <div className="w-8 h-8 shrink-0 rounded-full bg-[#0B1E3A] text-white font-extrabold flex items-center justify-center text-sm">{s.n}</div>
                <div>
                  <p className="font-bold text-text text-sm sm:text-base">{s.title}</p>
                  <p className="text-xs sm:text-sm text-text-muted mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Brand strip ────────────────────────── */
function BrandStrip() {
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-extrabold text-text">تسوّق حسب الماركة</h2>
        <Link to="/listings" className="text-orange text-sm font-bold flex items-center gap-1 hover:underline">عرض الكل <ChevronLeft className="w-4 h-4" /></Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2.5">
        {BRAND_LOGOS.map((b) => {
          const src = b.slug ? `https://cdn.simpleicons.org/${b.slug}` : b.domain ? `https://www.google.com/s2/favicons?domain=${b.domain}&sz=64` : null;
          return (
            <Link key={b.name} to={`/brand/${encodeURIComponent(b.name)}`} onClick={() => trackEvent('brand_click', { brand: b.name })} className="group flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-surface border border-border hover:border-orange/50 hover:shadow-md transition-all btn-press">
              <div className="w-10 h-10 rounded-lg bg-bg flex items-center justify-center overflow-hidden">
                {src ? (
                  <img src={src} alt="" loading="lazy" className="w-7 h-7 object-contain" onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; const p = t.parentElement; if (p && !p.querySelector('.bf')) { const s = document.createElement('span'); s.className = 'bf text-orange font-extrabold text-[10px]'; s.textContent = b.name.slice(0, 3); p.appendChild(s); } }} />
                ) : <span className="text-orange font-extrabold text-[10px]">{b.name.slice(0, 3)}</span>}
              </div>
              <span className="text-[11px] font-semibold text-text group-hover:text-orange transition-colors text-center leading-tight">{b.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ────────────────────────── المزيد على كار مصر ────────────────────────── */
function MoreOnCarMasr() {
  const items = [
    {
      to: '/prices/new',
      title: 'أسعار السيارات الجديدة',
      desc: 'اكتشف أحدث الأسعار للسيارات الجديدة.',
      icon: Tag,
      bg: 'from-orange/15 to-amber-100 dark:from-orange/20 dark:to-amber-900/20',
    },
    {
      to: '/prices/used',
      title: 'أسعار السيارات المستعملة',
      desc: 'احصل على أفضل العروض على السيارات المستعملة الموثوقة',
      icon: Car,
      bg: 'from-sky-100 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/20',
    },
    {
      to: '/compare',
      title: 'مقارنة السيارات',
      desc: 'محتار بين عربيتين؟ قارن بينهم وخد القرار الصح',
      icon: Scale,
      bg: 'from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/20',
    },
    {
      to: '/my-maintenance',
      title: 'الصيانة الخاصة بي',
      desc: 'إدارة وتتبع صيانة سيارتك',
      icon: Wrench,
      bg: 'from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/20',
    },
    {
      to: '/finance',
      title: 'تمويل السيارات',
      desc: 'احصل على تمويل مريح بموافقة سريعة',
      icon: Landmark,
      bg: 'from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20',
    },
    {
      to: '/electric-cars',
      title: 'سيارات كهربائية',
      desc: 'استكشف أفضل السيارات الكهربائية، واعثر على محطات الشحن، واكتشف مقدار ما يمكنك توفيره.',
      icon: Zap,
      bg: 'from-cyan-100 to-sky-100 dark:from-cyan-900/30 dark:to-sky-900/20',
    },
    {
      to: '/rent-cars',
      title: 'سيارات للإيجار',
      desc: 'تصفح سيارات للإيجار، قارن الأسعار، واحجز رحلتك القادمة',
      icon: Calendar,
      bg: 'from-rose-100 to-orange-100 dark:from-rose-900/30 dark:to-orange-900/20',
      badge: 'جديد',
    },
  ];

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-extrabold text-text">المزيد على كار مصر</h2>
        <Link to="/services" className="text-orange text-sm font-bold flex items-center gap-1 hover:underline">كل الخدمات <ChevronLeft className="w-4 h-4" /></Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((it) => (
          <Link
            key={it.title}
            to={it.to}
            className="group bg-surface border border-border rounded-2xl overflow-hidden hover:border-orange/50 hover:shadow-lg transition-all btn-press flex flex-col"
          >
            <div className={`relative h-36 bg-gradient-to-br ${it.bg} flex items-center justify-center overflow-hidden`}>
              <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/30 dark:bg-white/5 blur-1xl" />
              <div className="w-16 h-16 rounded-2xl bg-white/70 dark:bg-black/20 backdrop-blur flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <it.icon className="w-8 h-8 text-orange" />
              </div>
              {it.badge && (
                <span className="absolute top-3 left-3 bg-orange text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow">
                  {it.badge}
                </span>
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-extrabold text-text text-[15px] leading-snug">{it.title}</h3>
              <p className="mt-1.5 text-sm text-text-muted leading-relaxed">{it.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────── Car Card & اكتشف السيارات ────────────────────────── */
function CarCard({ listing }: { listing: Listing }) {
  const img = listing.images?.[0];
  const km = (listing as any).mileage ?? (listing as any).kilometers;
  const title = [listing.brand, listing.model].filter(Boolean).join(' ') || listing.title;
  const subtitle = [listing.title && title !== listing.title ? listing.title : null, listing.year ? String(listing.year) : null, (listing as any).trim].filter(Boolean).join(' • ');
  return (
    <Link to={listingUrl(listing.id, listing.slug)} className="group bg-surface border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:border-orange/40 transition-all btn-press flex flex-col">
      <div className="relative aspect-[4/3] bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
        {img ? (
          <OptimizedImage src={optimizeImage(img, 'large')} alt={title} className="w-full h-full object-contain p-2 sm:p-3 group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-text-muted gap-2">
            <Car className="w-16 h-16 opacity-40" />
            <span className="text-xs font-semibold">صورة السيارة</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-start">
          {listing.featured && <span className="bg-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow"><Star className="w-3 h-3" /> مميز</span>}
          {listing.condition && <span className="bg-white/95 text-[#0B1E3A] text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">{listing.condition === 'new' ? 'جديدة' : 'مستعملة'}</span>}
          {listing.listingType === 'rent' && <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">إيجار</span>}
        </div>
      </div>
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 text-center sm:text-right">
        <h3 className="font-extrabold text-text text-base sm:text-lg line-clamp-1 leading-snug">{title}</h3>
        {subtitle && <p className="mt-1 text-xs sm:text-sm text-text-muted line-clamp-1">{subtitle}</p>}
        <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-[11px] text-text-muted">
          {listing.year && <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{listing.year}</span>}
          {km != null && km !== '' && <span className="inline-flex items-center gap-1"><Settings2 className="w-3.5 h-3.5" />{Number(km).toLocaleString('ar-EG')} كم</span>}
          {listing.governorate && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{listing.governorate}</span>}
        </div>
        <div className="mt-auto pt-3">
          <span className="block text-orange font-extrabold text-xl sm:text-2xl leading-none">
            {listing.priceType === 'call' ? 'اتصل للسعر' : formatPrice(listing.price)}
          </span>
          {listing.listingType === 'rent' && listing.priceType !== 'call' && <span className="text-[10px] text-text-muted font-semibold">/ للفترة</span>}
        </div>
      </div>
    </Link>
  );
}

const NEW_CAR_SHOWCASE = [
  { brand: 'Kia', model: 'Sportage', variant: 'Kia Sportage 2025', price: '1,700,000 جنيه', image: 'https://images.unsplash.com/photo-1619682817481-e994891cd1f5?auto=format&fit=crop&w=800&q=60' },
  { brand: 'Mercedes', model: 'C180', variant: 'Mercedes C180 2026', price: '6,000,000 جنيه', image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=60' },
  { brand: 'BMW', model: 'X6', variant: 'BMW X6 2025 / M60i xDrive', price: '9,200,000 جنيه', image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=60' },
  { brand: 'Hyundai', model: 'Elantra CN7', variant: 'Hyundai Elantra CN7 2025', price: '1,600,000 جنيه', image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=60' },
  { brand: 'Hyundai', model: 'Ioniq 6', variant: 'Hyundai Ioniq 6 2025', price: '2,300,000 جنيه', image: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=60' },
  { brand: 'Hyundai', model: 'Santa Fe', variant: 'Hyundai Santa Fe 2025', price: '3,000,000 جنيه', image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=60' },
  { brand: 'MG', model: '4 EV', variant: 'MG 4 EV 2025', price: '1,400,000 جنيه', image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=800&q=60' },
  { brand: 'MG', model: 'ZS', variant: 'MG ZS 2025', price: '1,049,990 جنيه', image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=60' },
];

function ShowcaseCard({ car }: { car: typeof NEW_CAR_SHOWCASE[number] }) {
  return (
    <Link to={`/listings?brand=${encodeURIComponent(car.brand)}&model=${encodeURIComponent(car.model)}`} className="group bg-surface border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:border-orange/40 transition-all btn-press flex flex-col">
      <div className="relative aspect-[4/3] bg-gradient-to-b from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
        <img src={car.image} alt={car.variant} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <span className="absolute top-2 right-2 bg-white/95 text-[#0B1E3A] text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">جديدة</span>
      </div>
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 text-center sm:text-right">
        <h3 className="font-extrabold text-text text-base sm:text-lg line-clamp-1 leading-snug">{car.model}</h3>
        <p className="mt-1 text-xs sm:text-sm text-text-muted line-clamp-1">{car.variant}</p>
        <div className="mt-auto pt-3">
          <span className="block text-orange font-extrabold text-xl sm:text-2xl leading-none">{car.price}</span>
        </div>
      </div>
    </Link>
  );
}

type Tab = 'all' | 'used' | 'new' | 'rent';

function DiscoverCars() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await listingsService.getAll({ status: 'active' });
        if (!mounted) return;
        setItems((all || []).slice(0, 40));
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'used') return items.filter(l => l.condition === 'used' || (!l.condition && l.listingType !== 'rent'));
    if (tab === 'new') return items.filter(l => l.condition === 'new');
    if (tab === 'rent') return items.filter(l => l.listingType === 'rent');
    return items;
  }, [items, tab]);

  const show = filtered.slice(0, 12);
  const tabs: { id: Tab; label: string; to: string }[] = [
    { id: 'all', label: 'الكل', to: '/listings' },
    { id: 'used', label: 'مستعمل', to: '/listings?condition=used' },
    { id: 'new', label: 'جديد', to: '/listings?condition=new' },
    { id: 'rent', label: 'إيجار', to: '/listings?listingType=rent' },
  ];

  const showShowcase = tab === 'new' || (tab === 'all' && show.length < 4);

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-xl font-extrabold text-text">اكتشف السيارات</h2>
          <Link to={tabs.find(t => t.id === tab)?.to || '/listings'} className="text-orange text-sm font-bold flex items-center gap-1 hover:underline">عرض الكل <ChevronLeft className="w-4 h-4" /></Link>
        </div>
        <div className="flex items-center gap-1.5 bg-surface border border-border rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${tab === t.id ? 'bg-orange text-white shadow-sm' : 'text-text-muted hover:text-text'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[280px] rounded-2xl bg-surface border border-border animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {show.length > 0 && (
            <div>
              {showShowcase && <h3 className="text-base font-extrabold text-text mb-3">إعلانات مميزة من المستخدمين</h3>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {show.map((l) => <CarCard key={l.id} listing={l} />)}
              </div>
            </div>
          )}
          {showShowcase && (
            <div>
              <h3 className="text-base font-extrabold text-text mb-3">اكتشف السيارات الجديدة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {NEW_CAR_SHOWCASE.map((car) => <ShowcaseCard key={car.variant} car={car} />)}
              </div>
            </div>
          )}
          {!show.length && !showShowcase && (
            <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-muted">
              <Car className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="font-semibold">لا توجد إعلانات في هذا القسم الآن</p>
              <Link to="/post-listing" className="inline-block mt-3 text-orange font-bold hover:underline">أضف أول إعلان ←</Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ────────────────────────── CTA + App ────────────────────────── */
function SellCta() {
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-orange-600 via-orange to-amber-500 text-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="max-w-xl">
          <h3 className="text-xl sm:text-2xl font-extrabold">هتبيع عربيتك؟ اعرضها على كار مصر</h3>
          <p className="text-white/90 mt-1.5 text-sm sm:text-base">أضف إعلانك مجانًا في دقائق ووصّل لآلاف المشترين المهتمين في محافظتك.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><BadgeCheck className="w-3.5 h-3.5" />نشر سريع</span>
            <span className="inline-flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><BadgeCheck className="w-3.5 h-3.5" />وصول لمشترين حقيقيين</span>
            <span className="inline-flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><BadgeCheck className="w-3.5 h-3.5" />مجاني</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 shrink-0 w-full md:w-auto">
          <Link to="/sell-car" className="bg-white text-orange font-extrabold px-6 py-3 rounded-xl hover:bg-orange-50 transition-colors shadow-lg btn-press text-center">
            بيع عربيتك الآن ←
          </Link>
          <Link to="/post-listing" className="bg-black/20 hover:bg-black/30 border border-white/30 text-white font-bold px-6 py-3 rounded-xl transition-colors btn-press text-center">
            أضف إعلانك
          </Link>
        </div>
      </div>
    </section>
  );
}

function AppStrip() {
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pb-6">
      <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/app-icon-128.png" alt="كار مصر" className="w-14 h-14 rounded-2xl logo-gloss" />
          <div>
            <p className="font-extrabold text-text">تطبيق كار مصر</p>
            <p className="text-sm text-text-muted">تصفح، ابحث، وتواصل مع البائعين أسرع من موبايلك.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/download-app" className="bg-[#0B1E3A] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">تحميل للأندرويد</Link>
          <a href="tel:01018870145" className="bg-bg border border-border text-text px-4 py-2.5 rounded-xl text-sm font-bold hover:border-orange/50 inline-flex items-center gap-1.5"><Phone className="w-4 h-4 text-orange" /> تواصل معنا</a>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Footer ────────────────────────── */
function HomeFooter() {
  return (
    <footer className="bg-surface border-t border-border mt-4">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src="/app-icon-128.png" alt="كار مصر" className="h-9 w-9 rounded-xl logo-gloss" />
            <span className="font-extrabold text-text">كار مصر</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">سوق السيارات في مصر — بيع، شراء، إيجار، قطع غيار وخدمات السيارات.</p>
        </div>
        <div>
          <p className="font-bold text-text text-sm mb-2">تصفح</p>
          <ul className="space-y-1.5 text-sm text-text-muted">
            <li><Link to="/listings" className="hover:text-orange">جميع السيارات</Link></li>
            <li><Link to="/listings?condition=new" className="hover:text-orange">جديدة</Link></li>
            <li><Link to="/listings?condition=used" className="hover:text-orange">مستعملة</Link></li>
            <li><Link to="/listings?listingType=rent" className="hover:text-orange">للإيجار</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-text text-sm mb-2">خدمات</p>
          <ul className="space-y-1.5 text-sm text-text-muted">
            <li><Link to="/prices" className="hover:text-orange">أسعار السيارات</Link></li>
            <li><Link to="/compare" className="hover:text-orange">مقارنة</Link></li>
            <li><Link to="/finance" className="hover:text-orange">تمويل</Link></li>
            <li><Link to="/maintenance" className="hover:text-orange">صيانة</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-text text-sm mb-2">كار مصر</p>
          <ul className="space-y-1.5 text-sm text-text-muted">
            <li><Link to="/about" className="hover:text-orange">من نحن</Link></li>
            <li><Link to="/contact" className="hover:text-orange">اتصل بنا</Link></li>
            <li><Link to="/help" className="hover:text-orange">مساعدة</Link></li>
            <li><Link to="/privacy" className="hover:text-orange">الخصوصية</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-text-muted">
        © 2026 كار مصر CarMasr. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}

/* ────────────────────────── Page ────────────────────────── */
export default function HomeCar() {
  return (
    <div className="min-h-screen bg-bg">
      <SeoHead
        title="كار مصر CarMasr — بيع وشراء السيارات في مصر"
        description="ابحث عن سيارتك في مصر. جديد ومستعمل وإيجار وقطع غيار — قارن الأسعار، قيّم سيارتك، وتواصل مع البائعين بسهولة."
      />
      <HomeHeader />
      <HeroSearch />
      <WhyCarMasr />
      <BrandStrip />
      <HowItWorks />
      <MoreOnCarMasr />
      <DiscoverCars />
      <SellCta />
      <AppStrip />
      <HomeFooter />
    </div>
  );
}
