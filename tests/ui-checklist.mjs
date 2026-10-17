// İçerik Üretim Kontrol Listesi — tarayıcı kabul testleri (demo verisi, gerçek arayüz etkileşimleri).
//   npm run test:ui:checklist
// Sunucu tarafı kurallar (RLS, API ile atlatma, kalıcılık) PGlite üzerinde ayrıca test edilir (bkz. özet).
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5181, debugPort: 9335 });
const { page, viewport, key, check, consoleProblems, send } = h;
const drawer = `$("aside[aria-label='Görev detayı']")`;
const section = `$("[data-checklist]")`;
// Görev başlığına göre açar: tablo / kart düğmesi veya çalışan ekranı kutu öğesi ([data-box-task]).
const findTask = (title) => `($$("button").find((x) => x.textContent.trim() === ${JSON.stringify(title)}) || $$("[data-box-task]").find((x) => x.querySelector(".cw-clamp2")?.textContent.trim() === ${JSON.stringify(title)}))`;
const openTaskByTitle = (title) => page(`const b = ${findTask(title)}; b.click(); return !!b;`);
const waitDrawer = (title) => waitFor(() => page(`const d = ${drawer}; return d && d.querySelector("textarea[aria-label='Görev başlığı']").value.startsWith(${JSON.stringify(title)}) && !!d.querySelector("[data-checklist] [data-check-item]");`), 6000);
const header = () => page(`return $("[id^='cl-title-']").textContent;`);
const counts = () => page(`const m = $("[id^='cl-title-']").textContent.match(/(\\d+)\\/(\\d+)/); return m ? [+m[1], +m[2]] : null;`);
const closeDrawer = async () => { await page(`$("button[aria-label='Detayı kapat']").click();`); await waitFor(() => page(`return !${drawer};`), 3000); };
const switchRole = async (role, userId) => {
  await page(`setValue($("select[aria-label='Rol']"), ${JSON.stringify(role)});`);
  if (userId) { await sleep(200); await page(`setValue($("select[aria-label='Görüntülenen kullanıcı']"), ${JSON.stringify(userId)});`); }
  await sleep(400);
};
const toastText = () => page(`const t = $$("[role='status'],[role='alert']").map((x) => x.textContent).join(" | "); return t;`);

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`));

  /* ── 14. Pano: göstergeler, kart boyutları ve bağımsız kaydırma korunur ── */
  // Kartlar varsayılan olarak 1 görev gösterir; "Diğerlerini Göster" ile açılan kartlarda tüm görevler kart içinde kayar.
  await page(`$$("[data-card-toggle][aria-expanded='false']").forEach((b) => b.click()); await tick(400); return true;`);
  const board = await page(`const cards = $$("[data-brand-card]"); return {
    indicators: $$("[data-checklist-indicator]").length,
    sample: $("[data-checklist-indicator]")?.getAttribute("title"),
    heights: new Set(cards.map((c) => Math.round(c.getBoundingClientRect().height))).size,
    h: Math.round(cards[0].getBoundingClientRect().height),
    scroll: $$("[data-card-tasks]").every((el) => getComputedStyle(el).overflowY === "auto"),
    rows: $$("[data-task-row]").filter((r) => r.scrollWidth > r.clientWidth + 1).length,
  };`);
  check("Pano: kontrol göstergesi görünür (Kontrol: x/y)", board.indicators > 10 && /^Kontrol: \d+\/\d+/.test(board.sample), JSON.stringify(board));
  check("Açılan marka kartları eşit (420px), görev listesi kendi içinde kayar, satır taşması yok", board.heights === 1 && board.h === 420 && board.scroll && board.rows === 0, JSON.stringify(board));

  /* ── Çalışan: Ayşe Demir ── */
  await switchRole("employee", "u2");
  await waitFor(() => page(`return !!${findTask("Öğle menüsü duyuru serisi")};`));
  await openTaskByTitle("Öğle menüsü duyuru serisi");
  await waitDrawer("Öğle menüsü duyuru serisi");
  check("Görev detayında “İçerik Kontrolü — x/12 Tamamlandı” ve durum etiketi", /İçerik Kontrolü — \d+\/12 Tamamlandı/.test(await header())
    && await page(`return ["not_started", "checking"].includes($("[data-checklist-state]").dataset.checklistState);`), await header());
  const cats = await page(`return $$("[data-check-group]").map((g) => g.textContent.match(/^[^0-9]+/)[0].trim());`);
  check("Kategoriler: Görsel Kimlik / İçerik & Metin / Teknik", cats.join("|") === "Görsel Kimlik Kontrolü|İçerik & Metin Kontrolü|Teknik Kontroller", cats.join("|"));

  /* ── 1–2. Kılavuz çekmecesi görev durumunu bozmaz; HEX kopyalanır ── */
  await page(`setValue($("textarea[aria-label='Görev başlığı']"), "Öğle menüsü duyuru serisi — taslak v2");`);
  await page(`$("button[aria-label='Marka Kılavuzunu Gör']").click();`);
  await waitFor(() => page(`return !!$("aside[aria-label='Sofra Pide kılavuzu']") && $$("aside[aria-label='Sofra Pide kılavuzu'] button").some((b) => /#[0-9A-F]{6}/.test(b.textContent));`), 5000);
  const kit = await page(`const k = $("aside[aria-label='Sofra Pide kılavuzu']"); return {
    blocks: $$("h4", k).map((x) => x.textContent), fonts: k.textContent.includes("Playfair Display"), logo: !!k.querySelector("[aria-hidden], img, span"),
  };`);
  check("Kılavuz çekmecesi: renkler, tipografi, kurallar, dosyalar", ["Renkler", "Tipografi", "Dosyalar & Bağlantılar"].every((b) => kit.blocks.includes(b)) && kit.fonts, kit.blocks.join(", "));
  // Başsız tarayıcıda pano okunamadığı için yazılan değer yakalanır (gerçek writeText de çağrılır).
  await page(`window.__copied = []; const w = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = (t) => { window.__copied.push(t); return w(t).catch(() => {}); };`);
  const hex = await page(`const b = $$("aside[aria-label='Sofra Pide kılavuzu'] button").find((x) => /#[0-9A-F]{6}/.test(x.textContent)); b.click(); return b.textContent.match(/#[0-9A-F]{6}/)[0];`);
  const copied = await waitFor(() => page(`return $$("aside[aria-label='Sofra Pide kılavuzu'] button").some((x) => x.textContent.includes(${JSON.stringify(hex)}) && x.textContent.includes("Kopyalandı"));`), 3000).catch(() => false);
  const clip = await page(`return window.__copied.at(-1);`);
  check("HEX koduna tıklayınca doğru renk kopyalanır", copied && clip === hex, `${hex} → ${clip}`);
  await key("Escape");
  await waitFor(() => page(`return !$("aside[aria-label='Sofra Pide kılavuzu']");`), 3000);
  check("Kılavuz kapanınca görev açık kalır ve yazılan başlık korunur",
    await page(`return !!${drawer} && $("textarea[aria-label='Görev başlığı']").value === "Öğle menüsü duyuru serisi — taslak v2";`));

  /* ── 4. İşaretleme ilerlemeyi günceller ── */
  const before = await counts();
  await page(`$$("[data-checklist] button[role='checkbox'][aria-checked='false']")[0].click();`);
  await waitFor(async () => (await counts())[0] === before[0] + 1, 3000);
  const meta = await page(`const li = $$("[data-check-item]").find((x) => x.querySelector("[aria-checked='true']")); return li.textContent;`);
  check("Madde işaretlenince ilerleme artar; tamamlayan ve zaman görünür", meta.includes("Ayşe Demir") && /Bugün · \d\d:\d\d/.test(meta), `${before} → ${await counts()}`);
  const indicatorNow = await page(`const t = $$("[data-box-task]").find((a) => a.textContent.includes("Öğle menüsü duyuru serisi")); return t?.querySelector("[data-checklist-indicator]")?.dataset.checklistIndicator;`);
  check("Çalışan ekranındaki görev göstergesi aynı anda güncellenir", indicatorNow === `${before[0] + 1}/12`, indicatorNow);

  /* Not ekleme */
  await page(`$$("[data-check-item] button[aria-label*='için not ekle']")[0].click();`);
  await page(`setValue($("[data-check-item] textarea"), "Fontu Playfair'e çevirdim");`);
  await page(`exact("button", "Notu Kaydet").click();`);
  check("Maddeye ekip içi not eklenir", await waitFor(() => page(`return $$("[data-check-item] p").some((p) => p.textContent.includes("Fontu Playfair'e çevirdim"));`), 2000).catch(() => false));

  /* ── 5. Eksik zorunlu kontrolle gönderim engellenir ── */
  const missingBefore = await page(`return $$("[data-check-item]").filter((li) => li.querySelector("[aria-checked='false']") && li.textContent.includes("Zorunlu")).length;`);
  await page(`exact("button", "Onaya Gönder", ${drawer}).click();`);
  await waitFor(() => page(`return $$("[data-missing='true']").length > 0;`), 3000).catch(() => {});
  const blocked = await page(`return {
    missing: $$("[data-missing='true']").length,
    banner: $("[data-checklist] [role='alert']")?.textContent || "",
    status: $$("button", ${drawer}).find((b) => b.getAttribute("aria-haspopup") || b.textContent.includes("Çalışılıyor"))?.textContent || "",
  };`);
  check("Eksik zorunlu kontrolde gönderim engellenir, uyarı ve vurgulama gösterilir",
    blocked.missing === missingBefore && blocked.banner.includes(`${missingBefore} zorunlu kontrolü tamamlamalısınız`) && (await toastText()).includes("zorunlu kontrolü"), JSON.stringify(blocked));
  check("Durum değişmez (Çalışılıyor)", await page(`return ${drawer}.textContent.includes("Çalışılıyor") && !$$("[data-checklist-state]")[0].textContent.includes("Kontroller Tamamlandı");`));

  /* ── 6–7. Zorunlular tamamlanınca (isteğe bağlılar boşken) gönderim başarılı ── */
  for (let i = 0; i < 20; i++) {
    const left = await page(`const b = $$("[data-missing='true'] button[role='checkbox'][aria-checked='false']")[0]; if (b) b.click(); return !!b;`);
    if (!left) break;
    await sleep(60);
  }
  const ready = await page(`return { state: $("[data-checklist-state]").textContent, optionalOpen: $$("[data-check-item]").filter((li) => li.textContent.includes("İsteğe bağlı") && li.querySelector("[aria-checked='false']")).length, banner: !!$("[data-checklist] [role='alert']") };`);
  check("Zorunlular tamamlanınca “Onaya Hazır” (isteğe bağlılar boş)", ready.state === "Onaya Hazır" && ready.optionalOpen > 0 && !ready.banner, JSON.stringify(ready));
  await page(`exact("button", "Onaya Gönder", ${drawer}).click();`);
  await waitFor(() => page(`return ${drawer}.textContent.includes("Müşteri Onayı");`), 3000).catch(() => {});
  check("Gönderim başarılı; durum Müşteri Onayı", (await toastText()).includes("müşteri onayına gönderildi") && await page(`return $("[data-checklist-state]").textContent === "Kontroller Tamamlandı";`), await toastText());
  check("Gönderimden sonra çalışan için kontroller kilitlenir", await page(`return $$("[data-checklist] button[role='checkbox']").every((b) => b.disabled) && ${section}.textContent.includes("kontroller kilitli");`));
  await page(`byText("button", "Kontrol Geçmişi").click();`);
  check("Kontrol geçmişinde gönderim kaydı (zorunlu 10/10) ve işaretleme kayıtları",
    await waitFor(() => page(`const h = $("[data-checklist-history]"); return h && h.textContent.includes("Müşteri Onayı") && h.textContent.includes("Zorunlu 10/10") && h.textContent.includes("tamamladı") && h.textContent.includes("not yazdı");`), 3000).catch(() => false));
  await closeDrawer();

  /* ── 11. Müşteri: kontrol listesi, not ve geçmişi görmez; 10. revize ister ── */
  await switchRole("client", "c2");
  await page(`$$("aside button").find((b) => b.textContent.includes("İçeriklerim")).click();`);
  await waitFor(() => page(`return !!$$("button").find((b) => b.textContent.includes("Öğle menüsü duyuru serisi"));`), 4000);
  await page(`$$("button").find((b) => b.textContent.includes("Öğle menüsü duyuru serisi")).click();`);
  await waitFor(() => page(`return !!$("[data-cw-modal] [role='dialog']");`), 3000);
  check("Müşteri içerik detayında kontrol listesi / not / ekip içi kayıt görmez",
    await page(`const d = document.body.textContent; return !$("[data-checklist]") && !$("[data-checklist-indicator]") && !d.includes("İçerik Kontrolü") && !d.includes("Fontu Playfair'e çevirdim");`));
  await page(`exact("button", "Revize Talebi Yaz").click();`);
  await waitFor(() => page(`return !!$("#cw-revision textarea");`), 3000);
  await page(`setValue($("#cw-revision textarea"), "Logo biraz daha büyük olsun.");`);
  await page(`byText("button", "Revize Talebini Gönder").click();`);
  await sleep(500);

  await switchRole("employee", "u2");
  await waitFor(() => page(`return !!${findTask("Öğle menüsü duyuru serisi")};`));
  await openTaskByTitle("Öğle menüsü duyuru serisi");
  await waitDrawer("Öğle menüsü");
  const rev = await page(`return { cycle: $("[data-checklist-cycle]").dataset.checklistCycle, label: $("[data-checklist-cycle]").textContent, unlocked: $$("[data-checklist] button[role='checkbox']").some((b) => !b.disabled), header: $("[id^='cl-title-']").textContent };`);
  check("Revize sonrası yeni döngü: “Revizyon 1 — Kontrol Bekliyor”, kontroller yeniden açılır", rev.cycle === "1" && rev.label === "Revizyon 1 — Kontrol Bekliyor" && rev.unlocked, JSON.stringify(rev));
  check("Revizyonda yeniden kontrol gereken maddeler sıfırlanır", (await counts())[0] === 0, await header());
  await page(`byText("button", "Kontrol Geçmişi").click();`);
  check("Önceki döngü geçmişte korunur (İlk Teslim, kapandı)", await waitFor(() => page(`const h = $("[data-checklist-history]"); return h && h.textContent.includes("İlk Teslim") && h.textContent.includes("Kapandı") && h.textContent.includes("Revizyon 1 başladı");`), 3000).catch(() => false));
  await closeDrawer();

  /* ── 8–9. Admin: marka şablonu özelleştirme; mevcut görevler etkilenmez ── */
  await switchRole("admin");
  await page(`$$("aside button").find((b) => b.textContent.includes("Marka Kılavuzu")).click();`);
  await waitFor(() => page(`return !!$$("button").find((b) => b.textContent.includes("Tepe Emlak") && b.textContent.includes("Kılavuzu Aç"));`));
  await page(`$$("button").find((b) => b.textContent.includes("Tepe Emlak") && b.textContent.includes("Kılavuzu Aç")).click();`);
  await waitFor(() => page(`return $$("[data-checklist-templates='b-tepe'] [data-checklist-template]").length === 2;`), 5000);
  const tpls = await page(`return $$("[data-checklist-template]").map((t) => t.textContent);`);
  check("Marka şablonları listelenir (marka şablonu + varsayılan)", tpls[0].includes("Tepe Emlak — Sosyal Medya") && tpls[1].includes("Tüm markalar") && tpls[0].includes("Sürüm 1"), tpls.join(" || ").slice(0, 200));
  await page(`$("button[aria-label='Tepe Emlak — Sosyal Medya Kontrol Listesi şablonunu düzenle']").click();`);
  await waitFor(() => page(`return !!$("[data-template-editor]");`), 3000);
  await page(`setValue($("[data-template-editor] input[aria-label='Şablon Adı'], [data-template-editor] input[maxlength='120']"), "");`);
  await page(`exact("button", "Kaydet", $("[data-template-editor]")).click();`);
  check("Şablon doğrulaması (ad zorunlu)", await waitFor(() => page(`return $("[data-template-editor]").textContent.includes("Şablon adı zorunludur.");`), 2000).catch(() => false));
  await page(`setValue($("[data-template-editor] input[maxlength='120']"), "Tepe Emlak — Sosyal Medya Kontrol Listesi");`);
  await page(`setValue($("[data-template-editor] input[aria-label='1. madde metni']"), "Logo sağ alt köşede, %8 genişlikte kullanıldı.");`);
  await page(`$("[data-template-editor] button[aria-label='2. maddeyi yukarı taşı']").click();`);
  await page(`exact("button", "Madde Ekle", $("[data-template-editor]")).click();`);
  const n = await page(`return $$("[data-template-editor] [data-template-item]").length;`);
  await page(`setValue($("[data-template-editor] input[aria-label='${n}. madde metni']"), "Fiyat bilgisi müşteriyle teyit edildi.");`);
  await page(`exact("button", "Kaydet", $("[data-template-editor]")).click();`);
  await waitFor(() => page(`return !$("[data-template-editor]") && $$("[data-checklist-template]")[0].textContent.includes("Sürüm 2");`), 3000).catch(() => {});
  check("Şablon kaydedilir; sürüm 2, madde eklendi / sıralandı", await page(`const t = $$("[data-checklist-template]")[0]; return t.textContent.includes("Sürüm 2") && t.textContent.includes("7 madde");`),
    await page(`return $$("[data-checklist-template]")[0]?.textContent.slice(0, 160);`));

  // Mevcut görev (Lüks villa tanıtımı, Tepe Emlak, Gönderi) eski maddeleri korur
  await page(`$$("aside button").find((b) => b.textContent.includes("İçerik Planlayıcı")).click();`);
  await waitFor(() => page(`return !!$$("button").find((x) => x.textContent.trim() === "Lüks villa tanıtımı");`), 4000);
  await openTaskByTitle("Lüks villa tanıtımı");
  await waitDrawer("Lüks villa tanıtımı");
  const existing = await page(`return { items: $$("[data-check-item]").map((li) => li.querySelector("p").textContent), meta: ${section}.textContent };`);
  check("Şablon güncellemesi mevcut görevin listesini değiştirmez", existing.items[0] === "Logo sağ alt köşede kullanıldı." && existing.items.length === 6 && existing.meta.includes("s1"), existing.items.join(" | "));
  await closeDrawer();

  // Henüz işaretlenmemiş görevin formatı değişince güncel marka şablonu uygulanır
  await openTaskByTitle("Portföy sayfası güncellemesi");
  await waitDrawer("Portföy sayfası güncellemesi");
  check("Web görevi varsayılan şablonu kullanır", (await counts())[1] === 12);
  await page(`$("button[aria-label='Görev Türü seç']", ${drawer}).click();`);
  await waitFor(() => page(`return !!$("[data-cw-popover]");`), 2000);
  await page(`exact("[data-cw-popover] button", "Gönderi").click();`);
  await waitFor(async () => (await counts())?.[1] === 7, 3000).catch(() => {});
  check("Görev Türü Gönderi olunca güncel marka şablonu (sürüm 2) uygulanır", await page(`return $$("[data-check-item] p")[0]?.textContent === "Kurumsal renk paletine uyuldu." && ${section}.textContent.includes("s2");`),
    await page(`return $$("[data-check-item] p").map((p) => p.textContent).slice(0, 2).join(" | ") + " " + $("[id^='cl-title-']").textContent;`));

  /* Admin: eksik kontrolle gönderim yalnızca gerekçeyle */
  await page(`exact("button", "Onaya Gönder", ${drawer}).click();`);
  await waitFor(() => page(`return !!$$("[role='dialog']").find((d) => d.getAttribute("aria-label") === "Eksik kontrollerle gönder");`), 3000);
  await page(`exact("button", "Müşteri Onayına Gönder").click();`);
  check("Admin gerekçesiz gönderemez", await waitFor(() => page(`return $$("[role='dialog']").some((d) => d.textContent.includes("Gerekçe zorunludur."));`), 2000).catch(() => false));
  await page(`setValue($$("[role='dialog']").find((d) => d.getAttribute("aria-label") === "Eksik kontrollerle gönder").querySelector("textarea"), "Müşteri yayını öne çekti.");`);
  await page(`exact("button", "Müşteri Onayına Gönder").click();`);
  await waitFor(() => page(`return ${drawer}.textContent.includes("Müşteri Onayı");`), 3000).catch(() => {});
  await page(`byText("button", "Kontrol Geçmişi").click();`);
  check("Gerekçeli gönderim yapılır ve geçmişe kaydedilir", await waitFor(() => page(`const h = $("[data-checklist-history]"); return h && h.textContent.includes("gerekçeyle atlandı: Müşteri yayını öne çekti.");`), 3000).catch(() => false));
  check("Admin onaydaki görevin kontrollerini değiştirebilir (kilit yalnızca çalışan için)", await page(`return $$("[data-checklist] button[role='checkbox']").some((b) => !b.disabled);`));

  /* Admin: görev bazında kontrol listesini kapatma */
  await closeDrawer();
  await openTaskByTitle("Lüks villa tanıtımı");
  await waitDrawer("Lüks villa tanıtımı");
  await page(`exact("button", "Bu görevde kapat").click();`);
  check("Admin görev bazında kontrol listesini kapatabilir / açabilir", await waitFor(() => page(`return ${section}.textContent.includes("kontrol listesi kapalı");`), 2000).catch(() => false));
  await page(`byText("button", "Kontrol Listesini Aç").click();`);
  await waitFor(() => page(`return !!$("[data-check-item]");`), 3000).catch(() => {});
  check("Liste yeniden açılınca eski kayıtlar korunur", (await counts())?.[1] === 6);
  await closeDrawer();

  /* ── 15. Mobil ve tablet ── */
  for (const [w, hh, mobile] of [[768, 1024, false], [375, 812, true]]) {
    await viewport(w, hh, mobile);
    await openTaskByTitle("Lüks villa tanıtımı");
    await waitDrawer("Lüks villa tanıtımı");
    const g = await page(`const s = ${section}, d = ${drawer}; return {
      overflow: s.scrollWidth - s.clientWidth, docOverflow: document.documentElement.scrollWidth - innerWidth, drawerW: Math.round(d.getBoundingClientRect().width),
      catH: Math.min(...$$("[data-check-group] > button").map((b) => b.getBoundingClientRect().height)),
      boxHit: Math.min(...$$("[data-checklist] button[role='checkbox']").map((b) => b.getBoundingClientRect().width)),
    };`);
    check(`${w}px: kontrol listesi taşmaz${mobile ? ", dokunma alanları yeterli, çekmece tam ekran" : ""}`,
      g.overflow <= 0 && g.docOverflow <= 0 && (!mobile || (g.catH >= 40 && g.boxHit >= 34 && g.drawerW === w)), JSON.stringify(g));
    await closeDrawer();
  }

  /* Konsol */
  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check(`Beklenmeyen hata: ${err.message}`, false);
} finally {
  await h.close();
}
