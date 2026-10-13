/*
 * YALNIZCA GELİŞTİRME / TEST: giriş akışını (şifreyle giriş, /login yönlendirmesi, çıkış, rol bazlı yönlendirme)
 * demo verisiyle denemek için bellek içi oturum. http://localhost:5173/?authdemo
 * main.jsx bunu yalnızca import.meta.env.DEV iken dinamik olarak yükler; üretim derlemesine girmez.
 * Gerçek kimlik doğrulama Supabase Auth'tur (workspaceData.js createSupabaseSource).
 */
import { AuthRequiredError } from "./workspaceData.js";
import { CALLBACK_PATH, parseAuthCallback } from "./authCallback.js";

export const DEV_ACCOUNTS = { "admin@demo.test": "u1", "calisan@demo.test": "u2", "musteri@demo.test": "c1", "yeni@demo.test": "u3" };
// Sözleşmeyi henüz onaylamamış hesap (ilk giriş akışı): "yeni@demo.test". Diğerleri onaylamış sayılır.
export const DEV_PASSWORD = "Demo1234";
/* Davet bağlantısı benzetimi: /auth/callback?authdemo&token_hash=demo-invite:<e-posta>&type=invite
   (demo-expired → süresi dolmuş / kullanılmış bağlantı). "yeni@demo.test" daveti henüz kabul etmemiş sayılır. */

export function createAuthDemoSource(base) {
  let session = null;
  const passwords = Object.fromEntries(Object.keys(DEV_ACCOUNTS).map((e) => [e, DEV_PASSWORD]));
  const emailOf = (id) => Object.keys(DEV_ACCOUNTS).find((e) => DEV_ACCOUNTS[e] === id);
  let accepted = new Set(Object.keys(DEV_ACCOUNTS).filter((e) => e !== "yeni@demo.test"));
  const acceptedById = (id) => { const e = emailOf(id); return e ? accepted.has(e) : undefined; };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  const callback = typeof window === "undefined" ? null : parseAuthCallback(window.location);
  const needsPw = new Set();
  const pendingInvites = new Set(["u3"]);
  let callbackPromise = null;
  const mailError = () => {
    const e = globalThis.__cwSimulateInviteError;
    if (e) { globalThis.__cwSimulateInviteError = null; throw new Error(e); }
  };
  return {
    ...base,
    allowImpersonation: false,
    async load() {
      if (!session) throw new AuthRequiredError();
      const demo = await base.load();
      const users = demo.state.users.map((u) => ({ ...u, agreementAccepted: acceptedById(u.id) }));
      return { ...demo, me: session, users, state: { ...demo.state, users, agreement: { accepted: accepted.has(emailOf(session)) }, needsPassword: needsPw.has(session) } };
    },
    agreement: {
      async save(doc, { reaccept = false } = {}) {
        const version = await base.agreement.save(doc);
        if (reaccept) accepted = new Set([emailOf(session)]);
        return version;
      },
      async accept() {
        await new Promise((r) => setTimeout(r, 120));
        if (globalThis.__cwSimulateSaveError) { globalThis.__cwSimulateSaveError = null; throw new Error("Onayınız kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin."); }
        accepted.add(emailOf(session));
      },
    },
    users: {
      async invite(user) { await new Promise((r) => setTimeout(r, 150)); mailError(); globalThis.__cwInvites = [...(globalThis.__cwInvites || []), user.email]; return { sent: "invite" }; },
      async resend(id) { await new Promise((r) => setTimeout(r, 100)); mailError(); globalThis.__cwMails = [...(globalThis.__cwMails || []), `resend:${id}`]; return { sent: "invite" }; },
      async reset(id) { await new Promise((r) => setTimeout(r, 100)); mailError(); globalThis.__cwMails = [...(globalThis.__cwMails || []), `reset:${id}`]; return { sent: "reset" }; },
      async status() { return Object.values(DEV_ACCOUNTS).map((id) => ({ id, confirmed: !pendingInvites.has(id) })); },
    },
    account: {
      async setInitialPassword(next) {
        await new Promise((r) => setTimeout(r, 120));
        passwords[emailOf(session)] = next;
        needsPw.delete(session);
      },
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
      callback,
      completeCallback() {
        if (!callback?.tokenHash) return Promise.resolve();
        callbackPromise ||= (async () => {
          await new Promise((r) => setTimeout(r, 200));
          window.history.replaceState(null, "", `${CALLBACK_PATH}?authdemo`);
          const email = callback.tokenHash.startsWith("demo-invite:") ? callback.tokenHash.slice(12) : null;
          const id = email && DEV_ACCOUNTS[email];
          if (!id) throw Object.assign(new Error("Email link is invalid or has expired"), { errorCode: "otp_expired" });
          session = id; pendingInvites.delete(id);
          if (["invite", "recovery"].includes(callback.type)) needsPw.add(id);
          emit();
        })();
        return callbackPromise;
      },
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
