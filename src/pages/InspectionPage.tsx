import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import SeoHead from '../components/SeoHead';

const CHECKLIST = [
  'فحص هيكل السيارة (صدأ، حوادث، لحام)',
  'فحص المحرك (تسربات، أصوات غير طبيعية)',
  'فحص ناقل الحركة (تعشيق، اهتزاز)',
  'فحص الفرامل (أقراص، بطانات، سائل)',
  'فحص الإطارات (تآكل، تاريخ)',
  'فحص الكهرباء (بطارية، مولد، أضواء)',
  'فحص التكييف والتدفئة',
  'فحص نظام التعليق (مساعدين، rotors)',
  'فحص العادم (دخان، صوت)',
  'فحص interior (مقاعد، طبلون، إلكترونيات)',
  'فحص الوثائق (استمارة، تأمين، فحص دوري)',
  'تجربة قيادة (تسارع، فرملة، توجيه)',
];

export default function InspectionPage() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead title="فحص قبل الشراء — كار مصر" description="قائمة فحص سيارة قبل الشراء." />
      <div className="bg-gradient-to-br from-[#0B1E3A] to-[#122B4F] text-white py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-orange" /> فحص قبل الشراء
          </h1>
          <p className="text-white/80 mt-2">قائمة فحص شاملة قبل شراء سيارة مستعملة.</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-surface border border-border rounded-2xl p-6">
          <ul className="space-y-3">
            {CHECKLIST.map((c, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-orange shrink-0 mt-0.5" />
                <span className="text-text text-sm">{c}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted mt-6 text-center">نوصي بفحص السيارة لدى ورشة معتمدة قبل الشراء.</p>
        </div>
      </div>
    </div>
  );
}
