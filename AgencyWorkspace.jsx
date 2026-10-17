import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { createMemorySource } from "./workspaceData.js";
import { ROUTES, locationKey, navigate, resolveRoute, safeNext, subscribeLocation } from "./router.js";
import { MIN_PASSWORD, validatePasswordChange } from "./passwords.js";
import { callbackErrorMessage } from "./authCallback.js";
import { AGREEMENT_LIMITS, DEFAULT_AGREEMENT, normalizeAgreement, placeholdersIn, splitBlanks, validateAgreement } from "./agreement.js";
import {
  ACCEPT_ATTR, ASSET_CATEGORIES, COLOR_TYPES, FONT_ROLES, FONT_WEIGHTS, IMAGE_PREVIEW, INLINE_VIEWABLE, INSTRUCTION_CATEGORIES, LINK_CATEGORIES,
  MAX_BRAND_FILE_BYTES, VISIBILITY, createBrandKitStore, createMemoryBrandKit, formatBytes, normalizeHex, validateDriveUrl, validateHttpsUrl, validateUpload,
} from "./brandKit.js";
import {
  BULK_COLUMNS, BULK_FORMATS, BULK_PLATFORMS, MAX_BULK_ROWS, applyPaste as bulkApplyPaste, carryFrom as bulkCarry, cellText as bulkCellText,
  clearCell as bulkClearCell, clearDraft as bulkClearDraft, draftKey, duplicateRow as bulkDuplicate, isEmptyRow as bulkIsEmpty, loadDraft,
  newRow as bulkNewRow, parseTSV as bulkParseTSV, parseTable as bulkParseTable, saveDraft as bulkSaveDraft, setCell as bulkSetCell,
  setValue as bulkSetValueRaw, toTask as bulkToTask, validateRow as bulkValidateRow,
} from "./bulkTasks.js";
import {
  CONTENT_ACCEPT, REQUEST_STATUS, VERSION_STATUS, assetsOf, createMemoryContent, latestVersion, parsePortalPath, portalPath, requestsOf, reviewTarget,
  rotatedSlug, slugify, validateContentFile, validateRevisionNote, versionStatus, versionsOf,
} from "./approvals.js";
import {
  EMPLOYEE_BOXES, OPS_BOXES, REVISION_LABELS, deadlineInfo, employeeBox, isPendingRevision, normalizeTime, opsBox, opsMetrics, planDate, revisionInfo, wallClock, weekOfMonth,
} from "./taskIndicators.js";
import {
  CHECK_CATEGORIES, CREATIVE_TASK_TYPES, DEFAULT_TEMPLATE_ITEMS, LOCKED_STATUSES, MAX_TEMPLATE_ITEMS, REVIEW_STATUSES, TASK_TYPES,
  checklistSummary, createMemoryChecklist, currentChecklist, cycleLabel, demoTemplates, incompleteMessage, indexChecklists, itemsOf,
  missingForSubmit, startRevisionCycle, validateTemplate,
} from "./checklist.js";
import {
  CLIENT_STATUS_LABELS, PERMISSION_LABELS, ROLE_ALLOWED_TOGGLES, ROLE_DEFAULT_TOGGLES, ROLE_LABELS, ROLE_TITLES, ROLES, STATUS,
  assignableUsers, authorize, can, canEditBrandKit, canEditContentVersion, canManageChecklists, canViewBrandKit, canViewChecklist, canWorkChecklist, isOpen, permissionsFor, roleOf,
  scopeBrandKit, scopeState, statusOptionsFor,
} from "./rbac.js";
import {
  Activity, AlertTriangle, Archive, ArrowDown, ArrowUp, Bold, BookOpen, Calendar, CalendarDays, CalendarRange, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Circle, ClipboardCheck, EyeOff, KeyRound, Globe, Megaphone, ClipboardList, Clock, Copy, Download, ExternalLink, Eye, File as FileIcon, FileImage, FileText, Film, Flag, Folder, FolderOpen, HardDrive, Heading, History, ListChecks,
  Image as ImageIcon, Inbox, Italic, Layers, LayoutDashboard, LayoutGrid, Link as LinkIcon, List, ListOrdered, Lock, LogOut, Menu, MessageSquare,
  MoreHorizontal, Palette, Paperclip, PenTool, Pencil, Pilcrow, Plus, RefreshCw, RotateCcw, Search, Send, ShieldCheck, SlidersHorizontal, Sparkles, Star, Table, Trash2, Type, Unlink, Bell, Briefcase, UserPlus,
  Upload, User, Users, X,
} from "lucide-react";

/* ───────────────────────── Tarih yardımcıları ───────────────────────── */

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/* "Bugün" ajansın saat dilimine göredir (taskIndicators.js → TIMEZONE). Gün değişince refreshToday() ile güncellenir
   (açık kalan sekme gece yarısını geçebilir). */
let TODAY = wallClock().iso;
const parseISO = (iso) => new Date(`${iso}T12:00:00`);
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const fmtDate = (iso) => { if (!iso) return "Tarihsiz"; const d = parseISO(iso); return `${d.getDate()} ${AYLAR[d.getMonth()].slice(0, 3)}`; };
const fmtDateLong = (iso) => { if (!iso) return "Tarihsiz"; const d = parseISO(iso); return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDateDay = (iso) => `${fmtDateLong(iso)} ${GUNLER[parseISO(iso).getDay()]}`;
const dayDiff = (iso) => Math.round((parseISO(iso) - parseISO(TODAY)) / 864e5);
const relDay = (iso) => { if (!iso) return "Tarihsiz"; const d = dayDiff(iso); if (d === 0) return "Bugün"; if (d === 1) return "Yarın"; if (d === -1) return "Dün"; return fmtDate(iso); };
const fmtDateTime = (ts) => { const d = new Date(ts); const day = toISO(d) === TODAY ? "Bugün" : `${d.getDate()} ${AYLAR[d.getMonth()].slice(0, 3)}`; return `${day} · ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
let WEEK_START, WEEK_END;
function refreshToday() {
  const now = wallClock().iso;
  const changed = now !== TODAY || !WEEK_START;
  TODAY = now;
  WEEK_START = addDays(TODAY, -((parseISO(TODAY).getDay() + 6) % 7));
  WEEK_END = addDays(WEEK_START, 6);
  return changed;
}
refreshToday();

/* ───────────────────────── Genel yardımcılar ───────────────────────── */

/* Kayıt kimlikleri UUID'dir (Supabase sütunlarıyla uyumlu, istemcide üretilir → iyimser ekleme). */
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16)));
const norm = (s) => String(s || "").toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/* Görev açıklaması HTML'i için izin listesi temizleyicisi. Veritabanındaki içerik başka üyelerden
   geldiği için editöre yüklenmeden ve kaydedilmeden önce mutlaka buradan geçer (XSS koruması). */
const SAFE_TAGS = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "A", "IMG", "DIV", "SPAN", "H1", "H2", "H3", "BLOCKQUOTE"]);
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "SVG", "MATH", "FORM", "INPUT", "TEXTAREA", "BUTTON", "SELECT", "LINK", "META", "BASE", "NOSCRIPT"]);
const STORAGE_PATH_RE = /^[\w-]+\/[\w-]+\.(png|jpe?g|gif|webp)$/i;
/* Kaydedilecek biçim: Storage görsellerinin süreli imzalı adresi (src) atılır, yalnızca data-path kalır. */
function toStoredHtml(html) {
  if (!html || typeof DOMParser === "undefined" || !html.includes("data-path")) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.body.querySelectorAll("img[data-path]").forEach((img) => img.removeAttribute("src"));
  return doc.body.innerHTML;
}
function sanitizeHtml(html) {
  if (!html || typeof DOMParser === "undefined") return html ? escHtml(html) : "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const clean = (node) => {
    [...node.childNodes].forEach((el) => {
      if (el.nodeType === 3) return;
      if (el.nodeType !== 1) { el.remove(); return; }
      const tag = el.tagName.toUpperCase();
      if (DROP_TAGS.has(tag)) { el.remove(); return; }
      clean(el);
      if (!SAFE_TAGS.has(tag)) { el.replaceWith(...el.childNodes); return; }
      const href = el.getAttribute("href"), src = el.getAttribute("src"), alt = el.getAttribute("alt"), path = el.getAttribute("data-path");
      [...el.attributes].forEach((a) => el.removeAttribute(a.name));
      if (tag === "A") {
        if (href && /^(https?:|mailto:)/i.test(href.trim())) { el.setAttribute("href", href.trim()); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
      }
      if (tag === "IMG") {
        const okPath = path && STORAGE_PATH_RE.test(path);
        const okSrc = src && /^(https:|data:image\/)/i.test(src.trim());
        if (!okPath && !okSrc) { el.remove(); return; }
        if (okPath) el.setAttribute("data-path", path);
        if (okSrc) el.setAttribute("src", src.trim());
        el.setAttribute("alt", alt || "Görsel");
      }
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}
const initialsOf = (name) => name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toLocaleUpperCase("tr-TR");
const EMPTY = [];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/* Odak yönetimi: açılan pencereye odak taşır, Tab ile dışarı çıkmayı engeller, kapanınca odağı geri verir. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
function useFocusTrap(ref, active = true) {
  // Açan öğe render sırasında yakalanır: içerideki autoFocus, efektlerden önce odağı alır.
  const openerRef = useRef(null);
  const wasActive = useRef(false);
  if (active && !wasActive.current && typeof document !== "undefined") openerRef.current = document.activeElement;
  wasActive.current = active;
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return undefined;
    const previous = openerRef.current;
    const items = () => [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);
    if (!el.contains(document.activeElement)) (items()[0] || el).focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}

function useMediaQuery(query) {
  const get = () => typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : true;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/* Ortak saat (30 sn'de bir): teslim etiketleri ("Gecikti · 2 saat") sayfa yenilenmeden güncellenir.
   Yalnızca onu kullanan bileşenler yeniden çizilir. */
const clock = { now: Date.now(), listeners: new Set(), timer: null };
function subscribeClock(fn) {
  clock.listeners.add(fn);
  if (!clock.timer) {
    clock.now = Date.now();
    clock.timer = setInterval(() => { clock.now = Date.now(); clock.listeners.forEach((l) => l()); }, 30 * 1000);
  }
  return () => {
    clock.listeners.delete(fn);
    if (!clock.listeners.size) { clearInterval(clock.timer); clock.timer = null; }
  };
}
const getClock = () => clock.now;
const useNow = () => useSyncExternalStore(subscribeClock, getClock, getClock);

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* yedek yönteme geç */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

/* ───────────────────────── Sabitler ───────────────────────── */

/* İş akışı: Başlanmadı → Çalışılıyor → (Yönetici Onayı) → Müşteri Onayı → Onaylandı → Tamamlandı (yayınlandı).
   Müşteri revize isterse: Müşteri Onayı → Revizyon → Çalışılıyor → tekrar Müşteri Onayı. */
const STATUSES = ["Başlanmadı", "Çalışılıyor", "Yönetici Onayı", "Müşteri Onayı", "Revizyon", "Onaylandı", "Tamamlandı", "Gecikti"];
const STATUS_META = {
  "Başlanmadı": { cls: "text-slate-600 bg-slate-100 border-slate-200", dot: "bg-slate-400", Icon: Circle },
  "Çalışılıyor": { cls: "text-sky-700 bg-sky-50 border-sky-200", dot: "bg-sky-500", Icon: Activity },
  "Yönetici Onayı": { cls: "text-violet-700 bg-violet-50 border-violet-200", dot: "bg-violet-500", Icon: Clock },
  "Müşteri Onayı": { cls: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500", Icon: MessageSquare },
  "Revizyon": { cls: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-500", Icon: RotateCcw },
  "Onaylandı": { cls: "text-teal-700 bg-teal-50 border-teal-200", dot: "bg-teal-500", Icon: CheckCircle2 },
  "Tamamlandı": { cls: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", Icon: Check },
  "Gecikti": { cls: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500", Icon: AlertTriangle },
};
const PRIORITIES = ["Yüksek", "Orta", "Düşük"];
const PRIORITY_META = {
  "Yüksek": { cls: "text-red-600", dot: "bg-red-500", rank: 0 },
  "Orta": { cls: "text-amber-500", dot: "bg-amber-400", rank: 1 },
  "Düşük": { cls: "text-slate-400", dot: "bg-slate-300", rank: 2 },
};
const PLATFORMS = ["Instagram", "TikTok", "Facebook", "LinkedIn", "YouTube", "Web Sitesi", "Meta Reklam", "Google Reklam"];
const PLATFORM_DOT = {
  Instagram: "bg-pink-500", TikTok: "bg-slate-900", Facebook: "bg-blue-600", LinkedIn: "bg-sky-700",
  YouTube: "bg-red-600", "Web Sitesi": "bg-emerald-600", "Meta Reklam": "bg-indigo-500", "Google Reklam": "bg-amber-500",
};
const FORMATS = ["Reels", "Gönderi", "Hikâye", "Karusel", "Video", "Web", "Reklam", "Rapor"];

const BRAND_COLORS = {
  orange: { tile: "bg-orange-100 text-orange-700", bar: "bg-orange-500", hex: ["#fb923c", "#c2410c"] },
  red: { tile: "bg-red-100 text-red-700", bar: "bg-red-500", hex: ["#f87171", "#b91c1c"] },
  sky: { tile: "bg-sky-100 text-sky-700", bar: "bg-sky-500", hex: ["#38bdf8", "#0369a1"] },
  emerald: { tile: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", hex: ["#34d399", "#047857"] },
  amber: { tile: "bg-amber-100 text-amber-700", bar: "bg-amber-500", hex: ["#fbbf24", "#b45309"] },
  violet: { tile: "bg-violet-100 text-violet-700", bar: "bg-violet-500", hex: ["#a78bfa", "#6d28d9"] },
  indigo: { tile: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500", hex: ["#818cf8", "#4338ca"] },
  rose: { tile: "bg-rose-100 text-rose-700", bar: "bg-rose-500", hex: ["#fb7185", "#be123c"] },
};
const BRAND_COLOR_KEYS = Object.keys(BRAND_COLORS);
const BRAND_COLOR_NAMES = { orange: "Turuncu", red: "Kırmızı", sky: "Mavi", emerald: "Yeşil", amber: "Sarı", violet: "Mor", indigo: "Lacivert", rose: "Pembe" };

const AVATAR_TONES = {
  slate: "bg-slate-900 text-white", violet: "bg-violet-100 text-violet-700", sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700", rose: "bg-rose-100 text-rose-700", amber: "bg-amber-100 text-amber-700",
  orange: "bg-orange-100 text-orange-700", indigo: "bg-indigo-100 text-indigo-700",
};

/* Ekip listesi veri kaynağından yüklenir (bkz. setDirectory). USERS yalnızca aktif üyeleri içerir;
   USER_BY_ID pasif üyeleri de tutar ki eski kayıtlarda isimleri görünsün. */
let USERS = [];
let USER_BY_ID = {};
let ME = null;
let directoryKey = null;
/* USERS: görev atanabilecek aktif ajans çalışanları (müşteriler hariç). ME: işlemi yapan (etkin) kullanıcı. */
function setDirectory(users, meId) {
  if (directoryKey && directoryKey.users === users && directoryKey.me === meId) return;
  directoryKey = { users, me: meId };
  const all = users.map((u) => ({ ...u, color: AVATAR_TONES[u.color] || u.color || AVATAR_TONES.slate }));
  USERS = all.filter((u) => u.active !== false && u.role !== "client");
  USER_BY_ID = Object.fromEntries(all.map((u) => [u.id, u]));
  ME = meId;
}
const userTitle = (u) => u?.title || ROLE_TITLES[u?.role] || "";

const DEMO_USERS = [
  { id: "u1", name: "Ahmet Yıldız", email: "yonetici@example.com", role: "admin", title: "Ajans Yöneticisi", color: "slate" },
  { id: "u2", name: "Ayşe Demir", email: "ayse@example.com", role: "employee", title: "Tasarım Uzmanı", color: "violet" },
  { id: "u3", name: "Burak Yılmaz", email: "burak@example.com", role: "employee", title: "Video Editörü", color: "sky" },
  { id: "u4", name: "Can Şahin", email: "can@example.com", role: "employee", title: "Web Geliştirici", color: "emerald" },
  { id: "u5", name: "Selin Arslan", email: "selin@example.com", role: "employee", title: "İçerik Yazarı", color: "rose" },
  { id: "u6", name: "Elif Tuna", email: "elif@example.com", role: "employee", title: "Sosyal Medya Uzmanı", color: "amber" },
  { id: "c1", name: "Deniz Aydın", email: "deniz@tepeemlak.example", role: "client", title: "Pazarlama Müdürü", company: "Tepe Emlak Gayrimenkul A.Ş.", color: "indigo" },
  { id: "c2", name: "Mert Kaya", email: "mert@sofrapide.example", role: "client", title: "İşletme Sahibi", company: "Sofra Pide Restoran", color: "orange" },
  { id: "c3", name: "Zeynep Erdem", email: "zeynep@veliaclinic.example", role: "client", title: "Klinik Müdürü", company: "Velia Clinic", color: "rose" },
];
const DEMO_CLIENT_BRANDS = { c1: ["b-tepe"], c2: ["b-sofra"], c3: ["b-velia"] };

const FOLDERS = [
  { id: "logolar", name: "Logolar & Vektöreller", Icon: PenTool },
  { id: "kimlik", name: "Kurumsal Kimlik Rehberi", Icon: FileText },
  { id: "fontlar", name: "Fontlar", Icon: Type },
  { id: "gorseller", name: "Görsel Kütüphanesi", Icon: ImageIcon },
  { id: "video", name: "Video & Reels", Icon: Film },
  { id: "sablonlar", name: "Sosyal Medya Şablonları", Icon: LayoutGrid },
  { id: "kampanyalar", name: "Kampanyalar", Icon: Sparkles },
  { id: "arsiv", name: "Arşiv", Icon: Archive },
];
const FOLDER_BY_ID = Object.fromEntries(FOLDERS.map((f) => [f.id, f]));

const FILE_TYPES = {
  "Görsel": { Icon: ImageIcon, cls: "bg-sky-50 text-sky-600" },
  "Vektör": { Icon: PenTool, cls: "bg-orange-50 text-orange-600" },
  "PDF": { Icon: FileText, cls: "bg-red-50 text-red-600" },
  "Font": { Icon: Type, cls: "bg-violet-50 text-violet-600" },
  "Video": { Icon: Film, cls: "bg-indigo-50 text-indigo-600" },
  "Şablon": { Icon: LayoutGrid, cls: "bg-emerald-50 text-emerald-600" },
  "Arşiv": { Icon: Archive, cls: "bg-slate-100 text-slate-600" },
  "Doküman": { Icon: FileIcon, cls: "bg-slate-100 text-slate-600" },
};
const FILE_TYPE_KEYS = Object.keys(FILE_TYPES);
const APPROVALS = ["Onaylandı", "Onay Bekliyor", "Revizyon"];
const APPROVAL_META = {
  "Onaylandı": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "Onay Bekliyor": "text-amber-700 bg-amber-50 border-amber-200",
  "Revizyon": "text-orange-700 bg-orange-50 border-orange-200",
};

/* Google Drive modeli: dosyalar uygulamada saklanmaz, yalnızca Drive meta verisi ve bağlantısı tutulur. */
const DRIVE = {
  file: (fileId) => `https://drive.google.com/file/d/${fileId}/view`,
  folder: (folderId) => `https://drive.google.com/drive/folders/${folderId}`,
  isValid: (url) => /^https:\/\/(drive|docs)\.google\.com\//.test(String(url).trim()),
};
/* Alt klasörlerin Drive kimlikleri tutulmadığından alt klasör bağlantısı markanın kök klasörüne gider. */
const brandDriveLink = (brand) => (brand?.driveFolderId ? DRIVE.folder(brand.driveFolderId) : null);
const parseDriveFolderId = (url) => (String(url).match(/\/folders\/([\w-]+)/) || [])[1] || null;
const driveId = () => `1${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;

function makeThumb(colors, label, variant = 0) {
  const [c1, c2] = colors;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200' viewBox='0 0 320 200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='320' height='200' fill='url(#g)'/><circle cx='${250 - (variant % 4) * 28}' cy='${58 + (variant % 3) * 14}' r='48' fill='white' fill-opacity='0.18'/><rect x='24' y='${124 - (variant % 3) * 6}' width='150' height='10' rx='5' fill='white' fill-opacity='0.55'/><rect x='24' y='${144 - (variant % 3) * 6}' width='96' height='8' rx='4' fill='white' fill-opacity='0.35'/><text x='24' y='52' font-family='Arial, sans-serif' font-size='22' font-weight='700' fill='white'>${escHtml(label)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ───────────────────────── Demo verisi ───────────────────────── */

const SEED_BRANDS = [
  { id: "b-atlas", name: "Atlas Ajans", initials: "AA", sector: "Ajans İçi", color: "orange" },
  { id: "b-sofra", name: "Sofra Pide", initials: "SP", sector: "Restoran & Yemek", color: "red" },
  { id: "b-tepe", name: "Tepe Emlak", initials: "TE", sector: "Gayrimenkul", color: "sky" },
  { id: "b-edva", name: "Edva", initials: "ED", sector: "Sanat & Atölye", color: "emerald" },
  { id: "b-3k", name: "3 Kartal Perde", initials: "3K", sector: "Ev Dekorasyon", color: "amber" },
  { id: "b-velia", name: "Velia Clinic", initials: "VC", sector: "Sağlık & Estetik", color: "violet" },
  { id: "b-gurel", name: "Gürel Altyapı", initials: "GA", sector: "İnşaat", color: "indigo" },
].map((b, i) => ({ ...b, driveFolderId: `1Cdg${i}${b.initials}x7Kq`, slug: slugify(b.name) }));

const SEED_TASKS = [
  ["b-atlas", "Ajans LinkedIn vaka çalışması", "LinkedIn", "Karusel", "u5", "Çalışılıyor", "Orta", 2, 1, "Son üç projeden öne çıkan sonuçların anlatıldığı vaka çalışması."],
  ["b-atlas", "Yeni freelancer brief dokümanı", "Web Sitesi", "Rapor", "u2", "Başlanmadı", "Düşük", 3, 2, "Yeni video freelancer için proje brief ve teslim kuralları."],
  ["b-atlas", "Eylül performans raporu", "Web Sitesi", "Rapor", "u1", "Yönetici Onayı", "Yüksek", 0, 0, "Tüm markaların aylık erişim ve etkileşim özeti."],
  ["b-sofra", "Yeni menü lansmanı Reels montajı", "Instagram", "Reels", "u3", "Gecikti", "Yüksek", -1, -1, "Sonbahar menüsündeki dört ana ürünün hızlı geçişlerle anlatıldığı 30 saniyelik dikey video."],
  ["b-sofra", "Öğle menüsü duyuru serisi", "Instagram", "Hikâye", "u2", "Çalışılıyor", "Orta", 0, 0, "Hafta içi öğle menüsünü anlatan üç karelik hareketli hikâye serisi."],
  ["b-sofra", "Hafta sonu rezervasyon reklamı", "Meta Reklam", "Reklam", "u5", "Yönetici Onayı", "Düşük", 1, 0, "Hafta sonu rezervasyonlarını artırmaya yönelik kısa reklam metni ve görsel uyarlaması."],
  ["b-sofra", "Cuma akşamı rezervasyon çağrısı", "Instagram", "Hikâye", "u6", "Tamamlandı", "Orta", 0, 0, "Cuma akşamı için rezervasyon çağrısı yapan hikâye."],
  ["b-sofra", "Şef ile mutfak turu", "TikTok", "Video", "u3", "Başlanmadı", "Orta", 3, 2, "Şefin mutfağı tanıttığı samimi kamera arkası videosu."],
  ["b-sofra", "Makarna çeşitleri karuseli", "Instagram", "Karusel", "u2", "Müşteri Onayı", "Orta", 1, 1, "Altı makarna çeşidini tanıtan kaydırmalı gönderi."],
  ["b-sofra", "Google yorumlarına teşekkür gönderisi", "Facebook", "Gönderi", "u5", "Tamamlandı", "Düşük", -1, -2, "Müşteri yorumlarından alıntılarla teşekkür gönderisi."],
  ["b-sofra", "Ekim kampanya görselleri", "Instagram", "Gönderi", "u2", "Revizyon", "Yüksek", 2, 1, "Ekim kampanyası için altı görsellik set; müşteri renklerde revizyon istedi."],
  ["b-sofra", "Menü sayfası güncellemesi", "Web Sitesi", "Web", "u4", "Çalışılıyor", "Orta", 4, 3, "Web sitesindeki menü sayfasının yeni fiyatlarla güncellenmesi."],
  ["b-sofra", "Google reklamları haftalık kontrol", "Google Reklam", "Reklam", "u1", "Başlanmadı", "Orta", 0, 0, "Arama reklamlarının haftalık bütçe ve dönüşüm kontrolü."],
  ["b-sofra", "Müşteri deneyimi röportajı", "YouTube", "Video", "u3", "Başlanmadı", "Düşük", 7, 5, "Düzenli müşterilerle kısa röportaj serisi."],
  ["b-sofra", "Doğum günü kampanyası hikâyesi", "Instagram", "Hikâye", "u6", "Çalışılıyor", "Orta", 5, 4, "Doğum günü menüsü kampanyasını duyuran hikâye."],
  ["b-tepe", "Kira artış oranı ve yasal haklar", "Instagram", "Reels", "u5", "Müşteri Onayı", "Yüksek", 0, 0, "Güncel kira artış oranlarını ve kiracı haklarını açıklayan video."],
  ["b-tepe", "Haftalık portföy paylaşımı", "Instagram", "Hikâye", "u6", "Tamamlandı", "Orta", 0, 0, "Haftanın öne çıkan daire ve villa seçenekleri."],
  ["b-tepe", "Lüks villa tanıtımı", "Instagram", "Gönderi", "u2", "Çalışılıyor", "Orta", 1, 0, "Deniz manzaralı villa için tekli tanıtım gönderisi."],
  ["b-tepe", "Yeni proje tanıtım videosu", "YouTube", "Video", "u3", "Yönetici Onayı", "Yüksek", 2, 1, "Vadi Konakları projesi için 45 saniyelik tanıtım kurgusu."],
  ["b-tepe", "Konut kredisi bilgilendirme", "Instagram", "Karusel", "u2", "Revizyon", "Yüksek", 1, 0, "Konut kredisi seçeneklerini sade biçimde açıklayan altı sayfalık gönderi."],
  ["b-tepe", "Portföy sayfası güncellemesi", "Web Sitesi", "Web", "u4", "Başlanmadı", "Orta", 3, 2, "Yeni eklenen sekiz ilanın web sitesine girilmesi."],
  ["b-tepe", "Meta potansiyel müşteri reklamı", "Meta Reklam", "Reklam", "u1", "Gecikti", "Yüksek", -2, -2, "Form toplama amaçlı potansiyel müşteri kampanyası."],
  ["b-edva", "Seramik atölyesi tanıtımı", "Instagram", "Reels", "u3", "Yönetici Onayı", "Orta", 0, 0, "Atölye sürecini ve eğitmeni öne çıkaran kısa tanıtım videosu."],
  ["b-edva", "Ekim etkinlik programı", "Instagram", "Gönderi", "u5", "Tamamlandı", "Düşük", -1, -1, "Ekim ayındaki etkinlikleri tek görselde duyuran gönderi."],
  ["b-edva", "Sonbahar tablo koleksiyonu", "Facebook", "Gönderi", "u2", "Müşteri Onayı", "Orta", 1, 1, "Yeni tablo koleksiyonunun tanıtım gönderisi."],
  ["b-edva", "Meta piksel kontrolü", "Web Sitesi", "Web", "u4", "Başlanmadı", "Orta", 2, 1, "Meta pikselinin satın alma olaylarını doğru gönderdiğinin kontrolü."],
  ["b-edva", "Atölye eğitmeni röportajı", "TikTok", "Video", "u3", "Çalışılıyor", "Düşük", 4, 3, "Eğitmenle kısa soru-cevap videosu."],
  ["b-3k", "Kış koleksiyonu ürün gönderisi", "Instagram", "Gönderi", "u2", "Gecikti", "Yüksek", -1, -1, "Kadife perde grubunu öne çıkaran ürün gönderisi."],
  ["b-3k", "Ölçü alma rehberi", "Instagram", "Karusel", "u5", "Çalışılıyor", "Orta", 0, 0, "Evde doğru perde ölçüsü almayı anlatan beş adımlı rehber."],
  ["b-3k", "Motorlu perde sistemleri videosu", "YouTube", "Video", "u3", "Başlanmadı", "Orta", 3, 2, "Motorlu perde sistemlerinin kullanımını gösteren video."],
  ["b-3k", "Katalog PDF indirme butonu testi", "Web Sitesi", "Web", "u4", "Çalışılıyor", "Orta", 1, 1, "Mobil tarayıcılarda katalog indirme kontrolü."],
  ["b-3k", "Arama reklamları optimizasyonu", "Google Reklam", "Reklam", "u1", "Tamamlandı", "Orta", -2, -2, "Anahtar kelime ve teklif optimizasyonu."],
  ["b-velia", "Medikal cilt bakımı Reels", "Instagram", "Reels", "u3", "Tamamlandı", "Orta", -1, -1, "Medikal cilt bakımı uygulamasını anlatan video."],
  ["b-velia", "Uzman görüşü videosu", "YouTube", "Video", "u3", "Başlanmadı", "Orta", 2, 1, "Dermatoloji uzmanıyla bilgilendirici video."],
  ["b-velia", "Sık sorulan sorular karuseli", "Instagram", "Karusel", "u5", "Yönetici Onayı", "Orta", 0, 0, "Kliniğe en çok sorulan altı soru ve cevabı."],
  ["b-velia", "Randevu kampanyası reklamı", "Meta Reklam", "Reklam", "u1", "Çalışılıyor", "Yüksek", 1, 0, "Ekim randevu kampanyası reklam kurgusu."],
  ["b-gurel", "Şantiye ilerleme videosu", "Instagram", "Reels", "u3", "Yönetici Onayı", "Yüksek", 0, 0, "Şantiyenin aylık ilerlemesini gösteren drone destekli video."],
  ["b-gurel", "Satış ofisi canlı yayını", "Instagram", "Hikâye", "u6", "Tamamlandı", "Orta", -1, -1, "Satış ofisinden canlı yayın duyurusu."],
  ["b-gurel", "Proje teslim röportajı", "YouTube", "Video", "u3", "Başlanmadı", "Orta", 5, 4, "Anahtar teslim töreninde ev sahipleriyle röportaj."],
  ["b-gurel", "LinkedIn yatırımcı bülteni", "LinkedIn", "Gönderi", "u5", "Çalışılıyor", "Düşük", 3, 2, "Yatırımcılara yönelik çeyrek dönem bülteni."],
];

/* Demo marka kılavuzu (yalnızca ?demo; canlıda kılavuzlar veritabanından gelir). Diğer markalar boş başlar. */
const DEMO_BRAND_KITS = (() => {
  const at = new Date(Date.now() - 2 * 864e5).toISOString();
  const base = { brandId: "b-sofra", createdAt: at, updatedAt: at };
  return {
    "b-sofra": {
      kit: { brandId: "b-sofra", createdAt: at, updatedAt: at, updatedBy: "u1" },
      colors: [
        { ...base, id: "kc-1", name: "Sofra Pide Kırmızısı", hex: "#C8102E", usage: "Logo, ana butonlar ve kampanya vurguları.", type: "primary", sortOrder: 0 },
        { ...base, id: "kc-2", name: "Krem", hex: "#FFF4E0", usage: "Arka planlar ve menü kartları.", type: "secondary", sortOrder: 1 },
        { ...base, id: "kc-3", name: "Fesleğen Yeşili", hex: "#2E7D32", usage: "Vegan ve taze ürün etiketleri.", type: "secondary", sortOrder: 2 },
      ],
      fonts: [
        { ...base, id: "kf-1", family: "Playfair Display", role: "heading", weights: [600, 700], usage: "Menü başlıkları ve kampanya görsellerindeki ana başlıklar.", assetId: null, referenceUrl: "", sortOrder: 0 },
        { ...base, id: "kf-2", family: "Inter", role: "body", weights: [400, 500], usage: "Fiyatlar, açıklamalar ve bilgi alanları.", assetId: null, referenceUrl: "", sortOrder: 1 },
      ],
      instructions: [
        { ...base, id: "ki-1", category: "design", title: "Logo kullanım standartları", content: "<ul><li>Logo yalnızca krem veya beyaz zemin üzerinde kullanılır.</li><li>Logonun çevresinde en az logo yüksekliğinin yarısı kadar boşluk bırakılır.</li></ul>", important: true, visibility: "shared", sortOrder: 0, updatedBy: "u1" },
        { ...base, id: "ki-2", category: "design", title: "Yemek fotoğrafları", content: "<p>Doğal ışık ve sıcak tonlar tercih edilir; filtreli, soğuk tonlu görseller kullanılmaz.</p>", important: false, visibility: "shared", sortOrder: 1, updatedBy: "u2" },
        { ...base, id: "ki-3", category: "content", title: "İletişim dili", content: "<p>Samimi ama saygılı; “siz” hitabı kullanılır. Her gönderide en fazla 2 emoji, 5 hashtag.</p><p><strong>Yasaklı kelimeler:</strong> “ucuz”, “bedava”.</p>", important: true, visibility: "shared", sortOrder: 0, updatedBy: "u5" },
        { ...base, id: "ki-4", category: "client", title: "Onay süreci notu (ekip içi)", content: "<p>Mert Bey kampanya görsellerini akşam 18:00'den sonra onaylıyor; teslimleri öğleden önce gönderin.</p>", important: false, visibility: "internal", sortOrder: 0, updatedBy: "u1" },
      ],
      assets: [],
      links: [
        { ...base, id: "kl-1", title: "Sofra Pide — Kurumsal Drive", url: "https://drive.google.com/drive/folders/1Cdg1SPx7Kq", category: "general", description: "Logo dosyaları, kurumsal kimlik belgeleri ve güncel tasarım materyalleri.", visibility: "shared", createdBy: "u1" },
        { ...base, id: "kl-2", title: "Ham çekimler (ekip içi)", url: "https://drive.google.com/drive/folders/1Cdg1SPraw01", category: "media", description: "Kurgu öncesi ham video ve fotoğraflar.", visibility: "internal", createdBy: "u3" },
      ],
    },
  };
})();

const ASSET_TEMPLATES = [
  ["logolar", "Logo Ana Versiyon.svg", "Vektör", "248 KB", "Onaylandı", true, true],
  ["logolar", "Logo Beyaz.png", "Görsel", "412 KB", "Onaylandı", true, true],
  ["logolar", "Logo İkon.ai", "Vektör", "1,2 MB", "Onaylandı", false, true],
  ["kimlik", "Kurumsal Kimlik Rehberi.pdf", "PDF", "8,4 MB", "Onaylandı", false, true],
  ["kimlik", "Renk Paleti ve Tipografi.pdf", "PDF", "1,6 MB", "Onay Bekliyor", false, false],
  ["fontlar", "Başlık Fontu.otf", "Font", "96 KB", "Onaylandı", false, false],
  ["fontlar", "Metin Font Ailesi.zip", "Arşiv", "2,3 MB", "Onaylandı", false, false],
  ["gorseller", "Ürün Çekimi 01.jpg", "Görsel", "3,1 MB", "Onaylandı", true, false],
  ["gorseller", "Ürün Çekimi 02.jpg", "Görsel", "2,8 MB", "Onay Bekliyor", true, false],
  ["gorseller", "Mekân Fotoğrafı.jpg", "Görsel", "4,2 MB", "Onaylandı", true, false],
  ["gorseller", "Ekip Portresi.jpg", "Görsel", "2,2 MB", "Revizyon", true, false],
  ["gorseller", "Kampanya Ana Görsel.png", "Görsel", "5,6 MB", "Onay Bekliyor", true, false],
  ["video", "Tanıtım Reels Final.mp4", "Video", "48 MB", "Onaylandı", true, false],
  ["video", "Kamera Arkası Ham.mov", "Video", "312 MB", "Onay Bekliyor", false, false],
  ["sablonlar", "Hikâye Şablonu.psd", "Şablon", "22 MB", "Onaylandı", true, false],
  ["sablonlar", "Gönderi Şablonu.fig", "Şablon", "6,4 MB", "Onaylandı", true, false],
  ["kampanyalar", "Ekim Kampanyası Brief.pdf", "PDF", "1,1 MB", "Onay Bekliyor", false, false],
  ["arsiv", "2025 İçerik Arşivi.zip", "Arşiv", "1,4 GB", "Onaylandı", false, false],
];

const COMMENT_TEXTS = [
  "Görsel yönlendirmesi çok iyi görünüyor, kapanış karesini biraz uzatalım.",
  "Metin için son düzenlemeleri tamamladım.",
  "Müşteri geri bildirimini ekledim: logo daha görünür olmalı.",
  "Yayın saati 19:30 olarak planlandı.",
  "Revizyon sonrası dosyayı Drive klasörüne yükledim.",
];

function seedDescription(brief, format, brand) {
  return `<p><strong>Brief:</strong> ${escHtml(brief)}</p><ul><li>Marka kimlik rehberindeki renk ve tipografi kullanılacak.</li><li>${escHtml(format)} türüne uygun ölçüler ve güvenli alanlar kontrol edilecek.</li><li>Yayın öncesi yönetici onayı alınacak.</li></ul><p>Referans: <a href="${DRIVE.folder(brand.driveFolderId)}" target="_blank" rel="noopener noreferrer">${escHtml(brand.name)} Drive klasörü</a></p>`;
}

/* Demo kontrol listesi şablonları: tüm markalar için varsayılan + Tepe Emlak'a özel sosyal medya listesi. */
const DEMO_CHECKLIST_TEMPLATES = demoTemplates([
  {
    brandId: "b-tepe", name: "Tepe Emlak — Sosyal Medya Kontrol Listesi", taskTypes: ["Gönderi", "Karusel", "Hikâye", "Reels"],
    items: [
      { title: "Logo sağ alt köşede kullanıldı.", description: "Beyaz zeminde lacivert, koyu zeminde beyaz logo.", category: "visual", isRequired: true, isEnabled: true, recheckOnRevision: true },
      { title: "Kurumsal renk paletine uyuldu.", description: "", category: "visual", isRequired: true, isEnabled: true, recheckOnRevision: true },
      { title: "İletişim bilgileri eklendi.", description: "Telefon ve web adresi son karede / görselin altında.", category: "content", isRequired: true, isEnabled: true, recheckOnRevision: false },
      { title: "Gayrimenkul açıklamaları kontrol edildi.", description: "m², oda sayısı, konum ve fiyat bilgisi ilanla aynı olmalı.", category: "content", isRequired: true, isEnabled: true, recheckOnRevision: true },
      { title: "Müşteri talepleri uygulandı.", description: "", category: "content", isRequired: true, isEnabled: true, recheckOnRevision: true },
      { title: "Görsel boyutları doğru.", description: "Gönderi 1080×1350, hikâye/Reels 1080×1920.", category: "technical", isRequired: false, isEnabled: true, recheckOnRevision: true },
    ],
  },
]);

/* Demo: görevlerin kontrol listeleri. Onay aşamasındakilerde zorunlular tamamdır; revize istenenlerde önceki döngü
   kapanmış, yeni döngü açılmıştır; diğerlerinde kısmi ilerleme vardır. */
function seedChecklists(api, tasks, approvals, now) {
  const checklists = [], checklistItems = [];
  if (!api) return { checklists, checklistItems };
  const at = (h) => new Date(now - h * 36e5).toISOString();
  const complete = (items, pick, by, h) => items.map((it, n) => (pick(it, n) ? { ...it, isCompleted: true, completedBy: by, completedAt: at(h + n * 0.1) } : it));
  tasks.forEach((t, i) => {
    if (t.status === "Onaylandı" || t.status === "Tamamlandı") return;
    const r = api.instantiateFor(t, 0);
    if (!r) return;
    const by = t.assigneeId || "u1";
    const revised = approvals.some((a) => a.taskId === t.id && a.decision === "revision");
    if (revised) {
      const first = { ...r.checklist, createdAt: at(60) };
      const firstItems = complete(r.items, (it) => it.isRequired, by, 30);
      const next = startRevisionCycle(first, firstItems, at(8));
      checklists.push(next.closed, next.checklist);
      checklistItems.push(...firstItems, ...complete(next.items, (it, n) => n < 2, by, 2));
      return;
    }
    let items = r.items;
    if (LOCKED_STATUSES.has(t.status)) items = complete(items, (it, n) => it.isRequired || n % 2 === 0, by, 6);
    else if (t.status !== "Başlanmadı") items = complete(items, (it, n) => n < (i * 3) % items.length, by, 4);
    checklists.push(r.checklist);
    checklistItems.push(...items);
  });
  return { checklists, checklistItems };
}

/* Demo kaynağı için örnek çalışma alanı (Supabase bağlıyken kullanılmaz). */
const DEMO_DUE_TIMES = ["10:00", "16:30", "12:00", "18:00", "", "14:00", "09:30"];
function createDemoState(checklistApi) {
  const USERS = DEMO_USERS.filter((u) => u.role !== "client"), ME = DEMO_USERS[0].id;
  let taskNo = 1000;
  const brands = SEED_BRANDS;
  const brandById = Object.fromEntries(brands.map((b) => [b.id, b]));
  const now = Date.now();
  const tasks = [], comments = [], attachments = [], activity = [], assets = [];

  brands.forEach((brand, bi) => {
    ASSET_TEMPLATES.forEach(([folderId, name, type, size, approval, hasThumb, prefixed], ai) => {
      const fileId = driveId();
      assets.push({
        id: `as-${brand.id}-${ai}`, brandId: brand.id, folderId,
        name: prefixed ? `${brand.name} ${name}` : name, type,
        thumbnail: hasThumb ? makeThumb(BRAND_COLORS[brand.color].hex, folderId === "logolar" ? brand.initials : name.split(".")[0].slice(0, 16), ai + bi) : null,
        driveFileId: fileId, driveUrl: DRIVE.file(fileId), size, owner: USERS[(ai + bi) % USERS.length].id,
        approvalStatus: approval, updatedAt: addDays(TODAY, -((ai * 3 + bi) % 12)),
      });
    });
  });

  SEED_TASKS.forEach(([brandId, title, platform, format, assigneeId, status, priority, pub, due, brief], i) => {
    const brand = brandById[brandId];
    const id = uid();
    const createdAt = new Date(now - (4 + (i % 5)) * 864e5).toISOString();
    tasks.push({
      id, code: `CW-${++taskNo}`, brandId, title, platform, format, assigneeId, status, priority,
      publishDate: addDays(TODAY, pub), dueDate: addDays(TODAY, due), dueTime: DEMO_DUE_TIMES[i % DEMO_DUE_TIMES.length],
      description: seedDescription(brief, format, brand), createdAt, updatedAt: createdAt,
    });
    activity.push({ id: uid(), taskId: id, userId: ME, text: "görevi oluşturdu", createdAt });
    if (status !== "Başlanmadı") {
      activity.push({ id: uid(), taskId: id, userId: assigneeId || ME, text: `durumu “${status}” olarak değiştirdi`, createdAt: new Date(now - (i % 6 + 1) * 36e5).toISOString() });
    }
    if (i % 2 === 0) {
      const count = (i % 4) + 1;
      for (let j = 0; j < count; j++) {
        comments.push({ id: uid(), taskId: id, userId: USERS[(i + j + 1) % USERS.length].id, text: COMMENT_TEXTS[(i + j) % COMMENT_TEXTS.length], createdAt: new Date(now - (count - j) * 36e5 - i * 6e5).toISOString() });
      }
    }
    if (i % 3 !== 2) {
      const f1 = driveId();
      attachments.push({ id: uid(), taskId: id, assetId: null, name: `Taslak Görsel v${(i % 3) + 1}.jpg`, type: "Görsel", size: `${(1.2 + (i % 5) * 0.6).toFixed(1).replace(".", ",")} MB`, thumbnail: makeThumb(BRAND_COLORS[brand.color].hex, "Taslak", i), driveUrl: DRIVE.file(f1), addedBy: assigneeId || ME, createdAt });
      if (i % 3 === 0) {
        const f2 = driveId();
        attachments.push({ id: uid(), taskId: id, assetId: null, name: "Brief Dokümanı.pdf", type: "PDF", size: "640 KB", thumbnail: null, driveUrl: DRIVE.file(f2), addedBy: ME, createdAt, internal: true });
      }
    }
  });

  // Marka üyelikleri: çalışanlar görev aldıkları markalara, müşteriler kendi markalarına bağlı.
  const memberships = [];
  const addMember = (brandId, userId) => { if (!memberships.some((m) => m.brandId === brandId && m.userId === userId)) memberships.push({ id: `${brandId}:${userId}`, brandId, userId }); };
  tasks.forEach((t) => { if (t.assigneeId && t.assigneeId !== ME) addMember(t.brandId, t.assigneeId); });
  Object.entries(DEMO_CLIENT_BRANDS).forEach(([userId, ids]) => ids.forEach((b) => addMember(b, userId)));

  const byTitle = (title) => tasks.find((t) => t.title === title);
  const ago = (h) => new Date(now - h * 36e5).toISOString();
  const approvals = [], notifications = [];
  [
    ["Konut kredisi bilgilendirme", "c1", "revision", "Faiz oranlarını güncel tabloyla değiştirelim. Son sayfada iletişim bilgisi eksik.", 5],
    ["Ekim kampanya görselleri", "c2", "revision", "Renkler kurumsal kırmızımıza uymuyor; logo biraz daha büyük olmalı.", 7],
    ["Medikal cilt bakımı Reels", "c3", "approved", "", 20],
  ].forEach(([title, userId, decision, note, h]) => {
    const t = byTitle(title);
    if (!t) return;
    if (decision === "approved") t.status = "Onaylandı";
    if (title === "Ekim kampanya görselleri") t.status = "Çalışılıyor"; // revize ele alınmış örneği (Revizyonda)
    approvals.push({ id: uid(), taskId: t.id, userId, decision, note, link: "", createdAt: ago(h) });
    activity.push({ id: uid(), taskId: t.id, userId, text: decision === "approved" ? "içeriği onayladı" : "revize talep etti", createdAt: ago(h) });
    if (decision === "revision") {
      [t.assigneeId, ME].forEach((to) => notifications.push({ id: uid(), userId: to, taskId: t.id, kind: "revision", text: `${DEMO_USERS.find((u) => u.id === userId).name} “${t.title}” için revize istedi: ${note}`, createdAt: ago(h), readAt: null }));
    }
  });
  tasks.filter((t) => t.status === "Müşteri Onayı").forEach((t) => {
    Object.entries(DEMO_CLIENT_BRANDS).forEach(([userId, ids]) => {
      if (ids.includes(t.brandId)) notifications.push({ id: uid(), userId, taskId: t.id, kind: "review", text: `“${t.title}” onayınıza sunuldu.`, createdAt: ago(3), readAt: null });
    });
  });
  brands.forEach((b) => { b.status = "active"; });
  const { checklists, checklistItems } = seedChecklists(checklistApi, tasks, approvals, now);

  // İçerik sürümleri (demo): müşteriye gönderilmiş sürümler kilitli; her kararın kendi isteği ve sürümü vardır.
  const contentVersions = [], contentAssets = [], approvalRequests = [];
  const addVersion = (t, no, at, locked, files = 2) => {
    const brand = brandById[t.brandId];
    const v = { id: uid(), taskId: t.id, versionNo: no, caption: `${t.title}\n\n${brand.name} için hazırlanan paylaşım metni (sürüm ${no}).`, createdBy: t.assigneeId || ME, createdAt: at, updatedAt: at, lockedAt: locked ? at : null };
    contentVersions.push(v);
    for (let k = 0; k < files; k++) {
      contentAssets.push({
        id: uid(), versionId: v.id, taskId: t.id, storagePath: `${t.id}/${v.id}/${k}.png`, fileName: `${t.format} v${no} — ${k + 1}.png`, mimeType: "image/png",
        fileSize: 840000 + k * 120000, sortOrder: k, createdBy: v.createdBy, createdAt: at, previewUrl: makeThumb(BRAND_COLORS[brand.color].hex, `${t.format} · Sürüm ${no}`, k + no * 2),
      });
    }
    return v;
  };
  tasks.forEach((t) => {
    const decisions = approvals.filter((a) => a.taskId === t.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let no = 0;
    decisions.forEach((a) => {
      const v = addVersion(t, ++no, new Date(Date.parse(a.createdAt) - 6 * 36e5).toISOString(), true);
      const r = { id: uid(), taskId: t.id, versionId: v.id, status: a.decision === "approved" ? "approved" : "revision_requested", requestedBy: ME, requestedAt: v.createdAt, closedAt: a.createdAt };
      approvalRequests.push(r);
      a.requestId = r.id; a.versionId = v.id;
    });
    if (t.status === "Müşteri Onayı") {
      const v = addVersion(t, ++no, ago(3), true);
      approvalRequests.push({ id: uid(), taskId: t.id, versionId: v.id, status: "pending", requestedBy: ME, requestedAt: v.createdAt, closedAt: null });
    } else if (t.status === "Yönetici Onayı" || t.status === "Revizyon" || (decisions.length && t.status === "Çalışılıyor")) {
      addVersion(t, ++no, ago(1), false, t.status === "Revizyon" ? 0 : 1);
    }
  });

  return {
    users: DEMO_USERS, me: ME,
    state: { users: DEMO_USERS, brands, memberships, tasks, comments, attachments, assets, activity, approvals, notifications, checklists, checklistItems, contentVersions, contentAssets, approvalRequests },
  };
}

/* ───────────────────────── Merkezi durum (reducer) ───────────────────────── */

const FIELD_LABELS = {
  status: "durumu", priority: "önceliği", assigneeId: "sorumluyu", platform: "platformu", format: "görev türünü",
  dueDate: "son teslim tarihini", dueTime: "teslim saatini", publishDate: "yayın tarihini", brandId: "markayı", title: "başlığı",
  checklistDisabled: "kontrol listesini",
};

function describeField(key, value, state) {
  if (key === "assigneeId") return USER_BY_ID[value]?.name || "Atanmamış";
  if (key === "brandId") return state.brands.find((b) => b.id === value)?.name || "Bilinmeyen marka";
  if (key === "dueDate" || key === "publishDate") return value ? fmtDateLong(value) : "Tarihsiz";
  if (key === "dueTime") return value || "gün sonu";
  if (key === "checklistDisabled") return value ? "kapalı" : "açık";
  return value;
}

const MERGE_COLLECTIONS = ["checklists", "checklistItems", "contentVersions", "contentAssets", "approvalRequests", "brands"];
/* Sunucudan gelen kontrol listesi kayıtlarını birleştirir; taskId verilirse o görevin kayıtları tümüyle değiştirilir. */
function mergeById(list = [], incoming = [], taskId) {
  if (taskId) return [...list.filter((x) => x.taskId !== taskId), ...incoming];
  if (!incoming.length) return list;
  const byId = new Map(incoming.map((x) => [x.id, x]));
  const out = list.map((x) => (byId.has(x.id) ? { ...x, ...byId.get(x.id) } : x));
  const seen = new Set(list.map((x) => x.id));
  incoming.forEach((x) => { if (!seen.has(x.id)) out.push(x); });
  return out;
}

/* Bildirim alıcıları — iş akışı olaylarında kim haberdar edilir. */
const activeUsers = (state) => state.users.filter((u) => u.active !== false);
const adminIds = (state) => activeUsers(state).filter((u) => u.role === "admin").map((u) => u.id);
const brandClientIds = (state, brandId) => {
  const members = new Set(state.memberships.filter((m) => m.brandId === brandId).map((m) => m.userId));
  return activeUsers(state).filter((u) => u.role === "client" && members.has(u.id)).map((u) => u.id);
};
function makeNotifications(recipients, taskId, kind, text, now) {
  return [...new Set(recipients)].filter((id) => id && id !== ME).map((userId) => ({ id: uid(), userId, taskId, kind, text, createdAt: now, readAt: null }));
}

/* Durum veya sorumlu değiştiğinde ilgili rollere giden bildirimler. */
function workflowNotifications(state, prev, next, now) {
  const actor = USER_BY_ID[ME]?.name || "Bir ekip üyesi";
  const out = [];
  if (prev.status !== next.status) {
    if (next.status === "Müşteri Onayı") {
      const again = state.approvals.some((a) => a.taskId === next.id && a.decision === "revision");
      out.push(...makeNotifications(brandClientIds(state, next.brandId), next.id, "review", again ? `“${next.title}” revize edildi ve tekrar onayınıza sunuldu.` : `“${next.title}” onayınıza sunuldu.`, now));
      out.push(...makeNotifications(adminIds(state), next.id, "status", `${actor} “${next.title}” içeriğini ${again ? "tekrar " : ""}müşteri onayına gönderdi.`, now));
    } else if (next.status === "Yönetici Onayı") {
      out.push(...makeNotifications(adminIds(state), next.id, "status", `${actor} “${next.title}” için yönetici onayı istiyor.`, now));
    } else if (next.status === "Tamamlandı" && prev.status === "Onaylandı") {
      out.push(...makeNotifications(brandClientIds(state, next.brandId), next.id, "status", `Onayladığınız “${next.title}” yayınlandı.`, now));
    }
  }
  if (prev.assigneeId !== next.assigneeId && next.assigneeId) {
    out.push(...makeNotifications([next.assigneeId], next.id, "assign", `${actor} “${next.title}” görevini size atadı.`, now));
  }
  return out;
}

function reducer(state, action) {
  const now = new Date().toISOString();
  const log = (taskId, text) => ({ id: uid(), taskId, userId: ME, text, createdAt: now });
  switch (action.type) {
    case "ADD_TASK": {
      const t = action.task;
      const notes = t.assigneeId ? makeNotifications([t.assigneeId], t.id, "assign", `${USER_BY_ID[ME]?.name || "Yönetici"} “${t.title}” görevini size atadı.`, now) : [];
      return { ...state, tasks: [...state.tasks, t], activity: [log(t.id, "görevi oluşturdu"), ...state.activity], notifications: [...notes, ...state.notifications] };
    }
    case "ADD_TASKS":
      return {
        ...state,
        brands: [...state.brands, ...(action.brands || [])],
        tasks: [...state.tasks, ...action.tasks],
        activity: [...action.tasks.map((t) => log(t.id, "görevi toplu içe aktarma ile oluşturdu")), ...state.activity],
      };
    case "UPDATE_TASK": {
      const prev = state.tasks.find((t) => t.id === action.id);
      if (!prev) return state;
      const next = { ...prev, ...action.patch, updatedAt: now };
      const entries = action.silent ? [] : Object.keys(action.patch)
        .filter((k) => FIELD_LABELS[k] && prev[k] !== next[k])
        .map((k) => log(prev.id, `${FIELD_LABELS[k]} “${describeField(k, next[k], state)}” olarak değiştirdi`));
      const notes = action.remote ? [] : workflowNotifications(state, prev, next, now);
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === prev.id ? next : t)),
        activity: [...entries, ...state.activity],
        notifications: notes.length ? [...notes, ...state.notifications] : state.notifications,
      };
    }
    case "SUBMIT_TASK": {
      const prev = state.tasks.find((t) => t.id === action.id);
      if (!prev) return state;
      const next = { ...prev, status: action.status, updatedAt: now };
      const reason = String(action.reason || "").trim();
      const text = `${action.status === "Müşteri Onayı" ? "içeriği müşteri onayına gönderdi" : "içeriği yönetici onayına gönderdi"}${reason ? ` — eksik kontroller gerekçeyle atlandı: “${reason}”` : ""}`;
      const notes = workflowNotifications(state, prev, next, now);
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === prev.id ? next : t)),
        activity: [log(prev.id, text), ...state.activity],
        notifications: notes.length ? [...notes, ...state.notifications] : state.notifications,
      };
    }
    case "TOGGLE_CHECK":
      return {
        ...state,
        checklistItems: state.checklistItems.map((i) => (i.id === action.itemId
          ? { ...i, isCompleted: action.completed, completedBy: action.completed ? ME : null, completedAt: action.completed ? now : null } : i)),
      };
    case "SET_CHECK_NOTE":
      return { ...state, checklistItems: state.checklistItems.map((i) => (i.id === action.itemId ? { ...i, note: String(action.note || "").trim() } : i)) };
    case "TASKS_CREATED": {
      // Toplu girişte sunucu kaydı tamamlandıktan sonra işlenir (canlı güncelleme yankısıyla çakışmaz: kimliğe göre birleşir).
      const seenA = new Set(state.activity.map((a) => a.id)), seenN = new Set(state.notifications.map((n) => n.id));
      return {
        ...state,
        tasks: mergeById(state.tasks, action.tasks),
        activity: [...action.activity.filter((a) => !seenA.has(a.id)), ...state.activity],
        notifications: [...action.notifications.filter((n) => !seenN.has(n.id)), ...state.notifications],
        checklists: mergeById(state.checklists, action.checklists || []),
        checklistItems: mergeById(state.checklistItems, action.checklistItems || []),
      };
    }
    case "REMOTE_MERGE": {
      // Sunucunun oluşturduğu / değiştirdiği kayıtlar (yalnızca eylemde bulunan koleksiyonlar; taskId varsa o görevin kayıtları değiştirilir).
      const out = { ...state };
      MERGE_COLLECTIONS.forEach((k) => { if (action[k]) out[k] = mergeById(state[k] || [], action[k], k === "brands" ? null : action.taskId); });
      return out;
    }
    case "UPDATE_VERSION":
      return { ...state, contentVersions: state.contentVersions.map((v) => (v.id === action.id ? { ...v, ...action.patch, updatedAt: now } : v)) };
    case "DELETE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        contentVersions: (state.contentVersions || []).filter((v) => v.taskId !== action.id),
        contentAssets: (state.contentAssets || []).filter((a) => a.taskId !== action.id),
        approvalRequests: (state.approvalRequests || []).filter((r) => r.taskId !== action.id),
        checklists: (state.checklists || []).filter((c) => c.taskId !== action.id),
        checklistItems: (state.checklistItems || []).filter((i) => i.taskId !== action.id),
        comments: state.comments.filter((c) => c.taskId !== action.id),
        attachments: state.attachments.filter((a) => a.taskId !== action.id),
        activity: state.activity.filter((a) => a.taskId !== action.id),
        approvals: state.approvals.filter((a) => a.taskId !== action.id),
        notifications: state.notifications.filter((n) => n.taskId !== action.id),
      };
    case "REVIEW_CONTENT": {
      const task = state.tasks.find((t) => t.id === action.taskId);
      if (!task) return state;
      const approved = action.decision === "approved";
      const status = approved ? "Onaylandı" : "Revizyon";
      const approval = {
        id: action.id || uid(), taskId: task.id, userId: ME, decision: action.decision, note: (action.note || "").trim(), link: (action.link || "").trim(), createdAt: now,
        requestId: action.requestId || null, versionId: action.versionId || null,
      };
      const who = USER_BY_ID[ME]?.name || "Müşteri";
      const text = approved ? `${who} “${task.title}” içeriğini onayladı.` : `${who} “${task.title}” için revize istedi: ${approval.note}`;
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === task.id ? { ...t, status, updatedAt: now } : t)),
        approvalRequests: (state.approvalRequests || []).map((r) => (r.id === action.requestId && r.status === "pending" ? { ...r, status: approved ? "approved" : "revision_requested", closedAt: now } : r)),
        approvals: [approval, ...state.approvals],
        activity: [log(task.id, approved ? "içeriği onayladı" : `revize talep etti: “${approval.note}”`), ...state.activity],
        notifications: [...makeNotifications([task.assigneeId, ...adminIds(state)], task.id, approved ? "approved" : "revision", text, now), ...state.notifications],
      };
    }
    case "ADD_USER":
      return {
        ...state,
        users: [...state.users, action.user],
        memberships: [...state.memberships, ...action.brandIds.map((brandId) => ({ id: `${brandId}:${action.user.id}`, brandId, userId: action.user.id }))],
      };
    case "UPDATE_USER":
      return { ...state, users: state.users.map((u) => (u.id === action.id ? { ...u, ...action.patch } : u)) };
    case "SET_USER_BRANDS":
      return {
        ...state,
        memberships: [
          ...state.memberships.filter((m) => m.userId !== action.userId),
          ...action.brandIds.map((brandId) => ({ id: `${brandId}:${action.userId}`, brandId, userId: action.userId })),
        ],
      };
    case "SET_BRAND_MEMBERS": {
      // Yalnızca belirtilen roldeki üyeler değiştirilir (ekip ataması müşterileri etkilemez).
      const roleOfId = Object.fromEntries(state.users.map((u) => [u.id, u.role]));
      return {
        ...state,
        memberships: [
          ...state.memberships.filter((m) => m.brandId !== action.brandId || roleOfId[m.userId] !== action.role),
          ...action.userIds.map((userId) => ({ id: `${action.brandId}:${userId}`, brandId: action.brandId, userId })),
        ],
      };
    }
    case "UPDATE_BRAND":
      return { ...state, brands: state.brands.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)) };
    case "MARK_NOTIFICATIONS_READ": {
      const ids = new Set(action.ids);
      return { ...state, notifications: state.notifications.map((n) => (ids.has(n.id) && !n.readAt ? { ...n, readAt: now } : n)) };
    }
    case "ADD_COMMENT": {
      const comment = { id: uid(), taskId: action.taskId, userId: ME, text: action.text, createdAt: now };
      return { ...state, comments: [...state.comments, comment], activity: [log(action.taskId, "yorum ekledi"), ...state.activity] };
    }
    case "DELETE_COMMENT": {
      const c = state.comments.find((x) => x.id === action.id);
      if (!c) return state;
      return { ...state, comments: state.comments.filter((x) => x.id !== action.id), activity: [log(c.taskId, "bir yorumu sildi"), ...state.activity] };
    }
    case "ADD_ATTACHMENT":
      return { ...state, attachments: [...state.attachments, action.attachment], activity: [log(action.attachment.taskId, `“${action.attachment.name}” dosyasını ekledi`), ...state.activity] };
    case "REMOVE_ATTACHMENT": {
      const a = state.attachments.find((x) => x.id === action.id);
      if (!a) return state;
      return { ...state, attachments: state.attachments.filter((x) => x.id !== action.id), activity: [log(a.taskId, `“${a.name}” dosyasını kaldırdı`), ...state.activity] };
    }
    case "LOG":
      return { ...state, activity: [log(action.taskId, action.text), ...state.activity] };
    case "ADD_BRAND":
      return { ...state, brands: [...state.brands, action.brand] };
    case "ADD_ASSET":
      return { ...state, assets: [action.asset, ...state.assets] };
    case "REMOTE_UPSERT": {
      const list = state[action.collection];
      if (!list) return state;
      const i = list.findIndex((x) => x.id === action.item.id);
      if (i >= 0) return { ...state, [action.collection]: list.map((x, j) => (j === i ? { ...x, ...action.item } : x)) };
      const prepend = action.collection === "activity" || action.collection === "assets";
      return { ...state, [action.collection]: prepend ? [action.item, ...list] : [...list, action.item] };
    }
    case "REMOTE_DELETE": {
      const list = state[action.collection];
      if (!list || !list.some((x) => x.id === action.id)) return state;
      const next = { ...state, [action.collection]: list.filter((x) => x.id !== action.id) };
      if (action.collection === "tasks") {
        next.comments = state.comments.filter((c) => c.taskId !== action.id);
        next.attachments = state.attachments.filter((a) => a.taskId !== action.id);
        next.activity = state.activity.filter((a) => a.taskId !== action.id);
        next.approvals = state.approvals.filter((a) => a.taskId !== action.id);
        next.checklists = (state.checklists || []).filter((c) => c.taskId !== action.id);
        next.checklistItems = (state.checklistItems || []).filter((i) => i.taskId !== action.id);
        next.contentVersions = (state.contentVersions || []).filter((v) => v.taskId !== action.id);
        next.contentAssets = (state.contentAssets || []).filter((a) => a.taskId !== action.id);
        next.approvalRequests = (state.approvalRequests || []).filter((r) => r.taskId !== action.id);
      }
      return next;
    }
    case "DAY_CHANGED":
      // Tarihe bağlı hesaplamaları (bugün, geciken, bu hafta) yeniden çalıştırmak için listeyi yeniler.
      return { ...state, tasks: [...state.tasks] };
    case "UPDATE_ASSET":
      return { ...state, assets: state.assets.map((a) => (a.id === action.id ? { ...a, ...action.patch, updatedAt: TODAY } : a)) };
    default:
      return state;
  }
}

const WorkspaceContext = createContext(null);
const useWS = () => useContext(WorkspaceContext);

/* ───────────────────────── Filtreleme & sıralama ───────────────────────── */

const emptyFilters = () => ({ search: "", dateScope: "all", customDate: TODAY, status: "all", assignee: "all", platform: "all" });
/* Gecikme; son teslim tarihi + saati, teslim durumu ve ajans saat dilimine göre hesaplanır (bkz. taskIndicators.js). */
const isOverdue = (t) => deadlineInfo(t).state === "overdue";

function matchDate(t, f) {
  switch (f.dateScope) {
    case "today": return t.dueDate === TODAY;
    case "tomorrow": return t.dueDate === addDays(TODAY, 1);
    case "week": return !!t.dueDate && t.dueDate >= WEEK_START && t.dueDate <= WEEK_END;
    case "overdue": return isOverdue(t);
    case "custom": return t.dueDate === f.customDate;
    default: return true;
  }
}

function matchTask(t, f, brandsById) {
  if (f.status === "open" && t.status === "Tamamlandı") return false;
  if (f.status === "approval" && t.status !== "Yönetici Onayı" && t.status !== "Müşteri Onayı") return false;
  if (!["all", "open", "approval"].includes(f.status) && t.status !== f.status) return false;
  if (f.assignee === "none" ? !!t.assigneeId : f.assignee !== "all" && t.assigneeId !== f.assignee) return false;
  if (f.platform !== "all" && t.platform !== f.platform) return false;
  if (!matchDate(t, f)) return false;
  const q = norm(f.search);
  if (q) {
    const hay = norm([t.title, t.code, brandsById[t.brandId]?.name, USER_BY_ID[t.assigneeId]?.name, t.platform, t.format, t.status].join(" "));
    if (!hay.includes(q)) return false;
  }
  return true;
}

const SORT_OPTIONS = [
  ["due", "Son Teslim"], ["publish", "Yayın Tarihi"], ["priority", "Öncelik"], ["status", "Durum"], ["title", "Görev Adı"],
  ["brand", "Marka"], ["assignee", "Sorumlu"], ["platform", "Platform"], ["comments", "Yorum Sayısı"], ["files", "Dosya Sayısı"],
];

function sortTasks(list, sort, ctx) {
  const dir = sort.dir === "asc" ? 1 : -1;
  const val = (t) => {
    switch (sort.key) {
      case "due": return t.dueDate || "9999";
      case "publish": return t.publishDate || "9999";
      case "priority": return PRIORITY_META[t.priority]?.rank ?? 9;
      case "status": return STATUSES.indexOf(t.status);
      case "title": return norm(t.title);
      case "brand": return norm(ctx.brandsById[t.brandId]?.name);
      case "assignee": return norm(USER_BY_ID[t.assigneeId]?.name || "zzz");
      case "platform": return norm(t.platform);
      case "comments": return ctx.commentCount[t.id] || 0;
      case "files": return (ctx.attachmentsByTask[t.id] || EMPTY).length;
      default: return 0;
    }
  };
  return [...list].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return a.id.localeCompare(b.id);
  });
}

function makeBrand(name, sector, color, driveFolderId = null) {
  const words = name.trim().split(/\s+/);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2)).toLocaleUpperCase("tr-TR");
  return { id: uid(), name: name.trim(), initials, sector: sector || "Yeni Müşteri", color, driveFolderId, slug: slugify(name) };
}

/* ───────────────────────── Küçük UI parçaları ───────────────────────── */

function GlobalStyles() {
  return (
    <style>{`
      .cw-root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a}
      .cw-10{font-size:10px;line-height:14px}.cw-11{font-size:11px;line-height:16px}.cw-12{font-size:12px;line-height:17px}.cw-13{font-size:13px;line-height:19px}.cw-14{font-size:14px;line-height:20px}.cw-15{font-size:15px;line-height:21px}
      .cw-plan-list{container-type:inline-size}
      .cw-plan-row{display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"date day status" "title title title" "meta meta meta";gap:4px 10px;align-items:center;padding:8px 10px}
      .cw-plan-date{grid-area:date}.cw-plan-day{grid-area:day}.cw-plan-title{grid-area:title}.cw-plan-meta{grid-area:meta}.cw-plan-status{grid-area:status}
      @container (min-width:720px){.cw-plan-row{grid-template-columns:100px 84px minmax(0,1fr) auto 150px;grid-template-areas:"date day title meta status";padding:6px 12px;min-height:44px}}
      .cw-scroll::-webkit-scrollbar{width:6px;height:6px}.cw-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:6px}.cw-scroll::-webkit-scrollbar-track{background:transparent}
      .cw-scroll{scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent}
      .cw-brand-wrap{container-type:inline-size}
      .cw-brand-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
      @container (min-width:640px){.cw-brand-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}}
      @container (min-width:1200px){.cw-brand-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      .cw-brand-card{height:288px;transition:height .2s ease}.cw-brand-card[data-expanded="true"]{height:420px}
      .cw-tasks{overscroll-behavior:contain;container-type:inline-size}
      @container (max-width:400px){.cw-rev-label{display:none}}
      .cw-row{transition:background-color .15s ease}
      .cw-drawer-w{width:100%}@media(min-width:640px){.cw-drawer-w{width:580px}}
      .cw-clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .cw-rte{outline:none;min-height:150px;font-size:13px;line-height:21px;color:#334155}
      .cw-rte:empty:before{content:attr(data-placeholder);color:#94a3b8}
      .cw-rte p{margin:0 0 8px}.cw-rte ul{list-style:disc;padding-left:20px;margin:0 0 8px}.cw-rte ol{list-style:decimal;padding-left:20px;margin:0 0 8px}
      .cw-rte a{color:#ea580c;text-decoration:underline;cursor:pointer}
      .cw-rte img{max-width:100%;border-radius:8px;margin:6px 0;display:block}
      .cw-rte strong,.cw-rte b{font-weight:600;color:#0f172a}
      @keyframes cwIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
      .cw-pop{animation:cwIn .13s ease}
      @keyframes cwDrawer{from{transform:translateX(28px);opacity:.5}to{transform:none;opacity:1}}
      .cw-drawer{animation:cwDrawer .18s ease}
      .cw-flash{box-shadow:0 0 0 3px #fed7aa;transition:box-shadow .3s}
    `}</style>
  );
}

function Btn({ variant = "secondary", size = "md", className = "", children, ...rest }) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300";
  const sizes = { sm: "h-8 px-2.5 cw-12", md: "h-9 px-3.5 cw-13", icon: "h-9 w-9 cw-13" };
  const variants = {
    primary: "bg-orange-600 text-white hover:bg-orange-700 shadow-sm",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return <button type="button" className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>{children}</button>;
}

/* Atlas Ajans logosu (public/icons/brand-logo.png, 1000×141, saydam zemin). Yükseklik verilir, genişlik orana göre hesaplanır;
   width/height öznitelikleri görsel yüklenmeden yer ayırır (sayfa kaymaz). */
const LOGO_SRC = `${import.meta.env?.BASE_URL || "/"}icons/brand-logo.png`;
function LogoImage({ height = 24, className = "" }) {
  return <img src={LOGO_SRC} alt="Atlas Ajans" width={Math.round((height * 1000) / 141)} height={height} draggable={false}
    className={`block shrink-0 max-w-full h-auto object-contain object-left select-none ${className}`} style={{ maxHeight: height }} />;
}

function Avatar({ userId, size = 20 }) {
  const u = USER_BY_ID[userId];
  if (!u) {
    return (
      <span title="Atanmamış" className="inline-flex items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 shrink-0" style={{ width: size, height: size }}>
        <User size={Math.round(size * 0.55)} />
      </span>
    );
  }
  return (
    <span title={u.name} className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none ${u.color}`} style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.4)) }}>
      {initialsOf(u.name)}
    </span>
  );
}

function BrandLogo({ brand, size = 32 }) {
  if (!brand) return null;
  const c = BRAND_COLORS[brand.color] || BRAND_COLORS.orange;
  return (
    <span className={`inline-flex items-center justify-center rounded-lg font-bold shrink-0 select-none ${c.tile}`} style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.34)) }}>
      {brand.initials}
    </span>
  );
}

function StatusPill({ status, small, chevron }) {
  const meta = STATUS_META[status] || STATUS_META["Başlanmadı"];
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 border rounded-md font-semibold whitespace-nowrap ${meta.cls} ${small ? "h-5 px-1.5 cw-10" : "h-6 px-2 cw-11"}`}>
      <Icon size={small ? 10 : 11} strokeWidth={2.4} />{status}{chevron && <ChevronDown size={11} className="opacity-60" />}
    </span>
  );
}

function PlatformChip({ platform }) {
  return (
    <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-slate-100 text-slate-600 cw-10 font-semibold whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full ${PLATFORM_DOT[platform] || "bg-slate-400"}`} />{platform}
    </span>
  );
}

function PriorityLabel({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META["Orta"];
  return <span className="inline-flex items-center gap-1 cw-12 font-medium text-slate-700"><Flag size={12} className={meta.cls} />{priority}</span>;
}

function ApprovalBadge({ status }) {
  return <span className={`inline-flex items-center h-5 px-1.5 rounded-md border cw-10 font-semibold whitespace-nowrap ${APPROVAL_META[status]}`}>{status}</span>;
}

function FileTypeTile({ type, size = 40 }) {
  const meta = FILE_TYPES[type] || FILE_TYPES["Doküman"];
  const Icon = meta.Icon;
  return <span className={`inline-flex items-center justify-center rounded-lg shrink-0 ${meta.cls}`} style={{ width: size, height: size }}><Icon size={Math.round(size * 0.45)} /></span>;
}

function SectionTitle({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <h4 className="flex items-center gap-1.5 cw-12 font-semibold text-slate-900 uppercase tracking-wide">{Icon && <Icon size={13} className="text-slate-400" />}{children}</h4>
      {right}
    </div>
  );
}

function EmptyBlock({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-white border border-dashed border-slate-300 rounded-xl">
      <span className="h-11 w-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-3"><Icon size={20} /></span>
      <p className="cw-13 font-semibold text-slate-900">{title}</p>
      {text && <p className="cw-12 text-slate-500 mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ───────────────────────── Portal tabanlı açılır katman ───────────────────────── */

/* Tetikleyicinin kaydırılabilir üst kapsayıcıları (ör. marka kartının görev listesi). */
function scrollParents(el) {
  const out = [];
  for (let p = el && el.parentElement; p && p !== document.body; p = p.parentElement) {
    const st = getComputedStyle(p);
    if (/(auto|scroll|hidden)/.test(st.overflowY + st.overflowX)) out.push(p);
  }
  return out;
}

/* Katman body'ye portallanır: kartın kaydırma alanı tarafından kırpılmaz. Tetikleyici kaydırılarak
   kapsayıcısının dışına çıkarsa katman gizlenir, geri gelince tekrar görünür. */
function Floating({ anchorEl, open, onClose, children, placement = "bottom-start", width, onMouseEnter, onMouseLeave, label }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open || !anchorEl) { setPos(null); return undefined; }
    const parents = scrollParents(anchorEl);
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      const hidden = !anchorEl.isConnected || parents.some((p) => {
        const c = p.getBoundingClientRect();
        return r.bottom <= c.top + 2 || r.top >= c.bottom - 2 || r.right <= c.left || r.left >= c.right;
      });
      const el = ref.current;
      const w = el ? el.offsetWidth : width || 220;
      const h = el ? el.offsetHeight : 200;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = placement.endsWith("end") ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, vw - w - 8));
      let top;
      const above = r.top - h - 6, below = r.bottom + 6;
      if (placement.startsWith("top")) top = above >= 8 ? above : below;
      else top = below + h <= vh - 8 ? below : above >= 8 ? above : Math.max(8, vh - h - 8);
      setPos({ top, left, hidden });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, anchorEl, placement, width]);
  useEffect(() => {
    if (!open || !onClose) return undefined;
    const down = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchorEl && anchorEl.contains(e.target)) return;
      onClose();
    };
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open, onClose, anchorEl]);
  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      data-cw-popover=""
      role={label ? "dialog" : undefined}
      aria-label={label}
      className="cw-root cw-pop bg-white border border-slate-200 rounded-xl shadow-xl"
      style={{ position: "fixed", top: pos ? pos.top : -9999, left: pos ? pos.left : -9999, width, maxWidth: "calc(100vw - 16px)", zIndex: 80, visibility: pos && !pos.hidden ? "visible" : "hidden" }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  );
}

function SelectMenu({ value, options, onChange, renderTrigger, renderOption, title, width = 210, align = "start", triggerClassName = "", ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        ref={setAnchor}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 rounded-md ${triggerClassName}`}
      >
        {renderTrigger(value, open)}
      </button>
      <Floating anchorEl={anchor} open={open} onClose={close} width={width} placement={align === "end" ? "bottom-end" : "bottom-start"}>
        <div className="p-1.5 max-h-80 overflow-y-auto cw-scroll" role="listbox">
          {title && <div className="px-2 pt-1 pb-1.5 cw-10 font-semibold uppercase tracking-wide text-slate-400">{title}</div>}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { if (opt.value !== value) onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 h-8 rounded-md text-left cw-12 ${opt.value === value ? "bg-orange-50 text-orange-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}
            >
              {renderOption ? renderOption(opt) : <span className="truncate">{opt.label}</span>}
              <span className="flex-1" />
              {opt.value === value && <Check size={14} className="text-orange-600 shrink-0" />}
            </button>
          ))}
        </div>
      </Floating>
    </>
  );
}

function StatusMenu({ value, onChange, small, options = STATUSES }) {
  if (options.length <= 1) return <StatusPill status={value} small={small} />;
  return (
    <SelectMenu
      value={value} onChange={onChange} title="Durumu değiştir" width={200} ariaLabel={`Durum: ${value}`}
      options={options.map((s) => ({ value: s, label: s }))}
      renderOption={(o) => <><span className={`h-2 w-2 rounded-full ${STATUS_META[o.value].dot}`} /><span>{o.label}</span></>}
      renderTrigger={(v) => <StatusPill status={v} small={small} chevron />}
    />
  );
}

function AssigneeMenu({ value, onChange, compact }) {
  return (
    <SelectMenu
      value={value || ""} onChange={onChange} title="Sorumlu ata" width={230} ariaLabel="Sorumlu seç"
      options={[{ value: "", label: "Atanmamış" }, ...USERS.map((u) => ({ value: u.id, label: u.name }))]}
      renderOption={(o) => <><Avatar userId={o.value} size={20} /><span className="truncate">{o.label}</span></>}
      triggerClassName="px-1 py-0.5 -mx-1 hover:bg-slate-100"
      renderTrigger={(v) => (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <Avatar userId={v} size={compact ? 20 : 22} />
          <span className={`truncate cw-12 ${v ? "text-slate-700 font-medium" : "text-slate-400"}`}>{USER_BY_ID[v]?.name || "Atanmamış"}</span>
        </span>
      )}
    />
  );
}

function PlatformMenu({ value, onChange }) {
  return (
    <SelectMenu
      value={value} onChange={onChange} title="Platform" width={200} ariaLabel="Platform seç"
      options={PLATFORMS.map((p) => ({ value: p, label: p }))}
      renderOption={(o) => <><span className={`h-2 w-2 rounded-full ${PLATFORM_DOT[o.value]}`} /><span>{o.label}</span></>}
      renderTrigger={(v) => <span className="inline-flex items-center gap-1"><PlatformChip platform={v} /><ChevronDown size={11} className="text-slate-400" /></span>}
    />
  );
}

function PriorityMenu({ value, onChange }) {
  return (
    <SelectMenu
      value={value} onChange={onChange} title="Öncelik" width={170} ariaLabel="Öncelik seç"
      options={PRIORITIES.map((p) => ({ value: p, label: p }))}
      renderOption={(o) => <PriorityLabel priority={o.value} />}
      triggerClassName="px-1 py-0.5 -mx-1 hover:bg-slate-100"
      renderTrigger={(v) => <PriorityLabel priority={v} />}
    />
  );
}

function BrandMenu({ value, onChange }) {
  const { state, brandsById } = useWS();
  return (
    <SelectMenu
      value={value} onChange={onChange} title="Marka" width={230} ariaLabel="Marka seç"
      options={state.brands.map((b) => ({ value: b.id, label: b.name }))}
      renderOption={(o) => <><BrandLogo brand={brandsById[o.value]} size={20} /><span className="truncate">{o.label}</span></>}
      triggerClassName="px-1 py-0.5 -mx-1 hover:bg-slate-100"
      renderTrigger={(v) => (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <BrandLogo brand={brandsById[v]} size={22} />
          <span className="truncate cw-12 font-medium text-slate-700">{brandsById[v]?.name}</span>
        </span>
      )}
    />
  );
}

function FormatMenu({ value, onChange }) {
  return (
    <SelectMenu
      value={value} onChange={onChange} title="Görev Türü" width={170} ariaLabel="Görev Türü seç"
      options={FORMATS.map((f) => ({ value: f, label: f }))}
      triggerClassName="px-1 py-0.5 -mx-1 hover:bg-slate-100"
      renderTrigger={(v) => <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-slate-100 text-slate-600 cw-10 font-semibold uppercase tracking-wide">{v}</span>}
    />
  );
}

function DateInput({ value, onChange, danger, className = "" }) {
  return (
    <input
      type="date"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Tarih seç"
      className={`h-7 w-full rounded-md border border-transparent bg-transparent px-1.5 cw-12 hover:border-slate-200 focus:border-orange-400 focus:bg-white focus:outline-none ${danger ? "text-red-600 font-semibold" : "text-slate-700"} ${className}`}
    />
  );
}

/* ───────────────────────── Görev göstergeleri: ek, yorum/revize, teslim ───────────────────────── */

/* Küçük resim; adres açılamazsa (süresi dolmuş/erişimsiz bağlantı) dosya türü simgesine düşer. */
function AttachmentThumb({ attachment: a, size = 32, aspect, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [a.thumbnail]);
  if (a.thumbnail && !failed) {
    const box = aspect ? { width: "100%", aspectRatio: aspect } : { width: size, height: size };
    return <img src={a.thumbnail} alt="" loading="lazy" onError={() => setFailed(true)} className={`object-cover shrink-0 bg-slate-100 ${aspect ? "" : "rounded-md"} ${className}`} style={box} />;
  }
  if (aspect) return <span className="w-full flex items-center justify-center bg-slate-50" style={{ aspectRatio: aspect }}><FileTypeTile type={a.type} size={36} /></span>;
  return <FileTypeTile type={a.type} size={size} />;
}

const attachmentTriggerIcon = (list) => {
  if (list.every((a) => a.type === "Görsel")) return FileImage;
  if (list.every((a) => a.type === "PDF" || a.type === "Doküman")) return FileText;
  return Paperclip;
};

function AttachmentList({ attachments, onPreview, contentRef }) {
  const images = attachments.filter((a) => a.type === "Görsel" && a.thumbnail).slice(0, 3);
  return (
    <div ref={contentRef}>
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 cw-10 font-semibold uppercase tracking-wide text-slate-400">
        <Paperclip size={11} />Ekler · {attachments.length}
      </div>
      {images.length > 0 && (
        <div className={`grid gap-1.5 px-2 pt-1 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {images.map((a) => (
            <button key={a.id} type="button" onClick={() => onPreview(a)} aria-label={`${a.name} önizle`} title={a.name} className="block rounded-lg overflow-hidden border border-slate-100 hover:border-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
              <AttachmentThumb attachment={a} aspect={images.length === 1 ? "16 / 9" : "1 / 1"} />
            </button>
          ))}
        </div>
      )}
      <ul className="p-1.5 max-h-60 overflow-y-auto cw-scroll">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center gap-1 rounded-lg hover:bg-slate-50 transition-colors">
            <button type="button" onClick={() => onPreview(a)} className="flex-1 min-w-0 flex items-center gap-2 px-1.5 py-1.5 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" aria-label={`${a.name} önizle`}>
              <AttachmentThumb attachment={a} size={30} />
              <span className="min-w-0">
                <span className="block cw-12 font-medium text-slate-800 truncate" title={a.name}>{a.name}</span>
                <span className="flex items-center gap-1 cw-10 text-slate-400">{a.type} · {a.size}{a.internal && <><span aria-hidden="true">·</span><Lock size={9} />Ekip içi</>}</span>
              </span>
            </button>
            <button type="button" onClick={() => onPreview(a)} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label={`${a.name} önizle`} title="Önizle"><Eye size={13} /></button>
            {a.driveUrl && <a href={a.driveUrl} target="_blank" rel="noopener noreferrer" className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50" aria-label={`${a.name} dosyasını Drive'da aç`} title="Drive'da aç"><ExternalLink size={13} /></a>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Mobilde ek önizlemesi: alttan açılan dokunmatik uyumlu panel. */
function AttachmentSheet({ attachments, onPreview, onClose }) {
  const ref = useRef(null);
  useFocusTrap(ref);
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [onClose]);
  return createPortal(
    <div className="cw-root fixed inset-0" style={{ zIndex: 85 }} data-cw-popover="" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Görev ekleri" className="cw-pop outline-none absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: "75vh", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <span className="shrink-0 mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        <div className="flex-1 min-h-0 overflow-y-auto cw-scroll"><AttachmentList attachments={attachments} onPreview={onPreview} /></div>
        <div className="shrink-0 p-2 border-t border-slate-100"><Btn variant="secondary" className="w-full" onClick={onClose}>Kapat</Btn></div>
      </div>
    </div>,
    document.body,
  );
}

/* Ek göstergesi: yalnızca görevde gerçekten dosya varsa görünür. Masaüstünde üzerine gelince, dokunmatik
   ekranda ve klavyede tıklayınca açılır; içerik body'ye portallanır (kart kaydırma alanında kırpılmaz). */
function AttachmentIndicator({ attachments, showEmpty }) {
  const { openPreview } = useWS();
  const sheet = useMediaQuery("(max-width: 639px)");
  const [anchor, setAnchor] = useState(null);
  const [mode, setMode] = useState(null); // null | "hover" | "pinned"
  const timer = useRef(null);
  const contentRef = useRef(null);
  const focusOnOpen = useRef(false);
  const close = useCallback(() => {
    clearTimeout(timer.current);
    if (anchor && contentRef.current && contentRef.current.contains(document.activeElement)) anchor.focus({ preventScroll: true });
    setMode(null);
  }, [anchor]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (mode !== "pinned" || !focusOnOpen.current) return undefined;
    focusOnOpen.current = false;
    const raf = requestAnimationFrame(() => { const b = contentRef.current && contentRef.current.querySelector("button"); if (b) b.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(raf);
  }, [mode]);
  if (!attachments.length) return showEmpty ? <span className="cw-11 text-slate-300" aria-label="Ek dosya yok">—</span> : null;
  const Icon = attachmentTriggerIcon(attachments);
  const keep = () => clearTimeout(timer.current);
  const hoverIn = (e) => { if (e.pointerType !== "mouse" || sheet) return; keep(); setMode((m) => m || "hover"); };
  const hoverOut = () => { keep(); timer.current = setTimeout(() => setMode((m) => (m === "hover" ? null : m)), 180); };
  const preview = (a) => { close(); openPreview("attachment", a.id); };
  const open = mode !== null;
  const label = `${attachments.length} ek dosya`;
  return (
    <>
      <button
        type="button"
        ref={setAnchor}
        onPointerEnter={hoverIn}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") hoverOut(); }}
        onClick={(e) => {
          e.stopPropagation();
          focusOnOpen.current = e.detail === 0; // klavyeyle açıldıysa odak katmana taşınır
          setMode((m) => (m === "pinned" ? null : "pinned"));
        }}
        aria-label={`${label}, önizlemeyi aç`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={label}
        className={`inline-flex items-center gap-0.5 h-6 min-w-6 px-1 -mx-0.5 rounded-md cw-11 font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${open ? "text-orange-600 bg-orange-50" : "text-slate-500 hover:text-orange-600 hover:bg-orange-50"}`}
      >
        <Icon size={13} aria-hidden="true" />{attachments.length}
      </button>
      {sheet ? (open && <AttachmentSheet attachments={attachments} onPreview={preview} onClose={close} />) : (
        <Floating anchorEl={anchor} open={open} onClose={close} width={300} placement="top-start" onMouseEnter={keep} onMouseLeave={() => { if (mode === "hover") hoverOut(); }} label="Görev ekleri">
          <AttachmentList attachments={attachments} onPreview={preview} contentRef={contentRef} />
        </Floating>
      )}
    </>
  );
}

/* Yorum ve revize göstergesi. Sıradan yorumlar ile müşterinin revize talepleri ayrı gösterilir;
   bekleyen (istendi / revizyonda) revize turuncu etiketle işaretlenir, tamamlanmış revize etiket göstermez. */
function FeedbackIndicator({ task, showEmpty }) {
  const { openTask, commentCount, revisionByTask } = useWS();
  const comments = commentCount[task.id] || 0;
  const rev = revisionByTask[task.id];
  const pending = isPendingRevision(rev);
  if (!comments && !pending) return showEmpty ? <span className="cw-11 text-slate-300" aria-label="Yorum yok">—</span> : null;
  return (
    <span className="inline-flex items-center gap-1">
      {pending && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openTask(task.id, "feedback"); }}
          title={`${rev.label}${rev.approval.note ? `: ${rev.approval.note}` : ""}`}
          aria-label={`${rev.label}. Müşteri geri bildirimini aç`}
          className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md border cw-10 font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${rev.state === "requested" ? "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100" : "bg-white border-orange-200 border-dashed text-orange-600 hover:bg-orange-50"}`}
        >
          <RotateCcw size={10} strokeWidth={2.4} aria-hidden="true" /><span className="cw-rev-label">{rev.state === "requested" ? "Revize" : "Revizyonda"}</span>
        </button>
      )}
      {comments > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openTask(task.id, "comments"); }}
          aria-label={`${comments} yorum, yorumları aç`}
          title={`${comments} yorum`}
          className="inline-flex items-center gap-0.5 h-6 min-w-6 px-1 -mx-0.5 rounded-md cw-11 font-medium tabular-nums text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          <MessageSquare size={13} aria-hidden="true" />{comments}
        </button>
      )}
    </span>
  );
}

const DEADLINE_TONES = {
  none: "text-slate-400", upcoming: "text-slate-500", soon: "text-orange-600 font-semibold",
  overdue: "text-red-600 font-semibold", done: "text-emerald-600 font-medium",
};
const DEADLINE_ICONS = { overdue: AlertTriangle, done: CheckCircle2 };

/* Son teslim etiketi: "Bugün, 16:30", "Yarın, 10:00", "12 Ekim, 14:00", "Gecikti · 2 saat", "Teslim edildi". */
function DeadlineLabel({ task, className = "" }) {
  useNow();
  const info = deadlineInfo(task);
  const Icon = DEADLINE_ICONS[info.state] || Clock;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${DEADLINE_TONES[info.state]} ${className}`} title={info.title} data-deadline={info.state}>
      <Icon size={11} aria-hidden="true" className="shrink-0" /><span className="sr-only">Son teslim: </span>{info.label}
    </span>
  );
}

function TimeInput({ value, onChange, danger, className = "" }) {
  return (
    <input
      type="time"
      value={value || ""}
      onChange={(e) => onChange(normalizeTime(e.target.value))}
      onClick={(e) => e.stopPropagation()}
      aria-label="Teslim saati seç"
      title="Teslim saati (boş bırakılırsa gün sonu)"
      className={`h-7 w-[5.5rem] rounded-md border border-transparent bg-transparent px-1.5 cw-12 hover:border-slate-200 focus:border-orange-400 focus:bg-white focus:outline-none ${danger ? "text-red-600 font-semibold" : "text-slate-700"} ${className}`}
    />
  );
}

/* "Ahmet Yıldız" → "A. Yıldız" */
const shortName = (name) => {
  const w = String(name || "").trim().split(/\s+/);
  return w.length > 1 ? `${w[0][0]}. ${w[w.length - 1]}` : w[0] || "";
};

/* ───────────────────────── Kenar çubuğu ───────────────────────── */

function Sidebar({ open, onClose, navItems, activeNav, onNav, counts, selectedBrandId, onSelectBrand, onHome, onNewBrand, onMyTasks, onResetFilters, onSignOut, onChangePassword, switcher }) {
  const { state } = useWS();
  const [q, setQ] = useState("");
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const stats = useMemo(() => {
    const m = {};
    state.tasks.forEach((t) => { const s = m[t.brandId] || (m[t.brandId] = { total: 0, done: 0 }); s.total++; if (t.status === "Tamamlandı") s.done++; });
    return m;
  }, [state.tasks]);
  const list = state.brands.filter((b) => norm(b.name).includes(norm(q)));
  const me = USER_BY_ID[ME];
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const asideRef = useRef(null);
  // Mobilde kapalı menü ekran dışında kalır; klavye ve ekran okuyucu için de devre dışı bırakılır.
  // Layout efekti: odak tuzağı menüye odaklanmadan önce inert kalkmış olmalı.
  useLayoutEffect(() => { if (asideRef.current) asideRef.current.toggleAttribute("inert", !open && !isDesktop); }, [open, isDesktop]);
  useFocusTrap(asideRef, open && !isDesktop);
  return (
    <>
      {open && <div className="fixed inset-0 bg-slate-900/30 lg:hidden" style={{ zIndex: 45 }} onClick={onClose} aria-hidden="true" />}
      <aside
        ref={asideRef}
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ zIndex: 46 }}
        aria-label="Ana menü"
      >
        <div className="h-16 shrink-0 flex items-center gap-2.5 px-4 border-b border-slate-100">
          <button type="button" onClick={onHome} aria-label="AgencyOS: ana görünüme dön (tüm markalar)" title="Ana görünüme dön" data-home-link=""
            className="flex-1 min-w-0 flex items-center gap-2.5 -mx-1.5 px-1.5 py-1 rounded-lg text-left cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
            <LogoImage height={24} />
          </button>
          <button type="button" onClick={onClose} className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100" aria-label="Menüyü kapat"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto cw-scroll px-3 py-3">
          <p className="px-2 pb-1.5 cw-10 font-semibold tracking-widest text-slate-400">{ROLE_LABELS[me?.role] === "Müşteri" ? "PORTAL" : "ÇALIŞMA ALANI"}</p>
          {navItems.map(({ key, label, Icon }) => {
            const active = activeNav === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onNav(key)}
                aria-current={active ? "true" : undefined}
                className={`w-full h-9 mb-0.5 flex items-center gap-2.5 px-2.5 rounded-lg border cw-13 text-left transition ${active ? "bg-orange-50 border-orange-200 text-orange-700 font-semibold" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"}`}
              >
                <Icon size={16} className={active ? "text-orange-600" : "text-slate-400"} />
                <span className="flex-1 truncate" title={label}>{label}</span>
                {counts[key] ? <span className={`min-w-5 h-5 px-1.5 rounded-md cw-10 font-semibold flex items-center justify-center ${active ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>{counts[key]}</span> : null}
              </button>
            );
          })}

          <div className="flex items-center justify-between px-2 pt-5 pb-1.5">
            <p className="cw-10 font-semibold tracking-widest text-slate-400">{state.brands.length > 1 || onNewBrand ? "MARKA SEÇİCİ" : "MARKAM"}</p>
            {onNewBrand && <button type="button" onClick={onNewBrand} className="p-1 rounded text-slate-400 hover:text-orange-600 hover:bg-orange-50" aria-label="Yeni marka ekle" title="Yeni marka ekle"><Plus size={14} /></button>}
          </div>
          {state.brands.length > 6 && (
            <label className="mx-1 mb-2 flex items-center gap-2 h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-orange-300">
              <Search size={13} className="text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marka ara…" aria-label="Marka ara" className="flex-1 min-w-0 bg-transparent outline-none cw-12 placeholder:text-slate-400" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Aramayı temizle" className="text-slate-400 hover:text-slate-700"><X size={12} /></button>}
            </label>
          )}
          {(state.brands.length > 1 || onNewBrand) && <button
            type="button"
            onClick={() => onSelectBrand("all")}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left mb-0.5 ${selectedBrandId === "all" ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-700"}`}
          >
            <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${selectedBrandId === "all" ? "bg-white/15" : "bg-slate-100 text-slate-500"}`}><Layers size={14} /></span>
            <span className="flex-1 min-w-0">
              <span className="block cw-12 font-semibold">Tüm Markalar</span>
              <span className={`block cw-10 ${selectedBrandId === "all" ? "text-slate-300" : "text-slate-400"}`}>{state.brands.length} marka · {state.tasks.length} görev</span>
            </span>
          </button>}
          {list.map((b) => {
            const s = stats[b.id] || { total: 0, done: 0 };
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            const active = selectedBrandId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelectBrand(state.brands.length === 1 && selectedBrandId === b.id ? "all" : b.id)}
                aria-pressed={selectedBrandId === b.id}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left mb-0.5 border ${active ? "bg-orange-50 border-orange-200" : "border-transparent hover:bg-slate-50"}`}
              >
                <BrandLogo brand={b} size={28} />
                <span className="flex-1 min-w-0">
                  <span className={`block cw-12 font-semibold truncate ${active ? "text-orange-800" : "text-slate-800"}`}>{b.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden"><span className={`block h-full ${BRAND_COLORS[b.color]?.bar || "bg-orange-500"}`} style={{ width: `${pct}%` }} /></span>
                    <span className="cw-10 text-slate-400 tabular-nums">{s.done}/{s.total}</span>
                  </span>
                </span>
              </button>
            );
          })}
          {list.length === 0 && <p className="px-2 py-3 cw-12 text-slate-400">Aramayla eşleşen marka yok.</p>}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3">
          {switcher}
          <button type="button" ref={setProfileAnchor} onClick={() => setProfileOpen((o) => !o)} aria-expanded={profileOpen} className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 text-left">
            <span className="relative">
              <Avatar userId={ME} size={34} />
              <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
            </span>
            <span className="flex-1 min-w-0 leading-tight">
              <span className="block cw-12 font-semibold text-slate-900 truncate">{me.name}</span>
              <span className="block cw-11 text-slate-400 truncate">{userTitle(me)}</span>
            </span>
            <ChevronUp size={14} className="text-slate-400" />
          </button>
          <Floating anchorEl={profileAnchor} open={profileOpen} onClose={closeProfile} width={232} placement="top-start">
            <div className="p-1.5">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <Avatar userId={ME} size={30} />
                <div className="min-w-0"><p className="cw-12 font-semibold text-slate-900 truncate">{me.name}</p><p className="cw-11 text-slate-400">{userTitle(me)} · {ROLE_LABELS[me.role]}</p></div>
              </div>
              <div className="h-px bg-slate-100 my-1" />
              {[
                [User, "Bana Atanan Görevler", onMyTasks],
                [RotateCcw, "Tüm Filtreleri Sıfırla", onResetFilters],
                [Plus, "Yeni Marka Ekle", onNewBrand],
                [KeyRound, "Şifremi Değiştir", onChangePassword],
                [LogOut, "Çıkış Yap", onSignOut],
              ].filter(([, , fn]) => fn).map(([Icon, label, fn]) => (
                <button key={label} type="button" onClick={() => { setProfileOpen(false); fn(); }} className="w-full flex items-center gap-2.5 h-8 px-2 rounded-md cw-12 text-slate-700 hover:bg-slate-50">
                  <Icon size={14} className="text-slate-400" />{label}
                </button>
              ))}
            </div>
          </Floating>
        </div>
      </aside>
    </>
  );
}

/* ───────────────────────── Üst kontrol çubuğu ───────────────────────── */

function FilterSelect({ label, value, onChange, options, selectRef }) {
  const active = value !== "all";
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="cw-10 font-semibold uppercase tracking-wide text-slate-400 md:sr-only">{label}</span>
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`h-8 w-full md:w-auto rounded-lg border px-2.5 pr-7 cw-12 font-medium outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 ${active ? "border-orange-300 bg-orange-50 text-orange-800" : "border-slate-200 bg-white text-slate-700"}`}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function TopBar({ title, brand, filters, setFilter, onMenu, onNewTask, onBulk, showFilters = true, showAssigneeFilter = true, searchPlaceholder = "Görev, marka veya kişi ara…", eyebrow = "ÇALIŞMA ALANI", searchRef, firstFilterRef, filtersOpen, setFiltersOpen, flash, activeCount, onClear, resultCount }) {
  return (
    <header className="bg-white border-b border-slate-200 shrink-0" style={{ zIndex: 30 }}>
      <div className="h-16 flex items-center gap-3 px-4 lg:px-6">
        <button type="button" onClick={onMenu} className="lg:hidden h-9 w-9 -ml-1 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Menüyü aç"><Menu size={19} /></button>
        <div className="hidden sm:flex items-center gap-2.5 min-w-0 shrink">
          {brand ? <BrandLogo brand={brand} size={34} /> : <span className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0"><Layers size={16} /></span>}
          <div className="min-w-0">
            <p className="cw-10 font-semibold tracking-widest text-slate-400 truncate">{eyebrow} · {fmtDateDay(TODAY).toLocaleUpperCase("tr-TR")}</p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 truncate leading-tight">{title}</h1>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex justify-end sm:justify-center">
          <label className="w-full max-w-md flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input ref={searchRef} value={filters.search} onChange={(e) => setFilter("search", e.target.value)} placeholder={searchPlaceholder} aria-label="Genel arama" className="flex-1 min-w-0 bg-transparent outline-none cw-13 placeholder:text-slate-400" />
            {filters.search ? (
              <button type="button" onClick={() => setFilter("search", "")} aria-label="Aramayı temizle" className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
            ) : (
              <kbd className="hidden md:inline-flex items-center h-5 px-1.5 rounded border border-slate-200 bg-white cw-10 text-slate-400 font-sans">Ctrl K</kbd>
            )}
          </label>
        </div>
        {onBulk && <Btn variant="secondary" onClick={onBulk} aria-label="Toplu Görev Ekle" title="Toplu Görev Ekle" className="px-2.5 sm:px-3.5"><Plus size={15} /><span className="hidden md:inline">Toplu Görev Ekle</span></Btn>}
        {onNewTask && <Btn variant="primary" onClick={onNewTask} aria-label="Yeni Görev" title="Yeni Görev" className="px-2.5 sm:px-3.5"><Plus size={16} strokeWidth={2.4} /><span className="hidden sm:inline">Yeni Görev</span></Btn>}
      </div>

      {showFilters && <div className="px-4 lg:px-6 pb-3 md:pb-0 md:h-12 md:flex md:items-center gap-2 border-t border-slate-100">
        <div className="flex items-center gap-2 pt-2.5 md:pt-0 md:hidden">
          <Btn size="sm" variant={filtersOpen ? "primary" : "secondary"} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}>
            <SlidersHorizontal size={13} />Filtreler{activeCount ? ` (${activeCount})` : ""}
          </Btn>
          <span className="cw-12 text-slate-500 ml-auto">{resultCount} görev</span>
        </div>
        <div className={`${filtersOpen ? "grid" : "hidden"} md:flex grid-cols-2 gap-2 pt-3 md:pt-0 md:items-center flex-1 min-w-0 rounded-lg ${flash ? "cw-flash" : ""}`}>
          <span className="hidden md:inline-flex items-center gap-1.5 cw-12 font-semibold text-slate-500 mr-1"><SlidersHorizontal size={13} />Filtreler</span>
          <FilterSelect
            label="Tarih" value={filters.dateScope} onChange={(v) => setFilter("dateScope", v)} selectRef={firstFilterRef}
            options={[["all", "Tüm Tarihler"], ["today", "Bugün"], ["tomorrow", "Yarın"], ["week", "Bu Hafta"], ["overdue", "Gecikenler"], ["custom", "Belirli Gün…"]]}
          />
          {filters.dateScope === "custom" && (
            <label className="flex flex-col gap-1">
              <span className="cw-10 font-semibold uppercase tracking-wide text-slate-400 md:sr-only">Gün</span>
              <input type="date" value={filters.customDate} onChange={(e) => setFilter("customDate", e.target.value || TODAY)} aria-label="Gün seç" className="h-8 rounded-lg border border-orange-300 bg-orange-50 px-2 cw-12 text-orange-800 outline-none focus:ring-2 focus:ring-orange-100" />
            </label>
          )}
          <FilterSelect
            label="Durum" value={filters.status} onChange={(v) => setFilter("status", v)}
            options={[["all", "Tüm Durumlar"], ["open", "Açık Görevler"], ["approval", "Onay Bekleyenler"], ...STATUSES.map((s) => [s, s])]}
          />
          {showAssigneeFilter && <FilterSelect
            label="Sorumlu" value={filters.assignee} onChange={(v) => setFilter("assignee", v)}
            options={[["all", "Tüm Sorumlular"], ["none", "Atanmamış"], ...USERS.map((u) => [u.id, u.name])]}
          />}
          <FilterSelect
            label="Platform" value={filters.platform} onChange={(v) => setFilter("platform", v)}
            options={[["all", "Tüm Platformlar"], ...PLATFORMS.map((p) => [p, p])]}
          />
          {activeCount > 0 && (
            <button type="button" onClick={onClear} className="col-span-2 md:col-span-1 h-8 inline-flex items-center justify-center gap-1 px-2.5 rounded-lg cw-12 font-semibold text-orange-700 hover:bg-orange-50">
              <X size={13} />Temizle ({activeCount})
            </button>
          )}
          <span className="hidden md:block ml-auto cw-12 text-slate-500 whitespace-nowrap">{resultCount} görev gösteriliyor</span>
        </div>
      </div>}
    </header>
  );
}

/* ───────────────────────── Genel bakış ───────────────────────── */

function Overview({ tasks, open, onToggle, filters, onApply }) {
  const count = (fn) => tasks.filter(fn).length;
  const done = count((t) => t.status === "Tamamlandı");
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const items = [
    { label: "Açık Görev", value: count((t) => t.status !== "Tamamlandı"), Icon: Inbox, tone: "bg-slate-100 text-slate-600", key: "status", val: "open" },
    { label: "Bugün Teslim", value: count((t) => t.dueDate === TODAY), Icon: Calendar, tone: "bg-orange-50 text-orange-600", key: "dateScope", val: "today" },
    { label: "Geciken", value: count(isOverdue), Icon: AlertTriangle, tone: "bg-red-50 text-red-600", key: "dateScope", val: "overdue" },
    { label: "Onay Bekleyen", value: count((t) => t.status === "Yönetici Onayı" || t.status === "Müşteri Onayı"), Icon: Clock, tone: "bg-violet-50 text-violet-600", key: "status", val: "approval" },
    { label: "Tamamlanan", value: done, Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", key: "status", val: "Tamamlandı" },
  ];
  return (
    <section aria-label="Genel bakış">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="flex items-center gap-2 cw-13 font-semibold text-slate-900"><LayoutDashboard size={15} className="text-slate-400" />Genel Bakış</h2>
        <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 cw-12 font-medium text-slate-500 hover:text-slate-900" aria-expanded={open}>
          {open ? "Gizle" : "Göster"}{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {items.map((it) => {
            const active = filters[it.key] === it.val;
            const Icon = it.Icon;
            return (
              <button
                key={it.label}
                type="button"
                onClick={() => onApply(it.key, active ? "all" : it.val)}
                title={active ? "Filtreyi kaldır" : "Bu kırılıma göre filtrele"}
                className={`text-left p-3 rounded-xl border bg-white transition ${active ? "border-orange-300 ring-2 ring-orange-100" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="cw-11 font-medium text-slate-500">{it.label}</span>
                  <span className={`h-6 w-6 rounded-md flex items-center justify-center ${it.tone}`}><Icon size={13} /></span>
                </div>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{it.value}</p>
              </button>
            );
          })}
          <div className="col-span-2 sm:col-span-1 p-3 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <span className="cw-11 font-medium text-slate-500">Genel İlerleme</span>
              <span className="cw-12 font-bold text-emerald-600">%{pct}</span>
            </div>
            <p className="mt-1.5 cw-12 text-slate-500"><strong className="text-xl text-slate-900 tabular-nums">{done}</strong> / {tasks.length} görev</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── Çalışma alanı sekmeleri ───────────────────────── */

const TABS = [
  { key: "feed", label: "Günlük Akış", Icon: LayoutGrid },
  { key: "table", label: "İçerik Tablosu", Icon: Table },
  { key: "kit", label: "Marka Kılavuzu", Icon: BookOpen },
  { key: "files", label: "Marka Dosyaları", Icon: FolderOpen },
];

function WorkspaceTabs({ tabs = TABS, tab, setTab, counts, sort, setSort }) {
  return (
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <div className="inline-flex p-1 gap-0.5 rounded-lg bg-slate-200/60 overflow-x-auto max-w-full" role="tablist" aria-label="Çalışma alanı görünümü">
        {tabs.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-md cw-12 whitespace-nowrap transition ${active ? "bg-white text-slate-900 font-semibold shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900 font-medium border border-transparent"}`}
            >
              <Icon size={14} className={active ? "text-orange-600" : ""} />{label}
              {counts[key] != null && <span className={`ml-0.5 h-4 min-w-4 px-1 rounded cw-10 font-semibold flex items-center justify-center ${active ? "bg-orange-100 text-orange-700" : "bg-white/70 text-slate-500"}`}>{counts[key]}</span>}
            </button>
          );
        })}
      </div>
      {tab !== "files" && tab !== "kit" && (
        <div className="flex items-center gap-1.5">
          <label className="cw-12 text-slate-500" htmlFor="cw-sort">Sırala</label>
          <select id="cw-sort" value={sort.key} onChange={(e) => setSort({ key: e.target.value, dir: sort.dir })} className="h-8 rounded-lg border border-slate-200 bg-white px-2 cw-12 font-medium text-slate-700 outline-none focus:border-orange-400">
            {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="button" onClick={() => setSort({ key: sort.key, dir: sort.dir === "asc" ? "desc" : "asc" })} className="h-8 w-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50" aria-label={sort.dir === "asc" ? "Artan sıralama, azalana çevir" : "Azalan sıralama, artana çevir"} title={sort.dir === "asc" ? "Artan" : "Azalan"}>
            {sort.dir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Günlük akış ───────────────────────── */

/* Kompakt görev satırı: başlık + durum; altında sorumlu · teslim zamanı · ek · yorum/revize. */
function TaskRow({ task }) {
  const { openTask, askDelete, attachmentsByTask, updateTask, can: allowed, statusOptions } = useWS();
  const done = task.status === "Tamamlandı";
  const attachments = attachmentsByTask[task.id] || EMPTY;
  const assignee = USER_BY_ID[task.assigneeId];
  return (
    <div
      onClick={() => openTask(task.id)}
      data-task-row={task.id}
      className="cw-row group relative rounded-lg px-2.5 py-2 hover:bg-slate-50 cursor-pointer focus-within:bg-slate-50"
    >
      <div className="flex items-start gap-2 min-w-0">
        <span className={`mt-[7px] h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_META[task.priority]?.dot}`} title={`Öncelik: ${task.priority}`} aria-hidden="true" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openTask(task.id); }}
          title={`${task.title} · ${task.platform} · ${task.format}`}
          className={`flex-1 min-w-0 text-left cw-13 font-medium cw-clamp2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${done ? "text-slate-400 line-through decoration-slate-300" : "text-slate-800"}`}
        >
          {task.title}
        </button>
        <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <StatusMenu value={task.status} small options={statusOptions(task)} onChange={(s) => updateTask(task.id, { status: s }, `Durum “${s}” olarak güncellendi.`)} />
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 pl-3.5 cw-11 text-slate-500 min-w-0">
        <Avatar userId={task.assigneeId} size={16} />
        <span className="truncate min-w-0 max-w-[40%]" title={assignee?.name || "Atanmamış"}>{assignee ? shortName(assignee.name) : "Atanmamış"}</span>
        <span className="text-slate-300 shrink-0" aria-hidden="true">·</span>
        <DeadlineLabel task={task} className="shrink-0" />
        <span className="flex-1" />
        <span className="shrink-0 inline-flex items-center gap-1.5">
          <ChecklistIndicator task={task} />
          <AttachmentIndicator attachments={attachments} />
          <FeedbackIndicator task={task} />
          {allowed("canDeleteTasks") && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); askDelete(task.id); }}
              className="sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
              aria-label={`${task.title} görevini sil`}
              title="Görevi sil"
            >
              <Trash2 size={12} />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/* Marka kartı: tüm kartlar aynı yükseklikte (420px); başlık ve alt bilgi sabit, görev listesi kendi içinde kayar. */
/* Kartın başında açık iş görünür; tamamlanan / onaylanan görevler (seçili sıralamayı koruyarak) sona alınır. */
const FINISHED = new Set(["Tamamlandı", "Onaylandı"]);
const activeFirst = (list) => [...list.filter((t) => !FINISHED.has(t.status)), ...list.filter((t) => FINISHED.has(t.status))];

function BrandCard({ brand, tasks, onFocusBrand }) {
  const { openNewTask, can: allowed } = useWS();
  useNow(); // gecikme sayısı zamanla değişir
  // Varsayılan olarak 1 görev; "Diğerlerini Göster" kartı aşağı doğru (en fazla 420px) açar, fazlası kart içinde kayar.
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef(null);
  const extra = Math.max(0, tasks.length - 1);
  const open = expanded && extra > 0;
  const toggle = () => { setExpanded((e) => !e); if (listRef.current) listRef.current.scrollTop = 0; };
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const done = tasks.filter((t) => t.status === "Tamamlandı").length;
  const today = tasks.filter((t) => t.dueDate === TODAY).length;
  const pending = tasks.length - done;
  const overdue = tasks.filter(isOverdue).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const color = BRAND_COLORS[brand.color] || BRAND_COLORS.orange;
  return (
    <article data-brand-card={brand.id} data-expanded={open ? "true" : "false"} aria-label={`${brand.name} görevleri`} className="cw-brand-card flex flex-col min-w-0 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 hover:shadow-md transition-[border-color,box-shadow] duration-150">
      <header className="shrink-0 px-4 pt-3.5 pb-3 border-b border-slate-100" data-card-header="">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandLogo brand={brand} size={32} />
          <div className="flex-1 min-w-0">
            <h3 className="cw-13 font-bold text-slate-900 truncate" title={brand.name}>{brand.name}</h3>
            <p className="cw-11 text-slate-400 truncate">{brand.sector} · {tasks.length} görev</p>
          </div>
          {overdue > 0 && <span className="shrink-0 h-5 px-1.5 rounded-md bg-red-50 text-red-600 cw-10 font-bold inline-flex items-center gap-1" title={`${overdue} geciken görev`}><AlertTriangle size={10} aria-hidden="true" />{overdue}<span className="sr-only"> geciken görev</span></span>}
          <button type="button" ref={setMenuAnchor} onClick={() => setMenuOpen((o) => !o)} aria-label={`${brand.name} seçenekleri`} aria-expanded={menuOpen} title="Seçenekler" className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${menuOpen ? "bg-slate-100 text-slate-700" : ""}`}>
            <MoreHorizontal size={16} />
          </button>
          <Floating anchorEl={menuAnchor} open={menuOpen} onClose={closeMenu} width={220} placement="bottom-end">
            <div className="p-1.5">
              {[
                allowed("canCreateTasks") && [Plus, "Yeni Görev Ekle", () => openNewTask(brand.id)],
                [Eye, "Sadece Bu Markayı Göster", () => onFocusBrand(brand.id, "feed")],
                [Table, "Tabloda Görüntüle", () => onFocusBrand(brand.id, "table")],
                [BookOpen, "Marka Kılavuzunu Aç", () => onFocusBrand(brand.id, "kit")],
                allowed("canViewBrandFiles") && [FolderOpen, "Marka Dosyalarını Aç", () => onFocusBrand(brand.id, "files")],
              ].filter(Boolean).map(([Icon, label, fn]) => (
                <button key={label} type="button" onClick={() => { setMenuOpen(false); fn(); }} className="w-full flex items-center gap-2.5 h-8 px-2 rounded-md cw-12 text-slate-700 hover:bg-slate-50">
                  <Icon size={14} className="text-slate-400" />{label}
                </button>
              ))}
            </div>
          </Floating>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-label="Tamamlanma oranı" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full ${color.bar} transition-all`} style={{ width: `${pct}%` }} /></div>
          <span className="cw-11 font-semibold text-slate-600 tabular-nums">%{pct}</span>
        </div>
        <dl className="mt-2 flex items-center gap-3 cw-11 text-slate-400">
          {[["Bugün", today, "text-orange-600"], ["Tamamlanan", done, "text-emerald-600"], ["Bekleyen", pending, "text-slate-700"]].map(([l, v, c]) => (
            <div key={l} className="inline-flex items-center gap-1"><dt>{l}</dt><dd className={`font-bold tabular-nums ${c}`}>{v}</dd></div>
          ))}
        </dl>
      </header>
      <div ref={listRef} id={`cw-tasks-${brand.id}`} className={`cw-tasks flex-1 min-h-0 ${open ? "overflow-y-auto" : "overflow-hidden"} cw-scroll px-1.5 py-1 divide-y divide-slate-100`} data-card-tasks="" tabIndex={0} role="region" aria-label={`${brand.name} görev listesi`}>
        {tasks.length ? (open ? tasks : tasks.slice(0, 1)).map((t) => <TaskRow key={t.id} task={t} />) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Inbox size={20} className="text-slate-300" />
            <p className="cw-12 text-slate-500 mt-2">Bu markada gösterilecek görev yok.</p>
          </div>
        )}
      </div>
      {extra > 0 && (
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`cw-tasks-${brand.id}`} data-card-toggle=""
          className="shrink-0 mx-1.5 mb-1 h-8 inline-flex items-center justify-center gap-1 rounded-md cw-12 font-semibold text-orange-700 hover:bg-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
          {open ? <><ChevronUp size={14} />Daha Az Göster</> : <><ChevronDown size={14} />Diğerlerini Göster ({extra})</>}
        </button>
      )}
      <footer className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-t border-slate-100" data-card-footer="">
        {allowed("canCreateTasks") ? <button type="button" onClick={() => openNewTask(brand.id)} className="flex-1 h-8 inline-flex items-center gap-1.5 px-2 rounded-md cw-12 font-medium text-slate-500 hover:text-orange-700 hover:bg-orange-50 transition-colors"><Plus size={14} />Görev ekle</button> : <span className="flex-1" />}
        <button type="button" onClick={() => onFocusBrand(brand.id, "kit")} title="Marka kılavuzu" className="h-8 inline-flex items-center gap-1.5 px-2 rounded-md cw-12 font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"><BookOpen size={14} />Kılavuz</button>
        {allowed("canViewBrandFiles") && <button type="button" onClick={() => onFocusBrand(brand.id, "files")} className="h-8 inline-flex items-center gap-1.5 px-2 rounded-md cw-12 font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"><FolderOpen size={14} />Dosyalar</button>}
      </footer>
    </article>
  );
}

function DailyFeed({ brands, tasks, hasActiveFilters, onClear, onFocusBrand }) {
  const { openNewTask, can: allowed } = useWS();
  const groups = brands
    .map((b) => ({ brand: b, tasks: tasks.filter((t) => t.brandId === b.id) }))
    .filter((g) => !hasActiveFilters || g.tasks.length);
  if (!groups.length) {
    return (
      <EmptyBlock
        icon={Search}
        title="Bu kriterlere uygun görev bulunamadı"
        text="Filtreleri değiştirerek veya arama ifadesini temizleyerek tekrar deneyebilirsiniz."
        action={hasActiveFilters ? <Btn variant="secondary" onClick={onClear}>Filtreleri Temizle</Btn> : allowed("canCreateTasks") ? <Btn variant="primary" onClick={() => openNewTask()}><Plus size={14} />Yeni Görev</Btn> : null}
      />
    );
  }
  return (
    <div className="cw-brand-wrap">
      <div className="cw-brand-grid">
        {groups.map((g) => <BrandCard key={g.brand.id} brand={g.brand} tasks={activeFirst(g.tasks)} onFocusBrand={onFocusBrand} />)}
      </div>
    </div>
  );
}

/* ───────────────────────── İçerik tablosu ───────────────────────── */

const COLUMNS = [
  ["brand", "Marka", 170], ["title", "Görev", 290], ["platform", "Platform", 140], ["assignee", "Sorumlu", 170],
  ["status", "Durum", 160], ["priority", "Öncelik", 110], ["publish", "Yayın Tarihi", 135], ["due", "Son Teslim", 215],
  ["comments", "Yorum", 120], ["files", "Dosya", 76], [null, "", 80],
];
const TABLE_WIDTH = COLUMNS.reduce((s, c) => s + c[2], 0);

function TitleCell({ task }) {
  const { openTask, updateTask, can: allowed } = useWS();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(task.title);
  useEffect(() => { if (!editing) setV(task.title); }, [task.title, editing]);
  const commit = () => {
    const t = v.trim();
    if (t && t !== task.title) updateTask(task.id, { title: t }, "Görev başlığı güncellendi.");
    else setV(task.title);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { e.stopPropagation(); setV(task.title); setEditing(false); } }}
        aria-label="Görev başlığı"
        className="w-full h-8 px-2 rounded-md border border-orange-300 ring-2 ring-orange-100 outline-none cw-13 font-medium"
      />
    );
  }
  return (
    <div className="group/title flex items-center gap-1 min-w-0">
      <button type="button" onClick={() => openTask(task.id)} className={`min-w-0 text-left cw-13 font-medium truncate hover:text-orange-700 hover:underline ${task.status === "Tamamlandı" ? "text-slate-400 line-through" : "text-slate-800"}`} title={task.title}>
        {task.title}
      </button>
      <ChecklistIndicator task={task} />
      {allowed("canEditContent") && <button type="button" onClick={() => setEditing(true)} className="shrink-0 p-1 rounded text-slate-300 hover:text-slate-700 hover:bg-slate-100 opacity-100 sm:opacity-0 sm:group-hover/title:opacity-100 focus:opacity-100" aria-label="Başlığı düzenle" title="Başlığı düzenle">
        <Pencil size={12} />
      </button>}
    </div>
  );
}

function ContentTable({ tasks, sort, setSort, defaultBrandId, dueDefault, isVisible }) {
  const { state, dispatch, updateTask, openTask, askDelete, attachmentsByTask, notify, can: allowed, statusOptions, brandsById } = useWS();
  useNow();
  const canAssign = allowed("canAssignTasks"), canEdit = allowed("canEditContent");
  const [quickBrand, setQuickBrand] = useState(defaultBrandId);
  const [quickTitle, setQuickTitle] = useState("");
  useEffect(() => { setQuickBrand(defaultBrandId); }, [defaultBrandId]);
  const headerSort = (key) => {
    if (!key) return;
    setSort(sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };
  const quickAdd = () => {
    const title = quickTitle.trim();
    if (!title || !quickBrand) return;
    const now = new Date().toISOString();
    const task = { id: uid(), code: null, brandId: quickBrand, title, platform: "Instagram", format: "Gönderi", assigneeId: "", status: "Başlanmadı", priority: "Orta", publishDate: dueDefault, dueDate: dueDefault, dueTime: "", description: "", createdAt: now, updatedAt: now };
    if (!dispatch({ type: "ADD_TASK", task })) return;
    setQuickTitle("");
    notify(isVisible(task) ? "Görev eklendi." : "Görev eklendi ancak mevcut filtreler nedeniyle listede görünmüyor.", isVisible(task) ? "success" : "info");
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-auto cw-scroll" style={{ maxHeight: "calc(100vh - 230px)", minHeight: 320 }}>
        <table className="border-collapse table-fixed" style={{ width: TABLE_WIDTH, minWidth: "100%" }}>
          <colgroup>{COLUMNS.map(([k, , w], i) => <col key={k || i} style={{ width: w }} />)}</colgroup>
          <thead>
            <tr>
              {COLUMNS.map(([key, label], i) => (
                <th key={key || i} scope="col" className="sticky top-0 bg-slate-50 border-b border-slate-200 text-left px-3 h-9 cw-10 font-semibold uppercase tracking-wide text-slate-500" style={{ zIndex: 2 }}>
                  {key ? (
                    <button type="button" onClick={() => headerSort(key)} className={`inline-flex items-center gap-1 hover:text-slate-900 ${sort.key === key ? "text-slate-900" : ""}`} aria-label={`${label} sütununa göre sırala`}>
                      {label}
                      {sort.key === key ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowDown size={11} className="opacity-0" />}
                    </button>
                  ) : <span className="sr-only">İşlemler</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const overdue = isOverdue(t);
              return (
                <tr key={t.id} className="group border-b border-slate-100 hover:bg-orange-50/30 h-12">
                  <td className="px-3">{canAssign ? <BrandMenu value={t.brandId} onChange={(v) => updateTask(t.id, { brandId: v }, "Marka güncellendi.")} /> : <span className="inline-flex items-center gap-1.5 min-w-0"><BrandLogo brand={brandsById[t.brandId]} size={22} /><span className="truncate cw-12 font-medium text-slate-700">{brandsById[t.brandId]?.name}</span></span>}</td>
                  <td className="px-3"><TitleCell task={t} /></td>
                  <td className="px-3">{canEdit ? <PlatformMenu value={t.platform} onChange={(v) => updateTask(t.id, { platform: v }, "Platform güncellendi.")} /> : <PlatformChip platform={t.platform} />}</td>
                  <td className="px-3">{canAssign ? <AssigneeMenu compact value={t.assigneeId} onChange={(v) => updateTask(t.id, { assigneeId: v }, "Sorumlu güncellendi.")} /> : <span className="inline-flex items-center gap-1.5 min-w-0"><Avatar userId={t.assigneeId} size={20} /><span className="truncate cw-12 text-slate-700">{USER_BY_ID[t.assigneeId]?.name || "Atanmamış"}</span></span>}</td>
                  <td className="px-3"><StatusMenu value={t.status} options={statusOptions(t)} onChange={(v) => updateTask(t.id, { status: v }, `Durum “${v}” olarak güncellendi.`)} /></td>
                  <td className="px-3">{canAssign ? <PriorityMenu value={t.priority} onChange={(v) => updateTask(t.id, { priority: v }, "Öncelik güncellendi.")} /> : <PriorityLabel priority={t.priority} />}</td>
                  <td className="px-2">{canEdit ? <DateInput value={t.publishDate} onChange={(v) => updateTask(t.id, { publishDate: v }, "Yayın tarihi güncellendi.")} /> : <span className="px-1.5 cw-12 text-slate-700">{fmtDate(t.publishDate)}</span>}</td>
                  <td className="px-2">
                    {canAssign ? (
                      <div className="flex items-center gap-0.5" title={deadlineInfo(t).label}>
                        <DateInput value={t.dueDate} danger={overdue} className="flex-1 min-w-0" onChange={(v) => updateTask(t.id, { dueDate: v }, "Son teslim tarihi güncellendi.")} />
                        <TimeInput value={t.dueTime} danger={overdue} onChange={(v) => updateTask(t.id, { dueTime: v }, "Teslim saati güncellendi.")} />
                      </div>
                    ) : <span className="px-1.5 cw-12"><DeadlineLabel task={t} /></span>}
                  </td>
                  <td className="px-3"><FeedbackIndicator task={t} showEmpty /></td>
                  <td className="px-3"><AttachmentIndicator attachments={attachmentsByTask[t.id] || EMPTY} showEmpty /></td>
                  <td className="px-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" onClick={() => openTask(t.id)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100" aria-label="Detayı aç" title="Detayı aç"><ChevronRight size={15} /></button>
                      {allowed("canDeleteTasks") && <button type="button" onClick={() => askDelete(t.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Görevi sil" title="Görevi sil"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr><td colSpan={COLUMNS.length} className="px-4 py-12 text-center cw-13 text-slate-500">{allowed("canCreateTasks") ? "Bu filtrelere uygun görev bulunamadı. Aşağıdan hızlıca yeni görev ekleyebilirsiniz." : "Bu filtrelere uygun görev bulunamadı."}</td></tr>
            )}
            {allowed("canCreateTasks") && state.brands.length > 0 && <tr className="bg-slate-50/60">
              <td className="px-3 py-2">
                <select value={quickBrand} onChange={(e) => setQuickBrand(e.target.value)} aria-label="Yeni görev markası" className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 cw-12 outline-none focus:border-orange-400">
                  {state.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </td>
              <td className="px-3 py-2" colSpan={3}>
                <div className="flex items-center gap-2">
                  <Plus size={14} className="text-slate-400 shrink-0" />
                  <input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }} placeholder="Yeni görev adı yazın ve Enter'a basın…" aria-label="Yeni görev adı" className="flex-1 h-8 rounded-md border border-slate-200 bg-white px-2.5 cw-13 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                  <Btn size="sm" variant="primary" disabled={!quickTitle.trim()} onClick={quickAdd}>Ekle</Btn>
                </div>
              </td>
              <td colSpan={COLUMNS.length - 4} className="px-3 py-2 cw-11 text-slate-400">Varsayılan: Instagram · Başlanmadı · {relDay(dueDefault)}</td>
            </tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 h-10 border-t border-slate-200 bg-slate-50 cw-12 text-slate-500">
        <span>{tasks.length} görev</span>
        <span className="hidden sm:inline">{canAssign || canEdit ? "Hücrelere tıklayarak satır içinde düzenleyebilirsiniz." : "Durumu güncellemek için durum etiketine tıklayın."}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── Marka dosyaları ───────────────────────── */

function AssetCard({ asset }) {
  const { openPreview, copyLink } = useWS();
  return (
    <div className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-shadow flex flex-col">
      <button type="button" onClick={() => openPreview("asset", asset.id)} className="block w-full bg-slate-50 border-b border-slate-100" style={{ aspectRatio: "16 / 10" }} aria-label={`${asset.name} önizle`}>
        {asset.thumbnail ? <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center"><FileTypeTile type={asset.type} size={48} /></span>}
      </button>
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="min-w-0">
          <p className="cw-12 font-semibold text-slate-900 truncate" title={asset.name}>{asset.name}</p>
          <p className="cw-11 text-slate-400">{asset.type} · {asset.size}</p>
        </div>
        <div className="flex items-center gap-2">
          <Avatar userId={asset.owner} size={18} />
          <span className="cw-11 text-slate-500 truncate flex-1">{fmtDate(asset.updatedAt)}</span>
          <ApprovalBadge status={asset.approvalStatus} />
        </div>
        <div className="flex items-center gap-1 pt-1 mt-auto border-t border-slate-100">
          <button type="button" onClick={() => openPreview("asset", asset.id)} className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded-md cw-11 font-medium text-slate-600 hover:bg-slate-100"><Eye size={12} />Önizle</button>
          <a href={asset.driveUrl} target="_blank" rel="noopener noreferrer" className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded-md cw-11 font-medium text-slate-600 hover:bg-slate-100"><ExternalLink size={12} />Drive'da Aç</a>
          <button type="button" onClick={() => copyLink(asset.driveUrl)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="Bağlantıyı Kopyala" title="Bağlantıyı Kopyala"><Copy size={12} /></button>
        </div>
      </div>
    </div>
  );
}

function AssetListRow({ asset, showFolder }) {
  const { openPreview, copyLink } = useWS();
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50">
      {asset.thumbnail ? <img src={asset.thumbnail} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" /> : <FileTypeTile type={asset.type} size={36} />}
      <button type="button" onClick={() => openPreview("asset", asset.id)} className="flex-1 min-w-0 text-left">
        <p className="cw-12 font-semibold text-slate-900 truncate hover:text-orange-700">{asset.name}</p>
        <p className="cw-11 text-slate-400 truncate">{asset.type} · {asset.size}{showFolder ? ` · ${FOLDER_BY_ID[asset.folderId]?.name}` : ""}</p>
      </button>
      <span className="hidden md:flex items-center gap-1.5 w-40 cw-11 text-slate-500"><Avatar userId={asset.owner} size={18} /><span className="truncate">{USER_BY_ID[asset.owner]?.name}</span></span>
      <span className="hidden sm:block w-16 cw-11 text-slate-500">{fmtDate(asset.updatedAt)}</span>
      <span className="hidden sm:block"><ApprovalBadge status={asset.approvalStatus} /></span>
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={() => openPreview("asset", asset.id)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100" aria-label="Önizle" title="Önizle"><Eye size={14} /></button>
        <a href={asset.driveUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50" aria-label="Drive'da Aç" title="Drive'da Aç"><ExternalLink size={14} /></a>
        <button type="button" onClick={() => copyLink(asset.driveUrl)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100" aria-label="Bağlantıyı Kopyala" title="Bağlantıyı Kopyala"><Copy size={14} /></button>
      </div>
    </div>
  );
}

function AssetCollection({ assets, view, showFolder, emptyText, onAdd }) {
  if (!assets.length) {
    return <EmptyBlock icon={FolderOpen} title={emptyText} text="Dosyalar Google Drive'da saklanır; buraya yalnızca bağlantısı eklenir." action={onAdd ? <Btn variant="primary" onClick={onAdd}><LinkIcon size={14} />Drive Bağlantısı Ekle</Btn> : null} />;
  }
  if (view === "list") {
    return <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">{assets.map((a) => <AssetListRow key={a.id} asset={a} showFolder={showFolder} />)}</div>;
  }
  return <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{assets.map((a) => <AssetCard key={a.id} asset={a} />)}</div>;
}

function BrandFiles({ selectedBrandId, onSelectBrand, folderId, setFolderId, onAddAsset }) {
  const { state, brandsById } = useWS();
  const [q, setQ] = useState("");
  const [approval, setApproval] = useState("all");
  const [view, setView] = useState("grid");
  const brand = brandsById[selectedBrandId];
  const folder = folderId ? FOLDER_BY_ID[folderId] : null;
  const brandAssets = useMemo(() => (brand ? state.assets.filter((a) => a.brandId === brand.id) : EMPTY), [state.assets, brand]);
  const filterAsset = (a) => (approval === "all" || a.approvalStatus === approval) && (!q || norm(a.name).includes(norm(q)));

  const crumbs = (
    <nav aria-label="Dosya konumu" className="flex items-center gap-1 cw-12 flex-wrap">
      <button type="button" onClick={() => { onSelectBrand("all"); setFolderId(null); }} className={`inline-flex items-center gap-1.5 px-1.5 py-1 rounded-md ${brand ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100" : "text-slate-900 font-semibold"}`}><HardDrive size={13} />Markalar</button>
      {brand && <><ChevronRight size={13} className="text-slate-300" /><button type="button" onClick={() => setFolderId(null)} className={`px-1.5 py-1 rounded-md ${folder ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100" : "text-slate-900 font-semibold"}`}>{brand.name}</button></>}
      {folder && <><ChevronRight size={13} className="text-slate-300" /><span className="px-1.5 py-1 text-slate-900 font-semibold">{folder.name}</span></>}
    </nav>
  );

  if (!brand) {
    if (!state.brands.length) return <EmptyBlock icon={FolderOpen} title="Erişebildiğiniz marka yok" text="Bir markaya atandığınızda dosyaları burada görünür." />;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">{crumbs}<span className="cw-12 text-slate-500">Bir marka seçerek klasör yapısını açın.</span></div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {state.brands.map((b) => {
            const count = state.assets.filter((a) => a.brandId === b.id).length;
            return (
              <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-md transition-shadow flex items-center gap-3">
                <button type="button" onClick={() => { onSelectBrand(b.id); setFolderId(null); }} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <BrandLogo brand={b} size={40} />
                  <span className="min-w-0">
                    <span className="block cw-13 font-semibold text-slate-900 truncate">{b.name}</span>
                    <span className="block cw-11 text-slate-400">{FOLDERS.length} klasör · {count} dosya</span>
                  </span>
                </button>
                {b.driveFolderId && <a href={brandDriveLink(b)} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50" aria-label={`${b.name} Drive klasörünü aç`} title="Drive'da Aç"><ExternalLink size={15} /></a>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const folderAssets = folder ? brandAssets.filter((a) => a.folderId === folder.id).filter(filterAsset) : [];
  const searchResults = !folder && (q || approval !== "all") ? brandAssets.filter(filterAsset) : null;
  const driveLink = brandDriveLink(brand);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {crumbs}
        <div className="flex items-center gap-2">
          {driveLink && <a href={driveLink} target="_blank" rel="noopener noreferrer" className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-slate-200 bg-white cw-12 font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink size={13} />Drive'da Aç</a>}
          {onAddAsset && <Btn size="sm" variant="primary" onClick={() => onAddAsset(folder ? folder.id : "gorseller")}><LinkIcon size={13} />Drive Bağlantısı Ekle</Btn>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-slate-200 bg-white flex-1 min-w-48 max-w-sm focus-within:border-orange-300">
          <Search size={13} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={folder ? `${folder.name} içinde ara…` : `${brand.name} dosyalarında ara…`} aria-label="Dosya ara" className="flex-1 min-w-0 bg-transparent outline-none cw-12 placeholder:text-slate-400" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Aramayı temizle" className="text-slate-400 hover:text-slate-700"><X size={12} /></button>}
        </label>
        <select value={approval} onChange={(e) => setApproval(e.target.value)} aria-label="Onay durumu" className="h-8 rounded-lg border border-slate-200 bg-white px-2 cw-12 font-medium text-slate-700 outline-none focus:border-orange-400">
          <option value="all">Tüm Onay Durumları</option>
          {APPROVALS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="inline-flex p-0.5 rounded-lg border border-slate-200 bg-white ml-auto" role="group" aria-label="Görünüm">
          <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} className={`h-7 w-8 flex items-center justify-center rounded-md ${view === "grid" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`} aria-label="Izgara görünümü" title="Izgara görünümü"><LayoutGrid size={14} /></button>
          <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`h-7 w-8 flex items-center justify-center rounded-md ${view === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`} aria-label="Liste görünümü" title="Liste görünümü"><List size={14} /></button>
        </div>
      </div>

      {folder ? (
        <AssetCollection assets={folderAssets} view={view} emptyText={q || approval !== "all" ? "Bu klasörde eşleşen dosya yok." : "Bu klasör henüz boş."} onAdd={onAddAsset ? () => onAddAsset(folder.id) : null} />
      ) : searchResults ? (
        <>
          <p className="cw-12 text-slate-500">{searchResults.length} dosya bulundu</p>
          <AssetCollection assets={searchResults} view={view} showFolder emptyText="Aramanızla eşleşen dosya bulunamadı." />
        </>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {FOLDERS.map((f) => {
            const items = brandAssets.filter((a) => a.folderId === f.id);
            const pending = items.filter((a) => a.approvalStatus !== "Onaylandı").length;
            const last = items.reduce((m, a) => (a.updatedAt > m ? a.updatedAt : m), "");
            const Icon = f.Icon;
            return (
              <button key={f.id} type="button" onClick={() => setFolderId(f.id)} className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-orange-200 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <span className="relative h-10 w-10 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center"><Folder size={22} fill="currentColor" fillOpacity={0.25} /><Icon size={11} className="absolute bottom-1.5 right-1.5 text-amber-700" /></span>
                  {pending > 0 && <span className="h-5 px-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 cw-10 font-semibold inline-flex items-center">{pending} onay bekliyor</span>}
                </div>
                <p className="mt-3 cw-13 font-semibold text-slate-900">{f.name}</p>
                <p className="cw-11 text-slate-400">{items.length} dosya{last ? ` · Son güncelleme ${fmtDate(last)}` : ""}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Zengin metin düzenleyici ───────────────────────── */

function RichTextEditor({ value, onChange, onCommit, docKey, readOnly, allowImages = true, headings = false, label = "Görev açıklaması", placeholder = "Açıklama, brief veya notlar ekleyin…" }) {
  const { media, notify } = useWS();
  const [uploading, setUploading] = useState(false);
  const ref = useRef(null);
  const wrapRef = useRef(null);
  const savedRange = useRef(null);
  const fileRef = useRef(null);
  const dirty = useRef(false);
  const [active, setActive] = useState({});
  const [mode, setMode] = useState(null);
  const [url, setUrl] = useState("");
  const [chip, setChip] = useState(null);

  /* Storage görsellerine süreli imzalı adres verir (DOM'u doğrudan günceller, değişiklik sayılmaz). */
  const resolveImages = useCallback(() => {
    const el = ref.current;
    if (!el || !media) return;
    const imgs = [...el.querySelectorAll("img[data-path]")].filter((img) => !img.getAttribute("src"));
    if (!imgs.length) return;
    media.resolve(imgs.map((img) => img.getAttribute("data-path"))).then((urls) => {
      imgs.forEach((img) => { const u = urls[img.getAttribute("data-path")]; if (u && el.contains(img)) img.setAttribute("src", u); });
    }).catch(() => {});
  }, [media]);
  const render = useCallback((html) => { if (ref.current) { ref.current.innerHTML = sanitizeHtml(html); resolveImages(); } }, [resolveImages]);
  useEffect(() => { render(value); dirty.current = false; }, [docKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Başka bir üye açıklamayı değiştirdiyse ve editör şu an kullanılmıyorsa yeni içeriği göster.
  useEffect(() => {
    const el = ref.current;
    if (!el || dirty.current || el.contains(document.activeElement)) return;
    if (toStoredHtml(sanitizeHtml(el.innerHTML)) !== (value || "")) render(value);
  }, [value, render]);

  const refresh = () => {
    try {
      setActive({
        bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"),
        ul: document.queryCommandState("insertUnorderedList"), ol: document.queryCommandState("insertOrderedList"),
      });
    } catch (e) { setActive({}); }
  };
  const emit = () => { dirty.current = true; onChange(toStoredHtml(sanitizeHtml(ref.current.innerHTML))); };
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current && ref.current.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const el = ref.current;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && el.contains(savedRange.current.startContainer)) {
      sel.removeAllRanges(); sel.addRange(savedRange.current);
    } else {
      const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
    }
  };
  const exec = (cmd, arg) => { restoreSelection(); document.execCommand(cmd, false, arg); saveSelection(); emit(); refresh(); };
  const normalizeUrl = (u) => { const t = u.trim(); if (!t) return ""; return /^(https?:|mailto:|data:image\/)/i.test(t) ? t : `https://${t}`; };

  const applyLink = () => {
    const href = normalizeUrl(url);
    if (!href) return;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.getRangeAt(0).collapsed) {
      document.execCommand("insertHTML", false, `<a href="${escHtml(href)}" target="_blank" rel="noopener noreferrer">${escHtml(href)}</a>&nbsp;`);
    } else {
      document.execCommand("createLink", false, href);
      ref.current.querySelectorAll("a").forEach((a) => { if (!a.getAttribute("target")) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); } });
    }
    saveSelection(); emit(); setMode(null); setUrl("");
  };
  const insertImage = (src, path) => {
    if (!src) return;
    restoreSelection();
    document.execCommand("insertHTML", false, `<img src="${escHtml(src)}"${path ? ` data-path="${escHtml(path)}"` : ""} alt="Görsel" /><p><br></p>`);
    saveSelection(); emit(); setMode(null); setUrl("");
  };
  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) { notify("Görsel en fazla 5 MB olabilir.", "error"); return; }
    if (media) {
      setUploading(true);
      media.upload(file, docKey)
        .then(({ url, path }) => insertImage(url, path))
        .catch((err) => notify(`Görsel yüklenemedi: ${err?.message || "bilinmeyen hata"}`, "error"))
        .finally(() => setUploading(false));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => insertImage(String(reader.result));
    reader.readAsDataURL(file);
  };
  const onEditorClick = (e) => {
    const a = e.target.closest ? e.target.closest("a") : null;
    if (a && ref.current.contains(a)) {
      if (e.metaKey || e.ctrlKey) { window.open(a.href, "_blank", "noopener,noreferrer"); return; }
      const r = a.getBoundingClientRect();
      const w = wrapRef.current.getBoundingClientRect();
      setChip({ href: a.href, el: a, top: r.bottom - w.top + 4, left: Math.max(0, Math.min(r.left - w.left, w.width - 250)) });
    } else setChip(null);
  };
  const removeLink = () => {
    if (!chip) return;
    const r = document.createRange(); r.selectNodeContents(chip.el);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    document.execCommand("unlink");
    emit(); setChip(null);
  };

  const tools = [
    { key: "p", label: "Paragraf", Icon: Pilcrow, run: () => exec("formatBlock", "<p>") },
    headings && { key: "h", label: "Ara başlık", Icon: Heading, run: () => exec("formatBlock", "<h3>") },
    { key: "bold", label: "Kalın", Icon: Bold, run: () => exec("bold") },
    { key: "italic", label: "İtalik", Icon: Italic, run: () => exec("italic") },
    { key: "ul", label: "Madde listesi", Icon: List, run: () => exec("insertUnorderedList") },
    { key: "ol", label: "Numaralı liste", Icon: ListOrdered, run: () => exec("insertOrderedList") },
    { key: "link", label: "Bağlantı ekle", Icon: LinkIcon, run: () => { saveSelection(); setUrl(""); setMode(mode === "link" ? null : "link"); } },
    allowImages && { key: "image", label: "Görsel ekle", Icon: ImageIcon, run: () => { saveSelection(); setUrl(""); setMode(mode === "image" ? null : "image"); } },
  ].filter(Boolean);

  return (
    <div ref={wrapRef} className="relative border border-slate-200 rounded-xl focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 bg-white">
      {!readOnly && <>
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-slate-100 flex-wrap" role="toolbar" aria-label="Metin biçimlendirme">
        {tools.map(({ key, label, Icon, run }) => (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={!!active[key] || mode === key}
            onMouseDown={(e) => e.preventDefault()}
            onClick={run}
            className={`h-7 w-7 flex items-center justify-center rounded-md ${active[key] || mode === key ? "bg-orange-50 text-orange-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
          >
            <Icon size={14} />
          </button>
        ))}
        <span className="ml-auto pr-1 cw-10 text-slate-400 hidden sm:inline">Ctrl + tık: bağlantıyı aç</span>
      </div>
      {mode && (
        <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 border-b border-slate-100 bg-slate-50">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (mode === "link") applyLink(); else insertImage(normalizeUrl(url)); } if (e.key === "Escape") { e.stopPropagation(); setMode(null); } }}
            placeholder={mode === "link" ? "Bağlantı adresi (örn. drive.google.com/…)" : "Görsel adresi (https://…)"}
            aria-label={mode === "link" ? "Bağlantı adresi" : "Görsel adresi"}
            className="flex-1 min-w-40 h-8 rounded-md border border-slate-200 bg-white px-2.5 cw-12 outline-none focus:border-orange-400"
          />
          <Btn size="sm" variant="primary" disabled={!url.trim()} onClick={() => (mode === "link" ? applyLink() : insertImage(normalizeUrl(url)))}>{mode === "link" ? "Bağlantı Ekle" : "Görsel Ekle"}</Btn>
          {mode === "image" && <Btn size="sm" variant="secondary" disabled={uploading} onClick={() => fileRef.current && fileRef.current.click()}><Upload size={13} />{uploading ? "Yükleniyor…" : "Bilgisayardan"}</Btn>}
          <Btn size="sm" variant="ghost" onClick={() => setMode(null)}>Vazgeç</Btn>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={onFile} />
        </div>
      )}
      </>}
      <div
        ref={ref}
        className="cw-rte px-3.5 py-3"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder={placeholder}
        onInput={emit}
        onKeyUp={() => { saveSelection(); refresh(); }}
        onMouseUp={() => { saveSelection(); refresh(); }}
        onClick={onEditorClick}
        onBlur={() => { saveSelection(); if (dirty.current) { dirty.current = false; if (onCommit) onCommit(); } }}
        onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); emit(); }}
      />
      {chip && (
        <div className="absolute flex items-center gap-1 bg-white border border-slate-200 rounded-lg shadow-lg px-1.5 py-1 cw-12" style={{ top: chip.top, left: chip.left, zIndex: 5, maxWidth: 250 }}>
          <span className="truncate text-slate-500 px-1 max-w-28" title={chip.href}>{chip.href}</span>
          <a href={chip.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-1.5 h-6 rounded-md font-semibold text-orange-700 hover:bg-orange-50"><ExternalLink size={12} />Aç</a>
          <button type="button" onClick={removeLink} className="inline-flex items-center gap-1 px-1.5 h-6 rounded-md text-slate-600 hover:bg-slate-100"><Unlink size={12} />Kaldır</button>
          <button type="button" onClick={() => setChip(null)} className="p-1 rounded text-slate-400 hover:text-slate-700" aria-label="Kapat"><X size={12} /></button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Görev detay çekmecesi ───────────────────────── */

function PropertyRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-9">
      <span className="w-28 shrink-0 flex items-center gap-1.5 cw-12 text-slate-500"><Icon size={13} className="text-slate-400" />{label}</span>
      <div className="flex-1 min-w-0 flex items-center">{children}</div>
    </div>
  );
}

function AttachmentsSection({ task }) {
  const { state, dispatch, attachmentsByTask, openPreview, notify, can: allowed } = useWS();
  const canEdit = allowed("canEditContent");
  const [mode, setMode] = useState(null);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [internal, setInternal] = useState(false);
  const items = attachmentsByTask[task.id] || EMPTY;
  const attachedAssetIds = new Set(items.map((a) => a.assetId).filter(Boolean));
  const brandAssets = state.assets.filter((a) => a.brandId === task.brandId && (!q || norm(a.name).includes(norm(q))));
  const addFromAsset = (asset) => {
    if (dispatch({ type: "ADD_ATTACHMENT", attachment: { id: uid(), taskId: task.id, assetId: asset.id, name: asset.name, type: asset.type, size: asset.size, thumbnail: asset.thumbnail, driveUrl: asset.driveUrl, addedBy: ME, createdAt: new Date().toISOString(), internal } })) notify(`“${asset.name}” göreve eklendi${internal ? " (yalnızca ekip görür)" : ""}.`);
  };
  const addLink = () => {
    if (!name.trim()) { setErr("Dosya adı zorunludur."); return; }
    if (!DRIVE.isValid(link)) { setErr("Geçerli bir Google Drive bağlantısı girin."); return; }
    const lower = name.toLocaleLowerCase("tr-TR");
    const type = /\.(png|jpe?g|webp|gif)$/.test(lower) ? "Görsel" : /\.pdf$/.test(lower) ? "PDF" : /\.(mp4|mov)$/.test(lower) ? "Video" : "Doküman";
    if (!dispatch({ type: "ADD_ATTACHMENT", attachment: { id: uid(), taskId: task.id, assetId: null, name: name.trim(), type, size: "Drive", thumbnail: null, driveUrl: link.trim(), addedBy: ME, createdAt: new Date().toISOString(), internal } })) return;
    setName(""); setLink(""); setErr(""); setMode(null);
    notify("Drive bağlantısı göreve eklendi.");
  };
  return (
    <section>
      <SectionTitle icon={Paperclip} right={canEdit &&
        <div className="flex gap-1">
          <Btn size="sm" variant={mode === "assets" ? "primary" : "secondary"} onClick={() => setMode(mode === "assets" ? null : "assets")}><FolderOpen size={13} />Marka Dosyalarından</Btn>
          <Btn size="sm" variant={mode === "link" ? "primary" : "secondary"} onClick={() => setMode(mode === "link" ? null : "link")}><LinkIcon size={13} />Bağlantı</Btn>
        </div>
      }>Ekler ({items.length})</SectionTitle>

      {mode && (
        <label className="mb-2 flex items-center gap-2 cw-12 text-slate-600 cursor-pointer select-none w-fit">
          <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-3.5 w-3.5 accent-orange-600" />
          <Lock size={12} className="text-slate-400" />Yalnızca ekip görsün (müşteriden gizle)
        </label>
      )}

      {mode === "assets" && (
        <div className="mb-3 border border-slate-200 rounded-xl overflow-hidden">
          <label className="flex items-center gap-2 h-9 px-3 border-b border-slate-100 bg-slate-50">
            <Search size={13} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marka dosyalarında ara…" aria-label="Marka dosyalarında ara" className="flex-1 bg-transparent outline-none cw-12" />
          </label>
          <div className="max-h-56 overflow-y-auto cw-scroll">
            {brandAssets.length ? brandAssets.map((a) => {
              const added = attachedAssetIds.has(a.id);
              return (
                <div key={a.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-100 last:border-0">
                  {a.thumbnail ? <img src={a.thumbnail} alt="" className="h-8 w-8 rounded-md object-cover" /> : <FileTypeTile type={a.type} size={32} />}
                  <div className="flex-1 min-w-0"><p className="cw-12 font-medium text-slate-800 truncate">{a.name}</p><p className="cw-10 text-slate-400">{FOLDER_BY_ID[a.folderId]?.name} · {a.size}</p></div>
                  <Btn size="sm" variant={added ? "ghost" : "secondary"} disabled={added} onClick={() => addFromAsset(a)}>{added ? <><Check size={12} />Eklendi</> : <><Plus size={12} />Ekle</>}</Btn>
                </div>
              );
            }) : <p className="px-3 py-4 cw-12 text-slate-500">Eşleşen marka dosyası yok.</p>}
          </div>
        </div>
      )}
      {mode === "link" && (
        <div className="mb-3 p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
          <input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Dosya adı (örn. Final Kurgu.mp4)" aria-label="Dosya adı" className="w-full h-8 rounded-md border border-slate-200 bg-white px-2.5 cw-12 outline-none focus:border-orange-400" />
          <input value={link} onChange={(e) => { setLink(e.target.value); setErr(""); }} placeholder="https://drive.google.com/file/d/…" aria-label="Drive bağlantısı" className="w-full h-8 rounded-md border border-slate-200 bg-white px-2.5 cw-12 outline-none focus:border-orange-400" />
          {err && <p className="cw-11 text-red-600">{err}</p>}
          <div className="flex justify-end gap-2"><Btn size="sm" variant="ghost" onClick={() => setMode(null)}>Vazgeç</Btn><Btn size="sm" variant="primary" onClick={addLink}>Ekle</Btn></div>
        </div>
      )}

      {items.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((a) => (
            <div key={a.id} className="group flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white">
              <button type="button" onClick={() => openPreview("attachment", a.id)} className="shrink-0" aria-label={`${a.name} önizle`}>
                <AttachmentThumb attachment={a} size={40} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="cw-12 font-medium text-slate-800 truncate" title={a.name}>{a.name}</p>
                <p className="flex items-center gap-1 cw-10 text-slate-400">{a.type} · {a.size}{a.internal && <span className="inline-flex items-center gap-0.5 text-slate-500 font-semibold" title="Müşteri bu eki görmez"><Lock size={9} />Ekip içi</span>}</p>
              </div>
              <div className="flex items-center">
                <a href={a.driveUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50" aria-label="Drive'da Aç" title="Drive'da Aç"><ExternalLink size={13} /></a>
                {canEdit && <button type="button" onClick={() => { if (dispatch({ type: "REMOVE_ATTACHMENT", id: a.id })) notify("Ek kaldırıldı."); }} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label={`${a.name} ekini kaldır`} title="Kaldır"><X size={13} /></button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="cw-12 text-slate-400 py-2">Bu göreve henüz dosya eklenmemiş.</p>
      )}
    </section>
  );
}

function CommentsPanel({ task, composerRef }) {
  const { state, dispatch, notify } = useWS();
  const [text, setText] = useState("");
  const comments = state.comments.filter((c) => c.taskId === task.id);
  const listRef = useRef(null);
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    if (!dispatch({ type: "ADD_COMMENT", taskId: task.id, text: t })) return;
    setText("");
    notify("Yorum eklendi.");
    setTimeout(() => { const last = listRef.current && listRef.current.lastElementChild; if (last) last.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 30);
  };
  return (
    <div>
      <div ref={listRef} className="space-y-4 mb-4">
        {comments.length ? comments.map((c) => {
          const u = USER_BY_ID[c.userId];
          return (
            <div key={c.id} className="group flex gap-2.5">
              <Avatar userId={c.userId} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="cw-12 font-semibold text-slate-900">{u?.name || "Bilinmeyen kullanıcı"}</span>
                  <time className="cw-11 text-slate-400">{fmtDateTime(c.createdAt)}</time>
                  {c.userId === ME && (
                    <button type="button" onClick={() => { if (dispatch({ type: "DELETE_COMMENT", id: c.id })) notify("Yorum silindi."); }} className="ml-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Yorumu sil" title="Yorumu sil"><Trash2 size={12} /></button>
                  )}
                </div>
                <p className="mt-1 cw-13 text-slate-700 whitespace-pre-wrap break-words bg-slate-50 border border-slate-100 rounded-lg rounded-tl-sm px-3 py-2">{c.text}</p>
              </div>
            </div>
          );
        }) : <p className="cw-12 text-slate-400">Henüz yorum yok. İlk yorumu siz ekleyin.</p>}
      </div>
      <div className="flex gap-2.5 items-start">
        <Avatar userId={ME} size={28} />
        <div className="flex-1 border border-slate-200 rounded-xl focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 bg-white">
          <textarea
            ref={composerRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
            rows={3}
            placeholder="Yorum yazın…"
            aria-label="Yorum yaz"
            className="w-full resize-none bg-transparent outline-none px-3 pt-2.5 cw-13 placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="cw-10 text-slate-400 pl-1">Göndermek için Ctrl + Enter</span>
            <Btn size="sm" variant="primary" disabled={!text.trim()} onClick={submit}><Send size={12} />Gönder</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityPanel({ task }) {
  const { state } = useWS();
  const items = state.activity.filter((a) => a.taskId === task.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!items.length) return <p className="cw-12 text-slate-400">Henüz aktivite yok.</p>;
  return (
    <ol className="relative border-l border-slate-200 ml-2.5 space-y-3.5">
      {items.map((a) => (
        <li key={a.id} className="pl-4 relative">
          <span className="absolute -left-2.5 top-0"><Avatar userId={a.userId} size={20} /></span>
          <p className="cw-12 text-slate-700"><strong className="font-semibold text-slate-900">{USER_BY_ID[a.userId]?.name}</strong> {a.text}</p>
          <time className="cw-11 text-slate-400">{fmtDateTime(a.createdAt)}</time>
        </li>
      ))}
    </ol>
  );
}

function TaskDrawer({ task, focus, focusKey, onClose }) {
  const { state, dispatch, brandsById, commentCount, askDelete, updateTask, can: allowed, statusOptions } = useWS();
  useNow();
  const canAssign = allowed("canAssignTasks"), canEdit = allowed("canEditContent");
  const options = statusOptions(task);
  const canSubmit = options.includes("Müşteri Onayı") && !["Müşteri Onayı", "Onaylandı", "Tamamlandı"].includes(task.status);
  const checklistRef = useRef(null);
  const readDate = (v, danger) => <span className={`px-1.5 cw-12 ${danger ? "text-red-600 font-semibold" : "text-slate-700"}`}>{v ? fmtDateLong(v) : "Tarihsiz"}</span>;
  const brand = brandsById[task.brandId];
  const [title, setTitle] = useState(task.title);
  const [sub, setSub] = useState("comments");
  const [kitOpen, setKitOpen] = useState(false);
  const commentsRef = useRef(null);
  const feedbackRef = useRef(null);
  const composerRef = useRef(null);
  const drawerRef = useRef(null);
  useFocusTrap(drawerRef);
  useEffect(() => { setTitle(task.title); }, [task.title]);
  useEffect(() => {
    if (focus !== "feedback") return undefined;
    const t = setTimeout(() => { const el = feedbackRef.current || commentsRef.current; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 120);
    return () => clearTimeout(t);
  }, [focus, task.id]);
  useEffect(() => {
    if (focus !== "comments") return undefined;
    setSub("comments");
    const t = setTimeout(() => {
      if (commentsRef.current) commentsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      if (composerRef.current) composerRef.current.focus({ preventScroll: true });
    }, 120);
    return () => clearTimeout(t);
  }, [focus, task.id]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-cw-modal],[data-cw-popover]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const commitTitle = () => {
    const t = title.trim();
    if (!t) { setTitle(task.title); return; }
    if (t !== task.title) updateTask(task.id, { title: t }, "Görev başlığı güncellendi.");
  };
  const done = task.status === "Tamamlandı";
  const activityCount = state.activity.filter((a) => a.taskId === task.id).length;
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/20" style={{ zIndex: 40 }} onClick={onClose} aria-hidden="true" />
      <aside ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Görev detayı" className="outline-none cw-drawer cw-drawer-w fixed inset-y-0 right-0 bg-white border-l border-slate-200 shadow-2xl flex flex-col" style={{ zIndex: 41, maxWidth: "100vw" }}>
        <div className="shrink-0 h-14 flex items-center gap-2 px-4 border-b border-slate-200">
          <BrandLogo brand={brand} size={24} />
          <span className="cw-12 font-medium text-slate-600 truncate">{brand?.name}</span>
          <ChevronRight size={13} className="text-slate-300 shrink-0" />
          <span className="cw-12 font-mono font-semibold text-slate-400">{task.code || "Kaydediliyor…"}</span>
          <span className="flex-1" />
          <Btn size="sm" variant="secondary" onClick={() => setKitOpen(true)} aria-label="Marka Kılavuzunu Gör" title="Marka Kılavuzunu Gör"><BookOpen size={13} /><span className="hidden md:inline">Marka Kılavuzunu Gör</span></Btn>
          {canSubmit && (
            <Btn size="sm" variant="primary" onClick={() => updateTask(task.id, { status: "Müşteri Onayı" }, "İçerik müşteri onayına gönderildi.")}><Send size={13} /><span className="hidden sm:inline">Onaya Gönder</span></Btn>
          )}
          {options.includes(done ? "Çalışılıyor" : "Tamamlandı") && (
            <Btn size="sm" variant={done || canSubmit ? "secondary" : "primary"} onClick={() => updateTask(task.id, { status: done ? "Çalışılıyor" : "Tamamlandı" }, done ? "Görev yeniden açıldı." : "Görev tamamlandı olarak işaretlendi.")} className={done || canSubmit ? "" : "bg-emerald-600 hover:bg-emerald-700"}>
              {done ? <><RotateCcw size={13} /><span className="hidden sm:inline">Yeniden Aç</span></> : <><CheckCircle2 size={13} /><span className="hidden sm:inline">Tamamlandı</span></>}
            </Btn>
          )}
          {allowed("canDeleteTasks") && <button type="button" onClick={() => askDelete(task.id)} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Görevi sil" title="Görevi sil"><Trash2 size={15} /></button>}
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Detayı kapat" title="Kapat (Esc)"><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto cw-scroll">
          <div className="px-5 sm:px-6 pt-5 pb-8 space-y-6">
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
              rows={2}
              readOnly={!canEdit}
              aria-label="Görev başlığı"
              className="w-full resize-none text-xl font-bold tracking-tight text-slate-900 outline-none rounded-lg px-2 py-1 -mx-2 hover:bg-slate-50 focus:bg-slate-50 leading-snug"
            />

            <div className="space-y-0.5">
              <PropertyRow icon={Activity} label="Durum"><StatusMenu value={task.status} options={options} onChange={(v) => updateTask(task.id, { status: v }, `Durum “${v}” olarak güncellendi.`)} /></PropertyRow>
              <PropertyRow icon={Flag} label="Öncelik">{canAssign ? <PriorityMenu value={task.priority} onChange={(v) => updateTask(task.id, { priority: v }, "Öncelik güncellendi.")} /> : <PriorityLabel priority={task.priority} />}</PropertyRow>
              <PropertyRow icon={Users} label="Sorumlu">{canAssign ? <AssigneeMenu value={task.assigneeId} onChange={(v) => updateTask(task.id, { assigneeId: v }, "Sorumlu güncellendi.")} /> : <span className="inline-flex items-center gap-1.5"><Avatar userId={task.assigneeId} size={22} /><span className="cw-12 font-medium text-slate-700">{USER_BY_ID[task.assigneeId]?.name || "Atanmamış"}</span></span>}</PropertyRow>
              <PropertyRow icon={Layers} label="Marka">{canAssign ? <BrandMenu value={task.brandId} onChange={(v) => updateTask(task.id, { brandId: v }, "Marka güncellendi.")} /> : <span className="inline-flex items-center gap-1.5"><BrandLogo brand={brand} size={22} /><span className="cw-12 font-medium text-slate-700">{brand?.name}</span></span>}</PropertyRow>
              <PropertyRow icon={LayoutGrid} label="Platform">{canEdit ? <PlatformMenu value={task.platform} onChange={(v) => updateTask(task.id, { platform: v }, "Platform güncellendi.")} /> : <PlatformChip platform={task.platform} />}</PropertyRow>
              <PropertyRow icon={Type} label="Görev Türü">{canEdit ? <FormatMenu value={task.format} onChange={(v) => updateTask(task.id, { format: v }, "Görev türü güncellendi.")} /> : <span className="cw-12 text-slate-700">{task.format}</span>}</PropertyRow>
              <PropertyRow icon={Calendar} label="Yayın Tarihi"><div className="w-44">{canEdit ? <DateInput value={task.publishDate} onChange={(v) => updateTask(task.id, { publishDate: v }, "Yayın tarihi güncellendi.")} /> : readDate(task.publishDate)}</div></PropertyRow>
              <PropertyRow icon={Clock} label="Son Teslim">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                  {canAssign ? (
                    <span className="inline-flex items-center gap-0.5">
                      <span className="w-36"><DateInput value={task.dueDate} danger={isOverdue(task)} onChange={(v) => updateTask(task.id, { dueDate: v }, "Son teslim tarihi güncellendi.")} /></span>
                      <TimeInput value={task.dueTime} danger={isOverdue(task)} onChange={(v) => updateTask(task.id, { dueTime: v }, "Teslim saati güncellendi.")} />
                    </span>
                  ) : readDate(task.dueDate, isOverdue(task))}
                  <DeadlineLabel task={task} className="cw-11" />
                </div>
              </PropertyRow>
            </div>

            <ChecklistSection task={task} sectionRef={checklistRef} focusKey={focus === "checklist" ? focusKey : null} />

            <section>
              <SectionTitle icon={FileText}>Açıklama</SectionTitle>
              <RichTextEditor
                readOnly={!canEdit}
                docKey={task.id}
                value={task.description}
                onChange={(html) => dispatch({ type: "UPDATE_TASK", id: task.id, patch: { description: html }, silent: true })}
                onCommit={() => dispatch({ type: "LOG", taskId: task.id, text: "açıklamayı güncelledi" })}
              />
            </section>

            <ContentVersionsSection task={task} />

            <ClientFeedbackSection task={task} sectionRef={feedbackRef} />

            <AttachmentsSection task={task} />

            <section ref={commentsRef} style={{ scrollMarginTop: 12 }}>
              <div className="flex items-center gap-1 border-b border-slate-200 mb-4" role="tablist" aria-label="Yorumlar ve aktivite">
                {[["comments", `Yorumlar (${commentCount[task.id] || 0})`, MessageSquare], ["activity", `Aktivite (${activityCount})`, Activity]].map(([k, l, Icon]) => (
                  <button key={k} type="button" role="tab" aria-selected={sub === k} onClick={() => setSub(k)} className={`relative h-9 px-2.5 inline-flex items-center gap-1.5 cw-12 ${sub === k ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-900 font-medium"}`}>
                    <Icon size={13} />{l}
                    {sub === k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-orange-600 rounded-full" />}
                  </button>
                ))}
              </div>
              {sub === "comments" ? <CommentsPanel task={task} composerRef={composerRef} /> : <ActivityPanel task={task} />}
            </section>

            <p className="cw-11 text-slate-400 pt-2 border-t border-slate-100">Oluşturulma: {fmtDateTime(task.createdAt)} · Son güncelleme: {fmtDateTime(task.updatedAt || task.createdAt)}</p>
          </div>
        </div>
      </aside>
      {kitOpen && <BrandKitDrawer brandId={task.brandId} onClose={() => setKitOpen(false)} />}
    </>
  );
}

/* ───────────────────────── Modallar ───────────────────────── */

function Modal({ title, subtitle, onClose, children, footer, width = 560 }) {
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && !document.querySelector("[data-cw-popover]")) onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div data-cw-modal="" className="cw-root fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center sm:p-4" style={{ zIndex: 60 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="cw-pop outline-none bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col" style={{ maxWidth: width, maxHeight: "92vh" }}>
        <div className="shrink-0 flex items-start gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="cw-12 text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 -mr-1 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Kapat"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto cw-scroll px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 flex flex-wrap justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* group: birden fazla denetim içeren alanlar (<label> içinde olsalardı etikete tıklamak ilk düğmeyi tetiklerdi). */
function Field({ label, error, children, full, group }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`} role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <span className="cw-12 font-semibold text-slate-700">{label}</span>
      {children}
      {error && <span className="cw-11 text-red-600">{error}</span>}
    </Tag>
  );
}
const inputCls = (err) => `h-9 w-full rounded-lg border px-3 cw-13 outline-none bg-white focus:ring-2 ${err ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"}`;

function NewTaskModal({ presetBrandId, defaultDate, onClose, onCreated }) {
  const { state } = useWS();
  const [form, setForm] = useState({
    title: "", brandId: presetBrandId || state.brands[0]?.id || "", platform: "Instagram", format: "Gönderi", assigneeId: "",
    status: "Başlanmadı", priority: "Orta", publishDate: defaultDate, dueDate: defaultDate, dueTime: "", description: "",
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = "Görev başlığı zorunludur.";
    if (!form.brandId) next.brandId = "Bir marka seçin.";
    if (!form.dueDate) next.dueDate = "Son teslim tarihi seçin.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const now = new Date().toISOString();
    onCreated({
      id: uid(), code: null, brandId: form.brandId, title: form.title.trim(), platform: form.platform, format: form.format,
      assigneeId: form.assigneeId, status: form.status, priority: form.priority, publishDate: form.publishDate || form.dueDate, dueDate: form.dueDate, dueTime: normalizeTime(form.dueTime),
      description: form.description.trim() ? form.description.trim().split(/\n{2,}/).map((p) => `<p>${escHtml(p).replace(/\n/g, "<br>")}</p>`).join("") : "",
      createdAt: now, updatedAt: now,
    });
  };
  return (
    <Modal title="Yeni Görev" subtitle="Görev oluşturulduğu anda günlük akışta ve içerik tablosunda görünür." onClose={onClose} width={620}
      footer={<><Btn variant="secondary" onClick={onClose}>İptal</Btn><Btn variant="primary" type="submit" form="cw-new-task"><Plus size={15} />Görevi Oluştur</Btn></>}>
      <form id="cw-new-task" onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Görev Başlığı" error={errors.title} full>
          <input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Görevin kısa ve açıklayıcı adı" className={inputCls(errors.title)} />
        </Field>
        <Field label="Marka" error={errors.brandId}>
          <select value={form.brandId} onChange={(e) => set("brandId", e.target.value)} className={inputCls(errors.brandId)}>
            {state.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Sorumlu">
          <select value={form.assigneeId} onChange={(e) => set("assigneeId", e.target.value)} className={inputCls()}>
            <option value="">Atanmamış</option>
            {USERS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Platform">
          <select value={form.platform} onChange={(e) => set("platform", e.target.value)} className={inputCls()}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
        </Field>
        <Field label="Görev Türü">
          <select value={form.format} onChange={(e) => set("format", e.target.value)} className={inputCls()}>{FORMATS.map((p) => <option key={p}>{p}</option>)}</select>
        </Field>
        <Field label="Durum">
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls()}>{STATUSES.map((p) => <option key={p}>{p}</option>)}</select>
        </Field>
        <Field label="Öncelik">
          <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={inputCls()}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
        </Field>
        <Field label="Yayın Tarihi">
          <input type="date" value={form.publishDate} onChange={(e) => set("publishDate", e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Son Teslim" error={errors.dueDate}>
          <div className="flex gap-2">
            <input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} aria-label="Son teslim tarihi" className={inputCls(errors.dueDate).replace("w-full", "flex-1 min-w-0")} />
            <input type="time" value={form.dueTime} onChange={(e) => set("dueTime", e.target.value)} aria-label="Teslim saati" title="Boş bırakılırsa gün sonu" className={inputCls().replace("w-full", "w-28 shrink-0")} />
          </div>
        </Field>
        <Field label="Açıklama" full>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Brief veya notlar (detay panelinde zengin metinle düzenleyebilirsiniz)" className="w-full rounded-lg border border-slate-200 px-3 py-2 cw-13 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-y" />
        </Field>
      </form>
    </Modal>
  );
}

/* ───────────────────────── Toplu Görev Girişi (spreadsheet) ───────────────────────── */

/* Kayıt iyimser değildir: "Tümünü Kaydet" sunucu sonucunu bekler (workspaceData createTasks). Satırlar kaydedilene kadar
   tabloda ve kullanıcı + çalışma alanı bazındaki taslakta kalır; ağ hatasında hiçbir şey kaybolmaz. */

const SHEET_COLS = BULK_COLUMNS;
const LAST_COL = SHEET_COLS.length - 1;
const INITIAL_ROWS = 5;
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

function sheetReducer(s, a) {
  switch (a.type) {
    case "set": {
      const rows = typeof a.rows === "function" ? a.rows(s.rows) : a.rows;
      if (rows === s.rows) return s;
      return a.history === false ? { ...s, rows } : { rows, past: [...s.past.slice(-99), s.rows], future: [] };
    }
    case "undo": return s.past.length ? { rows: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.rows, ...s.future] } : s;
    case "redo": return s.future.length ? { rows: s.future[0], past: [...s.past, s.rows], future: s.future.slice(1) } : s;
    case "reset": return { rows: typeof a.rows === "function" ? a.rows(s.rows) : a.rows, past: [], future: [] };
    default: return s;
  }
}

const sheetStorage = () => { try { return window.localStorage; } catch { return null; } };

/* Hücre düzenleyicileri: metin / tarih / saat için satır içi input, marka / kişi / seçenek için aranabilir liste. */
function SheetTextEditor({ col, initial, onCommit, onCancel }) {
  const [v, setV] = useState(initial);
  const ref = useRef(null);
  const dateRef = useRef(null);
  // Odak commit aşamasında verilir: F2 / ilk tuştan hemen sonra yazılanlar kaybolmaz.
  useLayoutEffect(() => { const el = ref.current; if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch { /* tarih */ } } }, []);
  const key = (e) => {
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); onCommit(v, e.shiftKey ? "up" : "down"); }
    else if (e.key === "Tab") { e.preventDefault(); e.stopPropagation(); onCommit(v, e.shiftKey ? "left" : "right"); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
    else e.stopPropagation(); // ok tuşları, silme ve metin seçimi input içinde normal çalışır
  };
  const placeholder = { title: "Görev başlığı", dueDate: "gg.aa.yyyy", dueTime: "ss:dd" }[col.key];
  return (
    <div className="absolute inset-0 flex items-center bg-white ring-2 ring-orange-500 rounded-[3px] z-10">
      <input ref={ref} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={key} onBlur={() => onCommit(v, null)} placeholder={placeholder}
        aria-label={col.label} maxLength={col.key === "title" ? 300 : 40} spellCheck={col.key === "title"}
        className="h-full w-full min-w-0 bg-transparent px-2.5 cw-13 text-slate-900 outline-none" data-sheet-editor="" />
      {col.type === "date" && (
        <>
          <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); try { dateRef.current.showPicker(); } catch { dateRef.current.focus(); } }}
            className="shrink-0 h-7 w-7 mr-1 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Takvimden seç"><Calendar size={13} /></button>
          <input ref={dateRef} type="date" tabIndex={-1} aria-hidden="true" className="absolute right-1 bottom-0 h-0 w-0 opacity-0"
            onChange={(e) => { if (e.target.value) { const [y, m, d] = e.target.value.split("-"); onCommit(`${d}.${m}.${y}`, null); } }} />
        </>
      )}
    </div>
  );
}

function SheetCombobox({ anchorEl, label, options, value, initialQuery, onPick, onCommitText, onCancel, width = 260 }) {
  const [q, setQ] = useState(initialQuery || "");
  const ref = useRef(null);
  const listId = useMemo(() => `cb-${uid()}`, []);
  const filtered = useMemo(() => {
    const t = norm(q);
    if (!t) return options;
    const starts = [], has = [];
    options.forEach((o) => { const n = norm(`${o.label} ${o.sub || ""}`); if (norm(o.label).startsWith(t)) starts.push(o); else if (n.includes(t)) has.push(o); });
    return [...starts, ...has];
  }, [q, options]);
  const [hi, setHi] = useState(() => Math.max(0, initialQuery ? 0 : options.findIndex((o) => o.value === value)));
  useEffect(() => { setHi(q ? 0 : Math.max(0, options.findIndex((o) => o.value === value))); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { document.getElementById(`${listId}-${hi}`)?.scrollIntoView({ block: "nearest" }); }, [hi, listId]);
  const choose = (o, move) => onPick(o.value, move);
  const key = (e) => {
    e.stopPropagation();
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const move = e.key === "Enter" ? (e.shiftKey ? "up" : "down") : (e.shiftKey ? "left" : "right");
      if (filtered[hi]) choose(filtered[hi], move); else if (q.trim()) onCommitText(q, move); else onCancel(move);
    } else if (e.key === "Escape") { e.preventDefault(); onCancel(null); }
  };
  return (
    <>
      <div className="absolute inset-0 flex items-center bg-white ring-2 ring-orange-500 rounded-[3px] z-10">
        <Search size={12} className="ml-2 shrink-0 text-slate-400" />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder={`${label} ara…`} aria-label={`${label} ara`}
          role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={filtered[hi] ? `${listId}-${hi}` : undefined} aria-autocomplete="list"
          className="h-full w-full min-w-0 bg-transparent px-2 cw-13 outline-none" data-sheet-editor="" />
      </div>
      <Floating anchorEl={anchorEl} open onClose={() => onCancel(null)} width={width}>
        <div id={listId} role="listbox" aria-label={label} className="p-1 max-h-64 overflow-y-auto cw-scroll" onMouseDown={(e) => e.preventDefault()}>
          {filtered.length ? filtered.slice(0, 80).map((o, i) => (
            <div key={o.value || "none"} id={`${listId}-${i}`} role="option" aria-selected={o.value === value}
              onMouseEnter={() => setHi(i)} onClick={() => choose(o, null)}
              className={`flex items-center gap-2 h-8 px-2 rounded-md cw-12 cursor-pointer ${i === hi ? "bg-orange-50 text-orange-900" : "text-slate-700"}`}>
              {o.icon}<span className="flex-1 min-w-0 truncate">{o.label}</span>{o.sub && <span className="cw-11 text-slate-400 truncate">{o.sub}</span>}
              {o.value === value && <Check size={13} className="text-orange-600 shrink-0" />}
            </div>
          )) : <p className="px-2 py-2 cw-12 text-slate-500">Eşleşen kayıt yok. Enter ile yazılan değer işaretlenir.</p>}
        </div>
      </Floating>
    </>
  );
}

/* Hücrenin görünümü (düzenleme dışında). */
function SheetCellView({ row, col, lists }) {
  const bad = row.bad[col.key];
  if (bad != null) return <span className="truncate text-red-700 font-medium" title={bad}>{bad}</span>;
  switch (col.key) {
    case "brand": {
      const b = lists.brandById[row.brandId];
      return b ? <span className="inline-flex items-center gap-1.5 min-w-0"><BrandLogo brand={b} size={18} /><span className="truncate">{b.name}</span></span> : <span className="text-slate-300">Marka seç</span>;
    }
    case "title": return row.title ? <span className="truncate" title={row.title}>{row.title}</span> : <span className="text-slate-300">Görev başlığı yazın</span>;
    case "platform": return <span className="inline-flex items-center gap-1.5 min-w-0"><span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PLATFORM_DOT[row.platform] || "bg-slate-300"}`} /><span className="truncate">{row.platform || "—"}</span></span>;
    case "format": return row.format ? <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-slate-100 text-slate-600 cw-10 font-semibold uppercase tracking-wide">{row.format}</span> : <span className="text-slate-300">—</span>;
    case "dueDate": return row.dueDate ? <span className="truncate">{fmtDateLong(row.dueDate)}</span> : <span className="text-slate-300">gg.aa.yyyy</span>;
    case "dueTime": return row.dueTime ? <span className="tabular-nums">{row.dueTime}</span> : <span className="text-slate-300">Gün sonu</span>;
    case "assignee": {
      const u = lists.userById[row.assigneeId];
      return u ? <span className="inline-flex items-center gap-1.5 min-w-0"><Avatar userId={u.id} size={18} /><span className="truncate">{u.name}</span></span> : <span className="text-slate-300">Atanmamış</span>;
    }
    default: return null;
  }
}

const SheetRow = React.memo(function SheetRow({ row, index, active, range, errors, showErrors, checked, editor, lists, handlers }) {
  if (import.meta.env?.DEV) window.__cwSheetRowRenders = (window.__cwSheetRowRenders || 0) + 1; // performans testi (yalnızca geliştirme)
  const saved = !!row.saved;
  return (
    <tr data-sheet-row={row.id} data-row-index={index} className={`group/sr h-10 ${saved ? "bg-emerald-50/50" : checked ? "bg-orange-50/40" : "bg-white"}`}>
      <td className="sticky left-0 z-[2] p-0 border-b border-r border-slate-200 bg-inherit" style={{ background: "inherit" }}>
        <div className={`h-10 flex items-center gap-1 pl-1.5 pr-1 ${saved ? "bg-emerald-50" : checked ? "bg-orange-50" : "bg-white group-hover/sr:bg-slate-50"}`}>
          <input type="checkbox" checked={checked} onChange={(e) => handlers.toggleRow(row.id, e.nativeEvent.shiftKey)} aria-label={`${index + 1}. satırı seç`}
            className={`h-3.5 w-3.5 accent-orange-600 cursor-pointer ${checked ? "" : "sm:opacity-0 sm:group-hover/sr:opacity-100 focus:opacity-100"}`} />
          <span className={`flex-1 text-right cw-11 tabular-nums ${Object.keys(errors).length && (showErrors || Object.keys(row.bad).length) ? "text-red-600 font-semibold" : "text-slate-400"}`}>{index + 1}</span>
        </div>
      </td>
      {SHEET_COLS.map((col, c) => {
        const isActive = active === c;
        const inRange = range && c >= range[0] && c <= range[1];
        const err = errors[col.key] && (showErrors || row.bad[col.key] != null) ? errors[col.key] : null;
        return (
          <td key={col.key} data-cell={`${index}:${c}`} data-active={isActive ? "true" : undefined} aria-invalid={err ? "true" : undefined} title={err || undefined}
            onMouseDown={(e) => handlers.cellDown(e, index, c)} onDoubleClick={() => handlers.edit(index, c)}
            className={`relative p-0 border-b border-r border-slate-200 cw-13 ${saved ? "text-slate-500" : "text-slate-800 cursor-cell"} ${inRange && !isActive ? "bg-orange-50/70" : ""}`}
            style={{ scrollMarginTop: 40, scrollMarginLeft: 64 }}>
            <div className={`h-10 flex items-center px-2.5 min-w-0 ${err ? "shadow-[inset_0_0_0_1.5px_#f87171] bg-red-50/60" : ""} ${isActive && !editor ? "shadow-[inset_0_0_0_2px_#ea580c]" : ""}`}>
              <SheetCellView row={row} col={col} lists={lists} />
            </div>
            {isActive && editor}
          </td>
        );
      })}
      <td className="p-0 border-b border-slate-200">
        <div className="h-10 flex items-center justify-center gap-0.5 px-1">
          {saved ? (
            <button type="button" onClick={() => handlers.openTask(row.taskId)} className="h-7 px-1.5 inline-flex items-center gap-1 rounded-md cw-11 font-semibold text-emerald-700 hover:bg-emerald-100" title="Görevi aç"><CheckCircle2 size={12} />{row.saved.code || "Kaydedildi"}</button>
          ) : (
            <>
              <IconAction icon={Copy} label={`${index + 1}. satırı çoğalt`} onClick={() => handlers.duplicate(row.id)} />
              <IconAction icon={Trash2} label={`${index + 1}. satırı sil`} tone="danger" onClick={() => handlers.remove([row.id])} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
});

/* Mobil: satır bazlı kart düzenleme (aynı satır durumu ve doğrulama). */
function SheetCard({ row, index, errors, showErrors, checked, lists, update, handlers, disabled }) {
  const saved = !!row.saved;
  const err = (k) => (errors[k] && (showErrors || row.bad[k] != null) ? errors[k] : null);
  const fieldCls = (k) => `h-11 w-full rounded-lg border px-3 cw-13 bg-white outline-none focus:ring-2 ${err(k) ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"}`;
  const F = ({ k, label, children }) => (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="cw-11 font-semibold text-slate-600">{label}</span>{children}{err(k) && <span className="cw-11 text-red-600">{err(k)}</span>}
    </label>
  );
  return (
    <article data-sheet-card={row.id} className={`rounded-xl border p-3 space-y-2.5 ${saved ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={() => handlers.toggleRow(row.id, false)} aria-label={`${index + 1}. satırı seç`} className="h-5 w-5 accent-orange-600" />
        <span className="cw-12 font-bold text-slate-700">{index + 1}. görev</span>
        <span className="flex-1" />
        {saved ? <span className="cw-11 font-semibold text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={12} />{row.saved.code}</span> : (
          <>
            <button type="button" onClick={() => handlers.duplicate(row.id)} className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`${index + 1}. satırı çoğalt`}><Copy size={16} /></button>
            <button type="button" onClick={() => handlers.remove([row.id])} className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50" aria-label={`${index + 1}. satırı sil`}><Trash2 size={16} /></button>
          </>
        )}
      </div>
      <fieldset disabled={saved || disabled} className="grid gap-2.5 grid-cols-2">
        <div className="col-span-2">{F({ k: "brand", label: "Marka", children: (
          <select value={row.brandId} onChange={(e) => update(row.id, (r) => bulkSetValue(r, "brand", e.target.value))} className={fieldCls("brand")}>
            <option value="">{row.bad.brand != null ? `“${row.bad.brand}” bulunamadı — seçin` : "Marka seçin"}</option>
            {lists.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>) })}</div>
        <div className="col-span-2">{F({ k: "title", label: "Görev Başlığı", children: (
          <textarea value={row.title} rows={2} maxLength={300} onChange={(e) => update(row.id, (r) => ({ ...r, title: e.target.value.replace(/\n/g, " ") }), "title")} placeholder="Görev başlığı" className={`${fieldCls("title")} h-auto py-2 resize-none`} />) })}</div>
        {F({ k: "platform", label: "Platform", children: (
          <select value={row.platform} onChange={(e) => update(row.id, (r) => bulkSetValue(r, "platform", e.target.value))} className={fieldCls("platform")}>{BULK_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>) })}
        {F({ k: "format", label: "Görev Türü", children: (
          <select value={row.format} onChange={(e) => update(row.id, (r) => bulkSetValue(r, "format", e.target.value))} className={fieldCls("format")}>{BULK_FORMATS.map((p) => <option key={p}>{p}</option>)}</select>) })}
        {F({ k: "dueDate", label: "Teslim Tarihi", children: (
          <input type="date" value={row.dueDate} onChange={(e) => update(row.id, (r) => bulkSetValue(r, "dueDate", e.target.value))} className={fieldCls("dueDate")} />) })}
        {F({ k: "dueTime", label: "Teslim Saati", children: (
          <input type="time" value={row.dueTime} onChange={(e) => update(row.id, (r) => bulkSetValue(r, "dueTime", e.target.value))} className={fieldCls("dueTime")} />) })}
        <div className="col-span-2">{F({ k: "assignee", label: "Atanan Kişi", children: (
          <select value={row.assigneeId} onChange={(e) => update(row.id, (r) => bulkSetValue(r, "assignee", e.target.value))} className={fieldCls("assignee")}>
            <option value="">{row.bad.assignee != null ? `“${row.bad.assignee}” bulunamadı — seçin` : "Atanmamış"}</option>
            {lists.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>) })}</div>
      </fieldset>
    </article>
  );
}

/* Seçili satırlara toplu atama (marka / kişi / teslim tarihi). */
function BulkAssignMenu({ label, icon: Icon, options, onApply, date }) {
  const [anchor, setAnchor] = useState(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [d, setD] = useState("");
  const close = useCallback(() => { setOpen(false); setQ(""); }, []);
  const list = useMemo(() => (options || []).filter((o) => norm(o.label).includes(norm(q))), [options, q]);
  return (
    <>
      <Btn size="sm" variant="secondary" ref={setAnchor} onClick={() => setOpen((o) => !o)} aria-expanded={open}><Icon size={13} />{label}</Btn>
      <Floating anchorEl={anchor} open={open} onClose={close} width={240} label={label}>
        {date ? (
          <form className="p-2 space-y-2" onSubmit={(e) => { e.preventDefault(); if (d) { onApply(d); close(); } }}>
            <input type="date" value={d} onChange={(e) => setD(e.target.value)} aria-label="Teslim tarihi" className={inputCls()} autoFocus />
            <Btn size="sm" variant="primary" type="submit" className="w-full" disabled={!d}>Uygula</Btn>
          </form>
        ) : (
          <div className="p-1.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara…" aria-label={`${label} ara`} autoFocus className={`${inputCls()} h-8 mb-1`} />
            <div className="max-h-60 overflow-y-auto cw-scroll" role="listbox" aria-label={label}>
              {list.map((o) => (
                <button key={o.value || "none"} type="button" role="option" aria-selected="false" onClick={() => { onApply(o.value); close(); }}
                  className="w-full flex items-center gap-2 h-8 px-2 rounded-md cw-12 text-slate-700 hover:bg-slate-50 text-left">{o.icon}<span className="truncate">{o.label}</span></button>
              ))}
              {!list.length && <p className="px-2 py-2 cw-12 text-slate-500">Sonuç yok.</p>}
            </div>
          </div>
        )}
      </Floating>
    </>
  );
}

function PasteDialog({ onClose, onPaste }) {
  const [text, setText] = useState("");
  return (
    <Modal title="Excel / E-Tablolar'dan Yapıştır" subtitle="Satırlar tablonun sonuna eklenir. Başlık satırı varsa sütunlar adlarına göre eşleştirilir." onClose={onClose} width={640}
      footer={<><Btn variant="ghost" onClick={onClose}>Vazgeç</Btn><Btn variant="primary" disabled={!text.trim()} onClick={() => onPaste(text)}><ClipboardList size={14} />Tabloya Ekle</Btn></>}>
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={9} spellCheck={false} aria-label="Yapıştırılacak veri"
        placeholder={"Marka\tGörev Başlığı\tPlatform\tGörev Türü\tTeslim Tarihi\tTeslim Saati\tAtanan Kişi\nSofra Pide\tKasım menüsü Reels\tInstagram\tReels\t12.11.2026\t16:30\tBurak"}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono cw-12 outline-none focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-y" />
      <p className="mt-2 cw-11 text-slate-500">Excel, Google E-Tablolar (sekme ayrımlı), Markdown tablosu veya ; / , ayrımlı metin desteklenir.</p>
    </Modal>
  );
}

const bulkSetValue = (row, key, value) => (value === "" && (key === "brand" || key === "assignee" || key === "dueDate" || key === "dueTime") ? bulkClearCell(row, key) : bulkSetValueRaw(row, key, value));

function BulkTaskSheet({ draftScope, createTasks, onClose }) {
  const { state, actor, notify, openTask, brandsById } = useWS();
  const isMobile = useMediaQuery("(max-width: 639px)");
  const storage = useMemo(sheetStorage, []);
  const key = draftKey(draftScope || "yerel", actor.id);
  const lists = useMemo(() => {
    const brands = [...state.brands].sort((a, b) => a.name.localeCompare(b.name, "tr"));
    const users = assignableUsers(state).sort((a, b) => a.name.localeCompare(b.name, "tr"));
    return {
      brands, users, brandById: Object.fromEntries(brands.map((b) => [b.id, b])), userById: Object.fromEntries(users.map((u) => [u.id, u])),
      ctx: { brands, users, today: TODAY },
      options: {
        brand: brands.map((b) => ({ value: b.id, label: b.name, sub: b.sector, icon: <BrandLogo brand={b} size={18} /> })),
        assignee: [{ value: "", label: "Atanmamış" }, ...users.map((u) => ({ value: u.id, label: u.name, sub: userTitle(u), icon: <Avatar userId={u.id} size={18} /> }))],
        platform: BULK_PLATFORMS.map((p) => ({ value: p, label: p })),
        format: BULK_FORMATS.map((p) => ({ value: p, label: p })),
      },
    };
  }, [state]);

  const [draft, setDraft] = useState(() => loadDraft(storage, key));
  const [sheet, send] = useReducer(sheetReducer, null, () => ({ rows: Array.from({ length: INITIAL_ROWS }, () => bulkNewRow()), past: [], future: [] }));
  const rows = sheet.rows;
  const [sel, setSel] = useState({ row: 0, col: 0 });
  const [anchor, setAnchor] = useState(null); // aralık seçimi başlangıcı
  const [editing, setEditing] = useState(null); // { row, col, initial }
  const [checked, setChecked] = useState(() => new Set());
  const [carry, setCarry] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [draftAt, setDraftAt] = useState(null);
  const savingRef = useRef(false);
  const gridRef = useRef(null);
  const lastChecked = useRef(null);
  const rowsRef = useRef(rows); rowsRef.current = rows;
  const selRef = useRef(sel); selRef.current = sel;

  /* Doğrulama: yalnızca değişen satırlar yeniden doğrulanır (satır nesneleri değişmezdir). */
  const errCache = useRef(new WeakMap());
  const ctxRef = useRef(lists.ctx);
  if (ctxRef.current !== lists.ctx) { ctxRef.current = lists.ctx; errCache.current = new WeakMap(); }
  const summary = useMemo(() => {
    const errors = {};
    const messages = [];
    let ready = 0, invalid = 0, saved = 0;
    rows.forEach((row, i) => {
      if (row.saved) { saved++; return; }
      let e = errCache.current.get(row);
      if (!e) { e = bulkValidateRow(row, lists.ctx); errCache.current.set(row, e); }
      if (bulkIsEmpty(row)) return;
      if (Object.keys(e).length) {
        errors[row.id] = e; invalid++;
        SHEET_COLS.forEach((c, j) => { if (e[c.key]) messages.push({ rowId: row.id, row: i, col: j, text: `${i + 1}. satır: ${e[c.key]}` }); });
      } else ready++;
    });
    return { errors, messages, ready, invalid, saved, total: rows.length };
  }, [rows, lists.ctx]);
  const unsaved = rows.filter((r) => !r.saved && !bulkIsEmpty(r)).length;

  /* Taslak: karar verilene kadar (geri yükle / yeni başla) yazılmaz; sonra her değişiklikte kısa gecikmeyle saklanır. */
  const draftPending = useRef(false);
  draftPending.current = !draft;
  useEffect(() => {
    if (draft) return undefined;
    const t = setTimeout(() => { const n = bulkSaveDraft(storage, key, rows); if (n > 0) setDraftAt(new Date().toISOString()); else if (n === 0) setDraftAt(null); }, 400);
    return () => clearTimeout(t);
  }, [rows, draft, storage, key]);
  // Kapanırken bekleyen taslak hemen yazılır (kaydedilen satırlar taslakta kalmaz, son yazılanlar kaybolmaz).
  useEffect(() => () => { if (draftPending.current) bulkSaveDraft(storage, key, rowsRef.current); }, [storage, key]);
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const setRows = useCallback((fn, history = true) => send({ type: "set", rows: fn, history }), []);
  const update = useCallback((id, fn) => setRows((rs) => rs.map((r) => (r.id === id && !r.saved ? fn(r) : r))), [setRows]);
  const focusGrid = () => { if (gridRef.current) gridRef.current.focus({ preventScroll: true }); };

  const addRows = useCallback((n = 1, focus = false) => {
    let added = 0;
    setRows((rs) => {
      const out = [...rs];
      for (let i = 0; i < n && out.length < MAX_BULK_ROWS; i++) { out.push(bulkNewRow(carry ? bulkCarry(out[out.length - 1]) : null)); added++; }
      return out;
    });
    if (rowsRef.current.length + n > MAX_BULK_ROWS) notify(`Bir seferde en fazla ${MAX_BULK_ROWS} satır girilebilir.`, "error");
    if (focus) { setSel({ row: rowsRef.current.length, col: 0 }); setAnchor(null); setTimeout(focusGrid, 0); }
    return added;
  }, [setRows, carry, notify]);

  const move = useCallback((dir, extend = false) => {
    const rs = rowsRef.current;
    const cur = selRef.current;
    let { row, col } = cur;
    if (dir === "down" || dir === "up") {
      row += dir === "down" ? 1 : -1;
      if (row >= rs.length) {
        if (rs.length >= MAX_BULK_ROWS) return;
        setRows((x) => [...x, bulkNewRow(carry ? bulkCarry(x[x.length - 1]) : null)]); // Enter son satırda: yeni satır
      }
      row = Math.max(0, row);
    } else if (dir === "right" || dir === "left") {
      col += dir === "right" ? 1 : -1;
      if (col > LAST_COL) { col = 0; row += 1; if (row >= rs.length) { if (rs.length >= MAX_BULK_ROWS) return; setRows((x) => [...x, bulkNewRow(carry ? bulkCarry(x[x.length - 1]) : null)]); } }
      if (col < 0) { if (row === 0) col = 0; else { col = LAST_COL; row -= 1; } }
    } else if (dir === "arrowRight") col = Math.min(LAST_COL, col + 1);
    else if (dir === "arrowLeft") col = Math.max(0, col - 1);
    if (extend) setAnchor((a) => a || cur); else setAnchor(null);
    setSel({ row, col });
  }, [setRows, carry]);

  const range = useMemo(() => {
    const a = anchor || sel;
    return { r0: Math.min(a.row, sel.row), r1: Math.max(a.row, sel.row), c0: Math.min(a.col, sel.col), c1: Math.max(a.col, sel.col) };
  }, [anchor, sel]);

  // Seçili hücre görünür alanda tutulur.
  useEffect(() => {
    const el = gridRef.current?.querySelector(`[data-cell="${sel.row}:${sel.col}"]`);
    if (el) el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel]);

  const startEdit = useCallback((row, col, initial = null) => {
    const r = rowsRef.current[row];
    if (!r || r.saved) return;
    const c = SHEET_COLS[col];
    setSel({ row, col }); setAnchor(null);
    setEditing({ row, col, initial: initial ?? (c.type === "text" ? r.title : c.type === "date" || c.type === "time" ? bulkCellText(r, c.key, lists.ctx) : null) });
  }, [lists.ctx]);

  const finishEdit = useCallback((moveDir) => {
    setEditing(null);
    if (moveDir) move(moveDir);
    setTimeout(focusGrid, 0);
  }, [move]);

  const commitText = useCallback((row, col, text, moveDir) => {
    const r = rowsRef.current[row];
    const c = SHEET_COLS[col];
    if (r && String(text) !== String(bulkCellText(r, c.key, lists.ctx))) {
      const id = r.id;
      setRows((rs) => rs.map((x) => (x.id === id ? (String(text).trim() === "" ? bulkClearCell(x, c.key) : bulkSetCell(x, c.key, text, lists.ctx)) : x)));
    }
    finishEdit(moveDir);
  }, [lists.ctx, setRows, finishEdit]);

  const pickValue = useCallback((row, col, value, moveDir) => {
    const r = rowsRef.current[row];
    if (r) { const id = r.id; setRows((rs) => rs.map((x) => (x.id === id ? bulkSetValueRaw(x, SHEET_COLS[col].key, value) : x))); }
    finishEdit(moveDir);
  }, [setRows, finishEdit]);

  const clearRange = useCallback(() => {
    const { r0, r1, c0, c1 } = range;
    setRows((rs) => rs.map((x, i) => {
      if (i < r0 || i > r1 || x.saved) return x;
      let y = x;
      for (let c = c0; c <= c1; c++) y = bulkClearCell(y, SHEET_COLS[c].key);
      return y;
    }));
  }, [range, setRows]);

  const pasteMatrix = useCallback((matrix, at) => {
    if (!matrix.length) return;
    const { r0, r1, c0, c1 } = range;
    // Tek hücre değeri seçili aralığa yapıştırılırsa aralığın tamamına uygulanır.
    if (!at && matrix.length === 1 && matrix[0].length === 1 && (r1 > r0 || c1 > c0)) {
      setRows((rs) => rs.map((x, i) => {
        if (i < r0 || i > r1 || x.saved) return x;
        let y = x;
        for (let c = c0; c <= c1; c++) y = bulkSetCell(y, SHEET_COLS[c].key, matrix[0][0], lists.ctx);
        return y;
      }));
      return;
    }
    const start = at || { row: r0, col: SHEET_COLS[c0].key };
    const res = bulkApplyPaste(rowsRef.current, start, matrix, lists.ctx, { carry: false });
    send({ type: "set", rows: res.rows });
    const bad = res.rows.slice(res.from, res.to + 1).filter((r) => Object.keys(r.bad).length).length;
    setSel({ row: Math.max(0, res.to), col: Math.max(0, SHEET_COLS.findIndex((c) => c.key === start.col)) });
    setAnchor({ row: res.from, col: 0 });
    notify(`${res.changed} satır yapıştırıldı${res.added ? ` (${res.added} yeni satır)` : ""}.${bad ? ` ${bad} satırda eşleşmeyen değer var; kırmızı hücreleri kontrol edin.` : ""}${res.truncated ? ` En fazla ${MAX_BULK_ROWS} satır.` : ""}`, bad ? "error" : "success");
  }, [range, setRows, lists.ctx, notify]);

  const copyRange = useCallback(() => {
    const { r0, r1, c0, c1 } = range;
    return rowsRef.current.slice(r0, r1 + 1).map((r) => SHEET_COLS.slice(c0, c1 + 1).map((c) => String(bulkCellText(r, c.key, lists.ctx)).replace(/[\t\n]/g, " ")).join("\t")).join("\n");
  }, [range, lists.ctx]);

  const removeRows = useCallback((ids) => {
    const set = new Set(ids);
    setRows((rs) => { const out = rs.filter((r) => !set.has(r.id)); return out.length ? out : [bulkNewRow()]; });
    setChecked((c) => { const n = new Set(c); ids.forEach((id) => n.delete(id)); return n; });
    const left = Math.max(1, rowsRef.current.filter((r) => !set.has(r.id)).length);
    setSel((s) => ({ row: Math.min(s.row, left - 1), col: s.col }));
    setAnchor(null);
  }, [setRows]);

  const duplicate = useCallback((id) => {
    setRows((rs) => { const i = rs.findIndex((r) => r.id === id); if (i < 0 || rs.length >= MAX_BULK_ROWS) return rs; const out = [...rs]; out.splice(i + 1, 0, bulkDuplicate(rs[i])); return out; });
  }, [setRows]);

  const toggleRow = useCallback((id, shift) => {
    setChecked((c) => {
      const n = new Set(c);
      const rs = rowsRef.current;
      if (shift && lastChecked.current) {
        const a = rs.findIndex((r) => r.id === lastChecked.current), b = rs.findIndex((r) => r.id === id);
        if (a >= 0 && b >= 0) { for (let i = Math.min(a, b); i <= Math.max(a, b); i++) n.add(rs[i].id); return n; }
      }
      if (n.has(id)) n.delete(id); else n.add(id);
      lastChecked.current = id;
      return n;
    });
  }, []);

  const applyToChecked = (key, value) => {
    setRows((rs) => rs.map((r) => (checked.has(r.id) && !r.saved ? bulkSetValue(r, key, value) : r)));
    notify(`${[...checked].length} satır güncellendi.`);
  };

  const onKeyDown = (e) => {
    if (editing || saving || e.target !== gridRef.current) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod && (k === "z" || k === "Z")) { e.preventDefault(); send({ type: e.shiftKey ? "redo" : "undo" }); return; }
    if (mod && (k === "y" || k === "Y") && !isMac) { e.preventDefault(); send({ type: "redo" }); return; }
    if (mod || e.altKey) return; // Ctrl+C / Ctrl+V: copy / paste olayları; diğer kısayollar tarayıcıya bırakılır
    if (k === "ArrowDown") { e.preventDefault(); if (sel.row < rows.length - 1) move("down", e.shiftKey); }
    else if (k === "ArrowUp") { e.preventDefault(); move("up", e.shiftKey); }
    else if (k === "ArrowRight") { e.preventDefault(); move("arrowRight", e.shiftKey); }
    else if (k === "ArrowLeft") { e.preventDefault(); move("arrowLeft", e.shiftKey); }
    else if (k === "Tab") { e.preventDefault(); move(e.shiftKey ? "left" : "right"); }
    else if (k === "Enter") { e.preventDefault(); move(e.shiftKey ? "up" : "down"); }
    else if (k === "F2") { e.preventDefault(); startEdit(sel.row, sel.col); }
    else if (k === "Escape") { if (anchor) { e.preventDefault(); setAnchor(null); } }
    else if (k === "Delete" || k === "Backspace") { e.preventDefault(); clearRange(); }
    else if (k.length === 1) { e.preventDefault(); startEdit(sel.row, sel.col, k === " " && SHEET_COLS[sel.col].type !== "text" ? "" : k); }
  };

  const handlers = useMemo(() => ({
    cellDown: (e, row, col) => {
      if (e.button !== 0) return;
      if (e.target.closest("[data-sheet-editor]")) return;
      e.preventDefault();
      if (savingRef.current) return;
      if (e.shiftKey) setAnchor((a) => a || selRef.current); else setAnchor(null);
      setSel({ row, col });
      setEditing((ed) => (ed && (ed.row !== row || ed.col !== col) ? null : ed));
      focusGrid();
    },
    edit: (row, col) => { if (!savingRef.current) startEdit(row, col); },
    duplicate, remove: removeRows, toggleRow, openTask: (taskId) => openTask(taskId),
  }), [startEdit, duplicate, removeRows, toggleRow, openTask]);

  /* Kaydet: doğrula → görev modeline dönüştür → yetki → tek işlemde kaydet → merkezi duruma işle. */
  const save = async () => {
    if (savingRef.current) return;
    setShowErrors(true);
    setSaveError(null);
    const pending = rows.filter((r) => !r.saved && !bulkIsEmpty(r));
    if (!pending.length) { notify("Kaydedilecek görev yok. Satırlara görev bilgisi girin.", "error"); return; }
    if (summary.invalid) {
      const first = summary.messages[0];
      if (first) { setSel({ row: first.row, col: first.col }); setAnchor(null); setTimeout(focusGrid, 0); }
      notify(`${summary.invalid} satırda hata var. Kırmızı hücreleri düzeltin veya satırları silin.`, "error");
      return;
    }
    savingRef.current = true; setSaving(true);
    const now = new Date().toISOString();
    try {
      const tasks = pending.map((r) => bulkToTask(r, now));
      const res = await createTasks(tasks);
      const savedIds = new Set(pending.map((r) => r.id));
      send({ type: "reset", rows: (rs) => rowsAfterSave(rs, savedIds, res, now) });
      bulkSaveDraft(storage, key, rowsAfterSave(rowsRef.current, savedIds, res, now)); // kaydedilenler taslaktan hemen çıkarılır
      setChecked(new Set());
      setShowErrors(false);
      notify(`${tasks.length} görev kaydedildi. İçerik Planlayıcı ve Günlük Operasyon Akışı güncellendi.`);
    } catch (err) {
      setSaveError(err?.message || "Bilinmeyen hata");
    } finally {
      savingRef.current = false; setSaving(false);
    }
  };

  const restoreDraft = () => { send({ type: "reset", rows: [...draft.rows, bulkNewRow(carry ? bulkCarry(draft.rows[draft.rows.length - 1]) : null)] }); setDraft(null); setSel({ row: 0, col: 0 }); setTimeout(focusGrid, 0); };
  const discardDraft = () => { bulkClearDraft(storage, key); setDraft(null); setTimeout(focusGrid, 0); };
  const clearAll = () => { bulkClearDraft(storage, key); send({ type: "reset", rows: Array.from({ length: INITIAL_ROWS }, () => bulkNewRow()) }); setChecked(new Set()); setShowErrors(false); setSaveError(null); setConfirmClear(false); setDraftAt(null); setSel({ row: 0, col: 0 }); notify("Taslak temizlendi."); };
  const close = () => { if (unsaved) notify(`Kaydedilmemiş ${unsaved} satır taslak olarak saklandı.`, "info"); onClose(); };

  const editor = editing && (() => {
    const c = SHEET_COLS[editing.col];
    const r = rows[editing.row];
    if (!r) return null;
    if (c.type === "text" || c.type === "date" || c.type === "time") {
      return <SheetTextEditor key={`${editing.row}:${editing.col}`} col={c} initial={editing.initial ?? ""} onCommit={(v, m) => commitText(editing.row, editing.col, v, m)} onCancel={() => finishEdit(null)} />;
    }
    const value = r[c.field];
    const anchorEl = gridRef.current?.querySelector(`[data-cell="${editing.row}:${editing.col}"]`);
    return (
      <SheetCombobox key={`${editing.row}:${editing.col}`} anchorEl={anchorEl} label={c.label} options={lists.options[c.key]} value={value} initialQuery={editing.initial}
        onPick={(v, m) => pickValue(editing.row, editing.col, v, m)} onCommitText={(t, m) => commitText(editing.row, editing.col, t, m)} onCancel={(m) => finishEdit(m)} />
    );
  })();

  const checkedCount = [...checked].filter((id) => rows.some((r) => r.id === id)).length;
  const summaryChips = [["Toplam satır", summary.total, "text-slate-700", "total"], ["Kayda hazır", summary.ready, "text-emerald-700", "ready"], ["Hatalı", summary.invalid, summary.invalid ? "text-red-600" : "text-slate-400", "invalid"], ["Kaydedilen", summary.saved, "text-slate-700", "saved"]];

  return (
    <div className="h-full flex flex-col bg-slate-50 min-h-0" data-bulk-sheet="" aria-label="Toplu görev girişi">
      {/* Araç çubuğu */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-3 lg:px-5 py-2.5 space-y-2" data-bulk-toolbar="">
        <div className="flex flex-wrap items-center gap-2">
          <Btn size="sm" variant="primary" onClick={() => addRows(1, true)} disabled={!!draft}><Plus size={14} />Yeni Satır</Btn>
          <SelectMenu value="" title="Boş satır ekle" width={170} ariaLabel="Birden fazla satır ekle" options={[5, 10, 20, 50].map((n) => ({ value: String(n), label: `${n} boş satır ekle` }))}
            onChange={(v) => addRows(Number(v))} triggerClassName="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            renderTrigger={() => <span className="inline-flex items-center gap-1 cw-12 font-semibold text-slate-700"><Layers size={13} />Satır ekle<ChevronDown size={12} /></span>} />
          <Btn size="sm" variant="secondary" onClick={() => setPasteOpen(true)} disabled={!!draft}><ClipboardList size={13} /><span className="hidden sm:inline">Excel'den </span>Yapıştır</Btn>
          <label className="inline-flex items-center gap-1.5 h-8 px-1.5 cw-12 text-slate-600 cursor-pointer select-none" title="Yeni satırda önceki satırın marka, platform, görev türü ve kişisi kullanılır (başlık hariç).">
            <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} className="h-4 w-4 accent-orange-600" />Önceki satırdan taşı
          </label>
          <span className="inline-flex items-center gap-0.5">
            <IconAction icon={RotateCcw} label="Geri al (Ctrl+Z)" onClick={() => send({ type: "undo" })} disabled={!sheet.past.length} />
            <IconAction icon={RefreshCw} label="Yinele (Ctrl+Shift+Z)" onClick={() => send({ type: "redo" })} disabled={!sheet.future.length} />
          </span>
          <span className="flex-1" />
          <span className="cw-11 text-slate-400" role="status">{draftAt ? `Taslak kaydedildi · ${fmtDateTime(draftAt)}` : ""}</span>
          {confirmClear ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 pl-2 pr-1 h-8" role="group" aria-label="Taslağı temizleme onayı">
              <span className="cw-11 font-semibold text-red-700">Kaydedilmemiş satırlar silinsin mi?</span>
              <Btn size="sm" variant="danger" className="h-6 px-2" onClick={clearAll}>Temizle</Btn>
              <Btn size="sm" variant="ghost" className="h-6 px-2" onClick={() => setConfirmClear(false)}>Vazgeç</Btn>
            </span>
          ) : <Btn size="sm" variant="ghost" onClick={() => setConfirmClear(true)} disabled={!!draft}><Trash2 size={13} />Taslağı Temizle</Btn>}
          <Btn size="sm" variant="secondary" onClick={close}><X size={13} />Kapat</Btn>
        </div>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 cw-12" data-bulk-summary="">
          {summaryChips.map(([l, v, c, k]) => <div key={k} className="inline-flex items-center gap-1.5" data-summary={k}><dt className="text-slate-500">{l}</dt><dd className={`font-bold tabular-nums ${c}`}>{v}</dd></div>)}
          <span className="hidden lg:inline cw-11 text-slate-400 ml-auto">Tab / Enter ile gezin · yazmaya başlayınca düzenler · F2 düzenle · Ctrl+V Excel'den yapıştır · Ctrl+Z geri al</span>
        </dl>
        {checkedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1.5" role="toolbar" aria-label="Seçili satırlar">
            <span className="cw-12 font-semibold text-orange-900">{checkedCount} satır seçildi</span>
            <BulkAssignMenu label="Marka ata" icon={Layers} options={lists.options.brand} onApply={(v) => applyToChecked("brand", v)} />
            <BulkAssignMenu label="Kişi ata" icon={Users} options={lists.options.assignee} onApply={(v) => applyToChecked("assignee", v)} />
            <BulkAssignMenu label="Teslim tarihi ata" icon={Calendar} date onApply={(v) => applyToChecked("dueDate", v)} />
            <Btn size="sm" variant="secondary" onClick={() => { const ids = rows.filter((r) => checked.has(r.id)).map((r) => r.id); ids.forEach(duplicate); }}><Copy size={13} />Çoğalt</Btn>
            <Btn size="sm" variant="danger" onClick={() => removeRows([...checked])}><Trash2 size={13} />Sil</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Seçimi kaldır</Btn>
          </div>
        )}
        {showErrors && summary.messages.length > 0 && (
          <details className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5" open data-bulk-errors="">
            <summary className="cw-12 font-semibold text-red-800 cursor-pointer">{summary.invalid} satırda {summary.messages.length} hata — düzeltmek için tıklayın</summary>
            <ul className="mt-1 max-h-28 overflow-y-auto cw-scroll space-y-0.5">
              {summary.messages.slice(0, 100).map((m) => (
                <li key={`${m.rowId}:${m.col}`}><button type="button" onClick={() => { setSel({ row: m.row, col: m.col }); setAnchor(null); setTimeout(focusGrid, 0); }} className="cw-12 text-red-700 hover:underline text-left">{m.text}</button></li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Tablo / kartlar */}
      <div className="relative flex-1 min-h-0">
        {draft && (
          <div className="absolute inset-0 z-20 flex items-start justify-center bg-slate-50/80 backdrop-blur-[1px] p-6">
            <div role="alertdialog" aria-label="Kaydedilmemiş taslak" className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-5 cw-pop">
              <p className="flex items-center gap-2 cw-13 font-bold text-slate-900"><History size={16} className="text-orange-600" />Kaydedilmemiş taslak bulundu</p>
              <p className="cw-12 text-slate-600 mt-1">{draft.rows.length} satır{draft.savedAt ? ` · ${fmtDateTime(draft.savedAt)}` : ""}. Kaldığınız yerden devam edebilir veya yeni bir tabloyla başlayabilirsiniz.</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Btn variant="secondary" onClick={discardDraft}>Yeni Başla (taslak silinir)</Btn>
                <Btn variant="primary" onClick={restoreDraft}><RotateCcw size={14} />Taslağı Geri Yükle</Btn>
              </div>
            </div>
          </div>
        )}
        {isMobile ? (
          <div className="h-full overflow-y-auto cw-scroll p-3 space-y-3" data-bulk-cards="">
            {rows.map((r, i) => (
              <SheetCard key={r.id} row={r} index={i} disabled={saving} errors={summary.errors[r.id] || EMPTY_OBJ} showErrors={showErrors} checked={checked.has(r.id)} lists={lists} handlers={handlers}
                update={(id, fn) => update(id, fn)} />
            ))}
            <Btn variant="secondary" className="w-full h-11" onClick={() => addRows(1)}><Plus size={15} />Yeni Satır</Btn>
          </div>
        ) : (
          <div ref={gridRef} tabIndex={0} role="region" aria-label="Toplu görev tablosu" aria-busy={saving} onKeyDown={onKeyDown}
            onCopy={(e) => { if (editing) return; e.preventDefault(); e.clipboardData.setData("text/plain", copyRange()); }}
            onCut={(e) => { if (editing) return; e.preventDefault(); e.clipboardData.setData("text/plain", copyRange()); clearRange(); }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text/plain");
              if (editing && !/[\t\n]/.test(text.replace(/\n$/, ""))) return; // tek değer: düzenleyiciye normal yapıştırma
              e.preventDefault(); setEditing(null); pasteMatrix(bulkParseTSV(text)); setTimeout(focusGrid, 0);
            }}
            className="h-full overflow-auto cw-scroll outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-200" data-bulk-grid="">
            <table className="border-separate border-spacing-0 bg-white" style={{ tableLayout: "fixed", width: 64 + SHEET_COLS.reduce((s, c) => s + c.width, 0) + 84 }}>
              <colgroup><col style={{ width: 64 }} />{SHEET_COLS.map((c) => <col key={c.key} style={{ width: c.width }} />)}<col style={{ width: 84 }} /></colgroup>
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-[4] h-9 bg-slate-50 border-b border-r border-slate-200 cw-10 font-semibold uppercase tracking-wide text-slate-500 text-right pr-2">
                    <span className="flex items-center gap-1 pl-1.5">
                      <input type="checkbox" aria-label="Tüm satırları seç" checked={checkedCount > 0 && checkedCount === rows.length}
                        onChange={(e) => setChecked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} className="h-3.5 w-3.5 accent-orange-600" />
                      <span className="flex-1">Sıra</span>
                    </span>
                  </th>
                  {SHEET_COLS.map((c) => <th key={c.key} scope="col" className="sticky top-0 z-[3] h-9 bg-slate-50 border-b border-r border-slate-200 px-2.5 text-left cw-10 font-semibold uppercase tracking-wide text-slate-500">{c.label}</th>)}
                  <th className="sticky top-0 z-[3] h-9 bg-slate-50 border-b border-slate-200 cw-10 font-semibold uppercase tracking-wide text-slate-500">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const inRows = i >= range.r0 && i <= range.r1 && (range.r1 > range.r0 || range.c1 > range.c0);
                  return (
                    <SheetRow key={r.id} row={r} index={i} active={sel.row === i ? sel.col : -1} range={inRows ? RANGE_CACHE(range.c0, range.c1) : null}
                      errors={summary.errors[r.id] || EMPTY_OBJ} showErrors={showErrors} checked={checked.has(r.id)} editor={editing && editing.row === i ? editor : null}
                      lists={lists} handlers={handlers} />
                  );
                })}
              </tbody>
            </table>
            <div className="sticky left-0 p-2 w-fit"><Btn size="sm" variant="ghost" onClick={() => addRows(1, true)}><Plus size={14} />Yeni Satır</Btn></div>
          </div>
        )}
      </div>

      {/* Kayıt çubuğu */}
      <div className="shrink-0 bg-white border-t border-slate-200 px-3 lg:px-5 py-2.5 flex flex-wrap items-center gap-2">
        {saveError ? (
          <p role="alert" className="flex-1 min-w-[14rem] flex items-start gap-2 cw-12 text-red-800">
            <AlertTriangle size={14} className="shrink-0 mt-px text-red-600" />
            <span><strong>Kayıt tamamlanamadı:</strong> {saveError} Hiçbir satır kaybolmadı; tekrar denediğinizde daha önce kaydedilmiş görevler yeniden oluşturulmaz.</span>
          </p>
        ) : (
          <p className="flex-1 min-w-[12rem] cw-12 text-slate-500">
            {summary.invalid ? <span className="text-red-600 font-medium">{summary.invalid} satır hatalı.</span> : summary.ready ? `${summary.ready} görev kayda hazır.` : "Görevleri girin; boş satırlar kaydedilmez."}
            {summary.saved > 0 && <span className="ml-1.5 text-emerald-700">{summary.saved} görev kaydedildi.</span>}
          </p>
        )}
        {summary.saved > 0 && <Btn size="sm" variant="ghost" onClick={() => send({ type: "set", rows: (rs) => { const out = rs.filter((r) => !r.saved); return out.length ? out : [bulkNewRow()]; } })}>Kaydedilenleri Listeden Kaldır</Btn>}
        <Btn variant="primary" onClick={save} disabled={saving || !!draft} aria-busy={saving} data-bulk-save="">
          {saving ? <><RefreshCw size={14} className="animate-spin" />Kaydediliyor…</> : <><Check size={15} />{saveError ? "Tekrar Dene" : "Tümünü Kaydet"}{summary.ready ? ` (${summary.ready})` : ""}</>}
        </Btn>
      </div>
      {pasteOpen && <PasteDialog onClose={() => setPasteOpen(false)} onPaste={(text) => {
        setPasteOpen(false);
        const firstEmpty = rows.findIndex((r) => !r.saved && bulkIsEmpty(r));
        pasteMatrix(bulkParseTable(text), { row: firstEmpty >= 0 ? firstEmpty : rows.length, col: "brand" });
      }} />}
    </div>
  );
}

const EMPTY_OBJ = Object.freeze({});
/* Aynı aralık için aynı dizi (satır bileşeni gereksiz yeniden çizilmesin). */
const rangeCache = new Map();
const RANGE_CACHE = (a, b) => { const k = `${a}:${b}`; if (!rangeCache.has(k)) rangeCache.set(k, [a, b]); return rangeCache.get(k); };
/* Kayıttan sonra: kaydedilen satırlar kod ile işaretlenir; geri alma geçmişi sıfırlanır (kaydedilmiş görev geri alınamaz). */
function rowsAfterSave(rows, savedIds, res, at) {
  return rows.map((r) => (savedIds.has(r.id) && !r.saved ? { ...r, saved: { code: res.codes[r.taskId] || null, at } } : r));
}

function ConfirmDeleteModal({ task, onClose, onConfirm }) {
  const { commentCount, attachmentsByTask } = useWS();
  return (
    <Modal title="Görevi silmek istediğinize emin misiniz?" onClose={onClose} width={440}
      footer={<><Btn variant="secondary" onClick={onClose}>Vazgeç</Btn><Btn variant="danger" onClick={onConfirm}><Trash2 size={15} />Görevi Sil</Btn></>}>
      <p className="cw-13 text-slate-700"><strong className="font-semibold">“{task.title}”</strong> görevi günlük akıştan, içerik tablosundan ve marka sayaçlarından kaldırılacak.</p>
      <p className="cw-12 text-slate-500 mt-2">Görevle ilişkili {commentCount[task.id] || 0} yorum ve {(attachmentsByTask[task.id] || EMPTY).length} ek de silinir. Bu işlem geri alınamaz.</p>
    </Modal>
  );
}

/* Drive dosya bağlantısı → gömülebilir önizleme adresi (yalnızca /file/d/<id>/ biçimi). */
const drivePreviewUrl = (url) => { const m = String(url || "").match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/); return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null; };

function FilePreviewModal({ kind, id, onClose }) {
  const { state, dispatch, brandsById, copyLink, notify, can: allowed } = useWS();
  const [embed, setEmbed] = useState(false);
  const item = kind === "asset" ? state.assets.find((a) => a.id === id) : state.attachments.find((a) => a.id === id);
  if (!item) return null;
  const embedUrl = drivePreviewUrl(item.driveUrl);
  const task = kind === "attachment" ? state.tasks.find((t) => t.id === item.taskId) : null;
  const rows = kind === "asset"
    ? [["Marka", brandsById[item.brandId]?.name], ["Klasör", FOLDER_BY_ID[item.folderId]?.name], ["Tür", item.type], ["Boyut", item.size], ["Sahibi", USER_BY_ID[item.owner]?.name], ["Güncellenme", fmtDateLong(item.updatedAt)]]
    : [["Görev", task?.title || "—"], ["Tür", item.type], ["Boyut", item.size], ["Ekleyen", USER_BY_ID[item.addedBy]?.name], ["Eklenme", fmtDateTime(item.createdAt)], ["Görünürlük", item.internal ? "Yalnızca ekip" : "Ekip ve müşteri"]];
  return (
    <Modal title={item.name} subtitle={kind === "asset" ? "Marka dosyası · Google Drive" : "Görev eki · Google Drive"} onClose={onClose} width={720}
      footer={
        <>
          <Btn variant="secondary" onClick={() => copyLink(item.driveUrl)}><Copy size={14} />Bağlantıyı Kopyala</Btn>
          <a href={item.driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-orange-600 text-white cw-13 font-semibold hover:bg-orange-700"><ExternalLink size={14} />Drive'da Aç</a>
        </>
      }>
      <div className="grid gap-5 md:grid-cols-5">
        <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center" style={{ minHeight: 220 }}>
          {embed && embedUrl ? (
            <iframe src={embedUrl} title={`${item.name} önizlemesi`} className="w-full border-0 bg-white" style={{ height: 380 }} allow="autoplay" />
          ) : item.thumbnail ? <PreviewImage item={item} /> : (
            <div className="flex flex-col items-center gap-3 py-10 px-4 text-center">
              <FileTypeTile type={item.type} size={64} />
              <p className="cw-12 text-slate-500">{embedUrl ? "Dosyayı burada Drive önizlemesiyle görüntüleyebilirsiniz." : "Bu dosya türü için önizleme Drive üzerinde açılır."}</p>
              {embedUrl && <Btn size="sm" variant="secondary" onClick={() => setEmbed(true)}><Eye size={13} />Drive önizlemesini göster</Btn>}
            </div>
          )}
        </div>
        <div className="md:col-span-2 space-y-3">
          <dl className="space-y-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 cw-12">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-slate-900 font-medium text-right break-words min-w-0">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          {kind === "asset" && !allowed("canManageAssets") && <div className="pt-3 border-t border-slate-100 flex items-center justify-between cw-12"><span className="text-slate-500">Onay Durumu</span><ApprovalBadge status={item.approvalStatus} /></div>}
          {kind === "asset" && allowed("canManageAssets") && (
            <div className="pt-3 border-t border-slate-100">
              <p className="cw-12 text-slate-500 mb-1.5">Onay Durumu</p>
              <div className="flex flex-wrap gap-1.5">
                {APPROVALS.map((a) => (
                  <button key={a} type="button" onClick={() => { if (a !== item.approvalStatus && dispatch({ type: "UPDATE_ASSET", id: item.id, patch: { approvalStatus: a } })) notify(`Onay durumu “${a}” olarak güncellendi.`); }} className={`h-7 px-2.5 rounded-md border cw-11 font-semibold ${item.approvalStatus === a ? APPROVAL_META[a] : "border-slate-200 text-slate-500 hover:bg-slate-50"}`} aria-pressed={item.approvalStatus === a}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="pt-3 border-t border-slate-100">
            <p className="cw-12 text-slate-500 mb-1.5">Drive Bağlantısı</p>
            <div className="flex items-center gap-1.5">
              <input readOnly value={item.driveUrl} onFocus={(e) => e.target.select()} aria-label="Drive bağlantısı" className="flex-1 min-w-0 h-8 rounded-md border border-slate-200 bg-slate-50 px-2 cw-11 text-slate-600 outline-none" />
              <button type="button" onClick={() => copyLink(item.driveUrl)} className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Bağlantıyı Kopyala"><Copy size={13} /></button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PreviewImage({ item }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="flex flex-col items-center gap-3 py-10"><FileTypeTile type={item.type} size={64} /><p className="cw-12 text-slate-500">Küçük resim yüklenemedi. Dosyayı Drive'da açabilirsiniz.</p></div>;
  return <img src={item.thumbnail} alt={item.name} onError={() => setFailed(true)} className="w-full h-full object-contain" />;
}

function AddAssetModal({ brandId, folderId, onClose, onSave }) {
  const { state } = useWS();
  const [form, setForm] = useState({ brandId: brandId || state.brands[0]?.id, folderId: folderId || "gorseller", name: "", url: "", type: "Görsel", size: "" });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Dosya adı zorunludur.";
    if (!DRIVE.isValid(form.url)) next.url = "Bağlantı drive.google.com veya docs.google.com ile başlamalıdır.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const brand = state.brands.find((b) => b.id === form.brandId);
    onSave({
      id: uid(), brandId: form.brandId, folderId: form.folderId, name: form.name.trim(), type: form.type,
      thumbnail: form.type === "Görsel" ? makeThumb(BRAND_COLORS[brand.color].hex, form.name.trim().slice(0, 16)) : null,
      driveFileId: null, driveUrl: form.url.trim(), size: form.size.trim() || "Drive", owner: ME, approvalStatus: "Onay Bekliyor", updatedAt: TODAY,
    });
  };
  return (
    <Modal title="Drive Bağlantısı Ekle" subtitle="Dosya Google Drive'da kalır; çalışma alanına yalnızca meta veri ve bağlantı eklenir." onClose={onClose} width={560}
      footer={<><Btn variant="secondary" onClick={onClose}>İptal</Btn><Btn variant="primary" type="submit" form="cw-add-asset"><LinkIcon size={14} />Bağlantıyı Ekle</Btn></>}>
      <form id="cw-add-asset" onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Dosya Adı" error={errors.name} full><input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Örn. Kasım Kampanya Görseli.jpg" className={inputCls(errors.name)} /></Field>
        <Field label="Drive Bağlantısı" error={errors.url} full><input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://drive.google.com/file/d/…" className={inputCls(errors.url)} /></Field>
        <Field label="Marka"><select value={form.brandId} onChange={(e) => set("brandId", e.target.value)} className={inputCls()}>{state.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Klasör"><select value={form.folderId} onChange={(e) => set("folderId", e.target.value)} className={inputCls()}>{FOLDERS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
        <Field label="Dosya Türü"><select value={form.type} onChange={(e) => set("type", e.target.value)} className={inputCls()}>{FILE_TYPE_KEYS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Boyut (isteğe bağlı)"><input value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="Örn. 2,4 MB" className={inputCls()} /></Field>
      </form>
    </Modal>
  );
}

function NewBrandModal({ onClose, onSave }) {
  const { state } = useWS();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [driveError, setDriveError] = useState("");
  const [color, setColor] = useState(BRAND_COLOR_KEYS[state.brands.length % BRAND_COLOR_KEYS.length]);
  const [error, setError] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Marka adı zorunludur."); return; }
    if (state.brands.some((b) => norm(b.name) === norm(name))) { setError("Bu isimde bir marka zaten var."); return; }
    const folderId = driveUrl.trim() ? parseDriveFolderId(driveUrl) : null;
    if (driveUrl.trim() && (!DRIVE.isValid(driveUrl) || !folderId)) { setDriveError("Geçerli bir Google Drive klasör bağlantısı girin (…/drive/folders/…)."); return; }
    onSave(makeBrand(name, sector.trim(), color, folderId));
  };
  return (
    <Modal title="Yeni Marka" subtitle="Markanın Google Drive klasör bağlantısını isteğe bağlı olarak ekleyebilirsiniz." onClose={onClose} width={460}
      footer={<><Btn variant="secondary" onClick={onClose}>İptal</Btn><Btn variant="primary" type="submit" form="cw-new-brand"><Plus size={14} />Markayı Oluştur</Btn></>}>
      <form id="cw-new-brand" onSubmit={submit} noValidate className="space-y-3.5">
        <Field label="Marka Adı" error={error}><input autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Örn. Lumina Kozmetik" className={inputCls(error)} /></Field>
        <Field label="Sektör"><input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Örn. Kozmetik" className={inputCls()} /></Field>
        <Field label="Drive Klasörü (isteğe bağlı)" error={driveError}><input value={driveUrl} onChange={(e) => { setDriveUrl(e.target.value); setDriveError(""); }} placeholder="https://drive.google.com/drive/folders/…" className={inputCls(driveError)} /></Field>
        <div>
          <p className="cw-12 font-semibold text-slate-700 mb-1.5">Renk</p>
          <div className="flex flex-wrap gap-2">
            {BRAND_COLOR_KEYS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-pressed={color === c} title={BRAND_COLOR_NAMES[c]} aria-label={BRAND_COLOR_NAMES[c]} className={`h-8 w-8 rounded-lg ${BRAND_COLORS[c].bar} ${color === c ? "ring-2 ring-offset-2 ring-slate-900" : ""}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <BrandLogo brand={{ initials: name.trim() ? makeBrand(name, "", color).initials : "YM", color }} size={36} />
          <div><p className="cw-13 font-semibold text-slate-900">{name.trim() || "Yeni Marka"}</p><p className="cw-11 text-slate-400">{sector.trim() || "Yeni Müşteri"} · {FOLDERS.length} klasör</p></div>
        </div>
      </form>
    </Modal>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const tones = {
    success: ["bg-emerald-500", Check],
    error: ["bg-red-500", AlertTriangle],
    info: ["bg-sky-500", Inbox],
  };
  const [bg, Icon] = tones[toast.tone] || tones.success;
  return (
    <div role="status" className="cw-pop fixed left-1/2 -translate-x-1/2 bottom-5 flex items-center gap-2.5 bg-slate-900 text-white pl-2.5 pr-2 py-2 rounded-xl shadow-2xl cw-13 max-w-[92vw]" style={{ zIndex: 90 }}>
      <span className={`h-6 w-6 rounded-full ${bg} flex items-center justify-center shrink-0`}><Icon size={13} strokeWidth={2.6} /></span>
      <span className="min-w-0">{toast.text}</span>
      <button type="button" onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10" aria-label="Bildirimi kapat"><X size={14} /></button>
    </div>
  );
}

/* ───────────────────────── Rol bazlı ekranlar: ortak parçalar ───────────────────────── */

const WORKLOAD_CAPACITY = 8;
const htmlToText = (html) => {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return (new DOMParser().parseFromString(`<body>${sanitizeHtml(html)}</body>`, "text/html").body.textContent || "").replace(/\s+/g, " ").trim();
};
const matchesSearch = (q, ...parts) => !q || norm(parts.filter(Boolean).join(" ")).includes(q);
const latestRevision = (approvals, taskId) => approvals.reduce((best, a) => (a.taskId === taskId && a.decision === "revision" && (!best || a.createdAt > best.createdAt) ? a : best), null);

function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="cw-13 text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function Segmented({ value, onChange, items, ariaLabel }) {
  return (
    <div className="inline-flex p-1 gap-0.5 rounded-lg bg-slate-200/60 overflow-x-auto max-w-full" role="tablist" aria-label={ariaLabel}>
      {items.map(([key, label, count]) => {
        const active = value === key;
        return (
          <button key={key} type="button" role="tab" aria-selected={active} onClick={() => onChange(key)}
            className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-md cw-12 whitespace-nowrap transition ${active ? "bg-white text-slate-900 font-semibold shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900 font-medium border border-transparent"}`}>
            {label}
            {count != null && <span className={`h-4 min-w-4 px-1 rounded cw-10 font-semibold flex items-center justify-center ${active ? "bg-orange-100 text-orange-700" : "bg-white/70 text-slate-500"}`}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function IconAction({ icon: Icon, label, onClick, tone = "default", disabled }) {
  const tones = { default: "text-slate-400 hover:text-slate-900 hover:bg-slate-100", orange: "text-slate-400 hover:text-orange-700 hover:bg-orange-50", danger: "text-slate-400 hover:text-red-600 hover:bg-red-50" };
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-md disabled:opacity-40 disabled:cursor-not-allowed ${tones[tone]}`}>
      <Icon size={15} />
    </button>
  );
}

function StatusDot({ active, labels = ["Aktif", "Pasif"] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-5 px-1.5 rounded-md border cw-10 font-semibold ${active ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-100 border-slate-200"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />{active ? labels[0] : labels[1]}
    </span>
  );
}

function RoleBadge({ role }) {
  const cls = { admin: "text-slate-800 bg-slate-100 border-slate-300", employee: "text-sky-700 bg-sky-50 border-sky-200", client: "text-violet-700 bg-violet-50 border-violet-200" }[role] || "";
  return <span className={`inline-flex items-center h-5 px-1.5 rounded-md border cw-10 font-semibold ${cls}`}>{ROLE_LABELS[role] || role}</span>;
}

function BrandStack({ brandIds, max = 4 }) {
  const { brandsById } = useWS();
  const list = brandIds.map((id) => brandsById[id]).filter(Boolean);
  if (!list.length) return <span className="cw-12 text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1 min-w-0" title={list.map((b) => b.name).join(", ")}>
      {list.slice(0, max).map((b) => <BrandLogo key={b.id} brand={b} size={22} />)}
      {list.length > max && <span className="cw-11 font-semibold text-slate-500">+{list.length - max}</span>}
    </span>
  );
}

function AvatarStack({ userIds, max = 4 }) {
  if (!userIds.length) return <span className="cw-12 text-slate-400">Atanmamış</span>;
  return (
    <span className="inline-flex items-center -space-x-1" title={userIds.map((id) => USER_BY_ID[id]?.name).filter(Boolean).join(", ")}>
      {userIds.slice(0, max).map((id) => <span key={id} className="ring-2 ring-white rounded-full"><Avatar userId={id} size={26} /></span>)}
      {userIds.length > max && <span className="pl-2.5 cw-11 font-semibold text-slate-500">+{userIds.length - max}</span>}
    </span>
  );
}

function WorkloadBar({ count }) {
  const pct = Math.min(100, Math.round((count / WORKLOAD_CAPACITY) * 100));
  const tone = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
  const label = pct >= 90 ? "Yoğun" : pct >= 60 ? "Dengeli" : "Uygun";
  return (
    <span className="flex items-center gap-2 min-w-0" title={`${count} aktif görev · kapasite ${WORKLOAD_CAPACITY}`}>
      <span className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden"><span className={`block h-full ${tone}`} style={{ width: `${pct}%` }} /></span>
      <span className="cw-11 text-slate-500">{label}</span>
    </span>
  );
}

/* Görev açıklaması (salt okunur): temizlenmiş HTML, Storage görselleri imzalı adresle gösterilir. */
function HtmlView({ html, empty = "Açıklama eklenmemiş." }) {
  const { media } = useWS();
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeHtml(html || "");
    const imgs = [...el.querySelectorAll("img[data-path]")].filter((img) => !img.getAttribute("src"));
    if (media && imgs.length) {
      media.resolve(imgs.map((i) => i.getAttribute("data-path"))).then((urls) => imgs.forEach((i) => { const u = urls[i.getAttribute("data-path")]; if (u) i.setAttribute("src", u); })).catch(() => {});
    }
  }, [html, media]);
  if (!htmlToText(html) && !(html || "").includes("<img")) return <p className="cw-13 text-slate-400">{empty}</p>;
  return <div ref={ref} className="cw-rte" style={{ minHeight: 0 }} />;
}

function ClientStatusBadge({ status }) {
  const label = CLIENT_STATUS_LABELS[status] || status;
  const cls = {
    "Müşteri Onayı": "text-amber-700 bg-amber-50 border-amber-200",
    "Revizyon": "text-orange-700 bg-orange-50 border-orange-200",
    "Onaylandı": "text-teal-700 bg-teal-50 border-teal-200",
    "Tamamlandı": "text-emerald-700 bg-emerald-50 border-emerald-200",
  }[status] || "text-slate-600 bg-slate-100 border-slate-200";
  return <span className={`inline-flex items-center h-6 px-2 rounded-md border cw-11 font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
}

/* Kart / detay görseli: görünür en son sürümün ilk görseli → ek küçük resmi → marka renkli yer tutucu. */
function useContentThumb(task) {
  const { attachmentsByTask, brandsById, state } = useWS();
  const cover = useMemo(() => {
    const v = latestVersion(state.contentVersions || EMPTY, task.id);
    return v ? assetsOf(state.contentAssets || EMPTY, v.id).find((a) => a.mimeType.startsWith("image/")) || null : null;
  }, [state.contentVersions, state.contentAssets, task.id]);
  const urls = useContentUrls(cover ? [cover] : EMPTY);
  const fallback = useMemo(() => {
    const withThumb = (attachmentsByTask[task.id] || EMPTY).find((a) => a.thumbnail);
    if (withThumb) return withThumb.thumbnail;
    const brand = brandsById[task.brandId];
    return makeThumb((BRAND_COLORS[brand?.color] || BRAND_COLORS.orange).hex, task.format, task.title.length);
  }, [task.id, task.brandId, task.format, task.title, attachmentsByTask, brandsById]);
  return (cover && urls[cover.id]) || fallback;
}

/* ───────────────────────── Rol değiştirici (geliştirme) ───────────────────────── */

function RoleSwitcher({ actor, realUserId, onChange, previewOnly, directory }) {
  const all = directory.users;
  const role = roleOf(actor);
  const candidates = all.filter((u) => u.role === role && u.active !== false);
  const pickForRole = (r) => {
    if (r === roleOf(all.find((u) => u.id === realUserId))) return realUserId;
    const list = all.filter((u) => u.role === r && u.active !== false);
    // Çalışan için görevi olan ilk kişi, müşteri için markası olan ilk kişi seçilir.
    const withWork = list.find((u) => (r === "client" ? directory.memberships.some((m) => m.userId === u.id) : directory.tasks.some((t) => t.assigneeId === u.id)));
    return (withWork || list[0])?.id;
  };
  return (
    <div className="mb-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="cw-10 font-semibold tracking-widest text-slate-400">ROL DEĞİŞTİRİCİ</span>
        <span className="h-4 px-1.5 rounded cw-10 font-semibold bg-amber-100 text-amber-800 inline-flex items-center" title={previewOnly ? "Önizleme: başka kullanıcı olarak yalnızca görüntüleyebilirsiniz." : "Test amaçlı geçici bileşen"}>Geliştirme Modu</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <label className="min-w-0">
          <span className="sr-only">Rol</span>
          <select value={role} aria-label="Rol" onChange={(e) => { const id = pickForRole(e.target.value); if (id) onChange(id); }} className="h-7 w-full rounded-md border border-slate-200 bg-white px-1.5 cw-11 font-semibold text-slate-700 outline-none focus:border-orange-400">
            {ROLES.map((r) => <option key={r} value={r} disabled={!all.some((u) => u.role === r && u.active !== false)}>{ROLE_LABELS[r]}</option>)}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">Kullanıcı</span>
          <select value={actor.id} aria-label="Görüntülenen kullanıcı" onChange={(e) => onChange(e.target.value)} className="h-7 w-full rounded-md border border-slate-200 bg-white px-1.5 cw-11 text-slate-700 outline-none focus:border-orange-400">
            {candidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function PreviewBanner({ actor, onExit, readOnly }) {
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 lg:px-6 py-2 bg-amber-50 border-b border-amber-200 cw-12 text-amber-900">
      <Eye size={14} className="shrink-0" />
      <span className="flex-1 min-w-0"><strong className="font-semibold">{actor.name}</strong> ({ROLE_LABELS[roleOf(actor)]}) olarak görüntülüyorsunuz{readOnly ? " · önizleme modunda değişiklik yapılamaz" : ""}.</span>
      <button type="button" onClick={onExit} className="h-7 px-2.5 rounded-md bg-white border border-amber-300 font-semibold hover:bg-amber-100">Kendi görünümüme dön</button>
    </div>
  );
}

/* ───────────────────────── Çalışan: Bugünkü İşlerim ───────────────────────── */

/* Çalışan ekranı kutuları (sıra ve sınıflandırma: taskIndicators.js EMPLOYEE_BOXES / employeeBox). */
const BOX_META = {
  late: [AlertTriangle, "text-red-600", "Geciken işiniz yok."],
  active: [Activity, "text-sky-600", "Aktif işiniz yok."],
  done: [CheckCircle2, "text-emerald-600", "Henüz tamamlanan iş yok."],
  web: [Globe, "text-indigo-600", "Web veya teknik iş yok."],
  manager: [ShieldCheck, "text-violet-600", "Yönetici onayında iş yok."],
  client: [Briefcase, "text-amber-600", "Müşteri onayında iş yok."],
  other: [Inbox, "text-slate-500", "Diğer görev yok."],
  ads: [Megaphone, "text-rose-600", "Reklam görevi yok."],
};

function EmployeeBoxItem({ task }) {
  const { openTask, brandsById } = useWS();
  const brand = brandsById[task.brandId];
  return (
    <li>
      <button type="button" onClick={() => openTask(task.id)} data-box-task={task.id}
        className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
        <span className="flex items-start gap-2">
          <span className="flex-1 min-w-0 cw-13 font-medium text-slate-800 cw-clamp2">{task.title}</span>
          <StatusPill status={task.status} small />
        </span>
        <span className="mt-1 flex items-center gap-1.5 cw-11 text-slate-500 min-w-0">
          <BrandLogo brand={brand} size={14} /><span className="truncate min-w-0">{brand?.name}</span>
          <span className="text-slate-300 shrink-0" aria-hidden="true">·</span><DeadlineLabel task={task} className="shrink-0" />
          <span className="flex-1" /><ChecklistIndicator task={task} />
        </span>
      </button>
    </li>
  );
}

/* Sabit yükseklikli kutu: başlık + sayı; görevler kutu içinde kayar (kutu uzamaz). */
function EmployeeBox({ box, tasks }) {
  const [Icon, tone, empty] = BOX_META[box.key];
  const id = `eb-${box.key}`;
  return (
    <section data-employee-box={box.key} aria-labelledby={id} className="flex flex-col h-[300px] bg-white border border-slate-200 rounded-xl overflow-hidden min-w-0">
      <header className="shrink-0 flex items-center gap-2 px-3.5 h-11 border-b border-slate-100">
        <Icon size={15} className={tone} aria-hidden="true" />
        <h2 id={id} className="flex-1 min-w-0 cw-13 font-bold text-slate-900 truncate" title={box.title}>{box.title}</h2>
        <span className={`cw-12 font-bold tabular-nums ${tasks.length ? tone : "text-slate-300"}`} data-box-count={tasks.length}>{tasks.length}</span>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto cw-scroll p-1.5" tabIndex={0} role="region" aria-label={`${box.title} listesi`}>
        {tasks.length
          ? <ul className="space-y-0.5">{tasks.map((t) => <EmployeeBoxItem key={t.id} task={t} />)}</ul>
          : <p className="h-full flex items-center justify-center text-center cw-12 text-slate-400 px-4">{empty}</p>}
      </div>
    </section>
  );
}

function NotificationList({ items, onOpen, compact }) {
  if (!items.length) return <p className="cw-12 text-slate-400 px-1 py-3">Henüz bildirim yok.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((n) => {
        const KindIcon = { revision: RotateCcw, approved: CheckCircle2, review: Clock, assign: User, status: Activity }[n.kind] || Bell;
        return (
          <li key={n.id}>
            <button type="button" onClick={() => onOpen(n)} className={`w-full text-left flex items-start gap-2.5 ${compact ? "py-2 px-1" : "py-3 px-3"} hover:bg-slate-50 rounded-lg`}>
              <span className={`mt-0.5 h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${n.readAt ? "bg-slate-100 text-slate-400" : "bg-orange-50 text-orange-600"}`}><KindIcon size={13} /></span>
              <span className="flex-1 min-w-0">
                <span className={`block cw-12 ${n.readAt ? "text-slate-600" : "text-slate-900 font-medium"} ${compact ? "cw-clamp2" : ""}`}>{n.text}</span>
                <span className="block cw-11 text-slate-400 mt-0.5">{fmtDateTime(n.createdAt)}</span>
              </span>
              {!n.readAt && <span className="mt-2 h-2 w-2 rounded-full bg-orange-500 shrink-0" aria-label="Okunmadı" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EmployeeDashboard({ search, brandId, onAllNotifications }) {
  const { state, actor, brandsById } = useWS();
  const now = useNow(); // gecikme zamanla değişir
  const q = norm(search);
  const groups = useMemo(() => {
    const out = Object.fromEntries(EMPLOYEE_BOXES.map((b) => [b.key, []]));
    state.tasks
      .filter((t) => (brandId === "all" || t.brandId === brandId) && matchesSearch(q, t.title, brandsById[t.brandId]?.name, t.platform, t.format))
      .forEach((t) => out[employeeBox(t, new Date(now))].push(t));
    const byDue = (a, b) => `${a.dueDate || "9999"} ${a.dueTime || "99"}`.localeCompare(`${b.dueDate || "9999"} ${b.dueTime || "99"}`);
    Object.entries(out).forEach(([k, list]) => list.sort(k === "done" ? (a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) : byDue));
    return out;
  }, [state.tasks, brandId, q, brandsById, now]);
  const unread = state.notifications.filter((n) => !n.readAt).length;
  return (
    <div className="space-y-5">
      <PageHeader title="Bugünkü İşlerim" description={`Merhaba ${actor.name.split(" ")[0]}, ${fmtDateDay(TODAY)} için size atanan işler.`}
        actions={<Btn size="sm" variant="secondary" onClick={onAllNotifications}><Bell size={14} />Bildirimler{unread ? ` (${unread})` : ""}</Btn>} />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" data-employee-boxes="">
        {EMPLOYEE_BOXES.map((b) => <EmployeeBox key={b.key} box={b} tasks={groups[b.key]} />)}
      </div>
    </div>
  );
}

/* ───────────────────────── Admin: Operasyon masası (4 sayaç + 8 grup) ───────────────────────── */

const isAgencyBrand = (brand) => !!brand && (/ajans/i.test(brand.sector || ""));
const OPS_META = {
  urgent: [AlertTriangle, "text-red-600", "border-t-red-500", "Geciken veya acil iş yok."],
  manager: [ShieldCheck, "text-violet-600", "border-t-violet-500", "Yönetici onayında iş yok."],
  client: [Briefcase, "text-amber-600", "border-t-amber-500", "Müşteri yanıtı beklenen iş yok."],
  active: [Activity, "text-sky-600", "border-t-sky-500", "Aktif çalışma yok."],
  done: [CheckCircle2, "text-emerald-600", "border-t-emerald-500", "Son 7 günde tamamlanan iş yok."],
  web: [Globe, "text-indigo-600", "border-t-indigo-500", "Web veya teknik iş yok."],
  agency: [Sparkles, "text-orange-600", "border-t-orange-500", "Ajans içi iş yok."],
  ads: [Megaphone, "text-rose-600", "border-t-rose-500", "Reklam işi yok."],
};

function OpsBoxItem({ task, showStatus }) {
  const { openTask, brandsById } = useWS();
  const brand = brandsById[task.brandId];
  const assignee = USER_BY_ID[task.assigneeId];
  return (
    <li>
      <button type="button" onClick={() => openTask(task.id)} data-ops-task={task.id}
        className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
        <span className="block cw-13 cw-clamp2"><strong className="font-semibold text-slate-900">{brand?.name}</strong><span className="text-slate-300 mx-1" aria-hidden="true">·</span><span className="text-slate-700">{task.title}</span></span>
        <span className="mt-1 flex items-center gap-1.5 cw-11 text-slate-500 min-w-0">
          <Avatar userId={task.assigneeId} size={16} />
          <span className="truncate min-w-0" title={assignee?.name}>{assignee ? assignee.name.split(" ")[0] : "Atanmamış"}</span>
          <span className="text-slate-300 shrink-0" aria-hidden="true">·</span><DeadlineLabel task={task} className="shrink-0" />
          {showStatus && <><span className="flex-1" /><StatusPill status={task.status} small /></>}
        </span>
      </button>
    </li>
  );
}

/* Grubun adı durumu zaten söylüyorsa (onaylar, tamamlananlar, geciken) satırda ayrıca durum etiketi gösterilmez. */
const STATUS_IMPLIED = new Set(["urgent", "manager", "client", "done"]);

function OpsBox({ box, tasks }) {
  const [Icon, tone, border, empty] = OPS_META[box.key];
  const id = `ops-${box.key}`;
  return (
    <section data-ops-box={box.key} aria-labelledby={id} className={`flex flex-col h-[300px] bg-white border border-slate-200 border-t-4 ${border} rounded-xl overflow-hidden min-w-0`}>
      <header className="shrink-0 flex items-center gap-2 px-3.5 h-11 border-b border-slate-100">
        <Icon size={15} className={tone} aria-hidden="true" />
        <h3 id={id} className="flex-1 min-w-0 cw-13 font-bold text-slate-900 truncate" title={box.title}>{box.title}</h3>
        <span className={`h-5 min-w-5 px-1.5 rounded-full cw-11 font-bold tabular-nums flex items-center justify-center ${tasks.length ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-300"}`} data-ops-count={tasks.length}>{tasks.length}</span>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto cw-scroll p-1.5" tabIndex={0} role="region" aria-label={`${box.title} listesi`}>
        {tasks.length
          ? <ul className="space-y-0.5">{tasks.map((t) => <OpsBoxItem key={t.id} task={t} showStatus={!STATUS_IMPLIED.has(box.key)} />)}</ul>
          : <p className="h-full flex items-center justify-center text-center cw-12 text-slate-400 px-4">{empty}</p>}
      </div>
    </section>
  );
}

/* Ekranda gösterilen kutular (Geciken & Acil İşler, Yönetici Onayı, Müşteri Onayı, Aktif Çalışmalar gizli). */
const VISIBLE_OPS_BOXES = new Set(["done", "web", "agency", "ads"]);

function OpsDesk({ tasks, open, onToggle }) {
  const { brandsById } = useWS();
  const now = useNow();
  const { metrics, groups } = useMemo(() => {
    const at = new Date(now);
    const yesterday = addDays(TODAY, -1), weekAgo = addDays(TODAY, -7);
    const out = Object.fromEntries(OPS_BOXES.map((b) => [b.key, []]));
    const isAgency = (t) => isAgencyBrand(brandsById[t.brandId]);
    tasks.forEach((t) => {
      const key = opsBox(t, { now: at, isAgency });
      // Tamamlananlar: yayına hazır (Onaylandı) her zaman; tamamlananlar yalnızca son 7 gün.
      if (key === "done" && t.status === "Tamamlandı" && !((planDate(t) || "") >= weekAgo || String(t.updatedAt || "").slice(0, 10) >= weekAgo)) return;
      out[key].push(t);
    });
    const byDue = (a, b) => `${a.dueDate || "9999"} ${a.dueTime || "99"}`.localeCompare(`${b.dueDate || "9999"} ${b.dueTime || "99"}`);
    Object.entries(out).forEach(([k, list]) => list.sort(k === "done" ? (a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) : byDue));
    return { metrics: opsMetrics(tasks, { now: at, today: TODAY, yesterday }), groups: out };
  }, [tasks, brandsById, now]);
  const diff = metrics.today - metrics.yesterday;
  const cards = [
    { key: "today", label: "Bugünkü Teslimatlar", value: metrics.today, tone: "text-orange-600", border: "border-t-orange-500",
      sub: diff === 0 ? "Dünle aynı" : `Dünden ${Math.abs(diff)} ${diff > 0 ? "fazla" : "az"}`, SubIcon: diff >= 0 ? ArrowUp : ArrowDown },
    { key: "late", label: "Geciken İşler", value: metrics.late, tone: metrics.late ? "text-red-600" : "text-slate-900", border: "border-t-red-500",
      sub: metrics.critical ? `${metrics.critical} kritik iş` : metrics.late ? "Kritik iş yok" : "Geciken iş yok", SubIcon: AlertTriangle, subTone: metrics.critical ? "text-red-600 font-semibold" : "" },
    { key: "manager", label: "Yönetici Onayı", value: metrics.manager, tone: "text-slate-900", border: "border-t-violet-500", sub: "İncelenmeyi bekliyor", SubIcon: ShieldCheck },
    { key: "client", label: "Müşteri Onayı", value: metrics.client, tone: "text-slate-900", border: "border-t-amber-500", sub: "Yanıt bekliyor", SubIcon: Briefcase },
  ];
  return (
    <section aria-label="Genel bakış" data-ops-desk="">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="flex items-center gap-2 cw-13 font-semibold text-slate-900"><LayoutDashboard size={15} className="text-slate-400" />Genel Bakış</h2>
        <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 cw-12 font-medium text-slate-500 hover:text-slate-900" aria-expanded={open}>
          {open ? "Gizle" : "Göster"}{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            {cards.map(({ key, label, value, tone, border, sub, SubIcon, subTone }) => (
              <div key={key} data-ops-metric={key} className={`p-4 rounded-xl border border-slate-200 border-t-4 ${border} bg-white min-w-0`}>
                <p className="cw-11 font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</p>
                <p className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${tone}`} data-ops-value={value}>{value}</p>
                <p className={`mt-1 flex items-center gap-1 cw-12 text-slate-500 min-w-0 ${subTone || ""}`}><SubIcon size={12} className="shrink-0" aria-hidden="true" /><span className="truncate">{sub}</span></p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" data-ops-boxes="">
            {OPS_BOXES.filter((b) => VISIBLE_OPS_BOXES.has(b.key)).map((b) => <OpsBox key={b.key} box={b} tasks={groups[b.key]} />)}
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── Sosyal Medya Planı (Günlük / Haftalık / Aylık) ───────────────────────── */

const PLAN_VIEWS = [["day", "Günlük", Calendar], ["week", "Haftalık", CalendarRange], ["month", "Aylık", CalendarDays]];
const PLAN_VIEW_KEY = "cw:plan-view";
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const shiftMonth = (iso, n) => { const d = parseISO(monthStart(iso)); d.setMonth(d.getMonth() + n); return toISO(d); };
const weekStartOf = (iso) => addDays(iso, -((parseISO(iso).getDay() + 6) % 7));
const fmtShort = (iso) => { const d = parseISO(iso); return `${d.getDate()} ${AYLAR[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
const monthLabel = (iso) => { const d = parseISO(iso); return `${AYLAR[d.getMonth()]} ${d.getFullYear()}`; };
/* Satır tonu (Google Docs planındaki renklendirme): gecikmiş açık iş kırmızı, diğerleri duruma göre. */
const PLAN_ROW_TONE = {
  "Başlanmadı": "border-l-slate-300 bg-white", "Çalışılıyor": "border-l-sky-500 bg-sky-50/50", "Yönetici Onayı": "border-l-violet-500 bg-violet-50/50",
  "Müşteri Onayı": "border-l-amber-500 bg-amber-50/60", "Revizyon": "border-l-orange-500 bg-orange-50/50", "Onaylandı": "border-l-teal-500 bg-teal-50/50",
  "Tamamlandı": "border-l-emerald-500 bg-emerald-50/50", "Gecikti": "border-l-red-500 bg-red-50/60",
};
const planRowTone = (task) => (deadlineInfo(task).state === "overdue" ? PLAN_ROW_TONE["Gecikti"] : PLAN_ROW_TONE[task.status] || PLAN_ROW_TONE["Başlanmadı"]);
const planTitle = (task) => (norm(task.title).startsWith(norm(task.format)) ? task.title : `${task.format.toLocaleUpperCase("tr-TR")} · ${task.title}`);

/* Üzerine gelince açılan küçük bilgi kartı (masaüstü); dokunmatikte / klavyede tıklayınca açılır. */
function HoverInfo({ label, trigger, triggerClass = "", width = 280, children }) {
  const [anchor, setAnchor] = useState(null);
  const [mode, setMode] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const keep = () => clearTimeout(timer.current);
  const close = useCallback(() => { clearTimeout(timer.current); setMode(null); }, []);
  const hoverOut = () => { keep(); timer.current = setTimeout(() => setMode((m) => (m === "hover" ? null : m)), 180); };
  return (
    <>
      <button type="button" ref={setAnchor} aria-label={label} aria-haspopup="dialog" aria-expanded={mode !== null}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") { keep(); setMode((m) => m || "hover"); } }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") hoverOut(); }}
        onClick={(e) => { e.stopPropagation(); setMode((m) => (m === "pinned" ? null : "pinned")); }}
        className={`inline-flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${triggerClass}`}>
        {trigger}
      </button>
      <Floating anchorEl={anchor} open={mode !== null} onClose={close} width={width} placement="top-start" onMouseEnter={keep} onMouseLeave={() => { if (mode === "hover") hoverOut(); }} label={label}>
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
      </Floating>
    </>
  );
}

function CommentPreview({ task }) {
  const { state, openTask, commentCount } = useWS();
  const count = commentCount[task.id] || 0;
  const latest = useMemo(() => state.comments.filter((c) => c.taskId === task.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2), [state.comments, task.id]);
  if (!count) return <span className="inline-flex items-center gap-0.5 cw-11 text-slate-300 tabular-nums" aria-label="Yorum yok"><MessageSquare size={13} aria-hidden="true" />0</span>;
  return (
    <HoverInfo label={`${count} yorum`} width={300} triggerClass="gap-0.5 h-6 px-1 cw-11 font-medium tabular-nums text-slate-500 hover:text-orange-600 hover:bg-orange-50"
      trigger={<><MessageSquare size={13} aria-hidden="true" />{count}</>}>
      <p className="px-3 pt-2.5 pb-1 cw-11 font-semibold uppercase tracking-wide text-slate-400">Yorumlar</p>
      <ul className="px-3 pb-1 space-y-2.5">
        {latest.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <Avatar userId={c.userId} size={24} />
            <span className="min-w-0">
              <span className="flex items-baseline gap-1.5"><span className="cw-12 font-semibold text-slate-900 truncate">{USER_BY_ID[c.userId]?.name.split(" ")[0] || "Kullanıcı"}</span><span className="cw-10 text-slate-400 shrink-0">{fmtDateTime(c.createdAt)}</span></span>
              <span className="block cw-12 text-slate-600 cw-clamp2">{c.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => openTask(task.id, "comments")} className="w-full text-left px-3 py-2 mt-1 border-t border-slate-100 cw-12 font-semibold text-orange-600 hover:bg-orange-50 rounded-b-xl inline-flex items-center gap-1">
        Tüm yorumları gör ({count})<ChevronRight size={13} aria-hidden="true" />
      </button>
    </HoverInfo>
  );
}

function AssigneeHover({ userId }) {
  const u = USER_BY_ID[userId];
  if (!u) return <Avatar userId={null} size={26} />;
  return (
    <HoverInfo label={`Sorumlu: ${u.name}`} width={240} triggerClass="rounded-full" trigger={<Avatar userId={userId} size={26} />}>
      <div className="flex items-center gap-2.5 p-3">
        <Avatar userId={userId} size={36} />
        <span className="min-w-0">
          <span className="block cw-11 font-semibold uppercase tracking-wide text-slate-400">Sorumlu kişi</span>
          <span className="block cw-13 font-semibold text-slate-900 truncate">{u.name}</span>
          <span className="block cw-11 text-slate-500 truncate">{u.email || userTitle(u)}</span>
        </span>
      </div>
    </HoverInfo>
  );
}

/* Aylık plan satırı: tarih · gün · format/başlık · ekler · yorumlar · sorumlu · durum. */
function PlanRow({ task }) {
  const { openTask, attachmentsByTask, updateTask, statusOptions } = useWS();
  const iso = planDate(task);
  const d = parseISO(iso);
  const late = deadlineInfo(task).state === "overdue";
  return (
    <div role="row" onClick={() => openTask(task.id)} data-plan-row={task.id}
      className={`cw-plan-row group border border-slate-200 border-l-4 rounded-lg cursor-pointer hover:shadow-sm transition ${planRowTone(task)}`}>
      <span role="cell" className={`cw-plan-date cw-12 font-medium tabular-nums ${late ? "text-red-600" : "text-slate-700"}`}>{fmtShort(iso)}</span>
      <span role="cell" className={`cw-plan-day cw-12 ${late ? "text-red-600" : "text-slate-500"}`}>{GUNLER[d.getDay()]}</span>
      <button role="cell" type="button" onClick={(e) => { e.stopPropagation(); openTask(task.id); }} title={`${task.title} · ${task.platform} · ${task.format}`}
        className={`cw-plan-title min-w-0 text-left cw-13 font-semibold truncate rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${task.status === "Tamamlandı" ? "text-slate-500" : "text-slate-900"}`}>
        {planTitle(task)}
      </button>
      <span role="cell" className="cw-plan-meta inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <AttachmentIndicator attachments={attachmentsByTask[task.id] || EMPTY} showEmpty />
        <CommentPreview task={task} />
        <AssigneeHover userId={task.assigneeId} />
      </span>
      <span role="cell" className="cw-plan-status justify-self-end" onClick={(e) => e.stopPropagation()}>
        <StatusMenu value={task.status} small options={statusOptions(task)} onChange={(s) => updateTask(task.id, { status: s }, `Durum “${s}” olarak güncellendi.`)} />
      </span>
    </div>
  );
}

function MonthPlan({ brands, tasks, month, brandId, onSelectBrand }) {
  const { openNewTask, can: allowed } = useWS();
  const inMonth = useMemo(() => tasks.filter((t) => (planDate(t) || "").startsWith(month.slice(0, 7))), [tasks, month]);
  const countBy = useMemo(() => { const m = {}; inMonth.forEach((t) => { m[t.brandId] = (m[t.brandId] || 0) + 1; }); return m; }, [inMonth]);
  const active = brands.find((b) => b.id === brandId) || brands.find((b) => countBy[b.id]) || brands[0];
  const [collapsed, setCollapsed] = useState(() => new Set());
  const weeks = useMemo(() => {
    const m = new Map();
    inMonth.filter((t) => active && t.brandId === active.id)
      .sort((a, b) => `${planDate(a)} ${a.dueTime || "99"} ${a.title}`.localeCompare(`${planDate(b)} ${b.dueTime || "99"} ${b.title}`))
      .forEach((t) => { const w = weekOfMonth(planDate(t)); if (!m.has(w)) m.set(w, []); m.get(w).push(t); });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [inMonth, active]);
  if (!active) return <EmptyBlock icon={CalendarDays} title="Henüz marka yok" text="Plan oluşturmak için önce bir marka ekleyin." />;
  const toggle = (w) => setCollapsed((s) => { const n = new Set(s); n.has(w) ? n.delete(w) : n.add(w); return n; });
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]" data-month-plan="">
      <nav aria-label="Marka planları" className="hidden lg:block">
        <p className="px-2 mb-1.5 cw-11 font-semibold uppercase tracking-wide text-slate-400">Marka planları</p>
        <ul className="space-y-0.5">
          {brands.map((b) => {
            const on = b.id === active.id;
            return (
              <li key={b.id}>
                <button type="button" onClick={() => onSelectBrand(b.id)} aria-current={on ? "true" : undefined} data-plan-brand={b.id}
                  className={`w-full flex items-center gap-2 h-9 px-2 rounded-lg cw-13 text-left transition ${on ? "bg-orange-50 text-orange-700 font-semibold" : "text-slate-600 hover:bg-slate-100"}`}>
                  <FileText size={14} className={on ? "text-orange-600" : "text-slate-400"} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate">{b.name}</span>
                  {countBy[b.id] ? <span className="cw-10 font-semibold tabular-nums text-slate-400">{countBy[b.id]}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0 bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 justify-between mb-3">
          <label className="lg:hidden w-full">
            <span className="sr-only">Marka</span>
            <select value={active.id} onChange={(e) => onSelectBrand(e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 cw-13 font-medium text-slate-700">
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}{countBy[b.id] ? ` (${countBy[b.id]})` : ""}</option>)}
            </select>
          </label>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 min-w-0" data-plan-heading="">{active.name.toLocaleUpperCase("tr-TR")} {AYLAR[parseISO(month).getMonth()]} Sosyal Medya</h2>
          {allowed("canCreateTasks") && <Btn size="sm" variant="secondary" onClick={() => openNewTask(active.id)}><Plus size={14} />İçerik Ekle</Btn>}
        </div>
        {weeks.length === 0 ? (
          <p className="py-10 text-center cw-13 text-slate-500" data-plan-empty="">{monthLabel(month)} için {active.name} planında içerik yok.</p>
        ) : (
          <div className="cw-plan-list space-y-4" role="table" aria-label={`${active.name} ${monthLabel(month)} planı`}>
            {weeks.map(([w, list]) => {
              const open = !collapsed.has(w);
              return (
                <section key={w} data-plan-week={w} role="rowgroup">
                  <button type="button" onClick={() => toggle(w)} aria-expanded={open} className="flex items-center gap-1.5 mb-2 cw-14 font-bold text-slate-900 hover:text-orange-700">
                    <ChevronDown size={16} className={`transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />{w}. Hafta
                    <span className="cw-11 font-medium text-slate-400 ml-1">{list.length} içerik</span>
                  </button>
                  {open && <div className="space-y-1.5">{list.map((t) => <PlanRow key={t.id} task={t} />)}</div>}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* Günlük / haftalık görünümde bir markanın o günkü içerikleri. */
function PlanBrandCard({ brand, tasks }) {
  const { openTask } = useWS();
  const color = BRAND_COLORS[brand.color] || BRAND_COLORS.orange;
  return (
    <article data-plan-card={brand.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden min-w-0 flex flex-col">
      <span className={`h-1 ${color.bar}`} aria-hidden="true" />
      <header className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
        <BrandLogo brand={brand} size={30} />
        <h3 className="flex-1 min-w-0 cw-13 font-bold text-slate-900 truncate" title={brand.name}>{brand.name}</h3>
        <span className="h-5 px-2 rounded-full bg-slate-100 cw-11 font-semibold text-slate-600 whitespace-nowrap">{tasks.length} görev</span>
      </header>
      <ul className="px-1.5 pb-1.5 divide-y divide-slate-100">
        {tasks.map((t) => {
          const assignee = USER_BY_ID[t.assigneeId];
          return (
            <li key={t.id}>
              <button type="button" onClick={() => openTask(t.id)} data-plan-card-task={t.id} className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
                <span className="flex items-center gap-2">
                  <span className="flex-1 inline-flex items-center gap-1 cw-11 text-slate-500"><Calendar size={11} aria-hidden="true" />{fmtShort(planDate(t))}</span>
                  <StatusPill status={t.status} small />
                </span>
                <span className="block mt-1 cw-13 font-semibold text-slate-900 cw-clamp2">{planTitle(t)}</span>
                <span className="mt-1 flex items-center gap-1.5 cw-11 text-slate-500 min-w-0">
                  <Avatar userId={t.assigneeId} size={18} /><span className="truncate">{assignee ? shortName(assignee.name) : "Atanmamış"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function PlanDay({ iso, brands, tasks, compact }) {
  const groups = useMemo(() => brands.map((b) => ({ brand: b, tasks: tasks.filter((t) => t.brandId === b.id && planDate(t) === iso) })).filter((g) => g.tasks.length), [brands, tasks, iso]);
  const [open, setOpen] = useState(true);
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);
  const isToday = iso === TODAY;
  if (!compact && !total) return <EmptyBlock icon={CalendarDays} title={`${fmtDateDay(iso)} için planlanmış içerik yok`} text="Başka bir güne geçebilir veya yeni içerik ekleyebilirsiniz." />;
  return (
    <section data-plan-day={iso} aria-label={fmtDateDay(iso)}>
      {compact && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={!total} className="flex items-center gap-2 mb-2.5 text-left disabled:cursor-default">
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${open && total ? "" : "-rotate-90"}`} aria-hidden="true" />
          <span className={`cw-14 font-bold ${total ? "text-slate-900" : "text-slate-400"}`}>{fmtDateLong(iso)}</span>
          <span className="cw-12 text-slate-400">{GUNLER[parseISO(iso).getDay()]}</span>
          {isToday && <span className="h-5 px-1.5 rounded-md bg-orange-100 text-orange-700 cw-10 font-semibold flex items-center">Bugün</span>}
          <span className="cw-11 text-slate-400">{total ? `${total} içerik` : "İçerik yok"}</span>
        </button>
      )}
      {(!compact || (open && total > 0)) && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 items-start">
          {groups.map((g) => <PlanBrandCard key={g.brand.id} brand={g.brand} tasks={g.tasks} />)}
        </div>
      )}
    </section>
  );
}

function SocialPlanPage({ search, brandId }) {
  const { state, brandsById, openNewTask, can: allowed } = useWS();
  useNow();
  const [view, setViewState] = useState(() => { try { return window.localStorage.getItem(PLAN_VIEW_KEY) || "month"; } catch { return "month"; } });
  const setView = (v) => { setViewState(v); try { window.localStorage.setItem(PLAN_VIEW_KEY, v); } catch { /* depolama kapalı */ } };
  const [cursor, setCursor] = useState(TODAY);
  // Aylık planda seçilen marka yalnızca planı değiştirir; kenar çubuğundaki marka seçimi (günlük/haftalık süzgeç) etkilenmez.
  const [planBrand, setPlanBrand] = useState(brandId !== "all" ? brandId : null);
  useEffect(() => { if (brandId !== "all") setPlanBrand(brandId); }, [brandId]);
  const q = norm(search);
  const tasks = useMemo(() => state.tasks.filter((t) => planDate(t) && matchesSearch(q, t.title, brandsById[t.brandId]?.name, t.platform, t.format)), [state.tasks, q, brandsById]);
  const brands = state.brands;
  const visibleBrands = view === "month" || brandId === "all" ? brands : brands.filter((b) => b.id === brandId);
  const step = (n) => setCursor((c) => (view === "day" ? addDays(c, n) : view === "week" ? addDays(c, 7 * n) : shiftMonth(c, n)));
  const ws = weekStartOf(cursor);
  const heading = view === "day" ? fmtDateLong(cursor) : view === "week" ? `${fmtDate(ws)} – ${fmtDateLong(addDays(ws, 6))}` : monthLabel(cursor);
  const sub = view === "day" ? GUNLER[parseISO(cursor).getDay()] : view === "week" ? "Haftalık plan" : "Aylık içerik planı";
  const unplanned = state.tasks.filter((t) => !planDate(t)).length;
  return (
    <div className="space-y-4" data-social-plan={view}>
      <div className="flex flex-wrap items-center gap-2 justify-between bg-white border border-slate-200 rounded-xl p-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Btn size="sm" variant="secondary" onClick={() => setCursor(TODAY)}><Calendar size={14} />Bugün</Btn>
          <button type="button" onClick={() => step(-1)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100" aria-label="Önceki"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => step(1)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100" aria-label="Sonraki"><ChevronRight size={16} /></button>
          <div className="min-w-0 ml-1">
            <h2 className="cw-15 font-bold text-slate-900 leading-tight truncate" data-plan-title="">{heading}</h2>
            <p className="cw-11 text-slate-500 leading-tight">{sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 gap-0.5 rounded-lg bg-slate-100" role="tablist" aria-label="Plan görünümü">
            {PLAN_VIEWS.map(([key, label, Icon]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} data-plan-view={key}
                className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md cw-12 whitespace-nowrap transition ${view === key ? "bg-white text-orange-700 font-semibold shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900 font-medium border border-transparent"}`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
          {allowed("canCreateTasks") && <Btn size="sm" variant="primary" onClick={() => openNewTask(brandId !== "all" ? brandId : undefined)}><Plus size={14} /><span className="hidden sm:inline">Yeni Görev</span></Btn>}
        </div>
      </div>
      {view === "month" && <MonthPlan brands={brands} tasks={tasks} month={monthStart(cursor)} brandId={planBrand} onSelectBrand={setPlanBrand} />}
      {view === "day" && <PlanDay iso={cursor} brands={visibleBrands} tasks={tasks} />}
      {view === "week" && (
        <div className="space-y-5">
          {Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((iso) => <PlanDay key={iso} iso={iso} brands={visibleBrands} tasks={tasks} compact />)}
        </div>
      )}
      {unplanned > 0 && <p className="cw-11 text-slate-400">{unplanned} görevin yayın veya teslim tarihi olmadığı için planda gösterilmiyor; tarih ekleyince burada görünür.</p>}
    </div>
  );
}

/* ───────────────────────── Admin: Onay Süreçleri ───────────────────────── */

const APPROVAL_STAGES = [
  ["Yönetici Onayı", "Yönetici Onayı"],
  ["Müşteri Onayı", "Müşteri Onayı Bekleniyor"],
  ["Revizyon", "Revize İstendi"],
  ["Onaylandı", "Onaylandı"],
];

function ApprovalsPage({ search, brandId }) {
  const { state, brandsById, openTask, updateTask, can: allowed } = useWS();
  const [stage, setStage] = useState("Müşteri Onayı");
  const q = norm(search);
  const list = state.tasks
    .filter((t) => t.status === stage && (brandId === "all" || t.brandId === brandId) && matchesSearch(q, t.title, brandsById[t.brandId]?.name, USER_BY_ID[t.assigneeId]?.name))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const clientsOf = (brandId) => state.memberships.filter((m) => m.brandId === brandId && USER_BY_ID[m.userId]?.role === "client").map((m) => m.userId);
  const actionsFor = (t) => {
    if (!allowed("canUpdateTasks")) return [];
    if (stage === "Yönetici Onayı") return [["Müşteriye Gönder", Send, () => updateTask(t.id, { status: "Müşteri Onayı" }, "İçerik müşteri onayına gönderildi."), "primary"], ["Çalışana İade Et", RotateCcw, () => updateTask(t.id, { status: "Çalışılıyor" }, "İçerik çalışana iade edildi.")]];
    if (stage === "Müşteri Onayı") return [["Onaydan Geri Çek", RotateCcw, () => updateTask(t.id, { status: "Çalışılıyor" }, "İçerik onaydan geri çekildi.")]];
    if (stage === "Onaylandı") return [["Yayınlandı İşaretle", Check, () => updateTask(t.id, { status: "Tamamlandı" }, "İçerik yayınlandı olarak işaretlendi."), "primary"]];
    return [];
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Onay Süreçleri" description="İçeriklerin iç onaydan müşteri onayına ve yayına kadar olan akışı." />
      <Segmented ariaLabel="Onay aşaması" value={stage} onChange={setStage} items={APPROVAL_STAGES.map(([k, l]) => [k, l, state.tasks.filter((t) => t.status === k && (brandId === "all" || t.brandId === brandId)).length])} />
      {list.length ? (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {list.map((t) => {
            const brand = brandsById[t.brandId];
            const rev = stage === "Revizyon" ? latestRevision(state.approvals, t.id) : null;
            const clients = clientsOf(t.brandId);
            return (
              <div key={t.id} className="p-3.5 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <BrandLogo brand={brand} size={32} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => openTask(t.id)} className="text-left cw-13 font-semibold text-slate-900 hover:text-orange-700">{t.title}</button>
                    <p className="cw-11 text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{brand?.name}</span><span>·</span><PlatformChip platform={t.platform} /><span>·</span><span>Yayın: {fmtDate(t.publishDate)}</span><span>·</span><span>Güncelleme: {fmtDateTime(t.updatedAt || t.createdAt)}</span>
                      {latestVersion(state.contentVersions || EMPTY, t.id) && <><span>·</span><span data-approval-version="">Sürüm {latestVersion(state.contentVersions || EMPTY, t.id).versionNo} · {assetsOf(state.contentAssets || EMPTY, latestVersion(state.contentVersions || EMPTY, t.id).id).length} dosya</span></>}
                    </p>
                    {rev && <p className="mt-1.5 cw-12 text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5"><strong className="font-semibold">{USER_BY_ID[rev.userId]?.name}:</strong> {rev.note}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <span className="inline-flex items-center gap-1.5 cw-12 text-slate-600" title="Sorumlu"><Avatar userId={t.assigneeId} size={22} />{USER_BY_ID[t.assigneeId]?.name || "Atanmamış"}</span>
                  <span className="inline-flex items-center gap-1 cw-11 text-slate-500" title="Müşteri"><Briefcase size={12} />{clients.length ? clients.map((id) => USER_BY_ID[id]?.name).join(", ") : "Müşteri atanmamış"}</span>
                  {actionsFor(t).map(([label, Icon, fn, variant]) => <Btn key={label} size="sm" variant={variant || "secondary"} onClick={fn}><Icon size={13} />{label}</Btn>)}
                  <Btn size="sm" variant="ghost" onClick={() => openTask(t.id)}><ChevronRight size={13} />Detay</Btn>
                </div>
              </div>
            );
          })}
        </div>
      ) : <EmptyBlock icon={CheckCircle2} title="Bu aşamada içerik yok" text={search ? "Aramanızla eşleşen içerik bulunamadı." : "İçerikler iş akışında ilerledikçe burada görünür."} />}
    </div>
  );
}

/* ───────────────────────── Bildirimler ───────────────────────── */

function NotificationsPage({ onOpen, search }) {
  const { state, dispatch, notify } = useWS();
  const [filter, setFilter] = useState("all");
  const q = norm(search);
  const sorted = [...state.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = sorted.filter((n) => !n.readAt);
  const list = (filter === "unread" ? unread : sorted).filter((n) => matchesSearch(q, n.text));
  return (
    <div className="space-y-4">
      <PageHeader title="Bildirimler" description="Size atanan işler, onaylar ve revize talepleri."
        actions={<Btn size="sm" variant="secondary" disabled={!unread.length} onClick={() => { if (dispatch({ type: "MARK_NOTIFICATIONS_READ", ids: unread.map((n) => n.id) })) notify("Tüm bildirimler okundu olarak işaretlendi."); }}><Check size={13} />Tümünü Okundu İşaretle</Btn>} />
      <Segmented ariaLabel="Bildirim filtresi" value={filter} onChange={setFilter} items={[["all", "Tümü", sorted.length], ["unread", "Okunmamış", unread.length]]} />
      <div className="bg-white border border-slate-200 rounded-xl p-1.5">
        {list.length ? <NotificationList items={list} onOpen={onOpen} /> : <p className="cw-13 text-slate-500 text-center py-10">{filter === "unread" ? "Okunmamış bildiriminiz yok." : "Gösterilecek bildirim yok."}</p>}
      </div>
    </div>
  );
}

/* ───────────────────────── Admin: kullanıcı formu ───────────────────────── */

function BrandChecklist({ value, onChange, error }) {
  const { state } = useWS();
  const [q, setQ] = useState("");
  const list = state.brands.filter((b) => norm(b.name).includes(norm(q)));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className={`rounded-lg border ${error ? "border-red-300" : "border-slate-200"} overflow-hidden`}>
      {state.brands.length > 6 && (
        <label className="flex items-center gap-2 h-8 px-2.5 border-b border-slate-100 bg-slate-50">
          <Search size={12} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marka ara…" aria-label="Marka ara" className="flex-1 bg-transparent outline-none cw-12" />
        </label>
      )}
      <div className="max-h-44 overflow-y-auto cw-scroll p-1">
        {list.map((b) => (
          <label key={b.id} className="flex items-center gap-2 px-2 h-8 rounded-md hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={value.includes(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4 accent-orange-600" />
            <BrandLogo brand={b} size={20} /><span className="cw-12 text-slate-800 truncate">{b.name}</span>
          </label>
        ))}
        {!list.length && <p className="px-2 py-2 cw-12 text-slate-400">Marka bulunamadı.</p>}
      </div>
    </div>
  );
}

/* Yöneticinin belirlediği şifre. Panelde / veritabanı tablolarında saklanmaz; yalnızca Supabase Auth'a (bcrypt özeti) gider. */
function strongPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", digits = "23456789";
  const pick = (set) => set[globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  let p = "";
  for (let i = 0; i < 10; i++) p += pick(letters + digits);
  return `${p}${pick(digits)}${pick(letters)}`; // en az bir harf + bir rakam garantili (12 karakter)
}
const passwordErrors = ({ password, repeat }) => {
  const e = validatePasswordChange({ next: password, repeat }, false);
  return { ...(e.next ? { password: e.next } : {}), ...(e.repeat ? { repeat: e.repeat } : {}) };
};
function PasswordFields({ value, onChange, errors }) {
  const [show, setShow] = useState(false);
  const type = show ? "text" : "password";
  return (
    <>
      <Field label="Şifre" error={errors.password}>
        <input type={type} autoComplete="new-password" value={value.password} onChange={(e) => onChange({ password: e.target.value })} aria-label="Yeni kullanıcı şifresi" className={inputCls(errors.password)} />
      </Field>
      <Field label="Şifre (Tekrar)" error={errors.repeat}>
        <input type={type} autoComplete="new-password" value={value.repeat} onChange={(e) => onChange({ repeat: e.target.value })} aria-label="Yeni kullanıcı şifresi (tekrar)" className={inputCls(errors.repeat)} />
      </Field>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <label className="inline-flex items-center gap-2 cw-12 text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-orange-600" />Şifreyi göster
        </label>
        <button type="button" onClick={() => { const p = strongPassword(); onChange({ password: p, repeat: p }); setShow(true); }} className="inline-flex items-center gap-1 cw-12 font-semibold text-orange-600 hover:text-orange-700">
          <KeyRound size={13} />Güçlü şifre oluştur
        </button>
        <span className="cw-11 text-slate-500">En az {MIN_PASSWORD} karakter; en az bir harf ve bir rakam.</span>
      </div>
    </>
  );
}

/* Yönetici mevcut kullanıcıya yeni şifre verir (şifresini unutan çalışan). E-posta gönderilmez. */
function UserPasswordModal({ user, api, onClose, onDone }) {
  const [form, setForm] = useState({ password: "", repeat: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const errs = passwordErrors(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try { await api.setPassword(user.id, form.password); onDone(); }
    catch (err) { setErrors({ form: err?.message || "Şifre kaydedilemedi." }); setSaving(false); }
  };
  return (
    <Modal title="Şifre Belirle" subtitle={`${user.name} · ${user.email}`} onClose={onClose} width={480}
      footer={<><Btn variant="secondary" onClick={onClose} disabled={saving}>İptal</Btn><Btn variant="primary" type="submit" form="cw-user-password" disabled={saving}>{saving ? "Kaydediliyor…" : <><KeyRound size={14} />Şifreyi Kaydet</>}</Btn></>}>
      <form id="cw-user-password" onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" data-user-password="">
        <p className="sm:col-span-2 cw-12 text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">Kullanıcı bundan sonra e-posta adresi ve bu şifreyle giriş yapar; eski şifresi geçersiz olur. E-posta gönderilmez — şifreyi kendisine güvenli bir kanaldan iletin.</p>
        <PasswordFields value={form} errors={errors} onChange={(patch) => { setForm((f) => ({ ...f, ...patch })); setErrors({}); }} />
        {errors.form && <p role="alert" className="sm:col-span-2 cw-12 text-red-700">{errors.form}</p>}
      </form>
    </Modal>
  );
}

function UserModal({ userId, presetRole, onClose }) {
  const { state, dispatch, notify, userApi } = useWS();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const existing = userId ? state.allUsers.find((u) => u.id === userId) : null;
  const [form, setForm] = useState(() => ({
    name: existing?.name || "",
    email: existing?.email || "",
    role: existing?.role || presetRole || "employee",
    title: existing?.title || "",
    company: existing?.company || "",
    brandIds: existing ? state.allMemberships.filter((m) => m.userId === existing.id).map((m) => m.brandId) : [],
    permissions: existing ? (Array.isArray(existing.permissions) ? existing.permissions : ROLE_DEFAULT_TOGGLES[existing.role]) : ROLE_DEFAULT_TOGGLES[presetRole || "employee"],
    password: "",
    repeat: "",
  }));
  const withPassword = !existing && !!userApi;
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const setRole = (role) => setForm((f) => ({ ...f, role, permissions: ROLE_DEFAULT_TOGGLES[role] }));
  const allowedToggles = ROLE_ALLOWED_TOGGLES[form.role];
  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const next = {};
    if (!form.name.trim()) next.name = "Ad soyad zorunludur.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Geçerli bir e-posta adresi girin.";
    else if (state.allUsers.some((u) => u.id !== userId && (u.email || "").toLowerCase() === form.email.trim().toLowerCase())) next.email = "Bu e-posta ile kayıtlı bir kullanıcı var.";
    if (form.role === "client" && !form.brandIds.length) next.brandIds = "Müşteri için en az bir marka seçin.";
    if (withPassword) Object.assign(next, passwordErrors(form));
    setErrors(next);
    if (Object.keys(next).length) return;
    const permissions = form.permissions.filter((p) => allowedToggles.includes(p));
    const profile = { name: form.name.trim(), role: form.role, title: form.title.trim() || ROLE_TITLES[form.role], company: form.role === "client" ? form.company.trim() : "", permissions };
    if (existing) {
      const ok = dispatch({ type: "UPDATE_USER", id: existing.id, patch: profile }) && dispatch({ type: "SET_USER_BRANDS", userId: existing.id, brandIds: form.role === "admin" ? [] : form.brandIds });
      if (ok) { notify(`“${profile.name}” güncellendi.`); onClose(); }
    } else if (userApi) {
      // Canlı: hesap sunucuda e-posta + şifreyle, e-posta onaylı oluşturulur (davet / onay e-postası YOK); rol / izin / marka
      // orada kaydedilir. Sonuç gelmeden "oluşturuldu" denmez; hata olursa form açık kalır ve neden gösterilir.
      setSending(true); setSendError("");
      try {
        await userApi.create({ ...profile, email: form.email.trim().toLowerCase() }, form.role === "admin" ? [] : form.brandIds, form.password);
        notify(`“${profile.name}” oluşturuldu. ${form.email.trim().toLowerCase()} ve belirlediğiniz şifreyle hemen giriş yapabilir.`);
        onClose();
      } catch (err) {
        setSendError(err?.message || "Kullanıcı oluşturulamadı.");
        setSending(false);
      }
    } else {
      const user = { id: uid(), email: form.email.trim().toLowerCase(), active: true, color: BRAND_COLOR_KEYS.filter((c) => AVATAR_TONES[c])[state.allUsers.length % 6] || "slate", createdAt: new Date().toISOString(), lastActiveAt: null, ...profile };
      if (dispatch({ type: "ADD_USER", user, brandIds: form.role === "admin" ? [] : form.brandIds })) {
        notify(`“${user.name}” oluşturuldu.`);
        onClose();
      }
    }
  };
  return (
    <Modal title={existing ? "Kullanıcıyı Düzenle" : "Kullanıcı Ekle"} subtitle={existing ? existing.email : "Kullanıcı rolüne göre yalnızca yetkili olduğu ekranları ve markaları görür."} onClose={onClose} width={640}
      footer={<><Btn variant="secondary" onClick={onClose} disabled={sending}>İptal</Btn><Btn variant="primary" type="submit" form="cw-user-form" disabled={sending}>{existing ? <><Check size={14} />Kaydet</> : sending ? "Oluşturuluyor…" : <><UserPlus size={14} />Kullanıcı Oluştur</>}</Btn></>}>
      {sendError && <p role="alert" data-user-error="" className="mb-3 cw-12 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sendError}</p>}
      {withPassword && !sendError && <p className="mb-3 cw-12 text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">E-posta gönderilmez. Kişi bu e-posta ve belirlediğiniz şifreyle hemen giriş yapar ve yalnızca bu rolün yetkilerini görür. Şifreyi kendisine güvenli bir kanaldan iletin; isterse giriş yaptıktan sonra “Şifremi Değiştir” ile değiştirebilir.</p>}
      <form id="cw-user-form" onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Ad Soyad" error={errors.name}><input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Örn. Ayşe Demir" className={inputCls(errors.name)} /></Field>
        <Field label="E-posta" error={errors.email}><input type="email" autoComplete="off" value={form.email} disabled={!!existing} onChange={(e) => set("email", e.target.value)} placeholder="ad@sirket.com" className={`${inputCls(errors.email)} disabled:bg-slate-50 disabled:text-slate-500`} /></Field>
        {withPassword && <PasswordFields value={form} errors={errors} onChange={(patch) => { setForm((f) => ({ ...f, ...patch })); setErrors((e) => ({ ...e, password: "", repeat: "" })); }} />}
        <div className="sm:col-span-2">
          <p className="cw-12 font-semibold text-slate-700 mb-1.5">Rol</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Rol">
            {ROLES.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={form.role === r} onClick={() => setRole(r)}
                className={`text-left rounded-lg border px-3 py-2 transition ${form.role === r ? "border-orange-300 bg-orange-50 ring-2 ring-orange-100" : "border-slate-200 hover:bg-slate-50"}`}>
                <span className="block cw-13 font-semibold text-slate-900">{ROLE_LABELS[r]}</span>
                <span className="block cw-11 text-slate-500">{{ admin: "Tüm ajans yönetimi", employee: "Atanan işler ve içerik üretimi", client: "Marka portalı ve onaylar" }[r]}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label="Unvan (isteğe bağlı)"><input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={ROLE_TITLES[form.role]} className={inputCls()} /></Field>
        {form.role === "client" ? (
          <Field label="Şirket"><input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Örn. Tepe Emlak A.Ş." className={inputCls()} /></Field>
        ) : <div className="hidden sm:block" />}
        {form.role !== "admin" ? (
          <div className="sm:col-span-2">
            <p className="cw-12 font-semibold text-slate-700 mb-1.5">Bağlı Marka{form.role === "employee" ? " / Markalar" : "lar"} {form.role === "client" && <span className="text-red-600">*</span>}</p>
            <BrandChecklist value={form.brandIds} onChange={(v) => set("brandIds", v)} error={errors.brandIds} />
            {errors.brandIds ? <p className="cw-11 text-red-600 mt-1">{errors.brandIds}</p> : <p className="cw-11 text-slate-400 mt-1">{form.role === "client" ? "Müşteri yalnızca seçilen markaların içeriklerini görür." : "Çalışan, seçilen markalarda kendisine atanan işleri görür."}</p>}
          </div>
        ) : <p className="sm:col-span-2 cw-12 text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">Admin kullanıcılar tüm markalara erişir.</p>}
        <div className="sm:col-span-2">
          <p className="cw-12 font-semibold text-slate-700 mb-1.5">İzinler</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
              const enabled = allowedToggles.includes(key);
              return (
                <label key={key} className={`flex items-center gap-2 h-9 px-2.5 rounded-lg border ${enabled ? "border-slate-200 cursor-pointer hover:bg-slate-50" : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"}`} title={enabled ? "" : `${ROLE_LABELS[form.role]} rolü için kullanılamaz`}>
                  <input type="checkbox" disabled={!enabled} checked={enabled && form.permissions.includes(key)} onChange={(e) => set("permissions", e.target.checked ? [...form.permissions, key] : form.permissions.filter((p) => p !== key))} className="h-4 w-4 accent-orange-600" />
                  <span className="cw-12">{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
}

function AssignModal({ title, subtitle, items, initial, onSave, onClose, emptyText }) {
  const [selected, setSelected] = useState(initial);
  const [q, setQ] = useState("");
  const list = items.filter((i) => norm(`${i.label} ${i.sub || ""}`).includes(norm(q)));
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} width={480}
      footer={<><span className="mr-auto self-center cw-12 text-slate-500">{selected.length} seçili</span><Btn variant="secondary" onClick={onClose}>İptal</Btn><Btn variant="primary" onClick={() => onSave(selected)}><Check size={14} />Kaydet</Btn></>}>
      <label className="flex items-center gap-2 h-9 px-3 mb-2 rounded-lg border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-orange-300">
        <Search size={14} className="text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara…" aria-label="Listede ara" className="flex-1 bg-transparent outline-none cw-13" />
      </label>
      <div className="space-y-0.5">
        {list.map((i) => (
          <label key={i.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={selected.includes(i.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id)))} className="h-4 w-4 accent-orange-600" />
            {i.visual}
            <span className="min-w-0"><span className="block cw-13 font-medium text-slate-900 truncate">{i.label}</span>{i.sub && <span className="block cw-11 text-slate-400 truncate">{i.sub}</span>}</span>
          </label>
        ))}
        {!list.length && <p className="cw-12 text-slate-400 px-2 py-4">{emptyText || "Sonuç bulunamadı."}</p>}
      </div>
    </Modal>
  );
}

function BrandEditModal({ brand, onClose }) {
  const { state, dispatch, notify } = useWS();
  const [form, setForm] = useState({ name: brand.name, sector: brand.sector || "", color: brand.color, driveUrl: brand.driveFolderId ? DRIVE.folder(brand.driveFolderId) : "", status: brand.status || "active" });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Marka adı zorunludur.";
    else if (state.allBrands.some((b) => b.id !== brand.id && norm(b.name) === norm(form.name))) next.name = "Bu isimde bir marka zaten var.";
    const folderId = form.driveUrl.trim() ? parseDriveFolderId(form.driveUrl) : null;
    if (form.driveUrl.trim() && (!DRIVE.isValid(form.driveUrl) || !folderId)) next.driveUrl = "Geçerli bir Google Drive klasör bağlantısı girin.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const initials = makeBrand(form.name, "", form.color).initials;
    if (dispatch({ type: "UPDATE_BRAND", id: brand.id, patch: { name: form.name.trim(), initials, sector: form.sector.trim() || "Yeni Müşteri", color: form.color, driveFolderId: folderId, status: form.status } })) {
      notify(`“${form.name.trim()}” güncellendi.`);
      onClose();
    }
  };
  return (
    <Modal title="Markayı Düzenle" subtitle={brand.name} onClose={onClose} width={480}
      footer={<><Btn variant="secondary" onClick={onClose}>İptal</Btn><Btn variant="primary" type="submit" form="cw-brand-edit"><Check size={14} />Kaydet</Btn></>}>
      <form id="cw-brand-edit" onSubmit={submit} noValidate className="space-y-3.5">
        <Field label="Marka Adı" error={errors.name}><input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls(errors.name)} /></Field>
        <Field label="Sektör"><input value={form.sector} onChange={(e) => set("sector", e.target.value)} className={inputCls()} /></Field>
        <Field label="Drive Klasörü (isteğe bağlı)" error={errors.driveUrl}><input value={form.driveUrl} onChange={(e) => set("driveUrl", e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className={inputCls(errors.driveUrl)} /></Field>
        <Field label="Durum"><select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls()}><option value="active">Aktif</option><option value="paused">Pasif</option></select></Field>
        <div>
          <p className="cw-12 font-semibold text-slate-700 mb-1.5">Renk</p>
          <div className="flex flex-wrap gap-2">
            {BRAND_COLOR_KEYS.map((c) => <button key={c} type="button" onClick={() => set("color", c)} aria-pressed={form.color === c} aria-label={BRAND_COLOR_NAMES[c]} title={BRAND_COLOR_NAMES[c]} className={`h-8 w-8 rounded-lg ${BRAND_COLORS[c].bar} ${form.color === c ? "ring-2 ring-offset-2 ring-slate-900" : ""}`} />)}
          </div>
        </div>
      </form>
      <BrandPortalLink brandId={brand.id} />
    </Modal>
  );
}

function UserProfileModal({ userId, onClose, onEdit, onAssign }) {
  const { state, openTask } = useWS();
  const u = state.allUsers.find((x) => x.id === userId);
  if (!u) return null;
  const brandIds = state.allMemberships.filter((m) => m.userId === u.id).map((m) => m.brandId);
  const tasks = u.role === "client"
    ? state.allTasks.filter((t) => brandIds.includes(t.brandId) && t.status === "Müşteri Onayı")
    : state.allTasks.filter((t) => t.assigneeId === u.id && isOpen(t));
  return (
    <Modal title={u.name} subtitle={`${userTitle(u)} · ${ROLE_LABELS[u.role]}`} onClose={onClose} width={560}
      footer={<><Btn variant="secondary" onClick={onAssign}><Layers size={14} />Marka Ata</Btn><Btn variant="primary" onClick={onEdit}><Pencil size={14} />Düzenle</Btn></>}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar userId={u.id} size={48} />
        <div className="min-w-0 cw-12 text-slate-600 space-y-0.5">
          <p className="flex items-center gap-2"><RoleBadge role={u.role} /><StatusDot active={u.active !== false} /></p>
          <p className="truncate">{u.email || "E-posta yok"}</p>
          {u.company && <p className="truncate">{u.company}</p>}
        </div>
      </div>
      <SectionTitle icon={Layers}>Bağlı Markalar</SectionTitle>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {brandIds.length ? brandIds.map((id) => state.allBrands.find((b) => b.id === id)).filter(Boolean).map((b) => (
          <span key={b.id} className="inline-flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-lg border border-slate-200 cw-12 text-slate-700"><BrandLogo brand={b} size={20} />{b.name}</span>
        )) : <span className="cw-12 text-slate-400">{u.role === "admin" ? "Tüm markalar" : "Henüz marka atanmamış."}</span>}
      </div>
      <SectionTitle icon={u.role === "client" ? Clock : ClipboardList}>{u.role === "client" ? "Onay Bekleyen İçerikler" : "Aktif Görevler"} ({tasks.length})</SectionTitle>
      {tasks.length ? (
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto cw-scroll">
          {tasks.map((t) => (
            <button key={t.id} type="button" onClick={() => { onClose(); openTask(t.id); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50">
              <BrandLogo brand={state.allBrands.find((b) => b.id === t.brandId)} size={22} />
              <span className="flex-1 min-w-0 cw-12 font-medium text-slate-800 truncate">{t.title}</span>
              <StatusPill status={t.status} small /><span className="cw-11 text-slate-400 w-14 text-right">{relDay(t.dueDate)}</span>
            </button>
          ))}
        </div>
      ) : <p className="cw-12 text-slate-400">Kayıt yok.</p>}
    </Modal>
  );
}

/* Ekip & Marka Yönetimi ile Kullanıcılar & Yetkiler ekranlarının ortak modal yönetimi. */
function useManagementModals() {
  const { state, dispatch, notify } = useWS();
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);
  const userItems = (role) => state.allUsers.filter((u) => u.role === role && u.active !== false).map((u) => ({ id: u.id, label: u.name, sub: u.role === "client" ? u.company || u.email : userTitle(u), visual: <Avatar userId={u.id} size={26} /> }));
  const brandItems = state.allBrands.map((b) => ({ id: b.id, label: b.name, sub: b.sector, visual: <BrandLogo brand={b} size={26} /> }));
  const membersOf = (brandId, role) => state.allMemberships.filter((m) => m.brandId === brandId && USER_BY_ID[m.userId]?.role === role).map((m) => m.userId);
  let node = null;
  if (modal?.kind === "user") node = <UserModal userId={modal.userId} presetRole={modal.role} onClose={close} />;
  if (modal?.kind === "profile") node = <UserProfileModal userId={modal.userId} onClose={close} onEdit={() => setModal({ kind: "user", userId: modal.userId })} onAssign={() => setModal({ kind: "user-brands", userId: modal.userId })} />;
  if (modal?.kind === "brand-edit") { const b = state.allBrands.find((x) => x.id === modal.brandId); if (b) node = <BrandEditModal brand={b} onClose={close} />; }
  if (modal?.kind === "brand-team" || modal?.kind === "brand-clients") {
    const role = modal.kind === "brand-team" ? "employee" : "client";
    const b = state.allBrands.find((x) => x.id === modal.brandId);
    if (b) node = (
      <AssignModal title={role === "employee" ? "Ekip Ata" : "Müşteri Ata"} subtitle={b.name} items={userItems(role)} initial={membersOf(b.id, role)} onClose={close}
        emptyText={role === "client" ? "Henüz müşteri kullanıcısı yok. Önce “Yeni Müşteri” ile ekleyin." : "Aktif çalışan bulunamadı."}
        onSave={(ids) => { if (dispatch({ type: "SET_BRAND_MEMBERS", brandId: b.id, role, userIds: ids })) { notify(`${b.name} için ${role === "employee" ? "ekip" : "müşteri"} ataması güncellendi.`); close(); } }} />
    );
  }
  if (modal?.kind === "user-brands") {
    const u = state.allUsers.find((x) => x.id === modal.userId);
    if (u) node = (
      <AssignModal title="Marka Ata" subtitle={u.name} items={brandItems} initial={state.allMemberships.filter((m) => m.userId === u.id).map((m) => m.brandId)} onClose={close}
        onSave={(ids) => {
          if (u.role === "client" && !ids.length) { notify("Müşteri için en az bir marka seçilmelidir.", "error"); return; }
          if (dispatch({ type: "SET_USER_BRANDS", userId: u.id, brandIds: ids })) { notify(`${u.name} için marka ataması güncellendi.`); close(); }
        }} />
    );
  }
  return { open: setModal, node };
}

/* ───────────────────────── Admin: Ekip & Marka Yönetimi ───────────────────────── */

function TeamPage({ search, onViewBrand, onViewKit, onViewTasks, onViewPortal, onNewBrand }) {
  const { state } = useWS();
  const [tab, setTab] = useState("brands");
  const { open, node } = useManagementModals();
  const q = norm(search);
  const employees = state.allUsers.filter((u) => u.role === "employee");
  const clients = state.allUsers.filter((u) => u.role === "client");
  const brandIdsOf = (userId) => state.allMemberships.filter((m) => m.userId === userId).map((m) => m.brandId);
  const membersOf = (brandId, role) => state.allMemberships.filter((m) => m.brandId === brandId && USER_BY_ID[m.userId]?.role === role).map((m) => m.userId);
  const activeTasksOf = (userId) => state.allTasks.filter((t) => t.assigneeId === userId && isOpen(t)).length;
  const brands = state.allBrands.filter((b) => matchesSearch(q, b.name, b.sector, ...membersOf(b.id, "client").map((id) => USER_BY_ID[id]?.name)));
  const team = employees.filter((u) => matchesSearch(q, u.name, u.title, u.email));
  const clientList = clients.filter((u) => matchesSearch(q, u.name, u.company, u.email));
  const th = "text-left px-3 h-9 cw-10 font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200 whitespace-nowrap";
  const td = "px-3 py-2.5 align-middle";
  return (
    <div className="space-y-4">
      <PageHeader title="Ekip & Marka Yönetimi" description="Markaları, müşterileri ve ekip üyelerini tek merkezden yönetin."
        actions={<>
          <Btn variant="secondary" onClick={onNewBrand}><Plus size={14} />Yeni Marka</Btn>
          <Btn variant="secondary" onClick={() => open({ kind: "user", role: "employee" })}><UserPlus size={14} />Yeni Çalışan</Btn>
          <Btn variant="primary" onClick={() => open({ kind: "user", role: "client" })}><Briefcase size={14} />Yeni Müşteri</Btn>
        </>} />
      <Segmented ariaLabel="Yönetim sekmeleri" value={tab} onChange={setTab} items={[["brands", "Markalar", brands.length], ["team", "Ekip", team.length], ["clients", "Müşteriler", clientList.length]]} />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto cw-scroll">
          {tab === "brands" && (
            <table className="w-full border-collapse" style={{ minWidth: 920 }}>
              <thead><tr>{["Marka", "Müşteri", "Ekip", "Aktif Görev", "Onay Bekleyen", "Durum", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {brands.map((b) => {
                  const bt = state.allTasks.filter((t) => t.brandId === b.id);
                  const cl = membersOf(b.id, "client");
                  return (
                    <tr key={b.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className={td}><span className="flex items-center gap-2.5 min-w-0"><BrandLogo brand={b} size={32} /><span className="min-w-0"><span className="block cw-13 font-semibold text-slate-900 truncate">{b.name}</span><span className="block cw-11 text-slate-400 truncate">{b.sector}</span></span></span></td>
                      <td className={`${td} cw-12 text-slate-700`}>{cl.length ? cl.map((id) => USER_BY_ID[id]?.name).join(", ") : <span className="text-slate-400">Atanmamış</span>}</td>
                      <td className={td}><AvatarStack userIds={membersOf(b.id, "employee")} /></td>
                      <td className={`${td} cw-13 font-semibold tabular-nums text-slate-800`}>{bt.filter(isOpen).length}</td>
                      <td className={td}><span className={`cw-13 font-semibold tabular-nums ${bt.some((t) => t.status === "Müşteri Onayı") ? "text-amber-600" : "text-slate-400"}`}>{bt.filter((t) => t.status === "Müşteri Onayı" || t.status === "Yönetici Onayı").length}</span></td>
                      <td className={td}><StatusDot active={(b.status || "active") === "active"} /></td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <IconAction icon={Eye} label="Markayı Görüntüle" onClick={() => onViewBrand(b.id)} />
                        <IconAction icon={BookOpen} label="Marka Kılavuzu" onClick={() => onViewKit(b.id)} />
                        <IconAction icon={Pencil} label="Düzenle" onClick={() => open({ kind: "brand-edit", brandId: b.id })} />
                        <IconAction icon={Users} label="Ekip Ata" tone="orange" onClick={() => open({ kind: "brand-team", brandId: b.id })} />
                        <IconAction icon={Briefcase} label="Müşteri Ata" tone="orange" onClick={() => open({ kind: "brand-clients", brandId: b.id })} />
                      </td>
                    </tr>
                  );
                })}
                {!brands.length && <tr><td colSpan={7} className="px-4 py-10 text-center cw-13 text-slate-500">Eşleşen marka yok.</td></tr>}
              </tbody>
            </table>
          )}
          {tab === "team" && (
            <table className="w-full border-collapse" style={{ minWidth: 900 }}>
              <thead><tr>{["Çalışan", "Markalar", "Aktif Görev", "İş Yükü", "Durum", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {team.map((u) => {
                  const n = activeTasksOf(u.id);
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className={td}><span className="flex items-center gap-2.5 min-w-0"><Avatar userId={u.id} size={32} /><span className="min-w-0"><span className="block cw-13 font-semibold text-slate-900 truncate">{u.name}</span><span className="block cw-11 text-slate-400 truncate">{userTitle(u)}</span></span></span></td>
                      <td className={td}><BrandStack brandIds={brandIdsOf(u.id)} /></td>
                      <td className={`${td} cw-13 font-semibold tabular-nums text-slate-800`}>{n}</td>
                      <td className={td}><WorkloadBar count={n} /></td>
                      <td className={td}><StatusDot active={u.active !== false} /></td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <IconAction icon={User} label="Profili Gör" onClick={() => open({ kind: "profile", userId: u.id })} />
                        <IconAction icon={Layers} label="Marka Ata" tone="orange" onClick={() => open({ kind: "user-brands", userId: u.id })} />
                        <IconAction icon={ClipboardList} label="Görevleri Gör" onClick={() => onViewTasks(u.id)} />
                        <IconAction icon={ShieldCheck} label="Yetki Düzenle" onClick={() => open({ kind: "user", userId: u.id })} />
                      </td>
                    </tr>
                  );
                })}
                {!team.length && <tr><td colSpan={6} className="px-4 py-10 text-center cw-13 text-slate-500">Eşleşen çalışan yok.</td></tr>}
              </tbody>
            </table>
          )}
          {tab === "clients" && (
            <table className="w-full border-collapse" style={{ minWidth: 940 }}>
              <thead><tr>{["Müşteri", "Şirket", "Markalar", "Onay Bekleyen", "E-posta", "Hesap", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {clientList.map((u) => {
                  const ids = brandIdsOf(u.id);
                  const pending = state.allTasks.filter((t) => ids.includes(t.brandId) && t.status === "Müşteri Onayı").length;
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className={td}><span className="flex items-center gap-2.5 min-w-0"><Avatar userId={u.id} size={32} /><span className="block cw-13 font-semibold text-slate-900 truncate">{u.name}</span></span></td>
                      <td className={`${td} cw-12 text-slate-700`}>{u.company || "—"}</td>
                      <td className={td}><BrandStack brandIds={ids} /></td>
                      <td className={`${td} cw-13 font-semibold tabular-nums ${pending ? "text-amber-600" : "text-slate-400"}`}>{pending}</td>
                      <td className={`${td} cw-12 text-slate-600`}>{u.email}</td>
                      <td className={td}><StatusDot active={u.active !== false} /></td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <IconAction icon={User} label="Profili Gör" onClick={() => open({ kind: "profile", userId: u.id })} />
                        <IconAction icon={Layers} label="Marka Ata" tone="orange" onClick={() => open({ kind: "user-brands", userId: u.id })} />
                        <IconAction icon={ExternalLink} label="Portalı Görüntüle" disabled={u.active === false || !ids.length} onClick={() => onViewPortal(u.id)} />
                      </td>
                    </tr>
                  );
                })}
                {!clientList.length && <tr><td colSpan={7} className="px-4 py-10 text-center cw-13 text-slate-500">Eşleşen müşteri yok.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {node}
    </div>
  );
}

/* ───────────────────────── Admin: Sözleşme metni ve onay durumu ───────────────────────── */

const cloneAgreement = (d) => ({ title: d.title, consent: d.consent, sections: d.sections.map((s) => ({ heading: s.heading, body: s.body })) });
const sameAgreement = (a, b) => JSON.stringify(normalizeAgreement(a)) === JSON.stringify(normalizeAgreement(b));

function AgreementAdminPage({ text, api, search }) {
  const { state, notify } = useWS();
  const saved = text || DEFAULT_AGREEMENT;
  const [draft, setDraft] = useState(() => cloneAgreement(saved));
  const [errors, setErrors] = useState({});
  const [reaccept, setReaccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  // Sunucudaki metin değişirse (kayıt / başka yönetici) düzenlenmemiş taslak güncellenir; yarım kalan düzenleme ezilmez.
  const prevSaved = useRef(saved);
  useEffect(() => {
    setDraft((d) => (sameAgreement(d, prevSaved.current) ? cloneAgreement(saved) : d));
    prevSaved.current = saved;
  }, [saved.version, saved.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !sameAgreement(draft, saved);
  const blanks = placeholdersIn(draft);
  const author = text?.updatedBy ? state.allUsers.find((u) => u.id === text.updatedBy) : null;
  const previewDoc = normalizeAgreement(draft);

  const clearErr = (k) => setErrors((e) => (e[k] || e.sections ? { ...e, [k]: "", sections: "" } : e));
  const set = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); clearErr(k); };
  const setSection = (i, k, v) => { setDraft((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, [k]: v } : s)) })); clearErr(`s${i}.${k}`); };
  // Sıra değişince bölüm hataları kayıtta yeniden hesaplanır.
  const reorder = (fn) => { setDraft((d) => ({ ...d, sections: fn(d.sections.slice()) })); setErrors({}); };
  const move = (i, dir) => reorder((a) => { const j = i + dir; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const remove = (i) => reorder((a) => { a.splice(i, 1); return a; });
  const add = () => reorder((a) => [...a, { heading: `${a.length + 1}. `, body: "" }]);

  const save = async () => {
    if (!api || saving) return;
    const doc = normalizeAgreement(draft);
    const errs = validateAgreement(doc);
    setErrors(errs);
    if (Object.keys(errs).length) { notify("Kaydedilmedi: işaretli alanları düzeltin.", "error"); return; }
    setSaving(true);
    try {
      await api.save(doc, { reaccept });
      notify(reaccept ? "Sözleşme kaydedildi. Diğer tüm kullanıcılar bir sonraki girişte yeniden onaylayacak." : "Sözleşme kaydedildi.");
      setReaccept(false);
    } catch (err) { notify(err?.message || "Sözleşme kaydedilemedi.", "error"); }
    finally { setSaving(false); }
  };

  const q = norm(search);
  const people = state.allUsers
    .filter((u) => u.active !== false && matchesSearch(q, u.name, u.email, ROLE_LABELS[u.role]))
    .sort((a, b) => (a.agreementAccepted === b.agreementAccepted ? a.name.localeCompare(b.name, "tr") : a.agreementAccepted ? 1 : -1));
  const known = people.filter((u) => typeof u.agreementAccepted === "boolean");
  const acceptedCount = known.filter((u) => u.agreementAccepted).length;
  const taCls = (err) => `w-full rounded-lg border px-3 py-2 cw-13 outline-none bg-white focus:ring-2 resize-y ${err ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"}`;
  const saveBtn = <Btn variant="primary" onClick={save} disabled={!api || saving || (!dirty && !reaccept)}>{saving ? "Kaydediliyor…" : <><Check size={14} />Kaydet</>}</Btn>;

  return (
    <div className="space-y-4" data-agreement-admin="">
      <PageHeader title="Gizlilik ve Rekabet Sözleşmesi" description="Kullanıcıların panele ilk girişte onayladığı metin. Köşeli parantezli alanları doldurup kaydedin."
        actions={<><Btn variant="secondary" onClick={() => setPreview(true)}><Eye size={14} />Önizle</Btn>{saveBtn}</>} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 cw-12 text-slate-500" data-agreement-status="">
        {text
          ? <span>Yayındaki sürüm: <strong className="text-slate-700">{text.version}</strong>{text.updatedAt && <> · {fmtDateTime(text.updatedAt)}</>}{author && <> · {author.name}</>}</span>
          : <span className="text-amber-700">Henüz kaydedilmiş metin yok — kullanıcılar aşağıdaki hazır taslağı görüyor.</span>}
        {dirty && <span className="text-orange-600 font-semibold" data-agreement-dirty="">Kaydedilmemiş değişiklikler var</span>}
      </div>
      {!api && <p role="alert" className="cw-12 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Bu ortamda sözleşme metni kaydedilemiyor.</p>}

      {blanks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3" data-agreement-blanks="">
          <p className="cw-13 font-semibold text-amber-900 flex items-center gap-2"><AlertTriangle size={15} />Doldurulması gereken {blanks.length} alan</p>
          <p className="cw-12 text-amber-800 mt-0.5">Köşeli parantezli ifadeleri gerçek bilgilerle değiştirin (parantezleri de silin). Doldurulmayanlar kullanıcıya sarı vurgulu görünür.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{blanks.map((b) => <span key={b} className="cw-11 font-medium bg-white border border-amber-200 text-amber-900 rounded-md px-1.5 py-0.5">{b}</span>)}</div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <Field label="Başlık" error={errors.title}>
          <input value={draft.title} maxLength={AGREEMENT_LIMITS.title} onChange={(e) => set("title", e.target.value)} className={inputCls(errors.title)} aria-label="Sözleşme başlığı" />
        </Field>
        <div className="space-y-3" data-agreement-sections="">
          {draft.sections.map((s, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2" data-agreement-section={i}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <input value={s.heading} maxLength={AGREEMENT_LIMITS.heading} onChange={(e) => setSection(i, "heading", e.target.value)} placeholder="Bölüm başlığı"
                    aria-label={`Bölüm ${i + 1} başlığı`} className={`${inputCls(errors[`s${i}.heading`])} font-semibold`} />
                  {errors[`s${i}.heading`] && <span className="cw-11 text-red-600">{errors[`s${i}.heading`]}</span>}
                </div>
                <div className="flex shrink-0">
                  <IconAction icon={ArrowUp} label="Yukarı taşı" disabled={i === 0} onClick={() => move(i, -1)} />
                  <IconAction icon={ArrowDown} label="Aşağı taşı" disabled={i === draft.sections.length - 1} onClick={() => move(i, 1)} />
                  <IconAction icon={Trash2} label="Bölümü sil" tone="danger" disabled={draft.sections.length === 1} onClick={() => remove(i)} />
                </div>
              </div>
              <textarea value={s.body} maxLength={AGREEMENT_LIMITS.body} rows={Math.min(10, Math.max(3, s.body.split("\n").length + 1))} onChange={(e) => setSection(i, "body", e.target.value)}
                placeholder="Bölüm metni (madde işareti için satır başına • koyabilirsiniz)" aria-label={`Bölüm ${i + 1} metni`} className={taCls(errors[`s${i}.body`])} />
              {errors[`s${i}.body`] && <span className="cw-11 text-red-600">{errors[`s${i}.body`]}</span>}
            </div>
          ))}
          {errors.sections && <p className="cw-12 text-red-600">{errors.sections}</p>}
          <Btn variant="secondary" onClick={add} disabled={draft.sections.length >= AGREEMENT_LIMITS.sections}><Plus size={14} />Bölüm Ekle</Btn>
        </div>
        <Field label="Onay cümlesi (kullanıcının işaretlediği kutu)" error={errors.consent}>
          <input value={draft.consent} maxLength={AGREEMENT_LIMITS.consent} onChange={(e) => set("consent", e.target.value)} className={inputCls(errors.consent)} aria-label="Onay cümlesi" />
        </Field>
        <label className="flex items-start gap-2.5 cw-13 text-slate-800 cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
          <input type="checkbox" checked={reaccept} onChange={(e) => setReaccept(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600" data-agreement-reaccept="" />
          <span><strong>Herkes yeniden onaylasın.</strong> <span className="text-slate-500">Esaslı bir değişiklik yaptıysanız işaretleyin: sizin dışınızdaki tüm kullanıcılardan bir sonraki girişte yeni metni onaylamaları istenir. Yazım düzeltmelerinde işaretlemeyin.</span></span>
        </label>
        <div className="flex justify-end">{saveBtn}</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" data-agreement-people="">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <p className="cw-13 font-semibold text-slate-900">Onay Durumu</p>
          <p className="cw-12 text-slate-500">{known.length ? `${acceptedCount} / ${known.length} aktif kullanıcı onayladı` : "Onay bilgisi yok"}</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {people.map((u) => (
            <li key={u.id} className="px-4 py-2.5 flex items-center gap-2.5" data-agreement-person={u.agreementAccepted === true ? "accepted" : u.agreementAccepted === false ? "pending" : "unknown"}>
              <Avatar userId={u.id} size={28} />
              <div className="flex-1 min-w-0"><p className="cw-13 font-medium text-slate-900 truncate">{u.name}</p><p className="cw-11 text-slate-400 truncate">{u.email || ROLE_LABELS[u.role]}</p></div>
              <span className="hidden sm:block"><RoleBadge role={u.role} /></span>
              {u.agreementAccepted === true
                ? <span className="cw-12 text-emerald-700 text-right">Onayladı{u.agreementAcceptedAt && <span className="block cw-11 text-slate-400">{fmtDateTime(u.agreementAcceptedAt)}</span>}</span>
                : u.agreementAccepted === false
                  ? <span className="cw-12 font-semibold text-amber-700">Bekliyor</span>
                  : <span className="cw-12 text-slate-400">—</span>}
            </li>
          ))}
          {!people.length && <li className="px-4 py-8 text-center cw-13 text-slate-500">Eşleşen kullanıcı yok.</li>}
        </ul>
      </div>

      {preview && (
        <Modal title={previewDoc.title || "Sözleşme"} subtitle="Önizleme — kullanıcının göreceği metin" onClose={() => setPreview(false)} width={720}
          footer={<Btn variant="secondary" onClick={() => setPreview(false)}>Kapat</Btn>}>
          <div className="space-y-3.5 cw-13 text-slate-700" data-agreement-preview="">
            <AgreementBody doc={{ ...previewDoc, version: dirty ? "kaydedilmemiş taslak" : saved.version }} />
            <p className="flex items-start gap-2 cw-13 text-slate-800 border-t border-slate-100 pt-3"><span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-slate-300" />{previewDoc.consent}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────────────────── Admin: Kullanıcılar & Yetkiler ───────────────────────── */

function UsersPage({ search }) {
  const { state, dispatch, notify, actor, userApi } = useWS();
  const [role, setRole] = useState("all");
  // Şifresini unutan kullanıcıya yönetici yeni şifre verir (e-posta gönderilmez).
  const [passwordUser, setPasswordUser] = useState(null);
  const { open, node } = useManagementModals();
  const q = norm(search);
  const lastActivity = useMemo(() => {
    const m = {};
    const bump = (id, at) => { if (id && at && (!m[id] || at > m[id])) m[id] = at; };
    state.allUsers.forEach((u) => bump(u.id, u.lastActiveAt));
    state.allActivity.forEach((a) => bump(a.userId, a.createdAt));
    state.allApprovals.forEach((a) => bump(a.userId, a.createdAt));
    return m;
  }, [state.allUsers, state.allActivity, state.allApprovals]);
  const brandIdsOf = (userId) => state.allMemberships.filter((m) => m.userId === userId).map((m) => m.brandId);
  const list = state.allUsers
    .filter((u) => (role === "all" || u.role === role) && matchesSearch(q, u.name, u.email, u.company, ROLE_LABELS[u.role]))
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name, "tr"));
  const toggleActive = (u) => {
    const active = u.active === false;
    if (dispatch({ type: "UPDATE_USER", id: u.id, patch: { active } })) notify(active ? `${u.name} yeniden aktifleştirildi.` : `${u.name} pasifleştirildi; artık giriş yapamaz.`, active ? "success" : "info");
  };
  const brandsCell = (u) => (u.role === "admin" ? <span className="cw-12 text-slate-500">Tüm markalar</span> : <BrandStack brandIds={brandIdsOf(u.id)} />);
  const actions = (u) => (
    <>
      {userApi?.setPassword && <IconAction icon={KeyRound} label="Şifre Belirle" disabled={u.id === actor.id} onClick={() => setPasswordUser(u)} />}
      <IconAction icon={Pencil} label="Düzenle" onClick={() => open({ kind: "user", userId: u.id })} />
      <IconAction icon={Layers} label="Marka Ata" tone="orange" disabled={u.role === "admin"} onClick={() => open({ kind: "user-brands", userId: u.id })} />
      <IconAction icon={u.active === false ? RotateCcw : X} label={u.active === false ? "Aktifleştir" : "Pasifleştir"} tone={u.active === false ? "default" : "danger"} disabled={u.id === actor.id} onClick={() => toggleActive(u)} />
    </>
  );
  return (
    <div className="space-y-4">
      <PageHeader title="Kullanıcılar & Yetkiler" description="Ajans ekibinin ve müşterilerin erişimlerini yönetin." actions={<Btn variant="primary" onClick={() => open({ kind: "user" })}><Plus size={15} />Kullanıcı Ekle</Btn>} />
      <Segmented ariaLabel="Rol filtresi" value={role} onChange={setRole} items={[["all", "Tümü", state.allUsers.length], ...ROLES.map((r) => [r, ROLE_LABELS[r], state.allUsers.filter((u) => u.role === r).length])]} />
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto cw-scroll">
          <table className="w-full border-collapse" style={{ minWidth: 900 }}>
            <thead><tr>{["Kullanıcı", "E-posta", "Rol", "Bağlı Marka", "Durum", "Son Aktivite", "İşlemler"].map((h) => <th key={h} className="text-left px-3 h-9 cw-10 font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5"><span className="flex items-center gap-2.5 min-w-0"><Avatar userId={u.id} size={30} /><span className="min-w-0"><span className="block cw-13 font-semibold text-slate-900 truncate">{u.name}{u.id === actor.id && <span className="ml-1.5 cw-10 font-semibold text-slate-400">(siz)</span>}</span><span className="block cw-11 text-slate-400 truncate">{u.role === "client" ? u.company || userTitle(u) : userTitle(u)}</span></span></span></td>
                  <td className="px-3 py-2.5 cw-12 text-slate-600">{u.email || "—"}</td>
                  <td className="px-3 py-2.5"><RoleBadge role={u.role} /></td>
                  <td className="px-3 py-2.5">{brandsCell(u)}</td>
                  <td className="px-3 py-2.5"><StatusDot active={u.active !== false} /></td>
                  <td className="px-3 py-2.5 cw-12 text-slate-500 whitespace-nowrap">{lastActivity[u.id] ? fmtDateTime(lastActivity[u.id]) : "Henüz yok"}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap">{actions(u)}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} className="px-4 py-10 text-center cw-13 text-slate-500">Eşleşen kullanıcı yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="md:hidden space-y-2">
        {list.map((u) => (
          <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-2.5"><Avatar userId={u.id} size={32} /><div className="flex-1 min-w-0"><p className="cw-13 font-semibold text-slate-900 truncate">{u.name}</p><p className="cw-11 text-slate-500 truncate">{u.email}</p></div><RoleBadge role={u.role} /></div>
            <div className="mt-2 flex items-center justify-between gap-2">{brandsCell(u)}<StatusDot active={u.active !== false} /></div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between"><span className="cw-11 text-slate-400">{lastActivity[u.id] ? fmtDateTime(lastActivity[u.id]) : "Aktivite yok"}</span><span>{actions(u)}</span></div>
          </div>
        ))}
        {!list.length && <p className="cw-13 text-slate-500 text-center py-8">Eşleşen kullanıcı yok.</p>}
      </div>
      {node}
      {passwordUser && userApi?.setPassword && (
        <UserPasswordModal user={passwordUser} api={userApi} onClose={() => setPasswordUser(null)}
          onDone={() => { notify(`${passwordUser.name} için yeni şifre kaydedildi. Bundan sonra bu şifreyle giriş yapar.`); setPasswordUser(null); }} />
      )}
    </div>
  );
}

/* ───────────────────────── Müşteri portalı ───────────────────────── */

function ContentCard({ task }) {
  const { brandsById, openContent, state } = useWS();
  const thumb = useContentThumb(task);
  const brand = brandsById[task.brandId];
  const caption = htmlToText(task.description);
  const rev = task.status === "Revizyon" ? latestRevision(state.approvals, task.id) : null;
  return (
    <button type="button" onClick={() => openContent(task.id)} className="text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-shadow flex flex-col min-w-0">
      <div className="relative bg-slate-100" style={{ aspectRatio: "16 / 10" }}>
        <img src={thumb} alt="" className="w-full h-full object-cover" />
        <span className="absolute top-2 left-2"><ClientStatusBadge status={task.status} /></span>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PlatformChip platform={task.platform} />
          <span className="inline-flex items-center h-5 px-1.5 rounded-md border border-slate-200 text-slate-500 cw-10 font-semibold uppercase tracking-wide">{task.format}</span>
          {brand && <span className="ml-auto inline-flex items-center gap-1 cw-11 text-slate-500"><BrandLogo brand={brand} size={16} />{brand.name}</span>}
        </div>
        <p className="cw-13 font-semibold text-slate-900 cw-clamp2">{task.title}</p>
        <p className="cw-12 text-slate-500 cw-clamp2">{caption || "Metin eklenmemiş."}</p>
        {rev && <p className="cw-11 text-orange-700 cw-clamp2"><strong className="font-semibold">Revize notunuz:</strong> {rev.note}</p>}
        <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between cw-11 text-slate-500">
          <span className="inline-flex items-center gap-1"><Calendar size={11} />Yayın: {fmtDate(task.publishDate)}</span>
          <span>Güncelleme: {relDay((task.updatedAt || task.createdAt || "").slice(0, 10))}</span>
        </div>
      </div>
    </button>
  );
}

function ContentGrid({ tasks, empty }) {
  if (!tasks.length) return <EmptyBlock icon={Inbox} title={empty.title} text={empty.text} />;
  return <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{tasks.map((t) => <ContentCard key={t.id} task={t} />)}</div>;
}

const byPublish = (a, b) => (a.publishDate || "9999").localeCompare(b.publishDate || "9999");

function ClientHome({ search, brandId, onGo, onOpenNotification }) {
  const { state, actor } = useWS();
  const q = norm(search);
  const tasks = state.tasks.filter((t) => (brandId === "all" || t.brandId === brandId) && matchesSearch(q, t.title, t.platform, t.format));
  const pending = tasks.filter((t) => t.status === "Müşteri Onayı").sort(byPublish);
  const kpis = [
    ["Onay Bekleyen", pending.length, "text-amber-600", "pending"],
    ["Revize İstenen", tasks.filter((t) => t.status === "Revizyon").length, "text-orange-600", "content"],
    ["Onaylanan", tasks.filter((t) => t.status === "Onaylandı").length, "text-teal-600", "content"],
    ["Yayınlanan", tasks.filter((t) => t.status === "Tamamlandı").length, "text-emerald-600", "content"],
  ];
  const recent = [...state.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  return (
    <div className="space-y-5">
      <PageHeader title={`Hoş geldiniz, ${actor.name.split(" ")[0]}`} description={`${state.brands.map((b) => b.name).join(", ") || "Markanız"} için içerik ve onay portalı.`} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(([l, v, c, page]) => (
          <button key={l} type="button" onClick={() => onGo(page)} className="text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm">
            <p className="cw-11 font-medium text-slate-500">{l}</p>
            <p className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${c}`}>{v}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <SectionTitle icon={Clock} right={pending.length > 3 ? <button type="button" onClick={() => onGo("pending")} className="cw-11 font-semibold text-orange-700 hover:underline">Tümünü gör</button> : null}>Onayınızı Bekleyenler</SectionTitle>
          <ContentGrid tasks={pending.slice(0, 3)} empty={{ title: "Onay bekleyen içerik yok", text: "Ajansınız yeni içerik gönderdiğinde burada görünecek." }} />
        </section>
        <aside className="bg-white border border-slate-200 rounded-xl p-3 h-fit">
          <SectionTitle icon={Bell} right={<button type="button" onClick={() => onGo("notifications")} className="cw-11 font-semibold text-orange-700 hover:underline">Tümü</button>}>Son Bildirimler</SectionTitle>
          <NotificationList items={recent} onOpen={onOpenNotification} compact />
        </aside>
      </div>
    </div>
  );
}

const CLIENT_FILTERS = [["all", "Tümü"], ["Müşteri Onayı", "Onay Bekliyor"], ["Revizyon", "Revize İstendi"], ["Onaylandı", "Onaylandı"], ["Tamamlandı", "Yayınlandı"]];

function ClientContentPage({ search, brandId, pendingOnly }) {
  const { state } = useWS();
  const [filter, setFilter] = useState("all");
  const q = norm(search);
  const base = state.tasks.filter((t) => (brandId === "all" || t.brandId === brandId) && matchesSearch(q, t.title, t.platform, t.format, htmlToText(t.description)));
  if (pendingOnly) {
    const pending = base.filter((t) => t.status === "Müşteri Onayı").sort(byPublish);
    return (
      <div className="space-y-4">
        <PageHeader title="Onay Bekleyen İçerikler" description="İçerikleri inceleyip onaylayabilir veya revize talep edebilirsiniz." />
        <ContentGrid tasks={pending} empty={{ title: "Onay bekleyen içerik yok", text: "Tüm içerikleri incelediniz. Yeni içerikler geldiğinde bildirim alacaksınız." }} />
      </div>
    );
  }
  const list = (filter === "all" ? base : base.filter((t) => t.status === filter)).sort(byPublish);
  return (
    <div className="space-y-4">
      <PageHeader title="İçeriklerim" description="Ajansınızın sizin için hazırladığı tüm içerikler." />
      <Segmented ariaLabel="İçerik durumu" value={filter} onChange={setFilter} items={CLIENT_FILTERS.map(([k, l]) => [k, l, k === "all" ? base.length : base.filter((t) => t.status === k).length])} />
      <ContentGrid tasks={list} empty={{ title: "Bu filtrede içerik yok", text: search ? "Aramanızla eşleşen içerik bulunamadı." : "Durum filtresini değiştirerek diğer içerikleri görebilirsiniz." }} />
    </div>
  );
}

function RevisionModal({ task, target, onClose, onSubmitted }) {
  const { dispatch, notify } = useWS();
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [errors, setErrors] = useState({});
  const submit = (e) => {
    e.preventDefault();
    const next = {};
    const noteError = validateRevisionNote(note);
    if (noteError) next.note = noteError;
    if (link.trim() && !/^https:\/\/\S+$/i.test(link.trim())) next.link = "Bağlantı https:// ile başlamalıdır.";
    setErrors(next);
    if (Object.keys(next).length) return;
    if (dispatch({ type: "REVIEW_CONTENT", taskId: task.id, decision: "revision", note, link, requestId: target?.request.id, versionId: target?.version?.id })) {
      notify("Revize talebiniz ajansa iletildi.");
      onSubmitted();
    }
  };
  return (
    <Modal title="Revize Talebi Yaz" subtitle={`${task.title}${target?.version ? ` · Sürüm ${target.version.versionNo}` : ""}`} onClose={onClose} width={520}
      footer={<><Btn variant="secondary" onClick={onClose}>İptal</Btn><Btn variant="primary" type="submit" form="cw-revision"><Send size={14} />Revize Talebini Gönder</Btn></>}>
      <form id="cw-revision" onSubmit={submit} noValidate className="space-y-3.5">
        <Field label="Revize Talebiniz" error={errors.note}>
          <textarea autoFocus value={note} onChange={(e) => { setNote(e.target.value); setErrors((x) => ({ ...x, note: "" })); }} rows={5} placeholder="Neyin değişmesini istediğinizi yazın (ör. renkler, metin, görsel)…" className={`w-full rounded-lg border px-3 py-2 cw-13 outline-none resize-y focus:ring-2 ${errors.note ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"}`} />
        </Field>
        <Field label="Ek (isteğe bağlı)" error={errors.link}>
          <input value={link} onChange={(e) => { setLink(e.target.value); setErrors((x) => ({ ...x, link: "" })); }} placeholder="Örnek görsel veya dosya bağlantısı (https://…)" className={inputCls(errors.link)} />
        </Field>
        <p className="cw-11 text-slate-500">Talebiniz içeriği hazırlayan ekip üyesine ve ajans yöneticisine iletilir.</p>
      </form>
    </Modal>
  );
}

function ContentDetailModal({ taskId, onClose }) {
  const { state, brandsById, attachmentsByTask, dispatch, notify, openPreview, can: allowed, contentApi } = useWS();
  const [revising, setRevising] = useState(false);
  const [sel, setSel] = useState(0);
  const task = state.tasks.find((t) => t.id === taskId);
  const thumb = useContentThumb(task || { id: "", brandId: "", format: "", title: "" });
  // Müşterinin gördüğü sürüm: bekleyen isteğin sürümü; yoksa son gönderilen sürüm. Karar her zaman bekleyen isteğe verilir.
  const target = task && contentApi ? reviewTarget(state, task.id) : null;
  const requests = task && contentApi ? requestsOf(state.approvalRequests || EMPTY, task.id) : EMPTY;
  const shown = target?.version || (requests.length ? (state.contentVersions || EMPTY).find((v) => v.id === requests.at(-1).versionId) : null) || null;
  const media = shown ? assetsOf(state.contentAssets || EMPTY, shown.id) : EMPTY;
  const urls = useContentUrls(media);
  if (!task) return null;
  const brand = brandsById[task.brandId];
  const files = attachmentsByTask[task.id] || EMPTY;
  const history = state.approvals.filter((a) => a.taskId === task.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const revInfo = revisionInfo(task, state.approvals);
  const pending = task.status === "Müşteri Onayı" && (!contentApi || !!target);
  const approve = () => {
    if (dispatch({ type: "REVIEW_CONTENT", taskId: task.id, decision: "approved", requestId: target?.request.id, versionId: target?.version?.id })) { notify("İçerik onaylandı. Ajansınız bilgilendirildi."); onClose(); }
  };
  if (revising) return <RevisionModal task={task} target={target} onClose={() => setRevising(false)} onSubmitted={onClose} />;
  const current = media[Math.min(sel, media.length - 1)];
  return (
    <Modal title={task.title} subtitle={`${brand?.name || ""} · ${task.platform} · ${task.format}${shown ? ` · Sürüm ${shown.versionNo}` : ""}`} onClose={onClose} width={900}
      footer={pending && (allowed("canApproveContent") || allowed("canRequestRevision")) ? (
        <>
          <span className="mr-auto self-center cw-12 text-slate-500">Bu içerik onayınızı bekliyor.</span>
          {allowed("canRequestRevision") && <Btn variant="secondary" onClick={() => setRevising(true)}><Pencil size={14} />Revize Talebi Yaz</Btn>}
          {allowed("canApproveContent") && <Btn variant="primary" className="bg-emerald-600 hover:bg-emerald-700" onClick={approve}><Check size={15} />Onayla</Btn>}
        </>
      ) : <><span className="mr-auto self-center cw-12 text-slate-500">{{ "Onaylandı": "Bu içeriği onayladınız; yayın planına alındı.", "Revizyon": "Revize talebiniz ajans tarafından hazırlanıyor.", "Tamamlandı": "Bu içerik yayınlandı." }[task.status] || ""}</span><Btn variant="secondary" onClick={onClose}>Kapat</Btn></>}>
      <div className="grid gap-5 md:grid-cols-5">
        <div className="md:col-span-3 space-y-3">
          {current ? (
            <div className="space-y-2" data-review-media={shown.id}>
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"><ContentMedia asset={current} url={urls[current.id]} large /></div>
              {media.length > 1 && (
                <div className="flex gap-2 overflow-x-auto cw-scroll pb-1" role="tablist" aria-label="Sürüm dosyaları">
                  {media.map((a, i) => (
                    <button key={a.id} type="button" role="tab" aria-selected={i === sel} onClick={() => setSel(i)} aria-label={a.fileName}
                      className={`shrink-0 h-14 w-20 rounded-lg overflow-hidden border-2 ${i === sel ? "border-orange-500" : "border-transparent hover:border-slate-300"}`}>
                      <ContentMedia asset={a} url={urls[a.id]} thumb />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"><img src={thumb} alt={task.title} className="w-full object-cover" style={{ aspectRatio: "16 / 10" }} /></div>}
          <section>
            <SectionTitle icon={FileText}>Metin</SectionTitle>
            {shown?.caption ? <p className="cw-13 text-slate-700 whitespace-pre-wrap break-words" data-review-caption="">{shown.caption}</p> : <HtmlView html={task.description} empty="Bu içerik için metin eklenmemiş." />}
          </section>
        </div>
        <div className="md:col-span-2 space-y-4">
          <dl className="space-y-2">
            {[["Durum", <ClientStatusBadge key="s" status={task.status} />], ["Platform", <PlatformChip key="p" platform={task.platform} />], ["İçerik Türü", task.format], ["Yayın Tarihi", fmtDateLong(task.publishDate)], ["Son Güncelleme", fmtDateTime(task.updatedAt || task.createdAt)]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 cw-12"><dt className="text-slate-500">{k}</dt><dd className="text-slate-900 font-medium text-right">{v}</dd></div>
            ))}
          </dl>
          <section>
            <SectionTitle icon={Paperclip}>İlgili Dosyalar ({files.length})</SectionTitle>
            {files.length ? (
              <div className="space-y-1.5">
                {files.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200">
                    <AttachmentThumb attachment={a} size={32} />
                    <span className="flex-1 min-w-0"><span className="block cw-12 font-medium text-slate-800 truncate">{a.name}</span><span className="block cw-10 text-slate-400">{a.type} · {a.size}</span></span>
                    <IconAction icon={Eye} label={`${a.name} önizle`} onClick={() => openPreview("attachment", a.id)} />
                    <a href={a.driveUrl} target="_blank" rel="noopener noreferrer" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50" aria-label={`${a.name} dosyasını aç`}><ExternalLink size={14} /></a>
                  </div>
                ))}
              </div>
            ) : <p className="cw-12 text-slate-400">Dosya eklenmemiş.</p>}
          </section>
          {requests.length > 0 ? (
            <section data-review-history="">
              <SectionTitle icon={History}>Sürüm ve Onay Geçmişi</SectionTitle>
              <ol className="space-y-2">
                {[...requests].reverse().map((r) => {
                  const v = (state.contentVersions || EMPTY).find((x) => x.id === r.versionId);
                  const d = state.approvals.find((a) => a.requestId === r.id);
                  const tone = r.status === "approved" ? "border-teal-200 bg-teal-50 text-teal-900" : r.status === "revision_requested" ? "border-orange-200 bg-orange-50 text-orange-900" : r.status === "pending" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-600";
                  return (
                    <li key={r.id} className={`rounded-lg border px-2.5 py-2 cw-12 ${tone}`}>
                      <p className="font-semibold flex flex-wrap items-center gap-1.5">Sürüm {v?.versionNo || "?"} · {REQUEST_STATUS[r.status]}<span className="font-normal opacity-75">· {fmtDateTime(r.closedAt || r.requestedAt)}</span></p>
                      {d && <p className="mt-0.5 opacity-80">{USER_BY_ID[d.userId]?.name || "Müşteri"}{d.note ? `: ${d.note}` : ""}</p>}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : (
          <section>
            <SectionTitle icon={RotateCcw}>Geri Bildirim Geçmişi</SectionTitle>
            {history.length ? (
              <ol className="space-y-2">
                {history.map((a) => (
                  <li key={a.id} className={`rounded-lg border px-2.5 py-2 cw-12 ${a.decision === "approved" ? "border-teal-200 bg-teal-50 text-teal-900" : "border-orange-200 bg-orange-50 text-orange-900"}`}>
                    <p className="font-semibold flex items-center gap-1.5 flex-wrap">{a.decision === "approved" ? "Onaylandı" : "Revize istendi"} · <span className="font-normal">{USER_BY_ID[a.userId]?.name || "Müşteri"} · {fmtDateTime(a.createdAt)}</span>{revisionStateOf(a, revInfo) && <span className="ml-auto"><RevisionBadge state={revisionStateOf(a, revInfo)} /></span>}</p>
                    {a.note && <p className="mt-0.5 whitespace-pre-wrap">{a.note}</p>}
                    {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 underline"><LinkIcon size={11} />Ek bağlantı</a>}
                  </li>
                ))}
              </ol>
            ) : <p className="cw-12 text-slate-400">Henüz geri bildirim yok.</p>}
          </section>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* Müşteri: onay geçmişi (karar verilmiş istekler, sürüm numarasıyla). */
function ClientHistoryPage({ search, brandId }) {
  const { state, openContent, brandsById } = useWS();
  const q = norm(search);
  const byId = Object.fromEntries(state.tasks.map((t) => [t.id, t]));
  const rows = (state.approvalRequests || EMPTY)
    .filter((r) => (r.status === "approved" || r.status === "revision_requested") && byId[r.taskId] && (brandId === "all" || byId[r.taskId].brandId === brandId)
      && matchesSearch(q, byId[r.taskId].title, byId[r.taskId].format))
    .sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)));
  return (
    <div className="space-y-4">
      <PageHeader title="Onay Geçmişi" description="Onayladığınız ve revize istediğiniz içerikler, incelediğiniz sürümle birlikte." />
      {rows.length ? (
        <ol className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100" data-client-history="">
          {rows.map((r) => {
            const t = byId[r.taskId];
            const v = (state.contentVersions || EMPTY).find((x) => x.id === r.versionId);
            const d = state.approvals.find((a) => a.requestId === r.id);
            return (
              <li key={r.id} className="p-3.5 flex flex-wrap items-center gap-3">
                <BrandLogo brand={brandsById[t.brandId]} size={28} />
                <div className="flex-1 min-w-[12rem]">
                  <button type="button" onClick={() => openContent(t.id)} className="text-left cw-13 font-semibold text-slate-900 hover:text-orange-700">{t.title}</button>
                  <p className="cw-11 text-slate-500">{t.format} · Sürüm {v?.versionNo || "?"} · {fmtDateTime(r.closedAt)}</p>
                  {d?.note && <p className="cw-12 text-slate-600 mt-0.5 cw-clamp2">“{d.note}”</p>}
                </div>
                <span className={`inline-flex items-center h-6 px-2 rounded-md border cw-11 font-semibold ${r.status === "approved" ? "text-teal-700 bg-teal-50 border-teal-200" : "text-orange-700 bg-orange-50 border-orange-200"}`}>{REQUEST_STATUS[r.status]}</span>
              </li>
            );
          })}
        </ol>
      ) : <EmptyBlock icon={History} title="Henüz karar verilmiş içerik yok" text="Onayladığınız veya revize istediğiniz içerikler burada listelenir." />}
    </div>
  );
}

/* Görev çekmecesinde müşteri geri bildirimleri (ajans içi görünüm). */
const REVISION_TONES = {
  requested: "bg-orange-100 border-orange-200 text-orange-800",
  in_progress: "bg-white border-orange-300 border-dashed text-orange-700",
  resolved: "bg-emerald-50 border-emerald-200 text-emerald-700",
};
function RevisionBadge({ state }) {
  return <span className={`inline-flex items-center h-5 px-1.5 rounded-md border cw-10 font-semibold whitespace-nowrap ${REVISION_TONES[state]}`}>{REVISION_LABELS[state]}</span>;
}
/* Bir onay kaydının revize durumu: en son revize talebi görevin güncel durumunu taşır, öncekiler tamamlanmıştır. */
const revisionStateOf = (approval, info) => (approval.decision !== "revision" ? null : info && info.approval.id === approval.id ? info.state : "resolved");

function ClientFeedbackSection({ task, sectionRef }) {
  const { state, revisionByTask } = useWS();
  const history = state.approvals.filter((a) => a.taskId === task.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!history.length) return null;
  const info = revisionByTask[task.id];
  return (
    <section ref={sectionRef} style={{ scrollMarginTop: 12 }}>
      <SectionTitle icon={Briefcase}>Müşteri Geri Bildirimleri ({history.length})</SectionTitle>
      <ol className="space-y-2">
        {history.map((a) => (
          <li key={a.id} className={`rounded-lg border px-3 py-2 cw-12 ${a.decision === "approved" ? "border-teal-200 bg-teal-50 text-teal-900" : "border-orange-200 bg-orange-50 text-orange-900"}`}>
            <p className="font-semibold flex items-center gap-1.5 flex-wrap"><Avatar userId={a.userId} size={18} />{USER_BY_ID[a.userId]?.name || "Müşteri"} · {a.decision === "approved" ? "onayladı" : "revize istedi"}{a.versionId && <span className="font-normal">· Sürüm {(state.contentVersions || EMPTY).find((v) => v.id === a.versionId)?.versionNo || "?"}</span>}<span className="font-normal opacity-70">· {fmtDateTime(a.createdAt)}</span>{revisionStateOf(a, info) && <span className="ml-auto"><RevisionBadge state={revisionStateOf(a, info)} /></span>}</p>
            {a.note && <p className="mt-1 whitespace-pre-wrap">{a.note}</p>}
            {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 underline"><LinkIcon size={11} />Ek bağlantı</a>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ───────────────────────── İçerik sürümleri ve müşteri onay bağlantısı ───────────────────────── */

/* Süreli (imzalı) önizleme adresleri; kısa süre önbellekte tutulur (aynı dosya için tekrar istek atılmaz). */
const contentUrlCache = new Map();
function useContentUrls(assets) {
  const { contentApi } = useWS();
  const key = assets.map((a) => a.id).join(",");
  const [urls, setUrls] = useState({});
  useEffect(() => {
    if (!contentApi || !assets.length) { setUrls({}); return undefined; }
    const fresh = {}, need = [];
    assets.forEach((a) => { const c = contentUrlCache.get(a.id); if (c && Date.now() - c.at < 8 * 60 * 1000) fresh[a.id] = c.url; else need.push(a); });
    setUrls(fresh);
    if (!need.length) return undefined;
    let alive = true;
    contentApi.urls(need).then((m) => {
      Object.entries(m).forEach(([id, url]) => contentUrlCache.set(id, { url, at: Date.now() }));
      if (alive) setUrls((u) => ({ ...u, ...m }));
    }, () => { /* önizleme yoksa yer tutucu gösterilir */ });
    return () => { alive = false; };
  }, [contentApi, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}

/* Dosya önizlemesi: görsel / video / PDF; adres yoksa veya dosya açılamazsa arayüz bozulmaz. */
function ContentMedia({ asset, url, large, thumb }) {
  const [broken, setBroken] = useState(false);
  const kind = asset.mimeType.startsWith("image/") ? "image" : asset.mimeType.startsWith("video/") ? "video" : "pdf";
  const box = large ? "w-full" : "w-full h-full";
  const style = large ? { aspectRatio: "16 / 10" } : undefined;
  if (!url || broken) {
    return (
      <div className={`${box} flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400`} style={style} data-media-fallback="">
        {kind === "video" ? <Film size={large ? 28 : 16} /> : kind === "pdf" ? <FileText size={large ? 28 : 16} /> : <FileImage size={large ? 28 : 16} />}
        {large && <span className="cw-12">{url === undefined && !broken ? "Önizleme yükleniyor…" : "Önizleme açılamadı."}</span>}
      </div>
    );
  }
  if (kind === "image") return <img src={url} alt={asset.fileName} loading="lazy" onError={() => setBroken(true)} className={`${box} object-${large ? "contain bg-slate-900/5" : "cover"}`} style={style} />;
  if (kind === "video") {
    return thumb
      ? <div className={`${box} flex items-center justify-center bg-slate-800 text-white`}><Film size={16} /></div>
      : <video src={url} controls={large} preload="metadata" onError={() => setBroken(true)} className={`${box} bg-black`} style={style} />;
  }
  return (
    <div className={`${box} flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-500`} style={style}>
      <FileText size={large ? 32 : 16} />
      {large && <a href={url} target="_blank" rel="noopener noreferrer" className="cw-12 font-semibold text-orange-700 hover:underline">PDF'i yeni sekmede aç</a>}
    </div>
  );
}

const VERSION_TONES = {
  draft: "text-slate-600 bg-slate-100 border-slate-200", sent: "text-amber-700 bg-amber-50 border-amber-200", pending: "text-amber-700 bg-amber-50 border-amber-200",
  approved: "text-teal-700 bg-teal-50 border-teal-200", revision_requested: "text-orange-700 bg-orange-50 border-orange-200",
  withdrawn: "text-slate-500 bg-slate-50 border-slate-200", superseded: "text-slate-500 bg-slate-50 border-slate-200",
};

/* Görev detayı (ekip): içerik sürümleri. Taslak sürüme dosya yüklenir ve metni yazılır; müşteriye gönderilince kilitlenir. */
function ContentVersionsSection({ task }) {
  const { state, actor, contentApi, dispatch, notify, previewOnly } = useWS();
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [openOld, setOpenOld] = useState(false);
  const fileRef = useRef(null);
  const versions = useMemo(() => (contentApi ? versionsOf(state.contentVersions || EMPTY, task.id).reverse() : EMPTY), [contentApi, state.contentVersions, task.id]);
  const allAssets = useMemo(() => (state.contentAssets || EMPTY).filter((a) => a.taskId === task.id), [state.contentAssets, task.id]);
  const urls = useContentUrls(allAssets);
  if (!contentApi) return null;
  const canEdit = !previewOnly && canEditContentVersion(actor, task, state);
  const latest = versions[0] || null;
  const draft = latest && !latest.lockedAt ? latest : null;

  const createVersion = async () => {
    setBusy(true);
    try { const res = await contentApi.createVersion(task, state, actor.id); if (res) dispatch({ type: "REMOTE_MERGE", remote: true, ...res }); }
    catch (err) { notify(err?.message || "Sürüm oluşturulamadı.", "error"); }
    finally { setBusy(false); }
  };
  const upload = async (files) => {
    if (!draft) return;
    for (const file of files) {
      const key = uid();
      const check = validateContentFile(file);
      if (!check.ok) { setUploads((u) => [...u, { key, name: file.name, error: check.error }]); continue; }
      setUploads((u) => [...u, { key, name: file.name, progress: 0 }]);
      try {
        const asset = await contentApi.upload(task, draft, file, { userId: actor.id, onProgress: (p) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))) });
        dispatch({ type: "REMOTE_MERGE", remote: true, contentAssets: [asset] });
        setUploads((u) => u.filter((x) => x.key !== key));
      } catch (err) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: err?.message || "Yükleme başarısız." } : x)));
      }
    }
  };
  const removeAsset = async (asset, version) => {
    try { await contentApi.removeAsset(asset, version); dispatch({ type: "REMOTE_DELETE", remote: true, collection: "contentAssets", id: asset.id }); notify("Dosya kaldırıldı."); }
    catch (err) { notify(err?.message || "Dosya kaldırılamadı.", "error"); throw err; }
  };

  const shownVersions = openOld ? versions : versions.slice(0, 2);
  return (
    <section data-content-versions={task.id}>
      <SectionTitle icon={Layers} right={canEdit && !draft && (
        <Btn size="sm" variant="secondary" onClick={createVersion} disabled={busy}><Plus size={13} />{latest ? `Sürüm ${latest.versionNo + 1} Oluştur` : "Sürüm Oluştur"}</Btn>
      )}>İçerik Sürümleri</SectionTitle>
      {!versions.length ? (
        <p className="cw-12 text-slate-500 rounded-lg border border-dashed border-slate-300 px-3 py-3">
          Henüz sürüm yok. {canEdit ? "Müşteriye gönderilecek görsel, video veya PDF'leri yüklemek için bir sürüm oluşturun." : "Sorumlu ekip üyesi dosyaları yüklediğinde burada görünür."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {shownVersions.map((v) => {
            const st = versionStatus(v, state.approvalRequests || EMPTY);
            const files = assetsOf(state.contentAssets || EMPTY, v.id);
            const decisions = state.approvals.filter((a) => a.versionId === v.id);
            const editable = canEdit && !v.lockedAt;
            return (
              <article key={v.id} data-version={v.versionNo} className={`rounded-xl border p-3 space-y-2.5 ${v.lockedAt ? "border-slate-200 bg-white" : "border-orange-200 bg-orange-50/30"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="cw-13 font-bold text-slate-900">Sürüm {v.versionNo}</span>
                  <span className={`inline-flex items-center h-5 px-1.5 rounded-md border cw-10 font-semibold ${VERSION_TONES[st]}`} data-version-status={st}>{VERSION_STATUS[st]}</span>
                  <span className="cw-11 text-slate-400 ml-auto">{v.lockedAt ? <span className="inline-flex items-center gap-1"><Lock size={10} />Gönderildi · {fmtDateTime(v.lockedAt)}</span> : `Oluşturuldu · ${fmtDateTime(v.createdAt)}`}</span>
                </div>
                {editable
                  ? <VersionCaption version={v} />
                  : v.caption ? <p className="cw-12 text-slate-700 whitespace-pre-wrap break-words">{v.caption}</p> : <p className="cw-12 text-slate-400">Paylaşım metni yok.</p>}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {files.map((a) => (
                    <figure key={a.id} className="relative group/asset rounded-lg border border-slate-200 overflow-hidden bg-white" data-content-asset={a.id}>
                      <div className="h-20"><ContentMedia asset={a} url={urls[a.id]} thumb /></div>
                      <figcaption className="px-1.5 py-1 cw-10 text-slate-500 truncate" title={a.fileName}>{a.fileName} · {formatBytes(a.fileSize)}</figcaption>
                      <span className="absolute top-1 right-1 flex gap-0.5 sm:opacity-0 sm:group-hover/asset:opacity-100 focus-within:opacity-100">
                        {urls[a.id] && <a href={urls[a.id]} target="_blank" rel="noopener noreferrer" className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-white/90 text-slate-600 hover:text-orange-700 shadow-sm" aria-label={`${a.fileName} dosyasını aç`}><ExternalLink size={12} /></a>}
                        {editable && <span className="bg-white/90 rounded-md shadow-sm"><DeleteAction label={`${a.fileName} dosyasını kaldır`} onConfirm={() => removeAsset(a, v)} /></span>}
                      </span>
                    </figure>
                  ))}
                  {editable && (
                    <button type="button" onClick={() => fileRef.current?.click()} className="h-[6.25rem] rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-orange-400 hover:text-orange-700 flex flex-col items-center justify-center gap-1 cw-11 font-semibold">
                      <Upload size={16} />Dosya Ekle<span className="font-normal text-slate-400">≤ 50 MB</span>
                    </button>
                  )}
                </div>
                {editable && uploads.length > 0 && (
                  <ul className="space-y-1" aria-live="polite">
                    {uploads.map((u) => (
                      <li key={u.key} className={`flex items-center gap-2 cw-11 ${u.error ? "text-red-700" : "text-slate-600"}`}>
                        <span className="truncate flex-1 min-w-0">{u.name}</span>
                        {u.error ? <><span className="truncate max-w-[60%]">{u.error}</span><button type="button" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))} className="shrink-0 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-red-50" aria-label="Uyarıyı kapat"><X size={12} /></button></>
                          : <span className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-label={`${u.name} yükleniyor`} aria-valuenow={Math.round((u.progress || 0) * 100)} aria-valuemin={0} aria-valuemax={100}><span className="block h-full bg-orange-500" style={{ width: `${Math.round((u.progress || 0) * 100)}%` }} /></span>}
                      </li>
                    ))}
                  </ul>
                )}
                {decisions.map((d) => (
                  <p key={d.id} className={`rounded-lg border px-2.5 py-1.5 cw-12 ${d.decision === "approved" ? "border-teal-200 bg-teal-50 text-teal-900" : "border-orange-200 bg-orange-50 text-orange-900"}`}>
                    <strong className="font-semibold">{USER_BY_ID[d.userId]?.name || "Müşteri"}</strong> {d.decision === "approved" ? "onayladı" : "revize istedi"} · {fmtDateTime(d.createdAt)}{d.note ? `: ${d.note}` : ""}
                  </p>
                ))}
              </article>
            );
          })}
          {versions.length > 2 && <Btn size="sm" variant="ghost" onClick={() => setOpenOld((o) => !o)}>{openOld ? "Eski sürümleri gizle" : `${versions.length - 2} eski sürümü göster`}</Btn>}
        </div>
      )}
      <input ref={fileRef} type="file" multiple accept={CONTENT_ACCEPT} className="hidden" aria-hidden="true" tabIndex={-1}
        onChange={(e) => { const list = [...e.target.files]; e.target.value = ""; upload(list); }} data-content-file-input="" />
    </section>
  );
}

function VersionCaption({ version }) {
  const { dispatch } = useWS();
  const [v, setV] = useState(version.caption);
  useEffect(() => { setV(version.caption); }, [version.id, version.caption]);
  const commit = () => { if (v !== version.caption && dispatch({ type: "UPDATE_VERSION", id: version.id, patch: { caption: v } })) { /* kaydedildi */ } };
  return (
    <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} rows={3} maxLength={5000} aria-label={`Sürüm ${version.versionNo} paylaşım metni`}
      placeholder="Paylaşım metni (müşteri bu metni onaylar)…"
      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 cw-13 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-y" />
  );
}

/* Marka düzenleme: Müşteri Onay Bağlantısı. Bağlantı yalnızca yönlendirir; erişim marka üyeliğiyle verilir ve iptal edilir. */
function BrandPortalLink({ brandId }) {
  const { state, dispatch, notify, copyLink } = useWS();
  const [ask, setAsk] = useState(null);
  const brand = state.allBrands.find((b) => b.id === brandId);
  if (!brand) return null;
  if (!brand.slug) return <p className="mt-4 cw-12 text-slate-500">Müşteri onay bağlantısı için supabase/007_content_approvals.sql çalıştırılmalı.</p>;
  const url = `${window.location.origin}${portalPath(brand.slug)}`;
  const clients = state.allMemberships.filter((m) => m.brandId === brand.id && state.allUsers.find((u) => u.id === m.userId)?.role === "client").map((m) => state.allUsers.find((u) => u.id === m.userId));
  const setClients = (ids) => dispatch({ type: "SET_BRAND_MEMBERS", brandId: brand.id, role: "client", userIds: ids });
  return (
    <section className="mt-5 pt-4 border-t border-slate-100 space-y-2.5" data-portal-link={brand.slug} aria-labelledby={`portal-${brand.id}`}>
      <h3 id={`portal-${brand.id}`} className="cw-13 font-bold text-slate-900 flex items-center gap-1.5"><LinkIcon size={14} className="text-slate-400" />Müşteri Onay Bağlantısı</h3>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 h-9 min-w-0">
        <span className="flex-1 min-w-0 truncate font-mono cw-12 text-slate-700" title={url}>{url}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Btn size="sm" variant="secondary" onClick={() => copyLink(url)}><Copy size={13} />Bağlantıyı Kopyala</Btn>
        <Btn size="sm" variant="secondary" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}><ExternalLink size={13} />Onay Sayfasını Aç</Btn>
        <Btn size="sm" variant="secondary" onClick={() => setAsk("rotate")}><RefreshCw size={13} />Bağlantıyı Yenile</Btn>
        <Btn size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setAsk("revoke")} disabled={!clients.length}><Lock size={13} />Erişimi İptal Et</Btn>
      </div>
      {ask && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2 cw-12 text-amber-900">
          <p>{ask === "rotate" ? "Yeni bir adres oluşturulur; eski bağlantı artık hiçbir markaya açılmaz. Müşterilere yeni bağlantıyı göndermeniz gerekir." : `Bu markaya bağlı ${clients.length} müşteri hesabının erişimi kaldırılır. Hesaplar silinmez; tekrar erişim için Kullanıcılar ekranından marka atanır.`}</p>
          <div className="flex justify-end gap-2">
            <Btn size="sm" variant="ghost" onClick={() => setAsk(null)}>Vazgeç</Btn>
            <Btn size="sm" variant="danger" onClick={() => {
              const ok = ask === "rotate" ? dispatch({ type: "UPDATE_BRAND", id: brand.id, patch: { slug: rotatedSlug(brand.name) } }) : setClients([]);
              if (ok) notify(ask === "rotate" ? "Bağlantı yenilendi. Eski bağlantı artık çalışmaz." : "Müşteri erişimi iptal edildi.");
              setAsk(null);
            }}>{ask === "rotate" ? "Bağlantıyı Yenile" : "Erişimi İptal Et"}</Btn>
          </div>
        </div>
      )}
      <div>
        <p className="cw-11 font-semibold text-slate-600 mb-1">Erişimi olan müşteri hesapları</p>
        {clients.length ? (
          <ul className="space-y-1">
            {clients.map((u) => (
              <li key={u.id} className="flex items-center gap-2 cw-12 text-slate-700">
                <Avatar userId={u.id} size={20} /><span className="flex-1 min-w-0 truncate">{u.name}<span className="text-slate-400"> · {u.email}</span></span>
                <Btn size="sm" variant="ghost" className="h-7 text-red-600 hover:bg-red-50" onClick={() => { if (setClients(clients.filter((c) => c.id !== u.id).map((c) => c.id))) notify(`${u.name} için erişim kaldırıldı.`); }}>Kaldır</Btn>
              </li>
            ))}
          </ul>
        ) : <p className="cw-12 text-slate-400">Bu markaya bağlı müşteri hesabı yok. Bağlantı tek başına erişim vermez.</p>}
        <p className="mt-1.5 cw-11 text-slate-500">Bağlantı yalnızca yönlendirir: müşteri e-posta bağlantısıyla giriş yapar ve yalnızca bu markaya tanımlıysa onay sayfasını görür.</p>
      </div>
    </section>
  );
}

/* ───────────────────────── Marka kılavuzu: veri bağlantısı ───────────────────────── */

const noopSubscribe = () => () => {};

/* Seçili markanın kılavuzu: marka başına yüklenir, önbellekte kalır, canlı değişikliklerde sessizce yenilenir.
   Görünen veri her zaman rbac.scopeBrandKit dilimidir (müşteri ekip içi kayıtları hiç almaz). */
function useBrandKit(brandId) {
  const { brandKitStore: store, actor, state, notify, previewOnly } = useWS();
  const canView = !!brandId && canViewBrandKit(actor, brandId, state);
  const canEdit = canView && !previewOnly && canEditBrandKit(actor, brandId, state);
  const getSnap = useCallback(() => (store && brandId ? store.get(brandId) : undefined), [store, brandId]);
  const entry = useSyncExternalStore(store ? store.subscribe : noopSubscribe, getSnap, getSnap);
  useEffect(() => { if (store && canView) store.load(brandId).catch(() => {}); }, [store, brandId, canView]);
  useEffect(() => (store && canView ? store.watch(brandId, () => store.refresh(brandId)) : undefined), [store, brandId, canView]);
  const data = useMemo(() => (entry && entry.data ? scopeBrandKit(actor, entry.data) : null), [entry, actor]);

  const run = useCallback(async (fn, okMsg) => {
    if (!canEdit) { const err = new Error(previewOnly ? "Önizleme modunda değişiklik yapılamaz." : "Bu işlem için yetkiniz yok."); notify(err.message, "error"); throw err; }
    try { const r = await fn(); if (okMsg) notify(okMsg); return r; }
    catch (err) { notify(err?.message || "İşlem tamamlanamadı.", "error"); throw err; }
  }, [canEdit, previewOnly, notify]);

  return useMemo(() => ({
    brandId, canView, canEdit, data,
    status: !store ? "unavailable" : !canView ? "denied" : entry ? entry.status : "loading",
    error: entry?.error || null,
    reload: () => store.load(brandId, { force: true }).catch(() => {}),
    createKit: () => run(() => store.createKit(brandId, actor.id), "Marka kılavuzu oluşturuldu."),
    save: (entity, item, msg) => run(() => store.save(entity, { ...item, brandId }, actor.id), msg),
    remove: (entity, item, msg) => run(() => store.remove(entity, item, actor.id), msg),
    reorder: (entity, ids) => run(() => store.reorder(entity, brandId, ids, actor.id)),
    upload: (file, meta, onProgress) => {
      if (!canEdit) return Promise.reject(new Error("Bu işlem için yetkiniz yok."));
      return store.upload(brandId, file, meta, { userId: actor.id, onProgress });
    },
    fileUrl: (asset, opts) => store.fileUrl(asset, opts),
    fileUrls: (assets) => store.fileUrls(assets),
  }), [brandId, canView, canEdit, data, store, entry, run, actor.id]);
}

/* Taslaklar: düzenleme formu açıkken sekme veya marka değişse de yazılanlar kaybolmaz; kaydedilmemiş
   değişiklik varken sayfadan çıkılırsa tarayıcı uyarır. */
const kitDrafts = new Map();
const dirtyKitForms = new Set();
const onKitUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
function syncKitUnloadGuard() {
  if (typeof window === "undefined") return;
  window.removeEventListener("beforeunload", onKitUnload);
  if (dirtyKitForms.size) window.addEventListener("beforeunload", onKitUnload);
}
function usePersisted(key, initial) {
  const [value, setValue] = useState(() => (kitDrafts.has(`ui:${key}`) ? kitDrafts.get(`ui:${key}`) : initial));
  useEffect(() => { setValue(kitDrafts.has(`ui:${key}`) ? kitDrafts.get(`ui:${key}`) : initial); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((v) => { if (v === initial) kitDrafts.delete(`ui:${key}`); else kitDrafts.set(`ui:${key}`, v); setValue(v); }, [key, initial]);
  return [value, set];
}
function useKitForm(key, initial) {
  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  const [values, setValues] = useState(() => kitDrafts.get(key) || initial);
  const dirty = JSON.stringify(values) !== initialJson;
  useEffect(() => {
    if (dirty) { kitDrafts.set(key, values); dirtyKitForms.add(key); } else { kitDrafts.delete(key); dirtyKitForms.delete(key); }
    syncKitUnloadGuard();
  }, [key, values, dirty]);
  const set = useCallback((k, v) => setValues((f) => ({ ...f, [k]: typeof v === "function" ? v(f[k]) : v })), []);
  const discard = useCallback(() => { kitDrafts.delete(key); dirtyKitForms.delete(key); syncKitUnloadGuard(); }, [key]);
  return { values, set, dirty, discard };
}

/* ───────────────────────── Marka kılavuzu: ortak parçalar ───────────────────────── */

function KitSection({ icon: Icon, title, description, count, action, children, id }) {
  return (
    <section aria-labelledby={id} className="bg-white border border-slate-200 rounded-xl min-w-0">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
        <span className="h-8 w-8 shrink-0 rounded-lg bg-slate-100 text-slate-500 inline-flex items-center justify-center"><Icon size={15} /></span>
        <div className="flex-1 min-w-[12rem]">
          <h3 id={id} className="cw-13 font-bold text-slate-900">{title}{count != null && <span className="ml-1.5 cw-11 font-semibold text-slate-400 tabular-nums">{count}</span>}</h3>
          {description && <p className="cw-12 text-slate-500 mt-0.5">{description}</p>}
        </div>
        {action}
      </header>
      <div className="px-4 sm:px-5 py-4">{children}</div>
    </section>
  );
}

function KitEmpty({ children }) {
  return <p className="cw-12 text-slate-400 py-2">{children}</p>;
}

function VisibilityBadge({ visibility }) {
  if (visibility !== "internal") return null;
  return <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-slate-100 text-slate-600 cw-10 font-semibold whitespace-nowrap" title="Müşteri bu kaydı görmez"><Lock size={9} />Ekip içi</span>;
}

/* Silme onayı satır içinde (ek pencere açılmaz). */
function DeleteAction({ label, onConfirm }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ask) return <IconAction icon={Trash2} label={label} tone="danger" onClick={() => setAsk(true)} />;
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 pl-2 pr-1 h-8" role="group" aria-label="Silme onayı">
      <span className="cw-11 font-semibold text-red-700">Silinsin mi?</span>
      <Btn size="sm" variant="danger" className="h-6 px-2" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } catch { setBusy(false); setAsk(false); } }}>Sil</Btn>
      <Btn size="sm" variant="ghost" className="h-6 px-2" onClick={() => setAsk(false)}>Vazgeç</Btn>
    </span>
  );
}

function KitFormActions({ dirty, saving, onCancel, submitLabel = "Kaydet" }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5" role="alert">
        <span className="cw-12 text-amber-900 mr-auto">Kaydedilmemiş değişiklikler silinecek.</span>
        <Btn size="sm" variant="ghost" onClick={() => setConfirm(false)}>Düzenlemeye Dön</Btn>
        <Btn size="sm" variant="danger" onClick={onCancel}>Değişiklikleri Sil</Btn>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-2">
      {dirty && <span className="mr-auto cw-11 text-amber-700">Kaydedilmemiş değişiklik var</span>}
      <Btn size="sm" variant="ghost" onClick={() => (dirty ? setConfirm(true) : onCancel())}>Vazgeç</Btn>
      <Btn size="sm" variant="primary" type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : submitLabel}</Btn>
    </div>
  );
}

const kitFormCls = "rounded-xl border border-orange-200 bg-orange-50/30 p-3 sm:p-4 space-y-3";
const sanitizeFamily = (f) => String(f || "").replace(/["';{}<>\\]/g, "").trim();
const moveId = (ids, id, dir) => { const i = ids.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= ids.length) return ids; const next = [...ids]; [next[i], next[j]] = [next[j], next[i]]; return next; };

/* ───────────────────────── Marka renkleri ───────────────────────── */

function CopyHex({ hex, size = "md" }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return undefined; const t = setTimeout(() => setCopied(false), 1600); return () => clearTimeout(t); }, [copied]);
  return (
    <button
      type="button"
      onClick={async (e) => { e.stopPropagation(); if (await copyText(hex)) setCopied(true); }}
      aria-label={`${hex} renk kodunu kopyala`}
      title="Kopyalamak için tıklayın"
      className={`inline-flex items-center gap-1.5 rounded-md font-mono font-semibold text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${size === "sm" ? "h-6 px-1 -mx-1 cw-11" : "h-7 px-1.5 -mx-1.5 cw-12"}`}
    >
      {hex}
      <span role="status" className="inline-flex items-center">
        {copied ? <span className="inline-flex items-center gap-0.5 font-sans cw-11 text-emerald-600"><Check size={12} />Kopyalandı</span> : <Copy size={12} className="text-slate-400" aria-hidden="true" />}
      </span>
    </button>
  );
}

function ColorForm({ kit, color, onDone }) {
  const initial = useMemo(() => ({ name: color?.name || "", hex: color?.hex || "#EA580C", usage: color?.usage || "", type: color?.type || (kit.data.colors.length ? "secondary" : "primary") }), [color, kit.data.colors.length]);
  const { values: v, set, dirty, discard } = useKitForm(`${kit.brandId}:color:${color?.id || "new"}`, initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const hex = normalizeHex(v.hex);
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!v.name.trim()) err.name = "Renk adı zorunludur.";
    if (!hex) err.hex = "Geçerli bir HEX kodu girin (örn. #EA580C).";
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      await kit.save("colors", { id: color?.id || uid(), name: v.name.trim(), hex, usage: v.usage.trim(), type: v.type, sortOrder: color ? color.sortOrder : kit.data.colors.length }, color ? "Renk güncellendi." : "Renk eklendi.");
      discard(); onDone();
    } catch { setSaving(false); }
  };
  return (
    <form onSubmit={submit} noValidate className={kitFormCls} aria-label={color ? "Rengi düzenle" : "Yeni renk"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Renk Adı" error={errors.name}><input autoFocus value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="örn. Ana Marka Rengi" maxLength={80} className={inputCls(errors.name)} /></Field>
        <Field label="HEX Kodu" error={errors.hex} group>
          <div className="flex gap-2">
            <input type="color" value={hex || "#000000"} onChange={(e) => set("hex", e.target.value.toUpperCase())} aria-label="Renk seçici" className="h-9 w-12 shrink-0 rounded-lg border border-slate-200 bg-white p-1 cursor-pointer" />
            <input value={v.hex} onChange={(e) => set("hex", e.target.value)} onBlur={() => { if (hex) set("hex", hex); }} placeholder="#EA580C" maxLength={7} aria-label="HEX kodu" className={`${inputCls(errors.hex)} font-mono uppercase`} />
          </div>
        </Field>
        <Field label="Sınıf">
          <select value={v.type} onChange={(e) => set("type", e.target.value)} className={inputCls()}>{Object.entries(COLOR_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Kullanım (isteğe bağlı)"><input value={v.usage} onChange={(e) => set("usage", e.target.value)} placeholder="örn. Ana butonlar ve vurgu alanları" maxLength={500} className={inputCls()} /></Field>
      </div>
      <KitFormActions dirty={dirty} saving={saving} onCancel={() => { discard(); onDone(); }} submitLabel={color ? "Kaydet" : "Rengi Ekle"} />
    </form>
  );
}

function ColorsSection({ kit }) {
  const colors = kit.data.colors;
  const [editing, setEditing] = usePersisted(`${kit.brandId}:colors:editing`, null);
  const ids = colors.map((c) => c.id);
  return (
    <KitSection id={`kit-colors-${kit.brandId}`} icon={Palette} title="Marka Renkleri" count={colors.length} description="HEX koduna tıklayarak kopyalayabilirsiniz."
      action={kit.canEdit && editing !== "new" && <Btn size="sm" variant="secondary" onClick={() => setEditing("new")}><Plus size={13} />Renk Ekle</Btn>}>
      {editing === "new" && <div className="mb-3"><ColorForm kit={kit} onDone={() => setEditing(null)} /></div>}
      {colors.length ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {colors.map((c, i) => (editing === c.id ? <div key={c.id} className="sm:col-span-2 xl:col-span-3"><ColorForm kit={kit} color={c} onDone={() => setEditing(null)} /></div> : (
            <div key={c.id} data-kit-color={c.hex} className="flex gap-3 p-2.5 rounded-xl border border-slate-200 min-w-0">
              <span className="h-14 w-14 shrink-0 rounded-lg border border-black/5 shadow-inner" style={{ backgroundColor: c.hex }} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="cw-13 font-semibold text-slate-900 truncate" title={c.name}>{c.name}</p>
                  <span className={`shrink-0 inline-flex items-center h-5 px-1.5 rounded-md cw-10 font-semibold ${c.type === "primary" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-600"}`}>{c.type === "primary" ? "Ana" : "İkincil"}</span>
                </div>
                <CopyHex hex={c.hex} />
                {c.usage && <p className="cw-11 text-slate-500 cw-clamp2" title={c.usage}><span className="font-semibold text-slate-600">Kullanım:</span> {c.usage}</p>}
              </div>
              {kit.canEdit && (
                <div className="shrink-0 flex flex-col items-center -my-1">
                  <IconAction icon={ArrowUp} label={`${c.name} rengini yukarı taşı`} disabled={i === 0} onClick={() => kit.reorder("colors", moveId(ids, c.id, -1)).catch(() => {})} />
                  <IconAction icon={ArrowDown} label={`${c.name} rengini aşağı taşı`} disabled={i === colors.length - 1} onClick={() => kit.reorder("colors", moveId(ids, c.id, 1)).catch(() => {})} />
                </div>
              )}
              {kit.canEdit && (
                <div className="shrink-0 flex flex-col items-end -my-1">
                  <IconAction icon={Pencil} label={`${c.name} rengini düzenle`} onClick={() => setEditing(c.id)} />
                  <DeleteAction label={`${c.name} rengini sil`} onConfirm={() => kit.remove("colors", c, "Renk silindi.")} />
                </div>
              )}
            </div>
          )))}
        </div>
      ) : <KitEmpty>Henüz marka rengi eklenmemiş.</KitEmpty>}
    </KitSection>
  );
}

/* ───────────────────────── Tipografi ───────────────────────── */

/* Önizleme: font dosyası yüklenmişse yalnızca kendi (yetkili) Storage adresimizden yüklenir; dış adresler
   hiçbir zaman otomatik yüklenmez. Dosya yoksa ad cihazda yüklüyse kullanılır, değilse yedek yazı tipi görünür. */
const loadedKitFonts = new Map(); // assetId → Promise<boolean>
function useKitFontFace(kit, asset) {
  const [ready, setReady] = useState(asset ? null : false);
  useEffect(() => {
    if (!asset || typeof FontFace === "undefined") { setReady(false); return undefined; }
    let alive = true;
    if (!loadedKitFonts.has(asset.id)) {
      loadedKitFonts.set(asset.id, kit.fileUrl(asset).then(async (url) => {
        const face = new FontFace(`cwkit-${asset.id}`, `url("${url}")`);
        await face.load(); document.fonts.add(face); return true;
      }).catch(() => { loadedKitFonts.delete(asset.id); return false; }));
    }
    loadedKitFonts.get(asset.id).then((ok) => { if (alive) setReady(ok); });
    return () => { alive = false; };
  }, [asset?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

function FontPreview({ kit, font, asset, compact }) {
  const ready = useKitFontFace(kit, asset);
  const family = sanitizeFamily(font.family);
  const stack = `${ready ? `"cwkit-${asset.id}", ` : ""}"${family}", ui-sans-serif, system-ui, sans-serif`;
  const weight = font.weights?.length ? Math.max(...font.weights.filter((w) => w <= 700), font.weights[0]) : 600;
  return (
    <div>
      <p className={`text-slate-900 truncate ${compact ? "text-lg" : "text-2xl"}`} style={{ fontFamily: stack, fontWeight: weight }}>Aa Bb Çç Ğğ 123</p>
      {!compact && <p className="cw-13 text-slate-600 truncate" style={{ fontFamily: stack, fontWeight: 400 }}>Hızlı kahverengi tilki tembel köpeğin üzerinden atlar.</p>}
      <p className="cw-10 text-slate-400 mt-0.5">{ready ? "Yüklenen font dosyasıyla önizleniyor." : ready === null ? "Font dosyası yükleniyor…" : "Font cihazınızda yüklü değilse yedek yazı tipiyle gösterilir."}</p>
    </div>
  );
}

function FontForm({ kit, font, onDone }) {
  const fontAssets = kit.data.assets.filter((a) => a.fileType === "Font");
  const initial = useMemo(() => ({ family: font?.family || "", role: font?.role || "heading", weights: font?.weights || [400], usage: font?.usage || "", assetId: font?.assetId || "", referenceUrl: font?.referenceUrl || "" }), [font]);
  const { values: v, set, dirty, discard } = useKitForm(`${kit.brandId}:font:${font?.id || "new"}`, initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!sanitizeFamily(v.family)) err.family = "Font adı zorunludur.";
    const ref = validateHttpsUrl(v.referenceUrl);
    if (!ref.ok) err.referenceUrl = ref.error;
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      await kit.save("fonts", {
        id: font?.id || uid(), family: sanitizeFamily(v.family), role: v.role, weights: [...v.weights].sort((a, b) => a - b), usage: v.usage.trim(),
        assetId: v.assetId || null, referenceUrl: ref.url, sortOrder: font ? font.sortOrder : kit.data.fonts.length,
      }, font ? "Font güncellendi." : "Font eklendi.");
      discard(); onDone();
    } catch { setSaving(false); }
  };
  const toggleWeight = (w) => set("weights", (cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]));
  return (
    <form onSubmit={submit} noValidate className={kitFormCls} aria-label={font ? "Fontu düzenle" : "Yeni font"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Font Ailesi" error={errors.family}><input autoFocus value={v.family} onChange={(e) => set("family", e.target.value)} placeholder="örn. Montserrat" maxLength={80} className={inputCls(errors.family)} /></Field>
        <Field label="Rol"><select value={v.role} onChange={(e) => set("role", e.target.value)} className={inputCls()}>{Object.entries(FONT_ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Kalınlıklar" full group>
          <div className="flex flex-wrap gap-1.5">
            {FONT_WEIGHTS.map((w) => (
              <button key={w} type="button" aria-pressed={v.weights.includes(w)} onClick={() => toggleWeight(w)} className={`h-7 min-w-11 px-2 rounded-md border cw-12 font-semibold tabular-nums transition-colors ${v.weights.includes(w) ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{w}</button>
            ))}
          </div>
        </Field>
        <Field label="Kullanım Kuralı" full><textarea value={v.usage} onChange={(e) => set("usage", e.target.value)} rows={2} maxLength={500} placeholder="örn. Sosyal medya tasarımlarında ana başlıklar" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 cw-13 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-y" /></Field>
        <Field label="Font Dosyası (isteğe bağlı)">
          <select value={v.assetId} onChange={(e) => set("assetId", e.target.value)} className={inputCls()}>
            <option value="">Dosya bağlanmadı</option>
            {fontAssets.map((a) => <option key={a.id} value={a.id}>{a.fileName}</option>)}
          </select>
          {!fontAssets.length && <p className="cw-11 text-slate-400 mt-1">Önce “Kurumsal Dosyalar” bölümüne font dosyası yükleyin.</p>}
        </Field>
        <Field label="Referans Bağlantısı (isteğe bağlı)" error={errors.referenceUrl}><input value={v.referenceUrl} onChange={(e) => set("referenceUrl", e.target.value)} placeholder="https://fonts.google.com/…" className={inputCls(errors.referenceUrl)} /></Field>
      </div>
      <KitFormActions dirty={dirty} saving={saving} onCancel={() => { discard(); onDone(); }} submitLabel={font ? "Kaydet" : "Fontu Ekle"} />
    </form>
  );
}

function FontsSection({ kit }) {
  const fonts = kit.data.fonts;
  const [editing, setEditing] = usePersisted(`${kit.brandId}:fonts:editing`, null);
  const assetsById = Object.fromEntries(kit.data.assets.map((a) => [a.id, a]));
  return (
    <KitSection id={`kit-fonts-${kit.brandId}`} icon={Type} title="Tipografi & Fontlar" count={fonts.length}
      action={kit.canEdit && editing !== "new" && <Btn size="sm" variant="secondary" onClick={() => setEditing("new")}><Plus size={13} />Font Ekle</Btn>}>
      {editing === "new" && <div className="mb-3"><FontForm kit={kit} onDone={() => setEditing(null)} /></div>}
      {fonts.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {fonts.map((f) => (editing === f.id ? <div key={f.id} className="lg:col-span-2"><FontForm kit={kit} font={f} onDone={() => setEditing(null)} /></div> : (
            <article key={f.id} className="p-3.5 rounded-xl border border-slate-200 min-w-0 flex flex-col gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="cw-13 font-bold text-slate-900 truncate">{f.family} <span className="font-medium text-slate-400">— {FONT_ROLES[f.role]}</span></p>
                  {f.weights.length > 0 && <p className="cw-11 text-slate-500">Kalınlık: <span className="font-semibold text-slate-700 tabular-nums">{f.weights.join(" / ")}</span></p>}
                </div>
                {kit.canEdit && <div className="shrink-0 flex items-center -mr-1 -mt-1"><IconAction icon={Pencil} label={`${f.family} fontunu düzenle`} onClick={() => setEditing(f.id)} /><DeleteAction label={`${f.family} fontunu sil`} onConfirm={() => kit.remove("fonts", f, "Font silindi.")} /></div>}
              </div>
              <FontPreview kit={kit} font={f} asset={assetsById[f.assetId]} />
              {f.usage && <p className="cw-12 text-slate-600"><span className="font-semibold text-slate-700">Kullanım:</span> {f.usage}</p>}
              {(assetsById[f.assetId] || f.referenceUrl) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {assetsById[f.assetId] && <AssetActionButton kit={kit} asset={assetsById[f.assetId]} mode="download" label="Font Dosyasını İndir" />}
                  {f.referenceUrl && <a href={f.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 cw-12 font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink size={13} />Referans</a>}
                </div>
              )}
            </article>
          )))}
        </div>
      ) : <KitEmpty>Henüz font tanımlanmamış.</KitEmpty>}
    </KitSection>
  );
}

/* ───────────────────────── Marka istekleri & tasarım kuralları ───────────────────────── */

function InstructionForm({ kit, item, category, onDone }) {
  const initial = useMemo(() => ({ title: item?.title || "", category: item?.category || category || "design", content: item?.content || "", important: !!item?.important, visibility: item?.visibility || "internal" }), [item, category]);
  const draftKey = `${kit.brandId}:instruction:${item?.id || `new-${category}`}`;
  const { values: v, set, dirty, discard } = useKitForm(draftKey, initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!v.title.trim()) err.title = "Başlık zorunludur.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      const sameCat = kit.data.instructions.filter((x) => x.category === v.category);
      await kit.save("instructions", { id: item?.id || uid(), title: v.title.trim(), category: v.category, content: toStoredHtml(sanitizeHtml(v.content)), important: v.important, visibility: v.visibility, sortOrder: item ? item.sortOrder : sameCat.length }, item ? "Talimat güncellendi." : "Talimat eklendi.");
      discard(); onDone();
    } catch { setSaving(false); }
  };
  return (
    <form onSubmit={submit} noValidate className={kitFormCls} aria-label={item ? "Talimatı düzenle" : "Yeni talimat"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Başlık" error={errors.title} full><input autoFocus value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="örn. Logo kullanım standartları" className={inputCls(errors.title)} /></Field>
        <Field label="Kategori"><select value={v.category} onChange={(e) => set("category", e.target.value)} className={inputCls()}>{Object.entries(INSTRUCTION_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</select></Field>
        <Field label="Görünürlük"><select value={v.visibility} onChange={(e) => set("visibility", e.target.value)} className={inputCls()}>{Object.entries(VISIBILITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="İçerik" full group>
          <RichTextEditor value={v.content} docKey={draftKey} onChange={(html) => set("content", html)} allowImages={false} headings label="Talimat içeriği" placeholder="Madde madde kuralları yazın…" />
        </Field>
      </div>
      <label className="flex items-center gap-2 cw-12 text-slate-700 cursor-pointer w-fit"><input type="checkbox" checked={v.important} onChange={(e) => set("important", e.target.checked)} className="h-3.5 w-3.5 accent-orange-600" /><Star size={12} className="text-orange-500" />Önemli olarak işaretle (görev panelinde öne çıkar)</label>
      <KitFormActions dirty={dirty} saving={saving} onCancel={() => { discard(); onDone(); }} submitLabel={item ? "Kaydet" : "Talimatı Ekle"} />
    </form>
  );
}

function InstructionItem({ kit, item, onEdit, compact }) {
  return (
    <article data-kit-instruction={item.id} className={`relative rounded-xl border min-w-0 ${item.important ? "border-orange-200 bg-orange-50/40" : "border-slate-200"} ${compact ? "p-3" : "p-3.5"}`}>
      {item.important && <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-orange-500" aria-hidden="true" />}
      <div className="flex items-start gap-2 min-w-0">
        <h5 className="flex-1 min-w-0 cw-13 font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
          {item.important && <span className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md bg-orange-100 text-orange-800 cw-10 font-bold"><Star size={9} />Önemli</span>}
          {item.title}<VisibilityBadge visibility={item.visibility} />
        </h5>
        {onEdit && kit.canEdit && <div className="shrink-0 flex items-center -mr-1 -mt-1"><IconAction icon={Pencil} label={`${item.title} talimatını düzenle`} onClick={onEdit} /><DeleteAction label={`${item.title} talimatını sil`} onConfirm={() => kit.remove("instructions", item, "Talimat silindi.")} /></div>}
      </div>
      {htmlToText(item.content) && <div className="mt-1.5"><HtmlView html={item.content} empty="" /></div>}
      {!compact && (item.updatedAt || item.createdAt) && <p className="mt-2 cw-10 text-slate-400">Güncelleme: {fmtDateTime(item.updatedAt || item.createdAt)}{USER_BY_ID[item.updatedBy] ? ` · ${USER_BY_ID[item.updatedBy].name}` : ""}</p>}
    </article>
  );
}

function InstructionsSection({ kit }) {
  const [editing, setEditing] = usePersisted(`${kit.brandId}:instructions:editing`, null); // null | "new:<kategori>" | id
  const list = kit.data.instructions;
  return (
    <KitSection id={`kit-rules-${kit.brandId}`} icon={ClipboardList} title="Marka İstekleri & Tasarım Kuralları" count={list.length}
      description="Tasarımcı ve editörlerin uyması gereken kurallar. Önemli olanlar görev panelinde öne çıkar.">
      <div className="space-y-5">
        {Object.entries(INSTRUCTION_CATEGORIES).map(([cat, meta]) => {
          const items = list.filter((x) => x.category === cat).sort(bySortOrder);
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="cw-12 font-semibold uppercase tracking-wide text-slate-500 flex-1">{meta.label}</h4>
                {kit.canEdit && editing !== `new:${cat}` && <Btn size="sm" variant="ghost" onClick={() => setEditing(`new:${cat}`)}><Plus size={13} />Ekle</Btn>}
              </div>
              {editing === `new:${cat}` && <div className="mb-2"><InstructionForm kit={kit} category={cat} onDone={() => setEditing(null)} /></div>}
              {items.length ? (
                <div className="space-y-2">
                  {items.map((it) => (editing === it.id ? <InstructionForm key={it.id} kit={kit} item={it} onDone={() => setEditing(null)} /> : <InstructionItem key={it.id} kit={kit} item={it} onEdit={() => setEditing(it.id)} />))}
                </div>
              ) : editing !== `new:${cat}` && <KitEmpty>{meta.hint}. Henüz eklenmemiş.</KitEmpty>}
            </div>
          );
        })}
      </div>
    </KitSection>
  );
}
const bySortOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt));

/* ───────────────────────── Kurumsal dosyalar & varlıklar ───────────────────────── */

/* Dosya açma/indirme: her seferinde kısa süreli imzalı adres alınır. Yeni sekme, açılır pencere engelleyicisine
   takılmaması için tıklama anında açılır, adres gelince yönlendirilir. */
function AssetActionButton({ kit, asset, mode, label, iconOnly }) {
  const { notify } = useWS();
  const [busy, setBusy] = useState(false);
  const Icon = mode === "download" ? Download : Eye;
  const run = async () => {
    const win = mode === "open" ? window.open("", "_blank") : null;
    if (win) win.opener = null;
    setBusy(true);
    try {
      const url = await kit.fileUrl(asset, { download: mode === "download" });
      if (mode === "open") { if (win) win.location.href = url; else window.open(url, "_blank", "noopener"); }
      else { const a = document.createElement("a"); a.href = url; a.download = asset.fileName; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
    } catch (err) {
      if (win) win.close();
      notify(err?.message || "Dosya açılamadı. Erişim izniniz olmayabilir veya dosya kaldırılmış olabilir.", "error");
    } finally { setBusy(false); }
  };
  if (iconOnly) return <IconAction icon={Icon} label={`${asset.fileName}: ${label}`} onClick={run} disabled={busy} />;
  return <Btn size="sm" variant="secondary" onClick={run} disabled={busy}><Icon size={13} />{label}</Btn>;
}

function AssetThumbnail({ asset, url }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed && IMAGE_PREVIEW.has(asset.mimeType)) return <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="h-10 w-10 rounded-lg object-cover border border-slate-100 bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:10px_10px] shrink-0" />;
  return <FileTypeTile type={asset.fileType} size={40} />;
}

const guessCategory = (label, name) => (/logo/i.test(name) && (label === "Görsel" || label === "Vektör") ? "logos" : { Font: "fonts", Vektör: "logos", PDF: "identity", Şablon: "social_templates", Video: "media", Görsel: "media" }[label] || "other");

function UploadForm({ kit, defaultCategory, onDone }) {
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState({ category: defaultCategory || "logos", description: "", visibility: "shared" });
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef(null);
  const busy = progress !== null && !failed;
  useEffect(() => {
    const key = `${kit.brandId}:upload`;
    if (file && !busy) dirtyKitForms.add(key); else dirtyKitForms.delete(key);
    syncKitUnloadGuard();
    return () => { dirtyKitForms.delete(key); syncKitUnloadGuard(); };
  }, [file, busy, kit.brandId]);
  const pick = (f) => {
    if (!f) return;
    const v = validateUpload(f);
    if (!v.ok) { setError(v.error); setFile(null); return; }
    setError(""); setFailed(false); setProgress(null); setFile(f);
    if (!defaultCategory) setMeta((m) => ({ ...m, category: guessCategory(v.label, f.name) }));
  };
  const start = async () => {
    if (!file || busy) return;
    setFailed(false); setError(""); setProgress(0);
    try {
      await kit.upload(file, { ...meta, description: meta.description.trim() }, (p) => setProgress(p));
      setFile(null); setProgress(null);
      onDone(`“${file.name}” yüklendi.`);
    } catch (err) {
      setFailed(true); setError(err?.message || "Yükleme başarısız.");
    }
  };
  return (
    <div className={kitFormCls}>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept={ACCEPT_ATTR} hidden onChange={(e) => { pick(e.target.files && e.target.files[0]); e.target.value = ""; }} data-kit-file-input="" />
        <Btn size="sm" variant="secondary" disabled={busy} onClick={() => inputRef.current && inputRef.current.click()}><Upload size={13} />Dosya Seç</Btn>
        <span className="flex-1 min-w-0 cw-12 text-slate-600 truncate">{file ? `${file.name} · ${formatBytes(file.size)}` : `PNG, JPG, SVG, PDF, font, ZIP, PSD, video… En fazla ${MAX_BRAND_FILE_BYTES / 1024 / 1024} MB.`}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Kategori"><select value={meta.category} disabled={busy} onChange={(e) => setMeta((m) => ({ ...m, category: e.target.value }))} className={inputCls()}>{Object.entries(ASSET_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Görünürlük"><select value={meta.visibility} disabled={busy} onChange={(e) => setMeta((m) => ({ ...m, visibility: e.target.value }))} className={inputCls()}>{Object.entries(VISIBILITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Açıklama (isteğe bağlı)"><input value={meta.description} disabled={busy} maxLength={500} onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))} className={inputCls()} /></Field>
      </div>
      {progress !== null && (
        <div className="space-y-1" aria-live="polite">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-label="Yükleme ilerlemesi" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full transition-all ${failed ? "bg-red-500" : "bg-orange-500"}`} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="cw-11 text-slate-500 tabular-nums">{failed ? "Yükleme tamamlanamadı." : `Yükleniyor… %${Math.round(progress * 100)}`}</p>
        </div>
      )}
      {error && <p className="cw-12 text-red-600" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Btn size="sm" variant="ghost" disabled={busy} onClick={() => onDone()}>Vazgeç</Btn>
        <Btn size="sm" variant="primary" disabled={!file || busy} onClick={start}>{failed ? <><RefreshCw size={13} />Tekrar Dene</> : busy ? "Yükleniyor…" : <><Upload size={13} />Yükle</>}</Btn>
      </div>
    </div>
  );
}

function AssetEditForm({ kit, asset, onDone }) {
  const initial = useMemo(() => ({ category: asset.category, description: asset.description, visibility: asset.visibility }), [asset]);
  const { values: v, set, dirty, discard } = useKitForm(`${kit.brandId}:asset:${asset.id}`, initial);
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await kit.save("assets", { ...asset, ...v, description: v.description.trim() }, "Dosya bilgileri güncellendi."); discard(); onDone(); } catch { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className={`${kitFormCls} mt-2`} aria-label="Dosya bilgilerini düzenle">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Kategori"><select value={v.category} onChange={(e) => set("category", e.target.value)} className={inputCls()}>{Object.entries(ASSET_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Görünürlük"><select value={v.visibility} onChange={(e) => set("visibility", e.target.value)} className={inputCls()}>{Object.entries(VISIBILITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Açıklama"><input value={v.description} maxLength={500} onChange={(e) => set("description", e.target.value)} className={inputCls()} /></Field>
      </div>
      <KitFormActions dirty={dirty} saving={saving} onCancel={() => { discard(); onDone(); }} />
    </form>
  );
}

function AssetsSection({ kit }) {
  const { notify } = useWS();
  const [filter, setFilter] = usePersisted(`${kit.brandId}:assets:filter`, "all");
  const [editing, setEditing] = usePersisted(`${kit.brandId}:assets:editing`, null);
  const [uploading, setUploading] = useState(false);
  const [thumbs, setThumbs] = useState({});
  const assets = kit.data.assets;
  const shown = (filter === "all" ? assets : assets.filter((a) => a.category === filter)).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const imageKey = assets.filter((a) => IMAGE_PREVIEW.has(a.mimeType)).map((a) => a.id).join(",");
  useEffect(() => {
    const imgs = assets.filter((a) => IMAGE_PREVIEW.has(a.mimeType) && !thumbs[a.id]);
    if (!imgs.length) return undefined;
    let alive = true;
    kit.fileUrls(imgs).then((m) => { if (alive) setThumbs((t) => ({ ...t, ...m })); }).catch(() => {});
    return () => { alive = false; };
  }, [imageKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = assets.reduce((m, a) => ({ ...m, [a.category]: (m[a.category] || 0) + 1 }), {});
  return (
    <KitSection id={`kit-assets-${kit.brandId}`} icon={FolderOpen} title="Kurumsal Dosyalar & Varlıklar" count={assets.length}
      description="Dosyalar özel depoda saklanır; açma ve indirme bağlantıları kısa süreli ve yetkiye bağlıdır."
      action={kit.canEdit && !uploading && <Btn size="sm" variant="secondary" onClick={() => setUploading(true)}><Upload size={13} />Dosya Yükle</Btn>}>
      {uploading && <div className="mb-3"><UploadForm kit={kit} defaultCategory={filter !== "all" ? filter : null} onDone={(msg) => { setUploading(false); if (msg) notify(msg); }} /></div>}
      {assets.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto cw-scroll pb-2 mb-1" role="group" aria-label="Kategoriye göre filtrele">
          {[["all", "Tümü", assets.length], ...Object.entries(ASSET_CATEGORIES).filter(([k]) => counts[k]).map(([k, l]) => [k, l, counts[k]])].map(([k, l, n]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`shrink-0 h-7 px-2.5 rounded-full border cw-11 font-semibold whitespace-nowrap transition-colors ${filter === k ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{l} <span className="opacity-60 tabular-nums">{n}</span></button>
          ))}
        </div>
      )}
      {shown.length ? (
        <ul className="divide-y divide-slate-100">
          {shown.map((a) => (
            <li key={a.id} data-kit-asset={a.fileName} className="py-2.5">
              <div className="flex items-start gap-3 min-w-0">
                <AssetThumbnail asset={a} url={thumbs[a.id]} />
                <div className="flex-1 min-w-0">
                  <p className="cw-13 font-medium text-slate-900 truncate flex items-center gap-1.5" title={a.fileName}><span className="truncate">{a.fileName}</span><VisibilityBadge visibility={a.visibility} /></p>
                  <p className="cw-11 text-slate-500 flex flex-wrap gap-x-1.5">
                    <span>{ASSET_CATEGORIES[a.category]}</span><span aria-hidden="true">·</span><span>{a.fileType}</span><span aria-hidden="true">·</span><span>{formatBytes(a.fileSize)}</span>
                    <span aria-hidden="true">·</span><span>{fmtDateLong(String(a.createdAt).slice(0, 10))}</span>{USER_BY_ID[a.uploadedBy] && <><span aria-hidden="true">·</span><span>{USER_BY_ID[a.uploadedBy].name}</span></>}
                  </p>
                  {a.description && <p className="cw-12 text-slate-600 mt-0.5">{a.description}</p>}
                </div>
                <div className="shrink-0 flex items-center">
                  {INLINE_VIEWABLE.has(a.mimeType) && <AssetActionButton kit={kit} asset={a} mode="open" label="Görüntüle" iconOnly />}
                  <AssetActionButton kit={kit} asset={a} mode="download" label="İndir" iconOnly />
                  {kit.canEdit && <IconAction icon={Pencil} label={`${a.fileName}: bilgileri düzenle`} onClick={() => setEditing(editing === a.id ? null : a.id)} />}
                  {kit.canEdit && <DeleteAction label={`${a.fileName} dosyasını sil`} onConfirm={() => kit.remove("assets", a, "Dosya silindi.")} />}
                </div>
              </div>
              {editing === a.id && <AssetEditForm kit={kit} asset={a} onDone={() => setEditing(null)} />}
            </li>
          ))}
        </ul>
      ) : <KitEmpty>{assets.length ? "Bu kategoride dosya yok." : "Henüz kurumsal dosya eklenmemiş."}</KitEmpty>}
    </KitSection>
  );
}

/* ───────────────────────── Google Drive bağlantıları ───────────────────────── */

function LinkForm({ kit, link, onDone }) {
  const initial = useMemo(() => ({ title: link?.title || "", url: link?.url || "", category: link?.category || "general", description: link?.description || "", visibility: link?.visibility || "shared" }), [link]);
  const { values: v, set, dirty, discard } = useKitForm(`${kit.brandId}:link:${link?.id || "new"}`, initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!v.title.trim()) err.title = "Bağlantı başlığı zorunludur.";
    const u = validateDriveUrl(v.url);
    if (!u.ok) err.url = u.error;
    else if (kit.data.links.some((l) => l.url === u.url && l.id !== link?.id)) err.url = "Bu bağlantı zaten ekli.";
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try { await kit.save("links", { id: link?.id || uid(), title: v.title.trim(), url: u.url, category: v.category, description: v.description.trim(), visibility: v.visibility }, link ? "Bağlantı güncellendi." : "Drive bağlantısı eklendi."); discard(); onDone(); }
    catch { setSaving(false); }
  };
  return (
    <form onSubmit={submit} noValidate className={kitFormCls} aria-label={link ? "Bağlantıyı düzenle" : "Yeni Drive bağlantısı"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bağlantı Başlığı" error={errors.title}><input autoFocus value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="örn. Kurumsal Drive" className={inputCls(errors.title)} /></Field>
        <Field label="Google Drive URL" error={errors.url}><input value={v.url} onChange={(e) => set("url", e.target.value)} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" className={inputCls(errors.url)} /></Field>
        <Field label="Kategori"><select value={v.category} onChange={(e) => set("category", e.target.value)} className={inputCls()}>{Object.entries(LINK_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Görünürlük"><select value={v.visibility} onChange={(e) => set("visibility", e.target.value)} className={inputCls()}>{Object.entries(VISIBILITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Açıklama" full><input value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={500} placeholder="örn. Logo dosyaları ve güncel tasarım materyalleri" className={inputCls()} /></Field>
      </div>
      <KitFormActions dirty={dirty} saving={saving} onCancel={() => { discard(); onDone(); }} submitLabel={link ? "Kaydet" : "Bağlantıyı Ekle"} />
    </form>
  );
}

function DriveLinkRow({ link, actions, compact }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="h-9 w-9 shrink-0 rounded-lg bg-emerald-50 text-emerald-600 inline-flex items-center justify-center"><HardDrive size={16} /></span>
      <div className="flex-1 min-w-0">
        <p className="cw-13 font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">{link.title}<VisibilityBadge visibility={link.visibility} /></p>
        <p className="cw-11 text-slate-500">{LINK_CATEGORIES[link.category]}</p>
        {!compact && link.description && <p className="cw-12 text-slate-600 mt-0.5">{link.description}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-0.5">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 cw-12 font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300" aria-label={`${link.title}: Drive'da aç (yeni sekme)`}>
          <ExternalLink size={13} /><span className={compact ? "sr-only sm:not-sr-only" : ""}>Drive'da Aç</span>
        </a>
        {actions}
      </div>
    </div>
  );
}

function LinksSection({ kit }) {
  const [editing, setEditing] = usePersisted(`${kit.brandId}:links:editing`, null);
  const links = kit.data.links;
  return (
    <KitSection id={`kit-links-${kit.brandId}`} icon={HardDrive} title="Google Drive Bağlantıları" count={links.length}
      description="Bağlantılar yeni sekmede açılır. Dosyalara erişim Drive'daki paylaşım ayarlarına bağlıdır."
      action={kit.canEdit && editing !== "new" && <Btn size="sm" variant="secondary" onClick={() => setEditing("new")}><Plus size={13} />Bağlantı Ekle</Btn>}>
      {editing === "new" && <div className="mb-3"><LinkForm kit={kit} onDone={() => setEditing(null)} /></div>}
      {links.length ? (
        <ul className="divide-y divide-slate-100">
          {links.map((l) => (
            <li key={l.id} className="py-2.5 first:pt-0 last:pb-0">
              {editing === l.id ? <LinkForm kit={kit} link={l} onDone={() => setEditing(null)} /> : (
                <DriveLinkRow link={l} actions={kit.canEdit && <><IconAction icon={Pencil} label={`${l.title} bağlantısını düzenle`} onClick={() => setEditing(l.id)} /><DeleteAction label={`${l.title} bağlantısını sil`} onConfirm={() => kit.remove("links", l, "Bağlantı kaldırıldı.")} /></>} />
              )}
            </li>
          ))}
        </ul>
      ) : editing !== "new" && <KitEmpty>Bu markaya ait Drive bağlantısı bulunmuyor.</KitEmpty>}
    </KitSection>
  );
}

/* ───────────────────────── Kılavuz görünümü ───────────────────────── */

function KitSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Marka kılavuzu yükleniyor">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
          <div className="h-4 w-44 rounded bg-slate-200" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((j) => <div key={j} className="h-16 rounded-lg bg-slate-100" />)}</div>
        </div>
      ))}
    </div>
  );
}

function KitState({ kit, brand }) {
  if (kit.status === "unavailable") return <EmptyBlock icon={BookOpen} title="Marka kılavuzu kullanılamıyor" text="Veri kaynağı marka kılavuzunu desteklemiyor." />;
  if (kit.status === "denied") return <EmptyBlock icon={Lock} title="Bu markanın kılavuzunu görüntüleme yetkiniz yok" text="Erişim için ajans yöneticinizle iletişime geçin." />;
  if (kit.status === "error" && !kit.data) return <EmptyBlock icon={AlertTriangle} title="Marka kılavuzu yüklenemedi" text={kit.error?.message} action={<Btn variant="secondary" onClick={kit.reload}><RefreshCw size={14} />Tekrar Dene</Btn>} />;
  if (!kit.data) return <KitSkeleton />;
  if (!kit.data.kit) {
    return (
      <EmptyBlock icon={BookOpen} title="Bu marka için henüz marka kılavuzu oluşturulmamış."
        text={kit.canEdit ? `${brand?.name || "Marka"} için renkler, fontlar, tasarım kuralları ve kurumsal dosyalar tek yerde toplanır.` : "Kılavuz oluşturulduğunda burada görünecek."}
        action={kit.canEdit && <CreateKitButton kit={kit} />} />
    );
  }
  return null;
}

function CreateKitButton({ kit }) {
  const [busy, setBusy] = useState(false);
  return <Btn variant="primary" disabled={busy} onClick={async () => { setBusy(true); try { await kit.createKit(); } catch { setBusy(false); } }}><Plus size={14} />Marka Kılavuzu Oluştur</Btn>;
}

function KitMeta({ kit }) {
  const k = kit.data.kit;
  return (
    <p className="cw-11 text-slate-500">
      Son güncelleme: {fmtDateTime(k.updatedAt)}{USER_BY_ID[k.updatedBy] ? ` · ${USER_BY_ID[k.updatedBy].name}` : ""}
      {!kit.canEdit && <span className="ml-1.5 inline-flex items-center gap-1 text-slate-400"><Eye size={11} />Salt okunur</span>}
    </p>
  );
}

function BrandKitView({ brandId }) {
  const { brandsById } = useWS();
  const kit = useBrandKit(brandId);
  const brand = brandsById[brandId];
  const state = <KitState kit={kit} brand={brand} />;
  if (!kit.data || !kit.data.kit || kit.status === "denied") return <div className="space-y-4" data-brand-kit={brandId}>{state}<ChecklistTemplatesSection brandId={brandId} /></div>;
  return (
    <div className="space-y-4" data-brand-kit={brandId}>
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 sm:px-5 py-3.5">
        <BrandLogo brand={brand} size={40} />
        <div className="flex-1 min-w-[12rem]">
          <h2 className="text-base font-bold text-slate-900">{brand?.name} · Marka Kılavuzu</h2>
          <KitMeta kit={kit} />
        </div>
      </div>
      <ColorsSection kit={kit} />
      <FontsSection kit={kit} />
      <InstructionsSection kit={kit} />
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <AssetsSection kit={kit} />
        <LinksSection kit={kit} />
      </div>
      <ChecklistTemplatesSection brandId={brandId} />
    </div>
  );
}

/* Tüm markalar seçiliyken kılavuz sekmesi: marka seçimi. */
function BrandKitPicker({ brands, onPick }) {
  if (!brands.length) return <EmptyBlock icon={BookOpen} title="Görüntülenebilecek marka yok" />;
  return (
    <div className="space-y-3">
      <p className="cw-13 text-slate-600">Kılavuzunu görmek istediğiniz markayı seçin.</p>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {brands.map((b) => (
          <button key={b.id} type="button" onClick={() => onPick(b.id)} className="flex items-center gap-3 p-3.5 text-left bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-[border-color,box-shadow] duration-150 min-w-0">
            <BrandLogo brand={b} size={36} />
            <span className="flex-1 min-w-0"><span className="block cw-13 font-semibold text-slate-900 truncate">{b.name}</span><span className="block cw-11 text-slate-500 truncate">{b.sector}</span></span>
            <span className="inline-flex items-center gap-1 cw-12 font-semibold text-orange-700"><BookOpen size={14} />Kılavuzu Aç</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Görev içinden hızlı erişim ───────────────────────── */

/* Görevden ayrılmadan kılavuz: görev çekmecesinin üzerinde açılır (görev ve yazılmamış başlık/açıklama yerinde
   kalır), kapanınca görev durumuna dokunulmaz. Mobilde tam ekran. */
function BrandKitDrawer({ brandId, onClose }) {
  const { brandsById } = useWS();
  const kit = useBrandKit(brandId);
  const brand = brandsById[brandId];
  const ref = useRef(null);
  const [showAll, setShowAll] = useState(false);
  useFocusTrap(ref);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || document.querySelector("[data-cw-popover]")) return;
      e.stopPropagation(); onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const d = kit.data && kit.data.kit ? kit.data : null;
  const byCategory = (c) => (d ? d.instructions.filter((i) => i.category === c && !i.important).sort(bySortOrder) : []);
  const important = d ? d.instructions.filter((i) => i.important).sort(bySortOrder) : [];
  const tone = byCategory("content");
  const design = byCategory("design");
  const requests = byCategory("client");
  const assetsById = d ? Object.fromEntries(d.assets.map((a) => [a.id, a])) : {};
  return createPortal(
    <div className="cw-root fixed inset-0" style={{ zIndex: 55 }} data-cw-modal="">
      <div className="absolute inset-0 bg-slate-900/10" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${brand?.name || "Marka"} kılavuzu`} className="cw-drawer outline-none absolute inset-y-0 right-0 w-full sm:w-[440px] bg-slate-50 border-l border-slate-200 shadow-2xl flex flex-col">
        <div className="shrink-0 h-14 flex items-center gap-2.5 px-4 bg-white border-b border-slate-200">
          <BrandLogo brand={brand} size={28} />
          <div className="flex-1 min-w-0">
            <p className="cw-13 font-bold text-slate-900 truncate">{brand?.name}</p>
            <p className="cw-11 text-slate-500">Marka Kılavuzu</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Kılavuzu kapat" title="Kapat (Esc)"><X size={17} /></button>
        </div>
        <div className="flex-1 overflow-y-auto cw-scroll p-4 space-y-4">
          {!d ? <KitState kit={{ ...kit, canEdit: false }} brand={brand} /> : (
            <>
              <QuickBlock title="Renkler" icon={Palette}>
                {d.colors.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {d.colors.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white min-w-0">
                        <span className="h-9 w-9 shrink-0 rounded-md border border-black/5" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                        <div className="min-w-0"><p className="cw-11 font-semibold text-slate-800 truncate" title={c.name}>{c.name}</p><CopyHex hex={c.hex} size="sm" /></div>
                      </div>
                    ))}
                  </div>
                ) : <KitEmpty>Renk tanımlanmamış.</KitEmpty>}
              </QuickBlock>
              <QuickBlock title="Tipografi" icon={Type}>
                {d.fonts.length ? d.fonts.map((f) => (
                  <div key={f.id} className="p-2.5 rounded-lg border border-slate-200 bg-white">
                    <p className="cw-12 font-bold text-slate-900">{f.family} <span className="font-medium text-slate-400">— {FONT_ROLES[f.role]}{f.weights.length ? ` · ${f.weights.join(" / ")}` : ""}</span></p>
                    <FontPreview kit={kit} font={f} asset={assetsById[f.assetId]} compact />
                    {f.usage && <p className="cw-11 text-slate-600 mt-1">{f.usage}</p>}
                  </div>
                )) : <KitEmpty>Font tanımlanmamış.</KitEmpty>}
              </QuickBlock>
              {important.length > 0 && <QuickBlock title="Önemli Talimatlar" icon={Star}>{important.map((i) => <InstructionItem key={i.id} kit={kit} item={i} compact />)}</QuickBlock>}
              {(tone.length > 0 || !d.instructions.some((i) => i.category === "content")) && (
                <QuickBlock title="İçerik & İletişim Dili" icon={MessageSquare}>
                  {tone.length ? tone.map((i) => <InstructionItem key={i.id} kit={kit} item={i} compact />) : <KitEmpty>İçerik kuralı eklenmemiş.</KitEmpty>}
                </QuickBlock>
              )}
              {design.length > 0 && (
                <QuickBlock title="Tasarım Kuralları" icon={PenTool}>
                  {(showAll || design.length <= 3 ? design : design.slice(0, 3)).map((i) => <InstructionItem key={i.id} kit={kit} item={i} compact />)}
                  {!showAll && design.length > 3 && <Btn size="sm" variant="secondary" onClick={() => setShowAll(true)}><ChevronDown size={13} />{design.length - 3} kural daha</Btn>}
                </QuickBlock>
              )}
              {requests.length > 0 && <QuickBlock title="Müşteri Özel Talepleri" icon={ClipboardList}>{requests.map((i) => <InstructionItem key={i.id} kit={kit} item={i} compact />)}</QuickBlock>}
              <QuickBlock title="Dosyalar & Bağlantılar" icon={FolderOpen}>
                {d.assets.length || d.links.length ? (
                  <div className="space-y-1.5">
                    {d.assets.slice(0, 8).map((a) => (
                      <div key={a.id} className="flex items-center gap-2 p-1.5 pl-2 rounded-lg border border-slate-200 bg-white min-w-0">
                        <FileTypeTile type={a.fileType} size={28} />
                        <span className="flex-1 min-w-0"><span className="block cw-12 font-medium text-slate-800 truncate" title={a.fileName}>{a.fileName}</span><span className="block cw-10 text-slate-400">{ASSET_CATEGORIES[a.category]}</span></span>
                        {INLINE_VIEWABLE.has(a.mimeType) && <AssetActionButton kit={kit} asset={a} mode="open" label="Görüntüle" iconOnly />}
                        <AssetActionButton kit={kit} asset={a} mode="download" label="İndir" iconOnly />
                      </div>
                    ))}
                    {d.links.map((l) => <div key={l.id} className="p-2 rounded-lg border border-slate-200 bg-white"><DriveLinkRow link={l} compact /></div>)}
                  </div>
                ) : <KitEmpty>Henüz kurumsal dosya eklenmemiş.</KitEmpty>}
              </QuickBlock>
              <div className="text-slate-400"><KitMeta kit={{ ...kit, canEdit: true }} /></div>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function QuickBlock({ title, icon: Icon, children }) {
  return (
    <section>
      <h4 className="flex items-center gap-1.5 mb-2 cw-11 font-semibold uppercase tracking-wide text-slate-500"><Icon size={12} className="text-slate-400" />{title}</h4>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/* ───────────────────────── İçerik üretim kontrol listesi ───────────────────────── */

const CHECK_TONES = {
  not_started: "text-slate-600 bg-slate-100 border-slate-200",
  checking: "text-amber-700 bg-amber-50 border-amber-200",
  complete: "text-emerald-700 bg-emerald-50 border-emerald-200",
  ready: "text-emerald-700 bg-emerald-50 border-emerald-200",
};
const CHECK_BAR = { not_started: "bg-slate-300", checking: "bg-amber-500", complete: "bg-emerald-500", ready: "bg-emerald-500" };

/* Görev satırındaki küçük gösterge: "8/12". Yalnızca kontrol listesi olan açık görevlerde görünür. */
function ChecklistIndicator({ task }) {
  const { checklistIndex } = useWS();
  const entry = checklistIndex && checklistIndex[task.id];
  if (!entry || !entry.items.length || task.checklistDisabled || task.status === "Tamamlandı") return null;
  const s = checklistSummary(entry.checklist, entry.items, task);
  const tone = !s.missing.length ? "text-emerald-600" : s.done ? "text-amber-600" : "text-slate-400";
  const label = `Kontrol: ${s.done}/${s.total} · ${s.label}${s.cycle ? ` · Revizyon ${s.cycle}` : ""}`;
  return (
    <span className={`shrink-0 inline-flex items-center gap-0.5 cw-11 font-semibold tabular-nums ${tone}`} title={label} data-checklist-indicator={`${s.done}/${s.total}`}>
      <ListChecks size={12} aria-hidden="true" /><span className="sr-only">Kontrol: </span>{s.done}/{s.total}
    </span>
  );
}

/* Yazılıp kaydedilmemiş notlar (çekmece kapanıp açılsa da kaybolmaz). */
const checkNoteDrafts = new Map();

function ChecklistItemRow({ item, editable, canUncomplete, missing, onToggle, onSaveNote }) {
  const [noteOpen, setNoteOpen] = useState(() => checkNoteDrafts.has(item.id));
  const [draft, setDraftRaw] = useState(() => (checkNoteDrafts.has(item.id) ? checkNoteDrafts.get(item.id) : item.note));
  useEffect(() => { if (!noteOpen) setDraftRaw(item.note); }, [item.note, noteOpen]);
  const setDraft = (v) => { setDraftRaw(v); if (v !== item.note) checkNoteDrafts.set(item.id, v); else checkNoteDrafts.delete(item.id); };
  const closeNote = () => { checkNoteDrafts.delete(item.id); setNoteOpen(false); setDraftRaw(item.note); };
  const saveNote = (e) => { e.preventDefault(); if (draft.trim() !== item.note) onSaveNote(item, draft); closeNote(); };
  const disabled = !editable || (item.isCompleted && !canUncomplete);
  const by = USER_BY_ID[item.completedBy];
  const why = !editable ? "Bu kontrolü değiştiremezsiniz" : item.isCompleted && !canUncomplete ? "Başka bir kullanıcının tamamladığı kontrolü yalnızca yönetici geri alabilir" : undefined;
  return (
    <li data-check-item={item.id} data-missing={missing ? "true" : undefined} className={`group/ci px-3.5 py-2 transition-colors ${missing ? "bg-red-50/80" : ""}`}>
      <div className="flex items-start gap-2.5">
        <button
          type="button" role="checkbox" aria-checked={item.isCompleted} aria-label={item.title} aria-describedby={missing ? `miss-${item.id}` : undefined}
          disabled={disabled} title={why} onClick={() => onToggle(item)}
          className="shrink-0 -m-2 p-2 sm:-m-1 sm:p-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed"
        >
          <span className={`h-[18px] w-[18px] rounded-[5px] border flex items-center justify-center transition-colors ${item.isCompleted ? "bg-emerald-600 border-emerald-600 text-white" : missing ? "bg-white border-red-400" : "bg-white border-slate-300 group-hover/ci:border-slate-400"} ${disabled ? "opacity-60" : ""}`}>
            {item.isCompleted && <Check size={12} strokeWidth={3} aria-hidden="true" />}
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5">
            <p onClick={disabled ? undefined : () => onToggle(item)} className={`flex-1 min-w-0 cw-13 break-words ${item.isCompleted ? "text-slate-500" : "text-slate-800"} ${disabled ? "" : "cursor-pointer"}`}>{item.title}</p>
            {item.isRequired
              ? <span className={`shrink-0 mt-px h-[18px] px-1.5 inline-flex items-center rounded cw-10 font-semibold ${missing ? "text-red-700 bg-red-100" : "text-slate-600 bg-slate-100"}`}>Zorunlu</span>
              : <span className="shrink-0 mt-px h-[18px] inline-flex items-center cw-10 text-slate-400">İsteğe bağlı</span>}
            {editable && !noteOpen && (
              <button type="button" onClick={() => setNoteOpen(true)} aria-label={item.note ? `“${item.title}” notunu düzenle` : `“${item.title}” için not ekle`} title={item.note ? "Notu düzenle" : "Not ekle"}
                className={`shrink-0 -my-1 h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:opacity-100 ${item.note ? "" : "sm:opacity-0 sm:group-hover/ci:opacity-100"}`}>
                <MessageSquare size={13} />
              </button>
            )}
          </div>
          {item.description && <p className="cw-11 text-slate-500 mt-0.5 break-words">{item.description}</p>}
          {missing && <p id={`miss-${item.id}`} className="cw-11 font-semibold text-red-600 mt-0.5">Onaya göndermeden önce tamamlanmalı.</p>}
          {item.isCompleted && (
            <p className="cw-11 text-slate-400 mt-0.5 flex items-center gap-1 min-w-0">
              <Avatar userId={item.completedBy} size={14} /><span className="truncate">{by?.name || "Ekip üyesi"}</span><span aria-hidden="true">·</span><span className="shrink-0">{fmtDateTime(item.completedAt)}</span>
            </p>
          )}
          {item.note && !noteOpen && (
            <p className="mt-1 cw-12 text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 whitespace-pre-wrap break-words"><span className="sr-only">Not: </span>{item.note}</p>
          )}
          {noteOpen && (
            <form onSubmit={saveNote} className="mt-1.5 space-y-1.5">
              <textarea
                autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={1000} aria-label={`“${item.title}” notu`}
                placeholder="Ekip içi not (müşteri görmez)"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveNote(e); if (e.key === "Escape") { e.stopPropagation(); closeNote(); } }}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 cw-12 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-y"
              />
              <div className="flex items-center justify-end gap-1.5">
                <span className="mr-auto cw-10 text-slate-400 inline-flex items-center gap-1"><Lock size={9} />Yalnızca ekip görür</span>
                <Btn size="sm" variant="ghost" className="h-7" onClick={closeNote}>Vazgeç</Btn>
                <Btn size="sm" variant="primary" className="h-7" type="submit">Notu Kaydet</Btn>
              </div>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}

/* Görev detayındaki kontrol listesi: ilerleme, kategoriler (mobilde katlanır), işaretleme, notlar ve geçmiş. */
function ChecklistSection({ task, sectionRef, focusKey }) {
  const { state, actor, role, dispatch, checklistApi, checklistIndex, ensureChecklist, updateTask, previewOnly } = useWS();
  const visible = !!checklistApi && canViewChecklist(actor, task, state);
  const entry = checklistIndex[task.id];
  const hasEntry = !!entry;
  const [ensure, setEnsure] = useState({ status: "idle", error: null, n: 0 });
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [highlight, setHighlight] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const isMobile = useMediaQuery("(max-width: 639px)");

  useEffect(() => {
    if (!visible || hasEntry || task.checklistDisabled) return undefined;
    let alive = true;
    setEnsure((e) => ({ ...e, status: "loading", error: null }));
    ensureChecklist(task).then(
      () => { if (alive) setEnsure((e) => ({ ...e, status: "done" })); },
      (error) => { if (alive) setEnsure((e) => ({ ...e, status: "error", error })); },
    );
    return () => { alive = false; };
  }, [visible, hasEntry, task.id, task.checklistDisabled, ensure.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Onaya gönderim eksik kontrol nedeniyle durdurulduysa: bölüm açılır, eksikler vurgulanır ve görünür alana kaydırılır.
  useEffect(() => {
    if (!focusKey) return undefined;
    setOpen(true); setHighlight(true); setCollapsed({});
    const t = setTimeout(() => { if (sectionRef.current) sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
    return () => clearTimeout(t);
  }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = entry ? entry.items : EMPTY;
  const summary = entry ? checklistSummary(entry.checklist, items, task) : null;
  const missingCount = summary ? summary.missing.length : 0;
  useEffect(() => { if (highlight && summary && !missingCount) setHighlight(false); }, [highlight, summary, missingCount]);

  if (!visible) return null;

  const admin = role === "admin";
  const canWork = !previewOnly && canWorkChecklist(actor, task, state);
  const locked = LOCKED_STATUSES.has(task.status) && !admin;
  const editable = canWork && !locked;
  const missingIds = new Set(highlight && summary ? summary.missing.map((i) => i.id) : []);
  const toggle = (item) => dispatch({ type: "TOGGLE_CHECK", itemId: item.id, completed: !item.isCompleted });
  const saveNote = (item, note) => dispatch({ type: "SET_CHECK_NOTE", itemId: item.id, note });
  const groups = Object.keys(CHECK_CATEGORIES).map((k) => [k, items.filter((i) => i.category === k)]).filter(([, list]) => list.length);
  const pastCycles = (state.checklists || EMPTY).filter((c) => c.taskId === task.id && c.closedAt).length;
  const bodyId = `cl-body-${task.id}`;

  let body;
  if (task.checklistDisabled) {
    body = (
      <div className="px-3.5 py-3 flex flex-wrap items-center gap-2 cw-12 text-slate-600">
        <span className="flex-1 min-w-[12rem]">Bu görev için kontrol listesi kapalı; onaya gönderimde kontrol yapılmaz.</span>
        {admin && <Btn size="sm" variant="secondary" onClick={() => updateTask(task.id, { checklistDisabled: false }, "Kontrol listesi açıldı.")}><ListChecks size={13} />Kontrol Listesini Aç</Btn>}
      </div>
    );
  } else if (!entry) {
    body = ensure.status === "error" ? (
      <div className="px-3.5 py-3 flex flex-wrap items-center gap-2 cw-12 text-red-700" role="alert">
        <AlertTriangle size={14} /><span className="flex-1 min-w-[12rem]">Kontrol listesi yüklenemedi. {ensure.error?.message}</span>
        <Btn size="sm" variant="secondary" onClick={() => setEnsure((e) => ({ ...e, n: e.n + 1 }))}><RefreshCw size={13} />Tekrar Dene</Btn>
      </div>
    ) : ensure.status === "done" ? (
      <p className="px-3.5 py-3 cw-12 text-slate-500">“{task.format}” görev türü için tanımlı bir kontrol listesi şablonu yok.</p>
    ) : (
      <div className="px-3.5 py-3 space-y-2" aria-busy="true" aria-label="Kontrol listesi yükleniyor">
        {[0, 1, 2].map((i) => <div key={i} className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${80 - i * 15}%` }} />)}
      </div>
    );
  } else {
    body = (
      <>
        {highlight && missingCount > 0 && (
          <p role="alert" className="mx-3.5 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 cw-12 font-medium text-red-800">
            <AlertTriangle size={14} className="shrink-0 mt-px" />{incompleteMessage(missingCount)}
          </p>
        )}
        {locked && canViewChecklist(actor, task, state) && (
          <p className="mx-3.5 mt-3 flex items-center gap-1.5 cw-11 text-slate-500"><Lock size={11} />İçerik onaya gönderildi; kontroller kilitli.</p>
        )}
        {!canWork && !locked && <p className="mx-3.5 mt-3 flex items-center gap-1.5 cw-11 text-slate-500"><Eye size={11} />Salt okunur</p>}
        <div className="mt-1">
          {groups.map(([k, list]) => {
            const done = list.filter((i) => i.isCompleted).length;
            const hasMissing = list.some((i) => missingIds.has(i.id));
            const isCollapsed = collapsed[k] ?? (isMobile && done === list.length && !hasMissing);
            return (
              <div key={k} className="border-t border-slate-100 first:border-t-0" data-check-group={k}>
                <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [k]: !isCollapsed }))} aria-expanded={!isCollapsed}
                  className="w-full flex items-center gap-1.5 px-3.5 h-10 sm:h-8 text-left hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50">
                  <ChevronRight size={13} className={`text-slate-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                  <span className="cw-11 font-semibold uppercase tracking-wide text-slate-500">{CHECK_CATEGORIES[k]}</span>
                  {hasMissing && <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="Eksik zorunlu kontrol var" />}
                  <span className={`ml-auto cw-11 font-semibold tabular-nums ${done === list.length ? "text-emerald-600" : "text-slate-400"}`}>{done}/{list.length}</span>
                </button>
                {!isCollapsed && (
                  <ul className="pb-1.5">
                    {list.map((item) => (
                      <ChecklistItemRow key={item.id} item={item} editable={editable} missing={missingIds.has(item.id)}
                        canUncomplete={admin || !item.completedBy || item.completedBy === actor.id} onToggle={toggle} onSaveNote={saveNote} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2 border-t border-slate-100 bg-slate-50/60 rounded-b-xl">
          <button type="button" onClick={() => setShowHistory((s) => !s)} aria-expanded={showHistory} className="h-7 inline-flex items-center gap-1.5 px-1.5 -ml-1.5 rounded-md cw-12 font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100">
            <History size={13} />Kontrol Geçmişi{pastCycles > 0 && <span className="cw-11 text-slate-400">· {pastCycles} önceki döngü</span>}
          </button>
          <span className="flex-1" />
          <span className="cw-11 text-slate-400 truncate max-w-full" title="Görev oluşturulduğundaki şablon; şablon sonradan değişse de bu liste değişmez.">{entry.checklist.templateName} · s{entry.checklist.templateVersion}</span>
          {admin && !LOCKED_STATUSES.has(task.status) && (
            <button type="button" onClick={() => updateTask(task.id, { checklistDisabled: true }, "Kontrol listesi bu görev için kapatıldı.")} className="h-7 px-1.5 rounded-md cw-11 font-medium text-slate-500 hover:text-red-600 hover:bg-red-50">Bu görevde kapat</button>
          )}
        </div>
        {showHistory && <ChecklistHistory task={task} />}
      </>
    );
  }

  return (
    <section ref={sectionRef} style={{ scrollMarginTop: 12 }} aria-labelledby={`cl-title-${task.id}`} data-checklist={task.id}
      className={`rounded-xl border bg-white transition-shadow ${highlight && missingCount ? "border-red-200 shadow-[0_0_0_3px_#fee2e2]" : "border-slate-200"}`}>
      <div className="flex items-center gap-2 pl-3.5 pr-2.5 pt-2.5 pb-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={bodyId}
          className="flex-1 min-w-0 flex items-center gap-2 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
          <ListChecks size={15} className="text-slate-400 shrink-0" />
          <span id={`cl-title-${task.id}`} className="cw-13 font-bold text-slate-900 truncate">
            İçerik Kontrolü{summary ? <span className="font-semibold text-slate-500"> — {summary.done}/{summary.total} Tamamlandı</span> : null}
          </span>
          <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        {summary && <span className={`shrink-0 inline-flex items-center h-5 px-1.5 rounded-md border cw-10 font-semibold whitespace-nowrap ${CHECK_TONES[summary.state]}`} data-checklist-state={summary.state}>{summary.label}</span>}
      </div>
      {summary && (
        <div className="px-3.5 pb-2.5">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-label="Kontrol listesi ilerlemesi" aria-valuenow={summary.done} aria-valuemin={0} aria-valuemax={summary.total}>
            <div className={`h-full ${CHECK_BAR[summary.state]} transition-all`} style={{ width: `${summary.pct}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 cw-11 text-slate-500">
            <span className={summary.cycle ? "font-semibold text-orange-700" : ""} data-checklist-cycle={summary.cycle}>{cycleLabel(summary)}</span>
            <span aria-hidden="true">·</span>
            <span>Zorunlu: <span className="font-semibold tabular-nums text-slate-700">{summary.requiredDone}/{summary.required}</span></span>
          </p>
        </div>
      )}
      {open && <div id={bodyId} className="border-t border-slate-100">{body}</div>}
    </section>
  );
}

const CHECK_EVENT_TEXT = { completed: "tamamladı", reopened: "işaretini kaldırdı", note: "not yazdı", reset: "sıfırladı" };
const cycleName = (cycle) => (cycle ? `Revizyon ${cycle}` : "İlk Teslim");

/* Kalite kontrol geçmişi: döngüler (önceki döngüler salt okunur), onaya gönderimler ve işaretleme kayıtları. */
function ChecklistHistory({ task }) {
  const { checklistApi, state } = useWS();
  const [data, setData] = useState({ status: "loading" });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setData({ status: "loading" });
    checklistApi.history(task.id).then((d) => { if (alive) setData({ status: "ready", ...d }); }, (error) => { if (alive) setData({ status: "error", error }); });
    return () => { alive = false; };
  }, [checklistApi, task.id, n, task.status]);
  const cycles = (state.checklists || EMPTY).filter((c) => c.taskId === task.id).sort((a, b) => b.cycle - a.cycle);
  const itemsAll = state.checklistItems || EMPTY;
  return (
    <div className="border-t border-slate-100 px-3.5 py-3 space-y-4" data-checklist-history="">
      <div>
        <h5 className="cw-11 font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Döngüler</h5>
        <ul className="space-y-1">
          {cycles.map((c) => {
            const list = itemsOf(itemsAll, c.id);
            const s = checklistSummary(c, list, c.closedAt ? null : task);
            return (
              <li key={c.id}>
                <details className="group/cy rounded-lg border border-slate-200">
                  <summary className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-1.5 cursor-pointer cw-12 list-none">
                    <ChevronRight size={12} className="text-slate-400 transition-transform group-open/cy:rotate-90" />
                    <span className="font-semibold text-slate-800">{cycleName(c.cycle)}</span>
                    <span className="text-slate-500 tabular-nums">{s.done}/{s.total} · Zorunlu {s.requiredDone}/{s.required}</span>
                    <span className="ml-auto cw-11 text-slate-400">{c.closedAt ? `Kapandı: ${fmtDateTime(c.closedAt)}` : "Güncel"}</span>
                  </summary>
                  <ul className="px-2.5 pb-2 space-y-0.5">
                    {list.map((i) => (
                      <li key={i.id} className="flex items-start gap-1.5 cw-11 text-slate-600">
                        {i.isCompleted ? <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-emerald-600" /> : <Circle size={12} className="shrink-0 mt-0.5 text-slate-300" />}
                        <span className="flex-1 min-w-0">{i.title}{i.isCompleted && <span className="text-slate-400"> — {USER_BY_ID[i.completedBy]?.name || "Ekip üyesi"}, {fmtDateTime(i.completedAt)}</span>}{i.note && <span className="block text-slate-500 italic">Not: {i.note}</span>}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
      {data.status === "loading" && <p className="cw-12 text-slate-400" aria-busy="true">Geçmiş yükleniyor…</p>}
      {data.status === "error" && (
        <p role="alert" className="flex flex-wrap items-center gap-2 cw-12 text-red-700">Geçmiş yüklenemedi. {data.error?.message}
          <Btn size="sm" variant="secondary" className="h-7" onClick={() => setN((x) => x + 1)}><RefreshCw size={12} />Tekrar Dene</Btn></p>
      )}
      {data.status === "ready" && (
        <>
          <div>
            <h5 className="cw-11 font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Onaya Gönderimler</h5>
            {data.submissions.length ? (
              <ul className="space-y-1.5">
                {data.submissions.map((s) => (
                  <li key={s.id} className="cw-12 text-slate-700" data-submission={s.id}>
                    <span className="font-semibold">{USER_BY_ID[s.submittedBy]?.name || "Ekip üyesi"}</span> → {s.targetStatus}
                    <span className="text-slate-400"> · {fmtDateTime(s.createdAt)}{s.cycle != null ? ` · ${cycleName(s.cycle)}` : ""} · Zorunlu {s.requiredDone}/{s.required}</span>
                    {s.overrideReason && <span className="mt-0.5 flex items-start gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 cw-11 text-amber-900"><AlertTriangle size={11} className="shrink-0 mt-0.5" />Eksik kontroller gerekçeyle atlandı: {s.overrideReason}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="cw-12 text-slate-400">Henüz onaya gönderilmedi.</p>}
          </div>
          <div>
            <h5 className="cw-11 font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Kontrol Kayıtları</h5>
            {data.events.length ? (
              <ol className="space-y-1">
                {data.events.slice(0, 50).map((e) => (
                  <li key={e.id} className="cw-11 text-slate-600">
                    {e.kind === "cycle" ? <span className="font-semibold text-orange-700">{e.detail}</span> : (
                      <><span className="font-semibold text-slate-800">{USER_BY_ID[e.userId]?.name || "Ekip üyesi"}</span> “{e.itemTitle}” {CHECK_EVENT_TEXT[e.kind] || e.kind}{e.kind === "note" && e.detail ? `: ${e.detail}` : ""}</>
                    )}
                    <span className="text-slate-400"> · {fmtDateTime(e.createdAt)}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="cw-12 text-slate-400">Kayıt yok.</p>}
          </div>
        </>
      )}
    </div>
  );
}

/* Admin: eksik zorunlu kontrollerle onaya gönderme (gerekçe zorunlu, geçmişe kaydedilir). */
function ChecklistOverrideModal({ title, status, missing, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const confirm = () => { if (!reason.trim()) { setError("Gerekçe zorunludur."); return; } onConfirm(reason.trim()); };
  return (
    <Modal title="Eksik kontrollerle gönder" subtitle={title} onClose={onClose} width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Vazgeç</Btn><Btn variant="primary" onClick={confirm}><Send size={14} />{status === "Müşteri Onayı" ? "Müşteri Onayına Gönder" : "Yönetici Onayına Gönder"}</Btn></>}>
      <div className="space-y-3">
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 cw-12 text-amber-900">
          <AlertTriangle size={14} className="shrink-0 mt-px" />
          <span>{missing} zorunlu kontrol tamamlanmamış. Yönetici olarak gerekçe yazarak gönderebilirsiniz; gerekçe kalite kontrol geçmişine kaydedilir.</span>
        </p>
        <Field label="Gerekçe" error={error}>
          <textarea autoFocus value={reason} onChange={(e) => { setReason(e.target.value); if (error) setError(""); }} rows={3} maxLength={500}
            placeholder="örn. Müşteri yayın saatini öne çekti; teknik kontroller yayın öncesi yapılacak."
            className={`${inputCls(error)} h-auto py-2 resize-y`} />
        </Field>
      </div>
    </Modal>
  );
}

/* ── Şablon yönetimi (marka kılavuzu sayfasında; admin ve açıkça yetkilendirilmiş çalışan) ── */

function ChecklistTemplatesSection({ brandId }) {
  const { checklistApi, actor, state, previewOnly } = useWS();
  if (!checklistApi || previewOnly || !canManageChecklists(actor, brandId, state)) return null;
  return <ChecklistTemplatesPanel brandId={brandId} />;
}

function ChecklistTemplatesPanel({ brandId }) {
  const { checklistApi, actor, state, notify } = useWS();
  const [data, setData] = useState({ status: "loading", list: [], error: null });
  const [n, setN] = useState(0);
  const [editing, setEditing] = usePersisted(`${brandId}:cltpl:editing`, null);
  useEffect(() => {
    let alive = true;
    setData((d) => ({ ...d, status: d.list.length ? "ready" : "loading", error: null }));
    checklistApi.listTemplates(brandId).then((list) => { if (alive) setData({ status: "ready", list, error: null }); }, (error) => { if (alive) setData({ status: "error", list: [], error }); });
    return () => { alive = false; };
  }, [checklistApi, brandId, n]);
  const reload = () => setN((x) => x + 1);
  const canGlobal = canManageChecklists(actor, null, state);
  const list = [...data.list].sort((a, b) => (a.brandId ? 0 : 1) - (b.brandId ? 0 : 1) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const remove = async (t) => {
    try { await checklistApi.removeTemplate(t); notify("Şablon silindi. Mevcut görevlerin kontrol listeleri korunur."); reload(); }
    catch (err) { notify(err?.message || "Şablon silinemedi.", "error"); throw err; }
  };
  return (
    <KitSection id={`kit-checklists-${brandId}`} icon={ClipboardCheck} title="Kontrol Listesi Şablonları" count={data.list.filter((t) => t.brandId).length}
      description="Görev türüne göre yeni görevlere otomatik uygulanır. Değişiklikler mevcut görevlerin listelerini ve geçmişini değiştirmez."
      action={editing !== "new" && <Btn size="sm" variant="secondary" onClick={() => setEditing("new")}><Plus size={13} />Yeni Şablon</Btn>}>
      <div className="space-y-2.5" data-checklist-templates={brandId}>
        {editing === "new" && <ChecklistTemplateEditor brandId={brandId} onDone={() => setEditing(null)} onSaved={reload} />}
        {data.status === "loading" && <KitEmpty>Şablonlar yükleniyor…</KitEmpty>}
        {data.status === "error" && (
          <p role="alert" className="flex flex-wrap items-center gap-2 cw-12 text-red-700">Şablonlar yüklenemedi. {data.error?.message}
            <Btn size="sm" variant="secondary" onClick={reload}><RefreshCw size={13} />Tekrar Dene</Btn></p>
        )}
        {data.status === "ready" && !list.length && editing !== "new" && <KitEmpty>Bu marka için şablon yok; varsayılan şablon kullanılır.</KitEmpty>}
        {list.map((t) => (editing === t.id
          ? <ChecklistTemplateEditor key={t.id} brandId={brandId} template={t} onDone={() => setEditing(null)} onSaved={reload} />
          : <ChecklistTemplateCard key={t.id} template={t} canEdit={t.brandId ? true : canGlobal} onEdit={() => setEditing(t.id)} onRemove={t.brandId ? () => remove(t) : null} />))}
      </div>
    </KitSection>
  );
}

function ChecklistTemplateCard({ template: t, canEdit, onEdit, onRemove }) {
  const [open, setOpen] = useState(false);
  const enabled = t.items.filter((i) => i.isEnabled);
  return (
    <div className="rounded-lg border border-slate-200 p-3" data-checklist-template={t.id}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex-1 min-w-[12rem]">
          <p className="flex flex-wrap items-center gap-1.5 cw-13 font-semibold text-slate-900">
            {t.name}
            {!t.brandId && <span className="h-5 px-1.5 inline-flex items-center rounded-md bg-slate-100 text-slate-600 cw-10 font-semibold">Tüm markalar</span>}
            {!t.isActive && <span className="h-5 px-1.5 inline-flex items-center rounded-md bg-slate-100 text-slate-500 cw-10 font-semibold">Pasif</span>}
            <span className="cw-10 font-semibold text-slate-400">Sürüm {t.version}</span>
          </p>
          <p className="cw-11 text-slate-500 mt-0.5">{enabled.length} madde · {enabled.filter((i) => i.isRequired).length} zorunlu · {t.taskTypes.length ? t.taskTypes.join(", ") : "Tüm görev türleri"}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <IconAction icon={open ? ChevronUp : ChevronDown} label={open ? "Maddeleri gizle" : "Maddeleri göster"} onClick={() => setOpen((o) => !o)} />
          {canEdit && <IconAction icon={Pencil} label={`${t.name} şablonunu düzenle`} onClick={onEdit} />}
          {canEdit && onRemove && <DeleteAction label={`${t.name} şablonunu sil`} onConfirm={onRemove} />}
        </div>
      </div>
      {!canEdit && <p className="cw-11 text-slate-400 mt-1 flex items-center gap-1"><Lock size={10} />Varsayılan şablonu yalnızca yönetici düzenleyebilir.</p>}
      {open && (
        <ol className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          {t.items.map((i) => (
            <li key={i.id} className={`flex items-start gap-1.5 cw-12 ${i.isEnabled ? "text-slate-700" : "text-slate-400 line-through"}`}>
              <span className="shrink-0 w-24 cw-10 font-semibold uppercase tracking-wide text-slate-400 mt-0.5 truncate">{CHECK_CATEGORIES[i.category]?.split(" ")[0]}</span>
              <span className="flex-1 min-w-0">{i.title}</span>
              {i.isRequired && <span className="shrink-0 cw-10 font-semibold text-slate-500">Zorunlu</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const newTemplateItem = () => ({ key: uid(), title: "", description: "", category: "visual", isRequired: true, isEnabled: true, recheckOnRevision: true });

function TemplateToggle({ label, checked, onChange, hint }) {
  return (
    <label className="inline-flex items-center gap-1.5 min-h-[32px] cw-12 text-slate-600 cursor-pointer select-none" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded accent-orange-600" />{label}
    </label>
  );
}

function ChecklistTemplateEditor({ brandId, template, onDone, onSaved }) {
  const { checklistApi, actor, notify, brandsById } = useWS();
  const initial = useMemo(() => (template
    ? { name: template.name, taskTypes: template.taskTypes, isActive: template.isActive, items: template.items.map((i) => ({ ...i, key: i.id })) }
    : { name: `${brandsById[brandId]?.name || "Marka"} — Kontrol Listesi`, taskTypes: [...CREATIVE_TASK_TYPES], isActive: true, items: DEFAULT_TEMPLATE_ITEMS.map((i) => ({ ...i, key: uid() })) }), [template, brandId, brandsById]);
  const { values: v, set, dirty, discard } = useKitForm(`${brandId}:cltpl:${template?.id || "new"}`, initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const setItem = (n, patch) => set("items", (items) => items.map((x, j) => (j === n ? { ...x, ...patch } : x)));
  const move = (n, dir) => set("items", (items) => { const j = n + dir; if (j < 0 || j >= items.length) return items; const next = [...items]; [next[n], next[j]] = [next[j], next[n]]; return next; });
  const toggleType = (t) => set("taskTypes", (types) => (types.includes(t) ? types.filter((x) => x !== t) : TASK_TYPES.filter((x) => x === t || types.includes(x))));
  const submit = async (e) => {
    e.preventDefault();
    const err = validateTemplate(v);
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      await checklistApi.saveTemplate({
        id: template?.id, brandId: template ? template.brandId : brandId, name: v.name.trim(), taskTypes: v.taskTypes, isActive: v.isActive,
        items: v.items.map(({ key, ...i }) => ({ ...i, title: i.title.trim(), description: (i.description || "").trim() })),
      }, actor.id);
      notify(template ? "Şablon güncellendi. Yalnızca yeni görevlere uygulanır." : "Şablon oluşturuldu.");
      discard(); onSaved(); onDone();
    } catch (err2) {
      notify(err2?.message || "Şablon kaydedilemedi.", "error");
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className={kitFormCls} aria-label={template ? "Şablonu düzenle" : "Yeni şablon"} data-template-editor="">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="Şablon Adı" error={errors.name}><input autoFocus value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} className={inputCls(errors.name)} /></Field>
        <TemplateToggle label="Aktif" checked={v.isActive} onChange={(x) => set("isActive", x)} hint="Pasif şablon yeni görevlere uygulanmaz." />
      </div>
      <Field label="Görev Türleri" group error={errors.taskTypes}>
        <div className="flex flex-wrap gap-1.5">
          {TASK_TYPES.map((t) => {
            const on = v.taskTypes.includes(t);
            return <button key={t} type="button" aria-pressed={on} onClick={() => toggleType(t)} className={`h-8 px-2.5 rounded-lg border cw-12 font-medium transition-colors ${on ? "border-orange-300 bg-orange-50 text-orange-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{t}</button>;
          })}
        </div>
        <span className="cw-11 text-slate-500">{v.taskTypes.length ? `Yalnızca seçili türdeki görevlere uygulanır.` : "Tür seçilmezse tüm görev türlerine uygulanır."}</span>
      </Field>
      <div role="group" aria-label="Kontrol maddeleri">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="cw-12 font-semibold text-slate-700">Kontrol Maddeleri <span className="font-medium text-slate-400">{v.items.length}</span></span>
          {errors.items && <span className="cw-11 text-red-600" role="alert">{errors.items}</span>}
        </div>
        <ol className="space-y-2">
          {v.items.map((it, n) => (
            <li key={it.key || it.id} className={`rounded-lg border bg-white p-2 ${it.isEnabled ? "border-slate-200" : "border-dashed border-slate-300"}`} data-template-item={n}>
              <div className="flex items-start gap-1.5">
                <span className="flex flex-col shrink-0">
                  <IconAction icon={ArrowUp} label={`${n + 1}. maddeyi yukarı taşı`} onClick={() => move(n, -1)} disabled={n === 0} />
                  <IconAction icon={ArrowDown} label={`${n + 1}. maddeyi aşağı taşı`} onClick={() => move(n, 1)} disabled={n === v.items.length - 1} />
                </span>
                <div className={`flex-1 min-w-0 space-y-1.5 ${it.isEnabled ? "" : "opacity-60"}`}>
                  <input value={it.title} onChange={(e) => setItem(n, { title: e.target.value })} aria-label={`${n + 1}. madde metni`} placeholder="örn. Logo sağ alt köşede kullanıldı." maxLength={200} className={inputCls(errors[`item-${n}`])} />
                  {errors[`item-${n}`] && <span className="block cw-11 text-red-600">{errors[`item-${n}`]}</span>}
                  <input value={it.description || ""} onChange={(e) => setItem(n, { description: e.target.value })} aria-label={`${n + 1}. madde açıklaması`} placeholder="Açıklama (isteğe bağlı)" maxLength={1000} className={`${inputCls()} h-8 cw-12`} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <select value={it.category} onChange={(e) => setItem(n, { category: e.target.value })} aria-label={`${n + 1}. madde kategorisi`} className="h-8 rounded-lg border border-slate-200 bg-white px-2 cw-12 outline-none focus:border-orange-400">
                      {Object.entries(CHECK_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <TemplateToggle label="Zorunlu" checked={!!it.isRequired} onChange={(x) => setItem(n, { isRequired: x })} hint="Zorunlu maddeler tamamlanmadan içerik onaya gönderilemez." />
                    <TemplateToggle label="Revizyonda yeniden kontrol" checked={it.recheckOnRevision !== false} onChange={(x) => setItem(n, { recheckOnRevision: x })} hint="Müşteri revize istediğinde bu madde sıfırlanır." />
                    <TemplateToggle label="Etkin" checked={it.isEnabled !== false} onChange={(x) => setItem(n, { isEnabled: x })} hint="Devre dışı maddeler yeni görevlere eklenmez." />
                  </div>
                </div>
                <IconAction icon={Trash2} label={`${n + 1}. maddeyi kaldır`} tone="danger" onClick={() => set("items", (items) => items.filter((_, j) => j !== n))} />
              </div>
            </li>
          ))}
        </ol>
        <Btn size="sm" variant="secondary" className="mt-2" onClick={() => set("items", (items) => [...items, newTemplateItem()])} disabled={v.items.length >= MAX_TEMPLATE_ITEMS}><Plus size={13} />Madde Ekle</Btn>
      </div>
      {template && <p className="cw-11 text-slate-500">Kaydedince sürüm {template.version + 1} olur. Mevcut görevlerdeki kontrol listeleri ve tamamlanma kayıtları değişmez.</p>}
      <KitFormActions dirty={dirty} saving={saving} onCancel={() => { discard(); onDone(); }} submitLabel={template ? "Kaydet" : "Şablonu Oluştur"} />
    </form>
  );
}

/* ───────────────────────── Uygulama ───────────────────────── */

/* Rol bazlı menü. `perm` belirtilen öğe yalnızca o yetkiye sahip kullanıcılara görünür.
   "ops" sayfaları mevcut çalışma alanını (genel bakış + akış/tablo/dosyalar) kullanır. */
const NAV_BY_ROLE = {
  admin: [
    { key: "overview", label: "Genel Bakış", Icon: LayoutDashboard },
    { key: "today", label: "Günlük Operasyon Akışı", Icon: Calendar },
    { key: "plan", label: "İçerik Planlayıcı", Icon: Table },
    { key: "social", label: "Sosyal Medya Planı", Icon: CalendarDays },
    { key: "kit", label: "Marka Kılavuzu", Icon: BookOpen },
    { key: "files", label: "Marka Dosyaları & Varlıklar", Icon: FolderOpen, perm: "canViewBrandFiles" },
    { key: "approvals", label: "Onay Süreçleri", Icon: CheckCircle2, perm: "canAccessApprovals" },
    { key: "team", label: "Ekip & Marka Yönetimi", Icon: Users, perm: "canManageUsers" },
    { key: "users", label: "Kullanıcılar & Yetkiler", Icon: ShieldCheck, perm: "canManageUsers" },
    { key: "agreement", label: "Sözleşme", Icon: FileText, perm: "canManageUsers" },
    { key: "notifications", label: "Bildirimler", Icon: Bell },
    { key: "filters", label: "Filtreler", Icon: SlidersHorizontal },
  ],
  employee: [
    { key: "my", label: "Bugünkü İşlerim", Icon: Inbox },
    { key: "plan", label: "Görevlerim", Icon: ClipboardList, perm: "canViewTasks" },
    { key: "kit", label: "Marka Kılavuzu", Icon: BookOpen },
    { key: "files", label: "Marka Dosyaları", Icon: FolderOpen, perm: "canViewBrandFiles" },
    { key: "notifications", label: "Bildirimler", Icon: Bell },
  ],
  client: [
    { key: "client-home", label: "Genel Bakış", Icon: LayoutDashboard },
    { key: "content", label: "İçeriklerim", Icon: LayoutGrid, perm: "canViewContent" },
    { key: "pending", label: "Onay Bekleyen İçerikler", Icon: Clock, perm: "canAccessApprovals" },
    { key: "client-history", label: "Onay Geçmişi", Icon: History, perm: "canAccessApprovals" },
    { key: "client-kit", label: "Marka Kılavuzu", Icon: BookOpen, perm: "canViewBrandFiles" },
    { key: "client-files", label: "Marka Dosyaları", Icon: FolderOpen, perm: "canViewBrandFiles" },
    { key: "notifications", label: "Bildirimler", Icon: Bell },
  ],
};
const OPS_KEYS = new Set(["overview", "today", "plan", "kit", "files", "filters"]);
const DEFAULT_PAGE = { admin: "ops", employee: "my", client: "client-home" };
const PAGE_TITLES = {
  my: "Bugünkü İşlerim", social: "Sosyal Medya Planı", approvals: "Onay Süreçleri", team: "Ekip & Marka Yönetimi", users: "Kullanıcılar & Yetkiler", agreement: "Sözleşme",
  notifications: "Bildirimler", "client-home": "Genel Bakış", content: "İçeriklerim", pending: "Onay Bekleyen İçerikler", "client-files": "Marka Dosyaları", "client-kit": "Marka Kılavuzu", "client-history": "Onay Geçmişi",
};
const SEARCH_PLACEHOLDERS = {
  ops: "Görev, marka veya kişi ara…", my: "İşlerimde ara…", social: "Plandaki içeriklerde ara…", approvals: "Onay sürecindeki içeriklerde ara…", team: "Marka, çalışan veya müşteri ara…",
  users: "Kullanıcı veya e-posta ara…", agreement: "Kullanıcı ara…", notifications: "Bildirimlerde ara…", "client-home": "İçeriklerimde ara…", content: "İçeriklerimde ara…", pending: "Onay bekleyenlerde ara…", "client-files": "Görev, marka veya kişi ara…", "client-kit": "İçeriklerimde ara…", "client-history": "Onay geçmişinde ara…",
};

function Workspace({ state, dispatch, getState, createTasks, draftScope, contentApi, accountApi, agreementApi, userApi, portalSlug, portalKey, actorId, realUserId, onViewAs, allowImpersonation, onSignOut, syncError, denied, media, brandKit, checklistApi }) {
  const actor = state.users.find((u) => u.id === actorId) || state.users.find((u) => u.id === realUserId);
  const realUser = state.users.find((u) => u.id === realUserId);
  setDirectory(state.users, actor.id);
  const role = roleOf(actor);
  const perms = permissionsFor(actor);
  const allowed = useCallback((p) => perms.has(p), [perms]);
  const view = useMemo(() => scopeState(actor, state), [actor, state]);

  const navItems = NAV_BY_ROLE[role].filter((n) => !n.perm || perms.has(n.perm));
  const allowedPages = new Set(navItems.map((n) => (OPS_KEYS.has(n.key) ? "ops" : n.key)));

  const [page, setPageRaw] = useState(DEFAULT_PAGE[role]);
  const [tab, setTab] = useState(role === "employee" ? "table" : "feed");
  const [selectedBrandId, setSelectedBrandId] = useState("all");
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState({ key: "due", dir: "asc" });
  const [drawer, setDrawer] = useState(null);
  const [contentId, setContentId] = useState(null);
  const [newTask, setNewTask] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [assetModal, setAssetModal] = useState(null);
  const [brandModal, setBrandModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [folderId, setFolderId] = useState(null);
  const [toast, setToast] = useState(null);
  const [override, setOverride] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const mainRef = useRef(null);
  const workspaceRef = useRef(null);
  const searchRef = useRef(null);
  const firstFilterRef = useRef(null);
  const toastTimer = useRef(null);

  // Yetkisiz sayfaya hiçbir yoldan geçilemez: izin listesinde olmayan sayfa rolün varsayılanına döner.
  const currentPage = allowedPages.has(page) ? page : DEFAULT_PAGE[role];
  const setPage = (p) => setPageRaw(allowedPages.has(p) ? p : DEFAULT_PAGE[role]);

  const notify = useCallback((text, tone = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ text, tone, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    const check = () => { if (refreshToday()) dispatch({ type: "DAY_CHANGED", remote: true }); };
    const timer = setInterval(check, 60 * 1000);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [dispatch]);
  useEffect(() => { if (syncError) notify(`Değişiklik kaydedilemedi, veriler yenilendi. (${syncError.message})`, "error"); }, [syncError, notify]);
  useEffect(() => { if (denied) notify(denied.message, "error"); }, [denied, notify]);

  // Rol/kullanıcı değişince arayüz o rolün başlangıç ekranına döner; veriler korunur.
  const lastActor = useRef(actor.id);
  useEffect(() => {
    if (lastActor.current === actor.id) return;
    lastActor.current = actor.id;
    setPageRaw(DEFAULT_PAGE[role]); setTab(role === "employee" ? "table" : "feed"); setSelectedBrandId("all"); setFilters(emptyFilters());
    setDrawer(null); setContentId(null); setNewTask(null); setBulkOpen(false); setDeleteId(null); setPreview(null); setAssetModal(null); setBrandModal(false); setFolderId(null); setOverride(null);
    setSidebarOpen(false);
    if (mainRef.current) mainRef.current.scrollTo({ top: 0 });
  }, [actor.id, role]);
  useEffect(() => { if (selectedBrandId !== "all" && !view.brands.some((b) => b.id === selectedBrandId)) setSelectedBrandId("all"); }, [view.brands, selectedBrandId]);

  const brandsById = useMemo(() => Object.fromEntries(view.brands.map((b) => [b.id, b])), [view.brands]);
  const commentCount = useMemo(() => { const m = {}; view.comments.forEach((c) => { m[c.taskId] = (m[c.taskId] || 0) + 1; }); return m; }, [view.comments]);
  const attachmentsByTask = useMemo(() => { const m = {}; view.attachments.forEach((a) => { (m[a.taskId] = m[a.taskId] || []).push(a); }); return m; }, [view.attachments]);
  const revisionByTask = useMemo(() => {
    const m = {};
    const withApprovals = new Set(view.approvals.map((a) => a.taskId));
    view.tasks.forEach((t) => { if (withApprovals.has(t.id)) { const r = revisionInfo(t, view.approvals); if (r) m[t.id] = r; } });
    return m;
  }, [view.tasks, view.approvals]);

  const scopedTasks = useMemo(() => (selectedBrandId === "all" ? view.tasks : view.tasks.filter((t) => t.brandId === selectedBrandId)), [view.tasks, selectedBrandId]);
  const filteredTasks = useMemo(
    () => sortTasks(scopedTasks.filter((t) => matchTask(t, filters, brandsById)), sort, { brandsById, commentCount, attachmentsByTask }),
    [scopedTasks, filters, brandsById, sort, commentCount, attachmentsByTask],
  );
  const activeCount = [filters.search.trim(), filters.dateScope !== "all", filters.status !== "all", filters.assignee !== "all", filters.platform !== "all"].filter(Boolean).length;
  const visibleBrands = selectedBrandId === "all" ? view.brands : view.brands.filter((b) => b.id === selectedBrandId);
  const scopedAssets = selectedBrandId === "all" ? view.assets.length : view.assets.filter((a) => a.brandId === selectedBrandId).length;
  const selectedBrand = brandsById[selectedBrandId] || null;
  const unread = view.notifications.filter((n) => !n.readAt).length;

  const setFilter = useCallback((k, v) => setFilters((f) => ({ ...f, [k]: v })), []);
  const clearFilters = useCallback(() => setFilters(emptyFilters()), []);
  const isVisible = useCallback((t) => (selectedBrandId === "all" || t.brandId === selectedBrandId) && matchTask(t, filters, brandsById), [selectedBrandId, filters, brandsById]);
  const defaultDate = filters.dateScope === "custom" ? filters.customDate : filters.dateScope === "tomorrow" ? addDays(TODAY, 1) : TODAY;

  const checklistsOn = !!state.features?.checklists;
  const checklistIndex = useMemo(() => indexChecklists(view.checklists || EMPTY, view.checklistItems || EMPTY), [view.checklists, view.checklistItems]);
  const openTask = useCallback((id, focus) => setDrawer({ id, focus: focus || null, n: Date.now() }), []);

  /* Görevin kontrol listesi yoksa (eski görev / sonradan eklenen şablon) sunucuda oluşturur ve yerel duruma işler. */
  const ensureChecklist = useCallback(async (task) => {
    if (!checklistApi || !checklistsOn || task.checklistDisabled || roleOf(actor) === "client") return;
    if (currentChecklist(getState().checklists || EMPTY, task.id)) return;
    const res = await checklistApi.ensure(task, getState());
    if (res) dispatch({ type: "REMOTE_MERGE", remote: true, ...res });
  }, [checklistApi, checklistsOn, getState, dispatch, actor]);

  /* "Onaya Gönder": zorunlu kontroller eksikse çalışan uyarılır ve eksikler görev içinde vurgulanır; admin gerekçe
     yazarak gönderebilir. Asıl doğrulama sunucuda yapılır (006 submit_task_for_approval) — bu yalnızca erken uyarıdır. */
  const submitTask = useCallback(async (id, status, msg) => {
    let task = getState().tasks.find((t) => t.id === id);
    if (!task) return false;
    try { await ensureChecklist(task); } catch { /* sunucu gönderimde yine doğrular */ }
    const s = getState();
    task = s.tasks.find((t) => t.id === id);
    const missing = missingForSubmit(s, task).length;
    if (missing) {
      if (roleOf(actor) === "admin") { setOverride({ taskId: id, status, msg, missing, title: task.title }); return false; }
      notify(incompleteMessage(missing), "error");
      setDrawer({ id, focus: "checklist", n: Date.now() });
      return false;
    }
    const ok = dispatch({ type: "SUBMIT_TASK", id, status });
    if (ok && msg) notify(msg);
    return ok;
  }, [getState, ensureChecklist, dispatch, notify, actor]);

  const updateTask = useCallback((id, patch, msg) => {
    const current = getState().tasks.find((t) => t.id === id);
    if (current && patch.status && patch.status !== current.status && REVIEW_STATUSES.has(patch.status)) {
      const { status, ...rest } = patch;
      if (Object.keys(rest).length) dispatch({ type: "UPDATE_TASK", id, patch: rest });
      submitTask(id, status, msg);
      return;
    }
    if (dispatch({ type: "UPDATE_TASK", id, patch }) && msg) notify(msg);
  }, [dispatch, notify, getState, submitTask]);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const copyLink = useCallback((url) => {
    copyText(url).then((ok) => notify(ok ? "Bağlantı panoya kopyalandı." : `Bağlantı kopyalanamadı: ${url}`, ok ? "success" : "error"));
  }, [notify]);
  const statusOptions = useCallback((task) => statusOptionsFor(actor, task, STATUSES), [actor]);

  // Yönetim ekranları (yalnızca kullanıcı yönetimi yetkisi olanlar) tüm kayıtlarla çalışır; diğer roller yalnızca kendi dilimini alır.
  const ctxState = useMemo(() => (perms.has("canManageUsers")
    ? { ...view, allUsers: state.users, allBrands: state.brands, allMemberships: state.memberships, allTasks: state.tasks, allActivity: state.activity, allApprovals: state.approvals }
    : { ...view, allUsers: view.users, allBrands: view.brands, allMemberships: view.memberships, allTasks: view.tasks, allActivity: view.activity, allApprovals: view.approvals }), [perms, view, state]);

  const ctx = useMemo(() => ({
    state: ctxState, dispatch, brandsById, commentCount, attachmentsByTask, revisionByTask, notify, updateTask, openTask, copyLink, media,
    actor, role, can: allowed, statusOptions,
    openContent: (id) => setContentId(id),
    askDelete: (id) => setDeleteId(id),
    openPreview: (kind, id) => setPreview({ kind, id }),
    openNewTask: (brandId) => setNewTask({ brandId: brandId || (selectedBrandId !== "all" ? selectedBrandId : undefined) }),
    brandKitStore: brandKit,
    checklistApi: checklistsOn ? checklistApi : null, checklistIndex, ensureChecklist, submitTask,
    contentApi: state.features?.approvals ? contentApi : null,
    // Yalnızca kendi oturumunda (önizleme değil) — sunucu ayrıca yönetici yetkisini denetler.
    userApi: actor.id === realUserId ? userApi : null,
    // Gerçek oturumda başka kullanıcı olarak önizleme yapılırken kılavuz da salt okunurdur.
    previewOnly: actor.id !== realUserId && !allowImpersonation,
  }), [ctxState, dispatch, brandsById, commentCount, attachmentsByTask, revisionByTask, notify, updateTask, openTask, copyLink, media, actor, role, allowed, statusOptions, selectedBrandId, brandKit, realUserId, allowImpersonation, checklistsOn, checklistApi, checklistIndex, ensureChecklist, submitTask, contentApi, state.features, userApi]);

  /* Müşteri onay bağlantısı (/onay/<adres>, /onay): adres yalnızca yönlendirir, yetki vermez. Markayı kullanıcı zaten
     görebiliyorsa (RLS) o markanın onay ekranı açılır; aksi halde — marka var olsun ya da olmasın — aynı mesaj gösterilir. */
  const [portal, setPortal] = useState(() => (portalSlug == null ? null : { slug: portalSlug, status: "pending" }));
  // Adres değişince (geri / ileri, yeni marka bağlantısı) yeniden uygulanır.
  useEffect(() => { setPortal(portalSlug == null ? null : { slug: portalSlug, status: "pending" }); }, [portalSlug, portalKey]);
  useEffect(() => {
    if (!portal || portal.status !== "pending") return;
    if (portal.slug === "*") { // /onay: tüm markaların onay ekranı
      setSelectedBrandId("all");
      setPageRaw(role === "client" ? "pending" : "approvals");
      setPortal({ ...portal, status: "ok" });
      return;
    }
    const brand = portal.slug ? view.brands.find((b) => b.slug === portal.slug) : null;
    if (!brand) { setPortal({ ...portal, status: "denied" }); return; }
    setSelectedBrandId(brand.id);
    setPageRaw(role === "client" ? "pending" : "approvals");
    setPortal({ ...portal, status: "ok" });
  }, [portal, view.brands, role]);

  const drawerTask = drawer ? view.tasks.find((t) => t.id === drawer.id) : null;
  const deleteTask = deleteId ? view.tasks.find((t) => t.id === deleteId) : null;
  useEffect(() => { if (drawer && !drawerTask) setDrawer(null); }, [drawer, drawerTask]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "k") { e.preventDefault(); if (searchRef.current) searchRef.current.focus(); }
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const scrollToWorkspace = () => setTimeout(() => {
    if (workspaceRef.current && mainRef.current) mainRef.current.scrollTo({ top: Math.max(0, workspaceRef.current.offsetTop - 12), behavior: "smooth" });
  }, 30);
  const scrollTop = () => { if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: "smooth" }); };

  const onNav = (key) => {
    setSidebarOpen(false);
    if (!OPS_KEYS.has(key)) { setPage(key); scrollTop(); return; }
    setPage("ops");
    if (key === "overview") { setTab("feed"); setFilter("dateScope", "all"); setOverviewOpen(true); scrollTop(); }
    if (key === "today") { setTab("feed"); setFilter("dateScope", "today"); scrollToWorkspace(); }
    // "Günlük Operasyon Akışı"nın koyduğu Bugün süzgeci planlayıcıda takılı kalmaz (menüdeki sayı ile liste aynı olur).
    if (key === "plan") { setTab("table"); if (filters.dateScope === "today") setFilter("dateScope", "all"); scrollToWorkspace(); }
    if (key === "files") { setTab("files"); scrollToWorkspace(); }
    if (key === "kit") { setTab("kit"); scrollToWorkspace(); }
    if (key === "filters") {
      setFiltersOpen(true); setFlash(true);
      setTimeout(() => { if (firstFilterRef.current) firstFilterRef.current.focus(); }, 60);
      setTimeout(() => setFlash(false), 1400);
    }
  };
  const opsNav = role === "employee"
    ? (tab === "files" || tab === "kit" ? tab : "plan")
    : flash ? "filters" : tab === "table" ? "plan" : tab === "files" || tab === "kit" ? tab : filters.dateScope === "today" ? "today" : "overview";
  const activeNav = currentPage === "ops" ? opsNav : currentPage;

  const selectBrand = (id) => { setSelectedBrandId(id); setFolderId(null); setSidebarOpen(false); };
  // Logo: marka seçimi ve filtreler sıfırlanır, rolün ana görünümü tüm markalarla açılır (adres değişmez).
  const goHome = () => {
    clearFilters(); setSelectedBrandId("all"); setFolderId(null); setSidebarOpen(false);
    setPage(DEFAULT_PAGE[role]);
    if (role === "admin") { setTab("feed"); setOverviewOpen(true); }
    scrollTop();
  };
  const focusBrand = (id, nextTab) => { selectBrand(id); setPage("ops"); setTab(nextTab); scrollToWorkspace(); };

  // Bildirime tıklayınca okundu işaretlenir ve ilgili içerik/görev açılır.
  const openNotification = (n) => {
    if (!n.readAt) dispatch({ type: "MARK_NOTIFICATIONS_READ", ids: [n.id] });
    if (!n.taskId) return;
    if (!view.tasks.some((t) => t.id === n.taskId)) { notify("Bu içerik artık görüntülenemiyor.", "info"); return; }
    if (role === "client") setContentId(n.taskId); else openTask(n.taskId);
  };

  const opsTitle = tab === "files" ? (selectedBrand ? `${selectedBrand.name} · Marka Dosyaları` : "Marka Dosyaları")
    : tab === "kit" ? (selectedBrand ? `${selectedBrand.name} · Marka Kılavuzu` : "Marka Kılavuzu") : selectedBrand ? selectedBrand.name : role === "employee" ? "Görevlerim" : "Tüm Markalar";
  const title = currentPage === "ops" ? opsTitle : PAGE_TITLES[currentPage];
  const showSwitcher = allowImpersonation || roleOf(realUser) === "admin";
  const impersonating = actor.id !== realUserId;
  const tabs = TABS.filter((t) => t.key !== "files" || perms.has("canViewBrandFiles"));
  const navCounts = {
    today: scopedTasks.filter((t) => t.dueDate === TODAY).length,
    plan: scopedTasks.length,
    files: scopedAssets,
    filters: activeCount,
    approvals: view.tasks.filter((t) => ["Yönetici Onayı", "Müşteri Onayı", "Revizyon"].includes(t.status)).length,
    notifications: unread,
    my: view.tasks.filter((t) => isOpen(t) && t.dueDate && t.dueDate <= TODAY && !["Müşteri Onayı", "Yönetici Onayı"].includes(t.status)).length,
    pending: view.tasks.filter((t) => t.status === "Müşteri Onayı").length,
    content: view.tasks.length,
    "client-files": scopedAssets,
  };

  let pageNode;
  if (currentPage === "ops") {
    pageNode = (
      <>
        {role === "admin"
          ? <OpsDesk tasks={scopedTasks} open={overviewOpen} onToggle={() => setOverviewOpen((o) => !o)} />
          : <Overview tasks={scopedTasks} open={overviewOpen} onToggle={() => setOverviewOpen((o) => !o)} filters={filters} onApply={(k, v) => { setFilter(k, v); if (tab === "files") setTab("feed"); }} />}
        <section ref={workspaceRef} className="space-y-4" aria-label="Çalışma alanı">
          <WorkspaceTabs tabs={tabs} tab={tab} setTab={setTab} sort={sort} setSort={setSort} counts={{ feed: filteredTasks.length, table: filteredTasks.length, files: scopedAssets }} />
          {tab === "feed" && <DailyFeed brands={visibleBrands} tasks={filteredTasks} hasActiveFilters={activeCount > 0} onClear={clearFilters} onFocusBrand={focusBrand} />}
          {tab === "table" && <ContentTable tasks={filteredTasks} sort={sort} setSort={setSort} defaultBrandId={selectedBrandId !== "all" ? selectedBrandId : view.brands[0]?.id} dueDefault={defaultDate} isVisible={isVisible} />}
          {tab === "kit" && (selectedBrand ? <BrandKitView key={selectedBrand.id} brandId={selectedBrand.id} /> : <BrandKitPicker brands={view.brands} onPick={selectBrand} />)}
          {tab === "files" && <BrandFiles selectedBrandId={selectedBrandId} onSelectBrand={selectBrand} folderId={folderId} setFolderId={setFolderId} onAddAsset={perms.has("canManageAssets") ? (fid) => setAssetModal({ folderId: fid }) : null} />}
        </section>
      </>
    );
  } else if (currentPage === "my") pageNode = <EmployeeDashboard search={filters.search} brandId={selectedBrandId} onAllNotifications={() => setPage("notifications")} />;
  else if (currentPage === "social") pageNode = <SocialPlanPage search={filters.search} brandId={selectedBrandId} />;
  else if (currentPage === "approvals") pageNode = <ApprovalsPage search={filters.search} brandId={selectedBrandId} />;
  else if (currentPage === "team") {
    pageNode = (
      <TeamPage search={filters.search} onNewBrand={() => setBrandModal(true)}
        onViewBrand={(id) => { selectBrand(id); setPage("ops"); setTab("feed"); setFilters(emptyFilters()); scrollTop(); }}
        onViewTasks={(userId) => { setFilters({ ...emptyFilters(), assignee: userId }); setSelectedBrandId("all"); setPage("ops"); setTab("table"); scrollTop(); }}
        onViewKit={(id) => { selectBrand(id); setPage("ops"); setTab("kit"); scrollTop(); }}
        onViewPortal={(userId) => onViewAs(userId)} />
    );
  } else if (currentPage === "users") pageNode = <UsersPage search={filters.search} />;
  else if (currentPage === "agreement") pageNode = <AgreementAdminPage text={state.agreementText} api={agreementApi} search={filters.search} />;
  else if (currentPage === "notifications") pageNode = <NotificationsPage search={filters.search} onOpen={openNotification} />;
  else if (currentPage === "client-home") pageNode = <ClientHome search={filters.search} brandId={selectedBrandId} onGo={setPage} onOpenNotification={openNotification} />;
  else if (currentPage === "content") pageNode = <ClientContentPage search={filters.search} brandId={selectedBrandId} />;
  else if (currentPage === "pending") pageNode = <ClientContentPage search={filters.search} brandId={selectedBrandId} pendingOnly />;
  else if (currentPage === "client-history") pageNode = <ClientHistoryPage search={filters.search} brandId={selectedBrandId} />;
  else if (currentPage === "client-kit") {
    const kitBrandId = selectedBrand ? selectedBrand.id : view.brands.length === 1 ? view.brands[0].id : null;
    pageNode = kitBrandId ? <BrandKitView key={kitBrandId} brandId={kitBrandId} /> : <BrandKitPicker brands={view.brands} onPick={selectBrand} />;
  } else if (currentPage === "client-files") pageNode = <BrandFiles selectedBrandId={selectedBrandId} onSelectBrand={selectBrand} folderId={folderId} setFolderId={setFolderId} onAddAsset={null} />;

  return (
    <WorkspaceContext.Provider value={ctx}>
      <GlobalStyles />
      <div className="cw-root h-screen w-full flex overflow-hidden bg-slate-50">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          navItems={navItems}
          activeNav={activeNav}
          onNav={onNav}
          counts={navCounts}
          selectedBrandId={selectedBrandId}
          onSelectBrand={selectBrand}
          onHome={goHome}
          onNewBrand={perms.has("canCreateBrand") ? () => setBrandModal(true) : null}
          onMyTasks={role === "client" ? null : () => { setFilters({ ...emptyFilters(), assignee: actor.id }); setPage("ops"); setTab(role === "employee" ? "table" : "feed"); notify("Size atanan görevler listelendi.", "info"); }}
          onResetFilters={() => { clearFilters(); setSelectedBrandId("all"); notify("Tüm filtreler sıfırlandı.", "info"); }}
          onSignOut={onSignOut}
          onChangePassword={accountApi && actor.id === realUserId ? () => setPasswordOpen(true) : null}
          switcher={showSwitcher ? <RoleSwitcher actor={actor} realUserId={realUserId} onChange={onViewAs} previewOnly={!allowImpersonation} directory={{ users: state.users, memberships: state.memberships, tasks: state.tasks }} /> : null}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          {impersonating && <PreviewBanner actor={actor} readOnly={!allowImpersonation} onExit={() => onViewAs(realUserId)} />}
          <TopBar
            title={bulkOpen ? "Toplu Görev Ekle" : title}
            brand={currentPage === "ops" && !bulkOpen ? selectedBrand : null}
            filters={filters}
            setFilter={setFilter}
            onMenu={() => setSidebarOpen(true)}
            onNewTask={perms.has("canCreateTasks") && ["ops", "approvals"].includes(currentPage) && !bulkOpen ? () => ctx.openNewTask() : null}
            onBulk={perms.has("canCreateTasks") && currentPage === "ops" && !bulkOpen ? () => setBulkOpen(true) : null}
            showFilters={currentPage === "ops" && !bulkOpen}
            showAssigneeFilter={perms.has("canAssignTasks")}
            searchPlaceholder={SEARCH_PLACEHOLDERS[currentPage]}
            eyebrow={role === "client" ? "MÜŞTERİ PORTALI" : "ÇALIŞMA ALANI"}
            searchRef={searchRef}
            firstFilterRef={firstFilterRef}
            filtersOpen={filtersOpen}
            setFiltersOpen={setFiltersOpen}
            flash={flash}
            activeCount={activeCount}
            onClear={clearFilters}
            resultCount={filteredTasks.length}
          />

          <main ref={mainRef} className={`flex-1 min-h-0 ${bulkOpen ? "overflow-hidden" : "overflow-y-auto"} cw-scroll`}>
            {bulkOpen
              ? <BulkTaskSheet draftScope={draftScope} createTasks={createTasks} onClose={() => setBulkOpen(false)} />
              : (
                <div className="px-4 lg:px-6 py-5 space-y-5 max-w-screen-2xl mx-auto">
                  {portal?.status === "denied" && (
                    <div role="alert" data-portal-denied="" className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 cw-13 text-amber-900">
                      <Lock size={16} className="shrink-0 mt-0.5" />
                      <span className="flex-1">Bu müşteri onay bağlantısına erişiminiz yok veya bağlantı yenilenmiş. Ajansınızdan güncel bağlantıyı isteyin.</span>
                      <button type="button" onClick={() => setPortal(null)} className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-amber-100" aria-label="Uyarıyı kapat"><X size={14} /></button>
                    </div>
                  )}
                  {pageNode}
                </div>
              )}
          </main>
        </div>

        {drawerTask && <TaskDrawer key={drawerTask.id} task={drawerTask} focus={drawer.focus} focusKey={drawer.n} onClose={closeDrawer} />}
        {override && <ChecklistOverrideModal {...override} onClose={() => setOverride(null)} onConfirm={(reason) => {
          const ok = dispatch({ type: "SUBMIT_TASK", id: override.taskId, status: override.status, reason });
          if (ok) notify(override.msg || "İçerik onaya gönderildi.");
          setOverride(null);
        }} />}
        {contentId && <ContentDetailModal taskId={contentId} onClose={() => setContentId(null)} />}
        {passwordOpen && accountApi && <ChangePasswordModal api={accountApi} onClose={() => setPasswordOpen(false)} onDone={() => { setPasswordOpen(false); notify("Şifreniz güncellendi. Bir sonraki girişte yeni şifrenizi kullanın."); }} />}

        {newTask && (
          <NewTaskModal
            presetBrandId={newTask.brandId}
            defaultDate={defaultDate}
            onClose={() => setNewTask(null)}
            onCreated={(task) => {
              if (!dispatch({ type: "ADD_TASK", task })) return;
              setNewTask(null);
              notify(isVisible(task) ? "Görev oluşturuldu." : "Görev oluşturuldu ancak mevcut filtreler nedeniyle gizli.", isVisible(task) ? "success" : "info");
            }}
          />
        )}
        {deleteTask && (
          <ConfirmDeleteModal
            task={deleteTask}
            onClose={() => setDeleteId(null)}
            onConfirm={() => { if (dispatch({ type: "DELETE_TASK", id: deleteTask.id })) notify("Görev silindi."); setDeleteId(null); }}
          />
        )}
        {preview && <FilePreviewModal kind={preview.kind} id={preview.id} onClose={() => setPreview(null)} />}
        {assetModal && (
          <AddAssetModal
            brandId={selectedBrandId !== "all" ? selectedBrandId : undefined}
            folderId={assetModal.folderId}
            onClose={() => setAssetModal(null)}
            onSave={(asset) => {
              if (!dispatch({ type: "ADD_ASSET", asset })) return;
              setAssetModal(null);
              if (asset.brandId !== selectedBrandId) setSelectedBrandId(asset.brandId);
              setFolderId(asset.folderId);
              notify("Drive bağlantısı marka dosyalarına eklendi.");
            }}
          />
        )}
        {brandModal && (
          <NewBrandModal
            onClose={() => setBrandModal(false)}
            onSave={(brand) => { if (!dispatch({ type: "ADD_BRAND", brand })) return; setBrandModal(false); if (currentPage !== "team") selectBrand(brand.id); notify(`“${brand.name}” markası oluşturuldu.`); }}
          />
        )}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </WorkspaceContext.Provider>
  );
}

/* ───────────────────────── Veri kaynağı & oturum ───────────────────────── */

export const demoSource = createMemorySource(createDemoState, { checklist: createMemoryChecklist(DEMO_CHECKLIST_TEMPLATES), content: createMemoryContent() });
demoSource.brandKit = createMemoryBrandKit(DEMO_BRAND_KITS);

/* Reducer'ı yerel önbellek olarak çalıştırır (iyimser güncelleme) ve her işlemi kaynağa yazar.
   Yazma başarısız olursa kullanıcı uyarılır ve durum sunucudan yeniden yüklenir. */
function useWorkspaceStore(source) {
  const [phase, setPhase] = useState({ name: "loading" });
  const [state, setState] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [denied, setDenied] = useState(null);
  // Oturumdaki gerçek kullanıcı ve (rol değiştirici ile) etkin görüntülenen kullanıcı.
  const [realUserId, setRealUserId] = useState(null);
  const [viewAsId, setViewAsId] = useState(null);
  const stateRef = useRef(null);
  const realRef = useRef(null);
  const viewAsRef = useRef(null);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const { me, state: loaded } = await source.load();
      if (seq !== loadSeq.current) return;
      if (realRef.current !== me) { realRef.current = me; setRealUserId(me); viewAsRef.current = me; setViewAsId(me); }
      // Görüntülenen kullanıcı artık yoksa veya pasifse kendi hesabına dön.
      const viewed = loaded.users.find((u) => u.id === viewAsRef.current);
      if (!viewed || viewed.active === false) { viewAsRef.current = me; setViewAsId(me); }
      setDirectory(loaded.users, viewAsRef.current);
      stateRef.current = loaded; setState(loaded); setPhase({ name: "ready" });
    } catch (err) {
      if (seq !== loadSeq.current) return;
      if (err && err.code === "AUTH_REQUIRED") {
        // Oturum yok (çıkış / süresi doldu): önceki kullanıcının verisi bellekte tutulmaz.
        stateRef.current = null; setState(null);
        realRef.current = null; setRealUserId(null); viewAsRef.current = null; setViewAsId(null);
        setPhase({ name: "auth" });
      } else if (err && err.code === "NO_ACCESS") {
        stateRef.current = null; setState(null);
        setPhase({ name: "no-access", message: err.message });
      } else setPhase({ name: "error", message: err?.message || "Veriler yüklenemedi." });
    }
  }, [source]);

  useEffect(() => {
    load();
    return source.onAuthChange ? source.onAuthChange(() => { setPhase({ name: "loading" }); load(); }) : undefined;
  }, [source, load]);

  /* Her yerel işlem önce yetki kontrolünden geçer (rbac.authorize). Uygulandıysa true döner;
     bileşenler başarı mesajını yalnızca bu durumda gösterir. */
  const dispatchRef = useRef(null);
  const dispatch = useCallback((action) => {
    const prev = stateRef.current;
    if (!prev) return false;
    if (!action.remote) {
      const actorId = viewAsRef.current || realRef.current;
      if (actorId !== realRef.current && !source.allowImpersonation) {
        setDenied({ message: "Önizleme modunda değişiklik yapılamaz. Kendi görünümünüze dönüp tekrar deneyin.", at: Date.now() });
        return false;
      }
      const actor = prev.users.find((u) => u.id === actorId);
      const reason = authorize(actor, action, prev, STATUSES);
      if (reason) { setDenied({ message: reason, at: Date.now() }); return false; }
      ME = actorId;
    }
    const next = reducer(prev, action);
    if (next === prev) return true;
    stateRef.current = next; setState(next);
    if (action.remote) return true;
    const patchTask = (id, patch) => dispatchRef.current({ type: "UPDATE_TASK", id, patch, silent: true, remote: true });
    const merge = (payload) => dispatchRef.current({ type: "REMOTE_MERGE", ...payload, remote: true });
    Promise.resolve(source.persist(action, prev, next, { patchTask, merge, actorId: ME, reload: () => load() })).catch((err) => {
      setSyncError({ message: err?.message || "Bilinmeyen hata", at: Date.now() });
      load();
    });
    return true;
  }, [source, load]);
  dispatchRef.current = dispatch;

  const viewAs = useCallback((userId) => { viewAsRef.current = userId; setViewAsId(userId); }, []);

  // Canlı güncelleme: diğer üyelerin değişiklikleri anında yerel duruma işlenir.
  // Bağlantı koparsa yeniden bağlanınca kaçırılan değişiklikler için tam yükleme yapılır.
  const ready = phase.name === "ready";
  useEffect(() => {
    if (!ready || !source.subscribe) return undefined;
    return source.subscribe({
      onEvent: (action) => dispatchRef.current({ ...action, remote: true }),
      onResync: () => load(),
    });
  }, [ready, source, load]);

  const getState = useCallback(() => stateRef.current, []);

  /* Toplu görev girişi: yetki kontrolü → sunucuya yazma (sonuç beklenir) → başarılıysa merkezi duruma işleme.
     Başarısız olursa durum değişmez ve hata çağırana iletilir (satırlar tabloda kalır). */
  const createTasks = useCallback(async (tasks) => {
    const prev = stateRef.current;
    const actorId = viewAsRef.current || realRef.current;
    if (actorId !== realRef.current && !source.allowImpersonation) throw new Error("Önizleme modunda değişiklik yapılamaz. Kendi görünümünüze dönüp tekrar deneyin.");
    const actor = prev.users.find((u) => u.id === actorId);
    const reason = authorize(actor, { type: "CREATE_TASKS", tasks }, prev, STATUSES);
    if (reason) throw new Error(reason);
    if (!source.createTasks) throw new Error("Veri kaynağı toplu kaydı desteklemiyor.");
    ME = actorId;
    const now = new Date().toISOString();
    const who = USER_BY_ID[actorId]?.name || "Yönetici";
    const activity = tasks.map((t) => ({ id: uid(), taskId: t.id, userId: actorId, text: "görevi toplu görev girişiyle oluşturdu", createdAt: now }));
    const notifications = tasks.flatMap((t) => (t.assigneeId ? makeNotifications([t.assigneeId], t.id, "assign", `${who} “${t.title}” görevini size atadı.`, now) : []));
    const res = await source.createTasks(tasks, { activity, notifications });
    dispatchRef.current({
      type: "TASKS_CREATED", remote: true, activity, notifications, checklists: res.checklists, checklistItems: res.checklistItems,
      tasks: tasks.map((t) => ({ ...t, code: res.codes[t.id] || t.code })),
    });
    return res;
  }, [source]);
  return { phase, state, dispatch, getState, createTasks, syncError, denied, reload: load, realUserId, viewAsId, viewAs };
}

function FullScreenMessage({ children }) {
  return (
    <div className="cw-root min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
      <GlobalStyles />
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6">{children}</div>
    </div>
  );
}

/* Giriş: e-posta + şifre (kullanıcılar Supabase panelinde şifreyle oluşturulur). Şifresi olmayan hesaplar için
   e-postayla giriş bağlantısı ikinci seçenek olarak kalır. Başarılı girişte oturum değişikliği uygulamayı yükler;
   rol ve yönlendirme sunucudaki profilden belirlenir. */
function LoginScreen({ auth }) {
  const [mode, setMode] = useState("password"); // password | link
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState({ name: "idle" });
  // Kullanıcı gitmek istediği sayfaya (ör. /onay/<marka>) geri döner; yalnızca güvenli iç adresler (router.safeNext).
  const next = typeof window === "undefined" ? null : safeNext(new URLSearchParams(window.location.search).get("next"));
  const clearError = () => { if (status.name === "error") setStatus({ name: "idle" }); };
  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setStatus({ name: "error", field: "email", message: "Geçerli bir e-posta adresi girin." }); return; }
    if (mode === "password" && !password) { setStatus({ name: "error", field: "password", message: "Şifrenizi girin." }); return; }
    setStatus({ name: "sending" });
    try {
      if (mode === "password") { await auth.signInWithPassword(email, password); setStatus({ name: "signing-in" }); }
      else { await auth.sendLink(email, next || "/"); setStatus({ name: "sent" }); }
    } catch (err) {
      setStatus({ name: "error", field: mode === "password" ? "password" : "email", message: err?.message || "Giriş yapılamadı." });
    }
  };
  const busy = status.name === "sending" || status.name === "signing-in";
  return (
    <FullScreenMessage>
      <div className="mb-6">
        <LogoImage height={32} />
        <p className="mt-3 cw-12 text-slate-400">Workspace · Giriş</p>
      </div>
      {status.name === "sent" ? (
        <div role="status" className="cw-13 text-slate-700">
          <p className="font-semibold text-slate-900 mb-1">E-postanızı kontrol edin</p>
          <p><strong>{email.trim()}</strong> adresine bir giriş bağlantısı gönderdik. Bağlantıya tıkladığınızda panel açılır.</p>
          <button type="button" onClick={() => { setMode("password"); setStatus({ name: "idle" }); }} className="mt-4 cw-12 font-semibold text-orange-600 hover:text-orange-700">Şifreyle giriş yap</button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3" data-login-mode={mode}>
          <Field label="E-posta" error={status.name === "error" && status.field === "email" ? status.message : ""}>
            <input type="email" autoFocus autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }} placeholder="ad@sirket.com" aria-label="E-posta" className={inputCls(status.name === "error" && status.field === "email")} />
          </Field>
          {mode === "password" && (
            <Field label="Şifre" error={status.name === "error" && status.field === "password" ? status.message : ""} group>
              <div className="relative">
                <input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  aria-label="Şifre" className={`${inputCls(status.name === "error" && status.field === "password")} pr-10`} />
                <button type="button" onClick={() => setShow((x) => !x)} aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"} aria-pressed={show}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
          )}
          <Btn variant="primary" type="submit" className="w-full justify-center" disabled={busy}>
            {busy ? (mode === "password" ? "Giriş yapılıyor…" : "Gönderiliyor…") : mode === "password" ? "Giriş Yap" : "Giriş bağlantısı gönder"}
          </Btn>
          <div className="flex flex-wrap items-center justify-between gap-2 cw-11">
            <span className="text-slate-400">{mode === "password" ? "Şifrenizi unuttuysanız ajans yöneticinizden yeni şifre isteyin." : "Yalnızca kayıtlı kullanıcılar giriş yapabilir."}</span>
            {auth.sendLink && (
              <button type="button" onClick={() => { setMode(mode === "password" ? "link" : "password"); setStatus({ name: "idle" }); }} className="font-semibold text-orange-600 hover:text-orange-700">
                {mode === "password" ? "E-postayla giriş bağlantısı gönder" : "Şifreyle giriş yap"}
              </button>
            )}
          </div>
        </form>
      )}
    </FullScreenMessage>
  );
}

/* E-posta bağlantısı dönüşü (/auth/callback): davet / şifre sıfırlama jetonu doğrulanır, oturum kurulur, kullanıcı rolüne
   (ve gerekirse önce /sifre-olustur'a) yönlendirilir. Doğrulama bitmeden hiçbir yönlendirme yapılmaz; süresi dolmuş veya
   kullanılmış bağlantıda kullanıcı sessizce /login'e atılmaz, nedeni gösterilir. */
function AuthCallbackScreen({ auth, phaseName, reload }) {
  const info = auth?.callback || null;
  const [next] = useState(() => safeNext(new URLSearchParams(window.location.search).get("next")) || ROUTES.dashboard);
  const [status, setStatus] = useState(() => (info && (info.error || info.errorCode) ? { name: "error", info }
    : info?.tokenHash && auth.completeCallback ? { name: "verifying" } : { name: "done" }));
  useEffect(() => {
    if (status.name !== "verifying") return undefined;
    let alive = true;
    auth.completeCallback().then(() => reload()).then(
      () => { if (alive) setStatus({ name: "done" }); },
      (err) => { if (alive) setStatus({ name: "error", info: { errorCode: err?.errorCode || null, errorDescription: err?.errorDescription || err?.message || null } }); },
    );
    return () => { alive = false; };
  }, [status.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const settled = status.name === "done" && phaseName !== "loading";
  useEffect(() => {
    // Oturum hazır (veya erişim / hata ekranı gösterilecek): rol bazlı yönlendirme router'a bırakılır.
    if (settled && phaseName !== "auth") navigate(next, { replace: true });
  }, [settled, phaseName]); // eslint-disable-line react-hooks/exhaustive-deps
  if (status.name === "error" || (settled && phaseName === "auth")) {
    const msg = status.name === "error" ? callbackErrorMessage(status.info) : callbackErrorMessage({});
    const signedIn = phaseName === "ready";
    return (
      <FullScreenMessage>
        <div role="alert" className="cw-13 text-slate-700" data-callback-error={status.info?.errorCode || "invalid"}>
          <p className="flex items-center gap-2 font-semibold text-slate-900 mb-1"><AlertTriangle size={16} className="text-amber-600 shrink-0" />{msg.title}</p>
          <p>{msg.text}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Btn variant="primary" onClick={() => navigate(signedIn ? ROUTES.dashboard : ROUTES.login, { replace: true })}>{signedIn ? "Panele Dön" : "Giriş Sayfasına Git"}</Btn>
          </div>
        </div>
      </FullScreenMessage>
    );
  }
  return <FullScreenMessage><p role="status" className="cw-13 text-slate-500 text-center" data-callback-verifying="">Bağlantınız doğrulanıyor…</p></FullScreenMessage>;
}

/* Davet / şifre sıfırlama bağlantısıyla gelen kullanıcı: panele geçmeden önce şifresini belirler (/sifre-olustur).
   Şifre yalnızca Supabase Auth'ta saklanır. Kaydedilince rolüne göre (sözleşme onayı gerekiyorsa önce /sozlesme) yönlenir. */
function SetPasswordScreen({ api, email, onDone, onSignOut }) {
  const [form, setForm] = useState({ next: "", repeat: "" });
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "", form: "" })); };
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const errs = validatePasswordChange(form, false);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try { await api.setInitialPassword(form.next); await onDone(); }
    catch (err) { setErrors({ [err?.field || "form"]: err?.message || "Şifre kaydedilemedi." }); setSaving(false); }
  };
  const type = show ? "text" : "password";
  return (
    <FullScreenMessage>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-9 w-9 shrink-0 rounded-xl bg-orange-500 text-white flex items-center justify-center"><KeyRound size={18} /></span>
        <div className="min-w-0"><p className="cw-13 font-semibold text-slate-900">Şifrenizi belirleyin</p><p className="cw-12 text-slate-500 truncate">{email}</p></div>
      </div>
      <form onSubmit={submit} noValidate className="space-y-3" data-set-password="">
        <p className="cw-12 text-slate-600">Hesabınızı etkinleştirmek için bir şifre belirleyin. Sonraki girişlerinizde e-posta adresiniz ve bu şifreyi kullanacaksınız.</p>
        {/* Parola yöneticileri için kullanıcı adı (görünmez). */}
        <input type="email" autoComplete="username" value={email || ""} readOnly hidden />
        <Field label="Yeni Şifre" error={errors.next}>
          <input type={type} autoFocus autoComplete="new-password" value={form.next} onChange={(e) => set("next", e.target.value)} aria-label="Yeni Şifre" className={inputCls(errors.next)} />
        </Field>
        <Field label="Yeni Şifre (Tekrar)" error={errors.repeat}>
          <input type={type} autoComplete="new-password" value={form.repeat} onChange={(e) => set("repeat", e.target.value)} aria-label="Yeni Şifre (Tekrar)" className={inputCls(errors.repeat)} />
        </Field>
        <label className="inline-flex items-center gap-2 cw-12 text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-orange-600" />Şifreleri göster
        </label>
        <p className="cw-11 text-slate-500">En az {MIN_PASSWORD} karakter; en az bir harf ve bir rakam içermeli.</p>
        {errors.form && <p role="alert" className="cw-12 text-red-700">{errors.form}</p>}
        <Btn variant="primary" type="submit" className="w-full justify-center" disabled={saving}>{saving ? "Kaydediliyor…" : <><Check size={14} />Şifreyi Kaydet ve Devam Et</>}</Btn>
        {onSignOut && <button type="button" onClick={onSignOut} disabled={saving} className="w-full cw-12 font-semibold text-slate-500 hover:text-slate-800">Çıkış Yap</button>}
      </form>
    </FullScreenMessage>
  );
}

/* `source` verilmezse demo (bellek içi) veriyle açılır. Canlıda:
   <App source={createSupabaseSource(supabase)} />  — bkz. workspaceData.js */
/* Çıkışta kullanıcıya özel bellek içi önbellekler ve bu kullanıcının toplu giriş taslağı temizlenir. */
function clearUserCaches(userId, draftScope) {
  contentUrlCache.clear(); checkNoteDrafts.clear(); kitDrafts.clear(); dirtyKitForms.clear(); loadedKitFonts.clear();
  syncKitUnloadGuard();
  try { if (userId) window.localStorage.removeItem(draftKey(draftScope || "yerel", userId)); } catch { /* depolama kapalı */ }
}

/* "Şifremi Değiştir": şifreyle girilmiş oturumda mevcut şifre sorulur; e-posta bağlantısıyla girilmişse sorulmaz. */
function ChangePasswordModal({ api, onClose, onDone }) {
  const [ctx, setCtx] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ current: "", next: "", repeat: "" });
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    api.passwordContext().then((c) => { if (alive) setCtx(c); }, (e) => { if (alive) setLoadError(e?.message || "Oturum bilgisi alınamadı."); });
    return () => { alive = false; };
  }, [api]);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "", form: "" })); };
  const submit = async (e) => {
    e.preventDefault();
    if (!ctx || saving) return;
    const errs = validatePasswordChange(form, ctx.needsCurrent);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try { await api.changePassword({ current: form.current, next: form.next }); onDone(); }
    catch (err) { setErrors({ [err?.field || "form"]: err?.message || "Şifre güncellenemedi." }); setSaving(false); }
  };
  const type = show ? "text" : "password";
  return (
    <Modal title="Şifremi Değiştir" subtitle={ctx?.email} onClose={onClose} width={440}
      footer={<><Btn variant="secondary" onClick={onClose}>Vazgeç</Btn><Btn variant="primary" type="submit" form="cw-password" disabled={!ctx || saving}>{saving ? "Kaydediliyor…" : <><KeyRound size={14} />Şifreyi Güncelle</>}</Btn></>}>
      {loadError ? <p role="alert" className="cw-13 text-red-700">{loadError}</p> : !ctx ? <p className="cw-13 text-slate-500" aria-busy="true">Yükleniyor…</p> : (
        <form id="cw-password" onSubmit={submit} noValidate className="space-y-3.5" data-password-form="">
          {ctx.needsCurrent ? (
            <Field label="Mevcut Şifre" error={errors.current}>
              <input type={type} autoFocus autoComplete="current-password" value={form.current} onChange={(e) => set("current", e.target.value)} className={inputCls(errors.current)} />
            </Field>
          ) : <p className="cw-12 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">E-posta bağlantısıyla giriş yaptığınız için mevcut şifre sorulmaz. Bundan sonra e-posta ve bu şifreyle de giriş yapabilirsiniz.</p>}
          <Field label="Yeni Şifre" error={errors.next}>
            <input type={type} autoFocus={!ctx.needsCurrent} autoComplete="new-password" value={form.next} onChange={(e) => set("next", e.target.value)} className={inputCls(errors.next)} />
          </Field>
          <Field label="Yeni Şifre (Tekrar)" error={errors.repeat}>
            <input type={type} autoComplete="new-password" value={form.repeat} onChange={(e) => set("repeat", e.target.value)} className={inputCls(errors.repeat)} />
          </Field>
          <label className="inline-flex items-center gap-2 cw-12 text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-orange-600" />Şifreleri göster
          </label>
          <p className="cw-11 text-slate-500">En az {MIN_PASSWORD} karakter; en az bir harf ve bir rakam içermeli.</p>
          {errors.form && <p role="alert" className="cw-12 text-red-700">{errors.form}</p>}
        </form>
      )}
    </Modal>
  );
}

/* İlk girişte zorunlu "Gizlilik ve Rekabet Sözleşmesi". Onaylanmadan panelin hiçbir ekranı açılmaz (router.resolveRoute);
   onay sunucuda kaydedilince veriler yeniden yüklenir ve kullanıcı gideceği sayfaya yönlendirilir. */
/* Sözleşme metni: bölümler, satır sonları korunur; [boşluklar] vurgulanır (yönetici doldurana kadar). */
function BlankText({ text }) {
  return splitBlanks(text).map((p, i) => (p.blank
    ? <mark key={i} className="bg-amber-100 text-amber-900 rounded px-0.5" data-agreement-blank="">{p.text}</mark>
    : <React.Fragment key={i}>{p.text}</React.Fragment>));
}
function AgreementBody({ doc }) {
  return (
    <>
      {doc.sections.map((sec, i) => (
        <section key={i}>
          <h2 className="font-semibold text-slate-900 mb-0.5"><BlankText text={sec.heading} /></h2>
          <p className="whitespace-pre-line"><BlankText text={sec.body} /></p>
        </section>
      ))}
      <p className="cw-11 text-slate-400">Sürüm: {doc.version}</p>
    </>
  );
}

function AgreementScreen({ doc = DEFAULT_AGREEMENT, onAccept, onSignOut }) {
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState({ name: "idle" });
  const saving = status.name === "saving";
  const submit = async (e) => {
    e.preventDefault();
    if (!checked) { setStatus({ name: "error", message: "Devam etmek için sözleşmeyi onaylamanız gerekiyor." }); return; }
    setStatus({ name: "saving" });
    try { await onAccept(doc.version); }
    catch (err) { setStatus({ name: "error", message: err?.message || "Onayınız kaydedilemedi." }); }
  };
  return (
    <div className="cw-root min-h-screen w-full flex items-start sm:items-center justify-center bg-slate-50 px-4 py-6" data-agreement="">
      <GlobalStyles />
      <form onSubmit={submit} noValidate className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col" style={{ maxHeight: "calc(100dvh - 3rem)" }}>
        <header className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 shrink-0 rounded-xl bg-orange-500 text-white flex items-center justify-center"><ShieldCheck size={18} /></span>
            <div className="min-w-0">
              <h1 className="cw-15 font-semibold text-slate-900">{doc.title}</h1>
              <p className="cw-12 text-slate-500">Panele ilk girişinizde bu sözleşmeyi okuyup onaylamanız gerekiyor.</p>
            </div>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-3.5 cw-13 text-slate-700 leading-relaxed" tabIndex={0} aria-label="Sözleşme metni" data-agreement-text="">
          <AgreementBody doc={doc} />
        </div>
        <footer className="px-5 sm:px-6 py-4 border-t border-slate-100 space-y-3">
          <label className="flex items-start gap-2.5 cw-13 text-slate-800 cursor-pointer select-none">
            <input type="checkbox" checked={checked} onChange={(e) => { setChecked(e.target.checked); if (status.name === "error") setStatus({ name: "idle" }); }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600" data-agreement-consent="" />
            <span>{doc.consent}</span>
          </label>
          {status.name === "error" && <p role="alert" className="cw-12 text-red-700">{status.message}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            {onSignOut ? <Btn variant="secondary" type="button" onClick={onSignOut} disabled={saving}><LogOut size={14} />Onaylamadan Çıkış Yap</Btn> : <span />}
            <Btn variant="primary" type="submit" disabled={!checked || saving} className="justify-center">
              {saving ? "Kaydediliyor…" : <><Check size={14} />Onaylıyorum, Devam Et</>}
            </Btn>
          </div>
        </footer>
      </form>
    </div>
  );
}

function NoAccessScreen({ message, onSignOut, onRetry }) {
  return (
    <FullScreenMessage>
      <div role="alert" className="cw-13 text-slate-700" data-no-access="">
        <p className="flex items-center gap-2 font-semibold text-slate-900 mb-1"><Lock size={16} className="text-amber-600" />Erişim yetkiniz yok</p>
        <p>{message || "Bu sayfayı görüntüleme yetkiniz bulunmuyor."}</p>
        <div className="mt-4 flex gap-2">
          {onRetry && <Btn variant="secondary" onClick={onRetry}><RefreshCw size={14} />Tekrar Kontrol Et</Btn>}
          {onSignOut && <Btn variant="primary" onClick={onSignOut}><LogOut size={14} />Çıkış Yap</Btn>}
        </div>
      </div>
    </FullScreenMessage>
  );
}

export default function App({ source = demoSource }) {
  const { phase, state, dispatch, getState, createTasks, syncError, denied, reload, realUserId, viewAsId, viewAs } = useWorkspaceStore(source);
  // Marka kılavuzu önbelleği kullanıcıya özeldir: kullanıcı değişince yeniden oluşturulur.
  const brandKit = useMemo(() => (source.brandKit ? createBrandKitStore(source.brandKit) : null), [source, realUserId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sözleşme metnini kaydetme (Admin → Sözleşme): kayıttan sonra metin ve onay durumları yeniden yüklenir.
  const agreementApi = useMemo(() => (source.agreement?.save
    ? { save: async (doc, opts) => { const v = await source.agreement.save(doc, opts); await reload(); return v; } }
    : null), [source, reload]);
  const signOut = source.auth ? () => { clearUserCaches(realUserId, source.draftScope); source.auth.signOut().catch(() => {}); } : null;

  /* Rol bazlı yönlendirme: her konum değişikliğinde (bağlantı, geri/ileri, doğrudan adres) yeniden karar verilir.
     Yönlendirme gerekiyorsa yanlış ekran hiç çizilmez. */
  const loc = useSyncExternalStore(subscribeLocation, locationKey, () => "/");
  const actor = state && phase.name === "ready" ? state.users.find((u) => u.id === (viewAsId || realUserId)) : null;
  const routePhase = phase.name === "ready" && state ? "ready" : phase.name === "auth" && source.auth ? "auth" : phase.name;
  // Sözleşme onayı oturumdaki gerçek kullanıcıya aittir (rol değiştirici ile önizlenen kullanıcıya değil).
  const agreementAccepted = routePhase === "ready" && state.agreement ? state.agreement.accepted : undefined;
  // Davet / sıfırlama bağlantısıyla gelip şifresini henüz belirlememiş kullanıcı (yalnızca gerçek oturum sahibi).
  const needsPassword = routePhase === "ready" && !!state.needsPassword && !!source.account?.setInitialPassword;
  const route = resolveRoute({ path: window.location.pathname, search: window.location.search, phase: routePhase, role: actor?.role || null, agreementAccepted, needsPassword });
  // Yönetici kullanıcıyı şifreyle oluşturur / şifre belirler (yalnızca canlı kaynak). Oluşturduktan sonra liste yeniden yüklenir.
  const userApi = useMemo(() => (source.users
    ? { ...source.users, create: async (...args) => { const res = await source.users.create(...args); await reload(); return res; } }
    : null), [source, reload]);
  const [staffFocus, setStaffFocus] = useState(null);
  useEffect(() => {
    if (!route.redirect) return;
    // Ekip bir marka onay bağlantısıyla geldiyse ajans tarafındaki onay ekranı o markayla açılır.
    if (route.portal && route.portal !== "*" && routePhase === "ready" && actor?.role !== "client") setStaffFocus({ slug: route.portal, n: Date.now() });
    navigate(route.redirect, { replace: true });
  }, [route.redirect, loc]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sekmeye dönüldüğünde rol / aktiflik sunucuda değiştiyse (veya oturum düştüyse) eski yetki kullanılmaz. */
  const lastCheck = useRef(0);
  useEffect(() => {
    if (phase.name !== "ready" || !source.checkProfile) return undefined;
    const onVisible = async () => {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck.current < 30 * 1000) return;
      lastCheck.current = Date.now();
      const p = await source.checkProfile().catch(() => undefined);
      if (p === undefined) return;
      const me = getState()?.users.find((u) => u.id === realUserId);
      if (p === null || !me || p.id !== me.id || p.role !== me.role || p.active === false) reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase.name, source, realUserId, reload, getState]);

  if (route.redirect) return <FullScreenMessage><p role="status" className="cw-13 text-slate-500 text-center">Yönlendiriliyor…</p></FullScreenMessage>;
  if (route.callback) return <AuthCallbackScreen auth={source.auth} phaseName={phase.name} reload={reload} />;
  if (phase.name === "auth" && source.auth) return <LoginScreen auth={source.auth} />;
  if (phase.name === "no-access") return <NoAccessScreen message={phase.message} onSignOut={signOut} onRetry={reload} />;
  if (phase.name === "ready" && state && (!actor || !ROLES.includes(actor.role))) {
    return <NoAccessScreen message="Hesabınızın rolü tanımlı değil. Ajans yöneticinizle iletişime geçin." onSignOut={signOut} />;
  }
  if (phase.name === "error") {
    return (
      <FullScreenMessage>
        <div role="alert" className="cw-13 text-slate-700">
          <p className="flex items-center gap-2 font-semibold text-slate-900 mb-1"><AlertTriangle size={16} className="text-red-500" />Panel açılamadı</p>
          <p>{phase.message}</p>
          <div className="mt-4 flex gap-2">
            <Btn variant="primary" onClick={reload}>Tekrar Dene</Btn>
            {signOut && <Btn variant="secondary" onClick={signOut}>Çıkış Yap</Btn>}
          </div>
        </div>
      </FullScreenMessage>
    );
  }
  if (phase.name !== "ready" || !state) {
    return (
      <FullScreenMessage>
        <p role="status" className="cw-13 text-slate-500 text-center">Çalışma alanı yükleniyor…</p>
      </FullScreenMessage>
    );
  }
  if (route.setPassword) {
    const me = state.users.find((u) => u.id === realUserId);
    return <SetPasswordScreen api={source.account} email={me?.email || ""} onSignOut={signOut} onDone={reload} />;
  }
  if (route.agreement) {
    // Kaynak sözleşmeyi desteklemiyorsa (beklenmeyen durum) panel açılmaz.
    if (!source.agreement) return <NoAccessScreen message="Sözleşme onayı şu anda alınamıyor. Ajans yöneticinizle iletişime geçin." onSignOut={signOut} onRetry={reload} />;
    return <AgreementScreen doc={state.agreementText || DEFAULT_AGREEMENT} onSignOut={signOut} onAccept={async (version) => { await source.agreement.accept(version); await reload(); }} />;
  }
  return (
    <Workspace
      state={state} dispatch={dispatch} getState={getState} createTasks={createTasks} draftScope={source.draftScope || null} actorId={viewAsId} realUserId={realUserId} onViewAs={viewAs}
      allowImpersonation={!!source.allowImpersonation} onSignOut={signOut} syncError={syncError} denied={denied} media={source.media || null} brandKit={brandKit}
      checklistApi={source.checklist || null} contentApi={source.content || null} accountApi={source.account || null} agreementApi={agreementApi} userApi={userApi}
      portalSlug={actor?.role === "client" ? route.portal : staffFocus?.slug ?? null} portalKey={actor?.role === "client" ? loc : staffFocus?.n}
    />
  );
}
