// Çoklu "Görevi Yapan" / "Platform" ve sayfa yenilemede (Ctrl+R) kalınan ekranın korunması — tarayıcı testi (demo verisi).
//   npm run test:ui:multi
// Demo kaynağı bellek içidir: yenileme testleri yeni oluşturulan görevle değil, demo görevleriyle yapılır.
// Veritabanı tarafı (assignee_ids / platforms, RLS, eşitleme) 013_multi_assign.sql PGlite testiyle doğrulanır.
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5193, debugPort: 9353 });
const { page, viewport, check, consoleProblems, send } = h;
const TITLE = "Çoklu Sorumlu Testi — Kampanya Görseli";
const drawer = `$("aside[aria-label='Görev detayı']")`;
const toasts = () => page(`return $$("[role='status'],[role='alert']").map((x) => x.textContent).join(" | ");`);
const nav = (label) => page(`const b = $$("aside button").find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)})); b.click(); return !!b;`);
const role = async (r, userId) => {
  await page(`setValue($("select[aria-label='Rol']"), ${JSON.stringify(r)});`);
  await sleep(250);
  if (userId) { await page(`setValue($("select[aria-label='Görüntülenen kullanıcı']"), ${JSON.stringify(userId)});`); await sleep(300); }
};
const field = (label) => `$$("[role='dialog'] label").find((l) => l.firstElementChild && l.firstElementChild.textContent.trim() === ${JSON.stringify(label)}).querySelector("input, select, textarea")`;
const chip = (group, value) => `$("[data-chip-checks='${group}'] [data-value='${value}']").click();`;
const inbox = async () => { await nav("Bildirimler"); await sleep(300); return page(`return $("main").textContent;`); };
const params = () => page(`return Object.fromEntries(new URLSearchParams(location.search));`);
const reload = async () => {
  await send("Page.reload", {});
  await sleep(500);
  await waitFor(() => page(`return !!$("aside[aria-label='Ana menü']") && document.readyState === "complete";`), 45000);
  await sleep(400);
};
const openPlannerTask = async (title) => {
  await nav("İçerik Planlayıcı");
  const sel = title ? `$$("table button").find((x) => x.textContent.trim() === ${JSON.stringify(title)})` : `$("table tbody tr")?.children[1]?.querySelector("button")`;
  await waitFor(() => page(`return !!${sel};`), 5000);
  await page(`${sel}.click(); return true;`);
  await waitFor(() => page(`return !!${drawer};`), 4000);
};

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: h.url });
  await waitFor(() => page(`return !!$("[data-ops-desk]");`), 45000);

  /* 1. Yeni Görev: birden fazla kişi ve platform */
  await page(`$("button[aria-label='Yeni Görev']").click(); return true;`);
  await waitFor(() => page(`return !!$("[data-chip-checks='assignees']");`), 3000);
  const form = await page(`return { labels: $$("[role='dialog'] [role='group']").map((g) => g.getAttribute("aria-label")),
    people: $$("[data-chip-checks='assignees'] [data-value]").map((b) => b.dataset.value), checkedPlatforms: $$("[data-chip-checks='platforms'] [aria-checked='true']").map((b) => b.dataset.value) };`);
  check("Formda Görevi Yapan ve Platform çoklu seçimli (etiket, yalnızca ekip, varsayılan Instagram)",
    form.labels.includes("Görevi Yapan (birden fazla seçilebilir)") && form.labels.includes("Platform (birden fazla seçilebilir)")
      && form.people.includes("u2") && form.people.includes("u3") && !form.people.some((id) => id.startsWith("c")) && JSON.stringify(form.checkedPlatforms) === '["Instagram"]', JSON.stringify(form));
  await page(`setValue(${field("Görev Başlığı")}, ${JSON.stringify(TITLE)}); setValue(${field("Marka")}, "b-tepe"); return true;`);
  await page(`${chip("platforms", "Instagram")} return true;`); await sleep(80);
  await page(`exact("button", "Görevi Oluştur").click(); return true;`); await sleep(200);
  const errs = await page(`return $("[role='dialog'][aria-label='Yeni Görev']")?.textContent || "";`);
  check("Kişi veya platform seçilmezse görev oluşturulmaz", errs.includes("Görevi yapacak en az bir kişi seçin.") && errs.includes("En az bir platform seçin."));
  await page(`${chip("assignees", "u2")} ${chip("assignees", "u3")} ${chip("platforms", "Instagram")} ${chip("platforms", "Facebook")} return true;`); await sleep(80);
  const picked = await page(`return { a: $$("[data-chip-checks='assignees'] [aria-checked='true']").map((b) => b.dataset.value), p: $$("[data-chip-checks='platforms'] [aria-checked='true']").map((b) => b.dataset.value) };`);
  check("İki kişi ve iki platform işaretlenir", JSON.stringify(picked) === JSON.stringify({ a: ["u2", "u3"], p: ["Instagram", "Facebook"] }), JSON.stringify(picked));
  await page(`exact("button", "Görevi Oluştur").click(); return true;`); await sleep(300);
  check("Görev oluşturulur", (await toasts()).includes("Görev oluşturuldu"), await toasts());

  /* 2. Tablo ve görev detayı */
  await openPlannerTask(TITLE);
  const row = await page(`const tr = $$("table tbody tr").find((r) => r.textContent.includes(${JSON.stringify(TITLE)}));
    return { people: tr.querySelector("[data-assignees]")?.dataset.assignees, platforms: tr.querySelector("[data-platforms]")?.dataset.platforms, text: tr.textContent };`);
  check("Tabloda iki kişi (A. Demir +1) ve iki platform görünür", row.people === "2" && row.platforms === "2" && row.text.includes("Demir +1"), JSON.stringify(row).slice(0, 200));
  await page(`$("button[aria-label='Görevi yapan seç']", ${drawer}).click(); return true;`);
  await waitFor(() => page(`return !!$("[data-cw-popover] [role='listbox']");`), 2000);
  const sel0 = await page(`return $$("[data-cw-popover] [role='option'][aria-selected='true']").map((o) => o.textContent.trim());`);
  await page(`$$("[data-cw-popover] [role='option']").find((o) => o.textContent.includes("Can Şahin")).click(); return true;`); await sleep(150);
  const stillOpen = await page(`return !!$("[data-cw-popover] [role='listbox'][aria-multiselectable='true']");`);
  await page(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return true;`); await sleep(200);
  const drawerPeople = await page(`return $("[data-assignees]", ${drawer})?.dataset.assignees;`);
  check("Detayda Görevi Yapan menüsü çoklu: 2 kişi seçili, 3. kişi eklenince menü açık kalır", sel0.length === 2 && stillOpen && drawerPeople === "3", JSON.stringify({ sel0, stillOpen, drawerPeople }));
  await page(`$("button[aria-label='Platform seç']", ${drawer}).click(); return true;`);
  await waitFor(() => page(`return !!$("[data-cw-popover] [role='listbox']");`), 2000);
  await page(`$$("[data-cw-popover] [role='option']").find((o) => o.textContent.includes("TikTok")).click(); return true;`); await sleep(150);
  await page(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return true;`); await sleep(200);
  check("Detayda platform eklenir (3 platform)", (await page(`return $("[data-platforms]", ${drawer})?.dataset.platforms;`)) === "3");
  await page(`$("button[aria-label='Detayı kapat']")?.click(); return true;`); await sleep(300);

  /* 3. Bildirimler ve görünürlük: seçilen tüm kişiler */
  for (const [id, name] of [["u2", "Ayşe"], ["u3", "Burak"], ["u4", "Can (sonradan eklenen)"]]) {
    await role("employee", id);
    const box = await inbox();
    check(`Bildirim ${name}'a gider (“size atadı”)`, box.includes(`“${TITLE}” görevini size atadı`));
    await nav("Bugünkü İşlerim"); await sleep(200);
    await page(`setValue($("input[aria-label='Genel arama']"), ${JSON.stringify(TITLE.slice(0, 14))}); return true;`); await sleep(300);
    check(`${name} görevi kendi listesinde görür`, await page(`return $("main").textContent.includes(${JSON.stringify(TITLE)});`));
    await page(`setValue($("input[aria-label='Genel arama']"), ""); return true;`);
  }
  await role("employee", "u5");
  check("Atanmayan çalışan (Selin) bildirimi almaz", !(await inbox()).includes(`“${TITLE}”`));
  await role("admin", "u1");
  await sleep(300);

  /* 4. Süzgeç: ikinci kişiye göre */
  await nav("İçerik Planlayıcı"); await sleep(200);
  await page(`setValue($("select[aria-label='Görevi Yapan']"), "u3"); return true;`); await sleep(300);
  check("Görevi Yapan süzgeci ikinci kişiyle de görevi bulur", await page(`return !!$$("table tbody tr").find((r) => r.textContent.includes(${JSON.stringify(TITLE)}));`));
  await page(`setValue($("select[aria-label='Görevi Yapan']"), "all"); return true;`); await sleep(200);

  /* 5. Sayfa yenileme (Ctrl+R): kalınan ekran korunur */
  await openPlannerTask(null);
  const opened = await page(`return $("aside[aria-label='Görev detayı'] input, aside[aria-label='Görev detayı'] textarea")?.value || "";`);
  const p1 = await params();
  check("Görev detayı açıkken adreste ?gorev ve ?sekme var (demo parametresi korunur)", !!p1.gorev && p1.sekme === "table" && "demo" in p1, JSON.stringify(p1));
  await reload();
  const after = await waitFor(() => page(`const d = $("aside[aria-label='Görev detayı']"); return d ? (d.querySelector("input, textarea")?.value || "?") : null;`), 8000).catch(() => null);
  check("Yenilemeden sonra aynı görev detayı açık", !!after && after === opened, JSON.stringify({ opened, after }));
  check("Yenilemeden sonra İçerik Planlayıcı sekmesi açık", await page(`return !!$("table tbody tr");`));
  await page(`$("button[aria-label='Detayı kapat']")?.click(); return true;`); await sleep(300);
  check("Detay kapanınca ?gorev adresten kalkar", !(await params()).gorev);

  await nav("Sosyal Medya Planı");
  await waitFor(() => page(`return !!$("[data-social-plan]");`), 4000);
  await reload();
  check("Yenilemeden sonra Sosyal Medya Planı açık (?sayfa=social)", await waitFor(() => page(`return !!$("[data-social-plan]");`), 8000).then(() => true, () => false), JSON.stringify(await params()));

  await nav("Genel Bakış"); await sleep(300);
  await page(`$("button[aria-label='Toplu Görev Ekle']").click(); return true;`);
  await waitFor(() => page(`return !!$("[data-bulk-sheet]");`), 3000);
  await reload();
  check("Yenilemeden sonra Toplu Görev Ekle açık (?toplu=1)", await waitFor(() => page(`return !!$("[data-bulk-sheet]");`), 8000).then(() => true, () => false));
  await nav("Genel Bakış"); await sleep(300);
  check("Menüden çıkınca ?toplu adresten kalkar", !(await params()).toplu && !(await page(`return !!$("[data-bulk-sheet]");`)));

  await page(`$$("aside button[aria-pressed]").find((b) => b.textContent.includes("Tepe Emlak")).click(); return true;`); await sleep(300);
  await reload();
  check("Yenilemeden sonra seçili marka korunur", await page(`return !!$$("aside button[aria-pressed='true']").find((b) => b.textContent.includes("Tepe Emlak"));`), JSON.stringify(await params()));

  await send("Page.navigate", { url: `${h.url}&sayfa=users&gorev=yok-boyle-gorev` });
  await waitFor(() => page(`return !!$("aside[aria-label='Ana menü']");`), 45000); await sleep(400);
  check("Geçersiz görev kimliği yok sayılır, sayfa açılır", !(await page(`return !!$("aside[aria-label='Görev detayı']");`)) && !(await params()).gorev);
  await role("employee", "u2"); await sleep(300);
  check("Çalışan yetkisiz sayfada kalmaz (?sayfa=users → kendi ana sayfası)", !(await page(`return $("main").textContent.includes("Kullanıcılar & Yetkiler");`)) && (await params()).sayfa !== "users", JSON.stringify(await params()));

  await sleep(200);
  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check("Beklenmeyen hata", false, err.message);
} finally {
  await h.close();
}
