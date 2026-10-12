-- MVP sunumu için demo içerik planı — Supabase Dashboard → SQL Editor'da tek seferde çalıştırın.
--   • 8 marka (yoksa eklenir; varsa dokunulmaz) + mevcut Atlas Ajans markasına ajans içi işler
--   • 57 içerik görevi: tarihler BUGÜNE göre (geçen hafta / bugün / önümüzdeki iki hafta), tüm durumlar, 3 geciken iş
--   • 28 yorum, kontrol listeleri (onaydaki / biten işlerde tamamlanmış)
--   • calisan@example.com bu markalara üye yapılır (atanan işlerini görsün diye)
-- Tekrar çalıştırmak görevleri çoğaltmaz. Demo görevler açıklamadaki görünmez "cw-demo" işaretiyle ayrılır;
-- kaldırmak için en alttaki TEMİZLİK bloğunu kullanın (gerçek görevlere dokunmaz).

begin;

create temp table _demo_brands (name text, initials text, sector text, color text) on commit drop;
insert into _demo_brands values
  ('Tepe Emlak', 'TE', 'Gayrimenkul', 'sky'),
  ('Sofra Pide', 'SP', 'Restoran & Yemek', 'red'),
  ('Mavitur TR/ENG', 'MX', 'Turizm & Turlar', 'indigo'),
  ('3 Kartal Perde', '3K', 'Ev Dekorasyon', 'amber'),
  ('Edva', 'ED', 'Sanat & Atölye', 'emerald'),
  ('Gürel Altyapı', 'GA', 'İnşaat', 'violet'),
  ('Velia Clinic', 'VC', 'Sağlık & Estetik', 'rose'),
  ('Gelinay', 'GE', 'Gelinlik & Moda', 'orange');

insert into public.brands (name, initials, sector, color)
select d.name, d.initials, d.sector, d.color from _demo_brands d
where not exists (select 1 from public.brands b where lower(b.name) = lower(d.name));

-- marka | başlık | platform | format | yayın (gün) | teslim (gün) | durum | öncelik | sorumlu (e = çalışan, m = Yöneticiniz) | saat
create temp table _demo_tasks (brand text, title text, platform text, format text, pub int, due int, status text, priority text, who text, tm text) on commit drop;
insert into _demo_tasks values
  ('Tepe Emlak', 'Antalya Konut Piyasası Reels', 'Instagram', 'Reels', -10, -11, 'Tamamlandı', 'Orta', 'e', null),
  ('Tepe Emlak', 'Ekim Kira Artış Oranı Post', 'Instagram', 'Gönderi', -8, -9, 'Tamamlandı', 'Yüksek', 'e', null),
  ('Tepe Emlak', 'Etkinlik Story', 'Instagram', 'Hikâye', -5, -6, 'Tamamlandı', 'Düşük', 'e', null),
  ('Tepe Emlak', 'Yeni Portföy Tanıtımı', 'Instagram', 'Karusel', -2, -3, 'Çalışılıyor', 'Yüksek', 'e', '17:00'),
  ('Tepe Emlak', 'Müşteri Referans Videosu', 'Instagram', 'Reels', 0, 0, 'Müşteri Onayı', 'Yüksek', 'e', '16:00'),
  ('Tepe Emlak', 'Kira Artış Bedeli Bilgilendirme', 'Instagram', 'Gönderi', 1, 0, 'Yönetici Onayı', 'Orta', 'e', '12:00'),
  ('Tepe Emlak', 'Davetiye Post', 'Instagram', 'Gönderi', 2, 1, 'Revizyon', 'Orta', 'e', null),
  ('Tepe Emlak', 'Ödül Töreni Reels', 'Instagram', 'Reels', 3, 2, 'Çalışılıyor', 'Orta', 'e', null),
  ('Tepe Emlak', 'Gujan Bey Röportaj Reels', 'Instagram', 'Reels', 5, 4, 'Başlanmadı', 'Orta', 'e', null),
  ('Tepe Emlak', 'Lüks Villa Portföyü Karusel', 'Instagram', 'Karusel', 8, 7, 'Başlanmadı', 'Düşük', 'e', null),
  ('Tepe Emlak', 'Konut Kredisi Rehberi Post', 'Facebook', 'Gönderi', 10, 9, 'Başlanmadı', 'Düşük', 'e', null),
  ('Tepe Emlak', 'Portföy Sayfası Güncellemesi', 'Web Sitesi', 'Web', 4, 3, 'Çalışılıyor', 'Orta', 'm', null),
  ('Sofra Pide', 'Yeni Menü Tanıtımı', 'Instagram', 'Karusel', -9, -10, 'Tamamlandı', 'Yüksek', 'e', null),
  ('Sofra Pide', 'Mutfak Arkası Reels', 'Instagram', 'Reels', -4, -5, 'Tamamlandı', 'Orta', 'e', null),
  ('Sofra Pide', 'Hafta Sonu Kampanyası', 'Instagram', 'Gönderi', -1, -2, 'Çalışılıyor', 'Yüksek', 'e', '18:00'),
  ('Sofra Pide', 'Öğle Menüsü Story Serisi', 'Instagram', 'Hikâye', 0, 0, 'Yönetici Onayı', 'Orta', 'e', '14:00'),
  ('Sofra Pide', 'Şefin Önerisi Reels', 'Instagram', 'Reels', 2, 1, 'Müşteri Onayı', 'Orta', 'e', null),
  ('Sofra Pide', 'Hafta Sonu Rezervasyon Reklamı', 'Meta Reklam', 'Reklam', 3, 1, 'Çalışılıyor', 'Orta', 'm', null),
  ('Sofra Pide', 'Google Arama Reklamları Kontrolü', 'Google Reklam', 'Reklam', 0, 0, 'Başlanmadı', 'Orta', 'm', '17:00'),
  ('Sofra Pide', 'Makarna Çeşitleri Karuseli', 'Instagram', 'Karusel', 6, 5, 'Başlanmadı', 'Düşük', 'e', null),
  ('Sofra Pide', 'Doğum Günü Menüsü Post', 'Facebook', 'Gönderi', 9, 8, 'Başlanmadı', 'Düşük', 'e', null),
  ('Mavitur TR/ENG', 'P01 | Antalya ve Çevresindeki Turlar Tek Bir Yerde', 'Instagram', 'Gönderi', -11, -12, 'Tamamlandı', 'Orta', 'e', null),
  ('Mavitur TR/ENG', 'Ali Part 2 Reels', 'Instagram', 'Reels', -7, -8, 'Tamamlandı', 'Orta', 'e', null),
  ('Mavitur TR/ENG', 'P02 | Ekim''de Sen Nasıl Bir Tatilcisin?', 'Instagram', 'Gönderi', -3, -4, 'Onaylandı', 'Orta', 'e', null),
  ('Mavitur TR/ENG', 'Antalya Turları Reels', 'Instagram', 'Reels', 1, 0, 'Yönetici Onayı', 'Yüksek', 'e', '11:00'),
  ('Mavitur TR/ENG', 'P03 | Tatil Fırsatları Post', 'Instagram', 'Gönderi', 4, 3, 'Çalışılıyor', 'Orta', 'e', null),
  ('Mavitur TR/ENG', 'İngilizce Tur Tanıtımı (ENG Reels)', 'Instagram', 'Reels', 5, 4, 'Revizyon', 'Yüksek', 'e', null),
  ('Mavitur TR/ENG', 'Suadada Tekne Turu Reels', 'Instagram', 'Reels', 7, 6, 'Başlanmadı', 'Orta', 'e', null),
  ('Mavitur TR/ENG', 'P04 | Tur Seçmeden Önce Bu 5 Detaya Bak', 'Instagram', 'Karusel', 11, 10, 'Başlanmadı', 'Orta', 'e', null),
  ('3 Kartal Perde', 'Kış Koleksiyonu Tanıtımı', 'Instagram', 'Reels', -6, -7, 'Tamamlandı', 'Orta', 'e', null),
  ('3 Kartal Perde', 'Ölçü Alma Rehberi Karusel', 'Instagram', 'Karusel', -1, -2, 'Başlanmadı', 'Yüksek', 'e', null),
  ('3 Kartal Perde', 'Stor Perde Kampanya Post', 'Instagram', 'Gönderi', 0, 0, 'Müşteri Onayı', 'Orta', 'e', '15:00'),
  ('3 Kartal Perde', 'Showroom Story', 'Instagram', 'Hikâye', 3, 2, 'Çalışılıyor', 'Orta', 'e', null),
  ('3 Kartal Perde', 'Katalog PDF İndirme Sayfası', 'Web Sitesi', 'Web', 6, 5, 'Başlanmadı', 'Orta', 'm', null),
  ('3 Kartal Perde', 'Müşteri Evinden Uygulama Reels', 'Instagram', 'Reels', 9, 8, 'Başlanmadı', 'Düşük', 'e', null),
  ('Edva', 'Seramik Atölyesi Tanıtımı', 'Instagram', 'Reels', -5, -6, 'Tamamlandı', 'Orta', 'e', null),
  ('Edva', 'Sonbahar Tablo Koleksiyonu', 'Instagram', 'Karusel', 1, 0, 'Müşteri Onayı', 'Orta', 'e', '18:00'),
  ('Edva', 'Ekim Etkinlik Programı', 'Instagram', 'Gönderi', 2, 1, 'Yönetici Onayı', 'Orta', 'e', null),
  ('Edva', 'Çocuk Resim Atölyesi Duyurusu', 'Instagram', 'Hikâye', 6, 5, 'Başlanmadı', 'Düşük', 'e', null),
  ('Edva', 'Sanatçı Röportajı Videosu', 'YouTube', 'Video', 13, 12, 'Başlanmadı', 'Düşük', 'e', null),
  ('Gürel Altyapı', 'Şantiye İlerleme Videosu', 'Instagram', 'Reels', -3, -4, 'Tamamlandı', 'Orta', 'e', null),
  ('Gürel Altyapı', 'Proje Tanıtım Reels', 'Instagram', 'Reels', 0, 0, 'Yönetici Onayı', 'Yüksek', 'e', '10:00'),
  ('Gürel Altyapı', 'Satış Ofisi Açılış Post', 'LinkedIn', 'Gönderi', 3, 2, 'Çalışılıyor', 'Orta', 'e', null),
  ('Gürel Altyapı', 'Daire Planları Karuseli', 'Instagram', 'Karusel', 7, 6, 'Başlanmadı', 'Orta', 'e', null),
  ('Gürel Altyapı', 'Proje Web Sayfası Güncellemesi', 'Web Sitesi', 'Web', 5, 4, 'Revizyon', 'Orta', 'm', null),
  ('Velia Clinic', 'Cilt Bakımı Reels', 'Instagram', 'Reels', -4, -5, 'Tamamlandı', 'Orta', 'e', null),
  ('Velia Clinic', 'Sık Sorulan Sorular Karuseli', 'Instagram', 'Karusel', 0, 0, 'Çalışılıyor', 'Orta', 'e', '17:30'),
  ('Velia Clinic', 'Randevu Kampanyası Reklamı', 'Meta Reklam', 'Reklam', 2, 1, 'Başlanmadı', 'Yüksek', 'm', null),
  ('Velia Clinic', 'Uzman Görüşü Videosu', 'YouTube', 'Video', 4, 3, 'Çalışılıyor', 'Orta', 'e', null),
  ('Velia Clinic', 'Hasta Deneyimi Story', 'Instagram', 'Hikâye', 8, 7, 'Başlanmadı', 'Düşük', 'e', null),
  ('Gelinay', 'Gelinlik Koleksiyonu Reels', 'Instagram', 'Reels', -2, -3, 'Onaylandı', 'Orta', 'e', null),
  ('Gelinay', 'Ürün Çekimi Story', 'Instagram', 'Hikâye', 1, 0, 'Çalışılıyor', 'Orta', 'e', '13:00'),
  ('Gelinay', 'Prova Günü Deneyimi Post', 'Instagram', 'Gönderi', 5, 4, 'Başlanmadı', 'Orta', 'e', null),
  ('Gelinay', 'Sezon Kampanyası Reklamı', 'Meta Reklam', 'Reklam', 9, 8, 'Başlanmadı', 'Orta', 'm', null),
  ('Atlas Ajans', 'Ekim Performans Raporu', 'LinkedIn', 'Rapor', 0, 0, 'Yönetici Onayı', 'Yüksek', 'm', '12:00'),
  ('Atlas Ajans', 'Ajans LinkedIn Vaka Çalışması', 'LinkedIn', 'Karusel', 4, 3, 'Çalışılıyor', 'Orta', 'e', null),
  ('Atlas Ajans', 'Yeni Müşteri Sunum Şablonu', 'LinkedIn', 'Rapor', 6, 5, 'Başlanmadı', 'Orta', 'm', null);

-- marka | görev | yazan (e / m) | kaç saat önce | yorum
create temp table _demo_comments (brand text, title text, who text, hrs int, body text) on commit drop;
insert into _demo_comments values
  ('Tepe Emlak', 'Müşteri Referans Videosu', 'e', 26, 'Röportaj çekimi tamamlandı, kurgu ilk versiyon hazır.'),
  ('Tepe Emlak', 'Müşteri Referans Videosu', 'm', 20, 'Altyazıları büyütelim, kapanışta logo 2 saniye kalsın.'),
  ('Tepe Emlak', 'Müşteri Referans Videosu', 'e', 4, 'Düzeltmeler yapıldı, müşteri onayına gönderildi.'),
  ('Tepe Emlak', 'Kira Artış Bedeli Bilgilendirme', 'e', 3, 'Ekim oranı TÜİK verisiyle güncellendi, kontrolünüze sunuyorum.'),
  ('Tepe Emlak', 'Davetiye Post', 'm', 30, 'Müşteri tarih ve saat bilgisinin daha görünür olmasını istedi.'),
  ('Tepe Emlak', 'Davetiye Post', 'e', 6, 'Revize üzerinde çalışıyorum, yarın sabah hazır olur.'),
  ('Tepe Emlak', 'Yeni Portföy Tanıtımı', 'm', 50, 'Fotoğraflar Drive''a yüklendi, 6 karelik karusel olsun.'),
  ('Tepe Emlak', 'Yeni Portföy Tanıtımı', 'e', 8, 'Fiyat bilgileri gelmedi, müşteriden teyit bekliyorum.'),
  ('Tepe Emlak', 'Ödül Töreni Reels', 'm', 12, 'Tören görüntüleri gelince hemen başlayalım, 18 Ekim''de yayında olmalı.'),
  ('Sofra Pide', 'Öğle Menüsü Story Serisi', 'e', 5, 'Üç karelik seri hazır, fiyatlar menüyle aynı.'),
  ('Sofra Pide', 'Öğle Menüsü Story Serisi', 'm', 2, 'İkinci karede yazı biraz küçük kalmış, bakar mısın?'),
  ('Sofra Pide', 'Şefin Önerisi Reels', 'e', 22, 'Müzik lisanslı kütüphaneden seçildi.'),
  ('Sofra Pide', 'Hafta Sonu Kampanyası', 'm', 28, 'İndirim oranı %20 olarak kesinleşti.'),
  ('Sofra Pide', 'Hafta Sonu Rezervasyon Reklamı', 'm', 9, 'Bütçe günlük 750 TL, hedef kitle Konyaaltı 5 km.'),
  ('Mavitur TR/ENG', 'Antalya Turları Reels', 'e', 7, 'TR versiyon hazır, ENG altyazı Zeynep''te.'),
  ('Mavitur TR/ENG', 'Antalya Turları Reels', 'm', 3, 'Kapakta tur fiyatı görünmesin, sadece "Antalya Turları" yazsın.'),
  ('Mavitur TR/ENG', 'İngilizce Tur Tanıtımı (ENG Reels)', 'm', 15, 'Müşteri seslendirmenin daha yavaş olmasını istedi.'),
  ('Mavitur TR/ENG', 'P02 | Ekim''de Sen Nasıl Bir Tatilcisin?', 'm', 40, 'Müşteri onayladı, planlanan saatte yayına alınacak.'),
  ('3 Kartal Perde', 'Stor Perde Kampanya Post', 'e', 10, 'Kampanya görseli ve metni hazır, müşteriye gönderildi.'),
  ('3 Kartal Perde', 'Ölçü Alma Rehberi Karusel', 'm', 60, 'Showroom''dan ölçü fotoğrafları bekleniyor.'),
  ('3 Kartal Perde', 'Ölçü Alma Rehberi Karusel', 'e', 20, 'Fotoğraflar hâlâ gelmedi, bugün tekrar arayacağım.'),
  ('Edva', 'Sonbahar Tablo Koleksiyonu', 'e', 11, 'Tablo fotoğrafları renk düzeltmesinden geçti.'),
  ('Edva', 'Ekim Etkinlik Programı', 'e', 4, 'Etkinlik tarihleri atölyeyle teyit edildi.'),
  ('Gürel Altyapı', 'Proje Tanıtım Reels', 'e', 6, 'Drone çekimleri eklendi, süre 28 saniye.'),
  ('Gürel Altyapı', 'Proje Web Sayfası Güncellemesi', 'm', 18, 'Daire planları PDF''leri yeni versiyonla değiştirilecek.'),
  ('Velia Clinic', 'Sık Sorulan Sorular Karuseli', 'e', 9, 'Sorular klinik müdürüyle netleşti, tasarıma başladım.'),
  ('Gelinay', 'Gelinlik Koleksiyonu Reels', 'm', 35, 'Müşteri çok beğendi, onaylandı.'),
  ('Atlas Ajans', 'Ekim Performans Raporu', 'm', 5, 'Tüm markaların erişim ve etkileşim verileri eklendi.');

do $$
declare
  v_emp uuid; v_m uuid;
begin
  select id into v_emp from public.profiles where lower(email) = 'calisan@example.com' and active;
  select id into v_m from public.profiles where lower(email) = 'yonetici@example.com' and active;
  if v_m is null then select id into v_m from public.profiles where role = 'admin' and active order by created_at limit 1; end if;
  if v_m is null then raise exception 'Aktif yönetici bulunamadı.'; end if;
  v_emp := coalesce(v_emp, v_m);

  if not exists (select 1 from public.brands where lower(name) = 'atlas ajans') then
    insert into public.brands (name, initials, sector, color) values ('Atlas Ajans', 'AA', 'Ajans İçi', 'orange');
  end if;

  -- Çalışan atandığı markaların işlerini görebilsin.
  insert into public.brand_members (brand_id, user_id)
  select b.id, v_emp from public.brands b
  where lower(b.name) in (select lower(brand) from _demo_tasks)
  on conflict do nothing;

  insert into public.tasks (brand_id, title, platform, format, assignee_id, status, priority, publish_date, due_date, due_time, description)
  select b.id, d.title, d.platform, d.format, case d.who when 'm' then v_m else v_emp end, d.status, d.priority,
         current_date + d.pub, current_date + d.due, d.tm::time,
         '<!--cw-demo--><p><strong>Brief:</strong> ' || d.title || ' için ' || lower(d.format) || ' içeriği hazırlanacak.</p>'
         || '<ul><li>Marka kılavuzundaki renk ve tipografi kullanılacak.</li><li>' || d.platform
         || ' ölçüleri ve güvenli alanlar kontrol edilecek.</li><li>Yayın öncesi metin ve görsel son kontrolden geçecek.</li></ul>'
  from _demo_tasks d join public.brands b on lower(b.name) = lower(d.brand)
  where not exists (select 1 from public.tasks t where t.brand_id = b.id and t.title = d.title and t.description like '<!--cw-demo-->%');

  insert into public.comments (task_id, user_id, body, created_at)
  select t.id, case c.who when 'm' then v_m else v_emp end, c.body, now() - make_interval(hours => c.hrs)
  from _demo_comments c
  join public.brands b on lower(b.name) = lower(c.brand)
  join public.tasks t on t.brand_id = b.id and t.title = c.title and t.description like '<!--cw-demo-->%'
  where not exists (select 1 from public.comments x where x.task_id = t.id and x.body = c.body);

  -- Onaya gönderilmiş / biten demo işlerde kontrol listesi tamamlanmış görünür; üzerinde çalışılanlarda kısmen.
  update public.task_checklist_items i
  set is_completed = true, completed_by = t.assignee_id, completed_at = now() - interval '1 day'
  from public.tasks t
  where i.task_id = t.id and t.description like '<!--cw-demo-->%' and not i.is_completed
    and (t.status in ('Yönetici Onayı', 'Müşteri Onayı', 'Onaylandı', 'Tamamlandı')
         or (t.status in ('Çalışılıyor', 'Revizyon') and i.sort_order < 3));
end $$;

commit;

-- Doğrulama
select 'Demo görev' as kontrol, count(*)::text as sonuc from public.tasks where description like '<!--cw-demo-->%'
union all select 'Demo yorum', count(*)::text from public.comments c join public.tasks t on t.id = c.task_id where t.description like '<!--cw-demo-->%'
union all select 'Marka sayısı', count(*)::text from public.brands
union all select 'Bugün teslim', count(*)::text from public.tasks where due_date = current_date
union all select 'Geciken açık iş', count(*)::text from public.tasks where due_date < current_date and status not in ('Tamamlandı', 'Onaylandı')
union all select 'Yönetici onayında', count(*)::text from public.tasks where status = 'Yönetici Onayı'
union all select 'Müşteri onayında', count(*)::text from public.tasks where status = 'Müşteri Onayı'
union all select 'Çalışanın marka üyeliği', (select count(*) from public.brand_members m join public.profiles p on p.id = m.user_id where lower(p.email) = 'calisan@example.com')::text;


-- ───────────────────────── TEMİZLİK (gerekirse) ─────────────────────────
-- Demo görevleri (yorumları ve kontrol listeleriyle birlikte) kaldırmak için yorumu açıp çalıştırın:
-- delete from public.tasks where description like '<!--cw-demo-->%';
