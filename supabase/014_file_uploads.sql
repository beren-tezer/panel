-- 014_file_uploads.sql — Görev eklerine ve marka dosyalarına doğrudan dosya yükleme (Supabase Storage)
--
-- YENİ PANEL DERLEMESİ YÜKLENMEDEN ÖNCE çalıştırın (013'ten sonra). Veri silmez; mevcut Drive bağlantıları aynen çalışır.
--
--   1. attachments / assets: storage_path, mime_type, file_size sütunları. Kayıt ya geçerli bir Drive bağlantısı ya da
--      yüklenmiş bir dosya (storage_path) taşır; drive_url artık yüklenen dosyalarda boş olabilir.
--      Yol, kaydın sahibiyle eşleşmek zorundadır: ek → <görev id>/…, marka dosyası → <marka id>/…
--   2. Özel kovalar (herkese açık adres yok, en fazla 50 MB):
--        task-files  : görsel, video, PDF
--        brand-files : görsel, vektör, video, PDF, font, arşiv, Word / PowerPoint
--   3. Storage erişimi tablo kurallarıyla aynıdır:
--        (yükleyen kişi kendi yüklediğini her zaman görür: kaydı oluşturulamayan dosyayı geri alabilsin)
--        görev eki     → görebilen okur (müşteri "ekip içi" ekleri göremez); "İçerik düzenleme" izinli ekip, görebildiği göreve yükler / siler
--        marka dosyası → kaydı görebilen okur; admin veya markaya bağlı, "Marka dosyaları" izinli çalışan yükler; admin siler
--
-- Tekrar çalıştırmak güvenlidir. Sonda doğrulama satırı döner (hepsi true olmalı).

begin;

-- 1. Kayıt sütunları
alter table public.attachments add column if not exists storage_path text;
alter table public.attachments add column if not exists mime_type text;
alter table public.attachments add column if not exists file_size bigint;
alter table public.attachments alter column drive_url drop not null;
alter table public.attachments drop constraint if exists attachments_drive_url_check;
alter table public.attachments add constraint attachments_drive_url_check check (
  (drive_url is not null and drive_url ~ '^https://(drive|docs)\.google\.com/') or (drive_url is null and storage_path is not null));
alter table public.attachments drop constraint if exists attachments_storage_path_check;
alter table public.attachments add constraint attachments_storage_path_check check (
  storage_path is null or (split_part(storage_path, '/', 1) = task_id::text and storage_path !~ '\.\.'));
alter table public.attachments drop constraint if exists attachments_file_size_check;
alter table public.attachments add constraint attachments_file_size_check check (file_size is null or (file_size > 0 and file_size <= 52428800));
create unique index if not exists attachments_storage_path_key on public.attachments (storage_path) where storage_path is not null;

alter table public.assets add column if not exists storage_path text;
alter table public.assets add column if not exists mime_type text;
alter table public.assets add column if not exists file_size bigint;
alter table public.assets alter column drive_url drop not null;
alter table public.assets drop constraint if exists assets_drive_url_check;
alter table public.assets add constraint assets_drive_url_check check (
  (drive_url is not null and drive_url ~ '^https://(drive|docs)\.google\.com/') or (drive_url is null and storage_path is not null));
alter table public.assets drop constraint if exists assets_storage_path_check;
alter table public.assets add constraint assets_storage_path_check check (
  storage_path is null or (split_part(storage_path, '/', 1) = brand_id::text and storage_path !~ '\.\.'));
alter table public.assets drop constraint if exists assets_file_size_check;
alter table public.assets add constraint assets_file_size_check check (file_size is null or (file_size > 0 and file_size <= 52428800));
create unique index if not exists assets_storage_path_key on public.assets (storage_path) where storage_path is not null;

-- 2. Kovalar
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-files', 'task-files', false, 52428800, array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-files', 'brand-files', false, 52428800, array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf',
  'image/svg+xml', 'application/postscript', 'image/vnd.adobe.photoshop', 'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. Storage erişimi
-- Not: alt sorgularda dosya yolu "objects.name" olarak yazılır; çıplak "name" kayıt tablosunun dosya adı sütununa çözülür.
-- Yolun ilk bölümü (görev / marka kimliği); geçersizse boş.
create or replace function public.storage_owner_id(path text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end $$;

-- "attachments: ekip ekler / kaldırır" politikalarıyla aynı koşul. Çağıranın yetkisiyle çalışır: görev görünürlüğü RLS'ten gelir.
create or replace function public.file_can_attach(p_task uuid) returns boolean
language sql stable as $$
  select coalesce(public.my_role() in ('admin', 'employee'), false) and coalesce(public.has_perm('canEditContent'), false)
     and exists (select 1 from public.tasks t where t.id = p_task);
$$;

-- "assets: ekip ekler/günceller" politikasıyla aynı koşul.
create or replace function public.file_can_add_asset(p_brand uuid) returns boolean
language sql stable as $$
  select coalesce(public.is_admin(), false)
      or (public.my_role() = 'employee' and coalesce(public.has_brand(p_brand), false) and coalesce(public.has_perm('canViewBrandFiles'), false));
$$;

drop policy if exists "task-files: görünürlük" on storage.objects;
drop policy if exists "task-files: yükleme" on storage.objects;
drop policy if exists "task-files: silme" on storage.objects;
create policy "task-files: görünürlük" on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and (owner = auth.uid() or exists (select 1 from public.attachments a where a.storage_path = objects.name)));
create policy "task-files: yükleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files' and public.file_can_attach(public.storage_owner_id(name)));
create policy "task-files: silme" on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and public.file_can_attach(public.storage_owner_id(name)));

drop policy if exists "brand-files: görünürlük" on storage.objects;
drop policy if exists "brand-files: yükleme" on storage.objects;
drop policy if exists "brand-files: silme" on storage.objects;
create policy "brand-files: görünürlük" on storage.objects for select to authenticated
  using (bucket_id = 'brand-files' and (owner = auth.uid() or exists (select 1 from public.assets a where a.storage_path = objects.name)));
create policy "brand-files: yükleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-files' and public.file_can_add_asset(public.storage_owner_id(name)));
-- Silme: admin; yükleyen kişi de (kaydı oluşturulamayan dosyayı geri almak için) kendi yüklediğini silebilir.
create policy "brand-files: silme" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-files' and (coalesce(public.is_admin(), false) or owner = auth.uid()));

commit;

-- Doğrulama: hepsi true olmalı.
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'attachments' and column_name = 'storage_path') as ek_dosya_alani,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'assets' and column_name = 'storage_path')      as marka_dosya_alani,
  (select count(*) = 2 from storage.buckets where id in ('task-files', 'brand-files') and not public)                                              as ozel_kovalar,
  (select count(*) = 6 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like any (array['task-files:%', 'brand-files:%'])) as depo_kurallari;
