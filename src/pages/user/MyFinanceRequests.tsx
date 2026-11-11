import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, PlusCircle, ChevronLeft, Loader2, Clock, CheckCircle, XCircle, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { financeService } from '../../lib/firestoreService';
import type { FinanceRequest } from '../../types';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  new:       { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  reviewing: { label: 'قيد الدراسة',  color: 'bg-blue-100 text-blue-700',      icon: Search },
  approved:  { label: 'تمت الموافقة', color: 'bg-success/10 text-success',     icon: CheckCircle },
  rejected:  { label: 'مرفوض',        color: 'bg-danger/10 text-danger',       icon: XCircle },
};

export default function MyFinanceRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FinanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    financeService.getByUser(user.id)
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">طلبات التمويل</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">طلبات التمويل</h1>
              <p className="text-gray-400 text-sm">تتبع طلبات التمويل المقدَّمة</p>
            </div>
            <Link to="/finance" className="flex items-center gap-2 bg-orange hover:bg-orange-dark px-4 py-2.5 rounded-xl text-sm font-bold transition-colors">
              <PlusCircle className="w-4 h-4" /> طلب جديد
            </Link>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange" />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center">
            <DollarSign className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h2 className="font-bold text-text mb-2">لا توجد طلبات تمويل</h2>
            <p className="text-text-light text-sm mb-6">تقدّم بطلب تمويل لمركبتك أو معداتك الآن</p>
            <Link to="/finance" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors inline-block">تقديم طلب تمويل</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => {
              const cfg = statusConfig[r.status] || statusConfig.new;
              const Icon = cfg.icon;
              return (
                <div key={r.id} className="bg-surface rounded-2xl border border-border p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-text">{r.vehicleType}</p>
                      <p className="text-sm text-text-light mt-1">{r.name} • {r.governorate}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" /> {cfg.label}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-3 text-sm text-text-light">
                    <span>السعر: <strong>{r.vehiclePrice?.toLocaleString('ar-EG')} جنيه</strong></span>
                    <span>دفعة: <strong>{r.downPayment?.toLocaleString('ar-EG')} جنيه</strong></span>
                  </div>
                  <p className="text-xs text-text-light mt-2">تم الإرسال: {new Date(r.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
