import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Briefcase, MapPin, Search, X, SlidersHorizontal, Star, Clock, GraduationCap, Users, DollarSign, Bookmark, MessageCircle, Phone } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { jobsService } from '../lib/firestoreService';
import { governorates } from '../lib/data';
import { getPhoneLink, getWhatsAppLink, formatDateDMY } from '../lib/utils';
import ProtectedPhoneButton from '../components/ProtectedPhoneButton';
import type { Job } from '../types';
import { getSiteUrl } from '../lib/config';

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'الأحدث' },
  { value: 'date-asc', label: 'الأقدم' },
  { value: 'salary-desc', label: 'الراتب: الأعلى' },
  { value: 'salary-asc', label: 'الراتب: الأقل' },
];

const JOB_TYPES = [
  { id: '',           name: 'الكل', icon: '📋' },
  { id: 'driver',     name: 'سائق', icon: '🚛' },
  { id: 'mechanic',   name: 'ميكانيكي', icon: '🔧' },
  { id: 'technician', name: 'تقني', icon: '💻' },
  { id: 'logistics',  name: 'لوجستيات', icon: '📦' },
  { id: 'heavy-equip',name: 'سيارات', icon: '🏗️' },
  { id: 'electrician',name: 'كهربائي', icon: '⚡' },
  { id: 'welder',     name: 'لحام', icon: '🔥' },
  { id: 'craftsman',  name: 'صنايعي', icon: '🛠️' },
  { id: 'tinsmith',   name: 'سمكري', icon: '🔩' },
  { id: 'carpenter',  name: 'نجار', icon: '🪚' },
  { id: 'warehouse',  name: 'مستودعات', icon: '🏭' },
  { id: 'sales',      name: 'مبيعات', icon: '📊' },
  { id: 'other',      name: 'أخرى', icon: '📌' },
];

const EXPERIENCE_LEVELS = [
  { value: '', label: 'كل الخبرات' },
  { value: 'fresh', label: 'حديث التخرج' },
  { value: '1-3', label: '1-3 سنوات' },
  { value: '3-5', label: '3-5 سنوات' },
  { value: '5+', label: '5+ سنوات' },
];

const POST_TYPES = [
  { value: '', label: 'الكل' },
  { value: 'hire', label: 'مطلوب موظف' },
  { value: 'available', label: 'أبحث عن عمل' },
];

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [savedJobs, setSavedJobs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('tareeq_saved_jobs') || '[]'); } catch { return []; }
  });

  const type        = searchParams.get('type')        || '';
  const governorate = searchParams.get('governorate') || '';
  const postType    = searchParams.get('postType')    || '';
  const experience  = searchParams.get('experience')  || '';
  const searchQuery = searchParams.get('q')           || '';
  const sort        = searchParams.get('sort')        || 'date-desc';

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);

    jobsService.getAll({ status: 'active' })
      .then(list => { if (!cancelled) setJobs(list); })
      .catch(err => { console.error("Jobs load error:", err); })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const toggleSave = (id: string) => {
    setSavedJobs(prev => {
      const next = prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id];
      localStorage.setItem('tareeq_saved_jobs', JSON.stringify(next));
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = [...jobs];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j =>
        j.title?.toLowerCase().includes(q) ||
        j.company?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q) ||
        j.governorate?.toLowerCase().includes(q)
      );
    }

    if (type)        result = result.filter(j => j.type === type);
    if (governorate) result = result.filter(j => j.governorate === governorate);
    if (postType)    result = result.filter(j => j.jobPostType === postType);
    if (experience) {
      const yearsOf = (v?: string): number | null => {
        if (!v) return null;
        const m = v.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : null;
      };
      const isFresh = (v?: string) =>
        !v || v === 'fresh' || v === '0' || /حديث|جديد|تخرج|less than|أقل من/i.test(v);

      result = result.filter(j => {
        if (experience === 'fresh') return isFresh(j.experience);
        const n = yearsOf(j.experience);
        if (n === null) return false;
        if (experience === '1-3') return n >= 1 && n <= 3;
        if (experience === '3-5') return n >= 3 && n <= 5;
        if (experience === '5+')  return n >= 5;
        return j.experience === experience;
      });
    }

    const salaryMax = (v?: string): number => {
      if (!v) return -1;
      const nums = v.match(/[\d,]+/g);
      if (!nums || !nums.length) return -1;
      return Math.max(...nums.map(n => parseInt(n.replace(/,/g, ''), 10)).filter(n => !isNaN(n)));
    };

    result.sort((a, b) => {
      switch (sort) {
        case 'date-asc': return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'salary-desc': return salaryMax(b.salary) - salaryMax(a.salary);
        case 'salary-asc': return salaryMax(a.salary) - salaryMax(b.salary);
        default: return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });

    return result;
  }, [jobs, searchQuery, type, governorate, postType, experience, sort]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const byType: Record<string, number> = {};
    filtered.forEach(j => { byType[j.type] = (byType[j.type] || 0) + 1; });
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    const topLabel = JOB_TYPES.find(t => t.id === topType?.[0]);
    return {
      total: filtered.length,
      topType: topLabel ? `${topLabel.icon} ${topLabel.name}` : '',
      topCount: topType?.[1] || 0,
      hireCount: filtered.filter(j => j.jobPostType === 'hire').length,
      availableCount: filtered.filter(j => j.jobPostType === 'available').length,
    };
  }, [filtered]);

  const updateFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) { p.set(key, value); } else { p.delete(key); }
    setSearchParams(p);
  };

  const clearFilters = () => setSearchParams(new URLSearchParams());
  const hasFilters = type || governorate || postType || experience || searchQuery || sort !== 'date-desc';

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy py-5 sm:py-7">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">وظائف النقل</h1>
              <p className="text-gray-400 text-xs sm:text-sm mt-1">فرص عمل في قطاع النقل الثقيل</p>
            </div>
            <Link to="/post-listing?type=job"
              className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">أضف إعلان</span>
            </Link>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
            <input value={searchQuery} onChange={e => updateFilter('q', e.target.value)}
              placeholder="ابحث في الوظائف (مسمى، شركة، محافظة...)"
              className="bg-transparent w-full text-white placeholder:text-white/40 text-sm focus:outline-none" />
            {searchQuery && (
              <button onClick={() => updateFilter('q', '')} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
            {JOB_TYPES.map(t => (
              <button key={t.id} onClick={() => updateFilter('type', t.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  type === t.id ? 'bg-orange text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                {t.icon} {t.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select value={postType} onChange={e => updateFilter('postType', e.target.value)}
              className="bg-white/10 text-white/70 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none appearance-none">
              {POST_TYPES.map(p => (
                <option key={p.value} value={p.value} className="bg-navy text-white">{p.label}</option>
              ))}
            </select>
            <select value={experience} onChange={e => updateFilter('experience', e.target.value)}
              className="bg-white/10 text-white/70 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none appearance-none">
              {EXPERIENCE_LEVELS.map(e => (
                <option key={e.value} value={e.value} className="bg-navy text-white">{e.label}</option>
              ))}
            </select>
            <select value={sort} onChange={e => updateFilter('sort', e.target.value)}
              className="bg-white/10 text-white/70 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none">
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value} className="bg-navy text-white">{o.label}</option>
              ))}
            </select>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showFilters || hasFilters ? 'bg-orange text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              فلتر
            </button>
          </div>

          {showFilters && (
            <div className="bg-white rounded-2xl p-4 mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text">تصفية متقدمة</span>
                <button onClick={clearFilters} className="text-orange text-xs font-semibold">إعادة ضبط</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={governorate} onChange={e => updateFilter('governorate', e.target.value)}
                  className="w-full h-10 px-3 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm">
                  <option value="">كل المحافظات</option>
                  {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                </select>
                <select value={postType} onChange={e => updateFilter('postType', e.target.value)}
                  className="w-full h-10 px-3 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-sm">
                  {POST_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text mb-1">لا توجد وظائف</h3>
            <p className="text-text-light text-sm mb-6">جرب تغيير الفلاتر أو أضف أول وظيفة</p>
            <div className="flex items-center justify-center gap-3">
              {hasFilters && (
                <button onClick={clearFilters}
                  className="bg-bg border border-border text-text px-6 py-2.5 rounded-xl font-bold text-sm transition-colors">
                  إعادة ضبط الفلاتر
                </button>
              )}
              <Link to="/post-listing?type=job"
                className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors inline-block">
                أضف وظيفة
              </Link>
            </div>
          </div>
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <Briefcase className="w-3.5 h-3.5" /> إجمالي
                  </div>
                  <p className="text-lg font-black text-text">{stats.total}</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <Users className="w-3.5 h-3.5" /> مطلوب
                  </div>
                  <p className="text-lg font-black text-orange">{stats.hireCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <Users className="w-3.5 h-3.5" /> متاح للعمل
                  </div>
                  <p className="text-lg font-black text-success">{stats.availableCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-text-light mb-1">
                    <Star className="w-3.5 h-3.5" /> الأكثر طلباً
                  </div>
                  <p className="text-lg font-black text-text truncate">{stats.topType || '-'}</p>
                </div>
              </div>
            )}

            <p className="text-text-light text-sm mb-4">{filtered.length} وظيفة</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(j => (
                <JobCard key={j.id} job={j} saved={savedJobs.includes(j.id)} onToggleSave={toggleSave} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, saved, onToggleSave }: { job: Job; saved: boolean; onToggleSave: (id: string) => void }) {
  const typeLabels: Record<string, string> = {
    driver:'سائق', mechanic:'ميكانيكي', technician:'تقني',
    logistics:'لوجستيات', warehouse:'مستودعات', sales:'مبيعات',
    'heavy-equip':'سيارات', electrician:'كهربائي',
    welder:'لحام', craftsman:'صنايعي', tinsmith:'سمكري',
    carpenter:'نجار', other:'أخرى',
  };

  const typeIcons: Record<string, string> = {
    driver:'🚛', mechanic:'🔧', technician:'💻',
    logistics:'📦', warehouse:'🏭', sales:'📊',
    'heavy-equip':'🏗️', electrician:'⚡',
    welder:'🔥', craftsman:'🛠️', tinsmith:'🔩',
    carpenter:'🪚', other:'📌',
  };

  const experienceLabel: Record<string, string> = {
    fresh: 'حديث التخرج', '1-3': '1-3 سنوات', '3-5': '3-5 سنوات', '5+': '5+ سنوات',
  };

  const showExperience = (v?: string): string | null => {
    if (!v) return null;
    if (experienceLabel[v]) return experienceLabel[v];
    const m = v.match(/(\d+)/);
    if (!m) return v;
    const n = parseInt(m[1], 10);
    if (n === 0) return experienceLabel.fresh;
    if (n <= 1) return 'سنة على الأقل';
    if (n <= 3) return '1-3 سنوات';
    if (n <= 5) return '3-5 سنوات';
    return '5+ سنوات';
  };

  return (
    <div className={`bg-surface rounded-2xl border ${saved ? 'border-orange/40' : 'border-border'} p-5 hover:border-orange/40 transition-all hover:shadow-md relative flex flex-col`}>
      {saved && (
        <span className="absolute top-3 left-3 bg-orange/10 text-orange text-[10px] font-bold px-2 py-0.5 rounded-full">
          محفوظة
        </span>
      )}
      {String(job.id).startsWith('sample-') && (
        <span className="absolute top-3 left-3 bg-gray-700/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          تجريبي (عرض)
        </span>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center flex-shrink-0 text-lg">
          {typeIcons[job.type] || '📋'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-text truncate">{job.title}</h3>
            {job.featured && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0">مميز</span>
            )}
          </div>
          <p className="text-text-light text-sm">{job.company}</p>
        </div>
        <button onClick={() => onToggleSave(job.id)}
          className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${saved ? 'text-orange bg-orange/10' : 'text-gray-300 hover:text-orange hover:bg-orange/5'}`}
          title={saved ? 'إزالة من المحفوظات' : 'حفظ الوظيفة'}>
          <Bookmark className={`w-4 h-4 ${saved ? 'fill-orange' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
          job.jobPostType === 'available'
            ? 'bg-green-100 text-green-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {job.jobPostType === 'available' ? 'أبحث عن عمل' : 'مطلوب موظف'}
        </span>
        <span className="bg-orange/10 text-orange text-[11px] font-semibold px-2 py-0.5 rounded-lg">
          {typeIcons[job.type] || ''} {typeLabels[job.type] || job.type}
        </span>
        {showExperience(job.experience) && (
          <span className="bg-purple-50 text-purple-600 text-[11px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1">
            <GraduationCap className="w-3 h-3" /> {showExperience(job.experience)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-text-light mb-3 flex-wrap">
        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.governorate}</span>
        {job.salary && <span className="font-semibold text-success"><DollarSign className="w-3.5 h-3.5 inline" />{job.salary}</span>}
        <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{formatDateDMY(job.createdAt)}</span>
      </div>

      {job.description && (
        <p className="text-text-light text-xs mb-3 line-clamp-2">{job.description}</p>
      )}

      {job.requirements && job.requirements.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {job.requirements.slice(0, 3).map((r, i) => (
            <span key={i} className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">{r}</span>
          ))}
          {job.requirements.length > 3 && (
            <span className="text-gray-400 text-[10px] px-1">+{job.requirements.length - 3}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        {(() => {
          const phone = job.secondaryPhone || job.contactPhone || job.userPhone;
          return phone ? (
            <>
              <ProtectedPhoneButton phone={phone} className="flex-1">
                <a href={getWhatsAppLink(phone, `مرحباً، شفت إعلان الوظيفة "${job.title}" على تطبيق كار مصر`)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
                  title="تواصل واتساب">
                  <MessageCircle className="w-4 h-4" /> واتساب
                </a>
              </ProtectedPhoneButton>
              <ProtectedPhoneButton phone={phone} className="flex-1">
                <a href={getPhoneLink(phone)}
                  className="flex-1 bg-orange hover:bg-orange-dark text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
                  title="اتصال مباشر">
                  <Phone className="w-4 h-4" /> {job.jobPostType === 'hire' ? 'تقدم' : 'اتصل'}
                </a>
              </ProtectedPhoneButton>
            </>
          ) : null;
        })()}
      </div>
    </div>
  );
}
