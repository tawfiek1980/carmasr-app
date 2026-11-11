import { useEffect, useState } from 'react';
import { CheckCircle, Landmark, Truck, Calculator, Loader2, DollarSign, Star, Phone, MessageCircle } from 'lucide-react';
import { financeService, notificationsService, financeCompaniesService } from '../lib/firestoreService';
import { governorates } from '../lib/data';
import { useAuth } from '../contexts/AuthContext';
import { getPhoneLink, getWhatsAppLink } from '../lib/utils';
import ProtectedPhoneButton from '../components/ProtectedPhoneButton';
import type { FinanceCompany } from '../types';

const vehicleTypes = [
  'شاحنة السيارات الملاكي','رأس جرارة','نصف مقطورة','تانكر','شاحنة برادة',
  'قلابة','حفار','لودر','كرينة','بلدوزر','رافعة شوكية','سيارات أخرى',
];

const inp = "w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-bg focus:outline-none focus:border-orange";
const latinDigits = (v: string) => v.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^\d]/g, "");
const formatPrice = (v: string) => latinDigits(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function Finance() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<FinanceCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '',
    governorate: '', vehicleType: '',
    vehiclePrice: '', downPayment: '', monthlyIncome: '',
    additionalNotes: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    financeCompaniesService.getAll()
      .then(setCompanies)
      .catch(() => {})
      .finally(() => setLoadingCompanies(false));
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const estimated = () => {
    const price = Number(form.vehiclePrice) || 0;
    const down  = Number(form.downPayment) || 0;
    const net   = price - down;
    return net > 0 ? Math.round((net * 1.12) / 48).toLocaleString('ar-EG') : '—';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.phone || !form.vehicleType || !form.vehiclePrice) {
      setError('يرجى ملء جميع الحقول الإلزامية'); return;
    }
    setLoading(true);
    try {
      const req = await financeService.create({
        name:          form.name,
        phone:         form.phone,
        governorate:   form.governorate,
        vehicleType:   form.vehicleType,
        vehiclePrice:  Number(form.vehiclePrice),
        downPayment:   Number(form.downPayment) || 0,
        monthlyIncome: Number(form.monthlyIncome) || 0,
        ...(user ? { userId: user.id, userEmail: user.email } : {}),
      } as any);
      setSubmitted(true);
      notificationsService.notifyAdminNewFinanceRequest({ id: req.id, name: form.name });
    } catch {
      setError('حدث خطأ أثناء الإرسال، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const applyToCompany = (name: string) => {
    document.getElementById('finance-form')?.scrollIntoView({ behavior: 'smooth' });
    setForm(f => ({ ...f, additionalNotes: `أود التقديم على تمويل عبر ${name}` }));
  };

  if (submitted) return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-10 h-10 text-success" />
      </div>
      <h2 className="text-2xl font-bold text-text mb-2">تم إرسال طلبك!</h2>
      <p className="text-text-light mb-2 max-w-sm">سيتواصل معك أحد مستشاري التمويل خلال 24 ساعة على رقم هاتفك.</p>
      <p className="text-text-light text-sm mb-8 max-w-sm">رقمك المسجّل: <strong className="text-text">{form.phone}</strong></p>
      <button onClick={() => setSubmitted(false)} className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors">
        طلب آخر
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-gradient-to-l from-navy to-navy-light text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-orange/20 flex items-center justify-center">
              <Landmark className="w-7 h-7 text-orange" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">طلب تمويل مركبة</h1>
              <p className="text-gray-300 text-sm">احصل على موافقة مبدئية خلال 48 ساعة</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['تمويل حتى','80%','من قيمة المركبة'],['مدة السداد','حتى 60','شهراً'],['الموافقة','خلال','48 ساعة']].map(([a,b,c])=>(
              <div key={b} className="bg-white/10 rounded-2xl p-3 text-center backdrop-blur-sm">
                <div className="text-xs text-gray-300 mb-0.5">{a}</div>
                <div className="text-xl font-black text-orange">{b}</div>
                <div className="text-xs text-gray-300">{c}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-5 relative z-10 space-y-4 pb-8">
        {loadingCompanies ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange" />
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500 text-sm">
            لا توجد شركات تمويل متاحة حالياً
          </div>
        ) : (
          companies.filter(c => c.isActive !== false).map(c => (
            <div key={c.id} className={`bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow ${c.isFree ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center text-orange font-bold text-lg flex-shrink-0">
                      {c.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{c.name}</h3>
                        {c.isFree && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">مجاني</span>}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({length: 5}).map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < c.stars ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{c.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                    <span>نسبة: <strong className="text-gray-900">{c.rate}</strong></span>
                    <span>المدة: <strong className="text-gray-900">{c.maxPeriod}</strong></span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="flex gap-1">
                    <ProtectedPhoneButton phone={c.phone}>
                      <a href={getPhoneLink(c.phone)} className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"><Phone className="w-4 h-4" /></a>
                    </ProtectedPhoneButton>
                    <ProtectedPhoneButton phone={c.whatsapp}>
                      <a href={getWhatsAppLink(c.whatsapp)} className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"><MessageCircle className="w-4 h-4" /></a>
                    </ProtectedPhoneButton>
                  </div>
                  <button onClick={() => applyToCompany(c.name)}
                    className="bg-orange hover:bg-orange-dark text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap">
                    قدم على التمويل
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {error && <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-3 text-sm">{error}</div>}

        <form id="finance-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1 h-5 bg-orange rounded-full inline-block" />
              البيانات الشخصية
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="الاسم الكامل *">
                <input required value={form.name} onChange={e=>set('name',e.target.value)} className={inp} placeholder="الاسم الكامل" />
              </Field>
              <Field label="رقم الهاتف *">
                <input required type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} className={inp} placeholder="01XXXXXXXXX" />
              </Field>
            </div>
            <Field label="المحافظة">
              <select value={form.governorate} onChange={e=>set('governorate',e.target.value)} className={inp}>
                <option value="">اختر المحافظة</option>
                {governorates.map(g=><option key={g.id} value={g.name}>{g.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1 h-5 bg-orange rounded-full inline-block" />
              تفاصيل المركبة
            </h3>
            <Field label="نوع المركبة *">
              <select required value={form.vehicleType} onChange={e=>set('vehicleType',e.target.value)} className={inp}>
                <option value="">اختر نوع المركبة</option>
                {vehicleTypes.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="سعر المركبة (جنيه) *">
                <input required type="text" inputMode="numeric" dir="ltr" value={form.vehiclePrice ? formatPrice(form.vehiclePrice) : ""} onChange={e=>set('vehiclePrice',latinDigits(e.target.value))} className={`${inp} text-right`} placeholder="1,500,000" />
              </Field>
              <Field label="الدفعة المقدمة (جنيه)">
                <input type="text" inputMode="numeric" dir="ltr" value={form.downPayment ? formatPrice(form.downPayment) : ""} onChange={e=>set('downPayment',latinDigits(e.target.value))} className={`${inp} text-right`} placeholder="300,000" />
              </Field>
            </div>
            <Field label="الدخل الشهري التقريبي (جنيه)">
              <input type="text" inputMode="numeric" dir="ltr" value={form.monthlyIncome ? formatPrice(form.monthlyIncome) : ""} onChange={e=>set('monthlyIncome',latinDigits(e.target.value))} className={`${inp} text-right`} placeholder="20,000" />
            </Field>
          </div>

          {Number(form.vehiclePrice) > 0 && (
            <div className="bg-orange/5 border border-orange/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-5 h-5 text-orange" />
                <h3 className="font-bold text-gray-900 text-sm">تقدير تقريبي للقسط الشهري</h3>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-orange">{estimated()}</span>
                <span className="text-text-light text-sm mb-1">جنيه / شهر</span>
              </div>
              <p className="text-text-light text-xs mt-2">* تقدير غير ملزم. القسط الفعلي يحدده الممول بعد الدراسة.</p>
            </div>
          )}

          <Field label="ملاحظات إضافية (اختياري)">
            <textarea rows={3} value={form.additionalNotes} onChange={e=>set('additionalNotes',e.target.value)}
              className={`${inp} resize-none`} placeholder="أي معلومات إضافية تريد إضافتها..." />
          </Field>

          <button type="submit" disabled={loading}
            className="w-full h-12 bg-orange hover:bg-orange-dark disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" />جاري الإرسال...</> : <><DollarSign className="w-5 h-5" />إرسال طلب التمويل</>}
          </button>

          <p className="text-center text-text-light text-xs">
            بإرسال الطلب، أنت توافق على مشاركة بياناتك مع شركاء التمويل المعتمدين.
          </p>
        </form>
      </div>
    </div>
  );
}
