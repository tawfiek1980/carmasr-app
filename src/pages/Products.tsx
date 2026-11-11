import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Package, Loader2, Search, X, MapPin, Phone, Share2, Store, Camera, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { exhibitionsService } from '../lib/firestoreService';
import ListingCard from '../components/ListingCard';
import { productToListing } from '../lib/productCard';
import type { ExhibitionProduct } from '../types';
import { getSiteUrl } from '../lib/config';
import { optimizeImage } from '../lib/imageUtils';
import { cleanText } from '../lib/utils';

const categories = ['معدات نقل', 'قطع غيار', 'إطارات', 'زيوت ووقود', 'معدات ثقيلة', 'كماليات', 'خدمات', 'أخرى'];

type SortKey = 'newest' | 'priceAsc' | 'priceDesc' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'الأحدث' },
  { key: 'priceAsc', label: 'السعر: الأقل أولاً' },
  { key: 'priceDesc', label: 'السعر: الأعلى أولاً' },
  { key: 'name', label: 'الاسم أ-ي' },
];

const parsePrice = (p?: string): number => {
  if (!p) return 0;
  const digits = p.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
};

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ExhibitionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('newest');

  const searchQuery = searchParams.get('q') || '';
  const categoryFilter = searchParams.get('category') || '';
  const governorateFilter = searchParams.get('gov') || '';
  const conditionFilter = searchParams.get('condition') || '';
  const soldFilter = searchParams.get('sold') || '';

  useEffect(() => {
    exhibitionsService.getAllProducts()
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => { if (p.category) map[p.category] = (map[p.category] || 0) + 1; });
    return map;
  }, [products]);

  const governorateOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.governorate) set.add(p.governorate); });
    return Array.from(set);
  }, [products]);

  const filtered = useMemo(() => {
    let result = [...products];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        cleanText(p.name).toLowerCase().includes(q) ||
        cleanText(p.description).toLowerCase().includes(q) ||
        cleanText(p.category).toLowerCase().includes(q) ||
        cleanText(p.exhibitionName).toLowerCase().includes(q) ||
        cleanText(p.governorate).toLowerCase().includes(q)
      );
    }
    if (categoryFilter) result = result.filter(p => p.category === categoryFilter);
    if (governorateFilter) result = result.filter(p => p.governorate === governorateFilter);
    if (conditionFilter) result = result.filter(p => (p.condition || 'used') === conditionFilter);
    if (soldFilter === 'hide') result = result.filter(p => p.status !== 'sold');
    if (soldFilter === 'only') result = result.filter(p => p.status === 'sold');
    switch (sort) {
      case 'newest':
        result.sort((a, b) => {
          const ta = (a.createdAt as any)?.seconds || (a.createdAt as any)?.toMillis?.() || new Date(a.createdAt || 0).getTime();
          const tb = (b.createdAt as any)?.seconds || (b.createdAt as any)?.toMillis?.() || new Date(b.createdAt || 0).getTime();
          return Number(tb) - Number(ta);
        });
        break;
      case 'priceAsc':
        result.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
        break;
      case 'priceDesc':
        result.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
        break;
      case 'name':
        result.sort((a, b) => cleanText(a.name).localeCompare(cleanText(b.name), 'ar'));
        break;
    }
    return result;
  }, [products, searchQuery, categoryFilter, governorateFilter, conditionFilter, soldFilter, sort]);

  const updateFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p);
  };

  const shareProduct = (prod: ExhibitionProduct) => {
    const shareUrl = `/api/share?type=product&id=${prod.id}`;
    const text = `🛒 ${prod.name}\n${prod.price ? `💰 ${prod.price}\n` : ''}📍 ${cleanText(prod.governorate)}\n📞 ${prod.exhibitionPhone || ''}`;
    if (navigator.share) {
      navigator.share({ title: prod.name, text, url: `${getSiteUrl()}${shareUrl}` }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send/?text=${encodeURIComponent(text + '\n' + getSiteUrl() + shareUrl)}`, '_blank');
    }
  };

  const hasFilters = searchQuery || categoryFilter || governorateFilter || conditionFilter || soldFilter;

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-gradient-to-l from-navy to-navy-light py-6 sm:py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">كل المنتجات</h1>
          <p className="text-gray-300 text-sm mt-1">جميع منتجات المعارض على المنصة — {products.length} منتج</p>

          <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-2 mt-4">
            <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
            <input value={searchQuery} onChange={e => updateFilter('q', e.target.value)}
              placeholder="ابحث في المنتجات..."
              className="bg-transparent w-full text-white placeholder:text-white/40 text-sm focus:outline-none" />
            {searchQuery && (
              <button onClick={() => updateFilter('q', '')} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-3">
            <button onClick={() => updateFilter('category', '')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                !categoryFilter ? 'bg-orange text-white' : 'bg-white/10 text-white/70 hover:text-white'
              }`}>الكل ({products.length})</button>
            {categories.map(cat => (
              <button key={cat} onClick={() => updateFilter('category', cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  categoryFilter === cat ? 'bg-orange text-white' : 'bg-white/10 text-white/70 hover:text-white'
                }`}>{cat} ({categoryCounts[cat] || 0})</button>
            ))}
            <div className="mr-auto flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-white/60" />
              <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
                className="bg-transparent text-white/70 text-xs focus:outline-none">
                {SORTS.map(s => <option key={s.key} value={s.key} className="bg-navy text-white">{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <select value={governorateFilter} onChange={e => updateFilter('gov', e.target.value)}
              className="bg-white/10 text-white/80 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none">
              <option value="" className="bg-navy text-white">كل المحافظات</option>
              {governorateOptions.map(g => <option key={g} value={g} className="bg-navy text-white">{g}</option>)}
            </select>
            <select value={conditionFilter} onChange={e => updateFilter('condition', e.target.value)}
              className="bg-white/10 text-white/80 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none">
              <option value="" className="bg-navy text-white">كل الحالات</option>
              <option value="new" className="bg-navy text-white">جديد</option>
              <option value="used" className="bg-navy text-white">مستعمل</option>
            </select>
            <select value={soldFilter} onChange={e => updateFilter('sold', e.target.value)}
              className="bg-white/10 text-white/80 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none">
              <option value="" className="bg-navy text-white">الكل (مباع ومتاح)</option>
              <option value="hide" className="bg-navy text-white">إخفاء المباع</option>
              <option value="only" className="bg-navy text-white">المباع فقط</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-text mb-2">{hasFilters ? 'لا توجد نتائج' : 'لا توجد منتجات'}</h2>
            <p className="text-text-light text-sm">{hasFilters ? 'حاول تغيير بحثك' : 'لم يتم إضافة منتجات بعد'}</p>
            {hasFilters && (
              <button onClick={() => setSearchParams(new URLSearchParams())}
                className="mt-4 bg-bg border border-border text-text px-6 py-2.5 rounded-xl font-bold text-sm transition-colors">
                إعادة ضبط الفلاتر
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(prod => (
                <ListingCard key={prod.id} listing={productToListing(prod)} href={`/product/${prod.id}`} />
              ))}
            </div>

            <p className="text-center text-xs text-text-light mt-6">{filtered.length} منتج</p>
          </>
        )}
      </div>
    </div>
  );
}
