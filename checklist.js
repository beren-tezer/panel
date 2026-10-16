/*
 * AgencyOS — İçerik Üretim Kontrol Listesi (kalite kontrol + onaya hazır olma)
 *
 * Görev kontrol listeleri ana durumda tutulur (state.checklists = döngüler, state.checklistItems = maddeler) ve
 * diğer görev verileri gibi canlı senkronize olur. Şablonlar ve geçmiş (denetim kayıtları) ihtiyaç olduğunda yüklenir.
 * Sunucu kuralları: supabase/006_checklists.sql — buradaki saf fonksiyonlar aynı kuralların istemci karşılığıdır.
 *
 * API (createMemoryChecklist → demo, createSupabaseChecklist → canlı):
 *   ensure(task, state)               → { taskId, checklists, checklistItems }  (görevin listesi yoksa oluşturur)
 *   refresh(taskId)                   → { taskId, checklists, checklistItems }  (yalnızca Supabase)
 *   listTemplates(brandId)            → [şablon]  (markanın şablonları + tüm markalar için varsayılan)
 *   saveTemplate(template, userId)    → şablon
 *   removeTemplate(template)
 *   history(taskId)                   → { events, submissions }
 */

import { ALL_TASK_TYPES } from "./taskTypes.js";

/* ───────────────────────── Sabitler ───────────────────────── */

export const CHECK_CATEGORIES = {
  visual: "Görsel Kimlik Kontrolü",
  content: "İçerik & Metin Kontrolü",
  technical: "Teknik Kontroller",
  other: "Diğer Kontroller",
};
/* Şablonun uygulanacağı görev türleri (tasks.format değerleri; tek kaynak: taskTypes.js). Eski değerler geçerli kalır. */
export const TASK_TYPES = ALL_TASK_TYPES;
// Varsayılan şablon: üretim işleri (rapor ve ajans içi işler hariç).
export const CREATIVE_TASK_TYPES = TASK_TYPES.filter((t) => t !== "Rapor" && t !== "Ajans İçi İşler");

/* "Onaya Gönder" ile girilen aşamalar ve gönderimden sonra kontrollerin kilitlendiği aşamalar. */
export const REVIEW_STATUSES = new Set(["Yönetici Onayı", "Müşteri Onayı"]);
export const LOCKED_STATUSES = new Set(["Yönetici Onayı", "Müşteri Onayı", "Onaylandı", "Tamamlandı"]);

export const PROGRESS_LABELS = {
  not_started: "Henüz Başlanmadı",
  checking: "Kontrol Ediliyor",
  complete: "Kontroller Tamamlandı",
  ready: "Onaya Hazır",
};

export const DEFAULT_TEMPLATE_ITEMS = [
  ["Marka renkleri doğru kullanıldı.", "visual", true],
  ["Doğru font ailesi kullanıldı.", "visual", true],
  ["Logo kullanım kurallarına uyuldu.", "visual", true],
  ["Tasarım marka kimliğiyle tutarlı.", "visual", false],
  ["Yazım ve imla kontrolü yapıldı.", "content", true],
  ["Marka iletişim diline uyuldu.", "content", true],
  ["Müşteri özel talepleri karşılandı.", "content", true],
  ["İçerikte yasaklı ifadeler kullanılmadı.", "content", true],
  ["Görsel boyutları doğru.", "technical", true],
  ["Dosya formatı uygun.", "technical", true],
  ["İçerik önizlemesi kontrol edildi.", "technical", false],
  ["Gerekli dosyalar göreve yüklendi.", "technical", true],
].map(([title, category, isRequired]) => ({ title, description: "", category, isRequired, isEnabled: true, recheckOnRevision: true }));

export const MAX_TEMPLATE_ITEMS = 60;

const uuid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16)));
const bySort = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

/* ───────────────────────── Durumdan okuma ───────────────────────── */

/* Görevin güncel (en son) döngüsü. */
export function currentChecklist(checklists, taskId) {
  let best = null;
  for (const c of checklists) if (c.taskId === taskId && (!best || c.cycle > best.cycle)) best = c;
  return best;
}

export const itemsOf = (items, checklistId) => items.filter((i) => i.checklistId === checklistId).sort(bySort);

/* Görev → güncel döngü ve maddeleri (tek geçişte; pano göstergeleri için). */
export function indexChecklists(checklists, items) {
  const current = new Map();
  for (const c of checklists) { const cur = current.get(c.taskId); if (!cur || c.cycle > cur.cycle) current.set(c.taskId, c); }
  const byChecklist = new Map();
  for (const i of items) { const list = byChecklist.get(i.checklistId); if (list) list.push(i); else byChecklist.set(i.checklistId, [i]); }
  const out = {};
  current.forEach((c, taskId) => { out[taskId] = { checklist: c, items: (byChecklist.get(c.id) || []).sort(bySort) }; });
  return out;
}

/* İlerleme ve durum; her zaman gerçek madde verisinden hesaplanır. */
export function checklistSummary(checklist, items, task) {
  if (!checklist) return null;
  const total = items.length;
  const done = items.filter((i) => i.isCompleted).length;
  const required = items.filter((i) => i.isRequired);
  const requiredDone = required.filter((i) => i.isCompleted).length;
  const missing = required.filter((i) => !i.isCompleted);
  let state;
  if (done === 0 && required.length > 0) state = "not_started";
  else if (missing.length) state = "checking";
  else if (task && LOCKED_STATUSES.has(task.status)) state = "complete";
  else state = "ready";
  return {
    total, done, required: required.length, requiredDone, missing, state, label: PROGRESS_LABELS[state],
    cycle: checklist.cycle, closed: !!checklist.closedAt, pct: total ? Math.round((done / total) * 100) : 0,
  };
}

export function cycleLabel(summary) {
  if (!summary) return "";
  if (summary.cycle === 0) return "İlk Teslim";
  return `Revizyon ${summary.cycle} — ${summary.missing.length ? "Kontrol Bekliyor" : "Kontroller Tamam"}`;
}

/* Onaya gönderimde eksik zorunlu kontroller (liste yoksa veya kapalıysa boş). */
export function missingForSubmit(state, task) {
  if (!task || task.checklistDisabled) return [];
  const c = currentChecklist(state.checklists || [], task.id);
  if (!c) return [];
  return itemsOf(state.checklistItems || [], c.id).filter((i) => i.isRequired && !i.isCompleted);
}

export const incompleteMessage = (n) => `İçeriği onaya göndermeden önce ${n} zorunlu kontrolü tamamlamalısınız.`;

/* ───────────────────────── Şablon seçimi ve kopyalama (sunucu kurallarının aynısı) ───────────────────────── */

export const templateApplies = (t, format) => !t.taskTypes?.length || t.taskTypes.includes(format);

/* Öncelik: markanın formata özel şablonu → markanın genel şablonu → varsayılan formata özel → varsayılan genel. */
export function pickTemplate(templates, brandId, format) {
  const rank = (t) => (t.brandId ? 0 : 2) + (t.taskTypes?.length ? 0 : 1);
  return templates
    .filter((t) => t.isActive && (t.brandId === brandId || !t.brandId) && templateApplies(t, format) && t.items.some((i) => i.isEnabled))
    .sort((a, b) => rank(a) - rank(b) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0] || null;
}

export function instantiate(template, taskId, cycle = 0, now = new Date().toISOString()) {
  const checklist = { id: uuid(), taskId, templateId: template.id, templateName: template.name, templateVersion: template.version, cycle, createdAt: now, closedAt: null };
  const items = template.items.filter((i) => i.isEnabled).sort(bySort).map((i, n) => ({
    id: uuid(), checklistId: checklist.id, taskId, templateItemId: i.id, title: i.title, description: i.description || "", category: i.category,
    isRequired: !!i.isRequired, recheckOnRevision: i.recheckOnRevision !== false, isCompleted: false, completedBy: null, completedAt: null, note: "", sortOrder: n,
  }));
  return { checklist, items };
}

/* Revizyon: önceki döngü kapanır; "revizyonda yeniden kontrol" maddeleri sıfırlanır, diğerleri tamamlanmış olarak taşınır. */
export function startRevisionCycle(checklist, items, now = new Date().toISOString()) {
  const closed = { ...checklist, closedAt: now };
  const next = { ...checklist, id: uuid(), cycle: checklist.cycle + 1, createdAt: now, closedAt: null };
  const nextItems = items.map((i) => {
    const keep = i.isCompleted && !i.recheckOnRevision;
    return { ...i, id: uuid(), checklistId: next.id, isCompleted: keep, completedBy: keep ? i.completedBy : null, completedAt: keep ? i.completedAt : null, note: "" };
  });
  return { closed, checklist: next, items: nextItems };
}

export function validateTemplate(t) {
  const errors = {};
  if (!String(t.name || "").trim()) errors.name = "Şablon adı zorunludur.";
  else if (t.name.trim().length > 120) errors.name = "Şablon adı en fazla 120 karakter olabilir.";
  const items = t.items || [];
  if (!items.length) errors.items = "En az bir kontrol maddesi ekleyin.";
  else if (items.length > MAX_TEMPLATE_ITEMS) errors.items = `Bir şablonda en fazla ${MAX_TEMPLATE_ITEMS} madde olabilir.`;
  else if (!items.some((i) => i.isEnabled)) errors.items = "En az bir madde etkin olmalı.";
  items.forEach((i, n) => {
    if (!String(i.title || "").trim()) errors[`item-${n}`] = "Madde metni boş olamaz.";
    else if (i.title.trim().length > 200) errors[`item-${n}`] = "Madde metni en fazla 200 karakter olabilir.";
  });
  if ((t.taskTypes || []).some((x) => !TASK_TYPES.includes(x))) errors.taskTypes = "Geçersiz görev türü.";
  return errors;
}

/* ───────────────────────── Demo (bellek içi) ───────────────────────── */

export function demoTemplates(brandTemplates = []) {
  const at = new Date(Date.now() - 5 * 864e5).toISOString();
  const withIds = (items) => items.map((i, n) => ({ id: uuid(), ...i, sortOrder: n }));
  return [
    { id: uuid(), brandId: null, name: "Varsayılan Kontrol Listesi", taskTypes: CREATIVE_TASK_TYPES, version: 1, isActive: true, createdAt: at, updatedAt: at, items: withIds(DEFAULT_TEMPLATE_ITEMS) },
    ...brandTemplates.map((t) => ({ id: uuid(), version: 1, isActive: true, createdAt: at, updatedAt: at, ...t, items: withIds(t.items) })),
  ];
}

export function createMemoryChecklist(templates = demoTemplates()) {
  let db = structuredClone(templates);
  const events = [];
  const submissions = [];
  const delay = () => new Promise((r) => setTimeout(r, 40));
  return {
    templates: () => db,
    async listTemplates(brandId) { await delay(); return structuredClone(db.filter((t) => t.brandId === brandId || !t.brandId)); },
    async saveTemplate(template, userId) {
      await delay();
      const errors = validateTemplate(template);
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
      const now = new Date().toISOString();
      const prev = db.find((t) => t.id === template.id);
      if (prev && prev.brandId !== template.brandId) throw new Error("Şablon başka bir markaya taşınamaz.");
      const saved = {
        ...template, name: template.name.trim(), version: prev ? prev.version + 1 : 1, createdAt: prev?.createdAt || now, updatedAt: now, updatedBy: userId,
        items: template.items.map((i, n) => ({ ...i, id: i.id || uuid(), title: i.title.trim(), sortOrder: n })),
      };
      db = prev ? db.map((t) => (t.id === saved.id ? saved : t)) : [...db, saved];
      return structuredClone(saved);
    },
    async removeTemplate(template) { await delay(); db = db.filter((t) => t.id !== template.id); },
    /* Demo "sunucusu": ana durumdaki görev için liste oluşturur (aynı kurallar). */
    async ensure(task, state) {
      const existing = currentChecklist(state.checklists, task.id);
      if (existing || task.checklistDisabled) return null;
      const tpl = pickTemplate(db, task.brandId, task.format);
      if (!tpl) return null;
      const { checklist, items } = instantiate(tpl, task.id, 0);
      return { taskId: task.id, checklists: [checklist], checklistItems: items };
    },
    instantiateFor(task, cycle = 0) {
      if (task.checklistDisabled) return null;
      const tpl = pickTemplate(db, task.brandId, task.format);
      return tpl ? instantiate(tpl, task.id, cycle) : null;
    },
    log(entry) { events.unshift({ id: uuid(), createdAt: new Date().toISOString(), detail: "", ...entry }); },
    logSubmission(entry) { submissions.unshift({ id: uuid(), createdAt: new Date().toISOString(), ...entry }); },
    async history(taskId) { await delay(); return { events: events.filter((e) => e.taskId === taskId), submissions: submissions.filter((s) => s.taskId === taskId) }; },
  };
}

/* ───────────────────────── Supabase ───────────────────────── */

export const rowToChecklist = (r) => ({
  id: r.id, taskId: r.task_id, templateId: r.template_id, templateName: r.template_name, templateVersion: r.template_version,
  cycle: r.cycle, createdAt: r.created_at, closedAt: r.closed_at,
});
export const rowToChecklistItem = (r) => ({
  id: r.id, checklistId: r.checklist_instance_id, taskId: r.task_id, templateItemId: r.template_item_id, title: r.title_snapshot,
  description: r.description_snapshot || "", category: r.category, isRequired: r.is_required, recheckOnRevision: r.recheck_on_revision,
  isCompleted: r.is_completed, completedBy: r.completed_by, completedAt: r.completed_at, note: r.note || "", sortOrder: r.sort_order,
});
const rowToTemplate = (r) => ({
  id: r.id, brandId: r.brand_id, name: r.name, taskTypes: r.task_types || [], version: r.version, isActive: r.is_active,
  createdBy: r.created_by, updatedBy: r.updated_by, createdAt: r.created_at, updatedAt: r.updated_at,
  items: (r.checklist_template_items || []).map((i) => ({
    id: i.id, title: i.title, description: i.description || "", category: i.category, isRequired: i.is_required, isEnabled: i.is_enabled,
    recheckOnRevision: i.recheck_on_revision, sortOrder: i.sort_order,
  })).sort(bySort),
});
const rowToEvent = (r) => ({ id: r.id, taskId: r.task_id, checklistId: r.checklist_instance_id, itemId: r.item_id, itemTitle: r.item_title, userId: r.user_id, kind: r.kind, detail: r.detail || "", createdAt: r.created_at });
const rowToSubmission = (r) => ({
  id: r.id, taskId: r.task_id, checklistId: r.checklist_instance_id, cycle: r.cycle, fromStatus: r.from_status, targetStatus: r.target_status,
  submittedBy: r.submitted_by, total: r.total_items, done: r.done_items, required: r.required_total, requiredDone: r.required_done,
  overrideReason: r.override_reason, createdAt: r.created_at,
});

/* Tablo/fonksiyon henüz oluşturulmamış (006 çalıştırılmamış). */
export const isMissingRelation = (error) => ["42P01", "PGRST205", "PGRST202", "42883"].includes(error?.code);

export function checklistError(error) {
  const m = error?.message || "İşlem tamamlanamadı.";
  if (isMissingRelation(error)) return new Error("Kontrol listesi tabloları bulunamadı. supabase/006_checklists.sql çalıştırılmalı.");
  if (error?.code === "42501" && /row-level security|permission denied/i.test(m)) return new Error("Bu işlem için yetkiniz yok.");
  if (error?.code === "23514") return new Error("Girilen değer geçersiz.");
  return new Error(m);
}

export function createSupabaseChecklist(supabase) {
  const must = ({ data, error }) => { if (error) throw checklistError(error); return data; };
  const forTask = async (taskId) => {
    const [c, i] = await Promise.all([
      supabase.from("task_checklist_instances").select("*").eq("task_id", taskId),
      supabase.from("task_checklist_items").select("*").eq("task_id", taskId),
    ]);
    return { taskId, checklists: must(c).map(rowToChecklist), checklistItems: must(i).map(rowToChecklistItem) };
  };
  return {
    async ensure(task) {
      must(await supabase.rpc("ensure_task_checklist", { p_task: task.id }));
      return forTask(task.id);
    },
    refresh: forTask,
    async listTemplates(brandId) {
      let q = supabase.from("brand_checklist_templates").select("*, checklist_template_items(*)").order("created_at", { ascending: true });
      q = brandId ? q.or(`brand_id.eq.${brandId},brand_id.is.null`) : q.is("brand_id", null);
      return must(await q).map(rowToTemplate);
    },
    async saveTemplate(t) {
      const id = must(await supabase.rpc("save_checklist_template", {
        p: {
          id: t.id || null, brand_id: t.brandId || null, name: t.name, task_types: t.taskTypes || [], is_active: t.isActive !== false,
          items: t.items.map((i) => ({
            id: i.id || null, title: i.title, description: i.description || "", category: i.category, is_required: !!i.isRequired,
            is_enabled: i.isEnabled !== false, recheck_on_revision: i.recheckOnRevision !== false,
          })),
        },
      }));
      const row = must(await supabase.from("brand_checklist_templates").select("*, checklist_template_items(*)").eq("id", id).single());
      return rowToTemplate(row);
    },
    async removeTemplate(t) { must(await supabase.from("brand_checklist_templates").delete().eq("id", t.id)); },
    async history(taskId) {
      const [e, s] = await Promise.all([
        supabase.from("task_checklist_events").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(200),
        supabase.from("task_checklist_submissions").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
      ]);
      return { events: must(e).map(rowToEvent), submissions: must(s).map(rowToSubmission) };
    },
  };
}
