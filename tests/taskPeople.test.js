// Çoklu Görevi Yapan / Platform: liste ↔ birincil alan eşitlemesi ve atama bildirimi alıcıları (taskPeople.js, notifyRules.js)
import test from "node:test";
import assert from "node:assert/strict";
import { addedAssignees, assigneesOf, isAssignee, peoplePatch, platformsOf, withPeople } from "../taskPeople.js";
import { assignRecipients } from "../notifyRules.js";
import { employeeBox, opsBox } from "../taskIndicators.js";

test("Eski (tek değerli) görev listeye çevrilir; boş değer boş liste", () => {
  assert.deepEqual(assigneesOf({ assigneeId: "e1" }), ["e1"]);
  assert.deepEqual(assigneesOf({ assigneeId: "" }), []);
  assert.deepEqual(platformsOf({ platform: "Instagram" }), ["Instagram"]);
  assert.deepEqual(platformsOf({ platform: "" }), []);
  assert.deepEqual(assigneesOf({ assigneeId: "e1", assigneeIds: ["e2", "e3"] }), ["e2", "e3"], "liste varsa liste esas alınır");
});

test("withPeople: tekrarlar ayıklanır, ilk eleman birincil alana yazılır", () => {
  const t = withPeople({ assigneeIds: ["e2", "e1", "e2", ""], platforms: ["Facebook", "Instagram", "Facebook"] });
  assert.deepEqual(t.assigneeIds, ["e2", "e1"]);
  assert.equal(t.assigneeId, "e2");
  assert.deepEqual(t.platforms, ["Facebook", "Instagram"]);
  assert.equal(t.platform, "Facebook");
  const empty = withPeople({ assigneeIds: [], platforms: [] });
  assert.equal(empty.assigneeId, "");
  assert.equal(empty.platform, "");
});

test("peoplePatch: liste değişince birincil alan, yalnızca birincil alan gelince liste güncellenir", () => {
  assert.deepEqual(peoplePatch({ assigneeIds: ["e3", "e1"] }), { assigneeIds: ["e3", "e1"], assigneeId: "e3" });
  assert.deepEqual(peoplePatch({ assigneeIds: [] }), { assigneeIds: [], assigneeId: "" });
  assert.deepEqual(peoplePatch({ assigneeId: "e4" }), { assigneeId: "e4", assigneeIds: ["e4"] });
  assert.deepEqual(peoplePatch({ platforms: ["TikTok", "YouTube"] }), { platforms: ["TikTok", "YouTube"], platform: "TikTok" });
  assert.deepEqual(peoplePatch({ title: "x" }), { title: "x" }, "ilgisiz alan aynen kalır");
});

test("isAssignee: listedeki her kişi görevin sorumlusudur", () => {
  const t = { assigneeIds: ["e1", "e2"] };
  assert.ok(isAssignee(t, "e1") && isAssignee(t, "e2"));
  assert.ok(!isAssignee(t, "e3") && !isAssignee(t, ""));
});

test("Atama bildirimi: yeni görevde tüm kişiler, güncellemede yalnızca yeni eklenenler", () => {
  assert.deepEqual(assignRecipients({ assigneeIds: ["e1", "e2"] }), ["e1", "e2"]);
  assert.deepEqual(assignRecipients({ assigneeIds: ["e1", "e2", "e3"] }, { assigneeIds: ["e1", "e2"] }), ["e3"]);
  assert.deepEqual(assignRecipients({ assigneeIds: ["e1"] }, { assigneeIds: ["e1", "e2"] }), [], "kişi çıkarılınca bildirim yok");
  assert.deepEqual(addedAssignees({ assigneeId: "e1" }, { assigneeIds: ["e2", "e1"] }), ["e2"]);
});

test("Kutular: platformlardan herhangi biri reklam / web ise ilgili kutuya düşer", () => {
  const now = new Date("2026-10-07T12:00:00+03:00");
  const base = { status: "Çalışılıyor", priority: "Orta", dueDate: "2026-10-20", format: "Sosyal Medya" };
  assert.equal(opsBox({ ...base, platforms: ["Instagram", "Meta Reklam"] }, { now }), "ads");
  assert.equal(employeeBox({ ...base, platforms: ["Facebook", "Web Sitesi"] }, now), "web");
  assert.equal(employeeBox({ ...base, platforms: ["Instagram", "TikTok"] }, now), "active");
});
