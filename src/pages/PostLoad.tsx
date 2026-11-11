import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ChevronLeft, Package, Truck, MapPin, CheckCircle, Globe, Clock, FileText,
  Phone, Send, Loader2, Edit3, RefreshCw, Sparkles,
  Weight, Info, CreditCard, TrendingUp, DollarSign, Calendar,
} from 'lucide-react';
import { auth } from '../lib/auth';
import { useNotifications } from '../contexts/NotificationContext';
import { getSiteUrl, getApiUrl } from '../lib/config';
import { trackEvent } from '../lib/analytics';
import { notifyWhatsApp } from '../lib/notifyWhatsApp';
import { firebaseAuth } from '../firebase';
import { governorates, citiesByGovernorate } from '../lib/data';
import SeoHead from '../components/SeoHead';
import { formatDateDMY } from '../lib/utils';

const CARGO_TYPES = ['بضاعة جافة', 'مبردة', 'سوائل', 'مواد بناء', 'أثاث', 'مواشي', 'حاويات', 'مواد غذائية', 'أخرى'];

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
const VEHICLE_TYPES = ['أي عربية', 'قلاب', 'سطحه', 'تريلة', 'دينا', 'براد', 'تانك', 'كونتينر', 'نقل عادي', 'أخرى'];
const PAYMENT_TERMS = ['نقدي عند التحميل', 'نقدي عند التسليم', 'تحويل بنكي', 'بعد التسليم', 'بالاتفاق', 'أخرى'];
const TRIP_TYPES = [
  { value: 'single', label: 'رحلة واحدة' },
  { value: 'return', label: 'رحلة رجعية' },
  { value: 'contract', label: 'تعاقد / لفترة' },
];

type Step = 1 | 2 | 3 | 4 | 5 | 6;
const STEPS: { n: Step; label: string; icon: React.ElementType }[] = [
  { n: 1, label: 'مسار الحمولة', icon: MapPin },
  { n: 2, label: 'تفاصيل الحمولة', icon: Package },
  { n: 3, label: 'السيارة المطلوبة', icon: Truck },
  { n: 4, label: 'الرحلة والأجرة', icon: Clock },
  { n: 5, label: 'التواصل', icon: Phone },
  { n: 6, label: 'مراجعة ونشر', icon: Send },
];

const STORAGE_KEY = 'tareeq-load-draft';
const PRICE_TYPE_LABELS: Record<string, string> = {
  per_trip: 'للرحلة',
  per_ton: 'للطن',
  negotiable: 'بالاتفاق',
};
const PACKAGING_OPTIONS = ['كرتون', 'أسطواني', 'صندوق', 'أخشاب', 'أبريشم', 'أخرى'];

interface LoadForm {
  international: boolean;
  originCountry: string;
  originCity: string;
  originGovernorate: string;
  destinationCountry: string;
  destinationCity: string;
  destinationGovernorate: string;
  sameGovernorate: boolean;
  pickupAddress: string;
  deliveryAddress: string;
  cargoType: string;
  cargoTypeOther: string;
  packagingType: string;
  weight: string;
  pieceCount: string;
  volume: string;
  vehicleType: string;
  vehicleSpecs: string;
  tripType: string;
  contractTrips: string;
  contractNature: string;
  contractNotes: string;
  isReturnLoad: boolean;
  price: string;
  priceType: string;
  paymentTerms: string;
  paymentTermsOther: string;
  shipDate: string;
  shipTime: string;
  timeFlexible: boolean;
  contactPhone: string;
  secondaryPhone: string;
  showPhone: boolean;
  allowWhatsApp: boolean;
  loadingInstructions: string;
  description: string;
  needsLoader: boolean;
  needsPermit: boolean;
  specialConditions: string;
}

const initialForm: LoadForm = {
  international: false, originCountry: '', originCity: '', originGovernorate: '',
  destinationCountry: '', destinationCity: '', destinationGovernorate: '', sameGovernorate: true,
  pickupAddress: '', deliveryAddress: '',
  cargoType: '', cargoTypeOther: '', packagingType: '', weight: '', pieceCount: '', volume: '',
  vehicleType: '', vehicleSpecs: '',
  tripType: 'single', contractTrips: '', contractNature: '', contractNotes: '',
  isReturnLoad: false,
  price: '', priceType: 'per_trip', paymentTerms: '', paymentTermsOther: '',
  shipDate: '', shipTime: '', timeFlexible: false,
  contactPhone: '', secondaryPhone: '', showPhone: true, allowWhatsApp: false,
  loadingInstructions: '', description: '',
  needsLoader: false, needsPermit: false, specialConditions: '',
};

function getCities(province: string): string[] {
  if (!province) return [];
  const g = governorates.find(g => g.name === province);
  return g ? citiesByGovernorate[g.id] || [] : [];
}

export default function PostLoad() {
  const { toast } = useNotifications();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<LoadForm>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...initialForm, ...JSON.parse(saved) } : initialForm;
    } catch { return initialForm; }
  });
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [publishedStatus, setPublishedStatus] = useState<'published' | 'pending' | null>(null);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const user = auth.getUser();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const update = (patch: Partial<LoadForm>) => setForm(f => ({ ...f, ...patch }));

  const originText = form.international
    ? `${form.originCity || form.originCountry}`.trim() || form.originCountry
    : `${form.originCity || form.originGovernorate}`.trim() || form.originGovernorate;
  const destinationText = form.international
    ? `${form.destinationCity || form.destinationCountry}`.trim() || form.destinationCountry
    : `${form.destinationCity || form.destinationGovernorate}`.trim() || form.destinationGovernorate;

  const canGoNext = (s: Step): boolean => {
    switch (s) {
      case 1: return !!(form.international ? (form.originCountry && form.destinationCountry) : (form.originGovernorate && form.destinationGovernorate));
      case 2: return !!(form.cargoType && form.weight);
      case 3: return !!form.vehicleType;
      case 4: {
        if (form.priceType === 'negotiable') return !!form.shipDate && !!form.shipTime;
        return !!(form.price && form.shipDate && form.shipTime);
      }
      case 5: return !!form.contactPhone;
      default: return true;
    }
  };

  const goNext = () => {
    if (!canGoNext(step)) {
      const names: Partial<Record<Step, string>> = {
        1: 'اختر نقطة الانطلاق والوصول',
        2: 'حدد نوع الحمولة والوزن',
        3: 'حدد نوع العربية المطلوبة',
        4: 'أكمل الأجرة وموعد التحميل',
        5: 'أدخل رقم التواصل',
        6: 'راجع ثم انشر الحمولة',
      };
      toast(names[step] || 'يرجى ملء الحقول المطلوبة', 'error');
      return;
    }
    if (step < 6) setStep(s => (s + 1) as Step);
  };

  const generateLoadDescription = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/ai/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "describe", type: "load",
          origin: originText, destination: destinationText,
          cargoType: form.cargoType, vehicleType: form.vehicleType,
          weight: form.weight, price: form.priceType === 'negotiable' ? '' : form.price,
          notes: form.description,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast(data.message || "الذكاء الاصطناعي غير متاح", "error"); return; }
      const parts: string[] = [];
      if (data.description) parts.push(data.description);
      if (data.highlights?.length) parts.push("", ...data.highlights.map((h: string) => `• ${h}`));
      if (data.priceNote) parts.push("", data.priceNote);
      if (data.keywords?.length) parts.push("", ...data.keywords.map((k: string) => `#${k}`));
      update({ description: parts.join("\n") });
      toast("تم توليد وصف الحمولة وتطبيقه", "success");
    } catch { toast("تعذر الاتصال بخدمة الذكاء الاصطناعي", "error"); }
    finally { setAiLoading(false); }
  };

  const handlePublish = async () => {
    if (!user) return;
    if (!canGoNext(6)) return;
    setPublishing(true);
    setError('');
    trackEvent('publish_load', { vehicleType: form.vehicleType, cargoType: form.cargoType, international: form.international });
    try {
      const payload: Record<string, unknown> = {
        origin: originText,
        destination: destinationText,
        cargoType: form.cargoType === 'أخرى' ? form.cargoTypeOther : form.cargoType,
        vehicleType: form.vehicleType,
        weight: form.weight,
        price: form.priceType === 'negotiable' ? 0 : Number(form.price) || 0,
        priceType: form.priceType,
        paymentTerms: form.paymentTerms,
        isReturnLoad: form.isReturnLoad,
        date: form.shipDate,
        loadingTime: form.shipTime,
        timeFlexible: form.timeFlexible,
        userId: user.id,
        userName: user.name || '',
        userPhone: user.phone || '',
        contactPhone: form.contactPhone || user.phone || '',
        secondaryPhone: form.secondaryPhone || '',
        showPhone: form.showPhone,
        allowWhatsApp: form.allowWhatsApp,
        status: 'available',
        international: form.international,
      };
      const optional: [string, unknown][] = [
        ['originCountry', form.originCountry],
        ['destinationCountry', form.destinationCountry],
        ['originCity', form.originCity],
        ['destinationCity', form.destinationCity],
        ['originGovernorate', form.originGovernorate],
        ['destinationGovernorate', form.destinationGovernorate],
        ['pickupAddress', form.pickupAddress],
        ['deliveryAddress', form.deliveryAddress],
        ['pieceCount', form.pieceCount],
        ['volume', form.volume],
        ['packagingType', form.packagingType],
        ['vehicleSpecs', form.vehicleSpecs],
        ['tripType', form.tripType],
        ['contractTrips', form.contractTrips],
        ['contractNature', form.contractNature],
        ['contractNotes', form.contractNotes],
        ['description', form.description],
        ['loadingInstructions', form.loadingInstructions],
        ['needsLoader', form.needsLoader],
        ['needsPermit', form.needsPermit],
        ['specialConditions', form.specialConditions],
      ];
      optional.forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== false) payload[k] = v; });
      if (form.isReturnLoad) {
        payload.returnOrigin = form.originCity || form.originGovernorate;
        payload.returnDestination = form.destinationCity || form.destinationGovernorate;
      }

      const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : '';
      const resp = await fetch(`${getApiUrl()}/ai/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'auto-publish', kind: 'load', data: payload }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.message || 'تعذر نشر حمولتك');
      localStorage.removeItem(STORAGE_KEY);
      setPublishedId(data.id);
      if (data.status === 'available') {
        setPublishedStatus('published');
        toast('تم نشر حمولتك بنجاح وهي الآن مرئية للسائقين', 'success');
        notifyWhatsApp('load', {
          title: `${originText} → ${destinationText}`,
          userName: user.name || '',
          governorate: form.originGovernorate || '',
          phone: form.contactPhone || user.phone || '',
          price: form.priceType === 'negotiable' ? 'بالاتفاق' : `${Number(form.price) || 0} جنيه`,
          link: `${getSiteUrl()}/loads`,
        });
      } else if (data.status === 'pending') {
        setPublishedStatus('pending');
        toast('تم استلام حمولتك وهي قيد المراجعة', 'info');
      } else {
        const why = Array.isArray(data.reasons) && data.reasons.length ? ` (${data.reasons.join('، ')})` : '';
        setPublishedId(null);
        throw new Error(`لم يتم نشر الحمولة لأنها لا تطابق معايير النشر${why}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'حدث خطأ أثناء النشر';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const popularRouteHint = useMemo(() => {
    if (originText && destinationText && form.vehicleType) {
      return `🚛 رحلة شائعة على كار مصر ${originText} → ${destinationText}`;
    }
    return '';
  }, [originText, destinationText, form.vehicleType]);

  const priceDisplay = form.priceType === 'negotiable'
    ? 'بالاتفاق'
    : `${Number(form.price) || 0} جنيه ${PRICE_TYPE_LABELS[form.priceType] || ''}`;

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-bg pb-24 sm:pb-8">
      <SeoHead title="نشر حمولة جديدة" description="أضف حمولتك مجانًا ووصلها بالسائق المناسب." ogType="website" canonical={`${getSiteUrl()}/loads/new`} />

      {/* Header */}
      <div className="bg-gradient-to-l from-navy to-navy-light text-white py-7 px-4">
        <div className="max-w-3xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <Link to="/loads" className="hover:text-orange">الحمولات</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">حمولة جديدة</span>
          </nav>
          <h1 className="text-2xl font-bold">نشر حمولة جديدة</h1>
          <p className="text-gray-300 text-sm mt-1">أضف حمولتك مجانًا ووصلها بالسائق المناسب.</p>
          <p className="text-success text-xs mt-1 font-semibold">✓ نشر مجاني بالكامل — لا أسعار، لا اشتراكات، لا باقات</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Progress */}
        <div className="flex items-center justify-between mb-6 text-xs text-text-light">
          {STEPS.map(s => (
            <div key={s.n} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                step >= s.n ? 'bg-orange text-white' : 'bg-gray-200 text-gray-500'
              }`}>{s.n}</div>
              <span className={step >= s.n ? 'text-text font-semibold' : ''}>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full mb-6 overflow-hidden">
          <div className="h-full bg-orange transition-all" style={{ width: `${((step - 1) / 5) * 100}%` }} />
        </div>

        {/* Common draft note */}
        <div className="bg-blue-50 border border-blue-100 text-blue-700 text-xs rounded-xl p-2.5 mb-4 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          <span>يتم حفظ بياناتك تلقائياً كمسودة — يمكنك إغلاق الصفحة واستكمالها لاحقاً.</span>
        </div>

        {publishedId ? (
          <div className="bg-success/10 border border-success/20 rounded-2xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
            <h2 className="text-xl font-bold text-text mb-1">{publishedStatus === 'pending' ? 'تم الاستلام!' : 'تم النشر!'}</h2>
            <p className="text-text-light text-sm mb-4">{publishedStatus === 'pending' ? 'حمولتك قيد المراجعة الإدارية وسيتم تفعيلها بعد الموافقة.' : 'تم نشر حمولتك وهي مرئية للسائقين الآن.'}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/loads" className="bg-orange hover:bg-orange-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm">عرض الحمولات</Link>
              <Link to={`/load/${publishedId}`} className="bg-surface border border-border hover:bg-gray-50 text-text px-5 py-2.5 rounded-xl font-bold text-sm">عرض حمولتي</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (step === 6) { handlePublish(); } else { goNext(); } }}>
            {error && <div className="bg-error/10 border border-error/20 text-error text-sm rounded-xl p-3 mb-4">{error}</div>}

            {/* STEP 1 — مسار الحمولة */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-bold text-text">1. مسار الحمولة</h2>

                <div className="flex items-center gap-3 p-3 bg-bg rounded-xl border border-border">
                  <input type="checkbox" id="intlLoad" checked={form.international}
                    onChange={e => update({ international: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
                  <label htmlFor="intlLoad" className="text-sm font-bold text-text flex items-center gap-1.5 cursor-pointer">
                    <Globe className="w-4 h-4 text-text-light" /> نقل خارج مصر
                  </label>
                </div>
                {!form.international && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-border">
                    <input type="checkbox" id="sameProv" checked={form.sameGovernorate}
                      onChange={e => update({ sameGovernorate: e.target.checked, destinationGovernorate: e.target.checked ? form.originGovernorate : '' })}
                      className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
                    <label htmlFor="sameProv" className="text-sm font-bold text-text cursor-pointer">داخل المحافظة (نفسها للتحميل والتسليم)</label>
                  </div>
                )}

                {form.international ? (
                  <>
                    <Field label="من (الدولة) *">
                      <input value={form.originCountry} onChange={e => update({ originCountry: e.target.value })}
                        className={inp} placeholder="مثال: السعودية" />
                    </Field>
                    <Field label="من (المدينة)">
                      <input value={form.originCity} onChange={e => update({ originCity: e.target.value })}
                        className={inp} placeholder="مثال: الرياض" />
                    </Field>
                    <Field label="إلى (الدولة) *">
                      <input value={form.destinationCountry} onChange={e => update({ destinationCountry: e.target.value })}
                        className={inp} placeholder="مثال: الإمارات" />
                    </Field>
                    <Field label="إلى (المدينة)">
                      <input value={form.destinationCity} onChange={e => update({ destinationCity: e.target.value })}
                        className={inp} placeholder="مثال: دبي" />
                    </Field>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="المحافظة *">
                        <select value={form.originGovernorate} onChange={e => update({ originGovernorate: e.target.value, destinationGovernorate: form.sameGovernorate ? e.target.value : form.destinationGovernorate })}
                          className={inpSel}>
                          <option value="">اختر...</option>
                          {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                        </select>
                      </Field>
                      <Field label="المدينة">
                        <select value={form.originCity} onChange={e => update({ originCity: e.target.value })} className={inpSel} disabled={!form.originGovernorate}>
                          <option value="">اختر المدينة</option>
                          {getCities(form.originGovernorate).map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="__manual__">مدينة أخرى...</option>
                        </select>
                        {form.originCity === '__manual__' && (
                          <input value={form.originCity === '__manual__' ? '' : form.originCity}
                            onChange={e => update({ originCity: e.target.value })} className={inp} placeholder="اكتب اسم المدينة" />
                        )}
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="المحافظة *">
                        <select value={form.destinationGovernorate} onChange={e => update({ destinationGovernorate: e.target.value })}
                          className={inpSel} disabled={form.sameGovernorate}>
                          <option value="">اختر...</option>
                          {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                        </select>
                      </Field>
                      <Field label="المدينة">
                        <select value={form.destinationCity} onChange={e => update({ destinationCity: e.target.value })} className={inpSel} disabled={!form.destinationGovernorate || form.sameGovernorate}>
                          <option value="">اختر المدينة</option>
                          {getCities(form.destinationGovernorate).map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="__manual__">مدينة أخرى...</option>
                        </select>
                        {form.destinationCity === '__manual__' && (
                          <input value={form.destinationCity === '__manual__' ? '' : form.destinationCity}
                            onChange={e => update({ destinationCity: e.target.value })} className={inp} placeholder="اكتب اسم المدينة" />
                        )}
                      </Field>
                    </div>
                  </>
                )}

                {!form.sameGovernorate && !form.international && (form.pickupAddress || form.deliveryAddress) && (
                  <Field label="عنوان التحميل / التسليم التفصيلي">
                    <input value={form.pickupAddress} onChange={e => update({ pickupAddress: e.target.value })} className={inp} placeholder="شارع، منطقة، حي..." />
                  </Field>
                )}
                {!form.sameGovernorate && !form.international && (
                  <Field label="عنوان التسليم التفصيلي">
                    <input value={form.deliveryAddress} onChange={e => update({ deliveryAddress: e.target.value })} className={inp} placeholder="شارع، منطقة، حي..." />
                  </Field>
                )}

                {popularRouteHint && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> {popularRouteHint}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 — تفاصيل الحمولة */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-bold text-text">2. تفاصيل الحمولة</h2>
                <Field label="نوع الحمولة *">
                  <select value={form.cargoType} onChange={e => update({ cargoType: e.target.value, cargoTypeOther: e.target.value === 'أخرى' ? '' : form.cargoTypeOther })}
                    className={inpSel}>
                    <option value="">اختر...</option>
                    {CARGO_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                {form.cargoType === 'أخرى' && (
                  <Field label="حدد نوع الحمولة">
                    <input value={form.cargoTypeOther} onChange={e => update({ cargoTypeOther: e.target.value })} className={inp} placeholder="حدد نوع الحمولة" />
                  </Field>
                )}
                <Field label="نوع التغليف">
                  <select value={form.packagingType} onChange={e => update({ packagingType: e.target.value === '__other__' ? '__manual__' : e.target.value })} className={inpSel}>
                    <option value="">بدون</option>
                    {PACKAGING_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="__other__">أخرى</option>
                  </select>
                </Field>
                {form.packagingType === '__manual__' && (
                  <input value={form.packagingType === '__manual__' ? '' : form.packagingType}
                    onChange={e => update({ packagingType: e.target.value })} className={inp} placeholder="حدد نوع التغليف" />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Field label="الوزن (طن) *">
                    <input type="number" min="0" step="0.01" value={form.weight}
                      onChange={e => update({ weight: e.target.value })} className={inp} placeholder="مثال: 20" />
                  </Field>
                  <Field label="عدد القطع / الطرود">
                    <input type="number" min="0" value={form.pieceCount} onChange={e => update({ pieceCount: e.target.value })} className={inp} placeholder="مثال: 50" />
                  </Field>
                </div>
                <Field label="الحجم (إن وجد)">
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" min="0" value={form.volume} onChange={e => update({ volume: e.target.value })} className={inp} placeholder="طول" />
                    <input type="number" min="0" className={inp} placeholder="عرض" />
                    <input type="number" min="0" className={inp} placeholder="ارتفاع" />
                  </div>
                  <p className="text-[10px] text-text-light mt-1">متر مكعب — اتركه فارغاً إذا غير متوفر</p>
                </Field>
              </div>
            )}

            {/* STEP 3 — السيارة المطلوبة */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="font-bold text-text">3. السيارة المطلوبة</h2>
                <Field label="نوع العربية المطلوبة *">
                  <select value={form.vehicleType === '' ? 'any' : form.vehicleType} onChange={e => update({ vehicleType: e.target.value })}
                    className={inpSel}>
                    <option value="any">أي عربية</option>
                    {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="مواصفات ومتطلبات إضافية">
                  <input value={form.vehicleSpecs} onChange={e => update({ vehicleSpecs: e.target.value })}
                    className={inp} placeholder="مثال: شاحنة 40 طن، مقطورة مغلقة، ..." />
                </Field>
                {form.vehicleType === 'any' && (
                  <div className="text-xs text-text-light">أي عربية مناسبة للحملة تُقبل.</div>
                )}
              </div>
            )}

            {/* STEP 4 — الرحلة والأجرة */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="font-bold text-text">4. الرحلة والأجرة</h2>
                <Field label="نوع الرحلة">
                  {TRIP_TYPES.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 p-2.5 border border-border rounded-xl cursor-pointer has-[:checked]:border-orange has-[:checked]:bg-orange/5">
                      <input type="radio" name="tripType" value={opt.value} checked={form.tripType === opt.value}
                        onChange={e => update({ tripType: e.target.value })} className="w-5 h-5 text-orange focus:ring-orange" />
                      <span className="text-sm font-semibold">{opt.label}</span>
                    </label>
                  ))}
                </Field>

                {form.tripType === 'contract' && (
                  <>
                    <Field label="عدد الرحلات المتوقع"><input type="number" min="1" value={form.contractTrips} onChange={e => update({ contractTrips: e.target.value })} className={inp} placeholder="مثال: 30" /></Field>
                    <Field label="طبيعة التعاقد"><input value={form.contractNature} onChange={e => update({ contractNature: e.target.value })} className={inp} placeholder="مثال: يومياً / أسبوعياً / شهرياً" /></Field>
                    <Field label="ملاحظات التعاقد"><textarea rows={2} value={form.contractNotes} onChange={e => update({ contractNotes: e.target.value })} className={`${inp} resize-none`} placeholder="أي تفاصيل إضافية عن التعاقد..." /></Field>
                  </>
                )}

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-border">
                  <RefreshCw className="w-4 h-4 text-text-light" />
                  <input type="checkbox" id="returnLoad" checked={form.isReturnLoad} onChange={e => update({ isReturnLoad: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
                  <label htmlFor="returnLoad" className="text-sm font-bold text-text cursor-pointer">هذه حمولة رجعة (السائق فاضي وراجع في هذا الاتجاه)</label>
                </div>

                <Field label="الأجرة (جنيه)">
                  <div className="grid grid-cols-5 gap-2">
                    <input type="text" inputMode="numeric" min="0" dir="ltr" value={form.price ? form.price.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""} onChange={e => update({ price: e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^\d]/g, "") })} className="col-span-3 text-right" style={{ height: '42px' }} placeholder="مثال: 8,000" />
                    <select value={form.priceType} onChange={e => update({ priceType: e.target.value, price: e.target.value === 'negotiable' ? '' : form.price })}
                      className="col-span-2" style={{ height: '42px' }} />
                    <option value="per_trip">للرحلة</option>
                    <option value="per_ton">للطن</option>
                    <option value="negotiable">بالاتفاق</option>
                  </div>
                </Field>
                {form.priceType !== 'negotiable' && form.price && (
                  <p className="text-xs text-success font-semibold">✓ الأجرة ثابتة — يمكنك التفاوض على السعر مع السائق</p>
                )}
                {form.priceType === 'negotiable' && (
                  <p className="text-xs text-text-light">تم اختيار "بالاتفاق" — لن تظهر سعرًا ثابتًا، يتفاوض صاحب الحملة مع السائق.</p>
                )}

                <Field label="شروط الدفع">
                  <select value={form.paymentTerms} onChange={e => update({ paymentTerms: e.target.value === '__other__' ? '__manual__' : e.target.value, paymentTermsOther: '' })}
                    className={inpSel}>
                    <option value="">اختر...</option>
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="__other__">أخرى</option>
                  </select>
                </Field>
                {form.paymentTerms === '__manual__' && (
                  <Field label="حدد شروط الدفع"><input value={form.paymentTermsOther} onChange={e => update({ paymentTermsOther: e.target.value, paymentTerms: e.target.value })} className={inp} placeholder="حدد شروط الدفع" /></Field>
                )}
              </div>
            )}

            {/* STEP 5 — التواصل */}
            {step === 5 && (
              <div className="space-y-4">
                <h2 className="font-bold text-text">5. التواصل</h2>
                <Field label="رقم هاتف التواصل">
                  <input type="tel" value={form.contactPhone} onChange={e => update({ contactPhone: e.target.value })}
                    className={inp} placeholder={user.phone || '01000000000'} dir="ltr" />
                  {!form.contactPhone && user.phone && (
                    <p className="text-[10px] text-text-light mt-1">سيتم استخدام رقم حسابك تلقائياً: {user.phone}</p>
                  )}
                </Field>
                <Field label="رقم هاتف بديل (اختياري)">
                  <input type="tel" value={form.secondaryPhone} onChange={e => update({ secondaryPhone: e.target.value })} className={inp} placeholder="01000000000" dir="ltr" />
                </Field>
                <div className="flex items-center gap-3 p-3 bg-bg rounded-xl border border-border">
                  <input type="checkbox" id="showPhone" checked={form.showPhone} onChange={e => update({ showPhone: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
                  <label htmlFor="showPhone" className="text-sm font-bold text-text cursor-pointer">إظهار رقم الهاتف للسائقين</label>
                </div>
                <div className="flex items-center gap-3 p-3 bg-bg rounded-xl border border-border">
                  <input type="checkbox" id="allowWhatsApp" checked={form.allowWhatsApp} onChange={e => update({ allowWhatsApp: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
                  <label htmlFor="allowWhatsApp" className="text-sm font-bold text-text cursor-pointer">السماح بالتواصل عبر واتساب</label>
                </div>
              </div>
            )}

            {/* STEP 6 — مراجعة ونشر */}
            {step === 6 && (
              <div className="space-y-5">
                <h2 className="font-bold text-text">6. مراجعة ونشر</h2>

                <Field label="وصف الحمولة (اختياري)">
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={generateLoadDescription} disabled={aiLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-orange/50 bg-orange/5 text-orange text-sm font-bold hover:bg-orange/10 transition-all disabled:opacity-60">
                      {aiLoading ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span className="animate-pulse">جاري التوليد...</span></span>
                      ) : (
                        <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" />توليد وصف بالذكاء الاصطناعي</span>
                      )}
                    </button>
                  </div>
                  <textarea rows={4} value={form.description} onChange={e => update({ description: e.target.value })}
                    className={`${inp} resize-none`} placeholder="وصف تفصيلي للحمولة (الذكاء الاصطناعي يملأه تلقائياً)" />
                </Field>

                <div className="bg-surface rounded-2xl border border-border p-5 space-y-3 text-sm">
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-orange" /><b>المسار:</b> <span>{originText || '—'} → {destinationText || '—'}</span></div>
                  {form.international && <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-text-light" /><span>نقل دولي</span></div>}
                  <div className="flex items-center gap-2"><Package className="w-4 h-4 text-text-light" /><b>نوع الحمولة:</b> <span>{form.cargoType === 'أخرى' ? form.cargoTypeOther : form.cargoType || '—'}</span></div>
                  {form.packagingType && form.packagingType !== '__manual__' && <div className="flex items-center gap-2"><Package className="w-4 h-4 text-text-light" /><b>التغليف:</b> <span>{form.packagingType}</span></div>}
                  <div className="flex items-center gap-2"><Weight className="w-4 h-4 text-text-light" /><b>الوزن:</b> <span>{form.weight || '—'} طن</span></div>
                  {form.pieceCount && <div className="flex items-center gap-2"><Package className="w-4 h-4 text-text-light" /><b>عدد القطع:</b> <span>{form.pieceCount}</span></div>}
                  <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-text-light" /><b>العربية:</b> <span>{form.vehicleType === 'any' ? 'أي عربية' : form.vehicleType || '—'}</span></div>
                  {form.vehicleSpecs && <div className="flex items-center gap-2"><Info className="w-4 h-4 text-text-light" /><b>المواصفات:</b> <span>{form.vehicleSpecs}</span></div>}
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-text-light" /><b>نوع الرحلة:</b> <span>{TRIP_TYPES.find(t => t.value === form.tripType)?.label || '—'}</span></div>
                  {form.tripType === 'contract' && <>
                    <div className="flex items-center gap-2"><Package className="w-4 h-4 text-text-light" /><b>عدد الرحلات:</b> <span>{form.contractTrips || '—'}</span></div>
                    <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-text-light" /><b>طبيعة التعاقد:</b> <span>{form.contractNature || '—'}</span></div>
                  </>}
                  <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-text-light" /><b>الأجرة:</b> <span>{priceDisplay}</span></div>
                  <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-text-light" /><b>شروط الدفع:</b> <span>{form.paymentTerms === '__manual__' ? form.paymentTermsOther : form.paymentTerms || '—'}</span></div>
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-text-light" /><b>تاريخ الشحن:</b> <span>{form.shipDate ? formatDateDMY(form.shipDate) : '—'}</span></div>
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-text-light" /><b>وقت التحميل:</b> <span>{form.shipTime || '—'}{form.timeFlexible && ' (مرن)'}</span></div>
                  {form.isReturnLoad && <div className="flex items-center gap-2 bg-amber-50 px-2 py-1 rounded-lg"><RefreshCw className="w-4 h-4 text-amber-600" /><b>حمولة رجعة</b></div>}
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-text-light" /><b>التواصل:</b> <span>{form.contactPhone || user.phone || '—'}</span></div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setStep(5)}
                    className="text-orange font-semibold hover:underline flex items-center gap-1">
                    <Edit3 className="w-4 h-4" /> تعديل البيانات
                  </button>
                  <div className="text-text-light">حمولة مجانية — لا أي رسوم</div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <button type="button" onClick={() => setStep(s => (s > 1 ? (s - 1) as Step : s))}
                disabled={step === 1}
                className="px-4 py-2 text-sm text-text-light hover:text-text disabled:opacity-40">
                السابق
              </button>
              {step < 6 ? (
                <button type="submit"
                  className="bg-orange hover:bg-orange-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2">
                  {step === 1 ? 'التالي' : 'استمرار'}
                </button>
              ) : (
                <button type="submit" disabled={publishing}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-60">
                  {publishing ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ النشر...</> : <><Send className="w-4 h-4" /> نشر الحمولة مجاناً</>}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="block text-sm font-semibold text-text">{label}</label>
    {children}
  </div>
);

const inp = "w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-bg focus:outline-none focus:border-orange";
const inpSel = "w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-orange appearance-none";
