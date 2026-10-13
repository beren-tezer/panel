/*
 * AgencyOS — e-posta bağlantısı dönüşü (/auth/callback).
 *
 * Supabase e-posta bağlantıları panele üç biçimde döner:
 *   1. ?token_hash=…&type=invite|recovery|magiclink|email   (önerilen e-posta şablonu — panel verifyOtp ile doğrular;
 *                                                          e-posta tarayıcılarının bağlantıyı önceden açması jetonu harcamaz)
 *   2. #access_token=…&type=invite|recovery|…                (varsayılan şablon — supabase-js oturumu kendisi kurar)
 *   3. #error=…&error_code=otp_expired&error_description=…   (süresi dolmuş / daha önce kullanılmış bağlantı)
 *
 * supabase-js 3. durumda hatayı sessizce yutar (oturum yok → panel /login'e düşer, kullanıcı nedenini göremez). Bu yüzden
 * adres, Supabase istemcisi oluşturulmadan ÖNCE okunur (src/supabase.js) ve davet / sıfırlama / hata dönüşleri tek bir
 * ekrana (/auth/callback) toplanır.
 */

export const CALLBACK_PATH = "/auth/callback";
export const OTP_TYPES = ["invite", "recovery", "magiclink", "email", "signup", "email_change"];
// Bu dönüşlerden sonra kullanıcı şifresini belirlemeden panele geçmez (/sifre-olustur).
export const PASSWORD_TYPES = ["invite", "recovery"];

/* { tokenHash, type, error, errorCode, errorDescription, hasSession } | null (adreste e-posta dönüşü yoksa). Saf fonksiyon. */
export function parseAuthCallback({ pathname = "/", search = "", hash = "" } = {}) {
  const q = new URLSearchParams(search);
  const h = new URLSearchParams(String(hash).replace(/^#/, ""));
  const get = (k) => q.get(k) || h.get(k) || null;
  const tokenHash = q.get("token_hash");
  const rawType = get("type");
  const type = OTP_TYPES.includes(rawType) ? rawType : null;
  const error = get("error");
  const errorCode = get("error_code");
  const errorDescription = get("error_description");
  const hasSession = !!h.get("access_token");
  if (!tokenHash && !hasSession && !error && !errorCode) return pathname === CALLBACK_PATH ? { tokenHash: null, type, error: null, errorCode: null, errorDescription: null, hasSession: false } : null;
  return { tokenHash: tokenHash || null, type, error, errorCode, errorDescription, hasSession };
}

/* Dönüş /auth/callback dışında bir adrese geldiyse (eski davetler, Dashboard'dan gönderilen davetler Site URL'e döner)
   adres /auth/callback'e çevrilir. Giriş bağlantısı (magiclink) başarılıysa olduğu yerde kalır: gideceği sayfa korunur. */
export function shouldMoveToCallback(info, pathname) {
  if (!info || pathname === CALLBACK_PATH) return false;
  return !!(info.tokenHash || info.error || info.errorCode || (info.hasSession && PASSWORD_TYPES.includes(info.type)));
}

/* Kullanıcıya gösterilecek açıklama. */
export function callbackErrorMessage(info) {
  const code = info?.errorCode || "";
  const desc = info?.errorDescription || "";
  if (code === "otp_expired" || /expired|invalid/i.test(desc)) {
    return {
      title: "Bağlantının süresi dolmuş veya bağlantı daha önce kullanılmış",
      text: "Güvenlik nedeniyle e-posta bağlantıları yalnızca bir kez ve sınırlı süre için geçerlidir. Davet bağlantısıysa ajans yöneticinizden yeni bir davet isteyin. Hesabınızı daha önce etkinleştirdiyseniz e-posta ve şifrenizle giriş yapabilirsiniz.",
    };
  }
  if (code === "access_denied" || info?.error === "access_denied") {
    return { title: "Bağlantı doğrulanamadı", text: "Bağlantı geçersiz. Ajans yöneticinizden yeni bir davet isteyin." };
  }
  return { title: "Bağlantı doğrulanamadı", text: desc ? `Supabase yanıtı: ${desc}` : "Bağlantı geçersiz veya eksik. E-postadaki bağlantıyı tam olarak açtığınızdan emin olun ya da yöneticinizden yeni bir davet isteyin." };
}

/* Şifre belirlenene kadar tutulan işaret (kullanıcıya özel). Güvenlik kararı değildir — yalnızca akışı yönlendirir. */
const flagKey = (userId) => `cw:needs-password:${userId}`;
export function markNeedsPassword(userId, storage = globalThis.localStorage) {
  try { if (userId) storage.setItem(flagKey(userId), "1"); } catch { /* depolama kapalı */ }
}
export function needsPassword(userId, storage = globalThis.localStorage) {
  try { return !!userId && storage.getItem(flagKey(userId)) === "1"; } catch { return false; }
}
export function clearNeedsPassword(userId, storage = globalThis.localStorage) {
  try { if (userId) storage.removeItem(flagKey(userId)); } catch { /* depolama kapalı */ }
}
