/*
 * YALNIZCA GELİŞTİRME / TEST: giriş akışını (şifreyle giriş, /login yönlendirmesi, çıkış, rol bazlı yönlendirme)
 * demo verisiyle denemek için bellek içi oturum. http://localhost:5173/?authdemo
 * main.jsx bunu yalnızca import.meta.env.DEV iken dinamik olarak yükler; üretim derlemesine girmez.
 * Gerçek kimlik doğrulama Supabase Auth'tur (workspaceData.js createSupabaseSource).
 */
import { AuthRequiredError } from "./workspaceData.js";

export const DEV_ACCOUNTS = { "admin@demo.test": "u1", "calisan@demo.test": "u2", "musteri@demo.test": "c1" };
export const DEV_PASSWORD = "Demo1234";

export function createAuthDemoSource(base) {
  let session = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  return {
    ...base,
    allowImpersonation: false,
    async load() {
      if (!session) throw new AuthRequiredError();
      const demo = await base.load();
      return { ...demo, me: session };
    },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    auth: {
      async signInWithPassword(email, password) {
        await new Promise((r) => setTimeout(r, 150));
        const id = DEV_ACCOUNTS[String(email).trim().toLowerCase()];
        if (!id || password !== DEV_PASSWORD) throw new Error("E-posta veya şifre hatalı.");
        session = id; emit();
      },
      async sendLink() { throw new Error("Test ortamında e-posta gönderilmez."); },
      async signOut() { session = null; emit(); },
    },
  };
}
