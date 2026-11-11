import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, CheckCircle, Loader2, Plus, Save, ShieldAlert } from "lucide-react";
import ImageUploader from "../components/ImageUploader";
import VideoUploader from "../components/VideoUploader";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { listingsService } from "../lib/firestoreService";
import { equipmentCategories, governorates, vehicleCategories, citiesByGovernorate } from "../lib/data";
import { listingUrl, generateSlug, sanitizeTitle, priceInputError, listingPriceValue, priceToNumber, MIN_LISTING_PRICE } from "../lib/utils";
import { normalizeArabicText, normalizeGovernorate } from "../lib/listingMeta";
import { getApiUrl } from "../lib/config";
import type { Listing } from "../types";

const inp = "w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-bg focus:outline-none focus:border-orange";
const sel = "w-full appearance-none border border-border rounded-xl pr-4 pl-10 py-2.5 text-sm bg-bg focus:outline-none focus:border-orange cursor-pointer";

const stripNonDigits = (v: string) => v.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^\d]/g, "");
const formatThousand = (v: string) => stripNonDigits(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function getCitiesOf(govName: string): string[] {
  const g = governorates.find(g => g.name === govName);
  return g ? citiesByGovernorate[g.id] || [] : [];
}

export default function EditListing() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useNotifications();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "trucks",
    subcategory: "",
    governorate: "",
    location: "",
    year: "",
    brand: "",
    model: "",
    condition: "used",
    images: [] as string[],
    videoUrl: "",
    userPhone: "",
    contactPhone: "",
    whatsappPhone: "",
    advertiserName: "",
    listingType: "sell" as "sell" | "rent",
    priceType: "fixed" as "fixed" | "negotiable" | "call" | "sold",
    dailyPrice: "", weeklyPrice: "", monthlyPrice: "", deposit: "",
    availableFrom: "", availableTo: "", insuranceRequired: false,
  });
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    listingsService.getById(id)
      .then(data => {
        setListing(data);
        if (!data) return;
        setForm({
          title: data.title || "",
          description: data.description || "",
          price: data.price ? String(data.price) : "",
          category: data.category || "trucks",
          subcategory: data.subcategory || "",
          governorate: data.governorate || "",
          location: data.location || "",
          year: data.year ? String(data.year) : "",
          brand: data.brand || "",
          model: data.model || "",
          condition: data.condition || "used",
          images: data.images || [],
          videoUrl: data.videoUrl || "",
          userPhone: data.userPhone || "",
          contactPhone: data.contactPhone || "",
          whatsappPhone: data.whatsappPhone || user?.whatsapp || "",
          advertiserName: data.advertiserName || "",
          listingType: data.listingType || "sell",
          // "تم البيع" حالة من صفحة الإعلان بس — مش خيار في الإنشاء ولا التعديل
priceType: data.priceType === "sold" ? "fixed" : (data.priceType || "fixed"),
          dailyPrice: data.dailyPrice ? String(data.dailyPrice) : "",
          weeklyPrice: data.weeklyPrice ? String(data.weeklyPrice) : "",
          monthlyPrice: data.monthlyPrice ? String(data.monthlyPrice) : "",
          deposit: data.deposit ? String(data.deposit) : "",
          availableFrom: data.availableFrom || "",
          availableTo: data.availableTo || "",
          insuranceRequired: data.insuranceRequired || false,
        });
      })
      .catch(() => setError("تعذر تحميل الإعلان"))
      .finally(() => setLoading(false));
  }, [id]);

  const canEdit = useMemo(() => {
    if (!user || !listing) return false;
    return user.type === "admin" || listing.userId === user.id;
  }, [user, listing]);

  const subcategoryOptions: Record<string, { id: string; name: string }[]> = {
    trucks: [
      { id: 'half-trucks', name: 'نصف نقل' },
      { id: 'quarter-trucks', name: 'ربع نقل' },
      { id: 'tractor-heads', name: 'رؤوس جرارات' },
      { id: 'dump-trucks', name: 'قلابات' },
      { id: 'flatbeds', name: 'سطيحات' },
      { id: 'tankers', name: 'تانكرات' },
      { id: 'refrigerated', name: 'برادات' },
    ],
    equipment: equipmentCategories,
    trailers: [
      { id: 'semi-trailers', name: 'نصف مقطورات' },
      { id: 'tankers', name: 'تانكرات' },
      { id: 'flatbeds', name: 'سطيحات' },
      { id: 'refrigerated', name: 'برادات' },
    ],
    buses: [
      { id: 'passenger', name: 'أتوبيس ركاب' },
      { id: 'tourism', name: 'أتوبيس سياحي' },
      { id: 'minibus', name: 'ميني باص' },
      { id: 'school', name: 'أتوبيس مدرسة' },
    ],
    'spare-parts': [
      { id: 'engine', name: 'محركات' },
      { id: 'transmission', name: 'فتيس الحركة' },
      { id: 'brakes', name: 'فرامل' },
      { id: 'tires', name: 'إطارات' },
      { id: 'electrical', name: 'كهربائيات' },
      { id: 'body', name: 'بدي وكبائن' },
      { id: 'filters', name: 'فلاتر' },
      { id: 'oils', name: 'زيوت وشحن' },
    ],
  };
  const subcategories = subcategoryOptions[form.category] || [];

  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError("رابط الصورة يجب أن يبدأ بـ http أو https");
      return;
    }
    if (form.images.includes(url)) {
      setImageUrl("");
      return;
    }
    setForm({ ...form, images: [...form.images, url] });
    setImageUrl("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !listing || !canEdit) return;
    setError("");
    if (!form.title.trim() || !form.governorate) {
      setError("فضلاً ملء الخانات الإجبارية");
      return;
    }
    if (form.title.trim().length < 8) {
      setError("عنوان الإعلان قصير جدًا — اكتب نوع المركبة والماركة على الأقل");
      return;
    }
    if (form.listingType === "sell") {
      const priceErr = priceInputError(form.price, form.priceType);
      if (priceErr) {
        setError(priceErr);
        return;
      }
    }
    if (form.listingType === "rent") {
      const rentPrices = [form.dailyPrice, form.weeklyPrice, form.monthlyPrice].map(priceToNumber);
      if (!rentPrices.some((n) => n >= MIN_LISTING_PRICE)) {
        setError("اكتب سعر الإيجار بالجنيه، أو اختار «السعر عند التواصل»");
        return;
      }
    }
    if (!form.images.length) {
      setError("يجب وجود صورة واحدة على الأقل");
      return;
    }

    setSaving(true);
    try {
      const update: Partial<Listing> = {
        title: sanitizeTitle(form.title, 120),
        slug: await listingsService.uniqueSlug(generateSlug(`${form.title} ${form.year || ''} ${form.listingType === 'rent' ? 'ايجار' : 'للبيع'}`), id),
        description: normalizeArabicText(form.description),
        listingType: form.listingType,
        price: listingPriceValue(form.price, form.priceType),
        priceType: form.priceType,
        category: form.category,
        subcategory: form.subcategory,
        governorate: normalizeGovernorate(form.governorate),
        location: normalizeArabicText(form.location),
        images: form.images,
        videoUrl: form.videoUrl || "",
        condition: form.condition as Listing["condition"],
        userPhone: form.userPhone.trim(),
          contactPhone: form.contactPhone.trim(),
          whatsappPhone: (form.whatsappPhone || "").trim(),
        advertiserName: form.advertiserName.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
      };
      if (form.year) update.year = Number(form.year);
      if (form.listingType === "rent") {
        if (form.dailyPrice)   update.dailyPrice   = Number(form.dailyPrice);
        if (form.weeklyPrice)  update.weeklyPrice  = Number(form.weeklyPrice);
        if (form.monthlyPrice) update.monthlyPrice = Number(form.monthlyPrice);
        if (form.deposit)      update.deposit      = Number(form.deposit);
        if (form.availableFrom) update.availableFrom = form.availableFrom;
        if (form.availableTo)   update.availableTo   = form.availableTo;
        update.insuranceRequired = form.insuranceRequired;
      }
      if (user?.type !== "admin") update.status = "pending";

      await listingsService.update(id, update);
      setDone(true);
      setTimeout(() => navigate(listingUrl(id)), 900);
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

  if (!listing) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-text mb-2">الإعلان غير موجود</h1>
      <Link to="/my-listings" className="text-orange font-semibold hover:underline">العودة لإعلاناتي</Link>
    </div>
  );

  if (!canEdit) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <ShieldAlert className="w-14 h-14 text-danger mx-auto mb-4" />
      <h1 className="text-xl font-bold text-text mb-2">لا تملك صلاحية تعديل هذا الإعلان</h1>
      <p className="text-text-light text-sm mb-5">التعديل متاح لصاحب الإعلان أو الأدمن فقط.</p>
      <Link to={listingUrl(listing.id, listing.slug)} className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-bold inline-block">عرض الإعلان</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-text-light mb-6">
        <Link to="/" className="hover:text-orange">الرئيسية</Link>
        <ChevronLeft className="w-4 h-4 rtl-flip" />
        <Link to="/my-listings" className="hover:text-orange">إعلاناتي</Link>
        <ChevronLeft className="w-4 h-4 rtl-flip" />
        <span className="text-text">تعديل الإعلان</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">تعديل الإعلان</h1>
        <p className="text-text-light text-sm mt-1">يمكن تعديل النصوص، السعر، بيانات التواصل، والصور.</p>
      </div>

      {done && (
        <div className="bg-success/10 border border-success/20 text-success rounded-xl p-3 mb-5 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> تم حفظ التعديلات بنجاح
        </div>
      )}
      {error && <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-3 mb-5 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-bold text-text">صور الإعلان</h3>
          <ImageUploader images={form.images} onChange={images => setForm({ ...form, images })} max={15} />
          <div className="flex gap-2">
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} className={inp} placeholder="أو أضف رابط صورة مباشر https://..." />
            <button type="button" onClick={addImageUrl} className="flex items-center gap-1 bg-navy hover:bg-navy/90 text-white px-4 py-2 rounded-xl text-sm font-bold">
              <Plus className="w-4 h-4" /> إضافة
            </button>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-bold text-text">فيديو الإعلان (اختياري)</h3>
          <VideoUploader value={form.videoUrl} onChange={videoUrl => setForm({ ...form, videoUrl })}
            phone={form.contactPhone || form.userPhone || user?.phone || ''} label={form.advertiserName || ''} />
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-bold text-text">معلومات الإعلان</h3>
          <Field label="عنوان الإعلان *">
            <input required value={form.title} maxLength={120}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className={inp} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="الفئة">
              <CustomSelect value={form.category} onChange={e => setForm({ ...form, category: e.target.value, subcategory: "", listingType: e.target.value === "spare-parts" ? "sell" : form.listingType })}>
                <option value="trucks">شاحنات</option>
                <option value="equipment">معدات ثقيلة</option>
                <option value="trailers">مقطورات</option>
                <option value="buses">حافلات</option>
                <option value="spare-parts">قطع غيار</option>
              </CustomSelect>
            </Field>
            <Field label="التصنيف الفرعي">
              <CustomSelect value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}>
                <option value="">بدون</option>
                {subcategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </CustomSelect>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="الماركة"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className={inp} /></Field>
            <Field label="الموديل"><input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className={inp} /></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="سنة الصنع"><input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className={inp} placeholder="2020" /></Field>
            <Field label="الحالة">
              <CustomSelect value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
                <option value="used">مستعمل</option>
                <option value="new">جديد</option>
              </CustomSelect>
            </Field>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-bold text-text">معلومات السعر والموقع</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="المحافظة *">
              <CustomSelect required value={form.governorate} onChange={e => setForm({ ...form, governorate: e.target.value })}>
                <option value="">اختر...</option>
                {governorates.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
              </CustomSelect>
            </Field>
            <Field label="المنطقة">
              <CustomSelect value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })}>
                <option value="">اختر...</option>
                {form.governorate ? (
                  <>
                    <option value={form.governorate}>{form.governorate} (المحافظة)</option>
                    {getCitiesOf(form.governorate).filter(c => c !== form.governorate).map(c => <option key={c} value={c}>{c}</option>)}
                  </>
                ) : <option value="" disabled>اختر المحافظة أولًا</option>}
              </CustomSelect>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="نوع الإعلان">
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({...form, listingType: "sell"})}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${form.listingType === "sell" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>بيع</button>
                {form.category !== "spare-parts" && (
                  <button type="button" onClick={() => setForm({...form, listingType: "rent"})}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${form.listingType === "rent" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>إيجار</button>
                )}
              </div>
            </Field>
            <Field label="رقم الهاتف"><input value={form.userPhone} onChange={e => setForm({ ...form, userPhone: e.target.value })} className={inp} placeholder="01XXXXXXXXX" /></Field>
            <Field label="رقم هاتف التواصل (اختياري)"><input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className={inp} placeholder="01000000000" /></Field>
            <Field label="رقم واتساب (اختياري)"><input value={form.whatsappPhone || ""} onChange={e => setForm({ ...form, whatsappPhone: e.target.value })} className={inp} placeholder="01000000000" /></Field>
            <Field label="اسم المعلن (معرض أو فرد)"><input value={form.advertiserName} onChange={e => setForm({ ...form, advertiserName: e.target.value })} className={inp} placeholder="مثال: معرض النور للشاحنات" /></Field>
          </div>

          {form.listingType === "sell" ? (
            <>
              {form.priceType !== "call" && form.priceType !== "sold" && (
                <Field label="السعر (جنيه) *"><input ref={priceRef} required type="text" inputMode="numeric" dir="ltr" value={form.price ? formatThousand(form.price) : ""} onChange={e => { const raw = stripNonDigits(e.target.value); setForm({ ...form, price: raw }); }} className={`${inp} text-right`} placeholder="1,000,000" /></Field>
              )}
              <Field label="نوع السعر">
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setForm({...form, priceType: "fixed"}); setTimeout(() => priceRef.current?.focus(), 0); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${form.priceType === "fixed" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>سعر ثابت</button>
                  <button type="button" onClick={() => { setForm({...form, priceType: "negotiable"}); setTimeout(() => priceRef.current?.focus(), 0); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${form.priceType === "negotiable" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>قابل للتفاوض</button>
                  <button type="button" onClick={() => { setForm({...form, priceType: "call", price: ""})}}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${form.priceType === "call" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>عند التواصل</button>
                </div>
              </Field>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Field label="السعر اليومي"><input inputMode="numeric" dir="ltr" value={form.dailyPrice ? formatThousand(form.dailyPrice) : ""} onChange={e => { const raw = stripNonDigits(e.target.value); setForm({ ...form, dailyPrice: raw }); }} className={`${inp} text-right`} placeholder="0" /></Field>
                <Field label="السعر الأسبوعي"><input inputMode="numeric" dir="ltr" value={form.weeklyPrice ? formatThousand(form.weeklyPrice) : ""} onChange={e => { const raw = stripNonDigits(e.target.value); setForm({ ...form, weeklyPrice: raw }); }} className={`${inp} text-right`} placeholder="0" /></Field>
                <Field label="السعر الشهري"><input inputMode="numeric" dir="ltr" value={form.monthlyPrice ? formatThousand(form.monthlyPrice) : ""} onChange={e => { const raw = stripNonDigits(e.target.value); setForm({ ...form, monthlyPrice: raw }); }} className={`${inp} text-right`} placeholder="0" /></Field>
              </div>
              <Field label="تأمين (اختياري)"><input inputMode="numeric" dir="ltr" value={form.deposit ? formatThousand(form.deposit) : ""} onChange={e => { const raw = stripNonDigits(e.target.value); setForm({ ...form, deposit: raw }); }} className={`${inp} text-right`} placeholder="0" /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="متاح من"><input type="date" value={form.availableFrom} onChange={e=>setForm({...form,availableFrom:e.target.value})} className={inp} /></Field>
                <Field label="متاح إلى"><input type="date" value={form.availableTo} onChange={e=>setForm({...form,availableTo:e.target.value})} className={inp} /></Field>
              </div>
              <div className="flex items-center gap-3 p-3 bg-bg rounded-xl">
                <input type="checkbox" id="editInsuranceRequired" checked={form.insuranceRequired} onChange={e=>setForm({...form,insuranceRequired:e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
                <label htmlFor="editInsuranceRequired" className="text-sm font-bold text-text cursor-pointer">مطلوب تأمين</label>
              </div>
            </>
          )}
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5">
          <Field label="وصف الإعلان">
            <textarea rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inp} resize-none`} />
          </Field>
        </div>

        {user?.type !== "admin" && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl p-3 text-sm">
            بعد تعديل الناشر، سيتم تحويل الإعلان إلى قيد المراجعة حتى يوافق عليه الأدمن.
          </div>
        )}

        <button type="submit" disabled={saving} className="w-full h-12 bg-orange hover:bg-orange-dark disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
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
      <ChevronDown className="w-4 h-4 text-orange absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}




