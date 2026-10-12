import { test } from "node:test";
import assert from "node:assert/strict";
import { signedInWithEmailLink, validatePassword, validatePasswordChange } from "../passwords.js";
import { createSupabaseSource } from "../workspaceData.js";

const jwt = (amr) => `x.${Buffer.from(JSON.stringify({ sub: "u", amr })).toString("base64url")}.y`;

test("şifre kuralları", () => {
  assert.match(validatePassword("Ab1"), /en az 8/);
  assert.match(validatePassword("abcdefgh"), /harf ve bir rakam/);
  assert.match(validatePassword("12345678"), /harf ve bir rakam/);
  assert.match(validatePassword("a1".repeat(40)), /en fazla 72/);
  assert.equal(validatePassword("Sonbahar2026"), null);
  assert.equal(validatePassword("şifre1234"), null, "Türkçe harfler");
});

test("şifre değiştirme formu", () => {
  assert.deepEqual(validatePasswordChange({ current: "", next: "Yeni12345", repeat: "Yeni12345" }, true), { current: "Mevcut şifrenizi girin." });
  assert.match(validatePasswordChange({ current: "Eski12345", next: "Eski12345", repeat: "Eski12345" }, true).next, /farklı/);
  assert.match(validatePasswordChange({ current: "Eski12345", next: "Yeni12345", repeat: "Yeni1234" }, true).repeat, /eşleşmiyor/);
  assert.deepEqual(validatePasswordChange({ next: "Yeni12345", repeat: "Yeni12345" }, false), {}, "e-posta bağlantısıyla girişte mevcut şifre sorulmaz");
});

test("oturumun giriş yöntemi jetondan okunur; okunamazsa mevcut şifre istenir", () => {
  assert.equal(signedInWithEmailLink(jwt([{ method: "otp", timestamp: 1 }])), true);
  assert.equal(signedInWithEmailLink(jwt([{ method: "magiclink", timestamp: 1 }])), true);
  assert.equal(signedInWithEmailLink(jwt([{ method: "password", timestamp: 1 }])), false);
  assert.equal(signedInWithEmailLink(jwt([{ method: "otp" }, { method: "password" }])), false);
  assert.equal(signedInWithEmailLink(jwt([])), false);
  assert.equal(signedInWithEmailLink("bozuk"), false);
});

function fakeClient({ amr, verifyError = null, updateError = null }) {
  const calls = { verify: [], update: [] };
  const client = {
    channel() {}, from() { throw new Error("kullanılmamalı"); },
    auth: {
      getSession: async () => ({ data: { session: { access_token: jwt(amr), user: { email: "yonetici@example.com" } } } }),
      signInWithPassword: async (a) => { calls.verify.push(a); return { error: verifyError }; },
      updateUser: async (a) => { calls.update.push(a); return { error: updateError }; },
    },
  };
  return { client, calls };
}

test("şifreyle girilmiş oturum: önce mevcut şifre doğrulanır, sonra güncellenir", async () => {
  const f = fakeClient({ amr: [{ method: "password" }] });
  const account = createSupabaseSource(f.client).account;
  assert.deepEqual(await account.passwordContext(), { email: "yonetici@example.com", needsCurrent: true });
  await account.changePassword({ current: "Eski12345", next: "Yeni12345" });
  assert.deepEqual(f.calls.verify, [{ email: "yonetici@example.com", password: "Eski12345" }]);
  assert.deepEqual(f.calls.update, [{ password: "Yeni12345" }]);
});

test("mevcut şifre yanlışsa güncelleme yapılmaz", async () => {
  const f = fakeClient({ amr: [{ method: "password" }], verifyError: { status: 400, message: "Invalid login credentials" } });
  await assert.rejects(createSupabaseSource(f.client).account.changePassword({ current: "yanlis", next: "Yeni12345" }), (e) => e.field === "current" && /hatalı/.test(e.message));
  assert.equal(f.calls.update.length, 0);
});

test("e-posta bağlantısıyla girilmiş oturum: mevcut şifre sorulmadan ilk şifre belirlenir", async () => {
  const f = fakeClient({ amr: [{ method: "otp" }] });
  const account = createSupabaseSource(f.client).account;
  assert.equal((await account.passwordContext()).needsCurrent, false);
  await account.changePassword({ next: "Ilk12345" });
  assert.equal(f.calls.verify.length, 0);
  assert.deepEqual(f.calls.update, [{ password: "Ilk12345" }]);
});

test("Supabase güncelleme hataları Türkçe", async () => {
  const same = fakeClient({ amr: [{ method: "otp" }], updateError: { message: "New password should be different from the old password." } });
  await assert.rejects(createSupabaseSource(same.client).account.changePassword({ next: "Ayni12345" }), /farklı olmalı/);
  const reauth = fakeClient({ amr: [{ method: "otp" }], updateError: { message: "Password update requires reauthentication." } });
  await assert.rejects(createSupabaseSource(reauth.client).account.changePassword({ next: "Yeni12345" }), /tekrar giriş/);
});
