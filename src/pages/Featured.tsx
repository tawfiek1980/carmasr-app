import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Truck, Loader2, X } from 'lucide-react';
import { listingsService } from '../lib/firestoreService';
import { governorates } from '../lib/data';
import type { Listing } from '../types';
import ListingCard from '../components/ListingCard';

const cats = [
  { id: '', name: 'الكل' },
  { id: 'trucks', name: 'سيارات' },
  { id: 'equipment', name: 'سيارات' },
  { id: 'trailers', name: 'سيارات' },
  { id: 'buses', name: 'حافلات' },
  { id: 'spare-parts', name: 'قطع غيار' },
];

export default function Featured() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [governorate, setGovernorate] = useState('');

  useEffect(() => {
    listingsService.getFeatured()
      .then(setListings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = listings.filter(l =>
    (!category || l.category === category) &&
    (!governorate || l.governorate === governorate)
  );
  const hasFilters = Boolean(category || governorate);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-gradient-to-l from-orange to-orange-dark py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Star className="w-4 h-4 fill-white" /> مميز
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-3">الإعلانات المميزة</h1>
          <p className="text-white/80 text-sm sm:text-base max-w-xl mx-auto">
            أفضل العروض والإعلانات المختارة بعناية من بائعين موثوقين
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
            {cats.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${category === c.id ? 'bg-orange text-white' : 'bg-surface border border-border text-text-light hover:border-orange'}`}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select value={governorate} onChange={e => setGovernorate(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-surface text-sm focus:outline-none focus:border-orange">
              <option value="">كل المحافظات</option>
              {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
            {hasFilters && (
              <button onClick={() => { setCategory(''); setGovernorate(''); }}
                className="h-10 w-10 rounded-xl border border-border bg-surface text-text-light hover:text-danger flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Star className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text mb-2">لا توجد إعلانات مميزة حالياً</h3>
            <p className="text-text-light text-sm mb-6">تابعنا قريباً للمزيد</p>
            <Link to="/vehicles"
              className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">
              تصفح كل الإعلانات
            </Link>
          </div>
        ) : (
          <>
            <p className="text-text-light text-sm mb-4">{filtered.length} إعلان مميز</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(l => <ListingCard key={l.id} listing={l} featured />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
