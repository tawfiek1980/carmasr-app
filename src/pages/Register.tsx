import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Phone, User, MapPin, ArrowLeft, Building2, Lock } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, db } from '../firebase';
import { auth } from '../lib/auth';
import { governorates } from '../lib/data';
import { useAuth } from '../contexts/AuthContext';
import { notifyWhatsApp } from '../lib/notifyWhatsApp';
import { notificationsService } from '../lib/firestoreService';
import { trackEvent, campaignForSignup } from '../lib/analytics';
import { syncAdminClaim } from '../lib/userService';
import type { User as UserType } from '../types';

const userTypes = [
  { id: 'individual', name: 'فرد' },
  { id: 'seller', name: 'بائع' },
  { id: 'driver', name: 'سائق' },
  { id: 'dealer', name: 'معرض' },
  { id: 'workshop', name: 'ورشة' },
  { id: 'finance', name: 'تمويل' },
];

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    type: 'individual',
    governorate: '',
  });

  const normalizePhone = (phone: string) => {
    const d = phone.replace(/[^\d]/g, '');
    if (d.length === 12 && d.startsWith('2')) return d.slice(1);
    if (d.length === 11 && d.startsWith('0')) return d.slice(1);
    return d;
  };
  const phoneToEmail = (phone: string) => `phone_${normalizePhone(phone)}@carmasr.app`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    trackEvent('begin_signup', { method: 'phone', user_type: formData.type });
    try {
      const email = phoneToEmail(formData.phone);

      const credential = await createUserWithEmailAndPassword(
        firebaseAuth, email, formData.password
      );
      const fbUser = credential.user;

      await updateProfile(fbUser, { displayName: formData.name });

      const normalizedPhone = normalizePhone(formData.phone);
      const newUser: UserType = {
        id:          fbUser.uid,
        name:        formData.name,
        email:       email,
        phone:       normalizedPhone,
        governorate: formData.governorate,
        type:        formData.type as UserType['type'],
        verified:    false,
        avatar:      '',
        createdAt:   new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', fbUser.uid), {
        ...newUser,
        ...campaignForSignup(),
        createdAt: serverTimestamp(),
      });

      // صلاحية الأدمن تُمنح سيرفريًا (Custom Claim) وليس بكتابة type من العميل
      if (await syncAdminClaim()) newUser.type = 'admin' as UserType['type'];

      auth.setUser({ ...newUser, ...campaignForSignup() });
      trackEvent('sign_up', {
        method: 'phone',
        user_type: formData.type,
        governorate: formData.governorate,
      });
      notifyWhatsApp('new-user', { name: formData.name, phone: normalizedPhone, type: formData.type, governorate: formData.governorate });
      notificationsService.notifyWelcome(fbUser.uid, formData.name);
      navigate('/');
    } catch (err: any) {
      trackEvent('sign_up_failed', { method: 'phone', error: err.code || 'unknown' });
      const msgs: Record<string, string> = {
        'auth/email-already-in-use': 'رقم الهاتف مسجل بالفعل',
        'auth/weak-password':        'كلمة المرور ضعيفة جداً (6 أحرف على الأقل)',
        'auth/invalid-email':        'البريد الإلكتروني غير صحيح',
      };
      const c = err?.code;
      if (msgs[c]) setError(msgs[c]);
      else if (c === "auth/network-request-failed") setError("تعذر الاتصال بالإنترنت — تحقق من الشبكة");
      else if (c === "auth/operation-not-allowed") setError("طريقة التسجيل غير مفعلة");
      else if (c === "auth/configuration-not-found") setError("خطأ في إعدادات النظام");
      else setError(`حدث خطأ أثناء إنشاء الحساب (${c || "غير معروف"})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 pb-24 sm:pb-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/tareeq-logo.png" alt="كار مصر" className="h-16 w-16 object-contain" />
          </Link>
          <h1 className="text-2xl font-extrabold text-navy mb-2">إنشاء حساب جديد</h1>
          <p className="text-text-light text-sm">انضم إلى أكبر سوق للنقل الثقيل في مصر</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-text mb-1.5">الاسم بالكامل *</label>
              <div className="relative">
                <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-light" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 pr-12 pl-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none"
                  placeholder="الاسم الثلاثي"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-text mb-1.5">رقم الموبايل *</label>
              <div className="relative">
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange" />
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-12 pr-12 pl-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none text-left"
                  placeholder="01xxxxxxxxx"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-text mb-1.5">نوع الحساب *</label>
                <div className="relative">
                  <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-light" />
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full h-12 pr-12 pl-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none appearance-none"
                  >
                    {userTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-text mb-1.5">المحافظة *</label>
                <div className="relative">
                  <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-light" />
                  <select
                    required
                    value={formData.governorate}
                    onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                    className="w-full h-12 pr-12 pl-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none appearance-none"
                  >
                    <option value="">اختر المحافظة</option>
                    {governorates.map((g) => (
                      <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-text mb-1.5">كلمة المرور *</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-light" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

            {/* Legal consent */}
            <p className="text-xs text-text-light leading-relaxed">
              بإنشاء حساب، أنت توافق على{' '}
              <Link to="/terms" className="text-orange hover:underline">شروط الاستخدام</Link>
              {' '}و{' '}
              <Link to="/privacy-policy" className="text-orange hover:underline">سياسة الخصوصية</Link>
              {' '}و{' '}
              <Link to="/community-guidelines" className="text-orange hover:underline">إرشادات المجتمع</Link>
              {' '}الخاصة بمنصة كار مصر.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-orange hover:bg-orange-dark disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <p className="text-text-light text-sm">
              لديك حساب بالفعل؟{' '}
              <Link to="/login" className="text-orange font-bold hover:underline">
                تسجيل الدخول
              </Link>
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link to="/help" className="text-text-light hover:text-orange text-xs transition-colors">مركز المساعدة</Link>
              <Link to="/safety-tips" className="text-text-light hover:text-orange text-xs transition-colors">نصائح الأمان</Link>
              <Link to="/support" className="text-text-light hover:text-orange text-xs transition-colors">الدعم</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}