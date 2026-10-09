// node --test tests/   (npm test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { deadlineInfo, normalizeTime, revisionInfo, wallClock, isPendingRevision } from "../taskIndicators.js";
import { authorize, scopeState } from "../rbac.js";

// 8 Ekim 2026, 14:00 İstanbul (UTC+3) = 11:00 UTC
const NOW = new Date("2026-10-08T11:00:00Z");
const task = (over) => ({ id: "t1", status: "Çalışılıyor", dueDate: "2026-10-08", dueTime: "", ...over });

test("ajans saat dilimine göre bugün ve saat", () => {
  assert.deepEqual({ iso: wallClock(NOW).iso, time: wallClock(NOW).time }, { iso: "2026-10-08", time: "14:00" });
  // UTC'de hâlâ 7 Ekim iken İstanbul'da 8 Ekim
  assert.equal(wallClock(new Date("2026-10-07T22:30:00Z")).iso, "2026-10-08");
});

test("saat normalizasyonu", () => {
  assert.equal(normalizeTime("16:30:00"), "16:30");
  assert.equal(normalizeTime("9:05"), "09:05");
  assert.equal(normalizeTime("25:00"), "");
  assert.equal(normalizeTime(null), "");
});

test("bugün, yarın ve ileri tarih etiketleri", () => {
  assert.deepEqual(pick(deadlineInfo(task({ dueTime: "16:30" }), NOW)), { state: "soon", label: "Bugün, 16:30" });
  assert.deepEqual(pick(deadlineInfo(task({ dueDate: "2026-10-09", dueTime: "10:00" }), NOW)), { state: "soon", label: "Yarın, 10:00" });
  assert.deepEqual(pick(deadlineInfo(task({ dueDate: "2026-10-12", dueTime: "14:00" }), NOW)), { state: "upcoming", label: "12 Ekim, 14:00" });
  assert.equal(deadlineInfo(task({ dueDate: "2027-01-05" }), NOW).label, "5 Ocak 2027");
  assert.equal(deadlineInfo(task({ dueDate: "" }), NOW).state, "none");
});

test("gecikme doğru hesaplanır", () => {
  assert.deepEqual(pick(deadlineInfo(task({ dueTime: "12:00" }), NOW)), { state: "overdue", label: "Gecikti · 2 saat" });
  assert.deepEqual(pick(deadlineInfo(task({ dueTime: "13:45" }), NOW)), { state: "overdue", label: "Gecikti · 15 dk" });
  assert.deepEqual(pick(deadlineInfo(task({ dueDate: "2026-10-05" }), NOW)), { state: "overdue", label: "Gecikti · 2 gün" });
  // Saat yoksa son teslim gün sonudur: bugün tarihli görev henüz gecikmemiştir
  assert.equal(deadlineInfo(task(), NOW).state, "soon");
});

test("tamamlanan görev gecikmiş görünmez", () => {
  for (const status of ["Tamamlandı", "Onaylandı"]) {
    assert.deepEqual(pick(deadlineInfo(task({ status, dueDate: "2026-10-01", dueTime: "09:00" }), NOW)), { state: "done", label: "Teslim edildi" });
  }
});

test("revize durumları yorumlardan ayrı izlenir", () => {
  const rev = { id: "a1", taskId: "t1", decision: "revision", note: "Logo büyüsün", createdAt: "2026-10-08T08:00:00Z" };
  assert.equal(revisionInfo(task(), []), null);
  assert.equal(revisionInfo(task({ status: "Revizyon" }), [rev]).state, "requested");
  assert.equal(revisionInfo(task({ status: "Çalışılıyor" }), [rev]).state, "in_progress");
  assert.equal(revisionInfo(task({ status: "Müşteri Onayı" }), [rev]).state, "resolved");
  const approved = { id: "a2", taskId: "t1", decision: "approved", note: "", createdAt: "2026-10-08T10:00:00Z" };
  assert.equal(revisionInfo(task({ status: "Onaylandı" }), [approved, rev]).state, "resolved");
  assert.equal(isPendingRevision(revisionInfo(task({ status: "Revizyon" }), [rev])), true);
  assert.equal(isPendingRevision(revisionInfo(task({ status: "Onaylandı" }), [rev, approved])), false);
  // Başka görevin onay kaydı karışmaz
  assert.equal(revisionInfo(task({ id: "t2", status: "Revizyon" }), [rev]), null);
});

/* ───────── Rol kısıtları ───────── */

const users = [
  { id: "admin", role: "admin" }, { id: "emp", role: "employee" }, { id: "cli", role: "client" },
];
const state = {
  users,
  brands: [{ id: "b1" }],
  memberships: [{ id: "b1:cli", brandId: "b1", userId: "cli" }, { id: "b1:emp", brandId: "b1", userId: "emp" }],
  tasks: [{ id: "t1", brandId: "b1", assigneeId: "emp", status: "Müşteri Onayı", dueDate: "2026-10-08" }],
  comments: [{ id: "c1", taskId: "t1", userId: "emp", text: "iç not" }],
  attachments: [
    { id: "f1", taskId: "t1", name: "Taslak.jpg", internal: false },
    { id: "f2", taskId: "t1", name: "Brief.pdf", internal: true },
  ],
  assets: [], activity: [], approvals: [], notifications: [],
};

test("müşteri ekip içi ekleri ve yorumları göremez", () => {
  const v = scopeState(users[2], state);
  assert.deepEqual(v.attachments.map((a) => a.id), ["f1"]);
  assert.deepEqual(v.comments, []);
});

test("ekip ekip içi ekleri görür", () => {
  assert.deepEqual(scopeState(users[1], state).attachments.map((a) => a.id), ["f1", "f2"]);
  assert.equal(scopeState(users[0], state).attachments.length, 2);
});

test("teslim saatini yalnızca yönetici değiştirir", () => {
  const STATUSES = ["Başlanmadı", "Çalışılıyor", "Yönetici Onayı", "Müşteri Onayı", "Revizyon", "Onaylandı", "Tamamlandı", "Gecikti"];
  const action = { type: "UPDATE_TASK", id: "t1", patch: { dueTime: "18:00" } };
  assert.equal(authorize(users[0], action, state, STATUSES), null);
  assert.notEqual(authorize(users[1], action, state, STATUSES), null);
});

function pick(info) { return { state: info.state, label: info.label }; }
