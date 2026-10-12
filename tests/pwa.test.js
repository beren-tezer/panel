import { test } from "node:test";
import assert from "node:assert/strict";
import { buildManifest, serviceWorkerSource } from "../pwa.js";

test("Varsayılan manifest adrese bağımsızdır (göreli start_url / scope / simgeler)", () => {
  const m = buildManifest({});
  assert.equal(m.start_url, "./");
  assert.equal(m.scope, "./");
  assert.equal(m.display, "standalone");
  assert.equal(m.lang, "tr");
  assert.ok(m.icons.some((i) => i.sizes === "192x192") && m.icons.some((i) => i.sizes === "512x512" && i.purpose === "any"));
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  for (const i of m.icons) assert.ok(!i.src.startsWith("/") && !/^https?:/.test(i.src), `simge göreli olmalı: ${i.src}`);
  assert.ok(!JSON.stringify(m).includes("ornekalan"), "alan adı gömülmez");
});

test("Ortam değişkenleri uygulanır; boş değer varsayılana döner", () => {
  const m = buildManifest({ VITE_APP_NAME: "Örnek Panel", VITE_PWA_START_URL: "./dashboard", VITE_PWA_SCOPE: "./", VITE_THEME_COLOR: "#112233", VITE_APP_SHORT_NAME: "  " });
  assert.equal(m.name, "Örnek Panel");
  assert.equal(m.short_name, "Atlas Ajans");
  assert.equal(m.start_url, "./dashboard");
  assert.equal(m.id, "./dashboard");
  assert.equal(m.theme_color, "#112233");
  assert.equal(buildManifest({ VITE_PWA_START_URL: "https://panel.ornek.com/", VITE_PWA_SCOPE: "https://panel.ornek.com/" }).start_url, "https://panel.ornek.com/");
});

test("Hatalı değerde derleme durur", () => {
  assert.throws(() => buildManifest({ VITE_PWA_START_URL: "javascript:alert(1)" }), /VITE_PWA_START_URL/);
  assert.throws(() => buildManifest({ VITE_PWA_START_URL: "//kotu.com/" }), /VITE_PWA_START_URL/);
  assert.throws(() => buildManifest({ VITE_PWA_SCOPE: "http://ornek.com/" }), /VITE_PWA_SCOPE/);
  assert.throws(() => buildManifest({ VITE_THEME_COLOR: "orange" }), /renk/);
  assert.throws(() => buildManifest({ VITE_PWA_START_URL: "/", VITE_PWA_SCOPE: "/panel/" }), /kapsamının içinde/);
});

test("Service worker: sürüm gömülür, alan adı gömülmez, Supabase (başka adres) önbelleğe alınmaz", () => {
  const sw = serviceWorkerSource("abc123");
  assert.ok(sw.includes('"abc123"') && !sw.includes("__CW_SW_VERSION__"));
  assert.ok(sw.includes("self.registration.scope"));
  assert.ok(sw.includes("url.origin !== self.location.origin"));
  assert.ok(!/supabase\.co|ornekalan/.test(sw));
});
