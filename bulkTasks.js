/*
 * AgencyOS — Toplu Görev Girişi: satır modeli, yapıştırma ayrıştırma, eşleştirme ve doğrulama
 *
 * Arayüzden bağımsızdır (birim testleri: tests/bulkTasks.test.js). Satırlar mevcut görev modeline (tasks)
 * dönüştürülür; ek bir veri modeli yoktur. Her satırın kalıcı istemci kimliği (id) ve kayıtta kullanılacak
 * görev kimliği (taskId) vardır — tekrar denemede aynı görev ikinci kez oluşturulmaz.
 */

export const BULK_FORMATS = ["Reels", "Gönderi", "Hikâye", "Karusel", "Video", "Web", "Reklam", "Rapor"];
export const BULK_PLATFORMS = ["Instagram", "TikTok", "Facebook", "LinkedIn", "YouTube", "Web Sitesi", "Meta Reklam", "Google Reklam"];
export const MAX_BULK_ROWS = 500;

/* Düzenlenebilir sütunlar (Sıra ve İşlemler hariç). field: satırdaki değer alanı. */
export const BULK_COLUMNS = [
  { key: "brand", label: "Marka", type: "brand", field: "brandId", width: 190 },
  { key: "title", label: "Görev Başlığı", type: "text", field: "title", width: 320 },
  { key: "platform", label: "Platform", type: "option", field: "platform", width: 150 },
  { key: "format", label: "Görev Türü", type: "option", field: "format", width: 130 },
  { key: "dueDate", label: "Bitiş Tarihi", type: "date", field: "dueDate", width: 160 },
  { key: "assignee", label: "Atanan Kişi", type: "user", field: "assigneeId", width: 190 },
];
export const COLUMN_KEYS = BULK_COLUMNS.map((c) => c.key);

const AYLAR = ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"];
const pad = (n) => String(n).padStart(2, "0");
export const norm = (s) => String(s ?? "").toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const uuid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16)));

/* ───────────────────────── Satır modeli ───────────────────────── */

/* bad: eşleştirilemeyen ham değerler (ör. bilinmeyen marka adı) — kullanıcıya gösterilir, asla sessizce kaydedilmez. */
export function newRow(carry = null) {
  return {
    id: uuid(), taskId: uuid(),
    brandId: carry?.brandId || "", title: "", platform: carry?.platform || "Instagram", format: carry?.format || "Gönderi",
    dueDate: "", dueTime: "", assigneeId: carry?.assigneeId || "", bad: {}, saved: null,
  };
}

/* Çoğaltma: yeni kimlikler, kaydedilmemiş durumda. */
export const duplicateRow = (row) => ({ ...row, id: uuid(), taskId: uuid(), bad: { ...row.bad }, saved: null });

/* Önceki satırdan taşınan alanlar (başlık taşınmaz). */
export const carryFrom = (row) => (row ? { brandId: row.brandId, platform: row.platform, format: row.format, assigneeId: row.assigneeId } : null);

/* Kullanıcının bir şey yazmadığı satır (varsayılan platform/format ve taşınan değerler tek başına "dolu" sayılmaz). */
export function isEmptyRow(row) {
  return !row.title.trim() && !row.dueDate && !row.dueTime && !Object.values(row.bad || {}).some(Boolean);
}

/* ───────────────────────── Eşleştirme ───────────────────────── */

export function resolveBrand(text, brands) {
  const t = norm(text);
  if (!t) return { value: "" };
  const partial = t.length >= 3 ? brands.filter((b) => norm(b.name).includes(t)) : [];
  const hit = brands.find((b) => norm(b.name) === t) || brands.find((b) => norm(b.initials) === t) || (partial.length === 1 ? partial[0] : null);
  return hit ? { value: hit.id } : { bad: String(text).trim() };
}

export function resolveUser(text, users) {
  const t = norm(text);
  if (!t || t === "atanmamis" || t === "-") return { value: "" };
  const firstName = users.filter((u) => norm(u.name).split(" ")[0] === t);
  const hit = users.find((u) => norm(u.name) === t) || users.find((u) => norm(u.email) === t) || (firstName.length === 1 ? firstName[0] : null);
  return hit ? { value: hit.id } : { bad: String(text).trim() };
}

const FORMAT_ALIASES = {
  reels: "Reels", reel: "Reels", post: "Gönderi", gonderi: "Gönderi", "tekli gonderi": "Gönderi", story: "Hikâye", stories: "Hikâye", hikaye: "Hikâye",
  carousel: "Karusel", karusel: "Karusel", karosel: "Karusel", video: "Video", web: "Web", reklam: "Reklam", ads: "Reklam", ad: "Reklam", rapor: "Rapor", report: "Rapor",
};
export function resolveFormat(text) {
  const t = norm(text);
  if (!t) return { value: "" };
  const v = FORMAT_ALIASES[t] || BULK_FORMATS.find((f) => norm(f) === t);
  return v ? { value: v } : { bad: String(text).trim() };
}

const PLATFORM_ALIASES = { ig: "Instagram", insta: "Instagram", instagram: "Instagram", tiktok: "TikTok", tt: "TikTok", fb: "Facebook", facebook: "Facebook",
  linkedin: "LinkedIn", youtube: "YouTube", yt: "YouTube", web: "Web Sitesi", "web sitesi": "Web Sitesi", website: "Web Sitesi", site: "Web Sitesi",
  "meta reklam": "Meta Reklam", "meta ads": "Meta Reklam", meta: "Meta Reklam", "google reklam": "Google Reklam", "google ads": "Google Reklam", google: "Google Reklam" };
export function resolvePlatform(text) {
  const t = norm(text);
  if (!t) return { value: "" };
  const v = PLATFORM_ALIASES[t] || BULK_PLATFORMS.find((p) => norm(p) === t);
  return v ? { value: v } : { bad: String(text).trim() };
}

const toISO = (y, m, d) => {
  const dt = new Date(y, m - 1, d, 12);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};
const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(y, m - 1, d + n, 12); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`; };

/* Tarih: 12.11.2026, 12/11/26, 12.11 (bu yıl), 2026-11-12, 12 Kasım (2026), bugün / yarın, Excel seri numarası. */
export function parseDate(text, today) {
  const raw = String(text ?? "").trim();
  const t = norm(raw);
  if (!t) return { value: "" };
  if (t === "bugun") return { value: today };
  if (t === "yarin") return { value: addDays(today, 1) };
  const year = Number(today.slice(0, 4));
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t ].*)?$/);
  let v = m ? toISO(+m[1], +m[2], +m[3]) : null;
  if (!v && (m = t.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?$/))) v = toISO(m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : year, +m[2], +m[1]);
  if (!v && (m = t.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/))) {
    const mi = AYLAR.findIndex((a) => a.startsWith(m[2].slice(0, 3)));
    if (mi >= 0) v = toISO(m[3] ? +m[3] : year, mi + 1, +m[1]);
  }
  if (!v && /^\d{5}$/.test(t)) { // Excel tarih seri numarası (1900 sistemi)
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(t) * 864e5);
    v = toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return v ? { value: v } : { bad: raw };
}

/* Saat: 16:30, 16.30, 1630, 9:05, 16 → 16:00. */
export function parseTime(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return { value: "" };
  let m = raw.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/) || raw.match(/^(\d{2})(\d{2})$/);
  if (!m && (m = raw.match(/^(\d{1,2})$/))) m = [raw, m[1], "00"];
  if (m && +m[1] < 24 && +m[2] < 60) return { value: `${pad(+m[1])}:${m[2]}` };
  return { bad: raw };
}

/* Bir sütuna metin değeri yazar (yazma, yapıştırma, toplu atama). Eşleşmeyen değer bad'de tutulur. */
export function setCell(row, key, text, ctx) {
  const col = BULK_COLUMNS.find((c) => c.key === key);
  if (!col || row.saved) return row;
  let r;
  switch (col.type) {
    case "text": return { ...row, title: String(text ?? "").replace(/\s*\r?\n\s*/g, " ").slice(0, 300) };
    case "brand": r = resolveBrand(text, ctx.brands); break;
    case "user": r = resolveUser(text, ctx.users); break;
    case "date": r = parseDate(text, ctx.today); break;
    case "time": r = parseTime(text); break;
    default: r = key === "format" ? resolveFormat(text) : resolvePlatform(text);
  }
  const bad = { ...row.bad };
  if (r.bad != null) bad[key] = r.bad; else delete bad[key];
  return { ...row, [col.field]: r.bad != null ? "" : r.value, bad };
}

/* Bir sütuna doğrudan geçerli değer yazar (açılır listeden seçim). */
export function setValue(row, key, value) {
  const col = BULK_COLUMNS.find((c) => c.key === key);
  if (!col || row.saved) return row;
  const bad = { ...row.bad };
  delete bad[key];
  return { ...row, [col.field]: value, bad };
}

export const clearCell = (row, key) => {
  if (row.saved) return row;
  const bad = { ...row.bad };
  delete bad[key];
  const col = BULK_COLUMNS.find((c) => c.key === key);
  const empty = { platform: "Instagram", format: "Gönderi" }[key] ?? "";
  return { ...row, [col.field]: empty, bad };
};

/* Hücrenin görünen / kopyalanan metni. */
export function cellText(row, key, ctx) {
  if (row.bad?.[key] != null) return row.bad[key];
  switch (key) {
    case "brand": return ctx.brands.find((b) => b.id === row.brandId)?.name || "";
    case "assignee": return ctx.users.find((u) => u.id === row.assigneeId)?.name || "";
    case "dueDate": { if (!row.dueDate) return ""; const [y, m, d] = row.dueDate.split("-"); return `${d}.${m}.${y}`; }
    default: return row[BULK_COLUMNS.find((c) => c.key === key).field] || "";
  }
}

/* ───────────────────────── Doğrulama ───────────────────────── */

const LABEL_ERRORS = {
  brand: (v) => `Marka bulunamadı: “${v}”.`, assignee: (v) => `Ekip üyesi bulunamadı: “${v}”.`, format: (v) => `Görev türü tanınmadı: “${v}”.`,
  platform: (v) => `Platform tanınmadı: “${v}”.`, dueDate: (v) => `Bitiş tarihi okunamadı: “${v}” (örn. 12.11.2026).`, dueTime: (v) => `Teslim saati okunamadı: “${v}” (örn. 16:30).`,
};

/* { sütun: mesaj }. Tamamen boş ve kaydedilmiş satırlar doğrulanmaz.
   ctx: { brands (kullanıcının yetkili olduğu markalar), users (atanabilir ekip üyeleri) } */
export function validateRow(row, ctx) {
  if (row.saved || isEmptyRow(row)) return {};
  const e = {};
  Object.entries(row.bad || {}).forEach(([k, v]) => { if (v != null && LABEL_ERRORS[k]) e[k] = LABEL_ERRORS[k](v); });
  if (!e.brand) {
    if (!row.brandId) e.brand = "Marka seçilmedi.";
    else if (!ctx.brands.some((b) => b.id === row.brandId)) e.brand = "Bu markaya görev ekleme yetkiniz yok.";
  }
  if (!row.title.trim()) e.title = "Görev başlığı boş bırakılamaz.";
  if (!e.platform && !BULK_PLATFORMS.includes(row.platform)) e.platform = "Platform seçilmedi.";
  if (!e.format && !BULK_FORMATS.includes(row.format)) e.format = "Görev türü seçilmedi.";
  if (!e.dueDate && !row.dueDate) e.dueDate = "Bitiş tarihi girilmedi.";
  if (!e.assignee && row.assigneeId && !ctx.users.some((u) => u.id === row.assigneeId)) e.assignee = "Bu kişiye görev atanamaz.";
  return e;
}

/* Tüm tablo: satır hataları, özet ve "5. satır: …" biçiminde mesaj listesi. */
export function validateSheet(rows, ctx) {
  const errors = {};
  const messages = [];
  let ready = 0, invalid = 0, saved = 0, empty = 0;
  rows.forEach((row, i) => {
    if (row.saved) { saved++; return; }
    if (isEmptyRow(row)) { empty++; return; }
    const e = validateRow(row, ctx);
    if (Object.keys(e).length) {
      errors[row.id] = e; invalid++;
      COLUMN_KEYS.forEach((k) => { if (e[k]) messages.push({ rowId: row.id, col: k, text: `${i + 1}. satır: ${e[k]}` }); });
    } else ready++;
  });
  return { errors, messages, total: rows.length, ready, invalid, saved, empty };
}

/* ───────────────────────── Görev modeline dönüştürme ───────────────────────── */

export function toTask(row, now = new Date().toISOString()) {
  return {
    id: row.taskId, code: null, brandId: row.brandId, title: row.title.trim(), platform: row.platform, format: row.format,
    assigneeId: row.assigneeId || "", status: "Başlanmadı", priority: "Orta", publishDate: row.dueDate, dueDate: row.dueDate, dueTime: "", // saat seçimi yok: gün sonu
    description: "", createdAt: now, updatedAt: now,
  };
}

/* ───────────────────────── Pano (Excel / Google E-Tablolar) ───────────────────────── */

/* TSV: Excel, içinde sekme/satır sonu olan hücreleri tırnakla sarar ("" = tırnak). */
export function parseTSV(text) {
  const s = String(text ?? "").replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (!s) return [];
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows.map((r) => r.map((c) => c.replace(/ /g, " ").trim()));
}

/* Düz metin (yapıştırma penceresi): TSV, Markdown/| tablosu, ; veya , ayrımlı. */
export function parseTable(text) {
  const s = String(text ?? "");
  if (s.includes("\t")) return parseTSV(s);
  return s.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() && !l.trim().startsWith("```")).map((line) => {
    let cells;
    if (line.includes("|")) { let t = line.trim(); if (t.startsWith("|")) t = t.slice(1); if (t.endsWith("|")) t = t.slice(0, -1); cells = t.split("|"); }
    else if (line.includes(";")) cells = line.split(";");
    else if ((line.match(/,/g) || []).length >= 2) cells = splitCsv(line);
    else cells = [line];
    return cells.map((c) => c.replace(/\*\*|__|`/g, "").trim().replace(/^["']+|["']+$/g, "").trim());
  }).filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c) || c === ""));
}
function splitCsv(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}

const HEADER_ALIASES = {
  brand: ["marka", "brand", "musteri", "client"],
  title: ["gorev basligi", "gorev", "baslik", "icerik", "task", "title", "is"],
  platform: ["platform", "kanal", "channel"],
  format: ["gorev turu", "format", "tur", "icerik turu", "type"],
  dueDate: ["bitis tarihi", "bitis", "teslim tarihi", "son teslim", "tarih", "teslim", "deadline", "due date", "due", "date"],
  dueTime: ["teslim saati", "saat", "time", "due time"],
  assignee: ["atanan kisi", "atanan", "sorumlu", "kisi", "ekip uyesi", "assignee", "owner"],
};
/* İlk satır başlık satırıysa sütun eşlemesi döner (en az 2 tanınan sütun). */
export function detectHeader(cells) {
  const map = cells.map((c) => {
    const t = norm(c).replace(/[:*]/g, "").trim();
    return Object.keys(HEADER_ALIASES).find((k) => HEADER_ALIASES[k].includes(t)) || null;
  });
  return map.filter(Boolean).length >= 2 && new Set(map.filter(Boolean)).size === map.filter(Boolean).length ? map : null;
}

/* Yapıştırma: başlık satırı varsa sütunlar ada göre, yoksa seçili sütundan başlayarak sırayla eşlenir.
   Kaydedilmiş satırların üzerine yazılmaz (yeni satır açılır); gerekirse sona satır eklenir. */
export function applyPaste(rows, anchor, matrix, ctx, { carry = false } = {}) {
  if (!matrix.length) return { rows, changed: 0, added: 0, from: anchor.row, to: anchor.row, truncated: false };
  let header = detectHeader(matrix[0]);
  let data = header ? matrix.slice(1) : matrix;
  if (!header) header = matrix[0].map((_, j) => COLUMN_KEYS[COLUMN_KEYS.indexOf(anchor.col) + j] || null);
  data = data.filter((cells) => cells.some((c) => String(c).trim()));
  const out = [...rows];
  let r = anchor.row, added = 0, changed = 0, truncated = false;
  const from = anchor.row;
  for (const cells of data) {
    while (r < out.length && out[r].saved) r++;
    if (r >= out.length) {
      if (out.length >= MAX_BULK_ROWS) { truncated = true; break; }
      out.push(newRow(carry ? carryFrom(out[out.length - 1]) : null)); added++;
    }
    let row = out[r];
    header.forEach((key, j) => { if (key && COLUMN_KEYS.includes(key) && j < cells.length) row = setCell(row, key, cells[j], ctx); });
    out[r] = row; changed++; r++;
  }
  return { rows: out, changed, added, from, to: r - 1, truncated };
}

/* ───────────────────────── Taslak (kullanıcı + çalışma alanı bazında) ───────────────────────── */

export const draftKey = (scope, userId) => `cw:bulk-draft:v1:${scope}:${userId}`;

export function loadDraft(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!Array.isArray(d.rows)) return null;
    const rows = d.rows.filter((r) => r && typeof r.id === "string" && !r.saved).map((r) => ({ ...newRow(), ...r, bad: r.bad || {}, saved: null }));
    return rows.some((r) => !isEmptyRow(r)) ? { rows, savedAt: d.savedAt || null } : null;
  } catch { return null; }
}

/* Yalnızca kaydedilmemiş ve boş olmayan satırlar saklanır; hiçbiri yoksa taslak silinir. */
export function saveDraft(storage, key, rows, now = new Date().toISOString()) {
  try {
    const keep = rows.filter((r) => !r.saved && !isEmptyRow(r));
    if (!keep.length) { storage?.removeItem(key); return 0; }
    storage?.setItem(key, JSON.stringify({ v: 1, savedAt: now, rows: keep }));
    return keep.length;
  } catch { return -1; }
}

export const clearDraft = (storage, key) => { try { storage?.removeItem(key); } catch { /* yok say */ } };
