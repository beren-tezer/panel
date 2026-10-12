-- MVP öncesi canlı veri kontrolü — YALNIZCA OKUR, hiçbir şeyi değiştirmez.
-- Supabase Dashboard → SQL Editor'a yapıştırıp Run'a basın; çıkan tabloyu gönderin.
-- "uyari" sütunu dolu olan satırlar, yöneticilerin test sırasında göreceği düzeltilmesi gereken noktalardır.

with u as (
  select p.id, p.full_name, p.email, p.role, p.active,
         au.encrypted_password is not null and au.encrypted_password <> '' as has_password,
         au.email_confirmed_at is not null as confirmed, au.last_sign_in_at,
         (select count(*) from public.brand_members m where m.user_id = p.id) as brand_count
  from public.profiles p left join auth.users au on au.id = p.id
)
select * from (
  select 1 as sira, 'Kullanıcı' as bolum, coalesce(u.email, u.full_name) as kayit,
         u.role || case when u.active then ' · aktif' else ' · pasif' end
           || case when u.has_password then ' · şifreli' else ' · şifresiz (yalnız bağlantı)' end
           || ' · ' || u.brand_count || ' marka'
           || ' · son giriş: ' || coalesce(to_char(u.last_sign_in_at at time zone 'Europe/Istanbul', 'DD.MM HH24:MI'), 'hiç') as detay,
         case
           when u.active and not u.confirmed then 'E-posta onaylanmamış: giriş yapamaz'
           when u.active and u.role = 'client' and u.brand_count = 0 then 'Müşterinin markası yok: portal boş görünür'
           when u.active and u.role = 'employee' and u.brand_count = 0 then 'Çalışanın markası yok: hiçbir iş görmez'
           when u.active and u.role = 'admin' and not u.has_password then 'Yalnız e-posta bağlantısıyla girebilir (SMTP yoksa e-posta gelmeyebilir)'
           when not u.active then 'Pasif hesap: ekip listesinde pasif görünür'
         end as uyari
  from u
  union all
  select 2, 'Marka', b.name,
         coalesce(b.status, 'active') || ' · ' || count(t.id) || ' görev · '
           || count(t.id) filter (where t.status not in ('Tamamlandı', 'Onaylandı')) || ' açık',
         case
           when count(t.id) = 0 then 'Görevi olmayan marka'
           when b.name ~* '(test|deneme|demo|asdf|örnek|xxx)' then 'Test/demo marka adı'
         end
  from public.brands b left join public.tasks t on t.brand_id = b.id
  group by b.id, b.name, b.status
  union all
  select 3, 'Şüpheli görev', b.name || ' / ' || t.title, t.status || ' · teslim ' || coalesce(to_char(t.due_date, 'DD.MM.YYYY'), 'yok'),
         'Test/deneme görevi gibi görünüyor'
  from public.tasks t join public.brands b on b.id = t.brand_id
  where t.title ~* '(^|\W)(test|deneme|asdf|qwe|xxx|aaa|bbb|sil)(\W|$)' or length(trim(t.title)) < 4
  union all
  select 4, 'Görev', 'Atanmamış açık görev', count(*)::text,
         case when count(*) > 0 then 'Sorumlusu olmayan açık görevler var' end
  from public.tasks where assignee_id is null and status not in ('Tamamlandı', 'Onaylandı')
  union all
  select 4, 'Görev', 'Geciken açık görev', count(*)::text,
         case when count(*) > 10 then 'Çok sayıda geciken iş: tarihleri güncellemek iyi olur' end
  from public.tasks where due_date < current_date and status not in ('Tamamlandı', 'Onaylandı')
  union all
  select 4, 'Görev', 'Toplam görev', count(*)::text, null from public.tasks
  union all
  select 5, 'Bildirim', coalesce(p.email, p.full_name), count(*) || ' okunmamış',
         case when count(*) > 20 then 'Çok sayıda eski okunmamış bildirim' end
  from public.notifications n join public.profiles p on p.id = n.user_id
  where n.read_at is null group by p.email, p.full_name
) r
order by sira, (uyari is null), bolum, kayit;
