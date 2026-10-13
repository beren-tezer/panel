-- 010 geri alma: panelden düzenlenen sözleşme metni kaldırılır (panel yerleşik taslağa döner). Onay kayıtları (009) etkilenmez.
begin;
drop function if exists public.save_agreement_text(text, jsonb, text, boolean);
drop table if exists public.agreement_text;
commit;
