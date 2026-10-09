import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Dosya yüklemesi (ilerleme göstergesi için) Storage REST uç noktasını doğrudan çağırır.
export const supabaseConfig = { url, key };

export const supabaseConfigError = !url || !key
  ? "Supabase ayarları eksik: .env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlı olmalı."
  : null;

// Publishable (anon) anahtar tarayıcıda görünür; veri güvenliği veritabanındaki RLS kurallarıyla sağlanır.
export const supabase = supabaseConfigError ? null : createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
