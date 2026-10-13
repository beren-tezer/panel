// Supabase Edge Function: invite-user  (adı geriye uyumluluk için korunur — artık DAVET E-POSTASI GÖNDERMEZ)
// Kullanıcılar & Yetkiler ekranı bu fonksiyonu çağırır. Yalnızca aktif admin çağırabilir (rol veritabanından okunur;
// istemcinin gönderdiği hiçbir bilgi yetki için kullanılmaz). service_role anahtarı yalnızca burada, sunucuda kullanılır.
//
//   action: "create" (varsayılan) → yönetici e-posta + şifre belirler; hesap e-postası onaylı oluşturulur, hiçbir e-posta
//                                   gitmez. Kullanıcı hemen bu e-posta ve şifreyle giriş yapabilir. Rol / izin / marka kaydedilir.
//   action: "set_password" { userId, password } → yönetici mevcut kullanıcıya yeni şifre belirler (e-posta gitmez).
//
// SMTP gerekmez. Şifre hiçbir yerde kaydedilmez / loglanmaz; yalnızca Supabase Auth'ta (bcrypt özeti) saklanır.
// Yayınlama:  supabase functions deploy invite-user   (veya Dashboard → Edge Functions → invite-user → kodu yapıştır → Deploy)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (code: string, error: string, status: number) => json({ code, error }, status);

const ROLES = ["admin", "employee", "client"];
// rbac.js TOGGLEABLE_PERMISSIONS ile aynı liste (eksik izin sessizce düşer — bu yüzden ikisi birlikte güncellenmeli).
const PERMISSIONS = ["canViewContent", "canEditContent", "canViewTasks", "canUpdateTasks", "canViewBrandFiles", "canAccessApprovals", "canEditBrandKit", "canManageChecklists"];

// passwords.js validatePassword ile aynı kural (tarayıcı kontrolü atlanabilir; sunucu yeniden denetler).
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;
function passwordProblem(p: string): string | null {
  if (p.length < MIN_PASSWORD) return `Şifre en az ${MIN_PASSWORD} karakter olmalı.`;
  if (p.length > MAX_PASSWORD) return `Şifre en fazla ${MAX_PASSWORD} karakter olabilir.`;
  if (!p.trim()) return "Şifre yalnızca boşluktan oluşamaz.";
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p) || !/\d/.test(p)) return "Şifre en az bir harf ve bir rakam içermeli.";
  return null;
}

function authFailure(err: { message?: string; status?: number; code?: string } | null) {
  const msg = err?.message || "";
  const code = err?.code || "";
  if (code === "weak_password" || /weak|pwned|password should/i.test(msg)) return fail("weak_password", "Şifre Supabase güvenlik kurallarına uymuyor. Daha uzun ve tahmin edilmesi zor bir şifre seçin.", 400);
  if (code === "email_exists" || /already.*registered|already exists/i.test(msg)) return fail("already_exists", "Bu e-posta ile kayıtlı bir kullanıcı var. Listeden o kullanıcıya “Şifre Belirle” ile yeni şifre verebilirsiniz.", 409);
  if (code === "email_address_invalid" || /invalid.*email|email.*invalid/i.test(msg)) return fail("invalid_email", "E-posta adresi geçersiz.", 400);
  return fail("auth_error", msg || "Kullanıcı oluşturulamadı.", (err?.status ?? 0) >= 500 ? 502 : 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Yalnızca POST desteklenir." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Çağıranı doğrula: geçerli oturum + aktif admin profili.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller?.user) return json({ error: "Oturum doğrulanamadı." }, 401);
  const { data: me } = await admin.from("profiles").select("role, active").eq("id", caller.user.id).single();
  if (!me || me.role !== "admin" || !me.active) return json({ error: "Kullanıcı eklemek için yönetici yetkisi gerekir." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Geçersiz istek gövdesi." }, 400); }
  const action = String(body.action || "create");
  const password = typeof body.password === "string" ? body.password : "";

  /* ── Mevcut kullanıcıya yönetici tarafından yeni şifre ── */
  if (action === "set_password") {
    const userId = String(body.userId || "");
    const bad = passwordProblem(password);
    if (bad) return fail("weak_password", bad, 400);
    // E-posta onayı da verilir: daha önce davet edilip bağlantıyı hiç açmamış kullanıcı da bu şifreyle girebilir.
    const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (error) return /not.*found/i.test(error.message) ? fail("not_found", "Kullanıcı bulunamadı.", 404) : authFailure(error);
    return json({ id: userId });
  }

  if (action !== "create" && action !== "invite") return json({ error: "Geçersiz işlem." }, 400);

  /* ── Yeni kullanıcı: e-posta + şifre (e-posta gönderilmez) ── */
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "");
  const brandIds = Array.isArray(body.brandIds) ? body.brandIds.map(String) : [];
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String).filter((p) => PERMISSIONS.includes(p)) : null;
  if (!name) return json({ error: "Ad soyad zorunludur." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Geçerli bir e-posta adresi girin." }, 400);
  if (!ROLES.includes(role)) return json({ error: "Geçersiz rol." }, 400);
  if (role === "client" && !brandIds.length) return json({ error: "Müşteri için en az bir marka seçin." }, 400);
  const bad = passwordProblem(password);
  if (bad) return fail("weak_password", bad, 400);

  let id: string;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // onay e-postası yok; hesap hemen giriş yapabilir
    // Yalnızca görünen ad. Rol buradan okunmaz (008: yeni kullanıcı pasif müşteri olarak oluşur, rolü aşağıda atanır).
    user_metadata: { full_name: name },
  });
  if (createError || !created?.user) {
    if (!(createError?.code === "email_exists" || /already.*registered|already exists/i.test(createError?.message || ""))) return authFailure(createError);
    // Aynı e-posta zaten var. Yalnızca yarım kalmış bir kayıt tamamlanır (önceki deneme profil adımında kaldı ya da eski
    // davet sisteminden kalan, bağlantısı hiç açılmamış hesap). Kullanılan bir hesabın şifresi / rolü burada değiştirilmez.
    const { data: profile } = await admin.from("profiles").select("id, active").eq("email", email).maybeSingle();
    const { data: found } = profile ? await admin.auth.admin.getUserById(profile.id) : { data: null };
    const unused = found?.user && !found.user.last_sign_in_at && (!found.user.email_confirmed_at || profile?.active === false);
    if (!unused) return authFailure(createError);
    const { error: pwError } = await admin.auth.admin.updateUserById(found!.user!.id, { password, email_confirm: true });
    if (pwError) return authFailure(pwError);
    id = found!.user!.id;
  } else {
    id = created.user.id;
  }

  // Önce marka atamaları, en son aktifleştirme: herhangi bir adım başarısız olursa kullanıcı pasif kalır (hiçbir şey göremez).
  // Tekrar denemede aynı satırlar üzerine yazılır (upsert) — çift kayıt oluşmaz.
  if (role !== "admin" && brandIds.length) {
    const { error: memberError } = await admin.from("brand_members").upsert(brandIds.map((brand_id) => ({ brand_id, user_id: id })));
    if (memberError) return fail("save_failed", `Hesap oluşturuldu ancak marka ataması kaydedilemedi: ${memberError.message}. Aynı bilgilerle tekrar deneyin.`, 500);
  }

  const { error: profileError } = await admin.from("profiles").update({
    full_name: name,
    role,
    role_title: String(body.title || "") || null,
    company: role === "client" ? String(body.company || "") || null : null,
    permissions,
    email,
    active: true,
  }).eq("id", id);
  if (profileError) return fail("save_failed", `Hesap oluşturuldu ancak profil kaydedilemedi: ${profileError.message}. Aynı bilgilerle tekrar deneyin.`, 500);

  return json({ id });
});
