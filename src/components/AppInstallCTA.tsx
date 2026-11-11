import { useState } from 'react';
import { Download, X, ExternalLink } from 'lucide-react';
import { appDownloadUrl, isCapacitor } from '../lib/config';

interface Props {
  /** تعمل بوظيفة إغلاق إضافية من الأب (للوحات العلوية) */
  onDismiss?: () => void;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

function isFacebookInApp(): boolean {
  const ua = navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|MESSENGER/i.test(ua) || (ua.includes('Instagram') && /Android/i.test(ua));
}

export default function AppInstallCTA({ onDismiss }: Props) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  if (isCapacitor() || isStandalone() || !isFacebookInApp()) return null;

  const dismiss = () => (onDismiss ? onDismiss() : setHidden(true));

  return (
    <div dir="rtl" className="bg-navy rounded-2xl p-4 relative overflow-hidden shadow-lg">
      <div className="flex items-center gap-3">
        <img src="/app-icon-512.png" alt="كار مصر CarMasr"
          className="w-12 h-12 rounded-xl shadow-lg object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-black text-white text-base leading-tight">كمّل في التطبيق</p>
          <p className="text-[11px] text-white/60 mt-0.5 leading-snug">طريقة أفضل لتصفّح إعلانات السيارات والسيارات والسيارات</p>
        </div>
        {onDismiss ? null : (
          <button onClick={dismiss} aria-label="إغلاق" className="text-white/40 hover:text-white transition-colors p-0.5 -m-0.5">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <a href={appDownloadUrl()} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 bg-orange hover:bg-orange-dark text-white py-2.5 rounded-xl font-bold text-sm transition-colors">
          <Download className="w-4 h-4" /> حمّل التطبيق
        </a>
        <button onClick={dismiss}
          className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 border border-white/15 hover:bg-white/15 text-white py-2.5 rounded-xl font-bold text-sm transition-colors">
          <ExternalLink className="w-4 h-4" />
          المتابعة في المتصفح
        </button>
      </div>
    </div>
  );
}