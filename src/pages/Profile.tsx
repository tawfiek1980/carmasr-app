import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, MapPin, Phone, Mail, LogOut, Plus, Heart, Truck, Package, HardHat, Settings, Edit, Shield, Briefcase, Award, Loader2, Trash2, Sparkles, MessageCircle, Bell, Search, BarChart3, Eye, MousePointerClick, Activity, TrendingUp, Calculator } from 'lucide-react';
import { auth } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import { getInitials } from '../lib/utils';
import { listingsService, loadsService, jobsService } from '../lib/firestoreService';
import { alertsService, type SavedSearch } from '../lib/alerts';
import { statsService, type SellerStats } from '../lib/stats';
import ListingCard from '../components/ListingCard';
import LoadCard from '../components/LoadCard';
import JobCard from '../components/JobCard';
import { setChatDisabled } from '../components/AiAssistantChat';
import { setWhatsAppDisabled } from '../components/WhatsAppFloat';
import { optimizeImage } from '../lib/imageUtils';
import { toast } from '../components/Toast';
import type { User as UserType, Listing, Load, Job } from '../types';

export default function Profile() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState('listings');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savedSearchesLoading, setSavedSearchesLoading] = useState(true);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsOpen, setStatsOpen] = useState(true);

  useEffect(() => {
    const currentUser = auth.getUser();
    if (!currentUser) {
      navigate('/login');
      return;
    }
    setUser(currentUser);
    setFavorites(JSON.parse(localStorage.getItem('tareeq_favorites') || '[]'));

    const fetchData = async () => {
      try {
        const [l, ld, j, ss, st] = await Promise.all([
          listingsService.getByUser(currentUser.id),
          loadsService.getByUser(currentUser.id),
          jobsService.getByUser(currentUser.id),
          alertsService.listSavedSearches(),
          statsService.getMyStats(),
        ]);
        setListings(l);
        setLoads(ld);
        setJobs(j);
        setSavedSearches(ss);
        setStats(st);
      } catch {}
      setLoading(false);
      setSavedSearchesLoading(false);
      setStatsLoading(false);
    };
    fetchData();
  }, [navigate]);

  const handleDeleteSavedSearch = async (id: string) => {
    if (!confirm('حذف هذا البحث المحفوظ؟')) return;
    const ok = await alertsService.deleteSavedSearch(id);
    if (ok) setSavedSearches(p => p.filter(s => s.id !== id));
  };

  const searchUrl = (s: SavedSearch) => {
    const p = new URLSearchParams();
    if (s.query) p.set('search', s.query);
    if (s.category) p.set('category', s.category);
    if (s.governorate) p.set('governorate', s.governorate);
    if (s.brand) p.set('brand', s.brand);
    if (s.model) p.set('model', s.model);
    if (s.maxPrice) p.set('priceMax', String(s.maxPrice));
    return `/vehicles?${p.toString()}`;
  };

  const searchLabel = (s: SavedSearch) => {
    const parts: string[] = [];
    if (s.name) parts.push(s.name);
    else if (s.query) parts.push(`"${s.query}"`);
    if (s.maxPrice) parts.push(`حتى ${s.maxPrice.toLocaleString('ar-EG')} جنيه`);
    return parts.join(' ');
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate('/', { replace: true });
  };

  const handleDeleteLoad = async (id: string) => {
    if (!confirm('هل تريد حذف هذه الحمولة؟')) return;
    try {
      await loadsService.delete(id);
      setLoads(p => p.filter(l => l.id !== id));
      toast('تم حذف الحمولة', 'success');
    } catch {
      toast('تعذّر حذف الحمولة', 'error');
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm('هل تريد حذف هذا الإعلان؟')) return;
    try {
      await listingsService.delete(id);
      setListings(p => p.filter(l => l.id !== id));
      toast('تم حذف الإعلان', 'success');
    } catch {
      toast('تعذّر حذف الإعلان', 'error');
    }
  };

  const handleEnableAssistant = () => {
    setChatDisabled(false);
    window.dispatchEvent(new Event('tareeq:enable-chat'));
  };

  const handleEnableWhatsApp = () => {
    setWhatsAppDisabled(false);
    window.dispatchEvent(new Event('tareeq:enable-whatsapp'));
  };

  if (!user) return null;

  const fmtNum = (n: number) => Number(n || 0).toLocaleString('ar-EG');
  const maxTrend = Math.max(1, ...(stats?.trend.map(t => t.impressions) || [1]));

  const userTypeLabels: Record<string, string> = {
    individual: 'سائق',
    company: 'شركة نقل',
    dealer: 'معرض سيارات',
    workshop: 'مركز صيانة',
    finance: 'شركة تمويل',
    admin: 'مدير النظام',
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'individual': return 'bg-blue-500';
      case 'company': return 'bg-purple-500';
      case 'dealer': return 'bg-emerald-500';
      case 'workshop': return 'bg-amber-500';
      case 'finance': return 'bg-indigo-500';
      case 'admin': return 'bg-red-500';
      default: return 'bg-orange';
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">الملف الشخصي</h1>
            <div className="flex gap-3">
              <Link
                to="/complete-profile"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors backdrop-blur"
              >
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">تعديل البيانات</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/40 text-red-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors backdrop-blur border border-red-500/30"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-2xl">
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-orange flex items-center justify-center text-white text-3xl font-bold border-4 border-white/20 shadow-inner">
                {user.avatar ? (
                  <img src={optimizeImage(user.avatar, 'medium')} alt={user.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  getInitials(user.name)
                )}
              </div>
              <div className={`absolute -bottom-2 sm:-bottom-3 left-1/2 -translate-x-1/2 ${getBadgeColor(user.type)} text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-lg whitespace-nowrap border-2 border-navy`}>
                {userTypeLabels[user.type] || user.type}
              </div>
            </div>
            
            <div className="text-center sm:text-right flex-1 mt-4 sm:mt-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">{user.name}</h2>
                {user.verified && (
                  <span className="inline-flex items-center justify-center bg-blue-500/20 text-blue-300 p-1.5 rounded-full" title="حساب موثق">
                    <Shield className="w-5 h-5" />
                  </span>
                )}
              </div>

              {user.businessName && (
                <p className="text-lg text-orange font-semibold mb-3 flex items-center justify-center sm:justify-start gap-2">
                  <Briefcase className="w-5 h-5" />
                  {user.businessName}
                </p>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 mt-4 text-sm text-gray-200 bg-black/20 p-4 rounded-2xl">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="font-mono">{user.phone}</span>
                </div>
                {user.whatsapp && (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="w-4 h-4 text-green-400 flex items-center justify-center font-bold">W</span>
                    <span className="font-mono">{user.whatsapp}</span>
                  </div>
                )}
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{user.governorate}{user.city ? ` - ${user.city}` : ''}</span>
                </div>
                
                {user.type === 'individual' && user.drivingType && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-blue-200">
                    <Award className="w-4 h-4" />
                    <span>{user.drivingType} ({user.experienceYears} سنوات خبرة)</span>
                  </div>
                )}
                
                {user.type === 'workshop' && user.specialization && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-amber-200">
                    <Settings className="w-4 h-4" />
                    <span>تخصص: {user.specialization}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Link
            to="/post-listing"
            className="flex flex-col items-center gap-3 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all border border-gray-100"
          >
            <div className="w-12 h-12 bg-orange/10 rounded-2xl flex items-center justify-center">
              <Plus className="w-6 h-6 text-orange" />
            </div>
            <span className="text-sm font-bold text-text">إضافة إعلان</span>
          </Link>
          <Link
            to="/favorites"
            className="flex flex-col items-center gap-3 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all border border-gray-100"
          >
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-red-500" />
            </div>
            <span className="text-sm font-bold text-text">المفضلات ({favorites.length})</span>
          </Link>
          <Link
            to="/my-listings"
            className="flex flex-col items-center gap-3 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all border border-gray-100"
          >
            <div className="w-12 h-12 bg-navy/10 rounded-2xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-navy" />
            </div>
            <span className="text-sm font-bold text-text">إعلاناتي</span>
          </Link>
          <Link
            to="/complete-profile"
            className="flex flex-col items-center gap-3 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all border border-gray-100"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-text-light" />
            </div>
            <span className="text-sm font-bold text-text">الإعدادات</span>
          </Link>
          <button
            onClick={handleEnableAssistant}
            className="flex flex-col items-center gap-3 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all border border-orange/20"
          >
            <div className="w-12 h-12 bg-orange/10 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-orange" />
            </div>
            <span className="text-sm font-bold text-orange">تفعيل مساعد كار مصر</span>
          </button>
          <button
            onClick={handleEnableWhatsApp}
            className="flex flex-col items-center gap-3 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all border border-green-500/20"
          >
            <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-bold text-green-600">تفعيل واتساب الدعم</span>
          </button>
          <button
            onClick={() => document.getElementById('seller-stats')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex flex-col items-center gap-3 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all border border-blue-500/20"
          >
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-blue-600">إحصائيات إعلاناتي</span>
          </button>
          <Link
            to="/shift-calculator"
            className="flex flex-col items-center gap-3 bg-gradient-to-br from-orange/10 to-amber-50 p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all border border-orange/30"
          >
            <div className="w-12 h-12 bg-orange rounded-2xl flex items-center justify-center shadow-lg shadow-orange/30">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-bold text-orange">حاسبة الوردية</span>
            <span className="text-[10px] text-text-light leading-tight text-center -mt-2">سجّل النقلات والمصاريف</span>
          </Link>
        </div>

        {/* ── إحصائيات المعلن ─────────────────────────────── */}
        <div id="seller-stats" className="bg-white rounded-3xl shadow-sm border border-gray-100 mb-8 overflow-hidden scroll-mt-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange" />
              <h3 className="font-bold text-text">إحصائيات إعلاناتك</h3>
            </div>
            <button onClick={() => setStatsOpen(v => !v)} className="text-xs font-bold text-text-light hover:text-orange transition-colors">
              {statsOpen ? 'طيّ 👆' : 'عرض الإحصائيات 👇'}
            </button>
          </div>

          {statsOpen && (
            statsLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
            ) : stats && stats.totals.listings > 0 ? (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox label="إعلانات منشورة" value={fmtNum(stats.totals.listings)} icon={Truck} color="bg-blue-500" />
                  <StatBox label="مشاهدات" value={fmtNum(stats.totals.impressions)} icon={Eye} color="bg-orange" />
                  <StatBox label="نقرات تواصل" value={fmtNum(stats.totals.clicks)} icon={MousePointerClick} color="bg-green-500" />
                  <StatBox label="معدل التفاعل" value={`${stats.totals.ctr}%`} icon={Activity} color="bg-purple-500" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-text flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange" /> آخر 7 أيام ({fmtNum(stats.totals.weeklyImpressions)} مشاهدة / {fmtNum(stats.totals.weeklyClicks)} نقرة)</h4>
                  </div>
                  <div className="flex items-end gap-2 h-28 bg-gray-50 rounded-xl p-3">
                    {stats.trend.map(t => (
                      <div key={t.day} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                        <span className="text-[10px] text-text-light leading-none">{fmtNum(t.impressions)}</span>
                        <div className="w-full bg-orange/70 hover:bg-orange rounded-t-md transition-colors" style={{ height: `${Math.max(4, Math.round((t.impressions / maxTrend) * 70))}px` }} title={`${t.day} — ${t.impressions} مشاهدة / ${t.clicks} نقرة`} />
                        <span className="text-[10px] text-text-light whitespace-nowrap">{t.day.slice(8)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-text mb-2 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-orange" /> تفاصيل كل إعلان</h4>
                  <div className="space-y-2">
                    {stats.items.map(it => (
                      <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <Link to={`/listing/${it.id}`} className="font-bold text-text text-sm truncate block hover:text-orange transition-colors">{it.title}</Link>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${it.status === 'active' ? 'bg-green-100 text-green-700' : it.status === 'sold' ? 'bg-gray-200 text-gray-500' : it.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                              {it.status === 'active' ? 'نشط' : it.status === 'sold' ? 'مباع' : it.status === 'pending' ? 'قيد المراجعة' : it.status || '—'}
                            </span>
                            {(it.brand || it.model) && <span className="text-xs text-text-light">{[it.brand, it.model].filter(Boolean).join(' — ')}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-5 text-center flex-shrink-0">
                          <span className="flex flex-col"><b className="text-sm font-bold text-text">{fmtNum(it.impressions)}</b><span className="text-[10px] text-text-light">مشاهدات</span></span>
                          <span className="flex flex-col"><b className="text-sm font-bold text-text">{fmtNum(it.clicks)}</b><span className="text-[10px] text-text-light">نقرات</span></span>
                          <span className="flex flex-col"><b className="text-sm font-bold text-orange">{fmtNum(it.weeklyImpressions)}</b><span className="text-[10px] text-text-light">آخر 7 أيام</span></span>
                          <span className="flex flex-col"><b className="text-sm font-bold text-text">{it.ctr}%</b><span className="text-[10px] text-text-light">تفاعل</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-text-light">النقرات تُحتسب عند الضغط على واتساب أو الهاتف أو التمويل من صفحة الإعلان. المشاهدات = مرة واحدة لكل جهاز/يوم.</p>
              </div>
            ) : (
              <div className="p-8 text-center">
                <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-text-light text-sm">لا توجد إحصائيات بعد — ستظهر تلقائياً عندما يبدأ الزوار بمشاهدة إعلاناتك</p>
              </div>
            )
          )}
        </div>

        {savedSearchesLoading ? (
          <div className="flex items-center justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
        ) : savedSearches.length > 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <Bell className="w-5 h-5 text-orange" />
              <h3 className="font-bold text-text">البحث المحفوظ والتنبيهات ({savedSearches.length})</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {savedSearches.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-gray-50/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text text-sm truncate flex items-center gap-2">
                      <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {searchLabel(s) || 'بحث محفوظ'}
                    </p>
                    {s.query && <p className="text-xs text-text-light mt-0.5 truncate">بحث: {s.query}</p>}
                    {(s.governorate || s.category) && (
                      <p className="text-xs text-text-light truncate">
                        {[s.category, s.governorate].filter(Boolean).join(' — ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link to={searchUrl(s)}
                      className="flex items-center gap-1 text-xs bg-orange/10 hover:bg-orange/20 text-orange px-3 py-1.5 rounded-lg transition-colors">
                      عرض النتائج
                    </Link>
                    <button onClick={() => handleDeleteSavedSearch(s.id)}
                      className="flex items-center gap-1 text-xs bg-danger/10 hover:bg-danger/20 text-danger px-3 py-1.5 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
          <div className="flex border-b border-gray-100 overflow-x-auto hide-scrollbar bg-gray-50/50">
            {[
              { id: 'listings', label: `إعلاناتي (${listings.length})`, icon: Truck },
              { id: 'loads', label: `حمولاتي (${loads.length})`, icon: Package },
              { id: 'jobs', label: `وظائفي (${jobs.length})`, icon: HardHat },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all flex-shrink-0 relative ${
                  activeTab === tab.id ? 'text-orange bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-orange' : 'text-gray-400'}`} />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange rounded-t-full" />
                )}
              </button>
            ))}
          </div>
          
          <div className="p-8">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              </div>
            ) : activeTab === 'listings' ? (
              listings.length === 0 ? (
                <EmptyState icon={Truck} title="لم تقم بإضافة إعلانات بعد" desc="ابدأ بإضافة أول إعلانك الآن للوصول إلى آلاف المهتمين" link="/post-listing" btn="إضافة إعلان جديد" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {listings.map(l => (
                    <div key={l.id}>
                      <ListingCard listing={l} />
                      <div className="flex items-center gap-2 mt-2">
                        <Link to={`/listing/${l.id}/edit`}
                          className="flex items-center gap-1 text-xs bg-orange/10 hover:bg-orange/20 text-orange px-3 py-1.5 rounded-lg transition-colors">
                          <Edit className="w-3.5 h-3.5" /> تعديل
                        </Link>
                        <button onClick={() => handleDeleteListing(l.id)}
                          className="flex items-center gap-1 text-xs bg-danger/10 hover:bg-danger/20 text-danger px-3 py-1.5 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === 'loads' ? (
              loads.length === 0 ? (
                <EmptyState icon={Package} title="لم تقم بإضافة حمولات" desc="أضف حمولتك ليتم التواصل مع أقرب الشاحنات المتاحة" link="/post-listing?type=load" btn="إضافة حمولة" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {loads.map(l => (
                    <div key={l.id}>
                      <LoadCard load={l} />
                      <div className="flex items-center gap-2 mt-2">
                        <Link to={`/load/${l.id}/edit`}
                          className="flex items-center gap-1 text-xs bg-orange/10 hover:bg-orange/20 text-orange px-3 py-1.5 rounded-lg transition-colors">
                          <Edit className="w-3.5 h-3.5" /> تعديل
                        </Link>
                        <button onClick={() => handleDeleteLoad(l.id)}
                          className="flex items-center gap-1 text-xs bg-danger/10 hover:bg-danger/20 text-danger px-3 py-1.5 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              jobs.length === 0 ? (
                <EmptyState icon={HardHat} title="لم تقم بإضافة وظائف" desc="أضف وظائفك الشاغرة وابحث عن أفضل الكفاءات" link="/post-listing?type=job" btn="إضافة وظيفة" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {jobs.map(j => <JobCard key={j.id} job={j} />)}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, link, btn }: { icon: React.ElementType; title: string; desc: string; link: string; btn: string }) {
  return (
    <div className="text-center py-12 max-w-sm mx-auto">
      <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <Icon className="w-12 h-12 text-gray-300" />
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-6 leading-relaxed">{desc}</p>
      <Link
        to={link}
        className="inline-flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white px-8 py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-orange/20 w-full sm:w-auto"
      >
        <Plus className="w-5 h-5" />
        {btn}
      </Link>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-gradient-to-b from-gray-50 to-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-extrabold text-text leading-tight">{value}</div>
        <div className="text-[11px] text-text-light whitespace-nowrap">{label}</div>
      </div>
    </div>
  );
}
