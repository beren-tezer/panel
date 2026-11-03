// "Başka kullanıcı olarak görüntüle" yalnızca izin listesindeki hesaba açık (rbac.js canImpersonate).
// Liste koda yazılmaz; .env içindeki VITE_IMPERSONATION_EMAILS'tan okunur.
import test from "node:test";
import assert from "node:assert/strict";
import { IMPERSONATION_ALLOWLIST, canImpersonate, parseEmailList } from "../rbac.js";

test("ortam değişkeni yoksa izin listesi boştur, kimse geçiş yapamaz", () => {
  assert.deepEqual(IMPERSONATION_ALLOWLIST, []);
  assert.equal(canImpersonate({ id: "a1", role: "admin", email: "sahip@example.com" }), false);
});

test("yalnızca izinli hesap geçiş yapabilir; diğer admin / çalışan / müşteri yapamaz", () => {
  const list = parseEmailList(" Sahip@Example.com , ,diger@example.com");
  assert.deepEqual(list, ["sahip@example.com", "diger@example.com"]);
  assert.equal(canImpersonate({ id: "a1", role: "admin", email: "sahip@example.com" }, list), true);
  assert.equal(canImpersonate({ id: "a1", role: "admin", email: " Sahip@Example.COM " }, list), true);
  assert.equal(canImpersonate({ id: "a2", role: "admin", email: "yonetici@example.com" }, list), false);
  assert.equal(canImpersonate({ id: "a3", role: "admin", email: "yonetici2@example.com" }, list), false);
  assert.equal(canImpersonate({ id: "e1", role: "employee", email: "calisan@example.com" }, list), false);
  assert.equal(canImpersonate({ id: "c1", role: "client", email: "musteri@example.com" }, list), false);
  assert.equal(canImpersonate({ id: "a1", role: "admin", email: "sahip@example.com", active: false }, list), false);
  assert.equal(canImpersonate({ id: "x", role: "admin", email: "" }, list), false);
  assert.equal(canImpersonate(null, list), false);
});
