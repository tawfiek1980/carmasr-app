import { useRef, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Share2, X, Loader2, Copy, Check, Link2, Phone } from 'lucide-react';
import { displayPrice } from '../lib/utils';
import { getSiteUrl } from '../lib/config';
import type { Listing } from '../types';

interface ShareableAdCardProps {
  listing: Listing;
  onClose: () => void;
}

function PlatformUrlRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm text-gray-600">
      <span className="text-xs font-bold text-orange w-16 shrink-0">{label}</span>
      <span className="font-mono text-[10px] truncate flex-1 text-gray-400">{url}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex items-center gap-1 text-orange font-bold text-xs shrink-0"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'تم' : 'نسخ'}
      </button>
    </div>
  );
}

export default function ShareableAdCard({ listing, onClose }: ShareableAdCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl = getSiteUrl();
  const adUrl = `${baseUrl}/ad/${listing.id}`;
  const ogImageUrl = listing.images?.[0] || `${baseUrl}/og-default.jpg`;

  const getTrackedUrl = (source: string, medium: string = 'social', campaign: string = '') => {
    const params = new URLSearchParams({ utm_source: source, utm_medium: medium });
    if (campaign) params.set('utm_campaign', campaign);
    return `${adUrl}?${params.toString()}`;
  };

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a1628',
        scale: 2,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `tareeq-${listing.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }, [listing.id]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing.title,
          text: `${listing.title}\n${displayPrice(listing.price, listing.priceType)}\n${listing.governorate}`,
          url: adUrl,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(adUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [listing, adUrl]);

  const categoryLabels: Record<string, string> = {
    trucks: 'شاحنات',
    equipment: 'معدات ثقيلة',
    trailers: 'مقطورات',
    buses: 'حافلات',
    'spare-parts': 'قطع غيار',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">صورة الإعلان للنشر</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Ad Card Preview */}
        <div className="p-4">
          <div
            ref={cardRef}
            dir="rtl"
            className="rounded-xl overflow-hidden shadow-lg"
            style={{
              width: '1080px',
              maxWidth: '100%',
              background: 'linear-gradient(135deg, #0a1628 0%, #132a45 50%, #0f1f36 100%)',
            }}
          >
            {/* Main Image */}
            <div className="relative w-full" style={{ paddingBottom: '60%' }}>
              <img
                src={listing.images?.[0]}
                alt={listing.title}
                className="absolute inset-0 w-full h-full object-cover"
                crossOrigin="anonymous"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Category Badge */}
              <div className="absolute top-4 right-4 bg-orange text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg">
                {categoryLabels[listing.category] || listing.category}
              </div>

              {/* Price on Image */}
              <div className="absolute bottom-4 right-4 left-4">
                <div className="bg-white/95 backdrop-blur rounded-xl p-4 shadow-xl">
                  <h2 className="text-xl font-extrabold text-gray-900 leading-tight line-clamp-2">
                    {listing.title}
                  </h2>
                  <p className="text-2xl font-black text-orange mt-2">
                    {displayPrice(listing.price, listing.priceType)}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <span>{listing.governorate}</span>
                    {listing.location && <span>— {listing.location}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 flex items-center justify-between" style={{ background: 'rgba(10,22,40,0.95)' }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-lg">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-black text-xl leading-tight" dir="ltr">{listing.contactPhone || listing.userPhone || '—'}</p>
                  <p className="text-gray-400 text-xs">تواصل مع المعلن مباشرة</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <QRCodeSVG
                  value={adUrl}
                  size={56}
                  bgColor="transparent"
                  fgColor="#ffffff"
                  level="M"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          {/* Platform-specific tracked URLs */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> روابط متابعة حسب المنصة:
            </p>
            <PlatformUrlRow label="فيسبوك" url={getTrackedUrl('facebook', 'social')} />
            <PlatformUrlRow label="واتساب" url={getTrackedUrl('whatsapp', 'social')} />
            <PlatformUrlRow label="تويتر" url={getTrackedUrl('twitter', 'social')} />
            <PlatformUrlRow label="إعلان مدفوع" url={getTrackedUrl('ads', 'cpc', 'promo')} />
          </div>

          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm text-gray-600">
            <span className="font-mono text-xs truncate flex-1">{adUrl}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(adUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1 text-orange font-bold text-xs shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 bg-orange hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {downloading ? 'جاري التحميل...' : 'تحميل الصورة'}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
            >
              <Share2 className="w-5 h-5" />
              مشاركة
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            الصورة جاهزة للنشر على فيسبوك وواتساب ومجموعات النقل
          </p>
        </div>
      </div>
    </div>
  );
}
