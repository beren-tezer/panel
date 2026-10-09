// Çalışan ekranı — 8 durum kutusu (sıra, sınıflandırma, düzen, kutu içi kaydırma, mobil).
//   npm run test:ui:employee
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5184, debugPort: 9338 });
const { page, viewport, check, consoleProblems, send } = h;
const ORDER = ["Geciken İşler", "Aktif İşler", "Tamamlananlar", "Web İşleri ve Teknik İşler", "Yönetici Onayı", "Müşteri Onayı", "Diğer Görevler", "Reklam Görevleri"];

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`));
  await page(`setValue($("select[aria-label='Rol']"), "employee");`);
  await sleep(300);
  await page(`setValue($("select[aria-label='Görüntülenen kullanıcı']"), "u3");`); // Burak: farklı türlerde işleri var
  await waitFor(() => page(`return $$("[data-employee-box]").length === 8;`), 4000);

  const boxes = await page(`return $$("[data-employee-box]").map((b) => { const r = b.getBoundingClientRect(); return { key: b.dataset.employeeBox, title: b.querySelector("h2").textContent, n: +b.querySelector("[data-box-count]").dataset.boxCount, items: $$("[data-box-task]", b).map((x) => x.dataset.boxTask), x: Math.round(r.x), y: Math.round(r.y), h: Math.round(r.height) }; });`);
  check("Çalışan ekranında tam 8 kutu, istenen sırada", JSON.stringify(boxes.map((b) => b.title)) === JSON.stringify(ORDER), boxes.map((b) => b.title).join(" | "));
  const rows = [...new Set(boxes.map((b) => b.y))];
  check("Masaüstü: üst satırda 1–4, alt satırda 5–8", rows.length === 2 && boxes.slice(0, 4).every((b) => b.y === rows[0]) && boxes.slice(4).every((b) => b.y === rows[1])
    && boxes.slice(0, 4).every((b, i, a) => i === 0 || b.x > a[i - 1].x), JSON.stringify(boxes.map((b) => [b.x, b.y])));
  check("Kutular eşit yükseklikte (kutu içi kaydırma)", new Set(boxes.map((b) => b.h)).size === 1);

  const all = boxes.flatMap((b) => b.items);
  check("Her görev yalnızca bir kutuda; sayaçlar listeyle aynı", new Set(all).size === all.length && boxes.every((b) => b.n === b.items.length) && all.length > 0, `${all.length} görev`);

  // Sınıflandırma doğrulaması: kutudaki görevlerin durum / tür bilgisi kutu kuralına uyar.
  const detail = await page(`return $$("[data-employee-box]").map((b) => [b.dataset.employeeBox, $$("[data-box-task]", b).map((x) => x.textContent)]);`);
  const statusOf = (txt) => ["Tamamlandı", "Onaylandı", "Yönetici Onayı", "Müşteri Onayı"].find((s) => txt.includes(s));
  const okClass = detail.every(([k, list]) => list.every((txt) => {
    const s = statusOf(txt);
    if (k === "done") return s === "Tamamlandı" || s === "Onaylandı";
    if (k === "manager") return s === "Yönetici Onayı";
    if (k === "client") return s === "Müşteri Onayı";
    return !s; // diğer kutularda onaydaki veya tamamlanmış görev olmaz
  }));
  check("Onay / tamamlanma kutuları yalnızca o durumdaki görevleri, diğer kutular hiçbirini içermez", okClass, JSON.stringify(detail).slice(0, 300));
  check("Geciken kutusundaki görevler gecikmiş olarak işaretli", detail.find(([k]) => k === "late")[1].every((txt) => /gecikti|Gecikti/.test(txt)), JSON.stringify(detail.find(([k]) => k === "late")[1]).slice(0, 200));
  // Tür bazlı sınıflandırmanın (web / reklam / sosyal içerik / diğer) kesin doğrulaması: tests/employeeBoxes.test.js

  // Kutudan görev açılır
  await page(`$("[data-employee-box='active'] [data-box-task]").click();`);
  check("Kutudaki göreve tıklayınca görev detayı açılır", await waitFor(() => page(`return !!$("aside[aria-label='Görev detayı']");`), 3000).catch(() => false));
  await page(`$("button[aria-label='Detayı kapat']").click(); return true;`);

  // Arama kutuları filtreler
  await page(`setValue($("input[placeholder*='ara']"), "zzzz-yok"); return true;`);
  await sleep(300);
  check("Arama tüm kutulara uygulanır", await page(`return $$("[data-box-task]").length === 0 && $$("[data-employee-box]").length === 8;`));
  await page(`setValue($("input[placeholder*='ara']"), ""); return true;`);
  await sleep(200);

  // Mobil ve tablet
  for (const [w, hh, m, cols] of [[768, 1024, false, 2], [375, 812, true, 1]]) {
    await viewport(w, hh, m);
    await sleep(300);
    const g = await page(`const bs = $$("[data-employee-box]").map((b) => b.getBoundingClientRect()); return { cols: new Set(bs.map((r) => Math.round(r.x))).size, doc: document.documentElement.scrollWidth - innerWidth, order: $$("[data-employee-box] h2").map((x) => x.textContent).join("|") };`);
    check(`${w}px: ${cols} sütun, sıra korunur, taşma yok`, g.cols === cols && g.doc <= 0 && g.order === ORDER.join("|"), JSON.stringify(g).slice(0, 200));
  }
  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check(`Beklenmeyen hata: ${err.message}`, false);
} finally {
  await h.close();
}
