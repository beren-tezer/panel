import type { Attachment, Brand, Comment, Content, Status, User, WorkspaceData } from "./models";
import { weekOf } from "./models";

export const photoUrls = [
  "https://images.unsplash.com/photo-1678889284769-b7dcbec1f082?auto=format&fit=crop&w=160&q=75",
  "https://images.unsplash.com/photo-1642421374388-e79a9ea04b57?auto=format&fit=crop&w=160&q=75",
  "https://images.unsplash.com/photo-1580850792094-1496a7884eac?auto=format&fit=crop&w=160&q=75",
  "https://images.unsplash.com/photo-1648644788905-6f13219b59fe?auto=format&fit=crop&w=160&q=75",
  "https://images.unsplash.com/photo-1772982903112-071cc4636d31?auto=format&fit=crop&w=160&q=75",
  "https://images.unsplash.com/photo-1634976086437-eac65e194242?auto=format&fit=crop&w=160&q=75",
];

export const users: User[] = [
  { id: "seda", name: "Seda Y.", color: "lilac" },
  { id: "emre", name: "Emre K.", color: "blue" },
  { id: "mert", name: "Mert D.", color: "green" },
  { id: "elif", name: "Elif T.", color: "orange" },
];

const brandSeed = [
  ["tepe-emlak", "Tepe Emlak", "TE", 11], ["sofra pide", "Sofra Pide", "SP", 12],
  ["edva", "Edva", "ED", 5], ["3-kartal", "3 Kartal Perde", "3K", 8],
  ["gurel-altyapi", "Gürel Altyapı", "GA", 9], ["velia-clinic", "Velia Clinic", "VC", 14],
  ["gelinay", "Gelinay", "GE", 7], ["max-business", "Mira Business", "MB", 6],
  ["mavitur-tr", "Mavitur TR", "MT", 10], ["mavitur-eng", "Mavitur ENG", "ME", 4],
  ["sahinyali", "Şahin Yalı", "Şİ", 8], ["sdm", "SDM", "SD", 9], ["aek", "AEK", "AE", 3],
] as const;

export const brands: Brand[] = brandSeed.map(([id, name, initials]) => ({ id, name, initials, target: 15 }));

const raw = [
  ["2026-09-02", "Gönderi", "Eylül Ayı Piyasa Analizi", "Antalya emlak piyasasındaki son gelişmeleri özetleyen bilgilendirici içerik.", 2, 3, "seda"],
  ["2026-09-03", "Reels", "Modern Yaşam Alanları Turu", "Ofis ve daire projelerinden dinamik kısa video turu.", 3, 5, "emre"],
  ["2026-09-05", "Karusel", "Kira Artış Oranı ve Yasal Haklar", "2026 kira artış oranları ve kiracı haklarını açıklayan içerik.", 3, 2, "seda"],
  ["2026-09-07", "Hikâye", "Haftanın Soru-Cevapları", "Takipçilerden gelen emlak sorularına hızlı cevaplar.", 1, 7, "mert"],
  ["2026-09-08", "Hikâye", "Haftanın Emlak Fırsatları", "Haftanın öne çıkan daire ve villa seçenekleri.", 2, 1, "elif"],
  ["2026-09-10", "Reels", "Müşteri Memnuniyeti Röportajı", "Yeni ev sahiplerinin satın alma deneyimlerinden kısa kesitler.", 2, 4, "emre"],
  ["2026-09-12", "Gönderi", "Yatırım İçin Doğru Bölge Nasıl Seçilir?", "Uzman görüşleriyle lokasyon ve yatırım potansiyeli analizi.", 3, 2, "seda"],
  ["2026-09-14", "Karusel", "Sık Sorulan Sorular", "Emlak alım-satım sürecinde müşterilerin en çok merak ettiği konular.", 1, 0, "mert"],
  ["2026-09-15", "Reels", "Ödül Töreni Kısa Kurgu", "Şirketimizin aldığı ödülden prestij odaklı kısa video.", 2, 3, "elif"],
  ["2026-09-17", "Gönderi", "Emlakta Doğru Bilinen Yanlışlar", "Sektörde sık karşılaşılan yanlış bilgileri açıklayan içerik.", 1, 1, "seda"],
  ["2026-09-19", "Hikâye", "Ofisimizden Kamera Arkası", "Ekibin günlük çalışma sürecinden doğal kareler.", 3, 0, "mert"],
  ["2026-09-21", "Gönderi", "Hafta Sonu Önerisi: Antalya’da Gezilecek Yerler", "Yaşam tarzı odaklı, etkileşim artırıcı yerel içerik.", 2, 1, "emre"],
  ["2026-09-23", "Karusel", "Ev Alırken Kontrol Listesi", "Ev satın almadan önce kontrol edilmesi gereken temel noktalar.", 2, 2, "seda"],
  ["2026-09-26", "Reels", "Yeni Portföy Tanıtımı", "Yeni eklenen premium konut portföyünün kısa video tanıtımı.", 3, 1, "emre"],
  ["2026-09-29", "Gönderi", "Eylül Ayı Özeti", "Ay boyunca öne çıkan projeler ve gelişmeler.", 1, 0, "elif"],
] as const;

const trendStatuses: Status[] = [
  "Tamamlandı", "Tamamlandı", "Tamamlandı", "Tamamlandı", "Tamamlandı",
  "Müşteri Onayında", "Üzerinde Çalışılıyor", "Başlanmamış", "Tamamlandı",
  "Yönetici Onayında", "Üzerinde Çalışılıyor", "Başlanmamış", "Müşteri Onayında",
  "Üzerinde Çalışılıyor", "Başlanmamış",
];

function fileList(count: number, photoIndex: number): Attachment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `dosya-${photoIndex}-${index}`,
    name: index === 0 ? "İçerik görseli.jpg" : index === 1 ? "Metin taslağı.pdf" : "Video kurgusu.mp4",
    type: index === 0 ? "Görsel" : index === 1 ? "PDF" : "Video",
    preview: index === 0 ? photoUrls[photoIndex % photoUrls.length] : undefined,
    size: index === 0 ? "1,8 MB" : index === 1 ? "640 KB" : "12,4 MB",
  }));
}

function commentList(count: number, contentIndex: number): Comment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `yorum-${contentIndex}-${index}`,
    userId: users[(contentIndex + index) % users.length].id,
    text: ["Görsel yönlendirmesi çok iyi görünüyor.", "Metin için son düzenlemeleri tamamladım.", "Müşteri geri bildirimini buraya ekledim.", "Yayın saati için planlama yapıldı."][index % 4],
    createdAt: new Date(2026, 8, Math.max(1, contentIndex), 10 + index, 20).toISOString(),
  }));
}

function makeContent(brandId: string, completed: number, generic = false): Content[] {
  return raw.map(([date, format, title, brief, fileCount, commentCount, assignee], index) => {
    const status = generic ? (index < completed ? "Tamamlandı" : trendStatuses[index]) : trendStatuses[index];
    return {
      id: `${brandId}-${index + 1}`,
      brandId,
      date,
      format,
      title: generic && index < 3 ? `${title} — ${brands.find((brand) => brand.id === brandId)?.name}` : title,
      brief,
      files: fileList(fileCount, index),
      comments: commentList(commentCount, index),
      assigneeId: assignee,
      status,
      week: weekOf(date),
      createdAt: "2026-08-20T09:00:00.000Z",
      updatedAt: "2026-08-28T14:30:00.000Z",
    } as Content;
  });
}

export function createDemoData(): WorkspaceData {
  const contents = brands.flatMap((brand, index) => makeContent(brand.id, brandSeed[index][3], index > 0));
  return {
    brands,
    users,
    contents,
    notifications: [
      { id: "n1", text: "Tepe Emlak için 3 yeni yorum eklendi.", read: false, createdAt: new Date().toISOString() },
      { id: "n2", text: "İki içerik müşteri onayını bekliyor.", read: false, createdAt: new Date().toISOString() },
    ],
  };
}
