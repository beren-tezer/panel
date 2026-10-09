// Central data store — all mutable state lives here so pages stay in sync

export type StatusKey =
  | 'Aktif' | 'Bekliyor' | 'Gecikti' | 'Acil'
  | 'Yönetici Onayı' | 'Müşteri Onayı' | 'Revizyon'
  | 'Tamamlandı' | 'Yayına Hazır' | 'Geliştiriliyor'
  | 'İnceleniyor' | 'Optimizasyon' | 'Reddedildi' | 'Onaylandı'

export interface Task {
  id: string
  marka: string
  adi: string
  sorumlu?: string
  tarih?: string
  durum: StatusKey
  tur?: string
  progress?: number
  oncelik?: 'kritik' | 'normal' | 'dusuk'
  aciklama?: string
}

export interface Brand {
  id: string
  ad: string
  sektor: string
  sorumlu: string
  aktifIs: number
  geciken: number
  renk: string
}

export interface TeamMember {
  id: string
  ad: string
  rol: string
  aktifIs: number
  tamamlanan: number
  renk: string
}

export interface Notification {
  id: string
  mesaj: string
  zaman: string
  okundu: boolean
  tip: 'onay' | 'gecikme' | 'tamamlandi' | 'musteri'
}

export interface AdCampaign {
  id: string
  marka: string
  adi: string
  platform: string
  durum: StatusKey
  butce: string
  harcanan: string
  etki: string
}

// ─────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────
export const tasks: Task[] = [
  { id: 't1', marka: 'Sofra Pide', adi: 'Reels Montajı', sorumlu: 'Ayşe', tarih: '2 gün gecikti', durum: 'Gecikti', tur: 'Video', progress: 60, oncelik: 'kritik', aciklama: 'Müşteri tarafından onaylanan konsept, montaj aşamasında gecikti.' },
  { id: 't2', marka: 'Tepe Emlak', adi: 'Story Tasarımı', sorumlu: 'Burak', tarih: 'Bugün · 16:00', durum: 'Acil', tur: 'Tasarım', progress: 30, oncelik: 'kritik', aciklama: '5 adet story tasarımı bugün teslim edilmesi gerekiyor.' },
  { id: 't3', marka: '3 Kartal Perde', adi: 'Web Banner Tasarımı', sorumlu: 'Can', tarih: '1 gün gecikti', durum: 'Gecikti', tur: 'Tasarım', progress: 80, oncelik: 'kritik', aciklama: 'Web sitesi için 3 farklı boyutta banner.' },
  { id: 't4', marka: 'Sofra Pide', adi: 'Ürün Videosu', sorumlu: 'Can', tarih: 'Video', durum: 'Aktif', tur: 'Video', progress: 45, oncelik: 'normal', aciklama: 'Ürün tanıtım videosu, 60 saniyelik versiyon.' },
  { id: 't5', marka: 'Edva', adi: 'Instagram Carousel', sorumlu: 'Ayşe', tarih: 'Tasarım', durum: 'Aktif', tur: 'Tasarım', progress: 70, oncelik: 'normal', aciklama: '8 slaytlı Instagram carousel tasarımı.' },
  { id: 't6', marka: 'Tepe Emlak', adi: 'Reels Montajı', sorumlu: 'Burak', tarih: 'Video', durum: 'Aktif', tur: 'Video', progress: 80, oncelik: 'normal', aciklama: 'Mülk tanıtım reelsi.' },
  { id: 't7', marka: '3 Kartal Perde', adi: '4 Instagram Gönderisi', durum: 'Tamamlandı', tur: 'Tasarım', progress: 100, oncelik: 'normal', aciklama: 'Eylül ayı ilk haftası gönderi seti.' },
  { id: 't8', marka: 'Edva', adi: 'Eylül Kampanyası', durum: 'Yayına Hazır', tur: 'Kampanya', progress: 100, oncelik: 'normal', aciklama: 'Tüm materyaller hazır, yayın onayı verildi.' },
  { id: 't9', marka: 'Sofra Pide', adi: 'Marka Hikayesi', durum: 'Yayına Hazır', tur: 'Metin', progress: 100, oncelik: 'normal', aciklama: 'Marka hikayesi metni ve görselleri hazır.' },
  { id: 't10', marka: 'Tepe Emlak', adi: 'Landing Page', sorumlu: 'Can', durum: 'Geliştiriliyor', tur: 'Web', progress: 55, oncelik: 'normal', aciklama: 'Dönüşüm odaklı landing page.' },
  { id: 't11', marka: 'Sofra Pide', adi: 'Form Problemi', sorumlu: 'Ali', durum: 'İnceleniyor', tur: 'Teknik', progress: 20, oncelik: 'kritik', aciklama: 'İletişim formu hata veriyor.' },
  { id: 't12', marka: 'Edva', adi: 'Pixel Kontrolü', sorumlu: 'Burak', durum: 'Bekliyor', tur: 'Teknik', progress: 0, oncelik: 'normal', aciklama: 'Meta pixel doğru çalışıyor mu kontrol.' },
  { id: 't13', marka: 'Edva', adi: 'Eylül Performans Raporu', sorumlu: 'Ahmet', tarih: 'Bugün', durum: 'Bekliyor', tur: 'Rapor', progress: 10, oncelik: 'normal', aciklama: 'Aylık performans raporu.' },
  { id: 't14', marka: 'İç', adi: 'Yeni Freelancer Brief\'i', sorumlu: 'Ayşe', tarih: 'Yarın', durum: 'Bekliyor', tur: 'İç İş', progress: 0, oncelik: 'dusuk', aciklama: 'Yeni video freelancer için proje brief hazırlanacak.' },
  { id: 't15', marka: 'İç', adi: 'Haftalık İçerik Toplantısı', sorumlu: 'Ekip', tarih: '14:00', durum: 'Aktif', tur: 'Toplantı', progress: 0, oncelik: 'normal', aciklama: 'Haftalık içerik planlaması toplantısı.' },
]

export const approvalTasks: Task[] = [
  { id: 'a1', marka: 'Sofra Pide', adi: '3 Reels', sorumlu: 'Ayşe', durum: 'Yönetici Onayı', tur: 'Video', aciklama: 'Eylül ayı için hazırlanan 3 adet Reels videosu onay bekliyor.' },
  { id: 'a2', marka: 'Edva', adi: 'Kampanya Görselleri', sorumlu: 'Burak', durum: 'Yönetici Onayı', tur: 'Tasarım', aciklama: 'Ekim kampanyası için 6 adet görsel seti.' },
  { id: 'a3', marka: 'Tepe Emlak', adi: 'Banner Seti', sorumlu: 'Can', durum: 'Revizyon', tur: 'Tasarım', aciklama: 'Müşteri revizyon istedi — renkler değiştirilecek.' },
  { id: 'a4', marka: 'Sofra Pide', adi: 'Menü Fotoğrafları', sorumlu: 'Ayşe', durum: 'Yönetici Onayı', tur: 'Fotoğraf', aciklama: 'Yeni menü ürünlerinin fotoğrafları çekildi.' },
  { id: 'a5', marka: '3 Kartal Perde', adi: 'Ürün Kataloğu', sorumlu: 'Can', durum: 'Yönetici Onayı', tur: 'Tasarım', aciklama: 'Dijital ürün kataloğu PDF.' },
  { id: 'a6', marka: 'Edva', adi: 'Ekim Reels', sorumlu: 'Burak', durum: 'Yönetici Onayı', tur: 'Video', aciklama: '4 adet Ekim reelsi.' },
  { id: 'a7', marka: 'Tepe Emlak', adi: 'Sosyal Medya Takvimi', sorumlu: 'Ayşe', durum: 'Yönetici Onayı', tur: 'Plan', aciklama: 'Ekim ayı 30 günlük içerik takvimi.' },
]

export const customerApprovals: Task[] = [
  { id: 'c1', marka: 'Tepe Emlak', adi: 'Eylül İçerikleri', tarih: 'Dün gönderildi', durum: 'Müşteri Onayı', aciklama: 'Eylül ayı tüm sosyal medya içerikleri müşteriye gönderildi.' },
  { id: 'c2', marka: 'Sofra Pide', adi: 'Kampanya Videosu', tarih: '3 saat önce', durum: 'Bekliyor', aciklama: 'Ekim kampanya videosu onay için gönderildi.' },
  { id: 'c3', marka: 'Edva', adi: 'Sosyal Medya Takvimi', tarih: '1 gün önce', durum: 'Müşteri Onayı', aciklama: 'Ekim takvimi müşteriye iletildi.' },
  { id: 'c4', marka: '3 Kartal Perde', adi: 'Banner Görselleri', tarih: '2 saat önce', durum: 'Bekliyor', aciklama: '3 farklı boyut web banner seti.' },
  { id: 'c5', marka: 'Sofra Pide', adi: 'Menü Güncellemesi', tarih: '30 dk önce', durum: 'Müşteri Onayı', aciklama: 'Yeni menü grafikleri.' },
]

// ─────────────────────────────────────────────
// BRANDS
// ─────────────────────────────────────────────
export const brands: Brand[] = [
  { id: 'b1', ad: 'Sofra Pide', sektor: 'Restoran & Yemek', sorumlu: 'Ayşe', aktifIs: 7, geciken: 2, renk: '#ef4444' },
  { id: 'b2', ad: 'Tepe Emlak', sektor: 'Gayrimenkul', sorumlu: 'Burak', aktifIs: 5, geciken: 1, renk: '#3b82f6' },
  { id: 'b3', ad: 'Edva', sektor: 'E-Ticaret', sorumlu: 'Can', aktifIs: 6, geciken: 0, renk: '#10b981' },
  { id: 'b4', ad: '3 Kartal Perde', sektor: 'Ev Dekorasyon', sorumlu: 'Ayşe', aktifIs: 4, geciken: 1, renk: '#f59e0b' },
]

// ─────────────────────────────────────────────
// TEAM
// ─────────────────────────────────────────────
export const team: TeamMember[] = [
  { id: 'tm1', ad: 'Ahmet Yıldız', rol: 'Ajans Yöneticisi', aktifIs: 3, tamamlanan: 28, renk: '#4f46e5' },
  { id: 'tm2', ad: 'Ayşe Demir', rol: 'Tasarım Uzmanı', aktifIs: 5, tamamlanan: 42, renk: '#7c3aed' },
  { id: 'tm3', ad: 'Burak Yılmaz', rol: 'Video Editörü', aktifIs: 4, tamamlanan: 31, renk: '#2563eb' },
  { id: 'tm4', ad: 'Can Şahin', rol: 'Web Geliştirici', aktifIs: 3, tamamlanan: 19, renk: '#059669' },
  { id: 'tm5', ad: 'Ali Koc', rol: 'Teknik Uzman', aktifIs: 2, tamamlanan: 15, renk: '#ea580c' },
  { id: 'tm6', ad: 'Selin Arslan', rol: 'İçerik Yazarı', aktifIs: 4, tamamlanan: 37, renk: '#db2777' },
]

// ─────────────────────────────────────────────
// ADS
// ─────────────────────────────────────────────
export const adCampaigns: AdCampaign[] = [
  { id: 'ad1', marka: 'Sofra Pide', adi: 'Meta Reklamları', platform: 'Meta', durum: 'Aktif', butce: '₺8.000', harcanan: '₺5.240', etki: '%34 ROAS' },
  { id: 'ad2', marka: 'Edva', adi: 'Google Reklamları', platform: 'Google', durum: 'Optimizasyon', butce: '₺12.000', harcanan: '₺7.800', etki: '%28 CTR' },
  { id: 'ad3', marka: 'Tepe Emlak', adi: 'Yeni Kampanya', platform: 'Meta', durum: 'Yönetici Onayı', butce: '₺6.500', harcanan: '₺0', etki: '—' },
  { id: 'ad4', marka: '3 Kartal Perde', adi: 'Arama Reklamları', platform: 'Google', durum: 'Aktif', butce: '₺4.000', harcanan: '₺2.100', etki: '%19 CTR' },
  { id: 'ad5', marka: 'Sofra Pide', adi: 'Yeniden Hedefleme', platform: 'Meta', durum: 'Bekliyor', butce: '₺3.000', harcanan: '₺0', etki: '—' },
]

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────
export const notifications: Notification[] = [
  { id: 'n1', mesaj: 'Sofra Pide Reels Montajı 2 gün gecikti', zaman: '10 dk önce', okundu: false, tip: 'gecikme' },
  { id: 'n2', mesaj: 'Edva Kampanya Görselleri onay bekliyor', zaman: '25 dk önce', okundu: false, tip: 'onay' },
  { id: 'n3', mesaj: 'Tepe Emlak Eylül İçerikleri müşteriye gönderildi', zaman: '1 saat önce', okundu: false, tip: 'musteri' },
  { id: 'n4', mesaj: '3 Kartal Perde Banner Seti tamamlandı', zaman: '2 saat önce', okundu: true, tip: 'tamamlandi' },
  { id: 'n5', mesaj: 'Tepe Emlak Story Tasarımı bugün 16:00\'da teslim', zaman: '3 saat önce', okundu: true, tip: 'gecikme' },
]
