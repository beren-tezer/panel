/*
 * AgencyOS — Bildirim kuralları (kime gider?)
 *
 *   Görev oluşturulduğunda / kişi eklendiğinde         → görevi yapan kişiler (çoklu; yalnızca yeni eklenenler)
 *   Durum "Çalışılıyor", "Revizyon", "Yönetici Onayı",
 *         "Tamamlandı", "Onaylandı" olduğunda             → yalnızca Görevi Veren / Takipçi (reporter, admin)
 *   Durum "Müşteri Onayı" olduğunda                      → Takipçi + görevin markasına tanımlı müşteri(ler)
 *   Diğer durumlar ("Başlanmadı", "Gecikti")             → bildirim yok
 *
 * Takipçisi olmayan (eski) görevlerde takipçi yerine tüm aktif adminler bilgilendirilir.
 * İşlemi yapan kişi kendine bildirim almaz (makeNotifications içinde elenir).
 */

import { assigneesOf } from "./taskPeople.js";

export const FOLLOWER_STATUSES = new Set(["Çalışılıyor", "Revizyon", "Yönetici Onayı", "Tamamlandı", "Onaylandı", "Müşteri Onayı"]);
export const CLIENT_STATUSES = new Set(["Müşteri Onayı"]);

/* Takipçi: görevin reporterId'si; yoksa tüm aktif adminler (geri uyumluluk). */
export const followerIds = (task, adminIds) => (task.reporterId ? [task.reporterId] : [...adminIds]);

/* Durum değişikliğinde alıcılar: { team: [...], clients: [...] } */
export function statusRecipients(task, status, { adminIds = [], clientIds = [] } = {}) {
  if (!FOLLOWER_STATUSES.has(status)) return { team: [], clients: [] };
  return { team: followerIds(task, adminIds), clients: CLIENT_STATUSES.has(status) ? [...clientIds] : [] };
}

/* Atama: yeni görevde görevi yapan tüm kişiler; güncellemede yalnızca yeni eklenen kişiler (prev verilirse). */
export const assignRecipients = (task, prev = null) => {
  const before = new Set(prev ? assigneesOf(prev) : []);
  return assigneesOf(task).filter((id) => !before.has(id));
};
