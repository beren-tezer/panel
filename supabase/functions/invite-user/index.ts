// Supabase Edge Function: invite-user
// Kullanıcılar & Yetkiler ekranındaki "Kullanıcı Oluştur" bu fonksiyonu çağırır.
// Yalnızca aktif admin çağırabilir. Kullanıcıya davet e-postası gider; profil rolü, izinleri ve markaları kaydedilir.
//
// Yayınlama:  supabase functions deploy invite-user
// (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik sağlanır.)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ROLES = ["admin", "employee", "client"];
const PERMISSIONS = ["canViewContent", "canEditContent", "canViewTasks", "canUpdateTasks", "canViewBrandFiles", "canAccessApprovals"];

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
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "");
  const brandIds = Array.isArray(body.brandIds) ? body.brandIds.map(String) : [];
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String).filter((p) => PERMISSIONS.includes(p)) : null;
  if (!name) return json({ error: "Ad soyad zorunludur." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Geçerli bir e-posta adresi girin." }, 400);
  if (!ROLES.includes(role)) return json({ error: "Geçersiz rol." }, 400);
  if (role === "client" && !brandIds.length) return json({ error: "Müşteri için en az bir marka seçin." }, 400);

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name, role },
    redirectTo: typeof body.redirectTo === "string" ? body.redirectTo : undefined,
  });
  if (inviteError || !invited?.user) {
    const msg = /already.*registered|exists/i.test(inviteError?.message || "") ? "Bu e-posta ile kayıtlı bir kullanıcı zaten var." : inviteError?.message || "Davet gönderilemedi.";
    return json({ error: msg }, 400);
  }
  const id = invited.user.id;

  const { error: profileError } = await admin.from("profiles").update({
    full_name: name,
    role,
    role_title: String(body.title || "") || null,
    company: role === "client" ? String(body.company || "") || null : null,
    permissions,
    email,
    active: true,
  }).eq("id", id);
  if (profileError) return json({ error: `Profil kaydedilemedi: ${profileError.message}` }, 500);

  if (role !== "admin" && brandIds.length) {
    const { error: memberError } = await admin.from("brand_members").upsert(brandIds.map((brand_id) => ({ brand_id, user_id: id })));
    if (memberError) return json({ error: `Marka ataması kaydedilemedi: ${memberError.message}` }, 500);
  }

  return json({ id });
});
