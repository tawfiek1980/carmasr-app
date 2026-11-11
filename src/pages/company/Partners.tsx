import { Handshake, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const partnerTypes = [
  { title: 'شركات التمويل', desc: 'نتعاون مع بنوك وشركات تمويل معتمدة لتوفير حلول تمويلية مرنة لعملائنا.' },
  { title: 'ورش الفحص والصيانة', desc: 'شبكة ورش معتمدة توفر خدمات الفحص الفني قبل البيع والصيانة الدورية.' },
  { title: 'شركات التأمين', desc: 'شراكات مع شركات تأمين رائدة توفر تغطية شاملة للمركبات الثقيلة.' },
  { title: 'مورّدو قطع الغيار', desc: 'موردون معتمدون للقطع الأصلية والمعتمدة بأسعار تنافسية.' },
];

export default function Partners() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">شركاؤنا</span>
          </nav>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center">
              <Handshake className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-3xl font-bold">شركاؤنا</h1>
          </div>
          <p className="text-gray-300">منظومة شراكات قوية تُعزز قيمة خدماتنا لعملائنا</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          {partnerTypes.map((p) => (
            <div key={p.title} className="bg-surface rounded-2xl border border-border p-6">
              <h3 className="font-bold text-text mb-2">{p.title}</h3>
              <p className="text-text-light text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-border p-8 text-center">
          <Handshake className="w-12 h-12 text-orange mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text mb-2">هل تريد أن تصبح شريكاً؟</h2>
          <p className="text-text-light text-sm mb-6">نرحب بالشراكات مع الجهات التي تُضيف قيمة حقيقية لعملائنا في قطاع النقل الثقيل.</p>
          <Link to="/contact" className="inline-block bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors">
            تواصل لمناقشة الشراكة
          </Link>
        </div>
      </div>
    </div>
  );
}
