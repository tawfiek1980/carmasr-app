import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MapPin, Package, RotateCcw, Clock, Truck, Weight, DollarSign,
  Phone, User, Info, Calendar, CreditCard, AlertCircle, MessageCircle,
  ChevronRight, Pencil, Navigation, Loader2,
} from 'lucide-react';
import { loadsService } from '../lib/firestoreService';
import { cleanText, copyText, formatDateDMY, getPhoneLink, getWhatsAppLink, displayPrice, listingWhatsApp } from "../lib/utils";
import { getSiteUrl } from '../lib/config';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import ProtectedPhoneButton from '../components/ProtectedPhoneButton';
import AiMatch from '../components/AiMatch';
import type { Load } from '../types';

export default function LoadDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useNotifications();
  const [load, setLoad] = useState<Load | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!id) { setLoading(false); return; }
    loadsService.getById(id)
      .then((data) => { if (!cancelled) setLoad(data); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (load?.origin && load?.destination) {
      document.title = `حمولة: ${load.origin} → ${load.destination} - كار مصر CarMasr`;
    } else {
      document.title = 'حمولة - كار مصر CarMasr';
    }
  }, [load]);

  const pricePerTon = load && load.weight && Number(load.weight) > 0
    ? Math.round(load.price / Number(load.weight))
    : null;

  const tags: { label: string; bg: string; text: string }[] = [];
  if (load?.loadType === 'period') tags.push({ label: `تعاقد ${load.periodDays || ''}`, bg: 'bg-blue-100', text: 'text-blue-700' });
  if (load?.isReturnLoad) tags.push({ label: 'رجعة', bg: 'bg-emerald-100', text: 'text-emerald-700' });
  if (load?.international) tags.push({ label: 'دولي', bg: 'bg-indigo-100', text: 'text-indigo-700' });

  const SITE_URL = getSiteUrl();

  const copyShare = async (l: Load) => {
    const loadUrl = `${SITE_URL}/load/${l.id}`;
    const text = `🚛 حمولة: ${l.origin} → ${l.destination}\n📦 ${l.cargoType} | ${l.weight} طن\n💰 ${l.price.toLocaleString('ar-EG')} ج.م\n🔗 ${loadUrl}`;
    const ok = await copyText(text);
    toast(ok ? 'تم نسخ الرابط — هيعمل Preview تلقائي' : 'تعذر النسخ، الصق يدوياً', ok ? 'success' : 'error');
  };

  const openMap = (l: Load) => {
    const q = `${l.origin} مصر إلى ${l.destination} مصر`;
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="bg-navy py-6">
          <div className="max-w-3xl mx-auto px-4">
            <div className="h-6 w-48 bg-white/10 rounded-lg animate-pulse mb-4" />
            <div className="h-10 w-3/4 bg-white/10 rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-6 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange" />
        </div>
      </div>
    );
  }

  if (!load) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <Truck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-text mb-2">الحمولة غير موجودة</h1>
          <p className="text-text-light text-sm mb-6">ربما تم حذفها أو انتهى عرضها</p>
          <Link to="/loads"
            className="inline-block bg-orange hover:bg-orange-dark text-white px-6 py-3 rounded-xl font-bold transition-colors">
            تصفح كل السيارات
          </Link>
        </div>
      </div>
    );
  }

  const phone = load.secondaryPhone || load.contactPhone || load.userPhone;
  // رقم الواتساب بتاع صاحب الحمولة (مش بتاع اللي بيشوف)
  const waPhone = listingWhatsApp({
    whatsappPhone: load.whatsappPhone,
    contactPhone: load.contactPhone,
    userPhone: load.userPhone,
  });
  const isOwner = Boolean(user && load.userId && user.id === load.userId);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      {/* ── الهيدر ── */}
      <div className="bg-navy py-6 sm:py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Link to="/loads"
            className="inline-flex items-center gap-1 text-white/60 hover:text-white text-xs font-semibold mb-3 transition-colors">
            <ChevronRight className="w-4 h-4" /> كل السيارات
          </Link>
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {tags.map((t, i) => (
              <span key={i} className={`${t.bg} ${t.text} px-2.5 py-1 rounded-lg text-[11px] font-bold`}>{t.label}</span>
            ))}
            <span className="text-[11px] text-white/50">{formatDateDMY(load.date)}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange flex-shrink-0" />
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white truncate">{cleanText(load.origin) || '—'}</h1>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-4 h-[2px] bg-orange/40 rounded" />
              <Truck className="w-4 h-4 text-orange" />
              <div className="w-4 h-[2px] bg-orange/40 rounded" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 justify-end">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white truncate text-left">{cleanText(load.destination) || '—'}</h1>
                <div className="w-3 h-3 rounded-full border-2 border-orange flex-shrink-0" />
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between mt-4">
            <div className="flex items-center gap-4 text-white/70 text-xs">
              <span className="flex items-center gap-1"><span className="w-6 h-[2px] bg-white/25 rounded" /> كار مصر</span>
            </div>
            <div className="flex-shrink-0 text-left">
              <div className="text-3xl font-black text-orange leading-none">{displayPrice(load.price, load.priceType)}</div>
              <div className="text-[11px] text-white/50 font-medium mt-1">جنيه مصري</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* ── سعر الطن ── */}
        {pricePerTon && (
          <div className="bg-orange/5 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm text-gray-600 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-orange" /> سعر الطن
            </span>
            <span className="text-lg font-black text-orange">{pricePerTon.toLocaleString('ar-EG')} <span className="text-xs font-semibold">ج.م</span></span>
          </div>
        )}

        {/* ── الشبكة ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-2 gap-2">
            <InfoBox icon={<Package className="w-3.5 h-3.5" />} label="نوع الحمولة" value={load.cargoType || 'غير محدد'} />
            <InfoBox icon={<Truck className="w-3.5 h-3.5" />} label="نوع العربية" value={load.vehicleType || 'غير محدد'} />
            <InfoBox icon={<Weight className="w-3.5 h-3.5" />} label="الوزن" value={`${load.weight} طن`} />
            <InfoBox icon={<Calendar className="w-3.5 h-3.5" />} label="تاريخ التحميل" value={formatDateDMY(load.date)} />
            {load.distance && <InfoBox icon={<MapPin className="w-3.5 h-3.5" />} label="المسافة" value={`${load.distance} كم`} />}
            {load.loadingTime && <InfoBox icon={<Clock className="w-3.5 h-3.5" />} label="وقت التحميل" value={load.loadingTime} />}
            {load.international && load.originCountry && <InfoBox icon={<span>🌍</span>} label="بلد المنشأ" value={load.originCountry} accent />}
            {load.international && load.destinationCountry && <InfoBox icon={<span>🌍</span>} label="بلد الوصول" value={load.destinationCountry} accent />}
          </div>
        </div>

        {/* ── العناوين ── */}
        {load.pickupAddress && (
          <div className="bg-orange-50 rounded-2xl p-4">
            <p className="text-[10px] text-orange-400 font-bold mb-1">عنوان التحميل</p>
            <p className="text-sm text-gray-800">{load.pickupAddress}</p>
          </div>
        )}
        {load.deliveryAddress && (
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-[10px] text-emerald-400 font-bold mb-1">عنوان التسليم</p>
            <p className="text-sm text-gray-800">{load.deliveryAddress}</p>
          </div>
        )}

        {/* ── الملاحظات ── */}
        {load.paymentTerms && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
            <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div><p className="text-[10px] text-gray-400 font-bold mb-1">شروط الدفع</p><p className="text-sm text-gray-700">{load.paymentTerms}</p></div>
          </div>
        )}
        {load.loadingInstructions && (
          <div className="bg-amber-50 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div><p className="text-[10px] text-amber-500 font-bold mb-1">تعليمات التحميل</p><p className="text-sm text-amber-800">{load.loadingInstructions}</p></div>
          </div>
        )}
        {load.description && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-[10px] text-gray-400 font-bold mb-1.5">وصف إضافي</p>
            <p className="text-sm text-gray-700 leading-relaxed">{load.description}</p>
          </div>
        )}

        {/* ── رجعة / تعاقد ── */}
        {load.isReturnLoad && load.returnOrigin && (
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-[10px] text-emerald-500 font-bold mb-1 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> حمولة رجعة</p>
            <p className="text-sm text-emerald-800">
              السائق فاضي في {load.returnOrigin}{load.returnDestination ? ` — عايز رجعة إلى ${load.returnDestination}` : ''}
            </p>
          </div>
        )}
        {load.loadType === 'period' && (
          <div className="bg-blue-50 rounded-2xl p-4">
            <p className="text-[10px] text-blue-500 font-bold mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> تعاقد</p>
            <p className="text-sm text-blue-800">مطلوب شاحنة للتعاقد {load.periodDays ? `لمدة ${load.periodDays} يوماً` : ''}</p>
          </div>
        )}

        {/* ── صاحب الحمولة ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 font-bold mb-1.5 flex items-center gap-1"><User className="w-3 h-3" /> صاحب الحمولة</p>
          <p className="text-sm font-bold text-gray-800 mb-1">{load.userName || 'مجهول'}</p>
          <p className="text-[10px] text-gray-400">نشر منذ {formatDateDMY(load.createdAt)}</p>
        </div>

        {/* ── سيارات مناسبة (ذكاء اصطناعي) ── */}
        <AiMatch target="load" id={load.id} title="سيارات مناسبة للحمولة" />

        {/* ── الخريطة ── */}
        <button onClick={() => openMap(load)}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5">
          <Navigation className="w-4 h-4" /> عرض المسار على الخريطة
        </button>

        {/* ── أزرار التواصل ── */}
        <div className="flex items-center gap-2">
          {(waPhone || phone) && (
            <ProtectedPhoneButton phone={waPhone || phone}>
              <a href={getWhatsAppLink(waPhone || phone, `مرحباً، شفت حمولة ${load.origin} → ${load.destination} على تطبيق كار مصر`)}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl text-sm font-bold transition-colors flex-shrink-0">
                <MessageCircle className="w-4 h-4" /> واتساب
              </a>
            </ProtectedPhoneButton>
          )}
          {phone && (
            <ProtectedPhoneButton phone={phone} className="flex-1">
              <a href={getPhoneLink(phone)}
                className="flex-1 bg-orange hover:bg-orange-dark text-white py-3 rounded-2xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5">
                <Phone className="w-4 h-4" /> اتصل بالسائق
              </a>
            </ProtectedPhoneButton>
          )}
          <button onClick={() => copyShare(load)}
            className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-3 rounded-2xl text-sm font-bold transition-colors flex-shrink-0"
             aria-label="شارك الحمولة">
            <Info className="w-4 h-4" /> <span className="hidden sm:inline">مشاركة</span>
          </button>
        </div>

        {/* ── تعديل (صاحب الحمولة) ── */}
        {isOwner && (
          <Link to={`/load/${load.id}/edit`}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-orange/50 bg-orange/5 hover:bg-orange/10 text-orange py-3 rounded-2xl text-sm font-bold transition-colors">
            <Pencil className="w-4 h-4" /> تعديل الحمولة
          </Link>
        )}
      </div>
    </div>
  );
}

function InfoBox({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${accent ? 'bg-blue-50' : 'bg-gray-50'}`}>
      <div className={`flex items-center gap-1 text-[10px] font-bold mb-1 ${accent ? 'text-blue-400' : 'text-gray-400'}`}>
        {icon} {label}
      </div>
      <p className={`text-sm font-bold ${accent ? 'text-blue-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}