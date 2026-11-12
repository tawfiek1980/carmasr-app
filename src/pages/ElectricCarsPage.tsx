import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Car, ChevronLeft, BatteryCharging, Leaf } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import OptimizedImage from '../components/OptimizedImage';
import { listingsService } from '../lib/firestoreService';
import { formatPrice, listingUrl } from '../lib/utils';
import type { Listing } from '../types';

export default function ElectricCarsPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listingsService.getAll({ status: 'active' })
      .then(d => {
        if (!mounted) return;
        const all = d || [];
        const electric = all.filter(l => /electric|كهرب|ev/i.test(`${l.title} ${l.description || ''} ${l.fuel || ''} ${l.brand || ''} ${l.model || ''}`));
        setItems(electric.length ? electric : all.slice(0, 12));
      })
      .catch(() => { if (mounted) setItems([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead title="سيارات كهربائية — كار مصر" description="استكشف السيارات الكهربائية المتاحة، واعرف مزاياها وابحث عن الأنسب لك." />
      <div className="bg-gradient-to-br from-[#062c2a] via-[#0b3b3a] to-[#0f766e] text-white py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-4">
            <Link to="/" className="hover:text-orange">الرئيسية</Link><ChevronLeft className="w-4 h-4" /><span className="text-white">سيارات كهربائية</span>
          </nav>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-300" /> سيارات كهربائية
          </h1>
          <p className="text-white/80 mt-2 max-w-2xl">استكشف أفضل السيارات الكهربائية، واعرف مزاياها، وابحث عن الخيارات المتاحة.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold"><Leaf className="w-3.5 h-3.5" /> صديقة للبيئة</span>
            <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold"><BatteryCharging className="w-3.5 h-3.5" /> تكلفة تشغيل أقل</span>
          </div>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-text">سيارات متاحة</h2>
          <Link to="/listings?q=electric" className="text-orange text-sm font-bold hover:underline">بحث متقدم</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[260px] rounded-2xl bg-surface border border-border animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center text-text-muted">
            <Car className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">لا توجد إعلانات متاحة حاليًا</p>
            <Link to="/post-listing" className="inline-block mt-3 text-orange font-bold hover:underline">أضف إعلان ←</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map(l => (
              <Link key={l.id} to={listingUrl(l.id, l.slug)} className="group bg-surface border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-orange/40 transition-all">
                <div className="aspect-[4/3] bg-bg overflow-hidden">
                  {l.images?.[0] ? <OptimizedImage src={l.images[0]} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center"><Car className="w-10 h-10 text-text-muted" /></div>}
                </div>
                <div className="p-3.5">
                  <h3 className="font-extrabold text-text line-clamp-1">{l.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5">{[l.brand, l.year].filter(Boolean).join(' • ')}</p>
                  <p className="text-orange font-extrabold text-lg mt-2">{l.priceType === 'call' ? 'اتصل للسعر' : formatPrice(l.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
