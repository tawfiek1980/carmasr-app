import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, User, Sun, Moon, MapPin, Phone, ChevronLeft, Heart,
  Car, Sparkles, Zap, Wrench, ShieldCheck, Scale, Gauge, Tag, Building2,
  Siren, Star, Fuel, Calendar, Landmark,
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import OptimizedImage from '../components/OptimizedImage';
import { listingsService } from '../lib/firestoreService';
import { formatPrice, listingUrl } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { trackEvent } from '../lib/analytics';
import type { Listing } from '../types';

/* ────────────────────────── Header ────────────────────────── */
function HomeHeader() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between h-[72px] px-4 sm:px-6 gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/app-icon-128.png" alt="كار مصر" className="h-11 w-11 rounded-2xl object-cover logo-gloss" />
          <span className="text-text font-extrabold text-xl leading-none">كار مصر</span>
        </Link>

        <div className="hidden md:flex flex-1 max-w-xl mx-4">
          <Link
            to="/listings"
            className="w-full flex items-center gap-2 bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text-muted hover:border-orange/50 transition-colors"
          >
            <Search className="w-4 h-4 text-orange" />
            <span>ابحث عن ماركة، موديل، سنة...</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/post-listing"
            onClick={() => trackEvent('cta_add_listing', { source: 'home_header' })}
            className="flex items-center gap-1 bg-orange hover:bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-xl text-[12px] sm:text-sm font-bold shadow-sm shadow-orange/30 transition-colors btn-press"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">أضف إعلانك</span>
          </Link>
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-bg border border-border text-text hover:bg-orange hover:text-white transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? 'sun' : 'moon'}
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.25 }}
                className="flex items-center justify-center"
              >
                {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </motion.span>
            </AnimatePresence>
          </button>
          {user ? (
            <Link
              to="/profile"
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-bg border border-border text-text hover:bg-orange hover:text-white transition-colors"
              title={user.name}
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 bg-white border-2 border-border hover:border-orange/50 text-text px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <User className="w-4 h-4 text-orange" />
              <span className="hidden sm:inline">دخول</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────── Hero Search ────────────────────────── */
const GOVERNORATES = [
  'بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'كربلاء', 'بابل', 'ديالى',
  'الأنبار', 'كركوك', 'صلاح الدين', 'واسط', 'ميسان', 'ذي قار', 'المثنى',
  'دهوك', 'السليمانية',
];
// Egyptian governorates for CarMasr
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

function HeroSearch() {
  const navigate = useNavigate();
  const [brand, setBrand] = useState('');
  const [gov, setGov] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (brand) params.set('brand', brand);
    if (gov) params.set('governorate', gov);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    trackEvent('home_search', { brand, gov });
    navigate(`/listings?${params.toString()}`);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0B1E3A] via-[#122B4F] to-[#0B1E3A] text-white">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-orange/40 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-blue-400/30 blur-3xl" />
      </div>
      <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-orange" />
            سوق السيارات الملاكي في مصر
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
            ابحث عن سيارتك المثالية
            <span className="block text-orange mt-1">بِأسعار عادلة وثقة كاملة</span>
          </h1>
          <p className="mt-3 text-white/80 text-base sm:text-lg max-w-2xl">
            آلاف الإعلانات: مستعملة، جديدة، إيجار، كهربائية. قارن، تقيّم، وابحث عن أفضل عرض في محافظتك.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-8 bg-white rounded-2xl shadow-2xl p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5"
        >
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="bg-bg text-text rounded-xl px-3 py-3 text-sm border border-border focus:outline-none focus:border-orange"
          >
            <option value="">كل الماركات</option>
            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            value={gov}
            onChange={(e) => setGov(e.target.value)}
            className="bg-bg text-text rounded-xl px-3 py-3 text-sm border border-border focus:outline-none focus:border-orange"
          >
            <option value="">كل المحافظات</option>
            {EGYPT_GOV.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <input
            type="number"
            inputMode="numeric"
            placeholder="أقل سعر"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="bg-bg text-text rounded-xl px-3 py-3 text-sm border border-border focus:outline-none focus:border-orange"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="أعلى سعر"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="bg-bg text-text rounded-xl px-3 py-3 text-sm border border-border focus:outline-none focus:border-orange"
          />
          <button
            type="submit"
            className="bg-orange hover:bg-orange-600 text-white rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors btn-press"
          >
            <Search className="w-4 h-4" />
            بحث
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { label: 'مستعملة', to: '/listings?condition=used', icon: Car },
            { label: 'جديدة', to: '/listings?condition=new', icon: Sparkles },
            { label: 'للإيجار', to: '/listings?listingType=rent', icon: Calendar },
            { label: 'كهربائية', to: '/listings?q=electric', icon: Zap },
            { label: 'قطع غيار', to: '/spare-parts', icon: Wrench },
          ].map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            >
              <c.icon className="w-4 h-4 text-orange" />
              {c.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Brand strip ────────────────────────── */
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

function BrandStrip() {
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-extrabold text-text">تسوّق حسب الماركة</h2>
        <Link to="/listings" className="text-orange text-sm font-bold flex items-center gap-1 hover:underline">
          عرض الكل <ChevronLeft className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3">
        {BRAND_LOGOS.map((b) => {
          const src = b.slug
            ? `https://cdn.simpleicons.org/${b.slug}`
            : b.domain
            ? `https://www.google.com/s2/favicons?domain=${b.domain}&sz=64`
            : null;
          return (
            <Link
              key={b.name}
              to={`/brand/${encodeURIComponent(b.name)}`}
              onClick={() => trackEvent('brand_click', { brand: b.name })}
              className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface border border-border hover:border-orange/50 hover:shadow-md transition-all btn-press"
            >
              <div className="w-12 h-12 rounded-xl bg-bg flex items-center justify-center overflow-hidden logo-gloss">
                {src ? (
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = 'none';
                      const parent = t.parentElement;
                      if (parent && !parent.querySelector('.brand-fallback')) {
                        const span = document.createElement('span');
                        span.className = 'brand-fallback text-orange font-extrabold text-xs';
                        span.textContent = b.name.slice(0, 3);
                        parent.appendChild(span);
                      }
                    }}
                  />
                ) : (
                  <span className="text-orange font-extrabold text-xs">{b.name.slice(0, 3)}</span>
                )}
              </div>
              <span className="text-xs font-semibold text-text group-hover:text-orange transition-colors text-center leading-tight">{b.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ────────────────────────── Categories ────────────────────────── */
const CATEGORIES = [
  { label: 'سيارات مستعملة', to: '/listings?condition=used', icon: Car, desc: 'أفضل العروض على المستعمل' },
  { label: 'سيارات جديدة', to: '/listings?condition=new', icon: Sparkles, desc: 'موديلات 2024–2025' },
  { label: 'للإيجار', to: '/listings?listingType=rent', icon: Calendar, desc: 'إيجار يومي/شهري' },
  { label: 'كهربائية', to: '/listings?q=electric', icon: Zap, desc: 'مستقبل التنقل' },
  { label: 'قطع غيار', to: '/spare-parts', icon: Wrench, desc: 'أصلية ومضمونة' },
  { label: 'معارض', to: '/exhibitions', icon: Building2, desc: 'معارض موثوقة' },
];

function CategoryGrid() {
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
      <h2 className="text-lg sm:text-xl font-extrabold text-text mb-4">تصفح حسب الفئة</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORIES.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group bg-surface border border-border rounded-2xl p-4 hover:border-orange/50 hover:shadow-md transition-all btn-press"
          >
            <div className="w-11 h-11 rounded-xl bg-orange/10 flex items-center justify-center mb-3 group-hover:bg-orange transition-colors">
              <c.icon className="w-5 h-5 text-orange group-hover:text-white transition-colors" />
            </div>
            <p className="font-bold text-text text-sm">{c.label}</p>
            <p className="text-xs text-text-muted mt-0.5">{c.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────── Featured cars ────────────────────────── */
function CarCard({ listing }: { listing: Listing }) {
  const img = listing.images?.[0];
  return (
    <Link
      to={listingUrl(listing.id, listing.slug)}
      className="group shrink-0 w-[260px] sm:w-[280px] bg-surface border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-orange/40 transition-all btn-press"
    >
      <div className="relative aspect-[4/3] bg-bg overflow-hidden">
        {img ? (
          <OptimizedImage
            src={optimizeImage(img, 'medium')}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <Car className="w-10 h-10" />
          </div>
        )}
        {listing.featured && (
          <span className="absolute top-2 right-2 bg-orange text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Star className="w-3 h-3" /> مميز
          </span>
        )}
        {listing.condition && (
          <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full">
            {listing.condition === 'new' ? 'جديدة' : 'مستعملة'}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-bold text-text text-sm line-clamp-1">{listing.title}</h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
          {listing.brand && <span>{listing.brand}</span>}
          {listing.year && <span>• {listing.year}</span>}
          {listing.governorate && <span>• {listing.governorate}</span>}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-orange font-extrabold text-base">
            {listing.priceType === 'call' ? 'اتصل للسعر' : formatPrice(listing.price)}
          </span>
          {listing.listingType === 'rent' && (
            <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">إيجار</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function optimizeImage(src: string, _size: string) { return src; }

function FeaturedCars() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const featured = await listingsService.getFeatured();
        if (!mounted) return;
        if (featured && featured.length) { setItems(featured.slice(0, 12)); setLoading(false); return; }
        const all = await listingsService.getAll({ status: 'active' });
        if (!mounted) return;
        setItems((all || []).slice(0, 12));
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-extrabold text-text">اكتشف السيارات</h2>
        <Link to="/listings" className="text-orange text-sm font-bold flex items-center gap-1 hover:underline">
          عرض الكل <ChevronLeft className="w-4 h-4" />
        </Link>
      </div>
      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[260px] h-[260px] rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center text-text-muted">
          <Car className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="font-semibold">لا توجد إعلانات بعد</p>
          <Link to="/post-listing" className="inline-block mt-3 text-orange font-bold hover:underline">أضف أول إعلان ←</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((l) => (
            <CarCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ────────────────────────── Tools strip ────────────────────────── */
const TOOLS = [
  { label: 'مقارنة عربيتين', to: '/compare', icon: Scale, desc: 'قارن المواصفات' },
  { label: 'تقييم سيارة', to: '/evaluate', icon: Gauge, desc: 'قيمة سيارتك' },
  { label: 'دليل الأسعار', to: '/prices', icon: Tag, desc: 'أسعار السوق' },
  { label: 'تمويل/تقسيط', to: '/finance', icon: Landmark, desc: 'قروض مرنة' },
  { label: 'معارض', to: '/exhibitions', icon: Building2, desc: 'معارض موثوقة' },
  { label: 'صيانة', to: '/maintenance', icon: Wrench, desc: 'مراكز معتمدة' },
  { label: 'طوارئ', to: '/emergency', icon: Siren, desc: 'مساعدة 24/7' },
  { label: 'فحص', to: '/inspection', icon: ShieldCheck, desc: 'فحص قبل الشراء' },
];

function ToolsStrip() {
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-lg sm:text-xl font-extrabold text-text mb-4">أدوات وخدمات</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {TOOLS.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            className="group bg-surface border border-border rounded-2xl p-3 text-center hover:border-orange/50 hover:shadow-md transition-all btn-press"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-orange/10 flex items-center justify-center mb-2 group-hover:bg-orange transition-colors">
              <t.icon className="w-5 h-5 text-orange group-hover:text-white transition-colors" />
            </div>
            <p className="font-bold text-text text-xs">{t.label}</p>
            <p className="text-[10px] text-text-muted mt-0.5">{t.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────── Promo banner ────────────────────────── */
function PromoBanner() {
  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange to-orange-600 text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold">هل تريد بيع سيارتك؟</h3>
          <p className="text-white/90 mt-1 text-sm sm:text-base">أضف إعلانك مجاناً ووصّل لآلاف المشترين في ٢٤ ساعة.</p>
        </div>
        <Link
          to="/post-listing"
          className="shrink-0 bg-white text-orange font-bold px-5 py-3 rounded-xl hover:bg-orange-50 transition-colors shadow-lg btn-press"
        >
          ابدأ الآن ←
        </Link>
      </div>
    </section>
  );
}

/* ────────────────────────── Footer ────────────────────────── */
function HomeFooter() {
  return (
    <footer className="bg-surface border-t border-border mt-8">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src="/app-icon-128.png" alt="كار مصر" className="h-9 w-9 rounded-xl logo-gloss" />
            <span className="font-extrabold text-text">كار مصر</span>
          </div>
          <p className="text-xs text-text-muted">سوق السيارات الملاكي في مصر — بيع، شراء، إيجار، قطع غيار.</p>
        </div>
        <div>
          <p className="font-bold text-text text-sm mb-2">تصفح</p>
          <ul className="space-y-1 text-sm text-text-muted">
            <li><Link to="/listings" className="hover:text-orange">جميع السيارات</Link></li>
            <li><Link to="/listings?condition=used" className="hover:text-orange">مستعملة</Link></li>
            <li><Link to="/listings?condition=new" className="hover:text-orange">جديدة</Link></li>
            <li><Link to="/listings?listingType=rent" className="hover:text-orange">للإيجار</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-text text-sm mb-2">خدمات</p>
          <ul className="space-y-1 text-sm text-text-muted">
            <li><Link to="/finance" className="hover:text-orange">تمويل</Link></li>
            <li><Link to="/exhibitions" className="hover:text-orange">معارض</Link></li>
            <li><Link to="/maintenance" className="hover:text-orange">صيانة</Link></li>
            <li><Link to="/emergency" className="hover:text-orange">طوارئ</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-text text-sm mb-2">الشركة</p>
          <ul className="space-y-1 text-sm text-text-muted">
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
        title="كار مصر CarMasr — سوق السيارات الملاكي: بيع وشراء وإيجار"
        description="ابحث عن سيارتك المثالية في مصر. آلاف الإعلانات: مستعملة، جديدة، إيجار، كهربائية، قطع غيار. قارن، تقيّم، وابحث عن أفضل عرض."
      />
      <HomeHeader />
      <HeroSearch />
      <BrandStrip />
      <CategoryGrid />
      <FeaturedCars />
      <ToolsStrip />
      <PromoBanner />
      <HomeFooter />
    </div>
  );
}
