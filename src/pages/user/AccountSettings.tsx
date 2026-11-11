import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Settings, Bell, User, Shield, Trash2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { isNativeApp, getDevicePushStatus, registerDevicePush } from '../../services/devicePush';
import { isChatDisabled, setChatDisabled } from '../../components/AiAssistantChat';

const sections = [
  { icon: User, title: 'الملف الشخصي', desc: 'تعديل اسمك وصورتك وبياناتك', path: '/profile' },
  { icon: Shield, title: 'الأمان', desc: 'كلمة المرور والمصادقة الثنائية', path: '/security-settings' },
  { icon: Trash2, title: 'حذف الحساب', desc: 'إلغاء حسابك وحذف بياناتك نهائياً', path: '/delete-account', danger: true },
];

const legalLinks = [
  { name: 'سياسة الخصوصية', path: '/privacy-policy' },
  { name: 'شروط الاستخدام', path: '/terms' },
  { name: 'سياسة الكوكيز', path: '/cookies' },
  { name: 'سياسة المحتوى', path: '/content-policy' },
];

export default function AccountSettings() {
  const { user } = useAuth();
  const { supported, subscribed, subscribe, unsubscribe } = usePushNotifications();
  const [nativeStatus, setNativeStatus] = useState(getDevicePushStatus());
  const [chatEnabled, setChatEnabled] = useState(() => !isChatDisabled());
  const native = isNativeApp();
  const handleToggle = async () => {
    if (subscribed) await unsubscribe(user?.id);
    else await subscribe(user?.id);
  };
  const handleNativeRetry = async () => {
    await registerDevicePush();
    setNativeStatus(getDevicePushStatus());
  };
  const handleChatToggle = () => {
    const next = !chatEnabled;
    setChatEnabled(next);
    setChatDisabled(!next);
    window.dispatchEvent(new Event(next ? 'tareeq:enable-chat' : 'tareeq:disable-chat'));
  };
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">الإعدادات</span>
          </nav>
          <div className="flex items-center gap-4">
            <Settings className="w-8 h-8 text-orange" />
            <div>
              <h1 className="text-2xl font-bold">إعدادات الحساب</h1>
              <p className="text-gray-400 text-sm">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {sections.map((s) => (
          <Link key={s.path} to={s.path} className={`flex items-center justify-between bg-surface rounded-2xl border p-5 transition-colors ${s.danger ? 'border-danger/20 hover:border-danger' : 'border-border hover:border-orange'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.danger ? 'bg-danger/10' : 'bg-orange/10'}`}>
                <s.icon className={`w-5 h-5 ${s.danger ? 'text-danger' : 'text-orange'}`} />
              </div>
              <div>
                <div className={`font-semibold ${s.danger ? 'text-danger' : 'text-text'}`}>{s.title}</div>
                <div className="text-text-light text-sm">{s.desc}</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-text-light rtl-flip" />
          </Link>
        ))}
        {supported && (
          <div className="bg-surface rounded-2xl border border-border p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-orange" />
              </div>
              <div>
                <div className="font-semibold text-text">إشعارات التطبيق</div>
                <div className="text-text-light text-sm">{subscribed ? 'مفعلة' : 'غير مفعلة'}</div>
              </div>
            </div>
            <button onClick={handleToggle} className={`relative w-11 h-6 rounded-full transition-colors ${subscribed ? 'bg-orange' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${subscribed ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}
        {native && (
          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-text">إشعارات الجهاز (Native)</div>
              <button onClick={handleNativeRetry} className="text-orange text-sm font-semibold hover:underline">إعادة المحاولة</button>
            </div>
            <div className={`text-sm ${nativeStatus.registered ? 'text-green-600' : 'text-red-500'}`}>
              {nativeStatus.registered ? '✓ تم التسجيل بنجاح' : 'لم يتم التسجيل بعد'}
            </div>
            {nativeStatus.error && <div className="text-xs text-red-500 mt-1 break-all">{nativeStatus.error}</div>}
            {nativeStatus.token && <div className="text-xs text-text-light mt-1 break-all">Token: {nativeStatus.token.slice(0, 24)}...</div>}
          </div>
        )}

        <div className="bg-surface rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-orange" />
              </div>
              <div>
                <div className="font-semibold text-text">المساعد الذكي</div>
                <div className="text-text-light text-sm">{chatEnabled ? 'ظاهر في كل الصفحات' : 'مخفي'}</div>
              </div>
            </div>
            <button onClick={handleChatToggle} className={`relative w-11 h-6 rounded-full transition-colors ${chatEnabled ? 'bg-orange' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${chatEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5">
          <h2 className="font-semibold text-text mb-3">الوثائق القانونية</h2>
          <ul className="space-y-1">
            {legalLinks.map((l) => (
              <li key={l.path}>
                <Link to={l.path} className="flex items-center justify-between py-2 text-sm text-text-light hover:text-orange transition-colors border-b border-border last:border-0">
                  <span>{l.name}</span>
                  <ChevronRight className="w-4 h-4 rtl-flip" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
