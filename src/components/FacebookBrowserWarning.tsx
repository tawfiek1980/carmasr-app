"use client";
import { useEffect, useState } from "react";
import { Globe, Copy, ShieldCheck } from "lucide-react";
import AppInstallCTA from "./AppInstallCTA";

function isFacebookInApp() {
  const ua = navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|MESSENGER/i.test(ua) || (ua.includes("Instagram") && ua.includes("Android"));
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function getIntentUrl() {
  const path = window.location.pathname + window.location.search;
  return `intent://carmasr-app.vercel.app${path}#Intent;scheme=https;package=com.android.chrome;end`;
}

function openInDefaultBrowser() {
  if (isAndroid()) {
    window.location.href = getIntentUrl();
    return;
  }
  if (isIOS()) {
    window.location.href = window.location.href.replace(/^https:\/\//, "googlechrome://");
    setTimeout(() => window.location.reload(), 500);
  }
}

export default function FacebookBrowserWarning() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isFacebookInApp()) setVisible(true);
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  if (!visible) return null;

  return (
    <div dir="rtl" className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60">
      <div className="w-full max-w-lg bg-white rounded-t-3xl p-5 pb-8 shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1.5 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-xs text-gray-500">
            أنت تتصفح داخل متصفح فيسبوك — جاهز تنزل التطبيق وتكمّل أفضل؟
          </span>
        </div>

        <AppInstallCTA onDismiss={() => setVisible(false)} />

        <div className="flex gap-2 mt-3">
          <button onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 py-2 rounded-xl transition-colors">
            {copied ? <span>تم النسخ ✓</span> : <><Copy className="w-4 h-4" /> نسخ الرابط</>}
          </button>
          <button onClick={openInDefaultBrowser}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 py-2 rounded-xl transition-colors">
            <Globe className="w-4 h-4" /> افتح في المتصفح المتكامل
          </button>
        </div>

        <button onClick={() => setVisible(false)}
          className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition-colors underline">
          متابعة التصفح هنا
        </button>
      </div>
    </div>
  );
}