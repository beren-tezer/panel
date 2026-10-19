// Rol bazlı yönlendirme — tarayıcı testleri (demo verisi; demo oturumu admin olarak açılır, roller rol değiştiriciyle).
//   npm run test:ui:routing
// Giriş yapmamış kullanıcı (/login), çıkış ve oturum süresi Supabase Auth gerektirir: kurallar tests/router.test.js'te,
// gerçek oturumla doğrulama canlı / geliştirme projesinde yapılır.
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5185, debugPort: 9339 });
const { page, viewport, check, consoleProblems, send } = h;
const base = h.url.replace("/?demo", "");
// Ekran parametreleri (?sayfa, ?marka … — sayfa yenilemede kalınan ekran) yönlendirme kararının parçası değildir.
const path = () => page(`const q = new URLSearchParams(location.search); ["sayfa", "sekme", "marka", "gorev", "icerik", "toplu"].forEach((k) => q.delete(k));
  const s = q.toString().replace(/=(&|$)/g, "$1"); return location.pathname + (s ? "?" + s : "");`);
const role = async (r, u) => { await page(`setValue($("select[aria-label='Rol']"), ${JSON.stringify(r)});`); await sleep(300); if (u) { await page(`setValue($("select[aria-label='Görüntülenen kullanıcı']"), ${JSON.stringify(u)});`); await sleep(300); } };
// Dashboard'un bir an bile çizilip çizilmediğini izler (marka kartı / çalışan kutusu / admin menüsü).
const watchDashboard = () => page(`window.__dashSeen = false; window.__obs?.disconnect(); window.__obs = new MutationObserver(() => {
  if (document.querySelector("[data-brand-card], [data-employee-boxes]") || [...document.querySelectorAll("aside button")].some((b) => b.textContent.includes("Ekip & Marka Yönetimi"))) window.__dashSeen = true; });
  window.__obs.observe(document.body, { childList: true, subtree: true }); return true;`);

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`));
  check("Senaryo 3: admin girişte /dashboard'a yönlenir", (await path()) === "/dashboard?demo", await path());

  await role("client", "c1");
  await waitFor(() => page(`return location.pathname === "/onay";`), 3000).catch(() => {});
  const client = await page(`return { path: location.pathname, title: $("h1, h2")?.textContent, cards: !!$("[data-brand-card]"), adminNav: $$("aside button").some((b) => /Ekip & Marka|Kullanıcılar|Günlük Operasyon/.test(b.textContent)) };`);
  check("Senaryo 1: müşteri /onay'a yönlenir; onay bekleyen içerikler açılır", client.path === "/onay" && /Onay Bekleyen/.test(client.title || ""), JSON.stringify(client));
  check("Müşteri portalında ajans paneli ve yönetim menüleri yok", !client.cards && !client.adminNav, JSON.stringify(client));

  await watchDashboard();
  await page(`history.pushState(null, "", "/dashboard?demo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(500);
  const d1 = await page(`return { path: location.pathname, seen: window.__dashSeen, cards: !!$("[data-brand-card]") };`);
  check("Senaryo 2: müşteri /dashboard'a gidince panel HİÇ çizilmeden /onay'a döner", d1.path === "/onay" && !d1.seen && !d1.cards, JSON.stringify(d1));

  await watchDashboard();
  await page(`history.back(); return true;`);
  await sleep(600);
  const d2 = await page(`return { path: location.pathname, seen: window.__dashSeen };`);
  check("Senaryo 8: geri tuşu yetki kontrolünü aşamaz", d2.path === "/onay" && !d2.seen, JSON.stringify(d2));

  await page(`history.pushState(null, "", "/onay/sofra-pide?demo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(500);
  check("Müşteri başka markanın bağlantısıyla o markaya erişemez (bilgi sızdırmayan mesaj)", await page(`return !!$("[data-portal-denied]") && !document.body.textContent.includes("Makarna çeşitleri");`));
  await page(`history.pushState(null, "", "/onay/tepe-emlak?demo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(500);
  check("Müşteri kendi markasının bağlantısıyla onay ekranına gelir", await page(`return !$("[data-portal-denied]") && document.body.textContent.includes("Kira artış oranı");`));

  await role("employee", "u2");
  await waitFor(() => page(`return location.pathname === "/dashboard";`), 3000).catch(() => {});
  check("Çalışan /dashboard'a yönlenir (çalışan ekranı)", (await path()) === "/dashboard?demo" && await page(`return !!$("[data-employee-boxes]");`), await path());

  await role("admin");
  await page(`history.pushState(null, "", "/onay/tepe-emlak?demo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(600);
  const a1 = await page(`const m = $("main").textContent; return { path: location.pathname, approvals: m.includes("İçeriklerin iç onaydan"), brand: m.includes("Kira artış oranı") && !m.includes("Makarna çeşitleri") };`);
  check("Admin marka onay bağlantısında müşteri portalını görmez; ajans onay ekranı o markayla açılır", a1.path === "/dashboard" && a1.approvals && a1.brand, JSON.stringify(a1));

  for (const p of ["/onay", "/baska-bir-yol", "/login"]) {
    await page(`history.pushState(null, "", "${p}?demo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
    await sleep(400);
    check(`Admin ${p} → /dashboard`, (await path()) === "/dashboard?demo", await path());
  }

  // Doğrudan adres / yeni sekme: sayfa sıfırdan yüklenince de aynı kural
  await send("Page.navigate", { url: `${base}/onay/tepe-emlak?demo` });
  await waitFor(() => page(`return !!$("main");`), 8000);
  await sleep(400);
  check("Senaryo 4/8: doğrudan adresle açılış (yeni sekme) aynı kurallardan geçer", (await path()) === "/dashboard?demo" && await page(`return $("main").textContent.includes("İçeriklerin iç onaydan");`), await path());

  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check(`Beklenmeyen hata: ${err.message}`, false);
} finally {
  await h.close();
}
