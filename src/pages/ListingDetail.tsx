import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import OptimizedImage from '../components/OptimizedImage';
import ImageWatermark from '../components/ImageWatermark';
import {
  MapPin, Phone, MessageCircle, Calendar, ChevronLeft,
  Share2, Heart, AlertCircle, Loader2, ChevronRight, Truck,
  ShieldAlert, Star, CheckCircle2, Undo2, KeyRound, BadgeDollarSign,
  Store, RefreshCw, Pencil, Video, Maximize2, Facebook, Copy, X,
} from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { listingsService, ratingsService } from '../lib/firestoreService';
import { formatPrice, displayPrice, formatTitle, adTitle, formatDate, generateSlug, getWhatsAppLink, getPhoneLink, listingUrl, shareUrl, getShortLink, listingCallPhone, listingWhatsApp, buildAdShareText, shareOnFacebook, shareWithImage, copyText } from '../lib/utils';
import { listingTypeLabel } from '../lib/listingMeta';
import { statusLabel } from '../lib/listingStatus';
import { trackAdImpression, trackAdClick } from '../lib/adAnalytics';
import { reportContactClick } from '../lib/sellerApi';
import { useAuth } from '../contexts/AuthContext';
import SeoHead from '../components/SeoHead';
import ProtectedPhoneButton from '../components/ProtectedPhoneButton';
import { watermarkImage, optimizeImage } from '../lib/imageUtils';
import { videoPosterUrl } from '../lib/storageService';
import AiMatch from '../components/AiMatch';
import type { Listing } from '../types';
import { getSiteUrl } from '../lib/config';
import { toast } from '../components/Toast';

const FAV_KEY = 'tareeq_favorites';
function getFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function saveFavs(ids: string[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}

export default function ListingDetail() {
  const { id, slug }  = useParams<{ id: string; slug?: string }>();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const [listing, setListing]       = useState<Listing | null>(null);
  const [loading, setLoading]       = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [saved, setSaved]           = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent]  = useState(false);
  const [fullscreenImg, setFullscreenImg] = useState<number | null>(null);
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldLoading, setSoldLoading] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [ratings, setRatings] = useState<any[]>([]);
  const [hasRated, setHasRated] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [recentListings, setRecentListings] = useState<Listing[]>([]);
  const [videoFull, setVideoFull] = useState(false);

  const utm = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      source: p.get('utm_source') || 'direct',
      medium: p.get('utm_medium') || '',
      campaign: p.get('utm_campaign') || '',
    };
  }, []);

useEffect(() => {
    if (!id && !slug) return;
    setLoading(true);

    const load = async () => {
      let data: Listing | null = null;
      // الدايمًا بالـ id الأول — الـ slug مش مضمون إنه فريد، والبحث بيه كان بيفتح إعلان تاني
      if (id) {
        data = await listingsService.getById(id);
      }
      if (!data && slug) {
        data = await listingsService.getBySlug(slug);
      }
      return data;
    };

    load()
      .then(data => {
        if (data && data.featured && data.featuredUntil && new Date(data.featuredUntil) <= new Date()) {
          listingsService.update(data.id, { featured: false, featuredUntil: '' });
          setListing({ ...data, featured: false, featuredUntil: '' });
        } else {
          setListing(data);
        }
        if (data) {
          const freshSlug = generateSlug(`${data.title || ''} ${data.year || ''} ${data.listingType === 'rent' ? 'ايجار' : 'للبيع'}`);
          if (freshSlug && freshSlug !== slug) {
            navigate(`/listing/${data.id}/${freshSlug}`, { replace: true });
          }
          if (!(user && user.id === data.userId)) {
            trackAdImpression(data.id, utm.source, utm.medium, utm.campaign).catch(() => {});
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    if (id) setSaved(getFavs().includes(id));
  }, [id, slug]);

  useEffect(() => {
    if (!listing?.userId) return;
    try { ratingsService.getByUser(listing.userId).then(setRatings).catch(() => {}); } catch {}
    if (user && listing) {
      try { ratingsService.hasUserRated(user.id, listing.id).then(setHasRated).catch(() => {}); } catch {}
    }
  }, [listing?.userId, user?.id, listing?.id]);

  useEffect(() => {
    if (!listing?.id) return;
    const KEY = 'tareeq_recently_viewed';
    try {
      const stored: string[] = JSON.parse(localStorage.getItem(KEY) || '[]');
      const updated = [listing.id, ...stored.filter(x => x !== listing.id)].slice(0, 24);
      localStorage.setItem(KEY, JSON.stringify(updated));
    } catch {}
    listingsService.getAll({ category: listing.category, status: 'active' })
      .then(all => {
        setSimilarListings(all.filter(l => l.id !== listing.id).slice(0, 4));
        const recentIds: string[] = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } })();
        if (recentIds.length > 0) {
          listingsService.getAll({ status: 'active' })
            .then(all2 => setRecentListings(all2.filter(l => recentIds.includes(l.id) && l.id !== listing.id).slice(0, 8)))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [listing?.id]);

  const toggleFav = () => {
    if (!id) return;
    const favs = getFavs();
    if (favs.includes(id)) {
      saveFavs(favs.filter(f => f !== id));
      setSaved(false);
    } else {
      saveFavs([...favs, id]);
      setSaved(true);
    }
  };

  const share = async () => {
    const sharedLink = await getShortLink(id!).catch(() => shareUrl('listing', id!));
    if (navigator.share) {
      navigator.share({ title: listing?.title, url: sharedLink });
    } else {
      navigator.clipboard.writeText(sharedLink);
    }
  };

  const sendReport = () => {
    if (!reportReason.trim()) return;
    const reports = JSON.parse(localStorage.getItem('tareeq_reports') || '[]');
    reports.push({ listingId: id, reason: reportReason, date: new Date().toISOString() });
    localStorage.setItem('tareeq_reports', JSON.stringify(reports));
    setReportSent(true);
    setShowReport(false);
    setReportReason('');
  };

  const seoTitle = listing ? `${listing.title || formatTitle([listing.brand, listing.model, listing.year?.toString()])} | كار مصر CarMasr` : 'جاري التحميل... | كار مصر CarMasr';
  const seoDesc = listing ? formatTitle([listing.title, formatPrice(listing.price), listing.governorate, listing.condition === 'used' ? 'مستعمل' : 'جديد']) : '';
  const images = listing?.images?.length ? listing.images : [];
  const expectedSlug = listing ? (generateSlug(`${listing.title || ''} ${listing.year || ''} ${listing.listingType === 'rent' ? 'ايجار' : 'للبيع'}`) || listing.slug || '') : '';

  // ── مشاركة: نص الإعلان الكامل + لينك الصفحة (يطلع معاينة بصورة/غلاف الفيديو على واتساب/فيسبوك) ──
  const shareUrlFull = listing ? shareUrl('listing', listing.id) : '';
  const fullAdText = (withImages: boolean) => listing
    ? buildAdShareText({ ...listing, url: shareUrlFull }, { withImages })
    : shareUrlFull;

  const shareToWhatsApp = async () => {
    const text = fullAdText(false);
    // على الموبايل: نرفق صورة الإعلان كملف حقيقي في واتساب
    const shared = await shareWithImage({
      title: listing?.title || 'إعلان كار مصر',
      text,
      url: shareUrlFull,
      imageUrl: listing?.images?.[0],
    });
    if (shared) return;
    // على الكمبيوتر: رابط wa.me — فيسبوك/واتساب يسحبون صورة الإعلان من صفحة الـ OG
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const shareToFacebook = async () => {
    const text = fullAdText(false);
    const shared = await shareWithImage({
      title: listing?.title || 'إعلان كار مصر',
      text,
      url: shareUrlFull,
      imageUrl: listing?.images?.[0],
    });
    if (shared) return;
    shareOnFacebook(shareUrlFull);
    copyText(text).then(ok => toast(ok ? 'نص الإعلان الكامل اتنسخ — الصقه في البوست ✓' : 'انسخ النص يدويًا', ok ? 'success' : 'error'));
  };
  const copyListingLink = () => {
    try { navigator.clipboard?.writeText(shareUrlFull); toast('اتنسخ لينك الإعلان ✓'); }
    catch { toast('تعذّر النسخ — انسخه يدويًا', 'error'); }
  };

  // رسالة واتساب: السعر + التفاصيل + لينك الإعلان
  const waMessage = listing ? (() => {
    const lines: string[] = ['السلام عليكم، أهتم بإعلانكم وحاب أعرف تفاصيل أكتر:', ''];
    const title = (listing.title || '').trim() || [listing.brand, listing.model, listing.year].filter(Boolean).join(' ');
    if (title) lines.push(`🚛 الإعلان: ${title}`);
    const priceText = listing.price ? formatPrice(listing.price) : '';
    if (priceText) lines.push(`💰 السعر: ${priceText}`);
    const details: string[] = [];
    if (listing.condition) details.push(listing.condition === 'used' ? 'مستعمل' : 'جديد');
    if (listing.year) details.push(`سنة ${listing.year}`);
    const loc = [listing.governorate].filter(Boolean).join(' - ');
    if (loc) details.push(loc);
    if (details.length) lines.push(`📋 التفاصيل: ${details.join(' | ')}`);
    const desc = (listing.description || '').replace(/\s+/g, ' ').trim();
    if (desc) lines.push(`📝 ${desc.slice(0, 300)}${desc.length > 300 ? '…' : ''}`);
    lines.push('');
    lines.push(`🔗 رابط الإعلان: https://carmasr-app.vercel.app/listing/${listing.id}/${expectedSlug}`);
    return lines.join('\n');
  })() : '';
  const avgRating = useMemo(() => {
    if (!ratings.length) return 0;
    return Math.round(ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length * 10) / 10;
  }, [ratings]);

  // شارة الحالة: مباع أو محجوز أو موقوف أو منتهي (متاح مش بيتبان)
  const detailStatusLabel = useMemo(() => {
    if (!listing) return '';
    const st = listing.priceType === 'sold' ? 'sold' : listing.status;
    return statusLabel(st);
  }, [listing]);

  // رقم الاتصال ورقم الواتساب: كل واحد لوحده (بتاع صاحب الإعلان)
  const callPhone = listingCallPhone(listing);
  const waPhone = listingWhatsApp(listing);

  if (loading) return (
    <>
      <SeoHead title={seoTitle} />
      <div className="min-h-screen bg-bg">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="w-full aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-10 w-32" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (!listing) return (
    <>
      <SeoHead title="الإعلان غير موجود" description="عذراً، الإعلان الذي تبحث عنه غير موجود أو تم حذفه." />
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <AlertCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-text mb-2">الإعلان غير موجود</h2>
        <p className="text-text-light text-sm mb-6">ربما تم حذفه أو الرابط غير صحيح</p>
      <button onClick={() => navigate(-1)}
        className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors">
        رجوع
      </button>
    </div>
    </>
  );

  const listingJsonLd = listing ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": listing.title,
    "description": listing.description?.slice(0, 200),
    "image": listing.images?.[0] || '',
    "category": listing.category,
    "brand": listing.brand ? { "@type": "Brand", "name": listing.brand } : undefined,
    "offers": {
      "@type": "Offer",
      ...(listing.price > 0 ? { "price": listing.price, "priceCurrency": "EGP" } : {}),
      "availability": listing.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    },
  } : undefined;

  return (
    <>
      <SeoHead
        title={listing ? listing.title || formatTitle([listing.brand, listing.model, listing.year?.toString()]) : ''}
        description={listing ? formatTitle([listing.title, formatPrice(listing.price), listing.governorate]) : ''}
        ogImage={listing?.images?.[0] || undefined}
        ogType="product"
        canonical={`https://carmasr-app.vercel.app/listing/${listing?.id}/${expectedSlug}`.replace(/\/$/, '')}
        jsonLd={listingJsonLd as Record<string, unknown>}
      />
    <div className="bg-bg pb-24 sm:pb-8">
      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm text-text-light flex-wrap">
          <Link to="/" className="hover:text-orange transition-colors">الرئيسية</Link>
          <ChevronLeft className="w-3.5 h-3.5 rtl-flip" />
          <Link to="/vehicles" className="hover:text-orange transition-colors">الإعلانات</Link>
          <ChevronLeft className="w-3.5 h-3.5 rtl-flip" />
          <span className="text-text truncate max-w-[200px]">{listing.title}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── الجانب الأيسر ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Images */}
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              {images.length > 0 ? (
                <>
                  <div className="relative aspect-video bg-gray-100 cursor-pointer" onClick={() => setFullscreenImg(currentImage)}>
                    <OptimizedImage
                      src={watermarkImage(images[currentImage], listing?.contactPhone || listing?.userPhone)}
                      alt={listing.title}
                      size="large"
                      className="w-full h-full"
                      objectFit="cover"
                    />
{listing.status === 'sold' && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                        <span className="bg-red-600 text-white text-2xl font-extrabold px-8 py-3 -rotate-12 rounded-xl shadow-lg">
{listing.listingType === 'rent' ? 'تم الإيجار' : 'تم البيع'}
                        </span>
                      </div>
                    )}
                    <ImageWatermark phone={listing?.contactPhone || listing?.userPhone} />
                    {images.length > 1 && (
                      <>
                        <button onClick={e => { e.stopPropagation(); setCurrentImage(p => (p - 1 + images.length) % images.length); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setCurrentImage(p => (p + 1) % images.length); }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors">
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">
                          {currentImage + 1} / {images.length}
                        </div>
                      </>
                    )}
                    <button onClick={e => { e.stopPropagation(); setFullscreenImg(currentImage); }}
                      className="absolute top-3 left-3 bg-black/50 hover:bg-black/70 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    </button>
                  </div>
                  {images.length > 1 && (
                    <div className="flex gap-2 p-3 overflow-x-auto">
                      {images.map((img, i) => (
                        <button key={i} onClick={() => setCurrentImage(i)}
                          className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                            currentImage === i ? 'border-orange' : 'border-transparent'}`}>
                          <OptimizedImage src={watermarkImage(img, listing?.contactPhone || listing?.userPhone)} alt="" size="thumb" className="w-full h-full" objectFit="cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  <Truck className="w-16 h-16 text-gray-300" />
                </div>
              )}
            </div>

            {/* Video */}
            {listing.videoUrl && (
              <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border">
                  <span className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-orange" />
                    <span className="text-sm font-bold text-text">فيديو الإعلان</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={shareToWhatsApp} title="مشاركة على واتساب"
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" /> واتساب
                    </button>
                    <button type="button" onClick={shareToFacebook} title="مشاركة على فيسبوك"
                      className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
                      <Facebook className="w-3.5 h-3.5" /> فيسبوك
                    </button>
                  </div>
                </div>
                <div className="relative bg-black">
                  <video
                    src={listing.videoUrl}
                    poster={videoPosterUrl(listing.videoUrl)}
                    controls
                    playsInline
                    preload="none"
                    className="w-full aspect-video bg-black"
                  />
                  <button type="button" onClick={() => setVideoFull(true)} title="شاشة كاملة"
                    className="absolute top-2 left-2 w-9 h-9 bg-black/50 hover:bg-black/70 text-white rounded-lg flex items-center justify-center transition-colors">
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Fullscreen Image Modal */}
            {fullscreenImg !== null && images.length > 0 && (
              <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setFullscreenImg(null)}>
                <button onClick={() => setFullscreenImg(null)}
                  className="absolute top-4 left-4 text-white/80 hover:text-white w-10 h-10 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <button onClick={e => { e.stopPropagation(); setCurrentImage(p => (p - 1 + images.length) % images.length); setFullscreenImg(currentImage > 0 ? currentImage - 1 : images.length - 1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white">
                  <ChevronRight className="w-10 h-10" />
                </button>
                <img src={optimizeImage(images[fullscreenImg], 'original')} alt="" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
                <div className="absolute bottom-6 left-6 flex items-center gap-1.5 bg-orange text-white text-xs font-bold px-3 py-1.5 rounded-lg pointer-events-none" dir="ltr">
                  <Phone className="w-3.5 h-3.5" /> {(listing?.contactPhone || listing?.userPhone || 'كار مصر CarMasr')}
                </div>
                <button onClick={e => { e.stopPropagation(); setCurrentImage(p => (p + 1) % images.length); setFullscreenImg(currentImage < images.length - 1 ? currentImage + 1 : 0); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white">
                  <ChevronLeft className="w-10 h-10" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                  {fullscreenImg + 1} / {images.length}
                </div>
              </div>
            )}

            {/* Fullscreen Video Modal */}
            {videoFull && listing?.videoUrl && (
              <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center" onClick={() => setVideoFull(false)}>
                <button onClick={() => setVideoFull(false)}
                  className="absolute top-4 left-4 z-10 text-white/80 hover:text-white w-10 h-10 flex items-center justify-center">
                  <X className="w-7 h-7" />
                </button>
                <video
                  src={listing.videoUrl}
                  poster={videoPosterUrl(listing.videoUrl)}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-full w-full h-full object-contain bg-black"
                  onClick={e => e.stopPropagation()}
                />
              </div>
            )}

            {/* Title & Price */}
            <div className="bg-surface rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h1 className="text-xl sm:text-2xl font-extrabold text-text leading-snug">{adTitle(listing)}</h1>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={toggleFav}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
                      saved ? 'bg-red-50 border-red-200 text-red-500' : 'border-border text-text-light hover:border-orange'}`}>
                    <Heart className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={share}
                    className="w-9 h-9 rounded-xl border border-border text-text-light hover:border-orange flex items-center justify-center transition-colors">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowReport(true)}
                    className="w-9 h-9 rounded-xl border border-border text-text-light hover:border-red-400 hover:text-red-500 flex items-center justify-center transition-colors">
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {listing.listingType === 'rent' ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {listing.dailyPrice   && <span className="bg-blue-50 text-blue-700 text-sm font-bold px-3 py-1.5 rounded-lg">{formatPrice(listing.dailyPrice)} / يوم</span>}
                  {listing.weeklyPrice  && <span className="bg-blue-50 text-blue-700 text-sm font-bold px-3 py-1.5 rounded-lg">{formatPrice(listing.weeklyPrice)} / أسبوع</span>}
                  {listing.monthlyPrice && <span className="bg-blue-50 text-blue-700 text-sm font-bold px-3 py-1.5 rounded-lg">{formatPrice(listing.monthlyPrice)} / شهر</span>}
                </div>
              ) : (
                <div className="text-2xl font-black text-orange mb-4">
                  {displayPrice(listing.price, listing.priceType)}
                  {listing.price > 0 && listing.priceType === 'negotiable' && (
                    <span className="block text-sm font-bold text-text-light mt-1">قابل للتفاوض</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-text-light flex-wrap">
                {listingTypeLabel(listing.category, listing.subcategory) && (
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-orange" />
                    {listingTypeLabel(listing.category, listing.subcategory)}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-orange" />
                  {listing.governorate}{listing.location ? ` — ${listing.location}` : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-orange" />
                  نُشر {formatDate(listing.createdAt)}
                </span>
                {listing.updatedAt && (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-orange" />
                    آخر تحديث {formatDate(listing.updatedAt)}
                  </span>
                )}
                {detailStatusLabel && (
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold text-white ${
                    detailStatusLabel === 'تم البيع' ? 'bg-red-600'
                      : detailStatusLabel === 'محجوز' ? 'bg-amber-500'
                      : 'bg-gray-600'
                  }`}>
                    {detailStatusLabel}
                  </span>
                )}
              </div>

              {/* أزرار المشاركة */}
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
                <span className="flex items-center gap-1.5 text-xs text-text-light">
                  <Share2 className="w-3.5 h-3.5" /> شارك الإعلان:
                </span>
                <button onClick={shareToWhatsApp}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" /> واتساب
                </button>
                <button onClick={shareToFacebook}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#1877f2] hover:bg-[#166fe0] px-3 py-1.5 rounded-lg transition-colors">
                  <Facebook className="w-3.5 h-3.5" /> فيسبوك
                </button>
                <button onClick={copyListingLink}
                  className="flex items-center gap-1.5 text-xs font-bold text-text-light border border-border hover:border-orange hover:text-orange px-3 py-1.5 rounded-lg transition-colors">
                  <Copy className="w-3.5 h-3.5" /> نسخ الرابط
                </button>
              </div>
            </div>

            {/* Specs */}
            {(listing.brand || listing.model || listing.year || listing.condition) && (
              <div className="bg-surface rounded-2xl border border-border p-5">
                <h2 className="font-bold text-text mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-orange rounded-full" />
                  المواصفات
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ['الماركة', listing.brand],
                    ['الموديل', listing.model],
                    ['سنة الصنع', listing.year],
                    ['الحالة', listing.condition === 'new' ? 'جديد' : 'مستعمل'],
                  ].filter(([,v]) => v).map(([k, v]) => (
                    <div key={k as string} className="bg-bg rounded-xl p-3 text-center">
                      <div className="text-xs text-text-light mb-1">{k}</div>
                      <div className="font-bold text-text text-sm">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rental Info */}
            {listing.listingType === 'rent' && (
              <div className="bg-surface rounded-2xl border border-border p-5">
                <h2 className="font-bold text-text mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-orange rounded-full" />
                  معلومات الأجرة
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {listing.deposit && (
                    <div className="bg-bg rounded-xl p-3 text-center">
                      <div className="text-xs text-text-light mb-1">تأمين</div>
                      <div className="font-bold text-text text-sm">{formatPrice(listing.deposit)}</div>
                    </div>
                  )}
                  {listing.availableFrom && (
                    <div className="bg-bg rounded-xl p-3 text-center">
                      <div className="text-xs text-text-light mb-1">متاح من</div>
                      <div className="font-bold text-text text-sm">{listing.availableFrom}</div>
                    </div>
                  )}
                  {listing.availableTo && (
                    <div className="bg-bg rounded-xl p-3 text-center">
                      <div className="text-xs text-text-light mb-1">متاح إلى</div>
                      <div className="font-bold text-text text-sm">{listing.availableTo}</div>
                    </div>
                  )}
                  {listing.insuranceRequired !== undefined && (
                    <div className="bg-bg rounded-xl p-3 text-center">
                      <div className="text-xs text-text-light mb-1">مطلوب تأمين</div>
                      <div className="font-bold text-text text-sm">{listing.insuranceRequired ? 'نعم' : 'لا'}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {listing.description && (
              <div className="bg-surface rounded-2xl border border-border p-5">
                <h2 className="font-bold text-text mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-orange rounded-full" />
                  وصف الإعلان
                </h2>
                <p className="text-text-light text-sm leading-loose whitespace-pre-line">{listing.description}</p>
              </div>
            )}
          </div>

          {/* ── الجانب الأيمن ── */}
          <div className="space-y-4">
            {/* Seller */}
            <div className="bg-surface rounded-2xl border border-border p-5 sticky top-4">
              <h3 className="font-bold text-text mb-4">معلومات البائع</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-navy rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {listing.userName?.[0] || '?'}
                </div>
                <div>
                  <p className="font-bold text-text">{listing.userName}</p>
                  <p className="text-xs text-text-light">
                    {listing.userType === 'company' ? 'شركة' : listing.userType === 'admin' ? 'مدير' : 'فرد'}
                    {listing.verified && ' • موثّق ✓'}
                  </p>
                </div>
              </div>
              {avgRating > 0 && (
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${s <= avgRating ? 'fill-orange text-orange' : 'text-gray-200'}`} />
                  ))}
                  <span className="text-xs text-text-light mr-1">({avgRating} · {ratings.length} تقييم)</span>
                </div>
              )}

              <div className="border-t border-border pt-4 mt-2">
                {hasRated ? (
                  <p className="text-xs text-success flex items-center gap-1 mb-3">
                    <CheckCircle2 className="w-3.5 h-3.5" /> لقد قمت بتقييم هذا المستخدم
                  </p>
                ) : user && user.id !== listing.userId ? (
                  <>
                    {!showReviewForm ? (
                      <button onClick={() => setShowReviewForm(true)}
                        className="w-full text-sm text-orange font-bold py-2 border border-orange/30 rounded-xl hover:bg-orange/5 transition-colors flex items-center justify-center gap-1.5">
                        <Star className="w-4 h-4" /> قيّم هذا المستخدم
                      </button>
                    ) : (
                      <div className="bg-bg rounded-xl p-3 space-y-2">
                        <div className="flex gap-1 justify-center">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)}
                              onClick={() => setUserRating(s)}>
                              <Star className={`w-6 h-6 transition-colors ${(hoverRating || userRating) >= s ? 'fill-orange text-orange' : 'text-gray-200'}`} />
                            </button>
                          ))}
                        </div>
                        <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                          placeholder="اكتب تعليقاً (اختياري)..."
                          className="w-full h-16 p-2 border border-border rounded-lg text-xs resize-none focus:outline-none focus:border-orange" />
                        <button onClick={async () => {
                          if (!userRating || !user || !listing) return;
                          await ratingsService.create({
                            listingId: listing.id,
                            fromUserId: user.id,
                            fromUserName: user.name || 'مستخدم',
                            toUserId: listing.userId,
                            rating: userRating,
                            comment: reviewText,
                          });
                          setHasRated(true);
                          setShowReviewForm(false);
                          const updated = await ratingsService.getByUser(listing.userId);
                          setRatings(updated);
                          setUserRating(0);
                          setReviewText('');
                        }} disabled={!userRating}
                          className="w-full h-9 bg-orange hover:bg-orange-dark text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
                          إرسال التقييم
                        </button>
                      </div>
                    )}
                  </>
                ) : null}

                {ratings.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                    {ratings.slice(0, 5).map((r: any) => (
                      <div key={r.id} className="bg-bg rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-text">{r.fromUserName}</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-orange text-orange' : 'text-gray-200'}`} />
                            ))}
                          </div>
                        </div>
                        {r.comment && <p className="text-[11px] text-text-light">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 mt-4">
                {listing.advertiserName && (
                  <div className="flex items-center gap-2 bg-orange/5 border border-orange/20 rounded-xl px-3 py-2.5">
                    <Store className="w-4 h-4 text-orange flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-[11px] text-text-light">اسم المعلن</span>
                      <span className="block font-bold text-text leading-tight">{listing.advertiserName}</span>
                    </div>
                  </div>
                )}
                {(user && listing.userId) || listing.contactPhone || listing.userPhone ? (
                  <>
                    {user && (
                      listing.userId && user.id !== listing.userId ? (
                        <Link to={`/inbox/${listing.userId}`}
                          className="flex items-center justify-center gap-2 w-full h-12 bg-orange hover:bg-orange-dark text-white font-bold rounded-xl transition-colors">
                          <MessageCircle className="w-5 h-5" />
                          رسالة
                        </Link>
                      ) : user.id === listing.userId ? (
                        <button
                          onClick={() => toast('ده إعلانك ✅ — الزرار ده للمشترين.', 'info')}
                          className="flex items-center justify-center gap-2 w-full h-12 bg-orange/80 hover:bg-orange text-white font-bold rounded-xl transition-colors">
                          <MessageCircle className="w-5 h-5" />
                          رسالة
                        </button>
                      ) : (
                        <button
                          onClick={() => toast(listing.userName ? `صاحب الإعلان (${listing.userName}) مش مسجل في المنصة — تواصل معه بـ واتساب أو الاتصال المباشر ده.` : 'صاحب الإعلان مش مسجل في المنصة — تواصل معه بـ واتساب أو الاتصال المباشر ده.', 'info')}
                          className="flex items-center justify-center gap-2 w-full h-12 bg-orange/80 hover:bg-orange text-white font-bold rounded-xl transition-colors">
                          <MessageCircle className="w-5 h-5" />
                          رسالة
                        </button>
                      )
                    )}
                    {(callPhone || waPhone) && (
                      <>
                    <ProtectedPhoneButton phone={waPhone || callPhone}>
                      <a href={getWhatsAppLink(waPhone || callPhone, waMessage)}
                        target="_blank" rel="noopener noreferrer"
                        onClick={() => { try { trackAdClick(id!, utm.source, 'whatsapp', utm.campaign).catch(() => {}); reportContactClick(id!, 'whatsapp'); } catch {} }}
                        className="flex items-center justify-center gap-2 w-full h-12 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors">
                        <MessageCircle className="w-5 h-5" />
                        واتساب
                      </a>
                    </ProtectedPhoneButton>
                    <ProtectedPhoneButton phone={callPhone}>
                      <a href={getPhoneLink(callPhone)}
                        onClick={() => { try { trackAdClick(id!, utm.source, 'phone', utm.campaign).catch(() => {}); reportContactClick(id!, 'phone'); } catch {} }}
                        className="flex items-center justify-center gap-2 w-full h-12 bg-navy hover:bg-navy/90 text-white font-bold rounded-xl transition-colors">
                        <Phone className="w-5 h-5" />
                        اتصال مباشر
                      </a>
                    </ProtectedPhoneButton>
                      </>
                    )}
                  </>
                ) : null}
                {/* ملاحظة: ماسنجر/فيسبوك المعلن أدوات للأدمن فقط — تظهر في لوحة الأدمن مش هنا،
                    عشان العميل يتواصل جوه التطبيق (رسالة/اتصال) ويبص على صور العربية من المنصة بقى */}

                <a href={getWhatsAppLink('01277177710', `السلام عليكم، أريد قسط عربية (تسهيلات). بخصوص الإعلان: ${listing.title} — ${getSiteUrl()}${listingUrl(listing.id, listing.slug as string | undefined)}`)}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => { try { trackAdClick(id!, utm.source, 'tasehil', utm.campaign).catch(() => {}); reportContactClick(id!, 'tasehil'); } catch {} }}
                  className="flex items-center justify-center gap-2 w-full h-12 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl transition-colors">
                  <BadgeDollarSign className="w-5 h-5" />
                  قسط عربيتك مع تساهيل
                </a>

                {/* أدوات صاحب الإعلان — بتظهر لصاحب الإعلان بس (أو الأدمن) */}
                {user && (user.id === listing.userId || user.type === 'admin') && (
                  <div className="rounded-2xl border-2 border-dashed border-border bg-bg/60 p-3 space-y-2">
                    <p className="text-[11px] font-bold text-text-light text-center">أدوات صاحب الإعلان</p>

                    {listing.status === 'sold' ? (
                      <button onClick={async () => {
                        setSoldLoading(true);
                        try {
                          await listingsService.update(listing.id, {
                            status: 'pending',
                            soldThroughTareeq: false,
                          });
                          setListing(prev => prev ? { ...prev, status: 'pending', soldThroughTareeq: false } : null);
                        } catch (err) {
                          console.error(err);
                        }
                        setSoldLoading(false);
                      }}
                        className="flex items-center justify-center gap-2 w-full h-11 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors text-sm"
                      >
                        {soldLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                        {listing.listingType === 'rent' ? 'إلغاء الإيجار' : 'إلغاء البيع'}
                      </button>
                    ) : (
                      <button onClick={() => setShowSoldModal(true)}
                        className="flex items-center justify-center gap-2 w-full h-11 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors text-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {listing.listingType === 'rent' ? 'تم الإيجار' : 'تم البيع'}
                      </button>
                    )}

                    <Link to={`/promote/${listing.id}`}
                      className="flex items-center justify-center gap-2 w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors text-sm">
                      <Star className="w-4 h-4" />
                      ترقية الإعلان
                    </Link>

                    <Link to={`/listing/${listing.id}/edit`}
                      className="flex items-center justify-center gap-2 w-full h-11 border border-border bg-white hover:bg-gray-50 text-text font-bold rounded-xl transition-colors text-sm">
                      <Pencil className="w-4 h-4" />
                      تعديل الإعلان
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Safety */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <h3 className="font-bold text-yellow-800 text-sm">نصائح السلامة</h3>
              </div>
              <ul className="space-y-1.5 text-xs text-yellow-700">
                <li>• قابل البائع في مكان عام وآمن</li>
                <li>• تحقق من المركبة قبل الدفع</li>
                <li>• لا ترسل دفعات مسبقة</li>
                <li>• تأكد من مستندات الملكية</li>
              </ul>
            </div>

            {/* سيارات مناسبة (ذكاء اصطناعي) */}
            {(['trucks', 'trailers', 'buses'].includes(listing.category)) && (
              <AiMatch target="truck" id={listing.id} title="سيارات مناسبة لشاحنتك" />
            )}
          </div>
        </div>
      </div>

      {/* إعلانات مشابهة */}
      {similarListings.length > 0 && (
        <section className="border-t border-border bg-surface/40">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-navy flex items-center gap-2">
                <span className="w-1 h-5 bg-orange rounded-full" />
                إعلانات مشابهة
              </h2>
              <Link to={`/vehicles?category=${listing?.category || ''}`} className="flex items-center gap-1 text-orange font-bold text-sm">
                عرض الكل <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {similarListings.map(l => (
                <Link key={l.id} to={listingUrl(l.id, l.slug)}
                  className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                  <div className="relative aspect-[16/10] bg-bg">
                    <OptimizedImage src={watermarkImage(l.images?.[0], l.contactPhone || l.userPhone) || ''} alt={l.title} size="small"
                      className="absolute inset-0 w-full h-full"
                      fallback={<div className="w-full h-full bg-navy/10 flex items-center justify-center text-navy/30 text-xs font-bold">{l.title?.slice(0, 20)}</div>} />
                    {l.listingType === 'rent' && (
                      <span className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg">للإيجار</span>
                    )}
                    {l.price > 0 && (
                      <span className="absolute bottom-2 left-2 bg-navy/80 text-white text-[11px] font-bold px-2 py-1 rounded-lg dir-ltr">{formatPrice(l.price)}</span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3 className="font-bold text-text text-xs leading-snug line-clamp-2">{l.title}</h3>
                    <p className="flex items-center gap-1 text-[11px] text-text-light mt-1 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {l.governorate}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* شاهدت مؤخرًا */}
      {recentListings.length > 0 && (
        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-navy flex items-center gap-2">
                <span className="w-1 h-5 bg-orange rounded-full" />
                شاهدت مؤخرًا
              </h2>
            </div>
            <div className="overflow-x-auto hide-scrollbar snap-x snap-mandatory">
              <div className="flex gap-3 pb-2 w-max">
                {recentListings.map(l => (
                  <Link key={l.id} to={listingUrl(l.id, l.slug)}
                    className="w-56 shrink-0 snap-start bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="relative aspect-[16/10] bg-bg">
                      <OptimizedImage src={watermarkImage(l.images?.[0], l.contactPhone || l.userPhone) || ''} alt={l.title} size="small"
                        className="absolute inset-0 w-full h-full"
                        fallback={<div className="w-full h-full bg-navy/10 flex items-center justify-center text-navy/30 text-xs font-bold">{l.title?.slice(0, 20)}</div>} />
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-text text-sm leading-snug truncate">{l.title}</h3>
                      <p className="flex items-center gap-1 text-xs text-text-light mt-1 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {l.governorate}
                      </p>
                      <p className="text-orange font-extrabold text-sm mt-2">{displayPrice(l.price, l.priceType)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Sold Modal */}
      {showSoldModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSoldModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-bold text-text text-lg mb-2 text-center">{listing.listingType === 'rent' ? 'تأكيد الإيجار' : 'تأكيد البيع'}</h3>
            <p className="text-text-light text-sm mb-6 text-center">
              هل أنت متأكد من {listing.listingType === 'rent' ? 'تأجير' : 'بيع'} هذا الإعلان <strong>نهائياً</strong>؟
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowSoldModal(false)}
                className="flex-1 h-12 border border-border rounded-xl text-text-light font-semibold text-sm hover:bg-bg transition-colors">
                إلغاء
              </button>
              <button onClick={async () => {
                setSoldLoading(true);
                try {
                  await listingsService.update(listing.id, {
                    status: 'sold',
                    soldThroughTareeq: false,
                  });
                  setListing(prev => prev ? { ...prev, status: 'sold', soldThroughTareeq: false } : null);
                  setShowSoldModal(false);
                } catch (err) { console.error(err); }
                setSoldLoading(false);
              }}
                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors">
                {soldLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'لا، خارج المنصة'}
              </button>
              <button onClick={async () => {
                setSoldLoading(true);
                try {
                  await listingsService.update(listing.id, {
                    status: 'sold',
                    soldThroughTareeq: true,
                  });
                  setListing(prev => prev ? { ...prev, status: 'sold', soldThroughTareeq: true } : null);
                  setShowSoldModal(false);
                } catch (err) { console.error(err); }
                setSoldLoading(false);
              }}
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors">
                {soldLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'نعم، عبر كار مصر'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-text text-lg mb-2">الإبلاغ عن هذا الإعلان</h3>
            <p className="text-text-light text-sm mb-4">هل تريد الإبلاغ عن هذا الإعلان؟ سنراجع البلاغ في أقرب وقت.</p>
            <textarea value={reportReason} onChange={e => setReportReason(e.target.value)}
              placeholder="اذكر سبب الإبلاغ..."
              className="w-full h-24 p-3 border border-border rounded-xl text-sm resize-none focus:outline-none focus:border-orange mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowReport(false)}
                className="flex-1 h-11 border border-border rounded-xl text-text-light font-semibold text-sm hover:bg-bg transition-colors">
                إلغاء
              </button>
              <button onClick={sendReport} disabled={!reportReason.trim()}
                className="flex-1 h-11 bg-danger hover:bg-danger/90 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50">
                إرسال البلاغ
              </button>
            </div>
          </div>
        </div>
      )}
      {reportSent && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-6 py-3 rounded-xl shadow-lg text-sm font-bold">
          تم إرسال البلاغ، شكراً لك!
        </div>
      )}
    </div>
    </>
  );
}




