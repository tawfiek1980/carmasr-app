import { Link } from 'react-router-dom';
import { Shield, ChevronLeft, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
export default function SecuritySettings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/'); };
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <Link to="/settings" className="hover:text-orange">الإعدادات</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الأمان</span>
          </nav>
          <div className="flex items-center gap-4">
            <Shield className="w-8 h-8 text-orange" />
            <h1 className="text-2xl font-bold">إعدادات الأمان</h1>
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text mb-4">تسجيل الدخول النشط</h2>
          <div className="flex items-center justify-between p-4 bg-bg rounded-xl border border-border">
            <div>
              <div className="font-semibold text-text text-sm">الجهاز الحالي</div>
              <div className="text-text-light text-xs">نشط الآن</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-success" />
          </div>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="font-bold text-text mb-2">نشاط الحساب</h2>
          <p className="text-text-light text-sm mb-4">إذا لاحظت أي نشاط مريب على حسابك، أبلغنا فوراً.</p>
          <a href="mailto:tawfiek.fayez@gmail.com" className="text-orange hover:underline text-sm font-semibold">tawfiek.fayez@gmail.com</a>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 border border-danger/30 hover:bg-danger/5 text-danger py-3 rounded-2xl font-semibold transition-colors">
          <LogOut className="w-5 h-5" /> تسجيل الخروج من جميع الأجهزة
        </button>
      </div>
    </div>
  );
}
