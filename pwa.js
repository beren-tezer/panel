/*
 * AgencyOS — PWA (ana ekrana eklenebilir uygulama)
 *
 * Vite eklentisi `manifest.webmanifest` ve `sw.js` dosyalarını ortam değişkenlerinden üretir:
 *   • `npm run build` → dist/manifest.webmanifest + dist/sw.js (sürüm, derlenen dosyaların özetinden; her yeni sürümde
 *     tarayıcı service worker'ı günceller)
 *   • `npm run dev`   → aynı dosyalar bellekten sunulur (service worker yalnızca VITE_PWA_DEV=true ise kaydedilir)
 *
 * Adrese bağımlı değildir: start_url / scope / simgeler varsayılan olarak GÖRELİ yazılır ("./") ve tarayıcı bunları
 * manifest dosyasının bulunduğu adrese göre çözer. Aynı derleme ana alan adında da bir alt alan adında da çalışır.
 * Ortam değişkenleri (hepsi isteğe bağlı; .env.example):
 *   VITE_APP_NAME, VITE_APP_SHORT_NAME, VITE_PWA_START_URL, VITE_PWA_SCOPE, VITE_THEME_COLOR, VITE_BACKGROUND_COLOR
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const DEFAULTS = {
  name: "AgencyOS",
  shortName: "Atlas Ajans",
  startUrl: "./",
  scope: "./",
  themeColor: "#00ADA7", // üst bant renk geçişinin ilk rengi (tarayıcı / uygulama penceresi başlığı)
  backgroundColor: "#f8fafc",
};

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
// Göreli yol ("./", "./dashboard", "/") veya tam https adresi. Boşluk, tırnak ve protokolsüz "//alan" kabul edilmez.
const URLISH = /^(\.\/|\/(?!\/)|https:\/\/)[^\s"'<>]*$/;

/* Ortam değişkenlerinden manifest nesnesi (saf fonksiyon — tests/pwa.test.js). Hatalı değerde derleme durur. */
export function buildManifest(env = {}) {
  const pick = (key, fallback) => (env[key] ?? "").trim() || fallback;
  const m = {
    name: pick("VITE_APP_NAME", DEFAULTS.name),
    shortName: pick("VITE_APP_SHORT_NAME", DEFAULTS.shortName),
    startUrl: pick("VITE_PWA_START_URL", DEFAULTS.startUrl),
    scope: pick("VITE_PWA_SCOPE", DEFAULTS.scope),
    themeColor: pick("VITE_THEME_COLOR", DEFAULTS.themeColor),
    backgroundColor: pick("VITE_BACKGROUND_COLOR", DEFAULTS.backgroundColor),
  };
  for (const k of ["startUrl", "scope"]) if (!URLISH.test(m[k])) throw new Error(`PWA: ${k === "startUrl" ? "VITE_PWA_START_URL" : "VITE_PWA_SCOPE"} geçersiz: "${m[k]}" ("./", "/yol" veya https://… olmalı)`);
  for (const k of ["themeColor", "backgroundColor"]) if (!HEX.test(m[k])) throw new Error(`PWA: renk #rrggbb biçiminde olmalı: "${m[k]}"`);
  // start_url kapsamın (scope) içinde olmalı; aksi hâlde tarayıcı uygulamayı yüklenebilir saymaz.
  const base = "https://ornek.invalid/";
  const start = new URL(m.startUrl, base).href, scope = new URL(m.scope, base).href;
  if (!start.startsWith(scope)) throw new Error(`PWA: VITE_PWA_START_URL (${m.startUrl}) VITE_PWA_SCOPE (${m.scope}) kapsamının içinde olmalı.`);
  return {
    id: m.startUrl,
    name: m.name,
    short_name: m.shortName,
    description: "Atlas Ajans ajans içerik, görev ve müşteri onay paneli",
    lang: "tr",
    dir: "ltr",
    start_url: m.startUrl,
    scope: m.scope,
    display: "standalone",
    orientation: "any",
    theme_color: m.themeColor,
    background_color: m.backgroundColor,
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

const SW_TEMPLATE = fileURLToPath(new URL("./src/service-worker.js", import.meta.url));
export const serviceWorkerSource = (version) => readFileSync(SW_TEMPLATE, "utf8").replaceAll("__CW_SW_VERSION__", version);

export function pwaPlugin() {
  let manifest, base;
  const manifestJson = () => JSON.stringify(manifest, null, 2);
  return {
    name: "agencyos-pwa",
    configResolved(config) {
      base = config.base;
      manifest = buildManifest(loadEnv(config.mode, config.envDir || config.root, "VITE_"));
    },
    transformIndexHtml() {
      const meta = (name, content) => ({ tag: "meta", attrs: { name, content }, injectTo: "head" });
      return [
        { tag: "link", attrs: { rel: "manifest", href: `${base}manifest.webmanifest` }, injectTo: "head" },
        // Simgeler public/icons/app-icon.png'den üretilir (npm run icons).
        { tag: "link", attrs: { rel: "icon", href: `${base}favicon.ico`, sizes: "any" }, injectTo: "head" },
        { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "32x32", href: `${base}icons/favicon-32.png` }, injectTo: "head" },
        { tag: "link", attrs: { rel: "apple-touch-icon", sizes: "180x180", href: `${base}icons/apple-touch-icon.png` }, injectTo: "head" },
        meta("theme-color", manifest.theme_color),
        meta("mobile-web-app-capable", "yes"),
        meta("apple-mobile-web-app-capable", "yes"),
        meta("apple-mobile-web-app-title", manifest.short_name),
        meta("apple-mobile-web-app-status-bar-style", "default"),
      ];
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (path === `${base}manifest.webmanifest`) { res.setHeader("Content-Type", "application/manifest+json"); res.end(manifestJson()); return; }
        if (path === `${base}sw.js`) { res.setHeader("Content-Type", "text/javascript"); res.setHeader("Cache-Control", "no-cache"); res.end(serviceWorkerSource("dev")); return; }
        next();
      });
    },
    generateBundle(_options, bundle) {
      // Sürüm: derlenen dosya adları (içerik özetli) + manifest → kod değişince sw.js de değişir, tarayıcı günceller.
      const version = createHash("sha256").update(Object.keys(bundle).sort().join("|")).update(manifestJson()).digest("hex").slice(0, 12);
      this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: manifestJson() });
      this.emitFile({ type: "asset", fileName: "sw.js", source: serviceWorkerSource(version) });
    },
  };
}
