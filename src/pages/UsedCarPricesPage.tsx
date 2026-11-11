import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Tag, Car, ChevronLeft } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { listingsService } from '../lib/firestoreService';
import { formatPrice } from '../lib/utils';
import type { Listing } from '../types';

export default function UsedCarPricesPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listingsService.getAll({ status: 'active' })
      .then(d => { if (mounted) setListings((d || []).filter(l => l.condition === 'used' || (!l.condition && l.listingType !== 'rent'))); })
      .catch(() => { if (mounted) setListings([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const byBrand = useMemo(() => {
    const map = new Map<string, { count: number; min: number; max: number; sum: number }>();
    for (const l of listings) {
      const b = l.brand || 'غير محدد';
      const cur = map.get(b) || { count: 0, min: Infinity, max: 0, sum: 0 };
      cur.count += 1;
      if (l.price > 0) { cur.min = Math.min(cur.min, l.price); cur.max = Math.max(cur.max, l.price); cur.sum += l.price; }
      map.set(b, cur);
    }
    return [...map.entries()]
      .map(([brand, v]) => ({ brand, ...v, avg: v.count ? Math.round(v.sum / v.count) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [listings]);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead title="أسعار السيارات المستعملة — كار مصر" description="احصل على أفضل العروض ومؤشرات أسعار السيارات المستعملة في مصر." />
      <div className="bg-gradient-to-br from-[#0F172A] via-[#172554] to-[#1D4ED8] text-white py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-4">
            <Link to="/" className="hover:text-orange">الرئيسية</Link><ChevronLeft className="w-4 h-4" /><span className="text-white">أسعار السيارات المستعملة</span>
          </nav>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Tag className="w-8 h-8 text-orange" /> أسعار السيارات المستعملة
          </h1>
          <p className="text-white/80 mt-2">احصل على أفضل العروض ومؤشرات أسعار السيارات المستعملة حسب الماركة.</p>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-surface border border-border animate-pulse" />)}
          </div>
        ) : byBrand.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center text-text-muted">
            <Car className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">لا توجد بيانات أسعار سيارات مستعملة حاليًا</p>
            <Link to="/listings?condition=used" className="inline-block mt-3 text-orange font-bold hover:underline">تصفح السيارات المستعملة ←</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {byBrand.map(b => (
              <Link key={b.brand} to={`/listings?condition=used&brand=${encodeURIComponent(b.brand)}`} className="bg-surface border border-border rounded-2xl p-5 hover:border-orange/50 hover:shadow-md transition-all btn-press">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-text text-lg">{b.brand}</h3>
                  <span className="text-xs bg-orange/10 text-orange font-bold px-2 py-1 rounded-full">{b.count} إعلان</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-text-muted"><span>أقل سعر</span><span className="font-bold text-text">{b.min !== Infinity ? formatPrice(b.min) : '—'}</span></div>
                  <div className="flex justify-between text-text-muted"><span>متوسط</span><span className="font-bold text-orange">{b.avg ? formatPrice(b.avg) : '—'}</span></div>
                  <div className="flex justify-between text-text-muted"><span>أعلى سعر</span><span className="font-bold text-text">{b.max ? formatPrice(b.max) : '—'}</span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
