const CACHE_NAME = "tareeq-cache-v8";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => { if (k !== CACHE_NAME) return caches.delete(k); }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("/index.html", clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Network-first: keep the app in sync with deployments so hashed chunks always match the served HTML.
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).then((res) => {
      if (res.ok && res.type === "basic") {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(event.request))
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "\u0637\u0631\u064A\u0642 CarMasr", body: "", icon: "/tareeq-logo.png", url: "/" };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlRaw = event.notification.data?.url || "/notifications";
  const target = urlRaw.startsWith("/")
    ? new URL(urlRaw, self.registration.scope).toString()
    : urlRaw;
  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    // إن كان التطبيق مفتوحاً في نافذة سبق تحميلها، وجّهها للصفحة المطلوبة بدل فتح نافذة جديدة
    const existing = clientList.find((c) => c.url.startsWith(self.registration.scope));
    if (existing) {
      try { existing.postMessage({ type: "TAREEQ_NAVIGATE", url: target }); } catch {}
      if ("focus" in existing) return existing.focus();
      return;
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});