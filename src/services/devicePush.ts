import { Capacitor } from "@capacitor/core";
import { firebaseAuth } from "../firebase";
import { auth } from "../lib/auth";
import { getApiUrl } from "../lib/config";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getDevicePushStatus(): {
  registered: boolean;
  token: string;
  error: string;
  platform: string;
} {
  try {
    const raw = localStorage.getItem("devicePushStatus");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { registered: false, token: "", error: "", platform: "" };
}

function setStatus(partial: Partial<ReturnType<typeof getDevicePushStatus>>) {
  const current = getDevicePushStatus();
  const next = { ...current, ...partial };
  try {
    localStorage.setItem("devicePushStatus", JSON.stringify(next));
  } catch {}
}

export async function registerDevicePush(): Promise<string | null> {
  if (!isNativeApp()) return null;
  setStatus({ platform: Capacitor.getPlatform() });

  let PushNotifications: any;
  try {
    PushNotifications = (await import("@capacitor/push-notifications")).PushNotifications;
  } catch (err: any) {
    const msg = "Plugin import failed: " + (err?.message || err);
    console.error("🔴", msg);
    setStatus({ registered: false, error: "تعذّر تحميل إضافة الإشعارات" });
    return null;
  }

  try {
    let permissionStatus = await PushNotifications.checkPermissions();
    if (permissionStatus.receive === "prompt") {
      permissionStatus = await PushNotifications.requestPermissions();
    }
    setStatus({ registered: false, error: "permission=" + permissionStatus.receive });

    if (permissionStatus.receive !== "granted") {
      const msg = "Permission not granted (" + permissionStatus.receive + ")";
      console.warn("🔴", msg);
      setStatus({ registered: false, error: "رفضت إذن الإشعارات" });
      return null;
    }

    const token = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 20000);
      PushNotifications.addListener("registration", (t: any) => {
        clearTimeout(timeout);
        resolve(t.value);
      });
      PushNotifications.addListener("registrationError", (err: any) => {
        clearTimeout(timeout);
        console.error("🔴 registrationError:", err?.error || err);
        resolve(null);
      });
      PushNotifications.register();
    });

    if (!token) {
      const msg = "No token received (FCM not delivering)";
      console.warn("🔴", msg);
      setStatus({ registered: false, error: "جهازك لم يحصل على توكن إشعارات (تحقق من خدمات جوجل/النت)" });
      return null;
    }

    setStatus({ registered: true, token, error: "" });

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let userId = "";
      try {
        const user = firebaseAuth.currentUser;
        if (user) {
          const idToken = await user.getIdToken();
          headers["Authorization"] = `Bearer ${idToken}`;
          userId = user.uid;
        }
      } catch {}
      if (!userId) {
        const storedUser = auth.getUser();
        if (storedUser?.id) {
          headers["x-uid"] = storedUser.id;
          userId = storedUser.id;
        }
      }
      if (!userId) {
        setStatus({ registered: false, error: "سجّل دخولك بحسابك ثم أعد الضغط على تحديث" });
        return null;
      }
      const res = await fetch(`${getApiUrl()}/push`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "subscribeDevice",
          token,
          userId,
          platform: Capacitor.getPlatform(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus({ registered: false, error: "فشل حفظ الجهاز: " + (body.error || res.status) });
      }
    } catch (err: any) {
      const msg = "save failed: " + (err?.message || err);
      console.warn("🔴", msg);
      setStatus({ registered: false, error: "فشل الاتصال بحفظ الجهاز" });
    }

    return token;
  } catch (err: any) {
    const msg = "register crashed: " + (err?.message || err);
    console.error("🔴", msg);
    setStatus({ registered: false, error: "خطأ غير متوقع في تفعيل الإشعارات" });
    return null;
  }
}

export async function unregisterDevicePush(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let userId = "";
    try {
      const user = firebaseAuth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        headers["Authorization"] = `Bearer ${idToken}`;
        userId = user.uid;
      }
    } catch {}
    if (!userId) {
      const storedUser = auth.getUser();
      if (storedUser?.id) {
        headers["x-uid"] = storedUser.id;
        userId = storedUser.id;
      }
    }
    if (!userId) return;
    await fetch(`${getApiUrl()}/push`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "unsubscribeDevice", userId }),
    });
    setStatus({ registered: false, token: "", error: "" });
  } catch (err) {
    console.warn("Failed to remove native device token", err);
  }
}

export const NAV_EVENT = "tareeq:navigate";
const PENDING_KEY = "tareeq_pending_nav";

let pendingPath: string | null = null;

/** بنخزّن المسار كمان في localStorage عشان ما يضيعش لو الإشعار فتح التطبيق وهو مقفول */
function savePendingPath(path: string) {
  pendingPath = path;
  try { localStorage.setItem(PENDING_KEY, path); } catch {}
}

function readPendingPath(): string | null {
  if (pendingPath) return pendingPath;
  try {
    const v = localStorage.getItem(PENDING_KEY);
    return v || null;
  } catch {
    return null;
  }
}

function clearPendingPath() {
  pendingPath = null;
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

/** يحوّل رابط الإشعار لمسار داخلي للتطبيق. أي حاجة برّا الموقع بتتجاهل. */
function normalizePath(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const u = raw.trim();
  if (!u) return "";
  try {
    if (/^https?:\/\//i.test(u)) {
      const parsed = new URL(u);
      // لو الدومين مختلف بناخد المسار بس لو هو مسار داخلي معروف
      if (parsed.pathname && parsed.pathname !== "/" && isInternalPath(parsed.pathname)) {
        return parsed.pathname + parsed.search;
      }
      return "";
    }
    if (u.startsWith("//")) return ""; // رابط خارجي بدون بروتوكول
    if (u.startsWith("/")) return u;
    if (/^(listing|ad|job|load|dashboard|my-listings|notifications|inbox|profile)\b/i.test(u)) return "/" + u;
    return "";
  } catch {
    return "";
  }
}

/** المسارات اللي التطبيق بيعرف يتنقل لها */
function isInternalPath(pathname: string): boolean {
  return /^\/(listing|load|job|ad|user|exhibitions|product|dashboard|my-listings|notifications|inbox|profile|favorites|featured|search|vehicles|loads|jobs)\b/i.test(pathname);
}

/**
 * التنقل من داخل التطبيق (SPA) بدل window.location.assign
 * لأن الريلود الكامل في كاباسيتور بيشيل الـpath ويفتح الداشبورد.
 */
export function navigateFromNotification(raw: unknown): void {
  let path = normalizePath(raw);
  if (!path || path === "/") path = "/notifications";
  savePendingPath(path);
  window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: path }));
}

/** لو الإشعار فتح التطبيق من مقفول، بنستهدف المسار بعد ما الراوتر يجهز. */
export function consumePendingNotificationPath(): string | null {
  const p = readPendingPath();
  if (p) clearPendingPath();
  return p;
}

let actionHandlerReady = false;
let foregroundHandlerReady = false;

export function setupNotificationActionHandler(): void {
  if (!isNativeApp() || actionHandlerReady) return;
  actionHandlerReady = true;
  import("@capacitor/push-notifications").then(({ PushNotifications }) => {
    PushNotifications.addListener("pushNotificationActionPerformed", (event: any) => {
      const data = event?.notification?.data || event?.data || {};
      // لو مفيش مسار صريح، نستخدم رقم الإعلان لو موجود
      const target = data?.url || data?.path
        || (data?.listingId ? `/listing/${data.listingId}` : undefined);
      navigateFromNotification(target);
    });
  });
}

/**
 * FCM بيبعت notification payload — وده بيظهر لوحده بس لما التطبيق مقفول/في الخلفية.
 * لما التطبيق مفتوح (في المقدمة) أندرويد مش بيعرضه، فبنعمله إشعار محلي هنا.
 */
export function setupForegroundNotificationHandler(): void {
  if (!isNativeApp() || foregroundHandlerReady) return;
  foregroundHandlerReady = true;

  const openUrl = (urlRaw: any) => {
    navigateFromNotification(urlRaw);
  };

  import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
    // الضغط على الإشعار المحلي → فتح اللينك
    LocalNotifications.addListener("localNotificationActionPerformed", (event: any) => {
      openUrl(event?.notification?.extra?.url);
    });

    LocalNotifications.requestPermissions().catch(() => {});
  }).catch(() => {});

  import("@capacitor/push-notifications").then(({ PushNotifications }) => {
    PushNotifications.addListener("pushNotificationReceived", (event: any) => {
      const n = event?.notification || {};
      const title = n.title || "كار مصر CarMasr";
      const body = n.body || "";
      const data = n.data || {};
      if (!body && !n.title) return;

      import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
        LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 100000),
            title,
            body,
            smallIcon: "ic_stat_icon",
            largeIcon: "ic_stat_icon",
            extra: {
              url: data.url || data.path
                || (data.listingId ? `/listing/${data.listingId}` : "/"),
            },
            schedule: { at: new Date(Date.now() + 100) },
          }],
        }).catch(() => {});
      }).catch(() => {
        // بديل: توست داخلي لو الإشعار المحلي مش متاح
      });
    });
  }).catch(() => {});
}

/**
 * بنسجّل مستمعي الإشعارات بأول لحظة تحميل للملف (قبل ما React يعمل ريندر وقبل شاشة البداية)،
 * عشان لو الإشعار فتح التطبيق وهو مقفول ماتفوتش الحدث بتاعه.
 */
export function bootNotificationHandlers(): void {
  if (typeof window === "undefined") return;
  setupNotificationActionHandler();
  setupForegroundNotificationHandler();
}
