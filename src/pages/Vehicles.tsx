import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Plus, SlidersHorizontal, X, Bell, Check } from 'lucide-react';
import { ListingCardSkeleton } from '../components/Skeleton';
import Sheet from '../components/Sheet';
import EmptyState from '../components/EmptyState';
import { listingsService, sortByDate } from '../lib/firestoreService';
import { governorates, vehicleBrands } from '../lib/data';
import { alertsService } from '../lib/alerts';
import { useAuth } from '../contexts/AuthContext';
import type { Listing } from '../types';
import ListingCard from '../components/ListingCard';
import CategorySvgIcon from '../components/CategorySvgIcon';
import SeoHead from '../components/SeoHead';

const formatNum = (v: string) => v.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function Vehicles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [alertName, setAlertName] = useState('');
  const [alertMax, setAlertMax] = useState('');
  const [alertStatus, setAlertStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [alertMsg, setAlertMsg] = useState('');

  const category = searchParams.get('category') || '';
  const governorate = searchParams.get('governorate') || '';
  const search = searchParams.get('search') || '';
  const brand = searchParams.get('brand') || '';
  const model = searchParams.get('model') || '';
  const priceMin = searchParams.get('priceMin') || '';
  const priceMax = searchParams.get('priceMax') || '';
  const yearMin = searchParams.get('yearMin') || '';
  const yearMax = searchParams.get('yearMax') || '';

  useEffect(() => {
    setLoading(true);
    listingsService.getAll()
      .then(data => {
        let filtered = data.filter(l =>
          ['active', 'sold'].includes(l.status) &&
          ['trucks', 'equipment', 'trailers', 'buses', 'spare-parts'].includes(l.category)
        );
        if (category) filtered = filtered.filter(l => l.category === category);
        if (governorate) filtered = filtered.filter(l => l.governorate === governorate);
        if (search) filtered = filtered.filter(l =>
          l.title?.toLowerCase().includes(search.toLowerCase()) ||
          l.brand?.toLowerCase().includes(search.toLowerCase())
        );
        if (brand) filtered = filtered.filter(l => l.brand?.toLowerCase().includes(brand.toLowerCase()));
        if (model) filtered = filtered.filter(l => l.model?.toLowerCase().includes(model.toLowerCase()));
        if (priceMin) filtered = filtered.filter(l => l.price >= Number(priceMin));
        if (priceMax) filtered = filtered.filter(l => l.price <= Number(priceMax));
        if (yearMin) filtered = filtered.filter(l => (l.year || 0) >= Number(yearMin));
        if (yearMax) filtered = filtered.filter(l => (l.year || 9999) <= Number(yearMax));
        filtered = sortByDate(filtered);
        setListings(filtered);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category, governorate, search, brand, model, priceMin, priceMax, yearMin, yearMax]);

  const updateFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    value ? p.set(key, value) : p.delete(key);
    setSearchParams(p);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const hasFilters = category || governorate || search || brand || model || priceMin || priceMax || yearMin || yearMax;

  const cats = [
    { id: '', name: 'الكل', icon: '' },
    { id: 'trucks', name: 'شاحنات', icon: 'trucks' },
    { id: 'equipment', name: 'معدات', icon: 'equipment' },
    { id: 'trailers', name: 'مقطورات', icon: 'trailers' },
    { id: 'buses', name: 'حافلات', icon: 'buses' },
    { id: 'spare-parts', name: 'قطع غيار', icon: 'spare-parts' },
  ];

  const catName = cats.find(c => c.id === category)?.name || 'المركبات';

  const openAlertPanel = () => {
    if (!user) { navigate('/login'); return; }
    setAlertName(search || catName);
    setAlertMax(priceMax || '');
    setAlertStatus('idle');
    setAlertMsg('');
    setShowAlertPanel(v => !v);
  };

  const handleSaveSearch = async () => {
    if (!user) { navigate('/login'); return; }
    setAlertStatus('saving');
    const res = await alertsService.saveSearch({
      query: search,
      category,
      governorate,
      brand,
      model,
      maxPrice: alertMax ? Number(alertMax.replace(/[^\d]/g, '')) : null,
      name: alertName.trim() || search || catName,
    });
    if (res.ok) setAlertStatus('saved');
    else { setAlertStatus('error'); setAlertMsg(res.message || 'حدث خطأ، حاول مرة أخرى'); }
  };

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead
        title={`${catName} للبيع في مصر`}
        description={`${catName} مستعملة وجديدة للبيع في مصر. شاهد أحدث إعلانات ${catName} بأسعار تنافسية في جميع المحافظات.`}
      />
      <div className="bg-navy py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">المركبات والمعدات</h1>
            <Link to="/post-listing"
              className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">أضف إعلان</span>
            </Link>
          </div>

          {/* Search + Filter button */}
          <div className="flex gap-2 mb-4">
            <input
              type="text" value={search}
              onChange={e => updateFilter('search', e.target.value)}
              placeholder="ابحث عن شاحنة، معدة..."
              className="flex-1 h-11 px-4 rounded-xl text-sm focus:outline-none focus:border-orange border border-transparent"
            />
            <button onClick={() => setShowFilters(true)}
              className="h-11 px-4 rounded-xl border border-transparent bg-white text-text text-sm font-semibold flex items-center gap-2 transition-colors hover:bg-orange hover:text-white">
              <SlidersHorizontal className="w-4 h-4" /> فلتر
            </button>
            {hasFilters && (
              <button onClick={openAlertPanel} title="حفظ البحث وتنبيه بعروض جديدة"
                className={`h-11 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-colors ${showAlertPanel ? 'bg-orange text-white border-orange' : 'bg-white text-text border-gray-200'}`}>
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">حفظ البحث</span>
              </button>
            )}
            {hasFilters && (
              <button onClick={clearFilters}
                className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-text-light hover:text-danger flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Save search + alert panel */}
          {showAlertPanel && (
            <div className="mt-3 bg-white rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-text text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-orange" /> تنبيه عند ظهور إعلانات جديدة</h3>
                <button onClick={() => setShowAlertPanel(false)} className="text-text-light hover:text-danger"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">اسم البحث</label>
                  <input value={alertName} onChange={e => setAlertName(e.target.value)}
                    placeholder="مثال: أكتوس"
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">الحد الأقصى للسعر (اختياري)</label>
                  <input type="text" inputMode="numeric" dir="ltr" value={alertMax ? formatNum(alertMax) : ""}
                    onChange={e => setAlertMax(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="500,000" className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange text-right" />
                </div>
              </div>
              {alertStatus === 'saved' ? (
                <div className="flex items-center gap-2 text-green-600 text-sm font-bold">
                  <Check className="w-5 h-5" /> تم حفظ البحث بنجاح، سنخطرك فور ظهور إعلانات مطابقة
                </div>
              ) : (
                <button onClick={handleSaveSearch} disabled={alertStatus === 'saving'}
                  className="w-full sm:w-auto bg-orange hover:bg-orange-dark disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                  <Bell className="w-4 h-4" /> {alertStatus === 'saving' ? 'جارٍ الحفظ...' : 'حفظ البحث وتنبيهني'}
                </button>
              )}
              {alertStatus === 'error' && <p className="mt-2 text-sm text-danger">{alertMsg}</p>}
            </div>
          )}

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {cats.map(c => (
              <button key={c.id} onClick={() => updateFilter('category', c.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${category === c.id ? 'bg-orange text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {c.icon && <CategorySvgIcon categoryId={c.icon} className="w-4 h-4" />}
                {c.name}
              </button>
            ))}
          </div>

          {/* Advanced filters — bottom sheet */}
          <Sheet open={showFilters} onClose={() => setShowFilters(false)} title="فلترة النتائج">
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">السعر من</label>
                  <input type="text" inputMode="numeric" dir="ltr" value={priceMin ? formatNum(priceMin) : ""} onChange={e => updateFilter('priceMin', e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^\d]/g, ""))}
                    placeholder="0" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange text-right" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">السعر إلى</label>
                  <input type="text" inputMode="numeric" dir="ltr" value={priceMax ? formatNum(priceMax) : ""} onChange={e => updateFilter('priceMax', e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^\d]/g, ""))}
                    placeholder="10,000,000" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange text-right" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">سنة من</label>
                  <input type="number" value={yearMin} onChange={e => updateFilter('yearMin', e.target.value)}
                    placeholder="2000" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">سنة إلى</label>
                  <input type="number" value={yearMax} onChange={e => updateFilter('yearMax', e.target.value)}
                    placeholder="2026" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">الماركة</label>
                  <select value={brand} onChange={e => updateFilter('brand', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange">
                    <option value="">كل الماركات</option>
                    {vehicleBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">الموديل</label>
                  <input value={model} onChange={e => updateFilter('model', e.target.value)}
                    placeholder="مثال: أكتوس"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-light block mb-1">المحافظة</label>
                  <select value={governorate} onChange={e => updateFilter('governorate', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-orange">
                    <option value="">كل المحافظات</option>
                    {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => setShowFilters(false)}
                  className="flex-1 bg-orange hover:bg-orange-dark text-white h-11 rounded-xl text-sm font-bold transition-colors">
                  عرض {hasFilters ? 'النتائج' : 'الإعلانات'}
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
        ) : listings.length === 0 ? (
          hasFilters ? (
            <EmptyState
              actionLabel="امسح الفلاتر وعرض الكل"
              onAction={clearFilters}
              className="card-surface"
            />
          ) : (
            <EmptyState
              title="لسه مفيش إعلانات هنا"
              description="كن أول من يضيف إعلان في قسم المركبات والمعدات"
              actionLabel="أضف إعلان الآن"
              actionTo="/post-listing"
            />
          )
        ) : (
          <>
            <p className="text-text-light text-sm mb-4">{listings.length} إعلان</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {listings.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
