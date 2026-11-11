import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2, Loader2, MapPin, Phone, ChevronDown, ChevronUp, Search, X,
  SlidersHorizontal, Users, Crown, Store, Eye, Share2, Calendar, Shield,
  Info, Package, Clock, ArrowUpDown, Star, Sparkles, Rocket, Truck,
} from 'lucide-react';
import { exhibitionsService } from '../lib/firestoreService';
import { governorates } from '../lib/data';
import { formatDateDMY, cleanText } from '../lib/utils';
import { EXHIBITION_PLANS } from '../lib/plans';
import { getSiteUrl } from '../lib/config';
import { bumpExhibitionContact } from '../lib/exhibitionStats';
import { optimizeImage } from '../lib/imageUtils';
import ProtectedPhoneButton from '../components/ProtectedPhoneButton';
import SeoHead from '../components/SeoHead';
import type { Exhibition } from '../types';

const planConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; price: number; rank: number }> =
  Object.fromEntries(
    EXHIBITION_PLANS.map(p => [p.id, { label: p.name, color: p.textColor, bg: p.bg, icon: p.icon, price: p.price, rank: p.rank }])
  );

type SortKey = 'newest' | 'products' | 'name' | 'plan';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'plan', label: 'الأبرز (VIP أولاً)' },
  { key: 'newest', label: 'الأحدث' },
  { key: 'products', label: 'الأكثر منتجات' },
  { key: 'name', label: 'الاسم أ-ي' },
];

export default function Exhibitions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('plan');
  const [counts, setCounts] = useState<Record<string, number>>({});

  const searchQuery  = searchParams.get('q') || '';
  const governorate = searchParams.get('governorate') || '';
  const planFilter  = searchParams.get('plan') || '';
  const category    = searchParams.get('category') || '';

  useEffect(() => {
    exhibitionsService.getActive()
      .then(setExhibitions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    exhibitionsService.getAllProducts()
      .then(prods => {
        const map: Record<string, number> = {};
        prods.forEach(p => { if (p.exhibitionId) map[p.exhibitionId] = (map[p.exhibitionId] || 0) + 1; });
        setCounts(map);
      })
      .catch(() => {});
  }, []);

  const countFor = (ex: Exhibition) => ex.productCount ?? counts[ex.id] ?? 0;

  const filtered = useMemo(() => {
    let result = [...exhibitions];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ex =>
        cleanText(ex.name).toLowerCase().includes(q) ||
        cleanText(ex.description).toLowerCase().includes(q) ||
        cleanText(ex.governorate).toLowerCase().includes(q) ||
        cleanText(ex.city).toLowerCase().includes(q)
      );
    }
    if (governorate) result = result.filter(ex => cleanText(ex.governorate) === governorate);
    if (planFilter)  result = result.filter(ex => ex.plan === planFilter);
    if (category)    result = result.filter(ex => (ex.category || 'general') === category);

    switch (sort) {
      case 'plan':
        result.sort((a, b) =>
          (planConfig[b.plan]?.rank ?? 0) - (planConfig[a.plan]?.rank ?? 0) ||
          countFor(b) - countFor(a) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'products':
        result.sort((a, b) => countFor(b) - countFor(a));
        break;
      case 'name':
        result.sort((a, b) => cleanText(a.name).localeCompare(cleanText(b.name), 'ar'));
        break;
    }
    return result;
  }, [exhibitions, searchQuery, governorate, planFilter, category, sort, counts]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const byPlan: Record<string, number> = {};
    filtered.forEach(ex => { byPlan[ex.plan] = (byPlan[ex.plan] || 0) + 1; });
    const topPlan = Object.entries(byPlan).sort((a, b) => b[1] - a[1])[0];
    const totalProducts = filtered.reduce((sum, ex) => sum + countFor(ex), 0);
    return {
      total: filtered.length,
      topPlan: topPlan ? planConfig[topPlan[0]]?.label || '' : '',
      topPlanCount: topPlan?.[1] || 0,
      governorates: new Set(filtered.map(ex => cleanText(ex.governorate))).size,
      products: totalProducts,
    };
  }, [filtered, counts]);

  const updateFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p);
  };

  const clearFilters = () => setSearchParams(new URLSearchParams());
  const hasFilters = searchQuery || governorate || planFilter || category;

  return (
    <div className="min-h-screen bg-bg">
      <SeoHead
        title="معارض السيارات والسيارات الثقيلة"
        description="تصفح معارض السيارات والسيارات الثقيلة والسيارات في مصر — اعرض منتجاتك وخدماتك في معرضك الخاص وتواصل مع المشترين مباشرة."
        ogType="website"
        canonical={`${getSiteUrl()}/exhibitions`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'معارض كار مصر CarMasr',
          description: 'معارض السيارات والسيارات الثقيلة في مصر',
          url: `${getSiteUrl()}/exhibitions`,
        }}
      />
      <div className="bg-gradient-to-l from-navy to-navy-light py-6 sm:py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">المعارض</h1>
              <p className="text-gray-300 text-sm mt-1">اعرض منتجاتك وخدماتك في معرضك الخاص</p>
            </div>
            <Link to="/exhibitions/subscribe"
              className="flex items-center gap-2 bg-orange hover:bg-orange-dark text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap">
              <Building2 className="w-4 h-4" /> اشترك في معرض
            </Link>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
            <input value={searchQuery} onChange={e => updateFilter('q', e.target.value)}
              placeholder="ابحث في المعارض (الاسم، المحافظة، الوصف...)"
              className="bg-transparent w-full text-white placeholder:text-white/40 text-sm focus:outline-none" />
            {searchQuery && (
              <button onClick={() => updateFilter('q', '')} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-1 bg-white/10 rounded-xl p-0.5 mb-3 w-fit">
            {[
              { id: '', label: 'كل المعارض' },
              { id: 'general', label: 'معارض عامة' },
              { id: 'import', label: 'معارض الاستيراد' },
            ].map(c => (
              <button key={c.id || 'all'} onClick={() => updateFilter('category', c.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  category === c.id ? 'bg-white text-navy' : 'text-white/70 hover:text-white'
                }`}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-white/10 rounded-xl p-0.5">
              {['', 'free', 'basic', 'premium', 'vip'].map(p => {
                const cfg = p ? planConfig[p] : null;
                return (
                  <button key={p} onClick={() => updateFilter('plan', p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      planFilter === p ? 'bg-orange text-white' : 'text-white/70 hover:text-white'
                    }`}>
                    {cfg ? <>{cfg.label}</> : 'الكل'}
                  </button>
                );
              })}
            </div>
            <select value={governorate} onChange={e => updateFilter('governorate', e.target.value)}
              className="bg-white/10 text-white/70 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none">
              <option value="" className="bg-navy text-white">كل المحافظات</option>
              {governorates.map(g => <option key={g.id} value={g.name} className="bg-navy text-white">{g.name}</option>)}
            </select>
            <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-white/60" />
              <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
                className="bg-transparent text-white/70 text-xs focus:outline-none">
                {SORTS.map(s => <option key={s.key} value={s.key} className="bg-navy text-white">{s.label}</option>)}
              </select>
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                showFilters || hasFilters ? 'bg-orange text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              فلتر
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 bg-white/10 rounded-2xl p-3">
              <div className="flex flex-wrap gap-2">
                {hasFilters && (
                  <button onClick={clearFilters}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 text-white hover:bg-white/25 transition-colors">
                    إعادة ضبط الفلاتر
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link to="/exhibitions/subscribe" className="block mb-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-orange to-orange-dark p-5 sm:p-6 text-white shadow-lg shadow-orange/20 hover:shadow-orange/30 transition-shadow">
            <div className="absolute -left-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute -left-2 top-10 w-16 h-16 rounded-full bg-white/5" />
            <div className="relative flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Rocket className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-black text-lg">معندكش معرض؟ ابدأ معرضك المجاني الآن</h2>
                  <p className="text-white/90 text-xs mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Store className="w-3.5 h-3.5" /> معرض رقمي خاص</span>
                    <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> حتى 5 منتجات</span>
                    <span className="flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> رابط مشاركة</span>
                  </p>
                </div>
              </div>
              <span className="bg-white text-orange-dark font-bold text-sm px-5 py-2.5 rounded-xl whitespace-nowrap flex items-center gap-2">
                <Building2 className="w-4 h-4" /> أنشئ معرضك مجاناً
              </span>
            </div>
          </div>
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-10 sm:p-12 text-center">
            <div className="w-20 h-20 rounded-3xl bg-orange/10 flex items-center justify-center mx-auto mb-5">
              <Store className="w-10 h-10 text-orange" />
            </div>
            <h2 className="text-xl font-black text-text mb-2">لا توجد معارض بعد</h2>
            <p className="text-text-light text-sm mb-6 max-w-md mx-auto">كن أول من ينشئ معرضه على كار مصر واعرض منتجاتك وخدماتك لآلاف العملاء مجاناً.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-6">
              {[
                { icon: Store, title: 'معرض رقمي خاص', desc: 'باسمك وشعارك ورابط خاص' },
                { icon: Package, title: 'حتى 5 منتجات', desc: 'أضف منتجاتك بصور وسعر' },
                { icon: Share2, title: 'رابط مشاركة', desc: 'شاركه على واتساب وفيسبوك' },
              ].map((b, i) => {
                const BIcon = b.icon;
                return (
                  <div key={i} className="bg-gray-50 rounded-2xl p-4 text-right">
                    <BIcon className="w-5 h-5 text-orange mb-2" />
                    <p className="text-sm font-bold text-text">{b.title}</p>
                    <p className="text-xs text-text-light mt-0.5">{b.desc}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {hasFilters && (
                <button onClick={clearFilters}
                  className="bg-bg border border-border text-text px-6 py-2.5 rounded-xl font-bold text-sm transition-colors">
                  إعادة ضبط الفلاتر
                </button>
              )}
              <Link to="/exhibitions/subscribe"
                className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors inline-flex items-center gap-2">
                <Rocket className="w-4 h-4" /> أنشئ معرضك مجاناً
              </Link>
            </div>
          </div>
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <Store className="w-3.5 h-3.5" /> إجمالي المعارض
                  </div>
                  <p className="text-lg font-black text-text">{stats.total}</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <Package className="w-3.5 h-3.5" /> المنتجات
                  </div>
                  <p className="text-lg font-black text-orange">{stats.products}</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <MapPin className="w-3.5 h-3.5" /> محافظات
                  </div>
                  <p className="text-lg font-black text-text">{stats.governorates}</p>
                </div>
                {stats.topPlan && (
                  <div className="bg-white rounded-xl border border-border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                      <Users className="w-3.5 h-3.5" /> الأكثر
                    </div>
                    <p className="text-lg font-black text-text truncate">{stats.topPlan}</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-text-light text-sm mb-4">{filtered.length} معرض</p>

            {sort === 'plan' && !planFilter && filtered.filter(ex => ex.plan === 'vip').length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 text-amber-700">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-sm">معارض VIP — أعلى ترتيب وأوسع ظهور</h3>
                </div>
                {filtered.filter(ex => ex.plan === 'vip').map(ex => (
                  <ExhibitionCard key={ex.id} exhibition={ex} productCount={countFor(ex)}
                    expanded={expandedId === ex.id}
                    onToggle={() => setExpandedId(expandedId === ex.id ? null : ex.id)} />
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.filter(ex => !(sort === 'plan' && !planFilter && ex.plan === 'vip')).map(ex => (
                <ExhibitionCard key={ex.id} exhibition={ex} productCount={countFor(ex)}
                  expanded={expandedId === ex.id}
                  onToggle={() => setExpandedId(expandedId === ex.id ? null : ex.id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ExhibitionCard({ exhibition: ex, productCount, expanded, onToggle }: {
  exhibition: Exhibition; productCount: number; expanded: boolean; onToggle: () => void;
}) {
  const cfg = planConfig[ex.plan] || planConfig.basic;
  const Icon = cfg.icon;
  const featured = ex.plan === 'vip';
  const premium = ex.plan === 'premium';
  const basic = ex.plan === 'basic';
  const createdAtMs = new Date(ex.createdAt).getTime();
  // eslint-disable-next-line react-hooks/purity
  const isNew = createdAtMs > 0 && (Date.now() - createdAtMs) < 48 * 3600 * 1000;

  const shareExhibition = () => {
    const url = `${getSiteUrl()}/exhibitions/${ex.id}`;
    const text = `🏪 معرض ${cleanText(ex.name)} على كار مصر\n${cleanText(ex.description) ? cleanText(ex.description) + '\n' : ''}📍 ${cleanText(ex.governorate)}${ex.city ? ` - ${cleanText(ex.city)}` : ''}\n📞 ${ex.contactPhone}\n${url}`;
    if (navigator.share) {
      navigator.share({ title: `معرض ${cleanText(ex.name)}`, text, url }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  return (
    <div className={`bg-surface rounded-2xl border-2 overflow-hidden transition-all ${
      featured ? 'border-amber-400 ring-2 ring-amber-100 shadow-lg shadow-amber-100' : premium ? 'border-orange-400 ring-1 ring-orange-100 shadow-md' : basic ? 'border-gray-300 shadow-sm' : expanded ? 'border-orange/40 shadow-lg' : 'border-border hover:shadow-md hover:border-orange/20'
    }`}>
      {featured && (
        <div className="bg-gradient-to-l from-amber-400 to-amber-500 text-white text-center text-[11px] font-bold py-1 flex items-center justify-center gap-1">
          <Crown className="w-3 h-3" /> معرض VIP متميز
        </div>
      )}
      {premium && !featured && (
        <div className="bg-gradient-to-l from-orange to-orange-dark text-white text-center text-[11px] font-bold py-1 flex items-center justify-center gap-1">
          <Star className="w-3 h-3" /> أكثر طلباً
        </div>
      )}
      <button onClick={onToggle} className="w-full text-right">
        {ex.coverImage ? (
          <div className="relative h-32 overflow-hidden">
            <img src={optimizeImage(ex.coverImage, 'medium')} alt="" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className={`absolute top-2 right-2 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md ${
              featured ? 'bg-gradient-to-l from-amber-400 to-amber-500' : premium ? 'bg-orange' : 'bg-navy/80'
            }`}>
              <Icon className="w-3 h-3" /> {cfg.label}{cfg.price ? ` • ${cfg.price} ج` : ''}
            </span>
            <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Package className="w-3 h-3" /> {productCount} منتج
            </span>
          </div>
        ) : (
          <div className={`h-20 ${featured ? 'bg-gradient-to-l from-amber-100 to-amber-50' : premium ? 'bg-gradient-to-l from-orange/10 to-orange/5' : 'bg-gradient-to-l from-orange/10 to-transparent'}`} />
        )}

        <div className={`${ex.coverImage ? 'px-4 pb-3 -mt-10 relative z-10' : 'p-4 pb-2'}`}>
          <div className="flex items-center gap-3">
            {ex.logo ? (
              <img src={optimizeImage(ex.logo, 'thumb')} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-md flex-shrink-0" />
            ) : (
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg border-2 border-white shadow-md flex-shrink-0 ${featured ? 'bg-amber-100 text-amber-700' : 'bg-orange/10 text-orange'}`}>
                {cleanText(ex.name)[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-text truncate">{cleanText(ex.name)}</h3>
                {isNew && (
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0">
                    <Sparkles className="w-3 h-3" /> جديد
                  </span>
                )}
                {ex.category === 'import' && (
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0">
                    <Truck className="w-3 h-3" /> استيراد
                  </span>
                )}
                <span className={`${cfg.bg} ${cfg.color} text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0`}>
                  <Icon className="w-3 h-3" /> {cfg.label}
                </span>
              </div>
              <p className="text-text-light text-xs mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {cleanText(ex.governorate)}{ex.city ? ` - ${cleanText(ex.city)}` : ''}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-text-light">
                <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {productCount} منتج</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDateDMY(ex.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-gray-300 flex-shrink-0">
              <span className="text-xs">{expanded ? 'أقل' : 'تفاصيل'}</span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border animate-fadeIn">
          <div className="px-4 py-4 space-y-3">
            {ex.description && (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                  <Info className="w-3.5 h-3.5" /> عن المعرض
                </div>
                <p className="text-sm text-text whitespace-pre-wrap">{ex.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                  <MapPin className="w-3.5 h-3.5" /> الموقع
                </div>
                <p className="text-sm font-bold text-text">{cleanText(ex.governorate)}{ex.city ? ` - ${cleanText(ex.city)}` : ''}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                  <Package className="w-3.5 h-3.5" /> المنتجات
                </div>
                <p className="text-sm font-bold text-text">{productCount} منتج</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                  <Calendar className="w-3.5 h-3.5" /> تاريخ الإنشاء
                </div>
                <p className="text-sm font-bold text-text">{formatDateDMY(ex.createdAt)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                  <Shield className="w-3.5 h-3.5" /> الباقة
                </div>
                <p className="text-sm font-bold text-text flex items-center gap-1">
                  <Icon className="w-4 h-4" /> {cfg.label}
                </p>
              </div>
              {ex.workingHours && (
                <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <Clock className="w-3.5 h-3.5" /> ساعات العمل
                  </div>
                  <p className="text-sm font-bold text-text">{ex.workingHours}</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                <Phone className="w-3.5 h-3.5" /> التواصل
              </div>
              <ProtectedPhoneButton phone={ex.contactPhone}>
                <p className="text-sm font-bold text-text" dir="ltr">{ex.contactPhone}</p>
              </ProtectedPhoneButton>
            </div>

            {ex.expiresAt && (
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-1">
                  <Calendar className="w-3.5 h-3.5" /> تاريخ الانتهاء
                </div>
                <p className="text-sm font-bold text-amber-800">{formatDateDMY(ex.expiresAt)}</p>
              </div>
            )}
          </div>

          <div className="px-4 pb-4 flex items-center gap-2">
            <ProtectedPhoneButton phone={ex.contactPhone} className="flex-1">
              <a href={`tel:${ex.contactPhone}`} onClick={() => bumpExhibitionContact(ex.id)}
                className="flex-1 bg-orange hover:bg-orange-dark text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" /> اتصل بالمعرض
              </a>
            </ProtectedPhoneButton>
            <Link to={`/exhibitions/${ex.id}`}
              className="flex-1 bg-surface border border-border hover:bg-gray-50 text-text py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
              <Eye className="w-4 h-4" /> عرض المعرض
            </Link>
            <button onClick={shareExhibition}
              className="w-10 h-10 rounded-xl border border-border hover:bg-gray-50 flex items-center justify-center text-text-light hover:text-orange transition-colors flex-shrink-0"
              title="مشاركة المعرض">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!expanded && (
        <div className="px-4 pb-4">
          {ex.description && (
            <p className="text-text-light text-xs mb-3 line-clamp-2">{cleanText(ex.description)}</p>
          )}
          <div className="flex items-center gap-2">
            <ProtectedPhoneButton phone={ex.contactPhone}>
              <div className="flex items-center gap-1.5 text-xs text-text-light ml-auto">
                <Phone className="w-3 h-3" /> {ex.contactPhone}
              </div>
            </ProtectedPhoneButton>
          </div>
        </div>
      )}
    </div>
  );
}
