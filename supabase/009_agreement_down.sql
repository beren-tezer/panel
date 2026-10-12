-- 009 geri alma: sözleşme onayı sütunları, fonksiyonu ve tetikleyicisi kaldırılır (onay kayıtları silinir).
-- Önce sözleşme ekranı olmayan panel sürümüne dönün; yeni sürüm sütun yoksa onay ekranını göstermez.

begin;
drop trigger if exists profiles_agreement_guard on public.profiles;
drop function if exists public.profiles_agreement_guard();
drop function if exists public.accept_agreement(text);
alter table public.profiles
  drop column if exists agreement_accepted,
  drop column if exists agreement_accepted_at,
  drop column if exists agreement_version;
commit;
