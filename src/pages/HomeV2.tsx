import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Landmark, Wrench, Cog,
  ChevronLeft, ArrowLeft, Heart, MapPin, Siren, User, ArrowLeftRight,
  Phone, Facebook, ExternalLink, Megaphone, Store, Star, Sun, Moon, Plus,
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import OptimizedImage from '../components/OptimizedImage';
import ImageWatermark from '../components/ImageWatermark';
import EmptyState from '../components/EmptyState';
import { ListingRailSkeleton, LoadRailSkeleton } from '../components/Skeleton';
import { TruckIcon, LoadsIcon, JobsIcon, WorkshopIcon, SparePartsIcon, FinanceIcon } from '../components/CategoryIcons';
import { listingsService, loadsService, bannerAdsService, exhibitionsService } from '../lib/firestoreService';
import { formatPrice, listingUrl, exhibitionUrl, displayPrice } from "../lib/utils";
import { isAvailable, isSold, filterAvailable } from "../lib/listingStatus";
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { trackEvent } from '../lib/analytics';
import { watermarkImage, optimizeImage, getImageSrcSet } from '../lib/imageUtils';
import type { Listing, Load, BannerAd, Exhibition } from '../types';

/* ────────────────────────── Header ────────────────────────── */
function HomeV2Header() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between h-[72px] px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/app-icon-128.png" alt="كار مصر" className="h-11 w-11 rounded-2xl object-cover" />
          <div className="flex flex-col">
            <span className="text-text font-extrabold text-xl leading-none">كار مصر</span>
            <span className="text-orange-700 text-[11px] font-bold leading-none tracking-wider">CarMasr</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/post-listing"
            onClick={() => trackEvent('cta_add_listing', { source: 'home_header' })}
            className="flex items-center gap-1 bg-orange hover:bg-orange-600 text-white px-2.5 sm:px-4 py-2 rounded-xl text-[12px] sm:text-sm font-bold shadow-sm shadow-orange/30 transition-colors btn-press"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>أضف إعلانك</span>
          </Link>
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-bg border border-border text-text hover:bg-orange hover:text-white transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? 'sun' : 'moon'}
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.25 }}
                className="flex items-center justify-center"
              >
                {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </motion.span>
            </AnimatePresence>
          </button>
          {user ? (
            <Link
              to="/profile"
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-bg border border-border text-text hover:bg-orange hover:text-white transition-colors"
              title={user.name}
            >
              {user.avatar ? (
                <img src={optimizeImage(user.avatar, 'medium')} alt={user.name} className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 bg-white border-2 border-border hover:border-orange/50 text-text px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <User className="w-4 h-4 text-orange" />
              <span className="hidden sm:inline">دخول</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────── Hero ────────────────────────── */
interface HeroSlide {
  title: string;
  subtitle: string;
  cta: string;
  to: string;
  image: string;
  price?: number;
  priceType?: string;
}

function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <section className="pt-4 px-4 sm:px-6">
      <div className="max-w-[1280px] mx-auto">
        <div className="relative h-[200px] sm:h-[240px] lg:h-[280px] rounded-[22px] overflow-hidden shadow-sm bg-navy">
          {slide.image ? (
            <AnimatePresence mode="wait">
              <motion.img
                key={slide.image + index}
                src={optimizeImage(slide.image, 'large')}
                srcSet={getImageSrcSet(slide.image) || undefined}
                sizes="(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1280px"
                alt={slide.title}
                loading="eager"
                fetchPriority="high"
                decoding="sync"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>
          ) : (
            <div className="absolute inset-0 bg-navy" />
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/75 via-black/40 to-black/10" />
          {slide.price != null && (
            <span className="absolute top-3 left-3 bg-orange text-white font-extrabold text-sm px-3 py-1.5 rounded-xl shadow-lg shadow-orange/30">
              {displayPrice(slide.price, slide.priceType)}
            </span>
          )}
          <div className="relative h-full flex flex-col justify-center items-end text-right px-6 sm:px-8">
            <motion.h1
              key={`title-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-white text-xl sm:text-3xl lg:text-4xl font-extrabold leading-snug max-w-md drop-shadow line-clamp-2"
            >
              {slide.title}
            </motion.h1>
            <motion.p
              key={`sub-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-white/85 text-sm sm:text-base mt-2 font-medium max-w-sm"
            >
              {slide.subtitle}
            </motion.p>
            <motion.div
              key={`cta-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-4"
            >
              <Link
                to={slide.to}
                className="inline-flex items-center gap-2 bg-orange hover:bg-orange-dark text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-orange/30 transition-colors"
              >
                {slide.cta}
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
          {slides.length > 1 && (
            <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`الشريحة ${i + 1}`}
                  aria-current={i === index}
                  className="flex items-center justify-center w-9 h-9 group"
                >
                  <span className={`h-1.5 rounded-full transition-all pointer-events-none ${i === index ? 'w-6 bg-orange' : 'w-1.5 bg-white/50 group-hover:bg-white/75'}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Categories ────────────────────────── */
const v2Categories = [
  { name: 'سيارات وسيارات', to: '/vehicles', art: TruckIcon },
  { name: 'سيارات', to: '/loads', art: LoadsIcon },
  { name: 'وظائف', to: '/jobs', art: JobsIcon },
  { name: 'ورش وخدمات', to: '/services', art: WorkshopIcon },
  { name: 'قطع غيار', to: '/spare-parts', art: SparePartsIcon },
  { name: 'تمويل', to: '/finance', art: FinanceIcon },
];

function CategoryGrid() {
  return (
    <section className="pt-6 sm:pt-8">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-text">استكشف CarMasr</h2>
          <Link to="/vehicles" aria-label="عرض كل السيارات والسيارات" className="flex items-center gap-1 text-orange-700 font-bold text-sm">
            عرض الكل <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-6">
{v2Categories.map((cat) => {
            const Art = cat.art;
            return (
              <Link
                key={cat.name}
                to={cat.to}
                className="group card-surface hover:shadow-md hover:-translate-y-0.5 transition-all px-3 py-4 flex flex-col items-center justify-center gap-2.5 h-[110px] sm:h-[125px]"
              >
                <span
                  className="rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 overflow-hidden"
                  style={{ width: 'clamp(60px, 7.5vw, 92px)', height: 'clamp(60px, 7.5vw, 92px)' }}
                >
                  <Art className="w-full h-full" />
                </span>
                <span className="text-text font-bold text-xs sm:text-sm text-center leading-tight">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Listing Rail ────────────────────────── */
const FAV_KEY = 'tareeq_favorites';

function getFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}

function saveFavs(ids: string[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}

function ListingRailCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const [isFavorite, setIsFavorite] = useState(() => getFavs().includes(listing.id));

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const favs = getFavs();
    if (favs.includes(listing.id)) {
      saveFavs(favs.filter((id) => id !== listing.id));
      setIsFavorite(false);
    } else {
      saveFavs([...favs, listing.id]);
      setIsFavorite(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 7) * 0.08, ease: [0.22, 0.61, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      className="w-[272px] shrink-0 snap-start card-surface overflow-hidden card-hover lg:w-auto"
    >
      <Link to={listingUrl(listing.id, listing.slug)} className="block group">
        <div className="relative aspect-[16/10] bg-bg">
          <OptimizedImage
            src={watermarkImage(listing.images?.[0], listing.contactPhone || listing.userPhone) || ''}
            alt={listing.title}
            size="small"
            className="absolute inset-0 w-full h-full"
            fallback={
              <div className="w-full h-full bg-navy/10 flex items-center justify-center text-text/30 text-xs font-bold">
                {listing.title?.slice(0, 20)}
              </div>
            }
          />
          {listing.listingType === 'rent' && (
            <span className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
              للإيجار
            </span>
          )}
          {listing.status === 'sold' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="bg-red-600 text-white text-sm font-extrabold px-6 py-2 -rotate-12 rounded-lg shadow-lg tracking-wider ring-2 ring-white/50">
                {listing.listingType === 'rent' ? 'تم الإيجار' : 'تم البيع'}
              </span>
            </div>
          )}
          <ImageWatermark phone={listing.contactPhone || listing.userPhone} />
          <button
            onClick={toggleFavorite}
            aria-label="المفضلة"
            className="absolute bottom-2 left-2 p-2 rounded-full bg-white/90 backdrop-blur shadow-sm hover:bg-white transition-colors"
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-text-light'}`} />
          </button>
        </div>
        <div className="p-3">
          <h3 className="font-bold text-text text-sm leading-snug truncate group-hover:text-orange transition-colors">{listing.title}</h3>
          <p className="flex items-center gap-1 text-xs text-text-light mt-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {listing.governorate}
          </p>
          <p className="text-orange font-extrabold text-lg mt-2">{displayPrice(listing.price, listing.priceType)}</p>
        </div>
      </Link>
    </motion.div>
  );
}

function ListingRail({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  return (
    <section className="pt-8 sm:pt-10">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-text">أحدث الإعلانات</h2>
          <Link to="/vehicles" aria-label="عرض كل أحدث الإعلانات" className="flex items-center gap-1 text-orange-700 font-bold text-sm">
            عرض الكل <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
      {loading ? (
        <div className="max-w-[1280px] mx-auto overflow-hidden">
          <div className="flex gap-3 px-4 sm:px-6 w-max">
            <ListingRailSkeleton count={4} />
          </div>
        </div>
      ) : listings.length > 0 ? (
        <div className="max-w-[1280px] mx-auto overflow-x-auto hide-scrollbar snap-x snap-mandatory lg:overflow-visible lg:snap-none">
          <div className="flex gap-3 px-4 sm:px-6 pb-2 w-max lg:w-auto lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:gap-4 lg:pb-4">
            {listings.map((l, i) => <ListingRailCard key={l.id} listing={l} index={i} />)}
          </div>
        </div>
      ) : (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 card-surface">
          <EmptyState
            title="لسه مفيش إعلانات منشورة"
            description="أول إعلان هيظهر هنا — انشر عربيتك دلوقتي واوصل لآلاف المشترين"
            actionLabel="أضف إعلان"
            actionTo="/post-listing"
          />
        </div>
      )}
    </section>
  );
}

/* ────────────────────────── Loads Rail ────────────────────────── */
function LoadRailCard({ load }: { load: Load }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className="w-[280px] shrink-0 snap-start card-surface p-4 card-hover lg:w-auto"
    >
      <Link to={`/load/${load.id}`} className="block">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-text text-sm flex-1 truncate text-right">{load.origin}</span>
          <ArrowLeftRight className="w-4 h-4 text-orange flex-shrink-0" />
          <span className="font-extrabold text-text text-sm flex-1 truncate text-right">{load.destination}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="bg-bg text-text text-[11px] font-semibold px-2 py-1 rounded-lg">{load.cargoType}</span>
          <span className="bg-bg text-text text-[11px] font-semibold px-2 py-1 rounded-lg">{load.vehicleType}</span>
          {load.weight && <span className="bg-bg text-text text-[11px] font-semibold px-2 py-1 rounded-lg">{load.weight} طن</span>}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-orange font-extrabold text-base">{displayPrice(load.price, load.priceType)}</span>
          <motion.span
            className="flex items-center gap-1 text-orange font-bold text-xs"
            whileHover={{ x: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14 }}
          >
            التفاصيل <ArrowLeft className="w-3.5 h-3.5" />
          </motion.span>
        </div>
      </Link>
    </motion.div>
  );
}

function LoadsRail({ loads, loading }: { loads: Load[]; loading: boolean }) {
  return (
    <section className="pt-8 sm:pt-10">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-text">📦 سيارات متاحة الآن</h2>
          <Link to="/loads" aria-label="عرض كل السيارات المتاحة" className="flex items-center gap-1 text-orange-700 font-bold text-sm">
            عرض الكل <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>
      {loading ? (
        <div className="max-w-[1280px] mx-auto overflow-hidden">
          <div className="flex gap-3 px-4 sm:px-6 w-max">
            <LoadRailSkeleton count={3} />
          </div>
        </div>
      ) : loads.length > 0 ? (
        <div className="max-w-[1280px] mx-auto overflow-x-auto hide-scrollbar snap-x snap-mandatory lg:overflow-visible lg:snap-none">
          <div className="flex gap-3 px-4 sm:px-6 pb-2 w-max lg:w-auto lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:pb-4">
            {loads.map((l) => <LoadRailCard key={l.id} load={l} />)}
          </div>
        </div>
      ) : (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 card-surface">
          <EmptyState
            title="مفيش سيارات متاحة دلوقتي"
            description="لو عندك شاحنة فاضية، انشرها هنا واوصل لأصحاب البضاعة"
            actionLabel="انشر حمولة"
            actionTo="/post-listing?type=load"
          />
        </div>
      )}
    </section>
  );
}

/* ────────────────────────── Services ────────────────────────── */
const v2Services = [
  { name: 'ورش وصيانة', desc: 'صيانة سيارات وسيارات', to: '/services', icon: Wrench },
  { name: 'قطع غيار', desc: 'أصلي ومستعمل ومستورد', to: '/spare-parts', icon: Cog },
  { name: 'طوارئ الطريق', desc: 'مساعدة فورية 24/7', to: '/emergency', icon: Siren },
  { name: 'تمويل', desc: 'قسط شاحنتك بسهولة', to: '/finance', icon: Landmark },
];

function ServicesGrid() {
  return (
    <section className="pt-8 sm:pt-10">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-text">خدمات النقل</h2>
          <Link to="/services" aria-label="عرض كل خدمات النقل" className="flex items-center gap-1 text-orange-700 font-bold text-sm">
            عرض الكل <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {v2Services.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.name}
                to={s.to}
                className="card-surface hover:shadow-md transition-all p-4 flex items-center gap-3"
              >
                <span className="w-11 h-11 rounded-xl bg-navy/5 text-text flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-text text-sm truncate">{s.name}</p>
                  <p className="text-text-light text-[11px] truncate">{s.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Featured Banner ────────────────────────── */
function FeaturedBanner({ listings }: { listings: Listing[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (listings.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % listings.length), 5000);
    return () => clearInterval(t);
  }, [listings.length]);

  if (!listings.length) return null;
  const listing = listings[Math.min(index, listings.length - 1)];

  return (
    <section className="pt-10 sm:pt-12 px-4 sm:px-6">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-text flex items-center gap-2">
            <Star className="w-5 h-5 text-orange" /> إعلانات مميزة
          </h2>
          <Link to="/featured" aria-label="عرض كل الإعلانات المميزة" className="flex items-center gap-1 text-orange-700 font-bold text-sm">
            عرض الكل <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>

        <Link
          to="/featured"
          className="relative block overflow-hidden rounded-[22px] min-h-[220px] sm:min-h-[240px] bg-navy shadow-sm group hover:shadow-md transition-shadow"
        >
          {listing.images?.[0] ? (
            <>
              <AnimatePresence mode="wait">
                <motion.img
                  key={listing.id}
                  src={optimizeImage(listing.images[0], 'large')}
                  srcSet={getImageSrcSet(listing.images[0]) || undefined}
                  sizes="(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1280px"
                  alt={listing.title}
                  loading="lazy"
                  decoding="async"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </AnimatePresence>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,27,42,0.92) 0%, rgba(13,27,42,0.35) 55%, rgba(13,27,42,0.05) 100%)' }} />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Truck className="w-16 h-16 text-white/20" />
            </div>
          )}
          <div className="relative p-6 sm:p-8 flex flex-col items-start justify-end min-h-[220px] sm:min-h-[240px]">
            <motion.span
              key={`badge-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1 bg-orange-700 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-lg mb-3 shadow"
            >
              ⭐ عرض مميز
            </motion.span>
            <motion.h3
              key={`title-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-white text-xl sm:text-2xl font-extrabold leading-snug line-clamp-1"
            >
              {listing.title}
            </motion.h3>
            <motion.p
              key={`loc-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex items-center gap-1 text-white/80 text-sm mt-1.5"
            >
              <MapPin className="w-4 h-4 text-orange" /> {listing.governorate || listing.location}
            </motion.p>
            <motion.div
              key={`cta-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 w-full"
            >
              <span className="text-orange font-extrabold text-xl sm:text-2xl">{displayPrice(listing.price, listing.priceType)}</span>
              <span className="inline-flex items-center gap-1.5 bg-orange-700 hover:bg-orange-dark text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-orange/30 transition-colors">
                شاهد كل العروض المميزة <ChevronLeft className="w-4 h-4" />
              </span>
            </motion.div>
          </div>
        </Link>

        {listings.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {listings.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setIndex(i)}
                aria-label={`الإعلان المميز ${i + 1}`}
                aria-current={i === index}
                className="flex items-center justify-center w-9 h-9 group"
              >
                <span className={`h-1.5 rounded-full transition-all pointer-events-none ${i === index ? 'w-6 bg-orange' : 'w-1.5 bg-navy/20 group-hover:bg-navy/40'}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ────────────────────────── Footer ────────────────────────── */
const footerGroups = [
  {
    title: 'السوق',
    links: [
      { name: 'سيارات للبيع', to: '/vehicles' },
      { name: 'سيارات', to: '/equipment' },
      { name: 'سيارات', to: '/loads' },
      { name: 'وظائف النقل', to: '/jobs' },
      { name: 'قطع الغيار', to: '/spare-parts' },
      { name: 'المعارض', to: '/exhibitions' },
    ],
  },
  {
    title: 'الخدمات',
    links: [
      { name: 'ورش وخدمات', to: '/services' },
      { name: 'التمويل', to: '/finance' },
      { name: 'طوارئ الطريق', to: '/emergency' },
      { name: 'دليل الشراء', to: '/help/buying-guide' },
      { name: 'دليل البيع', to: '/help/selling-guide' },
      { name: 'مركز المساعدة', to: '/help' },
    ],
  },
  {
    title: 'الشركة',
    links: [
      { name: 'من نحن', to: '/about' },
      { name: 'لماذا كار مصر؟', to: '/why-carmasr' },
      { name: 'انضم كمعرض', to: '/join' },
      { name: 'عن المنصة', to: '/platform' },
      { name: 'اتصل بنا', to: '/contact' },
    ],
  },
];

const footerLegal = [
  { name: 'سياسة الخصوصية', to: '/privacy-policy' },
  { name: 'شروط الاستخدام', to: '/terms' },
  { name: 'سياسة الكوكيز', to: '/cookies' },
  { name: 'حماية البيانات', to: '/data-protection' },
  { name: 'إرشادات المجتمع', to: '/community-guidelines' },
  { name: 'سياسة الاسترداد', to: '/refund-policy' },
  { name: 'حذف الحساب', to: '/account-deletion-policy' },
];

function HomeV2Footer() {
  return (
    <footer className="mt-10 bg-surface border-t border-border">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 pb-28 sm:pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 pb-8">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <img src="/app-icon-128.png" alt="كار مصر" className="h-10 w-10 object-contain" />
              <div className="flex flex-col">
                <span className="text-text font-extrabold text-xl leading-none">كار مصر</span>
                <span className="text-orange-700 text-[11px] font-bold leading-none">CarMasr</span>
              </div>
            </Link>
            <p className="text-text-light text-sm leading-relaxed mb-4 max-w-xs">
              أكبر سوق إلكتروني متخصص في مركبات السيارات الملاكي والسيارات في مصر. نربط البائعين والمشترين وأصحاب الحمولة في بيئة آمنة وموثوقة.
            </p>
            <div className="space-y-1.5 text-sm text-text-light">
              <a href="tel:01018870145" className="flex items-center gap-2 hover:text-orange transition-colors">
                <Phone className="w-4 h-4 text-orange" /> الدعم الفني: 01018870145
              </a>
              <a href="tel:01277177710" className="flex items-center gap-2 hover:text-orange transition-colors">
                <Phone className="w-4 h-4 text-orange" /> المبيعات: 01277177710
              </a>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange" /> القاهرة، جمهورية مصر العربية
              </div>
            </div>
            <a
              href="https://www.facebook.com/TareeqEG"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-navy/5 text-text hover:bg-orange hover:text-white transition-colors text-sm font-semibold"
            >
              <Facebook className="w-4 h-4" /> تابعنا على فيسبوك
            </a>
          </div>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-text font-extrabold text-sm mb-3">{group.title}</h4>
              <ul className="space-y-2">
                {group.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-text-light hover:text-orange text-sm transition-colors">
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-5 pb-4 flex flex-wrap gap-x-4 gap-y-2">
          {footerLegal.map((l) => (
            <Link key={l.to} to={l.to} className="text-text-light hover:text-orange text-xs transition-colors">
              {l.name}
            </Link>
          ))}
        </div>
        <div className="border-t border-border pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-text-light text-xs">© {new Date().getFullYear()} كار مصر CarMasr. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-2 text-text-light text-xs">
            <Truck className="w-4 h-4 text-orange" />
            أكبر سوق للسيارات في مصر
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────────── Banner Ads ────────────────────────── */
function BannerAdsRail({ ads }: { ads: BannerAd[] }) {
  if (!ads.length) return null;
  return (
    <section className="py-3 bg-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ads.slice(0, 2).map(ad => (
            <a key={ad.id} href={ad.linkUrl || '#'} target={ad.linkUrl ? '_blank' : undefined} rel="noopener noreferrer"
              onClick={() => trackEvent('banner_click', { banner_id: ad.id, company: ad.companyName })}
              className="relative group block card-surface overflow-hidden hover:shadow-md transition-all">
              {ad.imageUrl ? (
                <img src={optimizeImage(ad.imageUrl, 'medium')} alt={ad.companyName} className="w-full h-24 object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-24 bg-gradient-to-l from-purple-600/10 to-purple-600/5 flex items-center justify-center">
                  <span className="text-sm font-bold text-purple-600">{ad.companyName}</span>
                </div>
              )}
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-text">{ad.companyName}</span>
                {ad.linkUrl && <ExternalLink className="w-3 h-3 text-text-light" />}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Exhibitions Ticker ────────────────────────── */
function ExhibitionsRail({ exhibitions }: { exhibitions: Exhibition[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const half = el.scrollWidth / 2;
    setDuration(Math.max(15, Math.round(half / 40)));
  }, [exhibitions]);

  if (!exhibitions.length) return null;
  const items = [...exhibitions, ...exhibitions];
  return (
    <section className="pt-8 sm:pt-10">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-text flex items-center gap-2">
            <Store className="w-5 h-5 text-orange" /> معارض السيارات والسيارات
          </h2>
          <Link to="/exhibitions" aria-label="عرض كل المعارض" className="flex items-center gap-1 text-orange-700 font-bold text-sm">
            عرض الكل <ChevronLeft className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="bg-surface border-y border-border overflow-hidden py-3.5">
        <div ref={trackRef} className="marquee-track flex w-max items-center gap-8 mx-4 px-1" style={{ animationDuration: `${duration}s` }}>
          {items.map((ex, i) => (
            <Link
              key={`${ex.id}-${i}`}
              to={exhibitionUrl(ex.id, ex.name)}
              className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-text hover:text-orange transition-colors"
            >
              <Store className="w-4 h-4 text-orange shrink-0" />
              {ex.name}
              <span className="text-border">•</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────── Page ────────────────────────── */
export default function HomeV2() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [bannerAds, setBannerAds] = useState<BannerAd[]>([]);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      listingsService.getAll().catch(() => []),
      listingsService.getFeatured().catch(() => []),
      loadsService.getAll({ status: 'available' }).catch(() => []),
      bannerAdsService.getActive().catch(() => []),
      exhibitionsService.getActive().catch(() => []),
    ]).then(([listingsResult, featuredResult, loadsResult, bannerResult, exhibitionsResult]) => {
      if (!mounted) return;
      const available = [...listingsResult]
        .filter((l) => isAvailable(l.status, l.priceType) && l.status === 'active')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);
      const sold = [...listingsResult]
        .filter((l) => isSold(l.priceType, l.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6);
      const sorted = [...available, ...sold];
      setListings(sorted);
      setFeaturedListings(featuredResult.length ? filterAvailable(featuredResult).slice(0, 6) : available.slice(0, 4));
      setLoads(loadsResult.slice(0, 5));
      setBannerAds(bannerResult || []);
      setExhibitions(exhibitionsResult || []);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const heroSlides = useMemo<HeroSlide[]>(() => {
    const withImages = listings.filter((l) => l.images?.length && l.status !== 'sold').slice(0, 4);
    if (withImages.length) {
      return withImages.map((l) => ({
        title: l.title,
        subtitle: [l.governorate || l.location, l.condition === 'used' ? 'مستعمل' : 'جديد'].filter(Boolean).join(' • '),
        cta: 'شاهد التفاصيل',
        to: listingUrl(l.id, l.slug),
        image: l.images[0],
        price: l.price,
      }));
    }
    return [{
      title: 'أكبر سوق للسيارات في مصر',
      subtitle: 'سيارات • سيارات • سيارات • وظائف',
      cta: 'تصفح السيارات',
      to: '/vehicles',
      image: '',
    }];
  }, [listings]);

  return (
    <div className="min-h-screen bg-bg" dir="rtl">
      <SeoHead
        title="كار مصر CarMasr - أكبر سوق للسيارات في مصر"
        description="أكبر سوق إلكتروني للنقل الثقيل في مصر. ابحث عن سيارات، سيارات، سيارات، وظائف نقل، تمويل، وخدمات طوارئ في مكان واحد."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "كار مصر CarMasr",
          "url": "https://carmasr-app.vercel.app",
          "description": "أكبر سوق إلكتروني للنقل الثقيل في مصر",
          "inLanguage": "ar",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://carmasr-app.vercel.app/vehicles?search={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />
      <HomeV2Header />
      <HeroSlider slides={heroSlides} />
      <CategoryGrid />
      <BannerAdsRail ads={bannerAds} />
      <ExhibitionsRail exhibitions={exhibitions} />
      <ListingRail listings={listings} loading={loading} />
      <LoadsRail loads={loads} loading={loading} />
      <ServicesGrid />
      <FeaturedBanner listings={featuredListings} />
      <HomeV2Footer />
    </div>
  );
}
