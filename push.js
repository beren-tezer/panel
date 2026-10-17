/*
 * AgencyOS — tarayıcı push bildirimleri (Web Push + service worker)
 *
 * Akış: izin (Notification.requestPermission) → service worker kaydı üzerinden abonelik (VAPID genel anahtarı) →
 * abonelik Supabase'e save_push_subscription RPC'si ile kaydedilir (012_reporter_push.sql). Bildirimleri send-push
 * Edge Function'ı gönderir. Service worker yalnızca üretim derlemesinde kayıtlıdır; geliştirmede push devre dışıdır.
 * iPhone / iPad: yalnızca "Ana Ekrana Ekle" ile yüklenen uygulamada ve kullanıcı dokunuşuyla izin istenebilir (iOS 16.4+).
 */

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const pushPermission = () => (pushSupported() ? Notification.permission : "unsupported");

function base64UrlToBytes(value) {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const sameKey = (sub, key) => {
  const current = sub.options?.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current), b = base64UrlToBytes(key);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};

/* ask: true → izin henüz verilmediyse sorulur (kullanıcı dokunuşuyla çağrılmalı; Chrome girişte de kabul eder).
   Dönüş: "granted" | "denied" | "default" | "unsupported" | "no-sw" */
export async function enablePush(supabase, vapidKey, { ask = false } = {}) {
  if (!vapidKey || !pushSupported()) return "unsupported";
  let permission = Notification.permission;
  if (permission === "default" && ask) permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "no-sw";
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, vapidKey)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidKey) });
  const { endpoint, keys } = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
  return "granted";
}

/* Çıkışta: bu cihazın aboneliği kullanıcıdan ayrılır (ortak bilgisayarda başkasına bildirim düşmez). */
export async function disablePush(supabase) {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => {});
}
