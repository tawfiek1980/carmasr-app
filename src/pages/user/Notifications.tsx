import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft, CheckCircle, XCircle, Info, AlertCircle, Loader2, CheckCheck, MessageCircle, Store } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import type { TareeqNotification } from '../../types';

const icons: Record<string, React.ElementType> = {
  listing_review: Info,
  listing_approved: CheckCircle,
  listing_rejected: XCircle,
  new_listing_admin: Bell,
  message: Info,
  system: AlertCircle,
  contact: MessageCircle,
  exhibition_product: Store,
};

const iconColors: Record<string, string> = {
  listing_review: 'bg-blue-100 text-blue-600',
  listing_approved: 'bg-success/10 text-success',
  listing_rejected: 'bg-danger/10 text-danger',
  new_listing_admin: 'bg-orange/10 text-orange',
  message: 'bg-purple-100 text-purple-600',
  system: 'bg-gray-100 text-gray-600',
  exhibition_product: 'bg-orange/10 text-orange',
};

// الوجهة عند الضغط: الرابط المحدد، وإلا لو إشعار إعلان نستخدم listingId
function notificationTarget(n: TareeqNotification): string {
  if (n.url) return n.url;
  if (n.type === 'message') return '/inbox';
  if (n.listingId) return `/listing/${n.listingId}`;
  return '/notifications';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return new Date(dateStr).toLocaleDateString('ar-EG');
}

export default function Notifications() {
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8 overflow-x-hidden">
      <div className="bg-navy text-white py-10 px-4">
        <div className="max-w-3xl mx-auto w-full">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الإشعارات</span>
          </nav>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">الإشعارات</h1>
            {notifications.some(n => !n.read) && (
              <button onClick={markAllAsRead} className="flex items-center gap-1 text-sm text-orange hover:text-orange-dark transition-colors">
                <CheckCheck className="w-4 h-4" />
                تحديد الكل كمقروء
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-6 w-full max-w-full">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-10 text-center">
            <Bell className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h2 className="font-bold text-text mb-2">لا توجد إشعارات</h2>
            <p className="text-text-light text-sm">ستصل إشعاراتك هنا عند وجود تحديثات على إعلاناتك أو رسائل جديدة.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const Icon = icons[n.type] || Info;
              return (
                <button
                  key={n.id}
                  onClick={() => { markAsRead(n.id); navigate(notificationTarget(n)); }}
                  className={`w-full text-right bg-surface rounded-2xl border p-4 flex items-start gap-3 transition-all hover:shadow-sm ${
                    n.read ? 'border-border' : 'border-orange/30 bg-orange/[0.02]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColors[n.type]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm break-words ${n.read ? 'text-text' : 'font-bold text-text'}`}>{n.title}</p>
                    <p className="text-xs text-text-light mt-0.5 break-words">{n.body}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-orange flex-shrink-0 mt-1.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
