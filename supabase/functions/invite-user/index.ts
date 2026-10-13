// Supabase Edge Function: invite-user
// Kullanıcılar & Yetkiler ekranı bu fonksiyonu çağırır. Yalnızca aktif admin çağırabilir (rol veritabanından okunur;
// istemcinin gönderdiği hiçbir bilgi yetki için kullanılmaz). service_role anahtarı yalnızca burada, sunucuda kullanılır.
//
//   action: "invite" (varsayılan) → yeni kullanıcı: davet e-postası + rol / izin / marka. Daveti henüz açılmamış bir
//                                   e-posta için tekrar çağrılırsa aynı kullanıcıya yeniden davet gider (mükerrer kayıt oluşmaz).
//   action: "resend"  { userId }  → daveti henüz kabul edilmemiş kullanıcıya yeni davet bağlantısı.
//   action: "reset"   { userId }  → hesabını etkinleştirmiş kullanıcıya şifre sıfırlama bağlantısı (davetten ayrı senaryo).
//   action: "status"              → kullanıcıların davet durumu (e-posta onaylandı mı, son giriş) — yalnızca liste rozetleri için.
//
// Yayınlama:  supabase functions deploy invite-user   (veya Dashboard → Edge Functions → invite-user → kodu yapıştır → Deploy)
// (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik sağlanır.)
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

/* Davet / sıfırlama bağlantısının döneceği adres: yalnızca <origin>/auth/callback kabul edilir (https veya localhost).
   Supabase ayrıca Authentication → URL Configuration → Redirect URLs listesini uygular; listede yoksa Site URL kullanılır. */
function callbackUrl(raw: unknown): string | undefined {
  try {
    const u = new URL(String(raw || ""));
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return undefined;
    return `${u.origin}/auth/callback`;
  } catch { return undefined; }
}

/* GoTrue hatası → açık Türkçe mesaj. E-posta gönderilemediyse bunu asla "başarılı" saymayız. */
function authFailure(err: { message?: string; status?: number; code?: string } | null, what: "invite" | "reset") {
  const msg = err?.message || "";
  const code = err?.code || "";
  if (code === "over_email_send_rate_limit" || /email rate limit/i.test(msg)) {
    return fail("email_rate_limit", "E-posta gönderim sınırı aşıldı. Supabase'in yerleşik e-posta servisi saatte yalnızca birkaç e-posta gönderir; özel SMTP ayarlayın veya bir süre sonra tekrar deneyin.", 429);
  }
  if (err?.status === 429 || /security purposes|only request this after/i.test(msg)) {
    return fail("too_soon", "Bu kişiye az önce e-posta gönderildi. Yaklaşık bir dakika bekleyip tekrar deneyin.", 429);
  }
  if (code === "email_exists" || /already.*registered|already exists/i.test(msg)) {
    return fail("already_active", "Bu e-posta ile hesabını etkinleştirmiş bir kullanıcı var. Şifresini unuttuysa listeden “Şifre sıfırlama bağlantısı gönder”i kullanın.", 409);
  }
  if (/error sending .*email/i.test(msg) || code === "unexpected_failure" || (err?.status ?? 0) >= 500) {
    return fail("email_failed", what === "invite"
      ? "Davet e-postası gönderilemedi; kullanıcı oluşturulmadı. Supabase'de özel SMTP ayarlı değilse e-posta yalnızca proje ekibi adreslerine gider (Authentication → Emails → SMTP Settings). Ayrıntı: Supabase → Logs → Auth."
      : "Şifre sıfırlama e-postası gönderilemedi. SMTP ayarlarını kontrol edin (Authentication → Emails → SMTP Settings). Ayrıntı: Supabase → Logs → Auth.", 502);
  }
  return fail("auth_error", msg || "İşlem tamamlanamadı.", 400);
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
  const action = String(body.action || "invite");
  const redirectTo = callbackUrl(body.redirectTo);

  /* ── Davet durumu (liste rozetleri) ── */
  if (action === "status") {
    const users: { id: string; confirmed: boolean; invitedAt: string | null; lastSignInAt: string | null }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return fail("auth_error", error.message, 500);
      for (const u of data.users) users.push({ id: u.id, confirmed: !!u.email_confirmed_at, invitedAt: u.invited_at || null, lastSignInAt: u.last_sign_in_at || null });
      if (data.users.length < 200) break;
    }
    return json({ users });
  }

  /* ── Mevcut kullanıcı: yeniden davet / şifre sıfırlama ── */
  if (action === "resend" || action === "reset") {
    const { data: found, error: findError } = await admin.auth.admin.getUserById(String(body.userId || ""));
    if (findError || !found?.user?.email) return fail("not_found", "Kullanıcı bulunamadı.", 404);
    const user = found.user;
    if (action === "resend") {
      if (user.email_confirmed_at) return fail("already_active", "Bu kullanıcı davetini kabul etmiş. Giriş yapamıyorsa “Şifre sıfırlama bağlantısı gönder”i kullanın.", 409);
      // Onaylanmamış kullanıcıya inviteUserByEmail yeni bir bağlantı gönderir (yeni kullanıcı oluşturmaz; eski bağlantı geçersizleşir).
      const { error } = await admin.auth.admin.inviteUserByEmail(user.email!, { redirectTo });
      return error ? authFailure(error, "invite") : json({ id: user.id, sent: "invite" });
    }
    if (!user.email_confirmed_at) return fail("pending_invite", "Bu kullanıcı davetini henüz kabul etmedi. Şifre sıfırlama yerine “Daveti yeniden gönder”i kullanın.", 409);
    const { error } = await admin.auth.resetPasswordForEmail(user.email!, { redirectTo });
    return error ? authFailure(error, "reset") : json({ id: user.id, sent: "reset" });
  }

  if (action !== "invite") return json({ error: "Geçersiz işlem." }, 400);

  /* ── Yeni kullanıcı daveti ── */
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "");
  const brandIds = Array.isArray(body.brandIds) ? body.brandIds.map(String) : [];
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String).filter((p) => PERMISSIONS.includes(p)) : null;
  if (!name) return json({ error: "Ad soyad zorunludur." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Geçerli bir e-posta adresi girin." }, 400);
  if (!ROLES.includes(role)) return json({ error: "Geçersiz rol." }, 400);
  if (role === "client" && !brandIds.length) return json({ error: "Müşteri için en az bir marka seçin." }, 400);

  // Aynı e-posta daha önce eklendiyse: hesabını etkinleştirmişse yeni davet yok (ayrı senaryo: şifre sıfırlama);
  // daveti bekliyorsa aşağıdaki çağrı aynı kullanıcıya yeniden davet gönderir — ikinci bir kullanıcı oluşmaz.
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    const { data: found } = await admin.auth.admin.getUserById(existing.id);
    if (found?.user?.email_confirmed_at) return fail("already_active", "Bu e-posta ile hesabını etkinleştirmiş bir kullanıcı var. Şifresini unuttuysa listeden “Şifre sıfırlama bağlantısı gönder”i kullanın.", 409);
  }

  // GoTrue kullanıcıyı ve e-postayı tek işlemde ele alır: e-posta gönderilemezse kullanıcı kaydı geri alınır.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    // Yalnızca görünen ad. Rol buradan okunmaz (008: yeni kullanıcı pasif müşteri olarak oluşur, rolü aşağıda atanır).
    data: { full_name: name },
    redirectTo,
  });
  if (inviteError || !invited?.user) return authFailure(inviteError, "invite");
  const id = invited.user.id;

  // Önce marka atamaları, en son aktifleştirme: herhangi bir adım başarısız olursa kullanıcı pasif kalır (hiçbir şey göremez).
  // Tekrar denemede aynı satırlar üzerine yazılır (upsert) — çift kayıt oluşmaz.
  if (role !== "admin" && brandIds.length) {
    const { error: memberError } = await admin.from("brand_members").upsert(brandIds.map((brand_id) => ({ brand_id, user_id: id })));
    if (memberError) return fail("save_failed", `Davet gönderildi ancak marka ataması kaydedilemedi: ${memberError.message}. Aynı bilgilerle tekrar deneyin.`, 500);
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
  if (profileError) return fail("save_failed", `Davet gönderildi ancak profil kaydedilemedi: ${profileError.message}. Aynı bilgilerle tekrar deneyin.`, 500);

  return json({ id, sent: "invite", resent: !!existing });
});
