-- 006 — İçerik Üretim Kontrol Listesi (kalite kontrol + onaya hazır olma)
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın (005'ten sonra). Geri almak için: 006_checklists_down.sql
-- SIRA: önce panelin yeni sürümünü yayınlayın (006 olmadan da çalışır, kontrol listesi gizli kalır), sonra bu dosyayı
-- çalıştırın ve paneli yenileyin. Eski panel bu dosyadan sonra onaya gönderemez (durum değişikliğini doğrudan yazar;
-- artık onaya gönderme yalnızca submit_task_for_approval ile yapılabilir).
--
-- Kurallar rbac.js ve checklist.js ile aynıdır:
--   Şablon      : marka başına (brand_id) veya tüm markalar için varsayılan (brand_id boş). Görev formatına
--                 (task_types; boş = tüm formatlar) göre seçilir. Yönetimi: admin; çalışan yalnızca permissions
--                 dizisinde açıkça 'canManageChecklists' varsa ve yalnızca kendi markalarında (varsayılan şablon: admin).
--   Görev listesi: görev oluşturulunca şablonun o anki maddeleri göreve KOPYALANIR (snapshot). Şablon sonradan
--                 değişse de mevcut görevlerin listesi ve tamamlanma kayıtları değişmez.
--   Revizyon    : görev "Revizyon" durumuna geçince yeni bir döngü (cycle) açılır; önceki döngü kapanır ve
--                 değiştirilemez. "Revizyonda yeniden kontrol" işaretli maddeler sıfırlanır, diğerleri taşınır.
--   Onaya gönderme: "Yönetici Onayı" / "Müşteri Onayı" durumuna yalnızca submit_task_for_approval ile geçilir.
--                 Zorunlu maddeler eksikse çalışan gönderemez; admin yalnızca gerekçe yazarak gönderebilir.
--   Görünürlük  : kontrol listeleri, notlar ve geçmiş yalnızca ekip (admin/çalışan) içindir; müşteriye hiç dönmez.
--   Denetim     : her işaretleme / not / gönderim / döngü kaydı task_checklist_events ve
--                 task_checklist_submissions tablolarına yazılır; bu tablolara istemciden yazılamaz.

begin;

-- ───────────────────────── Görev alanı ─────────────────────────

-- Yaratıcı üretim gerektirmeyen görevlerde admin kontrol listesini kapatabilir.
alter table public.tasks add column if not exists checklist_disabled boolean not null default false;

-- ───────────────────────── Tablolar ─────────────────────────

create table if not exists public.brand_checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid references public.brands (id) on delete cascade,            -- boş = tüm markalar (varsayılan)
  name        text not null check (length(trim(name)) between 1 and 120),
  task_types  text[] not null default '{}'                                     -- tasks.format değerleri; boş = tümü
              check (task_types <@ array['Reels', 'Gönderi', 'Hikâye', 'Karusel', 'Video', 'Web', 'Reklam', 'Rapor']),
  version     integer not null default 1,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists brand_checklist_templates_brand_idx on public.brand_checklist_templates (brand_id, is_active);

create table if not exists public.checklist_template_items (
  id                   uuid primary key default gen_random_uuid(),
  template_id          uuid not null references public.brand_checklist_templates (id) on delete cascade,
  title                text not null check (length(trim(title)) between 1 and 200),
  description          text not null default '' check (length(description) <= 1000),
  category             text not null default 'visual' check (category in ('visual', 'content', 'technical', 'other')),
  is_required          boolean not null default true,
  is_enabled           boolean not null default true,
  recheck_on_revision  boolean not null default true,
  sort_order           integer not null default 0
);
create index if not exists checklist_template_items_template_idx on public.checklist_template_items (template_id, sort_order);

-- Görevin kontrol listesi; her revizyon döngüsü ayrı bir kayıttır (cycle 0 = ilk teslim).
create table if not exists public.task_checklist_instances (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references public.tasks (id) on delete cascade,
  template_id       uuid references public.brand_checklist_templates (id) on delete set null,
  template_name     text not null,
  template_version  integer not null,
  cycle             integer not null default 0 check (cycle >= 0),
  created_at        timestamptz not null default now(),
  closed_at         timestamptz,                                               -- dolu = geçmiş döngü (salt okunur)
  unique (task_id, cycle)
);
create index if not exists task_checklist_instances_task_idx on public.task_checklist_instances (task_id, cycle desc);

create table if not exists public.task_checklist_items (
  id                     uuid primary key default gen_random_uuid(),
  checklist_instance_id  uuid not null references public.task_checklist_instances (id) on delete cascade,
  task_id                uuid not null references public.tasks (id) on delete cascade,  -- RLS ve canlı güncelleme filtresi için
  template_item_id       uuid,
  title_snapshot         text not null,
  description_snapshot   text not null default '',
  category               text not null default 'visual' check (category in ('visual', 'content', 'technical', 'other')),
  is_required            boolean not null default true,
  recheck_on_revision    boolean not null default true,
  is_completed           boolean not null default false,
  completed_by           uuid references public.profiles (id) on delete set null,
  completed_at           timestamptz,
  note                   text not null default '' check (length(note) <= 1000),
  sort_order             integer not null default 0,
  updated_at             timestamptz not null default now(),
  check (is_completed = (completed_at is not null))
);
create index if not exists task_checklist_items_instance_idx on public.task_checklist_items (checklist_instance_id, sort_order);
create index if not exists task_checklist_items_task_idx on public.task_checklist_items (task_id);

-- Denetim kaydı: kim, ne zaman, hangi kontrolü işaretledi / geri aldı / not yazdı; döngü açılışları.
create table if not exists public.task_checklist_events (
  id                     uuid primary key default gen_random_uuid(),
  task_id                uuid not null references public.tasks (id) on delete cascade,
  checklist_instance_id  uuid references public.task_checklist_instances (id) on delete cascade,
  item_id                uuid references public.task_checklist_items (id) on delete set null,
  item_title             text,
  user_id                uuid references public.profiles (id) on delete set null,
  kind                   text not null check (kind in ('completed', 'reopened', 'note', 'cycle', 'reset')),
  detail                 text not null default '',
  created_at             timestamptz not null default now()
);
create index if not exists task_checklist_events_task_idx on public.task_checklist_events (task_id, created_at desc);

-- Onaya gönderim kaydı (o andaki kontrol durumu ve varsa yönetici gerekçesi).
create table if not exists public.task_checklist_submissions (
  id                     uuid primary key default gen_random_uuid(),
  task_id                uuid not null references public.tasks (id) on delete cascade,
  checklist_instance_id  uuid references public.task_checklist_instances (id) on delete set null,
  cycle                  integer,
  from_status            text not null,
  target_status          text not null check (target_status in ('Yönetici Onayı', 'Müşteri Onayı')),
  submitted_by           uuid references public.profiles (id) on delete set null,
  total_items            integer not null default 0,
  done_items             integer not null default 0,
  required_total         integer not null default 0,
  required_done          integer not null default 0,
  override_reason        text,
  created_at             timestamptz not null default now()
);
create index if not exists task_checklist_submissions_task_idx on public.task_checklist_submissions (task_id, created_at desc);

-- ───────────────────────── Yetki yardımcıları ─────────────────────────

-- Şablon yönetimi. Varsayılan (markasız) şablonu yalnızca admin yönetir.
create or replace function public.cl_can_manage(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or (b is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'employee'
      and p.permissions is not null and 'canManageChecklists' = any (p.permissions)
      and (exists (select 1 from public.brand_members m where m.brand_id = b and m.user_id = p.id)
           or exists (select 1 from public.tasks t where t.brand_id = b and t.assignee_id = p.id))
  ));
$$;

-- Görevin kontrol listesini okuyabilir mi (ekip + görev görünürlüğü; müşteri asla).
create or replace function public.cl_can_read(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or (
    public.my_role() = 'employee' and coalesce(public.has_perm('canViewTasks'), false)
    and exists (select 1 from public.tasks t where t.id = p_task and t.assignee_id = auth.uid()));
$$;

-- Görevin kontrol listesinde işaretleme yapabilir mi.
create or replace function public.cl_can_work(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or (
    public.my_role() = 'employee' and coalesce(public.has_perm('canUpdateTasks'), false)
    and exists (select 1 from public.tasks t where t.id = p_task and t.assignee_id = auth.uid()));
$$;

-- ───────────────────────── Şablon seçimi ve göreve kopyalama (iç fonksiyonlar) ─────────────────────────

-- Öncelik: markanın formata özel şablonu → markanın genel şablonu → varsayılan formata özel → varsayılan genel.
create or replace function public.cl_pick_template(p_brand uuid, p_format text) returns uuid
language sql stable security definer set search_path = public as $$
  select t.id from public.brand_checklist_templates t
  where t.is_active and (t.brand_id = p_brand or t.brand_id is null)
    and (cardinality(t.task_types) = 0 or p_format = any (t.task_types))
    and exists (select 1 from public.checklist_template_items i where i.template_id = t.id and i.is_enabled)
  order by (t.brand_id is null), (cardinality(t.task_types) = 0), t.updated_at desc
  limit 1;
$$;

-- Şablonun etkin maddelerini göreve kopyalar. Uygun şablon yoksa veya liste kapalıysa null döner.
create or replace function public.cl_instantiate(p_task uuid, p_cycle integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  tpl public.brand_checklist_templates;
  v_id uuid;
begin
  select * into t from public.tasks where id = p_task;
  if not found or t.checklist_disabled then return null; end if;
  select * into tpl from public.brand_checklist_templates where id = public.cl_pick_template(t.brand_id, t.format);
  if not found then return null; end if;
  insert into public.task_checklist_instances (task_id, template_id, template_name, template_version, cycle)
  values (p_task, tpl.id, tpl.name, tpl.version, p_cycle) returning id into v_id;
  insert into public.task_checklist_items (checklist_instance_id, task_id, template_item_id, title_snapshot, description_snapshot,
                                           category, is_required, recheck_on_revision, sort_order)
  select v_id, p_task, i.id, i.title, i.description, i.category, i.is_required, i.recheck_on_revision,
         row_number() over (order by i.sort_order, i.id) - 1
  from public.checklist_template_items i where i.template_id = tpl.id and i.is_enabled;
  return v_id;
end $$;

-- Görevin güncel (açık) döngüsü.
create or replace function public.cl_current(p_task uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.task_checklist_instances where task_id = p_task order by cycle desc limit 1;
$$;

-- Bu fonksiyonlar yetki kontrolü yapmaz: istemciden (RPC) çağrılamaz, yalnızca aşağıdaki fonksiyon ve tetikleyiciler kullanır.
revoke execute on function public.cl_pick_template(uuid, text) from public, anon, authenticated;
revoke execute on function public.cl_instantiate(uuid, integer) from public, anon, authenticated;
revoke execute on function public.cl_current(uuid) from public, anon, authenticated;

-- ───────────────────────── İstemci fonksiyonları (RPC) ─────────────────────────

-- Görev açıldığında: listesi yoksa (eski görev, sonradan eklenen şablon) oluşturur. Güncel döngünün kimliğini döner.
create or replace function public.ensure_task_checklist(p_task uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_disabled boolean;
begin
  if not public.cl_can_read(p_task) then
    raise exception 'Bu görevin kontrol listesine erişim yetkiniz yok.' using errcode = '42501';
  end if;
  v_id := public.cl_current(p_task);
  if v_id is not null then return v_id; end if;
  select checklist_disabled into v_disabled from public.tasks where id = p_task for update;
  v_id := public.cl_current(p_task); -- kilit beklenirken başka bir istek oluşturmuş olabilir
  if v_id is not null or v_disabled then return v_id; end if;
  return public.cl_instantiate(p_task, 0);
end $$;

-- Onaya gönderme: tek işlemde (atomik) yetki + zorunlu kontrol doğrulaması + gönderim kaydı + durum değişikliği.
-- Görev satırı kilitlenir; aynı anda gelen ikinci gönderim "zaten bu aşamada" hatası alır.
create or replace function public.submit_task_for_approval(p_task uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  v_uid uuid := auth.uid();
  v_admin boolean := coalesce(public.is_admin(), false);
  v_inst public.task_checklist_instances;
  v_total integer := 0; v_done integer := 0; v_req integer := 0; v_req_done integer := 0;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_uid is null then raise exception 'Oturum gerekli.' using errcode = '42501'; end if;
  if p_status not in ('Yönetici Onayı', 'Müşteri Onayı') then
    raise exception 'Geçersiz onay aşaması.' using errcode = '22023';
  end if;
  select * into t from public.tasks where id = p_task for update;
  if not found then raise exception 'Görev bulunamadı.' using errcode = 'P0002'; end if;
  if not v_admin and not (public.my_role() = 'employee' and t.assignee_id = v_uid
                          and coalesce(public.has_perm('canUpdateTasks'), false) and coalesce(public.has_perm('canEditContent'), false)) then
    raise exception 'Bu görevi onaya gönderme yetkiniz yok.' using errcode = '42501';
  end if;
  if t.status = p_status then
    raise exception 'İçerik zaten “%” aşamasında.', p_status using errcode = 'P0001';
  end if;
  if t.status in ('Onaylandı', 'Tamamlandı') and not v_admin then
    raise exception 'Onaylanmış içerik tekrar onaya gönderilemez.' using errcode = '42501';
  end if;

  if not t.checklist_disabled then
    if public.cl_current(p_task) is null then perform public.cl_instantiate(p_task, 0); end if;
    select * into v_inst from public.task_checklist_instances where id = public.cl_current(p_task);
    if found then
      select count(*), count(*) filter (where is_completed), count(*) filter (where is_required),
             count(*) filter (where is_required and is_completed)
        into v_total, v_done, v_req, v_req_done
      from public.task_checklist_items where checklist_instance_id = v_inst.id;
      if v_req_done < v_req then
        if not v_admin then
          raise exception 'İçeriği onaya göndermeden önce % zorunlu kontrolü tamamlamalısınız.', v_req - v_req_done
            using errcode = 'P0001', detail = 'checklist_incomplete', hint = (v_req - v_req_done)::text;
        end if;
        if v_reason is null then
          raise exception 'Eksik zorunlu kontrollerle göndermek için gerekçe yazmalısınız.' using errcode = 'P0001', detail = 'reason_required';
        end if;
      else
        v_reason := null; -- gerekçe yalnızca eksik kontrol atlandığında kaydedilir
      end if;
    end if;
  else
    v_reason := null;
  end if;

  insert into public.task_checklist_submissions (task_id, checklist_instance_id, cycle, from_status, target_status, submitted_by,
                                                 total_items, done_items, required_total, required_done, override_reason)
  values (p_task, v_inst.id, v_inst.cycle, t.status, p_status, v_uid, v_total, v_done, v_req, v_req_done, v_reason);

  perform set_config('cw.bypass', 'on', true);
  update public.tasks set status = p_status where id = p_task;
  perform set_config('cw.bypass', 'off', true);

  return jsonb_build_object('status', p_status, 'cycle', v_inst.cycle, 'required_total', v_req, 'required_done', v_req_done,
                            'override', v_reason is not null);
end $$;

-- Şablonu maddeleriyle birlikte tek işlemde kaydeder; her kayıtta sürüm bir artar.
-- p: { id?, brand_id?, name, task_types[], is_active, items: [{ id?, title, description, category, is_required, is_enabled, recheck_on_revision }] }
create or replace function public.save_checklist_template(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid());
  v_brand uuid := nullif(p ->> 'brand_id', '')::uuid;
  v_existing public.brand_checklist_templates;
  v_items jsonb := coalesce(p -> 'items', '[]'::jsonb);
  v_types text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'task_types', '[]'::jsonb))), '{}');
  v_keep uuid[];
begin
  if not public.cl_can_manage(v_brand) then
    raise exception 'Kontrol listesi şablonlarını düzenleme yetkiniz yok.' using errcode = '42501';
  end if;
  select * into v_existing from public.brand_checklist_templates where id = v_id for update;
  if found and v_existing.brand_id is distinct from v_brand then
    raise exception 'Şablon başka bir markaya taşınamaz.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Şablonda en az bir kontrol maddesi olmalı.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_items) > 60 then
    raise exception 'Bir şablonda en fazla 60 madde olabilir.' using errcode = '22023';
  end if;

  insert into public.brand_checklist_templates (id, brand_id, name, task_types, is_active)
  values (v_id, v_brand, trim(p ->> 'name'), v_types, coalesce((p ->> 'is_active')::boolean, true))
  on conflict (id) do update set name = excluded.name, task_types = excluded.task_types, is_active = excluded.is_active,
    version = brand_checklist_templates.version + 1, updated_at = now(), updated_by = auth.uid();

  -- Madde kimlikleri yalnızca bu şablona ait olabilir (başka şablonun maddesi ele geçirilemez).
  select coalesce(array_agg(x.id), '{}') into v_keep
  from (select nullif(e ->> 'id', '')::uuid as id from jsonb_array_elements(v_items) e) x
  where x.id is not null and (v_existing.id is null
        or exists (select 1 from public.checklist_template_items i where i.id = x.id and i.template_id = v_id));
  delete from public.checklist_template_items where template_id = v_id and not (id = any (v_keep));

  insert into public.checklist_template_items (id, template_id, title, description, category, is_required, is_enabled, recheck_on_revision, sort_order)
  select case when nullif(e ->> 'id', '')::uuid = any (v_keep) then (e ->> 'id')::uuid else gen_random_uuid() end,
         v_id, trim(e ->> 'title'), coalesce(e ->> 'description', ''), coalesce(e ->> 'category', 'visual'),
         coalesce((e ->> 'is_required')::boolean, true), coalesce((e ->> 'is_enabled')::boolean, true),
         coalesce((e ->> 'recheck_on_revision')::boolean, true), (n - 1)::integer
  from jsonb_array_elements(v_items) with ordinality as x(e, n)
  on conflict (id) do update set title = excluded.title, description = excluded.description, category = excluded.category,
    is_required = excluded.is_required, is_enabled = excluded.is_enabled, recheck_on_revision = excluded.recheck_on_revision,
    sort_order = excluded.sort_order;
  return v_id;
end $$;

-- Fonksiyonlar varsayılan olarak herkese (PUBLIC) açıktır; yalnızca giriş yapmış kullanıcılar çağırabilir.
revoke execute on function public.ensure_task_checklist(uuid) from public, anon;
revoke execute on function public.submit_task_for_approval(uuid, text, text) from public, anon;
revoke execute on function public.save_checklist_template(jsonb) from public, anon;
grant execute on function public.ensure_task_checklist(uuid) to authenticated;
grant execute on function public.submit_task_for_approval(uuid, text, text) to authenticated;
grant execute on function public.save_checklist_template(jsonb) to authenticated;

-- ───────────────────────── Tetikleyiciler ─────────────────────────

-- Görevler: onay aşamalarına doğrudan geçiş engellenir (yalnızca submit_task_for_approval); kontrol listesini
-- kapatmak yalnızca admine açıktır. 004'teki koruma kurallarının tamamı korunur.
create or replace function public.tasks_guard() returns trigger
language plpgsql as $$
begin
  -- auth.uid() boşsa istek bir kullanıcıdan değil, servis anahtarından veya SQL Editor'dan gelir.
  if auth.uid() is null or current_setting('cw.bypass', true) = 'on' then return new; end if;
  if new.status is distinct from old.status and new.status in ('Yönetici Onayı', 'Müşteri Onayı') then
    raise exception 'İçerik yalnızca “Onaya Gönder” ile onaya gönderilebilir (kontrol listesi doğrulaması).' using errcode = '42501';
  end if;
  if public.is_admin() then return new; end if;
  if new.assignee_id is distinct from old.assignee_id or new.brand_id is distinct from old.brand_id
     or new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time
     or new.priority is distinct from old.priority or new.checklist_disabled is distinct from old.checklist_disabled then
    raise exception 'Atama, marka, son teslim, öncelik ve kontrol listesi ayarı yalnızca yöneticiler tarafından değiştirilebilir.' using errcode = '42501';
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

-- Yeni görev: uygun şablon varsa kontrol listesi hemen oluşturulur.
create or replace function public.cl_on_task_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.cl_instantiate(new.id, 0);
  return null;
end $$;
drop trigger if exists tasks_checklist_insert on public.tasks;
create trigger tasks_checklist_insert after insert on public.tasks for each row execute function public.cl_on_task_insert();

-- Görev değişince:
--   • "Revizyon"a geçiş → yeni döngü (önceki kapanır; yeniden kontrol gerektirmeyen maddeler tamamlanmış olarak taşınır)
--   • format / marka değişti ve listede henüz hiçbir işaret yok → güncel şablondan yeniden oluşturulur
--   • liste yeniden açıldı (checklist_disabled true → false) → yoksa oluşturulur
create or replace function public.cl_on_task_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cur public.task_checklist_instances;
  v_new uuid;
begin
  select * into cur from public.task_checklist_instances where id = public.cl_current(new.id);

  if new.status = 'Revizyon' and old.status is distinct from 'Revizyon' then
    if cur.id is null then
      perform public.cl_instantiate(new.id, 0);
    else
      update public.task_checklist_instances set closed_at = now() where id = cur.id;
      insert into public.task_checklist_instances (task_id, template_id, template_name, template_version, cycle)
      values (new.id, cur.template_id, cur.template_name, cur.template_version, cur.cycle + 1) returning id into v_new;
      insert into public.task_checklist_items (checklist_instance_id, task_id, template_item_id, title_snapshot, description_snapshot,
                                               category, is_required, recheck_on_revision, is_completed, completed_by, completed_at, note, sort_order)
      select v_new, new.id, i.template_item_id, i.title_snapshot, i.description_snapshot, i.category, i.is_required, i.recheck_on_revision,
             i.is_completed and not i.recheck_on_revision,
             case when i.is_completed and not i.recheck_on_revision then i.completed_by end,
             case when i.is_completed and not i.recheck_on_revision then i.completed_at end,
             '', i.sort_order
      from public.task_checklist_items i where i.checklist_instance_id = cur.id;
      insert into public.task_checklist_events (task_id, checklist_instance_id, user_id, kind, detail)
      values (new.id, v_new, auth.uid(), 'cycle', format('Revizyon %s başladı', cur.cycle + 1));
    end if;
    return null;
  end if;

  if (new.format is distinct from old.format or new.brand_id is distinct from old.brand_id) and cur.id is not null
     and cur.closed_at is null
     and not exists (select 1 from public.task_checklist_items where checklist_instance_id = cur.id and (is_completed or note <> ''))
     and not exists (select 1 from public.task_checklist_submissions where checklist_instance_id = cur.id) then
    delete from public.task_checklist_instances where id = cur.id;
    perform public.cl_instantiate(new.id, cur.cycle);
    return null;
  end if;

  if old.checklist_disabled and not new.checklist_disabled and cur.id is null then
    perform public.cl_instantiate(new.id, 0);
  end if;
  return null;
end $$;
drop trigger if exists tasks_checklist_update on public.tasks;
create trigger tasks_checklist_update after update of status, format, brand_id, checklist_disabled on public.tasks
  for each row execute function public.cl_on_task_update();

-- Görev kontrol maddeleri: yalnızca işaret ve not değiştirilebilir; tamamlayan kişi ve zaman sunucuda yazılır.
create or replace function public.cl_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_inst public.task_checklist_instances;
  v_status text;
  v_admin boolean;
begin
  if auth.uid() is null or current_setting('cw.bypass', true) = 'on' then return new; end if;
  v_admin := coalesce(public.is_admin(), false);
  if new.checklist_instance_id is distinct from old.checklist_instance_id or new.task_id is distinct from old.task_id
     or new.template_item_id is distinct from old.template_item_id or new.title_snapshot is distinct from old.title_snapshot
     or new.description_snapshot is distinct from old.description_snapshot or new.category is distinct from old.category
     or new.is_required is distinct from old.is_required or new.recheck_on_revision is distinct from old.recheck_on_revision
     or new.sort_order is distinct from old.sort_order then
    raise exception 'Kontrol maddesinin içeriği görevde değiştirilemez; şablonu düzenleyin.' using errcode = '42501';
  end if;
  select * into v_inst from public.task_checklist_instances where id = new.checklist_instance_id;
  if v_inst.closed_at is not null then
    raise exception 'Bu kontrol listesi önceki bir revizyon döngüsüne ait; değiştirilemez.' using errcode = '42501';
  end if;
  select status into v_status from public.tasks where id = new.task_id;
  if not v_admin and v_status in ('Yönetici Onayı', 'Müşteri Onayı', 'Onaylandı', 'Tamamlandı') then
    raise exception 'İçerik onaya gönderildiği için kontroller kilitli.' using errcode = '42501';
  end if;
  if new.is_completed is distinct from old.is_completed then
    if new.is_completed then
      new.completed_by := auth.uid(); new.completed_at := now();
    else
      if old.completed_by is distinct from auth.uid() and not v_admin then
        raise exception 'Başka bir kullanıcının tamamladığı kontrolü yalnızca yönetici geri alabilir.' using errcode = '42501';
      end if;
      new.completed_by := null; new.completed_at := null;
    end if;
  else
    new.completed_by := old.completed_by; new.completed_at := old.completed_at;
  end if;
  new.note := trim(new.note);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists task_checklist_items_guard on public.task_checklist_items;
create trigger task_checklist_items_guard before update on public.task_checklist_items for each row execute function public.cl_items_guard();

create or replace function public.cl_items_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_completed is distinct from old.is_completed then
    insert into public.task_checklist_events (task_id, checklist_instance_id, item_id, item_title, user_id, kind)
    values (new.task_id, new.checklist_instance_id, new.id, new.title_snapshot, auth.uid(), case when new.is_completed then 'completed' else 'reopened' end);
  end if;
  if new.note is distinct from old.note then
    insert into public.task_checklist_events (task_id, checklist_instance_id, item_id, item_title, user_id, kind, detail)
    values (new.task_id, new.checklist_instance_id, new.id, new.title_snapshot, auth.uid(), 'note', new.note);
  end if;
  return null;
end $$;
drop trigger if exists task_checklist_items_audit on public.task_checklist_items;
create trigger task_checklist_items_audit after update on public.task_checklist_items for each row execute function public.cl_items_audit();

create or replace function public.cl_templates_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists brand_checklist_templates_touch on public.brand_checklist_templates;
create trigger brand_checklist_templates_touch before update on public.brand_checklist_templates for each row execute function public.cl_templates_touch();

revoke execute on function public.cl_on_task_insert() from public, anon, authenticated;
revoke execute on function public.cl_on_task_update() from public, anon, authenticated;
revoke execute on function public.cl_items_audit() from public, anon, authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.brand_checklist_templates  enable row level security;
alter table public.checklist_template_items   enable row level security;
alter table public.task_checklist_instances   enable row level security;
alter table public.task_checklist_items       enable row level security;
alter table public.task_checklist_events      enable row level security;
alter table public.task_checklist_submissions enable row level security;

-- Şablonlar: yalnızca yönetebilenler okur; ekleme/güncelleme save_checklist_template ile, silme politikayla.
create policy "brand_checklist_templates: görünürlük" on public.brand_checklist_templates for select to authenticated
  using (public.cl_can_manage(brand_id));
create policy "brand_checklist_templates: silme" on public.brand_checklist_templates for delete to authenticated
  using (public.cl_can_manage(brand_id));
create policy "checklist_template_items: görünürlük" on public.checklist_template_items for select to authenticated
  using (exists (select 1 from public.brand_checklist_templates t where t.id = template_id));

-- Görev listeleri ve geçmiş: ekip, görevi görebiliyorsa. Müşteri hiçbirini göremez.
create policy "task_checklist_instances: görünürlük" on public.task_checklist_instances for select to authenticated
  using (public.cl_can_read(task_id));
create policy "task_checklist_items: görünürlük" on public.task_checklist_items for select to authenticated
  using (public.cl_can_read(task_id));
create policy "task_checklist_items: işaretleme" on public.task_checklist_items for update to authenticated
  using (public.cl_can_work(task_id)) with check (public.cl_can_work(task_id));
create policy "task_checklist_events: görünürlük" on public.task_checklist_events for select to authenticated
  using (public.cl_can_read(task_id));
create policy "task_checklist_submissions: görünürlük" on public.task_checklist_submissions for select to authenticated
  using (public.cl_can_read(task_id));

-- Doğrudan yazma izni yalnızca madde güncellemesi ve şablon silme için (diğerleri fonksiyonlar üzerinden).
revoke insert, update, delete on public.task_checklist_instances, public.task_checklist_events, public.task_checklist_submissions,
  public.checklist_template_items from anon, authenticated;
revoke insert, update on public.brand_checklist_templates from anon, authenticated;
revoke insert, delete on public.task_checklist_items from anon, authenticated;
revoke all on public.brand_checklist_templates, public.checklist_template_items, public.task_checklist_instances,
  public.task_checklist_items, public.task_checklist_events, public.task_checklist_submissions from anon;

-- ───────────────────────── Varsayılan şablon ─────────────────────────

do $$
declare v_id uuid;
begin
  if not exists (select 1 from public.brand_checklist_templates where brand_id is null) then
    insert into public.brand_checklist_templates (brand_id, name, task_types, created_by, updated_by)
    values (null, 'Varsayılan Kontrol Listesi', array['Reels', 'Gönderi', 'Hikâye', 'Karusel', 'Video', 'Web', 'Reklam'], null, null)
    returning id into v_id;
    insert into public.checklist_template_items (template_id, title, category, is_required, sort_order)
    values
      (v_id, 'Marka renkleri doğru kullanıldı.', 'visual', true, 0),
      (v_id, 'Doğru font ailesi kullanıldı.', 'visual', true, 1),
      (v_id, 'Logo kullanım kurallarına uyuldu.', 'visual', true, 2),
      (v_id, 'Tasarım marka kimliğiyle tutarlı.', 'visual', false, 3),
      (v_id, 'Yazım ve imla kontrolü yapıldı.', 'content', true, 4),
      (v_id, 'Marka iletişim diline uyuldu.', 'content', true, 5),
      (v_id, 'Müşteri özel talepleri karşılandı.', 'content', true, 6),
      (v_id, 'İçerikte yasaklı ifadeler kullanılmadı.', 'content', true, 7),
      (v_id, 'Görsel boyutları doğru.', 'technical', true, 8),
      (v_id, 'Dosya formatı uygun.', 'technical', true, 9),
      (v_id, 'İçerik önizlemesi kontrol edildi.', 'technical', false, 10),
      (v_id, 'Gerekli dosyalar göreve yüklendi.', 'technical', true, 11);
  end if;
end $$;

-- Mevcut açık görevlere kontrol listesi (onaylanmış / tamamlanmış görevlere eklenmez).
select public.cl_instantiate(t.id, 0) from public.tasks t
where t.status not in ('Onaylandı', 'Tamamlandı')
  and not exists (select 1 from public.task_checklist_instances i where i.task_id = t.id);

-- ───────────────────────── Canlı güncelleme ─────────────────────────

alter publication supabase_realtime add table
  public.task_checklist_instances, public.task_checklist_items, public.task_checklist_submissions;

commit;

-- ───────────────────────── Kontroller (isteğe bağlı) ─────────────────────────
-- 6 tablo, hepsi RLS açık olmalı:
--   select relname, relrowsecurity from pg_class where relname in ('brand_checklist_templates', 'checklist_template_items',
--     'task_checklist_instances', 'task_checklist_items', 'task_checklist_events', 'task_checklist_submissions') order by 1;
-- Açık görevlerin kontrol listesi durumu:
--   select t.title, i.cycle, count(x.*) filter (where x.is_completed) || '/' || count(x.*) as ilerleme
--   from public.tasks t join public.task_checklist_instances i on i.task_id = t.id and i.closed_at is null
--   join public.task_checklist_items x on x.checklist_instance_id = i.id group by 1, 2 order by 1;
