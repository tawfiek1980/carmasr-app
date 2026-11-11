import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Truck, Package, HardHat, Wrench, CheckCircle, Loader2, ChevronLeft, ChevronDown, Plus, MapPin } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { listingsService } from "../lib/firestoreService";
import { firebaseAuth } from "../firebase";
import { governorates, vehicleCategories, equipmentCategories, citiesByGovernorate, nearestGovernorate } from "../lib/data";
import ImageUploader from "../components/ImageUploader";
import VideoUploader from "../components/VideoUploader";
import { notifyWhatsApp } from "../lib/notifyWhatsApp";
import { trackEvent } from "../lib/analytics";
import { getSiteUrl, getApiUrl } from "../lib/config";
import { generateSlug, sanitizeTitle, priceInputError, listingPriceValue, priceToNumber, MIN_LISTING_PRICE } from "../lib/utils";
import { normalizeArabicText, normalizeGovernorate } from "../lib/listingMeta";

const listingTypes = [
  { id: "vehicle",     name: "شاحنة أو معدات", icon: Truck },
  { id: "load",        name: "حمولة",           icon: Package },
  { id: "job",         name: "وظيفة",           icon: HardHat },
  { id: "spare-part",  name: "قطعة غيار",       icon: Wrench },
];

function getCitiesOf(govName: string): string[] {
  const g = governorates.find(g => g.name === govName);
  return g ? citiesByGovernorate[g.id] || [] : [];
}

const cargoTypes = ["بضاعة جافة","مبردة","سوائل","مواد بناء","أثاث","مواشي","أخرى"];
const loadVehicleTypes = ["قلاب","سطحه","تريلة","دينا","براد","تانك","ونش","نقل عادي"];
const jobTypesList = [
  { id: "driver", name: "سائق" }, { id: "mechanic", name: "ميكانيكي" },
  { id: "technician", name: "تقني" }, { id: "logistics", name: "لوجستيات" },
  { id: "warehouse", name: "مستودعات" }, { id: "sales", name: "مبيعات" },
  { id: "heavy-equip", name: "معدات ثقيلة" }, { id: "electrician", name: "كهربائي" },
  { id: "welder", name: "لحام" }, { id: "craftsman", name: "صنايعي" },
  { id: "tinsmith", name: "سمكري" }, { id: "carpenter", name: "نجار" },
  { id: "other", name: "أخرى" },
];

const subcategoriesByCategory: Record<string, { id: string; name: string }[]> = {
  cars: [
    { id: 'sedan', name: 'سيدان' },
    { id: 'suv', name: 'SUV / كروس اوفر' },
    { id: 'hatchback', name: 'هاتشباك' },
    { id: 'pickup', name: 'بيك أب' },
    { id: 'coupe', name: 'كوبيه' },
    { id: 'convertible', name: 'مكشوفة' },
    { id: 'van', name: 'فان / عائلية' },
    { id: 'wagon', name: 'واجن' },
    { id: 'other', name: 'أخرى' },
  ],
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

export default function PostListing() {
  const navigate       = useNavigate();
  const [sp]           = useSearchParams();
  const { user }       = useAuth();
  const { toast }      = useNotifications();
  const validTypes = ["vehicle", "load", "job", "spare-part"];
  const requestedType = sp.get("type") || sp.get("tab") || "vehicle";
  const [type, setType] = useState(validTypes.includes(requestedType) ? requestedType : "vehicle");
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");
  const [doneNote, setDoneNote] = useState("");
  const [locating, setLocating] = useState(false);
  const priceRef = useRef<HTMLInputElement>(null);

  const useVehicleLocation = () => {
    if (!navigator.geolocation) { toast("المتصفح لا يدعم تحديد الموقع", "error"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const g = nearestGovernorate(pos.coords.latitude, pos.coords.longitude);
        if (g) {
          setVf(v => ({ ...v, governorate: g, location: g }));
          toast(`تم تحديد موقعك: ${g}`, "success");
        } else {
          toast("تعذر تحديد المحافظة من موقعك", "error");
        }
      },
      (err) => {
        setLocating(false);
        toast(err.code === 1 ? "أذن بالوصول للموقع من إعدادات المتصفح ثم أعد المحاولة" : "تعذر الوصول لموقعك الحالي", "error");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Vehicle form
  const [vf, setVf] = useState({
    title: "", description: "", price: "", category: "cars",
    subcategory: "", governorate: "", location: "",
    year: "", brand: "", model: "", condition: "used",
    fuel: "", transmission: "", mileage: "", color: "", engineSize: "",
    images: [] as string[],
    videoUrl: "",
    listingType: "sell" as "sell" | "rent",
    priceType: "fixed" as "fixed" | "negotiable" | "call" | "sold",
    dailyPrice: "", weeklyPrice: "", monthlyPrice: "", deposit: "",
    availableFrom: "", availableTo: "", insuranceRequired: false,
    contactPhone: sp.get("phone") || "",
    whatsappPhone: "",
    advertiserName: sp.get("advertiser") || "",
  });

  // ── Load form
  const [lf, setLf] = useState({
    origin: "", destination: "", cargoType: "", vehicleType: "",
    weight: "", price: "", date: "",
    priceType: "fixed" as "fixed" | "negotiable" | "call" | "sold",
    loadType: "single" as 'single' | 'period',
    periodDays: "",
    isReturnLoad: false,
    returnOrigin: "", returnDestination: "",
    international: false,
    secondaryPhone: "",
    whatsappPhone: "",
    contactPhone: sp.get("phone") || "",
    pickupAddress: "", deliveryAddress: "",
    loadingTime: "",
    paymentTerms: "", loadingInstructions: "", description: "",
  });

  // ── Job form
  const [jf, setJf] = useState({
    title: "", company: "", jobPostType: "available", jobType: "driver", location: "",
    governorate: "", salary: "", description: "", experience: "",
    contactPhone: sp.get("phone") || "",
  });

  if (!user) return null;

  // ── Submit
  const publishViaServer = async (kind: string, data: Record<string, any> = {}, images: string[] = []) => {
    const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : "";
    const res = await fetch(`${getApiUrl()}/ai/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action: "auto-publish", kind, data, images }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload || !payload.ok) throw new Error(payload?.message || "تعذر إرسال إعلانك");
    return payload as { id: string; status: string; reasons?: string[]; moderated?: boolean; spellCorrected?: boolean };
  };

  const handlePublishOutcome = (
    res: { id: string; status: string; reasons?: string[]; spellCorrected?: boolean },
    opts: { publishedMsg: string; whatsappEvent: "ad" | "load" | "new-user"; whatsappType: string; title: string; phone: string; governorate?: string; price?: string; link: string }
  ) => {
    if (res.status === "active" || res.status === "available") {
      setDoneNote(opts.publishedMsg);
      toast(opts.publishedMsg, "success");
      if (res.spellCorrected) toast("تم تصحيح بعض الأخطاء الإملائية في إعلانك تلقائيًا", "info");
      notifyWhatsApp(opts.whatsappEvent, { type: opts.whatsappType, title: opts.title, userName: user?.name || "", phone: opts.phone, governorate: opts.governorate, price: opts.price, link: opts.link });
    } else if (res.status === "pending") {
      setDoneNote("تم استلام إعلانك وهو الآن قيد المراجعة الإدارية، وسيُنشر بعد الموافقة.");
      toast("تم استلام إعلانك وهو قيد المراجعة", "info");
    } else {
      const why = Array.isArray(res.reasons) && res.reasons.length ? ` (${res.reasons.join("، ")})` : "";
      setDoneNote(`لم يتم نشر إعلانك لأنه لا يطابق معايير النشر في الموقع${why}.`);
      toast(why ? `تعذر نشر الإعلان${why}` : "تعذر نشر إعلانك", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (type === "vehicle" || type === "spare-part") {
        if (!vf.title || !vf.governorate) throw new Error("فضلاً ملء الحقول الإلزامية");
        if (vf.title.trim().length < 8) throw new Error("عنوان الإعلان قصير جدًا — اكتب نوع المركبة والماركة على الأقل");
        if (vf.listingType === "sell") {
          const priceErr = priceInputError(vf.price, vf.priceType);
          if (priceErr) throw new Error(priceErr);
        }
        if (vf.listingType === "rent") {
          const rentPrices = [vf.dailyPrice, vf.weeklyPrice, vf.monthlyPrice].map(priceToNumber);
          if (!rentPrices.some((n) => n >= MIN_LISTING_PRICE))
            throw new Error("اكتب سعر الإيجار بالجنيه، أو اختار «السعر عند التواصل»");
        }

        // إزالة الحقول الفاضية قبل الإرسال لـ Firestore
        const listingData: any = {
          title:       sanitizeTitle(vf.title),
          slug:        await listingsService.uniqueSlug(generateSlug(`${vf.title || ''} ${vf.year || ''} ${vf.listingType === 'rent' ? 'ايجار' : 'للبيع'}`)),
          description: normalizeArabicText(vf.description),
          listingType: vf.listingType,
          price:       listingPriceValue(vf.price, vf.priceType),
          priceType:   vf.priceType,
          category:    type === "spare-part" ? "spare-parts" : vf.category,
          governorate: normalizeGovernorate(vf.governorate),
          location:    normalizeArabicText(vf.location),
          images:      vf.images,
          condition:   vf.condition,
          userId:      user.id,
          userName:    user.name || '',
          userPhone:   user.phone || '',
          contactPhone: vf.contactPhone || '',
          // رقم واتساب صاحب الإعلان: المختار في النموذج أو رقم واتساب بروفايله
          whatsappPhone: ((vf.whatsappPhone || user.whatsapp || '') + '').replace(/\s/g, ''),
          advertiserName: vf.advertiserName || '',
          userType:    user.type || 'individual',
          verified:    user.verified || false,
          status:      "pending",
          featured:    false,
        };
        // أضف الحقول الاختيارية بس لو فيها قيمة
        if (vf.subcategory) listingData.subcategory = vf.subcategory;
        if (vf.brand)       listingData.brand = vf.brand;
        if (vf.model)       listingData.model = vf.model;
        if (vf.year)        listingData.year  = Number(vf.year);
        if (vf.fuel)        listingData.fuel = vf.fuel;
        if (vf.transmission) listingData.transmission = vf.transmission;
        if (vf.mileage)     listingData.mileage = Number(vf.mileage);
        if (vf.color)       listingData.color = vf.color;
        if (vf.engineSize)  listingData.engineSize = vf.engineSize;
        if (vf.videoUrl)    listingData.videoUrl = vf.videoUrl;
        // نوع حقل الإيجار
        if (vf.listingType === "rent") {
          if (vf.dailyPrice)   listingData.dailyPrice   = Number(vf.dailyPrice);
          if (vf.weeklyPrice)  listingData.weeklyPrice  = Number(vf.weeklyPrice);
          if (vf.monthlyPrice) listingData.monthlyPrice = Number(vf.monthlyPrice);
          if (vf.deposit)      listingData.deposit      = Number(vf.deposit);
          if (vf.availableFrom) listingData.availableFrom = vf.availableFrom;
          if (vf.availableTo)   listingData.availableTo   = vf.availableTo;
          listingData.insuranceRequired = vf.insuranceRequired;
        }

        const res = await withTimeout(publishViaServer("listing", listingData, vf.images), 25000, "استغرق النشر وقتًا طويلاً — تحقق من اتصالك ثم حاول مجددًا");
        trackEvent("post_listing", { type, listing_type: vf.listingType, category: listingData.category });
        handlePublishOutcome(res, {
          publishedMsg: "تم نشر إعلانك بنجاح على الموقع",
          whatsappEvent: "ad" as const,
          whatsappType: vf.listingType === "rent" ? "إيجار" : "بيع",
          title: vf.title,
          phone: vf.contactPhone || user.phone || "",
          governorate: vf.governorate,
          price: vf.price ? `${vf.price} جنيه` : "",
          link: `${getSiteUrl()}/listing/${res.id}/${listingData.slug}`,
        });
        // إشعار الأدمن يُرسل من السيرفر (handleAutoPublish) لمنع التكرار
      } else if (type === "load") {
        if (!lf.origin || !lf.destination) throw new Error("يرجى تحديد نقطة الانطلاق والوصول");
        const loadPriceErr = priceInputError(lf.price, lf.priceType);
        if (loadPriceErr) throw new Error(loadPriceErr);
        const loadData: Record<string, any> = {
          slug:              generateSlug(`${lf.origin} ${lf.destination} ${lf.cargoType}`),
          origin:            lf.origin,
          destination:       lf.destination,
          cargoType:         lf.cargoType || '',
          vehicleType:       lf.vehicleType || '',
          weight:            lf.weight || '',
          date:              lf.date || '',
          price:             listingPriceValue(lf.price, lf.priceType),
          priceType:          lf.priceType,
          loadType:          lf.loadType,
          isReturnLoad:      lf.isReturnLoad,
          international:     lf.international || false,
          userId:            user.id,
          userName:          user.name || '',
          userPhone:         user.phone || '',
          contactPhone:       lf.contactPhone || '',
          secondaryPhone:    lf.secondaryPhone || '',
          whatsappPhone:     ((lf.whatsappPhone || user.whatsapp || '') + '').replace(/\s/g, ''),
          pickupAddress:     lf.pickupAddress || '',
          deliveryAddress:   lf.deliveryAddress || '',
          loadingTime:       lf.loadingTime || '',
          paymentTerms:      lf.paymentTerms || '',
          loadingInstructions: lf.loadingInstructions || '',
          description:       lf.description || '',
          };
        if (lf.loadType === 'period') loadData.periodDays = Number(lf.periodDays) || 1;
        if (lf.isReturnLoad) {
          if (lf.returnOrigin)  loadData.returnOrigin = lf.returnOrigin;
          if (lf.returnDestination) loadData.returnDestination = lf.returnDestination;
        }
        const res = await withTimeout(publishViaServer("load", loadData), 25000, "استغرق النشر وقتًا طويلاً — تحقق من اتصالك ثم حاول مجددًا");
        handlePublishOutcome(res, {
          publishedMsg: "تم نشر حمولتك بنجاح وهي الآن مرئية للسائقين",
          whatsappEvent: "load" as const,
          whatsappType: "حمولة",
          title: `${lf.origin} ↔ ${lf.destination}`,
          phone: lf.contactPhone || user.phone || "",
          governorate: lf.origin,
          link: `${getSiteUrl()}/loads`,
        });
      } else if (type === "job") {
        if (!jf.title || !jf.governorate) throw new Error("يرجى ملء الحقول الإلزامية");
        const jobData: Record<string, any> = {
          slug:         generateSlug(`${jf.title} ${jf.company} ${jf.governorate}`),
          title:        jf.title,
          company:      jf.company || '',
          jobPostType:  jf.jobPostType as any,
          type:         jf.jobType as any,
          location:     jf.location || '',
          governorate:  jf.governorate,
          salary:       jf.salary || '',
          description:  jf.description || '',
          requirements: [],
          experience:   jf.experience || '',
          userId:       user.id,
          userName:     user.name || '',
          userPhone:    user.phone || '',
          contactPhone: jf.contactPhone || '',
          featured:     false,
        };
        const res = await withTimeout(publishViaServer("job", jobData), 25000, "استغرق النشر وقتًا طويلاً — تحقق من اتصالك ثم حاول مجددًا");
        handlePublishOutcome(res, {
          publishedMsg: "تم نشر إعلان الوظيفة بنجاح",
          whatsappEvent: "ad" as const,
          whatsappType: "وظيفة",
          title: jf.title,
          phone: jf.contactPhone || user.phone || "",
          governorate: jf.governorate,
          link: `${getSiteUrl()}/jobs`,
        });
      }
      setDone(true);
    } catch (e: any) {
      setError(e.message || "حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="w-10 h-10 text-success" />
      </div>
      <h2 className="text-2xl font-bold text-text mb-2">
        {doneNote.includes("لم يتم") ? "تعذر نشر إعلانك" : "تم إرسال إعلانك!"}
      </h2>
      <p className="text-text-light mb-6 max-w-sm whitespace-pre-line">
        {doneNote || (type === "vehicle" || type === "spare-part"
          ? "سيتم مراجعة إعلانك ونشره خلال 24 ساعة."
          : "تم نشر إعلانك بنجاح.")}
      </p>
      <div className="flex gap-3">
        <button onClick={() => { setDone(false); setVf({ title:"",description:"",price:"",category:"cars",subcategory:"",governorate:"",location:"",year:"",brand:"",model:"",condition:"used",fuel:"",transmission:"",mileage:"",color:"",engineSize:"",images:[],videoUrl:"",listingType:"sell",priceType:"fixed",dailyPrice:"",weeklyPrice:"",monthlyPrice:"",deposit:"",availableFrom:"",availableTo:"",insuranceRequired:false,contactPhone:"",whatsappPhone:"",advertiserName:"" }); }}
          className="border border-border text-text px-6 py-3 rounded-xl font-semibold hover:border-orange transition-colors">
          إعلان جديد
        </button>
        <button onClick={() => navigate("/my-listings")}
          className="bg-orange hover:bg-orange-dark text-white px-6 py-3 rounded-xl font-bold transition-colors">
          إعلاناتي
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">نشر إعلان جديد</h1>
        <p className="text-text-light text-sm mt-1">اختر نوع الإعلان وأدخل التفاصيل</p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {listingTypes.map(t => (
          <button key={t.id} type="button" onClick={() => { setType(t.id); if (t.id === "spare-part") setVf(v => ({...v, listingType: "sell"})); }}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
              type === t.id ? "border-orange bg-orange/5 text-orange" : "border-border bg-surface text-text-light hover:border-orange/50"}`}>
            <t.icon className="w-7 h-7" />
            <span className="text-xs font-semibold text-center">{t.name}</span>
          </button>
        ))}
      </div>

      {error && <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-3 mb-5 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── VEHICLE / SPARE PART ─────────────────── */}
        {(type === "vehicle" || type === "spare-part") && (
          <>
            <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-bold text-text">معلومات أساسية</h3>
              <Field label="عنوان الإعلان *" hint="بدون رقم هاتف وبدون تكرار لكلمة «للبيع»">
                <input required value={vf.title} maxLength={120}
                  onChange={e => setVf({...vf,title:e.target.value})}
                  className={inp} placeholder={type === "spare-part" ? "مثال: طقم فرامل مرسيدس أكتروس أصلي" : "مثال: شاحنة فولفو 2020"} />
              </Field>
{type === "vehicle" && (
                <Field label="نوع الهيكل">
                  <CustomSelect value={vf.subcategory} onChange={e => setVf({...vf,subcategory:e.target.value})}>
                    <option value="">اختر...</option>
                    {subcategoriesByCategory['cars'].map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </CustomSelect>
                </Field>
              )}
              {(type === "vehicle" || type === "spare-part") && (
                <Field label="التصنيف الفرعي">
                  <CustomSelect value={vf.subcategory} onChange={e => setVf({...vf,subcategory:e.target.value})}>
                    <option value="">بدون</option>
                    {(type === "spare-part" ? subcategoriesByCategory['spare-parts'] : subcategoriesByCategory[vf.category] || []).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </CustomSelect>
                </Field>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="الماركة"><input value={vf.brand} onChange={e=>setVf({...vf,brand:e.target.value})} className={inp} placeholder={type === "spare-part" ? "مثال: Mercedes" : "مثال: Volvo"} /></Field>
                <Field label="الموديل"><input value={vf.model} onChange={e=>setVf({...vf,model:e.target.value})} className={inp} placeholder={type === "spare-part" ? "مثال: رقم القطعة أو الموديل" : "مثال: FH16"} /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="سنة الصنع"><input type="number" value={vf.year} onChange={e=>setVf({...vf,year:e.target.value})} className={inp} placeholder="2020" /></Field>
                <Field label="الحالة">
                  <CustomSelect value={vf.condition} onChange={e=>setVf({...vf,condition:e.target.value})}>
                    <option value="used">مستعمل</option>
                    <option value="new">جديد</option>
                  </CustomSelect>
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="الوقود">
                  <CustomSelect value={vf.fuel} onChange={e => setVf({...vf,fuel:e.target.value})}>
                    <option value="">اختر...</option>
                    <option value="petrol">بنزين</option>
                    <option value="diesel">ديزل</option>
                    <option value="hybrid">هايبرد</option>
                    <option value="electric">كهربائي</option>
                    <option value="gas">گاز</option>
                  </CustomSelect>
                </Field>
                <Field label="ناقل الحركة">
                  <CustomSelect value={vf.transmission} onChange={e => setVf({...vf,transmission:e.target.value})}>
                    <option value="">اختر...</option>
                    <option value="automatic">أوتوماتيك</option>
                    <option value="manual">يدوي</option>
                    <option value="cvt">CVT</option>
                  </CustomSelect>
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="المسافة (كم)">
                  <input type="number" value={vf.mileage} onChange={e=>setVf({...vf,mileage:e.target.value})} className={inp} placeholder="0" />
                </Field>
                <Field label="اللون">
                  <input value={vf.color} onChange={e=>setVf({...vf,color:e.target.value})} className={inp} placeholder="أبيض" />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="سعة المحرك (لتر)">
                  <input value={vf.engineSize} onChange={e=>setVf({...vf,engineSize:e.target.value})} className={inp} placeholder="2.0" />
                </Field>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-bold text-text">معلومات السعر والموقع</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="المحافظة *">
                  <CustomSelect required value={vf.governorate} onChange={e=>setVf({...vf,governorate:e.target.value})}>
                    <option value="">اختر...</option>
                    {governorates.map(g=><option key={g.id} value={g.name}>{g.name}</option>)}
                  </CustomSelect>
                </Field>
                <Field label="المنطقة">
                  <CustomSelect value={vf.location || ''} onChange={e=>setVf({...vf,location:e.target.value})}>
                    <option value="">اختر...</option>
                    {vf.governorate ? (
                      <>
                        <option value={vf.governorate}>{vf.governorate} (المحافظة)</option>
                        {getCitiesOf(vf.governorate).filter(c => c !== vf.governorate).map(c => <option key={c} value={c}>{c}</option>)}
                      </>
                    ) : <option value="" disabled>اختر المحافظة أولًا</option>}
                  </CustomSelect>
                </Field>
              </div>
              <button type="button" onClick={useVehicleLocation} disabled={locating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-orange/40 text-orange text-sm font-bold hover:bg-orange/5 disabled:opacity-60 transition-colors">
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                {locating ? "جارٍ تحديد موقعك..." : "استخدام موقعي الحالي"}
              </button>

              {/* نوع الإعلان: بيع / إيجار */}
              {type !== "spare-part" && (
                <Field label="نوع الإعلان">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setVf({...vf, listingType: "sell"})}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${vf.listingType === "sell" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>بيع</button>
                    <button type="button" onClick={() => setVf({...vf, listingType: "rent"})}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${vf.listingType === "rent" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>إيجار</button>
                  </div>
                </Field>
              )}

              {vf.listingType === "sell" ? (
                <>
                  {vf.priceType !== "call" && vf.priceType !== "sold" && (
                    <Field label="السعر (جنيه) *">
                      <input ref={priceRef} required type="text" inputMode="numeric" dir="ltr" value={vf.price ? thFormat(vf.price) : ""} onChange={e=>setVf({...vf,price:numDigits(e.target.value)})} className={`${inp} text-right`} placeholder="مثال: 1,000,000" />
                    </Field>
                  )}
                  <Field label="نوع السعر">
                    <div className="grid grid-cols-2 sm:flex gap-2">
                      <button type="button" onClick={() => { setVf({...vf, priceType: "fixed"}); setTimeout(() => priceRef.current?.focus(), 0); }}
                        className={`flex-1 min-w-0 py-2.5 px-1 rounded-xl text-xs sm:text-sm font-bold border-2 transition-colors ${vf.priceType === "fixed" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>سعر ثابت</button>
                      <button type="button" onClick={() => { setVf({...vf, priceType: "negotiable"}); setTimeout(() => priceRef.current?.focus(), 0); }}
                        className={`flex-1 min-w-0 py-2.5 px-1 rounded-xl text-xs sm:text-sm font-bold border-2 transition-colors ${vf.priceType === "negotiable" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>قابل للتفاوض</button>
                      <button type="button" onClick={() => { setVf({...vf, priceType: "call", price: ""})}}
                        className={`flex-1 min-w-0 py-2.5 px-1 rounded-xl text-xs sm:text-sm font-bold border-2 transition-colors ${vf.priceType === "call" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>عند التواصل</button>
                    </div>
                  </Field>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="السعر اليومي">
                      <input inputMode="numeric" dir="ltr" value={vf.dailyPrice ? thFormat(vf.dailyPrice) : ""} onChange={e=>setVf({...vf,dailyPrice:numDigits(e.target.value)})} className={`${inp} text-right`} placeholder="0" />
                    </Field>
                    <Field label="السعر الأسبوعي">
                      <input inputMode="numeric" dir="ltr" value={vf.weeklyPrice ? thFormat(vf.weeklyPrice) : ""} onChange={e=>setVf({...vf,weeklyPrice:numDigits(e.target.value)})} className={`${inp} text-right`} placeholder="0" />
                    </Field>
                    <Field label="السعر الشهري">
                      <input inputMode="numeric" dir="ltr" value={vf.monthlyPrice ? thFormat(vf.monthlyPrice) : ""} onChange={e=>setVf({...vf,monthlyPrice:numDigits(e.target.value)})} className={`${inp} text-right`} placeholder="0" />
                    </Field>
                  </div>
                  <Field label="تأمين (اختياري)">
                    <input inputMode="numeric" dir="ltr" value={vf.deposit ? thFormat(vf.deposit) : ""} onChange={e=>setVf({...vf,deposit:numDigits(e.target.value)})} className={`${inp} text-right`} placeholder="0" />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <Field label="متاح من">
                      <input type="date" value={vf.availableFrom} onChange={e=>setVf({...vf,availableFrom:e.target.value})} className={inp} />
                    </Field>
                    <Field label="متاح إلى">
                      <input type="date" value={vf.availableTo} onChange={e=>setVf({...vf,availableTo:e.target.value})} className={inp} />
                    </Field>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-bg rounded-xl">
                    <input type="checkbox" id="insuranceRequired" checked={vf.insuranceRequired} onChange={e=>setVf({...vf,insuranceRequired:e.target.checked})}
                      className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
                    <label htmlFor="insuranceRequired" className="text-sm font-bold text-text cursor-pointer">مطلوب تأمين</label>
                  </div>
                </>
              )}
            </div>

            <div className="bg-surface rounded-2xl border border-border p-5">
              <h3 className="font-bold text-text mb-3">صور الإعلان</h3>
              <ImageUploader images={vf.images} onChange={images => setVf({...vf, images})} max={15} />
              <div className="mt-4 mb-3">
                <h3 className="font-bold text-text mb-3">فيديو الإعلان</h3>
                <VideoUploader value={vf.videoUrl} onChange={videoUrl => setVf({...vf, videoUrl})} phone={vf.contactPhone || user.phone || ''} label={vf.advertiserName || ''} />
              </div>
              <Field label="وصف الإعلان">
                <textarea rows={4} value={vf.description}
                  onChange={e => setVf(v => ({ ...v, description: e.target.value }))}
                  className={`${inp} resize-none`} placeholder="اكتب وصفاً تفصيلياً للحالة والمواصفات..." />
              </Field>
              <Field label="اسم المعلن (معرض أو فرد)">
                <input value={vf.advertiserName} onChange={e=>setVf({...vf,advertiserName:e.target.value})} className={inp} placeholder="مثال: معرض النور للشاحنات" />
              </Field>
              <Field label="رقم هاتف التواصل (اختياري)">
                <input value={vf.contactPhone} onChange={e=>setVf({...vf,contactPhone:e.target.value})} className={inp} placeholder="01000000000" />
              </Field>
              <Field label="رقم واتساب (اختياري)" hint="لو مختلف عن رقم الاتصال — علّمه هنا، وإلا هنستخدم رقم البروفايل">
                <input value={vf.whatsappPhone || ""} onChange={e=>setVf({...vf,whatsappPhone:e.target.value})} className={inp} placeholder={user?.whatsapp || "01000000000"} />
              </Field>
            </div>
          </>
        )}

        {/* ── LOAD ─────────────────────────────────── */}
        {type === "load" && (
          <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl">
              <input type="checkbox" id="intlLoad" checked={lf.international || false} onChange={e=>setLf({...lf,international:e.target.checked})}
                className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
              <label htmlFor="intlLoad" className="text-sm font-bold text-text cursor-pointer">🌍 نقل خارج مصر</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label={lf.international ? 'من (الدولة)' : 'من (المدينة) *'}><input required value={lf.origin} onChange={e=>setLf({...lf,origin:e.target.value})} className={inp} placeholder={lf.international ? 'السعودية' : 'القاهرة'} /></Field>
              <Field label={lf.international ? 'إلى (الدولة)' : 'إلى (المدينة) *'}><input required value={lf.destination} onChange={e=>setLf({...lf,destination:e.target.value})} className={inp} placeholder={lf.international ? 'الإمارات' : 'الإسكندرية'} /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label="نوع الحمولة">
                <CustomSelect value={lf.cargoType} onChange={e=>setLf({...lf,cargoType:e.target.value})}>
                  <option value="">اختر...</option>
                  {cargoTypes.map(c=><option key={c} value={c}>{c}</option>)}
                </CustomSelect>
              </Field>
              <Field label="نوع العربية المطلوبة">
                <CustomSelect value={lf.vehicleType} onChange={e=>setLf({...lf,vehicleType:e.target.value})}>
                  <option value="">أي عربية</option>
                  {loadVehicleTypes.map(v=><option key={v} value={v}>{v}</option>)}
                </CustomSelect>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Field label="الوزن (طن)"><input type="number" value={lf.weight} onChange={e=>setLf({...lf,weight:e.target.value})} className={inp} placeholder="20" /></Field>
              {lf.priceType !== "call" && lf.priceType !== "sold" && (
                <Field label="الأجرة (جنيه)"><input type="text" inputMode="numeric" dir="ltr" value={lf.price ? thFormat(lf.price) : ""} onChange={e=>setLf({...lf,price:numDigits(e.target.value)})} className={`${inp} text-right`} placeholder="5000" /></Field>
              )}
              <Field label="نوع الأجرة">
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setLf({...lf, priceType: "fixed"})}
                    className={`flex-1 min-w-0 py-2.5 px-1 rounded-xl text-xs sm:text-sm font-bold border-2 transition-colors ${lf.priceType === "fixed" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>أجرة محددة</button>
                  <button type="button" onClick={() => setLf({...lf, priceType: "negotiable"})}
                    className={`flex-1 min-w-0 py-2.5 px-1 rounded-xl text-xs sm:text-sm font-bold border-2 transition-colors ${lf.priceType === "negotiable" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>قابلة للتفاوض</button>
                  <button type="button" onClick={() => setLf({...lf, priceType: "call", price: ""})}
                    className={`flex-1 min-w-0 py-2.5 px-1 rounded-xl text-xs sm:text-sm font-bold border-2 transition-colors ${lf.priceType === "call" ? "border-orange bg-orange/5 text-orange" : "border-border text-text-light"}`}>عند التواصل</button>
                </div>
              </Field>
              <Field label="تاريخ الشحن"><input type="date" value={lf.date} onChange={e=>setLf({...lf,date:e.target.value})} className={inp} /></Field>
            </div>
            {/* Load type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label="نوع الرحلة">
                <CustomSelect value={lf.loadType} onChange={e=>setLf({...lf,loadType:e.target.value as 'single'|'period'})}>
                  <option value="single">رحلة واحدة</option>
                  <option value="period">لفترة (تعاقد)</option>
                </CustomSelect>
              </Field>
              {lf.loadType === 'period' && (
                <Field label="عدد الأيام"><input type="number" min="1" value={lf.periodDays} onChange={e=>setLf({...lf,periodDays:e.target.value})} className={inp} placeholder="30" /></Field>
              )}
            </div>
            {/* Return load */}
            <div className="flex items-center gap-3 p-3 bg-bg rounded-xl">
              <input type="checkbox" id="returnLoad" checked={lf.isReturnLoad} onChange={e=>setLf({...lf,isReturnLoad:e.target.checked})}
                className="w-5 h-5 rounded border-gray-300 text-orange focus:ring-orange" />
              <label htmlFor="returnLoad" className="text-sm font-bold text-text cursor-pointer">هذه حمولة رجعة (السائق فاضي وراجع)</label>
            </div>
            {lf.isReturnLoad && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pr-7">
                <Field label="من (للرجعة)">
                  <input value={lf.returnOrigin} onChange={e=>setLf({...lf,returnOrigin:e.target.value})} className={inp} placeholder="المدينة الحالية" />
                </Field>
                <Field label="إلى (للرجعة)">
                  <input value={lf.returnDestination} onChange={e=>setLf({...lf,returnDestination:e.target.value})} className={inp} placeholder="المدينة المطلوبة" />
                </Field>
              </div>
            )}
            {/* Extra details */}
            <div className="border-t border-border pt-4 mt-2">
              <p className="text-xs font-bold text-text-light mb-3">تفاصيل إضافية (اختياري)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="رقم هاتف بديل">
                  <input value={lf.secondaryPhone} onChange={e=>setLf({...lf,secondaryPhone:e.target.value})} className={inp} placeholder="01000000000" />
                </Field>
                <Field label="رقم هاتف التواصل (اختياري)">
                  <input value={lf.contactPhone} onChange={e=>setLf({...lf,contactPhone:e.target.value})} className={inp} placeholder="01000000000" />
                </Field>
                <Field label="رقم واتساب (اختياري)" hint="لو مختلف عن رقم الاتصال — وإلا هنستخدم رقم البروفايل">
                  <input value={lf.whatsappPhone || ""} onChange={e=>setLf({...lf,whatsappPhone:e.target.value})} className={inp} placeholder={user?.whatsapp || "01000000000"} />
                </Field>
                <Field label="وقت التحميل">
                  <input type="time" value={lf.loadingTime} onChange={e=>setLf({...lf,loadingTime:e.target.value})} className={inp} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
                <Field label="عنوان التحميل (إذا غير المحافظة)">
                  <input value={lf.pickupAddress} onChange={e=>setLf({...lf,pickupAddress:e.target.value})} className={inp} placeholder="شارع، منطقة، حي..." />
                </Field>
                <Field label="عنوان التسليم (إذا غير المحافظة)">
                  <input value={lf.deliveryAddress} onChange={e=>setLf({...lf,deliveryAddress:e.target.value})} className={inp} placeholder="شارع، منطقة، حي..." />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
                <Field label="شروط الدفع">
                  <input value={lf.paymentTerms} onChange={e=>setLf({...lf,paymentTerms:e.target.value})} className={inp} placeholder="نقداً، تحويل، كاش..." />
                </Field>
                <Field label="تعليمات التحميل">
                  <input value={lf.loadingInstructions} onChange={e=>setLf({...lf,loadingInstructions:e.target.value})} className={inp} placeholder="كرتون, بالات, سائل..." />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="وصف إضافي">
                  <textarea rows={2} value={lf.description} onChange={e=>setLf({...lf,description:e.target.value})}
                    className={`${inp} resize-none`} placeholder="أي تفاصيل إضافية عن الحمولة..." />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* ── JOB ──────────────────────────────────── */}
        {type === "job" && (
          <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
            <Field label="المسمى الوظيفي *"><input required value={jf.title} onChange={e=>setJf({...jf,title:e.target.value})} className={inp} placeholder="سائق شاحنة ثقيلة" /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label="نوع الإعلان">
                <CustomSelect value={jf.jobPostType} onChange={e=>setJf({...jf,jobPostType:e.target.value})}>
                  <option value="available">فرد يبحث عن عمل</option>
                  <option value="hire">شركة أو مؤسسة تطلب موظفين</option>
                </CustomSelect>
              </Field>
              <Field label="التخصص">
                <CustomSelect value={jf.jobType} onChange={e=>setJf({...jf,jobType:e.target.value})}>
                  {jobTypesList.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}
                </CustomSelect>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label="الشركة / اسم المتقدم"><input value={jf.company} onChange={e=>setJf({...jf,company:e.target.value})} className={inp} placeholder="اسم الشركة أو اسمك" /></Field>
              <Field label="المحافظة *">
                <CustomSelect required value={jf.governorate} onChange={e=>setJf({...jf,governorate:e.target.value})}>
                  <option value="">اختر...</option>
                  {governorates.map(g=><option key={g.id} value={g.name}>{g.name}</option>)}
                </CustomSelect>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Field label="الراتب / المرتب"><input value={jf.salary} onChange={e=>setJf({...jf,salary:e.target.value})} className={inp} placeholder="4000 جنيه + عمولة" /></Field>
              <Field label="سنوات الخبرة"><input value={jf.experience} onChange={e=>setJf({...jf,experience:e.target.value})} className={inp} placeholder="3 سنوات فأكثر" /></Field>
            </div>
            <Field label="تفاصيل">
              <textarea rows={4} value={jf.description} onChange={e=>setJf({...jf,description:e.target.value})}
                className={`${inp} resize-none`} placeholder="المهام والمتطلبات أو نبذة عن خبراتك..." />
            </Field>
            <Field label="رقم هاتف التواصل (اختياري)">
              <input value={jf.contactPhone} onChange={e=>setJf({...jf,contactPhone:e.target.value})} className={inp} placeholder="01000000000" />
            </Field>
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading}
          className="w-full h-12 bg-orange hover:bg-orange-dark disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري النشر...</> : "نشر الإعلان"}
        </button>
      </form>
    </div>
  );
}

// helper
const inp = "w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-bg focus:outline-none focus:border-orange";
const sel = "w-full appearance-none border border-border rounded-xl pr-4 pl-10 py-2.5 text-sm bg-bg focus:outline-none focus:border-orange cursor-pointer";

const numDigits = (v: string) => v.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^\d]/g, "");
const thFormat = (v: string) => numDigits(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-light mt-1">{hint}</p>}
    </div>
  );
}

// select مخصص بهوية الموقع — يشيل شكل المتصفح الافتراضي ويحط سهم برتقالي بدل الأزرق
function CustomSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={sel}>
        {props.children}
      </select>
      <ChevronDown className="w-4 h-4 text-orange absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}



