-- AgencyOS — Supabase şeması
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın. Tekrar çalıştırılabilir (idempotent) değildir;
-- değişiklikler için ayrı migration dosyaları kullanın.
--
-- Erişim modeli: ajans içi araç. `profiles.active = true` olan her ekip üyesi tüm markaları ve görevleri
-- görür ve düzenler. Yorumları yalnızca yazarı silebilir. Aktivite kayıtları yalnızca eklenebilir.
-- Kullanıcılar kendi kendine kayıt olamaz: Authentication → Users → "Invite user" ile davet edilir.

-- ───────────────────────── Ekip üyeleri ─────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role_title  text,
  color       text not null default 'slate'
              check (color in ('slate', 'violet', 'sky', 'emerald', 'rose', 'amber', 'orange', 'indigo')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Davet edilen kullanıcı ilk kez oluşturulduğunda profil satırını açar.
-- Ad, davette user_metadata.full_name olarak verilmezse e-postanın @ öncesi kullanılır.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS politikalarında kullanılır. security definer: profiles tablosunun kendi RLS'ine takılmadan okur.
create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

-- ───────────────────────── Markalar & görevler ─────────────────────────

create table public.brands (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  initials         text not null,
  sector           text not null default 'Yeni Müşteri',
  color            text not null
                   check (color in ('orange', 'red', 'sky', 'emerald', 'amber', 'violet', 'indigo', 'rose')),
  drive_folder_id  text,                       -- Google Drive kök klasör kimliği (isteğe bağlı)
  created_at       timestamptz not null default now()
);
create unique index brands_name_key on public.brands (lower(name));

create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  task_no       bigint generated always as identity (start with 1001) unique,   -- ekranda CW-1001
  brand_id      uuid not null references public.brands (id) on delete restrict,
  title         text not null check (length(trim(title)) > 0),
  platform      text not null
                check (platform in ('Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'YouTube', 'Web Sitesi', 'Meta Reklam', 'Google Reklam')),
  format        text not null
                check (format in ('Reels', 'Gönderi', 'Hikâye', 'Karusel', 'Video', 'Web', 'Reklam', 'Rapor')),
  assignee_id   uuid references public.profiles (id) on delete set null,
  status        text not null default 'Başlanmadı'
                check (status in ('Başlanmadı', 'Çalışılıyor', 'Yönetici Onayı', 'Müşteri Onayı', 'Revizyon', 'Tamamlandı', 'Gecikti')),
  priority      text not null default 'Orta' check (priority in ('Yüksek', 'Orta', 'Düşük')),
  publish_date  date,
  due_date      date,
  description   text not null default '',     -- istemcide temizlenmiş HTML
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tasks_brand_id_idx on public.tasks (brand_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_due_date_idx on public.tasks (due_date);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ───────────────────────── Görev alt kayıtları ─────────────────────────

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);
create index comments_task_id_idx on public.comments (task_id);

create table public.activity (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  text        text not null,
  created_at  timestamptz not null default now()
);
create index activity_task_id_idx on public.activity (task_id, created_at desc);

-- ───────────────────────── Drive dosyaları ─────────────────────────
-- Dosyaların kendisi Google Drive'da kalır; burada yalnızca meta veri ve bağlantı tutulur.

create table public.assets (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brands (id) on delete cascade,
  folder_id        text not null
                   check (folder_id in ('logolar', 'kimlik', 'fontlar', 'gorseller', 'video', 'sablonlar', 'kampanyalar', 'arsiv')),
  name             text not null,
  type             text not null
                   check (type in ('Görsel', 'Vektör', 'PDF', 'Font', 'Video', 'Şablon', 'Arşiv', 'Doküman')),
  thumbnail_url    text,
  drive_file_id    text,
  drive_url        text not null check (drive_url ~ '^https://(drive|docs)\.google\.com/'),
  size_label       text not null default 'Drive',
  owner_id         uuid references public.profiles (id) on delete set null,
  approval_status  text not null default 'Onay Bekliyor'
                   check (approval_status in ('Onaylandı', 'Onay Bekliyor', 'Revizyon')),
  updated_on       date not null default current_date
);
create index assets_brand_id_idx on public.assets (brand_id);

create table public.attachments (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.tasks (id) on delete cascade,
  asset_id       uuid references public.assets (id) on delete set null,
  name           text not null,
  type           text not null,
  size_label     text not null default 'Drive',
  thumbnail_url  text,
  drive_url      text not null check (drive_url ~ '^https://(drive|docs)\.google\.com/'),
  added_by       uuid not null references public.profiles (id),
  created_at     timestamptz not null default now()
);
create index attachments_task_id_idx on public.attachments (task_id);

-- ───────────────────────── Satır düzeyi güvenlik (RLS) ─────────────────────────

alter table public.profiles    enable row level security;
alter table public.brands      enable row level security;
alter table public.tasks       enable row level security;
alter table public.comments    enable row level security;
alter table public.activity    enable row level security;
alter table public.assets      enable row level security;
alter table public.attachments enable row level security;

-- Profiller: üyeler herkesi görür; herkes yalnızca kendi profilini düzenler.
-- `active` alanını yalnızca yönetici (Dashboard / service role) değiştirmelidir; bkz. aşağıdaki sütun izni.
create policy "profiles: üyeler okur" on public.profiles for select to authenticated using (public.is_member());
create policy "profiles: kendi profilini düzenler" on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_member()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, role_title, color) on public.profiles to authenticated;

-- Markalar, görevler, dosyalar, ekler: tüm üyeler tam yetkili.
create policy "brands: üyeler" on public.brands for all to authenticated
  using (public.is_member()) with check (public.is_member());
create policy "tasks: üyeler" on public.tasks for all to authenticated
  using (public.is_member()) with check (public.is_member());
create policy "assets: üyeler" on public.assets for all to authenticated
  using (public.is_member()) with check (public.is_member());
create policy "attachments: üyeler okur/siler" on public.attachments for select to authenticated using (public.is_member());
create policy "attachments: kendi adına ekler" on public.attachments for insert to authenticated
  with check (public.is_member() and added_by = auth.uid());
create policy "attachments: üyeler kaldırır" on public.attachments for delete to authenticated using (public.is_member());

-- Yorumlar: herkes okur, kendi adına yazar, yalnızca kendi yorumunu siler.
create policy "comments: üyeler okur" on public.comments for select to authenticated using (public.is_member());
create policy "comments: kendi adına yazar" on public.comments for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());
create policy "comments: kendi yorumunu siler" on public.comments for delete to authenticated
  using (public.is_member() and user_id = auth.uid());

-- Aktivite: yalnızca okuma ve kendi adına ekleme (görev silinince cascade ile gider).
create policy "activity: üyeler okur" on public.activity for select to authenticated using (public.is_member());
create policy "activity: kendi adına ekler" on public.activity for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

-- ───────────────────────── Canlı güncelleme (Realtime) ─────────────────────────
-- Ekip aynı anda çalışırken değişiklikler anında görünür. Olaylar RLS'e tabidir: yalnızca aktif üyeler alır.

alter publication supabase_realtime add table
  public.tasks, public.comments, public.activity, public.attachments, public.assets, public.brands, public.profiles;

-- ───────────────────────── Açıklama görselleri (Storage) ─────────────────────────
-- Gizli bucket: görseller yalnızca giriş yapmış aktif üyelere süreli imzalı adresle (1 saat) açılır.
-- Yol biçimi: <görev id>/<rastgele uuid>.<uzantı>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-images', 'task-images', false, 5242880, array['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

create policy "task-images: üyeler görür" on storage.objects for select to authenticated
  using (bucket_id = 'task-images' and public.is_member());
create policy "task-images: üyeler yükler" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-images' and public.is_member());
create policy "task-images: üyeler siler" on storage.objects for delete to authenticated
  using (bucket_id = 'task-images' and public.is_member());
