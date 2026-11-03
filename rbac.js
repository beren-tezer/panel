/*
 * AgencyOS — rol ve yetki katmanı (RBAC)
 *
 * Tüm yetki kararları buradan verilir; bileşenlerde `role === "admin"` gibi dağınık kontroller yoktur.
 *   permissionsFor(user)        → kullanıcının etkin yetkileri (rol + kişisel izin seçimleri)
 *   scopeState(user, state)     → kullanıcının görebileceği veri dilimi (markalar, görevler, dosyalar…)
 *   authorize(user, action, s)  → reducer'a gitmeden önce her işlemin yetki kontrolü (null = izinli)
 *   statusOptionsFor(user, t)   → kullanıcının bir görevi taşıyabileceği durumlar
 *
 * Supabase tarafında aynı kurallar RLS ve tetikleyicilerle uygulanır (supabase/003_roles.sql).
 */

import { LOCKED_STATUSES, REVIEW_STATUSES, currentChecklist, incompleteMessage, missingForSubmit } from "./checklist.js";
import { pendingRequest, validateRevisionNote } from "./approvals.js";
import { assigneesOf, isAssignee } from "./taskPeople.js";

export const ROLES = ["admin", "employee", "client"];
export const ROLE_LABELS = { admin: "Admin", employee: "Çalışan", client: "Müşteri" };
export const ROLE_TITLES = { admin: "Ajans Yöneticisi", employee: "Ekip Üyesi", client: "Müşteri" };

/* Kullanıcı bazında açılıp kapatılabilen izinler (Kullanıcılar & Yetkiler ekranındaki seçenekler). */
export const PERMISSION_LABELS = {
  canViewContent: "İçerik görüntüleme",
  canEditContent: "İçerik düzenleme",
  canViewTasks: "Görev görüntüleme",
  canUpdateTasks: "Görev güncelleme",
  canViewBrandFiles: "Marka dosyalarına erişim",
  canAccessApprovals: "Onay süreçlerine erişim",
  canEditBrandKit: "Marka kılavuzu düzenleme",
  canManageChecklists: "Kontrol listesi şablonu düzenleme",
};
export const TOGGLEABLE_PERMISSIONS = Object.keys(PERMISSION_LABELS);

/* Rolün kendisine bağlı, kişisel olarak değiştirilemeyen yetkiler. */
const ROLE_CAPABILITIES = {
  admin: [
    "canViewAllBrands", "canCreateBrand", "canManageUsers", "canAssignTasks", "canViewAgencyAnalytics",
    "canCreateTasks", "canDeleteTasks", "canManageAssets", "canComment", "canViewInternal", "canSubmitForApproval",
    "canPublish", "canEditBrandKit", "canManageChecklists",
  ],
  employee: ["canComment", "canViewInternal", "canSubmitForApproval", "canManageAssets"],
  client: ["canApproveContent", "canRequestRevision"],
};

/* Rolün açabileceği kişisel izinler ve yeni kullanıcıda varsayılan olarak açık olanlar. */
export const ROLE_ALLOWED_TOGGLES = {
  admin: TOGGLEABLE_PERMISSIONS,
  employee: TOGGLEABLE_PERMISSIONS,
  client: ["canViewContent", "canViewBrandFiles", "canAccessApprovals"],
};
/* Marka kılavuzu ve kontrol listesi şablonu düzenleme çalışanlarda varsayılan olarak kapalıdır; yönetici kişi
   bazında açar (veritabanında da yalnızca açıkça verilmiş izin geçerlidir — 005 kit_can_edit, 006 cl_can_manage). */
const EXPLICIT_ONLY = new Set(["canEditBrandKit", "canManageChecklists"]);
export const ROLE_DEFAULT_TOGGLES = {
  admin: TOGGLEABLE_PERMISSIONS,
  employee: TOGGLEABLE_PERMISSIONS.filter((p) => !EXPLICIT_ONLY.has(p)),
  client: ["canViewContent", "canViewBrandFiles", "canAccessApprovals"],
};

const cache = new WeakMap();
export function permissionsFor(user) {
  if (!user || user.active === false) return new Set();
  if (cache.has(user)) return cache.get(user);
  const role = ROLES.includes(user.role) ? user.role : "employee";
  const allowed = ROLE_ALLOWED_TOGGLES[role];
  const toggles = Array.isArray(user.permissions) ? user.permissions : ROLE_DEFAULT_TOGGLES[role];
  const set = new Set([...ROLE_CAPABILITIES[role], ...toggles.filter((p) => allowed.includes(p))]);
  // Bağımlı yetkiler: düzenleyemeyen onaya gönderemez, görevi göremeyen güncelleyemez.
  if (!set.has("canEditContent")) set.delete("canSubmitForApproval");
  if (!set.has("canViewTasks") && role !== "client") { set.delete("canUpdateTasks"); set.delete("canEditContent"); }
  if (!set.has("canAccessApprovals")) { set.delete("canApproveContent"); set.delete("canRequestRevision"); }
  if (!set.has("canViewBrandFiles")) set.delete("canManageAssets");
  cache.set(user, set);
  return set;
}
export const can = (user, permission) => permissionsFor(user).has(permission);
export const roleOf = (user) => (user && ROLES.includes(user.role) ? user.role : "employee");

/* "Başka kullanıcı olarak görüntüle" (rol değiştirici, "Portalı Görüntüle") yalnızca bu hesaplara açıktır. Diğer adminler,
   çalışanlar ve müşteriler kullanamaz. Görüntüleme kişinin kendi oturumunda olur: veritabanı yetkisi değişmez, değişiklik yapılamaz.
   Liste koda yazılmaz: .env içinde VITE_IMPERSONATION_EMAILS=a@ornek.com,b@ornek.com (boşsa kimse kullanamaz). */
export const parseEmailList = (value) =>
  String(value || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
export const IMPERSONATION_ALLOWLIST = parseEmailList(import.meta.env?.VITE_IMPERSONATION_EMAILS);
export const canImpersonate = (user, allowlist = IMPERSONATION_ALLOWLIST) =>
  !!user && user.active !== false && allowlist.includes(String(user.email || "").trim().toLowerCase());

/* ───────────────────────── İş akışı ───────────────────────── */

export const STATUS = {
  NOT_STARTED: "Başlanmadı",
  IN_PROGRESS: "Çalışılıyor",
  INTERNAL_REVIEW: "Yönetici Onayı",
  CLIENT_REVIEW: "Müşteri Onayı",
  REVISION: "Revizyon",
  APPROVED: "Onaylandı",
  DONE: "Tamamlandı",
  LATE: "Gecikti",
};
/* Müşterinin görebildiği aşamalar; taslak ve iç süreçler gizlidir. */
export const CLIENT_VISIBLE_STATUSES = new Set([STATUS.CLIENT_REVIEW, STATUS.REVISION, STATUS.APPROVED, STATUS.DONE]);
export const CLIENT_STATUS_LABELS = {
  [STATUS.CLIENT_REVIEW]: "Onay Bekliyor",
  [STATUS.REVISION]: "Revize İstendi",
  [STATUS.APPROVED]: "Onaylandı",
  [STATUS.DONE]: "Yayınlandı",
};
export const OPEN_STATUSES = new Set([STATUS.NOT_STARTED, STATUS.IN_PROGRESS, STATUS.INTERNAL_REVIEW, STATUS.CLIENT_REVIEW, STATUS.REVISION, STATUS.LATE]);
export const isOpen = (task) => OPEN_STATUSES.has(task.status);

const EMPLOYEE_TARGETS = [STATUS.NOT_STARTED, STATUS.IN_PROGRESS, STATUS.INTERNAL_REVIEW, STATUS.CLIENT_REVIEW, STATUS.DONE, STATUS.LATE];

/* Kullanıcının bu görev için seçebileceği durumlar (mevcut durum her zaman listede kalır). */
export function statusOptionsFor(user, task, allStatuses) {
  const p = permissionsFor(user);
  if (!p.has("canUpdateTasks")) return [task.status];
  if (p.has("canAssignTasks")) return allStatuses;
  let targets = EMPLOYEE_TARGETS;
  if (!p.has("canSubmitForApproval")) targets = targets.filter((s) => s !== STATUS.CLIENT_REVIEW && s !== STATUS.INTERNAL_REVIEW);
  // Onaylanmış içerik çalışan tarafından yalnızca yayınlandı (tamamlandı) olarak işaretlenebilir.
  if (task.status === STATUS.APPROVED) targets = [STATUS.DONE];
  return allStatuses.filter((s) => s === task.status || targets.includes(s));
}

/* ───────────────────────── Görünürlük ───────────────────────── */

export function brandIdsFor(user, state) {
  if (can(user, "canViewAllBrands")) return null; // null = tümü
  return new Set(state.memberships.filter((m) => m.userId === user.id).map((m) => m.brandId));
}

export function canSeeBrand(user, brandId, state) {
  const ids = brandIdsFor(user, state);
  return ids === null || ids.has(brandId);
}

/* Görev atanabilecek kişiler: aktif admin ve çalışanlar (müşteriye görev atanmaz). */
export const assignableUsers = (state) => state.users.filter((u) => u.active !== false && u.role !== "client");

export function canSeeTask(user, task, state) {
  const p = permissionsFor(user);
  if (p.has("canViewAllBrands")) return true;
  if (roleOf(user) === "client") return p.has("canViewContent") && CLIENT_VISIBLE_STATUSES.has(task.status) && canSeeBrand(user, task.brandId, state);
  return p.has("canViewTasks") && isAssignee(task, user.id);
}

/* Kullanıcının görebileceği veri dilimi. Tüm ekranlar bu dilimle çalışır; filtrelenmiş veri asla
   bileşen içinde "gizlenmez", baştan hiç verilmez. */
export function scopeState(user, state) {
  if (can(user, "canViewAllBrands")) {
    return { ...state, notifications: state.notifications.filter((n) => n.userId === user.id) };
  }
  const p = permissionsFor(user);
  const isClient = roleOf(user) === "client";
  const brandIds = brandIdsFor(user, state);
  const tasks = state.tasks.filter((t) => canSeeTask(user, t, state));
  const taskIds = new Set(tasks.map((t) => t.id));
  tasks.forEach((t) => brandIds.add(t.brandId)); // atanmış görevin markası da görünür
  const brands = state.brands.filter((b) => brandIds.has(b.id));
  const memberships = state.memberships.filter((m) => brandIds.has(m.brandId));
  const related = new Set([user.id, ...memberships.map((m) => m.userId), ...tasks.flatMap(assigneesOf)]);
  const users = state.users.filter((u) => related.has(u.id) || (!isClient && u.role === "admin"));
  return {
    ...state,
    users,
    brands,
    memberships,
    tasks,
    comments: p.has("canViewInternal") ? state.comments.filter((c) => taskIds.has(c.taskId)) : [],
    activity: p.has("canViewInternal") ? state.activity.filter((a) => taskIds.has(a.taskId)) : [],
    // Ekip içi (internal) ekler müşteriye hiç verilmez; veritabanında aynı kural RLS ile uygulanır (004).
    attachments: state.attachments.filter((a) => taskIds.has(a.taskId) && (!isClient || !a.internal)),
    assets: p.has("canViewBrandFiles") ? state.assets.filter((a) => brandIds.has(a.brandId)) : [],
    approvals: state.approvals.filter((a) => taskIds.has(a.taskId)),
    notifications: state.notifications.filter((n) => n.userId === user.id),
    // Kontrol listeleri, notlar ve kalite kontrol geçmişi ekip içidir; müşteriye hiç verilmez (006 RLS).
    checklists: isClient ? [] : (state.checklists || []).filter((c) => taskIds.has(c.taskId)),
    checklistItems: isClient ? [] : (state.checklistItems || []).filter((i) => taskIds.has(i.taskId)),
    ...scopeContent(isClient, taskIds, state),
  };
}

/* İçerik sürümleri (007 RLS ile aynı): ekip görevin tüm sürümlerini görür; müşteri yalnızca kendisine gönderilmiş
   (bir onay isteğine bağlı) sürümleri, onların dosyalarını ve isteklerini görür. Taslaklar müşteriye hiç verilmez. */
function scopeContent(isClient, taskIds, state) {
  const requests = (state.approvalRequests || []).filter((r) => taskIds.has(r.taskId));
  const sent = new Set(requests.map((r) => r.versionId));
  const visible = (v) => taskIds.has(v.taskId) && (!isClient || sent.has(v.id));
  const versions = (state.contentVersions || []).filter(visible);
  const versionIds = new Set(versions.map((v) => v.id));
  return { approvalRequests: requests, contentVersions: versions, contentAssets: (state.contentAssets || []).filter((a) => versionIds.has(a.versionId)) };
}

/* Taslak sürümde metin / dosya değişikliği: admin veya görevin sorumlusu ("İçerik düzenleme" izniyle). */
export function canEditContentVersion(user, task, state) {
  if (!task || !canSeeTask(user, task, state)) return false;
  const p = permissionsFor(user);
  return roleOf(user) === "admin" || (roleOf(user) === "employee" && p.has("canEditContent") && isAssignee(task, user.id));
}

/* ───────────────────────── İşlem yetkilendirme ───────────────────────── */

const ASSIGN_FIELDS = new Set(["assigneeId", "assigneeIds", "reporterId", "brandId", "dueDate", "dueTime", "priority", "checklistDisabled"]);
/* Görevi Veren / Takipçi yalnızca aktif bir admin olabilir (veritabanında 012 tetikleyicisi). */
const reporterOk = (state, id) => !id || state.users.some((u) => u.id === id && u.role === "admin" && u.active !== false);
const CONTENT_FIELDS = new Set(["title", "description", "platform", "platforms", "format", "publishDate"]);
const DENIED = "Bu işlem için yetkiniz yok.";

/* null döndürürse işlem uygulanır; aksi halde kullanıcıya gösterilecek gerekçe döner. */
export function authorize(user, action, state, allStatuses) {
  const p = permissionsFor(user);
  const task = (id) => state.tasks.find((t) => t.id === id);
  const seeTask = (id) => { const t = task(id); return t && canSeeTask(user, t, state) ? t : null; };
  switch (action.type) {
    case "ADD_TASK":
      if (!reporterOk(state, action.task.reporterId)) return "Görevi veren / takipçi yalnızca bir yönetici olabilir.";
      return p.has("canCreateTasks") && canSeeBrand(user, action.task.brandId, state) ? null : DENIED;
    case "ADD_TASKS":
    case "CREATE_TASKS": {
      if (!p.has("canCreateTasks") || (action.brands?.length && !p.has("canCreateBrand"))) return DENIED;
      // Her görev: yetkili marka (veya aynı işlemde oluşturulan yeni marka) ve atanabilir ekip üyesi.
      const newBrands = new Set((action.brands || []).map((b) => b.id));
      const assignable = new Set(assignableUsers(state).map((u) => u.id));
      for (const t of action.tasks) {
        if (!newBrands.has(t.brandId) && !canSeeBrand(user, t.brandId, state)) return "Seçilen markalardan birine görev ekleme yetkiniz yok.";
        if (assigneesOf(t).some((id) => !assignable.has(id))) return "Seçilen kişilerden birine görev atanamaz.";
        if (assigneesOf(t).some((id) => id !== user.id) && !p.has("canAssignTasks")) return "Görev atama yetkiniz yok.";
      }
      return null;
    }
    case "UPDATE_TASK": {
      const t = seeTask(action.id);
      if (!t) return DENIED;
      for (const key of Object.keys(action.patch)) {
        if (key === "code") continue;
        if (ASSIGN_FIELDS.has(key) && !p.has("canAssignTasks")) return "Atama, tarih ve öncelik değişikliklerini yalnızca yöneticiler yapabilir.";
        if (CONTENT_FIELDS.has(key) && !p.has("canEditContent")) return "İçerik düzenleme yetkiniz yok.";
        if (key === "status" && !statusOptionsFor(user, t, allStatuses).includes(action.patch.status)) return "Bu durum değişikliği için yetkiniz yok.";
        // Onay aşamalarına yalnızca kontrol listesi doğrulamasıyla (SUBMIT_TASK) geçilir; veritabanı da doğrudan geçişi reddeder.
        if (key === "status" && action.patch.status !== t.status && REVIEW_STATUSES.has(action.patch.status)) return "İçeriği onaya göndermek için “Onaya Gönder” kullanın.";
        if (key === "brandId" && !canSeeBrand(user, action.patch.brandId, state)) return DENIED;
        if (key === "reporterId" && !reporterOk(state, action.patch.reporterId)) return "Görevi veren / takipçi yalnızca bir yönetici olabilir.";
      }
      return null;
    }
    case "DELETE_TASK":
      return p.has("canDeleteTasks") ? null : DENIED;
    case "ADD_COMMENT":
      return p.has("canComment") && seeTask(action.taskId) ? null : DENIED;
    case "DELETE_COMMENT": {
      const c = state.comments.find((x) => x.id === action.id);
      return c && c.userId === user.id && p.has("canComment") ? null : DENIED;
    }
    case "ADD_ATTACHMENT":
      return p.has("canEditContent") && seeTask(action.attachment.taskId) ? null : DENIED;
    case "REMOVE_ATTACHMENT": {
      const a = state.attachments.find((x) => x.id === action.id);
      return a && p.has("canEditContent") && seeTask(a.taskId) ? null : DENIED;
    }
    case "LOG":
      return seeTask(action.taskId) ? null : DENIED;
    case "ADD_BRAND":
    case "UPDATE_BRAND":
      return p.has("canCreateBrand") ? null : DENIED;
    case "ADD_ASSET":
      return p.has("canManageAssets") && canSeeBrand(user, action.asset.brandId, state) ? null : DENIED;
    case "UPDATE_ASSET": {
      const a = state.assets.find((x) => x.id === action.id);
      return a && p.has("canManageAssets") && canSeeBrand(user, a.brandId, state) ? null : DENIED;
    }
    case "ADD_USER":
    case "UPDATE_USER":
    case "SET_USER_BRANDS":
    case "SET_BRAND_MEMBERS":
      if (!p.has("canManageUsers")) return DENIED;
      if (action.type === "UPDATE_USER" && action.id === user.id && (action.patch.active === false || (action.patch.role && action.patch.role !== "admin"))) {
        return "Kendi yönetici hesabınızı pasifleştiremez veya rolünü değiştiremezsiniz.";
      }
      return null;
    case "REVIEW_CONTENT": {
      const t = seeTask(action.taskId);
      if (!t) return DENIED;
      if (t.status !== STATUS.CLIENT_REVIEW) return "Bu içerik şu anda onay beklemiyor.";
      // 007: karar yalnızca bekleyen onay isteğine ve onun sürümüne verilebilir (eski sürüm / eski istek reddedilir).
      if (state.features?.approvals) {
        const req = pendingRequest(state.approvalRequests || [], t.id);
        if (!req) return "Bu içerik şu anda onay beklemiyor.";
        if (action.requestId && action.requestId !== req.id) return "Bu onay isteği artık geçerli değil; içerik güncellenmiş. Lütfen sayfayı yenileyip güncel sürümü inceleyin.";
        if (action.versionId && action.versionId !== req.versionId) return "Eski bir sürüme karar verilemez; lütfen güncel sürümü inceleyin.";
      }
      if (action.decision === "approved") return p.has("canApproveContent") ? null : DENIED;
      if (action.decision === "revision") return !p.has("canRequestRevision") ? DENIED : validateRevisionNote(action.note) || null;
      return DENIED;
    }
    case "MARK_NOTIFICATIONS_READ":
      return action.ids.every((id) => state.notifications.find((n) => n.id === id)?.userId === user.id) ? null : DENIED;
    case "SUBMIT_TASK": {
      const t = seeTask(action.id);
      if (!t || !REVIEW_STATUSES.has(action.status)) return DENIED;
      if (t.status === action.status) return `İçerik zaten “${action.status}” aşamasında.`;
      if (!statusOptionsFor(user, t, allStatuses).includes(action.status)) return "Bu durum değişikliği için yetkiniz yok.";
      const missing = missingForSubmit(state, t).length;
      if (missing && roleOf(user) !== "admin") return incompleteMessage(missing);
      if (missing && !String(action.reason || "").trim()) return "Eksik zorunlu kontrollerle göndermek için gerekçe yazmalısınız.";
      return null;
    }
    case "TOGGLE_CHECK":
    case "SET_CHECK_NOTE":
      return checklistEditReason(user, state, action);
    case "UPDATE_VERSION": {
      const v = (state.contentVersions || []).find((x) => x.id === action.id);
      if (!v) return "Sürüm bulunamadı.";
      if (v.lockedAt) return "Müşteriye gönderilmiş sürüm değiştirilemez; yeni sürüm oluşturun.";
      if (String(action.patch.caption ?? "").length > 5000) return "Metin en fazla 5000 karakter olabilir.";
      return canEditContentVersion(user, state.tasks.find((t) => t.id === v.taskId), state) ? null : DENIED;
    }
    default:
      return null;
  }
}

/* ───────────────────────── Marka kılavuzu ───────────────────────── */
/* Kurallar supabase/005_brand_kit.sql ile aynıdır (kit_can_view / kit_can_edit / görünürlük politikaları).
     Admin   : tüm markalar, düzenler.
     Çalışan : üyesi olduğu veya görev aldığı markalar; düzenleme yalnızca "Marka kılavuzu düzenleme" izniyle.
     Müşteri : yalnızca üyesi olduğu markalar ("Marka dosyalarına erişim" izniyle); ekip içi kayıtları görmez. */

export function canViewBrandKit(user, brandId, state) {
  const p = permissionsFor(user);
  if (!brandId || !p.size) return false;
  if (p.has("canViewAllBrands")) return true;
  const member = state.memberships.some((m) => m.userId === user.id && m.brandId === brandId);
  if (roleOf(user) === "client") return member && p.has("canViewBrandFiles");
  return member || state.tasks.some((t) => t.brandId === brandId && isAssignee(t, user.id));
}

export function canEditBrandKit(user, brandId, state) {
  return permissionsFor(user).has("canEditBrandKit") && roleOf(user) !== "client" && canViewBrandKit(user, brandId, state);
}

/* Kullanıcının görebileceği kılavuz dilimi: müşteri ekip içi talimat/dosya/bağlantıları hiç almaz;
   dosya ve bağlantılar "Marka dosyalarına erişim" izni gerektirir. */
export function scopeBrandKit(user, data) {
  if (!data) return data;
  const client = roleOf(user) === "client";
  const files = permissionsFor(user).has("canViewBrandFiles");
  const visible = (x) => !client || x.visibility === "shared";
  const assets = files ? data.assets.filter(visible) : [];
  const assetIds = new Set(assets.map((a) => a.id));
  return {
    ...data,
    instructions: data.instructions.filter(visible),
    assets,
    links: files ? data.links.filter(visible) : [],
    fonts: data.fonts.map((f) => (f.assetId && !assetIds.has(f.assetId) ? { ...f, assetId: null } : f)),
  };
}

/* ───────────────────────── İçerik üretim kontrol listesi ───────────────────────── */
/* Kurallar supabase/006_checklists.sql ile aynıdır (cl_can_read / cl_can_work / cl_can_manage / cl_items_guard).
     Görüntüleme : ekip (admin + görevi gören çalışan); müşteri hiçbir kontrol listesi verisini görmez.
     İşaretleme : admin; çalışan yalnızca kendisine atanan görevde ("Görev güncelleme" izniyle).
     Kilit      : görev onaya gönderildikten sonra çalışan değiştiremez; önceki revizyon döngüleri kimse değiştiremez.
     Şablonlar  : admin; çalışan yalnızca açıkça verilmiş "Kontrol listesi şablonu düzenleme" izniyle ve kendi markalarında.
                  Tüm markalar için varsayılan şablonu yalnızca admin düzenler. */

export function canViewChecklist(user, task, state) {
  return !!task && roleOf(user) !== "client" && canSeeTask(user, task, state);
}

export function canWorkChecklist(user, task, state) {
  if (!canViewChecklist(user, task, state)) return false;
  const p = permissionsFor(user);
  return roleOf(user) === "admin" || (p.has("canUpdateTasks") && isAssignee(task, user.id));
}

export function canManageChecklists(user, brandId, state) {
  const p = permissionsFor(user);
  if (!p.has("canManageChecklists") || roleOf(user) === "client") return false;
  if (roleOf(user) === "admin") return true;
  if (!brandId) return false;
  return state.memberships.some((m) => m.userId === user.id && m.brandId === brandId)
    || state.tasks.some((t) => t.brandId === brandId && isAssignee(t, user.id));
}

/* Madde işaretleme / not için gerekçe (null = izinli). */
export function checklistEditReason(user, state, action) {
  const item = (state.checklistItems || []).find((i) => i.id === action.itemId);
  if (!item) return "Kontrol maddesi bulunamadı.";
  const task = state.tasks.find((t) => t.id === item.taskId);
  if (!canWorkChecklist(user, task, state)) return "Bu kontrol listesinde işlem yapma yetkiniz yok.";
  const current = currentChecklist(state.checklists || [], item.taskId);
  if (!current || current.id !== item.checklistId) return "Bu kontrol listesi önceki bir revizyon döngüsüne ait; değiştirilemez.";
  const admin = roleOf(user) === "admin";
  if (!admin && LOCKED_STATUSES.has(task.status)) return "İçerik onaya gönderildiği için kontroller kilitli.";
  if (action.type === "TOGGLE_CHECK" && !action.completed && item.completedBy && item.completedBy !== user.id && !admin) {
    return "Başka bir kullanıcının tamamladığı kontrolü yalnızca yönetici geri alabilir.";
  }
  if (action.type === "SET_CHECK_NOTE" && String(action.note || "").length > 1000) return "Not en fazla 1000 karakter olabilir.";
  return null;
}
