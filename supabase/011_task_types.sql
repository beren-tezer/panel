-- 011_task_types.sql — Yeni görev türleri: "Sosyal Medya", "Reklam İşleri", "Dijital Pazarlama".
--
-- Görev ekleme formu artık bu üç türü gönderir; platform yalnızca "Sosyal Medya" görevlerinde seçilir, diğerlerinde boş kalır.
-- Bu dosya YENİ PANEL DERLEMESİ YÜKLENMEDEN ÖNCE çalıştırılmalıdır (aksi halde veritabanı yeni türleri reddeder ve eklenen
-- görev kaydedilemez). Yalnızca kuralları genişletir: eski türler ve mevcut görevler aynen kalır, eski panel de çalışmaya devam eder.
--
--   1. tasks.format kuralı: eski değerler + 3 yeni tür
--   2. tasks.platform: boş bırakılabilir (doluysa yine yalnızca listedeki platformlar)
--   3. Kontrol listesi şablonları: yeni türler de seçilebilir; mevcut şablonlar eşdeğer yeni türleri de kapsar
--      (sosyal medya türü olan → "Sosyal Medya", Reklam → "Reklam İşleri", Web veya Reklam → "Dijital Pazarlama")
--
-- Tekrar çalıştırmak güvenlidir. Sonda doğrulama sonucu tek satır döner.

begin;

alter table public.tasks drop constraint if exists tasks_format_check;
alter table public.tasks add constraint tasks_format_check check (format in (
  'Reels', 'Gönderi', 'Hikâye', 'Karusel', 'Video', 'Web', 'Reklam', 'Rapor',
  'Sosyal Medya', 'Reklam İşleri', 'Dijital Pazarlama'));

alter table public.tasks alter column platform drop not null;

alter table public.brand_checklist_templates drop constraint if exists brand_checklist_templates_task_types_check;
alter table public.brand_checklist_templates add constraint brand_checklist_templates_task_types_check check (task_types <@ array[
  'Reels', 'Gönderi', 'Hikâye', 'Karusel', 'Video', 'Web', 'Reklam', 'Rapor',
  'Sosyal Medya', 'Reklam İşleri', 'Dijital Pazarlama']);

-- Boş task_types (= tüm türler) olan şablonlara dokunulmaz.
update public.brand_checklist_templates t set task_types = t.task_types || array['Sosyal Medya']
 where cardinality(t.task_types) > 0 and t.task_types && array['Reels', 'Gönderi', 'Hikâye', 'Karusel', 'Video'] and not ('Sosyal Medya' = any (t.task_types));
update public.brand_checklist_templates t set task_types = t.task_types || array['Reklam İşleri']
 where cardinality(t.task_types) > 0 and 'Reklam' = any (t.task_types) and not ('Reklam İşleri' = any (t.task_types));
update public.brand_checklist_templates t set task_types = t.task_types || array['Dijital Pazarlama']
 where cardinality(t.task_types) > 0 and t.task_types && array['Web', 'Reklam'] and not ('Dijital Pazarlama' = any (t.task_types));

commit;

-- Doğrulama: üç sütun da true olmalı.
select
  pg_get_constraintdef(c.oid) like '%Dijital Pazarlama%'                                         as gorev_turu_kurali_guncel,
  (select is_nullable = 'YES' from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'platform')          as platform_bos_birakilabilir,
  not exists (select 1 from public.brand_checklist_templates
    where cardinality(task_types) > 0 and task_types && array['Reels', 'Gönderi', 'Hikâye', 'Karusel', 'Video']
      and not ('Sosyal Medya' = any (task_types)))                                                 as sablonlar_guncel
from pg_constraint c
where c.conrelid = 'public.tasks'::regclass and c.conname = 'tasks_format_check';

-- Geri almak gerekirse (yeni türde görev yoksa): tasks_format_check'i eski 8 değerle yeniden kurun ve
-- "alter table public.tasks alter column platform set not null;" çalıştırın.
