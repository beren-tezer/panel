// Yöneticinin şifreyle kullanıcı eklemesi / şifre belirlemesi + eski e-posta bağlantıları (/auth/callback) — tarayıcı testleri (yalnızca geliştirme: ?authdemo, bellek içi oturum).
//   npm run test:ui:invite
// Gerçek Supabase Auth / Edge Function bu testte YOKTUR (bellek içi benzetim); canlıda ayrıca doğrulanır.
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5187, debugPort: 9341 });
const { page, viewport, check, consoleProblems, send } = h;
const base = h.url.replace("/?demo", "");
const path = () => page(`return location.pathname + location.search;`);
const has = (text) => page(`return document.body.textContent.includes(${JSON.stringify(text)});`);
const go = async (url) => { await send("Page.navigate", { url: `${base}${url}` }); await sleep(300); };
const login = async (email, password) => {
  await waitFor(() => page(`return !!$("input[aria-label='Şifre']");`), 6000);
  await page(`setValue($("input[aria-label='E-posta']"), ${JSON.stringify(email)}); setValue($("input[aria-label='Şifre']"), ${JSON.stringify(password)}); exact("button", "Giriş Yap").click(); return true;`);
};
const logout = async () => {
  await page(`const b = $$("aside button").at(-1); b.click(); await tick(200); const out = $$("[data-cw-popover] button").find((x) => x.textContent.includes("Çıkış Yap")); out.click(); return !!out;`);
  await waitFor(() => page(`return location.pathname === "/login";`), 5000).catch(() => {});
};
const setPw = (a, b) => page(`const f = $("[data-set-password]"); setValue($("input[aria-label='Yeni Şifre']", f), ${JSON.stringify(a)}); setValue($("input[aria-label='Yeni Şifre (Tekrar)']", f), ${JSON.stringify(b)});
  $$("button", f).find((x) => x.type === "submit").click(); return true;`);

try {
  await viewport(1440, 900);

  /* ── Admin: şifreyle kullanıcı oluşturma (e-posta yok) ── */
  await go("/login?authdemo");
  await login("admin@demo.test", "Demo1234");
  await waitFor(() => page(`return location.pathname === "/dashboard";`), 8000);
  await page(`byText("aside button", "Kullanıcılar & Yetkiler").click(); return true;`);
  await waitFor(() => page(`return $("main").textContent.includes("Kullanıcılar & Yetkiler");`), 4000);
  check("Davet / e-posta işlemleri kaldırıldı", await page(`return !$("[data-invite-pending]") && !$("button[aria-label='Daveti yeniden gönder']") && !$("button[aria-label='Şifre sıfırlama bağlantısı gönder']");`));

  const fillUser = (pw, rep) => page(`const f = $("#cw-user-form"); const i = $$("input", f); setValue(i[0], "Deniz Kaya"); setValue(i[1], "deniz@ornek.com");
    setValue($("input[aria-label='Yeni kullanıcı şifresi']", f), ${JSON.stringify(pw)}); setValue($("input[aria-label='Yeni kullanıcı şifresi (tekrar)']", f), ${JSON.stringify(rep)}); return true;`);
  await page(`exact("button", "Kullanıcı Ekle").click(); return true;`);
  await waitFor(() => page(`return !!$("#cw-user-form");`), 3000);
  check("Formda şifre + tekrar alanı; rol varsayılanı Çalışan; e-posta gönderilmeyeceği yazıyor",
    await page(`return !!$("input[aria-label='Yeni kullanıcı şifresi']") && !!$("input[aria-label='Yeni kullanıcı şifresi (tekrar)']") && $("[role='radio'][aria-checked='true']").textContent.includes("Çalışan") && document.body.textContent.includes("E-posta gönderilmez.");`));
  check("Şifre alanları gizli (type=password)", await page(`return $("input[aria-label='Yeni kullanıcı şifresi']").type === "password";`));
  await fillUser("kisa", "kisa");
  await page(`exact("button", "Kullanıcı Oluştur").click(); return true;`);
  check("Zayıf şifreyle kullanıcı oluşturulmaz", await waitFor(() => page(`return $("#cw-user-form").textContent.includes("en az 8");`), 2000).catch(() => false) && !(await page(`return !!globalThis.__cwCreated;`)));
  await fillUser("Calisan2026", "Calisan2025");
  await page(`exact("button", "Kullanıcı Oluştur").click(); return true;`);
  check("Şifreler eşleşmezse oluşturulmaz", await waitFor(() => page(`return $("#cw-user-form").textContent.includes("Şifreler eşleşmiyor.");`), 2000).catch(() => false) && !(await page(`return !!globalThis.__cwCreated;`)));
  await page(`byText("#cw-user-form button", "Güçlü şifre oluştur").click(); return true;`);
  check("“Güçlü şifre oluştur” iki alanı da doldurur ve gösterir", await page(`const a = $("input[aria-label='Yeni kullanıcı şifresi']"), b = $("input[aria-label='Yeni kullanıcı şifresi (tekrar)']");
    return a.value.length === 12 && a.value === b.value && /\\d/.test(a.value) && /[a-zA-Z]/.test(a.value) && a.type === "text";`));
  await fillUser("Calisan2026", "Calisan2026");
  await page(`globalThis.__cwSimulateInviteError = "Bu e-posta ile kayıtlı bir kullanıcı var."; exact("button", "Kullanıcı Oluştur").click(); return true;`);
  await waitFor(() => page(`return !!$("[data-user-error]");`), 3000).catch(() => {});
  check("Sunucu hatasında form açık kalır, neden gösterilir, “oluşturuldu” denmez",
    await page(`return !!$("#cw-user-form") && $("[data-user-error]").textContent.includes("kayıtlı bir kullanıcı var") && !document.body.textContent.includes("oluşturuldu.");`));
  await page(`exact("button", "Kullanıcı Oluştur").click(); return true;`);
  check("Kullanıcı şifresiyle oluşturulur; form kapanır", await waitFor(() => page(`return !$("#cw-user-form") && document.body.textContent.includes("“Deniz Kaya” oluşturuldu.");`), 4000).catch(() => false));
  check("Sunucuya e-posta, rol ve şifre tek istekte gider",
    await page(`const c = globalThis.__cwCreated || []; return c.length === 1 && c[0].email === "deniz@ornek.com" && c[0].role === "employee" && c[0].password === "Calisan2026";`));

  /* ── Admin: mevcut çalışana şifre belirleme → çalışan doğrudan giriş yapar ── */
  check("Kendi hesabında “Şifre Belirle” kapalı", await page(`return $$("button[aria-label='Şifre Belirle']").some((b) => b.disabled);`));
  await page(`const row = $$("tr").find((r) => r.textContent.includes("ayse@example.com")); $("button[aria-label='Şifre Belirle']", row).click(); return true;`);
  await waitFor(() => page(`return !!$("[data-user-password]");`), 3000);
  await page(`const f = $("[data-user-password]"); setValue($("input[aria-label='Yeni kullanıcı şifresi']", f), "Yeni2026x"); setValue($("input[aria-label='Yeni kullanıcı şifresi (tekrar)']", f), "Yeni2026x"); exact("button", "Şifreyi Kaydet").click(); return true;`);
  check("Yönetici şifre belirler (e-posta gönderilmez)", await waitFor(() => page(`return !$("[data-user-password]") && document.body.textContent.includes("için yeni şifre kaydedildi");`), 3000).catch(() => false));
  await logout();
  await login("calisan@demo.test", "Demo1234");
  check("Eski şifre geçersiz", await waitFor(() => has("E-posta veya şifre hatalı."), 3000).catch(() => false));
  await page(`setValue($("input[aria-label='Şifre']"), "Yeni2026x"); exact("button", "Giriş Yap").click(); return true;`);
  await waitFor(() => page(`return location.pathname === "/dashboard" && !!$("[data-employee-boxes]");`), 8000).catch(() => {});
  check("Çalışan yöneticinin belirlediği şifreyle doğrudan giriş yapar (onay / davet yok)", (await path()) === "/dashboard?authdemo" && !(await page(`return !!$("[data-set-password]");`)), await path());
  await logout();

  /* ── Süresi dolmuş / kullanılmış bağlantı ── */
  await go("/auth/callback?authdemo&token_hash=demo-expired&type=invite");
  await waitFor(() => page(`return !!$("[data-callback-error]");`), 5000).catch(() => {});
  check("Süresi dolmuş davet: /login'e atılmaz, açıklama gösterilir", (await path()).startsWith("/auth/callback") && await has("süresi dolmuş"), await path());
  check("Jeton adresten silinir", !(await path()).includes("token_hash"), await path());
  await go("/auth/callback?authdemo#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  check("Supabase'in hata dönüşü (#error_code=otp_expired) okunur", await waitFor(() => page(`return $("[data-callback-error]")?.dataset.callbackError === "otp_expired";`), 4000).catch(() => false));
  await page(`exact("button", "Giriş Sayfasına Git").click(); return true;`);
  check("Hata ekranından giriş sayfasına gidilir", await waitFor(() => page(`return location.pathname === "/login";`), 3000).catch(() => false));
  await go("/auth/callback?authdemo");
  check("Parametresiz bağlantı: geçersiz bağlantı açıklaması", await waitFor(() => page(`return !!$("[data-callback-error]");`), 4000).catch(() => false));

  /* ── Davet kabulü (mobil) ── */
  await viewport(390, 844, true);
  await go("/auth/callback?authdemo&token_hash=demo-invite:yeni@demo.test&type=invite");
  check("Doğrulama sürerken yönlendirme yapılmaz", await page(`return location.pathname === "/auth/callback";`));
  await waitFor(() => page(`return location.pathname === "/sifre-olustur";`), 6000).catch(() => {});
  check("Senaryo: davet bağlantısı oturum açar ve /sifre-olustur'a götürür", (await path()).startsWith("/sifre-olustur") && (await page(`return !!$("[data-set-password]");`)), await path());
  check("Mobil: şifre ekranı yatay kaydırma olmadan sığar", await page(`return document.documentElement.scrollWidth <= innerWidth;`));
  await page(`history.pushState(null, "", "/dashboard?authdemo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(500);
  check("Şifre belirlenmeden panele geçilemez", (await path()).startsWith("/sifre-olustur"), await path());
  await setPw("kisa", "kisa");
  check("Zayıf şifre reddedilir", await waitFor(() => has("en az 8"), 2000).catch(() => false));
  await setPw("Calisan2026", "Calisan2025");
  check("Şifreler eşleşmezse kaydedilmez", await waitFor(() => has("Şifreler eşleşmiyor."), 2000).catch(() => false));
  await setPw("Calisan2026", "Calisan2026");
  await waitFor(() => page(`return location.pathname === "/sozlesme";`), 6000).catch(() => {});
  check("Şifre kaydedilince sözleşme onayına geçer (ilk giriş)", (await path()).startsWith("/sozlesme"), await path());
  await page(`const c = $("[data-agreement-consent]"); c.click(); await tick(100); exact("button", "Onaylıyorum, Devam Et").click(); return true;`);
  await waitFor(() => page(`return location.pathname === "/dashboard" && !!$("[data-employee-boxes]");`), 8000).catch(() => {});
  check("Senaryo: ilk başarılı giriş — çalışan paneli (/dashboard)", (await path()) === "/dashboard?authdemo" && await page(`return !!$("[data-employee-boxes]");`), await path());
  check("Çalışan yönetim ekranlarını görmez", await page(`return !$$("aside button, nav button").some((b) => /Kullanıcılar & Yetkiler/.test(b.textContent));`));
  await page(`history.pushState(null, "", "/sifre-olustur?authdemo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(500);
  check("Şifre belirlendikten sonra /sifre-olustur tekrar açılmaz", (await path()) === "/dashboard?authdemo", await path());
  await page(`history.pushState(null, "", "/onay?authdemo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(500);
  check("Yetkisiz erişim: çalışan müşteri portalını açamaz", (await path()) === "/dashboard?authdemo", await path());

  /* ── Çıkış ve tekrar giriş ── */
  await viewport(1440, 900);
  await logout();
  check("Çıkışta /login", (await path()).startsWith("/login"), await path());
  await login("yeni@demo.test", "Calisan2026");
  await waitFor(() => page(`return location.pathname === "/dashboard" && !!$("[data-employee-boxes]");`), 8000).catch(() => {});
  check("Senaryo: belirlenen şifreyle tekrar giriş — şifre / sözleşme tekrar sorulmaz", (await path()) === "/dashboard?authdemo", await path());
  await logout();

  /* ── Daha önce kullanılan davet ── */
  await go("/auth/callback?authdemo&token_hash=demo-used&type=invite");
  check("Kullanılmış davet bağlantısı açıklamayla reddedilir", await waitFor(() => page(`return !!$("[data-callback-error]");`), 5000).catch(() => false));

  /* ── Oturumsuz erişim ── */
  await go("/sifre-olustur?authdemo");
  await waitFor(() => page(`return location.pathname === "/login";`), 4000).catch(() => {});
  check("Oturumsuz /sifre-olustur → /login", (await path()).startsWith("/login"), await path());

  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check(`Beklenmeyen hata: ${err.message}`, false);
} finally {
  await h.close();
}
