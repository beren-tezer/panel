// PWA — derlenmiş sürümde (vite build → geçici klasör → vite preview) manifest, service worker, çevrimdışı açılış,
// yüklenebilirlik. dist/ klasörüne dokunulmaz.   npm run test:ui:pwa
// Not: uygulama .env'deki Supabase ayarlarıyla açılır ama giriş yapılmaz; yalnızca giriş ekranına kadar yüklenir.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const out = mkdtempSync(join(tmpdir(), "cw-pwa-"));
const build = spawnSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--outDir", out, "--emptyOutDir", "--logLevel", "error"], { encoding: "utf8" });
if (build.status !== 0) { console.log(build.stderr || build.stdout); process.exit(1); }
const file = (p) => readFileSync(join(out, p), "utf8");
const pre = [
  ["Derleme: manifest.webmanifest, sw.js, simgeler ve .htaccess üretildi", ["manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", ".htaccess"].every((p) => existsSync(join(out, p)))],
  ["sw.js sürümlüdür (yer tutucu kalmadı)", /const VERSION = "[0-9a-f]{12}"/.test(file("sw.js")) && !file("sw.js").includes("__CW_SW_VERSION__")],
  ["index.html: manifest, theme-color, apple-touch-icon", /rel="manifest" href="\/manifest\.webmanifest"/.test(file("index.html")) && file("index.html").includes('name="theme-color"') && file("index.html").includes("apple-touch-icon")],
  ["Derlemede alan adı gömülü değil (manifest + sw)", !/ornekalan|https?:\/\//.test(file("manifest.webmanifest")) && !/ornekalan/.test(file("sw.js"))],
];

const h = await startHarness({ port: 5188, debugPort: 9342, viteArgs: ["preview", "--outDir", out] });
const { page, check, consoleProblems, send } = h;
const base = h.url.replace("/?demo", "");
for (const [name, ok] of pre) check(name, ok);

try {
  await send("Page.navigate", { url: `${base}/login` });
  await waitFor(() => page(`return !!$("input[aria-label='E-posta']");`), 20000);
  const m = await page(`const href = $("link[rel='manifest']").href; const r = await fetch(href); return { type: r.headers.get("content-type"), json: await r.json(), href };`);
  check("Manifest yüklenir: göreli start_url / scope sayfanın adresine çözülür", m.json.start_url === "./" && new URL(m.json.start_url, m.href).href === `${base}/` && new URL(m.json.scope, m.href).href === `${base}/`, JSON.stringify({ s: m.json.start_url, href: m.href }));

  const reg = await page(`const r = await navigator.serviceWorker.ready; return { scope: r.scope, active: !!r.active };`);
  check("Service worker kaydedilir (kapsam = sitenin kökü)", reg.active && reg.scope === `${base}/`, JSON.stringify(reg));
  await send("Page.reload", {});
  await waitFor(() => page(`return !!navigator.serviceWorker.controller && !!$("input[aria-label='E-posta']");`), 20000).catch(() => {});
  check("Yeniden yüklemede sayfa service worker denetiminde", await page(`return !!navigator.serviceWorker.controller;`));

  const inst = await send("Page.getInstallabilityErrors", {}).catch((e) => ({ error: e.message }));
  check("Tarayıcıya göre yüklenebilir (ana ekrana eklenebilir)", Array.isArray(inst.installabilityErrors) && inst.installabilityErrors.length === 0, JSON.stringify(inst));

  const cached = await page(`const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url); return out;`);
  check("Önbellekte yalnızca uygulama kabuğu var (Supabase / başka adres yok)", cached.length > 0 && cached.every((u) => u.startsWith(base)), cached.filter((u) => !u.startsWith(base)).join(", "));

  await send("Network.enable", {});
  await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send("Page.navigate", { url: `${base}/dashboard` });
  await sleep(1500);
  const offline = await page(`return { title: document.title, root: document.getElementById("root")?.textContent.length || 0, text: document.body.textContent.slice(0, 120) };`).catch((e) => ({ error: e.message }));
  check("Çevrimdışı açılışta uygulama kabuğu yüklenir (tarayıcı hata sayfası yerine)", offline.title === "AgencyOS" && offline.root > 0, JSON.stringify(offline));
  await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // Çevrimdışı denemenin ağ hataları beklenen durumdur; yalnızca ondan önceki konsol kayıtları değerlendirilir.
  const relevant = consoleProblems.filter((x) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError|net::/i.test(x));
  check("Konsolda hata yok", relevant.length === 0, relevant.slice(0, 3).join(" || "));
} catch (err) {
  check(`Beklenmeyen hata: ${err.message}`, false);
} finally {
  try { rmSync(out, { recursive: true, force: true }); } catch { /* yok say */ }
  await h.close();
}
