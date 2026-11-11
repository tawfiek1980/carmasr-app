import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Heart, DollarSign, Bell, PlusCircle, User, Settings, ChevronLeft, Loader2, Store, ExternalLink, Edit, Eye, MessageCircle, Phone, BarChart3, Calculator } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { listingsService, loadsService, jobsService, financeService, notificationsService, exhibitionsService } from '../../lib/firestoreService';
import { getExhibitionPlan } from '../../lib/plans';
import { statsService, type SellerStats } from '../../lib/stats';
import { listingUrl } from '../../lib/utils';
import type { Exhibition } from '../../types';

const quickLinks = [
  { icon: PlusCircle, label: 'نشر إعلان', path: '/post-listing', color: 'bg-orange' },
  { icon: Truck, label: 'إعلاناتي', path: '/my-listings', color: 'bg-navy' },
  { icon: Store, label: 'معرضي', path: '', color: 'bg-purple-500' },
  { icon: Heart, label: 'المفضلات', path: '/favorites', color: 'bg-red-500' },
  { icon: DollarSign, label: 'طلبات التمويل', path: '/my-finance', color: 'bg-success' },
  { icon: Calculator, label: 'حاسبة الوردية', path: '/shift-calculator', color: 'bg-amber-600' },
  { icon: Bell, label: 'الإشعارات', path: '/notifications', color: 'bg-warning' },
  { icon: Settings, label: 'الإعدادات', path: '/settings', color: 'bg-gray-500' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ listings: 0, loads: 0, jobs: 0, finance: 0, notifications: 0 });
  const [myExhibitions, setMyExhibitions] = useState<Exhibition[]>([]);
  const [myStats, setMyStats] = useState<SellerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      listingsService.getByUser(user.id),
      loadsService.getByUser(user.id),
      jobsService.getByUser(user.id),
      financeService.getByUser(user.id),
      notificationsService.getByUser(user.id),
      exhibitionsService.getByUserId(user.id),
      statsService.getMyStats(),
    ]).then(([listings, loads, jobs, finance, notifs, exhs, ms]) => {
      setStats({
        listings: listings.filter(l => l.status === 'active').length,
        loads: loads.length,
        jobs: jobs.length,
        finance: finance.length,
        notifications: notifs.length,
      });
      setMyExhibitions(exhs);
      setMyStats(ms);
    }).finally(() => setLoading(false));
  }, [user]);

  const totalActive = stats.listings;
  const myExhibition = myExhibitions[0];
  const exhLink = myExhibition ? `/exhibitions/${myExhibition.id}` : '/exhibitions/subscribe';

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">لوحتي</span>
          </nav>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-orange flex items-center justify-center text-white text-xl font-bold">
              {user?.name?.[0] || 'U'}
            </div>
            <div>
              <h1 className="text-xl font-bold">مرحباً، {user?.name || 'مستخدم'}!</h1>
              <p className="text-gray-400 text-sm">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
          {quickLinks.map((l) => {
            const link = l.label === 'معرضي' ? exhLink : l.path;
            return (
              <Link key={l.label} to={link} className="flex flex-col items-center gap-2 bg-surface rounded-2xl border border-border p-4 hover:border-orange transition-colors text-center">
                <div className={`w-10 h-10 rounded-xl ${l.color} flex items-center justify-center`}>
                  <l.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-text">{l.label}</span>
              </Link>
            );
          })}
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-orange" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-surface rounded-2xl border border-border p-5 text-center">
                <div className="text-3xl font-bold text-success mb-1">{stats.listings}</div>
                <div className="text-text-light text-sm">إعلانات نشطة</div>
              </div>
              <div className="bg-surface rounded-2xl border border-border p-5 text-center">
                <div className="text-3xl font-bold text-orange mb-1">{stats.loads}</div>
                <div className="text-text-light text-sm">شحنات</div>
              </div>
              <div className="bg-surface rounded-2xl border border-border p-5 text-center">
                <div className="text-3xl font-bold text-navy mb-1">{stats.jobs}</div>
                <div className="text-text-light text-sm">وظائف</div>
              </div>
              <div className="bg-surface rounded-2xl border border-border p-5 text-center">
                <div className="text-3xl font-bold text-navy mb-1">{stats.finance}</div>
                <div className="text-text-light text-sm">طلبات تمويل</div>
              </div>
            </div>

            {myStats && myStats.items.length > 0 && (
              <div className="bg-surface rounded-2xl border border-border p-6 mb-8">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-text flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-orange" /> ملخص أداء إعلاناتك
                  </h2>
                  <Link to="/my-listings" className="text-orange text-sm hover:underline">كل الإعلانات</Link>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-text-light text-xs font-semibold mb-2">
                      <Eye className="w-4 h-4 text-blue-500" /> المشاهدات
                    </div>
                    <div className="text-2xl font-bold text-text" dir="ltr">{myStats.totals?.impressions ?? 0}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-text-light text-xs font-semibold mb-2">
                      <MessageCircle className="w-4 h-4 text-green-500" /> واتساب
                    </div>
                    <div className="text-2xl font-bold text-text" dir="ltr">{myStats.totals?.channels?.whatsapp ?? 0}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-text-light text-xs font-semibold mb-2">
                      <Phone className="w-4 h-4 text-orange" /> اتصالات
                    </div>
                    <div className="text-2xl font-bold text-text" dir="ltr">{myStats.totals?.channels?.call ?? 0}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-text-light text-xs font-semibold mb-2">
                      <BarChart3 className="w-4 h-4 text-purple-500" /> نسبة التفاعل
                    </div>
                    <div className="text-2xl font-bold text-text" dir="ltr">{Math.round((myStats.totals?.ctr ?? 0) * 100)}%</div>
                  </div>
                </div>
                {myStats.items.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold text-text mb-3">أكثر الإعلانات تفاعلاً</h3>
                    <div className="space-y-2">
                      {[...myStats.items].sort((a, b) => (b.impressions + b.clicks) - (a.impressions + a.clicks)).slice(0, 3).map(it => (
                        <Link key={it.id} to={listingUrl(it.id, it.slug)} dir="ltr"
                          className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 hover:border hover:border-orange transition-colors">
                          <div className="flex-1 min-w-0 text-right">
                            <p className="font-semibold text-sm text-text truncate">{it.title}</p>
                            <p className="text-xs text-text-light">{it.impressions} مشاهدة • {it.channels?.whatsapp ?? 0} واتساب • {it.channels?.call ?? 0} اتصال</p>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-text-light rtl-flip" />
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-text">إعلاناتي الأخيرة</h2>
                <Link to="/my-listings" className="text-orange text-sm hover:underline">عرض الكل</Link>
              </div>
              {totalActive === 0 ? (
                <div className="text-center py-10 text-text-light">
                  <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm mb-4">لم تنشر أي إعلانات بعد</p>
                  <Link to="/post-listing" className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors inline-block">نشر أول إعلان</Link>
                </div>
              ) : (
                <p className="text-sm text-text-light text-center py-4">لديك {totalActive} إعلان نشط. <Link to="/my-listings" className="text-orange hover:underline">إدارة الإعلانات</Link></p>
              )}
            </div>

            {myExhibitions.length > 0 && (
              <div className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-text flex items-center gap-2">
                    <Store className="w-5 h-5 text-purple-500" /> معرضي
                  </h2>
                  <Link to={`/exhibitions/${myExhibition?.id}`} className="text-orange text-sm hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" /> عرض المعرض
                  </Link>
                </div>
                <div className="space-y-3">
                  {myExhibitions.map(exh => (
                    <div key={exh.id} className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg flex-shrink-0">
                        {exh.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-text truncate">{exh.name}</h4>
                          <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-semibold">{getExhibitionPlan(exh.plan).name}</span>
                        </div>
                        <p className="text-xs text-text-light">{exh.governorate}{exh.city ? ` - ${exh.city}` : ''}</p>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <Link to={`/exhibitions/${exh.id}`}
                          className="w-8 h-8 rounded-lg bg-orange/10 text-orange flex items-center justify-center hover:bg-orange/20 transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Link to={`/exhibitions/${myExhibition?.id}`}
                      className="flex-1 text-center text-sm bg-orange hover:bg-orange-dark text-white py-2.5 rounded-xl font-semibold transition-colors">
                      إدارة المعرض
                    </Link>
                    <Link to={`/exhibitions/subscribe`}
                      className="text-center text-sm bg-purple-50 hover:bg-purple-100 text-purple-600 py-2.5 rounded-xl font-semibold transition-colors px-4">
                      ترقية الباقة
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {myExhibitions.length === 0 && (
              <div className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-text flex items-center gap-2">
                    <Store className="w-5 h-5 text-purple-500" /> معرض خاص بك
                  </h2>
                </div>
                <div className="text-center py-6 text-text-light">
                  <Store className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm mb-4">أنشئ معرضك الخاص واعرض منتجاتك</p>
                  <Link to="/exhibitions/subscribe" className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors inline-block">
                    إنشاء معرض مجاني
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
