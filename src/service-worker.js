/*
 * AgencyOS — service worker (şablon). pwa.js bunu /sw.js olarak yayımlar; __CW_SW_VERSION__ her derlemede değişir.
 * Uygulamanın kendisi bunu import ETMEZ.
 *
 * Yalnızca aynı adresteki uygulama kabuğunu önbelleğe alır:
 *   • Sayfa açılışları (navigasyon): önce ağ → çevrimdışıysa önbellekteki index.html (güncel sürüm her zaman ağdan gelir)
 *   • /assets/ (içerik özetli JS/CSS, değişmez): önce önbellek
 *   • simgeler ve manifest: önbellekten hemen, arka planda güncellenir
 * Supabase istekleri (veriler, giriş, dosyalar) başka adrestedir: hiçbir zaman önbelleğe alınmaz, doğrudan ağa gider.
 */

const VERSION = "__CW_SW_VERSION__";
const CACHE = `cw-shell-${VERSION}`;
const SCOPE = self.registration.scope; // ör. https://panel.alanadi.com/ — adres koddan değil kayıttan gelir
const at = (path) => new URL(path, SCOPE).href;
const SHELL = at("./");
const PRECACHE = [SHELL, at("manifest.webmanifest"), at("icons/icon-192.png"), at("icons/icon-512.png")];
const ASSETS = new URL(at("assets/")).pathname;
const STATIC = [new URL(at("icons/")).pathname, new URL(at("manifest.webmanifest")).pathname];

self.addEventListener("install", (event) => {
  // Bir dosya alınamasa bile kurulum sürer (çevrimdışı kabuk eksik kalır, uygulama etkilenmez).
  event.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" }))))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("cw-shell-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const okToCache = (res) => res && res.ok && res.type === "basic";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase ve diğer servisler: dokunulmaz

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (okToCache(res) && (res.headers.get("content-type") || "").includes("text/html")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        const cached = await caches.match(SHELL);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  if (url.pathname.startsWith(ASSETS)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (okToCache(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    })());
    return;
  }

  if (STATIC.some((p) => url.pathname.startsWith(p))) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const fresh = fetch(req).then((res) => {
        if (okToCache(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      });
      if (cached) { event.waitUntil(fresh.catch(() => {})); return cached; }
      return fresh;
    })());
  }
  // Diğer her şey (geliştirme modülleri, sw.js, .htaccess vb.): tarayıcının normal davranışı.
});

/* Push bildirimi (send-push Edge Function'ı gönderir): { title, body, url, tag } */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "AgencyOS", {
    body: data.body || "Yeni bildiriminiz var.",
    icon: at("icons/icon-192.png"),
    badge: at("icons/favicon-32.png"),
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: at((data.url || "/dashboard").replace(/^\//, "")) },
  }));
});

/* Bildirime tıklanınca: panel açıksa o pencere öne gelir ve adrese gider, değilse yeni pencere açılır. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || SHELL;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins.find((w) => new URL(w.url).origin === new URL(target).origin);
    if (win) { await win.focus(); if ("navigate" in win && win.url !== target) await win.navigate(target).catch(() => {}); return; }
    await self.clients.openWindow(target);
  })());
});
