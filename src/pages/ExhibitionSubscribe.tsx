import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {   Building2, Loader2, ChevronLeft, CheckCircle, DollarSign, Crown, Shield, Lock, Save, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { firebaseAuth } from '../firebase';
import { getApiUrl } from '../lib/config';
import api from '../lib/api';
import { exhibitionsService, notificationsService } from '../lib/firestoreService';
import { EXHIBITION_PLANS } from '../lib/plans';
import ImageUploader from '../components/ImageUploader';
import { governorates } from '../lib/data';

const PLANS = EXHIBITION_PLANS;

const PLAN_CTA: Record<string, string> = Object.fromEntries(PLANS.map(p => [p.id, p.cta]));

const COMPARE_ROWS = [
  { label: 'السعر', values: ['مجاني', '200 ج', '400 ج', '600 ج'] },
  { label: 'عدد المنتجات', values: ['5', '20', '50', '100'] },
  { label: 'صورة الغلاف', values: ['—', '—', '✓', '✓ مميزة'] },
  { label: 'شعار المعرض', values: ['—', '✓', '✓', '✓'] },
  { label: 'روابط التواصل الاجتماعي', values: ['—', '—', '✓', '✓'] },
  { label: 'التمييز في صفحة المعارض', values: ['—', 'بسيط', 'واضح', 'قوي'] },
  { label: 'أولوية ترتيب المعارض', values: ['—', '—', 'أفضل', 'الأولى'] },
  { label: 'الظهور أعلى صفحة المعارض', values: ['—', '—', '—', '✓'] },
  { label: 'أولوية نتائج البحث', values: ['—', '—', '—', '✓'] },
  { label: 'أزرار الاتصال وواتساب', values: ['عادية', 'عادية', 'واضحة', 'بارزة'] },
  { label: 'شارة VIP', values: ['—', '—', '—', '✓'] },
];

export default function ExhibitionSubscribe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = !!editId;
  const [plan, setPlan] = useState<string>('free');
  const [form, setForm] = useState({
    name: '', description: '', contactPhone: '', whatsapp: '',
    governorate: '', city: '', logo: '', coverImage: '',
    facebook: '', instagram: '', website: '', workingHours: '', googleMapsUrl: '',
    category: 'general' as 'general' | 'import',
  });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(isEditMode);

  const formRef = useRef<HTMLFormElement>(null);
  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!editId || !user) return;
    setLoadingEdit(true);
    exhibitionsService.getById(editId)
      .then(ex => {
        if (!ex || ex.userId !== user.id) {
          navigate('/exhibitions');
          return;
        }
        setPlan(ex.plan || 'free');
        setForm({
          name: ex.name || '',
          description: ex.description || '',
          contactPhone: ex.contactPhone || '',
          whatsapp: ex.whatsapp || '',
          governorate: ex.governorate || '',
          city: ex.city || '',
          logo: ex.logo || '',
          coverImage: ex.coverImage || '',
          facebook: ex.facebook || '',
          instagram: ex.instagram || '',
          website: ex.website || '',
          workingHours: ex.workingHours || '',
          googleMapsUrl: ex.googleMapsUrl || '',
          category: ex.category || 'general',
        });
      })
      .catch(() => navigate('/exhibitions'))
      .finally(() => setLoadingEdit(false));
  }, [editId, user, navigate]);

  if (!user) {
    navigate('/login');
    return null;
  }

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange" />
      </div>
    );
  }

  const selectedPlan = PLANS.find(p => p.id === plan) || PLANS[0];
  const isFree = plan === 'free';
  const allowsLogo = selectedPlan.allowsLogo ?? false;
  const allowsCover = selectedPlan.allowsCover;
  const allowsSocial = selectedPlan.allowsSocial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.contactPhone || !form.governorate) return;

    setProcessing(true);
    setResult(null);
    try {
      if (isEditMode && editId) {
        await exhibitionsService.update(editId, {
          ...form,
          plan: plan as any,
        });
        setResult({ success: true, message: 'تم تحديث معرضك بنجاح!' });
      } else if (isFree) {
        const created = await exhibitionsService.create({
          ...form,
          plan: 'free',
          userId: user.id,
          status: 'active',
        });
        notificationsService.notifyAdminNewExhibition({ id: created.id, name: created.name || form.name, userName: user.name || '' }).catch(() => {});
        notificationsService.notifyExhibitionCreated(user.id, created.name || form.name).catch(() => {});
        api.post('/push', { action: 'exhibitionCreated', exhibitionId: created.id }).catch(() => {});
        setResult({ success: true, message: isEditMode ? 'تم تحديث معرضك بنجاح!' : 'تم إنشاء معرضك بنجاح!' });
      } else {
        const token = await firebaseAuth.currentUser?.getIdToken();
        if (!token) throw new Error('يجب تسجيل الدخول');

        const resp = await fetch(`${getApiUrl()}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            action: 'create',
            type: 'exhibition',
            amount: selectedPlan.price,
            metadata: { ...form, plan },
          }),
        });

        const data = await resp.json();
        if (!data.success) throw new Error(data.message);

        setResult({ success: true, message: data.message || 'تم تقديم طلب الاشتراك في المعرض' });
      }
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'حدث خطأ' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-gradient-to-l from-navy to-navy-light text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <Link to="/exhibitions" className="hover:text-orange">المعارض</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">{isEditMode ? 'تعديل المعرض' : isFree ? 'معرض جديد' : 'اشتراك في معرض'}</span>
          </nav>
          <h1 className="text-2xl font-bold">{isEditMode ? 'تعديل المعرض' : isFree ? 'إنشاء معرض مجاني' : 'اشتراك في معرض'}</h1>
          <p className="text-gray-300 text-sm mt-1">{isEditMode ? 'حدّث بيانات معرضك' : 'اعرض منتجاتك في معرض خاص ووصل لآلاف العملاء'}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {result?.success ? (
          <div className="bg-success/10 border border-success/20 rounded-2xl p-8 text-center">
            <CheckCircle className="w-14 h-14 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">تم بنجاح!</h2>
            <p className="text-text-light text-sm mb-6">{result.message}</p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/exhibitions"
                className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">
                العودة للمعارض
              </Link>
            </div>
          </div>
        ) : (
          <form id="subscribe-form" ref={formRef} onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {PLANS.map(p => {
                const isVip = p.id === 'vip';
                const isPremium = p.id === 'premium';
                const selected = plan === p.id;
                const Icon = p.icon;
                const products = p.maxProducts;
                const cta = PLAN_CTA[p.id];
                return (
                  <div key={p.id}
                    onClick={() => setPlan(p.id)}
                    className={`relative rounded-2xl border-2 p-5 text-right transition-all cursor-pointer flex flex-col ${
                      isVip
                        ? `bg-gradient-to-br from-navy to-navy-light text-white ${
                            selected
                              ? 'border-amber-400 ring-2 ring-amber-400/40 scale-[1.03]'
                              : 'border-amber-300/60 hover:border-amber-300 shadow-lg shadow-amber-400/10'
                          }`
                        : isPremium
                          ? `bg-white border-orange ${selected ? 'ring-2 ring-orange/40 scale-[1.02]' : 'hover:border-orange/50 shadow-md shadow-orange/10'} ${selected ? 'border-orange' : 'border-orange/30'}`
                          : selected
                            ? 'border-orange shadow-lg shadow-orange/10 scale-[1.02]'
                            : p.color + ' hover:border-gray-300'
                    }`}>
                    {p.badge && (
                      <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap ${
                        isVip ? 'bg-amber-400 text-navy' : 'bg-orange text-white'
                      }`}>
                        {p.badge}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isVip ? 'bg-amber-400 text-navy'
                          : isPremium ? 'bg-orange/10 text-orange'
                          : selected ? 'bg-orange text-white'
                          : p.id === 'free' ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <p className={`font-bold text-sm ${isVip || isPremium ? 'text-white' : 'text-text'}`}>{p.name}</p>
                        {isVip && <Crown className="w-4 h-4 text-amber-400" />}
                        {isPremium && <Star className="w-4 h-4 text-orange" />}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className={`font-black text-2xl ${
                        isVip ? 'text-amber-300' : isPremium ? 'text-orange' : p.textColor
                      }`}>
                        {p.price === 0 ? 'مجاني' : `${p.price} ج`}
                      </p>
                      <p className="text-xs text-text-light/70 mt-0.5">دفعة واحدة — لا مدة</p>
                    </div>

                    <div className="bg-black/5 rounded-xl p-3 mb-3 text-center flex-shrink-0">
                      <p className="text-2xl font-black text-text">{products === Infinity ? '∞' : products}</p>
                      <p className="text-[11px] text-text-light">منتج</p>
                    </div>

                    <ul className="space-y-1.5 text-xs mt-auto mb-4">
                      {p.features.slice(0, 5).map((f, i) => (
                        <li key={i} className={`flex items-center gap-1.5 ${isVip ? 'text-gray-200' : 'text-text-light'}`}>
                          <CheckCircle className={`w-3 h-3 flex-shrink-0 ${isVip ? 'text-amber-300' : 'text-success'}`} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setPlan(p.id); scrollToForm(); }}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
                        isVip
                          ? 'bg-amber-400 hover:bg-amber-300 text-navy'
                          : isPremium
                            ? 'bg-orange hover:bg-orange-dark text-white'
                            : p.id === 'free'
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}>
                      {cta}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="bg-surface rounded-2xl border border-border p-4 mb-6 overflow-x-auto">
              <h3 className="font-bold text-text text-sm mb-3">مقارنة الباقات</h3>
              <table className="w-full text-center">
                <thead>
                  <tr>
                    <th className="text-[10px] font-bold text-text-light uppercase pb-2 text-right">الميزة</th>
                    {PLANS.map(p => (
                      <th key={p.id} className={`text-[10px] font-bold uppercase pb-2 ${
                        p.id === 'vip' ? 'text-amber-300' : p.id === 'premium' ? 'text-orange' : 'text-text-light'
                      }`}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map(row => (
                    <tr key={row.label} className="border-t border-border/50">
                      <td className="text-[11px] text-text-light py-2 text-right">{row.label}</td>
                      {row.values.map((val, i) => {
                        const plan = PLANS[i];
                        const isOk = val === '✓' || val === '✓ مميزة' || val.startsWith('✓');
                        const isDash = val === '—';
                        return (
                          <td key={i} className={`text-[11px] py-2 font-semibold ${
                            plan.id === 'vip' ? 'text-amber-300' : plan.id === 'premium' ? 'text-orange' : 'text-text-light'
                          }`}>
                            {isDash ? <span className="text-gray-300">—</span> : isOk ? <CheckCircle className={`w-3 h-3 mx-auto text-green-500 ${plan.id === 'vip' ? '' : ''}`} /> : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 mt-4">
              <h2 className="font-bold text-text mb-2">بيانات المعرض</h2>
              <div>
                <label className="block text-sm font-semibold text-text mb-1">نوع المعرض</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: 'general', label: 'معرض عام', desc: 'معرض تجاري عادي' },
                    { id: 'import', label: 'معارض الاستيراد', desc: 'بضائع ومستلزمات الاستيراد' },
                  ] as const).map(opt => (
                    <button key={opt.id} type="button" onClick={() => setForm(f => ({ ...f, category: opt.id }))}
                      className={`rounded-xl border-2 px-4 py-3 text-right transition-all ${
                        form.category === opt.id
                          ? 'border-orange bg-orange/5 shadow-sm'
                          : 'border-border bg-white hover:border-gray-300'
                      }`}>
                      <p className={`font-bold text-sm ${form.category === opt.id ? 'text-orange' : 'text-text'}`}>{opt.label}</p>
                      <p className="text-[11px] text-text-light mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">اسم المعرض *</label>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="اسم معرضك التجاري" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">المحافظة *</label>
                  <select value={form.governorate} onChange={e => setForm(f => ({...f, governorate: e.target.value}))} required
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange bg-white">
                    <option value="">اختر المحافظة</option>
                    {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">المدينة</label>
                  <input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="المدينة" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">رقم التواصل *</label>
                  <input value={form.contactPhone} onChange={e => setForm(f => ({...f, contactPhone: e.target.value}))} required
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="01000000000" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">واتساب</label>
                  <input value={form.whatsapp} onChange={e => setForm(f => ({...f, whatsapp: e.target.value}))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="رقم الواتساب" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">ساعات العمل</label>
                  <input value={form.workingHours} onChange={e => setForm(f => ({...f, workingHours: e.target.value}))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="مثل: 9ص - 9م" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">لوجو المعرض</label>
                  {allowsLogo ? (
                    <ImageUploader
                      images={form.logo ? [form.logo] : []}
                      onChange={urls => setForm(f => ({...f, logo: urls[0] || ''}))}
                      max={1}
                      folder="exhibitions/logos"
                    />
                  ) : (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 flex items-center gap-2 text-xs text-text-light">
                      <Lock className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span>الشعار متاح في باقة أساسي وما فوق. <span className="text-orange font-semibold">رقِّ باقتك لإضافته.</span></span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">صور غلاف</label>
                  {allowsCover ? (
                    <ImageUploader
                      images={form.coverImage ? [form.coverImage] : []}
                      onChange={urls => setForm(f => ({...f, coverImage: urls[0] || ''}))}
                      max={3}
                      folder="exhibitions/covers"
                    />
                  ) : (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 flex items-center gap-2 text-xs text-text-light">
                      <Lock className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      <span>صورة الغلاف متاحة في باقة متقدم وVIP. <span className="text-orange font-semibold">رقِّ باقتك لإضافتها.</span></span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text mb-1">وصف المعرض</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="اكتب وصفاً لمعرضك" />
              </div>
            </div>

            {allowsSocial ? (
              <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 mt-4">
                <h2 className="font-bold text-text mb-2">روابط إضافية (اختياري)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text mb-1">فيسبوك</label>
                    <input value={form.facebook} onChange={e => setForm(f => ({...f, facebook: e.target.value}))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="https://facebook.com/..." dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text mb-1">انستجرام</label>
                    <input value={form.instagram} onChange={e => setForm(f => ({...f, instagram: e.target.value}))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="https://instagram.com/..." dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text mb-1">موقع إلكتروني</label>
                    <input value={form.website} onChange={e => setForm(f => ({...f, website: e.target.value}))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="https://..." dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text mb-1">الموقع على الخريطة</label>
                    <input value={form.googleMapsUrl} onChange={e => setForm(f => ({...f, googleMapsUrl: e.target.value}))}
                      className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange" placeholder="https://maps.google.com/..." dir="ltr" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-2xl border border-border p-6 mt-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <h2 className="font-bold text-text text-sm">روابط التواصل الاجتماعي</h2>
                  <p className="text-xs text-text-light">إضافة فيسبوك وانستجرام وموقع إلكتروني متاحة في باقة متقدم وVIP. <span className="text-orange font-semibold">رقِّ باقتك لإظهارها.</span></p>
                </div>
              </div>
            )}

            {isFree ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-6 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">
                  المعرض المجاني نشط فوراً. يمكنك الترقية لأي باقة مدفوعة لاحقاً للحصول على مميزات إضافية.
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mt-6 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  سيتم مراجعة طلبك وتفعيل المعرض بعد تأكيد الدفع. يمكنك متابعة حالة الطلب من خلال الإشعارات.
                </p>
              </div>
            )}

            <button type="submit" disabled={processing || !form.name || !form.contactPhone || !form.governorate}
              className="w-full bg-orange hover:bg-orange-dark text-white py-3.5 rounded-2xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-6">
              {processing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> جاري...</>
              ) : isEditMode ? (
                <><Save className="w-5 h-5" /> حفظ التعديلات</>
              ) : isFree ? (
                <><Building2 className="w-5 h-5" /> إنشاء المعرض مجاناً</>
              ) : (
                <><DollarSign className="w-5 h-5" /> اشتراك {selectedPlan.price} جنيه</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
