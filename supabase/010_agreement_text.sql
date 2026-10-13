-- 010 — Sözleşme metni panelden düzenlenir (Admin → Sözleşme)
-- Supabase Dashboard → SQL Editor'da bir kez çalıştırın (009'dan sonra). Tekrar çalıştırmak zararsızdır.
-- Geri almak için: 010_agreement_text_down.sql
--
--   • agreement_text: tek satırlık tablo (başlık, bölümler, onay cümlesi, sürüm). Satır yoksa panel yerleşik taslağı gösterir;
--     yönetici ilk kez kaydettiğinde satır oluşur.
--   • Giriş yapmış herkes okur (sözleşme ekranı); yalnızca yönetici save_agreement_text() ile değiştirir.
--   • Kaydederken "herkes yeniden onaylasın" seçilirse kaydeden yönetici dışındaki tüm kullanıcıların onayı sıfırlanır
--     (eski onay tarihi / sürümü kayıtta kalır); kaydeden yönetici yeni sürümü onaylamış sayılır.

begin;

create table if not exists public.agreement_text (
  id          boolean primary key default true check (id),           -- tek satır
  title       text not null check (char_length(title) between 1 and 200),
  sections    jsonb not null check (jsonb_typeof(sections) = 'array'),
  consent     text not null check (char_length(consent) between 1 and 500),
  version     text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

alter table public.agreement_text enable row level security;
drop policy if exists "agreement_text: okuma" on public.agreement_text;
create policy "agreement_text: okuma" on public.agreement_text for select to authenticated using (true);
revoke all on public.agreement_text from anon, authenticated;
grant select on public.agreement_text to authenticated;

create or replace function public.save_agreement_text(p_title text, p_sections jsonb, p_consent text, p_reaccept boolean default false)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_version text := to_char(now() at time zone 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI:SS');
  v_sections jsonb := '[]'::jsonb;
  s jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Sözleşme metnini yalnızca yöneticiler düzenleyebilir.' using errcode = '42501';
  end if;
  p_title := trim(coalesce(p_title, ''));
  p_consent := trim(coalesce(p_consent, ''));
  if char_length(p_title) not between 1 and 200 then raise exception 'Başlık 1–200 karakter olmalı.' using errcode = '22023'; end if;
  if char_length(p_consent) not between 1 and 500 then raise exception 'Onay cümlesi 1–500 karakter olmalı.' using errcode = '22023'; end if;
  if p_sections is null or jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) not between 1 and 40 then
    raise exception 'Sözleşmede 1–40 bölüm olmalı.' using errcode = '22023';
  end if;
  -- Yalnızca { heading, body } alanları saklanır.
  for s in select value from jsonb_array_elements(p_sections) loop
    if jsonb_typeof(s) <> 'object' or jsonb_typeof(s -> 'heading') <> 'string' or jsonb_typeof(s -> 'body') <> 'string'
       or char_length(trim(s ->> 'heading')) not between 1 and 200 or char_length(trim(s ->> 'body')) not between 1 and 5000 then
      raise exception 'Her bölümün başlığı (1–200) ve metni (1–5000 karakter) olmalı.' using errcode = '22023';
    end if;
    v_sections := v_sections || jsonb_build_array(jsonb_build_object('heading', trim(s ->> 'heading'), 'body', trim(s ->> 'body')));
  end loop;

  insert into public.agreement_text (id, title, sections, consent, version, updated_at, updated_by)
  values (true, p_title, v_sections, p_consent, v_version, now(), auth.uid())
  on conflict (id) do update set title = excluded.title, sections = excluded.sections, consent = excluded.consent,
    version = excluded.version, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  if coalesce(p_reaccept, false) then
    update public.profiles set agreement_accepted = false where id <> auth.uid() and agreement_accepted;
    update public.profiles set agreement_accepted = true, agreement_accepted_at = now(), agreement_version = v_version where id = auth.uid();
  end if;
  return v_version;
end $$;
revoke execute on function public.save_agreement_text(text, jsonb, text, boolean) from public, anon;
grant execute on function public.save_agreement_text(text, jsonb, text, boolean) to authenticated;

commit;

-- Doğrulama (beklenen: tablo 1, fonksiyon 1; "Kayıtlı metin" ilk kayda kadar 0)
select 'agreement_text tablosu' as kontrol, count(*)::text as sonuc from information_schema.tables where table_schema = 'public' and table_name = 'agreement_text'
union all select 'save_agreement_text()', count(*)::text from pg_proc where proname = 'save_agreement_text'
union all select 'Kayıtlı metin', count(*)::text from public.agreement_text;
