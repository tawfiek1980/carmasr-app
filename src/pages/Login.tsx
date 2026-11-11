import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { signInWithGoogle } from "../auth/googleAuth";
import { useAuth } from "../contexts/AuthContext";
import { trackEvent } from "../lib/analytics";
import { getUserFromDB, syncAdminClaim } from "../lib/userService";
import { Loader2, Phone, Lock, Eye, EyeOff } from "lucide-react";

type LoginMode = "phone" | "google";

const normalizePhone = (phone: string) => {
  const d = phone.replace(/[^\d]/g, "");
  if (d.length === 12 && d.startsWith("2")) return d.slice(1);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
};
const phoneToEmail = (phone: string) => `phone_${normalizePhone(phone)}@carmasr.app`;

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  // رجوع لصفحة معيّنة بعد تسجيل الدخول (مثال: /login?redirect=/delete-account)
  const redirectParam = searchParams.get("redirect") || "";
  const redirectTo =
    redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : "/";

  const [mode, setMode] = useState<LoginMode>("phone");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState("");

  const handlePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (normalized.length < 10) {
      setError("أدخل رقم موبايل صحيح (مثال: 01000000000)");
      return;
    }
    if (!password) {
      setError("أدخل كلمة المرور");
      return;
    }
    try {
      setLoadingPhone(true); setError("");
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        phoneToEmail(normalized),
        password
      );
      const dbUser = await getUserFromDB(credential.user.uid);
      const fallback: any = {
        id: credential.user.uid,
        name: credential.user.displayName || "مستخدم جديد",
        email: phoneToEmail(normalized),
        phone: normalized,
        governorate: "",
        type: "individual",
        avatar: credential.user.photoURL || "",
        verified: credential.user.emailVerified,
        createdAt: new Date().toISOString(),
      };
      const fd = dbUser || fallback;
      // صلاحية الأدمن تُمنح سيرفريًا (Custom Claim) — لو الرقم/الإيميل مصرّح به
      if (await syncAdminClaim()) fd.type = "admin";
      const user = fd;
      trackEvent('login', { method: 'phone' });
      login(user);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      console.error("🔴 Login.tsx phone error:", err?.code, err?.message);
      const msgs: Record<string, string> = {
        'auth/invalid-credential': 'بيانات الدخول غير صحيحة',
        'auth/user-not-found': 'لا يوجد حساب بهذا الرقم',
        'auth/wrong-password': 'كلمة المرور غير صحيحة',
        'auth/too-many-requests': 'محاولات كثيرة… حاول بعد قليل',
        'auth/invalid-email': 'رقم الهاتف غير صحيح',
      };
      const c = err?.code;
      if (msgs[c]) setError(msgs[c]);
      else if (c === "auth/network-request-failed") setError("تعذر الاتصال بالإنترنت — تحقق من الشبكة");
      else if (c === "auth/operation-not-allowed") setError("طريقة الدخول غير مفعلة");
      else if (c === "auth/configuration-not-found") setError("خطأ في إعدادات النظام");
      else setError(`حدث خطأ أثناء تسجيل الدخول (${c || "غير معروف"})`);
    } finally { setLoadingPhone(false); }
  };

  const handleGoogle = async () => {
    try {
      setLoadingGoogle(true); setError("");
      const user = await signInWithGoogle();
      if (user?.id) {
        trackEvent('login', { method: 'google' });
        login(user); navigate(redirectTo, { replace: true });
      } else {
        setError("لم يتم استلام بيانات المستخدم. حاول مرة أخرى.");
      }
    } catch (err: any) {
      const msg = err?.message || err?.code || String(err);
      console.error("🔴 Login.tsx Google error:", err);
      setError("خطأ: " + msg);
    } finally { setLoadingGoogle(false); }
  };

  const tabBase = "flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors";
  const tabInactive = "text-gray-400 hover:text-gray-600";

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8 pb-24 sm:pb-8">

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-border overflow-hidden">

          <div className="bg-navy p-6 text-center">
            <Link to="/" className="inline-flex items-center gap-3 mb-3">
              <img src="/tareeq-logo.png" alt="كار مصر" className="h-14 w-14 object-contain" />
            </Link>
            <h1 className="text-xl font-bold text-white">تسجيل الدخول</h1>
            <p className="text-gray-400 text-xs mt-1">سوق النقل الثقيل الأول في مصر</p>
          </div>

          <div className="p-6">
            <div className="flex gap-1 bg-bg rounded-xl p-1 mb-5">
              <button
                type="button"
                onClick={() => { setMode("phone"); setError(""); }}
                className={`${tabBase} ${mode === "phone" ? "bg-white text-navy shadow-sm" : tabInactive}`}
              >
                <span className="inline-flex items-center gap-1.5"><Phone className="w-4 h-4" /> الموبايل</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode("google"); setError(""); }}
                className={`${tabBase} ${mode === "google" ? "bg-white text-navy shadow-sm" : tabInactive}`}
              >
                Google
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4 text-center">
                {error}
              </div>
            )}

            {mode === "phone" && (
              <form onSubmit={handlePhone} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">رقم الموبايل *</label>
                  <div className="relative">
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange" />
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-12 pr-12 pl-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-left"
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-text mb-1.5">كلمة المرور *</label>
                  <div className="relative">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-light" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 pr-12 pl-12 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-left"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light hover:text-text"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loadingPhone}
                  className="w-full flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark disabled:bg-gray-300 text-white py-3.5 rounded-xl font-bold transition-colors"
                >
                  {loadingPhone ? <Loader2 className="w-5 h-5 animate-spin" /> : "دخول بالموبايل"}
                </button>
              </form>
            )}

            {mode === "google" && (
              <>
                <button onClick={handleGoogle} disabled={loadingGoogle}
                  className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 py-3.5 rounded-xl transition-all disabled:opacity-50 font-semibold shadow-sm hover:shadow">
                  {loadingGoogle ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  {loadingGoogle ? "جارٍ تسجيل الدخول…" : "الدخول بحساب Google"}
                </button>
                <p className="mt-3 text-center text-xs text-text-light">
                  بدون كلمة مرور — استخدم حسابك في Google مباشرة
                </p>
              </>
            )}

            <p className="mt-6 text-center text-text-light text-xs leading-relaxed">
              بتسجيل دخولك، أنت توافق على{" "}
              <Link to="/terms" className="text-orange hover:underline">شروط الاستخدام</Link>
              {" "}و{" "}
              <Link to="/privacy-policy" className="text-orange hover:underline">سياسة الخصوصية</Link>
            </p>

            <div className="mt-5 pt-5 border-t border-border text-center">
              <p className="text-text-light text-sm mb-3">
                ليس لديك حساب؟{" "}
                <Link to="/register" className="text-orange font-bold hover:underline">إنشاء حساب مجاني</Link>
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link to="/help" className="text-text-light hover:text-orange text-xs transition-colors">مركز المساعدة</Link>
                <Link to="/support" className="text-text-light hover:text-orange text-xs transition-colors">الدعم</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}