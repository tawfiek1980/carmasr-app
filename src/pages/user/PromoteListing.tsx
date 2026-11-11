import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Loader2, ChevronLeft, CheckCircle, DollarSign, Clock, Upload, Image as ImageIcon, AlertCircle, Smartphone, Building, ArrowLeft } from 'lucide-react';
import { listingsService } from '../../lib/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { firebaseAuth } from '../../firebase';
import { uploadImage } from '../../lib/storageService';
import { getApiUrl } from '../../lib/config';
import type { Listing } from '../../types';

const FEATURED_PRICE = 100;
const VODAFONE_CASH = '01018870145';
const ACCOUNT_NAME = 'Tawfiek Fayez';
const FEATURES = [
  'يظهر في أول نتائج البحث',
  'وسام "مميز" على الإعلان',
  'يظهر في صفحة الإعلانات المميزة',
  'مدة 30 يوماً من التفعيل',
];
const HOW_TO_PAY = [
  'افتح محفظة فودافون كاش من الكود #9#',
  'اختر "دفع" ثم "محفظة فودافون كاش"',
  'أدخل الرقم: 01018870145',
  'أدخل المبلغ: 100 جنيه',
  'أدخل الرقم السري وأكّد التحويل',
];

export default function PromoteListing() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'info' | 'payment' | 'done'>('info');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [autoApproved, setAutoApproved] = useState(false);

  useEffect(() => {
    if (!id) return;
    listingsService.getById(id)
      .then(setListing)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (!user) { navigate('/login'); return null; }

  const isAdmin = user.type === 'admin';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!proofFile) return;
    setProcessing(true);
    setResult(null);
    try {
      setUploading(true);
      const proofImage = await uploadImage(proofFile, 'documents', user.id);
      setUploading(false);

      const token = await firebaseAuth.currentUser?.getIdToken();
      if (!token) throw new Error('يجب تسجيل الدخول');

      const resp = await fetch(`${getApiUrl()}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create',
          type: 'featured_listing',
          amount: FEATURED_PRICE,
          listingId: id,
          listingTitle: listing?.title,
          proofImage,
          metadata: { phone: user.phone, userName: user.name },
        }),
      });

      const data = await resp.json();
      if (!data.success) throw new Error(data.message);

      setPaymentId(data.paymentId);
      setStep('done');
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'حدث خطأ' });
    } finally {
      setProcessing(false);
    }
  };

  /** تفعيل فوري للأدمن: من غير دفع ولا إثبات — السيرفر بيعتمد الطلب على طول */
  const handleFastPromote = async () => {
    if (!id) return;
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
          type: 'featured_listing',
          amount: FEATURED_PRICE,
          listingId: id,
          listingTitle: listing?.title,
          metadata: { phone: user.phone, userName: user.name },
        }),
      });

      const data = await resp.json();
      if (!data.success) throw new Error(data.message);
      if (!data.autoApproved) throw new Error('الطلب محتاج تأكيد أدمن آخر');

      setPaymentId(data.paymentId);
      setAutoApproved(true);
      setListing((prev) => (prev ? { ...prev, featured: true } : prev));
      setStep('done');
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'حدث خطأ' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-text-light">الإعلان غير موجود</p>
      </div>
    );
  }

  if (listing.userId !== user.id && user.type !== 'admin') {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-gradient-to-l from-orange to-orange-dark py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-white/70 mb-6">
            <Link to="/" className="hover:text-white">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <Link to="/my-listings" className="hover:text-white">إعلاناتي</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-white">ترقية الإعلان</span>
          </nav>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Star className="w-7 h-7 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">ترقية الإعلان</h1>
              <p className="text-white/70 text-sm">اجعل إعلانك مميزاً ووصل لعدد أكبر من المشترين</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {['info', 'payment', 'done'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === s ? 'bg-orange text-white' : 
                ['info', 'payment', 'done'].indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {['info', 'payment', 'done'].indexOf(step) > i ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              {i < 2 && <div className={`w-12 h-0.5 ${['info', 'payment', 'done'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-10 text-xs font-bold mb-6">
          <span className={step === 'info' ? 'text-orange' : 'text-green-500'}>الاشتراك</span>
          <span className={step === 'payment' ? 'text-orange' : step === 'done' ? 'text-green-500' : 'text-gray-400'}>الدفع</span>
          <span className={step === 'done' ? 'text-green-500' : 'text-gray-400'}>تأكيد</span>
        </div>

        {/* Step 1: Info + Payment Instructions */}
        {step === 'info' && (
          <>
            <div className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-3">
              {listing.images?.[0] && (
                <img src={listing.images[0]} alt="" className="w-16 h-12 object-cover rounded-xl flex-shrink-0" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text text-sm">{listing.title}</p>
                <p className="text-text-light text-xs">{listing.price?.toLocaleString('ar-EG')} جنيه</p>
              </div>
              {listing.featured && (
                <span className="text-xs bg-orange/10 text-orange font-bold px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                  <Star className="w-3 h-3 fill-orange" /> مميز حالياً
                </span>
              )}
            </div>

            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="bg-gradient-to-l from-orange to-orange-dark p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 fill-white" />
                  <h2 className="font-bold text-lg">باقة التميز</h2>
                </div>
                <p className="text-white/80 text-sm">مدّة 30 يوماً من التفعيل</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black">{FEATURED_PRICE}</span>
                  <span className="text-lg font-bold">جنيه</span>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {FEATURES.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-text text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {!isAdmin && (
              <>
            <div className="bg-surface rounded-2xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="w-5 h-5 text-green-600" />
                <h2 className="font-bold text-text">طريقة الدفع: فودافون كاش</h2>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4">
                <div className="text-center mb-4">
                  <p className="text-xs text-green-600 font-bold mb-1">حول المبلغ إلى</p>
                  <p className="text-2xl font-black text-green-800 tracking-wider ltr" dir="ltr">{VODAFONE_CASH}</p>
                  <p className="text-sm text-green-600 mt-1">{ACCOUNT_NAME}</p>
                </div>
                <div className="border-t border-green-200 pt-4">
                  <p className="text-xs text-green-700 font-bold mb-2">المبلغ المطلوب</p>
                  <p className="text-xl font-black text-green-800">{FEATURED_PRICE} <span className="text-sm">جنيه</span></p>
                </div>
              </div>

              <h3 className="font-bold text-text text-sm mb-3">خطوات الدفع:</h3>
              <div className="space-y-3">
                {HOW_TO_PAY.map((h, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-orange/10 text-orange flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                    <span className="text-text text-sm">{h}</span>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">بعد التحويل، قم برفع إثبات الدفع (صورة من الإشعار) في الخطوة التالية ليتم تأكيد الترقية.</p>
              </div>
            </div>

            <button onClick={() => setStep('payment')}
              className="w-full bg-orange hover:bg-orange-dark text-white py-3.5 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2">
              <DollarSign className="w-5 h-5" /> لقد قمت بالدفع — أرفع إثبات الدفع
            </button>
              </>
            )}

            {isAdmin && (
              <div className="bg-surface rounded-2xl border-2 border-green-300 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h2 className="font-bold text-text">تفعيل فوري (صلاحية أدمن)</h2>
                </div>
                <p className="text-sm text-text-light">
                  أنت داخل بحساب أدمن — الترقية هتتفعل على طول لمدة 30 يوم من غير دفع ولا إثبات.
                </p>
                {result && !result.success && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm text-center">{result.message}</div>
                )}
                <button onClick={handleFastPromote} disabled={processing}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2">
                  {processing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> جاري التفعيل...</>
                  ) : (
                    <><Star className="w-5 h-5 fill-white" /> فعّل الترقية فورًا</>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Step 2: Upload Proof */}
        {step === 'payment' && (
          <>
            <button onClick={() => setStep('info')}
              className="flex items-center gap-1 text-sm text-orange font-bold hover:underline">
              <ArrowLeft className="w-4 h-4" /> العودة لتفاصيل الدفع
            </button>

            <div className="bg-surface rounded-2xl border border-border p-5">
              <h2 className="font-bold text-text mb-4">رفع إثبات الدفع</h2>

              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 text-center">
                <p className="text-xs text-green-600 font-bold">تم التحويل إلى</p>
                <p className="text-lg font-black text-green-800 tracking-wider ltr" dir="ltr">{VODAFONE_CASH}</p>
                <p className="text-sm font-bold text-green-700 mt-1">{FEATURED_PRICE} جنيه</p>
              </div>

              <label className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                proofPreview ? 'border-green-300 bg-green-50/50' : 'border-gray-300 hover:border-orange hover:bg-orange/5'
              }`}>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                {proofPreview ? (
                  <div className="space-y-3">
                    <img src={proofPreview} alt="إثبات الدفع" className="max-h-48 mx-auto rounded-xl shadow-sm" />
                    <p className="text-xs text-green-600 font-bold">تم اختيار الصورة — اضغط لتغييرها</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-orange/10 flex items-center justify-center mx-auto">
                      <Upload className="w-7 h-7 text-orange" />
                    </div>
                    <div>
                      <p className="font-bold text-text">ارفع صورة إشعار التحويل</p>
                      <p className="text-xs text-text-light mt-1">صورة من شاشة تأكيد الدفع من محفظتك</p>
                    </div>
                  </div>
                )}
              </label>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-4 flex items-start gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">يُفضّل أن تكون الصورة واضحة وتظهر فيها جميع تفاصيل التحويل (التاريخ، المبلغ، الرقم المستلم).</p>
              </div>
            </div>

            {result && !result.success && (
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-sm text-center">{result.message}</div>
            )}

            <button onClick={handleSubmit} disabled={!proofFile || processing}
              className="w-full bg-orange hover:bg-orange-dark disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2">
              {processing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {uploading ? 'جاري رفع الصورة...' : 'جاري إرسال الطلب...'}</>
              ) : (
                <><CheckCircle className="w-5 h-5" /> إرسال طلب الترقية</>
              )}
            </button>
          </>
        )}

        {/* Step 3: Done / Success */}
        {step === 'done' && (
          <>
            <div className="bg-success/10 border border-success/20 rounded-2xl p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
              <h2 className="text-xl font-bold text-text mb-2">
                {autoApproved ? 'تم تفعيل الترقية فورًا! ⭐' : 'تم إرسال طلب الترقية!'}
              </h2>
              <p className="text-text-light text-sm mb-4">
                رقم الطلب: <span className="font-bold text-orange">{paymentId?.slice(0, 8)}</span>
              </p>
              <div className="bg-surface border border-border rounded-2xl p-4 text-right space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-light">الحالة</span>
                  <span className={autoApproved
                    ? "bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold"
                    : "bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold"}>
                    {autoApproved ? 'مفعّل ✅' : 'في انتظار المراجعة'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-light">الإعلان</span>
                  <span className="font-bold text-text">{listing.title}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-light">المبلغ</span>
                  <span className="font-bold text-orange">{FEATURED_PRICE} جنيه</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-bold mb-1">ماذا يحدث الآن؟</p>
                <p>
                  {autoApproved
                    ? 'إعلانك أصبح مميزًا لمدة 30 يومًا ويظهر الآن أعلى نتائج البحث — مفيش حاجة تانية مطلوبة منك.'
                    : 'سيتم مراجعة إثبات الدفع من فريق كار مصر وتأكيد الترقية خلال 24 ساعة. سيظهر إعلانك مميزاً فور التأكيد.'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Link to="/my-listings"
                className="flex-1 bg-orange hover:bg-orange-dark text-white py-3 rounded-2xl font-bold transition-colors text-center">
                العودة لإعلاناتي
              </Link>
              <Link to="/"
                className="flex-1 border border-border text-text hover:border-orange py-3 rounded-2xl font-bold transition-colors text-center">
                الرئيسية
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
