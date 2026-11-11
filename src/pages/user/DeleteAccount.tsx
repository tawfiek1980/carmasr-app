import { Link, useNavigate } from 'react-router-dom';
import { Trash2, AlertTriangle, ChevronLeft, Loader2, LogIn, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { firebaseAuth } from '../../firebase';
import { getApiUrl } from '../../lib/config';

const SUPPORT_EMAIL = 'tawfiek.fayez@gmail.com';
const DELETE_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('طلب حذف حساب - كار مصر CarMasr')}&body=${encodeURIComponent('أرغب في حذف حسابي وكل بياناتي من تطبيق كار مصر CarMasr.\n\nرقم الموبايل المسجل:\nالبريد الإلكتروني المسجل:\n')}`;

export default function DeleteAccount() {
  const [step, setStep] = useState(1);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${getApiUrl()}/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('فشل حذف الحساب');
      logout();
      navigate('/');
    } catch (err) {
      alert('حدث خطأ أثناء حذف الحساب. حاول مرة أخرى.');
      setDeleting(false);
    }
  };

  const header = (
    <div className="bg-navy text-white py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link to="/" className="hover:text-orange">الرئيسية</Link>
          <ChevronLeft className="w-4 h-4 rtl-flip" />
          <span className="text-gray-300">حذف الحساب</span>
        </nav>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-danger/20 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-danger" />
          </div>
          <h1 className="text-2xl font-bold">حذف الحساب</h1>
        </div>
      </div>
    </div>
  );

  // صفحة عامة (بدون تسجيل دخول) — مطلوبة لسياسة Google Play
  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        {header}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange" />
        </div>
      </div>
    );
  }

  const isLoggedIn = !!user || !!firebaseAuth.currentUser;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-bg pb-20 sm:pb-8">
        {header}
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <div className="bg-surface rounded-2xl border border-border p-6">
            <h2 className="font-bold text-text mb-2">حذف حسابك وبياناتك من كار مصر CarMasr</h2>
            <p className="text-sm text-text-light leading-relaxed">
              يمكنك حذف حسابك وكل بياناتك نهائيًا في أي وقت. الحذف يشمل الإعلانات، الحمولات،
              الوظائف، المحادثات، الإشعارات، بيانات ورديات العمل، ومعلومات الحساب.
            </p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-6 space-y-3">
            <h3 className="font-bold text-text">اختر طريقة الحذف</h3>
            <Link
              to="/login?redirect=/delete-account"
              className="flex items-center justify-center gap-2 w-full bg-orange hover:bg-orange-dark text-white py-3 rounded-xl font-bold transition-colors"
            >
              <LogIn className="w-4 h-4" />
              تسجيل الدخول ثم الحذف فورًا
            </Link>
            <a
              href={DELETE_EMAIL_HREF}
              className="flex items-center justify-center gap-2 w-full border border-border hover:border-orange text-text py-3 rounded-xl font-semibold transition-colors"
            >
              <Mail className="w-4 h-4" />
              طلب الحذف عبر البريد الإلكتروني
            </a>
            <p className="text-[11px] text-text-light text-center leading-relaxed">
              طلبات الحذف عبر البريد تُنفَّذ خلال 7 أيام عمل كحد أقصى من التحقق من ملكية الحساب.
            </p>
          </div>

          <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-danger mb-2">ماذا سيتم حذفه؟</h3>
                <ul className="text-sm text-text-light space-y-1">
                  <li>• جميع إعلاناتك وبيانات الحمولات والوظائف.</li>
                  <li>• المحادثات والإشعارات والمفضلات.</li>
                  <li>• بيانات ورديات العمل (حاسبة الوردية) والمصاريف.</li>
                  <li>• معلومات الحساب والتقييمات وتاريخ المعاملات.</li>
                </ul>
                <p className="text-xs text-text-light mt-2">
                  قد نحتفظ ببعض سجلات المعاملات للمدة التي يفرضها القانون المصري فقط.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      {header}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {deleting ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-danger mb-4" />
            <p className="text-text-light">جاري حذف الحساب...</p>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-danger mb-2">تحذير: هذا الإجراء لا يمكن التراجع عنه</h2>
                  <ul className="text-sm text-text-light space-y-1">
                    <li>• ستُحذف جميع إعلاناتك النشطة فوراً.</li>
                    <li>• ستُحذف جميع بياناتك بما في ذلك المحادثات والإشعارات.</li>
                    <li>• لن تتمكن من استعادة حسابك بعد الحذف.</li>
                    <li>• ستفقد تاريخ معاملاتك وتقييماتك.</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="font-bold text-text mb-3">قبل الحذف، هل جربت؟</h2>
              <div className="space-y-2">
                <Link to="/settings" className="block text-sm text-text-light hover:text-orange py-1">• تعطيل الإشعارات من إعدادات الحساب</Link>
                <Link to="/my-listings" className="block text-sm text-text-light hover:text-orange py-1">• إيقاف إعلاناتك مؤقتاً</Link>
                <Link to="/support" className="block text-sm text-text-light hover:text-orange py-1">• التواصل مع الدعم لحل أي مشكلة</Link>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to="/settings" className="flex-1 text-center border border-border hover:border-orange text-text py-3 rounded-xl font-semibold transition-colors">إلغاء</Link>
              <button onClick={() => setStep(2)} className="flex-1 bg-danger hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-colors">أريد حذف حسابي</button>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-bold text-text">للتأكيد، اكتب "حذف حسابي" في المربع أدناه:</h2>
            <input value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-danger" placeholder="اكتب: حذف حسابي" />
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-border text-text py-3 rounded-xl font-semibold hover:border-orange transition-colors">رجوع</button>
              <button disabled={confirm !== 'حذف حسابي'} onClick={handleDelete} className="flex-1 bg-danger disabled:opacity-40 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-colors">تأكيد الحذف النهائي</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
