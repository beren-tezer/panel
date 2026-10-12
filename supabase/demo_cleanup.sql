-- AgencyOS — demo_mvp.sql ile eklenen demo verilerini siler. Supabase Dashboard → SQL Editor'da TEK SEFERDE çalıştırın.
--
--   • "cw-demo" işaretli tüm demo görevler (ekleri, yorumları, geçmişi, kontrol listeleri, onayları, bildirimleriyle — cascade)
--   • 5 demo ekip hesabı (@demo.example.com)
--   • Demo seti için açılan 13 marka — YALNIZCA içinde başka (gerçek) görev kalmamışsa; üyelikleri ve marka kılavuzlarıyla birlikte
--
--   • Lumière Kafe test markası ve tüm görevleri
--
-- Dokunmaz: gerçek hesaplar (yöneticiler, calisan@ / musteri@example.com), demo dışı görevler.
-- Tekrar çalıştırmak zararsızdır.

begin;

delete from public.tasks where description like '<!--cw-demo-->%';

delete from auth.users where lower(email) like '%@demo.example.com';

delete from public.brands b
where lower(b.name) in (
    'tepe emlak', 'sofra pide', 'mavitur tr/eng', '3 kartal perde', 'edva', 'gürel altyapı', 'velia clinic',
    'gelinay', 'mira business', 'şahin yalı', 'sdm', 'aek', 'atlas ajans')
  and not exists (select 1 from public.tasks t where t.brand_id = b.id);

-- Lumière Kafe test markası (seed_demo.sql): görevleri ve marka (üyelikleri cascade ile gider).
delete from public.tasks where brand_id in (select id from public.brands where lower(name) = lower('Lumière Kafe'));
delete from public.brands where lower(name) = lower('Lumière Kafe');

commit;

-- Doğrulama (beklenen: ilk iki satır 0)
select 'Kalan demo görev' as kontrol, count(*)::text as sonuc from public.tasks where description like '<!--cw-demo-->%'
union all select 'Kalan demo hesap', count(*)::text from auth.users where lower(email) like '%@demo.example.com'
union all select 'Markalar', coalesce(string_agg(name, ', ' order by name), '—') from public.brands
union all select 'Toplam görev', count(*)::text from public.tasks
union all select 'Aktif kullanıcı', count(*)::text from public.profiles where active;
