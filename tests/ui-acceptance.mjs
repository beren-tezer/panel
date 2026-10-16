// Tarayıcı kabul testleri (demo verisiyle, gerçek arayüz etkileşimleri).
//   npm run test:ui      → Vite geliştirme sunucusunu ve başsız Edge/Chrome'u kendisi başlatır.
// Node 20: global WebSocket için --experimental-websocket gerekir (package.json betiğinde var).
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

const PORT = 5179, DEBUG_PORT = 9333;
const BROWSERS = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].filter(Boolean);

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 15000, step = 100) {
  const end = Date.now() + timeout;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* tekrar dene */ }
    if (Date.now() > end) throw new Error("zaman aşımı");
    await sleep(step);
  }
}

const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const profile = mkdtempSync(join(tmpdir(), "cw-ui-"));
const exe = BROWSERS.find((p) => existsSync(p));
if (!exe) throw new Error("Edge/Chrome bulunamadı (BROWSER ortam değişkeniyle yol verin).");
const browser = spawn(exe, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });

let ws, seq = 0;
const pending = new Map();
const consoleProblems = [];
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function js(expr) {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function viewport(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  await sleep(400);
}
async function mouseTo(x, y) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); }
async function tap(x, y) {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/* Sayfa içi yardımcılar: React kontrollü alanlara değer yazma, metne göre öğe bulma. */
const HELPERS = `
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const byText = (sel, text, r = document) => $$(sel, r).find((el) => el.textContent.trim().includes(text));
  const setValue = (el, v) => {
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  };
  const rowByTitle = (t) => $$("[data-task-row]").find((r) => r.querySelector("button").textContent.trim() === t);
  const card = (name) => $$("[data-brand-card]").find((c) => c.querySelector("h3").textContent.trim() === name);
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; };
`;
const page = (body) => js(HELPERS + body);
// Kartları açar ("Diğerlerini Göster"): tüm görev satırları görünür olur.
const expandAll = () => page(`$$("[data-card-toggle][aria-expanded='false']").forEach((b) => b.click()); await new Promise((r) => setTimeout(r, 400)); return true;`);

try {
  await waitFor(() => fetch(`http://localhost:${PORT}/`).then((r) => r.ok));
  const target = await waitFor(() => fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json()));
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); return; }
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(msg.params.type)) {
      consoleProblems.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
    }
    if (msg.method === "Runtime.exceptionThrown") consoleProblems.push(msg.params.exceptionDetails.exception?.description?.slice(0, 300) || "exception");
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__CW_ALL_BRANDS__ = true;" });
  await viewport(1920, 1080);
  await send("Page.navigate", { url: `http://localhost:${PORT}/?demo` });
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`));

  /* ── 0. Kart kuralı: varsayılan 1 görev + "Diğerlerini Göster"; açılınca kart aşağı doğru açılır, içeride kayar ── */
  const collapsed = await page(`const cs = $$("[data-brand-card]"); return {
    maxRows: Math.max(...cs.map((c) => c.querySelectorAll("[data-task-row]").length)),
    heights: [...new Set(cs.map((c) => Math.round(rect(c).h)))],
    toggle: card("Sofra Pide").querySelector("[data-card-toggle]")?.textContent.trim(),
    total: card("Sofra Pide").querySelector("p").textContent };`);
  const spaTotal = Number((collapsed.total.match(/(\d+) görev/) || [])[1]);
  check("Kartlarda varsayılan en fazla 1 görev; tüm kartlar aynı yükseklikte", collapsed.maxRows === 1 && collapsed.heights.length === 1, JSON.stringify(collapsed));
  check("“Diğerlerini Göster (N)” kalan görev sayısını gösterir", collapsed.toggle === `Diğerlerini Göster (${spaTotal - 1})`, collapsed.toggle);
  const cardOpen = await page(`const c = card("Sofra Pide"), other = card("Tepe Emlak"), h0 = rect(other).h;
    c.querySelector("[data-card-toggle]").click(); await new Promise((r) => setTimeout(r, 400));
    const list = c.querySelector("[data-card-tasks]");
    return { rows: c.querySelectorAll("[data-task-row]").length, h: Math.round(rect(c).h), otherSame: Math.abs(rect(other).h - h0) < 1, scroll: list.scrollHeight > list.clientHeight,
      label: c.querySelector("[data-card-toggle]").textContent.trim(), expanded: c.querySelector("[data-card-toggle]").getAttribute("aria-expanded") };`);
  check("Açılınca tüm görevler kart içinde kayar; kart sınırlı (420px) açılır, komşu kartlar değişmez",
    cardOpen.rows === spaTotal && cardOpen.h === 420 && cardOpen.otherSame && cardOpen.scroll && cardOpen.expanded === "true" && cardOpen.label === "Daha Az Göster", JSON.stringify(cardOpen));
  const closed = await page(`const c = card("Sofra Pide"); c.querySelector("[data-card-toggle]").click(); await new Promise((r) => setTimeout(r, 400));
    return { rows: c.querySelectorAll("[data-task-row]").length, h: Math.round(rect(c).h) };`);
  check("“Daha Az Göster” kartı tekrar 1 göreve indirir", closed.rows === 1 && closed.h === collapsed.heights[0], JSON.stringify(closed));
  // Aşağıdaki kontroller (eski davranış: kartın tüm görevleri) için kartlar açılır.
  await expandAll();

  /* ── Kurulum: Atlas Ajans kartında 2, Sofra Pide kartında 25 görev ── */
  const before = await page(`return { cre: card("Atlas Ajans").querySelectorAll("[data-task-row]").length, spa: card("Sofra Pide").querySelectorAll("[data-task-row]").length };`);
  // Atlas Ajans'tan bir görev arayüzden silinir (sil düğmesi → onay)
  await page(`card("Atlas Ajans").querySelector("[data-task-row] button[aria-label$='görevini sil']").click();`);
  await waitFor(() => page(`return !!$("[data-cw-modal] button.bg-red-600");`));
  await page(`$("[data-cw-modal] button.bg-red-600").click();`);
  await waitFor(() => page(`return card("Atlas Ajans").querySelectorAll("[data-task-row]").length === ${before.cre - 1};`));
  // Sofra Pide'ya tablo hızlı ekleme ile görev eklenir
  // Yönetici Dashboard'u: İçerik Planlayıcı (hızlı ekleme) Günlük Operasyon Akışı ile aynı sayfada; sekme yok.
  await waitFor(() => page(`return !!$("input[aria-label='Yeni görev adı']");`));
  const toAdd = 25 - before.spa;
  for (let i = 1; i <= toAdd; i++) {
    await page(`
      const sel = $("select[aria-label='Yeni görev markası']");
      const opt = [...sel.options].find((o) => o.textContent === "Sofra Pide"); setValue(sel, opt.value);
      const inp = $("input[aria-label='Yeni görev adı']"); setValue(inp, "Test görevi ${i}");
    `);
    await page(`byText("button", "Ekle", $("input[aria-label='Yeni görev adı']").closest("tr")).click();`);
  }
  await waitFor(() => page(`return $$("[data-card-toggle]").length > 0;`));
  await expandAll();
  await waitFor(() => page(`return card("Sofra Pide") && card("Sofra Pide").querySelectorAll("[data-task-row]").length === 25;`));
  const counts = await page(`return { cre: card("Atlas Ajans").querySelectorAll("[data-task-row]").length, spa: card("Sofra Pide").querySelectorAll("[data-task-row]").length };`);
  check("Kurulum: 2 ve 25 görevli kartlar", counts.cre === 2 && counts.spa === 25, JSON.stringify(counts));

  /* ── 1. Eşit kart ölçüleri ve iç kaydırma ── */
  // Açılma animasyonu (0,2 sn) bitene kadar beklenir; kartlar kendiliğinden kapanırsa bu bekleme başarısız olur.
  const settled = await waitFor(() => page(`const cs = $$("[data-brand-card]").filter((c) => c.querySelector("[data-card-toggle]"));
    return cs.every((c) => c.dataset.expanded === "true" && Math.round(rect(c).h) === 420) ? true : null;`), 3000).catch(() => false);
  if (!settled) console.log("   kart durumu:", await page(`return JSON.stringify($$("[data-brand-card]").map((c) => [c.dataset.expanded, Math.round(rect(c).h)]));`));
  const dims = await page(`const a = rect(card("Atlas Ajans")), b = rect(card("Sofra Pide")); const all = $$("[data-brand-card]").map(rect); return { a, b, heights: [...new Set(all.map((r) => Math.round(r.h)))], widths: [...new Set(all.map((r) => Math.round(r.w)))] };`);
  check("2 ve 25 görevli kart aynı dış ölçüde", Math.round(dims.a.w) === Math.round(dims.b.w) && Math.round(dims.a.h) === Math.round(dims.b.h), `${Math.round(dims.a.w)}×${Math.round(dims.a.h)} / ${Math.round(dims.b.w)}×${Math.round(dims.b.h)}`);
  check("Tüm kartlar aynı yükseklik ve genişlikte", dims.heights.length === 1 && dims.widths.length === 1, `yükseklik ${dims.heights} genişlik ${dims.widths}`);
  const scroll = await page(`
    const c = card("Sofra Pide"), list = c.querySelector("[data-card-tasks]");
    const h0 = rect(c.querySelector("[data-card-header]")).y, f0 = rect(c.querySelector("[data-card-footer]")).y, ch0 = rect(c).h;
    list.scrollTop = list.scrollHeight; await new Promise((r) => setTimeout(r, 100));
    const res = { scrollable: list.scrollHeight > list.clientHeight + 10, scrolled: list.scrollTop > 0, headerSame: Math.abs(rect(c.querySelector("[data-card-header]")).y - h0) < 1,
      footerSame: Math.abs(rect(c.querySelector("[data-card-footer]")).y - f0) < 1, heightSame: Math.abs(rect(c).h - ch0) < 1,
      footerInside: rect(c.querySelector("[data-card-footer]")).y + rect(c.querySelector("[data-card-footer]")).h <= rect(c).y + rect(c).h + 1 };
    list.scrollTop = 0; return res;`);
  check("25 görevli kart kendi içinde kayar, büyümez", scroll.scrollable && scroll.scrolled && scroll.heightSame, JSON.stringify(scroll));
  check("Başlık ve alt bilgi kaydırırken sabit kalır", scroll.headerSame && scroll.footerSame && scroll.footerInside);

  /* ── 2. Ek göstergeleri ── */
  const att = await page(`
    const rows = $$("[data-task-row]", card("Sofra Pide"));
    const test = rows.filter((r) => r.textContent.includes("Test görevi"));
    const withAtt = rows.filter((r) => r.querySelector("button[aria-label*='ek dosya']"));
    return { testWithIcon: test.filter((r) => r.querySelector("button[aria-label*='ek dosya']")).length, testCount: test.length, withAtt: withAtt.length,
      labels: withAtt.map((r) => r.querySelector("button[aria-label*='ek dosya']").getAttribute("aria-label")).slice(0, 3) };`);
  check("Eki olmayan görevde ek simgesi yok", att.testCount > 0 && att.testWithIcon === 0, `${att.testCount} yeni görev`);
  check("Eki olan görevde simge ve sayı var", att.withAtt > 0, att.labels.join(" | "));

  // Masaüstü hover önizleme: gerçek fare hareketiyle
  const trig = await page(`const b = card("Sofra Pide").querySelector("button[aria-label*='ek dosya']"); b.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 150)); const n = parseInt(b.textContent, 10); return { ...rect(b), n };`);
  await mouseTo(trig.cx, trig.cy);
  const pop = await waitFor(() => page(`const p = $("[data-cw-popover][aria-label='Görev ekleri']"); if (!p || getComputedStyle(p).visibility !== "visible") return null;
    const r = rect(p); return { r, inBody: p.parentElement === document.body, items: $$("li", p).length, vw: innerWidth, vh: innerHeight };`), 4000);
  check("Hover ile önizleme açılır ve gerçek ek sayısını listeler", pop.items === trig.n, `${pop.items} öğe / sayaç ${trig.n}`);
  check("Önizleme body'ye portallanır, ekranda kalır (kırpılmaz)", pop.inBody && pop.r.x >= 0 && pop.r.y >= 0 && pop.r.x + pop.r.w <= pop.vw && pop.r.y + pop.r.h <= pop.vh);
  // Önizlemeden dosya görüntüleyiciye
  await page(`$("[data-cw-popover][aria-label='Görev ekleri'] li button").click();`);
  const viewer = await waitFor(() => page(`const m = byText("[data-cw-modal]", "Görev eki"); return m ? m.textContent.includes("Drive'da Aç") : null;`), 4000).catch(() => false);
  check("Eke tıklayınca dosya görüntüleyici açılır", viewer);
  await page(`$("[data-cw-modal] button[aria-label='Kapat']").click();`);
  await waitFor(() => page(`return !$("[data-cw-modal]");`), 4000);
  await mouseTo(5, 5);
  await waitFor(() => page(`return !$("[data-cw-popover][aria-label='Görev ekleri']");`), 4000).catch(() => {});

  // Kaydırma sırasında: tetikleyici liste dışına çıkınca katman gizlenir
  const clip = await page(`
    const c = card("Sofra Pide"), list = c.querySelector("[data-card-tasks]");
    list.scrollTop = 0; await new Promise((r) => setTimeout(r, 50));
    const b = c.querySelector("button[aria-label*='ek dosya']"); b.click(); await new Promise((r) => setTimeout(r, 200));
    const p = $("[data-cw-popover][aria-label='Görev ekleri']"); const visibleBefore = p && getComputedStyle(p).visibility === "visible";
    list.scrollTop = list.scrollHeight; list.dispatchEvent(new Event("scroll")); await new Promise((r) => setTimeout(r, 200));
    const p2 = $("[data-cw-popover][aria-label='Görev ekleri']"); const hiddenAfter = !p2 || getComputedStyle(p2).visibility === "hidden";
    list.scrollTop = 0; await new Promise((r) => setTimeout(r, 100));
    const p3 = $("[data-cw-popover][aria-label='Görev ekleri']"); const back = p3 && getComputedStyle(p3).visibility === "visible";
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return { visibleBefore, hiddenAfter, back };`);
  check("Kaydırırken önizleme tetikleyiciyle birlikte gizlenir/geri gelir", clip.visibleBefore && clip.hiddenAfter && clip.back, JSON.stringify(clip));

  /* ── 3. Yorum ve revize göstergeleri ── */
  const fb = await page(`
    const row = (title) => $$("[data-task-row]").find((r) => r.textContent.includes(title));
    const t1 = rowByTitle("Test görevi 1");
    return { noComment: !t1.querySelector("button[aria-label*='yorum,']"),
      requested: !!row("Konut kredisi bilgilendirme")?.querySelector("button[aria-label^='Revize istendi']"),
      inProgress: !!row("Ekim kampanya görselleri")?.querySelector("button[aria-label^='Revizyonda']"),
      resolvedHidden: !row("Medikal cilt bakımı Reels")?.querySelector("button[aria-label^='Revize']") };`);
  check("Yorumu olmayan görevde yorum simgesi yok", fb.noComment);
  check("Bekleyen revizeler ayırt edilir (istendi / revizyonda)", fb.requested && fb.inProgress, JSON.stringify(fb));
  await page(`rowByTitle("Test görevi 1").querySelector("button").click();`);
  await waitFor(() => page(`return !!$("textarea[aria-label='Yorum yaz']");`));
  await page(`setValue($("textarea[aria-label='Yorum yaz']"), "Kabul testi yorumu");`);
  await page(`$$("button", $("aside[aria-label='Görev detayı']")).find((b) => b.textContent.trim() === "Gönder").click();`);
  await page(`$("button[aria-label='Detayı kapat']").click();`);
  const commentAfter = await waitFor(() => page(`const r = rowByTitle("Test görevi 1"); const b = r && r.querySelector("button[aria-label*='yorum,']"); return b ? b.getAttribute("aria-label") : null;`), 4000).catch(() => null);
  check("Yorum eklenince sayaç hemen güncellenir", commentAfter && commentAfter.startsWith("1 yorum"), commentAfter || "simge yok");
  // Yorum simgesi yorum bölümünü açar
  await page(`rowByTitle("Test görevi 1").querySelector("button[aria-label*='yorum,']").click();`);
  const opened = await waitFor(() => page(`const a = $("aside[aria-label='Görev detayı']"); return a && document.activeElement === $("textarea[aria-label='Yorum yaz']") ? true : null;`), 4000).catch(() => false);
  check("Yorum simgesi görevin yorum bölümünü açar", opened);
  await page(`$("button[aria-label='Detayı kapat']").click();`);

  /* ── 4. Teslim zamanı ── */
  const dl = await page(`
    const rows = $$("[data-task-row]");
    const doneRows = rows.filter((r) => /Tamamlandı|Onaylandı/.test(r.querySelector("button[aria-label^='Durum']")?.textContent || r.textContent));
    return { overdue: $$("[data-deadline='overdue']").map((e) => e.textContent).slice(0, 3), anyOverdue: $$("[data-task-row] [data-deadline='overdue']").length,
      falseOverdue: doneRows.filter((r) => r.querySelector("[data-deadline='overdue']")).length, doneLabels: doneRows.filter((r) => r.querySelector("[data-deadline='done']")).length, done: doneRows.length,
      timed: $$("[data-deadline='soon'], [data-deadline='upcoming']").map((e) => e.textContent.replace("Son teslim: ", "")).filter((t) => /^(Bugün|Yarın|\\d{1,2} \\S+), \\d{2}:\\d{2}$/.test(t)).slice(0, 3) };`);
  check("Gecikmiş görevler 'Gecikti · …' olarak işaretlenir", dl.anyOverdue > 0 && dl.overdue.every((t) => t.includes("Gecikti")), dl.overdue.join(" | "));
  check("Tamamlanan görevler gecikmiş görünmez", dl.done > 0 && dl.falseOverdue === 0 && dl.doneLabels === dl.done, `${dl.done} teslim edilmiş görev`);
  check("Yaklaşan teslimler gün + saatle gösterilir", dl.timed.length > 0, dl.timed.join(" | "));

  /* ── 5. Duyarlı ızgara ve taşma ── */
  for (const [w, h, cols, mobile] of [[1920, 1080, 3], [1440, 900, 2], [1024, 768, 2], [768, 1024, 2], [430, 932, 1, true], [375, 812, 1, true]]) {
    await viewport(w, h, mobile);
    const g = await page(`const cs = $$("[data-brand-card]").map(rect); return { cols: new Set(cs.map((r) => Math.round(r.x))).size, overflow: document.documentElement.scrollWidth - innerWidth,
      rowOverflow: $$("[data-task-row]").filter((r) => r.scrollWidth > r.clientWidth + 1).length, heights: new Set(cs.map((r) => Math.round(r.h))).size };`);
    if (process.env.SCREENSHOT_DIR) {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(process.env.SCREENSHOT_DIR, `cw-${w}.png`), Buffer.from(shot.data, "base64"));
    }
    check(`${w}px: ${cols} sütun, yatay taşma yok`, g.cols === cols && g.overflow <= 0 && g.rowOverflow === 0 && g.heights === 1, JSON.stringify(g));
  }

  /* ── 6. Mobilde dokunarak önizleme ── */
  await viewport(390, 844, true);
  const mt = await page(`const b = card("Sofra Pide").querySelector("button[aria-label*='ek dosya']"); b.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 200)); return rect(b);`);
  await tap(mt.cx, mt.cy);
  const sheet = await waitFor(() => page(`const d = $("[role='dialog'][aria-label='Görev ekleri']"); if (!d) return null; const r = rect(d); return { fits: r.x >= 0 && r.x + r.w <= innerWidth + 1 && r.y >= 0, items: $$("li", d).length };`), 4000).catch(() => null);
  check("Mobilde dokununca önizleme paneli açılır", sheet && sheet.fits && sheet.items > 0, JSON.stringify(sheet));
  await page(`const d = $("[role='dialog'][aria-label='Görev ekleri']"); byText("button", "Kapat", d).click();`);
  await waitFor(() => page(`return !$("[role='dialog'][aria-label='Görev ekleri']");`), 3000);
  check("Mobil önizleme paneli kapanır", true);

  /* ── 7. Rol kısıtları: müşteri ekip içi eki göremez ── */
  await viewport(1440, 900);
  await page(`setValue($("select[aria-label='Rol']"), "client");`);
  await waitFor(() => page(`return byText("h1, h2", "Genel Bakış") && !$("[data-brand-card]");`), 5000).catch(() => {});
  const cl = await page(`return { internalHidden: !document.body.textContent.includes("Brief Dokümanı.pdf"), noComments: !$("button[aria-label*='yorum,']"), noOps: !$("[data-brand-card]") };`);
  const content = await page(`const b = $$("button").find((x) => x.textContent.includes("Kira artış oranı")); if (!b) return null; b.click(); await new Promise((r) => setTimeout(r, 300)); const m = $("[data-cw-modal]"); return m ? { files: m.textContent.includes("İlgili Dosyalar"), brief: m.textContent.includes("Brief Dokümanı.pdf") } : null;`);
  check("Müşteri ekip içi eki ve iç yorumları görmez", cl.internalHidden && cl.noComments && cl.noOps && content && content.files && !content.brief, JSON.stringify({ ...cl, content }));
  await page(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));`);
  await page(`setValue($("select[aria-label='Rol']"), "admin");`);
  await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`), 5000);
  check("Rol değiştirici admin paneline geri döner", true);

  /* ── 7b. Dashboard: Günlük Operasyon Akışı yalnızca bugünün görevleri (tüm görevler İçerik Planlayıcıda) ── */
  await page(`window.__CW_ALL_BRANDS__ = false; byText("aside button", "Genel Bakış").click(); return true;`);
  const sectionCount = (id) => `+$("[data-dashboard-section='${id}'] [data-section-count]").dataset.sectionCount`;
  const dash = await waitFor(() => page(`const d = ${sectionCount("cw-daily")}, p = ${sectionCount("cw-planner")};
    const rows = $$("[data-dashboard-section='cw-daily'] [data-task-row]").length;
    return p > 0 && d < p ? { daily: d, planner: p, charts: !!$("[data-ops-desk]"), outside: $$("[data-brand-card]").filter((c) => !c.closest("[data-dashboard-section='cw-daily']")).length, rows } : null;`), 5000).catch(() => null);
  check("Dashboard'da Günlük Akış yalnızca bugünün görevleri (ana sayfa tüm kartları yüklemez), grafikler üstte", dash && dash.charts && dash.outside === 0, JSON.stringify(dash));
  await page(`$$("aside button[aria-pressed]").find((b) => b.textContent.includes("Sofra Pide")).click(); return true;`);
  const one = await waitFor(() => page(`const cs = $$("[data-brand-card]"); return cs.length <= 1 && cs.every((c) => c.querySelector("h3").textContent.trim() === "Sofra Pide") && ${sectionCount("cw-planner")} < ${dash?.planner || 0};`), 5000).catch(() => false);
  check("Marka seçilince tüm bölümler yalnızca o markayı gösterir", one);
  await page(`byText("aside button", "Tüm Markalar").click(); return true;`);
  check("Tüm Markalar'a dönünce sayılar eski hâline döner", await waitFor(() => page(`return ${sectionCount("cw-daily")} === ${dash?.daily ?? -1} && ${sectionCount("cw-planner")} === ${dash?.planner ?? -1};`), 5000).catch(() => false));
  await page(`setValue($("input[aria-label='Genel arama']"), "Sofra Pide");`);
  check("Arama yapılınca sonuç kartları listelenir", await waitFor(() => page(`return $$("[data-brand-card]").length > 0;`), 5000).catch(() => false));
  await page(`setValue($("input[aria-label='Genel arama']"), ""); window.__CW_ALL_BRANDS__ = true; return true;`);
  check("Mobilde inputa dokununca yakınlaştırma kapalı (viewport maximum-scale=1)", await page(`return /maximum-scale=1/.test($("meta[name='viewport']").content);`));

  /* ── 8. Konsol ── */
  await sleep(300);
  check("Konsolda hata / React uyarısı yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check("Test akışı tamamlandı", false, err.stack || String(err));
} finally {
  try { ws?.close(); } catch { /* yok say */ }
  browser.kill(); vite.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* tarayıcı kilidi */ }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti.`);
  process.exit(failed.length ? 1 : 0);
}
