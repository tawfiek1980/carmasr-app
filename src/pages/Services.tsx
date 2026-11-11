import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, ArrowLeft, Phone, X, MessageCircle, CheckCircle2, MapPin, Facebook } from 'lucide-react';
import { getWhatsAppLink } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { DEFAULT_SERVICES, normalizeService, SERVICE_ICONS, SERVICE_FALLBACK_IMAGE } from '../lib/serviceData';
import type { ManagedService } from '../lib/serviceData';

const CONTACT_PHONE = "01018870145";

function facebookUrl(fb: string) {
  return /^https?:\/\//i.test(fb) ? fb : `https://www.facebook.com/${fb}`;
}

export default function Services() {
  const { user } = useAuth();
  const [services, setServices] = useState<ManagedService[]>(DEFAULT_SERVICES);
  const [showService, setShowService] = useState<ManagedService | null>(null);
  const [isPartner, setIsPartner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'siteConfig', 'services'))
      .then(snap => {
        if (cancelled) return;
        const arr = snap?.data()?.services;
        if (Array.isArray(arr) && arr.length > 0) {
          setServices(
            arr
              .map((s, i) => normalizeService(s, i))
              .filter(s => s.active)
              .sort((a, b) => a.order - b.order)
          );
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">خدمات السيارات الملاكي</h1>
          <p className="text-gray-300 text-sm sm:text-base">كل ما تحتاجه لسياراتك وسياراتك من خدمات في مكان واحد</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-border hover:shadow-lg transition-all card-hover"
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={service.image || SERVICE_FALLBACK_IMAGE}
                  alt={service.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                  onError={e => { if ((e.target as HTMLImageElement).src !== SERVICE_FALLBACK_IMAGE) (e.target as HTMLImageElement).src = SERVICE_FALLBACK_IMAGE; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/80 to-transparent" />
                <div className="absolute bottom-3 right-3 left-3 flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-orange flex items-center justify-center">
                    {(() => { const Icon = SERVICE_ICONS[service.iconKey]; return <Icon className="w-5 h-5 text-white" />; })()}
                  </div>
                  <h3 className="text-white font-bold text-lg">{service.name}</h3>
                </div>
              </div>
              <div className="p-4">
                <p className="text-text-light text-sm mb-3 line-clamp-2">{service.description}</p>
                <ul className="space-y-1.5 mb-4">
                  {service.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-text">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange" />
                      {feature}
                    </li>
                  ))}
                </ul>
                                <button
                  onClick={() => { setIsPartner(false); setShowService(service); }}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-bg hover:bg-orange hover:text-white text-text font-bold rounded-xl transition-colors group-hover:bg-orange group-hover:text-white cursor-pointer"
                >
                  <span>طلب الخدمة</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Contact Modal */}
        {(showService || isPartner) && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowService(null); setIsPartner(false); }}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowService(null); setIsPartner(false); }} className="float-left text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
              <Phone className="w-10 h-10 text-orange mx-auto mb-3" />
              <h3 className="font-bold text-gray-800 text-lg mb-1">{showService?.name || 'تقديم خدمة جديدة'}</h3>
              <p className="text-gray-500 text-sm mb-4">
                {isPartner ? 'تواصل معنا لتسجيل خدمتك لدى كار مصر والعرض على آلاف العملاء' : 'تواصل معنا لطلب الخدمة'}
              </p>
              {(showService?.contactPhones?.length ? showService.contactPhones : [CONTACT_PHONE]).map((p, i) => (
                <a
                  key={i}
                  href={`tel:${p}`}
                  dir="ltr"
                  className={`block w-full text-white py-3 rounded-xl font-bold text-lg tracking-wide transition-colors mb-2 ${i === 0 ? 'bg-orange hover:bg-orange-dark' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                >
                  {p}
                </a>
              ))}
              <a
                href={getWhatsAppLink((showService?.contactPhones?.[0]) || CONTACT_PHONE, isPartner
                  ? 'السلام عليكم، أرغب في إضافة خدمتي إلى كار مصر CarMasr كشريك موثق، أرسلوا لي التفاصيل.'
                  : `السلام عليكم، أرغب في طلب خدمة: ${showService?.name || ''}`)}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold mt-2 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                واتساب
              </a>
              {showService?.address && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-gray-600 mt-3">
                  <MapPin className="w-3.5 h-3.5 text-orange flex-shrink-0" />
                  {showService.address}
                </p>
              )}
              {showService?.facebook && (
                <a href={facebookUrl(showService.facebook)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 hover:underline mt-1.5">
                  <Facebook className="w-3.5 h-3.5" />
                  صفحة فيسبوك
                </a>
              )}
              {!user && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Link to="/register" className="inline-flex items-center gap-1 text-orange text-sm font-bold hover:underline">
                    أو أنشئ حساب مقدّم خدمة
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3">اتصال مباشر أو مراسلة واتساب</p>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 bg-gradient-to-r from-orange to-orange-dark rounded-2xl p-6 sm:p-8 text-white text-center">
          <Calendar className="w-12 h-12 mx-auto mb-3" />
          <h2 className="text-xl sm:text-2xl font-extrabold mb-2">هل تريد أن تضيف خدمتك إلى كار مصر؟</h2>
          <p className="text-white/90 text-sm mb-4 max-w-lg mx-auto">انضم إلينا كشريك موثق ووصل عملائك إلى آلاف العملاء في مجال السيارات الملاكي</p>
          <button
            onClick={() => { setIsPartner(true); setShowService(null); }}
            className="inline-flex items-center gap-1.5 bg-white text-orange px-6 py-2.5 rounded-xl font-bold hover:bg-bg transition-colors cursor-pointer"
          >
            سجّل كمقدّم خدمات
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center justify-center gap-4 flex-wrap mt-4 text-xs text-white/80">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> تظهر خدماتك عبر المنصة</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> تواصل مباشر مع العملاء</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> لا رسوم للتسجيل الآن</span>
          </div>
        </div>
      </div>
    </div>
  );
}
