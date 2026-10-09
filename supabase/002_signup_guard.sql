-- 002 — Kendi kendine kayıt koruması
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın (schema.sql'den sonra).
--
-- Sorun: "Allow new users to sign up" açık kalırsa, herkese açık anahtarla doğrudan kayıt olan biri
-- profil tetikleyicisi sayesinde aktif ekip üyesi olur ve tüm verileri görür.
-- Çözüm: Yalnızca davetle (Authentication → Users → Invite user) gelen kullanıcılar aktif başlar.
-- Diğerleri pasif oluşturulur; yönetici gerekirse profiles.active = true yaparak açar.
-- Ayardaki "sign up" yine de KAPATILMALIDIR; bu, ikinci savunma hattıdır.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.invited_at is not null
  );
  return new;
end $$;

-- Bu dosyadan önce davetsiz kayıt olmuş hesapları gözden geçirmek için:
-- select p.full_name, u.email, u.created_at, p.active
-- from public.profiles p join auth.users u on u.id = p.id
-- where u.invited_at is null;
