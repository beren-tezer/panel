// Bildirim matrisi: kime gider? (notifyRules.js)
import test from "node:test";
import assert from "node:assert/strict";
import { assignRecipients, followerIds, statusRecipients } from "../notifyRules.js";

const admins = ["a1", "a2"], clients = ["c1"];
const task = { id: "t1", assigneeId: "e1", reporterId: "a2", brandId: "b1" };

test("Görev atandığında yalnızca Görevi Yapan", () => {
  assert.deepEqual(assignRecipients(task), ["e1"]);
  assert.deepEqual(assignRecipients({ ...task, assigneeId: "" }), []);
});

test("Çalışılıyor / Revizyon / Yönetici Onayı / Tamamlandı / Onaylandı → yalnızca Takipçi", () => {
  for (const s of ["Çalışılıyor", "Revizyon", "Yönetici Onayı", "Tamamlandı", "Onaylandı"]) {
    assert.deepEqual(statusRecipients(task, s, { adminIds: admins, clientIds: clients }), { team: ["a2"], clients: [] }, s);
  }
});

test("Müşteri Onayı → Takipçi + markanın müşterisi", () => {
  assert.deepEqual(statusRecipients(task, "Müşteri Onayı", { adminIds: admins, clientIds: clients }), { team: ["a2"], clients: ["c1"] });
});

test("Başlanmadı / Gecikti → bildirim yok; Görevi Yapan hiçbir durum bildirimini almaz", () => {
  for (const s of ["Başlanmadı", "Gecikti"]) assert.deepEqual(statusRecipients(task, s, { adminIds: admins, clientIds: clients }), { team: [], clients: [] });
  for (const s of ["Çalışılıyor", "Revizyon", "Yönetici Onayı", "Tamamlandı", "Müşteri Onayı"]) {
    const r = statusRecipients(task, s, { adminIds: admins, clientIds: clients });
    assert.ok(![...r.team, ...r.clients].includes("e1"), s);
  }
});

test("Takipçisi olmayan eski görev → tüm aktif adminler", () => {
  assert.deepEqual(followerIds({ ...task, reporterId: "" }, admins), ["a1", "a2"]);
  assert.deepEqual(statusRecipients({ ...task, reporterId: "" }, "Yönetici Onayı", { adminIds: admins }).team, ["a1", "a2"]);
});
