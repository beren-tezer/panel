import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS_BOXES, opsBox, opsMetrics, planDate, weekOfMonth } from "../taskIndicators.js";

const NOW = new Date("2026-10-10T09:00:00Z"); // İstanbul 12:00
const t = (o) => ({ status: "Çalışılıyor", platform: "Instagram", format: "Reels", priority: "Orta", dueDate: "2026-10-12", dueTime: "", brandId: "b", ...o });
const box = (o, isAgency) => opsBox(t(o), { now: NOW, isAgency });

test("8 grup, istenen sırada", () => {
  assert.deepEqual(OPS_BOXES.map((b) => b.title), ["Geciken & Acil İşler", "Yönetici Onayı", "Müşteri Onayı", "Aktif Çalışmalar", "Tamamlanan & Yayına Hazır", "Web & Teknik", "Ajans İçi İşler", "Reklam İşleri"]);
});

test("görev tek bir gruba düşer; öncelik sırası", () => {
  assert.equal(box({ status: "Tamamlandı", dueDate: "2026-10-01" }), "done");
  assert.equal(box({ status: "Onaylandı" }), "done");
  assert.equal(box({ status: "Yönetici Onayı", dueDate: "2026-10-01" }), "manager", "onaydaki iş gecikmiş sayılmaz");
  assert.equal(box({ status: "Müşteri Onayı" }), "client");
  assert.equal(box({ dueDate: "2026-10-09" }), "urgent", "gecikmiş");
  assert.equal(box({ status: "Gecikti" }), "urgent");
  assert.equal(box({ priority: "Yüksek", dueDate: "2026-10-10", dueTime: "18:00" }), "urgent", "yüksek öncelik + bugün");
  assert.equal(box({ priority: "Orta", dueDate: "2026-10-10", dueTime: "18:00" }), "active", "orta öncelik bugün acil değil");
  assert.equal(box({ format: "Web", platform: "Web Sitesi", dueDate: "2026-10-09" }), "urgent", "gecikme türden önce gelir");
  assert.equal(box({ format: "Web", platform: "Web Sitesi" }), "web");
  assert.equal(box({ format: "Rapor", platform: "Web Sitesi" }, () => true), "web", "web ajans içinden önce");
  assert.equal(box({ format: "Rapor", platform: "LinkedIn" }, () => true), "agency");
  assert.equal(box({ format: "Reklam", platform: "Meta Reklam" }), "ads");
  assert.equal(box({ status: "Revizyon" }), "active");
  assert.equal(box({ status: "Başlanmadı", dueDate: null }), "active");
});

test("sayaçlar: bugün / dün, geciken + kritik, onaylar", () => {
  const list = [
    t({ dueDate: "2026-10-10", dueTime: "18:00" }), t({ dueDate: "2026-10-10", status: "Tamamlandı" }),
    t({ dueDate: "2026-10-09" }), t({ dueDate: "2026-10-08", priority: "Yüksek" }), t({ dueDate: "2026-10-09", status: "Tamamlandı" }),
    t({ status: "Yönetici Onayı", dueDate: "2026-10-01" }), t({ status: "Müşteri Onayı" }), t({ status: "Müşteri Onayı" }),
  ];
  assert.deepEqual(opsMetrics(list, { now: NOW, today: "2026-10-10", yesterday: "2026-10-09" }),
    { today: 2, yesterday: 2, late: 3, critical: 1, manager: 1, client: 2 });
});

test("plan tarihi ve ay içi hafta (Eylül 2026: 1 Eylül salı)", () => {
  assert.equal(planDate({ publishDate: "2026-09-04", dueDate: "2026-09-03" }), "2026-09-04");
  assert.equal(planDate({ publishDate: null, dueDate: "2026-09-03" }), "2026-09-03");
  assert.equal(planDate({}), null);
  const weeks = ["2026-09-02", "2026-09-04", "2026-09-07", "2026-09-12", "2026-09-14", "2026-09-19", "2026-09-21", "2026-09-25", "2026-09-28", "2026-09-30"].map(weekOfMonth);
  assert.deepEqual(weeks, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5], "Yöneticinin Mavitur planındaki hafta bölümleri");
  assert.equal(weekOfMonth("2026-06-01"), 1, "ay pazartesi başlarsa");
  assert.equal(weekOfMonth("2026-06-08"), 2);
});
