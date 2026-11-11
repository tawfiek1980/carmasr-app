import { Link } from 'react-router-dom';
import { Wrench, ShieldCheck, Car, Phone } from 'lucide-react';
import SeoHead from '../components/SeoHead';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <SeoHead title="مراكز الصيانة — كار مصر" description="مراكز صيانة معتمدة للسيارات في كار مصر." />
      <div className="bg-gradient-to-br from-[#0F172A] via-[#172554] to-[#1D4ED8] text-white py-10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Wrench className="w-8 h-8 text-orange" /> مراكز الصيانة
          </h1>
          <p className="text-white/80 mt-2">شبكة مراكز صيانة معتمدة (قريباً).</p>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="bg-surface border border-border rounded-2xl p-10 max-w-md mx-auto">
          <Wrench className="w-12 h-12 mx-auto mb-3 text-orange opacity-60" />
          <p className="font-bold text-text text-lg">قريباً</p>
          <p className="text-text-muted text-sm mt-2">نعمل على إضافة مراكز صيانة معتمدة في جميع المحافظات.</p>
          <Link to="/post-listing" className="inline-block mt-4 text-orange font-bold hover:underline">أضف مركزك ←</Link>
        </div>
      </div>
    </div>
  );
}
