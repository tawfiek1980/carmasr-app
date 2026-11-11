import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Car, ChevronLeft, KeyRound } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import OptimizedImage from '../components/OptimizedImage';
import { listingsService } from '../lib/firestoreService';
import { formatPrice, listingUrl } from '../lib/utils';
import type { Listing } from '../types';

export default function RentCarsPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listingsService.getAll({ status: 'active' })
      .then(d => {
        if (!mounted) return;
        const rents = (d || []).filter(l => l.listingType === 'rent');
        setItems(rents);
      })
      .catch(() => { if (mounted) setItems([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead title="سيارات للإيجار — كار مصر" description="تصفح سيارات للإيجار، قارن الأسعار، وتواصل مع المعلن مباشرة." />
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-white py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-4">
            <Link to="/" className="hover:text-orange">الرئيسية</Link><ChevronLeft className="w-4 h-4" /><span className="text-white">سيارات للإيجار</span>
          </nav>
          <span className="inline-flex items-center gap-1 bg-orange text-white text-xs font-extrabold px-2.5 py-1 rounded-full mb-3">جديد</span>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Calendar className="w-8 h-8 text-orange" /> سيارات للإيجار
          </h1>
          <p className="text-white/80 mt-2 max-w-2xl">تصفح سيارات للإيجار، قارن الأسعار، وتواصل مع المعلن مباشرة.</p>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-text">إعلانات الإيجار المتاحة</h2>
          <Link to="/listings?listingType=rent" className="text-orange text-sm font-bold hover:underline">عرض الكل</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[260px] rounded-2xl bg-surface border border-border animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center text-text-muted">
            <KeyRound className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">لا توجد سيارات للإيجار حاليًا</p>
            <Link to="/post-listing" className="inline-block mt-3 text-orange font-bold hover:underline">أضف إعلان إيجار ←</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map(l => (
              <Link key={l.id} to={listingUrl(l.id, l.slug)} className="group bg-surface border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-orange/40 transition-all">
                <div className="aspect-[4/3] bg-bg overflow-hidden relative">
                  {l.images?.[0] ? <OptimizedImage src={l.images[0]} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center"><Car className="w-10 h-10 text-text-muted" /></div>}
                  <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">إيجار</span>
                </div>
                <div className="p-3.5">
                  <h3 className="font-extrabold text-text line-clamp-1">{l.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5">{[l.brand, l.year, l.governorate].filter(Boolean).join(' • ')}</p>
                  <p className="text-orange font-extrabold text-lg mt-2">
                    {l.dailyPrice ? `${formatPrice(l.dailyPrice)} / يوم` : l.monthlyPrice ? `${formatPrice(l.monthlyPrice)} / شهر` : l.priceType === 'call' ? 'اتصل للسعر' : formatPrice(l.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
