-- MVP öncesi canlı veri düzeltmesi (mvp_preflight.sql sonucuna göre). Tek seferde çalıştırın; sonunda doğrulama tablosu çıkar.
--   1) yonetici2@example.com e-postası onaylı hale getirilir (onaysız hesap giriş yapamaz).
--   2) Atlas Ajans markasındaki "Test görev" silinir (yalnızca bu başlıktaki görev).
--   3) Teslim tarihi geçmiş AÇIK görevlerin tarihleri önümüzdeki günlere alınır (pano kırmızı açılmasın).
--   4) Hiç kullanılmamış pasif @test.com hesapları silinir (bir kayıtta adı geçiyorsa dokunulmaz).
begin;

update auth.users set email_confirmed_at = now()
where lower(email) = 'yonetici2@example.com' and email_confirmed_at is null;

delete from public.tasks t using public.brands b
where b.id = t.brand_id and b.name = 'Atlas Ajans' and t.title = 'Test görev';

with late as (
  select id, row_number() over (order by due_date, created_at) as n
  from public.tasks
  where due_date < current_date and status not in ('Tamamlandı', 'Onaylandı')
)
update public.tasks t
set due_date = current_date + late.n::int,
    publish_date = greatest(coalesce(t.publish_date, current_date), current_date + late.n::int + 1)
from late where late.id = t.id;

delete from auth.users u
using public.profiles p
where p.id = u.id and lower(u.email) in ('calisan@test.com', 'musteri@test.com') and not p.active
  and u.last_sign_in_at is null
  and not exists (select 1 from public.comments c where c.user_id = u.id)
  and not exists (select 1 from public.activity a where a.user_id = u.id)
  and not exists (select 1 from public.attachments x where x.added_by = u.id)
  and not exists (select 1 from public.approvals ap where ap.user_id = u.id);

commit;

-- Doğrulama
select 'Yönetici e-posta onayı' as kontrol,
       coalesce((select case when email_confirmed_at is not null then 'TAMAM' else 'HATA' end from auth.users where lower(email) = 'yonetici2@example.com'), 'hesap yok') as sonuc
union all select 'Test görev kaldı mı', case when exists (select 1 from public.tasks where title = 'Test görev') then 'HATA: duruyor' else 'TAMAM' end
union all select 'Geciken açık görev', (select count(*) from public.tasks where due_date < current_date and status not in ('Tamamlandı', 'Onaylandı'))::text
union all select 'Pasif @test.com hesabı', (select count(*) from auth.users where lower(email) in ('calisan@test.com', 'musteri@test.com'))::text || ' (0 beklenir; 1+ ise kayıtlarda adı geçiyor, dokunulmadı)'
union all select 'Toplam görev', (select count(*) from public.tasks)::text
union all select 'Aktif kullanıcı', (select string_agg(email || ' (' || role || ')', ', ' order by role, email) from public.profiles where active);
