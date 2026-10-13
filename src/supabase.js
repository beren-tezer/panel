import { createClient } from "@supabase/supabase-js";
import { CALLBACK_PATH, parseAuthCallback, shouldMoveToCallback } from "../authCallback.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Dosya yüklemesi (ilerleme göstergesi için) Storage REST uç noktasını doğrudan çağırır.
export const supabaseConfig = { url, key };

export const supabaseConfigError = !url || !key
  ? "Supabase ayarları eksik: .env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlı olmalı."
  : null;

// E-posta bağlantısı dönüşü (davet / şifre sıfırlama / hata) istemci oluşturulmadan önce okunur: supabase-js adresteki
// jetonu işleyip siler, hata dönüşlerini ise sessizce yutar (bkz. authCallback.js).
export const authCallback = typeof window === "undefined" ? null : parseAuthCallback(window.location);
if (authCallback && shouldMoveToCallback(authCallback, window.location.pathname)) {
  window.history.replaceState(window.history.state, "", `${CALLBACK_PATH}${window.location.search}${window.location.hash}`);
}

// Publishable (anon) anahtar tarayıcıda görünür; veri güvenliği veritabanındaki RLS kurallarıyla sağlanır.
export const supabase = supabaseConfigError ? null : createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
