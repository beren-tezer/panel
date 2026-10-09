-- 007 — İçerik sürümleri, müşteri onay istekleri ve müşteri onay bağlantısı
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın (006'dan sonra). Geri almak için: 007_content_approvals_down.sql
-- SIRA: önce panelin yeni sürümünü yayınlayın (007 olmadan da çalışır; sürüm bölümleri gizli kalır), sonra bu dosyayı
-- çalıştırın. 007'den sonra müşteri kararı yalnızca bir onay isteğine (ve onun sürümüne) verilebilir.
--
-- Model:
--   brands.slug                 Müşteri onay bağlantısı: /musteri/<slug>. Yalnızca yönlendirme içindir, YETKİ VERMEZ —
--                               sayfa giriş ister ve marka üyeliğiyle (brand_members) açılır. Yenilenince eski adres çözülmez.
--   task_content_versions       Görevin teslim sürümleri (v1, v2 …). Müşteriye gönderilince kilitlenir (locked_at);
--                               kilitli sürümün metni ve dosyaları değiştirilemez / silinemez.
--   task_content_assets         Sürüm dosyaları (özel "content-assets" kovası, 50 MB, görsel/video/PDF).
--   approval_requests           Bir sürümün müşteriye gönderilmesi. pending → approved | revision_requested | withdrawn | superseded.
--                               Görev başına en fazla bir bekleyen istek (kısmi benzersiz indeks).
--   approvals (003, genişletildi) Müşteri kararı; request_id + version_id. Bir isteğe en fazla bir karar (benzersiz indeks):
--                               aynı anda gelen iki karar / çift tıklama veritabanında reddedilir.
-- Görünürlük: ekip (admin + görevi gören çalışan) her şeyi; müşteri yalnızca kendi markasında müşteriye GÖNDERİLMİŞ
-- sürümleri, onların dosyalarını ve isteklerini görür. Taslak sürümler ve iç notlar müşteriye hiç dönmez.

begin;

-- ───────────────────────── Marka bağlantı adresi ─────────────────────────

create or replace function public.cw_slugify(t text) returns text
language sql immutable as $$
  select coalesce(nullif(left(trim(both '-' from regexp_replace(
    lower(translate(coalesce(t, ''), 'çğıİöşüÇĞÖŞÜâÂîÎûÛ', 'cgiiosucgosuaaiiuu')), '[^a-z0-9]+', '-', 'g')), 48), ''), 'marka');
$$;

alter table public.brands add column if not exists slug text;
with s as (
  select id, public.cw_slugify(name) as base, row_number() over (partition by public.cw_slugify(name) order by created_at, id) as n
  from public.brands where slug is null
)
update public.brands b set slug = case when s.n = 1 then s.base else s.base || '-' || s.n end from s where b.id = s.id;

-- Yeni markada adres otomatik üretilir; çakışırsa sona sayı eklenir.
create or replace function public.brands_slug() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_base text; v_try text; v_n int := 1;
begin
  if new.slug is null or new.slug = '' then
    v_base := public.cw_slugify(new.name); v_try := v_base;
    while exists (select 1 from public.brands where slug = v_try and id <> new.id) loop v_n := v_n + 1; v_try := v_base || '-' || v_n; end loop;
    new.slug := v_try;
  end if;
  new.slug := lower(new.slug);
  return new;
end $$;
drop trigger if exists brands_slug on public.brands;
create trigger brands_slug before insert or update of slug on public.brands for each row execute function public.brands_slug();

alter table public.brands alter column slug set not null;
alter table public.brands drop constraint if exists brands_slug_format;
alter table public.brands add constraint brands_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 60);
create unique index if not exists brands_slug_key on public.brands (slug);

-- ───────────────────────── Tablolar ─────────────────────────

create table if not exists public.task_content_versions (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  version_no  integer not null check (version_no > 0),
  caption     text not null default '' check (length(caption) <= 5000),     -- paylaşım metni (müşteri görür)
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  locked_at   timestamptz,                                                  -- müşteriye gönderildi: değişmez
  unique (task_id, version_no),
  unique (task_id, id)
);
create index if not exists task_content_versions_task_idx on public.task_content_versions (task_id, version_no desc);

create table if not exists public.task_content_assets (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null,
  task_id       uuid not null,
  storage_path  text not null unique,
  file_name     text not null check (length(trim(file_name)) between 1 and 255),
  mime_type     text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf')),
  file_size     bigint not null check (file_size > 0 and file_size <= 52428800),
  sort_order    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  -- Dosya kaydı ve yolu aynı görev + sürüme aittir (başka görevin sürümüne dosya bağlanamaz).
  foreign key (task_id, version_id) references public.task_content_versions (task_id, id) on delete cascade,
  check (storage_path like task_id::text || '/' || version_id::text || '/%')
);
create index if not exists task_content_assets_version_idx on public.task_content_assets (version_id, sort_order);
create index if not exists task_content_assets_task_idx on public.task_content_assets (task_id);

create table if not exists public.approval_requests (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null,
  version_id    uuid not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'revision_requested', 'withdrawn', 'superseded')),
  requested_by  uuid references public.profiles (id) on delete set null,
  requested_at  timestamptz not null default now(),
  closed_at     timestamptz,
  foreign key (task_id, version_id) references public.task_content_versions (task_id, id) on delete cascade,
  check ((status = 'pending') = (closed_at is null))
);
create unique index if not exists approval_requests_one_pending on public.approval_requests (task_id) where status = 'pending';
create index if not exists approval_requests_task_idx on public.approval_requests (task_id, requested_at desc);
create index if not exists approval_requests_version_idx on public.approval_requests (version_id);

alter table public.approvals add column if not exists request_id uuid references public.approval_requests (id) on delete cascade;
alter table public.approvals add column if not exists version_id uuid references public.task_content_versions (id) on delete set null;
create unique index if not exists approvals_one_per_request on public.approvals (request_id) where request_id is not null;

-- ───────────────────────── Yetki yardımcıları ─────────────────────────

-- Müşteri bu sürümü görebilir mi: kendi markası + içerik görüntüleme izni + sürüm müşteriye gönderilmiş.
create or replace function public.cv_client_can_see(p_version uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'client' and coalesce(public.has_perm('canViewContent'), false) and exists (
    select 1 from public.approval_requests r join public.tasks t on t.id = r.task_id
    where r.version_id = p_version and public.has_brand(t.brand_id));
$$;

-- Ekip okuması (006 cl_can_read ile aynı: admin veya görevi gören çalışan).
create or replace function public.cv_team_can_read(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.cl_can_read(p_task);
$$;

-- Taslak sürüme dosya ekleme / metin düzenleme: admin veya görevin sorumlusu ("İçerik düzenleme" izniyle).
create or replace function public.cv_can_edit(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or (
    public.my_role() = 'employee' and coalesce(public.has_perm('canEditContent'), false)
    and exists (select 1 from public.tasks t where t.id = p_task and t.assignee_id = auth.uid()));
$$;

create or replace function public.cv_version_open(p_task uuid, p_version uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.task_content_versions v where v.id = p_version and v.task_id = p_task and v.locked_at is null);
$$;

create or replace function public.cv_path_part(path text, n int) returns uuid
language plpgsql immutable as $$
begin
  return split_part(path, '/', n)::uuid;
exception when invalid_text_representation then
  return null;
end $$;

-- ───────────────────────── İstemci fonksiyonları (RPC) ─────────────────────────

-- Yeni taslak sürüm. Açık taslak varsa onu döner (aynı anda tek taslak). Metin önceki sürümden kopyalanır.
create or replace function public.create_content_version(p_task uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_last public.task_content_versions;
begin
  if not public.cv_can_edit(p_task) then raise exception 'Bu görev için içerik sürümü oluşturma yetkiniz yok.' using errcode = '42501'; end if;
  perform 1 from public.tasks where id = p_task for update;
  select * into v_last from public.task_content_versions where task_id = p_task order by version_no desc limit 1;
  if found and v_last.locked_at is null then return v_last.id; end if;
  insert into public.task_content_versions (task_id, version_no, caption)
  values (p_task, coalesce(v_last.version_no, 0) + 1, coalesce(v_last.caption, ''))
  returning id into v_last.id;
  return v_last.id;
end $$;

-- 006'daki onaya gönderme + "Müşteri Onayı"nda sürüm kilitleme ve onay isteği.
-- p_version boşsa son sürüm kullanılır; hiç sürüm yoksa (dosyasız teslim, eski akış) v1 oluşturulur.
drop function if exists public.submit_task_for_approval(uuid, text, text);
create or replace function public.submit_task_for_approval(p_task uuid, p_status text, p_reason text default null, p_version uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  v_uid uuid := auth.uid();
  v_admin boolean := coalesce(public.is_admin(), false);
  v_inst public.task_checklist_instances;
  v_total integer := 0; v_done integer := 0; v_req integer := 0; v_req_done integer := 0;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_ver public.task_content_versions;
  v_request uuid;
begin
  if v_uid is null then raise exception 'Oturum gerekli.' using errcode = '42501'; end if;
  if p_status not in ('Yönetici Onayı', 'Müşteri Onayı') then raise exception 'Geçersiz onay aşaması.' using errcode = '22023'; end if;
  select * into t from public.tasks where id = p_task for update;
  if not found then raise exception 'Görev bulunamadı.' using errcode = 'P0002'; end if;
  if not v_admin and not (public.my_role() = 'employee' and t.assignee_id = v_uid
                          and coalesce(public.has_perm('canUpdateTasks'), false) and coalesce(public.has_perm('canEditContent'), false)) then
    raise exception 'Bu görevi onaya gönderme yetkiniz yok.' using errcode = '42501';
  end if;
  if t.status = p_status then raise exception 'İçerik zaten “%” aşamasında.', p_status using errcode = 'P0001'; end if;
  if t.status in ('Onaylandı', 'Tamamlandı') and not v_admin then raise exception 'Onaylanmış içerik tekrar onaya gönderilemez.' using errcode = '42501'; end if;

  if not t.checklist_disabled then
    if public.cl_current(p_task) is null then perform public.cl_instantiate(p_task, 0); end if;
    select * into v_inst from public.task_checklist_instances where id = public.cl_current(p_task);
    if found then
      select count(*), count(*) filter (where is_completed), count(*) filter (where is_required), count(*) filter (where is_required and is_completed)
        into v_total, v_done, v_req, v_req_done
      from public.task_checklist_items where checklist_instance_id = v_inst.id;
      if v_req_done < v_req then
        if not v_admin then
          raise exception 'İçeriği onaya göndermeden önce % zorunlu kontrolü tamamlamalısınız.', v_req - v_req_done
            using errcode = 'P0001', detail = 'checklist_incomplete', hint = (v_req - v_req_done)::text;
        end if;
        if v_reason is null then raise exception 'Eksik zorunlu kontrollerle göndermek için gerekçe yazmalısınız.' using errcode = 'P0001', detail = 'reason_required'; end if;
      else v_reason := null;
      end if;
    end if;
  else v_reason := null;
  end if;

  if p_status = 'Müşteri Onayı' then
    if p_version is not null then
      select * into v_ver from public.task_content_versions where id = p_version and task_id = p_task for update;
      if not found then raise exception 'Gönderilecek sürüm bu göreve ait değil.' using errcode = '22023'; end if;
      if exists (select 1 from public.task_content_versions where task_id = p_task and version_no > v_ver.version_no) then
        raise exception 'Daha yeni bir sürüm var; müşteriye yalnızca en güncel sürüm gönderilebilir.' using errcode = 'P0001';
      end if;
    else
      select * into v_ver from public.task_content_versions where task_id = p_task order by version_no desc limit 1 for update;
      if not found then
        insert into public.task_content_versions (task_id, version_no, created_by) values (p_task, 1, v_uid) returning * into v_ver;
      end if;
    end if;
    if exists (select 1 from public.approval_requests where version_id = v_ver.id and status in ('approved', 'revision_requested')) then
      raise exception 'Bu sürüm için müşteri kararı verilmiş; değişiklik için yeni sürüm oluşturun.' using errcode = 'P0001';
    end if;
    update public.approval_requests set status = 'superseded', closed_at = now() where task_id = p_task and status = 'pending';
    perform set_config('cw.bypass', 'on', true);
    update public.task_content_versions set locked_at = coalesce(locked_at, now()) where id = v_ver.id;
    perform set_config('cw.bypass', 'off', true);
    insert into public.approval_requests (task_id, version_id, requested_by) values (p_task, v_ver.id, v_uid) returning id into v_request;
  end if;

  insert into public.task_checklist_submissions (task_id, checklist_instance_id, cycle, from_status, target_status, submitted_by,
                                                 total_items, done_items, required_total, required_done, override_reason)
  values (p_task, v_inst.id, v_inst.cycle, t.status, p_status, v_uid, v_total, v_done, v_req, v_req_done, v_reason);

  perform set_config('cw.bypass', 'on', true);
  update public.tasks set status = p_status where id = p_task;
  perform set_config('cw.bypass', 'off', true);

  return jsonb_build_object('status', p_status, 'cycle', v_inst.cycle, 'required_total', v_req, 'required_done', v_req_done,
                            'override', v_reason is not null, 'request_id', v_request, 'version_id', v_ver.id, 'version_no', v_ver.version_no);
end $$;

revoke execute on function public.submit_task_for_approval(uuid, text, text, uuid) from public, anon;
grant execute on function public.submit_task_for_approval(uuid, text, text, uuid) to authenticated;
revoke execute on function public.create_content_version(uuid) from public, anon;
grant execute on function public.create_content_version(uuid) to authenticated;

-- ───────────────────────── Tetikleyiciler ─────────────────────────

-- Müşteri kararı: isteği kilitler, hâlâ bekliyor mu ve doğru sürüme mi verildiğini doğrular, isteği ve görevi günceller.
-- Aynı isteğe ikinci karar benzersiz indeksle; eşzamanlı karar satır kilidiyle reddedilir.
create or replace function public.approvals_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.approval_requests;
begin
  -- BEFORE tetikleyicisi RLS kontrolünden önce çalışır: yetkisiz istek, görev/istek hakkında bilgi sızdırmadan reddedilir.
  if auth.uid() is not null and not (
    new.user_id = auth.uid() and public.my_role() = 'client' and coalesce(public.has_perm('canAccessApprovals'), false)
    and exists (select 1 from public.tasks t where t.id = new.task_id and public.has_brand(t.brand_id))) then
    raise exception 'new row violates row-level security policy for table "approvals"' using errcode = '42501';
  end if;
  if new.request_id is null then
    select * into r from public.approval_requests where task_id = new.task_id and status = 'pending' for update;
  else
    select * into r from public.approval_requests where id = new.request_id for update;
  end if;
  if not found then raise exception 'Bu içerik şu anda onay beklemiyor.' using errcode = 'P0001'; end if;
  if r.task_id <> new.task_id then raise exception 'Onay isteği bu içeriğe ait değil.' using errcode = '22023'; end if;
  if r.status <> 'pending' then raise exception 'Bu onay isteği artık geçerli değil (içerik güncellenmiş veya karar verilmiş).' using errcode = 'P0001'; end if;
  if new.version_id is not null and new.version_id <> r.version_id then
    raise exception 'Eski bir sürüme karar verilemez; lütfen güncel sürümü inceleyin.' using errcode = 'P0001';
  end if;
  new.request_id := r.id;
  new.version_id := r.version_id;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists approvals_guard on public.approvals;
create trigger approvals_guard before insert on public.approvals for each row execute function public.approvals_guard();

-- 003'teki apply_approval + onay isteğinin kapatılması (aynı işlemde).
create or replace function public.apply_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.approval_requests set status = case when new.decision = 'approved' then 'approved' else 'revision_requested' end, closed_at = now()
  where id = new.request_id;
  perform set_config('cw.bypass', 'on', true);
  update public.tasks set status = case when new.decision = 'approved' then 'Onaylandı' else 'Revizyon' end where id = new.task_id;
  perform set_config('cw.bypass', 'off', true);
  return new;
end $$;

-- Görev müşteri onayından karar dışı bir yolla çıkarsa (ör. "Onaydan Geri Çek") bekleyen istek geri çekilir.
create or replace function public.ar_on_task_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'Müşteri Onayı' and new.status <> 'Müşteri Onayı' then
    update public.approval_requests set status = 'withdrawn', closed_at = now() where task_id = new.id and status = 'pending';
  end if;
  return null;
end $$;
drop trigger if exists tasks_approval_requests on public.tasks;
create trigger tasks_approval_requests after update of status on public.tasks for each row execute function public.ar_on_task_update();

-- Kilitli sürüm değişmez; açık taslakta yalnızca metin düzenlenir.
create or replace function public.cv_versions_guard() returns trigger
language plpgsql as $$
begin
  if current_setting('cw.bypass', true) = 'on' or auth.uid() is null then new.updated_at := now(); return new; end if;
  if old.locked_at is not null then raise exception 'Müşteriye gönderilmiş sürüm değiştirilemez; yeni sürüm oluşturun.' using errcode = '42501'; end if;
  if new.task_id is distinct from old.task_id or new.version_no is distinct from old.version_no or new.created_by is distinct from old.created_by
     or new.locked_at is distinct from old.locked_at or new.created_at is distinct from old.created_at then
    raise exception 'Sürüm bilgileri değiştirilemez.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists task_content_versions_guard on public.task_content_versions;
create trigger task_content_versions_guard before update on public.task_content_versions for each row execute function public.cv_versions_guard();

-- Kilitli sürümün dosyası silinemez (görev silinirken cascade hariç: görev satırı o anda yoktur).
create or replace function public.cv_assets_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and exists (select 1 from public.tasks where id = old.task_id)
     and not public.cv_version_open(old.task_id, old.version_id) then
    raise exception 'Müşteriye gönderilmiş sürümün dosyaları silinemez.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then raise exception 'Dosya kaydı değiştirilemez.' using errcode = '42501'; end if;
  return coalesce(new, old);
end $$;
drop trigger if exists task_content_assets_guard on public.task_content_assets;
create trigger task_content_assets_guard before update or delete on public.task_content_assets for each row execute function public.cv_assets_guard();

revoke execute on function public.approvals_guard() from public, anon, authenticated;
revoke execute on function public.ar_on_task_update() from public, anon, authenticated;
revoke execute on function public.cv_assets_guard() from public, anon, authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.task_content_versions enable row level security;
alter table public.task_content_assets   enable row level security;
alter table public.approval_requests     enable row level security;

create policy "task_content_versions: görünürlük" on public.task_content_versions for select to authenticated
  using (public.cv_team_can_read(task_id) or public.cv_client_can_see(id));
create policy "task_content_versions: metin düzenleme" on public.task_content_versions for update to authenticated
  using (public.cv_can_edit(task_id) and locked_at is null) with check (public.cv_can_edit(task_id));
create policy "task_content_versions: taslak silme" on public.task_content_versions for delete to authenticated
  using (public.cv_can_edit(task_id) and locked_at is null and not exists (select 1 from public.approval_requests r where r.version_id = id));

create policy "task_content_assets: görünürlük" on public.task_content_assets for select to authenticated
  using (public.cv_team_can_read(task_id) or public.cv_client_can_see(version_id));
create policy "task_content_assets: ekleme" on public.task_content_assets for insert to authenticated
  with check (public.cv_can_edit(task_id) and public.cv_version_open(task_id, version_id) and created_by = auth.uid());
create policy "task_content_assets: silme" on public.task_content_assets for delete to authenticated
  using (public.cv_can_edit(task_id) and public.cv_version_open(task_id, version_id));

create policy "approval_requests: görünürlük" on public.approval_requests for select to authenticated
  using (public.cv_team_can_read(task_id) or public.cv_client_can_see(version_id));

-- Müşteri kararı: yalnızca kendi markasındaki bekleyen isteğe, kendi adına (003 politikasının yerine).
drop policy if exists "approvals: müşteri karar verir" on public.approvals;
create policy "approvals: müşteri karar verir" on public.approvals for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() = 'client' and public.has_perm('canAccessApprovals')
              and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'Müşteri Onayı' and public.has_brand(t.brand_id)));

revoke insert, update, delete on public.approval_requests from anon, authenticated;
revoke insert on public.task_content_versions from anon, authenticated;
revoke update on public.task_content_assets from anon, authenticated;
revoke all on public.task_content_versions, public.task_content_assets, public.approval_requests from anon;

-- ───────────────────────── Storage ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-assets', 'content-assets', false, 52428800,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Yol: <görev id>/<sürüm id>/<dosya id>.<uzantı>. Okuma dosya kaydının görünürlüğüne bağlıdır (müşteri yalnızca gönderilmiş sürüm).
create policy "content-assets: görünürlük" on storage.objects for select to authenticated
  using (bucket_id = 'content-assets' and (
    exists (select 1 from public.task_content_assets a where a.storage_path = name)
    or public.cv_can_edit(public.cv_path_part(name, 1))));
create policy "content-assets: yükleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'content-assets' and public.cv_can_edit(public.cv_path_part(name, 1))
              and public.cv_version_open(public.cv_path_part(name, 1), public.cv_path_part(name, 2)));
create policy "content-assets: silme" on storage.objects for delete to authenticated
  using (bucket_id = 'content-assets' and public.cv_can_edit(public.cv_path_part(name, 1))
         and public.cv_version_open(public.cv_path_part(name, 1), public.cv_path_part(name, 2)));

-- ───────────────────────── Mevcut veriler ─────────────────────────

-- Şu an müşteri onayında olan görevler: v1 (dosyasız, eski akış) + bekleyen istek; geçmiş kararlar olduğu gibi kalır.
do $$
declare r record; v_id uuid;
begin
  for r in select t.id from public.tasks t where t.status = 'Müşteri Onayı'
           and not exists (select 1 from public.approval_requests a where a.task_id = t.id and a.status = 'pending') loop
    select id into v_id from public.task_content_versions where task_id = r.id order by version_no desc limit 1;
    if v_id is null then insert into public.task_content_versions (task_id, version_no, locked_at) values (r.id, 1, now()) returning id into v_id;
    else update public.task_content_versions set locked_at = coalesce(locked_at, now()) where id = v_id; end if;
    insert into public.approval_requests (task_id, version_id) values (r.id, v_id);
  end loop;
end $$;

-- ───────────────────────── Canlı güncelleme ─────────────────────────

alter publication supabase_realtime add table public.task_content_versions, public.task_content_assets, public.approval_requests;

commit;

-- Kontroller (isteğe bağlı):
--   select relname, relrowsecurity from pg_class where relname in ('task_content_versions', 'task_content_assets', 'approval_requests');
--   select slug, name from public.brands order by name;                -- müşteri onay bağlantıları: /musteri/<slug>
--   select id, public, file_size_limit from storage.buckets where id = 'content-assets';
