import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Smartphone } from 'lucide-react';

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const deferredRef = useRef<any>(null);

  useEffect(() => {
    if (isStandalone()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e;
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone() || !deferred) return null;

  const install = () => {
    if (deferredRef.current) {
      deferredRef.current.prompt();
      deferredRef.current.userChoice.then((r: { outcome: string }) => {
        if (r.outcome === 'accepted') {
          setInstalled(true);
          setTimeout(() => setInstalled(false), 5000);
        }
      });
    }
  };

  if (installed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-green-700 text-white rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm w-full">
          <CheckCircle2 className="w-12 h-12 text-green-300" />
          <p className="font-bold text-lg">تم تثبيت التطبيق بنجاح ✓</p>
          <p className="text-green-200 text-sm">يمكنك فتح التطبيق من الشاشة الرئيسية</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-gradient-to-b from-navy to-[#0D1B2A] text-white rounded-3xl p-8 shadow-2xl border border-orange/20 flex flex-col items-center gap-5 text-center max-w-sm w-full">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange to-orange-dark flex items-center justify-center shadow-lg shadow-orange/20">
          <Smartphone className="w-10 h-10 text-white" />
        </div>
        <div>
          <p className="font-bold text-2xl mb-1">كار مصر CarMasr</p>
          <p className="text-gray-300 text-base">ثبّت التطبيق لتصفح أسرع وتجربة أفضل</p>
        </div>
        <button onClick={install}
          className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-orange/20 w-full">
          تثبيت التطبيق
        </button>
      </div>
    </div>
  );
}
