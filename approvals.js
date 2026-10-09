/*
 * AgencyOS — İçerik sürümleri ve müşteri onay akışı (iş kuralları)
 *
 * Kavramlar (supabase/007_content_approvals.sql ile aynı):
 *   Görev üretim durumu  : tasks.status (Başlanmadı … Müşteri Onayı, Revizyon, Onaylandı, Tamamlandı) — mevcut sistem.
 *   İçerik sürümü        : task_content_versions — her teslim ayrı sürümdür (v1, v2 …). Müşteriye gönderilince kilitlenir;
 *                          dosyaları ve metni bir daha değişmez (müşterinin ne gördüğünün kanıtı).
 *   Onay isteği          : approval_requests — belirli bir sürümün müşteriye gönderilmesi. Durum: pending → approved |
 *                          revision_requested | withdrawn | superseded. Görev başına aynı anda en fazla bir bekleyen istek.
 *   Müşteri kararı       : approvals — bir isteğe en fazla bir karar (veritabanında benzersiz). Karar, isteğin sürümüne bağlıdır.
 */

export const CONTENT_BUCKET = "content-assets";
export const MAX_CONTENT_BYTES = 50 * 1024 * 1024;

/* Uzantı → [MIME, tür]. Liste dışı her şey reddedilir (SVG/HTML gibi çalıştırılabilir içerik dahil). Aynı liste Storage kovasında zorunludur. */
export const CONTENT_FILES = {
  png: ["image/png", "image"], jpg: ["image/jpeg", "image"], jpeg: ["image/jpeg", "image"], webp: ["image/webp", "image"], gif: ["image/gif", "image"],
  mp4: ["video/mp4", "video"], mov: ["video/quicktime", "video"], webm: ["video/webm", "video"],
  pdf: ["application/pdf", "pdf"],
};
export const CONTENT_MIME_TYPES = [...new Set(Object.values(CONTENT_FILES).map(([m]) => m))];
export const CONTENT_ACCEPT = Object.keys(CONTENT_FILES).map((e) => `.${e}`).join(",");
const MIME_ALIASES = { jpg: ["image/pjpeg"], jpeg: ["image/pjpeg"], mov: ["video/mov"] };

export const REQUEST_STATUS = {
  pending: "Onay Bekliyor",
  approved: "Onaylandı",
  revision_requested: "Revizyon İstendi",
  withdrawn: "Geri Çekildi",
  superseded: "Yerine Yeni Sürüm Gönderildi",
};
export const VERSION_STATUS = { draft: "Taslak", ...REQUEST_STATUS, sent: "Müşteriye Gönderildi" };

/* ───────────────────────── Dosya doğrulama ───────────────────────── */

export const extOf = (name) => (String(name).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || "";

export function validateContentFile(file) {
  const ext = extOf(file.name);
  const entry = CONTENT_FILES[ext];
  if (!entry) return { ok: false, error: `“.${ext || "?"}” dosyaları yüklenemez. İzin verilenler: ${Object.keys(CONTENT_FILES).join(", ")}.` };
  const [mime, kind] = entry;
  const reported = String(file.type || "").toLowerCase();
  if (reported && reported !== mime && !(MIME_ALIASES[ext] || []).includes(reported)) return { ok: false, error: `Dosya türü uzantısıyla uyuşmuyor (${reported}).` };
  if (!file.size) return { ok: false, error: "Dosya boş." };
  if (file.size > MAX_CONTENT_BYTES) return { ok: false, error: `Dosya en fazla ${MAX_CONTENT_BYTES / 1024 / 1024} MB olabilir.` };
  return { ok: true, ext, mime, kind };
}

/* ───────────────────────── Durumdan okuma ───────────────────────── */

const byNo = (a, b) => a.versionNo - b.versionNo;
const byRequested = (a, b) => String(a.requestedAt).localeCompare(String(b.requestedAt));

export const versionsOf = (versions, taskId) => versions.filter((v) => v.taskId === taskId).sort(byNo);
export const latestVersion = (versions, taskId) => versionsOf(versions, taskId).at(-1) || null;
export const assetsOf = (assets, versionId) => assets.filter((a) => a.versionId === versionId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
export const requestsOf = (requests, taskId) => requests.filter((r) => r.taskId === taskId).sort(byRequested);
export const pendingRequest = (requests, taskId) => requests.find((r) => r.taskId === taskId && r.status === "pending") || null;
export const latestRequest = (requests, taskId) => requestsOf(requests, taskId).at(-1) || null;

/* Sürümün görünen durumu: kilitlenmemişse taslak; gönderildiyse son isteğinin sonucu. */
export function versionStatus(version, requests) {
  if (!version.lockedAt) return "draft";
  const rs = requests.filter((r) => r.versionId === version.id).sort(byRequested);
  return rs.length ? rs.at(-1).status : "sent";
}

/* Müşterinin şu an karar verebileceği istek ve sürüm (yoksa null). Karar her zaman bu isteğin sürümüne verilir. */
export function reviewTarget(state, taskId) {
  const request = pendingRequest(state.approvalRequests || [], taskId);
  if (!request) return null;
  const version = (state.contentVersions || []).find((v) => v.id === request.versionId) || null;
  return { request, version };
}

/* Revize notu: zorunlu, anlamlı ve sınırlı. */
export function validateRevisionNote(note) {
  const t = String(note || "").trim();
  if (t.length < 5) return "Lütfen revize talebinizi birkaç kelimeyle açıklayın.";
  if (t.length > 2000) return "Revize talebi en fazla 2000 karakter olabilir.";
  return null;
}

/* ───────────────────────── Müşteri onay bağlantısı ───────────────────────── */

const TR = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
export function slugify(name) {
  return String(name || "").toLocaleLowerCase("tr-TR").replace(/[çğıiöşüâîû]/g, (c) => TR[c] || c)
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "marka";
}
export const isValidSlug = (s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(s || "")) && s.length >= 2 && s.length <= 60;
/* "Bağlantıyı Yenile": aynı ad + yeni rastgele ek (eski adres artık hiçbir markaya çözülmez). */
export function rotatedSlug(name) {
  const bytes = new Uint8Array(4);
  (globalThis.crypto || { getRandomValues: (b) => b.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(bytes);
  return `${slugify(name).slice(0, 40)}-${[...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 7)}`;
}

export const PORTAL_PREFIX = "/musteri/";
export const portalPath = (slug) => `${PORTAL_PREFIX}${encodeURIComponent(slug)}`;
export function parsePortalPath(pathname) {
  const m = String(pathname || "").match(/\/musteri\/([^/?#]+)\/?$/);
  if (!m) return null;
  try { const slug = decodeURIComponent(m[1]).toLowerCase(); return isValidSlug(slug) ? slug : ""; } catch { return ""; }
}

/* ───────────────────────── Demo (bellek içi) içerik API'si ───────────────────────── */

/* Supabase uygulamasıyla aynı arayüz. Dosyalar bu oturumda nesne adresi (blob:) olarak tutulur;
   demo verisindeki örnek görseller previewUrl alanını taşır. */
export function createMemoryContent() {
  const blobs = new Map(); // asset id → adres
  const delay = (ms = 60) => new Promise((r) => setTimeout(r, ms));
  const uuid = () => globalThis.crypto.randomUUID();
  return {
    available: true,
    async refresh() { return null; },
    async createVersion(task, state, userId) {
      await delay();
      const last = latestVersion(state.contentVersions || [], task.id);
      if (last && !last.lockedAt) return { taskId: null, contentVersions: [last] };
      const now = new Date().toISOString();
      const v = { id: uuid(), taskId: task.id, versionNo: (last?.versionNo || 0) + 1, caption: last?.caption || "", createdBy: userId, createdAt: now, updatedAt: now, lockedAt: null };
      return { taskId: null, contentVersions: [v] };
    },
    async upload(task, version, file, { onProgress, userId } = {}) {
      const v = validateContentFile(file);
      if (!v.ok) throw new Error(v.error);
      if (version.lockedAt) throw new Error("Bu sürüme dosya ekleme yetkiniz yok (sürüm müşteriye gönderilmiş olabilir).");
      for (let p = 0.25; p < 1; p += 0.25) { onProgress?.(p); await delay(40); }
      const id = uuid();
      blobs.set(id, typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : "");
      onProgress?.(1);
      return { id, versionId: version.id, taskId: task.id, storagePath: `${task.id}/${version.id}/${id}.${v.ext}`, fileName: file.name, mimeType: v.mime, fileSize: file.size, sortOrder: 0, createdBy: userId, createdAt: new Date().toISOString() };
    },
    async removeAsset(asset, version) {
      await delay();
      if (version?.lockedAt) throw new Error("Dosya kaldırılamadı: sürüm müşteriye gönderilmiş veya yetkiniz yok.");
      blobs.delete(asset.id);
    },
    async urls(assets) {
      await delay(20);
      return Object.fromEntries(assets.map((a) => [a.id, a.previewUrl || blobs.get(a.id)]).filter(([, u]) => u));
    },
  };
}
