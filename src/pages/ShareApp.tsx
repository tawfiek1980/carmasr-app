import { useState } from 'react';
import { Share2, MessageCircle, Facebook, Link2, Check } from 'lucide-react';
import { getSiteUrl } from '../lib/config';

const APP_URL = 'https://carmasr-app.vercel.app/download';
const SHARE_TEXT = 'حمّل تطبيق كار مصر CarMasr — أكبر سوق للنقل الثقيل في مصر';

export default function ShareApp() {
  const [copied, setCopied] = useState(false);

  const shareWA = () => {
    window.open('https://api.whatsapp.com/send/?text=' + encodeURIComponent(SHARE_TEXT + '\n' + APP_URL), '_blank');
  };

  const shareFB = () => {
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(APP_URL), '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: SHARE_TEXT, text: SHARE_TEXT, url: APP_URL });
      } catch { /* مستخدم ألغى */ }
    } else {
      shareWA();
    }
  };

  const copyLink = async () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    try {
      await navigator.clipboard.writeText(APP_URL);
      done();
    } catch {
      const ta = document.createElement('textarea');
      ta.value = APP_URL;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
      done();
    }
  };

  const btn = 'flex items-center justify-center gap-2 w-full h-14 rounded-2xl font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60';

  return (
    <div className="min-h-screen bg-bg pb-24 sm:pb-8">
      <div className="bg-gradient-to-l from-navy to-navy-light px-4 py-10 text-center">
        <img src="/tareeq-logo.png" alt="كار مصر CarMasr" className="w-20 h-20 rounded-2xl mx-auto mb-4 object-contain bg-white/10 p-2" />
        <h1 className="text-2xl font-extrabold text-white mb-2">شارك تطبيق كار مصر</h1>
        <p className="text-white/80 text-sm max-w-sm mx-auto">
          ابعث التطبيق لأصدقائك وأصحاب السيارات — تحميل مجاني وسريع
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6">
        <div className="bg-white rounded-2xl border border-border shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between gap-3 p-3 bg-surface rounded-xl border border-border">
            <span className="text-text text-sm font-semibold truncate" dir="ltr">{APP_URL}</span>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 text-navy text-xs font-bold shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
          </div>

          <div className="space-y-3 mt-4">
            <button type="button" onClick={shareWA} className={`${btn} bg-[#25D366] hover:bg-[#1fb457]`}>
              <MessageCircle className="w-5 h-5" />
              واتساب
            </button>
            <button type="button" onClick={shareFB} className={`${btn} bg-[#1877F2] hover:bg-[#0f6ae0]`}>
              <Facebook className="w-5 h-5" />
              فيسبوك
            </button>
            <button type="button" onClick={shareNative} className={`${btn} bg-navy hover:bg-navy-light`}>
              <Share2 className="w-5 h-5" />
              مشاركة
            </button>
          </div>

          <p className="text-center text-text-light text-xs mt-4 leading-1.5">
            المشاركة بتفتح نافذة الاشتراك الأصلية على الموبايل (تليجرام، ماسنجر، ...)
          </p>
        </div>
      </div>
    </div>
  );
}