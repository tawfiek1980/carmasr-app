const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#0a1628,#0D1B2A,#132a45);color:#fff;padding:32px;text-align:center;font-family:system-ui,-apple-system,sans-serif;direction:rtl">' +
    '<div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:32px;color:#fff;font-weight:900;box-shadow:0 8px 32px rgba(249,115,22,0.3);animation:tp 1.5s ease-in-out infinite">\u0637</div>' +
    '<h1 style="font-size:24px;font-weight:800;margin:0 0 6px;letter-spacing:0.5px;background:linear-gradient(135deg,#fff,#94a3b8);-webkit-background-clip:text;-webkit-text-fill-color:transparent">\u0637\u0631\u064A\u0642 CarMasr</h1>' +
    '<p style="color:#64748b;font-size:14px;margin:0 0 32px;font-weight:500">\u0633\u0648\u0642 \u0627\u0644\u0646\u0642\u0644 \u0627\u0644\u062B\u0642\u064A\u0644 \u0641\u064A \u0645\u0635\u0631</p>' +
    '<div style="width:160px;height:3px;background:#1e293b;border-radius:4px;overflow:hidden">' +
    '<div style="width:40%;height:100%;background:linear-gradient(90deg,#f97316,#fb923c);border-radius:4px;animation:tp 1.2s ease-in-out infinite"></div></div>' +
    '<p style="color:#475569;font-size:13px;margin:16px 0 0;animation:tf 1.5s ease-in-out infinite">\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...</p>' +
    '<style>@keyframes tp{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@-webkit-keyframes tp{0%,100%{-webkit-transform:translateY(0)}50%{-webkit-transform:translateY(-6px)}}@keyframes tf{0%,100%{opacity:0.5}50%{opacity:1}}</style></div>';
}

// حماية من كسر واجهة React بسبب تعديل خارجي على DOM.
// متصفح فيسبوك الداخلي (in-app) والترجمة التلقائية بيضيفوا/ينقلوا عناصر جوه الشجرة،
// وده بيخلّي React يرمي: Failed to execute 'removeChild' on 'Node'
// فبنخلي removeChild/insertBefore يسقطوا بهدوء بدل ما يسقّطوا التطبيق كله.
(function guardDomMutations() {
  try {
    const origRemove = Node.prototype.removeChild;
    Node.prototype.removeChild = function (this: Node, child: Node) {
      if (child && child.parentNode !== this) return child;
      return origRemove.call(this, child);
    } as typeof Node.prototype.removeChild;

    const origInsert = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function (this: Node, newNode: Node, ref: Node | null) {
      if (ref && ref.parentNode !== this) {
        try { return this.appendChild(newNode); } catch { return newNode; }
      }
      return origInsert.call(this, newNode, ref);
    } as typeof Node.prototype.insertBefore;
  } catch { /* نتجاهل — أفضل من تعطّل الصفحة */ }
})();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import App from "./App";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ToastContainer from "./components/Toast";
import FacebookBrowserWarning from "./components/FacebookBrowserWarning";
import OfflineBanner from "./components/OfflineBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import { bootNotificationHandlers } from "./services/devicePush";
import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

// مهم: تسجيل مستمعي الإشعارات قبل أي ريندر أو شاشة بداية
// عشان فتح التطبيق من إشعار (والتطبيق مقفول) يوصلنا المسار
bootNotificationHandlers();

function showFatal(message: string) {
  const e = document.getElementById("root");
  if (!e || e.getAttribute("data-error")) return;
  e.setAttribute("data-error", "1");
  e.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#0D1B2A;color:#fff;padding:32px;text-align:center;font-family:system-ui,sans-serif;direction:rtl">' +
    '<div style="width:64px;height:64px;border-radius:16px;background:#f97316;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:#fff;font-weight:900">\u0637</div>' +
    '<h1 style="font-size:22px;font-weight:700;margin:0 0 12px">\u0637\u0631\u064A\u0642 CarMasr</h1>' +
    '<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;max-width:320px">\u0639\u0630\u0631\u0627\u064B\u060C \u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062A\u0637\u0628\u064A\u0642</p>' +
    '<p style="color:#f97316;font-size:13px;margin:0 0 20px;max-width:360px;word-break:break-all;direction:ltr;text-align:left;background:#1e293b;padding:12px;border-radius:8px">' + message.replace(/</g, "&lt;") + '</p>' +
    '<button onclick="location.reload()" style="background:#f97316;color:#fff;padding:14px 40px;border-radius:14px;border:none;font-size:16px;font-weight:700;cursor:pointer">\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u062D\u0645\u064A\u0644</button></div>';
}

window.onerror = function (msg, _url, _line, _col, err) {
  const m = (err && (err as Error).message) || String(msg || "");
  console.error("Global error:", m, err);
  // أخطاء تحميل الـchunks فقط بتستدعي إعادة تحميل — باقي الأخطاء تتسجل ولا تسقّط التطبيق
  if (isChunkLoadError(m)) {
    location.reload();
    return false;
  }
  return false;
};

function isChunkLoadError(msg: unknown): boolean {
  const s = String(msg || "");
  return /Failed to fetch dynamically imported module/i.test(s)
    || /error loading dynamically imported module/i.test(s)
    || /dynamically imported module/i.test(s)
    || /Importing a module script failed/i.test(s)
    || /Loading chunk .* failed/i.test(s);
}

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <HelmetProvider>
      <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
            <ErrorBoundary>
            <App />
            </ErrorBoundary>
            <OfflineBanner />
            <FacebookBrowserWarning />
            <ToastContainer />
            <SpeedInsights />
        </NotificationProvider>
      </AuthProvider>
      </ThemeProvider>
      </HelmetProvider>
    </StrictMode>
  );
} catch (e) {
  console.error("Fatal render error:", e);
  showFatal(e instanceof Error ? e.message : String(e));
}

if ("serviceWorker" in navigator) {
  window.addEventListener("unhandledrejection", (event) => {
    if (event && event.reason && isChunkLoadError((event.reason as Error)?.message || String(event.reason))) {
      event.preventDefault();
      location.reload();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
    }).catch((err) => console.error("Service Worker registration failed:", err));
  });
}
