-- 012_reporter_push.sql — "Görevi Veren / Takipçi" (reporter) ve push bildirimleri
--
-- YENİ PANEL DERLEMESİ YÜKLENMEDEN ÖNCE çalıştırın (011'den sonra). Yalnızca ekleme yapar; mevcut görevler ve eski panel etkilenmez.
--
--   1. tasks.reporter_id : görevi veren / takip eden yönetici. Boş olabilir (eski görevler). Doluysa AKTİF bir admin olmalıdır.
--                          Yalnızca adminler değiştirebilir (tasks_guard).
--   2. push_subscriptions: her cihazın tarayıcı push aboneliği (kullanıcı yalnızca kendi kayıtlarını görür).
--      save_push_subscription / delete_push_subscription RPC'leri (aynı tarayıcıda başka kullanıcı oturum açarsa abonelik ona geçer).
--   3. notifications.pushed_at: send-push fonksiyonu her bildirimi yalnızca bir kez gönderir.
--
-- Tekrar çalıştırmak güvenlidir. Sonda doğrulama satırı döner (hepsi true olmalı).

begin;

-- 1. Görevi Veren / Takipçi
alter table public.tasks add column if not exists reporter_id uuid references public.profiles (id) on delete set null;
create index if not exists tasks_reporter_id_idx on public.tasks (reporter_id);

create or replace function public.tasks_reporter_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reporter_id is not null and (tg_op = 'INSERT' or new.reporter_id is distinct from old.reporter_id)
     and not exists (select 1 from public.profiles where id = new.reporter_id and role = 'admin' and active) then
    raise exception 'Görevi veren / takipçi yalnızca aktif bir yönetici olabilir.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists tasks_reporter_check on public.tasks;
create trigger tasks_reporter_check before insert or update of reporter_id on public.tasks
  for each row execute function public.tasks_reporter_check();

-- 006'daki koruma + reporter_id: çalışan görevi veren kişiyi değiştiremez.
create or replace function public.tasks_guard() returns trigger
language plpgsql as $$
begin
  -- auth.uid() boşsa istek bir kullanıcıdan değil, servis anahtarından veya SQL Editor'dan gelir.
  if auth.uid() is null or current_setting('cw.bypass', true) = 'on' then return new; end if;
  if new.status is distinct from old.status and new.status in ('Yönetici Onayı', 'Müşteri Onayı') then
    raise exception 'İçerik yalnızca “Onaya Gönder” ile onaya gönderilebilir (kontrol listesi doğrulaması).' using errcode = '42501';
  end if;
  if public.is_admin() then return new; end if;
  if new.assignee_id is distinct from old.assignee_id or new.reporter_id is distinct from old.reporter_id or new.brand_id is distinct from old.brand_id
     or new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time
     or new.priority is distinct from old.priority or new.checklist_disabled is distinct from old.checklist_disabled then
    raise exception 'Atama, görevi veren, marka, son teslim, öncelik ve kontrol listesi ayarı yalnızca yöneticiler tarafından değiştirilebilir.' using errcode = '42501';
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

-- 2. Push abonelikleri
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%'),
  p256dh      text not null,
  auth        text not null,
  user_agent  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
drop policy if exists "push: kendi abonelikleri" on public.push_subscriptions;
create policy "push: kendi abonelikleri" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
-- Ekleme / güncelleme / silme yalnızca aşağıdaki RPC'lerle (doğrudan yazma izni yok).
revoke insert, update, delete on public.push_subscriptions from authenticated;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.my_role() is null then raise exception 'Oturum gerekli.' using errcode = '42501'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, updated_at = now();
end $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- 3. Bildirim push durumu
alter table public.notifications add column if not exists pushed_at timestamptz;

commit;

-- Doğrulama: hepsi true olmalı.
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'reporter_id') as gorevi_veren_alani,
  exists (select 1 from pg_trigger where tgname = 'tasks_reporter_check')                                                                 as yalnizca_admin_kurali,
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'push_subscriptions')                   as push_tablosu,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'notifications' and column_name = 'pushed_at') as bildirim_push_durumu;
