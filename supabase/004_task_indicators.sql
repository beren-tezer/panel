-- 004 — Teslim saati ve ekip içi ekler
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın (003'ten sonra). Panelin yeni sürümünü yayınlamadan
-- önce çalıştırılmalıdır: panel görev kaydederken due_time, ek kaydederken internal sütununu yazar.
--
--   tasks.due_time        : son teslim saati (boş = gün sonu). Yalnızca yöneticiler değiştirebilir.
--   attachments.internal  : true ise ek yalnızca ekip (admin/çalışan) tarafından görülür; müşteriye hiç dönmez.

begin;

alter table public.tasks add column if not exists due_time time;
alter table public.attachments add column if not exists internal boolean not null default false;

-- 003'teki koruma tetikleyicisi + due_time: çalışan teslim saatini de değiştiremez.
create or replace function public.tasks_guard() returns trigger
language plpgsql as $$
begin
  -- auth.uid() boşsa istek bir kullanıcıdan değil, servis anahtarından veya SQL Editor'dan gelir.
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

-- Ekler: görev görünürlüğü + müşteri ekip içi ekleri göremez (canlı güncellemeler de bu politikaya tabidir).
drop policy if exists "attachments: görünürlük" on public.attachments;
create policy "attachments: görünürlük" on public.attachments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id)
         and (not internal or public.my_role() in ('admin', 'employee')));

commit;

-- Kontrol (isteğe bağlı):
--   select column_name from information_schema.columns
--   where table_schema = 'public' and ((table_name = 'tasks' and column_name = 'due_time') or (table_name = 'attachments' and column_name = 'internal'));
--   → 2 satır dönmeli.
