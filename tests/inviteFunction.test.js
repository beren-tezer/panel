import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOGGLEABLE_PERMISSIONS, ROLES } from "../rbac.js";

// invite-user (Deno) panelin izin listesini içe aktaramaz; liste elle kopyalanır. Eksik izin davette sessizce düşer.
const src = readFileSync(new URL("../supabase/functions/invite-user/index.ts", import.meta.url), "utf8");

test("davet fonksiyonu paneldeki tüm izinleri ve rolleri tanır", () => {
  assert.deepEqual(JSON.parse(src.match(/const PERMISSIONS = (\[.*\]);/)[1]), TOGGLEABLE_PERMISSIONS);
  assert.deepEqual(JSON.parse(src.match(/const ROLES = (\[.*\]);/)[1]), ROLES);
});

test("kullanıcı verisinde rol gönderilmez; kullanıcı marka atamasından sonra aktifleşir", () => {
  assert.doesNotMatch(src.match(/createUser\(\{[\s\S]*?\}\);/)[0], /\brole\b/);
  assert.ok(src.indexOf('from("brand_members").upsert') < src.indexOf("active: true"));
});
