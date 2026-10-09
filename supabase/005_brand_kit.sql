-- 005 — Marka Kılavuzu & Bilgi Bankası
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın (003 ve 004'ten sonra). Geri almak için: 005_brand_kit_down.sql
--
-- Mevcut tablolara dokunulmaz; yeni tablolar mevcut brands.id (uuid) anahtarına bağlanır.
-- Kurallar rbac.js'teki canViewBrandKit / canEditBrandKit / scopeBrandKit ile aynıdır:
--   Görüntüleme : admin → tümü; çalışan → üyesi olduğu veya görev aldığı marka;
--                 müşteri → üyesi olduğu marka + "Marka dosyalarına erişim" izni.
--   Düzenleme   : admin; çalışan yalnızca permissions dizisinde açıkça 'canEditBrandKit' varsa (varsayılan kapalı).
--   Görünürlük  : visibility = 'internal' kayıtlar (talimat, dosya, bağlantı) müşteriye hiç dönmez.
-- Dosyalar özel "brand-assets" kovasında, <marka id>/<dosya id>.<uzantı> yolunda tutulur; erişim süreli imzalı adresle.

begin;

-- ───────────────────────── Yetki yardımcıları ─────────────────────────

-- Görüntüleme. security invoker: tasks politikası uygulanır (çalışan yalnızca kendi görevlerini görür).
create or replace function public.kit_can_view(b uuid) returns boolean
language sql stable set search_path = public as $$
  select coalesce(public.is_admin(), false)
    or (public.my_role() = 'employee' and (public.has_brand(b) or exists (select 1 from public.tasks t where t.brand_id = b)))
    or (public.my_role() = 'client' and public.has_brand(b) and coalesce(public.has_perm('canViewBrandFiles'), false));
$$;

-- Düzenleme. has_perm, null izin listesini "rol varsayılanı = her şey" saydığı için burada kullanılmaz:
-- çalışan için izin açıkça verilmiş olmalıdır.
create or replace function public.kit_can_edit(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'employee'
      and p.permissions is not null and 'canEditBrandKit' = any (p.permissions)
      and (exists (select 1 from public.brand_members m where m.brand_id = b and m.user_id = p.id)
           or exists (select 1 from public.tasks t where t.brand_id = b and t.assignee_id = p.id))
  );
$$;

-- Ekip içi kayıtları yalnızca ekip görür; dosya ve bağlantılar ayrıca "Marka dosyalarına erişim" ister.
create or replace function public.kit_row_visible(b uuid, vis text, files boolean default false) returns boolean
language sql stable set search_path = public as $$
  select public.kit_can_view(b)
     and (vis = 'shared' or public.my_role() in ('admin', 'employee'))
     and (not files or coalesce(public.has_perm('canViewBrandFiles'), false));
$$;

-- ───────────────────────── Tablolar ─────────────────────────

create table if not exists public.brand_kits (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null unique references public.brands (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null default auth.uid()
);

create table if not exists public.brand_kit_colors (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references public.brand_kits (brand_id) on delete cascade,
  name               text not null check (length(trim(name)) between 1 and 80),
  hex_code           text not null check (hex_code ~ '^#[0-9A-F]{6}$'),
  usage_description  text not null default '' check (length(usage_description) <= 500),
  color_type         text not null default 'secondary' check (color_type in ('primary', 'secondary')),
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists brand_kit_colors_brand_idx on public.brand_kit_colors (brand_id, sort_order);

create table if not exists public.brand_kit_assets (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brand_kits (brand_id) on delete cascade,
  file_name    text not null check (length(trim(file_name)) between 1 and 255),
  file_type    text not null,
  mime_type    text not null,
  file_size    bigint not null check (file_size > 0 and file_size <= 26214400),
  storage_path text not null unique,
  category     text not null default 'other'
               check (category in ('logos', 'identity', 'guide_pdf', 'fonts', 'social_templates', 'media', 'other')),
  description  text not null default '' check (length(description) <= 500),
  visibility   text not null default 'shared' check (visibility in ('internal', 'shared')),
  uploaded_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (brand_id, id),
  -- Dosya yolu kaydın markasına ait olmalı (başka markanın dosyası bağlanamaz).
  check (storage_path like brand_id::text || '/%')
);
create index if not exists brand_kit_assets_brand_idx on public.brand_kit_assets (brand_id, created_at);

create table if not exists public.brand_kit_fonts (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references public.brand_kits (brand_id) on delete cascade,
  font_family        text not null check (length(trim(font_family)) between 1 and 80),
  font_role          text not null default 'body' check (font_role in ('heading', 'body', 'support', 'alternative')),
  font_weights       integer[] not null default '{}' check (font_weights <@ array[100, 200, 300, 400, 500, 600, 700, 800, 900]),
  usage_description  text not null default '' check (length(usage_description) <= 500),
  font_asset_id      uuid,
  reference_url      text check (reference_url is null or reference_url ~ '^https://'),
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Font dosyası aynı markanın dosyası olmalı; dosya silinirse bağ kalkar, font kaydı kalır.
  foreign key (brand_id, font_asset_id) references public.brand_kit_assets (brand_id, id) on delete set null (font_asset_id)
);
create index if not exists brand_kit_fonts_brand_idx on public.brand_kit_fonts (brand_id, sort_order);

create table if not exists public.brand_kit_instructions (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_kits (brand_id) on delete cascade,
  category    text not null check (category in ('design', 'content', 'client')),
  title       text not null check (length(trim(title)) between 1 and 120),
  content     text not null default '',          -- istemcide temizlenmiş HTML
  important   boolean not null default false,
  visibility  text not null default 'internal' check (visibility in ('internal', 'shared')),
  sort_order  integer not null default 0,
  updated_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists brand_kit_instructions_brand_idx on public.brand_kit_instructions (brand_id, category, sort_order);

create table if not exists public.brand_kit_links (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brand_kits (brand_id) on delete cascade,
  title        text not null check (length(trim(title)) between 1 and 120),
  url          text not null check (url ~ '^https://(drive|docs)\.google\.com/'),
  category     text not null default 'general'
               check (category in ('general', 'logos', 'identity', 'guide_pdf', 'fonts', 'social_templates', 'media', 'other')),
  description  text not null default '' check (length(description) <= 500),
  visibility   text not null default 'shared' check (visibility in ('internal', 'shared')),
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (brand_id, url)
);
create index if not exists brand_kit_links_brand_idx on public.brand_kit_links (brand_id, created_at);

-- ───────────────────────── Zaman damgaları ─────────────────────────

-- Alt kayıt her değiştiğinde: kendi updated_at'i ve kılavuzun "son güncelleme / güncelleyen" bilgisi.
create or replace function public.kit_touch_row() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_table_name = 'brand_kit_instructions' then new.updated_by := coalesce(auth.uid(), new.updated_by); end if;
  if tg_op = 'UPDATE' and new.brand_id is distinct from old.brand_id then
    raise exception 'Kayıt başka bir markaya taşınamaz.' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.kit_touch_parent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.brand_kits set updated_at = now(), updated_by = coalesce(auth.uid(), updated_by)
  where brand_id = coalesce(new.brand_id, old.brand_id);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['brand_kit_colors', 'brand_kit_fonts', 'brand_kit_instructions', 'brand_kit_links'] loop
    execute format('drop trigger if exists %1$s_touch on public.%1$s', t);
    execute format('create trigger %1$s_touch before insert or update on public.%1$s for each row execute function public.kit_touch_row()', t);
  end loop;
  foreach t in array array['brand_kit_colors', 'brand_kit_fonts', 'brand_kit_instructions', 'brand_kit_links', 'brand_kit_assets'] loop
    execute format('drop trigger if exists %1$s_parent on public.%1$s', t);
    execute format('create trigger %1$s_parent after insert or update or delete on public.%1$s for each row execute function public.kit_touch_parent()', t);
  end loop;
end $$;

-- Dosya kaydında yalnızca kategori, açıklama ve görünürlük değiştirilebilir.
create or replace function public.kit_assets_guard() returns trigger
language plpgsql as $$
begin
  if new.storage_path is distinct from old.storage_path or new.brand_id is distinct from old.brand_id
     or new.file_size is distinct from old.file_size or new.mime_type is distinct from old.mime_type
     or new.uploaded_by is distinct from old.uploaded_by then
    raise exception 'Yüklenmiş dosyanın bilgileri değiştirilemez.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists brand_kit_assets_guard on public.brand_kit_assets;
create trigger brand_kit_assets_guard before update on public.brand_kit_assets for each row execute function public.kit_assets_guard();

-- ───────────────────────── RLS ─────────────────────────

alter table public.brand_kits             enable row level security;
alter table public.brand_kit_colors       enable row level security;
alter table public.brand_kit_fonts        enable row level security;
alter table public.brand_kit_instructions enable row level security;
alter table public.brand_kit_assets       enable row level security;
alter table public.brand_kit_links        enable row level security;

create policy "brand_kits: görünürlük" on public.brand_kits for select to authenticated using (public.kit_can_view(brand_id));
create policy "brand_kits: oluşturma" on public.brand_kits for insert to authenticated with check (public.kit_can_edit(brand_id));
create policy "brand_kits: güncelleme" on public.brand_kits for update to authenticated using (public.kit_can_edit(brand_id)) with check (public.kit_can_edit(brand_id));
create policy "brand_kits: silme" on public.brand_kits for delete to authenticated using (public.is_admin());

create policy "brand_kit_colors: görünürlük" on public.brand_kit_colors for select to authenticated using (public.kit_can_view(brand_id));
create policy "brand_kit_fonts: görünürlük" on public.brand_kit_fonts for select to authenticated using (public.kit_can_view(brand_id));
create policy "brand_kit_instructions: görünürlük" on public.brand_kit_instructions for select to authenticated using (public.kit_row_visible(brand_id, visibility));
create policy "brand_kit_assets: görünürlük" on public.brand_kit_assets for select to authenticated using (public.kit_row_visible(brand_id, visibility, true));
create policy "brand_kit_links: görünürlük" on public.brand_kit_links for select to authenticated using (public.kit_row_visible(brand_id, visibility, true));

do $$
declare t text;
begin
  foreach t in array array['brand_kit_colors', 'brand_kit_fonts', 'brand_kit_instructions', 'brand_kit_assets', 'brand_kit_links'] loop
    execute format('create policy "%1$s: ekleme" on public.%1$s for insert to authenticated with check (public.kit_can_edit(brand_id))', t);
    execute format('create policy "%1$s: güncelleme" on public.%1$s for update to authenticated using (public.kit_can_edit(brand_id)) with check (public.kit_can_edit(brand_id))', t);
    execute format('create policy "%1$s: silme" on public.%1$s for delete to authenticated using (public.kit_can_edit(brand_id))', t);
  end loop;
end $$;

-- Dosya kaydını yükleyen kişi kendi adına ekler.
drop policy if exists "brand_kit_assets: ekleme" on public.brand_kit_assets;
create policy "brand_kit_assets: ekleme" on public.brand_kit_assets for insert to authenticated
  with check (public.kit_can_edit(brand_id) and uploaded_by = auth.uid());

-- ───────────────────────── Storage ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', false, 26214400, array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'application/postscript', 'application/pdf',
  'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/zip', 'image/vnd.adobe.photoshop', 'video/mp4', 'video/quicktime',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.kit_brand_from_path(path text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end $$;

-- Okuma: dosyanın kaydı kullanıcıya görünüyorsa (görünürlük ve marka kuralları kayıt politikasından gelir).
create policy "brand-assets: görünürlük" on storage.objects for select to authenticated
  using (bucket_id = 'brand-assets' and (
    exists (select 1 from public.brand_kit_assets a where a.storage_path = name)
    or public.kit_can_edit(public.kit_brand_from_path(name))));
create policy "brand-assets: yükleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and public.kit_can_edit(public.kit_brand_from_path(name)));
create policy "brand-assets: silme" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and public.kit_can_edit(public.kit_brand_from_path(name)));

-- ───────────────────────── Canlı güncelleme ─────────────────────────

alter publication supabase_realtime add table
  public.brand_kits, public.brand_kit_colors, public.brand_kit_fonts, public.brand_kit_instructions, public.brand_kit_assets, public.brand_kit_links;

commit;

-- ───────────────────────── Kontroller (isteğe bağlı) ─────────────────────────
-- 6 tablo, hepsi RLS açık olmalı:
--   select relname, relrowsecurity from pg_class where relname like 'brand_kit%' order by 1;
-- Kova özel olmalı:
--   select id, public, file_size_limit from storage.buckets where id = 'brand-assets';
-- Kaydı olmayan (yetim) dosyalar:
--   select o.name from storage.objects o left join public.brand_kit_assets a on a.storage_path = o.name
--   where o.bucket_id = 'brand-assets' and a.id is null;
