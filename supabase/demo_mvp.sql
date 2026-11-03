-- AgencyOS — MVP sunumu için zengin demo veri seti. Supabase Dashboard → SQL Editor'da TEK SEFERDE çalıştırın.
--
--   • 13 marka (Atlas Ajans + Google Docs planlarındaki 12 marka; var olan markaya dokunulmaz)
--   • 5 kişilik demo ekip (Ayşe, Burak, Can, Selin, Zeynep) — GİRİŞ YAPAMAZ (şifresiz + kalıcı engelli), yalnızca görevlerde görünür
--   • 106 görev: tarihler ÇALIŞTIRDIĞINIZ GÜNE göre (geçen iki hafta / bugün / önümüzdeki üç hafta), tüm durumlar, 4 geciken iş
--   • Görev ekleri (gerçek görseller), yorumlar, görev geçmişi, kontrol listeleri, yöneticilere ve çalışana bildirimler
--   • calisan@example.com bu markalara üye yapılır ve işlerin bir kısmı ona atanır (çalışan girişiyle de dolu görünür)
--
-- Tekrar çalıştırmak hiçbir şeyi çoğaltmaz. Demo görevler açıklamadaki görünmez "cw-demo" işaretiyle ayrılır.
-- Kaldırmak için en alttaki TEMİZLİK bloğu (gerçek görevlere, Lumière Kafe'ye ve gerçek hesaplara dokunmaz).
--
-- İsteğe bağlı: ajansın paylaşılan bir Google Drive demo klasörü varsa aşağıdaki v_drive değerini o bağlantıyla değiştirin;
-- eklerdeki "Drive'da aç" bağlantısı oraya gider. (Görsel önizlemeleri her durumda çalışır.)

begin;

create temp table _team (code text, full_name text, role_title text, color text, email text) on commit drop;
insert into _team values
  ('a', 'Ayşe Demir', 'Tasarım Uzmanı', 'violet', 'ayse.demir@demo.example.com'),
  ('b', 'Burak Yılmaz', 'Video Editörü', 'sky', 'burak.yilmaz@demo.example.com'),
  ('c', 'Can Şahin', 'Web Geliştirici', 'emerald', 'can.sahin@demo.example.com'),
  ('s', 'Selin Arslan', 'İçerik Yazarı', 'rose', 'selin.arslan@demo.example.com'),
  ('z', 'Zeynep Kaya', 'Sosyal Medya Uzmanı (TR/ENG)', 'amber', 'zeynep.kaya@demo.example.com');

create temp table _brands (name text, initials text, sector text, color text, theme text) on commit drop;
insert into _brands values
  ('Tepe Emlak', 'TE', 'Gayrimenkul', 'sky', 'home'),
  ('Sofra Pide', 'SP', 'Restoran & Yemek', 'red', 'food'),
  ('Mavitur TR/ENG', 'MV', 'Turizm & Turlar', 'indigo', 'travel'),
  ('3 Kartal Perde', '3K', 'Ev Dekorasyon', 'amber', 'decor'),
  ('Edva', 'ED', 'Sanat & Atölye', 'emerald', 'art'),
  ('Gürel Altyapı', 'GA', 'İnşaat', 'violet', 'build'),
  ('Velia Clinic', 'VC', 'Sağlık & Estetik', 'rose', 'care'),
  ('Gelinay', 'GE', 'Gelinlik & Moda', 'orange', 'wedding'),
  ('Mira Business', 'MB', 'Kurumsal Danışmanlık', 'indigo', 'office'),
  ('Şahin Yalı', 'ŞY', 'Kafe & Restoran', 'sky', 'food'),
  ('SDM', 'SD', 'Kurumsal Hizmetler', 'emerald', 'office'),
  ('AEK', 'AE', 'Sağlık Eğitimi', 'red', 'care'),
  ('Atlas Ajans', 'AA', 'Ajans İçi', 'orange', 'office');

create temp table _img (theme text, photo text) on commit drop;
insert into _img values
  ('home', '1560518883-ce09059eeffa'),
  ('home', '1512917774080-9991f1c4c750'),
  ('home', '1600596542815-ffad4c1539a9'),
  ('home', '1564013799919-ab600027ffc6'),
  ('food', '1565299624946-b28f40a0ae38'),
  ('food', '1551183053-bf91a1d81141'),
  ('food', '1473093295043-cdd812d0e601'),
  ('food', '1509042239860-f550ce710b93'),
  ('food', '1501339847302-ac426a4a7cbb'),
  ('travel', '1507525428034-b723cf961d3e'),
  ('travel', '1500530855697-b586d89ba3ee'),
  ('travel', '1519046904884-53103b34b206'),
  ('decor', '1505693416388-ac5ce068fe85'),
  ('decor', '1513694203232-719a280e022f'),
  ('decor', '1522708323590-d24dbb6b0267'),
  ('art', '1460661419201-fd4cecdf8a8b'),
  ('art', '1541961017774-22349e4a1262'),
  ('build', '1503387762-592deb58ef4e'),
  ('build', '1541888946425-d81bb19240f5'),
  ('build', '1497366216548-37526070297c'),
  ('care', '1570172619644-dfd03ed5d881'),
  ('care', '1616394584738-fc6e612e71b9'),
  ('wedding', '1519741497674-611481863552'),
  ('wedding', '1594552072238-b8a33785b261'),
  ('office', '1460925895917-afdab827c52f'),
  ('office', '1552664730-d307ca884978'),
  ('office', '1497366216548-37526070297c');

-- marka | başlık | platform | format | yayın (gün) | teslim (gün) | durum | öncelik | sorumlu
create temp table _tasks (brand text, title text, platform text, format text, pub int, due int, status text, priority text, who text) on commit drop;
insert into _tasks values
  ('Tepe Emlak', 'Antalya Konut Piyasası Reels', 'Instagram', 'Reels', -11, -12, 'Onaylandı', 'Yüksek', 'b'),
  ('Tepe Emlak', 'Ekim Kira Artış Oranı Post', 'Instagram', 'Gönderi', -9, -10, 'Tamamlandı', 'Orta', 'a'),
  ('Tepe Emlak', 'Etkinlik Story', 'Instagram', 'Hikâye', -7, -8, 'Tamamlandı', 'Orta', 's'),
  ('Tepe Emlak', 'Yeni Portföy Tanıtımı', 'Instagram', 'Karusel', -1, -2, 'Çalışılıyor', 'Yüksek', 'e'),
  ('Tepe Emlak', 'Müşteri Referans Videosu', 'Instagram', 'Reels', -3, -4, 'Tamamlandı', 'Yüksek', 'b'),
  ('Tepe Emlak', 'Kira Artış Bedeli Bilgilendirme', 'Instagram', 'Gönderi', -1, 0, 'Çalışılıyor', 'Düşük', 'e'),
  ('Tepe Emlak', 'Davetiye Post', 'Instagram', 'Gönderi', 1, 0, 'Müşteri Onayı', 'Orta', 'e'),
  ('Tepe Emlak', 'Ödül Töreni Reels', 'Instagram', 'Reels', 3, 2, 'Yönetici Onayı', 'Orta', 'e'),
  ('Tepe Emlak', 'Gujan Bey Röportaj Reels', 'Instagram', 'Reels', 5, 4, 'Çalışılıyor', 'Yüksek', 'b'),
  ('Tepe Emlak', 'Lüks Villa Portföyü Karusel', 'Instagram', 'Karusel', 7, 6, 'Başlanmadı', 'Orta', 'e'),
  ('Tepe Emlak', 'Konut Kredisi Rehberi Post', 'Facebook', 'Gönderi', 9, 8, 'Çalışılıyor', 'Düşük', 's'),
  ('Tepe Emlak', 'Haftalık Portföy Story', 'Instagram', 'Hikâye', 11, 10, 'Başlanmadı', 'Orta', 'e'),
  ('Tepe Emlak', 'Konyaaltı Daire Turu Reels', 'Instagram', 'Reels', 13, 12, 'Başlanmadı', 'Yüksek', 'e'),
  ('Tepe Emlak', 'Portföy Sayfası Güncellemesi', 'Web Sitesi', 'Web', 15, 14, 'Başlanmadı', 'Orta', 'c'),
  ('Sofra Pide', 'Yeni Menü Tanıtımı', 'Instagram', 'Karusel', -10, -11, 'Tamamlandı', 'Orta', 'a'),
  ('Sofra Pide', 'Mutfak Arkası Reels', 'Instagram', 'Reels', -8, -9, 'Tamamlandı', 'Düşük', 'b'),
  ('Sofra Pide', 'Hafta Sonu Kampanyası', 'Instagram', 'Gönderi', -1, -2, 'Çalışılıyor', 'Yüksek', 'e'),
  ('Sofra Pide', 'Öğle Menüsü Story Serisi', 'Instagram', 'Hikâye', -3, -4, 'Tamamlandı', 'Orta', 's'),
  ('Sofra Pide', 'Şefin Önerisi Reels', 'Instagram', 'Reels', -1, 0, 'Müşteri Onayı', 'Orta', 'e'),
  ('Sofra Pide', 'Hafta Sonu Rezervasyon Reklamı', 'Meta Reklam', 'Reklam', 2, 1, 'Yönetici Onayı', 'Orta', 'm'),
  ('Sofra Pide', 'Google Arama Reklamları Kontrolü', 'Google Reklam', 'Reklam', 4, 3, 'Çalışılıyor', 'Yüksek', 'm'),
  ('Sofra Pide', 'Makarna Çeşitleri Karuseli', 'Instagram', 'Karusel', 7, 6, 'Başlanmadı', 'Orta', 'e'),
  ('Sofra Pide', 'Doğum Günü Menüsü Post', 'Facebook', 'Gönderi', 9, 8, 'Çalışılıyor', 'Orta', 's'),
  ('Sofra Pide', 'Tiramisu Hazırlanışı Reels', 'Instagram', 'Reels', 11, 10, 'Başlanmadı', 'Orta', 'b'),
  ('Sofra Pide', 'Müşteri Yorumları Story', 'Instagram', 'Hikâye', 14, 13, 'Başlanmadı', 'Yüksek', 'e'),
  ('Sofra Pide', 'Sonbahar Menüsü Lansmanı', 'Instagram', 'Karusel', 16, 15, 'Başlanmadı', 'Düşük', 'a'),
  ('Mavitur TR/ENG', 'P01 | Antalya ve Çevresindeki Turlar Tek Bir Yerde', 'Instagram', 'Gönderi', -9, -10, 'Tamamlandı', 'Orta', 'a'),
  ('Mavitur TR/ENG', 'Ali Part 1 Reels', 'Instagram', 'Reels', -7, -8, 'Onaylandı', 'Orta', 'b'),
  ('Mavitur TR/ENG', 'Ali Part 2 Reels', 'Instagram', 'Reels', -4, -5, 'Tamamlandı', 'Yüksek', 'b'),
  ('Mavitur TR/ENG', 'P02 | Ekim''de Sen Nasıl Bir Tatilcisin?', 'Instagram', 'Gönderi', -2, -3, 'Tamamlandı', 'Orta', 'z'),
  ('Mavitur TR/ENG', 'Ali Part 3 Reels', 'Instagram', 'Reels', 0, 0, 'Müşteri Onayı', 'Düşük', 'b'),
  ('Mavitur TR/ENG', 'P03 | Tur Seçmeden Önce Bu 5 Detaya Bak', 'Instagram', 'Karusel', 3, 2, 'Revizyon', 'Orta', 'a'),
  ('Mavitur TR/ENG', 'Antalya Turları Reels', 'Instagram', 'Reels', 5, 4, 'Yönetici Onayı', 'Yüksek', 'e'),
  ('Mavitur TR/ENG', 'İngilizce Tur Tanıtımı (ENG Reels)', 'Instagram', 'Reels', 8, 7, 'Başlanmadı', 'Orta', 'z'),
  ('Mavitur TR/ENG', 'P04 | Tatil Zamanın Değerli', 'Instagram', 'Gönderi', 10, 9, 'Çalışılıyor', 'Orta', 'z'),
  ('Mavitur TR/ENG', 'Suadada Tekne Turu Reels', 'Instagram', 'Reels', 12, 11, 'Başlanmadı', 'Düşük', 'b'),
  ('Mavitur TR/ENG', 'P05 | Turdan Önce Güvene İhtiyacın Var', 'Instagram', 'Gönderi', 15, 14, 'Başlanmadı', 'Yüksek', 'a'),
  ('Mavitur TR/ENG', 'Tatil Fırsatları Story (TR/ENG)', 'Instagram', 'Hikâye', 17, 16, 'Başlanmadı', 'Orta', 'z'),
  ('3 Kartal Perde', 'Kış Koleksiyonu Tanıtımı', 'Instagram', 'Reels', -11, -12, 'Tamamlandı', 'Orta', 'b'),
  ('3 Kartal Perde', 'Ölçü Alma Rehberi Karusel', 'Instagram', 'Karusel', -2, -3, 'Başlanmadı', 'Yüksek', 'a'),
  ('3 Kartal Perde', 'Stor Perde Kampanya Post', 'Instagram', 'Gönderi', -5, -6, 'Tamamlandı', 'Yüksek', 'e'),
  ('3 Kartal Perde', 'Showroom Story', 'Instagram', 'Hikâye', -1, 0, 'Çalışılıyor', 'Orta', 's'),
  ('3 Kartal Perde', 'Katalog PDF İndirme Sayfası', 'Web Sitesi', 'Web', 2, 1, 'Müşteri Onayı', 'Orta', 'c'),
  ('3 Kartal Perde', 'Müşteri Evinden Uygulama Reels', 'Instagram', 'Reels', 5, 4, 'Çalışılıyor', 'Orta', 'b'),
  ('3 Kartal Perde', 'Tül Perde Çeşitleri Karusel', 'Instagram', 'Karusel', 9, 8, 'Çalışılıyor', 'Yüksek', 'a'),
  ('3 Kartal Perde', 'Ücretsiz Keşif Duyurusu', 'Instagram', 'Gönderi', 12, 11, 'Başlanmadı', 'Düşük', 'e'),
  ('3 Kartal Perde', 'Kumaş Seçim Rehberi Story', 'Instagram', 'Hikâye', 15, 14, 'Başlanmadı', 'Orta', 's'),
  ('Edva', 'Seramik Atölyesi Tanıtımı', 'Instagram', 'Reels', -10, -11, 'Tamamlandı', 'Orta', 'b'),
  ('Edva', 'Sonbahar Tablo Koleksiyonu', 'Instagram', 'Karusel', -6, -7, 'Tamamlandı', 'Yüksek', 'a'),
  ('Edva', 'Ekim Etkinlik Programı', 'Instagram', 'Gönderi', -3, -4, 'Tamamlandı', 'Orta', 's'),
  ('Edva', 'Çocuk Resim Atölyesi Duyurusu', 'Instagram', 'Hikâye', 1, 0, 'Onaylandı', 'Düşük', 'e'),
  ('Edva', 'Sanatçı Röportajı Videosu', 'YouTube', 'Video', 5, 4, 'Revizyon', 'Orta', 'b'),
  ('Edva', 'Atölye Kayıt Formu Sayfası', 'Web Sitesi', 'Web', 9, 8, 'Çalışılıyor', 'Yüksek', 'c'),
  ('Edva', 'Öğrenci Eserleri Karusel', 'Instagram', 'Karusel', 12, 11, 'Başlanmadı', 'Orta', 'a'),
  ('Edva', 'Ebru Sanatı Reels', 'Instagram', 'Reels', 16, 15, 'Başlanmadı', 'Orta', 'e'),
  ('Gürel Altyapı', 'Şantiye İlerleme Videosu', 'Instagram', 'Reels', -9, -10, 'Tamamlandı', 'Düşük', 'b'),
  ('Gürel Altyapı', 'Proje Tanıtım Reels', 'Instagram', 'Reels', -5, -6, 'Tamamlandı', 'Yüksek', 'e'),
  ('Gürel Altyapı', 'Satış Ofisi Açılış Post', 'LinkedIn', 'Gönderi', -2, -3, 'Tamamlandı', 'Orta', 's'),
  ('Gürel Altyapı', 'Daire Planları Karuseli', 'Instagram', 'Karusel', 2, 1, 'Müşteri Onayı', 'Orta', 'a'),
  ('Gürel Altyapı', 'Proje Web Sayfası Güncellemesi', 'Web Sitesi', 'Web', 6, 5, 'Revizyon', 'Orta', 'c'),
  ('Gürel Altyapı', 'Drone Çekimi Story', 'Instagram', 'Hikâye', 10, 9, 'Çalışılıyor', 'Yüksek', 'b'),
  ('Gürel Altyapı', 'Teslim Tarihi Duyurusu', 'Instagram', 'Gönderi', 13, 12, 'Başlanmadı', 'Orta', 'e'),
  ('Gürel Altyapı', 'Sosyal Alanlar Tanıtımı', 'Instagram', 'Karusel', 17, 16, 'Başlanmadı', 'Orta', 'a'),
  ('Velia Clinic', 'Cilt Bakımı Reels', 'Instagram', 'Reels', -11, -12, 'Onaylandı', 'Orta', 'b'),
  ('Velia Clinic', 'Sık Sorulan Sorular Karuseli', 'Instagram', 'Karusel', -7, -8, 'Tamamlandı', 'Yüksek', 'a'),
  ('Velia Clinic', 'Randevu Kampanyası Reklamı', 'Meta Reklam', 'Reklam', -4, -5, 'Tamamlandı', 'Düşük', 'm'),
  ('Velia Clinic', 'Uzman Görüşü Videosu', 'YouTube', 'Video', 0, 0, 'Müşteri Onayı', 'Orta', 'b'),
  ('Velia Clinic', 'Hasta Deneyimi Story', 'Instagram', 'Hikâye', 4, 3, 'Yönetici Onayı', 'Orta', 's'),
  ('Velia Clinic', 'Lazer Epilasyon Bilgilendirme', 'Instagram', 'Gönderi', -1, -2, 'Çalışılıyor', 'Orta', 'e'),
  ('Velia Clinic', 'Önce-Sonra Karusel', 'Instagram', 'Karusel', 11, 10, 'Başlanmadı', 'Orta', 'a'),
  ('Velia Clinic', 'Google Randevu Reklamları', 'Google Reklam', 'Reklam', 15, 14, 'Başlanmadı', 'Düşük', 'm'),
  ('Gelinay', 'Gelinlik Koleksiyonu Reels', 'Instagram', 'Reels', -10, -11, 'Tamamlandı', 'Orta', 'b'),
  ('Gelinay', 'Ürün Çekimi Story', 'Instagram', 'Hikâye', -6, -7, 'Onaylandı', 'Yüksek', 'e'),
  ('Gelinay', 'Prova Günü Deneyimi Post', 'Instagram', 'Gönderi', -1, 0, 'Yönetici Onayı', 'Orta', 's'),
  ('Gelinay', 'Sezon Kampanyası Reklamı', 'Meta Reklam', 'Reklam', 3, 2, 'Revizyon', 'Orta', 'm'),
  ('Gelinay', 'Nişanlık Koleksiyonu Karusel', 'Instagram', 'Karusel', 7, 6, 'Başlanmadı', 'Düşük', 'a'),
  ('Gelinay', 'Gelin Hikâyeleri Reels', 'Instagram', 'Reels', 12, 11, 'Çalışılıyor', 'Yüksek', 'e'),
  ('Gelinay', 'Randevu Sayfası Güncellemesi', 'Web Sitesi', 'Web', 16, 15, 'Başlanmadı', 'Orta', 'c'),
  ('Mira Business', 'Kurumsal Danışmanlık Tanıtımı', 'LinkedIn', 'Karusel', -9, -10, 'Tamamlandı', 'Orta', 'a'),
  ('Mira Business', 'CEO Röportajı Videosu', 'LinkedIn', 'Video', -4, -5, 'Tamamlandı', 'Orta', 'b'),
  ('Mira Business', 'Haftalık Sektör Bülteni', 'LinkedIn', 'Gönderi', 1, 0, 'Onaylandı', 'Yüksek', 's'),
  ('Mira Business', 'Eğitim Programı Duyurusu', 'LinkedIn', 'Gönderi', 7, 6, 'Başlanmadı', 'Orta', 'e'),
  ('Mira Business', 'Referans Projeler Karusel', 'LinkedIn', 'Karusel', 12, 11, 'Çalışılıyor', 'Orta', 'a'),
  ('Mira Business', 'LinkedIn Reklam Kampanyası', 'LinkedIn', 'Reklam', 17, 16, 'Başlanmadı', 'Orta', 'm'),
  ('Şahin Yalı', 'Kahvaltı Menüsü Reels', 'Instagram', 'Reels', -11, -12, 'Tamamlandı', 'Yüksek', 'b'),
  ('Şahin Yalı', 'Deniz Manzaralı Masa Rezervasyonu', 'Instagram', 'Gönderi', -6, -7, 'Tamamlandı', 'Düşük', 'e'),
  ('Şahin Yalı', 'Canlı Müzik Akşamı Story', 'Instagram', 'Hikâye', -1, -2, 'Onaylandı', 'Orta', 's'),
  ('Şahin Yalı', 'Brunch Karusel', 'Instagram', 'Karusel', 5, 4, 'Yönetici Onayı', 'Orta', 'a'),
  ('Şahin Yalı', 'Şahin Yalı Bölge Tanıtım Reels', 'Instagram', 'Reels', 10, 9, 'Çalışılıyor', 'Yüksek', 'e'),
  ('Şahin Yalı', 'Hafta Sonu Rezervasyon Reklamı', 'Meta Reklam', 'Reklam', 15, 14, 'Başlanmadı', 'Orta', 'm'),
  ('SDM', 'Hizmet Tanıtım Post', 'LinkedIn', 'Gönderi', -10, -11, 'Onaylandı', 'Düşük', 'a'),
  ('SDM', 'Ekip Tanıtımı Karusel', 'LinkedIn', 'Karusel', -4, -5, 'Tamamlandı', 'Orta', 'a'),
  ('SDM', 'Kurumsal Tanıtım Videosu', 'YouTube', 'Video', 3, 2, 'Yönetici Onayı', 'Yüksek', 'b'),
  ('SDM', 'Hizmetler Sayfası Yenileme', 'Web Sitesi', 'Web', 10, 9, 'Başlanmadı', 'Orta', 'c'),
  ('SDM', 'Müşteri Başarı Hikâyesi', 'LinkedIn', 'Gönderi', 16, 15, 'Başlanmadı', 'Orta', 's'),
  ('AEK', 'Kalp Sağlığı Bilgilendirme Post', 'Instagram', 'Gönderi', -9, -10, 'Tamamlandı', 'Düşük', 'a'),
  ('AEK', 'İlk Yardım Eğitimi Duyurusu', 'Instagram', 'Gönderi', -3, -4, 'Tamamlandı', 'Yüksek', 'e'),
  ('AEK', 'Cihaz Kullanım Videosu', 'YouTube', 'Video', 4, 3, 'Yönetici Onayı', 'Orta', 'b'),
  ('AEK', 'Eğitim Takvimi Story', 'Instagram', 'Hikâye', 11, 10, 'Çalışılıyor', 'Orta', 's'),
  ('AEK', 'Sertifika Programı Karusel', 'Instagram', 'Karusel', 17, 16, 'Başlanmadı', 'Orta', 'a'),
  ('Atlas Ajans', 'Ekim Performans Raporu', 'LinkedIn', 'Rapor', -11, -12, 'Tamamlandı', 'Yüksek', 'm'),
  ('Atlas Ajans', 'Ajans LinkedIn Vaka Çalışması', 'LinkedIn', 'Karusel', -6, -7, 'Tamamlandı', 'Orta', 's'),
  ('Atlas Ajans', 'Yeni Müşteri Sunum Şablonu', 'LinkedIn', 'Rapor', -1, 0, 'Müşteri Onayı', 'Orta', 'm'),
  ('Atlas Ajans', 'Ajans Web Sitesi Portfolyo Güncellemesi', 'Web Sitesi', 'Web', 5, 4, 'Çalışılıyor', 'Orta', 'c'),
  ('Atlas Ajans', 'Ekip Tanıtım Reels', 'Instagram', 'Reels', 10, 9, 'Çalışılıyor', 'Yüksek', 'b'),
  ('Atlas Ajans', 'Aylık İçerik Planlama Notları', 'LinkedIn', 'Rapor', 15, 14, 'Başlanmadı', 'Düşük', 'e');

do $$
declare
  v_drive constant text := 'https://drive.google.com/drive/my-drive';
  v_m uuid; v_emp uuid;
begin
  select id into v_m from public.profiles where lower(email) = 'yonetici@example.com' and active;
  if v_m is null then select id into v_m from public.profiles where role = 'admin' and active order by created_at limit 1; end if;
  if v_m is null then raise exception 'Aktif yönetici bulunamadı.'; end if;
  select id into v_emp from public.profiles where lower(email) = 'calisan@example.com' and active;
  v_emp := coalesce(v_emp, v_m);

  -- 1) Demo ekip: şifresiz ve kalıcı engelli Auth kayıtları (giriş yapamaz), profil = aktif çalışan.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, banned_until)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', t.email, '',
         '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', t.full_name),
         now(), now(), '', '', '', '', '2999-12-31'::timestamptz
  from _team t where not exists (select 1 from auth.users u where lower(u.email) = lower(t.email));
  update public.profiles p set role = 'employee', active = true, full_name = t.full_name, role_title = t.role_title, color = t.color
  from _team t where lower(p.email) = lower(t.email);

  -- 2) Markalar (var olanlara dokunulmaz).
  insert into public.brands (name, initials, sector, color)
  select b.name, b.initials, b.sector, b.color from _brands b
  where not exists (select 1 from public.brands x where lower(x.name) = lower(b.name));

  -- 3) Ekip üyelikleri: demo ekip tüm demo markalarda, çalışan hesabı da öyle.
  insert into public.brand_members (brand_id, user_id)
  select b.id, p.id from public.brands b join _brands d on lower(d.name) = lower(b.name)
  cross join public.profiles p
  where p.id = v_emp or lower(p.email) in (select lower(email) from _team)
  on conflict do nothing;

  -- 4) Görevler. Pazar gününe denk gelen yayınlar pazartesiye kayar. Bugün teslim edilenlere saat verilir.
  insert into public.tasks (brand_id, title, platform, format, assignee_id, status, priority, publish_date, due_date, due_time, description)
  select b.id, d.title, d.platform, d.format,
         case d.who when 'm' then v_m when 'e' then v_emp else (select p.id from public.profiles p join _team t on lower(t.email) = lower(p.email) where t.code = d.who) end,
         d.status, d.priority,
         current_date + d.pub + case when extract(dow from current_date + d.pub) = 0 then 1 else 0 end,
         current_date + d.due,
         case when d.due = 0 then (array['10:00','12:00','14:00','16:30','18:00'])[1 + (abs(hashtext(d.title)) % 5)]::time end,
         '<!--cw-demo--><p><strong>Brief:</strong> ' || d.title || ' — ' || d.platform || ' için ' || lower(d.format) || ' içeriği.</p>'
         || '<ul><li>Marka kılavuzundaki logo, renk ve tipografi kurallarına uyulacak.</li>'
         || '<li>' || d.platform || ' ölçüleri ve güvenli alanlar kontrol edilecek.</li>'
         || '<li>Metin, hashtag ve iletişim bilgileri yayın öncesi son kontrolden geçecek.</li></ul>'
  from _tasks d join public.brands b on lower(b.name) = lower(d.brand)
  where not exists (select 1 from public.tasks t where t.brand_id = b.id and t.title = d.title and t.description like '<!--cw-demo-->%');

  -- 5) Ekler: üzerinde çalışılmış görsel işlerde 1–3 gerçek görsel (biri ekip içi ham dosya).
  insert into public.attachments (task_id, name, type, size_label, thumbnail_url, drive_url, added_by, internal)
  select t.id, f.name, 'Görsel', f.size, 'https://images.unsplash.com/photo-' || img.photo || '?w=1200&q=80', v_drive,
         coalesce(t.assignee_id, v_m), f.internal
  from public.tasks t
  join public.brands b on b.id = t.brand_id join _brands d on lower(d.name) = lower(b.name)
  cross join lateral (values (1, 'kapak_gorseli.jpg', '2,4 MB', false), (2, 'final_v2.jpg', '3,1 MB', false), (3, 'ham_cekim.jpg', '8,7 MB', true)) as f(n, name, size, internal)
  cross join lateral (select photo from _img where theme = d.theme order by photo offset ((abs(hashtext(t.title)) + f.n) % (select count(*) from _img where theme = d.theme)) limit 1) img
  where t.description like '<!--cw-demo-->%' and t.status <> 'Başlanmadı' and t.format in ('Reels', 'Gönderi', 'Hikâye', 'Karusel', 'Video')
    and f.n <= 1 + (abs(hashtext(t.title)) % 3)
    and not exists (select 1 from public.attachments a where a.task_id = t.id and a.name = f.name);

  -- 6) Yorumlar: duruma uygun, sorumlu ve yönetici arasında.
  insert into public.comments (task_id, user_id, body, created_at)
  select t.id, case c.by when 'm' then v_m else coalesce(t.assignee_id, v_m) end, c.body, now() - make_interval(hours => c.hrs + (abs(hashtext(t.title)) % 5))
  from public.tasks t
  cross join lateral (values
    ('Tamamlandı', 'm', 30, 'Yayına alındı, ilk 24 saatte etkileşim ortalamanın üzerinde.'),
    ('Tamamlandı', 'x', 52, 'Final dosyalar Drive klasörüne yüklendi.'),
    ('Onaylandı', 'm', 20, 'Müşteri onayladı, planlanan saatte yayına alınacak.'),
    ('Müşteri Onayı', 'x', 26, 'Kontrol listesi tamamlandı, yönetici onayına gönderdim.'),
    ('Müşteri Onayı', 'm', 6, 'İnceledim, müşteri onayına gönderildi.'),
    ('Yönetici Onayı', 'x', 5, 'Kontrol listesi tamamlandı, onayınıza sunuyorum.'),
    ('Yönetici Onayı', 'm', 2, 'Kapak görselindeki yazıyı biraz büyütelim, sonra müşteriye gönderiyorum.'),
    ('Revizyon', 'm', 28, 'Müşteri revizyonu: logo daha görünür olsun ve iletişim bilgisi son kareye eklensin.'),
    ('Revizyon', 'x', 7, 'Revize üzerinde çalışıyorum, bugün tekrar gönderirim.'),
    ('Çalışılıyor', 'm', 40, 'Brief ve görseller Drive klasöründe; marka kılavuzundaki renkleri kullanalım.'),
    ('Çalışılıyor', 'x', 9, 'Taslak hazırlanıyor, yarın sabah paylaşırım.')
  ) as c(status, by, hrs, body)
  where t.description like '<!--cw-demo-->%' and c.status = t.status
    and not exists (select 1 from public.comments x where x.task_id = t.id and x.body = c.body);

  -- 7) Görev geçmişi.
  insert into public.activity (task_id, user_id, text, created_at)
  select t.id, v_m, 'görevi oluşturdu', now() - interval '6 days' - make_interval(hours => abs(hashtext(t.title)) % 48)
  from public.tasks t
  where t.description like '<!--cw-demo-->%' and not exists (select 1 from public.activity a where a.task_id = t.id and a.text = 'görevi oluşturdu');
  insert into public.activity (task_id, user_id, text, created_at)
  select t.id, coalesce(t.assignee_id, v_m), 'durumu “' || t.status || '” olarak değiştirdi', now() - make_interval(hours => 3 + abs(hashtext(t.title)) % 20)
  from public.tasks t
  where t.description like '<!--cw-demo-->%' and t.status <> 'Başlanmadı'
    and not exists (select 1 from public.activity a where a.task_id = t.id and a.text like 'durumu %');

  -- 8) Kontrol listeleri: onaya gönderilmiş / biten işlerde tamam, üzerinde çalışılanlarda kısmen.
  update public.task_checklist_items i
  set is_completed = true, completed_by = t.assignee_id, completed_at = now() - interval '1 day'
  from public.tasks t
  where i.task_id = t.id and t.description like '<!--cw-demo-->%' and not i.is_completed
    and (t.status in ('Yönetici Onayı', 'Müşteri Onayı', 'Onaylandı', 'Tamamlandı') or (t.status in ('Çalışılıyor', 'Revizyon') and i.sort_order < 3));

  -- 9) Bildirimler: yöneticilere onay bekleyenler, çalışan hesabına atama / revizyon.
  insert into public.notifications (user_id, task_id, kind, text, created_at)
  select a.id, t.id, 'status', coalesce(p.full_name, 'Ekip') || ' “' || t.title || '” için yönetici onayı istiyor.', now() - make_interval(hours => 1 + abs(hashtext(t.title)) % 10)
  from public.tasks t left join public.profiles p on p.id = t.assignee_id
  cross join public.profiles a
  where t.description like '<!--cw-demo-->%' and t.status = 'Yönetici Onayı' and a.role = 'admin' and a.active
    and not exists (select 1 from public.notifications n where n.user_id = a.id and n.task_id = t.id and n.kind = 'status');
  insert into public.notifications (user_id, task_id, kind, text, created_at)
  select v_emp, t.id, case t.status when 'Revizyon' then 'revision' else 'assign' end,
         case t.status when 'Revizyon' then 'Müşteri “' || t.title || '” için revize istedi: logo daha görünür olsun.'
                       else 'Yöneticiniz “' || t.title || '” görevini size atadı.' end,
         now() - make_interval(hours => 2 + abs(hashtext(t.title)) % 30)
  from public.tasks t
  where t.description like '<!--cw-demo-->%' and t.assignee_id = v_emp and v_emp <> v_m and t.status in ('Revizyon', 'Başlanmadı')
    and not exists (select 1 from public.notifications n where n.user_id = v_emp and n.task_id = t.id);
end $$;

commit;

-- Doğrulama
select 'Marka' as kontrol, count(*)::text as sonuc from public.brands
union all select 'Aktif çalışan', count(*)::text from public.profiles where role = 'employee' and active
union all select 'Demo görev', count(*)::text from public.tasks where description like '<!--cw-demo-->%'
union all select 'Bugün teslim', count(*)::text from public.tasks where due_date = current_date
union all select 'Geciken açık iş', count(*)::text from public.tasks where due_date < current_date and status not in ('Tamamlandı', 'Onaylandı')
union all select 'Yönetici onayında', count(*)::text from public.tasks where status = 'Yönetici Onayı'
union all select 'Müşteri onayında', count(*)::text from public.tasks where status = 'Müşteri Onayı'
union all select 'Revizyonda', count(*)::text from public.tasks where status = 'Revizyon'
union all select 'Ek dosya', count(*)::text from public.attachments a join public.tasks t on t.id = a.task_id where t.description like '<!--cw-demo-->%'
union all select 'Yorum', count(*)::text from public.comments c join public.tasks t on t.id = c.task_id where t.description like '<!--cw-demo-->%'
union all select 'Çalışan hesabına atanan', count(*)::text from public.tasks t join public.profiles p on p.id = t.assignee_id where lower(p.email) = 'calisan@example.com';


-- ───────────────────────── TEMİZLİK (sunumdan sonra, gerekirse) ─────────────────────────
-- Yorumu açıp çalıştırın: demo görevler (ekleri, yorumları, geçmişi, bildirimleriyle) ve demo ekip hesapları silinir.
-- begin;
-- delete from public.tasks where description like '<!--cw-demo-->%';
-- delete from auth.users where lower(email) like '%@demo.example.com';
-- commit;
