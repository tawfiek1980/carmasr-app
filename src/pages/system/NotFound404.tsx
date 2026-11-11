import { Link } from 'react-router-dom';
import { Home, Search, Truck } from 'lucide-react';
export default function NotFound404() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-navy/10 mb-4 select-none">404</div>
        <Truck className="w-16 h-16 text-orange mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-text mb-2">الصفحة غير موجودة</h1>
        <p className="text-text-light mb-8">يبدو أن الصفحة التي تبحث عنها قد انعطفت في الاتجاه الخطأ أو لم تعد موجودة.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-white px-6 py-3 rounded-xl font-bold transition-colors">
            <Home className="w-4 h-4" /> الرئيسية
          </Link>
          <Link to="/vehicles" className="flex items-center justify-center gap-2 border border-border hover:border-orange text-text px-6 py-3 rounded-xl font-semibold transition-colors">
            <Search className="w-4 h-4" /> تصفح الإعلانات
          </Link>
        </div>
      </div>
    </div>
  );
}
