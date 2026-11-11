import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { registerDevicePush, isNativeApp, setupNotificationActionHandler, setupForegroundNotificationHandler, getDevicePushStatus, NAV_EVENT, consumePendingNotificationPath, navigateFromNotification } from '../services/devicePush';

export default function PushSetup() {
  const { user } = useAuth();
  const { supported, permission, subscribed, subscribe } = usePushNotifications();
  const [, force] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setupNotificationActionHandler();
    setupForegroundNotificationHandler();
  }, []);

  // رسائل من الـService Worker: تنقّل داخل الـSPA بدل فتح نافذة جديدة
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d && d.type === 'TAREEQ_NAVIGATE' && d.url) navigateFromNotification(d.url);
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, []);

  // فتح وجهة الإشعار جوّه التطبيق بدل إعادة تحميل الصفحة
  useEffect(() => {
    const onNav = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      // بنمسح المسار المحفوظ بعد ما ننتقل عشان ما يفتحش تاني بعد إعادة تحميل
      consumePendingNotificationPath();
      if (path) navigate(path);
    };
    window.addEventListener(NAV_EVENT, onNav);
    const pending = consumePendingNotificationPath();
    if (pending) navigate(pending);

    // لو الإشعار فتح التطبيق من مقفول، بنستهدف المسار أول ما يرجع للتشغيل
    let removeAppListener: (() => void) | undefined;
    import("@capacitor/app")
      .then(({ App: CapApp }) => {
        const h = CapApp.addListener("appStateChange", ({ isActive }: any) => {
          if (!isActive) return;
          const p = consumePendingNotificationPath();
          if (p) navigate(p);
        });
        removeAppListener = () => { h.then((x: any) => x.remove()).catch(() => {}); };
      })
      .catch(() => {});

    return () => {
      window.removeEventListener(NAV_EVENT, onNav);
      removeAppListener?.();
    };
  }, [navigate]);

  useEffect(() => {
    if (!isNativeApp()) return;
    if (!user) return;
    let mounted = true;
    let attempts = 0;
    const run = async () => {
      if (!mounted) return;
      attempts += 1;
      await registerDevicePush();
      if (mounted) force((x: number) => x + 1);
      const st = getDevicePushStatus();
      if (st.registered || st.error) {
        if (st.registered) return; // done
        if (attempts < 6) setTimeout(run, 20000); // retry up to 6 times if error
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (isNativeApp()) return;
    if (!supported || subscribed || permission === 'denied') return;
    const timer = setTimeout(() => subscribe(user?.id || ''), 5000);
    return () => clearTimeout(timer);
  }, [user?.id, supported, subscribed, permission]);

  return null;
}