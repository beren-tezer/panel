import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS_BOXES, opsBox, planDate, weekOfMonth } from "../taskIndicators.js";
import { GENERAL_TASK_TYPES, SOCIAL_MEDIA_TASK_TYPES, contextOfType, defaultTaskType, taskCategory, taskTypeOptions } from "../taskTypes.js";

const t = (o) => ({ status: "Çalışılıyor", platform: "Instagram", format: "Reels", priority: "Orta", dueDate: "2026-10-12", dueTime: "", brandId: "b", ...o });
const box = (o, isAgency) => opsBox(t(o), { isAgency });

test("Genel Bakış: yalnızca 4 kategori kutusu, istenen sırada", () => {
  assert.deepEqual(OPS_BOXES.map((b) => b.title), ["Tamamlanan & Yayına Hazır", "Web & Teknik", "Ajans İçi İşler", "Reklam İşleri"]);
});

test("görev tek bir kutuya düşer; sosyal medya içeriği kutulara girmez", () => {
  assert.equal(box({ status: "Tamamlandı", dueDate: "2026-10-01" }), "done");
  assert.equal(box({ status: "Onaylandı", format: "Web & Teknik" }), "done", "teslim edilmiş iş türünden önce gelir");
  assert.equal(box({ format: "Web & Teknik" }), "web");
  assert.equal(box({ format: "Web & Teknik", dueDate: "2026-10-01", status: "Yönetici Onayı" }), "web", "gecikmiş / onaydaki açık iş kendi türünde sayılır");
  assert.equal(box({ format: "Ajans İçi İşler" }), "agency");
  assert.equal(box({ format: "Reklam İşleri" }), "ads");
  assert.equal(box({ format: "Reels" }), null);
  assert.equal(box({ format: "Gönderi", status: "Müşteri Onayı" }), null);
  // Eski kayıtlar
  assert.equal(box({ format: "Web", platform: "Web Sitesi" }), "web");
  assert.equal(box({ format: "Rapor", platform: "Web Sitesi" }, () => true), "web", "web ajans içinden önce");
  assert.equal(box({ format: "Rapor", platform: "LinkedIn" }, () => true), "agency", "ajansın kendi markası");
  assert.equal(box({ format: "Reklam", platform: "Meta Reklam" }), "ads");
  assert.equal(box({ format: "Rapor", platform: "Google Reklam" }), "ads");
  assert.equal(box({ format: "Rapor", platform: "LinkedIn" }), null);
});

test("görev türü seçenekleri bağlama göre", () => {
  assert.deepEqual(taskTypeOptions("general"), GENERAL_TASK_TYPES);
  assert.deepEqual(taskTypeOptions("social"), SOCIAL_MEDIA_TASK_TYPES);
  assert.ok(!taskTypeOptions("general").some((x) => SOCIAL_MEDIA_TASK_TYPES.includes(x)), "genel listede sosyal medya türü yok");
  assert.deepEqual(taskTypeOptions("general", "Web"), [...GENERAL_TASK_TYPES, "Web"], "eski değer düzenlemede kaybolmaz");
  assert.deepEqual(taskTypeOptions("general", "Reklam İşleri"), GENERAL_TASK_TYPES);
  assert.equal(contextOfType("Karusel"), "social");
  assert.equal(contextOfType("Rapor"), "general");
  assert.equal(defaultTaskType("general", "Reklam İşleri"), "Reklam İşleri");
  assert.equal(defaultTaskType("general", "Reels"), "Web & Teknik", "bağlama uymayan ön seçim kullanılmaz");
  assert.equal(defaultTaskType("social"), "Reels");
  assert.equal(taskCategory(t({ format: "Hikâye" })), "social");
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
