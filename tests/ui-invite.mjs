// Çalışan daveti → bağlantı → ilk şifre → sözleşme → panel — tarayıcı testleri (yalnızca geliştirme: ?authdemo, bellek içi oturum).
//   npm run test:ui:invite
// Gerçek e-posta gönderimi, Supabase jeton doğrulaması ve SMTP bu testte YOKTUR; canlı / geliştirme projesinde ayrıca doğrulanır.
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

  /* ── Admin: davet formu ── */
  await go("/login?authdemo");
  await login("admin@demo.test", "Demo1234");
  await waitFor(() => page(`return location.pathname === "/dashboard";`), 8000);
  await page(`byText("aside button", "Kullanıcılar & Yetkiler").click(); return true;`);
  await waitFor(() => page(`return $("main").textContent.includes("Kullanıcılar & Yetkiler");`), 4000);
  check("Davet bekleyen kullanıcı listede işaretlenir", await waitFor(() => page(`return $$("[data-invite-pending]").length >= 1;`), 4000).catch(() => false));
  check("Davet bekleyende “Daveti yeniden gönder”, diğerlerinde “Şifre sıfırlama” (ayrı işlemler)",
    await page(`return !!$("button[aria-label='Daveti yeniden gönder']") && !!$("button[aria-label='Şifre sıfırlama bağlantısı gönder']");`));
  await page(`$("button[aria-label='Daveti yeniden gönder']").click(); return true;`);
  check("Yeniden davet gönderilir", await waitFor(() => page(`return (globalThis.__cwMails || []).includes("resend:u3") && document.body.textContent.includes("yeni davet bağlantısı gönderildi");`), 3000).catch(() => false));
  await page(`globalThis.__cwSimulateInviteError = "E-posta gönderim sınırı aşıldı."; $$("button[aria-label='Şifre sıfırlama bağlantısı gönder']").find((x) => !x.disabled).click(); return true;`);
  check("Sıfırlama e-postası gönderilemezse hata gösterilir (başarı denmez)", await waitFor(() => has("E-posta gönderim sınırı aşıldı."), 3000).catch(() => false) && !(await page(`return (globalThis.__cwMails || []).some((m) => m.startsWith("reset:"));`)));

  const openInvite = async () => {
    await page(`exact("button", "Kullanıcı Ekle").click(); return true;`);
    await waitFor(() => page(`return !!$("#cw-user-form");`), 3000);
    await page(`const f = $("#cw-user-form"); const i = $$("input", f); setValue(i[0], "Deniz Kaya"); setValue(i[1], "deniz@ornek.com"); return true;`);
  };
  await openInvite();
  check("Davet formunda rol varsayılanı Çalışan; buton “Davet Gönder”", await page(`return $("[role='radio'][aria-checked='true']").textContent.includes("Çalışan") && !!exact("button", "Davet Gönder");`));
  await page(`globalThis.__cwSimulateInviteError = "Davet e-postası gönderilemedi; kullanıcı oluşturulmadı. Supabase'de özel SMTP ayarlı değilse…"; exact("button", "Davet Gönder").click(); return true;`);
  await waitFor(() => page(`return !!$("[data-invite-error]");`), 3000).catch(() => {});
  check("Senaryo: davet e-postası gönderilemezse form açık kalır, neden gösterilir, “oluşturuldu” denmez",
    await page(`return !!$("#cw-user-form") && $("[data-invite-error]").textContent.includes("kullanıcı oluşturulmadı") && !document.body.textContent.includes("davet e-postası gönderildi");`));
  check("Girilen bilgiler korunur (tekrar denenebilir)", await page(`return $$("#cw-user-form input")[1].value === "deniz@ornek.com";`));
  await page(`exact("button", "Davet Gönder").click(); return true;`);
  check("Tekrar denemede davet gönderilir; form kapanır", await waitFor(() => page(`return !$("#cw-user-form") && document.body.textContent.includes("“Deniz Kaya” için davet e-postası gönderildi.");`), 4000).catch(() => false));
  check("Davet sunucuya tek kez gider (çift tıklama / tekrar mükerrer oluşturmaz)", await page(`return (globalThis.__cwInvites || []).filter((e) => e === "deniz@ornek.com").length === 1;`));
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
