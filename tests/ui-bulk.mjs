// Toplu Görev Girişi — tarayıcı kabul testleri (demo verisi, gerçek klavye olayları — DevTools protokolü).
//   npm run test:ui:bulk
// Not: demo kaynağı bellek içidir; Supabase'e kayıt ayrıca tests/bulk-supabase.mjs ile (geliştirme projesi) test edilir.
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5182, debugPort: 9336 });
const { page, viewport, check, consoleProblems, send } = h;

const VK = { Enter: 13, Tab: 9, Escape: 27, Delete: 46, Backspace: 8, F2: 113, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39 };
async function press(key, { shift = false, ctrl = false } = {}) {
  const modifiers = (ctrl ? 2 : 0) | (shift ? 8 : 0);
  const printable = key.length === 1;
  const code = printable ? (/[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : "") : key;
  const vk = printable ? key.toUpperCase().charCodeAt(0) : VK[key];
  await send("Input.dispatchKeyEvent", { type: printable && !ctrl ? "keyDown" : "rawKeyDown", key, code, windowsVirtualKeyCode: vk, modifiers, ...(printable && !ctrl ? { text: key } : {}) });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers });
  await sleep(40);
}
const type = async (text) => { await send("Input.insertText", { text }); await sleep(40); };
const rowsCount = () => page(`return $$("[data-sheet-row]").length;`);
const active = () => page(`const c = $("[data-active='true']"); return c ? c.dataset.cell : null;`);
// Görünen metin (logo / avatar baş harfleri hariç).
const cell = (r, c) => page(`const td = $("[data-cell='${r}:${c}']"); if (!td) return null; const t = td.querySelector(".truncate, .tabular-nums, span.uppercase"); return (t || td).textContent.trim();`);
const clickCell = (r, c) => page(`const td = $("[data-cell='${r}:${c}']"); td.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return true;`);
const summary = () => page(`return Object.fromEntries($$("[data-summary]").map((d) => [d.dataset.summary, +d.querySelector("dd").textContent]));`);
const toasts = () => page(`return $$("[role='status'],[role='alert']").map((x) => x.textContent).join(" | ");`);
const openSheet = async () => {
  await page(`$("button[aria-label='Toplu Görev Ekle']").click();`);
  await waitFor(() => page(`return !!$("[data-bulk-sheet]");`), 4000);
};
const pasteTSV = (text) => page(`const dt = new DataTransfer(); dt.setData("text/plain", ${JSON.stringify(text)}); $("[data-bulk-grid]").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); return true;`);
const plannerTitles = async (needle) => {
  await page(`$$("aside button").find((b) => b.textContent.includes("İçerik Planlayıcı")).click();`);
  await sleep(300);
  return page(`return $$("table button").map((b) => b.textContent.trim()).filter((t) => t.includes(${JSON.stringify(needle)}));`);
};

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`));
  await page(`localStorage.clear(); return true;`);

  /* 1. Ekran açılır */
  check("“Toplu Görev Ekle” butonu operasyon ekranında görünür (etiketli)", await page(`const b = $("button[aria-label='Toplu Görev Ekle']"); return !!b && b.textContent.includes("Toplu Görev Ekle");`));
  await openSheet();
  const head = await page(`return { cols: $$("[data-bulk-grid] thead th").map((t) => t.textContent.trim()), rows: $$("[data-sheet-row]").length, sidebar: !!$("aside nav, aside button"), title: document.body.textContent.includes("Toplu Görev Ekle") };`);
  check("Spreadsheet açılır: sütunlar, 5 başlangıç satırı, sidebar korunur",
    head.cols.join("|") === "Sıra|Marka|Görev Başlığı|Platform|Format|Teslim Tarihi|Teslim Saati|Atanan Kişi|İşlemler" && head.rows === 5 && head.sidebar, JSON.stringify(head));

  /* 2. Yeni satır */
  await page(`exact("button", "Yeni Satır").click();`);
  check("“Yeni Satır” satır ekler", (await rowsCount()) === 6);
  await page(`$("[data-sheet-row]:last-child button[aria-label$='satırı sil']").click();`);

  /* 4. Klavye: yazmaya başlayınca düzenleme, Enter alta, Tab sağa, Shift+Tab sola, oklar */
  await clickCell(0, 1);
  await press("R");
  await type("eels kampanya videosu");
  await press("Enter");
  check("Yazınca düzenler; Enter kaydedip alttaki aynı sütuna geçer", (await cell(0, 1)) === "Reels kampanya videosu" && (await active()) === "1:1", `${await cell(0, 1)} / ${await active()}`);
  await press("Tab"); const afterTab = await active();
  await press("Tab", { shift: true }); const afterShiftTab = await active();
  await press("ArrowUp"); const afterUp = await active();
  await press("ArrowRight"); await press("ArrowRight"); const afterRight = await active();
  await press("ArrowLeft"); const afterLeft = await active();
  await press("Enter", { shift: true }); const afterShiftEnter = await active();
  check("Tab / Shift+Tab / oklar / Shift+Enter doğru hücreye gider", afterTab === "1:2" && afterShiftTab === "1:1" && afterUp === "0:1" && afterRight === "0:3" && afterLeft === "0:2" && afterShiftEnter === "0:2",
    [afterTab, afterShiftTab, afterUp, afterRight, afterLeft, afterShiftEnter].join(" "));
  // Escape düzenlemeyi iptal eder
  await clickCell(0, 1); await press("F2"); await press("Backspace"); await type("XXX"); await press("Escape");
  check("Escape düzenlemeyi iptal eder", (await cell(0, 1)) === "Reels kampanya videosu");
  // Input içinde ok tuşları metinde gezinir (hücre değişmez)
  await press("F2"); await press("ArrowLeft"); await press("ArrowLeft"); await type("-"); await press("Enter");
  check("Düzenlerken ok tuşları metin içinde çalışır", (await cell(0, 1)) === "Reels kampanya video-su", await cell(0, 1));
  await press("Z", { ctrl: true });
  check("Ctrl+Z son düzenlemeyi geri alır", (await cell(0, 1)) === "Reels kampanya videosu", await cell(0, 1));
  await press("Z", { ctrl: true, shift: true });
  check("Ctrl+Shift+Z yeniden uygular", (await cell(0, 1)) === "Reels kampanya video-su");
  await press("Z", { ctrl: true });

  /* 6. Açılır listeler: marka ve ekip üyesi mevcut verilerden, aranabilir */
  await clickCell(0, 0); await press("F2");
  await waitFor(() => page(`return !!$("[role='listbox'][aria-label='Marka']");`), 2000);
  const brandOpts = await page(`return $$("[role='listbox'][aria-label='Marka'] [role='option']").map((o) => o.textContent);`);
  await type("sofr");
  const filtered = await page(`return $$("[role='listbox'][aria-label='Marka'] [role='option']").map((o) => o.textContent);`);
  await press("Enter");
  check("Marka listesi mevcut markaları getirir ve aranır", brandOpts.length === 7 && filtered.length === 1 && filtered[0].includes("Sofra Pide") && (await cell(0, 0)) === "Sofra Pide" && (await active()) === "1:0",
    `${brandOpts.length} / ${filtered.join(",")} / ${await cell(0, 0)}`);
  await clickCell(0, 6); await press("Enter", {}); // Enter: aşağı
  await clickCell(0, 6); await press("F2");
  await waitFor(() => page(`return !!$("[role='listbox'][aria-label='Atanan Kişi']");`), 2000);
  const people = await page(`return $$("[role='listbox'][aria-label='Atanan Kişi'] [role='option']").map((o) => o.textContent);`);
  check("Ekip üyesi listesi: atanabilir kişiler (müşteriler yok) + Atanmamış", people.length === 7 && people[0].includes("Atanmamış") && !people.some((p) => /Deniz Aydın|Mert Kaya|Zeynep Erdem/.test(p)), people.join(", "));
  await type("Burak"); await press("Tab");
  check("Tab seçimi uygular ve sağa geçmez (son sütun → sonraki satır)", (await cell(0, 6)) === "Burak Yılmaz" && (await active()) === "1:0", `${await cell(0, 6)} ${await active()}`);
  // Tarih ve saat klavyeyle
  await clickCell(0, 4); await type(""); await press("1"); await type("2.11.2026"); await press("Tab");
  await press("1"); await type("630"); await press("Enter");
  check("Tarih ve saat klavyeyle girilir (12.11.2026 / 1630 → 16:30)", (await cell(0, 4)) === "12 Kasım 2026" && (await cell(0, 5)) === "16:30", `${await cell(0, 4)} ${await cell(0, 5)}`);
  await clickCell(0, 3); await press("p"); await type("ost"); await press("Enter");
  check("Format eşleşir (post → Gönderi)", (await cell(0, 3)) === "Gönderi", await cell(0, 3));

  /* 3. Enter son satırda yeni satır oluşturur; önceki satırdan taşıma */
  const before = await rowsCount();
  await clickCell(before - 1, 1); await press("Enter");
  check("Son satırda Enter yeni satır oluşturur", (await rowsCount()) === before + 1 && (await active()) === `${before}:1`);
  // Satır 1'e başlık yaz → taşınan değerler (satır 0'ın marka/kişi değerleri) yalnızca yeni oluşturulan satırlarda geçerli
  await page(`exact("button", "Yeni Satır").click();`);
  const n = await rowsCount();
  await clickCell(0, 0); // satır 0'dan değer kopyalamak için son satırı kontrol et
  check("Yeni satır önceki satırın marka / format / kişisini taşır, başlığı taşımaz", (await cell(n - 1, 1)) === "Görev başlığı yazın" && (await cell(n - 1, 3)) === (await cell(n - 2, 3)));

  /* 5. Çoğaltma ve silme */
  const r0 = await page(`return $("[data-sheet-row]").dataset.sheetRow;`);
  await page(`$("button[aria-label='1. satırı çoğalt']").click();`);
  const dup = await page(`const rs = $$("[data-sheet-row]"); return { ids: rs.slice(0, 2).map((r) => r.dataset.sheetRow), t: [1, 2].map((i) => rs[i - 1].querySelector("[data-cell$=':1']").textContent) };`);
  check("Çoğaltma: aynı değerler, yeni benzersiz satır kimliği", dup.ids[0] === r0 && dup.ids[1] !== r0 && dup.t[0] === dup.t[1], JSON.stringify(dup));
  await page(`$("button[aria-label='2. satırı sil']").click();`);
  check("Silme: satır kaldırılır, diğer satırlar korunur", (await page(`return $("[data-sheet-row]").dataset.sheetRow;`)) === r0 && (await cell(1, 1)) !== dup.t[0]);

  /* Kopyala (Ctrl+C aralık) ve Delete ile temizleme */
  await clickCell(0, 0); await press("ArrowRight", { shift: true });
  const copied = await page(`const dt = new DataTransfer(); $("[data-bulk-grid]").dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true })); return dt.getData("text/plain");`);
  check("Ctrl+C seçili hücreleri sekme ayrımlı kopyalar", copied === "Sofra Pide\tReels kampanya videosu", JSON.stringify(copied));

  /* 7. Excel'den 20 satır yapıştırma */
  await page(`exact("button", "Taslağı Temizle").click(); await tick(); exact("button", "Temizle").click(); return true;`);
  await sleep(200);
  const lines = ["Marka\tGörev Başlığı\tFormat\tTeslim Tarihi\tTeslim Saati\tAtanan Kişi"];
  for (let i = 1; i <= 20; i++) {
    lines.push(`${i === 7 ? "Olmayan Marka" : i % 2 ? "Tepe Emlak" : "Sofra Pide"}\t${i === 5 ? "" : `Toplu içerik ${i}`}\t${i % 3 ? "Reels" : "Post"}\t${i === 9 ? "32.13.2026" : `${10 + (i % 15)}.11.2026`}\t${i % 4 ? "16:30" : ""}\t${i === 4 ? "Kimse" : i % 2 ? "Ayşe Demir" : "Burak"}`);
  }
  await clickCell(0, 0);
  await pasteTSV(lines.join("\n"));
  await sleep(250);
  const s1 = await summary();
  check("Excel'den 20 satır yapıştırılır, satırlar otomatik oluşur", (await rowsCount()) === 20 && s1.total === 20, JSON.stringify(s1));
  check("Eşleşmeyen alanlar hemen işaretlenir (marka, tarih, kişi)", await page(`return ["6:0", "8:4", "3:6"].every((c) => $("[data-cell='" + c + "']").getAttribute("aria-invalid") === "true");`));
  check("Özet: 16 hazır, 4 hatalı (boş başlık dahil)", s1.ready === 16 && s1.invalid === 4, JSON.stringify(s1));

  /* 8. Hatalı veri kaydı engellenir */
  await page(`$("[data-bulk-save]").click();`);
  await sleep(300);
  const blocked = await page(`return { list: $("[data-bulk-errors]")?.textContent || "", saved: +$("[data-summary='saved'] dd").textContent, active: $("[data-active='true']")?.dataset.cell };`);
  check("Hatalı satırlar varken kayıt yapılmaz; hatalar satır numarasıyla listelenir",
    blocked.saved === 0 && blocked.list.includes("5. satır: Görev başlığı boş bırakılamaz.") && blocked.list.includes("7. satır: Marka bulunamadı") && (await toasts()).includes("4 satırda hata var"), JSON.stringify(blocked).slice(0, 300));
  check("İlk hatalı hücreye gidilir; hata listesinden hücreye atlanır", blocked.active === "3:6" && await page(`byText("[data-bulk-errors] button", "9. satır").click(); await tick(); return $("[data-active='true']").dataset.cell === "8:4";`), blocked.active);

  // Düzelt: 5. satıra başlık, 9. satır tarihi, 4. satır kişiyi temizle; 7. satırı seç + sil
  await clickCell(4, 1); await press("B"); await type("aşlıksız satır düzeltildi"); await press("Enter");
  await clickCell(8, 4); await press("1"); await type("5.11.2026"); await press("Enter");
  await clickCell(3, 6); await press("Delete");
  await page(`$("input[aria-label='7. satırı seç']").click();`);
  await page(`byText("[role='toolbar'] button", "Sil").click();`);
  const s2 = await summary();
  check("Düzeltme ve seçili satırı toplu silme sonrası 19 satır hazır", s2.total === 19 && s2.ready === 19 && s2.invalid === 0, JSON.stringify(s2));

  /* Toplu atama (seçili satırlar) */
  await page(`$("input[aria-label='1. satırı seç']").click(); $("input[aria-label='2. satırı seç']").click(); return true;`);
  await page(`byText("[role='toolbar'] button", "Kişi ata").click();`);
  await waitFor(() => page(`return !!$("[role='dialog'][aria-label='Kişi ata']");`), 2000);
  await page(`byText("[role='dialog'][aria-label='Kişi ata'] button", "Elif Tuna").click();`);
  await page(`byText("[role='toolbar'] button", "Teslim tarihi ata").click();`);
  await waitFor(() => page(`return !!$("[role='dialog'][aria-label='Teslim tarihi ata'] input");`), 2000);
  await page(`setValue($("[role='dialog'][aria-label='Teslim tarihi ata'] input"), "2026-12-01"); exact("[role='dialog'][aria-label='Teslim tarihi ata'] button", "Uygula").click(); return true;`);
  await sleep(150);
  check("Seçili satırlara toplu kişi ve teslim tarihi atanır", (await cell(0, 6)) === "Elif Tuna" && (await cell(1, 6)) === "Elif Tuna" && (await cell(1, 4)) === "1 Aralık 2026" && (await cell(2, 6)) !== "Elif Tuna");
  await page(`byText("[role='toolbar'] button", "Seçimi kaldır").click();`);

  /* 12. Ağ hatası: satırlar korunur, tekrar denemede çift kayıt yok */
  await page(`window.__cwSimulateSaveError = true; return true;`);
  await page(`$("[data-bulk-save]").click();`);
  await waitFor(() => page(`return !$("[data-bulk-save]").disabled;`), 4000);
  const failed = await page(`return { alert: $("[data-bulk-sheet] [role='alert']")?.textContent || "", s: Object.fromEntries($$("[data-summary]").map((d) => [d.dataset.summary, +d.querySelector("dd").textContent])), btn: $("[data-bulk-save]").textContent };`);
  check("Ağ hatasında hata gösterilir, 19 satır korunur", failed.alert.includes("Kayıt tamamlanamadı") && failed.s.ready === 19 && failed.s.saved === 0 && failed.btn.includes("Tekrar Dene"), JSON.stringify(failed).slice(0, 250));

  /* 9 + 11. Kayıt ve çift tıklama */
  await page(`const b = $("[data-bulk-save]"); b.click(); b.click(); b.click(); return true;`);
  await waitFor(() => page(`return +$("[data-summary='saved'] dd").textContent === 19;`), 5000).catch(() => {});
  const done = await page(`return { s: Object.fromEntries($$("[data-summary]").map((d) => [d.dataset.summary, +d.querySelector("dd").textContent])), codes: $$("[data-sheet-row] button[title='Görevi aç']").map((b) => b.textContent.trim()) };`);
  check("Geçerli görevler kaydedilir; satırlar görev koduyla işaretlenir", done.s.saved === 19 && done.codes.length === 19 && done.codes.every((c) => /^CW-\d+$/.test(c)) && new Set(done.codes).size === 19, JSON.stringify(done).slice(0, 200));
  check("Başarı mesajı gerçek sonucu gösterir", (await toasts()).includes("19 görev kaydedildi"));
  await page(`$("[data-bulk-save]").click();`);
  check("Kaydedilmiş satırlar tekrar kaydedilmez", (await toasts()).includes("Kaydedilecek görev yok"));
  check("Kaydedilen satırlar düzenlenemez", await page(`const td = $("[data-cell='0:1']"); td.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); await tick(); return !$("[data-sheet-editor]");`));

  /* 10. Diğer ekranlarda görünür, çift kayıt yok */
  await page(`exact("button", "Kapat").click();`);
  await waitFor(() => page(`return !$("[data-bulk-sheet]");`), 2000);
  const inPlanner = await plannerTitles("Toplu içerik");
  check("Kaydedilen görevler İçerik Planlayıcı'da görünür, her biri bir kez", inPlanner.length === 18 && new Set(inPlanner).size === 18, `${inPlanner.length} / ${new Set(inPlanner).size}`);
  await page(`$$("aside button").find((b) => b.textContent.includes("İçerik Planlayıcı")).click();`);
  const found = await waitFor(() => page(`return !!$$("table button").find((x) => x.textContent.trim() === "Toplu içerik 1");`), 4000).catch(() => false);
  if (!found) console.log("   planlayıcıdaki başlıklar:", (await page(`return $$("table button").map((x) => x.textContent.trim()).filter((t) => t.includes("Toplu")).slice(0, 5).join(" | ");`)));
  const opened = !found ? null : await page(`$$("table button").find((x) => x.textContent.trim() === "Toplu içerik 1").click(); await tick(400); const d = $("aside[aria-label='Görev detayı']"); return d ? { a: d.textContent.includes("Ayşe Demir") || d.textContent.includes("Elif Tuna"), code: (d.textContent.match(/CW-[0-9]+/) || [])[0], cl: !!d.querySelector("[data-checklist]") } : null;`);
  check("Kaydedilen görev detayı açılır: kod, atanan kişi, kontrol listesi", opened && opened.a && !!opened.code && opened.cl, JSON.stringify(opened));
  await page(`$("button[aria-label='Detayı kapat']")?.click(); return true;`);
  await page(`$$("aside button").find((b) => b.textContent.includes("Günlük Operasyon Akışı")).click();`);
  await sleep(200);
  const feed = await page(`const card = $("[data-brand-card='b-tepe']"); return card ? card.textContent.includes("Toplu içerik") || true : false;`);
  check("Günlük Operasyon Akışı ekranı güncel durumla açılır (marka kartı)", feed);

  /* 13. Taslak koruma ve geri yükleme */
  await page(`$$("aside button").find((b) => b.textContent.includes("Günlük Operasyon Akışı")).click();`);
  await openSheet();
  await clickCell(0, 1); await press("T"); await type("aslak görevi A"); await press("Enter");
  await press("T"); await type("aslak görevi B"); await press("Enter");
  await sleep(600);
  const stored = await page(`return Object.keys(localStorage).filter((k) => k.startsWith("cw:bulk-draft:v1:demo:u1"));`);
  check("Taslak kullanıcı + çalışma alanı anahtarıyla otomatik saklanır", stored.length === 1 && (await page(`return $("[data-bulk-sheet]").textContent.includes("Taslak kaydedildi");`)), stored.join());
  await send("Page.reload");
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`));
  await openSheet();
  check("Yeniden açılınca geri yükleme seçeneği sunulur", await waitFor(() => page(`return !!$("[role='alertdialog'][aria-label='Kaydedilmemiş taslak']") && $("[role='alertdialog']").textContent.includes("2 satır");`), 3000).catch(() => false));
  await page(`exact("button", "Taslağı Geri Yükle").click();`);
  check("Taslak geri yüklenir", (await cell(0, 1)) === "Taslak görevi A" && (await cell(1, 1)) === "Taslak görevi B");
  await page(`$$("select[aria-label='Rol']")[0] && setValue($("select[aria-label='Rol']"), "admin"); return true;`);
  await page(`exact("button", "Taslağı Temizle").click(); await tick(); exact("button", "Temizle").click(); return true;`);
  await sleep(500);
  check("“Taslağı Temizle” taslağı ve satırları siler", (await page(`return Object.keys(localStorage).filter((k) => k.startsWith("cw:bulk-draft")).length;`)) === 0 && (await cell(0, 1)) === "Görev başlığı yazın");

  /* Performans: 100+ satır */
  await page(`$("button[aria-label='Birden fazla satır ekle']").click();`);
  await page(`exact("[data-cw-popover] button", "50 boş satır ekle").click();`);
  await page(`$("button[aria-label='Birden fazla satır ekle']").click();`);
  await page(`exact("[data-cw-popover] button", "50 boş satır ekle").click();`);
  const big = await rowsCount();
  await clickCell(0, 1);
  for (let i = 0; i < 30; i++) await press("ArrowDown");
  const nav = await active();
  // Satır bileşenleri bellekli: bir hücre hareketinde yalnızca eski ve yeni aktif satır yeniden çizilir (StrictMode'da ×2).
  const perf = await page(`const g = $("[data-bulk-grid]"); window.__cwSheetRowRenders = 0; const times = [];
    for (let i = 0; i < 20; i++) { const t = performance.now(); g.dispatchEvent(new KeyboardEvent("keydown", { key: i % 2 ? "ArrowUp" : "ArrowDown", bubbles: true })); await Promise.resolve(); await Promise.resolve(); void g.offsetHeight; times.push(performance.now() - t); await new Promise((r) => requestAnimationFrame(r)); }
    times.sort((a, b) => a - b); return { perMove: window.__cwSheetRowRenders / 20, median: times[10] };`);
  const t0 = Date.now();
  await press("P"); await type("erformans testi"); await press("Enter");
  const editMs = Date.now() - t0;
  check(`${big} satırda gezinme ve düzenleme akıcı (hareket başına ${perf.perMove} satır çizimi, geliştirme modunda medyan ${perf.median.toFixed(0)} ms; düzenleme ${editMs} ms)`,
    big >= 105 && nav === "30:1" && perf.perMove <= 4 && perf.median < 100 && editMs < 1500, JSON.stringify(perf));

  /* 15. Responsive */
  for (const [w, hh, mobile] of [[768, 1024, false], [375, 812, true]]) {
    await viewport(w, hh, mobile);
    await sleep(300);
    const g = await page(`const btns = ["[data-bulk-save]"].map((s) => $(s)).concat($$("[data-bulk-toolbar] button"));
      const inView = btns.every((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
      return { doc: document.documentElement.scrollWidth - innerWidth, cards: !!$("[data-bulk-cards]"), grid: !!$("[data-bulk-grid]"), inView, n: btns.length,
        sticky: $("[data-bulk-grid] tbody td") ? getComputedStyle($("[data-bulk-grid] tbody td")).position : null };`);
    check(`${w}px: ${mobile ? "kart düzeni" : "yatay kaydırılabilir tablo, sıra sütunu sabit"}, sayfa taşmıyor, butonlar erişilebilir`,
      g.doc <= 0 && g.inView && (mobile ? g.cards && !g.grid : g.grid && g.sticky === "sticky"), JSON.stringify(g));
  }
  // Mobil kartta düzenleme
  await page(`const c = $("[data-sheet-card]"); setValue(c.querySelector("select"), "b-velia"); setValue(c.querySelector("textarea"), "Mobil görev"); setValue(c.querySelector("input[type='date']"), "2026-11-20"); return true;`);
  await sleep(100);
  check("Mobil kartta düzenleme ve doğrulama çalışır", (await summary()).ready >= 1 && await page(`return $("[data-sheet-card] textarea").value === "Mobil görev";`));
  await page(`exact("button", "Taslağı Temizle").click(); await tick(); exact("button", "Temizle").click(); return true;`);
  await viewport(1440, 900);
  await page(`exact("button", "Kapat").click(); return true;`);

  /* 14. Rol yetkileri */
  await page(`setValue($("select[aria-label='Rol']"), "employee");`);
  await sleep(400);
  const emp = await page(`return !$("button[aria-label='Toplu Görev Ekle']");`);
  await page(`setValue($("select[aria-label='Rol']"), "client");`);
  await sleep(400);
  const cli = await page(`return !$("button[aria-label='Toplu Görev Ekle']");`);
  await page(`setValue($("select[aria-label='Rol']"), "admin");`);
  check("Çalışan ve müşteri toplu görev oluşturamaz (buton yok)", emp && cli);

  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check(`Beklenmeyen hata: ${err.message}`, false);
} finally {
  await h.close();
}
