import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, PlusCircle, ChevronLeft, Loader2, Trash2, Eye, Edit, Star, Briefcase, MapPin, Undo2, Share2, Check, X, MessageCircle, Phone, BarChart3, SlidersHorizontal } from 'lucide-react';
import { listingsService, loadsService, jobsService } from '../../lib/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { listingUrl } from '../../lib/utils';
import { OWNER_STATUS_OPTIONS } from '../../lib/listingStatus';
import { deleteListingServerSide, trackedLinks } from '../../lib/sellerApi';
import { statsService, type SellerStats } from '../../lib/stats';
import { toast } from '../../components/Toast';
import type { Listing, Load, Job } from '../../types';

const statusLabels: Record<string, { label: string; color: string }> = {
  active:   { label: 'نشط',    color: 'bg-success/10 text-success' },
  pending:  { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-700' },
  rejected: { label: 'مرفوض', color: 'bg-danger/10 text-danger' },
  sold:     { label: 'مُباع',  color: 'bg-gray-100 text-gray-500' },
  completed:{ label: 'مكتمل', color: 'bg-success/10 text-success' },
  cancelled:{ label: 'ملغي',  color: 'bg-danger/10 text-danger' },
};

type TabType = 'listings' | 'loads' | 'jobs';

export default function MyListings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabType>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [myStats, setMyStats] = useState<SellerStats | null>(null);
  const [shareFor, setShareFor] = useState<Listing | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      listingsService.getByUser(user.id),
      loadsService.getByUser(user.id),
      jobsService.getByUser(user.id),
      statsService.getMyStats(),
    ]).then(([l, ld, j, ms]) => {
      setListings(l);
      setLoads(ld);
      setJobs(j);
      setMyStats(ms);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (id: string, type: TabType) => {
    if (!confirm('هل تريد حذف هذا العنصر؟')) return;
    if (String(id).startsWith('sample-')) {
      toast('هذا عنصر تجريبي (عرض) ولا يمكن حذفه', 'error');
      return;
    }
    if (type === 'listings') {
      const res = await deleteListingServerSide(id);
      if (res.ok) {
        toast('تم حذف الإعلان بنجاح', 'success');
        setListings(p => p.filter(x => x.id !== id));
      } else {
        toast(res.message || 'تعذّر حذف الإعلان', 'error');
      }
    } else {
      try {
        if (type === 'loads') await loadsService.delete(id);
        else await jobsService.delete(id);
        toast('تم الحذف بنجاح', 'success');
        if (type === 'loads') setLoads(p => p.filter(x => x.id !== id));
        else setJobs(p => p.filter(x => x.id !== id));
      } catch (e: any) {
        toast(e?.code === 'permission-denied' ? 'غير مصرح لك بحذف هذا العنصر' : 'تعذّر الحذف، حاول مرة أخرى', 'error');
      }
    }
  };

  const copyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* ignore */ }
  };

  const handleUndoSale = async (id: string) => {
    try {
      await listingsService.update(id, { status: 'pending', soldThroughTareeq: false });
      setListings(p => p.map(l => l.id === id ? { ...l, status: 'pending', soldThroughTareeq: false } : l));
    } catch (error) {
      console.error('Error undoing sale:', error);
    }
  };

  // تغيير حالة الإعلان: متاح / محجوز / موقوف / تم البيع
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const handleStatus = async (id: string, next: string) => {
    setStatusBusy(id);
    try {
      await listingsService.update(id, {
        status: next as Listing['status'],
        soldThroughTareeq: next === 'sold',
      });
      setListings(p => p.map(l => (l.id === id ? { ...l, status: next as Listing['status'], soldThroughTareeq: next === 'sold' } : l)));
      setStatusFor(null);
    } catch (error) {
      console.error('Error changing status:', error);
    } finally {
      setStatusBusy(null);
    }
  };
  const [statusFor, setStatusFor] = useState<string | null>(null);

  const tabs = [
    { id: 'listings' as TabType, label: 'إعلانات', icon: Truck, count: listings.length },
    { id: 'loads' as TabType, label: 'شحنات', icon: MapPin, count: loads.length },
    { id: 'jobs' as TabType, label: 'وظائف', icon: Briefcase, count: jobs.length },
  ];

  const renderListings = () => {
    const filtered = filter === 'all' ? listings : listings.filter(l => l.status === filter);
    return (
      <>
        <div className="flex gap-2 mb-6 flex-wrap">
          {[['all','الكل'],['active','نشط'],['pending','معلق'],['rejected','مرفوض'],['sold','مُباع']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                filter === v ? 'bg-orange text-white' : 'bg-surface border border-border text-text-light hover:border-orange'}`}>
              {l}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center">
            <Truck className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h2 className="font-bold text-text mb-2">لا توجد إعلانات</h2>
            <p className="text-text-light text-sm mb-6">ابدأ الآن وصل إلى آلاف المشترين!</p>
            <Link to="/post-listing" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">نشر أول إعلان</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(l => (
              <div key={l.id} className="bg-surface rounded-2xl border border-border p-4 flex gap-3">
                {l.images?.[0]
                  ? <img src={l.images[0]} alt="" className="w-20 h-16 object-cover rounded-xl flex-shrink-0" loading="lazy" />
                  : <div className="w-20 h-16 bg-bg rounded-xl flex items-center justify-center flex-shrink-0"><Truck className="w-6 h-6 text-gray-300" /></div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-text text-sm">{l.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusLabels[l.status]?.color}`}>{statusLabels[l.status]?.label}</span>
                  </div>
                  <p className="text-text-light text-xs mt-1">{l.price?.toLocaleString('ar-EG')} جنيه • {l.governorate}</p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Link to={listingUrl(l.id, l.slug)} className="flex items-center gap-1 text-xs bg-bg border border-border hover:border-orange px-3 py-1.5 rounded-lg text-text transition-colors"><Eye className="w-3.5 h-3.5" /> عرض</Link>
                    <Link to={`/listing/${l.id}/edit`} className="flex items-center gap-1 text-xs bg-orange/10 hover:bg-orange/20 text-orange px-3 py-1.5 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /> تعديل</Link>
                    <button
                      onClick={() => setStatusFor(statusFor === l.id ? null : l.id)}
                      className="flex items-center gap-1 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" /> الحالة
                    </button>
                    <Link to={`/promote/${l.id}`} className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-600 px-3 py-1.5 rounded-lg transition-colors"><Star className="w-3.5 h-3.5" /> ترقية</Link>
                    <button onClick={() => setShareFor(l)} className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg transition-colors"><Share2 className="w-3.5 h-3.5" /> روابط النشر</button>
                    {l.status === 'sold' && (
                      <button onClick={() => handleUndoSale(l.id)} className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"><Undo2 className="w-3.5 h-3.5" /> إلغاء البيع</button>
                    )}
                    <button onClick={() => handleDelete(l.id, 'listings')} className="flex items-center gap-1 text-xs bg-danger/10 hover:bg-danger/20 text-danger px-3 py-1.5 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /> حذف</button>
                  </div>
                  {statusFor === l.id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-bold text-text-light mb-2">غيّر حالة الإعلان</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {OWNER_STATUS_OPTIONS.map(opt => {
                          const current = (l.status || 'active').toLowerCase() === opt.value;
                          return (
                            <button
                              key={opt.value}
                              disabled={statusBusy === l.id}
                              onClick={() => handleStatus(l.id, opt.value)}
                              title={opt.hint}
                              className={`text-xs font-bold px-2 py-2 rounded-xl border-2 transition-colors disabled:opacity-60 ${
                                current
                                  ? 'border-orange bg-orange/5 text-orange'
                                  : 'border-border text-text-light hover:border-orange'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-text-light mt-2">
                        {OWNER_STATUS_OPTIONS.find(o => o.value === (l.status || 'active').toLowerCase())?.hint || ''}
                      </p>
                    </div>
                  )}
                  {myStats && (() => {
                    const it = myStats.items.find(x => x.id === l.id);
                    if (!it) return null;
                    return (
                      <div dir="ltr" className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-text-light">
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-blue-500" /> {it.impressions} مشاهدة</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-green-500" /> {it.channels?.whatsapp ?? 0} واتساب</span>
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-orange" /> {it.channels?.call ?? 0} اتصال</span>
                        <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5 text-purple-500" /> {Math.round((it.ctr || 0) * 100)}% تفاعل</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  const renderLoads = () => (
    loads.length === 0 ? (
      <div className="bg-surface rounded-2xl border border-border p-10 text-center">
        <MapPin className="w-14 h-14 text-gray-200 mx-auto mb-4" />
        <h2 className="font-bold text-text mb-2">لا توجد شحنات</h2>
        <p className="text-text-light text-sm mb-6">انشر شحنتك الآن!</p>
        <Link to="/post-listing?tab=load" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">نشر شحنة</Link>
      </div>
    ) : (
      <div className="space-y-3">
        {loads.map(ld => (
          <div key={ld.id} className="bg-surface rounded-2xl border border-border p-4 flex gap-3">
            <div className="w-20 h-16 bg-bg rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="w-6 h-6 text-gray-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <p className="font-semibold text-text text-sm">{ld.origin} → {ld.destination}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusLabels[ld.status]?.color || 'bg-gray-100 text-gray-500'}`}>{statusLabels[ld.status]?.label || ld.status}</span>
              </div>
              <p className="text-text-light text-xs mt-1">{ld.price?.toLocaleString('ar-EG')} جنيه • {ld.cargoType}{ld.vehicleType ? ` • ${ld.vehicleType}` : ''}</p>
              <div className="flex gap-2 mt-3">
                <Link to={`/load/${ld.id}/edit`} className="flex items-center gap-1 text-xs bg-orange/10 hover:bg-orange/20 text-orange px-3 py-1.5 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /> تعديل</Link>
                <button onClick={() => handleDelete(ld.id, 'loads')} className="flex items-center gap-1 text-xs bg-danger/10 hover:bg-danger/20 text-danger px-3 py-1.5 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /> حذف</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  );

  const renderJobs = () => (
    jobs.length === 0 ? (
      <div className="bg-surface rounded-2xl border border-border p-10 text-center">
        <Briefcase className="w-14 h-14 text-gray-200 mx-auto mb-4" />
        <h2 className="font-bold text-text mb-2">لا توجد وظائف</h2>
        <p className="text-text-light text-sm mb-6">انشر وظيفة الآن!</p>
        <Link to="/post-listing?tab=job" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">نشر وظيفة</Link>
      </div>
    ) : (
      <div className="space-y-3">
        {jobs.map(j => (
          <div key={j.id} className="bg-surface rounded-2xl border border-border p-4 flex gap-3">
            <div className="w-20 h-16 bg-bg rounded-xl flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-6 h-6 text-gray-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <p className="font-semibold text-text text-sm">{j.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusLabels[j.status]?.color || 'bg-gray-100 text-gray-500'}`}>{statusLabels[j.status]?.label || j.status}</span>
              </div>
              <p className="text-text-light text-xs mt-1">{j.salary} جنيه • {j.location}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleDelete(j.id, 'jobs')} className="flex items-center gap-1 text-xs bg-danger/10 hover:bg-danger/20 text-danger px-3 py-1.5 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /> حذف</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  );

  return (
    <div className="w-full bg-bg">
      <div className="bg-navy text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">إعلاناتي</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">إعلاناتي</h1>
              <p className="text-gray-400 text-sm">{tab === 'listings' ? listings.length : tab === 'loads' ? loads.length : jobs.length} عنصر</p>
            </div>
            <Link to="/post-listing"
              className="flex items-center gap-2 bg-orange hover:bg-orange-dark px-4 py-2.5 rounded-xl text-sm font-bold transition-colors">
              <PlusCircle className="w-4 h-4" /> إضافة
            </Link>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setFilter('all'); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                tab === t.id ? 'bg-orange text-white shadow-lg shadow-orange/20' : 'bg-surface border border-border text-text-light hover:border-orange'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange" /></div>
        ) : tab === 'listings' ? renderListings() : tab === 'loads' ? renderLoads() : renderJobs()}
      </div>

      {shareFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShareFor(null)}>
          <div className="bg-surface rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-bold text-text flex items-center gap-2"><Share2 className="w-4 h-4 text-orange" /> روابط النشر</h3>
              <button onClick={() => setShareFor(null)} className="p-1.5 rounded-lg hover:bg-bg text-text-light"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-text-light mb-4">كل رابط متتبَّع تلقائياً، وضغطاته بتتحسب في إحصائياتك.</p>
              <div className="space-y-2">
                {trackedLinks(shareFor.id).map(link => (
                  <div key={link.id} className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-text">{link.label}</p>
                      <p dir="ltr" className="text-[11px] text-text-light truncate">{link.url}</p>
                    </div>
                    <button onClick={() => copyLink(link.url, link.id)}
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center hover:border-orange transition-colors text-text-light">
                      {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Share2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
