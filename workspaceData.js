/*
 * AgencyOS — veri katmanı
 *
 * Panel, durumunu yerel bir reducer'da tutar (iyimser güncelleme) ve her değişikliği
 * `source.persist(action, prev, next, helpers)` ile kalıcı kaynağa yazar.
 *
 * Bir "source" şu arayüzü uygular:
 *   load()                         → { users, me, state }   (oturum yoksa AuthRequiredError fırlatır)
 *   persist(action, prev, next, h) → Promise                 (h.patchTask(id, patch): sunucudan dönen alanları yerel duruma işler)
 *   onAuthChange?(cb)              → abonelikten çıkma fonksiyonu
 *   subscribe?({ onEvent, onResync }) → canlı güncelleme; onEvent(REMOTE_UPSERT | REMOTE_DELETE işlemi)
 *   auth?                          → { sendLink(email), signOut() }  (null ise giriş ekranı gösterilmez)
 *   media?                         → { upload(file, taskId) → { path, url }, resolve(paths) → { path: url } }
 *                                    (null ise açıklama görselleri metne gömülür — yalnızca demo)
 *   brandKit?                      → marka kılavuzu API'si (bkz. brandKit.js)
 *   checklist?                     → kontrol listesi şablon/geçmiş API'si (bkz. checklist.js)
 *
 *   createTasks(tasks, { activity, notifications }) → { codes: { taskId: "CW-…" }, checklists, checklistItems }
 *                                  Toplu görev girişi: iyimser değil, sonucu beklenir. Tek istekte (tek işlem) yazılır;
 *                                  aynı görev kimlikleriyle tekrar çağrılırsa mevcut görevler yeniden oluşturulmaz.
 *
 * persist yardımcıları: patchTask(id, patch), merge({ taskId?, checklists, checklistItems }) (sunucunun oluşturduğu
 * kontrol listesi kayıtlarını yerel duruma işler; taskId verilirse o görevin kayıtları tümüyle değiştirilir), reload(), actorId.
 *
 * İki uygulama var: createMemorySource (demo, kalıcı değil) ve createSupabaseSource (canlı).
 */

import { createSupabaseBrandKit } from "./brandKit.js";
import {
  checklistError, createSupabaseChecklist, currentChecklist, incompleteMessage, isMissingRelation, itemsOf, missingForSubmit,
  rowToChecklist, rowToChecklistItem, startRevisionCycle,
} from "./checklist.js";

export class AuthRequiredError extends Error {
  constructor() { super("Oturum açmanız gerekiyor."); this.code = "AUTH_REQUIRED"; }
}

const taskCode = (no) => (no == null ? null : `CW-${no}`);

/* Yeni eklenen aktivite kayıtları (reducer bunları başa ekler). */
function newActivity(prev, next) {
  if (prev.activity === next.activity) return [];
  const seen = new Set(prev.activity.map((a) => a.id));
  return next.activity.filter((a) => !seen.has(a.id));
}

/* ───────────────────────── Demo (bellek içi) kaynak ───────────────────────── */

export function createMemorySource(buildDemo, { checklist = null } = {}) {
  let taskNo = 1000;
  const created = new Map(); // görev kimliği → kod (tekrar denemede aynı kod)
  return {
    draftScope: "demo",
    async createTasks(tasks) {
      await new Promise((r) => setTimeout(r, 120));
      // Yalnızca demo: tarayıcı testlerinde ağ hatasını taklit etmek için (window.__cwSimulateSaveError = true).
      const fail = globalThis.__cwSimulateSaveError;
      if (fail) { globalThis.__cwSimulateSaveError = null; throw new Error(typeof fail === "string" ? fail : "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin."); }
      const codes = {}, checklists = [], checklistItems = [];
      tasks.forEach((t) => {
        if (!created.has(t.id)) {
          created.set(t.id, taskCode(++taskNo));
          const r = checklist && checklist.instantiateFor(t, 0);
          if (r) { checklists.push(r.checklist); checklistItems.push(...r.items); }
        }
        codes[t.id] = created.get(t.id);
      });
      return { codes, checklists, checklistItems };
    },
    auth: null,
    allowImpersonation: true, // demo: rol değiştirici başka kullanıcı adına işlem yapabilir
    checklist,
    async load() {
      const demo = buildDemo(checklist);
      taskNo = 1000;
      demo.state.tasks.forEach((t) => { const n = Number(String(t.code || "").replace("CW-", "")); if (n > taskNo) taskNo = n; });
      demo.state.features = { checklists: !!checklist };
      return demo;
    },
    async persist(action, prev, next, { patchTask, merge, actorId }) {
      if (action.type === "ADD_TASK") patchTask(action.task.id, { code: taskCode(++taskNo) });
      if (action.type === "ADD_TASKS") action.tasks.forEach((t) => patchTask(t.id, { code: taskCode(++taskNo) }));
      if (checklist) emulateChecklistServer(checklist, action, prev, next, merge, actorId);
    },
  };
}

/* Demo: 006'daki tetikleyici ve fonksiyonların bellek içi karşılığı (yeni görev, revizyon döngüsü, format değişikliği,
   gönderim doğrulaması ve denetim kayıtları). */
function emulateChecklistServer(api, action, prev, next, merge, actorId) {
  const taskOf = (id) => next.tasks.find((t) => t.id === id);
  const create = (task, cycle = 0) => { const r = task && api.instantiateFor(task, cycle); if (r) merge({ checklists: [r.checklist], checklistItems: r.items }); };
  const revise = (taskId) => {
    const cur = currentChecklist(next.checklists, taskId);
    if (!cur) { create(taskOf(taskId)); return; }
    const r = startRevisionCycle(cur, itemsOf(next.checklistItems, cur.id));
    merge({ checklists: [r.closed, r.checklist], checklistItems: r.items });
    api.log({ taskId, checklistId: r.checklist.id, userId: actorId, kind: "cycle", detail: `Revizyon ${r.checklist.cycle} başladı` });
  };
  switch (action.type) {
    case "ADD_TASK": create(action.task); break;
    case "ADD_TASKS": action.tasks.forEach((t) => create(t)); break;
    case "REVIEW_CONTENT": if (action.decision === "revision") revise(action.taskId); break;
    case "UPDATE_TASK": {
      const before = prev.tasks.find((t) => t.id === action.id), after = taskOf(action.id);
      if (!before || !after) break;
      const cur = currentChecklist(next.checklists, after.id);
      if (after.status === "Revizyon" && before.status !== "Revizyon") { revise(after.id); break; }
      if ((after.format !== before.format || after.brandId !== before.brandId) && cur && !cur.closedAt
          && !itemsOf(next.checklistItems, cur.id).some((i) => i.isCompleted || i.note)) {
        const r = api.instantiateFor(after, cur.cycle);
        merge({
          taskId: after.id,
          checklists: [...next.checklists.filter((c) => c.taskId === after.id && c.id !== cur.id), ...(r ? [r.checklist] : [])],
          checklistItems: [...next.checklistItems.filter((i) => i.taskId === after.id && i.checklistId !== cur.id), ...(r ? r.items : [])],
        });
        break;
      }
      if (before.checklistDisabled && !after.checklistDisabled && !cur) create(after);
      break;
    }
    case "TOGGLE_CHECK":
    case "SET_CHECK_NOTE": {
      const item = next.checklistItems.find((i) => i.id === action.itemId);
      if (item) {
        api.log({
          taskId: item.taskId, checklistId: item.checklistId, itemId: item.id, itemTitle: item.title, userId: actorId,
          kind: action.type === "SET_CHECK_NOTE" ? "note" : action.completed ? "completed" : "reopened", detail: action.type === "SET_CHECK_NOTE" ? item.note : "",
        });
      }
      break;
    }
    case "SUBMIT_TASK": {
      const task = prev.tasks.find((t) => t.id === action.id);
      const missing = missingForSubmit(prev, task).length;
      const reason = missing ? String(action.reason || "").trim() : "";
      if (missing && !reason) throw new Error(incompleteMessage(missing));
      const cur = task.checklistDisabled ? null : currentChecklist(prev.checklists, task.id);
      const items = cur ? itemsOf(prev.checklistItems, cur.id) : [];
      api.logSubmission({
        taskId: task.id, checklistId: cur?.id || null, cycle: cur?.cycle ?? null, fromStatus: task.status, targetStatus: action.status, submittedBy: actorId,
        total: items.length, done: items.filter((i) => i.isCompleted).length, required: items.filter((i) => i.isRequired).length,
        requiredDone: items.filter((i) => i.isRequired && i.isCompleted).length, overrideReason: reason || null,
      });
      break;
    }
    default:
  }
}

/* ───────────────────────── Supabase kaynağı ───────────────────────── */

/* Uygulama alanı → veritabanı sütunu. Boş string tarih/sorumlu değerleri null olarak yazılır. */
const TASK_COLUMNS = {
  brandId: "brand_id", title: "title", platform: "platform", format: "format", assigneeId: "assignee_id",
  status: "status", priority: "priority", publishDate: "publish_date", dueDate: "due_date", dueTime: "due_time",
  description: "description", createdAt: "created_at", updatedAt: "updated_at", checklistDisabled: "checklist_disabled",
};
const NULLABLE = new Set(["assignee_id", "publish_date", "due_date", "due_time"]);
const ASSET_COLUMNS = {
  brandId: "brand_id", folderId: "folder_id", name: "name", type: "type", thumbnail: "thumbnail_url",
  driveFileId: "drive_file_id", driveUrl: "drive_url", size: "size_label", owner: "owner_id",
  approvalStatus: "approval_status", updatedAt: "updated_on",
};

function toColumns(obj, map) {
  const row = {};
  Object.entries(obj).forEach(([k, v]) => {
    const col = map[k];
    if (!col) return;
    row[col] = NULLABLE.has(col) && v === "" ? null : v;
  });
  return row;
}

const rowToTask = (r) => ({
  id: r.id, code: taskCode(r.task_no), brandId: r.brand_id, title: r.title, platform: r.platform, format: r.format,
  assigneeId: r.assignee_id || "", status: r.status, priority: r.priority, publishDate: r.publish_date || "", dueDate: r.due_date || "",
  dueTime: r.due_time ? String(r.due_time).slice(0, 5) : "",
  description: r.description || "", createdAt: r.created_at, updatedAt: r.updated_at, checklistDisabled: r.checklist_disabled === true,
});
const taskToRow = (t) => {
  const row = { id: t.id, ...toColumns(t, TASK_COLUMNS) };
  if (!row.checklist_disabled) delete row.checklist_disabled; // varsayılan değer; 006 öncesi şemayla da uyumlu
  return row;
};

const rowToBrand = (r) => ({ id: r.id, name: r.name, initials: r.initials, sector: r.sector, color: r.color, driveFolderId: r.drive_folder_id, status: r.status || "active" });
const brandToRow = (b) => ({ id: b.id, name: b.name, initials: b.initials, sector: b.sector, color: b.color, drive_folder_id: b.driveFolderId || null, status: b.status || "active" });
const BRAND_COLUMNS = { name: "name", initials: "initials", sector: "sector", color: "color", driveFolderId: "drive_folder_id", status: "status" };

const rowToAsset = (r) => ({
  id: r.id, brandId: r.brand_id, folderId: r.folder_id, name: r.name, type: r.type, thumbnail: r.thumbnail_url,
  driveFileId: r.drive_file_id, driveUrl: r.drive_url, size: r.size_label, owner: r.owner_id, approvalStatus: r.approval_status, updatedAt: r.updated_on,
});
const assetToRow = (a) => ({ id: a.id, ...toColumns(a, ASSET_COLUMNS) });

const rowToAttachment = (r) => ({
  id: r.id, taskId: r.task_id, assetId: r.asset_id, name: r.name, type: r.type, size: r.size_label,
  thumbnail: r.thumbnail_url, driveUrl: r.drive_url, addedBy: r.added_by, createdAt: r.created_at, internal: r.internal === true,
});
const attachmentToRow = (a) => ({
  id: a.id, task_id: a.taskId, asset_id: a.assetId || null, name: a.name, type: a.type, size_label: a.size,
  thumbnail_url: a.thumbnail || null, drive_url: a.driveUrl, added_by: a.addedBy, created_at: a.createdAt, internal: !!a.internal,
});

const rowToComment = (r) => ({ id: r.id, taskId: r.task_id, userId: r.user_id, text: r.body, createdAt: r.created_at });
const commentToRow = (c) => ({ id: c.id, task_id: c.taskId, user_id: c.userId, body: c.text, created_at: c.createdAt });

const rowToActivity = (r) => ({ id: r.id, taskId: r.task_id, userId: r.user_id, text: r.text, createdAt: r.created_at });
const activityToRow = (a) => ({ id: a.id, task_id: a.taskId, user_id: a.userId, text: a.text, created_at: a.createdAt });

const rowToUser = (r) => ({
  id: r.id, name: r.full_name, email: r.email || "", role: r.role || "employee", title: r.role_title || "", company: r.company || "",
  color: r.color, active: r.active !== false, permissions: r.permissions ?? null, lastActiveAt: r.last_seen_at || null,
});
const USER_COLUMNS = { name: "full_name", title: "role_title", role: "role", company: "company", color: "color", active: "active", permissions: "permissions" };

const membershipId = (brandId, userId) => `${brandId}:${userId}`;
const rowToMembership = (r) => ({ id: membershipId(r.brand_id, r.user_id), brandId: r.brand_id, userId: r.user_id });
const rowToApproval = (r) => ({ id: r.id, taskId: r.task_id, userId: r.user_id, decision: r.decision, note: r.note || "", link: r.link || "", createdAt: r.created_at });
const approvalToRow = (a) => ({ id: a.id, task_id: a.taskId, user_id: a.userId, decision: a.decision, note: a.note || "", link: a.link || null, created_at: a.createdAt });
const rowToNotification = (r) => ({ id: r.id, userId: r.user_id, taskId: r.task_id, kind: r.kind, text: r.text, createdAt: r.created_at, readAt: r.read_at });
const notificationToRow = (n) => ({ id: n.id, user_id: n.userId, task_id: n.taskId || null, kind: n.kind, text: n.text, created_at: n.createdAt });

/* Yeni eklenen kayıtlar (önceki durumda olmayan kimlikler). */
const added = (prevList, nextList) => {
  if (prevList === nextList) return [];
  const seen = new Set(prevList.map((x) => x.id));
  return nextList.filter((x) => !seen.has(x.id));
};

export const IMAGE_BUCKET = "task-images";
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
const SIGNED_URL_SECONDS = 60 * 60;

/* Canlı güncellemede dinlenen tablolar → yerel koleksiyon ve satır dönüştürücü. */
const LIVE_TABLES = {
  tasks: ["tasks", (r) => rowToTask(r)],
  comments: ["comments", (r) => rowToComment(r)],
  attachments: ["attachments", (r) => rowToAttachment(r)],
  assets: ["assets", (r) => rowToAsset(r)],
  brands: ["brands", (r) => rowToBrand(r)],
  activity: ["activity", (r) => rowToActivity(r)],
  profiles: ["users", (r) => rowToUser(r)],
  brand_members: ["memberships", (r) => rowToMembership(r)],
  approvals: ["approvals", (r) => rowToApproval(r)],
  notifications: ["notifications", (r) => rowToNotification(r)],
};
/* 006 çalıştırıldıysa (tablolar varsa) ayrıca dinlenen tablolar. */
const CHECKLIST_LIVE_TABLES = {
  task_checklist_instances: ["checklists", (r) => rowToChecklist(r)],
  task_checklist_items: ["checklistItems", (r) => rowToChecklistItem(r)],
};
const rowKey = (table, r) => (table === "brand_members" ? membershipId(r.brand_id, r.user_id) : r.id);

export function createSupabaseSource(supabase, { descriptionDebounceMs = 600, storage = {} } = {}) {
  const must = ({ data, error }) => { if (error) throw error; return data; };

  /* Kendi yazdığımız satırların canlı güncelleme yankısı, yerel olarak daha yeni bir değeri
     geçici olarak geri almasın diye kısa süre yok sayılır. */
  const ECHO_WINDOW_MS = 2500;
  const localWrites = new Map();
  const touch = (table, id) => localWrites.set(`${table}:${id}`, Date.now());
  const recentlyWritten = (table, id) => {
    const at = localWrites.get(`${table}:${id}`);
    return at != null && Date.now() - at < ECHO_WINDOW_MS;
  };

  /* Supabase tek sorguda en fazla 1000 satır döndürür; tabloyu sayfalayarak okur. */
  async function selectAll(table, order, ascending = true) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const page = must(await supabase.from(table).select("*").order(order, { ascending }).range(from, from + 999));
      out.push(...page);
      if (page.length < 1000) return out;
    }
  }

  /* Yazmalar sırayla çalışır: görev eklenmeden yorumu/aktivitesi yazılmaz. */
  let queue = Promise.resolve();
  const enqueue = (fn) => { const run = queue.then(fn); queue = run.catch(() => {}); return run; };

  /* Açıklama editörü her tuşta değişiklik gönderir; görev başına birleştirip gecikmeli yazar. */
  const pendingDescriptions = new Map();
  const writeDescription = (id, description) => enqueue(async () => {
    touch("tasks", id);
    must(await supabase.from("tasks").update({ description }).eq("id", id));
    touch("tasks", id);
  });
  const flushDescriptions = () => {
    const jobs = [];
    pendingDescriptions.forEach(({ timer, description, resolve, reject }, id) => {
      clearTimeout(timer);
      jobs.push(writeDescription(id, description).then(resolve, reject));
    });
    pendingDescriptions.clear();
    return Promise.all(jobs);
  };
  if (typeof window !== "undefined") window.addEventListener("pagehide", flushDescriptions);

  /* Görev silinince açıklamadaki görseller de Storage'dan silinir (başarısız olursa görev silme yine geçerlidir). */
  const removeTaskImages = async (taskId) => {
    try {
      const files = must(await supabase.storage.from(IMAGE_BUCKET).list(taskId, { limit: 1000 }));
      if (files?.length) must(await supabase.storage.from(IMAGE_BUCKET).remove(files.map((f) => `${taskId}/${f.name}`)));
    } catch (err) {
      console.warn("Görev görselleri silinemedi:", err);
    }
  };

  const insertActivity = async (entries) => {
    if (entries.length) must(await supabase.from("activity").insert(entries.map(activityToRow)));
  };

  /* Bildirimler asıl işlemden sonra yazılır; gönderilemezse işlem geri alınmaz, yalnızca uyarı düşülür. */
  const insertNotifications = async (entries) => {
    if (!entries.length) return;
    const { error } = await supabase.from("notifications").insert(entries.map(notificationToRow));
    if (error) console.warn("Bildirim gönderilemedi:", error.message);
  };

  /* Marka üyeliklerindeki farkı (eklenen/çıkarılan) veritabanına yansıtır. */
  const syncMemberships = async (prev, next) => {
    const before = new Map(prev.memberships.map((m) => [m.id, m]));
    const after = new Map(next.memberships.map((m) => [m.id, m]));
    const removed = [...before.values()].filter((m) => !after.has(m.id));
    const inserted = [...after.values()].filter((m) => !before.has(m.id));
    for (const m of removed) must(await supabase.from("brand_members").delete().eq("brand_id", m.brandId).eq("user_id", m.userId));
    if (inserted.length) must(await supabase.from("brand_members").insert(inserted.map((m) => ({ brand_id: m.brandId, user_id: m.userId }))));
  };

  const invokeError = async (error) => {
    let message = error?.message || "İşlem tamamlanamadı.";
    try { const body = await error.context.json(); if (body?.error) message = body.error; } catch { /* gövde yok */ }
    return new Error(message);
  };

  /* Kontrol listesi tabloları var mı (load sırasında belirlenir). Yoksa panel 006 öncesi gibi çalışır. */
  let checklistsAvailable = false;
  const checklistApi = createSupabaseChecklist(supabase);
  const mustCl = ({ data, error }) => {
    if (error) throw error.code === "PGRST116" ? new Error("Bu kontrol listesinde işlem yapma yetkiniz yok.") : checklistError(error);
    return data;
  };
  /* Sunucu tetikleyicisinin oluşturduğu/değiştirdiği kontrol listesi kayıtlarını yeniden okur (canlı güncellemeyi beklemeden). */
  const refreshChecklist = async (taskId, merge) => {
    if (!checklistsAvailable) return;
    try { merge(await checklistApi.refresh(taskId)); } catch (err) { console.warn("Kontrol listesi yenilenemedi:", err.message); }
  };

  const write = async (action, prev, next, { patchTask, reload, merge }) => {
    const activity = newActivity(prev, next);
    const notifications = action.type === "MARK_NOTIFICATIONS_READ" ? [] : added(prev.notifications, next.notifications);
    switch (action.type) {
      case "ADD_TASK": {
        const row = must(await supabase.from("tasks").insert(taskToRow(action.task)).select("id, task_no").single());
        patchTask(row.id, { code: taskCode(row.task_no) });
        await refreshChecklist(row.id, merge);
        break;
      }
      case "ADD_TASKS": {
        if (action.brands?.length) must(await supabase.from("brands").insert(action.brands.map(brandToRow)));
        const rows = must(await supabase.from("tasks").insert(action.tasks.map(taskToRow)).select("id, task_no"));
        rows.forEach((r) => patchTask(r.id, { code: taskCode(r.task_no) }));
        break;
      }
      case "UPDATE_TASK": {
        const row = toColumns(action.patch, TASK_COLUMNS);
        delete row.updated_at; // veritabanı tetikleyicisi ayarlar
        if (Object.keys(row).length) {
          touch("tasks", action.id);
          must(await supabase.from("tasks").update(row).eq("id", action.id));
          touch("tasks", action.id);
        }
        // Revizyon döngüsü, format/marka değişikliği ve listenin açılıp kapanması sunucu tetikleyicisiyle işlenir.
        if (row.status === "Revizyon" || "format" in row || "brand_id" in row || "checklist_disabled" in row) await refreshChecklist(action.id, merge);
        break;
      }
      case "SUBMIT_TASK": {
        // Yetki + zorunlu kontrol doğrulaması + durum değişikliği sunucuda tek işlemde (006 submit_task_for_approval).
        touch("tasks", action.id);
        const { error } = await supabase.rpc("submit_task_for_approval", { p_task: action.id, p_status: action.status, p_reason: action.reason || null });
        if (error) {
          if (!checklistsAvailable && isMissingRelation(error)) must(await supabase.from("tasks").update({ status: action.status }).eq("id", action.id)); // 006 öncesi
          else throw checklistError(error);
        }
        touch("tasks", action.id);
        break;
      }
      case "TOGGLE_CHECK":
      case "SET_CHECK_NOTE": {
        const patch = action.type === "TOGGLE_CHECK" ? { is_completed: action.completed } : { note: String(action.note || "").trim() };
        touch("task_checklist_items", action.itemId);
        const saved = mustCl(await supabase.from("task_checklist_items").update(patch).eq("id", action.itemId).select().single());
        touch("task_checklist_items", action.itemId);
        merge({ checklistItems: [rowToChecklistItem(saved)] }); // tamamlayan ve zaman sunucudan
        break;
      }
      case "DELETE_TASK":
        // Görseller görev silinmeden önce kaldırılır (Storage erişimi görev görünürlüğüne bağlı).
        // Yorum, ek, onay ve aktivite kayıtları yabancı anahtar (on delete cascade) ile silinir.
        await removeTaskImages(action.id);
        must(await supabase.from("tasks").delete().eq("id", action.id));
        return;
      case "ADD_COMMENT": {
        const seen = new Set(prev.comments.map((c) => c.id));
        const added = next.comments.filter((c) => !seen.has(c.id));
        if (added.length) must(await supabase.from("comments").insert(added.map(commentToRow)));
        break;
      }
      case "DELETE_COMMENT":
        must(await supabase.from("comments").delete().eq("id", action.id));
        break;
      case "ADD_ATTACHMENT":
        must(await supabase.from("attachments").insert(attachmentToRow(action.attachment)));
        break;
      case "REMOVE_ATTACHMENT":
        must(await supabase.from("attachments").delete().eq("id", action.id));
        break;
      case "ADD_BRAND":
        must(await supabase.from("brands").insert(brandToRow(action.brand)));
        break;
      case "ADD_ASSET":
        must(await supabase.from("assets").insert(assetToRow(action.asset)));
        break;
      case "UPDATE_ASSET": {
        const updated = next.assets.find((a) => a.id === action.id);
        if (updated) {
          touch("assets", action.id);
          must(await supabase.from("assets").update(toColumns({ ...action.patch, updatedAt: updated.updatedAt }, ASSET_COLUMNS)).eq("id", action.id));
          touch("assets", action.id);
        }
        break;
      }
      case "REVIEW_CONTENT": {
        // Görev durumu veritabanında apply_approval tetikleyicisiyle güncellenir.
        const approval = added(prev.approvals, next.approvals)[0];
        if (approval) must(await supabase.from("approvals").insert(approvalToRow(approval)));
        touch("tasks", action.taskId);
        if (action.decision === "revision") await refreshChecklist(action.taskId, merge); // yeni revizyon döngüsü
        break;
      }
      case "ADD_USER": {
        const { error } = await supabase.functions.invoke("invite-user", {
          body: {
            name: action.user.name, email: action.user.email, role: action.user.role, title: action.user.title,
            company: action.user.company, permissions: action.user.permissions, brandIds: action.brandIds,
            redirectTo: typeof window !== "undefined" ? window.location.origin + window.location.pathname : undefined,
          },
        });
        if (error) throw await invokeError(error);
        reload(); // gerçek kullanıcı kimliğiyle yeniden yükle
        return;
      }
      case "UPDATE_USER":
        touch("profiles", action.id);
        must(await supabase.from("profiles").update(toColumns(action.patch, USER_COLUMNS)).eq("id", action.id));
        touch("profiles", action.id);
        break;
      case "SET_USER_BRANDS":
      case "SET_BRAND_MEMBERS":
        await syncMemberships(prev, next);
        break;
      case "UPDATE_BRAND":
        touch("brands", action.id);
        must(await supabase.from("brands").update(toColumns(action.patch, BRAND_COLUMNS)).eq("id", action.id));
        touch("brands", action.id);
        break;
      case "MARK_NOTIFICATIONS_READ": {
        const readAt = new Date().toISOString();
        must(await supabase.from("notifications").update({ read_at: readAt }).in("id", action.ids));
        break;
      }
      case "LOG":
        break;
      default:
        throw new Error(`Bilinmeyen işlem: ${action.type}`);
    }
    await insertActivity(activity);
    await insertNotifications(notifications);
  };

  let currentUserId;

  const media = {
    async upload(file, taskId) {
      const ext = IMAGE_TYPES[file.type];
      if (!ext) throw new Error("Yalnızca PNG, JPG, GIF veya WebP yüklenebilir.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Görsel en fazla 5 MB olabilir.");
      const path = `${taskId}/${crypto.randomUUID()}.${ext}`;
      must(await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false }));
      const urls = await media.resolve([path]);
      if (!urls[path]) throw new Error("Görsel adresi oluşturulamadı.");
      return { path, url: urls[path] };
    },
    async resolve(paths) {
      const unique = [...new Set(paths)];
      if (!unique.length) return {};
      const rows = must(await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS));
      return Object.fromEntries(rows.filter((r) => r.signedUrl && !r.error).map((r) => [r.path, r.signedUrl]));
    },
  };

  return {
    media,
    // Marka kılavuzu marka başına, ihtiyaç olduğunda yüklenir (açılış yüküne dahil değildir).
    brandKit: createSupabaseBrandKit(supabase, storage),
    // Kontrol listesi şablonları ve geçmişi ihtiyaç olduğunda yüklenir; görev listeleri açılış yüküne dahildir.
    checklist: checklistApi,
    // Taslaklar Supabase projesi bazında ayrılır (geliştirme ve canlı projelerin taslakları karışmaz).
    draftScope: (() => { try { return new URL(storage.url).host; } catch { return "supabase"; } })(),

    /* Toplu görev girişi. Tek upsert isteği PostgREST'te tek işlemdir: ya hepsi yazılır ya hiçbiri.
       ignoreDuplicates: önceki denemede yazılmış (yanıtı kaybolmuş) görevler tekrar oluşturulmaz. RLS (yalnızca admin
       görev ekler) ve tasks tablosundaki kısıtlar sunucuda geçerlidir. Aktivite / bildirim / kontrol listesi okuması
       görevler kaydedildikten sonra yapılır; başarısız olurlarsa görevler yine kaydedilmiş sayılır. */
    createTasks(tasks, { activity = [], notifications = [] } = {}) {
      return flushDescriptions().then(() => enqueue(async () => {
        const ids = tasks.map((t) => t.id);
        ids.forEach((id) => touch("tasks", id));
        must(await supabase.from("tasks").upsert(tasks.map(taskToRow), { onConflict: "id", ignoreDuplicates: true }));
        const saved = [];
        for (let i = 0; i < ids.length; i += 100) saved.push(...must(await supabase.from("tasks").select("id, task_no").in("id", ids.slice(i, i + 100))));
        if (saved.length !== ids.length) throw new Error(`${ids.length - saved.length} görev kaydedilemedi (yetki veya veri kısıtı). Hiçbir satır kaybolmadı; tekrar deneyebilirsiniz.`);
        try { await insertActivity(activity); } catch (err) { console.warn("Aktivite kaydı yazılamadı:", err.message); }
        await insertNotifications(notifications);
        const out = { codes: Object.fromEntries(saved.map((r) => [r.id, taskCode(r.task_no)])), checklists: [], checklistItems: [] };
        if (checklistsAvailable) {
          try {
            for (let i = 0; i < ids.length; i += 100) {
              const part = ids.slice(i, i + 100);
              const [c, it] = await Promise.all([
                supabase.from("task_checklist_instances").select("*").in("task_id", part),
                supabase.from("task_checklist_items").select("*").in("task_id", part),
              ]);
              out.checklists.push(...must(c).map(rowToChecklist));
              out.checklistItems.push(...must(it).map(rowToChecklistItem));
            }
          } catch (err) { console.warn("Kontrol listeleri okunamadı (canlı güncellemeyle gelecek):", err.message); }
        }
        return out;
      }));
    },

    subscribe({ onEvent, onResync }) {
      let wasSubscribed = false;
      let broken = false;
      const channel = supabase.channel("agency-workspace");
      const tables = checklistsAvailable ? { ...LIVE_TABLES, ...CHECKLIST_LIVE_TABLES } : LIVE_TABLES;
      const handle = (table, payload) => {
        const [collection, toItem] = tables[table];
        if (payload.eventType === "DELETE") {
          const id = payload.old && (table === "brand_members" ? payload.old.brand_id && rowKey(table, payload.old) : payload.old.id);
          if (id) onEvent({ type: "REMOTE_DELETE", collection, id });
          return;
        }
        if (payload.eventType === "UPDATE" && recentlyWritten(table, rowKey(table, payload.new))) return;
        // Kendi rolü/üyeliği değişen kullanıcı için görünürlük değişir: tam yükleme gerekir.
        if (table === "profiles" && payload.new.id === currentUserId) { onResync(); return; }
        if (table === "brand_members" && payload.new.user_id === currentUserId) { onResync(); return; }
        onEvent({ type: "REMOTE_UPSERT", collection, item: toItem(payload.new) });
      };
      Object.keys(tables).forEach((table) => {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => handle(table, payload));
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (broken) onResync(); // kopukken kaçırılan değişiklikler
          broken = false; wasSubscribed = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (wasSubscribed) broken = true;
        }
      });
      return () => { supabase.removeChannel(channel); };
    },

    auth: {
      sendLink: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
        });
        if (!error) return;
        if (/signups? not allowed|user not found/i.test(error.message)) throw new Error("Bu e-posta ekipte kayıtlı değil. Yöneticinizden davet isteyin.");
        if (error.status === 429 || /rate limit|security purposes/i.test(error.message)) throw new Error("Çok sık deneme yapıldı. Birkaç dakika sonra tekrar deneyin.");
        throw error;
      },
      signOut: async () => { await flushDescriptions(); must(await supabase.auth.signOut()); },
    },

    onAuthChange(cb) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const id = session?.user?.id ?? null;
        if (id === currentUserId) return; // jeton yenileme / sekmeye dönüşte yeniden yükleme yapma
        currentUserId = id;
        cb();
      });
      return () => data.subscription.unsubscribe();
    },

    async load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { currentUserId = null; throw new AuthRequiredError(); }
      currentUserId = session.user.id;

      // Kontrol listesi tabloları yoksa (006 çalıştırılmamış) panel onlarsız açılır.
      const optional = (p) => p.catch((err) => { if (isMissingRelation(err)) return null; throw err; });
      const [profiles, brands, members, tasks, comments, attachments, assets, activity, approvals, notifications, checklists, checklistItems] = await Promise.all([
        selectAll("profiles", "full_name"),
        selectAll("brands", "created_at"),
        selectAll("brand_members", "created_at"),
        selectAll("tasks", "created_at"),
        selectAll("comments", "created_at"),
        selectAll("attachments", "created_at"),
        selectAll("assets", "updated_on", false),
        selectAll("activity", "created_at", false),
        selectAll("approvals", "created_at", false),
        selectAll("notifications", "created_at", false),
        optional(selectAll("task_checklist_instances", "created_at")),
        optional(selectAll("task_checklist_items", "sort_order")),
      ]);
      checklistsAvailable = !!checklists && !!checklistItems;
      const me = profiles.find((p) => p.id === session.user.id);
      if (!me || !me.active) throw new Error("Hesabınız ekip üyesi olarak tanımlı değil. Yöneticinizle iletişime geçin.");

      // Son aktivite zamanı (hata olursa yükleme etkilenmez).
      supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id).then(() => {}, () => {});
      const users = profiles.map(rowToUser);
      return {
        me: me.id,
        users,
        state: {
          // Pasif üyeler listelerde görünmez ama eski kayıtlarda isimleri gösterilir.
          users,
          memberships: members.map(rowToMembership),
          approvals: approvals.map(rowToApproval),
          notifications: notifications.map(rowToNotification),
          brands: brands.map(rowToBrand),
          tasks: tasks.map(rowToTask),
          comments: comments.map(rowToComment),
          attachments: attachments.map(rowToAttachment),
          assets: assets.map(rowToAsset),
          activity: activity.map(rowToActivity),
          checklists: checklistsAvailable ? checklists.map(rowToChecklist) : [],
          checklistItems: checklistsAvailable ? checklistItems.map(rowToChecklistItem) : [],
          features: { checklists: checklistsAvailable },
        },
      };
    },

    persist(action, prev, next, helpers) {
      const descOnly = action.type === "UPDATE_TASK" && action.silent && Object.keys(action.patch).every((k) => k === "description");
      if (descOnly) {
        const pending = pendingDescriptions.get(action.id);
        if (pending) clearTimeout(pending.timer);
        return new Promise((resolve, reject) => {
          // Önceki bekleyen yazmanın sözü de son yazma ile birlikte çözülür.
          const prevSettle = pending ? [pending.resolve, pending.reject] : null;
          const entry = {
            description: action.patch.description,
            resolve: (v) => { prevSettle?.[0](v); resolve(v); },
            reject: (e) => { prevSettle?.[1](e); reject(e); },
          };
          entry.timer = setTimeout(() => {
            pendingDescriptions.delete(action.id);
            writeDescription(action.id, entry.description).then(entry.resolve, entry.reject);
          }, descriptionDebounceMs);
          pendingDescriptions.set(action.id, entry);
        });
      }
      return flushDescriptions().then(() => enqueue(() => write(action, prev, next, helpers)));
    },
  };
}
