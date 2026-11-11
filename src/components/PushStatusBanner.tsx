import { useEffect, useState } from 'react';
import { getDevicePushStatus, isNativeApp } from '../services/devicePush';
import { BUILD_TAG } from '../lib/config';

const AUTO_HIDE_MS = 6000;
const SHOWN_ONCE_KEY = "pushStatusBannerShownOnce";

export default function PushStatusBanner() {
  const status = getDevicePushStatus();
  const [visible, setVisible] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (!isNativeApp()) return;
    const t = setInterval(() => force((x: number) => x + 1), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    if (localStorage.getItem(SHOWN_ONCE_KEY) === "1") {
      setVisible(false);
      return;
    }
    if (!status.error && !status.registered) {
      setVisible(false);
      return;
    }
    setVisible(true);
    localStorage.setItem(SHOWN_ONCE_KEY, "1");
    const t = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [status.error, status.registered]);

  if (!isNativeApp()) return null;
  if (!visible) return null;

  return (
    <div className="fixed bottom-20 inset-x-3 z-[9999] flex justify-center">
      <div className={status.registered
        ? "bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
        : "bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2"}>
        <span>
          {status.registered
            ? "الإشعارات مفعلة على هذا الجهاز ✓"
            : "تعطيل الإشعارات: " + (status.error || "جاري المحاولة...")}
          <span className="opacity-80 mr-1">({BUILD_TAG})</span>
        </span>
        <button
          onClick={() => setVisible(false)}
          aria-label="إغلاق"
          className="pointer-events-auto text-white/80 hover:text-white text-sm font-bold px-1 leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
