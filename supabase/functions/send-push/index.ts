// Supabase Edge Function: send-push
// Panel, bildirim kayıtlarını (notifications) yazdıktan sonra bu fonksiyonu kimlikleriyle çağırır; fonksiyon her bildirimi
// alıcısının kayıtlı cihazlarına (push_subscriptions) Web Push ile gönderir. Bildirim içeriği istemciden değil veritabanından okunur.
//
//   body: { ids: string[] }  → yalnızca son 10 dakikada oluşturulmuş ve henüz gönderilmemiş (pushed_at boş) bildirimler gönderilir;
//                              her bildirim bir kez gönderilir. Geçersizleşen abonelikler (404 / 410) silinir.
//
// Gerekli gizli anahtarlar (Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ör. mailto:admin@example.com)
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik sağlanır.
// Yayınlama: Dashboard → Edge Functions → Deploy a new function → adı: send-push → bu kodu yapıştır → Deploy.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Yalnızca POST desteklenir." }, 405);

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY"), privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return json({ error: "VAPID anahtarları tanımlı değil (Edge Functions → Secrets)." }, 500);
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com", publicKey, privateKey);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Çağıran: geçerli oturumu olan aktif bir kullanıcı.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller?.user) return json({ error: "Oturum doğrulanamadı." }, 401);
  const { data: me } = await admin.from("profiles").select("active").eq("id", caller.user.id).single();
  if (!me?.active) return json({ error: "Hesap aktif değil." }, 403);

  let ids: string[] = [];
  try { const body = await req.json(); ids = (Array.isArray(body?.ids) ? body.ids : []).filter((x: unknown) => typeof x === "string" && UUID.test(x)).slice(0, 50); }
  catch { return json({ error: "Geçersiz istek gövdesi." }, 400); }
  if (!ids.length) return json({ sent: 0 });

  // Bildirimleri "gönderildi" olarak işaretleyerek al: aynı bildirim iki kez gönderilmez.
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: notes, error } = await admin.from("notifications").update({ pushed_at: new Date().toISOString() })
    .in("id", ids).is("pushed_at", null).gte("created_at", since)
    .select("id, user_id, task_id, kind, text");
  if (error) return json({ error: error.message }, 500);
  if (!notes?.length) return json({ sent: 0 });

  const userIds = [...new Set(notes.map((n) => n.user_id))];
  const [{ data: subs }, { data: profiles }] = await Promise.all([
    admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds),
    admin.from("profiles").select("id, role, active").in("id", userIds),
  ]);
  const roleOf = new Map((profiles || []).filter((p) => p.active).map((p) => [p.id, p.role]));

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(notes.flatMap((n) => {
    const role = roleOf.get(n.user_id);
    if (!role) return [];
    // Bildirime tıklayınca: müşteri onay portalına, ekip panele gider.
    const url = role === "client" ? "/onay" : "/dashboard";
    const payload = JSON.stringify({ title: "AgencyOS", body: n.text, url, tag: n.task_id || n.id });
    return (subs || []).filter((s) => s.user_id === n.user_id).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
        else console.warn("push gönderilemedi:", code, (err as Error)?.message);
      }
    });
  }));
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return json({ sent, removed: dead.length });
});
