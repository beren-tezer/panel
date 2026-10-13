/*
 * AgencyOS — rol bazlı yönlendirme (ek paket yok; History API)
 *
 *   Kullanıcı          Giriş sonrası   /dashboard              /onay
 *   Giriş yapmamış     /login          → /login                → /login (?next ile geri döner)
 *   Admin / Çalışan    /dashboard      izinli                  müşteri portalı açılmaz → /dashboard (marka onay ekranı)
 *   Müşteri            /onay           ASLA render edilmez → /onay   izinli
 *   Sözleşmeyi henüz onaylamamış (her rol)  → /sozlesme (?next ile döner); onaylamadan hiçbir panel ekranı açılmaz
 *   Davet / şifre sıfırlama bağlantısıyla gelmiş, şifresini belirlememiş → önce /sifre-olustur (sözleşmeden de önce)
 *   /auth/callback     E-posta bağlantısı dönüşü: hiçbir aşamada yönlendirilmez — ekran doğrulamayı bitirip kendisi yönlendirir
 *                      (oturum kurulmadan /login'e düşülmez; süresi dolmuş bağlantıda açıklama gösterilir).
 *
 * resolveRoute saf bir fonksiyondur (tests/router.test.js). Uygulama her konum değişikliğinde (bağlantı, geri/ileri,
 * doğrudan adres) bu kararı yeniden verir; yetki kararları yine de veritabanında (RLS) uygulanır — bu katman yalnızca
 * yanlış ekranın hiç gösterilmemesini sağlar.
 */

import { parsePortalPath } from "./approvals.js";

export const ROUTES = { login: "/login", dashboard: "/dashboard", portal: "/onay", agreement: "/sozlesme", callback: "/auth/callback", setPassword: "/sifre-olustur" };
const STAFF = new Set(["admin", "employee"]);

/* Giriş sonrası dönülebilecek güvenli iç adresler (açık yönlendirme yok: yalnızca bilinen yollar). */
export function safeNext(next) {
  const p = String(next || "");
  if (p === ROUTES.dashboard) return p;
  return parsePortalPath(p) ? p : null; // "/onay" veya geçerli "/onay/<adres>"
}

/* { redirect: string | null, portal: null | "*" | "<adres>" | "", agreement?: true }
   phase: loading | auth | ready | error ;  role: admin | employee | client | null
   agreementAccepted: false → "Gizlilik ve Rekabet Sözleşmesi" onaylanmadan yalnızca /sozlesme açılır (agreement: true);
                      true / undefined (009 çalıştırılmamış veya demo) → kısıt yok. */
export function resolveRoute({ path, search = "", phase, role, agreementAccepted, needsPassword = false }) {
  if (path === ROUTES.callback) return { redirect: null, portal: null, callback: true };
  const portal = parsePortalPath(path);
  if (phase === "auth") {
    if (path === ROUTES.login) return { redirect: null, portal: null };
    const next = safeNext(path);
    return { redirect: next ? `${ROUTES.login}?next=${encodeURIComponent(next)}` : ROUTES.login, portal: null };
  }
  if (phase !== "ready") return { redirect: null, portal: null }; // yükleniyor / hata: hiçbir korumalı ekran gösterilmez
  const next = path === ROUTES.login || path === ROUTES.agreement || path === ROUTES.setPassword ? safeNext(new URLSearchParams(search).get("next")) : null;
  if (needsPassword && (role === "client" || STAFF.has(role))) {
    if (path === ROUTES.setPassword) return { redirect: null, portal: null, setPassword: true };
    const target = path === ROUTES.login || path === ROUTES.agreement ? next : safeNext(path);
    return { redirect: target ? `${ROUTES.setPassword}?next=${encodeURIComponent(target)}` : ROUTES.setPassword, portal: null };
  }
  if (agreementAccepted === false && (role === "client" || STAFF.has(role))) {
    if (path === ROUTES.agreement) return { redirect: null, portal: null, agreement: true };
    const target = path === ROUTES.login || path === ROUTES.setPassword ? next : safeNext(path);
    return { redirect: target ? `${ROUTES.agreement}?next=${encodeURIComponent(target)}` : ROUTES.agreement, portal: null };
  }
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
  // Geliştirme demoları (?demo, ?authdemo) yönlendirmelerde korunur; diğer sorgu parametreleri taşınmaz.
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search);
  return q.has("demo") ? "?demo" : q.has("authdemo") ? "?authdemo" : "";
};

export function navigate(to, { replace = false } = {}) {
  if (typeof window === "undefined") return;
  const [p, q] = String(to).split("?");
  const query = q ? `?${q}${keepQuery() ? `&${keepQuery().slice(1)}` : ""}` : keepQuery();
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
