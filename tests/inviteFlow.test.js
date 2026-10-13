import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { callbackErrorMessage, clearNeedsPassword, markNeedsPassword, needsPassword, parseAuthCallback, shouldMoveToCallback } from "../authCallback.js";
import { resolveRoute } from "../router.js";

/* ── E-posta bağlantısı dönüşü ── */

test("token_hash dönüşü (önerilen şablon) okunur", () => {
  const info = parseAuthCallback({ pathname: "/auth/callback", search: "?token_hash=abc123&type=invite" });
  assert.deepEqual(info, { tokenHash: "abc123", type: "invite", error: null, errorCode: null, errorDescription: null, hasSession: false });
});

test("varsayılan şablon: #access_token&type=invite oturumu supabase-js'e bırakılır, tür okunur", () => {
  const info = parseAuthCallback({ pathname: "/", hash: "#access_token=x.y.z&refresh_token=r&expires_in=3600&token_type=bearer&type=invite" });
  assert.equal(info.hasSession, true);
  assert.equal(info.type, "invite");
  assert.equal(shouldMoveToCallback(info, "/"), true, "Site URL'e dönen davet /auth/callback'e taşınır");
});

test("süresi dolmuş / kullanılmış bağlantı hatası yutulmaz (canlıda gözlenen yanıt)", () => {
  // Canlı Supabase Auth'un geçersiz jetonla döndürdüğü adres (2026-10-13 doğrulandı).
  const info = parseAuthCallback({ pathname: "/dashboard", hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=" });
  assert.equal(info.errorCode, "otp_expired");
  assert.equal(shouldMoveToCallback(info, "/dashboard"), true, "hata /login yerine açıklama ekranında gösterilir");
  assert.match(callbackErrorMessage(info).title, /süresi dolmuş|kullanılmış/);
});

test("giriş bağlantısı (magiclink) başarılıysa gideceği sayfada kalır", () => {
  const info = parseAuthCallback({ pathname: "/onay/tepe-emlak", hash: "#access_token=a&type=magiclink" });
  assert.equal(shouldMoveToCallback(info, "/onay/tepe-emlak"), false);
});

test("e-posta dönüşü olmayan adresler etkilenmez; bilinmeyen tür kabul edilmez", () => {
  assert.equal(parseAuthCallback({ pathname: "/dashboard", search: "?next=%2Fonay" }), null);
  assert.equal(parseAuthCallback({ pathname: "/auth/callback", search: "?token_hash=x&type=admin" }).type, null);
  assert.equal(parseAuthCallback({ pathname: "/auth/callback" }).tokenHash, null, "parametresiz /auth/callback: geçersiz bağlantı olarak ele alınır");
});

test("şifre belirleme işareti kullanıcıya özeldir", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  markNeedsPassword("u1", storage);
  assert.equal(needsPassword("u1", storage), true);
  assert.equal(needsPassword("u2", storage), false);
  clearNeedsPassword("u1", storage);
  assert.equal(needsPassword("u1", storage), false);
  const broken = { getItem() { throw new Error("kapalı"); }, setItem() { throw new Error("kapalı"); }, removeItem() { throw new Error("kapalı"); } };
  assert.doesNotThrow(() => markNeedsPassword("u1", broken));
  assert.equal(needsPassword("u1", broken), false);
});

/* ── Yönlendirme ── */

const r = (path, phase, role, extra = {}) => resolveRoute({ path, phase, role, ...extra });

test("/auth/callback hiçbir aşamada /login'e yönlendirilmez (oturum doğrulanmadan yönlendirme yok)", () => {
  for (const phase of ["loading", "auth", "ready", "error"]) {
    assert.deepEqual(r("/auth/callback", phase, phase === "ready" ? "employee" : null), { redirect: null, portal: null, callback: true });
  }
});

test("şifresini belirlememiş davetli her rolde önce /sifre-olustur'a gider (sözleşmeden önce)", () => {
  for (const role of ["admin", "employee", "client"]) {
    assert.deepEqual(r("/dashboard", "ready", role, { needsPassword: true, agreementAccepted: false }), { redirect: "/sifre-olustur?next=%2Fdashboard", portal: null });
    assert.deepEqual(r("/sifre-olustur", "ready", role, { needsPassword: true, agreementAccepted: false }), { redirect: null, portal: null, setPassword: true });
  }
  assert.equal(r("/onay/tepe-emlak", "ready", "client", { needsPassword: true }).redirect, "/sifre-olustur?next=%2Fonay%2Ftepe-emlak");
});

test("şifre kaydedildikten sonra rolüne göre yönlenir (sözleşme gerekiyorsa önce /sozlesme)", () => {
  assert.deepEqual(r("/sifre-olustur", "ready", "employee", { search: "?next=%2Fdashboard" }), { redirect: "/dashboard", portal: null });
  assert.deepEqual(r("/sifre-olustur", "ready", "client"), { redirect: "/onay", portal: "*" });
  assert.equal(r("/sifre-olustur", "ready", "employee", { agreementAccepted: false, search: "?next=%2Fdashboard" }).redirect, "/sozlesme?next=%2Fdashboard");
  assert.equal(r("/sifre-olustur", "auth", null).redirect, "/login", "oturumsuz şifre ekranı açılmaz");
});

test("geçersiz rol / pasif kullanıcı şifre ekranıyla yetki kazanmaz", () => {
  assert.deepEqual(r("/sifre-olustur", "ready", "superadmin", { needsPassword: true }), { redirect: null, portal: null });
});

/* ── invite-user (Deno) — kaynak denetimleri ── */

const fn = readFileSync(new URL("../supabase/functions/invite-user/index.ts", import.meta.url), "utf8");

test("kullanıcı şifreyle, e-postası onaylı oluşturulur; hiçbir e-posta gönderilmez (SMTP gerekmez)", () => {
  assert.match(fn, /admin\.auth\.admin\.createUser\(\{[\s\S]*?password,[\s\S]*?email_confirm: true/);
  for (const mail of ["inviteUserByEmail", "resetPasswordForEmail", "signInWithOtp", "generateLink", "resend("]) assert.ok(!fn.includes(mail), mail);
});

test("panel de e-posta göndermez: giriş yalnızca şifreyle (e-posta bağlantısı yok)", () => {
  for (const f of ["../workspaceData.js", "../AgencyWorkspace.jsx", "../src/supabase.js", "../src/main.jsx"]) {
    const code = readFileSync(new URL(f, import.meta.url), "utf8");
    for (const mail of ["signInWithOtp", "resetPasswordForEmail", "inviteUserByEmail", "auth.resend("]) assert.ok(!code.includes(mail), `${f}: ${mail}`);
  }
});

test("şifre kuralı sunucuda da denetlenir (panelle aynı)", async () => {
  const { MIN_PASSWORD, MAX_PASSWORD } = await import("../passwords.js");
  assert.ok(fn.includes(`const MIN_PASSWORD = ${MIN_PASSWORD};`) && fn.includes(`const MAX_PASSWORD = ${MAX_PASSWORD};`));
  assert.ok(fn.indexOf("passwordProblem(password)") < fn.indexOf("createUser("), "şifre hesap oluşturulmadan önce denetlenir");
  assert.ok(!/console\.(log|error|info)/.test(fn), "şifre / istek gövdesi loglanmaz");
});

test("yetki her işlemden önce denetlenir; kullanılan hesabın şifresi / rolü 'oluştur' ile değiştirilemez", () => {
  assert.ok(fn.indexOf('me.role !== "admin"') < fn.indexOf('action === "set_password"'), "admin denetimi tüm işlemlerden önce");
  assert.match(fn, /const unused = found\?\.user && !found\.user\.last_sign_in_at/, "yalnızca hiç giriş yapılmamış yarım kayıt tamamlanır");
  assert.match(fn, /if \(!unused\) return authFailure\(createError\);/);
});

test("service_role anahtarı istemci koduna girmez", () => {
  for (const f of ["../src/supabase.js", "../workspaceData.js", "../AgencyWorkspace.jsx", "../authCallback.js", "../src/main.jsx"]) {
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), "utf8"), /SERVICE_ROLE_KEY|sb_secret_/, f);
  }
  // Tarayıcıya giden ortam değişkenleri (VITE_*) gizli anahtar içermez.
  for (const f of [".env", ".env.production", ".env.local"]) {
    let text = "";
    try { text = readFileSync(new URL(`../${f}`, import.meta.url), "utf8"); } catch { continue; }
    for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^VITE_/.test(l))) {
      assert.doesNotMatch(line, /sb_secret_|service_role/i, `${f}: ${line.split("=")[0]}`);
      const jwt = line.match(/eyJ[\w-]+\.([\w-]+)\./);
      if (jwt) assert.notEqual(JSON.parse(Buffer.from(jwt[1], "base64url").toString()).role, "service_role", f);
    }
  }
});
