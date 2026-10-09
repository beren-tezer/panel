-- 006 geri alma — Kontrol listesi tablolarını, fonksiyonlarını ve tetikleyicilerini kaldırır; tasks_guard 004'teki haline döner.
-- DİKKAT: Şablonlar, görev kontrol listeleri, notlar ve kalite kontrol geçmişi kalıcı olarak silinir.
-- Görevler ve diğer tablolar etkilenmez. Önce panelin 006 öncesi sürümünü yayınlayın.

begin;

alter publication supabase_realtime drop table
  public.task_checklist_instances, public.task_checklist_items, public.task_checklist_submissions;

drop trigger if exists tasks_checklist_insert on public.tasks;
drop trigger if exists tasks_checklist_update on public.tasks;

drop table if exists public.task_checklist_submissions;
drop table if exists public.task_checklist_events;
drop table if exists public.task_checklist_items;
drop table if exists public.task_checklist_instances;
drop table if exists public.checklist_template_items;
drop table if exists public.brand_checklist_templates;

drop function if exists public.submit_task_for_approval(uuid, text, text);
drop function if exists public.ensure_task_checklist(uuid);
drop function if exists public.save_checklist_template(jsonb);
drop function if exists public.cl_on_task_insert();
drop function if exists public.cl_on_task_update();
drop function if exists public.cl_items_guard();
drop function if exists public.cl_items_audit();
drop function if exists public.cl_templates_touch();
drop function if exists public.cl_instantiate(uuid, integer);
drop function if exists public.cl_pick_template(uuid, text);
drop function if exists public.cl_current(uuid);
drop function if exists public.cl_can_work(uuid);
drop function if exists public.cl_can_read(uuid);
drop function if exists public.cl_can_manage(uuid);

-- 004'teki koruma tetikleyicisi.
create or replace function public.tasks_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null or public.is_admin() or current_setting('cw.bypass', true) = 'on' then return new; end if;
  if new.assignee_id is distinct from old.assignee_id or new.brand_id is distinct from old.brand_id
     or new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time
     or new.priority is distinct from old.priority then
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

alter table public.tasks drop column if exists checklist_disabled;

commit;
