// Dosya yükleme — görev ekleri ve marka dosyaları (demo verisi, gerçek arayüz etkileşimleri; DevTools protokolü).
//   npm run test:ui:files
// Storage erişim kuralları 014_file_uploads.sql PGlite testiyle doğrulanır; burada arayüz akışı (seçme, sürükle-bırak,
// ilerleme, iptal, hata + tekrar deneme, önizleme, kaldırma, yetkiye göre düğmeler) sınanır.
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5194, debugPort: 9354 });
const { page, viewport, check, consoleProblems, send } = h;
const drawer = `$("aside[aria-label='Görev detayı']")`;
const toasts = () => page(`return $$("[role='status'],[role='alert']").map((x) => x.textContent).join(" | ");`);
const nav = (label) => page(`const b = $$("aside button").find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)})); b.click(); return !!b;`);
const role = async (r, userId) => {
  await page(`setValue($("select[aria-label='Rol']"), ${JSON.stringify(r)});`);
  await sleep(250);
  if (userId) { await page(`setValue($("select[aria-label='Görüntülenen kullanıcı']"), ${JSON.stringify(userId)});`); await sleep(300); }
};
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
// Sayfa içinde dosya üretir: kind = png | pdf | svg | exe | big
const makeFile = (name, kind) => `(() => {
  if (${JSON.stringify(kind)} === "png") { const bin = atob(${JSON.stringify(PNG)}); return new File([new Uint8Array([...bin].map((c) => c.charCodeAt(0)))], ${JSON.stringify(name)}, { type: "image/png" }); }
  if (${JSON.stringify(kind)} === "pdf") return new File(["%PDF-1.4 test"], ${JSON.stringify(name)}, { type: "application/pdf" });
  if (${JSON.stringify(kind)} === "svg") return new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], ${JSON.stringify(name)}, { type: "image/svg+xml" });
  if (${JSON.stringify(kind)} === "big") return new File([new Uint8Array(51 * 1024 * 1024)], ${JSON.stringify(name)}, { type: "video/mp4" });
  return new File(["MZ"], ${JSON.stringify(name)}, { type: "application/x-msdownload" });
})()`;
const pick = (input, files) => page(`const dt = new DataTransfer(); ${files.map(([n, k]) => `dt.items.add(${makeFile(n, k)});`).join(" ")}
  const el = $("[data-upload-input='${input}']"); el.files = dt.files; el.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
const dropOn = (sel, files) => page(`const dt = new DataTransfer(); ${files.map(([n, k]) => `dt.items.add(${makeFile(n, k)});`).join(" ")}
  const el = $(${JSON.stringify(sel)}); el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
  el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt })); return true;`);
const attNames = () => page(`return $$("[data-attachments] p.font-medium").map((p) => p.textContent);`);
const queue = () => page(`return $$("[data-upload-item]").map((x) => x.dataset.uploadItem + ":" + x.textContent.slice(0, 120));`);

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return !!$("[data-ops-desk]");`), 45000);

  /* 1. Görev detayı → Ekler → Dosya Yükle */
  await nav("İçerik Planlayıcı");
  await waitFor(() => page(`return !!$("table tbody tr");`), 5000);
  await page(`$("table tbody tr").children[1].querySelector("button").click(); return true;`);
  await waitFor(() => page(`return !!$("[data-attachments]", ${drawer});`), 4000);
  const before = (await attNames()).length;
  check("Ekler bölümünde “Dosya Yükle” düğmesi ve sınır bilgisi var", await page(`const s = $("[data-attachments]"); return !!exact("button", "Dosya Yükle", s) && s.textContent.includes("en fazla 50 MB") && $("[data-upload-input='attachments']").accept.includes(".pdf");`));
  await pick("attachments", [["Kampanya Görseli.png", "png"], ["Brief.pdf", "pdf"]]);
  const prog = await waitFor(() => page(`const b = $$("[data-upload-item='progress'] [role='progressbar']"); return b.length ? b.map((x) => +x.getAttribute("aria-valuenow")) : null;`), 2000).catch(() => null);
  check("Yükleme sırasında her dosya için ilerleme çubuğu görünür", Array.isArray(prog) && prog.length === 2, JSON.stringify(prog));
  await waitFor(async () => (await attNames()).length === before + 2, 5000).catch(() => {});
  const names = await attNames();
  check("İki dosya göreve eklenir; kuyruk boşalır", names.includes("Kampanya Görseli.png") && names.includes("Brief.pdf") && (await queue()).length === 0, names.join(", "));
  check("Başarı bildirimi gösterilir", (await toasts()).includes("yüklendi"), await toasts());
  const thumb = await waitFor(() => page(`const row = $$("[data-attachments] .group").find((r) => r.textContent.includes("Kampanya Görseli.png")); const img = row && row.querySelector("img"); return img && img.src.startsWith("blob:") ? img.src : null;`), 3000).catch(() => null);
  check("Yüklenen görselin küçük resmi gösterilir", !!thumb, String(thumb));

  /* Önizleme */
  await page(`$$("[data-attachments] button[aria-label$='önizle']").find((b) => b.getAttribute("aria-label").startsWith("Kampanya Görseli.png")).click(); return true;`);
  await waitFor(() => page(`return !!$("[data-uploaded-preview]");`), 3000);
  const pv = await page(`const m = $("[data-uploaded-preview]"); return { mime: m.dataset.uploadedPreview, img: !!m.querySelector("img[src^='blob:']"), open: !!exact("a", "Yeni Sekmede Aç"), dl: !!exact("a", "İndir") };`);
  check("Önizleme: görsel, Yeni Sekmede Aç ve İndir", pv.mime === "image/png" && pv.img && pv.open && pv.dl, JSON.stringify(pv));
  await page(`$$("[data-cw-modal] button[aria-label='Kapat']").at(-1)?.click(); return true;`); await sleep(250);
  await page(`$$("[data-attachments] button[aria-label$='önizle']").find((b) => b.getAttribute("aria-label").startsWith("Brief.pdf")).click(); return true;`);
  check("PDF önizlemesi tarayıcıda açılır", await waitFor(() => page(`return !!$("[data-uploaded-preview='application/pdf'] iframe");`), 3000).then(() => true, () => false));
  await page(`$$("[data-cw-modal] button[aria-label='Kapat']").at(-1)?.click(); return true;`); await sleep(250);

  /* Hatalar: tür, boyut, ağ hatası + tekrar dene, iptal */
  await pick("attachments", [["kurulum.exe", "exe"]]);
  const typeErr = await waitFor(() => page(`const e = $("[data-upload-item='error']"); return e ? e.textContent : null;`), 2000).catch(() => null);
  check("İzin verilmeyen tür anlaşılır hatayla reddedilir", !!typeErr && typeErr.includes("yüklenemez"), typeErr);
  await page(`$("[data-upload-item='error'] button[aria-label$='uyarısını kapat']").click(); return true;`); await sleep(100);
  await pick("attachments", [["dev-kurgu.mp4", "big"]]);
  const sizeErr = await waitFor(() => page(`const e = $("[data-upload-item='error']"); return e ? e.textContent : null;`), 3000).catch(() => null);
  check("50 MB üstü dosya reddedilir (boyut iletisiyle)", !!sizeErr && sizeErr.includes("çok büyük"), sizeErr);
  await page(`$("[data-upload-item='error'] button[aria-label$='uyarısını kapat']").click(); return true;`); await sleep(100);
  await page(`window.__cwSimulateUploadError = true; return true;`);
  await pick("attachments", [["Ağ Testi.pdf", "pdf"]]);
  const netErr = await waitFor(() => page(`const e = $("[data-upload-item='error']"); return e ? e.textContent : null;`), 3000).catch(() => null);
  check("Ağ hatasında dosya kaybolmaz: hata + “Tekrar Dene”", !!netErr && netErr.includes("Bağlantı hatası") && netErr.includes("Tekrar Dene"), netErr);
  await page(`exact("[data-upload-item='error'] button", "Tekrar Dene").click(); return true;`);
  await waitFor(async () => (await attNames()).includes("Ağ Testi.pdf"), 4000).catch(() => {});
  check("Tekrar Dene ile yükleme tamamlanır", (await attNames()).includes("Ağ Testi.pdf") && (await queue()).length === 0);
  const count1 = (await attNames()).length;
  await pick("attachments", [["İptal Edilecek.pdf", "pdf"]]);
  await waitFor(() => page(`return !!$("[data-upload-item='progress']");`), 1500);
  await page(`$("[data-upload-item='progress'] button[aria-label$='yüklemesini iptal et']").click(); return true;`);
  await sleep(700);
  check("İptal edilen yükleme eklenmez, kuyruktan kalkar", (await attNames()).length === count1 && (await queue()).length === 0);

  /* Sürükle-bırak + ekip içi */
  await page(`const cb = $$("[data-attachments] input[type='checkbox']")[0]; if (!cb.checked) cb.click(); return true;`);
  await dropOn("[data-attachments]", [["Ekip Notu.pdf", "pdf"]]);
  await waitFor(async () => (await attNames()).includes("Ekip Notu.pdf"), 4000).catch(() => {});
  check("Sürükle-bırak ile yüklenir; “Yalnızca ekip görsün” işaretliyse ekip içi olur",
    await page(`const r = $$("[data-attachments] .group").find((x) => x.textContent.includes("Ekip Notu.pdf")); return !!r && r.textContent.includes("Ekip içi");`));
  await page(`const cb = $$("[data-attachments] input[type='checkbox']")[0]; if (cb.checked) cb.click(); return true;`);

  /* Kaldırma + etkinlik kaydı */
  await page(`$("[data-attachments] button[aria-label='Brief.pdf ekini kaldır']").click(); return true;`); await sleep(250);
  check("Yüklenen ek kaldırılabilir", !(await attNames()).includes("Brief.pdf"));
  await page(`$("button[aria-label='Detayı kapat']")?.click(); return true;`); await sleep(300);

  /* 2. Marka Dosyaları → Dosya Yükle */
  await nav("Marka Dosyaları");
  await waitFor(() => page(`return $$("main button").some((b) => b.textContent.includes("Tepe Emlak"));`), 4000);
  await page(`$$("main button").find((b) => b.textContent.includes("Tepe Emlak") && b.textContent.includes("klasör")).click(); return true;`);
  await waitFor(() => page(`return !!$("[data-brand-files]");`), 3000);
  const head = await page(`const s = $("[data-brand-files]"); return { upload: !!exact("button", "Dosya Yükle", s), drive: !!exact("button", "Drive Bağlantısı Ekle", s), accept: $("[data-upload-input='brand-files']").accept };`);
  check("Marka Dosyaları: “Dosya Yükle” ve “Drive Bağlantısı Ekle” birlikte", head.upload && head.drive && head.accept.includes(".svg") && head.accept.includes(".zip"), JSON.stringify(head));
  const folderCount = (name) => page(`const b = $$("[data-brand-files] button").find((x) => x.textContent.includes(${JSON.stringify(name)}) && x.textContent.includes("dosya")); return b ? +(b.textContent.match(/(\\d+) dosya/) || [0, -1])[1] : -1;`);
  const g0 = await folderCount("Görsel Kütüphanesi");
  await pick("brand-files", [["Ürün Fotoğrafı.png", "png"]]);
  await waitFor(async () => (await folderCount("Görsel Kütüphanesi")) === g0 + 1, 4000).catch(() => {});
  check("Klasör açık değilken görsel türüne göre Görsel Kütüphanesi klasörüne yüklenir", g0 >= 0 && (await folderCount("Görsel Kütüphanesi")) === g0 + 1, `${g0} → ${await folderCount("Görsel Kütüphanesi")}`);
  check("Bildirim klasör adını söyler", (await toasts()).includes("Görsel Kütüphanesi klasörüne yüklendi"), await toasts());
  await page(`$$("[data-brand-files] button").find((x) => x.textContent.includes("Logolar")).click(); return true;`); await sleep(200);
  const l0 = await page(`return $$("[data-asset-card]").length;`);
  await pick("brand-files", [["Yeni Logo.svg", "svg"]]);
  await waitFor(() => page(`return $$("[data-asset-card]").length === ${l0 + 1};`), 4000).catch(() => {});
  const card = await page(`const c = $$("[data-asset-card]").find((x) => x.textContent.includes("Yeni Logo.svg")); return c ? { text: c.textContent, img: !!c.querySelector("img[src^='blob:']"), open: !!c.querySelector("a[href^='blob:']") } : null;`);
  check("Açık klasöre (Logolar) yüklenir; kart, küçük resim ve “Aç” bağlantısı", !!card && card.text.includes("Onay Bekliyor") && card.img && card.open, JSON.stringify(card));
  await dropOn("[data-brand-files]", [["Kurumsal Kimlik.pdf", "pdf"]]);
  await waitFor(() => page(`return $$("[data-asset-card]").some((x) => x.textContent.includes("Kurumsal Kimlik.pdf"));`), 4000).catch(() => {});
  check("Sürükle-bırak ile açık klasöre yüklenir", await page(`return $$("[data-asset-card]").some((x) => x.textContent.includes("Kurumsal Kimlik.pdf"));`));
  await page(`$$("[data-asset-card]").find((x) => x.textContent.includes("Yeni Logo.svg")).querySelector("button").click(); return true;`);
  check("Marka dosyası önizlemesi açılır (onay durumu düzenlenebilir)", await waitFor(() => page(`return !!$("[data-uploaded-preview='image/svg+xml'] img") && !!exact("button", "Onaylandı");`), 3000).then(() => true, () => false));
  await page(`$$("[data-cw-modal] button[aria-label='Kapat']").at(-1)?.click(); return true;`); await sleep(250);

  /* 3. Yetkiye göre düğmeler */
  await role("employee", "u2");
  await nav("Görevlerim"); await sleep(300);
  await waitFor(() => page(`return !!$("table tbody tr");`), 4000).catch(() => {});
  const opened = await page(`const b = $("table tbody tr")?.children[1]?.querySelector("button"); if (!b) return false; b.click(); return true;`);
  if (opened) await waitFor(() => page(`return !!$("[data-attachments]", ${drawer});`), 4000).catch(() => {});
  check("Çalışan kendi görevine dosya yükleyebilir (düğme görünür)", opened && (await page(`return !!exact("button", "Dosya Yükle", $("[data-attachments]") || document.body);`)));
  await page(`$("button[aria-label='Detayı kapat']")?.click(); return true;`); await sleep(200);
  await role("client", "c1");
  await nav("Marka Dosyaları"); await sleep(400);
  check("Müşteri marka dosyalarında yükleme düğmesi görmez", !(await page(`return !!$("[data-upload-input]");`)));

  await sleep(200);
  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check("Beklenmeyen hata", false, err.message);
} finally {
  await h.close();
}
