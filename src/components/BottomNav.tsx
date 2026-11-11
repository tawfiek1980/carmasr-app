import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Search, Plus, Heart, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AddSheet from './AddSheet';

const navItems = [
  { name: 'الرئيسية', path: '/', icon: Home },
  { name: 'البحث', path: '/search', icon: Search },
  { name: 'المفضلة', path: '/favorites', icon: Heart },
];

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        aria-current={active ? 'page' : undefined}
        className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
      >
        <motion.span
          className="flex items-center justify-center"
          animate={{ y: active ? -2 : 0, scale: active ? 1.06 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          <Icon
            className={`w-[22px] h-[22px] ${active ? 'text-orange' : 'text-text-light'}`}
            strokeWidth={active ? 2.5 : 2}
            fill={active && item.icon === Heart ? 'currentColor' : 'none'}
          />
        </motion.span>
        <span className={`text-[10px] leading-none ${active ? 'text-orange font-bold' : 'text-text-light font-medium'}`}>
          {item.name}
        </span>
      </Link>
    );
  };

  const accountActive = isActive('/profile') || isActive('/dashboard');

  return (
    <>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] safe-area-pb">
        <div className="flex items-stretch justify-around h-16 px-1.5">
          {renderItem(navItems[0])}
          {renderItem(navItems[1])}

          <div className="flex-1 flex flex-col items-center justify-end">
            <motion.button
              onClick={() => setAddOpen(true)}
              className="-mt-7 w-14 h-14 rounded-2xl bg-orange text-white flex items-center justify-center border-4 border-surface shadow-xl shadow-orange/40"
              aria-label="أضف إعلان"
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.06, rotate: 90 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Plus className="w-7 h-7" strokeWidth={2.5} />
            </motion.button>
            <span className="text-[9px] leading-none font-bold text-orange mt-1">أضف إعلانك</span>
          </div>

          {renderItem(navItems[2])}

          <Link
            to={user ? '/dashboard' : '/login'}
            aria-current={accountActive ? 'page' : undefined}
            className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
          >
            <motion.span
              className="flex items-center justify-center"
              animate={{ y: accountActive ? -2 : 0, scale: accountActive ? 1.06 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              <User className={`w-[22px] h-[22px] ${accountActive ? 'text-orange' : 'text-text-light'}`} strokeWidth={accountActive ? 2.5 : 2} />
            </motion.span>
            <span className={`text-[10px] leading-none ${accountActive ? 'text-orange font-bold' : 'text-text-light font-medium'}`}>
              {user ? 'حسابي' : 'دخول'}
            </span>
          </Link>
        </div>
      </nav>
      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
