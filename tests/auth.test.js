import { test } from "node:test";
import assert from "node:assert/strict";
import { createSupabaseSource } from "../workspaceData.js";

// Supabase istemcisinin yalnızca giriş için kullanılan kısmı (gerçek ağ isteği yok).
const fake = (error) => {
  const calls = [];
  return {
    calls,
    client: { auth: { signInWithPassword: async (args) => { calls.push(args); return { error }; } }, from() { throw new Error("kullanılmamalı"); }, channel() {} },
  };
};

test("şifreyle giriş: e-posta küçük harfe çevrilir, şifre olduğu gibi gönderilir", async () => {
  const f = fake(null);
  await createSupabaseSource(f.client).auth.signInWithPassword("  Musteri@Test.com ", "Gizli 123");
  assert.deepEqual(f.calls[0], { email: "musteri@test.com", password: "Gizli 123" });
});

test("şifreyle giriş: Supabase hataları anlamlı Türkçe mesajlara çevrilir", async () => {
  const cases = [
    [{ status: 400, message: "Invalid login credentials" }, /E-posta veya şifre hatalı/],
    [{ status: 400, message: "Email not confirmed" }, /henüz onaylanmadı/],
    [{ status: 429, message: "Request rate limit reached" }, /Çok fazla deneme/],
    [{ status: 0, message: "Failed to fetch" }, /Giriş yapılamadı/],
  ];
  for (const [error, re] of cases) {
    await assert.rejects(createSupabaseSource(fake(error).client).auth.signInWithPassword("a@b.co", "x"), re, error.message);
  }
});
