/*
 * AgencyOS — Görev ekleri ve marka dosyaları için doğrudan dosya yükleme
 *
 *   Dosya tarayıcıdan "file-upload" Edge Function'ına gönderilir; fonksiyon dosyayı Google Drive'da (hizmet hesabı)
 *   markanın klasörüne yükler, bağlantıyla paylaşır ve kaydı (attachments / assets, drive_url = webContentLink)
 *   çağıranın yetkisiyle ekler. Panel kayıt biçimi değişmez: yüklenen dosya da bağlantılı bir kayıttır.
 *
 *   Görev eki    → <marka klasörü>/Görev Ekleri          (görsel, video, PDF)
 *   Marka dosyası → <marka klasörü>/<panel klasörü adı>   (görsel, vektör, video, PDF, font, arşiv, ofis)
 *
 * Uzantı listeleri supabase/functions/file-upload ile aynıdır: liste dışı (ör. HTML, çalıştırılabilir) dosya istemcide
 * de sunucuda da reddedilir. Arayüz metinlerinde depo adı geçmez ("Dosya Yükle", "Dosyayı Aç").
 */

export const UPLOAD_FUNCTION = "file-upload";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

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

export const cleanFileName = (name) => String(name || "dosya").replace(/[\u0000-\u001f\\/]+/g, " ").trim().slice(0, 200) || "dosya";

/* Marka dosyası hangi klasöre? Açık klasör varsa o; yoksa türe göre (sunucu da aynı eşlemeyi kullanır). */
const FOLDER_FOR_TYPE = { "Görsel": "gorseller", "Vektör": "logolar", "Video": "video", "PDF": "kimlik", "Font": "fontlar", "Arşiv": "arsiv", "Şablon": "sablonlar", "Doküman": "sablonlar" };
export const folderForUpload = (type, openFolderId) => openFolderId || FOLDER_FOR_TYPE[type] || "gorseller";

/* ───────────────────────── Yüklenen dosyanın bağlantıları ───────────────────────── */

/* Kayıttaki bağlantıdan dosya kimliği (…/file/d/<id>/… veya …?id=<id>). */
export const fileIdOf = (url) => (String(url || "").match(/\/file\/d\/([\w-]+)/) || String(url || "").match(/[?&]id=([\w-]+)/) || [])[1] || null;
/* Panelden yüklenen dosya: fonksiyonun kaydettiği indirme bağlantısı (webContentLink) biçimi. */
export const isUploadedFile = (item) => /^https:\/\/drive\.google\.com\/uc\?/.test(String(item?.driveUrl || ""));
/* Gömülebilir önizleme (video, PDF) ve büyük görsel adresi; dosya bağlantıyla paylaşıldığı için oturum gerekmez. */
export const embedUrlOf = (item) => { const id = fileIdOf(item?.driveUrl); return id ? `https://drive.google.com/file/d/${id}/preview` : null; };
export const imageUrlOf = (item, width = 1600) => {
  if (String(item?.thumbnail || "").startsWith("blob:")) return item.thumbnail; // demo
  const id = fileIdOf(item?.driveUrl);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}` : item?.thumbnail || "";
};
export const mimeOf = (item) => (BRAND_FILE_TYPES[extOf(item?.name)] || [""])[0];

/* Fonksiyonun döndürdüğü hata iletisi; yoksa durum koduna göre. */
export function uploadErrorMessage(status, body, maxBytes = MAX_UPLOAD_BYTES) {
  let msg = "";
  try { const b = typeof body === "string" ? JSON.parse(body) : body; msg = b?.error || b?.message || ""; } catch { /* gövde yok */ }
  if (msg && !/function (was )?not found/i.test(msg)) return msg; // fonksiyon yayınlanmamışsa ağ geçidi iletisi gösterilmez
  if (status === 404) return "Dosya yükleme henüz yapılandırılmadı. Yöneticiye bildirin.";
  if (status === 413) return `Dosya çok büyük. En fazla ${formatBytes(maxBytes)} yüklenebilir.`;
  if (status === 415) return "Bu dosya türü yüklenemez.";
  if (status === 401) return "Oturumunuz sona ermiş. Sayfayı yenileyip tekrar giriş yapın.";
  if (status === 403) return "Bu dosyayı yükleme yetkiniz yok.";
  return `Yükleme başarısız (${status || "ağ hatası"}).`;
}

export class UploadAbortedError extends Error {
  constructor() { super("Yükleme iptal edildi."); this.name = "UploadAbortedError"; this.aborted = true; }
}

/* Fonksiyona XHR ile gönderim (supabase-js ilerleme bildirmez). Gönderim bitince %99'da bekler: dosya o sırada
   depoya aktarılır; yanıt gelince kayıt döner. signal (AbortController) ile iptal edilir. */
export function xhrUpload({ url, key, token, params, file, mime, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new UploadAbortedError()); return; }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${url}/functions/v1/${UPLOAD_FUNCTION}?${new URLSearchParams(params)}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.timeout = 5 * 60 * 1000;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.min(0.99, e.loaded / e.total)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).row); } catch { reject(new Error("Yükleme yanıtı okunamadı. Sayfayı yenileyin.")); }
      } else reject(new Error(uploadErrorMessage(xhr.status, xhr.responseText)));
    };
    xhr.onerror = () => reject(new Error("Bağlantı hatası: dosya yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin."));
    xhr.ontimeout = () => reject(new Error("Yükleme zaman aşımına uğradı. Tekrar deneyin."));
    xhr.onabort = () => reject(new UploadAbortedError());
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/* ───────────────────────── Demo (bellek içi) ───────────────────────── */

/* Kayıt biçimleri (panel alanları) — gerçek kaynakta bu alanları fonksiyonun eklediği satır verir. */
export const attachmentFromUpload = ({ id, taskId, file, check, link, thumbnail = null, userId, internal = false, now = new Date().toISOString() }) => ({
  id, taskId, assetId: null, name: cleanFileName(file.name), type: check.type, size: formatBytes(file.size), thumbnail, driveUrl: link,
  addedBy: userId, createdAt: now, internal: !!internal,
});

export const assetFromUpload = ({ id, brandId, folderId, file, check, link, thumbnail = null, userId, today = new Date().toISOString().slice(0, 10) }) => ({
  id, brandId, folderId: folderForUpload(check.type, folderId), name: cleanFileName(file.name), type: check.type, thumbnail,
  driveFileId: fileIdOf(link), driveUrl: link, size: formatBytes(file.size), owner: userId, approvalStatus: "Onay Bekliyor", updatedAt: today,
});

/* Görseller tarayıcıda nesne adresi olarak gösterilir (sayfa yenilenince kaybolur). Testler için:
   globalThis.__cwSimulateUploadError = true | "ileti" → sonraki yükleme ağ hatasıyla düşer. */
export function createMemoryFiles() {
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
    const fileId = `demo${uuid().replace(/-/g, "")}`;
    const blob = check.type === "Görsel" && typeof Blob !== "undefined" && file instanceof Blob ? URL.createObjectURL(file) : null;
    return { check, link: `https://drive.google.com/uc?id=${fileId}&export=download`, thumbnail: blob };
  };
  return {
    available: true,
    async uploadAttachment(task, file, { internal, userId, onProgress, signal } = {}) {
      const { check, link, thumbnail } = await run(file, TASK_FILE_TYPES, onProgress, signal);
      return attachmentFromUpload({ id: uuid(), taskId: task.id, file, check, link, thumbnail, userId, internal });
    },
    async uploadAsset(brandId, folderId, file, { userId, onProgress, signal } = {}) {
      const { check, link, thumbnail } = await run(file, BRAND_FILE_TYPES, onProgress, signal);
      return assetFromUpload({ id: uuid(), brandId, folderId, file, check, link, thumbnail, userId });
    },
    async remove() { /* demo: depo yok */ },
  };
}
