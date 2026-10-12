-- 009 — İlk girişte zorunlu "Gizlilik ve Rekabet Sözleşmesi" onayı
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın (008'den sonra). Tekrar çalıştırmak zararsızdır.
-- Geri almak için: 009_agreement_down.sql
--
--   • profiles tablosuna agreement_accepted (boolean, varsayılan false), agreement_accepted_at, agreement_version eklenir.
--     Mevcut kullanıcıların HEPSİ (yöneticiler dahil) bir sonraki girişte sözleşmeyi bir kez onaylar.
--   • Onay yalnızca accept_agreement() fonksiyonuyla, yalnızca kullanıcının kendi kaydına yazılır (tarih sunucu saatidir).
--   • Kullanıcı bu alanları profiles tablosunu doğrudan güncelleyerek değiştiremez; yöneticiler sıfırlayabilir.
--   • Eski panel sürümü bu alanları yok sayar: bu dosya, yeni sürüm yüklenmeden önce de güvenle çalıştırılabilir.

begin;

alter table public.profiles
  add column if not exists agreement_accepted boolean not null default false,
  add column if not exists agreement_accepted_at timestamptz,
  add column if not exists agreement_version text;

-- Onay yalnızca bu fonksiyonla kaydedilir (security definer: RLS'e takılmaz, ama yalnızca auth.uid() satırını günceller).
create or replace function public.accept_agreement(p_version text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Oturum açmanız gerekiyor.' using errcode = '28000';
  end if;
  perform set_config('cw.agreement', 'on', true); -- yalnızca bu işlem için: koruma tetikleyicisi bu güncellemeye izin verir
  update public.profiles
     set agreement_accepted = true,
         agreement_accepted_at = now(),
         agreement_version = nullif(left(trim(coalesce(p_version, '')), 40), '')
   where id = auth.uid()
  returning agreement_accepted_at into v_at;
  perform set_config('cw.agreement', 'off', true);
  if v_at is null then
    raise exception 'Hesabınız için bir profil bulunamadı.' using errcode = 'P0002';
  end if;
  return v_at;
end $$;
revoke execute on function public.accept_agreement(text) from public, anon;
grant execute on function public.accept_agreement(text) to authenticated;

-- Kullanıcı kendi profilini düzenleyebildiği için (ad, renk…) sözleşme alanları ayrıca korunur:
-- yönetici değilse ve istek accept_agreement() içinden gelmiyorsa eski değerler korunur.
create or replace function public.profiles_agreement_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;                          -- servis anahtarı / SQL Editor
  if current_setting('cw.agreement', true) = 'on' then return new; end if; -- accept_agreement()
  if public.is_admin() then return new; end if;                           -- yönetici sıfırlayabilir
  new.agreement_accepted := old.agreement_accepted;
  new.agreement_accepted_at := old.agreement_accepted_at;
  new.agreement_version := old.agreement_version;
  return new;
end $$;
drop trigger if exists profiles_agreement_guard on public.profiles;
create trigger profiles_agreement_guard before update on public.profiles
  for each row execute function public.profiles_agreement_guard();

commit;

-- Doğrulama (beklenen: 3 sütun, fonksiyon ve tetikleyici var; "Onay bekleyen" = aktif kullanıcı sayısı)
select 'Sözleşme sütunları' as kontrol, count(*)::text as sonuc from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles' and column_name in ('agreement_accepted', 'agreement_accepted_at', 'agreement_version')
union all select 'accept_agreement()', count(*)::text from pg_proc where proname = 'accept_agreement'
union all select 'Koruma tetikleyicisi', count(*)::text from pg_trigger where tgname = 'profiles_agreement_guard'
union all select 'Onay bekleyen aktif kullanıcı', count(*)::text from public.profiles where active and not agreement_accepted
union all select 'Onaylamış kullanıcı', count(*)::text from public.profiles where agreement_accepted;


-- ───────────────────────── Gerektiğinde (yorumu açıp tek başına çalıştırın) ─────────────────────────
-- Sözleşme metni değişti, herkes yeniden onaylasın:
--   update public.profiles set agreement_accepted = false;
-- Tek bir kullanıcı yeniden onaylasın:
--   update public.profiles set agreement_accepted = false where lower(email) = lower('kisi@ornek.com');
-- Kim, ne zaman, hangi sürümü onayladı:
--   select full_name, email, role, agreement_accepted, agreement_accepted_at, agreement_version from public.profiles order by agreement_accepted_at desc nulls last;
