import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, CheckCircle, Loader2, ShieldAlert, Save } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { loadsService } from "../lib/firestoreService";
import { priceInputError, listingPriceValue } from "../lib/utils";
import { cargoTypes, loadVehicleTypes } from "../lib/data";
import type { Load } from "../types";

const inp = "w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-bg focus:outline-none focus:border-orange";
const sel = "w-full appearance-none border border-border rounded-xl pr-4 pl-10 py-2.5 text-sm bg-bg focus:outline-none focus:border-orange cursor-pointer";

const latinDigits = (v: string) => v
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
  .replace(/[^\d]/g, "");
const formatPrice = (v: string) => latinDigits(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function EditLoad() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    cargoType: "",
    vehicleType: "",
    weight: "",
    price: "",
    date: "",
    loadType: "single" as 'single' | 'period',
    periodDays: "",
    isReturnLoad: false,
    returnOrigin: "",
    returnDestination: "",
    secondaryPhone: "",
    whatsappPhone: "",
    pickupAddress: "",
    deliveryAddress: "",
    loadingTime: "",
    paymentTerms: "",
    loadingInstructions: "",
    description: "",
  });

  useEffect(() => {
    if (!id) return;
    loadsService.getById(id)
      .then(data => {
        setLoad(data);
        if (!data) return;
        setForm({
          origin: data.origin || "",
          destination: data.destination || "",
          cargoType: data.cargoType || "",
          vehicleType: data.vehicleType || "",
          weight: data.weight || "",
          price: data.price ? String(data.price) : "",
          date: data.date || "",
          loadType: data.loadType || "single",
          periodDays: data.periodDays ? String(data.periodDays) : "",
          isReturnLoad: data.isReturnLoad || false,
          returnOrigin: data.returnOrigin || "",
          returnDestination: data.returnDestination || "",
          secondaryPhone: data.secondaryPhone || "",
          whatsappPhone: data.whatsappPhone || "",
          pickupAddress: data.pickupAddress || "",
          deliveryAddress: data.deliveryAddress || "",
          loadingTime: data.loadingTime || "",
          paymentTerms: data.paymentTerms || "",
          loadingInstructions: data.loadingInstructions || "",
          description: data.description || "",
        });
      })
      .catch(() => setError("تعذر تحميل الحمولة"))
      .finally(() => setLoading(false));
  }, [id]);

  const canEdit = (() => {
    if (!user || !load) return false;
    return user.type === "admin" || load.userId === user.id;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !load || !canEdit) return;
    setError("");
if (!form.origin.trim() || !form.destination.trim()) {
      setError("يرجى ملء نقطة الانطلاق والوصول");
      return;
    }
    const priceErr = priceInputError(form.price, load.priceType);
    if (priceErr) {
      setError(priceErr);
      return;
    }
    setSaving(true);
    try {
      const update: Partial<Load> = {
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        cargoType: form.cargoType,
        vehicleType: form.vehicleType,
        weight: form.weight,
        price: listingPriceValue(form.price, load.priceType),
        date: form.date,
        loadType: form.loadType,
        isReturnLoad: form.isReturnLoad,
        returnOrigin: form.isReturnLoad ? form.returnOrigin : '',
        returnDestination: form.isReturnLoad ? form.returnDestination : '',
        secondaryPhone: form.secondaryPhone || '',
        whatsappPhone: form.whatsappPhone || user?.whatsapp || "",
        pickupAddress: form.pickupAddress || '',
        deliveryAddress: form.deliveryAddress || '',
        loadingTime: form.loadingTime || '',
        paymentTerms: form.paymentTerms || '',
        loadingInstructions: form.loadingInstructions || '',
        description: form.description || '',
      };
      if (form.loadType === 'period' && form.periodDays) {
        update.periodDays = Number(form.periodDays);
      }
      await loadsService.update(id, update);
      setDone(true);
      setTimeout(() => navigate(-1), 900);
    } catch (err: any) {
      setError(err.message || "تعذر حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-orange" />
    </div>
  );

  if (!load) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-text mb-2">الحمولة غير موجودة</h1>
      <Link to="/loads" className="text-orange font-semibold hover:underline">العودة لسوق حمولة</Link>
    </div>
  );

  if (!canEdit) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <ShieldAlert className="w-14 h-14 text-danger mx-auto mb-4" />
      <h1 className="text-xl font-bold text-text mb-2">لا تملك صلاحية تعديل هذه الحمولة</h1>
      <p className="text-text-light text-sm mb-5">التعديل متاح لصاحب الحمولة أو الأدمن فقط.</p>
      <Link to="/loads" className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-bold inline-block">عرض حمولة</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-text-light mb-6">
        <Link to="/" className="hover:text-orange">الرئيسية</Link>
        <ChevronLeft className="w-4 h-4 rtl-flip" />
        <Link to="/loads" className="hover:text-orange">سوق حمولة</Link>
        <ChevronLeft className="w-4 h-4 rtl-flip" />
        <span className="text-text">تعديل الحمولة</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">تعديل الحمولة</h1>
        <p className="text-text-light text-sm mt-1">يمكن تعديل بيانات الحمولة كاملة.</p>
      </div>

      {done && (
        <div className="bg-success/10 border border-success/20 text-success rounded-xl p-3 mb-5 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> تم حفظ التعديلات بنجاح
        </div>
      )}
      {error && <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-3 mb-5 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-bold text-text">بيانات الحمولة</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="من (المدينة) *">
              <input required value={form.origin} onChange={e => setForm({...form, origin: e.target.value})} className={inp} placeholder="القاهرة" />
            </Field>
            <Field label="إلى (المدينة) *">
              <input required value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} className={inp} placeholder="الإسكندرية" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="نوع الحمولة">
              <CustomSelect value={form.cargoType} onChange={e => setForm({...form, cargoType: e.target.value})}>
                <option value="">اختر...</option>
                {cargoTypes.map(c => <option key={c} value={c}>{c}</option>)}
              </CustomSelect>
            </Field>
            <Field label="نوع العربية المطلوبة">
              <CustomSelect value={form.vehicleType} onChange={e => setForm({...form, vehicleType: e.target.value})}>
                <option value="">أي عربية</option>
                {loadVehicleTypes.map(v => <option key={v} value={v}>{v}</option>)}
              </CustomSelect>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="الوزن (طن)">
              <input type="number" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} className={inp} placeholder="20" />
            </Field>
            <Field label="الأجرة (جنيه)">
              <input inputMode="numeric" dir="ltr" value={form.price ? formatPrice(form.price) : ""} onChange={e => setForm({...form, price: latinDigits(e.target.value)})} className={`${inp} text-right`} placeholder="5000" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="تاريخ الشحن">
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={inp} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="نوع الرحلة">
              <CustomSelect value={form.loadType} onChange={e => setForm({...form, loadType: e.target.value as 'single' | 'period'})}>
                <option value="single">رحلة واحدة</option>
                <option value="period">لفترة (تعاقد)</option>
              </CustomSelect>
            </Field>
            {form.loadType === 'period' && (
              <Field label="عدد الأيام">
                <input type="number" min="1" value={form.periodDays} onChange={e => setForm({...form, periodDays: e.target.value})} className={inp} placeholder="30" />
              </Field>
            )}
          </div>
          <div className="flex items-center gap-3 p-3 bg-bg rounded-xl">
            <input type="checkbox" id="returnLoad" checked={form.isReturnLoad}
              onChange={e => setForm({...form, isReturnLoad: e.target.checked})}
              className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
            <label htmlFor="returnLoad" className="text-sm font-bold text-text cursor-pointer">هذه حمولة رجعة (السائق فاضي وراجع)</label>
          </div>
          {form.isReturnLoad && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 sm:pr-7">
              <Field label="من (للرجعة)">
                <input value={form.returnOrigin} onChange={e => setForm({...form, returnOrigin: e.target.value})} className={inp} placeholder="المدينة الحالية" />
              </Field>
              <Field label="إلى (للرجعة)">
                <input value={form.returnDestination} onChange={e => setForm({...form, returnDestination: e.target.value})} className={inp} placeholder="المدينة المطلوبة" />
              </Field>
            </div>
          )}

          <div className="border-t border-border pt-4 mt-2">
            <p className="text-xs font-bold text-text-light mb-3">تفاصيل إضافية (اختياري)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label="رقم هاتف بديل">
                <input value={form.secondaryPhone} onChange={e => setForm({...form, secondaryPhone: e.target.value})} className={inp} placeholder="01000000000" />
              </Field>
              <Field label="رقم واتساب (اختياري)">
                <input value={form.whatsappPhone || ""} onChange={e => setForm({...form, whatsappPhone: e.target.value})} className={inp} placeholder="01000000000" />
              </Field>
              <Field label="وقت التحميل">
                <input type="time" value={form.loadingTime} onChange={e => setForm({...form, loadingTime: e.target.value})} className={inp} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
              <Field label="عنوان التحميل">
                <input value={form.pickupAddress} onChange={e => setForm({...form, pickupAddress: e.target.value})} className={inp} placeholder="شارع، منطقة، حي..." />
              </Field>
              <Field label="عنوان التسليم">
                <input value={form.deliveryAddress} onChange={e => setForm({...form, deliveryAddress: e.target.value})} className={inp} placeholder="شارع، منطقة، حي..." />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
              <Field label="شروط الدفع">
                <input value={form.paymentTerms} onChange={e => setForm({...form, paymentTerms: e.target.value})} className={inp} placeholder="نقداً، تحويل، كاش..." />
              </Field>
              <Field label="تعليمات التحميل">
                <input value={form.loadingInstructions} onChange={e => setForm({...form, loadingInstructions: e.target.value})} className={inp} placeholder="كرتون, بالات, سائل..." />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="وصف إضافي">
                <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className={`${inp} resize-none`} placeholder="أي تفاصيل إضافية عن الحمولة..." />
              </Field>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full h-12 bg-orange hover:bg-orange-dark disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الحفظ...</> : <><Save className="w-5 h-5" /> حفظ التعديلات</>}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function CustomSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={sel}>{props.children}</select>
      <svg className="w-4 h-4 text-orange absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
    </div>
  );
}
