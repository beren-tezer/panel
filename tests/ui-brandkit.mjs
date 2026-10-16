// Marka Kılavuzu tarayıcı kabul testleri (demo verisi, gerçek arayüz etkileşimleri).
//   npm run test:ui:kit
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5180, debugPort: 9334 });
const { page, viewport, key, check, consoleProblems, send } = h;
const kit = (id = "b-sofra") => `$("[data-brand-kit='${id}']")`;

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`), 45000); // ilk derleme (büyük JSX) yavaş olabilir

  /* ── Erişim noktaları ── */
  const entry = await page(`return {
    nav: !!$$("aside button").find((b) => b.textContent.includes("Marka Kılavuzu")),
    card: !!$("[data-brand-card] footer button[title='Marka kılavuzu']"),
  };`);
  check("Kılavuza menüden ve marka kartından erişilir", entry.nav && entry.card, JSON.stringify(entry));
  await page(`$$("aside button").find((b) => b.textContent.includes("Marka Kılavuzu")).click();`);
  await waitFor(() => page(`return !!byText("button", "Kılavuzu Aç");`));
  await page(`$$("button").find((b) => b.textContent.includes("Sofra Pide") && b.textContent.includes("Kılavuzu Aç")).click();`);
  await waitFor(() => page(`return ${kit()} && $$("[data-kit-color]", ${kit()}).length === 3;`));
  check("Marka seçilince kılavuz yüklenir (renkler, fontlar, kurallar)", await page(`const k = ${kit()}; return k.textContent.includes("Playfair Display") && k.textContent.includes("Logo kullanım standartları");`));

  /* ── Renkler: kopyala, ekle (doğrulama), düzenle, sırala, sil ── */
  await page(`byText("button", "#C8102E", ${kit()}).click();`);
  check("HEX kodu kopyalanır ve “Kopyalandı” görünür", await waitFor(() => page(`return byText("button", "#C8102E", ${kit()}).textContent.includes("Kopyalandı");`), 3000).catch(() => false));
  await page(`exact("button", "Renk Ekle", ${kit()}).click();`);
  await waitFor(() => page(`return !!$("form[aria-label='Yeni renk']");`));
  await page(`const f = $("form[aria-label='Yeni renk']"); setValue($("input[placeholder='örn. Ana Marka Rengi']", f), "Gece Mavisi"); setValue($("input[aria-label='HEX kodu']", f), "#12");`);
  await page(`exact("button", "Rengi Ekle").click();`);
  check("Geçersiz HEX reddedilir", await waitFor(() => page(`return !!byText("form[aria-label='Yeni renk'] span", "Geçerli bir HEX");`), 2000).catch(() => false),
    await page(`const f = $("form[aria-label='Yeni renk']"); return f ? f.textContent.slice(0, 200) : "form yok";`));
  await page(`setValue($("form[aria-label='Yeni renk'] input[aria-label='HEX kodu']"), "1e40af");`);
  await page(`exact("button", "Rengi Ekle").click();`);
  check("Renk eklenir (HEX normalize edilir)", await waitFor(() => page(`return !!$("[data-kit-color='#1E40AF']", ${kit()});`), 3000).catch(() => false));
  await page(`$("button[aria-label='Gece Mavisi rengini düzenle']").click();`);
  await waitFor(() => page(`return !!$("form[aria-label='Rengi düzenle']");`));
  await page(`setValue($("form[aria-label='Rengi düzenle'] input[placeholder='örn. Ana Marka Rengi']"), "Lacivert");`);
  await page(`exact("form[aria-label='Rengi düzenle'] button", "Kaydet").click();`);
  check("Renk düzenlenir", await waitFor(() => page(`return !!$("button[aria-label='Lacivert rengini düzenle']");`), 3000).catch(() => false));
  const order0 = await page(`return $$("[data-kit-color]", ${kit()}).map((e) => e.dataset.kitColor);`);
  await page(`$("button[aria-label='Sofra Pide Kırmızısı rengini aşağı taşı']").click();`);
  const order1 = await waitFor(() => page(`const o = $$("[data-kit-color]", ${kit()}).map((e) => e.dataset.kitColor); return o[0] !== ${JSON.stringify(order0[0])} ? o : null;`), 3000).catch(() => null);
  check("Renkler yeniden sıralanır", order1 && order1[1] === order0[0], `${order0.join(",")} → ${order1}`);
  await page(`$("button[aria-label='Lacivert rengini sil']").click();`);
  await page(`exact("[aria-label='Silme onayı'] button", "Sil").click();`);
  check("Renk silinir (satır içi onayla)", await waitFor(() => page(`return !$("[data-kit-color='#1E40AF']");`), 3000).catch(() => false));

  /* ── Tipografi ── */
  await page(`exact("button", "Font Ekle", ${kit()}).click();`);
  await waitFor(() => page(`return !!$("form[aria-label='Yeni font']");`));
  await page(`const f = $("form[aria-label='Yeni font']"); setValue($("input[placeholder='örn. Montserrat']", f), "Montserrat"); exact("button", "700", f).click(); exact("button", "400", f).click();`);
  await page(`exact("button", "Fontu Ekle").click();`);
  check("Font eklenir (rol ve kalınlıklarla)", await waitFor(() => page(`const k = ${kit()}; return k.textContent.includes("Montserrat — Başlık Fontu") && k.textContent.includes("Kalınlık: 700");`), 3000).catch(() => false),
    await page(`const f = $("form[aria-label='Yeni font']"); return f ? "form açık: " + f.textContent.slice(0, 160) : $$("article", ${kit()}).map((a) => a.textContent.slice(0, 60)).join(" | ");`));
  check("Font yoksa yedek yazı tipi bilgisi gösterilir", await page(`return ${kit()}.textContent.includes("yedek yazı tipiyle gösterilir");`));

  /* ── Talimatlar (zengin metin, önemli, görünürlük) ── */
  await page(`const sec = $$("h4", ${kit()}).find((x) => x.textContent === "İçerik & Metin Kuralları").parentElement; exact("button", "Ekle", sec).click();`);
  await waitFor(() => page(`return !!$("form[aria-label='Yeni talimat']");`));
  await page(`
    const f = $("form[aria-label='Yeni talimat']");
    setValue($("input[placeholder='örn. Logo kullanım standartları']", f), "Hashtag kuralı");
    const ed = $("[aria-label='Talimat içeriği']", f); ed.focus(); ed.innerHTML = "<ul><li>Her gönderide #sofrapide kullanılır.</li></ul>"; ed.dispatchEvent(new InputEvent("input", { bubbles: true }));
    $("input[type='checkbox']", f).click();
    setValue($$("select", f)[1], "shared");`);
  await page(`exact("button", "Talimatı Ekle").click();`);
  const instr = await waitFor(() => page(`const a = $$("[data-kit-instruction]").find((x) => x.textContent.includes("Hashtag kuralı")); return a ? { important: a.textContent.includes("Önemli"), body: a.textContent.includes("#sofrapide"), meta: a.textContent.includes("Güncelleme:") } : null;`), 3000).catch(() => null);
  check("Talimat zengin metinle kaydedilir, önemli işaretlenir, güncelleyen görünür", instr && instr.important && instr.body && instr.meta, JSON.stringify(instr));
  check("Kılavuz son güncelleme bilgisi gösterilir", await page(`return byText("p", "Son güncelleme:", ${kit()}).textContent.includes("Ahmet");`));

  /* ── Kaydedilmemiş değişiklik uyarısı ve taslağın korunması ── */
  await page(`exact("button", "Bağlantı Ekle", ${kit()}).click();`);
  await waitFor(() => page(`return !!$("form[aria-label='Yeni Drive bağlantısı']");`));
  await page(`setValue($("form[aria-label='Yeni Drive bağlantısı'] input[placeholder='örn. Kurumsal Drive']"), "Taslak bağlantı");`);
  await page(`exact("form[aria-label='Yeni Drive bağlantısı'] button", "Vazgeç").click();`);
  const warn = await waitFor(() => page(`return !!byText("form[aria-label='Yeni Drive bağlantısı'] [role='alert']", "Kaydedilmemiş değişiklikler silinecek");`), 2000).catch(() => false);
  await page(`exact("button", "Düzenlemeye Dön").click();`);
  check("Vazgeçerken kaydedilmemiş değişiklik uyarısı çıkar", warn);
  await page(`$$("aside button").find((b) => b.textContent.includes("Genel Bakış")).click();`);
  await sleep(200);
  await page(`$$("aside button").find((b) => b.textContent.includes("Marka Kılavuzu")).click();`);
  check("Sayfa değişince taslak korunur", await waitFor(() => page(`const i = $("form[aria-label='Yeni Drive bağlantısı'] input[placeholder='örn. Kurumsal Drive']"); return i && i.value === "Taslak bağlantı";`), 3000).catch(() => false));

  /* ── Drive bağlantısı ── */
  await page(`setValue($("form[aria-label='Yeni Drive bağlantısı'] input[inputmode='url']"), "https://example.com/dosya");`);
  await page(`exact("button", "Bağlantıyı Ekle").click();`);
  check("Drive dışı bağlantı reddedilir", await waitFor(() => page(`return !!byText("form[aria-label='Yeni Drive bağlantısı'] span", "Yalnızca Google Drive");`), 2000).catch(() => false));
  await page(`setValue($("form[aria-label='Yeni Drive bağlantısı'] input[inputmode='url']"), "https://drive.google.com/drive/folders/1TestKlasor");`);
  await page(`exact("button", "Bağlantıyı Ekle").click();`);
  const link = await waitFor(() => page(`const a = $$("a", ${kit()}).find((x) => x.href.includes("1TestKlasor")); return a ? { target: a.target, rel: a.rel } : null;`), 3000).catch(() => null);
  check("Drive bağlantısı eklenir, yeni sekmede güvenli açılır", link && link.target === "_blank" && link.rel.includes("noopener") && link.rel.includes("noreferrer"), JSON.stringify(link));

  /* ── Dosya yükleme ── */
  await page(`exact("button", "Dosya Yükle", ${kit()}).click();`);
  await waitFor(() => page(`return !!$("[data-kit-file-input]");`));
  await page(`
    const input = $("[data-kit-file-input]"), dt = new DataTransfer();
    dt.items.add(new File(["<html></html>"], "zararli.html", { type: "text/html" }));
    input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));`);
  check("Güvensiz dosya türü reddedilir", await waitFor(() => page(`return !!byText("[role='alert']", "yüklenemez");`), 2000).catch(() => false));
  await page(`
    const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d"); g.fillStyle = "#C8102E"; g.fillRect(0, 0, 64, 64);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const input = $("[data-kit-file-input]"), dt = new DataTransfer();
    dt.items.add(new File([blob], "Sofra Pide Logo.png", { type: "image/png" }));
    input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));`);
  await page(`exact("button", "Yükle").click();`);
  const sawProgress = await waitFor(() => page(`return !!$("[role='progressbar'][aria-label='Yükleme ilerlemesi']") || !!$("[data-kit-asset='Sofra Pide Logo.png']");`), 3000).catch(() => false);
  const up = await waitFor(() => page(`const r = $("[data-kit-asset='Sofra Pide Logo.png']"); return r && r.querySelector("img") ? { cat: r.textContent.includes("Marka Logoları"), who: r.textContent.includes("Ahmet"), dl: !!r.querySelector("button[aria-label$=': İndir']") } : null;`), 5000).catch(() => null);
  check("Dosya ilerlemeyle yüklenir; küçük resim, kategori, yükleyen ve indirme görünür", sawProgress && up && up.cat && up.who && up.dl, JSON.stringify(up));

  /* ── Boş durum ve kılavuz oluşturma ── */
  await page(`$$("aside button").find((b) => b.textContent.includes("Atlas Ajans") && !b.textContent.includes("Workspace")).click();`);
  await waitFor(() => page(`return !!${kit("b-atlas")};`));
  check("Kılavuzu olmayan markada boş durum ve oluşturma düğmesi", await waitFor(() => page(`return ${kit("b-atlas")}.textContent.includes("Bu marka için henüz marka kılavuzu oluşturulmamış.") && !!exact("button", "Marka Kılavuzu Oluştur");`), 3000).catch(() => false));
  await page(`exact("button", "Marka Kılavuzu Oluştur").click();`);
  check("Kılavuz oluşturulur; boş bölüm mesajları görünür", await waitFor(() => page(`const t = ${kit("b-atlas")}.textContent; return t.includes("Henüz kurumsal dosya eklenmemiş.") && t.includes("Bu markaya ait Drive bağlantısı bulunmuyor.");`), 3000).catch(() => false));
  check("Markalar arası izolasyon (Sofra Pide verisi görünmez)", await page(`return !${kit("b-atlas")}.textContent.includes("Sofra Pide Kırmızısı");`));

  /* ── Görev içinden hızlı erişim ── */
  await page(`$$("aside button").find((b) => b.textContent.includes("Sofra Pide")).click();`);
  await page(`$$("aside button").find((b) => b.textContent.trim().startsWith("Genel Bakış")).click();`);
  await waitFor(() => page(`return $$("[data-task-row]").length > 0;`));
  const taskTitle = await page(`const r = $("[data-task-row]"); const st = $("button[aria-label^='Durum']", r)?.textContent || ""; r.querySelector("button").click(); return { title: r.querySelector("button").textContent.trim(), status: st };`);
  await waitFor(() => page(`return !!$("aside[aria-label='Görev detayı']");`));
  await page(`setValue($("textarea[aria-label='Görev başlığı']"), "Kaydedilmemiş başlık değişikliği");`);
  await page(`$("button[aria-label='Marka Kılavuzunu Gör']").click();`);
  const quick = await waitFor(() => page(`const d = $("[role='dialog'][aria-label='Sofra Pide kılavuzu']"); return d ? { colors: d.textContent.includes("#C8102E"), fonts: d.textContent.includes("Playfair Display"), important: d.textContent.includes("Önemli Talimatlar"), tone: d.textContent.includes("İletişim dili"), files: d.textContent.includes("Sofra Pide Logo.png"), internalNote: d.textContent.includes("Onay süreci notu") } : null;`), 4000).catch(() => null);
  check("Görevden kılavuz paneli açılır: renk, font, önemli kurallar, iletişim dili, dosyalar", quick && quick.colors && quick.fonts && quick.important && quick.tone && quick.files, JSON.stringify(quick));
  await page(`byText("[role='dialog'][aria-label='Sofra Pide kılavuzu'] button", "#C8102E").click();`);
  check("Panelden renk kodu kopyalanır", await waitFor(() => page(`return byText("[role='dialog'][aria-label='Sofra Pide kılavuzu'] button", "#C8102E").textContent.includes("Kopyalandı");`), 2000).catch(() => false));
  await key("Escape");
  const after = await waitFor(() => page(`if ($("[role='dialog'][aria-label='Sofra Pide kılavuzu']")) return null; const a = $("aside[aria-label='Görev detayı']"); return { drawer: !!a, title: a && $("textarea[aria-label='Görev başlığı']").value, status: a && $("button[aria-label^='Durum']", a)?.textContent };`), 3000).catch(() => null);
  check("Kılavuz kapanınca görev açık kalır, kaydedilmemiş başlık korunur, durum değişmez", after && after.drawer && after.title === "Kaydedilmemiş başlık değişikliği" && after.status === taskTitle.status, JSON.stringify(after));
  // Başlık değişikliğini geri al (kaydetmeden)
  await page(`setValue($("textarea[aria-label='Görev başlığı']"), ${JSON.stringify(taskTitle.title)});`);
  await page(`$("button[aria-label='Detayı kapat']").click();`);

  /* ── Mobil: tam ekran panel ve taşma ── */
  await viewport(390, 844, true);
  await page(`$("[data-task-row] button").click();`);
  await waitFor(() => page(`return !!$("button[aria-label='Marka Kılavuzunu Gör']");`));
  await page(`$("button[aria-label='Marka Kılavuzunu Gör']").click();`);
  const mob = await waitFor(() => page(`const d = $("[role='dialog'][aria-label='Sofra Pide kılavuzu']"); if (!d) return null; const r = rect(d); return { full: Math.round(r.w) === innerWidth, overflow: d.scrollWidth - d.clientWidth };`), 3000).catch(() => null);
  check("Mobilde kılavuz paneli tam ekran, taşma yok", mob && mob.full && mob.overflow <= 0, JSON.stringify(mob));
  await page(`$("button[aria-label='Kılavuzu kapat']").click();`);
  await page(`$("button[aria-label='Detayı kapat']").click();`);
  await page(`$$("aside button").find((b) => b.textContent.includes("Marka Kılavuzu")).click();`);
  await waitFor(() => page(`return !!${kit()};`));
  for (const [w, hh] of [[375, 812], [768, 1024], [1024, 768], [1920, 1080]]) {
    await viewport(w, hh, w < 768);
    const ov = await page(`const k = ${kit()}, kr = k.getBoundingClientRect(); return { doc: document.documentElement.scrollWidth - innerWidth, kit: k.scrollWidth - k.clientWidth,
      wide: $$("*", k).filter((e) => e.getBoundingClientRect().right > kr.right + 0.5).slice(0, 3).map((e) => e.tagName + "." + String(e.className).slice(0, 60)) };`);
    check(`${w}px: kılavuz sayfasında yatay taşma yok`, ov.doc <= 0 && ov.kit <= 0, JSON.stringify(ov));
  }
  await viewport(1440, 900);

  /* ── Çalışan: salt okunur ── */
  await page(`setValue($("select[aria-label='Rol']"), "employee");`);
  await waitFor(() => page(`return !!$$("aside button").find((b) => b.textContent.includes("Marka Kılavuzu"));`), 5000);
  await page(`$$("aside button").find((b) => b.textContent.includes("Marka Kılavuzu")).click();`);
  await waitFor(() => page(`return !!byText("button", "Kılavuzu Aç") || !!${kit()};`), 4000);
  await page(`const b = $$("button").find((x) => x.textContent.includes("Sofra Pide") && x.textContent.includes("Kılavuzu Aç")); if (b) b.click();`);
  const emp = await waitFor(() => page(`const k = ${kit()}; if (!k || !$$("[data-kit-color]", k).length) return null; return { readOnly: k.textContent.includes("Salt okunur"), noAdd: !exact("button", "Renk Ekle", k) && !exact("button", "Dosya Yükle", k), noDelete: !$("button[aria-label$='rengini sil']", k), internal: k.textContent.includes("Onay süreci notu"), copy: !!$("button[aria-label$='renk kodunu kopyala']", k) };`), 4000).catch(() => null);
  check("Çalışan kılavuzu okur, renk kopyalar ama düzenleyemez (izin verilmedikçe)", emp && emp.readOnly && emp.noAdd && emp.noDelete && emp.internal && emp.copy, JSON.stringify(emp));

  /* ── Müşteri: yalnızca kendi markası, ekip içi kayıtlar yok ── */
  await page(`setValue($("select[aria-label='Rol']"), "client");`);
  await waitFor(() => page(`return !!$("select[aria-label='Görüntülenen kullanıcı']");`), 5000);
  await page(`const s = $("select[aria-label='Görüntülenen kullanıcı']"); setValue(s, [...s.options].find((o) => o.textContent.includes("Mert")).value);`);
  await waitFor(() => page(`return !!$$("aside button").find((b) => b.textContent.includes("Marka Kılavuzu"));`), 5000);
  await page(`$$("aside button").find((b) => b.textContent.includes("Marka Kılavuzu")).click();`);
  const cl = await waitFor(() => page(`const k = ${kit()}; if (!k || !$$("[data-kit-color]", k).length) return null; const t = k.textContent;
    return { shared: t.includes("Logo kullanım standartları"), internalNote: t.includes("Onay süreci notu"), internalLink: t.includes("Ham çekimler"), sharedFile: t.includes("Sofra Pide Logo.png"), noEdit: !exact("button", "Renk Ekle", k), otherBrand: !!$("[data-brand-kit='b-tepe']") };`), 5000).catch(() => null);
  check("Müşteri kendi markasının kılavuzunu görür; ekip içi not ve bağlantıları görmez", cl && cl.shared && !cl.internalNote && !cl.internalLink && cl.sharedFile && cl.noEdit && !cl.otherBrand, JSON.stringify(cl));
  await page(`setValue($("select[aria-label='Rol']"), "admin");`);
  await waitFor(() => page(`return $$("aside button").some((b) => b.textContent.includes("Ekip & Marka Yönetimi"));`), 5000);

  /* ── Ekip & Marka Yönetimi kısayolu ── */
  await page(`$$("aside button").find((b) => b.textContent.includes("Ekip & Marka Yönetimi")).click();`);
  await waitFor(() => page(`return !!$("button[aria-label='Marka Kılavuzu']");`), 4000);
  await page(`$("button[aria-label='Marka Kılavuzu']").click();`);
  check("Marka yönetiminden kılavuza geçilir", await waitFor(() => page(`return !!$("[data-brand-kit]");`), 4000).catch(() => false));

  /* ── Mevcut akışlar bozulmadı ── */
  await page(`$$("aside button").find((b) => b.textContent.trim().startsWith("Genel Bakış")).click();`);
  check("Günlük akış ve marka kartları çalışıyor", await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`), 4000).catch(() => false));

  await sleep(300);
  check("Konsolda hata / React uyarısı yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check("Test akışı tamamlandı", false, err.stack || String(err));
} finally {
  await h.close();
}
