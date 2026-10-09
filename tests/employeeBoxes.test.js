import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPLOYEE_BOXES, employeeBox } from "../taskIndicators.js";

const NOW = new Date("2026-10-10T09:00:00Z"); // İstanbul 12:00
const t = (o) => ({ status: "Çalışılıyor", platform: "Instagram", format: "Reels", dueDate: "2026-10-12", dueTime: "", ...o });

test("8 kutu, istenen sırada", () => {
  assert.deepEqual(EMPLOYEE_BOXES.map((b) => b.title), ["Geciken İşler", "Aktif İşler", "Tamamlananlar", "Web İşleri ve Teknik İşler", "Yönetici Onayı", "Müşteri Onayı", "Diğer Görevler", "Reklam Görevleri"]);
});

test("görev tek bir kutuya düşer; öncelik sırası", () => {
  assert.equal(employeeBox(t({ status: "Tamamlandı", dueDate: "2026-10-01" }), NOW), "done");
  assert.equal(employeeBox(t({ status: "Onaylandı" }), NOW), "done");
  assert.equal(employeeBox(t({ status: "Yönetici Onayı", dueDate: "2026-10-01" }), NOW), "manager", "onaydaki iş gecikmiş sayılmaz");
  assert.equal(employeeBox(t({ status: "Müşteri Onayı" }), NOW), "client");
  assert.equal(employeeBox(t({ dueDate: "2026-10-09" }), NOW), "late");
  assert.equal(employeeBox(t({ dueDate: "2026-10-10", dueTime: "10:00" }), NOW), "late", "bugün saati geçmiş");
  assert.equal(employeeBox(t({ status: "Gecikti" }), NOW), "late");
  assert.equal(employeeBox(t({ format: "Web", platform: "Web Sitesi", dueDate: "2026-10-09" }), NOW), "late", "gecikme türden önce gelir");
  assert.equal(employeeBox(t({ format: "Web", platform: "Web Sitesi" }), NOW), "web");
  assert.equal(employeeBox(t({ format: "Rapor", platform: "Web Sitesi" }), NOW), "web");
  assert.equal(employeeBox(t({ format: "Reklam", platform: "Meta Reklam" }), NOW), "ads");
  assert.equal(employeeBox(t({ format: "Rapor", platform: "Google Reklam" }), NOW), "ads");
  assert.equal(employeeBox(t({ format: "Karusel", status: "Revizyon" }), NOW), "active");
  assert.equal(employeeBox(t({ format: "Rapor", platform: "LinkedIn" }), NOW), "other");
  assert.equal(employeeBox(t({ format: "Video", platform: "YouTube", status: "Başlanmadı" }), NOW), "active");
});
