import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Building2, Loader2, ChevronLeft, ChevronRight, ZoomIn, MapPin, Phone, Clock, Globe, Facebook, Camera,
  Instagram, Crown, Store, Share2, Package, Plus, X, Trash2, Edit, Calendar,
  CheckCircle2, Search, ExternalLink, Truck, RefreshCw, Eye, Users,
} from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { exhibitionsService, listingsService } from '../lib/firestoreService';
import { formatDateDMY, cleanText, listingUrl, formatPrice, getWhatsAppLink, shareOnFacebook, copyText } from '../lib/utils';
import { getExhibitionPlan } from '../lib/plans';
import { bumpExhibitionView, bumpExhibitionContact } from '../lib/exhibitionStats';
import SeoHead from '../components/SeoHead';
import ImageUploader from '../components/ImageUploader';
import ListingCard from '../components/ListingCard';
import { productToListing } from '../lib/productCard';

const toLatinDigits = (v: string) => v
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
  .replace(/[^\d]/g, '');
import ProtectedPhoneButton from '../components/ProtectedPhoneButton';
import { toast } from '../components/Toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Exhibition, ExhibitionProduct } from '../types';
import { getSiteUrl, getShareUrl } from '../lib/config';
import { optimizeImage } from '../lib/imageUtils';
import { restampImageUrl, uploadFileToCloudinary } from '../lib/storageService';
import api from '../lib/api';

const emptyProductForm = () => ({ name: '', description: '', price: '', brand: '', model: '', year: '', images: [] as string[], category: '', subcategory: '', condition: 'used' as 'new' | 'used', priceType: 'fixed' as 'fixed' | 'negotiable' | 'call' });

const STAMP_FOLDER = 'exhibitions/wm';

export default function ExhibitionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exhibition, setExhibition] = useState<Exhibition | null>(null);
  const [products, setProducts] = useState<ExhibitionProduct[]>([]);
  const [related, setRelated] = useState<Exhibition[]>([]);
  const [ownerListings, setOwnerListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ExhibitionProduct | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [addingProduct, setAddingProduct] = useState(false);
  const [restamping, setRestamping] = useState(false);
  const [restampMsg, setRestampMsg] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [debugMsg, setDebugMsg] = useState('');

  const [lbImages, setLbImages] = useState<string[]>([]);
  const [lbIdx, setLbIdx] = useState(0);
  const lbOpen = lbImages.length > 0;

  useEffect(() => {
    if (!lbOpen) return;
    const n = lbImages.length || 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLbImages([]);
      else if (e.key === 'ArrowLeft') setLbIdx(i => (i - 1 + n) % n);
      else if (e.key === 'ArrowRight') setLbIdx(i => (i + 1) % n);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lbOpen, lbImages.length]);

  const isOwner = user && exhibition && (user.id === exhibition.userId || user.type === 'admin');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      exhibitionsService.getById(id),
      exhibitionsService.getProducts(id),
      exhibitionsService.getActive(),
    ])
      .then(([ex, prods, all]) => {
        if (!ex) { navigate('/exhibitions'); return; }
        setExhibition(ex);
        setProducts(prods);
        if (!(user && ex.userId === user.id)) bumpExhibitionView(id);
        setRelated(all.filter(e => e.id !== ex.id && cleanText(e.governorate) === cleanText(ex.governorate)).slice(0, 3));
        const ownerPhone = ex.contactPhone || ex.whatsapp || '';
        Promise.all([
          ex.userId ? listingsService.getByUser(ex.userId).catch(() => []) : Promise.resolve([]),
          ownerPhone ? listingsService.getByPhone(ownerPhone).catch(() => []) : Promise.resolve([]),
        ]).then(([byUser, byPhone]) => {
          const seen = new Set<string>();
          const merged = [...byUser, ...byPhone].filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
          setOwnerListings(merged.filter(l => ['active', 'sold'].includes(l.status)).slice(0, 4));
        }).catch(() => {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [products]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p =>
      (!category || p.category === category) &&
      (!q ||
        cleanText(p.name).toLowerCase().includes(q) ||
        cleanText(p.description).toLowerCase().includes(q))
    );
  }, [products, search, category]);

  const soldCount = products.filter(p => p.status === 'sold').length;
  const totalImageCount = products.reduce((n, p) => {
    const urls = p.images?.length ? p.images : (p.image ? [p.image] : []);
    return n + urls.length;
  }, 0);

  const galleryImages = useMemo(() => {
    const list: string[] = [];
    const push = (u?: string) => { if (u && !list.includes(u)) list.push(u); };
    push(exhibition?.coverImage);
    push(exhibition?.logo);
    products.forEach(p => (p.images?.length ? p.images : (p.image ? [p.image] : [])).forEach(push));
    return list;
  }, [exhibition?.coverImage, exhibition?.logo, products]);

  const openGallery = (imgs: string[], idx = 0) => {
    if (!imgs.length) return;
    setLbIdx(idx);
    setLbImages(imgs);
  };

  const handleAddProduct = async () => {
    if (!productForm.name || !id) return;
    const limit = getExhibitionPlan(exhibition?.plan).maxProducts;
    if (!editingProduct && products.length >= limit) {
       toast(`وصلت للحد الأقصى لمنتجات باقتك (${limit}). رقِّ باقتك لإضافة المزيد.`, 'error');
      return;
    }
    setAddingProduct(true);
    try {
      if (editingProduct) {
        await exhibitionsService.updateProduct(editingProduct.id, {
          name: productForm.name,
          description: productForm.description,
          price: productForm.price,
          brand: productForm.brand,
          model: productForm.model,
          year: productForm.year,
          images: productForm.images.length ? productForm.images : undefined,
          category: productForm.category,
          subcategory: productForm.subcategory,
          condition: productForm.condition,
          priceType: productForm.priceType,
        });
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
          ...p,
          name: productForm.name,
          description: productForm.description,
          price: productForm.price,
          brand: productForm.brand,
          model: productForm.model,
          year: productForm.year,
          images: productForm.images.length ? productForm.images : undefined,
          category: productForm.category,
          subcategory: productForm.subcategory,
          condition: productForm.condition,
          priceType: productForm.priceType,
        } : p));
        toast('تم تعديل المنتج بنجاح', 'success');
      } else {
        const newProduct = await exhibitionsService.addProduct(id, {
          ...productForm,
          images: productForm.images.length ? productForm.images : undefined,
          userId: user?.id,
          exhibitionName: exhibition?.name,
          exhibitionPhone: exhibition?.contactPhone,
          governorate: exhibition?.governorate,
        });
        setProducts(prev => [newProduct, ...prev]);
        toast('تم إضافة المنتج بنجاح', 'success');
        api.post('/push', { action: 'exhibitionAd', productId: newProduct.id }).catch(() => {});
      }
      setProductForm(emptyProductForm());
      setEditingProduct(null);
      setShowAddProduct(false);
    } catch (e: any) {
      toast(e.message || 'حدث خطأ', 'error');
    } finally {
      setAddingProduct(false);
    }
  };

  const startEditProduct = (prod: ExhibitionProduct) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name || '',
      description: prod.description || '',
      price: prod.price || '',
      brand: prod.brand || '',
      model: prod.model || '',
      year: prod.year != null ? String(prod.year) : '',
      images: prod.images?.length ? prod.images : (prod.image ? [prod.image] : []),
      category: prod.category || '',
      subcategory: prod.subcategory || '',
      condition: prod.condition || 'used',
      priceType: prod.priceType || 'fixed',
    });
    setShowAddProduct(true);
  };

  const handleRestampImages = async () => {
    if (!exhibition || !id) return;
    const label = cleanText(exhibition.name) || exhibition.name;
    const phone = exhibition.contactPhone || exhibition.whatsapp || '';
    const targets = products
      .map(p => ({ p, urls: (p.images?.length ? p.images : (p.image ? [p.image] : [])).filter(Boolean) }))
      .filter(t => t.urls.length);
    if (!targets.length) { toast('لا توجد صور منتجات لختمها', 'error'); return; }
    const total = targets.reduce((n, t) => n + t.urls.length, 0);
    if (!window.confirm(`إعادة ختم كل صور المنتجات (${total} صورة في ${targets.length} منتج) باسم ورقم المعرض؟`)) return;
    setRestamping(true);
    let done = 0, failed = 0, saveFailed = 0;
    let firstError = '';
    try {
      for (const { p, urls } of targets) {
        const newUrls: string[] = [];
        for (const u of urls) {
          setRestampMsg(`جاري الختم ${done + failed + 1}/${total}`);
          try {
            const file = await restampImageUrl(u, label, phone);
            const up = await uploadFileToCloudinary(file, STAMP_FOLDER);
            newUrls.push(up);
            done++;
          } catch (e: any) {
            failed++;
            if (!firstError) firstError = e?.message || 'فشل تحميل/رفع صورة';
            newUrls.push(u);
          }
        }
        if (newUrls.length) {
          try {
            await exhibitionsService.updateProduct(p.id, { images: newUrls }, id);
            setProducts(prev => prev.map(x => x.id === p.id ? { ...x, images: newUrls } : x));
          } catch (e: any) {
            saveFailed++;
            if (!firstError) firstError = e?.message || 'فشل حفظ المنتج';
          }
        }
      }
      const notes = [
        failed ? `فشل ${failed} صورة` : '',
        saveFailed ? `تعذّر حفظ ${saveFailed} منتج` : '',
      ].filter(Boolean).join(' - ');
      toast(`تمت إعادة ختم ${done} صورة${notes ? ` (${notes})` : ''}`, (failed || saveFailed) ? 'error' : 'success');
      if ((failed || saveFailed) && firstError) console.warn('restamp:', firstError);
    } catch (e: any) {
      toast(e.message || 'حدث خطأ أثناء إعادة الختم', 'error');
    } finally {
      setRestamping(false);
      setRestampMsg('');
    }
  };

  const handleToggleSold = async (prod: ExhibitionProduct) => {
    if (!id) return;
    try {
      const sold = prod.status !== 'sold';
      await exhibitionsService.setProductSold(id, prod.id, sold);
      setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, status: sold ? 'sold' : 'active' } : p));
      toast(sold ? 'تم تعليم المنتج كمباع' : 'تم إرجاع المنتج', 'success');
    } catch (e: any) {
      console.error(e);
      toast(e?.code === 'permission-denied' ? 'لا تملك صلاحية تعديل هذا المنتج' : (e?.message || 'فشل تعديل حالة المنتج'), 'error');
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    if (!id) return;
    setDebugMsg('جارِ الحذف...');
    try {
      await exhibitionsService.removeProduct(id, productId);
      const stillExists = await exhibitionsService.getProductById(productId);
      const subSnap = await getDoc(doc(db, "exhibitions", id, "products", productId));
      setDebugMsg('OK: حذف من الخادم | top بعد الحذف=' + (stillExists ? 'موجود!' : 'محذوف') + ' | sub=' + (subSnap.exists() ? 'موجود!' : 'محذوف'));
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast('تم حذف المنتج', 'success');
    } catch (e: any) {
      console.error(e);
      setDebugMsg('FAIL: ' + (e?.code || '') + ' — ' + (e?.message || e));
      const msg = e?.code === 'permission-denied' ? 'لا تملك صلاحية حذف هذا المنتج — تأكد من تسجيل الدخول بحساب صاحب المعرض' : (e?.message || 'فشل حذف المنتج');
      toast(msg, 'error');
    }
  };

  const shareOnFb = async () => {
    const url = getShareUrl(`/exhibitions/${id}`);
    const text = `🏪 معرض ${cleanText(exhibition?.name)} على كار مصر${exhibition?.governorate ? `\n📍 ${cleanText(exhibition.governorate)}${exhibition?.city ? ' - ' + cleanText(exhibition.city) : ''}` : ''}${exhibition?.contactPhone ? `\n📞 ${exhibition.contactPhone}` : ''}\n🔗 ${url}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `معرض ${cleanText(exhibition?.name)}`, text, url });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    const ok = await copyText(text);
    shareOnFacebook(url);
    toast(ok ? 'تم نسخ تفاصيل المعرض — الصقها في المنشور (Ctrl+V)' : 'افتح المنشور وانسخ التفاصيل يدويًا', ok ? 'success' : 'error');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <Skeleton className="w-full h-64 rounded-none" />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="w-20 h-20 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden">
                <Skeleton className="w-full h-48 rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!exhibition) return null;

  const planInfo = getExhibitionPlan(exhibition.plan);
  const cfg = { label: planInfo.name, color: planInfo.textColor, bg: planInfo.bg, icon: planInfo.icon };
  const Icon = cfg.icon;

  const exhibitionUrl = `${getSiteUrl()}/exhibitions/${id}`;
  const exhibitionDesc = `${cleanText(exhibition.governorate)}${exhibition.city ? ` - ${cleanText(exhibition.city)}` : ''} - باقة ${planInfo.name}${products.length ? ` | ${products.length} منتج` : ''}${exhibition.description ? ` | ${exhibition.description.slice(0, 150)}` : ''}`;
  const exhibitionImage = exhibition.coverImage || exhibition.logo;

  return (
    <div className="min-h-screen bg-bg">
      <SeoHead
        title={cleanText(exhibition.name)}
        description={exhibitionDesc}
        ogImage={exhibitionImage || undefined}
        ogType="website"
        canonical={exhibitionUrl}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: `معرض ${cleanText(exhibition.name)}`,
          description: exhibitionDesc,
          image: exhibitionImage || undefined,
          url: exhibitionUrl,
          telephone: exhibition.contactPhone,
          address: {
            '@type': 'PostalAddress',
            addressLocality: cleanText(exhibition.governorate),
            addressCountry: 'EG',
          },
        }}
      />
      {debugMsg && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[999] bg-black/90 text-white text-xs px-4 py-2 rounded-lg max-w-[90vw] text-center" dir="ltr">
          {debugMsg}
        </div>
      )}
      {/* Header Cover */}
      <div className="relative">
        {exhibition.coverImage ? (
          <div className="h-48 sm:h-64 overflow-hidden">
            <img src={optimizeImage(exhibition.coverImage, 'large')} alt="" onClick={() => openGallery(galleryImages)}
              className="w-full h-full object-cover cursor-zoom-in" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
          </div>
        ) : (
          <div className="h-32 sm:h-48 bg-gradient-to-l from-navy to-navy-light" />
        )}

        <div className="absolute top-4 right-4 z-10">
          <Link to="/exhibitions"
            className="flex items-center gap-1 bg-black/30 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-sm hover:bg-black/50 transition-colors">
            <ChevronLeft className="w-4 h-4 rtl-flip" /> العودة
          </Link>
        </div>
        {isOwner && (
          <div className="absolute top-4 left-4 z-10">
            <Link to={`/exhibitions/subscribe?edit=${exhibition.id}`}
              className="flex items-center gap-1 bg-black/30 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-sm hover:bg-black/50 transition-colors">
              <Edit className="w-4 h-4" /> تعديل
            </Link>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Profile Header */}
        <div className={`${exhibition.coverImage ? '-mt-16 relative z-10' : ''} flex items-end gap-4 mb-6`}>
          <div className="flex-shrink-0">
            {exhibition.logo ? (
              <img src={optimizeImage(exhibition.logo, 'medium')} alt="" className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-orange/10 flex items-center justify-center text-orange font-bold text-3xl border-4 border-white shadow-lg">
                {cleanText(exhibition.name)[0]}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-text">{cleanText(exhibition.name)}</h1>
              <span className={`${cfg.bg} ${cfg.color} text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-0.5`}>
                <Icon className="w-3.5 h-3.5" /> {cfg.label}
              </span>
              {exhibition.category === 'import' && (
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Truck className="w-3.5 h-3.5" /> معارض الاستيراد
                </span>
              )}
              {exhibition.plan === 'vip' && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Crown className="w-3.5 h-3.5" /> مميز
                </span>
              )}
            </div>
            <p className="text-text-light text-sm flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" /> {cleanText(exhibition.governorate)}{exhibition.city ? ` - ${cleanText(exhibition.city)}` : ''}
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-light">
              <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {products.length} منتج</span>
              {soldCount > 0 && <span className="text-gray-500">• {soldCount} مباع</span>}
              {exhibition.workingHours && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {exhibition.workingHours}</span>}
            </div>
          </div>
          <button onClick={shareOnFb}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm transition-colors flex-shrink-0">
            <Facebook className="w-4 h-4" /> <span className="hidden sm:inline">مشاركة فيسبوك</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-5">
            {exhibition.description && (
              <div className="bg-surface rounded-2xl border border-border p-5">
                <h2 className="font-bold text-text mb-2">عن المعرض</h2>
                <p className="text-text-light text-sm leading-relaxed whitespace-pre-wrap">{cleanText(exhibition.description)}</p>
              </div>
            )}

            {/* Products Gallery */}
            <div className="bg-surface rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-text flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange" /> المنتجات
                  <span className="text-[10px] bg-gray-100 text-text-light px-2 py-0.5 rounded-full">{visibleProducts.length}</span>
                </h2>
                {isOwner && (
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:block text-[11px] text-text-light bg-gray-50 border border-border rounded-full px-2.5 py-1">
                      {`${products.length} من ${planInfo.maxProducts} منتج`}
                    </span>
                    <button onClick={handleRestampImages} disabled={restamping}
                      title="إعادة ختم كل صور منتجات المعرض باسم ورقم المعرض"
                      className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50 border ${
                        totalImageCount > 0 && !restamping
                          ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                          : 'bg-surface border-border hover:bg-gray-50 text-text-light'
                      }`}>
                      {restamping ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span className="hidden sm:inline">{restamping ? (restampMsg || 'جاري الختم...') : (totalImageCount > 0 ? `إعادة ختم كل الصور (${totalImageCount})` : 'إعادة ختم الصور')}</span>
                    </button>
                    <button onClick={() => setShowAddProduct(!showAddProduct)}
                      className="flex items-center gap-1 text-sm bg-orange hover:bg-orange-dark text-white px-3 py-1.5 rounded-xl transition-colors">
                      <Plus className="w-4 h-4" /> إضافة منتج
                    </button>
                  </div>
                )}
              </div>

              {products.length > 0 && (
                <div className="space-y-2 mb-4">
                  <div className="bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2 border border-border">
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="ابحث داخل المعرض..."
                      className="bg-transparent w-full text-sm focus:outline-none" />
                    {search && (
                      <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {categories.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => setCategory('')}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                          !category ? 'bg-orange text-white' : 'bg-gray-100 text-text-light hover:bg-gray-200'
                        }`}>الكل</button>
                      {categories.map(c => (
                        <button key={c} onClick={() => setCategory(category === c ? '' : c)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                            category === c ? 'bg-orange text-white' : 'bg-gray-100 text-text-light hover:bg-gray-200'
                          }`}>{c}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showAddProduct && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3 border border-border">
                  <h3 className="text-sm font-bold text-text">{editingProduct ? 'تعديل منتج' : 'منتج جديد'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-light mb-1">اسم المنتج *</label>
                      <input value={productForm.name} onChange={e => setProductForm(f => ({...f, name: e.target.value}))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange" placeholder="مثلاً: ونش هيدروليك" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-light mb-1">السعر (جنيه)</label>
                      <input inputMode="numeric" dir="ltr" value={productForm.price ? toLatinDigits(productForm.price).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""} onChange={e => setProductForm(f => ({...f, price: toLatinDigits(e.target.value)}))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange text-right" placeholder="مثلاً: 150,000" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-light mb-1">نوع السعر</label>
                      <select value={productForm.priceType} onChange={e => setProductForm(f => ({...f, priceType: e.target.value as 'fixed' | 'negotiable' | 'call'}))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange">
                        <option value="fixed">سعر ثابت</option>
                        <option value="negotiable">قابل للتفاوض</option>
                        <option value="call">السعر عند الاتصال</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-light mb-1">الماركة</label>
                      <input value={productForm.brand} onChange={e => setProductForm(f => ({...f, brand: e.target.value}))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange" placeholder="مثلاً: كاتربيلر" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-light mb-1">الموديل</label>
                      <input value={productForm.model} onChange={e => setProductForm(f => ({...f, model: e.target.value}))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange" placeholder="مثلاً: 320D" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-light mb-1">سنة الصنع</label>
                      <input type="number" inputMode="numeric" dir="ltr" value={productForm.year} onChange={e => setProductForm(f => ({...f, year: e.target.value}))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange text-right" placeholder="2020" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-text-light mb-1">الوصف</label>
                      <textarea value={productForm.description} onChange={e => setProductForm(f => ({...f, description: e.target.value}))} rows={2}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange" placeholder="نوع المعدة - الموديل - الحالة - المميزات" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-text-light mb-1">صور المنتج</label>
                      <ImageUploader
                        images={productForm.images}
                        onChange={urls => setProductForm(f => ({...f, images: urls}))}
                        max={20}
                        folder="exhibitions/wm"
                        watermarkLabel={exhibition?.name}
                        watermarkPhone={exhibition?.contactPhone}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-light mb-1">تصنيف</label>
                      <select value={productForm.category} onChange={e => setProductForm(f => ({...f, category: e.target.value}))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange">
                        <option value="">اختر التصنيف</option>
                        <option value="معدات نقل">معدات نقل</option>
                        <option value="قطع غيار">قطع غيار</option>
                        <option value="إطارات">إطارات</option>
                        <option value="زيوت ووقود">زيوت ووقود</option>
                        <option value="معدات ثقيلة">معدات ثقيلة</option>
                        <option value="كماليات">كماليات</option>
                        <option value="خدمات">خدمات</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-light mb-1">الفئة الفرعية</label>
                      <input value={productForm.subcategory} onChange={e => setProductForm(f => ({...f, subcategory: e.target.value}))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange" placeholder="مثلاً: رؤوس جرارات" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-light mb-1">الحالة</label>
                      <select value={productForm.condition} onChange={e => setProductForm(f => ({...f, condition: e.target.value as 'new' | 'used'}))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange">
                        <option value="used">مستعمل</option>
                        <option value="new">جديد</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleAddProduct} disabled={addingProduct || !productForm.name}
                      className="bg-orange hover:bg-orange-dark text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1">
                      {addingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {editingProduct ? 'حفظ' : 'إضافة'}
                    </button>
                    <button onClick={() => { setShowAddProduct(false); setEditingProduct(null); setProductForm(emptyProductForm()); }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm transition-colors">
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {products.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-text-light">لا توجد منتجات مضافة بعد</p>
                  {isOwner && (
                    <button onClick={() => setShowAddProduct(true)}
                      className="text-orange text-sm font-semibold mt-2 hover:underline">
                      أضف أول منتج
                    </button>
                  )}
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-text-light">لا توجد نتائج مطابقة</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleProducts.map(prod => {
                    const isSold = prod.status === 'sold';
                    const ownerActions = isOwner ? (
                      <>
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); startEditProduct(prod); }}
                          className="w-8 h-8 rounded-full bg-white/95 text-gray-600 hover:text-orange flex items-center justify-center shadow" title="تعديل المنتج">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); handleToggleSold(prod); }}
                          className={`w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow ${isSold ? 'text-green-600' : 'text-gray-600 hover:text-green-600'}`} title={isSold ? 'إرجاع المنتج' : 'تم البيع'}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); handleRemoveProduct(prod.id); }}
                          className="w-8 h-8 rounded-full bg-white/95 text-gray-600 hover:text-red-500 flex items-center justify-center shadow" title="حذف المنتج">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : undefined;
                    return (
                      <ListingCard key={prod.id} listing={productToListing(prod)} href={`/product/${prod.id}`} actions={ownerActions}
                        imageClassName="aspect-[5/4]"
                        onImageClick={() => openGallery(prod.images?.length ? prod.images : (prod.image ? [prod.image] : []))} />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Contact */}
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
              <h3 className="font-bold text-text text-sm">التواصل</h3>
              <ProtectedPhoneButton phone={exhibition.contactPhone}>
                <a href={`tel:${exhibition.contactPhone}`} onClick={() => bumpExhibitionContact(id)}
                  className="flex items-center gap-3 bg-orange hover:bg-orange-dark text-white p-3 rounded-xl transition-colors">
                  <Phone className="w-5 h-5" />
                  <span className="font-bold text-sm">{exhibition.contactPhone}</span>
                </a>
              </ProtectedPhoneButton>
              {exhibition.whatsapp && (
                <ProtectedPhoneButton phone={exhibition.whatsapp}>
                  <a href={getWhatsAppLink(exhibition.whatsapp, `السلام عليكم، أهتم بإعلانكم على كار مصر: معرض ${cleanText(exhibition.name)}\n🔗 ${getSiteUrl()}/exhibitions/${id}`)} target="_blank" rel="noopener noreferrer" onClick={() => bumpExhibitionContact(id)}
                    className="flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white p-3 rounded-xl transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    <span className="font-bold text-sm">واتساب</span>
                  </a>
                </ProtectedPhoneButton>
              )}
            </div>

            {/* Info */}
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
              <h3 className="font-bold text-text text-sm">معلومات المعرض</h3>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-text-light flex-shrink-0" />
                  <span className="text-text-light">{cleanText(exhibition.governorate)}{exhibition.city ? ` - ${cleanText(exhibition.city)}` : ''}</span>
                </div>
                {exhibition.workingHours && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-text-light flex-shrink-0" />
                    <span className="text-text-light">{exhibition.workingHours}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Store className="w-4 h-4 text-text-light flex-shrink-0" />
                  <span className="text-text-light">باقة {cfg.label}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-text-light flex-shrink-0" />
                  <span className="text-text-light">منذ {formatDateDMY(exhibition.createdAt)}</span>
                </div>
                {exhibition.googleMapsUrl && (
                  <a href={exhibition.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl py-2 transition-colors">
                    <ExternalLink className="w-4 h-4" /> الموقع على الخريطة
                  </a>
                )}
              </div>
            </div>

            {/* Social Links */}
            {(exhibition.facebook || exhibition.instagram || exhibition.website) && (
              <div className="bg-surface rounded-2xl border border-border p-5 space-y-2.5">
                <h3 className="font-bold text-text text-sm">روابط</h3>
                {exhibition.facebook && (
                  <a href={exhibition.facebook} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <Facebook className="w-4 h-4" /> فيسبوك
                  </a>
                )}
                {exhibition.instagram && (
                  <a href={exhibition.instagram} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-pink-600 hover:underline">
                    <Instagram className="w-4 h-4" /> انستجرام
                  </a>
                )}
                {exhibition.website && (
                  <a href={exhibition.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:underline">
                    <Globe className="w-4 h-4" /> موقع إلكتروني
                  </a>
                )}
              </div>
            )}

            {/* Related Exhibitions */}
            {ownerListings.length > 0 && (
              <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
                <h3 className="font-bold text-text text-sm flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-orange" /> إعلانات صاحب المعرض
                </h3>
                {ownerListings.map(l => (
                  <Link key={l.id} to={listingUrl(l.id, l.slug)}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5 hover:bg-gray-100 transition-colors">
                    {l.images?.[0] ? (
                      <img src={optimizeImage(l.images[0], 'thumb')} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center text-orange font-bold flex-shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text truncate">{l.title}</p>
                      <p className="text-[11px] text-text-light flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {l.governorate}
                        {l.status === 'sold' && <span className="text-red-500"> • تم البيع</span>}
                      </p>
                    </div>
                    {l.price > 0 && <span className="text-orange font-extrabold text-xs flex-shrink-0">{formatPrice(l.price)}</span>}
                  </Link>
                ))}
              </div>
            )}

            {related.length > 0 && (
              <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
                <h3 className="font-bold text-text text-sm flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-orange" /> معارض مشابهة
                </h3>
                {related.map(r => {
                  const rPlan = getExhibitionPlan(r.plan);
                  const rCfg = { label: rPlan.name, color: rPlan.textColor, bg: rPlan.bg, icon: rPlan.icon };
                  const RIcon = rCfg.icon;
                  return (
                    <Link key={r.id} to={`/exhibitions/${r.id}`}
                      className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5 hover:bg-gray-100 transition-colors">
                      {r.logo ? (
                        <img src={optimizeImage(r.logo, 'thumb')} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center text-orange font-bold flex-shrink-0">
                          {cleanText(r.name)[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text truncate">{cleanText(r.name)}</p>
                        <p className="text-[11px] text-text-light flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {cleanText(r.governorate)}
                        </p>
                      </div>
                      <span className={`${rCfg.bg} ${rCfg.color} text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0`}>
                        <RIcon className="w-3 h-3" /> {rCfg.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Owner Stats */}
            {isOwner && (
              <div className="bg-gradient-to-l from-navy to-navy-light rounded-2xl p-5 text-white space-y-3">
                <h3 className="font-bold text-sm flex items-center gap-1.5"><Users className="w-4 h-4" /> تفاعل معرضك</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black">{exhibition.views || 0}</p>
                    <p className="text-[11px] text-gray-300 mt-0.5 flex items-center justify-center gap-1"><Eye className="w-3 h-3" /> مشاهدة</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-green-300">{exhibition.contacts || 0}</p>
                    <p className="text-[11px] text-gray-300 mt-0.5 flex items-center justify-center gap-1"><Phone className="w-3 h-3" /> تواصل</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 text-center">إحصائيات تظهر لصاحب المعرض فقط</p>
              </div>
            )}

            {/* Owner Actions */}
            {isOwner && (
              <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
                <h3 className="font-bold text-text text-sm">إدارة المعرض</h3>
                <Link to={`/exhibitions/subscribe?edit=${exhibition.id}`}
                  className="flex items-center gap-2 w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl transition-colors">
                  <Edit className="w-4 h-4" /> تعديل المعرض
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {lbOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLbImages([])}>
          <button onClick={e => { e.stopPropagation(); setLbImages([]); }}
            aria-label="إغلاق" className="absolute top-4 left-4 z-10 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <span className="absolute top-4 right-4 z-10 text-white/90 text-sm bg-white/10 px-3 py-1.5 rounded-full">
            {lbIdx + 1} / {lbImages.length}
          </span>
          {lbImages.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setLbIdx(i => (i - 1 + lbImages.length) % lbImages.length); }}
                aria-label="السابق" className="absolute left-3 z-10 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                <ChevronRight className="w-7 h-7" />
              </button>
              <button onClick={e => { e.stopPropagation(); setLbIdx(i => (i + 1) % lbImages.length); }}
                aria-label="التالي" className="absolute right-3 z-10 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                <ChevronLeft className="w-7 h-7" />
              </button>
            </>
          )}
          <img src={optimizeImage(lbImages[lbIdx], 'large')} alt=""
            onClick={e => e.stopPropagation()}
            className="max-h-[92vh] max-w-[96vw] object-contain select-none" />
          {lbImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5" onClick={e => e.stopPropagation()}>
              {lbImages.map((_, i) => (
                <button key={i} onClick={() => setLbIdx(i)} aria-label={`صورة ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-all ${i === lbIdx ? 'bg-white w-4' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
