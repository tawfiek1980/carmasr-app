import { useEffect, useState } from 'react';
import { TrendingUp, Truck, Package, Briefcase, Users, DollarSign, Star } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { listingsService, loadsService, jobsService, financeService } from '../lib/firestoreService';
import { mainCategories, governorates } from '../lib/data';
import type { Listing, Load, Job, FinanceRequest } from '../types';

export default function Stats() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listingsService.getAll({}).catch(() => [] as Listing[]),
      loadsService.getAll({}).catch(() => [] as Load[]),
      jobsService.getAll({}).catch(() => [] as Job[]),
    ]).then(([l, ld, j]) => {
      setListings(l);
      setLoads(ld);
      setJobs(j);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const activeListings = listings.filter(l => l.status === 'active');
  const featuredListings = listings.filter(l => l.featured);
  const availableLoads = loads.filter(l => l.status === 'available');
  const activeJobs = jobs.filter(j => j.status === 'active');

  const byCategory = mainCategories.map(c => ({
    ...c,
    count: activeListings.filter(l => l.category === c.id).length,
  }));

  const byGov = governorates.slice(0, 10).map(g => ({
    ...g,
    count: activeListings.filter(l => l.governorate === g.name).length,
  }));

  const maxCatCount = Math.max(...byCategory.map(c => c.count), 1);
  const maxGovCount = Math.max(...byGov.map(g => g.count), 1);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-8 h-8 text-orange" />
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white">إحصائيات السوق</h1>
          </div>
          <p className="text-white/70 text-sm sm:text-base">نظرة عامة على نشاط سوق كار مصر</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'إعلانات نشطة', value: activeListings.length, icon: Truck, color: 'bg-orange/10 text-orange' },
            { label: 'إعلانات مميزة', value: featuredListings.length, icon: Star, color: 'bg-amber-50 text-amber-600' },
            { label: 'سيارات متاحة', value: availableLoads.length, icon: Package, color: 'bg-green-50 text-green-600' },
            { label: 'وظائف نشطة', value: activeJobs.length, icon: Briefcase, color: 'bg-blue-50 text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-border p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-text">{s.value}</div>
                <div className="text-xs text-text-light">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart: Categories */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text text-lg mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange" />
            الإعلانات حسب التصنيف
          </h2>
          <div className="space-y-3">
            {byCategory.map(c => (
              <div key={c.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-text">{c.name}</span>
                  <span className="text-text-light">{c.count}</span>
                </div>
                <div className="w-full bg-bg rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(c.count / maxCatCount) * 100}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart: Governorates */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text text-lg mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange" />
            أكثر المحافظات نشاطاً
          </h2>
          <div className="space-y-3">
            {byGov.map(g => (
              <div key={g.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-text">{g.name}</span>
                  <span className="text-text-light">{g.count}</span>
                </div>
                <div className="w-full bg-bg rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full bg-navy transition-all duration-500"
                    style={{ width: `${(g.count / maxGovCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange" />
            آخر الإعلانات المضافة
          </h2>
          <div className="space-y-2">
            {activeListings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map(l => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-semibold text-text text-sm">{l.title}</p>
                  <p className="text-xs text-text-light">{l.governorate} • {new Date(l.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
                <span className="text-sm font-bold text-orange">{l.price?.toLocaleString('ar-EG')} ج</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
