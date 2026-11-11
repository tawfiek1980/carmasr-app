import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, Loader2, ChevronLeft, CheckCircle, DollarSign, Info, Megaphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { firebaseAuth } from '../firebase';
import { getApiUrl } from '../lib/config';

const POSITIONS = [
  { id: 'home_top' as const, label: 'أعلى الصفحة الرئيسية', price: 3000, desc: 'يظهر في أعلى الصفحة الرئيسية - أعلى ظهور' },
  { id: 'home_bottom' as const, label: 'أسفل الصفحة الرئيسية', price: 2000, desc: 'يظهر في أسفل الصفحة الرئيسية' },
  { id: 'listing_detail' as const, label: 'داخل الإعلانات', price: 1500, desc: 'يظهر في صفحة تفاصيل الإعلان' },
  { id: 'sidebar' as const, label: 'الشريط الجانبي', price: 1000, desc: 'يظهر في الشريط الجانبي للأقسام' },
  { id: 'category_top' as const, label: 'أعلى الأقسام', price: 2500, desc: 'يظهر في أعلى صفحة كل قسم' },
];

export default function BannerAds() {
  const { user } = useAuth();
  const [position, setPosition] = useState<string>('home_top');
  const [companyName, setCompanyName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedPos = POSITIONS.find(p => p.id === position) || POSITIONS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) return;

    setProcessing(true);
    setResult(null);
    try {
      const token = await firebaseAuth.currentUser?.getIdToken();
      if (!token) throw new Error('يجب تسجيل الدخول');

      const resp = await fetch(`${getApiUrl()}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create',
          type: 'banner_ad',
          amount: selectedPos.price,
          metadata: { position, companyName, linkUrl },
        }),
      });

      const data = await resp.json();
      if (!data.success) throw new Error(data.message);

      setResult({ success: true, message: data.message || 'تم تقديم طلب الإعلان' });
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'حدث خطأ' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-gradient-to-l from-purple-700 to-purple-900 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-white/60 mb-6">
            <Link to="/" className="hover:text-white">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-white">الإعلانات المدفوعة</span>
          </nav>
          <h1 className="text-2xl font-bold">الإعلانات المدفوعة</h1>
          <p className="text-white/70 text-sm mt-1">أوصِل علامتك التجارية إلى آلاف المستخدمين يومياً</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {result?.success ? (
          <div className="bg-success/10 border border-success/20 rounded-2xl p-8 text-center">
            <CheckCircle className="w-14 h-14 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">تم تقديم الطلب!</h2>
            <p className="text-text-light text-sm mb-6">{result.message}</p>
            <Link to="/"
              className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">
              العودة للرئيسية
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {POSITIONS.map(p => (
                <button key={p.id} type="button" onClick={() => setPosition(p.id)}
                  className={`rounded-2xl border-2 p-4 text-right transition-all ${
                    position === p.id ? 'border-purple-500 shadow-lg shadow-purple-10' : 'border-border bg-surface hover:border-purple-300'
                  }`}>
                  <Megaphone className={`w-8 h-8 mb-2 ${position === p.id ? 'text-purple-600' : 'text-gray-400'}`} />
                  <p className="font-bold text-text text-sm mb-1">{p.label}</p>
                  <p className="font-bold text-purple-600">{p.price.toLocaleString('ar-EG')} <span className="text-xs text-text-light font-normal">جنيه</span></p>
                  <p className="text-xs text-text-light mt-1">{p.desc}</p>
                </button>
              ))}
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
              <h2 className="font-bold text-text mb-2">بيانات الإعلان</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">اسم الشركة *</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)} required
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                    placeholder="اسم الشركة أو النشاط" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1">رابط الموقع (اختياري)</label>
                  <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} dir="ltr"
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                    placeholder="https://example.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text mb-1">صورة الإعلان</label>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                  <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-text-light">سيتم التواصل معك لرفع الصورة بعد تأكيد الدفع</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mt-6 flex items-start gap-3">
              <Info className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-700">
                مدة الإعلان 30 يوماً من تاريخ التفعيل. سيتم مراجعة الإعلان قبل النشر للتأكد من مطابقته للسياسات.
              </p>
            </div>

            <button type="submit" disabled={processing || !companyName}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3.5 rounded-2xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-6">
              {processing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> جاري...</>
              ) : (
                <><DollarSign className="w-5 h-5" /> طلب إعلان - {selectedPos.price.toLocaleString('ar-EG')} جنيه</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
