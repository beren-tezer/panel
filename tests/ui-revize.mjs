// Arayüz revizeleri — marka kartında 5 görev sınırı + "Diğerlerini Göster", üst banttaki bildirim merkezi (zil),
// Marka Dosyaları'nda açık klasörün sayfa yenilemede (Ctrl+R) korunması. Demo verisi, gerçek arayüz etkileşimleri.
//   npm run test:ui:revize
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5195, debugPort: 9355 });
const { page, viewport, check, consoleProblems, send } = h;
const nav = (label) => page(`const b = $$("aside button").find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)})); b.click(); return !!b;`);
const params = () => page(`return Object.fromEntries(new URLSearchParams(location.search));`);
const reload = async () => {
  await send("Page.reload", {});
  await sleep(500);
  await waitFor(() => page(`return !!$("aside[aria-label='Ana menü']") && document.readyState === "complete";`), 45000);
  await sleep(400);
};
// Kart başına: başlıktaki görev sayısı, görünen satır, düğme metni, yükseklik
const cards = () => page(`return $$("[data-brand-card]").map((c) => ({
  id: c.dataset.brandCard, total: +((c.querySelector("[data-card-header] p")?.textContent.match(/(\\d+) görev/) || [0, 0])[1]),
  rows: c.querySelector("[data-card-tasks]").children.length, toggle: c.querySelector("[data-card-toggle]")?.textContent || "", h: Math.round(c.getBoundingClientRect().height),
}));`);

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return !!$("[data-ops-desk]");`), 45000);

  /* 1. Marka kartı: ≤5 görevin tamamı, >5 ise ilk 5 + "Diğerlerini Göster" */
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`), 8000).catch(() => {});
  const list = await cards();
  const withTasks = list.filter((c) => c.total > 0);
  check("Marka kartları görünür", withTasks.length > 0, `${list.length} kart`);
  const wrong = withTasks.filter((c) => c.rows !== Math.min(c.total, 5) || (c.total > 5) !== c.toggle.includes("Diğerlerini Göster"));
  check("5 ve altı görevin tamamı görünür; fazlasında ilk 5 + “Diğerlerini Göster”", wrong.length === 0, JSON.stringify(wrong.slice(0, 3)));
  const big = withTasks.find((c) => c.total > 5);
  if (big) {
    check("Düğme kalan görev sayısını söyler", big.toggle.includes(`(${big.total - 5})`), big.toggle);
    await page(`$("[data-brand-card='${big.id}'] [data-card-toggle]").click(); return true;`); await sleep(250);
    const after = (await cards()).find((c) => c.id === big.id);
    check("“Diğerlerini Göster” tüm görevleri açar; kart uzar (iç kaydırma yok)", after.rows === big.total && after.h > big.h && after.toggle.includes("Daha Az Göster"),
      `${big.rows}→${after.rows} satır, ${big.h}→${after.h}px`);
    await page(`$("[data-brand-card='${big.id}'] [data-card-toggle]").click(); return true;`); await sleep(200);
    check("“Daha Az Göster” 5 göreve döner", (await cards()).find((c) => c.id === big.id).rows === 5);
  } else check("Demo verisinde 5'ten fazla görevli marka var", false, JSON.stringify(withTasks.map((c) => c.total)));
  const small = withTasks.find((c) => c.total <= 5);
  if (small && big) check("Kart yüksekliği görev sayısına göre esner (sabit değil)", small.h < big.h, `${small.total} görev ${small.h}px / ${big.total} görev ${big.h}px`);

  /* 2. Bildirim merkezi (zil) */
  const bell = await page(`const b = $("[data-notification-bell]"); return b ? { label: b.getAttribute("aria-label"), inBand: !!b.closest("[data-topbar-band]") } : null;`);
  check("Üst bantta zil var; okunmamış sayısını söyler", !!bell && bell.inBand && /okunmamış|Bildirimler/.test(bell.label), JSON.stringify(bell));
  await page(`$("[data-notification-bell]").click(); return true;`);
  await waitFor(() => page(`return !!$("[data-notification-center]");`), 2000).catch(() => {});
  const tabs = await page(`const c = $("[data-notification-center]"); return c ? $$("[role='tab']", c).map((t) => t.textContent.replace(/\\d+/g, "").trim()) : [];`);
  check("Bildirim merkezi açılır: “Okunmamış” ve “Tümü” sekmeleri", tabs.includes("Okunmamış") && tabs.includes("Tümü"), JSON.stringify(tabs));
  await page(`$$("[data-notification-center] [role='tab']").find((t) => t.textContent.startsWith("Tümü")).click(); return true;`); await sleep(150);
  const allCount = await page(`return $$("[data-notification-center] li").length;`);
  check("“Tümü” sekmesi bildirimleri listeler", allCount > 0, `${allCount} bildirim`);
  const unreadBefore = await page(`return $$("[data-notification-center] li [aria-label='Okunmadı']").length;`);
  if (unreadBefore) {
    await page(`$("[data-notification-center] li [aria-label='Okunmadı']").closest("button").click(); return true;`); await sleep(400);
    check("Bildirime tıklayınca merkez kapanır, bildirim okundu olur",
      !(await page(`return !!$("[data-notification-center]");`)) && (await page(`return $("[data-notification-bell]").getAttribute("aria-label");`)) !== bell.label);
    await page(`$("button[aria-label='Detayı kapat']")?.click(); return true;`); await sleep(200);
  }
  await page(`$("[data-notification-bell]").click(); return true;`); await sleep(200);
  await page(`exact("[data-notification-center] button", "Tüm bildirimleri gör").click(); return true;`); await sleep(400);
  check("“Tüm bildirimleri gör” Bildirimler sayfasını açar", await page(`return !$("[data-notification-center]") && $("main h1, main h2")?.textContent.includes("Bildirimler");`));

  /* 3. Ctrl+R: Marka Dosyaları'nda açık klasör korunur */
  await nav("Marka Dosyaları");
  await waitFor(() => page(`return $$("main button").some((b) => b.textContent.includes("Tepe Emlak"));`), 4000);
  await page(`$$("main button").find((b) => b.textContent.includes("Tepe Emlak") && b.textContent.includes("klasör")).click(); return true;`);
  await waitFor(() => page(`return !!$("[data-brand-files]");`), 3000);
  await page(`$$("[data-brand-files] button").find((x) => x.textContent.includes("Logolar")).click(); return true;`); await sleep(300);
  check("Açık klasör adrese yazılır", (await params()).klasor === "logolar", JSON.stringify(await params()));
  await reload();
  await waitFor(() => page(`return !!$("[data-brand-files]");`), 5000).catch(() => {});
  check("Ctrl+R sonrası aynı marka ve klasör açık kalır", await page(`const n = $("nav[aria-label='Dosya konumu']"); return !!n && n.textContent.includes("Tepe Emlak") && n.textContent.includes("Logolar");`));

  /* Arayüzde depo adı geçmez (bildirim merkezi dahil) */
  await page(`$("[data-notification-bell]").click(); return true;`); await sleep(200);
  check("Arayüzde “Drive” kelimesi geçmez", await page(`return !/drive/i.test(document.body.innerText);`));

  await sleep(200);
  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check("Beklenmeyen hata", false, err.message);
} finally {
  await h.close();
}
