import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Car } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { listingsService } from '../lib/firestoreService';
import { formatPrice } from '../lib/utils';
import type { Listing } from '../types';

const FIELDS: { key: keyof Listing; label: string }[] = [
  { key: 'brand', label: 'الماركة' },
  { key: 'model', label: 'الموديل' },
  { key: 'year', label: 'السنة' },
  { key: 'condition', label: 'الحالة' },
  { key: 'bodyType' as any, label: 'نوع الهيكل' },
  { key: 'fuel', label: 'الوقود' },
  { key: 'transmission', label: 'ناقل الحركة' },
  { key: 'mileage', label: 'المسافة (كم)' },
  { key: 'color', label: 'اللون' },
  { key: 'engineSize', label: 'سعة المحرك' },
  { key: 'governorate', label: 'المحافظة' },
  { key: 'price', label: 'السعر' },
];

export default function ComparePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  useEffect(() => {
    let mounted = true;
    listingsService.getAll({ status: 'active' })
      .then(d => { if (mounted) setListings(d || []); })
      .catch(() => { if (mounted) setListings([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const la = useMemo(() => listings.find(l => l.id === a), [listings, a]);
  const lb = useMemo(() => listings.find(l => l.id === b), [listings, b]);

  const val = (l: Listing | undefined, key: string) => {
    if (!l) return '—';
    const v = (l as any)[key];
    if (v === undefined || v === null || v === '') return '—';
    if (key === 'price') return formatPrice(v);
    if (key === 'condition') return v === 'new' ? 'جديدة' : 'مستعملة';
    return String(v);
  };

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead title="مقارنة سيارتين — كار مصر" description="قارن بين سيارتين جنباً إلى جنب." />
      <div className="bg-gradient-to-br from-[#0B1E3A] to-[#122B4F] text-white py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Scale className="w-8 h-8 text-orange" /> مقارنة سيارتين
          </h1>
          <p className="text-white/80 mt-2">اختر سيارتين وقارن مواصفاتهما جنباً إلى جنب.</p>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="h-40 rounded-2xl bg-surface border border-border animate-pulse" />
        ) : listings.length < 2 ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center text-text-muted">
            <Car className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">لا توجد إعلانات كافية للمقارنة</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {[{ val: a, set: setA, label: 'السيارة الأولى' }, { val: b, set: setB, label: 'السيارة الثانية' }].map((s, i) => (
                <div key={i} className="bg-surface border border-border rounded-2xl p-4">
                  <label className="block text-sm font-bold text-text mb-2">{s.label}</label>
                  <select value={s.val} onChange={e => s.set(e.target.value)} className="w-full bg-bg text-text rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:border-orange">
                    <option value="">اختر...</option>
                    {listings.map(l => <option key={l.id} value={l.id}>{l.title} — {l.brand} {l.year || ''}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {la && lb && (
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="grid grid-cols-3 text-center border-b border-border">
                  <div className="p-3 font-bold text-text-muted text-sm">المواصفة</div>
                  <div className="p-3 font-bold text-text text-sm border-x border-border">{la.title}</div>
                  <div className="p-3 font-bold text-text text-sm">{lb.title}</div>
                </div>
                {FIELDS.map(f => (
                  <div key={f.key} className="grid grid-cols-3 text-center border-b border-border last:border-0">
                    <div className="p-3 text-sm text-text-muted">{f.label}</div>
                    <div className="p-3 text-sm font-semibold text-text border-x border-border">{val(la, f.key)}</div>
                    <div className="p-3 text-sm font-semibold text-text">{val(lb, f.key)}</div>
                  </div>
                ))}
                <div className="grid grid-cols-3 text-center">
                  <div className="p-3 text-sm text-text-muted">الصور</div>
                  <div className="p-3 border-x border-border">
                    {la.images?.[0] && <img src={la.images[0]} alt="" className="w-full h-24 object-cover rounded-lg" />}
                  </div>
                  <div className="p-3">
                    {lb.images?.[0] && <img src={lb.images[0]} alt="" className="w-full h-24 object-cover rounded-lg" />}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
