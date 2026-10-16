/*
 * AgencyOS — Görev Türü (tek kaynak)
 *
 * Görev türü veritabanında tasks.format sütununda tutulur (sütun adı değişmez, migration yoktur); arayüzde
 * "Görev Türü" olarak gösterilir. Seçenekler bulunulan modüle göre değişir:
 *   • Sosyal Medya Planı      → SOCIAL_MEDIA_TASK_TYPES
 *   • Diğer tüm giriş noktaları → GENERAL_TASK_TYPES
 * Eski kayıtlardaki "Web" / "Reklam" / "Rapor" değerleri silinmez: listede yine görünür ve doğru kategoriye düşer.
 */

export const TASK_TYPE_LABEL = "Görev Türü";

export const SOCIAL_MEDIA_TASK_TYPES = ["Reels", "Gönderi", "Hikâye", "Karusel", "Video"];
export const GENERAL_TASK_TYPES = ["Web & Teknik", "Ajans İçi İşler", "Reklam İşleri"];
export const LEGACY_TASK_TYPES = ["Web", "Reklam", "Rapor"];
export const ALL_TASK_TYPES = [...SOCIAL_MEDIA_TASK_TYPES, ...GENERAL_TASK_TYPES, ...LEGACY_TASK_TYPES];

/* Giriş noktası bağlamı: "social" (Sosyal Medya Planı) | "general" (diğer her yer). */
export const TASK_CONTEXTS = { social: "social", general: "general" };
export const taskTypesFor = (context) => (context === TASK_CONTEXTS.social ? SOCIAL_MEDIA_TASK_TYPES : GENERAL_TASK_TYPES);

export const isSocialTaskType = (type) => SOCIAL_MEDIA_TASK_TYPES.includes(type);
/* Mevcut görev düzenlenirken: sosyal medya içeriği kendi listesiyle, diğerleri genel listeyle düzenlenir. */
export const contextOfType = (type) => (isSocialTaskType(type) ? TASK_CONTEXTS.social : TASK_CONTEXTS.general);

/* Açılır liste seçenekleri. Listede olmayan (eski / farklı bağlamdan) mevcut değer sona eklenir: düzenlemede değer kaybolmaz. */
export function taskTypeOptions(context, current) {
  const list = taskTypesFor(context);
  return current && !list.includes(current) ? [...list, current] : list;
}

/* Yeni görevin varsayılan türü: modülün ön seçimi bağlama uyuyorsa o, yoksa bağlamın ilk seçeneği. */
export const defaultTaskType = (context, preset) => (preset && taskTypesFor(context).includes(preset) ? preset : taskTypesFor(context)[0]);

/* Türe göre önerilen platform (yalnızca yeni görev formunda varsayılan; kullanıcı değiştirebilir). */
const TYPE_PLATFORM = { "Web & Teknik": "Web Sitesi", "Reklam İşleri": "Meta Reklam" };
export const platformForType = (type, fallback = "Instagram") => TYPE_PLATFORM[type] || fallback;

/* ───────────── Kategori (Genel Bakış kutuları, çalışan ekranı) ───────────── */

export const AD_PLATFORMS = new Set(["Meta Reklam", "Google Reklam"]);
const WEB_TYPES = new Set(["Web & Teknik", "Web"]);
const AD_TYPES = new Set(["Reklam İşleri", "Reklam"]);

/* "web" | "agency" | "ads" | "social" | "other". Öncelik: web → ajans içi → reklam → sosyal medya içeriği.
   isAgency(task): görevin ajansın kendi markasına ait olup olmadığı (eski kayıtlar için). */
export function taskCategory(task, isAgency = () => false) {
  if (WEB_TYPES.has(task.format) || task.platform === "Web Sitesi") return "web";
  if (task.format === "Ajans İçi İşler" || isAgency(task)) return "agency";
  if (AD_TYPES.has(task.format) || AD_PLATFORMS.has(task.platform)) return "ads";
  if (isSocialTaskType(task.format)) return "social";
  return "other";
}

/* Kategori kutusundan "+ Yeni Görev" açıldığında seçili gelecek tür. */
export const TYPE_FOR_CATEGORY = { web: "Web & Teknik", agency: "Ajans İçi İşler", ads: "Reklam İşleri" };
