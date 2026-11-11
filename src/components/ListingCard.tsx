import { statusLabel, showsStatusBadge } from "../lib/listingStatus";
import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Heart, BadgeCheck, MessageCircle, Calendar, Share2, Store, ChevronLeft, Tag, Facebook, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Listing } from '../types';
import { formatPrice, formatTitle, displayPrice, adTitle, formatDate, getWhatsAppLink, listingUrl, shareUrl, getShortLink, listingWhatsApp, shareOnFacebook, shareWithImage, buildAdShareText, copyText } from '../lib/utils';
import { listingTypeLabel } from '../lib/listingMeta';
import OptimizedImage from './OptimizedImage';
import ImageWatermark from './ImageWatermark';
import ProtectedPhoneButton from './ProtectedPhoneButton';
import { getSiteUrl } from '../lib/config';
import { trackAdClick, currentUtm } from '../lib/adAnalytics';
import { reportContactClick } from '../lib/sellerApi';
import { toast } from './Toast';
import { watermarkImage } from '../lib/imageUtils';
import { videoPosterUrl } from '../lib/storageService';

interface ListingCardProps {
  listing: Listing;
  featured?: boolean;
  index?: number;
  href?: string;
  actions?: ReactNode;
  onImageClick?: (e: React.MouseEvent) => void;
  imageClassName?: string;
}

const FAV_KEY = 'tareeq_favorites';

function getFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}

function saveFavs(ids: string[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}

/** عنوان الإعلان: بنضيف الماركة/الموديل/السنة بس لو مش موجودة في نص المعلن — عشان ميتكررش ويبان الإعلان كقطعتين */

export default function ListingCard({ listing, featured, index = 0, href, actions, onImageClick, imageClassName }: ListingCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  // رقم الواتساب بتاع صاحب الإعلان (مش بتاع اللي بيشوف)
  const waPhone = listingWhatsApp(listing);

  const isFeatured = featured || (!!listing.featured && (!listing.featuredUntil || new Date(listing.featuredUntil) > new Date()));

  const link = href ?? listingUrl(listing.id, listing.slug);

  useEffect(() => {
    setIsFavorite(getFavs().includes(listing.id));
  }, [listing.id]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const favs = getFavs();
    if (favs.includes(listing.id)) {
      saveFavs(favs.filter(id => id !== listing.id));
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
      className={`group card-surface overflow-hidden card-hover relative ${isFeatured ? 'ring-2 ring-orange/25' : ''}`}
    >
      <Link to={link} className="block" onClick={e => { const u = currentUtm(); trackAdClick(listing.id, u.source, 'click', u.campaign).catch(() => {}); if (onImageClick) { e.preventDefault(); onImageClick(e); } }}>
        <div className={`relative ${imageClassName || 'aspect-[4/3]'} overflow-hidden bg-bg`}>
          <OptimizedImage
            src={watermarkImage(listing.images?.[0], listing.contactPhone || listing.userPhone) || videoPosterUrl(listing.videoUrl || '') || ''}
            alt={listing.title}
            size="small"
            className="w-full h-full transition-transform duration-300 group-hover:scale-105"
            fallback={
              <div className="w-full h-full bg-navy/10 flex items-center justify-center text-navy/30 text-xs font-bold">
                {listing.title?.slice(0, 20)}
              </div>
            }
          />
          {listing.status === 'sold' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="bg-red-600 text-white text-sm font-extrabold px-6 py-2 -rotate-12 rounded-lg shadow-lg tracking-wider ring-2 ring-white/50">
                {listing.listingType === 'rent' ? 'تم الإيجار' : 'تم البيع'}
              </span>
            </div>
          )}
          <ImageWatermark phone={listing.contactPhone || listing.userPhone} />
          {String(listing.id).startsWith('sample-') && (
            <div className="absolute top-2 left-2 bg-gray-700/80 text-white text-[10px] font-bold px-2 py-1 rounded-lg z-10">
              تجريبي (عرض)
            </div>
          )}
          {isFeatured && !listing.status?.startsWith('sold') && (
            <div className={`absolute right-2 bg-orange text-white text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-md ${listing.listingType === 'rent' ? 'top-9' : 'top-2'}`}>
              مميز
            </div>
          )}
          {(listing.userType === 'dealer' || (listing as { isDealer?: boolean }).isDealer) && (
            <div className={`absolute right-2 bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-1 rounded-lg shadow-md ${isFeatured ? 'top-[3.4rem]' : 'top-2'}`}>
              عرض من معرض
            </div>
          )}
          {listing.listingType === 'rent' && (
            <div className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg z-10">
              للإيجار
            </div>
          )}
{showsStatusBadge(listing.status, listing.priceType) && (() => {
            const st = listing.priceType === "sold" ? "sold" : listing.status;
            return statusLabel(st) ? (
              <div
                className={`absolute top-2 right-2 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-lg ${
                  st === "sold"
                    ? "bg-red-600/90"
                    : st === "reserved"
                    ? "bg-amber-500/90"
                    : "bg-gray-600/90"
                }`}
              >
                {statusLabel(st)}
              </div>
            ) : null;
          })()}
          {listing.verified && (
            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur text-navy text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
              <BadgeCheck className="w-3 h-3 text-orange" />
              موثّق
            </div>
          )}
          {!!listing.videoUrl && (
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
              <Video className="w-3 h-3" />
              فيديو
            </div>
          )}
          <button
            onClick={toggleFavorite}
            className="absolute bottom-2 left-2 p-2 rounded-full bg-white/90 backdrop-blur shadow-sm hover:bg-white transition-colors"
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-text-light'}`} />
          </button>
        </div>
      </Link>
      {actions && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1">{actions}</div>
      )}

      <div className="p-3 sm:p-4">
        <Link to={link}>
          <h3 className="font-extrabold text-text line-clamp-2 text-[15px] sm:text-lg leading-snug min-h-[2.6rem] group-hover:text-orange transition-colors">
            {adTitle(listing)}
          </h3>
        </Link>
        {listing.listingType === 'rent' ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
              {listing.dailyPrice   && <span className="bg-blue-50 px-2 py-0.5 rounded font-semibold">{formatPrice(listing.dailyPrice)}/يوم</span>}
              {listing.weeklyPrice  && <span className="bg-blue-50 px-2 py-0.5 rounded font-semibold">{formatPrice(listing.weeklyPrice)}/أسبوع</span>}
              {listing.monthlyPrice && <span className="bg-blue-50 px-2 py-0.5 rounded font-semibold">{formatPrice(listing.monthlyPrice)}/شهر</span>}
            </div>
            {listing.availableFrom && (
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <Calendar className="w-3 h-3" />
                متاح من {listing.availableFrom} {listing.availableTo ? 'إلى' : ''}
              </div>
            )}
          </div>
        ) : (
          <p className="text-lg sm:text-xl font-extrabold text-orange mt-2">
            {displayPrice(listing.price, listing.priceType)}
            {listing.price > 0 && listing.priceType === 'negotiable' && (
              <span className="block text-xs font-bold text-text-light mt-0.5">قابل للتفاوض</span>
            )}
          </p>
        )}
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {[
            { Icon: MapPin, value: listing.governorate || 'مصر' },
            { Icon: Tag, value: listing.model || listing.brand || '—' },
            {
              Icon: Calendar,
              value: listing.year
                ? String(listing.year)
                : listing.condition === 'new' ? 'جديد' : 'مستعمل',
            },
          ].map(({ Icon, value }, i) => (
            <span key={i} className="flex items-center gap-1 bg-bg rounded-lg px-2 py-1.5 min-w-0">
              <Icon className="w-3.5 h-3.5 text-orange flex-shrink-0" />
              <span className="text-[11px] font-semibold text-text-light line-clamp-1">{value}</span>
            </span>
          ))}
        </div>

        {(listing.advertiserName || listing.userName || listing.createdAt) && (
          <div className="flex items-center justify-between gap-2 mt-3 text-xs min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Store className="w-3.5 h-3.5 text-orange flex-shrink-0" />
              <span className="font-bold text-text-light line-clamp-1">
                {listing.advertiserName || listing.userName || listingTypeLabel(listing.category, listing.subcategory)}
              </span>
              {listing.verified && <BadgeCheck className="w-3.5 h-3.5 text-orange flex-shrink-0" />}
            </div>
            {listing.createdAt && (
              <span className="flex items-center gap-1 text-text-light flex-shrink-0">
                <Calendar className="w-3 h-3" />
                {formatDate(listing.createdAt)}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
          <Link
            to={link}
            className="inline-flex items-center gap-1 text-orange font-bold text-sm"
          >
            <motion.span
              className="inline-flex items-center"
              whileHover={{ y: -2, scale: 1.04 }}
              transition={{ type: 'spring', stiffness: 400, damping: 12 }}
            >
              عرض التفاصيل
            </motion.span>
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={async e => {
                e.preventDefault();
                e.stopPropagation();
                const url = shareUrl('listing', listing.id);
                const text = buildAdShareText({ ...listing, url }, { withImages: false });
                // موبايل: مشاركة الصورة نفسها كملف (واتساب يستقبلها كصورة)
                if (await shareWithImage({ title: listing.title, text, url, imageUrl: listing.images?.[0] })) return;
                if (typeof navigator.share === 'function') {
                  try {
                    await navigator.share({ title: listing.title, text, url });
                    return;
                  } catch (err) {
                    if ((err as Error)?.name === 'AbortError') return;
                  }
                }
                const ok = await copyText(text);
                shareOnFacebook(url);
                toast(ok ? 'تم نسخ تفاصيل الإعلان — الصقها في المنشور (Ctrl+V)' : 'افتح المنشور وانسخ التفاصيل يدويًا', ok ? 'success' : 'error');
              }}
              aria-label="مشاركة على فيسبوك"
              className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Facebook className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">فيسبوك</span>
            </button>
            {waPhone && (
              <ProtectedPhoneButton phone={waPhone}>
                <a
                  href={getWhatsAppLink(waPhone, `السلام عليكم، أهتم بإعلانكم على كار مصر: ${listing.title}\n🔗 ${getSiteUrl()}${link}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => {
                    e.stopPropagation();
                    const u = currentUtm();
                    trackAdClick(listing.id, u.source, 'whatsapp', u.campaign).catch(() => {});
                    reportContactClick(listing.id, 'whatsapp');
                  }}
                  className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>واتساب</span>
                </a>
              </ProtectedPhoneButton>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}


