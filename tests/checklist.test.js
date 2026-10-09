import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TEMPLATE_ITEMS, checklistSummary, createMemoryChecklist, currentChecklist, cycleLabel, demoTemplates, indexChecklists, instantiate,
  itemsOf, missingForSubmit, pickTemplate, startRevisionCycle, validateTemplate,
} from "../checklist.js";
import { authorize, canManageChecklists, canWorkChecklist, scopeState } from "../rbac.js";
import { createMemorySource } from "../workspaceData.js";

const STATUSES = ["Başlanmadı", "Çalışılıyor", "Yönetici Onayı", "Müşteri Onayı", "Revizyon", "Onaylandı", "Tamamlandı", "Gecikti"];
const admin = { id: "a", role: "admin" };
const emp = { id: "e", role: "employee" };
const other = { id: "o", role: "employee" };
const client = { id: "c", role: "client" };
const manager = { id: "m", role: "employee", permissions: ["canViewContent", "canEditContent", "canViewTasks", "canUpdateTasks", "canManageChecklists"] };

const templates = demoTemplates([{ brandId: "b1", name: "Marka — Gönderi", taskTypes: ["Gönderi"], items: [
  { title: "Logo sağ altta", category: "visual", isRequired: true, isEnabled: true, recheckOnRevision: true },
  { title: "İletişim bilgisi", category: "content", isRequired: false, isEnabled: true, recheckOnRevision: false },
  { title: "Eski madde", category: "other", isRequired: true, isEnabled: false, recheckOnRevision: true },
] }]);

function world(status = "Çalışılıyor", format = "Reels") {
  const task = { id: "t1", brandId: "b1", title: "Görev", format, status, assigneeId: "e" };
  const { checklist, items } = instantiate(pickTemplate(templates, "b1", format), task.id);
  return {
    users: [admin, emp, other, client, manager], brands: [{ id: "b1" }],
    memberships: [{ brandId: "b1", userId: "c" }, { brandId: "b1", userId: "e" }, { brandId: "b1", userId: "m" }],
    tasks: [task], comments: [], activity: [], attachments: [], assets: [], approvals: [], notifications: [],
    checklists: [checklist], checklistItems: items,
  };
}
const completeRequired = (s) => ({ ...s, checklistItems: s.checklistItems.map((i) => (i.isRequired ? { ...i, isCompleted: true, completedBy: "e", completedAt: "2026-10-09T10:00:00Z" } : i)) });

test("varsayılan şablon: 12 madde, 10 zorunlu, 3 kategori", () => {
  assert.equal(DEFAULT_TEMPLATE_ITEMS.length, 12);
  assert.equal(DEFAULT_TEMPLATE_ITEMS.filter((i) => i.isRequired).length, 10);
  assert.deepEqual([...new Set(DEFAULT_TEMPLATE_ITEMS.map((i) => i.category))], ["visual", "content", "technical"]);
});

test("şablon seçimi: marka + formata özel > marka genel > varsayılan; Rapor'da liste yok", () => {
  assert.equal(pickTemplate(templates, "b1", "Gönderi").name, "Marka — Gönderi");
  assert.equal(pickTemplate(templates, "b1", "Reels").name, "Varsayılan Kontrol Listesi");
  assert.equal(pickTemplate(templates, "b2", "Gönderi").name, "Varsayılan Kontrol Listesi");
  assert.equal(pickTemplate(templates, "b1", "Rapor"), null);
  const inactive = templates.map((t) => (t.brandId ? { ...t, isActive: false } : t));
  assert.equal(pickTemplate(inactive, "b1", "Gönderi").name, "Varsayılan Kontrol Listesi");
});

test("göreve kopyalama: devre dışı maddeler alınmaz, alanlar snapshot olarak kopyalanır", () => {
  const tpl = structuredClone(pickTemplate(templates, "b1", "Gönderi"));
  const { checklist, items } = instantiate(tpl, "t9");
  assert.equal(items.length, 2);
  assert.equal(checklist.templateVersion, 1);
  tpl.items[0].title = "Değişti";
  assert.equal(items[0].title, "Logo sağ altta", "şablon değişince görev maddesi değişmez");
});

test("ilerleme durumları gerçek veriden hesaplanır", () => {
  const s = world();
  const c = s.checklists[0];
  const sum = (items, task = s.tasks[0]) => checklistSummary(c, items, task);
  assert.equal(sum(s.checklistItems).state, "not_started");
  assert.equal(sum(s.checklistItems).label, "Henüz Başlanmadı");
  const one = s.checklistItems.map((i, n) => (n === 0 ? { ...i, isCompleted: true } : i));
  assert.equal(sum(one).state, "checking");
  const req = completeRequired(s).checklistItems;
  assert.equal(sum(req).state, "ready");
  assert.equal(sum(req).label, "Onaya Hazır");
  assert.equal(sum(req, { ...s.tasks[0], status: "Müşteri Onayı" }).label, "Kontroller Tamamlandı");
  const r = sum(req);
  assert.deepEqual([r.done, r.total, r.requiredDone, r.required], [10, 12, 10, 10]);
  assert.equal(cycleLabel(r), "İlk Teslim");
});

test("onaya gönderim: çalışan eksikle gönderemez, isteğe bağlı eksik engellemez, admin gerekçe ister", () => {
  const s = world();
  const task = s.tasks[0];
  assert.equal(missingForSubmit(s, task).length, 10);
  assert.equal(authorize(emp, { type: "SUBMIT_TASK", id: "t1", status: "Müşteri Onayı" }, s, STATUSES), "İçeriği onaya göndermeden önce 10 zorunlu kontrolü tamamlamalısınız.");
  assert.match(authorize(admin, { type: "SUBMIT_TASK", id: "t1", status: "Müşteri Onayı" }, s, STATUSES), /gerekçe/);
  assert.equal(authorize(admin, { type: "SUBMIT_TASK", id: "t1", status: "Müşteri Onayı", reason: "acil" }, s, STATUSES), null);
  const ok = completeRequired(s);
  assert.equal(authorize(emp, { type: "SUBMIT_TASK", id: "t1", status: "Müşteri Onayı" }, ok, STATUSES), null);
  assert.equal(authorize(emp, { type: "SUBMIT_TASK", id: "t1", status: "Yönetici Onayı" }, ok, STATUSES), null);
  // Doğrudan durum değişikliğiyle atlatılamaz
  assert.match(authorize(emp, { type: "UPDATE_TASK", id: "t1", patch: { status: "Müşteri Onayı" } }, ok, STATUSES), /Onaya Gönder/);
  // Liste kapatılmışsa kontrol yok
  const off = { ...s, tasks: [{ ...task, checklistDisabled: true }] };
  assert.equal(missingForSubmit(off, off.tasks[0]).length, 0);
  // Yinelenen gönderim
  const sent = { ...ok, tasks: [{ ...task, status: "Müşteri Onayı" }] };
  assert.match(authorize(emp, { type: "SUBMIT_TASK", id: "t1", status: "Müşteri Onayı" }, sent, STATUSES), /zaten/);
});

test("işaretleme yetkileri: atanan çalışan, kilit, başkasının işareti, eski döngü", () => {
  const s = world();
  const item = s.checklistItems[0];
  const toggle = (user, state, completed = true, id = item.id) => authorize(user, { type: "TOGGLE_CHECK", itemId: id, completed }, state, STATUSES);
  assert.equal(toggle(emp, s), null);
  assert.equal(toggle(admin, s), null);
  assert.match(toggle(other, s), /yetkiniz yok/);
  assert.match(toggle(client, s), /yetkiniz yok/);
  assert.ok(canWorkChecklist(emp, s.tasks[0], s) && !canWorkChecklist(client, s.tasks[0], s));
  const byAdmin = { ...s, checklistItems: s.checklistItems.map((i) => (i.id === item.id ? { ...i, isCompleted: true, completedBy: "a" } : i)) };
  assert.match(toggle(emp, byAdmin, false), /yalnızca yönetici/);
  assert.equal(toggle(admin, byAdmin, false), null);
  const locked = { ...s, tasks: [{ ...s.tasks[0], status: "Müşteri Onayı" }] };
  assert.match(toggle(emp, locked), /kilitli/);
  assert.equal(toggle(admin, locked), null);
  const r = startRevisionCycle(s.checklists[0], s.checklistItems);
  const revised = { ...s, checklists: [r.closed, r.checklist], checklistItems: [...s.checklistItems, ...r.items] };
  assert.match(toggle(emp, revised), /önceki bir revizyon/);
  assert.equal(toggle(emp, revised, true, r.items[0].id), null);
  assert.match(authorize(emp, { type: "SET_CHECK_NOTE", itemId: item.id, note: "x".repeat(1001) }, s, STATUSES), /1000/);
});

test("revizyon döngüsü: yeniden kontrol gerekenler sıfırlanır, diğerleri taşınır, geçmiş korunur", () => {
  const s = completeRequired(world("Müşteri Onayı", "Gönderi"));
  const items = s.checklistItems.map((i) => ({ ...i, isCompleted: true, completedBy: "e", completedAt: "2026-10-09T10:00:00Z", note: "ok" }));
  const r = startRevisionCycle(s.checklists[0], items);
  assert.equal(r.checklist.cycle, 1);
  assert.ok(r.closed.closedAt);
  assert.deepEqual(r.items.map((i) => i.isCompleted), [false, true]); // Logo: yeniden kontrol; İletişim: taşınır
  assert.equal(r.items[1].completedBy, "e");
  assert.ok(r.items.every((i) => i.note === "" && i.checklistId === r.checklist.id));
  assert.ok(items.every((i) => i.isCompleted), "önceki döngü değişmez");
  const sum = checklistSummary(r.checklist, r.items, { status: "Revizyon" });
  assert.equal(cycleLabel(sum), "Revizyon 1 — Kontrol Bekliyor");
  const idx = indexChecklists([r.closed, r.checklist], [...items, ...r.items]);
  assert.equal(idx.t1.checklist.id, r.checklist.id);
  assert.equal(currentChecklist([r.closed, r.checklist], "t1").cycle, 1);
});

test("müşteri kontrol listesi, not ve geçmiş verisini hiç almaz", () => {
  const s = { ...world("Müşteri Onayı"), checklistItems: world("Müşteri Onayı").checklistItems.map((i) => ({ ...i, note: "İç not" })) };
  const v = scopeState(client, s);
  assert.equal(v.tasks.length, 1, "müşteri görevi görür");
  assert.deepEqual([v.checklists, v.checklistItems], [[], []]);
  assert.equal(scopeState(emp, s).checklistItems.length, 12);
  assert.equal(scopeState(other, s).checklistItems.length, 0);
});

test("şablon yönetimi: admin her şey; çalışan yalnızca açık izinle ve kendi markasında; varsayılan yalnızca admin", () => {
  const s = world();
  assert.ok(canManageChecklists(admin, null, s) && canManageChecklists(admin, "b1", s));
  assert.ok(!canManageChecklists(emp, "b1", s), "varsayılan izinlerde kapalı");
  assert.ok(canManageChecklists(manager, "b1", s));
  assert.ok(!canManageChecklists(manager, "b2", s));
  assert.ok(!canManageChecklists(manager, null, s));
  assert.ok(!canManageChecklists({ ...client, permissions: ["canManageChecklists"] }, "b1", s));
});

test("şablon doğrulama", () => {
  assert.ok(validateTemplate({ name: "", items: [] }).name);
  assert.ok(validateTemplate({ name: "x", items: [] }).items);
  assert.ok(validateTemplate({ name: "x", items: [{ title: "a", isEnabled: false }] }).items);
  assert.ok(validateTemplate({ name: "x", items: [{ title: " ", isEnabled: true }] })["item-0"]);
  assert.ok(validateTemplate({ name: "x", taskTypes: ["Podcast"], items: [{ title: "a", isEnabled: true }] }).taskTypes);
  assert.deepEqual(validateTemplate({ name: "x", taskTypes: ["Reels"], items: [{ title: "a", isEnabled: true }] }), {});
});

test("demo şablon deposu: kaydetme sürümü artırır, mevcut görev listesi etkilenmez", async () => {
  const api = createMemoryChecklist(templates);
  const s = world("Çalışılıyor", "Gönderi");
  const tpl = (await api.listTemplates("b1")).find((t) => t.brandId === "b1");
  const saved = await api.saveTemplate({ ...tpl, items: tpl.items.map((i, n) => (n === 0 ? { ...i, title: "Logo sol üstte" } : i)) }, "a");
  assert.equal(saved.version, 2);
  assert.equal(s.checklistItems[0].title, "Logo sağ altta");
  const fresh = api.instantiateFor({ id: "t2", brandId: "b1", format: "Gönderi" });
  assert.equal(fresh.items[0].title, "Logo sol üstte");
  assert.equal(fresh.checklist.templateVersion, 2);
  await assert.rejects(api.saveTemplate({ ...tpl, name: " " }, "a"), /zorunlu/);
});

test("demo kaynağı sunucu kurallarını taklit eder: revizyon döngüsü, gönderim kaydı, eksikle gönderim reddi", async () => {
  const api = createMemoryChecklist(templates);
  const source = createMemorySource(() => ({ users: [], me: "a", state: {} }), { checklist: api });
  const merged = [];
  const helpers = { patchTask() {}, merge: (p) => merged.push(p), actorId: "e" };
  const prev = completeRequired(world("Müşteri Onayı", "Gönderi"));
  const next = { ...prev, tasks: [{ ...prev.tasks[0], status: "Revizyon" }] };
  await source.persist({ type: "REVIEW_CONTENT", taskId: "t1", decision: "revision" }, prev, next, helpers);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].checklists.map((c) => [c.cycle, !!c.closedAt]), [[0, true], [1, false]]);
  assert.equal((await api.history("t1")).events[0].kind, "cycle");

  const working = world("Çalışılıyor");
  await assert.rejects(source.persist({ type: "SUBMIT_TASK", id: "t1", status: "Müşteri Onayı" }, working, working, helpers), /10 zorunlu/);
  const ready = completeRequired(working);
  await source.persist({ type: "SUBMIT_TASK", id: "t1", status: "Müşteri Onayı" }, ready, ready, helpers);
  const sub = (await api.history("t1")).submissions[0];
  assert.deepEqual([sub.requiredDone, sub.required, sub.overrideReason], [10, 10, null]);
  await source.persist({ type: "SUBMIT_TASK", id: "t1", status: "Yönetici Onayı", reason: "acil" }, working, working, helpers);
  assert.equal((await api.history("t1")).submissions[0].overrideReason, "acil");
  assert.equal(itemsOf(ready.checklistItems, ready.checklists[0].id).length, 12);
});
