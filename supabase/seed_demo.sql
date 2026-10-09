-- Demo içerikleri — müşteri sunumu için örnek marka + 6 içerik görevi
-- Supabase Dashboard → SQL Editor'da çalıştırın (schema.sql, 002 ve 003'ten sonra).
--
-- Oluşturulanlar:
--   • "Lumière Kafe" demo markası (yoksa)
--   • 6 görev: 2 × Müşteri Onayı, 2 × Revizyon, 2 × Onaylandı
--   • Her göreve kapak görseli (attachments.thumbnail_url → müşteri portalındaki kart görseli)
--   • Revizyon / Onaylandı görevleri için onay geçmişi (approvals) — revize notları portalda görünür
--   • Sistemde müşteri rolünde bir kullanıcı varsa, demo markasına üye yapılır (portalda içerikleri görsün diye)
--
-- Tarihler bugüne göre hesaplanır; script her çalıştırıldığında yeni bir set ekler.
-- Temizlemek için dosyanın sonundaki bloğu kullanın.

do $$
declare
  v_brand    uuid;
  v_admin    uuid;
  v_worker   uuid;
  v_client   uuid;
  v_task     uuid;
  img        constant text := 'https://images.unsplash.com/photo-';
  drive      constant text := 'https://drive.google.com/drive/folders/demo-lumiere-kafe';
begin
  select id into v_admin from public.profiles where role = 'admin' and active order by created_at limit 1;
  if v_admin is null then
    raise exception 'Aktif admin profili bulunamadı — önce 003_roles.sql çalıştırılmalı.';
  end if;
  select id into v_worker from public.profiles where role = 'employee' and active order by created_at limit 1;
  v_worker := coalesce(v_worker, v_admin);
  select id into v_client from public.profiles where role = 'client' and active order by created_at limit 1;

  select id into v_brand from public.brands where lower(name) = lower('Lumière Kafe');
  if v_brand is null then
    insert into public.brands (name, initials, sector, color)
    values ('Lumière Kafe', 'LK', 'Kafe & Restoran', 'amber')
    returning id into v_brand;
  end if;

  if v_client is not null then
    insert into public.brand_members (brand_id, user_id) values (v_brand, v_client) on conflict do nothing;
  end if;

  -- 1) Müşteri Onayı — Instagram Reels
  insert into public.tasks (brand_id, title, platform, format, assignee_id, status, priority, publish_date, due_date, description)
  values (v_brand, 'Sonbahar Menüsü Lansman Reels', 'Instagram', 'Reels', v_worker, 'Müşteri Onayı', 'Yüksek',
          current_date + 3, current_date + 1,
          '<p><strong>Kapak metni:</strong> Sonbahar geldi, fincanlar ısındı ☕🍂</p>'
          || '<p>Yeni sezon menümüzde balkabaklı latte, tarçınlı elmalı turta ve fındıklı mocha sizi bekliyor. '
          || 'Bu hafta sonu tüm sonbahar içeceklerinde %15 indirim!</p>'
          || '<p><em>#LumièreKafe #SonbaharMenüsü #KahveKeyfi #PumpkinSpice</em></p>'
          || '<p>Müzik: lisanssız akustik, 15 sn. Altyazılar açık.</p>')
  returning id into v_task;
  insert into public.attachments (task_id, name, type, size_label, thumbnail_url, drive_url, added_by)
  values (v_task, 'sonbahar-reels-kapak.jpg', 'Görsel', '2,4 MB', img || '1495474472287-4d71bcdd2085?w=1200&q=80', drive, v_worker);

  -- 2) Müşteri Onayı — Instagram Karusel
  insert into public.tasks (brand_id, title, platform, format, assignee_id, status, priority, publish_date, due_date, description)
  values (v_brand, 'Kahve Çekirdeği Rehberi — 5 Slayt', 'Instagram', 'Karusel', v_worker, 'Müşteri Onayı', 'Orta',
          current_date + 5, current_date + 2,
          '<p><strong>Slayt 1:</strong> Hangi çekirdek size göre?</p>'
          || '<ul><li>Etiyopya — çiçeksi ve meyvemsi</li><li>Kolombiya — dengeli, karamel notalı</li>'
          || '<li>Brezilya — fındık ve çikolata</li><li>Guatemala — baharatlı, gövdeli</li></ul>'
          || '<p>Son slayt: “Favorinizi yorumlarda yazın, haftanın kahvesi sizden olsun!”</p>'
          || '<p><em>#KahveRehberi #SpecialtyCoffee #LumièreKafe</em></p>')
  returning id into v_task;
  insert into public.attachments (task_id, name, type, size_label, thumbnail_url, drive_url, added_by)
  values (v_task, 'cekirdek-rehberi-slayt1.jpg', 'Görsel', '1,8 MB', img || '1442512595331-e89e73853f31?w=1200&q=80', drive, v_worker);

  -- 3) Revizyon — Instagram Gönderi
  insert into public.tasks (brand_id, title, platform, format, assignee_id, status, priority, publish_date, due_date, description)
  values (v_brand, 'Hafta Sonu Brunch Duyurusu', 'Instagram', 'Gönderi', v_worker, 'Revizyon', 'Yüksek',
          current_date + 2, current_date,
          '<p>Cumartesi ve pazar 09:00–14:00 arası sınırsız çay eşliğinde serpme brunch! 🥐🍳</p>'
          || '<p>Rezervasyon için profildeki bağlantıya tıklayın.</p>'
          || '<p><em>#Brunch #HaftaSonu #LumièreKafe</em></p>')
  returning id into v_task;
  insert into public.attachments (task_id, name, type, size_label, thumbnail_url, drive_url, added_by)
  values (v_task, 'brunch-post-v1.jpg', 'Görsel', '2,1 MB', img || '1517248135467-4c7edcad34c4?w=1200&q=80', drive, v_worker);
  insert into public.approvals (task_id, user_id, decision, note, created_at)
  values (v_task, coalesce(v_client, v_admin), 'revision',
          'Fiyat bilgisi eksik, kişi başı 650 TL eklenmeli. Görselde masa daha dolu görünmeli; mümkünse menemen ve simit tabağı öne alınsın.',
          now() - interval '5 hours');

  -- 4) Revizyon — TikTok Video
  insert into public.tasks (brand_id, title, platform, format, assignee_id, status, priority, publish_date, due_date, description)
  values (v_brand, 'Barista ile 30 Saniyede Latte Art', 'TikTok', 'Video', v_worker, 'Revizyon', 'Orta',
          current_date + 6, current_date + 3,
          '<p>Baristamız Ece, 30 saniyede kuğu desenli latte art yapıyor. Hızlandırılmış çekim + yakın plan bitiş.</p>'
          || '<p>Açılış metni: “Bunu deneyen var mı? 👀”</p>'
          || '<p><em>#LatteArt #Barista #CoffeeTok</em></p>')
  returning id into v_task;
  insert into public.attachments (task_id, name, type, size_label, thumbnail_url, drive_url, added_by)
  values (v_task, 'latte-art-onizleme.jpg', 'Görsel', '1,2 MB', img || '1511920170033-f8396924c348?w=1200&q=80', drive, v_worker);
  insert into public.approvals (task_id, user_id, decision, note, created_at)
  values (v_task, coalesce(v_client, v_admin), 'revision',
          'Müzik çok hızlı, daha sakin bir parça tercih ederiz. Videonun sonuna logo ve adres kartı eklenebilir mi?',
          now() - interval '1 day');

  -- 5) Onaylandı — Instagram Hikâye
  insert into public.tasks (brand_id, title, platform, format, assignee_id, status, priority, publish_date, due_date, description)
  values (v_brand, 'Günün Kahvesi Anketi', 'Instagram', 'Hikâye', v_worker, 'Onaylandı', 'Düşük',
          current_date + 1, current_date - 1,
          '<p>Anket çıkartması: “Bugün hangisi? ☕ Filtre mi, Latte mi?”</p>'
          || '<p>Sonuçlar akşam hikâyede paylaşılacak; kazanan içecekte ertesi gün %10 indirim.</p>')
  returning id into v_task;
  insert into public.attachments (task_id, name, type, size_label, thumbnail_url, drive_url, added_by)
  values (v_task, 'gunun-kahvesi-story.jpg', 'Görsel', '980 KB', img || '1509042239860-f550ce710b93?w=1200&q=80', drive, v_worker);
  insert into public.approvals (task_id, user_id, decision, note, created_at)
  values (v_task, coalesce(v_client, v_admin), 'approved', 'Harika olmuş, yayına alabilirsiniz.', now() - interval '3 hours');

  -- 6) Onaylandı — Instagram Gönderi (revizyon sonrası onaylanmış: geçmişte iki kayıt)
  insert into public.tasks (brand_id, title, platform, format, assignee_id, status, priority, publish_date, due_date, description)
  values (v_brand, 'Yeni Şubemiz Moda''da Açıldı', 'Instagram', 'Gönderi', v_worker, 'Onaylandı', 'Yüksek',
          current_date + 4, current_date + 1,
          '<p>Lumière Kafe artık Moda''da! 🎉 Açılışa özel ilk hafta tüm kahvelerde 1 alana 1 bedava.</p>'
          || '<p>📍 Moda Cad. No: 42, Kadıköy · Her gün 08:00–23:00</p>'
          || '<p><em>#LumièreKafe #Moda #Kadıköy #YeniŞube</em></p>')
  returning id into v_task;
  insert into public.attachments (task_id, name, type, size_label, thumbnail_url, drive_url, added_by)
  values (v_task, 'moda-sube-acilis.jpg', 'Görsel', '2,7 MB', img || '1501339847302-ac426a4a7cbb?w=1200&q=80', drive, v_worker);
  insert into public.approvals (task_id, user_id, decision, note, created_at)
  values (v_task, coalesce(v_client, v_admin), 'revision', 'Adres satırına çalışma saatlerini de ekleyelim lütfen.', now() - interval '2 days');
  insert into public.approvals (task_id, user_id, decision, note, created_at)
  values (v_task, coalesce(v_client, v_admin), 'approved', '', now() - interval '1 day');

  raise notice 'Demo içerikleri eklendi (marka: %).', v_brand;
end $$;


-- ───────────────────────── Temizlik ─────────────────────────
-- Demo verilerini kaldırmak için aşağıdaki satırların yorumunu açıp çalıştırın.
-- (Görevler silinince ekleri ve onay kayıtları cascade ile gider.)
--
-- delete from public.tasks  where brand_id = (select id from public.brands where lower(name) = lower('Lumière Kafe'));
-- delete from public.brands where lower(name) = lower('Lumière Kafe');
