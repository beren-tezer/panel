/*
 * AgencyOS — rol bazlı yönlendirme (ek paket yok; History API)
 *
 *   Kullanıcı          Giriş sonrası   /dashboard              /onay
 *   Giriş yapmamış     /login          → /login                → /login (?next ile geri döner)
 *   Admin / Çalışan    /dashboard      izinli                  müşteri portalı açılmaz → /dashboard (marka onay ekranı)
 *   Müşteri            /onay           ASLA render edilmez → /onay   izinli
 *
 * resolveRoute saf bir fonksiyondur (tests/router.test.js). Uygulama her konum değişikliğinde (bağlantı, geri/ileri,
 * doğrudan adres) bu kararı yeniden verir; yetki kararları yine de veritabanında (RLS) uygulanır — bu katman yalnızca
 * yanlış ekranın hiç gösterilmemesini sağlar.
 */

import { parsePortalPath } from "./approvals.js";

export const ROUTES = { login: "/login", dashboard: "/dashboard", portal: "/onay" };
const STAFF = new Set(["admin", "employee"]);

/* Giriş sonrası dönülebilecek güvenli iç adresler (açık yönlendirme yok: yalnızca bilinen yollar). */
export function safeNext(next) {
  const p = String(next || "");
  if (p === ROUTES.dashboard) return p;
  return parsePortalPath(p) ? p : null; // "/onay" veya geçerli "/onay/<adres>"
}

/* { redirect: string | null, portal: null | "*" | "<adres>" | "" }
   phase: loading | auth | ready | error ;  role: admin | employee | client | null */
export function resolveRoute({ path, search = "", phase, role }) {
  const portal = parsePortalPath(path);
  if (phase === "auth") {
    if (path === ROUTES.login) return { redirect: null, portal: null };
    const next = safeNext(path);
    return { redirect: next ? `${ROUTES.login}?next=${encodeURIComponent(next)}` : ROUTES.login, portal: null };
  }
  if (phase !== "ready") return { redirect: null, portal: null }; // yükleniyor / hata: hiçbir korumalı ekran gösterilmez
  const next = path === ROUTES.login ? safeNext(new URLSearchParams(search).get("next")) : null;
  if (role === "client") {
    if (portal !== null) return { redirect: null, portal };
    const target = next && parsePortalPath(next) !== null ? next : ROUTES.portal;
    return { redirect: target, portal: parsePortalPath(target) };
  }
  if (STAFF.has(role)) {
    // Ekip müşteri portalını görmez; marka bağlantısı ajans tarafındaki onay ekranını açar.
    if (portal !== null) return { redirect: ROUTES.dashboard, portal };
    if (path === ROUTES.dashboard) return { redirect: null, portal: null };
    const fromNext = next ? parsePortalPath(next) : null;
    return { redirect: ROUTES.dashboard, portal: fromNext };
  }
  return { redirect: null, portal: null }; // geçersiz / eksik rol: varsayılan yetki YOK (uygulama erişim yok ekranı gösterir)
}

/* ───────────────────────── Tarayıcı ───────────────────────── */

const EVENT = "cw:navigate";
const keepQuery = () => {
  // Geliştirme demosu (?demo) yönlendirmelerde korunur; diğer sorgu parametreleri taşınmaz.
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).has("demo") ? "?demo" : "";
};

export function navigate(to, { replace = false } = {}) {
  if (typeof window === "undefined") return;
  const [p, q] = String(to).split("?");
  const query = q ? `?${q}${keepQuery() ? "&demo" : ""}` : keepQuery();
  const url = `${p}${query}`;
  if (`${window.location.pathname}${window.location.search}` === url) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", url);
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeLocation(fn) {
  window.addEventListener("popstate", fn);
  window.addEventListener(EVENT, fn);
  return () => { window.removeEventListener("popstate", fn); window.removeEventListener(EVENT, fn); };
}
export const locationKey = () => `${window.location.pathname}${window.location.search}`;
