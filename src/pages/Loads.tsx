import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, MapPin, Package, RotateCcw, Clock, Search, SlidersHorizontal, X, TrendingUp, Weight, DollarSign, ChevronDown, ChevronUp, Phone, User, Info, Truck, Calendar, CreditCard, AlertCircle, MessageCircle } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { loadsService } from '../lib/firestoreService';
import { governorates, cargoTypes, loadVehicleTypes } from '../lib/data';
import { getPhoneLink, getWhatsAppLink, formatDateDMY, displayPrice, listingWhatsApp } from "../lib/utils";
import { filterAvailable } from "../lib/listingStatus";
import ProtectedPhoneButton from '../components/ProtectedPhoneButton';
import AiMatch from '../components/AiMatch';
import type { Load } from '../types';
import { getSiteUrl } from '../lib/config';

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'الأحدث' },
  { value: 'date-asc', label: 'الأقدم' },
  { value: 'price-asc', label: 'السعر: الأقل' },
  { value: 'price-desc', label: 'السعر: الأعلى' },
  { value: 'weight-desc', label: 'الوزن: الأكبر' },
  { value: 'weight-asc', label: 'الوزن: الأصغر' },
];

export default function Loads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const routeType     = searchParams.get('routeType')     || 'domestic';
  const origin        = searchParams.get('origin')        || '';
  const destination   = searchParams.get('destination')   || '';
  const cargoType     = searchParams.get('cargoType')     || '';
  const vehicleType   = searchParams.get('vehicleType')   || '';
  const returnOnly    = searchParams.get('returnOnly')    === '1';
  const periodOnly    = searchParams.get('periodOnly')    === '1';
  const sort          = searchParams.get('sort')          || 'date-desc';
  const minPrice      = searchParams.get('minPrice')      || '';
  const maxPrice      = searchParams.get('maxPrice')      || '';
  const searchQuery   = searchParams.get('q')             || '';

  const isIntl = routeType === 'international';

  const filtered = useMemo(() => {
    let result = filterAvailable([...loads]);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.origin?.toLowerCase().includes(q) ||
        l.destination?.toLowerCase().includes(q) ||
        l.cargoType?.toLowerCase().includes(q) ||
        l.vehicleType?.toLowerCase().includes(q) ||
        l.userName?.toLowerCase().includes(q)
      );
    }

    if (isIntl) result = result.filter(l => l.international);
    else result = result.filter(l => !l.international);
    if (origin)      result = result.filter(l => l.origin?.includes(origin));
    if (destination) result = result.filter(l => l.destination?.includes(destination));
    if (cargoType)   result = result.filter(l => l.cargoType === cargoType);
    if (vehicleType) result = result.filter(l => l.vehicleType === vehicleType);
    if (returnOnly)  result = result.filter(l => l.isReturnLoad);
    if (periodOnly)  result = result.filter(l => l.loadType === 'period');
    if (minPrice)    result = result.filter(l => l.price >= Number(minPrice));
    if (maxPrice)    result = result.filter(l => l.price <= Number(maxPrice));

    result.sort((a, b) => {
      switch (sort) {
        case 'date-asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'weight-desc': return Number(b.weight) - Number(a.weight);
        case 'weight-asc': return Number(a.weight) - Number(b.weight);
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [loads, searchQuery, isIntl, origin, destination, cargoType, vehicleType, returnOnly, periodOnly, sort, minPrice, maxPrice]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const avgPrice = Math.round(filtered.reduce((s, l) => s + l.price, 0) / filtered.length);
    const totalTons = filtered.reduce((s, l) => s + Number(l.weight), 0);
    const avgPricePerTon = totalTons > 0 ? Math.round(avgPrice / (totalTons / filtered.length)) : 0;
    const popularRoute = filtered.reduce<Record<string, number>>((acc, l) => {
      const key = `${l.origin} → ${l.destination}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topRoute = Object.entries(popularRoute).sort((a, b) => b[1] - a[1])[0];
    return { avgPrice, avgPricePerTon, totalTons: Math.round(totalTons), topRoute: topRoute?.[0], totalLoads: filtered.length };
  }, [filtered]);

  useEffect(() => {
    loadsService.getAll({ status: 'available' })
      .then(setLoads)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) { p.set(key, value); } else { p.delete(key); }
    setSearchParams(p);
  };

  const clearFilters = () => {
    const p = new URLSearchParams();
    p.set('routeType', routeType);
    setSearchParams(p);
  };

  const hasFilters = origin || destination || cargoType || vehicleType || returnOnly || periodOnly || minPrice || maxPrice || sort !== 'date-desc';

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy py-5 sm:py-7">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">سوق حمولة</h1>
              <p className="text-gray-400 text-xs sm:text-sm mt-1">ابحث عن حمولة أو أضف حمولتك</p>
            </div>
            <Link to="/post-listing?type=load"
              className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">أضف حمولة</span>
            </Link>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
            <input value={searchQuery} onChange={e => updateFilter('q', e.target.value)}
              placeholder="ابحث في حمولة (مدينة، نوع حمولة، عربية...)"
              className="bg-transparent w-full text-white placeholder:text-white/40 text-sm focus:outline-none" />
            {searchQuery && (
              <button onClick={() => updateFilter('q', '')} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex bg-white/10 rounded-xl p-0.5">
              <button onClick={() => updateFilter('routeType', 'domestic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!isIntl ? 'bg-orange text-white' : 'text-white/70'}`}>داخلي</button>
              <button onClick={() => updateFilter('routeType', 'international')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isIntl ? 'bg-orange text-white' : 'text-white/70'}`}>خارج مصر</button>
            </span>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showFilters || hasFilters ? 'bg-orange text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              فلتر
              {hasFilters && <span className="bg-white/20 text-white px-1.5 py-0.5 rounded-full text-[10px]">!</span>}
            </button>
            <select value={sort} onChange={e => updateFilter('sort', e.target.value)}
              className="bg-white/10 text-white/70 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none">
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value} className="bg-navy text-white">{o.label}</option>
              ))}
            </select>
          </div>

          {showFilters && (
            <div className="bg-white rounded-2xl p-4 mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text">تصفية متقدمة</span>
                <button onClick={clearFilters} className="text-orange text-xs font-semibold">إعادة ضبط</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                  <select value={origin} onChange={e => updateFilter('origin', e.target.value)}
                    className="w-full h-10 pr-9 pl-2 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm">
                    <option value="">من المحافظة</option>
                    {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
                  <select value={destination} onChange={e => updateFilter('destination', e.target.value)}
                    className="w-full h-10 pr-9 pl-2 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm">
                    <option value="">إلى المحافظة</option>
                    {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
                <select value={cargoType} onChange={e => updateFilter('cargoType', e.target.value)}
                  className="w-full h-10 px-3 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm">
                  <option value="">نوع الحمولة</option>
                  {cargoTypes?.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={vehicleType} onChange={e => updateFilter('vehicleType', e.target.value)}
                  className="w-full h-10 px-3 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm">
                  <option value="">نوع العربية</option>
                  {loadVehicleTypes?.map((v: string) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-light mb-1 block">نطاق السعر (جنيه)</label>
                  <div className="flex gap-2">
                    <input type="number" value={minPrice} onChange={e => updateFilter('minPrice', e.target.value)}
                      placeholder="الحد الأدنى" className="w-full h-10 px-3 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm" />
                    <input type="number" value={maxPrice} onChange={e => updateFilter('maxPrice', e.target.value)}
                      placeholder="الحد الأقصى" className="w-full h-10 px-3 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-text-light cursor-pointer">
                    <input type="checkbox" checked={returnOnly} onChange={e => updateFilter('returnOnly', e.target.checked ? '1' : '')}
                      className="w-4 h-4 rounded border-gray-300 text-orange focus:ring-orange" />
                    حمولات رجعة
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-text-light cursor-pointer">
                    <input type="checkbox" checked={periodOnly} onChange={e => updateFilter('periodOnly', e.target.checked ? '1' : '')}
                      className="w-4 h-4 rounded border-gray-300 text-orange focus:ring-orange" />
                    تعاقد (لفترة)
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text mb-1">لا توجد حمولات</h3>
            <p className="text-text-light text-sm mb-6">جرب تغيير الفلاتر أو أضف حمولة</p>
            <div className="flex items-center justify-center gap-3">
              {hasFilters && (
                <button onClick={clearFilters}
                  className="bg-bg border border-border text-text px-6 py-2.5 rounded-xl font-bold text-sm transition-colors">
                  إعادة ضبط الفلاتر
                </button>
              )}
              <Link to="/post-listing?type=load"
                className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors inline-block">
                أضف حمولة الآن
              </Link>
            </div>
          </div>
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <Package className="w-3.5 h-3.5" /> إجمالي
                  </div>
                  <p className="text-lg font-black text-text">{stats.totalLoads}</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <DollarSign className="w-3.5 h-3.5" /> متوسط الأجرة
                  </div>
                  <p className="text-lg font-black text-orange">{stats.avgPrice.toLocaleString('ar-EG')} <span className="text-xs text-text-light">ج.م</span></p>
                </div>
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <TrendingUp className="w-3.5 h-3.5" /> متوسط / طن
                  </div>
                  <p className="text-lg font-black text-success">{stats.avgPricePerTon.toLocaleString('ar-EG')} <span className="text-xs text-text-light">ج.م</span></p>
                </div>
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <Weight className="w-3.5 h-3.5" /> إجمالي الأطنان
                  </div>
                  <p className="text-lg font-black text-text">{stats.totalTons.toLocaleString('ar-EG')} <span className="text-xs text-text-light">طن</span></p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <p className="text-text-light text-sm">{filtered.length} حمولة متاحة</p>
              {stats?.topRoute && (
                <p className="text-xs text-text-light hidden sm:block">
                  <TrendingUp className="w-3 h-3 inline ml-1 text-orange" />
                  أشهر خط: {stats.topRoute}
                </p>
              )}
            </div>

            {filtered.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(load => (
                  <LoadCard key={load.id} load={load}
                    expanded={expandedId === load.id}
                    onToggle={() => setExpandedId(expandedId === load.id ? null : load.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LoadCard({ load, expanded, onToggle }: { load: Load; expanded: boolean; onToggle: () => void }) {
  const pricePerTon = load.weight && Number(load.weight) > 0
    ? Math.round(load.price / Number(load.weight))
    : null;

  const tags: { label: string; bg: string; text: string }[] = [];
  if (load.loadType === 'period') tags.push({ label: `تعاقد ${load.periodDays || ''}`, bg: 'bg-blue-100', text: 'text-blue-700' });
  if (load.isReturnLoad) tags.push({ label: 'رجعة', bg: 'bg-emerald-100', text: 'text-emerald-700' });
  if (load.international) tags.push({ label: 'دولي', bg: 'bg-indigo-100', text: 'text-indigo-700' });

  const SITE_URL = getSiteUrl();

  const openMap = () => {
    const q = `${load.origin} مصر إلى ${load.destination} مصر`;
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}`, '_blank');
  };

const phone = load.secondaryPhone || load.contactPhone || load.userPhone;
  // رقم الواتساب بتاع صاحب الحمولة (مش بتاع اللي بيشوف)
  const waPhone = listingWhatsApp({
    whatsappPhone: load.whatsappPhone,
    contactPhone: load.contactPhone,
    userPhone: load.userPhone,
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
      {String(load.id).startsWith('sample-') && (
        <div className="px-4 pt-2">
          <span className="bg-gray-700/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">تجريبي (عرض)</span>
        </div>
      )}
      {/* ── الرئيسي: المسار والسعر ── */}
      <button onClick={onToggle} className="w-full text-right p-4 pb-3">
        {/* تاغز + سهم */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((t, i) => (
              <span key={i} className={`${t.bg} ${t.text} px-2 py-0.5 rounded-md text-[10px] font-bold`}>{t.label}</span>
            ))}
            <span className="text-[10px] text-gray-400">{formatDateDMY(load.date)}</span>
          </div>
          <div className="flex items-center gap-0.5 text-gray-300">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* المسار */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange flex-shrink-0" />
              <span className="text-base font-bold text-gray-900 truncate">{load.origin}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 px-1">
            <div className="w-6 h-[1.5px] bg-orange/30 rounded" />
            <Truck className="w-3.5 h-3.5 text-orange" />
            <div className="w-6 h-[1.5px] bg-orange/30 rounded" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-base font-bold text-gray-900 truncate text-left">{load.destination}</span>
              <div className="w-2.5 h-2.5 rounded-full border-2 border-orange flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* معلومات سريعة + السعر */}
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
              <Package className="w-3 h-3" /> {load.cargoType}
            </span>
            {load.vehicleType && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                <Truck className="w-3 h-3" /> {load.vehicleType}
              </span>
            )}
            {load.weight && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-semibold">
                ⚖️ {load.weight} طن
              </span>
            )}
            {pricePerTon && (
              <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-xs font-bold">
                ~{pricePerTon.toLocaleString('ar-EG')} ج/طن
              </span>
            )}
          </div>
          <div className="flex-shrink-0 text-left mr-2">
            <div className="text-xl font-black text-orange leading-none">{displayPrice(load.price, load.priceType)}</div>
            <div className="text-[10px] text-gray-400 font-medium">جنيه</div>
          </div>
        </div>
      </button>

      {/* ── الأزرار السريعة (مُقلصة) ── */}
      {!expanded && (
        <div className="px-4 pb-3 flex items-center gap-2 border-t border-gray-50 pt-3">
          {(waPhone || phone) && (
            <ProtectedPhoneButton phone={waPhone || phone}>
              <a href={getWhatsAppLink(waPhone || phone, `مرحباً، شفت حمولة ${load.origin} → ${load.destination} على تطبيق كار مصر`)}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors flex-shrink-0">
                <MessageCircle className="w-3.5 h-3.5" /> واتساب
              </a>
            </ProtectedPhoneButton>
          )}
          {phone && (
            <ProtectedPhoneButton phone={phone} className="flex-1">
              <a href={getPhoneLink(phone)}
                className="flex-1 bg-orange hover:bg-orange-dark text-white py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> اتصل للسائق
              </a>
            </ProtectedPhoneButton>
          )}
          <Link to={`/load/${load.id}`}
            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-bold transition-colors flex-shrink-0">
            <Info className="w-3.5 h-3.5" /> التفاصيل
          </Link>
          <span className="text-[10px] text-gray-400 mr-auto">{load.userName || ''}</span>
        </div>
      )}

      {/* ── التفاصيل (موسع) ── */}
      {expanded && (
        <div className="border-t border-gray-100 animate-fadeIn">
          <div className="p-4 space-y-3">
            {/* سعر لكل طن */}
            {pricePerTon && (
              <div className="bg-orange/5 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-orange" /> سعر الطن
                </span>
                <span className="text-base font-black text-orange">{pricePerTon.toLocaleString('ar-EG')} <span className="text-xs font-semibold">ج.م</span></span>
              </div>
            )}

            {/* الشبكة */}
            <div className="grid grid-cols-2 gap-2">
              <InfoBox icon={<Package className="w-3.5 h-3.5" />} label="نوع الحمولة" value={load.cargoType || 'غير محدد'} />
              <InfoBox icon={<Truck className="w-3.5 h-3.5" />} label="نوع العربية" value={load.vehicleType || 'غير محدد'} />
              <InfoBox icon={<Weight className="w-3.5 h-3.5" />} label="الوزن" value={`${load.weight} طن`} />
              <InfoBox icon={<Calendar className="w-3.5 h-3.5" />} label="تاريخ التحميل" value={formatDateDMY(load.date)} />
              {load.distance && <InfoBox icon={<MapPin className="w-3.5 h-3.5" />} label="المسافة" value={`${load.distance} كم`} />}
              {load.loadingTime && <InfoBox icon={<Clock className="w-3.5 h-3.5" />} label="وقت التحميل" value={load.loadingTime} />}
              {load.international && load.originCountry && <InfoBox icon={<span>🌍</span>} label="بلد المنشأ" value={load.originCountry} accent />}
              {load.international && load.destinationCountry && <InfoBox icon={<span>🌍</span>} label="بلد الوصول" value={load.destinationCountry} accent />}
            </div>

            {/* عناوين */}
            {load.pickupAddress && (
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-[10px] text-orange-400 font-bold mb-0.5">عنوان التحميل</p>
                <p className="text-sm text-gray-800">{load.pickupAddress}</p>
              </div>
            )}
            {load.deliveryAddress && (
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-[10px] text-emerald-400 font-bold mb-0.5">عنوان التسليم</p>
                <p className="text-sm text-gray-800">{load.deliveryAddress}</p>
              </div>
            )}

            {/* ملاحظات */}
            {load.paymentTerms && (
              <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2">
                <CreditCard className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">شروط الدفع</p><p className="text-sm text-gray-700">{load.paymentTerms}</p></div>
              </div>
            )}
            {load.loadingInstructions && (
              <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5" />
                <div><p className="text-[10px] text-amber-500 font-bold mb-0.5">تعليمات التحميل</p><p className="text-sm text-amber-800">{load.loadingInstructions}</p></div>
              </div>
            )}
            {load.description && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-bold mb-0.5">وصف إضافي</p>
                <p className="text-sm text-gray-700">{load.description}</p>
              </div>
            )}

            {/* رجعة / تعاقد */}
            {(load.isReturnLoad && load.returnOrigin) && (
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-[10px] text-emerald-500 font-bold mb-0.5 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> حمولة رجعة</p>
                <p className="text-sm text-emerald-800">
                  السائق فاضي في {load.returnOrigin}{load.returnDestination ? ` — عايز رجعة إلى ${load.returnDestination}` : ''}
                </p>
              </div>
            )}
            {load.loadType === 'period' && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-[10px] text-blue-500 font-bold mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> تعاقد</p>
                <p className="text-sm text-blue-800">مطلوب شاحنة للتعاقد {load.periodDays ? `لمدة ${load.periodDays} يوماً` : ''}</p>
              </div>
            )}

            {/* صاحب الحمولة */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 font-bold mb-1.5 flex items-center gap-1"><User className="w-3 h-3" /> صاحب الحمولة</p>
              <p className="text-sm font-bold text-gray-800 mb-2">{load.userName || 'مجهول'}</p>
              <p className="text-[10px] text-gray-400">نشر منذ {formatDateDMY(load.createdAt)}</p>
            </div>

            {/* شاحنات مناسبة (ذكاء اصطناعي) */}
            <AiMatch target="load" id={load.id} title="شاحنات مناسبة للحمولة" />

            {/* خريطة */}
            <button onClick={openMap}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> عرض المسار على الخريطة
            </button>
          </div>

          {/* أزرار التواصل (موسع) */}
          <div className="px-4 pb-4 flex items-center gap-2">
            {(waPhone || phone) && (
              <ProtectedPhoneButton phone={waPhone || phone}>
                <a href={getWhatsAppLink(waPhone || phone, `مرحباً، شفت حمولة ${load.origin} → ${load.destination} على تطبيق كار مصر`)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex-shrink-0">
                  <MessageCircle className="w-4 h-4" /> واتساب
                </a>
              </ProtectedPhoneButton>
            )}
            {phone && (
              <ProtectedPhoneButton phone={phone} className="flex-1">
                <a href={getPhoneLink(phone)}
                  className="flex-1 bg-orange hover:bg-orange-dark text-white py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                  <Phone className="w-4 h-4" /> اتصل بالسائق
                </a>
              </ProtectedPhoneButton>
            )}
            <Link to={`/load/${load.id}`}
              className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex-shrink-0">
              <Info className="w-4 h-4" /> التفاصيل
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 ${accent ? 'bg-blue-50' : 'bg-gray-50'}`}>
      <div className={`flex items-center gap-1 text-[10px] font-bold mb-0.5 ${accent ? 'text-blue-400' : 'text-gray-400'}`}>
        {icon} {label}
      </div>
      <p className={`text-xs font-bold ${accent ? 'text-blue-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}
