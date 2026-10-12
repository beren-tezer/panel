// İlk girişte zorunlu "Gizlilik ve Rekabet Sözleşmesi" — tarayıcı testleri (yalnızca geliştirme: ?authdemo, bellek içi oturum).
//   npm run test:ui:agreement
// yeni@demo.test sözleşmeyi henüz onaylamamış hesaptır; diğer demo hesaplar onaylamış sayılır.
// Sunucu tarafı (profiles.agreement_accepted, accept_agreement()) supabase/009_agreement.sql ile canlı / geliştirme projesinde doğrulanır.
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5187, debugPort: 9341 });
const { page, viewport, check, consoleProblems, send } = h;
const base = h.url.replace("/?demo", "");
const path = () => page(`return location.pathname + location.search;`);
const onAgreement = () => page(`return !!$("[data-agreement]") && !$("[data-brand-card]") && !$("[data-employee-boxes]") && !$("aside");`);
const login = async (email) => {
  await waitFor(() => page(`return !!$("input[aria-label='Şifre']");`), 20000);
  await page(`setValue($("input[aria-label='E-posta']"), ${JSON.stringify(email)}); setValue($("input[aria-label='Şifre']"), "Demo1234"); exact("button", "Giriş Yap").click(); return true;`);
};
const go = async (p) => { await page(`history.pushState(null, "", ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent("popstate")); return true;`); await sleep(400); };
const logoutFromPanel = async () => {
  await page(`const b = $$("aside button").at(-1); b.click(); await tick(200); const out = $$("[data-cw-popover] button").find((x) => x.textContent.includes("Çıkış Yap")); out.click(); return !!out;`);
  await waitFor(() => page(`return location.pathname === "/login";`), 5000).catch(() => {});
};

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: `${base}/onay/tepe-emlak?authdemo` });
  await waitFor(() => page(`return location.pathname === "/login";`), 8000).catch(() => {});
  await login("yeni@demo.test");
  await waitFor(() => page(`return location.pathname === "/sozlesme";`), 8000).catch(() => {});
  check("İlk giriş: sözleşme ekranı açılır, gideceği adres saklanır", (await path()) === "/sozlesme?next=%2Fonay%2Ftepe-emlak&authdemo" && await onAgreement(), await path());
  check("Başlık ve metin görünür", await page(`const t = $("[data-agreement]").textContent; return t.includes("Gizlilik ve Rekabet Sözleşmesi") && t.includes("Rekabet Yasağı") && !!$("[data-agreement-text]");`));
  check("Onay kutusu işaretlenmeden devam edilemez", await page(`return exact("button", "Onaylıyorum, Devam Et").disabled === true;`));

  await go("/dashboard?authdemo");
  check("Onaysız /dashboard → /sozlesme (panel çizilmez)", (await path()) === "/sozlesme?next=%2Fdashboard&authdemo" && await onAgreement(), await path());
  await go("/onay?authdemo");
  check("Onaysız /onay → /sozlesme", (await path()).startsWith("/sozlesme") && await onAgreement(), await path());
  await go("/rastgele?authdemo");
  check("Onaysız bilinmeyen adres → /sozlesme", (await path()) === "/sozlesme?authdemo" && await onAgreement(), await path());

  /* Onaylamadan çıkış */
  await page(`exact("button", "Onaylamadan Çıkış Yap").click(); return true;`);
  await waitFor(() => page(`return location.pathname === "/login";`), 5000).catch(() => {});
  check("“Onaylamadan Çıkış Yap” oturumu kapatır", (await path()).startsWith("/login") && !(await page(`return !!$("[data-agreement]");`)), await path());
  await login("yeni@demo.test");
  await waitFor(() => page(`return location.pathname === "/sozlesme";`), 8000).catch(() => {});
  check("Tekrar girişte sözleşme yine istenir", await onAgreement());

  /* Kayıt hatası */
  await page(`$("[data-agreement-consent]").click(); await tick(); window.__cwSimulateSaveError = true; exact("button", "Onaylıyorum, Devam Et").click(); return true;`);
  check("Kayıt başarısızsa hata gösterilir, panel açılmaz",
    await waitFor(() => page(`return $("[role='alert']")?.textContent.includes("Onayınız kaydedilemedi");`), 3000).catch(() => false) && await onAgreement());

  /* Onay */
  await page(`exact("button", "Onaylıyorum, Devam Et").click(); return true;`);
  await waitFor(() => page(`return location.pathname === "/dashboard" && !!$("[data-employee-boxes]");`), 8000).catch(() => {});
  check("Onaydan sonra rolün sayfasına geçilir (çalışan → /dashboard)", (await path()) === "/dashboard?authdemo" && await page(`return !!$("[data-employee-boxes]") && !$("[data-agreement]");`), await path());
  await go("/sozlesme?authdemo");
  check("Onaylamış kullanıcı /sozlesme'de kalmaz", (await path()) === "/dashboard?authdemo", await path());

  await logoutFromPanel();
  await login("yeni@demo.test");
  await waitFor(() => page(`return location.pathname === "/dashboard";`), 8000).catch(() => {});
  check("Sonraki girişte sözleşme sorulmaz", (await path()) === "/dashboard?authdemo" && !(await page(`return !!$("[data-agreement]");`)), await path());
  await logoutFromPanel();

  /* Daha önce onaylamış müşteri */
  await login("musteri@demo.test");
  await waitFor(() => page(`return location.pathname === "/onay";`), 8000).catch(() => {});
  check("Onaylamış hesap doğrudan paneline gider", (await path()) === "/onay?authdemo" && !(await page(`return !!$("[data-agreement]");`)), await path());

  /* Mobil */
  {
    await viewport(375, 700, true);
    await send("Page.navigate", { url: `${base}/login?authdemo` });
    await sleep(800);
    // Bellek içi oturum sayfa yenilemede sıfırlanır: yeni@demo.test yeniden onaysız başlar.
    await login("yeni@demo.test");
    await waitFor(() => page(`return location.pathname === "/sozlesme";`), 8000).catch(() => {});
    check("Mobil (375px): yatay kaydırma yok, onay düğmesi ekranda", await page(`
      const b = exact("button", "Onaylıyorum, Devam Et"); const r = rect(b);
      return document.documentElement.scrollWidth <= innerWidth && r.y + r.h <= innerHeight && r.w > 0;`), await path());
    check("Mobil: uzun metin kendi alanında kayar", await page(`const t = $("[data-agreement-text]"); return t.scrollHeight > t.clientHeight;`));
  }

  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check(`Beklenmeyen hata: ${err.message}`, false);
} finally {
  await h.close();
}
