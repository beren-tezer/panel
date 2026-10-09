-- 007 geri alma — İçerik sürümleri, onay istekleri ve marka bağlantı adresi kaldırılır; 006/003 davranışı geri gelir.
-- DİKKAT: Sürüm kayıtları, sürüm dosyası kayıtları ve onay istekleri kalıcı olarak silinir. Müşteri kararları (approvals)
-- korunur (request_id / version_id sütunları kaldırılır). Önce panelin 007 öncesi sürümünü yayınlayın.
-- Kovadaki dosyaları Dashboard → Storage → content-assets üzerinden silin (dosya içerikleri SQL ile silinemez).

begin;

alter publication supabase_realtime drop table public.task_content_versions, public.task_content_assets, public.approval_requests;

drop policy if exists "content-assets: görünürlük" on storage.objects;
drop policy if exists "content-assets: yükleme" on storage.objects;
drop policy if exists "content-assets: silme" on storage.objects;

drop trigger if exists approvals_guard on public.approvals;
drop trigger if exists tasks_approval_requests on public.tasks;
drop index if exists public.approvals_one_per_request;
alter table public.approvals drop column if exists request_id;
alter table public.approvals drop column if exists version_id;

-- Tablolar birbirine (yabancı anahtar ve RLS politikası) bağlı olduğundan tek komutta kaldırılır.
drop table if exists public.task_content_assets, public.approval_requests, public.task_content_versions;

-- 003: müşteri kararı politikası ve tetikleyicisi
drop policy if exists "approvals: müşteri karar verir" on public.approvals;
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

-- 006: onaya gönderme (sürümsüz)
drop function if exists public.submit_task_for_approval(uuid, text, text, uuid);
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
revoke execute on function public.submit_task_for_approval(uuid, text, text) from public, anon;
grant execute on function public.submit_task_for_approval(uuid, text, text) to authenticated;

drop function if exists public.create_content_version(uuid);
drop function if exists public.approvals_guard();
drop function if exists public.ar_on_task_update();
drop function if exists public.cv_versions_guard();
drop function if exists public.cv_assets_guard();
drop function if exists public.cv_client_can_see(uuid);
drop function if exists public.cv_team_can_read(uuid);
drop function if exists public.cv_can_edit(uuid);
drop function if exists public.cv_version_open(uuid, uuid);
drop function if exists public.cv_path_part(text, int);

drop trigger if exists brands_slug on public.brands;
drop function if exists public.brands_slug();
drop index if exists public.brands_slug_key;
alter table public.brands drop constraint if exists brands_slug_format;
alter table public.brands drop column if exists slug;
drop function if exists public.cw_slugify(text);

-- Kova boşsa kaldırılır (doluysa bu satır hata verir; yukarıdaki nota bakın).
delete from storage.buckets where id = 'content-assets';

commit;
