import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Car, TrendingUp } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { listingsService } from '../lib/firestoreService';
import { formatPrice } from '../lib/utils';
import type { Listing } from '../types';

export default function EvaluatePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [condition, setCondition] = useState('used');

  useEffect(() => {
    let mounted = true;
    listingsService.getAll({ status: 'active' })
      .then(d => { if (mounted) setListings(d || []); })
      .catch(() => { if (mounted) setListings([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const brands = useMemo(() => [...new Set(listings.map(l => l.brand).filter(Boolean))] as string[], [listings]);
  const models = useMemo(() => [...new Set(listings.filter(l => !brand || l.brand === brand).map(l => l.model).filter(Boolean))] as string[], [listings, brand]);

  const result = useMemo(() => {
    if (!brand) return null;
    let pool = listings.filter(l => (l.brand || '').toLowerCase() === brand.toLowerCase());
    if (model) pool = pool.filter(l => (l.model || '').toLowerCase() === model.toLowerCase());
    if (year) pool = pool.filter(l => Math.abs((l.year || 0) - Number(year)) <= 2);
    const prices = pool.map(l => l.price || 0).filter(p => p > 0);
    if (prices.length === 0) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    // mileage adjustment
    const km = Number(mileage) || 0;
    let factor = 1;
    if (km > 200000) factor = 0.85;
    else if (km > 100000) factor = 0.93;
    else if (km < 30000) factor = 1.05;
    if (condition === 'new') factor *= 1.1;
    return { min: Math.round(min * factor), max: Math.round(max * factor), avg: Math.round(avg * factor), count: prices.length };
  }, [listings, brand, model, year, mileage, condition]);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead title="تقييم سيارة — كار مصر" description="قيّم سيارتك واحصل على تقدير سعر." />
      <div className="bg-gradient-to-br from-[#0F172A] via-[#172554] to-[#1D4ED8] text-white py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Gauge className="w-8 h-8 text-orange" /> تقييم سيارة
          </h1>
          <p className="text-white/80 mt-2">أدخل بيانات سيارتك للحصول على تقدير سعر من سوق كار مصر.</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-text mb-2">الماركة *</label>
              <select value={brand} onChange={e => { setBrand(e.target.value); setModel(''); }} className="w-full bg-bg text-text rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:border-orange">
                <option value="">اختر...</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-text mb-2">الموديل</label>
              <select value={model} onChange={e => setModel(e.target.value)} className="w-full bg-bg text-text rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:border-orange">
                <option value="">الكل</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-text mb-2">السنة</label>
              <input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="2020" className="w-full bg-bg text-text rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:border-orange" />
            </div>
            <div>
              <label className="block text-sm font-bold text-text mb-2">المسافة (كم)</label>
              <input type="number" value={mileage} onChange={e => setMileage(e.target.value)} placeholder="80000" className="w-full bg-bg text-text rounded-xl px-3 py-2.5 text-sm border border-border focus:outline-none focus:border-orange" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-text mb-2">الحالة</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCondition('used')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${condition === 'used' ? 'border-orange bg-orange/5 text-orange' : 'border-border text-text-light'}`}>مستعملة</button>
                <button type="button" onClick={() => setCondition('new')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${condition === 'new' ? 'border-orange bg-orange/5 text-orange' : 'border-border text-text-light'}`}>جديدة</button>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-6 bg-surface border border-border rounded-2xl p-6">
            <h3 className="font-extrabold text-text text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange" /> تقدير السعر
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-bg rounded-xl p-4">
                <p className="text-xs text-text-muted mb-1">أقل</p>
                <p className="font-extrabold text-text">{formatPrice(result.min)}</p>
              </div>
              <div className="bg-orange/10 rounded-xl p-4">
                <p className="text-xs text-orange mb-1">متوسط</p>
                <p className="font-extrabold text-orange text-lg">{formatPrice(result.avg)}</p>
              </div>
              <div className="bg-bg rounded-xl p-4">
                <p className="text-xs text-text-muted mb-1">أعلى</p>
                <p className="font-extrabold text-text">{formatPrice(result.max)}</p>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-3 text-center">بناءً على {result.count} إعلان في سوق كار مصر. تقدير تقريبي.</p>
          </div>
        )}
        {!result && brand && !loading && (
          <div className="mt-6 bg-surface border border-border rounded-2xl p-6 text-center text-text-muted">
            لا توجد بيانات كافية لتقدير السعر. جرّب ماركة/موديل آخر.
          </div>
        )}
      </div>
    </div>
  );
}
