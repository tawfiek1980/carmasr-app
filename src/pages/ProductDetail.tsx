import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Package, ChevronLeft, Phone, Share2, Store, MapPin, Camera, ChevronRight, CheckCircle2, MessageCircle, X, ZoomIn, Loader2, Undo2 } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import SeoHead from '../components/SeoHead';
import { exhibitionsService } from '../lib/firestoreService';
import ProtectedPhoneButton from '../components/ProtectedPhoneButton';
import { getWhatsAppLink } from '../lib/utils';
import type { ExhibitionProduct } from '../types';
import { getSiteUrl } from '../lib/config';
import { cleanText, displayPrice } from '../lib/utils';
import { optimizeImage } from '../lib/imageUtils';
import { useAuth } from '../contexts/AuthContext';

const priceToNum = (p?: string | number) => Number(String(p ?? '').replace(/[^\d]/g, '')) || 0;

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ExhibitionProduct | null>(null);
  const [related, setRelated] = useState<ExhibitionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldLoading, setSoldLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!lightboxOpen) return;
    const imgs = product?.images?.length ? product.images : (product?.image ? [product.image] : []);
    const n = imgs.length || 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      else if (e.key === 'ArrowLeft') setGalleryIdx(i => (i - 1 + n) % n);
      else if (e.key === 'ArrowRight') setGalleryIdx(i => (i + 1) % n);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen, product]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    exhibitionsService.getProductById(id)
      .then(async p => {
        if (!p) { navigate('/products'); return; }
        setProduct(p);
        setGalleryIdx(0);
        if (p.exhibitionId) {
          try {
            const all = await exhibitionsService.getProducts(p.exhibitionId);
            setRelated(all.filter(x => x.id !== p.id).slice(0, 4));
          } catch { /* ignore */ }
        }
      })
      .catch(() => navigate('/products'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return (
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  if (!product) return null;

  const images = product.images?.length ? product.images : (product.image ? [product.image] : []);
  const isSold = product.status === 'sold';
  const isOwner = !!user && (user.id === product.userId || user.type === 'admin');

  const siteUrl = getSiteUrl();
  const productUrl = `${siteUrl}/product/${id}`;
  const specBits = [product.brand, product.model, product.year ? String(product.year) : ''].filter(Boolean).join(' ');
  const seoTitle = [product.name, specBits].filter(Boolean).join(' ');
  const priceNum = priceToNum(product.price);
  const seoDesc = [
    product.name,
    specBits,
    product.price ? `السعر ${product.price} جنيه` : '',
    product.category ? `تصنيف ${product.category}` : '',
    product.exhibitionName ? `من معرض ${cleanText(product.exhibitionName)}` : '',
    product.governorate ? `- ${cleanText(product.governorate)}` : '',
    'على كار مصر CarMasr سوق النقل الثقيل في مصر.',
  ].filter(Boolean).join(' - ');
  const seoImage = images[0] || undefined;
  const seoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || seoDesc,
    image: images.length ? images : undefined,
    category: product.category || undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    model: product.model || undefined,
    url: productUrl,
    ...(priceNum > 0 ? {
      offers: {
        '@type': 'Offer',
        price: priceNum,
        priceCurrency: 'EGP',
        availability: isSold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        url: productUrl,
        ...(product.exhibitionName ? { seller: { '@type': 'Organization', name: cleanText(product.exhibitionName) } } : {}),
      },
    } : {}),
  };

  const shareProduct = () => {
    const shareUrl = `${getSiteUrl()}/api/share?type=product&id=${id}`;
    const text = `${product.name}\n${priceNum > 0 ? `💰 ${product.price}` : ''}\n📍 ${cleanText(product.governorate) || ''}\nعبر كار مصر`;
    if (navigator.share) {
      navigator.share({ title: product.name, text, url: shareUrl }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send/?text=${encodeURIComponent(text + '\n' + shareUrl)}`, '_blank');
    }
  };

  const whatsAppMessage = () => {
    if (!product.exhibitionPhone) return;
    const lines: string[] = ['السلام عليكم، أهتم بإعلانكم وحاب أعرف تفاصيل أكتر:', ''];
    const title = cleanText(product.name) || [product.brand, product.model, product.year].filter(Boolean).join(' ');
    if (title) lines.push(`🚛 المنتج: ${title}`);
    const priceText = displayPrice(priceNum, product.priceType) || (product.price || '');
    if (priceText) lines.push(`💰 السعر: ${priceText}`);
    const details: string[] = [];
    if (product.condition) details.push(product.condition === 'used' ? 'مستعمل' : 'جديد');
    if (product.year) details.push(`سنة ${product.year}`);
    if (product.governorate) details.push(cleanText(product.governorate));
    if (details.length) lines.push(`📋 التفاصيل: ${details.join(' | ')}`);
    if (product.exhibitionName) lines.push(`🏬 المعرض: ${cleanText(product.exhibitionName)}`);
    const desc = (product.description || '').replace(/\s+/g, ' ').trim();
    if (desc) lines.push(`📝 ${desc.slice(0, 300)}${desc.length > 300 ? '…' : ''}`);
    lines.push('');
    lines.push(`🔗 رابط المنتج: ${getSiteUrl()}/product/${product.id}`);
    window.open(getWhatsAppLink(product.exhibitionPhone, lines.join('\n')), '_blank');
  };

  const markSold = async (sold: boolean) => {
    setSoldLoading(true);
    try {
      await exhibitionsService.setProductSold(product.exhibitionId || '', product.id, sold);
      setProduct(prev => prev ? { ...prev, status: sold ? 'sold' : 'active' } : null);
      setShowSoldModal(false);
    } catch (e) { console.error(e); } finally { setSoldLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg">
      <SeoHead
        title={seoTitle}
        description={seoDesc}
        ogImage={seoImage}
        ogType="product"
        canonical={productUrl}
        jsonLd={seoJsonLd}
      />
      {/* Image Gallery */}
      <div className="relative bg-black">
        {images.length > 0 ? (
          <>
            <div className="h-80 sm:h-[30rem] overflow-hidden relative group">
              <img src={optimizeImage(images[galleryIdx], 'large')} alt={product.name}
                onClick={() => setLightboxOpen(true)}
                className="w-full h-full object-contain cursor-zoom-in" />
              <button onClick={() => setLightboxOpen(true)} aria-label="عرض الصورة بالحجم الكامل"
                className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>
            {isSold && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className="bg-red-600 text-white text-lg font-extrabold px-8 py-3 -rotate-12 rounded-lg shadow-lg tracking-wider ring-2 ring-white/60">
                  تم البيع
                </span>
              </div>
            )}
            {images.length > 1 && (
              <>
                <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
                  <button onClick={() => setGalleryIdx(i => (i - 1 + images.length) % images.length)}
                    className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button onClick={() => setGalleryIdx(i => (i + 1) % images.length)}
                    className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setGalleryIdx(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === galleryIdx ? 'bg-white w-4' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="h-80 sm:h-[30rem] bg-gray-100 flex items-center justify-center">
            <Camera className="w-20 h-20 text-gray-200" />
          </div>
        )}
        <Link to="/products"
          className="absolute top-4 right-4 z-10 bg-black/30 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-sm flex items-center gap-1 hover:bg-black/50 transition-colors">
          <ChevronLeft className="w-4 h-4 rtl-flip" /> العودة
        </Link>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="bg-black pb-3 px-4 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button key={i} onClick={() => setGalleryIdx(i)}
              className={`w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${i === galleryIdx ? 'border-orange' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              <img src={optimizeImage(img, 'thumb')} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-text">{product.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {product.category && (
                  <span className="text-xs bg-orange/10 text-orange px-2.5 py-0.5 rounded-full font-semibold">
                    {product.category}
                  </span>
                )}
                {product.exhibitionName && (
                  <span className="text-xs bg-gray-100 text-text-light px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <Store className="w-3 h-3" /> {cleanText(product.exhibitionName)}
                  </span>
                )}
              </div>
            </div>
            <button onClick={shareProduct}
              className="flex items-center gap-1.5 bg-surface border border-border hover:bg-gray-50 text-text-light hover:text-orange px-3 py-2 rounded-xl text-sm transition-colors flex-shrink-0">
              <Share2 className="w-4 h-4" /> مشاركة
            </button>
          </div>
          {(priceNum > 0 || product.priceType === 'call' || product.priceType === 'negotiable') && <p className="text-2xl font-black text-orange mt-2">{displayPrice(priceNum, product.priceType)}</p>}
        </div>

        {(product.brand || product.model || product.year || product.subcategory || product.condition) && (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <h2 className="font-bold text-text mb-3">المواصفات</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {product.brand && (
                <div className="flex items-center gap-2">
                  <span className="text-text-light">الماركة:</span>
                  <span className="font-semibold text-text">{product.brand}</span>
                </div>
              )}
              {product.model && (
                <div className="flex items-center gap-2">
                  <span className="text-text-light">الموديل:</span>
                  <span className="font-semibold text-text">{product.model}</span>
                </div>
              )}
              {product.year && (
                <div className="flex items-center gap-2">
                  <span className="text-text-light">سنة الصنع:</span>
                  <span className="font-semibold text-text">{product.year}</span>
                </div>
              )}
              {product.subcategory && (
                <div className="flex items-center gap-2">
                  <span className="text-text-light">الفئة الفرعية:</span>
                  <span className="font-semibold text-text">{product.subcategory}</span>
                </div>
              )}
              {product.condition && (
                <div className="flex items-center gap-2">
                  <span className="text-text-light">الحالة:</span>
                  <span className="font-semibold text-text">{product.condition === 'new' ? 'جديد' : 'مستعمل'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {product.description && (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <h2 className="font-bold text-text mb-2">الوصف</h2>
            <p className="text-text-light text-sm leading-relaxed whitespace-pre-wrap">{product.description}</p>
          </div>
        )}

        <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
          <h2 className="font-bold text-text">معلومات المعرض</h2>
          {product.exhibitionName && (
            <div className="flex items-center gap-2 text-sm">
              <Store className="w-4 h-4 text-text-light" />
              <span className="text-text-light">{cleanText(product.exhibitionName)}</span>
            </div>
          )}
          {product.governorate && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-text-light" />
              <span className="text-text-light">{cleanText(product.governorate)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {product.exhibitionPhone && (
            <>
              <ProtectedPhoneButton phone={product.exhibitionPhone} className="flex-1">
                <a href={`tel:${product.exhibitionPhone}`}
                  className="flex-1 bg-orange hover:bg-orange-dark text-white py-3 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                  <Phone className="w-4 h-4" /> اتصل
                </a>
              </ProtectedPhoneButton>
              <button onClick={whatsAppMessage}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4" /> واتساب
              </button>
            </>
          )}
          {product.exhibitionId && (
            <Link to={`/exhibitions/${product.exhibitionId}`}
              className="flex-1 bg-surface border border-border hover:bg-gray-50 text-text py-3 rounded-2xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
              <Store className="w-4 h-4" /> المعرض
            </Link>
          )}
        </div>

        {isOwner && (
          <div className="rounded-2xl border-2 border-dashed border-border bg-bg/60 p-3 space-y-2">
            <p className="text-[11px] font-bold text-text-light text-center">أدوات صاحب الإعلان</p>
            {isSold ? (
              <button onClick={() => markSold(false)} disabled={soldLoading}
                className="flex items-center justify-center gap-2 w-full h-11 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors text-sm">
                {soldLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} إلغاء البيع
              </button>
            ) : (
              <button onClick={() => setShowSoldModal(true)}
                className="flex items-center justify-center gap-2 w-full h-11 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors text-sm">
                <CheckCircle2 className="w-4 h-4" /> تم البيع
              </button>
            )}
          </div>
        )}

        {/* Related Products */}
        {related.length > 0 && (
          <div className="pt-2">
            <h2 className="font-bold text-text mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange" /> منتجات مشابهة
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {related.map(rp => {
                const rpImages = rp.images?.length ? rp.images : (rp.image ? [rp.image] : []);
                return (
                  <Link key={rp.id} to={`/product/${rp.id}`}
                    className="bg-surface rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-orange/20 transition-all">
                    <div className="h-24 bg-gray-50">
                      {rpImages.length > 0 ? (
                        <img src={optimizeImage(rpImages[0], 'small')} alt={rp.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="w-6 h-6 text-gray-200" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-bold text-text truncate">{rp.name}</p>
                      {priceToNum(rp.price) > 0 && <p className="text-xs font-bold text-orange mt-0.5">{rp.price}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showSoldModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSoldModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-bold text-text text-lg mb-2 text-center">تأكيد البيع</h3>
            <p className="text-text-light text-sm mb-6 text-center">هل أنت متأكد من بيع هذا المنتج <strong>نهائياً</strong>؟</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSoldModal(false)}
                className="flex-1 h-12 border border-border rounded-xl text-text-light font-semibold text-sm hover:bg-bg transition-colors">إلغاء</button>
              <button onClick={() => markSold(true)} disabled={soldLoading}
                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors">
                {soldLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تأكيد البيع'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}>
          <button onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            aria-label="إغلاق" className="absolute top-4 left-4 z-10 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <span className="absolute top-4 right-4 z-10 text-white/90 text-sm bg-white/10 px-3 py-1.5 rounded-full">
            {galleryIdx + 1} / {images.length}
          </span>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setGalleryIdx(i => (i - 1 + images.length) % images.length); }}
                aria-label="السابق" className="absolute left-3 z-10 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                <ChevronRight className="w-7 h-7" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setGalleryIdx(i => (i + 1) % images.length); }}
                aria-label="التالي" className="absolute right-3 z-10 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                <ChevronLeft className="w-7 h-7" />
              </button>
            </>
          )}
          <img src={optimizeImage(images[galleryIdx], 'large')} alt={product.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-[96vw] object-contain select-none" />
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              {images.map((_, i) => (
                <button key={i} onClick={() => setGalleryIdx(i)} aria-label={`صورة ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-all ${i === galleryIdx ? 'bg-white w-4' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
