import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { X, Star, SlidersHorizontal, Search as SearchIcon, Image as ImageIcon, Tag, BadgeCheck, LayoutGrid, PackageCheck, Store } from 'lucide-react';
import { ListingCardSkeleton } from '../components/Skeleton';
import Sheet from '../components/Sheet';
import EmptyState from '../components/EmptyState';
import { listingsService, exhibitionsService, sortByDate, sortListingsByNewest } from '../lib/firestoreService';
import { governorates } from '../lib/data';
import { isSold } from '../lib/utils';
import { optimizeImage } from '../lib/imageUtils';
import type { Listing, ExhibitionProduct } from '../types';
import ListingCard from '../components/ListingCard';
import CategorySvgIcon from '../components/CategorySvgIcon';
import SeoHead from '../components/SeoHead';

const cats = [
  { id: '', name: 'الكل', icon: '' },
  { id: 'trucks', name: 'سيارات', icon: 'trucks' },
  { id: 'equipment', name: 'سيارات', icon: 'equipment' },
  { id: 'trailers', name: 'سيارات', icon: 'trailers' },
  { id: 'buses', name: 'حافلات', icon: 'buses' },
  { id: 'spare-parts', name: 'قطع غيار', icon: 'spare-parts' },
];

const sortOptions = [
  { id: 'priority', label: 'المميزة ثم الأحدث' },
  { id: 'newest', label: 'الأحدث' },
  { id: 'featured', label: 'المميز أولاً' },
  { id: 'price-asc', label: 'السعر: الأقل أولاً' },
  { id: 'price-desc', label: 'السعر: الأعلى أولاً' },
];

const LISTING_CATS = ['trucks', 'equipment', 'trailers', 'buses', 'spare-parts'];

/** توحيد اسم المحافظة: إزالة المسافات وإصلاح اختلاف الهمزات والتاء المربوطة */
const normalizeGovernorate = (v?: string): string => {
  const s = (v || '').trim().toLowerCase();
  if (!s) return '';
  return s
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
};

/** تطبيع النص العربي قبل المقارنة: توحيد الألف والياء والتاء المربوطة */
const normalizeText = (v?: string): string => normalizeGovernorate(v).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** الإعلان المميز فعليًا (مش منتهي 기간) */
const isFeaturedActive = (l: { featured?: boolean; featuredUntil?: string }): boolean =>
  !!l.featured && (!l.featuredUntil || new Date(l.featuredUntil).getTime() > Date.now());

/** صاحب المعرض (dealer) — يتقدم على الإعلان العادي */
const isDealer = (l: { userType?: string; isDealer?: boolean }): boolean =>
  l.isDealer === true || (l.userType || '').toLowerCase() === 'dealer';

/** نص السعر النصي (زي "250000 جنيه") يتحول لرقم */
const productPriceNumber = (p?: string): number => {
  const digits = String(p || '').replace(/[^\d]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
};

/** منتجات المعارض بتتعرض في نتائج البحث فوق الإعلانات، وبتلبّي نفس فلاتر البحث */
const productMatches = (p: ExhibitionProduct, q: string, governorate: string, withImages: boolean, withPrice: boolean): boolean => {
  if (p.status === 'sold') return false;
  if (governorate && normalizeGovernorate(p.governorate) !== governorate) return false;
  if (withImages && !((p.images?.length || 0) > 0 || p.image)) return false;
  if (withPrice && productPriceNumber(p.price) <= 0) return false;
  if (q) {
    const haystack = normalizeText([p.name, p.description, p.exhibitionName, p.governorate, p.category].filter(Boolean).join(' '));
    return haystack.includes(q);
  }
  return true;
};

/** أشهر الماركات الموجودة فعلاً — بتتقترح للعميل لو بحثه غلط */
const topBrands = (listings: Listing[]): string[] => {
  const counts = new Map<string, number>();
  for (const l of listings) {
    const b = (l.brand || '').trim();
    if (!b) continue;
    counts.set(b, (counts.get(b) || 0) + 1);
  }
  const fallback = ['فولفو', 'مان', 'سكان', 'إيفيكو', 'مرسيدس', 'دايكل'];
  const real = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  const merged = [...real, ...fallback.filter(f => !real.includes(f))];
  return merged.slice(0, 8);
};

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [dealerProducts, setDealerProducts] = useState<ExhibitionProduct[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const query = searchParams.get('search') || searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const governorate = searchParams.get('governorate') || '';
  const priceMin = searchParams.get('priceMin') || '';
  const priceMax = searchParams.get('priceMax') || '';
  // الافتراضي: المميزة أولاً ثم الأحدث، والمعلن بنفس ترتيب تاريخ الإنشاء
  const sort = searchParams.get('sort') || 'priority';
  const onlyFeatured = searchParams.get('featured') === '1';
  const condition = searchParams.get('condition') || '';        // new | used
  const withImages = searchParams.get('images') === '1';
  const withPrice = searchParams.get('hasPrice') === '1';
  const verifiedOnly = searchParams.get('verified') === '1';
  const soldFilter = searchParams.get('sold') || '';           // '' | 'hide' | 'only'
  // المميزة ومنتجات المعارض تظهر لما العميل يكتب بحث ويضغط — من غير بحث الصفحة إعلانات مستخدمين عادية
  const hasQuery = normalizeText(query).length > 0;
  const brand = searchParams.get('brand') || '';
  const yearFrom = searchParams.get('yearFrom') || '';
  const yearTo = searchParams.get('yearTo') || '';

  // خانة البحث: 상태 محلية + مزامنة متأخرة مع الرابط
  // (لو ربطنا الخانة بالرابط مباشرة، الكتابة بالعربي بتتكسر مع كل ضغطة مفتاح)
  const [searchText, setSearchText] = useState(query);
  const composingRef = useRef(false);
  const lastPushedRef = useRef(query);
  const allListingsRef = useRef<Listing[] | null>(null);
  const allProductsRef = useRef<ExhibitionProduct[] | null>(null);

  // مزامنة الخانة من الرابط بس لو التغيير جه من بره (مسح الكل / زر الرجوع)
  useEffect(() => {
    if (query !== lastPushedRef.current) setSearchText(query);
    lastPushedRef.current = query;
  }, [query]);

  /**فلترة وترتيب النتائج من البيانات المحمّلة — من غير أي جلب جديد */
  const applyFilters = (data: Listing[]): Listing[] => {
    let filtered = data.filter(l =>
      ['active', 'sold'].includes(l.status) && LISTING_CATS.includes(l.category)
    );
    if (category) filtered = filtered.filter(l => l.category === category);
    if (governorate) filtered = filtered.filter(l => normalizeGovernorate(l.governorate) === governorate);

    // بحث ذكي: نص الإعلان + اسم المعلن + رقم الإعلان + الماركة + الموديل + المحافظة
    const q = normalizeText(query);
    // من غير كلمة بحث: إعلانات المستخدمين العادية بس (المميزة والمعارض تظهر مع البحث بس)
    const showSpecial = q.length > 0;
    if (!showSpecial) filtered = filtered.filter(l => !isFeaturedActive(l));
    if (q) {
      const asId = q.replace(/\s+/g, '');
      filtered = filtered.filter(l => {
        const haystack = normalizeText([
          l.title, l.brand, l.model, l.subcategory, l.description,
          l.advertiserName, l.userName, l.governorate, l.location, l.id,
        ].filter(Boolean).join(' '));
        if (haystack.includes(q)) return true;
        // لو المستخدم كتب رقم: مطابقته على رقم الإعلان
        if (/^\d{4,}$/.test(asId)) {
          return l.id.toLowerCase() === asId || l.id.toLowerCase().endsWith(asId);
        }
        return false;
      });
    }

    if (brand) filtered = filtered.filter(l => normalizeText(l.brand).includes(normalizeText(brand)));
    if (condition === 'new') filtered = filtered.filter(l => l.condition === 'new');
    if (condition === 'used') filtered = filtered.filter(l => l.condition === 'used' || !l.condition);
    if (withImages) filtered = filtered.filter(l => (l.images?.length || 0) > 0);
    if (withPrice) filtered = filtered.filter(l => (l.price || 0) > 0);
    if (verifiedOnly) filtered = filtered.filter(l => !!l.verified);
    if (yearFrom) filtered = filtered.filter(l => Number(l.year || 0) >= Number(yearFrom));
    if (yearTo) filtered = filtered.filter(l => Number(l.year || 0) <= Number(yearTo));

    if (priceMin) filtered = filtered.filter(l => l.price >= Number(priceMin));
    if (priceMax) filtered = filtered.filter(l => l.price <= Number(priceMax));
    if (onlyFeatured) filtered = filtered.filter(l => l.featured && (!l.featuredUntil || new Date(l.featuredUntil) > new Date()));

    // فلتر حالة البيع: إخفاء المباع / عرض المباع بس
    if (soldFilter === 'hide') filtered = filtered.filter(l => !isSold(l.priceType, l.status));
    if (soldFilter === 'only') filtered = filtered.filter(l => isSold(l.priceType, l.status));

    switch (sort) {
      case 'price-asc': filtered = [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0)); break;
      case 'price-desc': filtered = [...filtered].sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case 'featured': filtered = sortListingsByNewest(filtered); break;
      case 'newest': filtered = sortByDate(filtered); break;
      default:
        // الافتراضي: المميزة أولاً، وبعدها كل الإعلانات — وكل مجموعة بتاريخ الإنشاء
        filtered = sortByDate(filtered);
        if (showSpecial) {
          filtered = [
            ...filtered.filter(isFeaturedActive),
            ...filtered.filter(l => !isFeaturedActive(l)),
          ];
        }
    }
    return filtered;
  };

  /**فلترة منتجات المعارض بنفس شروط البحث (المحافظة/الصور/السعر/الكلمة) */
  const applyProductFilters = (products: ExhibitionProduct[]): ExhibitionProduct[] => {
    const q = normalizeText(query);
    // منتجات المعارض تظهر في البحث بس — من غير كلمة بحث الصفحة عادية
    if (!q) return [];
    const out = products.filter(
      p => productMatches(p, q, governorate, withImages, withPrice) && soldFilter !== 'only'
    );
    return out.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  };

  useEffect(() => {
    // الإعلانات ومنتجات المعارض بتتجلب مرة واحدة بس، وبعدها الفلترة بتتم في الجهاز
    const cached = allListingsRef.current;
    if (cached) {
      setListings(applyFilters(cached));
      setDealerProducts(applyProductFilters(allProductsRef.current || []));
      return;
    }
    let cancelled = false;
    listingsService.getAll()
      .then(data => {
        allListingsRef.current = data;
        if (!cancelled) {
          setListings(applyFilters(data));
          setSuggestions(topBrands(data));
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    // منتجات المعارض: لازم الجلب يخلص قبل ما نعرضها
    exhibitionsService.getAllProducts()
      .then(products => {
        allProductsRef.current = products;
        if (!cancelled) setDealerProducts(applyProductFilters(products));
      })
      .catch(() => { /* منتجات المعارض اختيارية */ });
    return () => { cancelled = true; };
  }, [query, category, governorate, priceMin, priceMax, sort, onlyFeatured, condition, withImages, withPrice, verifiedOnly, soldFilter, brand, yearFrom, yearTo]);

  const updateFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    value ? p.set(key, value) : p.delete(key);
    setSearchParams(p, { replace: true });
  };

  const clearFilters = () => { setSearchText(''); setSearchParams({}); };

  // المزامنة مع الرابط بتتم بعد ما يوقف المستخدم عن الكتابة، ومتخطّاش أثناء compose العربي
  useEffect(() => {
    if (searchText === query || composingRef.current) return;
    const t = setTimeout(() => {
      lastPushedRef.current = searchText;
      updateFilter('search', searchText);
    }, 500);
    return () => clearTimeout(t);
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSearch = (value: string) => {
    setSearchText(value);
    lastPushedRef.current = value;
    updateFilter('search', value);
  };

  const hasFilters = query || category || governorate || priceMin || priceMax || onlyFeatured
    || condition || withImages || withPrice || verifiedOnly || soldFilter || brand || yearFrom || yearTo
    || sort !== 'priority';

  const resultCount = useMemo(() => listings.length, [listings]);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead
        title={query ? `نتائج البحث عن: ${query}` : 'البحث المتقدم في إعلانات كار مصر'}
        description="ابحث في كل إعلانات المركبات والسيارات الثقيلة وقطع الغيار في مصر — مع فلاتر المحافظة والسعر والترتيب."
      />
      <div className="bg-navy py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">البحث المتقدم</h1>

          <form onSubmit={e => { e.preventDefault(); }} className="mb-4">
            <div className="flex gap-2">
              <div className="flex-1 relative bg-white rounded-2xl shadow-xl ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-orange transition">
                <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="text" inputMode="search" enterKeyHint="search"
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                  dir="auto"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={(e) => {
                    composingRef.current = false;
                    setSearchText(e.currentTarget.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setSearch(searchText);
                    }
                  }}
                  placeholder="اكتب اسم السيارة أو الموديل أو رقم الإعلان أو اسم البائع..."
                  className="w-full h-12 sm:h-14 pr-12 pl-11 rounded-2xl bg-transparent text-sm sm:text-base font-medium text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:outline-none"
                />
                {searchText && (
                  <button type="button" onClick={() => setSearch('')} aria-label="مسح البحث"
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setShowFilters(true)}
                className="h-12 sm:h-14 px-4 sm:px-5 rounded-2xl bg-orange hover:bg-orange-dark text-white text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shrink-0">
                <SlidersHorizontal className="w-4 h-4" /> فلاتر
                {(condition || withImages || withPrice || verifiedOnly || soldFilter || brand || yearFrom || yearTo) && (
                  <span className="w-2 h-2 rounded-full bg-white" />
                )}
              </button>
              {hasFilters && (
                <button type="button" onClick={clearFilters} aria-label="مسح كل الفلاتر"
                  className="h-12 sm:h-14 px-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {cats.map(c => (
              <button key={c.id} onClick={() => updateFilter('category', c.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${category === c.id ? 'bg-orange text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {c.icon && <CategorySvgIcon categoryId={c.icon} className="w-4 h-4" />}
                {c.name}
              </button>
            ))}
          </div>

          <Sheet open={showFilters} onClose={() => setShowFilters(false)} title="فلترة النتائج">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">الماركة</label>
                  <input type="text" value={brand} onChange={e => updateFilter('brand', e.target.value)}
                    placeholder="فولفو، مان، Scania..." className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange text-right" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">سنة الصنع من</label>
                  <input type="text" inputMode="numeric" dir="ltr" value={yearFrom} onChange={e => updateFilter('yearFrom', e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                    placeholder="2018" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange text-right" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">سنة الصنع إلى</label>
                  <input type="text" inputMode="numeric" dir="ltr" value={yearTo} onChange={e => updateFilter('yearTo', e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                    placeholder="2026" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange text-right" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">حالة السيارة</label>
                  <select value={condition} onChange={e => updateFilter('condition', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange">
                    <option value="">الكل</option>
                    <option value="new">جديدة</option>
                    <option value="used">مستعملة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">السعر من</label>
                  <input type="text" inputMode="numeric" dir="ltr" value={priceMin} onChange={e => updateFilter('priceMin', e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="0" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange text-right" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">السعر إلى</label>
                  <input type="text" inputMode="numeric" dir="ltr" value={priceMax} onChange={e => updateFilter('priceMax', e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="10,000,000" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange text-right" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">المحافظة</label>
                  <select value={governorate} onChange={e => updateFilter('governorate', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange">
                    <option value="">كل المحافظات</option>
                    {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">الترتيب</label>
                  <select value={sort} onChange={e => updateFilter('sort', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange">
                    {sortOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <label className="text-xs font-semibold text-text-light block mb-2">حالة البيع</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '', label: 'الكل', icon: LayoutGrid },
                    { id: 'hide', label: 'متاح فقط', icon: Tag },
                    { id: 'only', label: 'تم البيع', icon: PackageCheck },
                  ].map(o => (
                    <button key={o.id} onClick={() => updateFilter('sold', o.id)}
                      className={`flex items-center justify-center gap-1.5 text-sm font-bold px-2 py-2.5 rounded-xl border transition-colors ${
                        soldFilter === o.id ? 'bg-orange text-white border-orange' : 'bg-white border-border text-text-light hover:border-orange'}`}>
                      <o.icon className="w-4 h-4" /> {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button onClick={() => updateFilter('images', withImages ? '' : '1')}
                  className={`flex items-center justify-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl border transition-colors ${withImages ? 'bg-orange text-white border-orange' : 'bg-white border-border text-text-light hover:border-orange'}`}>
                  <ImageIcon className="w-4 h-4" /> به صور
                </button>
                <button onClick={() => updateFilter('hasPrice', withPrice ? '' : '1')}
                  className={`flex items-center justify-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl border transition-colors ${withPrice ? 'bg-orange text-white border-orange' : 'bg-white border-border text-text-light hover:border-orange'}`}>
                  <Tag className="w-4 h-4" /> به سعر
                </button>
                <button onClick={() => updateFilter('verified', verifiedOnly ? '' : '1')}
                  className={`flex items-center justify-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl border transition-colors ${verifiedOnly ? 'bg-orange text-white border-orange' : 'bg-white border-border text-text-light hover:border-orange'}`}>
                  <BadgeCheck className="w-4 h-4" /> موثّق فقط
                </button>
              </div>

              <button onClick={() => updateFilter('featured', onlyFeatured ? '' : '1')}
                className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border transition-colors ${onlyFeatured ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-white border-border text-text-light'}`}>
                <Star className={`w-4 h-4 ${onlyFeatured ? 'fill-amber-500 text-amber-500' : ''}`} />
                المميزة فقط
              </button>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => setShowFilters(false)}
                  className="flex-1 bg-orange hover:bg-orange-dark text-white h-11 rounded-xl text-sm font-bold transition-colors">
                  عرض {resultCount} نتيجة
                </button>
                <button onClick={() => { clearFilters(); setShowFilters(false); }}
                  className="px-4 h-11 rounded-xl border border-border bg-white text-text-light hover:text-danger text-sm font-bold transition-colors">
                  مسح الكل
                </button>
              </div>
            </div>
          </Sheet>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {dealerProducts.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base sm:text-lg font-extrabold text-text">منتجات المعارض</h2>
                  <span className="text-xs font-bold text-text-light">({dealerProducts.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {dealerProducts.map((p, i) => {
                    const imgs = p.images?.length ? p.images : (p.image ? [p.image] : []);
                    const priceNum = productPriceNumber(p.price);
                    return (
                      <Link key={`expo-${p.id}`} to={`/product/${p.id}`}
                        className="group card-surface overflow-hidden card-hover block">
                        <div className="relative">
                          {imgs.length > 0 ? (
                            <img src={optimizeImage(imgs[0], 'small')} alt={p.name} loading="lazy"
                              className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-44 bg-gray-100 flex items-center justify-center text-gray-300">
                              <Store className="w-10 h-10" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-1 rounded-lg shadow-md">
                            عرض من معرض
                          </div>
                        </div>
                        <div className="p-3">
                          {p.exhibitionName && (
                            <p className="text-[11px] font-bold text-emerald-700 mb-1 truncate">{p.exhibitionName}</p>
                          )}
                          <h3 className="font-bold text-sm text-text line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                          <p className="text-orange font-extrabold mt-1.5">
                            {priceNum > 0 ? `${priceNum.toLocaleString('ar-EG')} جنيه` : (p.price || 'السعر عند الاتصال')}
                          </p>
                          {p.governorate && <p className="text-text-light text-xs mt-1">{p.governorate}</p>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {resultCount > 0 && (
              <>
                {hasQuery && (
                  <p className="text-text-light text-sm mb-4">
                    <span className="font-bold text-text">نتائج بحثك عن «{searchText}»</span> — {resultCount} إعلان
                  </p>
                )}
                {!hasQuery && <p className="text-text-light text-sm mb-4">{resultCount} إعلان</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {listings.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
                </div>
              </>
            )}

            {resultCount === 0 && (
              <div className="card-surface">
                <EmptyState
                  title={query ? `مفيش نتائج لـ «${searchText}»` : 'مفيش نتائج بالمواصفات دي'}
                  description="راجع الكتابة، أو جرّب كلمة أبسط، أو شيل بعض الفلاتر."
                  actionLabel="امسح الفلاتر وعرض الكل"
                  onAction={clearFilters}
                />
                {suggestions.length > 0 && (
                  <div className="px-4 pb-8 -mt-2">
                    <p className="text-center text-xs font-bold text-text-light mb-3">جرّب تبحث عن:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {suggestions.map(s => (
                        <button key={s} onClick={() => setSearch(s)}
                          className="px-3.5 py-1.5 rounded-full text-sm font-bold bg-orange/10 text-orange hover:bg-orange hover:text-white transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}