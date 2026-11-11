import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Car, Tag, MapPin, Star, ArrowLeft, Scale, Landmark } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import OptimizedImage from '../components/OptimizedImage';
import { listingsService } from '../lib/firestoreService';
import { formatPrice, listingUrl } from '../lib/utils';
import type { Listing } from '../types';

const BRAND_LOGOS: Record<string, string> = {
  Toyota: 'toyota', Nissan: 'nissan', Hyundai: 'hyundai', Kia: 'kia',
  Chevrolet: 'chevrolet', Ford: 'ford', Mitsubishi: 'mitsubishi',
  Mercedes: null as any, BMW: 'bmw', Volkswagen: 'volkswagen',
  Renault: 'renault', Peugeot: 'peugeot', Mazda: 'mazda', Honda: 'honda',
  MG: 'mg', Jeep: 'jeep', Audi: 'audi', Chery: null as any, Skoda: 'skoda',
  BYD: null as any, Haval: null as any, Geely: null as any, 'Land Rover': null as any,
};
const BRAND_DOMAIN: Record<string, string> = {
  Mercedes: 'mercedes-benz.com', Chery: 'cheryauto.com', BYD: 'byd.com',
  Haval: 'haval-global.com', Geely: 'geely.com', 'Land Rover': 'landrover.com',
};

function brandLogoSrc(name: string): string | null {
  const slug = BRAND_LOGOS[name];
  if (slug) return `https://cdn.simpleicons.org/${slug}`;
  const dom = BRAND_DOMAIN[name];
  if (dom) return `https://www.google.com/s2/favicons?domain=${dom}&sz=128`;
  return null;
}

export default function BrandPage() {
  const { brand } = useParams<{ brand: string }>();
  const navigate = useNavigate();
  const name = decodeURIComponent(brand || '');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await listingsService.getAll({ status: 'active' });
        if (!mounted) return;
        const filtered = (all || []).filter(l =>
          (l.brand || '').toLowerCase() === name.toLowerCase() ||
          (l.title || '').toLowerCase().includes(name.toLowerCase())
        );
        setListings(filtered);
      } catch {
        if (mounted) setListings([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [name]);

  const models = useMemo(() => {
    const map = new Map<string, { count: number; min: number; max: number }>();
    for (const l of listings) {
      const m = l.model || 'غير محدد';
      const cur = map.get(m) || { count: 0, min: Infinity, max: 0 };
      cur.count += 1;
      cur.min = Math.min(cur.min, l.price || 0);
      cur.max = Math.max(cur.max, l.price || 0);
      map.set(m, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [listings]);

  const prices = listings.map(l => l.price || 0).filter(p => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  const src = brandLogoSrc(name);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead
        title={`${name} — سيارات للبيع في كار مصر`}
        description={`تصفح سيارات ${name} للبيع في كار مصر. ${listings.length} إعلان، أسعار من ${minPrice} إلى ${maxPrice}.`}
      />
      <div className="bg-gradient-to-br from-[#0B1E3A] to-[#122B4F] text-white py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex items-center gap-5">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center overflow-hidden shadow-lg logo-gloss">
            {src ? (
              <img src={src} alt="" className="w-14 h-14 object-contain" />
            ) : (
              <span className="text-orange font-extrabold text-2xl">{name.slice(0, 2)}</span>
            )}
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold">{name}</h1>
            <p className="text-white/80 mt-1 text-sm sm:text-base">
              {listings.length} إعلان متاح
              {prices.length > 0 && ` • أسعار من ${formatPrice(minPrice)} إلى ${formatPrice(maxPrice)}`}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Models */}
        {models.length > 0 && (
          <section>
            <h2 className="text-lg sm:text-xl font-extrabold text-text mb-4">الموديلات</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {models.map(([model, info]) => (
                <Link
                  key={model}
                  to={`/listings?brand=${encodeURIComponent(name)}&model=${encodeURIComponent(model)}`}
                  className="bg-surface border border-border rounded-2xl p-4 hover:border-orange/50 hover:shadow-md transition-all btn-press"
                >
                  <p className="font-bold text-text">{model}</p>
                  <p className="text-xs text-text-muted mt-1">{info.count} إعلان</p>
                  {info.min > 0 && (
                    <p className="text-xs text-orange font-bold mt-1">
                      {formatPrice(info.min)}{info.max > info.min ? ` – ${formatPrice(info.max)}` : ''}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Listings */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-extrabold text-text">إعلانات {name}</h2>
            <Link to={`/listings?brand=${encodeURIComponent(name)}`} className="text-orange text-sm font-bold flex items-center gap-1 hover:underline">
              عرض الكل <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 rounded-2xl bg-surface border border-border animate-pulse" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-8 text-center text-text-muted">
              <Car className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-semibold">لا توجد إعلانات {name} حالياً</p>
              <Link to="/post-listing" className="inline-block mt-3 text-orange font-bold hover:underline">أضف إعلانك ←</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {listings.slice(0, 12).map(l => (
                <Link
                  key={l.id}
                  to={listingUrl(l.id, l.slug)}
                  className="group bg-surface border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-orange/40 transition-all btn-press"
                >
                  <div className="aspect-[4/3] bg-bg overflow-hidden">
                    {l.images?.[0] ? (
                      <OptimizedImage src={l.images[0]} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted"><Car className="w-10 h-10" /></div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-text text-sm line-clamp-1">{l.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                      {l.year && <span>{l.year}</span>}
                      {l.governorate && <span>• {l.governorate}</span>}
                    </div>
                    <span className="mt-2 block text-orange font-extrabold text-base">
                      {l.priceType === 'call' ? 'اتصل للسعر' : formatPrice(l.price)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Tools */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'تقييم سيارة', to: '/evaluate', icon: Star },
            { label: 'مقارنة', to: '/compare', icon: Scale },
            { label: 'دليل الأسعار', to: '/prices', icon: Tag },
            { label: 'تمويل', to: '/finance', icon: Landmark },
          ].map(t => (
            <Link key={t.label} to={t.to} className="bg-surface border border-border rounded-2xl p-4 text-center hover:border-orange/50 hover:shadow-md transition-all btn-press">
              <t.icon className="w-6 h-6 mx-auto mb-2 text-orange" />
              <p className="font-bold text-text text-sm">{t.label}</p>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
