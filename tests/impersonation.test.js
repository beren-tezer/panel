// "Başka kullanıcı olarak görüntüle" yalnızca izin listesindeki hesaba açık (rbac.js canImpersonate).
import test from "node:test";
import assert from "node:assert/strict";
import { IMPERSONATION_ALLOWLIST, canImpersonate } from "../rbac.js";

test("yalnızca izinli hesap geçiş yapabilir; diğer admin / çalışan / müşteri yapamaz", () => {
  assert.deepEqual(IMPERSONATION_ALLOWLIST, ["sahip@example.com"]);
  assert.equal(canImpersonate({ id: "a1", role: "admin", email: "sahip@example.com" }), true);
  assert.equal(canImpersonate({ id: "a1", role: "admin", email: " Sahip@Example.com " }), true);
  assert.equal(canImpersonate({ id: "a2", role: "admin", email: "yonetici@example.com" }), false);
  assert.equal(canImpersonate({ id: "a3", role: "admin", email: "yonetici2@example.com" }), false);
  assert.equal(canImpersonate({ id: "e1", role: "employee", email: "calisan@example.com" }), false);
  assert.equal(canImpersonate({ id: "c1", role: "client", email: "musteri@example.com" }), false);
  assert.equal(canImpersonate({ id: "a1", role: "admin", email: "sahip@example.com", active: false }), false);
  assert.equal(canImpersonate({ id: "x", role: "admin", email: "" }), false);
  assert.equal(canImpersonate(null), false);
});
