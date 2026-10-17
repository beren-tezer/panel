// Yeni Görev formundaki türler (Sosyal Medya / Reklam İşleri / Dijital Pazarlama) özet kutularında ve kontrol listesinde.
import test from "node:test";
import assert from "node:assert/strict";
import { employeeBox, opsBox } from "../taskIndicators.js";
import { TASK_TYPES, templateApplies } from "../checklist.js";

const far = "2099-01-01";
const t = (format, platform = "") => ({ format, platform, status: "Çalışılıyor", priority: "Orta", dueDate: far, dueTime: "" });

test("Reklam İşleri → Reklam kutusu; Sosyal Medya → aktif; Dijital Pazarlama kaybolmaz", () => {
  assert.equal(opsBox(t("Reklam İşleri")), "ads");
  assert.equal(opsBox(t("Sosyal Medya", "Instagram")), "active");
  assert.equal(opsBox(t("Dijital Pazarlama")), "active");
  assert.equal(employeeBox(t("Reklam İşleri")), "ads");
  assert.equal(employeeBox(t("Sosyal Medya", "TikTok")), "active");
  assert.equal(employeeBox(t("Dijital Pazarlama")), "other");
  // Eski türler aynı
  assert.equal(opsBox(t("Web", "Web Sitesi")), "web");
  assert.equal(opsBox(t("Reklam", "Meta Reklam")), "ads");
});

test("Kontrol listesi şablonları yeni türleri tanır", () => {
  for (const x of ["Sosyal Medya", "Reklam İşleri", "Dijital Pazarlama"]) assert.ok(TASK_TYPES.includes(x));
  assert.ok(templateApplies({ taskTypes: ["Reels", "Sosyal Medya"] }, "Sosyal Medya"));
  assert.ok(!templateApplies({ taskTypes: ["Reels"] }, "Reklam İşleri"));
});
