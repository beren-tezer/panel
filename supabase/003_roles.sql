-- 003 — Roller (Admin / Çalışan / Müşteri), marka üyelikleri, onay akışı ve bildirimler
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın (schema.sql ve 002'den sonra).
--
-- Bu dosya rbac.js'teki kuralların veritabanı karşılığıdır. Arayüz yalnızca yetkili ekranları gösterir;
-- buradaki RLS politikaları ve tetikleyiciler aynı kuralları API seviyesinde zorunlu kılar.
--
--   Admin    : her şeyi görür ve yönetir.
--   Çalışan  : yalnızca kendisine atanan görevleri görür; atama/tarih/öncelik değiştiremez, onaylayamaz.
--   Müşteri  : yalnızca bağlı olduğu markaların müşteriye açık aşamadaki içeriklerini görür;
--              iç yorum ve aktiviteleri göremez; yalnızca onay / revize talebi verebilir.
--
-- ÖNEMLİ: Bu migration öncesindeki tüm ekip üyeleri "admin" yapılır (şu an yalnızca siz varsınız).
-- Gerekirse paneldeki Kullanıcılar & Yetkiler ekranından değiştirin.

begin;

-- ───────────────────────── Profil alanları ─────────────────────────

alter table public.profiles
  add column if not exists role text not null default 'employee' check (role in ('admin', 'employee', 'client')),
  add column if not exists email text,
  add column if not exists company text,
  add column if not exists permissions text[],          -- null = rolün varsayılan izinleri
  add column if not exists last_seen_at timestamptz;

update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
update public.profiles set role = 'admin';

alter table public.brands add column if not exists status text not null default 'active' check (status in ('active', 'paused'));

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('Başlanmadı', 'Çalışılıyor', 'Yönetici Onayı', 'Müşteri Onayı', 'Revizyon', 'Onaylandı', 'Tamamlandı', 'Gecikti'));

-- Davetle gelen kullanıcı: rol davet verisinden alınır; davetsiz kayıtlar pasif başlar (002 ile aynı kural).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    case when meta_role in ('admin', 'employee', 'client') then meta_role else 'employee' end,
    new.invited_at is not null
  );
  return new;
end $$;

-- ───────────────────────── Yeni tablolar ─────────────────────────

create table if not exists public.brand_members (
  brand_id    uuid not null references public.brands (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index if not exists brand_members_user_id_idx on public.brand_members (user_id);

create table if not exists public.approvals (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  decision    text not null check (decision in ('approved', 'revision')),
  note        text not null default '',
  link        text,
  created_at  timestamptz not null default now(),
  check (decision = 'approved' or length(trim(note)) > 0)
);
create index if not exists approvals_task_id_idx on public.approvals (task_id, created_at desc);

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,  -- alıcı
  task_id     uuid references public.tasks (id) on delete cascade,
  kind        text not null default 'status',
  text        text not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ───────────────────────── Yetki yardımcıları ─────────────────────────
-- security definer: politikalar içinde profiles/brand_members RLS'ine takılmadan (ve döngüye girmeden) okur.

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

create or replace function public.has_brand(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null
     and exists (select 1 from public.brand_members where brand_id = b and user_id = auth.uid());
$$;

-- rbac.js permissionsFor ile aynı: null izin listesi = rol varsayılanı; müşteri yalnızca kendi izinlerini açabilir.
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when pr.role = 'admin' then true
    when pr.role = 'employee' then pr.permissions is null or p = any (pr.permissions)
    when pr.role = 'client' then p in ('canViewContent', 'canViewBrandFiles', 'canAccessApprovals')
                                 and (pr.permissions is null or p = any (pr.permissions))
    else false end
  from public.profiles pr where pr.id = auth.uid() and pr.active;
$$;

-- Bildirim yalnızca adminlere veya ortak markadaki kişilere gönderilebilir.
create or replace function public.can_notify(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null and (
    exists (select 1 from public.profiles where id = target and role = 'admin' and active)
    or exists (select 1 from public.brand_members a join public.brand_members b on a.brand_id = b.brand_id
               where a.user_id = auth.uid() and b.user_id = target)
    or exists (select 1 from public.tasks t where t.assignee_id = target
               and (t.assignee_id = auth.uid() or public.has_brand(t.brand_id)))
    or exists (select 1 from public.tasks t join public.brand_members m on m.brand_id = t.brand_id
               where t.assignee_id = auth.uid() and m.user_id = target)
  );
$$;

-- ───────────────────────── Politikalar (eskileri kaldırılır) ─────────────────────────

drop policy if exists "profiles: üyeler okur" on public.profiles;
drop policy if exists "profiles: kendi profilini düzenler" on public.profiles;
drop policy if exists "brands: üyeler" on public.brands;
drop policy if exists "tasks: üyeler" on public.tasks;
drop policy if exists "assets: üyeler" on public.assets;
drop policy if exists "attachments: üyeler okur/siler" on public.attachments;
drop policy if exists "attachments: kendi adına ekler" on public.attachments;
drop policy if exists "attachments: üyeler kaldırır" on public.attachments;
drop policy if exists "comments: üyeler okur" on public.comments;
drop policy if exists "comments: kendi adına yazar" on public.comments;
drop policy if exists "comments: kendi yorumunu siler" on public.comments;
drop policy if exists "activity: üyeler okur" on public.activity;
drop policy if exists "activity: kendi adına ekler" on public.activity;
drop policy if exists "task-images: üyeler görür" on storage.objects;
drop policy if exists "task-images: üyeler yükler" on storage.objects;
drop policy if exists "task-images: üyeler siler" on storage.objects;

alter table public.brand_members enable row level security;
alter table public.approvals     enable row level security;
alter table public.notifications enable row level security;

-- Görevler: diğer tabloların politikaları "görev görünür mü" sorusunu bu politika üzerinden sorar.
create policy "tasks: görünürlük" on public.tasks for select to authenticated using (
  public.is_admin()
  or (public.my_role() = 'employee' and public.has_perm('canViewTasks') and assignee_id = auth.uid())
  or (public.my_role() = 'client' and public.has_perm('canViewContent') and public.has_brand(brand_id)
      and status in ('Müşteri Onayı', 'Revizyon', 'Onaylandı', 'Tamamlandı'))
);
create policy "tasks: admin ekler" on public.tasks for insert to authenticated with check (public.is_admin());
create policy "tasks: güncelleme" on public.tasks for update to authenticated
  using (public.is_admin() or (public.my_role() = 'employee' and assignee_id = auth.uid() and public.has_perm('canUpdateTasks')))
  with check (public.is_admin() or (public.my_role() = 'employee' and assignee_id = auth.uid()));
create policy "tasks: admin siler" on public.tasks for delete to authenticated using (public.is_admin());

-- Çalışanın değiştiremeyeceği alanlar (atama, marka, tarih, öncelik, onay) tetikleyiciyle korunur.
create or replace function public.tasks_guard() returns trigger
language plpgsql as $$
begin
  -- auth.uid() boşsa istek bir kullanıcıdan değil, servis anahtarından veya SQL Editor'dan gelir.
  if auth.uid() is null or public.is_admin() or current_setting('cw.bypass', true) = 'on' then return new; end if;
  if new.assignee_id is distinct from old.assignee_id or new.brand_id is distinct from old.brand_id
     or new.due_date is distinct from old.due_date or new.priority is distinct from old.priority then
    raise exception 'Atama, marka, son teslim ve öncelik yalnızca yöneticiler tarafından değiştirilebilir.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and (new.status = 'Onaylandı' or (old.status = 'Onaylandı' and new.status <> 'Tamamlandı')) then
    raise exception 'Onay durumunu yalnızca müşteri veya yönetici değiştirebilir.' using errcode = '42501';
  end if;
  if not public.has_perm('canEditContent') and (new.title is distinct from old.title or new.description is distinct from old.description
     or new.platform is distinct from old.platform or new.format is distinct from old.format or new.publish_date is distinct from old.publish_date) then
    raise exception 'İçerik düzenleme yetkiniz yok.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists tasks_guard on public.tasks;
create trigger tasks_guard before update on public.tasks for each row execute function public.tasks_guard();

-- Profiller
create policy "profiles: görünürlük" on public.profiles for select to authenticated using (
  public.is_admin() or id = auth.uid()
  or (public.my_role() = 'employee' and role = 'admin')
  or exists (select 1 from public.brand_members a join public.brand_members b on a.brand_id = b.brand_id
             where a.user_id = auth.uid() and b.user_id = profiles.id)
  or exists (select 1 from public.tasks t where t.assignee_id = profiles.id)
);
create policy "profiles: güncelleme" on public.profiles for update to authenticated
  using (public.is_admin() or (id = auth.uid() and public.my_role() is not null))
  with check (public.is_admin() or id = auth.uid());
grant update on public.profiles to authenticated;

-- Admin olmayan kullanıcı kendi rolünü, durumunu, izinlerini veya e-postasını değiştiremez.
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if; -- servis anahtarı (davet fonksiyonu) / SQL Editor
  if public.is_admin() then
    if new.id = auth.uid() and (new.role <> 'admin' or not new.active) then
      raise exception 'Kendi yönetici hesabınızı pasifleştiremez veya rolünü değiştiremezsiniz.' using errcode = '42501';
    end if;
    return new;
  end if;
  new.role := old.role; new.active := old.active; new.permissions := old.permissions; new.email := old.email; new.company := old.company;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- Markalar ve üyelikler
create policy "brands: görünürlük" on public.brands for select to authenticated using (
  public.is_admin() or public.has_brand(id) or exists (select 1 from public.tasks t where t.brand_id = brands.id)
);
create policy "brands: admin yönetir" on public.brands for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "brand_members: görünürlük" on public.brand_members for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or public.has_brand(brand_id));
create policy "brand_members: admin yönetir" on public.brand_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Görev alt kayıtları (görev görünürlüğü tasks politikasından gelir)
create policy "comments: ekip okur" on public.comments for select to authenticated
  using (public.my_role() in ('admin', 'employee') and exists (select 1 from public.tasks t where t.id = task_id));
create policy "comments: ekip yazar" on public.comments for insert to authenticated
  with check (public.my_role() in ('admin', 'employee') and user_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id));
create policy "comments: kendi yorumunu siler" on public.comments for delete to authenticated using (user_id = auth.uid());

create policy "activity: ekip okur" on public.activity for select to authenticated
  using (public.my_role() in ('admin', 'employee') and exists (select 1 from public.tasks t where t.id = task_id));
create policy "activity: kendi adına ekler" on public.activity for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id));

create policy "attachments: görünürlük" on public.attachments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy "attachments: ekip ekler" on public.attachments for insert to authenticated
  with check (public.my_role() in ('admin', 'employee') and public.has_perm('canEditContent') and added_by = auth.uid()
              and exists (select 1 from public.tasks t where t.id = task_id));
create policy "attachments: ekip kaldırır" on public.attachments for delete to authenticated
  using (public.my_role() in ('admin', 'employee') and public.has_perm('canEditContent') and exists (select 1 from public.tasks t where t.id = task_id));

create policy "assets: görünürlük" on public.assets for select to authenticated
  using (public.is_admin() or (public.has_brand(brand_id) and public.has_perm('canViewBrandFiles')));
create policy "assets: ekip ekler/günceller" on public.assets for insert to authenticated
  with check (public.is_admin() or (public.my_role() = 'employee' and public.has_brand(brand_id) and public.has_perm('canViewBrandFiles')));
create policy "assets: ekip günceller" on public.assets for update to authenticated
  using (public.is_admin() or (public.my_role() = 'employee' and public.has_brand(brand_id) and public.has_perm('canViewBrandFiles')));
create policy "assets: admin siler" on public.assets for delete to authenticated using (public.is_admin());

-- Onaylar: yalnızca müşteri, yalnızca onay bekleyen içerik için; durum değişikliği tetikleyiciyle yapılır.
create policy "approvals: görünürlük" on public.approvals for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy "approvals: müşteri karar verir" on public.approvals for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() = 'client' and public.has_perm('canAccessApprovals')
              and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'Müşteri Onayı'));

create or replace function public.apply_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('cw.bypass', 'on', true);
  update public.tasks set status = case when new.decision = 'approved' then 'Onaylandı' else 'Revizyon' end where id = new.task_id;
  perform set_config('cw.bypass', 'off', true);
  return new;
end $$;
drop trigger if exists apply_approval on public.approvals;
create trigger apply_approval after insert on public.approvals for each row execute function public.apply_approval();

-- Bildirimler: herkes yalnızca kendi bildirimlerini görür ve okundu işaretler.
create policy "notifications: kendi bildirimleri" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications: okundu işaretle" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: gönder" on public.notifications for insert to authenticated with check (public.can_notify(user_id));

-- Açıklama görselleri (yol: <görev id>/<dosya>) — görev görünürlüğüne bağlı.
create or replace function public.task_visible_by_path(path text) returns boolean
language plpgsql stable as $$
begin
  return exists (select 1 from public.tasks t where t.id = split_part(path, '/', 1)::uuid);
exception when invalid_text_representation then
  return false;
end $$;

create policy "task-images: görünürlük" on storage.objects for select to authenticated
  using (bucket_id = 'task-images' and public.task_visible_by_path(name));
create policy "task-images: ekip yükler" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-images' and public.my_role() in ('admin', 'employee') and public.has_perm('canEditContent')
              and public.task_visible_by_path(name));
create policy "task-images: ekip siler" on storage.objects for delete to authenticated
  using (bucket_id = 'task-images' and (public.is_admin() or (public.my_role() = 'employee' and public.task_visible_by_path(name))));

-- ───────────────────────── Canlı güncelleme ─────────────────────────

alter publication supabase_realtime add table public.brand_members, public.approvals, public.notifications;

commit;
