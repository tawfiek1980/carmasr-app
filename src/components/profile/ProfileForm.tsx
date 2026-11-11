// ProfileForm.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { completeProfile } from "../../lib/userService";
import type { User } from "../../types";

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر تحويل الصورة"));
    reader.readAsDataURL(blob);
  });

const processAvatarFile = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("صورة غير صالحة"));
      img.onload = () => {
        const size = 400;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("التعامل مع الصورة غير مدعوم")); return; }
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("لا يمكن ضغط الصورة"))),
          "image/jpeg",
          0.82
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
};

interface Props {
  saving: boolean;
  setSaving: (value: boolean) => void;
}

const accountTypes: { value: User["type"]; label: string }[] = [
  { value: "individual", label: "مستخدم" },
  { value: "seller", label: "بائع" },
  { value: "driver", label: "سائق" },
  { value: "dealer", label: "معرض" },
  { value: "workshop", label: "ورشة" },
  { value: "finance", label: "تمويل" },
];

const governorates = [
  "القاهرة", "الإسكندرية", "الجيزة", "القليوبية", "البحيرة",
  "المنوفية", "الغربية", "كفر الشيخ", "الشرقية", "الدقهلية",
  "دمياط", "بورسعيد", "الإسماعيلية", "السويس", "شمال سيناء",
  "جنوب سيناء", "البحر الأحمر", "مطروح", "الفيوم", "بني سويف",
  "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "الوادي الجديد"
];

const drivingTypes = [
  "رخصة مهنية أولى",
  "رخصة مهنية ثانية",
  "رخصة مهنية ثالثة",
  "رخصة خاصة",
  "سيارات"
];

export default function ProfileForm({ saving, setSaving }: Props) {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || "");
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [governorate, setGovernorate] = useState(user?.governorate || "");
  const [city, setCity] = useState(user?.city || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [currentLocation, setCurrentLocation] = useState(user?.currentLocation || "");
  const [type, setType] = useState<User["type"]>(user?.type && user.type !== "admin" ? user.type : "individual");
  
  // Dynamic fields
  const [drivingType, setDrivingType] = useState(user?.drivingType || "");
  const [experienceYears, setExperienceYears] = useState(user?.experienceYears?.toString() || "");
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [specialization, setSpecialization] = useState(user?.specialization || "");

  useEffect(() => {
    if (sameAsPhone) {
      setWhatsapp(phone);
    }
  }, [phone, sameAsPhone]);

  if (!user) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("الرجاء اختيار ملف صورة");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvatarError("حجم الصورة كبير جداً (الحد الأقصى 8MB)");
      return;
    }
    try {
      setAvatarError("");
      setAvatarUploading(true);
      const blob = await processAvatarFile(file);
      const dataUrl = await blobToDataUrl(blob);
      setAvatar(dataUrl);
    } catch (err: any) {
      setAvatarError(err?.message || "حدث خطأ أثناء رفع الصورة");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !phone || !whatsapp || !governorate || !city) {
      alert("من فضلك أكمل جميع البيانات الأساسية (الاسم، الهاتف، الواتساب، المحافظة، المركز/المدينة).");
      return;
    }

    if (type === "individual" && (!drivingType || !experienceYears)) {
      alert("من فضلك أكمل بيانات السائق (نوع القيادة وسنوات الخبرة).");
      return;
    }

    if (["dealer", "company", "workshop", "finance"].includes(type) && !businessName) {
      alert("من فضلك أدخل اسم النشاط/الشركة.");
      return;
    }

    if (type === "workshop" && !specialization) {
      alert("من فضلك أدخل تخصص مركز الصيانة.");
      return;
    }

    try {
      setSaving(true);

      const profileData: Partial<User> = {
        name,
        phone,
        whatsapp,
        governorate,
        city,
        avatar,
        currentLocation,
        type,
        drivingType: type === "individual" ? drivingType : "",
        experienceYears: type === "individual" ? Number(experienceYears) : 0,
        businessName: ["dealer", "company", "workshop", "finance"].includes(type) ? businessName : "",
        specialization: type === "workshop" ? specialization : "",
      };

      await completeProfile(user.id, profileData);

      const updatedUser: User = {
        ...user,
        ...profileData,
      } as User;

      login(updatedUser);
      alert("تم حفظ البيانات بنجاح");
      navigate("/profile");
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const getBusinessNameLabel = () => {
    switch (type) {
      case "dealer": return "اسم المعرض";
      case "seller": return "اسم الشركة";
      case "workshop": return "اسم المركز";
      case "finance": return "اسم شركة التمويل";
      default: return "اسم النشاط";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700">الاسم الكامل <span className="text-red-500">*</span></label>
          <input
            className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="أدخل اسمك الكامل"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold text-gray-700">نوع الحساب <span className="text-red-500">*</span></label>
          <select
            className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white"
            value={type}
            onChange={(e) => {
              setType(e.target.value as User["type"]);
              setBusinessName("");
              setDrivingType("");
              setExperienceYears("");
              setSpecialization("");
            }}
          >
            {accountTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700">رقم الهاتف <span className="text-red-500">*</span></label>
          <input
            type="tel"
            className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
          />
        </div>

        <div>
          <label className="block mb-2 font-semibold text-gray-700">رقم الواتساب <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              type="tel"
              disabled={sameAsPhone}
              className={`w-full border border-gray-300 rounded-xl p-3 outline-none transition-all ${sameAsPhone ? 'bg-gray-100 text-gray-500' : 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="01xxxxxxxxx"
            />
            <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsPhone}
                onChange={(e) => setSameAsPhone(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              نفس رقم الهاتف
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700">المحافظة <span className="text-red-500">*</span></label>
          <select
            className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white"
            value={governorate}
            onChange={(e) => setGovernorate(e.target.value)}
          >
            <option value="">اختر المحافظة</option>
            {governorates.map((gov) => (
              <option key={gov} value={gov}>
                {gov}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-2 font-semibold text-gray-700">المركز / المدينة <span className="text-red-500">*</span></label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="أدخل المركز أو المدينة"
          />
        </div>
      </div>

      {/* Dynamic Fields Section */}
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-6">
        <h3 className="text-lg font-bold text-gray-800 border-b pb-2">بيانات الحساب الإضافية</h3>
        
        {type === "individual" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">نوع القيادة / الرخصة <span className="text-red-500">*</span></label>
              <select
                className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white"
                value={drivingType}
                onChange={(e) => setDrivingType(e.target.value)}
              >
                <option value="">اختر نوع الرخصة</option>
                {drivingTypes.map((dt) => (
                  <option key={dt} value={dt}>{dt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-2 font-semibold text-gray-700">سنوات الخبرة <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="عدد سنوات الخبرة"
              />
            </div>
          </div>
        )}

        {["dealer", "company", "workshop", "finance"].includes(type) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">{getBusinessNameLabel()} <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={`أدخل ${getBusinessNameLabel()}`}
              />
            </div>
            {type === "workshop" && (
              <div>
                <label className="block mb-2 font-semibold text-gray-700">التخصص <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="مثال: ميكانيكا، كهرباء، عفشة"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700">الصورة الشخصية (اختياري)</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt="الصورة الشخصية" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl text-gray-400">+</span>
              )}
            </div>
            <div className="flex-1">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="w-full border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-3 text-center text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                {avatarUploading ? "جاري رفع الصورة..." : "اختر صورة من جهازك"}
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar("")}
                  className="mt-2 w-full text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  إزالة الصورة
                </button>
              )}
              {avatarError && <p className="mt-2 text-xs text-red-500">{avatarError}</p>}
            </div>
          </div>
        </div>

        <div>
          <label className="block mb-2 font-semibold text-gray-700">الموقع الحالي (اختياري)</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-xl p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            value={currentLocation}
            onChange={(e) => setCurrentLocation(e.target.value)}
            placeholder="مثال: الطريق الدائري، الكيلو 21"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-4 transition-colors shadow-md disabled:bg-blue-400 disabled:cursor-not-allowed"
      >
        {saving ? "جاري الحفظ..." : "حفظ البيانات"}
      </button>

    </form>
  );
}