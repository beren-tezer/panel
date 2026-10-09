/*
 * AgencyOS — görev göstergeleri (teslim zamanı ve revize durumu)
 *
 * Saf fonksiyonlardır; panel ve testler (tests/indicators.test.js) aynı kodu kullanır.
 *   wallClock(date, tz)           → ajans saat dilimindeki tarih/saat ("bugün" bu saate göre belirlenir)
 *   deadlineInfo(task, now, tz)   → { state, label, title }  state: none | upcoming | soon | overdue | done
 *   revisionInfo(task, approvals) → null | { state, label, approval }  state: requested | in_progress | resolved
 */

/* Ajansın çalıştığı saat dilimi. Tarayıcının saat dilimi farklı olsa bile teslim durumları buna göre hesaplanır. */
export const TIMEZONE = "Europe/Istanbul";

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const pad = (n) => String(n).padStart(2, "0");

const formatters = new Map();
function partsIn(date, timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}

/* "Duvar saati" dakikası: saat dilimindeki tarih/saat UTC'ymiş gibi sayılır; iki duvar saati arasındaki fark doğrudan dakika verir. */
const wallMinutes = (y, m, d, h, min) => Date.UTC(y, m - 1, d, h, min) / 6e4;

export function wallClock(date = new Date(), timeZone = TIMEZONE) {
  const p = partsIn(date, timeZone);
  return { iso: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.min)}`, minutes: wallMinutes(p.y, p.m, p.d, p.h, p.min) };
}

/* "16:30", "16:30:00", "9:05" → "16:30" / "09:05"; geçersiz veya boş değer → "" */
export function normalizeTime(v) {
  const m = String(v || "").trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return "";
  const h = +m[1], min = +m[2];
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : "";
}

/* Teslim edilmiş sayılan durumlar: bu görevler gecikmiş olarak işaretlenmez. */
export const DELIVERED_STATUSES = new Set(["Onaylandı", "Tamamlandı"]);
/* Saat girilmemiş görevin son teslimi o günün sonudur. */
const END_OF_DAY = "23:59";
const SOON_MINUTES = 24 * 60;

const isoParts = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d }; };
const dateLabel = (iso, todayIso) => {
  const { y, m, d } = isoParts(iso);
  return `${d} ${AYLAR[m - 1]}${y !== isoParts(todayIso).y ? ` ${y}` : ""}`;
};
const weekday = (iso) => { const { y, m, d } = isoParts(iso); return GUNLER[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };

function lateLabel(mins) {
  if (mins < 60) return `Gecikti · ${Math.max(1, mins)} dk`;
  if (mins < 24 * 60) return `Gecikti · ${Math.floor(mins / 60)} saat`;
  return `Gecikti · ${Math.floor(mins / (24 * 60))} gün`;
}

export function deadlineInfo(task, now = new Date(), timeZone = TIMEZONE) {
  const time = normalizeTime(task.dueTime);
  if (DELIVERED_STATUSES.has(task.status)) {
    return { state: "done", label: "Teslim edildi", title: task.dueDate ? `Teslim edildi · Son teslim: ${fullLabel(task.dueDate, time)}` : "Teslim edildi" };
  }
  if (!task.dueDate) return { state: "none", label: "Tarihsiz", title: "Son teslim tarihi belirtilmemiş" };
  const wall = wallClock(now, timeZone);
  const { y, m, d } = isoParts(task.dueDate);
  const [h, min] = (time || END_OF_DAY).split(":").map(Number);
  const diff = wallMinutes(y, m, d, h, min) - wall.minutes; // > 0: kalan süre, < 0: gecikme
  const title = `Son teslim: ${fullLabel(task.dueDate, time)}`;
  if (diff < 0) return { state: "overdue", label: lateLabel(-diff), title };

  const today = isoParts(wall.iso);
  const dayDelta = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.y, today.m - 1, today.d)) / 864e5);
  const day = dayDelta === 0 ? "Bugün" : dayDelta === 1 ? "Yarın" : dateLabel(task.dueDate, wall.iso);
  const label = time ? `${day}, ${time}` : day;
  const state = dayDelta === 0 || diff <= SOON_MINUTES ? "soon" : "upcoming";
  return { state, label, title };
}

function fullLabel(iso, time) {
  const { y, m, d } = isoParts(iso);
  return `${d} ${AYLAR[m - 1]} ${y} ${weekday(iso)}${time ? `, ${time}` : ""}`;
}

/* ───────────────────────── Revize durumu ───────────────────────── */

export const REVISION_LABELS = { requested: "Revize istendi", in_progress: "Revizyonda", resolved: "Revize tamamlandı" };
const RESOLVED_STATUSES = new Set(["Müşteri Onayı", "Onaylandı", "Tamamlandı"]);

/* Revize talepleri müşterinin onay kayıtlarından (approvals) gelir; sıradan yorumlar revize sayılmaz.
   En son müşteri kararı revize ise:
     görev "Revizyon" durumundaysa      → revize istendi (henüz ele alınmadı)
     ekip tekrar çalışmaya başladıysa   → revizyonda
     tekrar müşteriye sunulduysa/onaylandıysa → revize tamamlandı
   En son karar onay ise ve daha önce revize istenmişse → revize tamamlandı. */
export function revisionInfo(task, approvals) {
  let latest = null, latestRevision = null;
  for (const a of approvals) {
    if (a.taskId !== task.id) continue;
    if (!latest || a.createdAt > latest.createdAt) latest = a;
    if (a.decision === "revision" && (!latestRevision || a.createdAt > latestRevision.createdAt)) latestRevision = a;
  }
  if (!latestRevision) return null;
  let state;
  if (latest.decision !== "revision") state = "resolved";
  else if (task.status === "Revizyon") state = "requested";
  else if (RESOLVED_STATUSES.has(task.status)) state = "resolved";
  else state = "in_progress";
  return { state, label: REVISION_LABELS[state], approval: latestRevision };
}

export const isPendingRevision = (info) => !!info && info.state !== "resolved";

/* ───────────────────────── Çalışan ekranı kutuları ───────────────────────── */

/* Ekrandaki sıra: üst satır 1–4, alt satır 5–8. Her görev tam olarak bir kutuda görünür. */
export const EMPLOYEE_BOXES = [
  { key: "late", title: "Geciken İşler" },
  { key: "active", title: "Aktif İşler" },
  { key: "done", title: "Tamamlananlar" },
  { key: "web", title: "Web İşleri ve Teknik İşler" },
  { key: "manager", title: "Yönetici Onayı" },
  { key: "client", title: "Müşteri Onayı" },
  { key: "other", title: "Diğer Görevler" },
  { key: "ads", title: "Reklam Görevleri" },
];
const SOCIAL_FORMATS = new Set(["Reels", "Gönderi", "Hikâye", "Karusel", "Video"]);
const AD_PLATFORMS = new Set(["Meta Reklam", "Google Reklam"]);

/* Öncelik: teslim edilmiş → onay aşamaları → gecikme → iş türü (web / reklam / sosyal medya içeriği / diğer). */
export function employeeBox(task, now = new Date(), timeZone = TIMEZONE) {
  if (DELIVERED_STATUSES.has(task.status)) return "done";
  if (task.status === "Yönetici Onayı") return "manager";
  if (task.status === "Müşteri Onayı") return "client";
  if (task.status === "Gecikti" || deadlineInfo(task, now, timeZone).state === "overdue") return "late";
  if (task.format === "Web" || task.platform === "Web Sitesi") return "web";
  if (task.format === "Reklam" || AD_PLATFORMS.has(task.platform)) return "ads";
  if (SOCIAL_FORMATS.has(task.format)) return "active";
  return "other";
}
