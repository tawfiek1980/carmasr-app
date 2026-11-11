import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
export default function ServerError() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-navy/10 mb-4 select-none">500</div>
        <AlertTriangle className="w-16 h-16 text-danger mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-text mb-2">خطأ في الخادم</h1>
        <p className="text-text-light mb-8">حدث خطأ غير متوقع من جانبنا. فريقنا التقني تلقى إشعاراً بالمشكلة وجاري إصلاحها.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => window.location.reload()} className="flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white px-6 py-3 rounded-xl font-bold transition-colors">
            <RefreshCw className="w-4 h-4" /> إعادة التحميل
          </button>
          <Link to="/" className="flex items-center justify-center gap-2 border border-border hover:border-orange text-text px-6 py-3 rounded-xl font-semibold transition-colors">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
