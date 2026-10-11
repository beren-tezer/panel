-- 008 — Kimlik doğrulama ve yetki sağlamlaştırma (demo öncesi)
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın (007'den sonra). Geri almak için: 008_auth_hardening_down.sql
-- Mevcut tablo, kolon ve veriler değişmez; yalnızca bir tetikleyici fonksiyonu, iki politika ve yetkiler güncellenir.
--
--   1. Yeni kullanıcı en düşük yetkiyle başlar: role = 'client', active = false. user_metadata'daki rol YOK SAYILIR.
--      Rolü, izinleri ve aktifliği yalnızca invite-user fonksiyonu (servis anahtarıyla, çağıranın aktif admin olduğu
--      doğrulanarak) atar. Davet sonrası profil güncellemesi başarısız olursa kullanıcı pasif kalır (hiçbir şey göremez).
--   2. Müşteri başka müşterilerin profilini (ad, e-posta) ve marka üyelik kayıtlarını göremez; yalnızca kendisini ve
--      kendisiyle çalışan ajans ekibini görür.
--   3. Anonim (giriş yapmamış) rolün tablolardaki tüm yetkileri kaldırılır (RLS'e ek savunma katmanı).
--
-- İlk admin hesabı (yalnızca bir kez, SQL Editor'da — servis yetkisiyle çalışır):
--   Authentication → Users → "Invite user" ile kendinizi davet edin, sonra:
--   update public.profiles set role = 'admin', active = true where email = 'sizin@adresiniz.com';
--   Sonraki tüm kullanıcılar panelden (Kullanıcılar & Yetkiler → Kullanıcı Ekle) davet edilir.

begin;

-- ───────────────────────── 1. Yeni kullanıcı profili ─────────────────────────

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Rol ve aktiflik kullanıcı tarafından gönderilebilen verilerden ALINMAZ (raw_user_meta_data yalnızca görünen ad için).
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), ''), split_part(new.email, '@', 1)),
    new.email,
    'client',
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ───────────────────────── 2. Müşteri gizliliği ─────────────────────────

-- Bir kullanıcının rolü (politika içinde profiles RLS'ine takılmadan / döngüye girmeden okunur).
create or replace function public.cw_role_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = p_user;
$$;
revoke execute on function public.cw_role_of(uuid) from public, anon;
grant execute on function public.cw_role_of(uuid) to authenticated;

drop policy if exists "profiles: görünürlük" on public.profiles;
create policy "profiles: görünürlük" on public.profiles for select to authenticated using (
  public.is_admin() or id = auth.uid()
  or (public.my_role() = 'employee' and role = 'admin')
  or (
    -- Müşteri: yalnızca ajans ekibi (admin / çalışan) — başka müşteriler hiçbir koşulda görünmez.
    -- (my_role() boşsa — pasif / profilsiz kullanıcı — bu dal hiçbir zaman doğru olmaz.)
    public.my_role() is not null and (public.my_role() <> 'client' or role in ('admin', 'employee'))
    and (
      exists (select 1 from public.brand_members a join public.brand_members b on a.brand_id = b.brand_id
              where a.user_id = auth.uid() and b.user_id = profiles.id)
      or exists (select 1 from public.tasks t where t.assignee_id = profiles.id)
    )
  )
);

drop policy if exists "brand_members: görünürlük" on public.brand_members;
create policy "brand_members: görünürlük" on public.brand_members for select to authenticated using (
  public.is_admin() or user_id = auth.uid()
  or (public.has_brand(brand_id) and (public.my_role() <> 'client' or public.cw_role_of(user_id) in ('admin', 'employee')))
);

-- ───────────────────────── 3. Anonim erişim ─────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'brands', 'brand_members', 'tasks', 'comments', 'activity', 'assets', 'attachments', 'approvals', 'notifications',
    'brand_kits', 'brand_kit_colors', 'brand_kit_fonts', 'brand_kit_instructions', 'brand_kit_assets', 'brand_kit_links',
    'brand_checklist_templates', 'checklist_template_items', 'task_checklist_instances', 'task_checklist_items',
    'task_checklist_events', 'task_checklist_submissions', 'task_content_versions', 'task_content_assets', 'approval_requests'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon', t);
    end if;
  end loop;
end $$;

commit;

-- ───────────────────────── Kontroller (salt okunur, isteğe bağlı) ─────────────────────────
-- RLS kapalı tablo olmamalı (boş sonuç beklenir):
--   select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
-- search_path tanımlanmamış SECURITY DEFINER fonksiyon olmamalı (boş sonuç beklenir):
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
-- Rolü veya aktifliği şüpheli profiller:
--   select email, role, active from public.profiles order by role, email;
-- Markası olmayan aktif müşteriler (hiçbir içerik göremezler):
--   select p.email from public.profiles p where p.role = 'client' and p.active
--   and not exists (select 1 from public.brand_members m where m.user_id = p.id);
