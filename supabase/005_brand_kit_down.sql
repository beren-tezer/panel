-- 005 geri alma — Marka Kılavuzu tablolarını, politikalarını ve fonksiyonlarını kaldırır.
-- DİKKAT: Kılavuz verileri (renk, font, talimat, dosya kayıtları, bağlantılar) kalıcı olarak silinir.
-- Mevcut markalar, görevler ve diğer tablolar etkilenmez.
--
-- Önce kovadaki dosyaları Dashboard → Storage → brand-assets üzerinden silin (Supabase, dosya içeriklerinin
-- SQL ile silinmesine izin vermez); ardından bu dosyayı çalıştırın.

begin;

alter publication supabase_realtime drop table
  public.brand_kits, public.brand_kit_colors, public.brand_kit_fonts, public.brand_kit_instructions, public.brand_kit_assets, public.brand_kit_links;

drop policy if exists "brand-assets: görünürlük" on storage.objects;
drop policy if exists "brand-assets: yükleme" on storage.objects;
drop policy if exists "brand-assets: silme" on storage.objects;

drop table if exists public.brand_kit_fonts;
drop table if exists public.brand_kit_colors;
drop table if exists public.brand_kit_instructions;
drop table if exists public.brand_kit_links;
drop table if exists public.brand_kit_assets;
drop table if exists public.brand_kits;

drop function if exists public.kit_touch_row();
drop function if exists public.kit_touch_parent();
drop function if exists public.kit_assets_guard();
drop function if exists public.kit_row_visible(uuid, text, boolean);
drop function if exists public.kit_can_edit(uuid);
drop function if exists public.kit_can_view(uuid);
drop function if exists public.kit_brand_from_path(text);

-- Kova boşsa kaldırılır (doluysa bu satır hata verir; yukarıdaki nota bakın).
delete from storage.buckets where id = 'brand-assets';

commit;
