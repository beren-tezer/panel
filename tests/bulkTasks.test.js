import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPaste, carryFrom, cellText, clearCell, detectHeader, draftKey, duplicateRow, isEmptyRow, loadDraft, newRow, parseDate, parseTSV, parseTable,
  parseTime, resolveBrand, resolveFormat, resolveUser, saveDraft, setCell, setValue, toTask, validateSheet,
} from "../bulkTasks.js";

const TODAY = "2026-10-10";
const brands = [{ id: "b1", name: "Tepe Emlak", initials: "TE" }, { id: "b2", name: "Sofra Pide", initials: "SP" }, { id: "b3", name: "Velia Clinic", initials: "VC" }];
const users = [{ id: "u2", name: "Ayşe Demir", email: "ayse@example.com" }, { id: "u3", name: "Burak Yılmaz", email: "burak@example.com" }];
const ctx = { brands, users, today: TODAY };

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test("satır kimlikleri benzersiz ve kalıcı; çoğaltma yeni kimlik verir", () => {
  const a = newRow();
  const b = duplicateRow({ ...a, title: "x" });
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.taskId, b.taskId);
  assert.equal(b.title, "x");
  assert.equal(b.saved, null);
});

test("önceki satırdan taşıma: marka, platform, format, kişi — başlık hariç", () => {
  const prev = { ...newRow(), brandId: "b1", title: "Başlık", format: "Reels", platform: "TikTok", assigneeId: "u2" };
  const r = newRow(carryFrom(prev));
  assert.deepEqual([r.brandId, r.format, r.platform, r.assigneeId, r.title], ["b1", "Reels", "TikTok", "u2", ""]);
  assert.ok(isEmptyRow(r), "yalnızca taşınan değerleri olan satır boş sayılır");
});

test("eşleştirme: marka, kişi, format, platform", () => {
  assert.deepEqual(resolveBrand("tepe emlak", brands), { value: "b1" });
  assert.deepEqual(resolveBrand("TE", brands), { value: "b1" });
  assert.deepEqual(resolveBrand("sofr", brands), { value: "b2" });
  assert.deepEqual(resolveBrand("Bilinmeyen", brands), { bad: "Bilinmeyen" });
  assert.deepEqual(resolveUser("ayse demir", users), { value: "u2" });
  assert.deepEqual(resolveUser("Burak", users), { value: "u3" });
  assert.deepEqual(resolveUser("burak@example.com", users), { value: "u3" });
  assert.deepEqual(resolveUser("Mehmet", users), { bad: "Mehmet" });
  assert.deepEqual(resolveFormat("Post"), { value: "Gönderi" });
  assert.deepEqual(resolveFormat("story"), { value: "Hikâye" });
  assert.deepEqual(resolveFormat("Carousel"), { value: "Karusel" });
  assert.deepEqual(resolveFormat("Diğer"), { bad: "Diğer" });
});

test("tarih ve saat ayrıştırma", () => {
  assert.equal(parseDate("12.11.2026", TODAY).value, "2026-11-12");
  assert.equal(parseDate("12/11/26", TODAY).value, "2026-11-12");
  assert.equal(parseDate("2026-11-12", TODAY).value, "2026-11-12");
  assert.equal(parseDate("5.1", TODAY).value, "2026-01-05");
  assert.equal(parseDate("12 Kasım", TODAY).value, "2026-11-12");
  assert.equal(parseDate("yarın", TODAY).value, "2026-10-11");
  assert.equal(parseDate("46338", TODAY).value, "2026-11-12", "Excel seri numarası");
  assert.equal(parseDate("31.02.2026", TODAY).bad, "31.02.2026");
  assert.equal(parseDate("pazartesi", TODAY).bad, "pazartesi");
  assert.equal(parseTime("16:30").value, "16:30");
  assert.equal(parseTime("9.05").value, "09:05");
  assert.equal(parseTime("1630").value, "16:30");
  assert.equal(parseTime("16").value, "16:00");
  assert.equal(parseTime("25:00").bad, "25:00");
});

test("hücre yazma: eşleşmeyen değer saklanır ve hata olarak gösterilir; seçimle düzelir", () => {
  let r = setCell(newRow(), "brand", "Yok Marka", ctx);
  assert.equal(r.brandId, "");
  assert.equal(cellText(r, "brand", ctx), "Yok Marka");
  r = setCell(r, "title", "Satır\nsonu ile", ctx);
  assert.equal(r.title, "Satır sonu ile");
  let v = validateSheet([r], ctx);
  assert.match(v.errors[r.id].brand, /Marka bulunamadı/);
  r = setValue(r, "brand", "b2");
  assert.equal(cellText(r, "brand", ctx), "Sofra Pide");
  r = clearCell(setCell(r, "format", "Diğer", ctx), "format");
  assert.equal(r.format, "Gönderi");
});

test("doğrulama: boş satırlar atlanır, eksikler satır numarasıyla bildirilir, yetkisiz marka/kişi reddedilir", () => {
  const ok = { ...newRow(), brandId: "b1", title: "Reels", dueDate: "2026-10-12" };
  const noTitle = { ...newRow(), brandId: "b1", dueDate: "2026-10-12" };
  const empty = newRow({ brandId: "b1" });
  const foreign = { ...newRow(), brandId: "bX", title: "x", dueDate: "2026-10-12", assigneeId: "c1" };
  const badTime = setCell({ ...ok, id: "t" }, "dueTime", "99:99", ctx);
  const v = validateSheet([ok, empty, noTitle, foreign, badTime], ctx);
  assert.deepEqual([v.total, v.ready, v.invalid, v.empty, v.saved], [5, 1, 3, 1, 0]);
  assert.ok(v.messages.some((m) => m.text === "3. satır: Teslim tarihi girilmedi." || m.text === "3. satır: Görev başlığı boş bırakılamaz."));
  assert.equal(v.messages.find((m) => m.rowId === noTitle.id && m.col === "title").text, "3. satır: Görev başlığı boş bırakılamaz.");
  assert.equal(v.errors[foreign.id].brand, "Bu markaya görev ekleme yetkiniz yok.");
  assert.equal(v.errors[foreign.id].assignee, "Bu kişiye görev atanamaz.");
  assert.match(v.errors[badTime.id].dueTime, /okunamadı/);
  assert.equal(validateSheet([{ ...ok, saved: { code: "CW-1" } }], ctx).saved, 1);
});

test("TSV ayrıştırma: Excel tırnaklı hücreler, satır sonları, sondaki boş satır", () => {
  assert.deepEqual(parseTSV("a\tb\r\nc\td\r\n"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(parseTSV('"çok\nsatırlı"\t"tırnak ""x"""\nz\t'), [["çok\nsatırlı", 'tırnak "x"'], ["z", ""]]);
  assert.deepEqual(parseTable("| Marka | Görev |\n|---|---|\n| TE | Reels |"), [["Marka", "Görev"], ["TE", "Reels"]]);
  assert.deepEqual(parseTable("TE;Reels;Instagram"), [["TE", "Reels", "Instagram"]]);
});

test("başlık algılama", () => {
  assert.deepEqual(detectHeader(["Marka", "Görev Başlığı", "Teslim Tarihi", "Atanan Kişi"]), ["brand", "title", "dueDate", "assignee"]);
  assert.equal(detectHeader(["Tepe Emlak", "Reels videosu"]), null);
});

test("Excel'den 20 satır yapıştırma: satırlar oluşur, eşleşmeyenler işaretlenir", () => {
  const lines = ["Marka\tGörev\tFormat\tTeslim Tarihi\tSaat\tSorumlu"];
  for (let i = 1; i <= 20; i++) lines.push(`${i === 7 ? "Olmayan Marka" : i % 2 ? "Tepe Emlak" : "Sofra Pide"}\tİçerik ${i}\t${i % 3 ? "Reels" : "Post"}\t${i === 9 ? "32.13.2026" : `${10 + (i % 15)}.11.2026`}\t16:30\t${i === 4 ? "Kimse" : "Ayşe"}`);
  const start = [newRow()];
  const res = applyPaste(start, { row: 0, col: "brand" }, parseTSV(lines.join("\n")), ctx);
  assert.equal(res.rows.length, 20);
  assert.equal(res.added, 19);
  const v = validateSheet(res.rows, ctx);
  assert.equal(v.ready, 17);
  assert.equal(v.invalid, 3);
  assert.equal(res.rows[0].format, "Reels");
  assert.equal(res.rows[2].format, "Gönderi");
  assert.equal(res.rows[0].dueTime, "16:30");
  assert.equal(res.rows[0].assigneeId, "u2");
  assert.match(v.errors[res.rows[6].id].brand, /Olmayan Marka/);
  assert.match(v.errors[res.rows[8].id].dueDate, /32\.13\.2026/);
  assert.match(v.errors[res.rows[3].id].assignee, /Kimse/);
});

test("başlıksız yapıştırma seçili sütundan başlar; kaydedilmiş satırların üzerine yazılmaz", () => {
  const saved = { ...newRow(), title: "Kayıtlı", saved: { code: "CW-1" } };
  const rows = [saved, newRow()];
  const res = applyPaste(rows, { row: 0, col: "title" }, [["Yeni A", "TikTok"], ["Yeni B", "YouTube"]], ctx);
  assert.equal(res.rows[0].title, "Kayıtlı");
  assert.deepEqual(res.rows.slice(1).map((r) => [r.title, r.platform]), [["Yeni A", "TikTok"], ["Yeni B", "YouTube"]]);
});

test("görev modeline dönüştürme mevcut alanlarla eşleşir", () => {
  const row = { ...newRow(), brandId: "b1", title: "  Başlık ", format: "Reels", platform: "Instagram", dueDate: "2026-10-12", dueTime: "16:30", assigneeId: "u2" };
  const t = toTask(row, "2026-10-10T10:00:00.000Z");
  assert.equal(t.id, row.taskId);
  assert.deepEqual([t.title, t.status, t.priority, t.publishDate, t.dueDate, t.dueTime, t.assigneeId], ["Başlık", "Başlanmadı", "Orta", "2026-10-12", "2026-10-12", "16:30", "u2"]);
});

test("taslak: kullanıcı ve çalışma alanı bazında, kaydedilenler ve boşlar saklanmaz", () => {
  const st = memoryStorage();
  const k1 = draftKey("dev.supabase.co", "u1"), k2 = draftKey("dev.supabase.co", "u2"), k3 = draftKey("demo", "u1");
  assert.notEqual(k1, k2); assert.notEqual(k1, k3);
  const rows = [{ ...newRow(), title: "A" }, newRow(), { ...newRow(), title: "B", saved: { code: "CW-9" } }];
  assert.equal(saveDraft(st, k1, rows), 1);
  assert.equal(loadDraft(st, k2), null, "başka kullanıcı göremez");
  const d = loadDraft(st, k1);
  assert.deepEqual(d.rows.map((r) => [r.title, r.id]), [["A", rows[0].id]]);
  assert.equal(saveDraft(st, k1, [newRow()]), 0);
  assert.equal(st.getItem(k1), null, "boş taslak silinir");
  st.setItem(k1, "{bozuk");
  assert.equal(loadDraft(st, k1), null);
  assert.equal(saveDraft({ setItem() { throw new Error("dolu"); }, removeItem() {} }, k1, rows), -1);
});
