// Müşteri Onay Portalı — uçtan uca tarayıcı testi (demo verisi, gerçek arayüz etkileşimleri).
//   npm run test:ui:approvals
// Demo kaynağı bellek içidir: sayfa yenilenince sıfırlanır. Kalıcılık, başka cihazdan görme ve RLS ayrıca
// tests/approvals-supabase.mjs (geliştirme Supabase projesi) ve 007 SQL testleriyle doğrulanır.
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5183, debugPort: 9337 });
const { page, viewport, check, consoleProblems, send } = h;
const base = h.url.replace("/?demo", "");
const TITLE = "Portal Testi — Daire Tanıtımı";
const drawer = `$("aside[aria-label='Görev detayı']")`;
const toasts = () => page(`return $$("[role='status'],[role='alert']").map((x) => x.textContent).join(" | ");`);
const nav = (label) => page(`const b = $$("aside button").find((x) => x.textContent.includes(${JSON.stringify(label)})); b.click(); return !!b;`);
const role = async (r, userId) => {
  await page(`setValue($("select[aria-label='Rol']"), ${JSON.stringify(r)});`);
  await sleep(250);
  if (userId) { await page(`setValue($("select[aria-label='Görüntülenen kullanıcı']"), ${JSON.stringify(userId)});`); await sleep(300); }
};
const field = (label) => `$$("[role='dialog'] label").find((l) => l.firstElementChild && l.firstElementChild.textContent.trim() === ${JSON.stringify(label)}).querySelector("input, select, textarea")`;
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const uploadPng = (name) => page(`const bin = atob(${JSON.stringify(PNG)}); const bytes = new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
  const dt = new DataTransfer(); dt.items.add(new File([bytes], ${JSON.stringify(name)}, { type: "image/png" }));
  const input = $("[data-content-file-input]"); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
const openTaskInPlanner = async () => {
  await nav(await page(`return $$("aside button").some((b) => b.textContent.includes("İçerik Planlayıcı")) ? "İçerik Planlayıcı" : "Görevlerim";`));
  await waitFor(() => page(`return !!$$("table button").find((x) => x.textContent.trim() === ${JSON.stringify(TITLE)});`), 5000);
  await page(`$$("table button").find((x) => x.textContent.trim() === ${JSON.stringify(TITLE)}).click();`);
  await waitFor(() => page(`return !!${drawer} && !!$("[data-content-versions]");`), 4000);
};
const closeDrawer = () => page(`$("button[aria-label='Detayı kapat']")?.click(); return true;`);
const completeChecklist = async () => {
  for (let i = 0; i < 20; i++) {
    const left = await page(`const b = $$("[data-checklist] button[role='checkbox'][aria-checked='false']").find((x) => !x.disabled); if (b) b.click(); return !!b;`);
    if (!left) break;
    await sleep(40);
  }
};
const setStatus = async (status) => {
  await page(`const row = $$("div", ${drawer}).find((d) => d.children[0] && d.children[0].textContent.trim() === "Durum"); row.querySelector("button[aria-haspopup='listbox']").click();`);
  await waitFor(() => page(`return !!$("[data-cw-popover]");`), 2000);
  await page(`$$("[data-cw-popover] [role='option']").find((o) => o.textContent.trim() === ${JSON.stringify(status)}).click();`);
  await sleep(300);
};
const versionStatusText = (no) => page(`const a = $("[data-version='${no}']"); return a ? a.querySelector("[data-version-status]").dataset.versionStatus : null;`);
const approvalsTab = async (label) => {
  await nav("Onay Süreçleri");
  await waitFor(() => page(`return !!$$("[role='tab'], button").find((b) => b.textContent.startsWith(${JSON.stringify(label)}));`), 3000);
  await page(`$$("[role='tab'], button").find((b) => b.textContent.startsWith(${JSON.stringify(label)})).click();`);
  await sleep(200);
};

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`));

  /* 1. Admin marka oluşturur; marka bağlantısı */
  await page(`$("button[aria-label='Yeni marka ekle']").click();`);
  await waitFor(() => page(`return !!$("[role='dialog'][aria-label='Yeni Marka']");`), 2000);
  await page(`setValue(${field("Marka Adı")}, "Lumina Kozmetik"); setValue(${field("Sektör")}, "Kozmetik"); exact("button", "Markayı Oluştur").click(); return true;`);
  await sleep(300);
  await nav("Ekip & Marka Yönetimi");
  await waitFor(() => page(`return !!$$("button[aria-label='Düzenle']").length;`), 3000);
  await page(`const row = $$("tr, li, div").filter((r) => r.textContent.includes("Lumina Kozmetik") && r.querySelector("button[aria-label='Düzenle']")).at(-1); row.querySelector("button[aria-label='Düzenle']").click();`);
  await waitFor(() => page(`return !!$("[data-portal-link]");`), 3000);
  const link = await page(`const s = $("[data-portal-link]"); return { slug: s.dataset.portalLink, url: s.querySelector(".font-mono").textContent, none: s.textContent.includes("müşteri hesabı yok"), revokeDisabled: exact("button", "Erişimi İptal Et", s)?.disabled };`);
  check("Yeni markaya müşteri onay bağlantısı (/onay/<adres>) oluşur; müşterisi yoksa erişim iptali pasif",
    link.slug === "lumina-kozmetik" && link.url.endsWith("/onay/lumina-kozmetik") && link.none && link.revokeDisabled, JSON.stringify(link));
  await page(`exact("button", "Bağlantıyı Kopyala").click();`);
  check("Bağlantıyı Kopyala", (await toasts()).includes("panoya kopyalandı") || (await toasts()).includes("kopyalanamadı"), await toasts());
  await page(`exact("button", "Bağlantıyı Yenile").click(); await tick(); exact("[data-portal-link] [role='alert'] button", "Bağlantıyı Yenile").click(); return true;`);
  await sleep(200);
  const rotated = await page(`return $("[data-portal-link]").dataset.portalLink;`);
  check("Bağlantıyı Yenile: yeni adres, eskisi geçersiz", /^lumina-kozmetik-[a-z0-9]{7}$/.test(rotated) && (await toasts()).includes("Eski bağlantı artık çalışmaz"), rotated);
  await page(`$("[role='dialog'][aria-label='Markayı Düzenle'] button[aria-label='Kapat']").click();`);

  /* 2. Admin görev oluşturur (Tepe Emlak, sorumlu Ayşe) */
  await nav("Günlük Operasyon Akışı");
  await page(`$$("button").find((b) => b.textContent.trim() === "Yeni Görev" || b.getAttribute("aria-label") === "Yeni Görev").click();`);
  await waitFor(() => page(`return !!$("[role='dialog'][aria-label='Yeni Görev']");`), 2000);
  await page(`setValue(${field("Görev Başlığı")}, ${JSON.stringify(TITLE)});
    setValue(${field("Marka")}, "b-tepe"); setValue(${field("Sorumlu")}, "u2"); setValue(${field("Format")}, "Gönderi"); return true;`);
  await page(`exact("button", "Görevi Oluştur").click();`);
  await sleep(300);
  check("Admin görevi oluşturur", (await toasts()).includes("Görev oluşturuldu"), await toasts());

  /* 3–4. Çalışan: sürüm oluşturur, dosya yükler, metni yazar, yönetici onayına gönderir */
  await role("employee", "u2");
  await openTaskInPlanner();
  await page(`exact("[data-content-versions] button", "Sürüm Oluştur").click();`);
  await waitFor(() => page(`return !!$("[data-version='1']");`), 3000);
  check("Çalışan Sürüm 1'i (taslak) oluşturur", (await versionStatusText(1)) === "draft");
  await uploadPng("kapak-v1.png");
  await waitFor(() => page(`return $$("[data-version='1'] [data-content-asset]").length === 1;`), 4000).catch(() => {});
  check("Dosya yüklenir ve sürüme eklenir", await page(`return $$("[data-version='1'] [data-content-asset]").length === 1 && $("[data-version='1']").textContent.includes("kapak-v1.png");`));
  await page(`const dt = new DataTransfer(); dt.items.add(new File(["<svg/>"], "zararli.svg", { type: "image/svg+xml" })); const i = $("[data-content-file-input]"); i.files = dt.files; i.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
  await sleep(150);
  check("İzin verilmeyen dosya türü reddedilir ve kullanıcıya gösterilir", await page(`return $("[data-content-versions]").textContent.includes("yüklenemez");`));
  await page(`const t = $("textarea[aria-label='Sürüm 1 paylaşım metni']"); setValue(t, "Deniz manzaralı 3+1 daire — hemen arayın!"); t.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); t.blur(); return true;`);
  await sleep(200);
  await completeChecklist();
  await setStatus("Yönetici Onayı");
  check("Çalışan iç onaya gönderir; sürüm iç onayda kilitlenmez", (await page(`return ${drawer}.textContent.includes("Yönetici Onayı");`)) && (await versionStatusText(1)) === "draft");
  await closeDrawer();

  /* 5. Admin müşteriye gönderir */
  await role("admin");
  await approvalsTab("Yönetici Onayı");
  await page(`const row = $$("main div").filter((d) => d.textContent.includes(${JSON.stringify(TITLE)}) && byText("button", "Müşteriye Gönder", d)).at(-1); byText("button", "Müşteriye Gönder", row).click();`);
  await sleep(400);
  await approvalsTab("Müşteri Onayı");
  const sent1 = await page(`const row = $$("main div").filter((d) => d.textContent.includes(${JSON.stringify(TITLE)}) && d.querySelector("[data-approval-version]")).at(-1); return row ? row.querySelector("[data-approval-version]").textContent : null;`);
  check("Admin müşteriye gönderir; Onay Süreçleri sürümü gösterir", sent1 === "Sürüm 1 · 1 dosya", sent1);

  /* 6–8. Müşteri: bağlantılı sayfada sürümü inceler, revize ister */
  await role("client", "c1");
  await nav("Onay Bekleyen İçerikler");
  await waitFor(() => page(`return !!$$("button").find((b) => b.textContent.includes(${JSON.stringify(TITLE)}));`), 3000);
  await page(`$$("button").find((b) => b.textContent.includes(${JSON.stringify(TITLE)})).click();`);
  await waitFor(() => page(`return !!$("[data-review-media]");`), 3000);
  const review1 = await page(`const d = $("[role='dialog']"); return { sub: d.querySelector("p").textContent, caption: $("[data-review-caption]")?.textContent, media: $$("[data-review-media] img, [data-review-media] [data-media-fallback]").length };`);
  check("Müşteri gönderilen sürümü (Sürüm 1, dosya ve metin) inceler", review1.sub.includes("Sürüm 1") && review1.caption === "Deniz manzaralı 3+1 daire — hemen arayın!" && review1.media >= 1, JSON.stringify(review1));
  await page(`exact("button", "Revize Talebi Yaz").click();`);
  await waitFor(() => page(`return !!$("#cw-revision textarea");`), 2000);
  await page(`setValue($("#cw-revision textarea"), "abc"); byText("button", "Revize Talebini Gönder").click(); return true;`);
  await sleep(150);
  check("Revize açıklaması zorunlu (doğrulama)", await page(`return $("#cw-revision").textContent.includes("açıklayın");`));
  await page(`setValue($("#cw-revision textarea"), "Fiyat bilgisi eksik, logo sağ alta alınsın."); byText("button", "Revize Talebini Gönder").click(); return true;`);
  await sleep(300);
  check("Revize talebi kaydedilir", (await toasts()).includes("Revize talebiniz ajansa iletildi"));
  await nav("Onay Geçmişi");
  const hist1 = await page(`return $("[data-client-history]")?.textContent || "";`);
  check("Müşteri onay geçmişinde Sürüm 1 · Revizyon İstendi", hist1.includes(TITLE) && hist1.includes("Sürüm 1") && hist1.includes("Revizyon İstendi"), hist1.slice(0, 160));

  /* 9. Çalışan: revizyonu görür, Sürüm 2'yi hazırlar ve gönderir */
  await role("employee", "u2");
  await openTaskInPlanner();
  const emp1 = await page(`const v = $("[data-version='1']"); return { st: v.querySelector("[data-version-status]").dataset.versionStatus, note: v.textContent.includes("Fiyat bilgisi eksik"), locked: !byText("[data-version='1'] button", "Dosya Ekle") && !$("[data-version='1'] textarea") };`);
  check("Çalışan revize talebini sürüm üzerinde görür; Sürüm 1 kilitli", emp1.st === "revision_requested" && emp1.note && emp1.locked, JSON.stringify(emp1));
  await page(`exact("[data-content-versions] button", "Sürüm 2 Oluştur").click();`);
  await waitFor(() => page(`return !!$("[data-version='2']");`), 3000);
  check("Sürüm 2 açılır, metin önceki sürümden gelir", await page(`return $("textarea[aria-label='Sürüm 2 paylaşım metni']").value.startsWith("Deniz manzaralı");`));
  await uploadPng("kapak-v2.png");
  await waitFor(() => page(`return $$("[data-version='2'] [data-content-asset]").length === 1;`), 4000).catch(() => {});
  await page(`const t = $("textarea[aria-label='Sürüm 2 paylaşım metni']"); setValue(t, "Deniz manzaralı 3+1 daire — 4.250.000 TL. Hemen arayın!"); t.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); return true;`);
  await sleep(200);
  await completeChecklist();
  await setStatus("Yönetici Onayı");
  await closeDrawer();

  /* 10. Admin Sürüm 2'yi gönderir */
  await role("admin");
  await approvalsTab("Yönetici Onayı");
  await page(`const row = $$("main div").filter((d) => d.textContent.includes(${JSON.stringify(TITLE)}) && byText("button", "Müşteriye Gönder", d)).at(-1); byText("button", "Müşteriye Gönder", row).click();`);
  await sleep(400);
  await approvalsTab("Müşteri Onayı");
  check("Admin Sürüm 2'yi müşteriye gönderir", (await page(`return $$("[data-approval-version]").map((x) => x.textContent);`)).includes("Sürüm 2 · 1 dosya"));

  /* 11. Müşteri Sürüm 2'yi onaylar */
  await role("client", "c1");
  await nav("Onay Bekleyen İçerikler");
  await waitFor(() => page(`return !!$$("button").find((b) => b.textContent.includes(${JSON.stringify(TITLE)}));`), 3000);
  await page(`$$("button").find((b) => b.textContent.includes(${JSON.stringify(TITLE)})).click();`);
  await waitFor(() => page(`return !!$("[data-review-media]");`), 3000);
  const review2 = await page(`return { sub: $("[role='dialog'] p").textContent, caption: $("[data-review-caption]").textContent, hist: $("[data-review-history]").textContent };`);
  check("Müşteri güncel sürümü (Sürüm 2) inceler; geçmişte Sürüm 1 görünür", review2.sub.includes("Sürüm 2") && review2.caption.includes("4.250.000") && review2.hist.includes("Sürüm 1 · Revizyon İstendi"), JSON.stringify(review2).slice(0, 220));
  await page(`exact("button", "Onayla").click();`);
  await sleep(300);
  check("Müşteri onaylar", (await toasts()).includes("İçerik onaylandı"));
  await nav("Onay Geçmişi");
  const hist2 = await page(`return $$("[data-client-history] li").filter((li) => li.textContent.includes(${JSON.stringify(TITLE)})).map((li) => li.textContent);`);
  check("Onay geçmişi korunur: Sürüm 2 Onaylandı + Sürüm 1 Revizyon İstendi", hist2.length === 2 && hist2[0].includes("Sürüm 2") && hist2[0].includes("Onaylandı") && hist2[1].includes("Sürüm 1"), hist2.join(" || ").slice(0, 200));

  /* 12–13. Admin ve çalışan aynı sonucu görür */
  await role("admin");
  await approvalsTab("Onaylandı");
  check("Admin Onay Süreçleri'nde içerik Onaylandı aşamasında", await page(`return $("main").textContent.includes(${JSON.stringify(TITLE)});`));
  await openTaskInPlanner();
  const adminView = [await versionStatusText(2), await versionStatusText(1)];
  check("Admin görev detayında: Sürüm 2 Onaylandı, Sürüm 1 Revizyon İstendi", adminView.join() === "approved,revision_requested", adminView.join());
  await closeDrawer();
  await role("employee", "u2");
  await openTaskInPlanner();
  const empView = [await versionStatusText(2), await versionStatusText(1), await page(`return ${drawer}.textContent.includes("Onaylandı");`)];
  check("Çalışan aynı sonucu görür", empView.join() === "approved,revision_requested,true", empView.join());
  check("Onaylanan sürüm değiştirilemez (dosya ekle / metin yok)", await page(`return !$("[data-version='2'] textarea") && !byText("[data-version='2'] button", "Dosya Ekle");`));
  await closeDrawer();

  /* 17. Yetkisiz müşteri erişemez */
  await role("client", "c2");
  await nav("İçeriklerim");
  await sleep(200);
  const c2 = await page(`return { list: document.body.textContent.includes(${JSON.stringify(TITLE)}) };`);
  await nav("Onay Geçmişi");
  check("Başka markanın müşterisi içeriği, sürümü ve geçmişi göremez", !c2.list && !(await page(`return document.body.textContent.includes(${JSON.stringify(TITLE)});`)));

  /* Mobil: müşteri onay ekranı */
  await role("client", "c1");
  await viewport(375, 812, true);
  await nav("İçeriklerim");
  await waitFor(() => page(`return !!$$("button").find((b) => b.textContent.includes(${JSON.stringify(TITLE)}));`), 3000);
  await page(`$$("button").find((b) => b.textContent.includes(${JSON.stringify(TITLE)})).click();`);
  await waitFor(() => page(`return !!$("[data-review-media]");`), 3000);
  const mob = await page(`const d = $("[role='dialog']"); return { doc: document.documentElement.scrollWidth - innerWidth, dlg: Math.round(d.getBoundingClientRect().width), over: d.scrollWidth - d.clientWidth };`);
  check("375px: müşteri onay ekranı taşmaz, tam genişlik", mob.doc <= 0 && mob.over <= 0 && mob.dlg <= 375, JSON.stringify(mob));
  await page(`$("[role='dialog'] button[aria-label='Kapat']").click();`);
  await viewport(1440, 900);

  /* Erişimi iptal et: Tepe Emlak müşterileri kaldırılır → müşteri içeriği göremez */
  await role("admin");
  await nav("Ekip & Marka Yönetimi");
  await waitFor(() => page(`return !!$$("button[aria-label='Düzenle']").length;`), 3000);
  await page(`const row = $$("tr, li, div").filter((r) => r.textContent.includes("Tepe Emlak") && r.querySelector("button[aria-label='Düzenle']")).at(-1); row.querySelector("button[aria-label='Düzenle']").click();`);
  await waitFor(() => page(`return !!$("[data-portal-link]");`), 3000);
  await page(`exact("[data-portal-link] button", "Erişimi İptal Et").click(); await tick(); exact("[data-portal-link] [role='alert'] button", "Erişimi İptal Et").click(); return true;`);
  await sleep(250);
  check("Erişimi İptal Et: markanın müşteri hesapları kaldırılır", (await toasts()).includes("Müşteri erişimi iptal edildi") && await page(`return $("[data-portal-link]").textContent.includes("müşteri hesabı yok");`));
  await page(`$("[role='dialog'][aria-label='Markayı Düzenle'] button[aria-label='Kapat']").click();`);
  await role("client", "c1");
  await nav("İçeriklerim");
  await sleep(200);
  check("Erişimi kaldırılan müşteri içeriği göremez", !(await page(`return document.body.textContent.includes(${JSON.stringify(TITLE)});`)));

  /* /onay yönlendirmesi (sayfa yeniden yüklenir; demo verisi sıfırlanır) */
  await send("Page.navigate", { url: `${base}/onay/tepe-emlak?demo` });
  await waitFor(() => page(`return !!$("main") && document.body.textContent.includes("Onay Süreçleri");`), 8000).catch(() => {});
  // Müşteri Onayı aşamasında demo verisinde Tepe Emlak (Kira artış oranı) ve başka markalar (Makarna çeşitleri) var: yalnızca Trend görünmeli.
  const r1 = await page(`const m = $("main").textContent; return { approvals: m.includes("İçeriklerin iç onaydan"), brand: m.includes("Kira artış oranı") && !m.includes("Makarna çeşitleri"), denied: !!$("[data-portal-denied]") };`);
  check("/onay/<adres>: ekip için ilgili markanın Onay Süreçleri sayfası açılır", r1.approvals && r1.brand && !r1.denied, JSON.stringify(r1));
  await send("Page.navigate", { url: `${base}/onay/olmayan-marka?demo` });
  await waitFor(() => page(`return !!$("main");`), 8000);
  await sleep(300);
  check("Geçersiz / yenilenmiş adres: bilgi sızdırmayan erişim yok mesajı", await page(`return !!$("[data-portal-denied]") && $("[data-portal-denied]").textContent.includes("erişiminiz yok");`));
  await send("Page.navigate", { url: `${base}/onay?demo` });
  await waitFor(() => page(`return !!$("main") && document.body.textContent.includes("İçeriklerin iç onaydan");`), 8000).catch(() => {});
  check("/onay: tüm markaların onay ekranı", await page(`return document.body.textContent.includes("İçeriklerin iç onaydan") && !$("[data-portal-denied]");`));

  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check(`Beklenmeyen hata: ${err.message}`, false);
} finally {
  await h.close();
}
