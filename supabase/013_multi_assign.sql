-- 013_multi_assign.sql — Çoklu "Görevi Yapan" ve çoklu "Platform"
--
-- YENİ PANEL DERLEMESİ YÜKLENMEDEN ÖNCE çalıştırın (011 ve 012'den sonra). Veri silmez, sütun kaldırmaz:
--
--   1. tasks.assignee_ids uuid[] : görevi yapan TÜM kişiler (sıralı; ilki "birincil" kişi)
--      tasks.platforms    text[] : görevin TÜM platformları (sıralı)
--      Mevcut görevler: assignee_id → assignee_ids = {assignee_id}, platform → platforms = {platform} (updated_at değişmez).
--   2. Eski tek değerli sütunlar (assignee_id, platform) kalır ve her zaman listenin ilk elemanıdır (tasks_people_sync):
--      yeni panel listeleri yazar → ilk eleman tek sütuna kopyalanır; eski panel tek sütunu yazar → liste buna göre güncellenir
--      (diğer kişiler korunur). Böylece SQL çalıştırıldıktan sonra eski panel de çalışmaya devam eder.
--   3. Görünürlük / yetki: "assignee_id = ben" olan her kural "ben ∈ assignee_ids" olur
--      (görev görünürlüğü ve güncelleme, profil görünürlüğü, bildirim gönderme, marka kılavuzu, kontrol listesi,
--      içerik sürümü düzenleme, onaya gönderme). Çalışan görevi yapanları ve platformları yine değiştiremez (tasks_guard).
--   4. Bir profil silinirse kişi tüm görev listelerinden çıkarılır (diğer kişiler kalır).
--
-- Tekrar çalıştırmak güvenlidir. Sonda doğrulama satırı döner (hepsi true olmalı).

begin;

-- 1. Sütunlar ve mevcut verinin taşınması
alter table public.tasks add column if not exists assignee_ids uuid[] not null default '{}';
alter table public.tasks add column if not exists platforms text[] not null default '{}';

alter table public.tasks disable trigger tasks_touch_updated_at; -- taşıma "son güncelleme" tarihlerini değiştirmesin
update public.tasks set assignee_ids = array[assignee_id] where assignee_id is not null and cardinality(assignee_ids) = 0;
update public.tasks set platforms = array[platform] where platform is not null and cardinality(platforms) = 0;
alter table public.tasks enable trigger tasks_touch_updated_at;

alter table public.tasks drop constraint if exists tasks_assignee_ids_check;
alter table public.tasks add constraint tasks_assignee_ids_check check (array_position(assignee_ids, null) is null);
alter table public.tasks drop constraint if exists tasks_platforms_check;
alter table public.tasks add constraint tasks_platforms_check check (platforms <@ array[
  'Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'YouTube', 'Web Sitesi', 'Meta Reklam', 'Google Reklam']::text[]);
create index if not exists tasks_assignee_ids_idx on public.tasks using gin (assignee_ids);

-- 2. Liste ↔ tek sütun eşitlemesi + kişilerin geçerliliği
create or replace function public.tasks_people_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if cardinality(new.assignee_ids) = 0 and new.assignee_id is not null then new.assignee_ids := array[new.assignee_id]; end if;
    if cardinality(new.platforms) = 0 and new.platform is not null then new.platforms := array[new.platform]; end if;
  else
    if new.assignee_ids is not distinct from old.assignee_ids and new.assignee_id is distinct from old.assignee_id then
      -- Tek sütun değişti (eski panel / silinen profil): birincil kişi değişir, diğer kişiler korunur.
      new.assignee_ids := array_remove(old.assignee_ids, old.assignee_id);
      if new.assignee_id is not null then new.assignee_ids := array[new.assignee_id] || array_remove(new.assignee_ids, new.assignee_id); end if;
    end if;
    if new.platforms is not distinct from old.platforms and new.platform is distinct from old.platform then
      new.platforms := array_remove(old.platforms, old.platform);
      if new.platform is not null then new.platforms := array[new.platform] || array_remove(new.platforms, new.platform); end if;
    end if;
  end if;
  -- Tekrarlar ayıklanır (ilk görülme sırası korunur).
  new.assignee_ids := coalesce((select array_agg(x order by i) from (select distinct on (x) x, i from unnest(new.assignee_ids) with ordinality u(x, i) order by x, i) d), '{}');
  new.platforms := coalesce((select array_agg(x order by i) from (select distinct on (x) x, i from unnest(new.platforms) with ordinality u(x, i) order by x, i) d), '{}');
  new.assignee_id := new.assignee_ids[1];
  new.platform := new.platforms[1];
  if (tg_op = 'INSERT' or new.assignee_ids is distinct from old.assignee_ids)
     and exists (select 1 from unnest(new.assignee_ids) a(id) where not exists (select 1 from public.profiles p where p.id = a.id)) then
    raise exception 'Görevi yapan kişilerden biri bulunamadı.' using errcode = '23503';
  end if;
  return new;
end $$;
drop trigger if exists tasks_people_sync on public.tasks;
create trigger tasks_people_sync before insert or update on public.tasks
  for each row execute function public.tasks_people_sync();

-- 4. Silinen profil tüm görev listelerinden çıkarılır (birincil kişi ise sıradaki kişi birincil olur).
create or replace function public.profiles_remove_from_tasks() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.tasks set assignee_ids = array_remove(assignee_ids, old.id) where old.id = any (assignee_ids);
  return old;
end $$;
drop trigger if exists profiles_remove_from_tasks on public.profiles;
create trigger profiles_remove_from_tasks before delete on public.profiles
  for each row execute function public.profiles_remove_from_tasks();

-- 3. Yetki kuralları: "assignee_id = ben" → "ben ∈ assignee_ids"
drop policy if exists "tasks: görünürlük" on public.tasks;
create policy "tasks: görünürlük" on public.tasks for select to authenticated using (
  public.is_admin()
  or (public.my_role() = 'employee' and public.has_perm('canViewTasks') and auth.uid() = any (assignee_ids))
  or (public.my_role() = 'client' and public.has_perm('canViewContent') and public.has_brand(brand_id)
      and status in ('Müşteri Onayı', 'Revizyon', 'Onaylandı', 'Tamamlandı'))
);
drop policy if exists "tasks: güncelleme" on public.tasks;
create policy "tasks: güncelleme" on public.tasks for update to authenticated
  using (public.is_admin() or (public.my_role() = 'employee' and auth.uid() = any (assignee_ids) and public.has_perm('canUpdateTasks')))
  with check (public.is_admin() or (public.my_role() = 'employee' and auth.uid() = any (assignee_ids)));

-- 008'deki profil görünürlüğü (yalnızca görev koşulu değişti)
drop policy if exists "profiles: görünürlük" on public.profiles;
create policy "profiles: görünürlük" on public.profiles for select to authenticated using (
  public.is_admin() or id = auth.uid()
  or (public.my_role() = 'employee' and role = 'admin')
  or (
    public.my_role() is not null and (public.my_role() <> 'client' or role in ('admin', 'employee'))
    and (
      exists (select 1 from public.brand_members a join public.brand_members b on a.brand_id = b.brand_id
              where a.user_id = auth.uid() and b.user_id = profiles.id)
      or exists (select 1 from public.tasks t where profiles.id = any (t.assignee_ids))
    )
  )
);

create or replace function public.can_notify(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null and (
    exists (select 1 from public.profiles where id = target and role = 'admin' and active)
    or exists (select 1 from public.brand_members a join public.brand_members b on a.brand_id = b.brand_id
               where a.user_id = auth.uid() and b.user_id = target)
    or exists (select 1 from public.tasks t where target = any (t.assignee_ids)
               and (auth.uid() = any (t.assignee_ids) or public.has_brand(t.brand_id)))
    or exists (select 1 from public.tasks t join public.brand_members m on m.brand_id = t.brand_id
               where auth.uid() = any (t.assignee_ids) and m.user_id = target)
  );
$$;

create or replace function public.kit_can_edit(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'employee'
      and p.permissions is not null and 'canEditBrandKit' = any (p.permissions)
      and (exists (select 1 from public.brand_members m where m.brand_id = b and m.user_id = p.id)
           or exists (select 1 from public.tasks t where t.brand_id = b and p.id = any (t.assignee_ids)))
  );
$$;

create or replace function public.cl_can_manage(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or (b is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'employee'
      and p.permissions is not null and 'canManageChecklists' = any (p.permissions)
      and (exists (select 1 from public.brand_members m where m.brand_id = b and m.user_id = p.id)
           or exists (select 1 from public.tasks t where t.brand_id = b and p.id = any (t.assignee_ids)))
  ));
$$;

create or replace function public.cl_can_read(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or (
    public.my_role() = 'employee' and coalesce(public.has_perm('canViewTasks'), false)
    and exists (select 1 from public.tasks t where t.id = p_task and auth.uid() = any (t.assignee_ids)));
$$;

create or replace function public.cl_can_work(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or (
    public.my_role() = 'employee' and coalesce(public.has_perm('canUpdateTasks'), false)
    and exists (select 1 from public.tasks t where t.id = p_task and auth.uid() = any (t.assignee_ids)));
$$;

create or replace function public.cv_can_edit(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_admin(), false) or (
    public.my_role() = 'employee' and coalesce(public.has_perm('canEditContent'), false)
    and exists (select 1 from public.tasks t where t.id = p_task and auth.uid() = any (t.assignee_ids)));
$$;

-- 007'deki onaya gönderme (yalnızca "görevin sorumlusu" koşulu değişti)
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
  if not v_admin and not (public.my_role() = 'employee' and v_uid = any (t.assignee_ids)
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

-- 012'deki koruma + listeler: çalışan görevi yapanları değiştiremez; platform listesi "İçerik düzenleme" izni ister.
create or replace function public.tasks_guard() returns trigger
language plpgsql as $$
begin
  -- auth.uid() boşsa istek bir kullanıcıdan değil, servis anahtarından veya SQL Editor'dan gelir.
  if auth.uid() is null or current_setting('cw.bypass', true) = 'on' then return new; end if;
  if new.status is distinct from old.status and new.status in ('Yönetici Onayı', 'Müşteri Onayı') then
    raise exception 'İçerik yalnızca “Onaya Gönder” ile onaya gönderilebilir (kontrol listesi doğrulaması).' using errcode = '42501';
  end if;
  if public.is_admin() then return new; end if;
  if new.assignee_id is distinct from old.assignee_id or new.assignee_ids is distinct from old.assignee_ids
     or new.reporter_id is distinct from old.reporter_id or new.brand_id is distinct from old.brand_id
     or new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time
     or new.priority is distinct from old.priority or new.checklist_disabled is distinct from old.checklist_disabled then
    raise exception 'Atama, görevi veren, marka, son teslim, öncelik ve kontrol listesi ayarı yalnızca yöneticiler tarafından değiştirilebilir.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and (new.status = 'Onaylandı' or (old.status = 'Onaylandı' and new.status <> 'Tamamlandı')) then
    raise exception 'Onay durumunu yalnızca müşteri veya yönetici değiştirebilir.' using errcode = '42501';
  end if;
  if not public.has_perm('canEditContent') and (new.title is distinct from old.title or new.description is distinct from old.description
     or new.platform is distinct from old.platform or new.platforms is distinct from old.platforms
     or new.format is distinct from old.format or new.publish_date is distinct from old.publish_date) then
    raise exception 'İçerik düzenleme yetkiniz yok.' using errcode = '42501';
  end if;
  return new;
end $$;

commit;

-- Doğrulama: hepsi true olmalı.
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'assignee_ids') as coklu_sorumlu_alani,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'platforms')    as coklu_platform_alani,
  not exists (select 1 from public.tasks where assignee_id is not null and not (assignee_id = any (assignee_ids)))                              as sorumlular_tasindi,
  not exists (select 1 from public.tasks where platform is not null and not (platform = any (platforms)))                                      as platformlar_tasindi,
  exists (select 1 from pg_trigger where tgname = 'tasks_people_sync')                                                                         as esitleme_kurali,
  pg_get_expr(p.polqual, p.polrelid) like '%assignee_ids%'                                                                                     as gorunurluk_guncel
from pg_policy p
where p.polrelid = 'public.tasks'::regclass and p.polname = 'tasks: görünürlük';
