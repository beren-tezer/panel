// Supabase Edge Function: file-upload
// Görev detayı "Ekler" ve "Marka Dosyaları" ekranındaki "Dosya Yükle" bu fonksiyonu çağırır. Dosya Google Drive'a
// (hizmet hesabı / Service Account ile) markanın klasörüne yüklenir, "bağlantıya sahip olan herkes görüntüleyebilir"
// olarak paylaşılır ve bağlantısı (webContentLink) attachments / assets tablosuna kaydedilir.
//
//   POST ?kind=task&id=<görev id>&name=<dosya adı>&internal=0|1     gövde: dosyanın kendisi   → attachments satırı
//   POST ?kind=brand&id=<marka id>&name=<dosya adı>&folder=<klasör>  gövde: dosyanın kendisi   → assets satırı
//   POST ?action=delete   { "fileIds": ["…"] }   → artık hiçbir kayıtta geçmeyen, bu fonksiyonun yüklediği dosyaları çöpe taşır
//
// Yetki: kayıt çağıranın oturumuyla eklenir; tablo kuralları (RLS) aynen uygulanır. Yükleme öncesi aynı koşullar ayrıca
// denetlenir (yetkisiz kişi Drive'a dosya bırakamasın). Kayıt eklenemezse yüklenen dosya geri silinir.
//
// Klasör: markada geçerli bir Ortak Drive klasörü (brands.drive_folder_id) varsa o; yoksa DRIVE_ROOT_FOLDER_ID altında
// marka adıyla klasör açılır ve markaya kaydedilir. Alt klasörler: "Görev Ekleri" ve marka dosyası klasör adları.
// Hizmet hesabının kendi depolama kotası yoktur: kök klasör bir Ortak Drive'da (Shared Drive) olmalıdır.
//
// Gizli değerler (Dashboard → Edge Functions → Secrets):
//   GOOGLE_SERVICE_ACCOUNT_JSON : Google Cloud'dan indirilen JSON anahtar dosyasının TAMAMI
//   DRIVE_ROOT_FOLDER_ID        : Ortak Drive'daki ana klasörün kimliği (adres çubuğunda …/folders/<kimlik>)
// Yayınlama:  supabase functions deploy file-upload   (veya Dashboard → Edge Functions → Deploy a new function → file-upload)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string, status: number) => json({ error }, status);

// fileUploads.js MAX_UPLOAD_BYTES / TASK_FILE_TYPES / BRAND_FILE_TYPES ile aynı (ikisi birlikte güncellenmeli).
const MAX_BYTES = 50 * 1024 * 1024;
const IMAGE = { png: ["image/png", "Görsel"], jpg: ["image/jpeg", "Görsel"], jpeg: ["image/jpeg", "Görsel"], webp: ["image/webp", "Görsel"], gif: ["image/gif", "Görsel"] };
const VIDEO = { mp4: ["video/mp4", "Video"], mov: ["video/quicktime", "Video"], webm: ["video/webm", "Video"] };
const PDF = { pdf: ["application/pdf", "PDF"] };
const TASK_TYPES: Record<string, string[]> = { ...IMAGE, ...VIDEO, ...PDF };
const BRAND_TYPES: Record<string, string[]> = {
  ...IMAGE, ...VIDEO, ...PDF,
  svg: ["image/svg+xml", "Vektör"], ai: ["application/postscript", "Vektör"], eps: ["application/postscript", "Vektör"],
  psd: ["image/vnd.adobe.photoshop", "Görsel"],
  ttf: ["font/ttf", "Font"], otf: ["font/otf", "Font"], woff: ["font/woff", "Font"], woff2: ["font/woff2", "Font"],
  zip: ["application/zip", "Arşiv"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Doküman"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "Şablon"],
};
// AgencyWorkspace.jsx FOLDERS ile aynı adlar; fileUploads.js folderForUpload ile aynı tür → klasör eşlemesi.
const FOLDER_NAMES: Record<string, string> = {
  logolar: "Logolar & Vektöreller", kimlik: "Kurumsal Kimlik Rehberi", fontlar: "Fontlar", gorseller: "Görsel Kütüphanesi",
  video: "Video & Reels", sablonlar: "Sosyal Medya Şablonları", kampanyalar: "Kampanyalar", arsiv: "Arşiv",
};
const FOLDER_FOR_TYPE: Record<string, string> = { "Görsel": "gorseller", "Vektör": "logolar", "Video": "video", "PDF": "kimlik", "Font": "fontlar", "Arşiv": "arsiv", "Şablon": "sablonlar", "Doküman": "sablonlar" };
const TASK_FOLDER = "Görev Ekleri";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);
const cleanName = (name: string) => name.replace(/[\u0000-\u001f\\/]+/g, " ").trim().slice(0, 200) || "dosya";

/* ───────────────────────── Google: hizmet hesabı erişim anahtarı ───────────────────────── */

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };
let cachedToken: { value: string; until: number } | null = null;

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function serviceAccount(): ServiceAccount {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("not_configured");
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key) throw new Error("not_configured");
  return sa;
}

async function googleToken(): Promise<string> {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.value;
  const sa = serviceAccount();
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive", aud: tokenUri, iat: now, exp: now + 3600,
  }))}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`google_auth: ${body.error_description || body.error || res.status}`);
  cachedToken = { value: body.access_token, until: Date.now() + (Number(body.expires_in || 3600) - 300) * 1000 };
  return cachedToken.value;
}

const API = "https://www.googleapis.com/drive/v3";
async function drive(path: string, init: RequestInit = {}, params: Record<string, string> = {}) {
  const url = new URL(path.startsWith("http") ? path : `${API}${path}`);
  url.searchParams.set("supportsAllDrives", "true");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await googleToken()}`, ...(init.headers || {}) } });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || "";
    throw Object.assign(new Error(`drive ${res.status} ${reason}: ${body?.error?.message || ""}`), { status: res.status, reason });
  }
  return body;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const folderPromises = new Map<string, Promise<string>>(); // aynı anda gelen yüklemeler aynı klasörü iki kez açmasın

function findOrCreateFolder(parent: string, name: string): Promise<string> {
  const key = `${parent}/${name}`;
  if (!folderPromises.has(key)) {
    const p = (async () => {
      const list = await drive("/files", {}, {
        q: `'${q(parent)}' in parents and name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
        fields: "files(id)", includeItemsFromAllDrives: "true", corpora: "allDrives", pageSize: "1",
      });
      if (list.files?.[0]?.id) return list.files[0].id as string;
      const made = await drive("/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }) }, { fields: "id" });
      return made.id as string;
    })();
    p.catch(() => folderPromises.delete(key));
    folderPromises.set(key, p);
  }
  return folderPromises.get(key)!;
}

/* Markanın klasörü: kayıtlı klasör Ortak Drive'da ve erişilebilirse o; değilse kök altında marka adıyla açılır. */
async function brandFolder(admin: SupabaseClient, brandId: string): Promise<string> {
  const { data: brand, error } = await admin.from("brands").select("id, name, drive_folder_id").eq("id", brandId).single();
  if (error || !brand) throw new Error("brand_not_found");
  if (brand.drive_folder_id) {
    try {
      const f = await drive(`/files/${encodeURIComponent(brand.drive_folder_id)}`, {}, { fields: "id, mimeType, driveId, trashed" });
      if (f.mimeType === FOLDER_MIME && f.driveId && !f.trashed) return f.id;
    } catch { /* hizmet hesabıyla paylaşılmamış veya Ortak Drive'da değil → kök altındaki klasör kullanılır */ }
  }
  const root = Deno.env.get("DRIVE_ROOT_FOLDER_ID");
  if (!root) throw new Error("not_configured");
  const id = await findOrCreateFolder(root, cleanName(brand.name));
  if (!brand.drive_folder_id) await admin.from("brands").update({ drive_folder_id: id }).eq("id", brandId);
  return id;
}

async function uploadToDrive(folder: string, name: string, mime: string, bytes: Uint8Array, props: Record<string, string>) {
  const init = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,webContentLink,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await googleToken()}`, "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(bytes.byteLength),
    },
    body: JSON.stringify({ name, mimeType: mime, parents: [folder], appProperties: { agencyos: "1", ...props } }),
  });
  const session = init.headers.get("Location");
  if (!init.ok || !session) {
    const body = await init.json().catch(() => ({}));
    throw Object.assign(new Error(`drive ${init.status}: ${body?.error?.message || "oturum açılamadı"}`), { status: init.status, reason: body?.error?.errors?.[0]?.reason || "" });
  }
  const put = await fetch(session, { method: "PUT", headers: { "Content-Type": mime }, body: bytes });
  const file = await put.json().catch(() => ({}));
  if (!put.ok || !file.id) throw new Error(`drive ${put.status}: ${file?.error?.message || "yükleme tamamlanamadı"}`);
  // Panelde kaydı görebilen herkes (müşteri dahil) açabilsin: bağlantıya sahip olan herkes görüntüleyebilir.
  await drive(`/files/${file.id}/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "reader", type: "anyone" }) });
  return { id: file.id as string, link: (file.webContentLink || file.webViewLink || `https://drive.google.com/uc?id=${file.id}&export=download`) as string };
}

const trash = (id: string) => drive(`/files/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });

/* Kullanıcıya gösterilecek ileti (Drive ayrıntısı yalnızca sunucu loguna yazılır). */
function userMessage(err: unknown): [string, number] {
  const e = err as { message?: string; status?: number; reason?: string };
  console.error("file-upload:", e?.message || err);
  const m = e?.message || "";
  if (m === "not_configured") return ["Dosya yükleme henüz yapılandırılmadı. Yöneticiye bildirin.", 503];
  if (m === "brand_not_found") return ["Marka bulunamadı.", 404];
  if (m.startsWith("google_auth")) return ["Dosya deposuna bağlanılamadı. Yöneticiye bildirin.", 502];
  if (e?.reason === "storageQuotaExceeded" || e?.reason === "teamDriveFileLimitExceeded") return ["Dosya deposunda yer kalmadı. Yöneticiye bildirin.", 507];
  if (e?.status === 404 || e?.status === 403) return ["Dosya klasörüne erişilemedi. Yöneticiye bildirin.", 502];
  return ["Dosya yüklenemedi. Biraz sonra tekrar deneyin.", 502];
}

/* ───────────────────────── İstek ───────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Yalnızca POST desteklenir.", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const auth = req.headers.get("Authorization") || "";
  // Çağıranın oturumuyla çalışan istemci: okuma ve kayıt RLS'ten geçer.
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false }, global: { headers: { Authorization: auth } } });
  const { data: caller, error: callerError } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (callerError || !caller?.user) return fail("Oturumunuz sona ermiş. Sayfayı yenileyip tekrar giriş yapın.", 401);
  const { data: me } = await admin.from("profiles").select("role, active").eq("id", caller.user.id).single();
  if (!me?.active || !["admin", "employee"].includes(me.role)) return fail("Dosya yükleme yetkiniz yok.", 403);
  const rpc = async (fn: string, args: Record<string, unknown> = {}) => (await asUser.rpc(fn, args)).data === true;

  const params = new URL(req.url).searchParams;

  /* ── Silme: kaydı kaldırılan ek / görevden sonra çağrılır ── */
  if (params.get("action") === "delete") {
    let ids: string[] = [];
    try { ids = ((await req.json()).fileIds || []).map(String).filter((id: string) => /^[\w-]{10,}$/.test(id)).slice(0, 50); } catch { /* boş */ }
    const removed: string[] = [];
    for (const id of ids) {
      try {
        // Yalnızca bu fonksiyonun yüklediği ve artık hiçbir ekte / marka dosyasında geçmeyen dosya silinir.
        const f = await drive(`/files/${encodeURIComponent(id)}`, {}, { fields: "id, appProperties" });
        if (f.appProperties?.agencyos !== "1") continue;
        const [{ count: a }, { count: b }] = await Promise.all([
          admin.from("attachments").select("id", { count: "exact", head: true }).like("drive_url", `%${id}%`),
          admin.from("assets").select("id", { count: "exact", head: true }).or(`drive_file_id.eq.${id},drive_url.like.*${id}*`),
        ]);
        if ((a ?? 1) > 0 || (b ?? 1) > 0) continue;
        await trash(id);
        removed.push(id);
      } catch (err) { console.warn("file-upload silme:", id, (err as Error).message); }
    }
    return json({ removed });
  }

  /* ── Yükleme ── */
  const kind = params.get("kind");
  const ownerId = params.get("id") || "";
  const name = cleanName(params.get("name") || "");
  if ((kind !== "task" && kind !== "brand") || !UUID.test(ownerId)) return fail("Geçersiz istek.", 400);
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || "";
  const entry = (kind === "task" ? TASK_TYPES : BRAND_TYPES)[ext];
  if (!entry) return fail(`“.${ext || "?"}” dosyaları yüklenemez.`, 415);
  const [mime, type] = entry;
  const declared = Number(req.headers.get("Content-Length") || 0);
  if (declared > MAX_BYTES) return fail(`Dosya çok büyük. En fazla ${formatBytes(MAX_BYTES)} yüklenebilir.`, 413);

  // Yetki ön denetimi (tablo kurallarıyla aynı koşullar); kesin denetim kayıt eklenirken RLS'te.
  let brandId = ownerId;
  if (kind === "task") {
    const { data: task } = await asUser.from("tasks").select("id, brand_id").eq("id", ownerId).maybeSingle();
    if (!task) return fail("Görev bulunamadı veya erişiminiz yok.", 404);
    if (!(await rpc("has_perm", { p: "canEditContent" }))) return fail("Bu göreve dosya ekleme yetkiniz yok.", 403);
    brandId = task.brand_id;
  } else {
    const ok = me.role === "admin" || ((await rpc("has_brand", { b: ownerId })) && (await rpc("has_perm", { p: "canViewBrandFiles" })));
    if (!ok) return fail("Bu markaya dosya yükleme yetkiniz yok.", 403);
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.byteLength) return fail("Dosya boş.", 400);
  if (bytes.byteLength > MAX_BYTES) return fail(`Dosya çok büyük. En fazla ${formatBytes(MAX_BYTES)} yüklenebilir.`, 413);

  let uploaded: { id: string; link: string };
  let folderId = "";
  try {
    const root = await brandFolder(admin, brandId);
    if (kind === "brand") folderId = FOLDER_NAMES[params.get("folder") || ""] ? params.get("folder")! : FOLDER_FOR_TYPE[type] || "gorseller";
    const target = await findOrCreateFolder(root, kind === "task" ? TASK_FOLDER : FOLDER_NAMES[folderId]);
    uploaded = await uploadToDrive(target, name, mime, bytes, { kind, owner: ownerId });
  } catch (err) {
    const [msg, status] = userMessage(err);
    return fail(msg, status);
  }

  const thumbnail = type === "Görsel" ? `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w640` : null;
  const res = kind === "task"
    ? await asUser.from("attachments").insert({
      task_id: ownerId, asset_id: null, name, type, size_label: formatBytes(bytes.byteLength), thumbnail_url: thumbnail,
      drive_url: uploaded.link, added_by: caller.user.id, internal: params.get("internal") === "1",
    }).select().single()
    : await asUser.from("assets").insert({
      brand_id: ownerId, folder_id: folderId, name, type, thumbnail_url: thumbnail, drive_file_id: uploaded.id, drive_url: uploaded.link,
      size_label: formatBytes(bytes.byteLength), owner_id: caller.user.id, approval_status: "Onay Bekliyor",
    }).select().single();
  if (res.error) {
    await trash(uploaded.id).catch(() => {}); // kaydı oluşturulamayan dosya depoda kalmasın
    console.error("file-upload kayıt:", res.error.message);
    return fail(/row-level security|permission denied/i.test(res.error.message) ? "Bu dosyayı ekleme yetkiniz yok." : "Dosya kaydedilemedi. Tekrar deneyin.", 403);
  }
  return json({ row: res.data });
});
