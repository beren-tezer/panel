/*
 * AgencyOS — şifre kuralları ("Şifremi Değiştir").
 * Şifreler yalnızca Supabase Auth'ta (bcrypt özeti) saklanır; panel veya veritabanı tablolarında tutulmaz.
 */

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72; // bcrypt sınırı

/* null = geçerli; aksi halde kullanıcıya gösterilecek Türkçe gerekçe. */
export function validatePassword(p) {
  const s = String(p ?? "");
  if (s.length < MIN_PASSWORD) return `Şifre en az ${MIN_PASSWORD} karakter olmalı.`;
  if (s.length > MAX_PASSWORD) return `Şifre en fazla ${MAX_PASSWORD} karakter olabilir.`;
  if (!s.trim()) return "Şifre yalnızca boşluktan oluşamaz.";
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(s) || !/\d/.test(s)) return "Şifre en az bir harf ve bir rakam içermeli.";
  return null;
}

/* Değişiklik formu: { current?, next, repeat } → { alan: hata } (boşsa geçerli). needsCurrent: mevcut şifre sorulacak mı. */
export function validatePasswordChange({ current = "", next = "", repeat = "" }, needsCurrent) {
  const e = {};
  if (needsCurrent && !current) e.current = "Mevcut şifrenizi girin.";
  const bad = validatePassword(next);
  if (bad) e.next = bad;
  else if (needsCurrent && current && next === current) e.next = "Yeni şifre mevcut şifrenizden farklı olmalı.";
  if (!e.next && next !== repeat) e.repeat = "Şifreler eşleşmiyor.";
  return e;
}

/* Oturum jetonundaki kimlik doğrulama yöntemi (amr): e-posta bağlantısı / tek kullanımlık kodla girilmişse mevcut şifre
   sorulmaz (kullanıcı e-postasına erişimini yeni kanıtladı; henüz şifresi olmayabilir). Okunamazsa güvenli taraf: sorulur. */
export function signedInWithEmailLink(accessToken) {
  try {
    const part = String(accessToken).split(".")[1];
    const json = JSON.parse(globalThis.atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    const methods = (json.amr || []).map((m) => m.method);
    return methods.length > 0 && methods.every((m) => m === "otp" || m === "magiclink" || m === "recovery" || m === "invite");
  } catch { return false; }
}
