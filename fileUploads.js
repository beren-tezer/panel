/*
 * AgencyOS — Görev ekleri ve marka dosyaları için doğrudan dosya yükleme (Supabase Storage)
 *
 *   Görev eki    → "task-files" kovası,  yol: <görev id>/<dosya id>.<uzantı>   (görsel, video, PDF)
 *   Marka dosyası → "brand-files" kovası, yol: <marka id>/<dosya id>.<uzantı>  (görsel, vektör, video, PDF, font, arşiv, ofis)
 *
 * Kovalar özeldir (herkese açık adres yoktur); dosyalar süreli imzalı adreslerle açılır. Erişim kuralları
 * supabase/014_file_uploads.sql'de görev / marka kayıtlarının kurallarıyla aynıdır. Uzantı listeleri kovaların
 * MIME listeleriyle aynıdır: liste dışı (ör. HTML, çalıştırılabilir) dosya istemcide de sunucuda da reddedilir.
 */

export const TASK_FILES_BUCKET = "task-files";
export const BRAND_FILES_BUCKET = "brand-files";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // Supabase ücretsiz planında tek dosya sınırı da 50 MB
export const SIGNED_URL_SECONDS = 10 * 60;

/* Uzantı → [MIME, panel türü] */
const IMAGE = { png: ["image/png", "Görsel"], jpg: ["image/jpeg", "Görsel"], jpeg: ["image/jpeg", "Görsel"], webp: ["image/webp", "Görsel"], gif: ["image/gif", "Görsel"] };
const VIDEO = { mp4: ["video/mp4", "Video"], mov: ["video/quicktime", "Video"], webm: ["video/webm", "Video"] };
const PDF = { pdf: ["application/pdf", "PDF"] };
export const TASK_FILE_TYPES = { ...IMAGE, ...VIDEO, ...PDF };
export const BRAND_FILE_TYPES = {
  ...IMAGE, ...VIDEO, ...PDF,
  svg: ["image/svg+xml", "Vektör"], ai: ["application/postscript", "Vektör"], eps: ["application/postscript", "Vektör"],
  psd: ["image/vnd.adobe.photoshop", "Görsel"],
  ttf: ["font/ttf", "Font"], otf: ["font/otf", "Font"], woff: ["font/woff", "Font"], woff2: ["font/woff2", "Font"],
  zip: ["application/zip", "Arşiv"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Doküman"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "Şablon"],
};
export const acceptOf = (types) => Object.keys(types).map((e) => `.${e}`).join(",");
export const mimeListOf = (types) => [...new Set(Object.values(types).map(([m]) => m))];

/* Tarayıcıların aynı dosya için bildirebildiği diğer MIME adları (uzantı yine esas alınır). */
const MIME_ALIASES = {
  jpg: ["image/pjpeg"], jpeg: ["image/pjpeg"], mov: ["video/mov"], zip: ["application/x-zip-compressed", "application/x-zip"],
  ai: ["application/illustrator", "application/pdf"], eps: ["application/eps", "image/x-eps"], psd: ["application/x-photoshop", "image/x-photoshop", "application/octet-stream"],
  ttf: ["application/x-font-ttf", "font/sfnt", "application/octet-stream"], otf: ["application/x-font-otf", "font/sfnt", "application/octet-stream"],
  woff: ["application/font-woff", "application/octet-stream"], woff2: ["application/octet-stream"],
};

export const extOf = (name) => (String(name).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || "";

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/* { ok: true, ext, mime, type } | { ok: false, error } */
export function validateUploadFile(file, types = TASK_FILE_TYPES, maxBytes = MAX_UPLOAD_BYTES) {
  const ext = extOf(file?.name);
  const entry = types[ext];
  if (!entry) return { ok: false, error: `“.${ext || "?"}” dosyaları yüklenemez. İzin verilenler: ${Object.keys(types).join(", ")}.` };
  const [mime, type] = entry;
  const reported = String(file.type || "").toLowerCase();
  if (reported && reported !== mime && !(MIME_ALIASES[ext] || []).includes(reported)) return { ok: false, error: `Dosya türü uzantısıyla uyuşmuyor (${reported}).` };
  if (!file.size) return { ok: false, error: "Dosya boş." };
  if (file.size > maxBytes) return { ok: false, error: `Dosya çok büyük (${formatBytes(file.size)}). En fazla ${formatBytes(maxBytes)} yüklenebilir.` };
  return { ok: true, ext, mime, type };
}

/* Depolama yolu: <üst kayıt id>/<dosya id>.<uzantı>. Dosya adı yola girmez (Türkçe / özel karakter sorunu yok); adı kayıtta durur. */
export const storagePathFor = (ownerId, fileId, ext) => `${ownerId}/${fileId}.${ext}`;
export const cleanFileName = (name) => String(name || "dosya").replace(/[\u0000-\u001f\\/]+/g, " ").trim().slice(0, 200) || "dosya";

/* Marka dosyası hangi klasöre? Açık klasör varsa o; yoksa türe göre. */
const FOLDER_FOR_TYPE = { "Görsel": "gorseller", "Vektör": "logolar", "Video": "video", "PDF": "kimlik", "Font": "fontlar", "Arşiv": "arsiv", "Şablon": "sablonlar", "Doküman": "sablonlar" };
export const folderForUpload = (type, openFolderId) => openFolderId || FOLDER_FOR_TYPE[type] || "gorseller";

/* Yüklemeden doğan hata iletisi (Storage REST yanıtı). */
export function uploadErrorMessage(status, body, maxBytes = MAX_UPLOAD_BYTES) {
  let msg = "";
  try { const b = typeof body === "string" ? JSON.parse(body) : body; msg = b?.message || b?.error || ""; } catch { /* gövde yok */ }
  if (status === 413 || /size|large|exceeded/i.test(msg)) return `Dosya çok büyük. En fazla ${formatBytes(maxBytes)} yüklenebilir.`;
  if (status === 415 || /mime|content type|not supported/i.test(msg)) return "Bu dosya türü yüklenemez.";
  if (status === 401 || /jwt|expired/i.test(msg)) return "Oturumunuz sona ermiş. Sayfayı yenileyip tekrar giriş yapın.";
  if (status === 403 || /security|policy|unauthorized|permission/i.test(msg)) return "Bu dosyayı yükleme yetkiniz yok.";
  if (status === 409 || /exists|duplicate/i.test(msg)) return "Aynı adla bir dosya zaten var. Tekrar deneyin.";
  if (/bucket not found/i.test(msg)) return "Dosya deposu bulunamadı. supabase/014_file_uploads.sql çalıştırılmalı.";
  return msg ? `Yükleme başarısız: ${msg}` : `Yükleme başarısız (${status || "ağ hatası"}).`;
}

export class UploadAbortedError extends Error {
  constructor() { super("Yükleme iptal edildi."); this.name = "UploadAbortedError"; this.aborted = true; }
}

/* Storage REST uç noktasına XHR ile yükleme: supabase-js ilerleme bildirmez. signal (AbortController) ile iptal edilir. */
export function xhrUpload({ url, key, token, bucket, path, file, mime, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new UploadAbortedError()); return; }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${url}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.min(0.99, e.loaded / e.total)); };
    xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error(uploadErrorMessage(xhr.status, xhr.responseText))); };
    xhr.onerror = () => reject(new Error("Bağlantı hatası: dosya yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin."));
    xhr.ontimeout = () => reject(new Error("Yükleme zaman aşımına uğradı. Tekrar deneyin."));
    xhr.onabort = () => reject(new UploadAbortedError());
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/* ───────────────────────── Kayıt biçimleri (panel alanları) ───────────────────────── */

export const attachmentFromUpload = ({ id, taskId, file, check, path, userId, internal = false, now = new Date().toISOString() }) => ({
  id, taskId, assetId: null, name: cleanFileName(file.name), type: check.type, size: formatBytes(file.size), thumbnail: null, driveUrl: "",
  storagePath: path, mimeType: check.mime, fileSize: file.size, addedBy: userId, createdAt: now, internal: !!internal,
});

export const assetFromUpload = ({ id, brandId, folderId, file, check, path, userId, today = new Date().toISOString().slice(0, 10) }) => ({
  id, brandId, folderId: folderForUpload(check.type, folderId), name: cleanFileName(file.name), type: check.type, thumbnail: null,
  driveFileId: null, driveUrl: "", size: formatBytes(file.size), owner: userId, approvalStatus: "Onay Bekliyor", updatedAt: today,
  storagePath: path, mimeType: check.mime, fileSize: file.size,
});

/* Hangi kovada? Görev eki → task-files, marka dosyası → brand-files. */
export const bucketOf = (item) => (item && "taskId" in item ? TASK_FILES_BUCKET : BRAND_FILES_BUCKET);

/* ───────────────────────── Demo (bellek içi) ───────────────────────── */

/* Dosyalar tarayıcıda nesne adresi olarak tutulur (sayfa yenilenince kaybolur). Testler için:
   globalThis.__cwSimulateUploadError = true | "ileti" → sonraki yükleme ağ hatasıyla düşer. */
export function createMemoryFiles() {
  const blobs = new Map(); // depolama yolu → adres
  const uuid = () => globalThis.crypto.randomUUID();
  const run = async (file, types, onProgress, signal) => {
    const check = validateUploadFile(file, types);
    if (!check.ok) throw new Error(check.error);
    for (let p = 0.2; p < 1; p += 0.2) {
      if (signal?.aborted) throw new UploadAbortedError();
      onProgress?.(p);
      await new Promise((r) => setTimeout(r, 90));
    }
    if (signal?.aborted) throw new UploadAbortedError();
    const fail = globalThis.__cwSimulateUploadError;
    if (fail) { globalThis.__cwSimulateUploadError = null; throw new Error(typeof fail === "string" ? fail : "Bağlantı hatası: dosya yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin."); }
    onProgress?.(1);
    return check;
  };
  const keep = (path, file) => blobs.set(path, typeof Blob !== "undefined" && file instanceof Blob ? URL.createObjectURL(file) : "");
  return {
    available: true,
    async uploadAttachment(task, file, { internal, userId, onProgress, signal } = {}) {
      const check = await run(file, TASK_FILE_TYPES, onProgress, signal);
      const id = uuid(), path = storagePathFor(task.id, id, check.ext);
      keep(path, file);
      return attachmentFromUpload({ id, taskId: task.id, file, check, path, userId, internal });
    },
    async uploadAsset(brandId, folderId, file, { userId, onProgress, signal } = {}) {
      const check = await run(file, BRAND_FILE_TYPES, onProgress, signal);
      const id = uuid(), path = storagePathFor(brandId, id, check.ext);
      keep(path, file);
      return assetFromUpload({ id, brandId, folderId, file, check, path, userId });
    },
    async urls(items) { return Object.fromEntries(items.filter((i) => blobs.get(i.storagePath)).map((i) => [i.storagePath, blobs.get(i.storagePath)])); },
    async remove(items) { items.forEach((i) => blobs.delete(i.storagePath)); },
  };
}
