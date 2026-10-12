/*
 * YALNIZCA GELİŞTİRME / TEST: giriş akışını (şifreyle giriş, /login yönlendirmesi, çıkış, rol bazlı yönlendirme)
 * demo verisiyle denemek için bellek içi oturum. http://localhost:5173/?authdemo
 * main.jsx bunu yalnızca import.meta.env.DEV iken dinamik olarak yükler; üretim derlemesine girmez.
 * Gerçek kimlik doğrulama Supabase Auth'tur (workspaceData.js createSupabaseSource).
 */
import { AuthRequiredError } from "./workspaceData.js";

export const DEV_ACCOUNTS = { "admin@demo.test": "u1", "calisan@demo.test": "u2", "musteri@demo.test": "c1", "yeni@demo.test": "u3" };
// Sözleşmeyi henüz onaylamamış hesap (ilk giriş akışı): "yeni@demo.test". Diğerleri onaylamış sayılır.
export const DEV_PASSWORD = "Demo1234";

export function createAuthDemoSource(base) {
  let session = null;
  const passwords = Object.fromEntries(Object.keys(DEV_ACCOUNTS).map((e) => [e, DEV_PASSWORD]));
  const emailOf = (id) => Object.keys(DEV_ACCOUNTS).find((e) => DEV_ACCOUNTS[e] === id);
  const accepted = new Set(Object.keys(DEV_ACCOUNTS).filter((e) => e !== "yeni@demo.test"));
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  return {
    ...base,
    allowImpersonation: false,
    async load() {
      if (!session) throw new AuthRequiredError();
      const demo = await base.load();
      return { ...demo, me: session, state: { ...demo.state, agreement: { accepted: accepted.has(emailOf(session)) } } };
    },
    agreement: {
      async accept() {
        await new Promise((r) => setTimeout(r, 120));
        if (globalThis.__cwSimulateSaveError) { globalThis.__cwSimulateSaveError = null; throw new Error("Onayınız kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin."); }
        accepted.add(emailOf(session));
      },
    },
    account: {
      async passwordContext() { return { email: emailOf(session), needsCurrent: true }; },
      async changePassword({ current, next }) {
        await new Promise((r) => setTimeout(r, 120));
        const email = emailOf(session);
        if (current !== passwords[email]) throw Object.assign(new Error("Mevcut şifreniz hatalı."), { field: "current" });
        passwords[email] = next;
      },
    },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    auth: {
      async signInWithPassword(email, password) {
        await new Promise((r) => setTimeout(r, 150));
        const id = DEV_ACCOUNTS[String(email).trim().toLowerCase()];
        if (!id || password !== passwords[String(email).trim().toLowerCase()]) throw new Error("E-posta veya şifre hatalı.");
        session = id; emit();
      },
      async sendLink() { throw new Error("Test ortamında e-posta gönderilmez."); },
      async signOut() { session = null; emit(); },
    },
  };
}
