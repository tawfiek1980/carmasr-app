import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, PlusCircle, LogOut, LayoutDashboard, Heart, Bell, MessageCircle, Store, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchBar from './SearchBar';
import BackButton from './BackButton';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';

const navLinks = [
  { name: 'الرئيسية', path: '/' },
  { name: 'الشاحنات', path: '/vehicles' },
  { name: 'المعدات', path: '/equipment' },
  { name: 'قطع غيار', path: '/spare-parts' },
  { name: 'حمولة', path: '/loads' },
  { name: 'الوظائف', path: '/jobs' },
  { name: 'الخدمات', path: '/services' },
  { name: 'التمويل', path: '/finance' },
  { name: 'طوارئ', path: '/emergency' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = user?.type === 'admin';
  const { unreadCount } = useNotifications();
  const { isDark, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-navy shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 lg:h-18">
          {/* Mobile Back Button + Logo */}
          <div className="flex items-center gap-1">
            <div className="sm:hidden">
              <BackButton />
            </div>
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img src="/tareeq-logo.png" alt="كار مصر" className="h-9 w-9 sm:h-10 sm:w-10 object-contain" />
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg sm:text-xl leading-none">كار مصر</span>
              <span className="text-orange text-[10px] sm:text-xs font-semibold leading-none">CarMasr</span>
            </div>
          </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 mx-4 overflow-x-auto scrollbar-hide">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-orange bg-white/10'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Search */}
          <div className="hidden lg:flex max-w-xs xl:max-w-sm mx-2">
            <SearchBar variant="header" />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to={user ? '/post-listing' : '/login'}
              aria-label="أضف إعلانك"
              className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-semibold transition-colors btn-press"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">أضف إعلانك</span>
            </Link>

            <Link
              to="/join"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-orange hover:bg-orange/10 transition-colors"
            >
              <Store className="w-4 h-4" />
              <span>انضم كمعرض</span>
            </Link>
            <Link
              to="/platform"
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>عن المنصة</span>
            </Link>

            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
              title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
              className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  to="/notifications"
                  className={`relative p-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/notifications' ? 'text-orange bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  title="الإشعارات"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-orange text-white text-[9px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </Link>

                <Link
                  to="/inbox"
                  className={`relative p-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/inbox' ? 'text-orange bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  title="الرسائل"
                >
                  <MessageCircle className="w-4.5 h-4.5" />
                </Link>


                <Link
                  to="/profile"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === '/profile' ? 'text-orange bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-[80px] truncate">{user.name}</span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>لوحة التحكم</span>
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>دخول</span>
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-navy-light border-t border-white/10 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              <div className="lg:hidden">
                <SearchBar variant="mobile" onClose={() => setMobileMenuOpen(false)} />
              </div>
              <nav className="grid grid-cols-2 gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === link.path
                        ? 'bg-orange text-white'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>
              <div className="border-t border-white/10 pt-3 space-y-2">
                <Link
                  to="/join"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-orange hover:bg-orange/10"
                >
                  <Store className="w-4 h-4" />
                  <span>انضم كمعرض</span>
                </Link>
                <Link
                  to="/platform"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5"
                >
                  <span>عن المنصة</span>
                </Link>
                <Link
                  to="/favorites"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5"
                >
                  <Heart className="w-4 h-4" />
                  <span>المفضلات</span>
                </Link>
                {user ? (
                  <>
                    <Link
                      to="/notifications"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        <span>الإشعارات</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="bg-orange text-white text-xs font-extrabold px-2 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/inbox"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>الرسائل</span>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5"
                    >
                      <User className="w-4 h-4" />
                      <span>الملف الشخصي</span>
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>لوحة التحكم</span>
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-white/5"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5"
                    >
                      <User className="w-4 h-4" />
                      <span>تسجيل الدخول</span>
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-white bg-orange hover:bg-orange-dark"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>إنشاء حساب</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
