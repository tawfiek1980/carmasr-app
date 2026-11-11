import { Siren, Phone, AlertTriangle, Clock } from 'lucide-react';
import EmergencyServiceCard from '../components/EmergencyServiceCard';
import { emergencyServices } from '../lib/data';
import { getPhoneLink } from '../lib/utils';

export default function Emergency() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-red-600 to-red-700 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Siren className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-3">خدمات طوارئ على الطريق</h1>
          <p className="text-red-100 text-sm sm:text-base max-w-2xl mx-auto">
            فريق كار مصر المتاح على الطريق 24/7 لمساعدتك في أي موقع داخل جمهورية مصر العربية
          </p>
          <a
            href={getPhoneLink('01018870145')}
            className="inline-flex items-center gap-2 mt-6 bg-white text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors"
          >
            <Phone className="w-5 h-5" />
            اتصل بالخط الساخن
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-yellow-800 text-sm mb-1">مهم للسلامة</h3>
            <p className="text-yellow-700 text-xs leading-relaxed">
              في حالات الأزمات الخطيرة أو حالات الإصابة، يرجى الاتصال بالأرقام الطارئة أو الخط الساخن للمساعدة الفورية.
            </p>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {emergencyServices.map((service) => (
            <EmergencyServiceCard key={service.id} service={service} />
          ))}
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm">
          <h2 className="text-xl font-extrabold text-navy mb-6 text-center">كيفية الاستفادة من خدمة الطوارئ</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'اتصل بنا', desc: 'ابحث عن أقرب خدمة واتصل مباشرة' },
              { step: '2', title: 'شارك الموقع', desc: 'زود لنا بموقعك والمشكلة لتوجيه الفريق' },
              { step: '3', title: 'الحل فوراً', desc: 'يصل الفريق ويقوم بحل المشكلة' },
            ].map((item) => (
              <div key={item.step} className="text-center p-4 bg-bg rounded-xl">
                <div className="w-10 h-10 bg-orange text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                  {item.step}
                </div>
                <h3 className="font-bold text-text mb-1">{item.title}</h3>
                <p className="text-xs text-text-light">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 24/7 Banner */}
        <div className="mt-6 bg-navy rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">نحن متواجدون طوال الوقت</h3>
              <p className="text-sm text-gray-300">24/7 خدمة طوارئ داخل مصر</p>
            </div>
          </div>
          <a
            href={getPhoneLink('01018870145')}
            className="bg-orange hover:bg-orange-dark text-white px-6 py-2.5 rounded-xl font-bold transition-colors"
          >
            اتصل الآن
          </a>
        </div>
      </div>
    </div>
  );
}
