-- 008 geri alma — 003'teki yeni kullanıcı, profil ve marka üyeliği kuralları ile anonim yetkiler geri gelir.
-- Veri değişmez. Önce invite-user fonksiyonunun 008 öncesi sürümünü kullanın (aksi halde yeni davetliler aktifleşir;
-- 008 öncesi tetikleyici aktifliği davet tarihinden belirler).

begin;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    case when meta_role in ('admin', 'employee', 'client') then meta_role else 'employee' end,
    new.invited_at is not null
  );
  return new;
end $$;

drop policy if exists "profiles: görünürlük" on public.profiles;
create policy "profiles: görünürlük" on public.profiles for select to authenticated using (
  public.is_admin() or id = auth.uid()
  or (public.my_role() = 'employee' and role = 'admin')
  or exists (select 1 from public.brand_members a join public.brand_members b on a.brand_id = b.brand_id
             where a.user_id = auth.uid() and b.user_id = profiles.id)
  or exists (select 1 from public.tasks t where t.assignee_id = profiles.id)
);

drop policy if exists "brand_members: görünürlük" on public.brand_members;
create policy "brand_members: görünürlük" on public.brand_members for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or public.has_brand(brand_id));

drop function if exists public.cw_role_of(uuid);

-- 008 öncesindeki anonim yetkiler (006 / 007 tabloları zaten anon'a kapalıydı, onlara dokunulmaz).
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'brands', 'brand_members', 'tasks', 'comments', 'activity', 'assets', 'attachments', 'approvals', 'notifications',
    'brand_kits', 'brand_kit_colors', 'brand_kit_fonts', 'brand_kit_instructions', 'brand_kit_assets', 'brand_kit_links'
  ] loop
    if to_regclass('public.' || t) is not null then execute format('grant all on public.%I to anon', t); end if;
  end loop;
end $$;

commit;
