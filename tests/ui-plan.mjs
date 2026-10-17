// Yönetici operasyon masası (4 sayaç + 8 grup) ve Sosyal Medya Planı (Günlük / Haftalık / Aylık).
//   npm run test:ui:plan          (SHOTS=<klasör> verilirse ekran görüntüleri de kaydedilir)
import { writeFileSync } from "node:fs";
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5192, debugPort: 9352 });
const { page, viewport, check, consoleProblems, send } = h;
const SHOTS = process.env.SHOTS;
const shot = async (name) => { if (!SHOTS) return; const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(r.data, "base64")); };
const ORDER = ["Geciken & Acil İşler", "Yönetici Onayı", "Müşteri Onayı", "Aktif Çalışmalar", "Tamamlanan & Yayına Hazır", "Web & Teknik", "Ajans İçi İşler", "Reklam İşleri"];
const nav = (label) => page(`const b = $$("aside button").find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)})); b.click(); return true;`);
const overflow = () => page(`return document.documentElement.scrollWidth - window.innerWidth;`);

try {
  /* ── 1. Operasyon masası ── */
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return $$("[data-ops-box]").length === 8;`), 45000); // ilk derleme (büyük JSX) yavaş makinede 15 sn'yi aşabilir
  const desk = await page(`return {
    metrics: $$("[data-ops-metric]").map((m) => [m.dataset.opsMetric, m.querySelector("p").textContent, +m.querySelector("[data-ops-value]").dataset.opsValue]),
    boxes: $$("[data-ops-box]").map((b) => { const r = b.getBoundingClientRect(); return { key: b.dataset.opsBox, title: b.querySelector("h3").textContent, n: +b.querySelector("[data-ops-count]").dataset.opsCount, items: $$("[data-ops-task]", b).map((x) => x.dataset.opsTask), x: Math.round(r.x), y: Math.round(r.y) }; }),
  };`);
  check("4 sayaç: Bugünkü Teslimatlar, Geciken İşler, Yönetici Onayı, Müşteri Onayı", JSON.stringify(desk.metrics.map((m) => m[1])) === JSON.stringify(["Bugünkü Teslimatlar", "Geciken İşler", "Yönetici Onayı", "Müşteri Onayı"]), desk.metrics.map((m) => `${m[1]}=${m[2]}`).join(", "));
  check("8 grup, istenen sırada", JSON.stringify(desk.boxes.map((b) => b.title)) === JSON.stringify(ORDER), desk.boxes.map((b) => b.title).join(" | "));
  const all = desk.boxes.flatMap((b) => b.items);
  check("Her görev yalnızca bir grupta; sayılar listeyle aynı", all.length > 0 && new Set(all).size === all.length && desk.boxes.every((b) => b.n === b.items.length), `${all.length} görev`);
  const m = Object.fromEntries(desk.metrics.map((x) => [x[0], x[2]])), bx = Object.fromEntries(desk.boxes.map((b) => [b.key, b.n]));
  check("Onay sayaçları gruplarla tutarlı", m.manager === bx.manager && m.client === bx.client && m.manager > 0 && m.client > 0, JSON.stringify({ m, bx }));
  const rows = [...new Set(desk.boxes.map((b) => b.y))];
  check("1440px: 4 sütun × 2 satır", rows.length === 2 && desk.boxes.slice(0, 4).every((b) => b.y === rows[0]) && desk.boxes.slice(4).every((b) => b.y === rows[1]));
  await shot("desk-1440");
  const opened = await page(`$("[data-ops-box='manager'] [data-ops-task]").click(); await tick(400); return !!$("aside[aria-label='Görev detayı']");`);
  check("Gruptaki işe tıklayınca görev detayı açılır", opened);
  await page(`$("button[aria-label='Detayı kapat']")?.click(); return true;`);
  await sleep(300);

  for (const [w, cols] of [[1920, 4], [1024, 2], [375, 1]]) {
    await viewport(w, 900, w < 640);
    await sleep(300);
    const xs = await page(`return [...new Set($$("[data-ops-box]").map((b) => Math.round(b.getBoundingClientRect().x)))].length;`);
    const of = await overflow();
    check(`${w}px: grup kutuları ${cols} sütuna kayar, yatay taşma yok`, xs === cols && of <= 0, `sütun ${xs}, taşma ${of}px`);
    if (w === 375) await shot("desk-375");
  }

  /* ── 2. Sosyal Medya Planı — Aylık ── */
  await viewport(1440, 900);
  await nav("Sosyal Medya Planı");
  await waitFor(() => page(`return !!$("[data-social-plan]");`));
  await page(`const b = $("[data-plan-view='month']"); b.click(); return true;`);
  await waitFor(() => page(`return !!$("[data-month-plan]");`));
  await page(`$$("[data-plan-brand]").find((b) => b.textContent.includes("Tepe Emlak")).click(); return true;`);
  await sleep(300);
  const month = await page(`return {
    heading: $("[data-plan-heading]")?.textContent,
    weeks: $$("[data-plan-week]").map((s) => s.querySelector("button").textContent),
    rows: $$("[data-plan-row]").map((r) => r.querySelector(".cw-plan-date").textContent),
    status: $$("[data-plan-row] .cw-plan-status button").length,
    perRow: $$("[data-plan-row]").map((r) => r.querySelectorAll("button[aria-label*='ek dosya'], button[aria-label*='yorum'], [aria-label='Yorum yok'], [aria-label='Ek dosya yok']").length),
  };`);
  check("Aylık görünüm: 'TEPE EMLAK <Ay> Sosyal Medya' başlığı", /^TEPE EMLAK \S+ Sosyal Medya$/.test(month.heading || ""), month.heading);
  check("Haftalara bölünmüş ('1. Hafta' …)", month.weeks.length > 0 && month.weeks.every((w) => /^\d\. Hafta/.test(w)), month.weeks.join(" | "));
  check("Her satırda durum menüsü, ek ve yorum göstergesi", month.rows.length > 0 && month.status === month.rows.length && month.perRow.every((n) => n === 2), `${month.rows.length} satır`);
  await shot("plan-month-1440");

  const hover = await page(`
    const withComments = () => $$("[data-plan-row] button[aria-label$=' yorum']")[0];
    for (const brand of $$("[data-plan-brand]")) { if (withComments()) break; brand.click(); await tick(250); }
    const b = withComments(); if (!b) return null;
    b.dispatchEvent(new PointerEvent("pointerover", { pointerType: "mouse", bubbles: true })); await tick(250);
    const pop = $$("[data-cw-popover]").find((p) => p.textContent.includes("Tüm yorumları gör")); return pop ? pop.textContent.slice(0, 80) : null;`);
  check("Yorum sayısının üzerine gelince son yorumlar ve 'Tüm yorumları gör' açılır", !!hover, hover);
  await shot("plan-month-hover");
  await page(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return true;`);
  await page(`$$("[data-plan-brand]").find((b) => b.textContent.includes("Tepe Emlak")).click(); return true;`);
  await sleep(250);
  const person = await page(`
    const b = $$("[data-plan-row] button[aria-label^='Sorumlu:']")[0]; if (!b) return null; b.click(); await tick(250);
    const pop = $$("[data-cw-popover]").find((p) => p.textContent.includes("Sorumlu kişi")); const t = pop?.textContent; b.click(); return t;`);
  check("Sorumlu kişi kartı (ad + e-posta)", !!person && person.includes("@"), person);
  const drawer = await page(`$("[data-plan-row] .cw-plan-title").click(); await tick(400); return !!$("aside[aria-label='Görev detayı']");`);
  check("Satıra tıklayınca görev detayı açılır", drawer);
  await page(`$("button[aria-label='Detayı kapat']")?.click(); return true;`);
  await sleep(300);
  const before = month.heading;
  await page(`$("button[aria-label='Önceki']").click(); return true;`); await sleep(200);
  const prev = await page(`return $("[data-plan-title]").textContent;`);
  await page(`exact("button", "Bugün").click(); return true;`); await sleep(200);
  check("Ay değiştirme ve 'Bugün' çalışır", prev !== (await page(`return $("[data-plan-title]").textContent;`)) && (await page(`return $("[data-plan-heading]")?.textContent;`)) === before, prev);

  /* ── 3. Günlük ve Haftalık ── */
  await page(`$("[data-plan-view='day']").click(); return true;`);
  await sleep(300);
  const day = await page(`return { cards: $$("[data-plan-card]").length, tasks: $$("[data-plan-card-task]").length, title: $("[data-plan-title]").textContent };`);
  check("Günlük görünüm: bugünün içerikleri marka kartlarında", day.cards > 0 && day.tasks >= day.cards, JSON.stringify(day));
  await shot("plan-day-1440");
  await page(`$("[data-plan-view='week']").click(); return true;`);
  await sleep(300);
  const week = await page(`return { days: $$("[data-plan-day]").length, cards: $$("[data-plan-card]").length };`);
  check("Haftalık görünüm: 7 gün, günlere göre marka kartları", week.days === 7 && week.cards > 0, JSON.stringify(week));
  await shot("plan-week-1440");
  const remembered = await page(`return localStorage.getItem("cw:plan-view");`);
  check("Seçilen görünüm hatırlanır", remembered === "week");

  /* ── 4. Mobil ── */
  for (const v of ["month", "week"]) {
    await viewport(375, 812, true);
    await page(`$("[data-plan-view='${v}']").click(); return true;`);
    await sleep(300);
    check(`375px: ${v === "month" ? "aylık" : "haftalık"} planda yatay taşma yok`, (await overflow()) <= 0, `${await overflow()}px`);
    await shot(`plan-${v}-375`);
  }

  await sleep(200);
  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check("Beklenmeyen hata", false, err.message);
} finally {
  await h.close();
}
