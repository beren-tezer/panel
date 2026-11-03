# AgencyOS demo veri seti → supabase/demo_mvp.sql üretir.
import sys

OUT = sys.argv[1]
q = lambda s: "'" + s.replace("'", "''") + "'"

TEAM = [  # kod, ad, unvan, renk, e-posta
    ("a", "Ayşe Demir", "Tasarım Uzmanı", "violet", "ayse.demir@demo.example.com"),
    ("b", "Burak Yılmaz", "Video Editörü", "sky", "burak.yilmaz@demo.example.com"),
    ("c", "Can Şahin", "Web Geliştirici", "emerald", "can.sahin@demo.example.com"),
    ("s", "Selin Arslan", "İçerik Yazarı", "rose", "selin.arslan@demo.example.com"),
    ("z", "Zeynep Kaya", "Sosyal Medya Uzmanı (TR/ENG)", "amber", "zeynep.kaya@demo.example.com"),
]

BRANDS = [  # ad, kısaltma, sektör, renk, görsel teması
    ("Tepe Emlak", "TE", "Gayrimenkul", "sky", "home"),
    ("Sofra Pide", "SP", "Restoran & Yemek", "red", "food"),
    ("Mavitur TR/ENG", "MV", "Turizm & Turlar", "indigo", "travel"),
    ("3 Kartal Perde", "3K", "Ev Dekorasyon", "amber", "decor"),
    ("Edva", "ED", "Sanat & Atölye", "emerald", "art"),
    ("Gürel Altyapı", "GA", "İnşaat", "violet", "build"),
    ("Velia Clinic", "VC", "Sağlık & Estetik", "rose", "care"),
    ("Gelinay", "GE", "Gelinlik & Moda", "orange", "wedding"),
    ("Mira Business", "MB", "Kurumsal Danışmanlık", "indigo", "office"),
    ("Şahin Yalı", "ŞY", "Kafe & Restoran", "sky", "food"),
    ("SDM", "SD", "Kurumsal Hizmetler", "emerald", "office"),
    ("AEK", "AE", "Sağlık Eğitimi", "red", "care"),
    ("Atlas Ajans", "AA", "Ajans İçi", "orange", "office"),
]

IMG = {  # doğrulanmış (HTTP 200) Unsplash görselleri
    "home": ["1560518883-ce09059eeffa", "1512917774080-9991f1c4c750", "1600596542815-ffad4c1539a9", "1564013799919-ab600027ffc6"],
    "food": ["1565299624946-b28f40a0ae38", "1551183053-bf91a1d81141", "1473093295043-cdd812d0e601", "1509042239860-f550ce710b93", "1501339847302-ac426a4a7cbb"],
    "travel": ["1507525428034-b723cf961d3e", "1500530855697-b586d89ba3ee", "1519046904884-53103b34b206"],
    "decor": ["1505693416388-ac5ce068fe85", "1513694203232-719a280e022f", "1522708323590-d24dbb6b0267"],
    "art": ["1460661419201-fd4cecdf8a8b", "1541961017774-22349e4a1262"],
    "build": ["1503387762-592deb58ef4e", "1541888946425-d81bb19240f5", "1497366216548-37526070297c"],
    "care": ["1570172619644-dfd03ed5d881", "1616394584738-fc6e612e71b9"],
    "wedding": ["1519741497674-611481863552", "1594552072238-b8a33785b261"],
    "office": ["1460925895917-afdab827c52f", "1552664730-d307ca884978", "1497366216548-37526070297c"],
}

R, G, H, K, V, W, AD, RP = "Reels", "Gönderi", "Hikâye", "Karusel", "Video", "Web", "Reklam", "Rapor"
IG, FB, LI, YT, WEB, META, GADS = "Instagram", "Facebook", "LinkedIn", "YouTube", "Web Sitesi", "Meta Reklam", "Google Reklam"

TASKS = {  # marka: [(başlık, platform, format, sorumlu)]
    "Tepe Emlak": [
        ("Antalya Konut Piyasası Reels", IG, R, "b"), ("Ekim Kira Artış Oranı Post", IG, G, "a"), ("Etkinlik Story", IG, H, "s"),
        ("Yeni Portföy Tanıtımı", IG, K, "e"), ("Müşteri Referans Videosu", IG, R, "b"), ("Kira Artış Bedeli Bilgilendirme", IG, G, "e"),
        ("Davetiye Post", IG, G, "e"), ("Ödül Töreni Reels", IG, R, "e"), ("Gujan Bey Röportaj Reels", IG, R, "b"),
        ("Lüks Villa Portföyü Karusel", IG, K, "e"), ("Konut Kredisi Rehberi Post", FB, G, "s"), ("Haftalık Portföy Story", IG, H, "e"),
        ("Konyaaltı Daire Turu Reels", IG, R, "e"), ("Portföy Sayfası Güncellemesi", WEB, W, "c"),
    ],
    "Sofra Pide": [
        ("Yeni Menü Tanıtımı", IG, K, "a"), ("Mutfak Arkası Reels", IG, R, "b"), ("Hafta Sonu Kampanyası", IG, G, "e"),
        ("Öğle Menüsü Story Serisi", IG, H, "s"), ("Şefin Önerisi Reels", IG, R, "e"), ("Hafta Sonu Rezervasyon Reklamı", META, AD, "m"),
        ("Google Arama Reklamları Kontrolü", GADS, AD, "m"), ("Makarna Çeşitleri Karuseli", IG, K, "e"), ("Doğum Günü Menüsü Post", FB, G, "s"),
        ("Tiramisu Hazırlanışı Reels", IG, R, "b"), ("Müşteri Yorumları Story", IG, H, "e"), ("Sonbahar Menüsü Lansmanı", IG, K, "a"),
    ],
    "Mavitur TR/ENG": [
        ("P01 | Antalya ve Çevresindeki Turlar Tek Bir Yerde", IG, G, "a"), ("Ali Part 1 Reels", IG, R, "b"), ("Ali Part 2 Reels", IG, R, "b"),
        ("P02 | Ekim'de Sen Nasıl Bir Tatilcisin?", IG, G, "z"), ("Ali Part 3 Reels", IG, R, "b"), ("P03 | Tur Seçmeden Önce Bu 5 Detaya Bak", IG, K, "a"),
        ("Antalya Turları Reels", IG, R, "e"), ("İngilizce Tur Tanıtımı (ENG Reels)", IG, R, "z"), ("P04 | Tatil Zamanın Değerli", IG, G, "z"),
        ("Suadada Tekne Turu Reels", IG, R, "b"), ("P05 | Turdan Önce Güvene İhtiyacın Var", IG, G, "a"), ("Tatil Fırsatları Story (TR/ENG)", IG, H, "z"),
    ],
    "3 Kartal Perde": [
        ("Kış Koleksiyonu Tanıtımı", IG, R, "b"), ("Ölçü Alma Rehberi Karusel", IG, K, "a"), ("Stor Perde Kampanya Post", IG, G, "e"),
        ("Showroom Story", IG, H, "s"), ("Katalog PDF İndirme Sayfası", WEB, W, "c"), ("Müşteri Evinden Uygulama Reels", IG, R, "b"),
        ("Tül Perde Çeşitleri Karusel", IG, K, "a"), ("Ücretsiz Keşif Duyurusu", IG, G, "e"), ("Kumaş Seçim Rehberi Story", IG, H, "s"),
    ],
    "Edva": [
        ("Seramik Atölyesi Tanıtımı", IG, R, "b"), ("Sonbahar Tablo Koleksiyonu", IG, K, "a"), ("Ekim Etkinlik Programı", IG, G, "s"),
        ("Çocuk Resim Atölyesi Duyurusu", IG, H, "e"), ("Sanatçı Röportajı Videosu", YT, V, "b"), ("Atölye Kayıt Formu Sayfası", WEB, W, "c"),
        ("Öğrenci Eserleri Karusel", IG, K, "a"), ("Ebru Sanatı Reels", IG, R, "e"),
    ],
    "Gürel Altyapı": [
        ("Şantiye İlerleme Videosu", IG, R, "b"), ("Proje Tanıtım Reels", IG, R, "e"), ("Satış Ofisi Açılış Post", LI, G, "s"),
        ("Daire Planları Karuseli", IG, K, "a"), ("Proje Web Sayfası Güncellemesi", WEB, W, "c"), ("Drone Çekimi Story", IG, H, "b"),
        ("Teslim Tarihi Duyurusu", IG, G, "e"), ("Sosyal Alanlar Tanıtımı", IG, K, "a"),
    ],
    "Velia Clinic": [
        ("Cilt Bakımı Reels", IG, R, "b"), ("Sık Sorulan Sorular Karuseli", IG, K, "a"), ("Randevu Kampanyası Reklamı", META, AD, "m"),
        ("Uzman Görüşü Videosu", YT, V, "b"), ("Hasta Deneyimi Story", IG, H, "s"), ("Lazer Epilasyon Bilgilendirme", IG, G, "e"),
        ("Önce-Sonra Karusel", IG, K, "a"), ("Google Randevu Reklamları", GADS, AD, "m"),
    ],
    "Gelinay": [
        ("Gelinlik Koleksiyonu Reels", IG, R, "b"), ("Ürün Çekimi Story", IG, H, "e"), ("Prova Günü Deneyimi Post", IG, G, "s"),
        ("Sezon Kampanyası Reklamı", META, AD, "m"), ("Nişanlık Koleksiyonu Karusel", IG, K, "a"), ("Gelin Hikâyeleri Reels", IG, R, "e"),
        ("Randevu Sayfası Güncellemesi", WEB, W, "c"),
    ],
    "Mira Business": [
        ("Kurumsal Danışmanlık Tanıtımı", LI, K, "a"), ("CEO Röportajı Videosu", LI, V, "b"), ("Haftalık Sektör Bülteni", LI, G, "s"),
        ("Eğitim Programı Duyurusu", LI, G, "e"), ("Referans Projeler Karusel", LI, K, "a"), ("LinkedIn Reklam Kampanyası", LI, AD, "m"),
    ],
    "Şahin Yalı": [
        ("Kahvaltı Menüsü Reels", IG, R, "b"), ("Deniz Manzaralı Masa Rezervasyonu", IG, G, "e"), ("Canlı Müzik Akşamı Story", IG, H, "s"),
        ("Brunch Karusel", IG, K, "a"), ("Şahin Yalı Bölge Tanıtım Reels", IG, R, "e"), ("Hafta Sonu Rezervasyon Reklamı", META, AD, "m"),
    ],
    "SDM": [
        ("Hizmet Tanıtım Post", LI, G, "a"), ("Ekip Tanıtımı Karusel", LI, K, "a"), ("Kurumsal Tanıtım Videosu", YT, V, "b"),
        ("Hizmetler Sayfası Yenileme", WEB, W, "c"), ("Müşteri Başarı Hikâyesi", LI, G, "s"),
    ],
    "AEK": [
        ("Kalp Sağlığı Bilgilendirme Post", IG, G, "a"), ("İlk Yardım Eğitimi Duyurusu", IG, G, "e"), ("Cihaz Kullanım Videosu", YT, V, "b"),
        ("Eğitim Takvimi Story", IG, H, "s"), ("Sertifika Programı Karusel", IG, K, "a"),
    ],
    "Atlas Ajans": [
        ("Ekim Performans Raporu", LI, RP, "m"), ("Ajans LinkedIn Vaka Çalışması", LI, K, "s"), ("Yeni Müşteri Sunum Şablonu", LI, RP, "m"),
        ("Ajans Web Sitesi Portfolyo Güncellemesi", WEB, W, "c"), ("Ekip Tanıtım Reels", IG, R, "b"), ("Aylık İçerik Planlama Notları", LI, RP, "e"),
    ],
}

# Bilinçli olarak geciken işler (kırmızı / "Geciken & Acil" grubu): başlık → (yayın günü, durum, öncelik)
OVERDUE = {
    "Yeni Portföy Tanıtımı": (-1, "Çalışılıyor", "Yüksek"),
    "Hafta Sonu Kampanyası": (-1, "Çalışılıyor", "Yüksek"),
    "Ölçü Alma Rehberi Karusel": (-2, "Başlanmadı", "Yüksek"),
    "Lazer Epilasyon Bilgilendirme": (-1, "Çalışılıyor", "Orta"),
}

def status_for(off, i):
    if off <= -2: return "Onaylandı" if i % 9 == 0 else "Tamamlandı"
    if off <= 2: return ["Müşteri Onayı", "Yönetici Onayı", "Onaylandı", "Yönetici Onayı", "Müşteri Onayı", "Çalışılıyor"][i % 6]
    if off <= 6: return ["Çalışılıyor", "Revizyon", "Yönetici Onayı", "Çalışılıyor", "Revizyon"][i % 5]
    if off <= 12: return ["Çalışılıyor", "Başlanmadı"][i % 2]
    return "Başlanmadı"

rows = []
i = 0
for bi, (brand, *_rest) in enumerate(BRANDS):
    items = TASKS[brand]
    n = len(items)
    for k, (title, platform, fmt, who) in enumerate(items):
        off = -10 + round(k * 26 / max(1, n - 1)) + (bi % 3) - 1
        st = status_for(off, i)
        prio = "Yüksek" if i % 4 == 0 else "Düşük" if i % 5 == 0 else "Orta"
        if title in OVERDUE:
            off, st, prio = OVERDUE[title]
            due = off - 1
        elif st in ("Tamamlandı", "Onaylandı"):
            due = off - 1
        else:
            due = max(off - 1, 0)  # açık işler (geciken olarak işaretlenenler hariç) bugünden önce teslim değil
        rows.append((brand, title, platform, fmt, off, due, st, prio, who))
        i += 1

def values(rs):
    return ",\n".join("  (" + ", ".join(q(v) if isinstance(v, str) else str(v) for v in r) + ")" for r in rs)

team_sql = values([(c, n, t, col, e) for c, n, t, col, e in TEAM])
brand_sql = values([(n, ini, sec, col, th) for n, ini, sec, col, th in BRANDS])
img_sql = values([(th, pid) for th, ids in IMG.items() for pid in ids])
task_sql = values(rows)

sql = f"""-- AgencyOS — MVP sunumu için zengin demo veri seti. Supabase Dashboard → SQL Editor'da TEK SEFERDE çalıştırın.
--
--   • 13 marka (Atlas Ajans + Google Docs planlarındaki 12 marka; var olan markaya dokunulmaz)
--   • 5 kişilik demo ekip (Ayşe, Burak, Can, Selin, Zeynep) — GİRİŞ YAPAMAZ (şifresiz + kalıcı engelli), yalnızca görevlerde görünür
--   • {len(rows)} görev: tarihler ÇALIŞTIRDIĞINIZ GÜNE göre (geçen iki hafta / bugün / önümüzdeki üç hafta), tüm durumlar, 4 geciken iş
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
{team_sql};

create temp table _brands (name text, initials text, sector text, color text, theme text) on commit drop;
insert into _brands values
{brand_sql};

create temp table _img (theme text, photo text) on commit drop;
insert into _img values
{img_sql};

-- marka | başlık | platform | format | yayın (gün) | teslim (gün) | durum | öncelik | sorumlu
create temp table _tasks (brand text, title text, platform text, format text, pub int, due int, status text, priority text, who text) on commit drop;
insert into _tasks values
{task_sql};

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
         '{{"provider":"email","providers":["email"]}}'::jsonb, jsonb_build_object('full_name', t.full_name),
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
"""
open(OUT, "w", encoding="utf-8", newline="\n").write(sql)
from collections import Counter
print(len(rows), "görev", Counter(r[6] for r in rows), "e:", sum(r[8] == "e" for r in rows), "due0:", sum(r[5] == 0 for r in rows), "late:", sum(r[5] < 0 and r[6] not in ("Tamamlandı", "Onaylandı") for r in rows))
