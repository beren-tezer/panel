-- Canlı veritabanı denetimi — YALNIZCA OKUR, hiçbir şeyi değiştirmez.
-- Supabase Dashboard → SQL Editor'da çalıştırın; sonuç tablosunu paylaşın. Migration'lardan önce ve sonra kullanılabilir.

select 'migration' as alan, m.ad as kontrol, m.var::text as sonuc from (values
  ('003 roller (profiles.role)',            exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role')),
  ('004 teslim saati (tasks.due_time)',     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_time')),
  ('005 marka kılavuzu (brand_kits)',       to_regclass('public.brand_kits') is not null),
  ('006 kontrol listesi',                   to_regclass('public.task_checklist_items') is not null),
  ('007 içerik sürümleri / onay istekleri', to_regclass('public.approval_requests') is not null),
  ('008 sağlamlaştırma (cw_role_of)',       exists (select 1 from pg_proc where proname = 'cw_role_of'))
) as m(ad, var)

union all
select 'güvenlik', 'RLS kapalı tablo', coalesce(string_agg(c.relname, ', '), 'yok')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

union all
select 'güvenlik', 'search_path tanımsız SECURITY DEFINER', coalesce(string_agg(p.proname, ', '), 'yok')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')

union all
select 'güvenlik', 'anon yetkisi olan tablolar', coalesce(string_agg(distinct table_name, ', '), 'yok')
from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'

union all
select 'kullanıcılar', role || ' / ' || case when active then 'aktif' else 'pasif' end, count(*)::text
from public.profiles group by role, active

union all
select 'kullanıcılar', 'markası olmayan aktif müşteri', count(*)::text
from public.profiles p where p.role = 'client' and p.active and not exists (select 1 from public.brand_members m where m.user_id = p.id)

union all
select 'kullanıcılar', 'profili olmayan Auth kullanıcısı', count(*)::text
from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)

union all
select 'veri', 'görev durumu: ' || status, count(*)::text from public.tasks group by status

union all
select 'depolama', 'kova: ' || id, case when public then 'HERKESE AÇIK' else 'özel' end from storage.buckets;
