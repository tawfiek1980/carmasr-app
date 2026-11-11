import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Landmark, Truck, Package, HardHat, ChevronLeft, Building2, ExternalLink, MapPin, Phone, Star, Crown, Store } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import SearchBar from '../components/SearchBar';
import CategoryCard from '../components/CategoryCard';
import ListingCard from '../components/ListingCard';
import LoadCard from '../components/LoadCard';
import JobCard from '../components/JobCard';
import MarketStat from '../components/MarketStat';
import { mainCategories, marketStats, governorates } from '../lib/data';
import { listingsService, loadsService, jobsService, bannerAdsService, exhibitionsService } from '../lib/firestoreService';
import { trackEvent } from '../lib/analytics';
import { optimizeImage } from '../lib/imageUtils';
import type { Listing, Load, Job, BannerAd, Exhibition, ExhibitionProduct } from '../types';

export default function Home() {
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const [latestLoads, setLatestLoads]           = useState<Load[]>([]);
  const [latestJobs, setLatestJobs]             = useState<Job[]>([]);
  const [bannerAds, setBannerAds]               = useState<BannerAd[]>([]);
  const [exhibitionCount, setExhibitionCount]   = useState(0);
  const [latestExhibitions, setLatestExhibitions] = useState<Exhibition[]>([]);
  const [latestProducts, setLatestProducts]     = useState<ExhibitionProduct[]>([]);
  const [loading, setLoading]                   = useState(true);

  useEffect(() => {
    Promise.all([
      listingsService.getFeatured().catch(() => []),
      loadsService.getAll({ status: 'available' }).catch(() => []),
      jobsService.getAll({ status: 'active' }).catch(() => []),
      bannerAdsService.getActive().catch(() => []),
      exhibitionsService.getActive().catch(() => []),
      exhibitionsService.getAllProducts().catch(() => []),
    ]).then(([featured, loads, jobs, ads, exs, prods]) => {
      setFeaturedListings([...featured]
        .sort((a, b) => (a.status === 'sold' ? 1 : 0) - (b.status === 'sold' ? 1 : 0))
        .slice(0, 6));
      setLatestLoads(loads.slice(0, 4));
      setLatestJobs(jobs.slice(0, 4));
      setBannerAds(ads);
      setExhibitionCount(exs.length);
      setLatestExhibitions(exs.slice(0, 3));
      setLatestProducts(prods.slice(0, 6));
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
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
      {/* Hero */}
      <section className="relative bg-navy overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1600&q=80" alt="Trucks" className="w-full h-full object-cover" fetchPriority="high" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/80 to-navy/60" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-white mb-4 leading-tight">
              أكبر سوق إلكتروني للنقل <span className="gradient-text">الثقيل</span> في مصر
            </h1>
            <p className="text-gray-300 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto">
              ابحث عن سيارات، سيارات، سيارات، وظائف، تمويل وخدمات طوارئ في مكان واحد
            </p>
          </motion.div>
          <SearchBar />
        </div>
      </section>

      {/* Categories */}
      <section className="py-6 sm:py-8 bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2 sm:gap-4">
            {mainCategories.map(c => <CategoryCard key={c.id} category={c} />)}
          </div>
        </div>
      </section>

      {/* Category Banners */}
      <section className="py-4 sm:py-6 bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link to="/vehicles?category=trucks" className="relative group block rounded-2xl overflow-hidden h-28 sm:h-36 shadow-sm hover:shadow-md transition-all">
               <img src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&q=80&fit=crop&crop=center" alt="سيارات" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(244,112,10,0.3) 0%, rgba(234,88,12,0.15) 100%)' }} />
              <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between z-10">
                <span className="text-white font-extrabold text-base sm:text-lg tracking-wide drop-shadow-lg">سيارات</span>
                <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/30 backdrop-blur flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" className="w-5 h-5 sm:w-6 sm:h-6"><path d="M5 17h14M5 17a2 2 0 1 1-4 0M5 17a2 2 0 1 0 4 0M5 17V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10M19 17a2 2 0 1 1-4 0m4 0a2 2 0 1 0 4 0m0 0V11l-4-4h-4"/></svg>
                </span>
              </div>
            </Link>
            <Link to="/equipment" className="relative group block rounded-2xl overflow-hidden h-28 sm:h-36 shadow-sm hover:shadow-md transition-all">
               <img src="https://images.unsplash.com/photo-1603814744247-ca3e77714471?w=600&q=80&fit=crop&crop=center" alt="سيارات" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(13,27,42,0.3) 0%, rgba(26,48,72,0.15) 100%)' }} />
              <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between z-10">
                <span className="text-white font-extrabold text-base sm:text-lg tracking-wide drop-shadow-lg">سيارات</span>
                <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/30 backdrop-blur flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" className="w-5 h-5 sm:w-6 sm:h-6"><path d="M10 3h4v14H10zM3 17h18M3 17a2 2 0 1 1-4 0M3 17a2 2 0 1 0 4 0M17 17a2 2 0 1 1-4 0m4 0a2 2 0 1 0 4 0M14 3v7l4 4"/></svg>
                </span>
              </div>
            </Link>
            <Link to="/vehicles?category=trailers" className="relative group block rounded-2xl overflow-hidden h-28 sm:h-36 shadow-sm hover:shadow-md transition-all sm:col-span-2 lg:col-span-1">
               <img src="https://images.unsplash.com/photo-1616432043562-3671ea2e5242?w=600&q=80&fit=crop&crop=center" alt="سيارات" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(8,145,178,0.3) 0%, rgba(6,122,150,0.15) 100%)' }} />
              <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between z-10">
                <span className="text-white font-extrabold text-base sm:text-lg tracking-wide drop-shadow-lg">سيارات</span>
                <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/30 backdrop-blur flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" className="w-5 h-5 sm:w-6 sm:h-6"><rect x="2" y="6" width="16" height="12" rx="2"/><path d="M18 12h4l-2 4h-2"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Finance Banner */}
      <section className="py-4 sm:py-6 bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/finance">
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy to-navy-light p-4 sm:p-6 lg:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-orange flex items-center justify-center flex-shrink-0">
                  <Landmark className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">
                    تمويل السيارات الملاكي حتى <span className="text-orange">4 ملايين جنيه</span>
                  </h2>
                  <p className="text-gray-300 text-xs sm:text-sm mt-1">احصل على شاحنتك بأقساط مرنة تبدأ من 10%</p>
                </div>
              </div>
              <div className="relative flex items-center gap-2 text-orange font-bold text-sm">
                <span>التفاصيل</span><ArrowLeft className="w-4 h-4" />
              </div>
            </motion.div>
          </Link>
        </div>
      </section>

      {/* Banner Ads */}
      {bannerAds.length > 0 && (
        <section className="py-3 bg-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bannerAds.slice(0, 2).map(ad => (
                <a key={ad.id} href={ad.linkUrl || '#'} target={ad.linkUrl ? '_blank' : undefined} rel="noopener noreferrer"
                  onClick={() => trackEvent('banner_click', { banner_id: ad.id, company: ad.companyName })}
                  className="relative group block bg-white rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                  {ad.imageUrl ? (
                    <img src={optimizeImage(ad.imageUrl, 'medium')} alt={ad.companyName} className="w-full h-24 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-24 bg-gradient-to-l from-orange/10 to-orange/5 flex items-center justify-center">
                      <span className="text-sm font-bold text-orange">{ad.companyName}</span>
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
      )}

      {/* Featured Listings */}
      <section className="py-6 sm:py-8 bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-orange" />
              <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-navy">إعلانات مميزة</h2>
            </div>
            <Link to="/featured" className="flex items-center gap-1 text-orange font-bold text-sm hover:underline">
              عرض الكل <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />)}
            </div>
          ) : featuredListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredListings.map(l => <ListingCard key={l.id} listing={l} featured />)}
            </div>
          ) : (
            <div className="text-center py-12 bg-surface rounded-2xl border border-border">
              <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-text-light text-sm mb-4">لا توجد إعلانات بعد</p>
              <Link to="/post-listing" className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors inline-block">
                أضف أول إعلان
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Latest Loads */}
      <section className="py-6 sm:py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-orange" />
              <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-navy">أحدث الحمولة</h2>
            </div>
            <Link to="/loads" className="flex items-center gap-1 text-orange font-bold text-sm hover:underline">
              عرض الكل <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="bg-bg rounded-2xl h-48 animate-pulse" />)}
            </div>
          ) : latestLoads.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latestLoads.map(l => <LoadCard key={l.id} load={l} />)}
            </div>
          ) : (
            <div className="text-center py-12 bg-bg rounded-2xl border border-border">
              <p className="text-text-light text-sm">لا توجد سيارات بعد</p>
            </div>
          )}
        </div>
      </section>

      {/* Jobs */}
      <section className="py-6 sm:py-8 bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <HardHat className="w-5 h-5 sm:w-6 sm:h-6 text-orange" />
              <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-navy">فرص العمل</h2>
            </div>
            <Link to="/jobs" className="flex items-center gap-1 text-orange font-bold text-sm hover:underline">
              عرض الكل <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-48 animate-pulse" />)}
            </div>
          ) : latestJobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latestJobs.map(j => <JobCard key={j.id} job={j} />)}
            </div>
          ) : (
            <div className="text-center py-12 bg-surface rounded-2xl border border-border">
              <p className="text-text-light text-sm">لا توجد وظائف بعد</p>
            </div>
          )}
        </div>
      </section>

      {/* Products */}
      {latestProducts.length > 0 && (
        <section className="py-6 sm:py-8 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-orange" />
                <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-navy">إعلانات المعارض</h2>
              </div>
              <Link to="/products" className="flex items-center gap-1 text-orange font-bold text-sm hover:underline">
                عرض الكل <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {latestProducts.map(prod => {
                const img = prod.images?.[0] || prod.image || '';
                return (
                  <Link key={prod.id} to={`/product/${prod.id}`}
                    className="relative bg-surface rounded-2xl border border-border overflow-hidden hover:shadow-md hover:border-orange/20 transition-all group">
                    <div className="aspect-[4/3] overflow-hidden">
                      {img ? (
                        <img src={optimizeImage(img, 'small')} alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <Package className="w-10 h-10 text-gray-200" />
                        </div>
                      )}
                    </div>
                    {prod.status === 'sold' && (
                      <div className="absolute top-2 right-2 bg-gray-900/90 text-white text-[11px] font-bold px-3 py-1 rounded-full z-10">
                        تم البيع
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-text truncate">{prod.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-light">
                        {prod.exhibitionName && <span>{prod.exhibitionName}</span>}
                        {prod.governorate && <span>• {prod.governorate}</span>}
                      </div>
                      {prod.price && <p className="text-sm font-bold text-orange mt-2">{prod.price}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Exhibitions */}
      {exhibitionCount > 0 && (
        <section className="py-6 sm:py-8 bg-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-orange" />
                <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-navy">المعارض النشطة</h2>
              </div>
              <Link to="/exhibitions" className="flex items-center gap-1 text-orange font-bold text-sm hover:underline">
                عرض الكل <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>
            {latestExhibitions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                {latestExhibitions.map(ex => {
                  const featured = ex.plan === 'vip';
                  return (
                    <Link key={ex.id} to={`/exhibitions/${ex.id}`}
                      className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all group ${
                        featured ? 'border-amber-300' : 'border-border hover:border-orange/20'
                      }`}>
                      {ex.coverImage ? (
                        <div className="relative h-28 overflow-hidden">
                          <img src={optimizeImage(ex.coverImage, 'medium')} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        </div>
                      ) : (
                        <div className={`h-16 ${featured ? 'bg-gradient-to-l from-amber-100 to-amber-50' : 'bg-gradient-to-l from-orange/10 to-transparent'}`} />
                      )}
                      <div className={`${ex.coverImage ? 'p-4 -mt-8 relative z-10' : 'p-4'}`}>
                        <div className="flex items-center gap-3">
                          {ex.logo ? (
                            <img src={optimizeImage(ex.logo, 'thumb')} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-md flex-shrink-0" loading="lazy" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center text-orange font-bold border-2 border-white shadow-md flex-shrink-0">
                              {(ex.name || 'م')[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-text text-sm truncate">{ex.name}</h3>
                              {featured && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                              {ex.plan === 'premium' && <Star className="w-3 h-3 text-orange flex-shrink-0" />}
                            </div>
                            <p className="text-[11px] text-text-light flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" /> {ex.governorate}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-text-light mt-2 line-clamp-2">{ex.description}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="flex items-center gap-1 text-[11px] bg-gray-100 text-text-light px-2 py-1 rounded-lg">
                            <Store className="w-3 h-3" /> {ex.plan === 'free' ? 'مجاني' : ex.plan === 'vip' ? 'VIP' : ex.plan === 'premium' ? 'متقدم' : 'أساسي'}
                          </span>
                          <span className="text-[11px] text-text-light flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {ex.contactPhone}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <Link to="/exhibitions" className="block bg-gradient-to-l from-orange/5 to-transparent border border-border rounded-2xl p-5 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center text-orange flex-shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-text">{exhibitionCount} معرض نشط على المنصة</p>
                  <p className="text-text-light text-xs">تصفح المعارض واكتشف المنتجات والخدمات</p>
                </div>
                <div className="mr-auto">
                  <span className="bg-orange text-white px-4 py-2 rounded-xl font-bold text-xs">تصفح</span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Market Stats */}
      <section className="py-6 sm:py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-orange" />
            <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-navy">مؤشرات السوق</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {marketStats.map((stat, i) => <MarketStat key={i} stat={stat} />)}
          </div>
          <div className="bg-bg rounded-2xl p-4 sm:p-6">
            <h3 className="font-bold text-navy mb-4">أكثر المحافظات نشاطاً</h3>
            <div className="flex flex-wrap gap-2">
              {governorates.slice(0, 10).map(gov => (
                <Link key={gov.id} to={`/vehicles?governorate=${gov.name}`}
                  className="px-3 py-1.5 bg-white rounded-lg text-xs sm:text-sm font-medium text-text hover:bg-orange hover:text-white transition-colors border border-border">
                  {gov.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
