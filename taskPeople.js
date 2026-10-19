/*
 * AgencyOS — Görevi Yapan kişiler ve platformlar (çoklu)
 *
 * Görevde iki liste tutulur: assigneeIds (görevi yapan tüm kişiler) ve platforms (tüm platformlar). Listenin ilk elemanı
 * "birincil" değerdir ve eski tek değerli alanlarda (assigneeId, platform) da durur: veritabanında 013_multi_assign.sql
 * aynı eşitlemeyi yapar (tasks.assignee_ids / platforms ↔ assignee_id / platform). Eski kayıtlarda yalnızca tek değer varsa
 * liste o değerden oluşur.
 */

const uniq = (list) => [...new Set(list.filter(Boolean))];

export const assigneesOf = (task) => (Array.isArray(task?.assigneeIds) ? task.assigneeIds : task?.assigneeId ? [task.assigneeId] : []);
export const platformsOf = (task) => (Array.isArray(task?.platforms) ? task.platforms : task?.platform ? [task.platform] : []);
export const isAssignee = (task, userId) => !!userId && assigneesOf(task).includes(userId);

/* Görevin iki listesini ve birincil alanlarını tutarlı hâle getirir. */
export function withPeople(task) {
  const assigneeIds = uniq(assigneesOf(task));
  const platforms = uniq(platformsOf(task));
  return { ...task, assigneeIds, assigneeId: assigneeIds[0] || "", platforms, platform: platforms[0] || "" };
}

/* Güncelleme yamasını tamamlar: liste değiştiyse birincil alan, yalnızca birincil alan geldiyse liste güncellenir. */
export function peoplePatch(patch) {
  const out = { ...patch };
  if ("assigneeIds" in patch) { out.assigneeIds = uniq(patch.assigneeIds || []); out.assigneeId = out.assigneeIds[0] || ""; }
  else if ("assigneeId" in patch) out.assigneeIds = patch.assigneeId ? [patch.assigneeId] : [];
  if ("platforms" in patch) { out.platforms = uniq(patch.platforms || []); out.platform = out.platforms[0] || ""; }
  else if ("platform" in patch) out.platforms = patch.platform ? [patch.platform] : [];
  return out;
}

/* Yeni eklenen kişiler (atama bildirimi yalnızca bunlara gider). */
export const addedAssignees = (prev, next) => { const before = new Set(assigneesOf(prev)); return assigneesOf(next).filter((id) => !before.has(id)); };
