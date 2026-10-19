/*
 * AgencyOS — Marka Kılavuzu & Bilgi Bankası veri katmanı
 *
 * Kılavuz verisi açılış yükünde gelmez; marka başına, ihtiyaç olduğunda yüklenir (load(brandId)) ve
 * createBrandKitStore ile önbellekte tutulur. İki uygulama var:
 *   createMemoryBrandKit()             → demo (?demo), bellek içi, kalıcı değil
 *   createSupabaseBrandKit(sb, cfg)    → canlı; tablolar ve RLS: supabase/005_brand_kit.sql
 *
 * API (her ikisi de):
 *   load(brandId)                               → { kit, colors, fonts, instructions, assets, links }
 *   createKit(brandId, userId)                  → kit
 *   save(entity, item, userId)                  → kaydedilen öğe (ekle/güncelle)      entity: colors | fonts | instructions | links | assets
 *   remove(entity, item)
 *   reorder(entity, brandId, ids)
 *   upload(brandId, file, meta, { userId, onProgress }) → asset
 *   fileUrl(asset, { download })                → süreli (imzalı) adres
 *   fileUrls(assets)                            → { [assetId]: url }  (küçük resimler)
 *   subscribe?(brandId, onChange)               → abonelikten çıkma
 */

/* ───────────────────────── Sabitler ───────────────────────── */

export const BRAND_ASSET_BUCKET = "brand-assets";
export const MAX_BRAND_FILE_BYTES = 25 * 1024 * 1024;

export const COLOR_TYPES = { primary: "Ana Renk", secondary: "İkincil Renk" };
export const FONT_ROLES = { heading: "Başlık Fontu", body: "Gövde Fontu", support: "Yardımcı Font", alternative: "Alternatif Font" };
export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
export const INSTRUCTION_CATEGORIES = {
  design: { label: "Tasarım Kuralları", hint: "Logo kullanımı, kompozisyon, renk kısıtlamaları, kullanılmaması gereken öğeler" },
  content: { label: "İçerik & Metin Kuralları", hint: "İletişim dili, hitap, yasaklı kelimeler, açıklama formatı, emoji ve hashtag" },
  client: { label: "Müşteri Özel Talepleri", hint: "Özellikle istenen detaylar, onay notları, kampanyada dikkat edilecekler" },
};
export const ASSET_CATEGORIES = {
  logos: "Marka Logoları",
  identity: "Kurumsal Kimlik Dosyaları",
  guide_pdf: "Marka Kılavuzu PDF",
  fonts: "Font Dosyaları",
  social_templates: "Sosyal Medya Şablonları",
  media: "Görsel & Video Varlıkları",
  other: "Diğer Dosyalar",
};
export const LINK_CATEGORIES = { general: "Genel Klasör", ...ASSET_CATEGORIES };
export const VISIBILITY = { internal: "Yalnızca ekip", shared: "Ekip ve müşteri" };

/* İzin verilen dosyalar: uzantı → [MIME, görünen tür]. Liste dışı her şey (html, js, exe, …) reddedilir.
   Aynı MIME listesi Storage kovasında da zorunludur (005). */
export const ALLOWED_FILES = {
  png: ["image/png", "Görsel"], jpg: ["image/jpeg", "Görsel"], jpeg: ["image/jpeg", "Görsel"], webp: ["image/webp", "Görsel"], gif: ["image/gif", "Görsel"],
  svg: ["image/svg+xml", "Vektör"], ai: ["application/postscript", "Vektör"], eps: ["application/postscript", "Vektör"],
  pdf: ["application/pdf", "PDF"],
  ttf: ["font/ttf", "Font"], otf: ["font/otf", "Font"], woff: ["font/woff", "Font"], woff2: ["font/woff2", "Font"],
  zip: ["application/zip", "Arşiv"],
  psd: ["image/vnd.adobe.photoshop", "Şablon"],
  mp4: ["video/mp4", "Video"], mov: ["video/quicktime", "Video"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Doküman"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "Doküman"],
};
/* Tarayıcıların aynı uzantı için bildirebildiği diğer türler (boş tür de kabul edilir; kayıtta kanonik tür kullanılır). */
const MIME_ALIASES = {
  zip: ["application/x-zip-compressed", "application/x-zip"], ttf: ["application/x-font-ttf", "font/sfnt", "application/font-sfnt"],
  otf: ["application/x-font-otf", "font/sfnt", "application/font-sfnt"], woff: ["application/font-woff"], woff2: ["application/font-woff2"],
  ai: ["application/illustrator", "application/pdf"], eps: ["application/eps", "image/x-eps"], psd: ["application/x-photoshop", "image/photoshop", "application/octet-stream"],
  mov: ["video/mov"], jpg: ["image/pjpeg"], jpeg: ["image/pjpeg"],
};
export const ALLOWED_MIME_TYPES = [...new Set(Object.values(ALLOWED_FILES).map(([m]) => m))];
export const ACCEPT_ATTR = Object.keys(ALLOWED_FILES).map((e) => `.${e}`).join(",");
/* Tarayıcıda satır içi gösterilebilen türler (SVG güvenlik nedeniyle yalnızca indirilir; <img> ile önizlenir). */
export const INLINE_VIEWABLE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "video/mp4"]);
export const IMAGE_PREVIEW = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

/* ───────────────────────── Doğrulama ───────────────────────── */

export const normalizeHex = (v) => {
  const s = String(v || "").trim().replace(/^#?/, "#").toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(s)) return s;
  if (/^#[0-9A-F]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return null;
};

export function validateDriveUrl(v) {
  let u;
  try { u = new URL(String(v || "").trim()); } catch { return { ok: false, error: "Geçerli bir bağlantı girin (https://…)." }; }
  if (u.protocol !== "https:") return { ok: false, error: "Bağlantı https:// ile başlamalı." };
  if (!/^(drive|docs)\.google\.com$/.test(u.hostname)) return { ok: false, error: "Bu bağlantı eklenemez. Şirket dosya klasöründeki bir dosya veya klasörün bağlantısını girin." };
  return { ok: true, url: u.toString() };
}

export function validateHttpsUrl(v) {
  if (!String(v || "").trim()) return { ok: true, url: "" };
  try {
    const u = new URL(String(v).trim());
    return u.protocol === "https:" ? { ok: true, url: u.toString() } : { ok: false, error: "Bağlantı https:// ile başlamalı." };
  } catch { return { ok: false, error: "Geçerli bir bağlantı girin (https://…)." }; }
}

export const extensionOf = (name) => (String(name).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || "";

/* Dosya seçildiğinde (yüklemeden önce) çağrılır. ok:false ise kullanıcıya gösterilecek gerekçe döner. */
export function validateUpload(file) {
  const ext = extensionOf(file.name);
  const entry = ALLOWED_FILES[ext];
  if (!entry) return { ok: false, error: `“.${ext || "?"}” uzantılı dosyalar yüklenemez. İzin verilenler: ${Object.keys(ALLOWED_FILES).join(", ")}.` };
  const [mime, label] = entry;
  const reported = (file.type || "").toLowerCase();
  if (reported && reported !== mime && !(MIME_ALIASES[ext] || []).includes(reported)) {
    return { ok: false, error: `Dosya türü uzantısıyla uyuşmuyor (${reported}).` };
  }
  if (!file.size) return { ok: false, error: "Dosya boş." };
  if (file.size > MAX_BRAND_FILE_BYTES) return { ok: false, error: `Dosya en fazla ${MAX_BRAND_FILE_BYTES / 1024 / 1024} MB olabilir.` };
  return { ok: true, ext, mime, label };
}

export function formatBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

const uuid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16)));
export const emptyKitData = () => ({ kit: null, colors: [], fonts: [], instructions: [], assets: [], links: [] });
const ENTITIES = ["colors", "fonts", "instructions", "assets", "links"];
const bySort = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

/* ───────────────────────── Demo (bellek içi) ───────────────────────── */

export function createMemoryBrandKit(seed = {}) {
  const db = {};
  const blobs = new Map(); // storagePath → objectURL
  const get = (brandId) => (db[brandId] = db[brandId] || structuredClone(seed[brandId] || emptyKitData()));
  const touch = (brandId, userId) => { const d = get(brandId); if (d.kit) d.kit = { ...d.kit, updatedAt: new Date().toISOString(), updatedBy: userId }; };
  const delay = () => new Promise((r) => setTimeout(r, 60));
  return {
    async load(brandId) { await delay(); const d = get(brandId); return structuredClone({ ...d, colors: [...d.colors].sort(bySort), fonts: [...d.fonts].sort(bySort) }); },
    async createKit(brandId, userId) {
      const d = get(brandId);
      if (!d.kit) { const now = new Date().toISOString(); d.kit = { brandId, createdAt: now, updatedAt: now, updatedBy: userId }; }
      return { ...d.kit };
    },
    async save(entity, item, userId) {
      if (!ENTITIES.includes(entity)) throw new Error("Bilinmeyen kayıt türü.");
      const d = get(item.brandId);
      if (!d.kit) throw new Error("Önce marka kılavuzu oluşturulmalı.");
      const now = new Date().toISOString();
      const saved = { ...item, updatedAt: now, ...(entity === "instructions" ? { updatedBy: userId } : {}) };
      const i = d[entity].findIndex((x) => x.id === item.id);
      if (i >= 0) d[entity][i] = saved; else d[entity].push({ createdAt: now, ...saved });
      touch(item.brandId, userId);
      return structuredClone(d[entity].find((x) => x.id === item.id));
    },
    async remove(entity, item, userId) {
      const d = get(item.brandId);
      d[entity] = d[entity].filter((x) => x.id !== item.id);
      if (entity === "assets") {
        d.fonts = d.fonts.map((f) => (f.assetId === item.id ? { ...f, assetId: null } : f));
        const url = blobs.get(item.storagePath); if (url) { URL.revokeObjectURL?.(url); blobs.delete(item.storagePath); }
      }
      touch(item.brandId, userId);
    },
    async reorder(entity, brandId, ids, userId) {
      const d = get(brandId);
      d[entity] = d[entity].map((x) => ({ ...x, sortOrder: ids.indexOf(x.id) }));
      touch(brandId, userId);
    },
    async upload(brandId, file, meta, { userId, onProgress } = {}) {
      const v = validateUpload(file);
      if (!v.ok) throw new Error(v.error);
      const d = get(brandId);
      if (!d.kit) throw new Error("Önce marka kılavuzu oluşturulmalı.");
      for (let p = 0.2; p < 1; p += 0.2) { onProgress?.(p); await delay(); }
      const id = uuid();
      const storagePath = `${brandId}/${id}.${v.ext}`;
      blobs.set(storagePath, URL.createObjectURL(file));
      const asset = {
        id, brandId, fileName: file.name, fileType: v.label, mimeType: v.mime, fileSize: file.size, storagePath,
        category: meta.category, description: meta.description || "", visibility: meta.visibility, uploadedBy: userId, createdAt: new Date().toISOString(),
      };
      d.assets.push(asset);
      touch(brandId, userId);
      onProgress?.(1);
      return { ...asset };
    },
    async fileUrl(asset) {
      const url = blobs.get(asset.storagePath);
      if (!url) throw new Error("Dosya bulunamadı (demo verisinde yalnızca bu oturumda yüklenen dosyalar açılabilir).");
      return url;
    },
    async fileUrls(assets) { return Object.fromEntries(assets.filter((a) => blobs.has(a.storagePath)).map((a) => [a.id, blobs.get(a.storagePath)])); },
  };
}

/* ───────────────────────── Supabase ───────────────────────── */

const TABLES = { colors: "brand_kit_colors", fonts: "brand_kit_fonts", instructions: "brand_kit_instructions", assets: "brand_kit_assets", links: "brand_kit_links" };

const MAP = {
  colors: {
    from: (r) => ({ id: r.id, brandId: r.brand_id, name: r.name, hex: r.hex_code, usage: r.usage_description || "", type: r.color_type, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at }),
    to: (c) => ({ id: c.id, brand_id: c.brandId, name: c.name, hex_code: c.hex, usage_description: c.usage || "", color_type: c.type, sort_order: c.sortOrder ?? 0 }),
  },
  fonts: {
    from: (r) => ({ id: r.id, brandId: r.brand_id, family: r.font_family, role: r.font_role, weights: r.font_weights || [], usage: r.usage_description || "", assetId: r.font_asset_id, referenceUrl: r.reference_url || "", sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at }),
    to: (f) => ({ id: f.id, brand_id: f.brandId, font_family: f.family, font_role: f.role, font_weights: f.weights || [], usage_description: f.usage || "", font_asset_id: f.assetId || null, reference_url: f.referenceUrl || null, sort_order: f.sortOrder ?? 0 }),
  },
  instructions: {
    from: (r) => ({ id: r.id, brandId: r.brand_id, category: r.category, title: r.title, content: r.content || "", important: !!r.important, visibility: r.visibility, sortOrder: r.sort_order, updatedBy: r.updated_by, updatedAt: r.updated_at, createdAt: r.created_at }),
    to: (i) => ({ id: i.id, brand_id: i.brandId, category: i.category, title: i.title, content: i.content || "", important: !!i.important, visibility: i.visibility, sort_order: i.sortOrder ?? 0 }),
  },
  assets: {
    from: (r) => ({ id: r.id, brandId: r.brand_id, fileName: r.file_name, fileType: r.file_type, mimeType: r.mime_type, fileSize: r.file_size, storagePath: r.storage_path, category: r.category, description: r.description || "", visibility: r.visibility, uploadedBy: r.uploaded_by, createdAt: r.created_at }),
    // Yüklemeden sonra yalnızca açıklama, kategori ve görünürlük değiştirilebilir.
    to: (a) => ({ category: a.category, description: a.description || "", visibility: a.visibility }),
  },
  links: {
    from: (r) => ({ id: r.id, brandId: r.brand_id, title: r.title, url: r.url, category: r.category, description: r.description || "", visibility: r.visibility, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at }),
    to: (l) => ({ id: l.id, brand_id: l.brandId, title: l.title, url: l.url, category: l.category, description: l.description || "", visibility: l.visibility }),
  },
};
const rowToKit = (r) => (r ? { brandId: r.brand_id, createdAt: r.created_at, updatedAt: r.updated_at, updatedBy: r.updated_by } : null);
const SIGNED_SECONDS = 10 * 60;

export function createSupabaseBrandKit(supabase, { url, key } = {}) {
  const must = ({ data, error }) => { if (error) throw friendly(error); return data; };
  const storage = () => supabase.storage.from(BRAND_ASSET_BUCKET);

  return {
    async load(brandId) {
      const q = (table, order = "created_at") => supabase.from(table).select("*").eq("brand_id", brandId).order(order, { ascending: true });
      const [kit, colors, fonts, instructions, assets, links] = await Promise.all([
        supabase.from("brand_kits").select("*").eq("brand_id", brandId).maybeSingle(),
        q(TABLES.colors, "sort_order"), q(TABLES.fonts, "sort_order"), q(TABLES.instructions, "sort_order"), q(TABLES.assets), q(TABLES.links),
      ]);
      return {
        kit: rowToKit(must(kit)),
        colors: must(colors).map(MAP.colors.from), fonts: must(fonts).map(MAP.fonts.from), instructions: must(instructions).map(MAP.instructions.from),
        assets: must(assets).map(MAP.assets.from), links: must(links).map(MAP.links.from),
      };
    },
    async createKit(brandId) {
      return rowToKit(must(await supabase.from("brand_kits").upsert({ brand_id: brandId }, { onConflict: "brand_id", ignoreDuplicates: false }).select().single()));
    },
    async save(entity, item) {
      const table = TABLES[entity];
      if (!table) throw new Error("Bilinmeyen kayıt türü.");
      const row = MAP[entity].to(item);
      const res = entity === "assets"
        ? await supabase.from(table).update(row).eq("id", item.id).select().single()
        : await supabase.from(table).upsert(row).select().single();
      return MAP[entity].from(must(res));
    },
    async remove(entity, item) {
      must(await supabase.from(TABLES[entity]).delete().eq("id", item.id));
      // Kayıt silindikten sonra dosya da kaldırılır. Başarısız olursa kayıt zaten yoktur; yetim nesne
      // 005'teki temizleme sorgusuyla bulunabilir.
      if (entity === "assets") {
        const { error } = await storage().remove([item.storagePath]);
        if (error) console.warn("Dosya Storage'dan silinemedi:", error.message);
      }
    },
    async reorder(entity, brandId, ids) {
      await Promise.all(ids.map((id, i) => supabase.from(TABLES[entity]).update({ sort_order: i }).eq("id", id).eq("brand_id", brandId).then(must)));
    },
    async upload(brandId, file, meta, { onProgress } = {}) {
      const v = validateUpload(file);
      if (!v.ok) throw new Error(v.error);
      const id = uuid();
      const path = `${brandId}/${id}.${v.ext}`;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Oturumunuz sona ermiş. Tekrar giriş yapın.");
      // supabase-js yükleme ilerlemesi vermez; Storage REST uç noktasına XHR ile yüklenir.
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${url}/storage/v1/object/${BRAND_ASSET_BUCKET}/${path}`);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("apikey", key);
        xhr.setRequestHeader("Content-Type", v.mime);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
          let msg = `Yükleme başarısız (${xhr.status}).`;
          try { const b = JSON.parse(xhr.responseText); msg = storageMessage(b.message || b.error, xhr.status) || msg; } catch { /* gövde yok */ }
          reject(new Error(msg));
        };
        xhr.onerror = () => reject(new Error("Bağlantı hatası: dosya yüklenemedi."));
        xhr.send(file);
      });
      const res = await supabase.from(TABLES.assets).insert({
        id, brand_id: brandId, file_name: file.name, file_type: v.label, mime_type: v.mime, file_size: file.size, storage_path: path,
        category: meta.category, description: meta.description || "", visibility: meta.visibility,
      }).select().single();
      if (res.error) {
        await storage().remove([path]); // kaydı oluşmayan dosya geride kalmaz
        throw friendly(res.error);
      }
      onProgress?.(1);
      return MAP.assets.from(res.data);
    },
    async fileUrl(asset, { download } = {}) {
      const data = must(await storage().createSignedUrl(asset.storagePath, SIGNED_SECONDS, download ? { download: asset.fileName } : undefined));
      return data.signedUrl;
    },
    async fileUrls(assets) {
      if (!assets.length) return {};
      const rows = must(await storage().createSignedUrls(assets.map((a) => a.storagePath), SIGNED_SECONDS));
      const byPath = Object.fromEntries(rows.filter((r) => r.signedUrl && !r.error).map((r) => [r.path, r.signedUrl]));
      return Object.fromEntries(assets.filter((a) => byPath[a.storagePath]).map((a) => [a.id, byPath[a.storagePath]]));
    },
    subscribe(brandId, onChange) {
      const channel = supabase.channel(`brand-kit-${brandId}`);
      ["brand_kits", ...Object.values(TABLES)].forEach((table) => {
        channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `brand_id=eq.${brandId}` }, onChange);
      });
      channel.subscribe();
      return () => { supabase.removeChannel(channel); };
    },
  };
}

function storageMessage(msg, status) {
  if (status === 413 || /size|too large/i.test(msg || "")) return `Dosya en fazla ${MAX_BRAND_FILE_BYTES / 1024 / 1024} MB olabilir.`;
  if (/mime|type/i.test(msg || "")) return "Bu dosya türü yüklenemez.";
  if (status === 403 || /row-level security|unauthorized|policy/i.test(msg || "")) return "Bu markaya dosya yükleme yetkiniz yok.";
  if (status === 409 || /exists/i.test(msg || "")) return "Bu dosya zaten yüklenmiş.";
  return msg;
}
function friendly(error) {
  const m = error?.message || "İşlem tamamlanamadı.";
  if (error?.code === "42501" || /row-level security|permission denied/i.test(m)) return new Error("Bu işlem için yetkiniz yok.");
  if (error?.code === "23505") return new Error("Bu kayıt zaten mevcut.");
  if (error?.code === "23514") return new Error("Girilen değer geçersiz.");
  if (error?.code === "42P01") return new Error("Marka kılavuzu tabloları bulunamadı. supabase/005_brand_kit.sql çalıştırılmalı.");
  return new Error(m);
}

/* ───────────────────────── Önbellek / mağaza ───────────────────────── */

/* Marka başına yükleme durumu ve veri. İyimser güncelleme: değişiklik önce yerelde uygulanır, sunucu
   reddederse önceki hali geri yüklenir. Bileşenler useSyncExternalStore ile abone olur. */
export function createBrandKitStore(api) {
  const entries = new Map(); // brandId → { status, data, error }
  const listeners = new Set();
  const inflight = new Map();
  const pendingWrites = new Map(); // brandId → sayı (yazma sürerken canlı yenileme ertelenir)
  const emit = () => listeners.forEach((l) => l());
  const set = (brandId, patch) => { entries.set(brandId, { ...(entries.get(brandId) || { status: "idle", data: null, error: null }), ...patch }); emit(); };

  function load(brandId, { force = false, silent = false } = {}) {
    const cur = entries.get(brandId);
    if (!force && cur && (cur.status === "ready" || cur.status === "loading")) return inflight.get(brandId) || Promise.resolve(cur.data);
    if (!silent || !cur || !cur.data) set(brandId, { status: "loading", error: null });
    const p = api.load(brandId).then(
      (data) => { if (inflight.get(brandId) === p) { inflight.delete(brandId); set(brandId, { status: "ready", data, error: null }); } return data; },
      (error) => { if (inflight.get(brandId) === p) { inflight.delete(brandId); set(brandId, cur && cur.data && silent ? { status: "ready" } : { status: "error", error }); } throw error; },
    );
    inflight.set(brandId, p);
    return p;
  }

  async function mutate(brandId, optimistic, remote, apply) {
    const before = entries.get(brandId)?.data;
    if (optimistic && before) set(brandId, { data: optimistic(before) });
    pendingWrites.set(brandId, (pendingWrites.get(brandId) || 0) + 1);
    try {
      const result = await remote();
      const cur = entries.get(brandId)?.data;
      if (apply && cur) set(brandId, { data: apply(cur, result) });
      return result;
    } catch (err) {
      if (optimistic && before) set(brandId, { data: before }); // geri al
      throw err;
    } finally {
      pendingWrites.set(brandId, pendingWrites.get(brandId) - 1);
    }
  }

  const replaceIn = (list, item) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? { ...x, ...item } : x)) : [...list, item]);
  const touchKit = (d, userId) => (d.kit ? { ...d.kit, updatedAt: new Date().toISOString(), updatedBy: userId } : d.kit);

  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get: (brandId) => entries.get(brandId),
    load,
    /* Canlı değişiklik: kısa gecikmeyle sessiz yeniden yükleme (kendi yazmalarımız sürerken beklenir). */
    refresh(brandId) {
      if (!entries.has(brandId)) return;
      const tryLoad = () => { if ((pendingWrites.get(brandId) || 0) > 0) { setTimeout(tryLoad, 400); return; } load(brandId, { force: true, silent: true }).catch(() => {}); };
      setTimeout(tryLoad, 300);
    },
    createKit: (brandId, userId) => mutate(brandId, null, () => api.createKit(brandId, userId), (d, kit) => ({ ...d, kit })),
    save: (entity, item, userId) => mutate(item.brandId,
      (d) => {
        // Sunucu yanıtı gelene kadar gösterilecek geçici zaman damgaları.
        const now = new Date().toISOString();
        const prev = d[entity].find((x) => x.id === item.id);
        const draft = { createdAt: prev?.createdAt || now, ...item, updatedAt: now, ...(entity === "instructions" ? { updatedBy: userId } : {}) };
        return { ...d, kit: touchKit(d, userId), [entity]: replaceIn(d[entity], draft) };
      },
      () => api.save(entity, item, userId),
      (d, saved) => ({ ...d, [entity]: replaceIn(d[entity], saved) })),
    remove: (entity, item, userId) => mutate(item.brandId,
      (d) => ({
        ...d, kit: touchKit(d, userId), [entity]: d[entity].filter((x) => x.id !== item.id),
        ...(entity === "assets" ? { fonts: d.fonts.map((f) => (f.assetId === item.id ? { ...f, assetId: null } : f)) } : {}),
      }),
      () => api.remove(entity, item, userId)),
    reorder: (entity, brandId, ids, userId) => mutate(brandId,
      (d) => ({ ...d, kit: touchKit(d, userId), [entity]: ids.map((id, i) => ({ ...d[entity].find((x) => x.id === id), sortOrder: i })) }),
      () => api.reorder(entity, brandId, ids, userId)),
    upload: (brandId, file, meta, opts) => mutate(brandId, null, () => api.upload(brandId, file, meta, opts),
      (d, asset) => ({ ...d, kit: touchKit(d, opts?.userId), assets: [...d.assets, asset] })),
    fileUrl: (asset, opts) => api.fileUrl(asset, opts),
    fileUrls: (assets) => api.fileUrls(assets),
    watch: (brandId, onChange) => (api.subscribe ? api.subscribe(brandId, onChange) : () => {}),
  };
}
