// İlk girişte zorunlu "Gizlilik ve Rekabet Sözleşmesi" — tarayıcı testleri (yalnızca geliştirme: ?authdemo, bellek içi oturum).
//   npm run test:ui:agreement
// yeni@demo.test sözleşmeyi henüz onaylamamış hesaptır; diğer demo hesaplar onaylamış sayılır.
// Sunucu tarafı (profiles.agreement_accepted, accept_agreement()) supabase/009_agreement.sql ile canlı / geliştirme projesinde doğrulanır.
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5187, debugPort: 9341 });
const { page, viewport, check, consoleProblems, send } = h;
const base = h.url.replace("/?demo", "");
// Ekran parametreleri (?sayfa, ?marka … — sayfa yenilemede kalınan ekran) yönlendirme kararının parçası değildir.
const path = () => page(`const q = new URLSearchParams(location.search); ["sayfa", "sekme", "marka", "gorev", "icerik", "toplu"].forEach((k) => q.delete(k));
  const s = q.toString().replace(/=(&|$)/g, "$1"); return location.pathname + (s ? "?" + s : "");`);
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

  /* Yönetici: metni panelden düzenler */
  await login("admin@demo.test");
  await waitFor(() => page(`return location.pathname === "/dashboard" && !!$("aside");`), 8000).catch(() => {});
  check("Onaylamış yönetici doğrudan /dashboard'a gider", (await path()) === "/dashboard?authdemo" && !(await page(`return !!$("[data-agreement]");`)), await path());
  await page(`exact("aside button", "Sözleşme")?.click() || $$("aside button").find((b) => b.textContent.trim() === "Sözleşme").click(); return true;`);
  await waitFor(() => page(`return !!$("[data-agreement-admin]");`), 5000).catch(() => {});
  check("Admin menüsünde “Sözleşme” sayfası: kayıtlı metin yok → hazır taslak düzenlenir", await page(`return !!$("[data-agreement-admin]") && $("[data-agreement-status]").textContent.includes("Henüz kaydedilmiş metin yok") && $$("[data-agreement-section]").length === 14;`));
  check("Doldurulacak boşluklar listelenir", await page(`const b = $("[data-agreement-blanks]"); return !!b && b.textContent.includes("[Şirket Unvanı]") && b.textContent.includes("[Cezai Şart Tutarı]");`));
  check("Onay durumu: onaylayan / bekleyen kullanıcılar", await page(`return $$("[data-agreement-person='accepted']").length >= 3 && $("[data-agreement-people]").textContent.includes("aktif kullanıcı onayladı");`));
  check("Değişiklik yokken Kaydet pasif", await page(`return $$("[data-agreement-admin] button").filter((b) => b.textContent.trim() === "Kaydet").every((b) => b.disabled);`));

  // Boşluğu doldur, boş bölüm ekleyip doğrulamayı dene
  await page(`const t = $("textarea[aria-label='Bölüm 1 metni']"); setValue(t, t.value.replace("[Şirket Unvanı]", "Atlas Dijital Ajans Ltd. Şti.")); return true;`);
  check("Doldurulan boşluk listeden düşer; kaydedilmemiş uyarısı", await page(`return !$("[data-agreement-blanks]").textContent.includes("[Şirket Unvanı]") && !!$("[data-agreement-dirty]");`));
  await page(`exact("button", "Bölüm Ekle").click(); await tick(); $$("[data-agreement-admin] button").find((b) => b.textContent.trim() === "Kaydet").click(); return true;`);
  check("Boş bölüm kaydedilmez (alan hatası)", await waitFor(() => page(`return $("[data-agreement-section='14']")?.textContent.includes("Bölüm metni boş olamaz.");`), 2000).catch(() => false));
  await page(`setValue($("input[aria-label='Bölüm 15 başlığı']"), "15. Ek Hüküm"); setValue($("textarea[aria-label='Bölüm 15 metni']"), "Ek hüküm metni."); return true;`);
  await page(`setValue($("textarea[aria-label='Bölüm 15 metni']"), "Ek hüküm metni."); $$("button[aria-label='Yukarı taşı']").at(-1).click(); return true;`);
  check("Bölüm sırası değiştirilebilir", await page(`return $("input[aria-label='Bölüm 14 başlığı']").value === "15. Ek Hüküm";`));
  await page(`exact("button", "Önizle").click(); return true;`);
  check("Önizleme: kullanıcının göreceği metin, kalan boşluklar vurgulu", await waitFor(() => page(`const p = $("[data-agreement-preview]"); return !!p && p.textContent.includes("Atlas Dijital Ajans Ltd. Şti.") && p.textContent.includes("Ek hüküm metni.") && $$("[data-agreement-blank]", p).length > 0;`), 2000).catch(() => false));
  await page(`exact("button", "Kapat").click(); return true;`);
  await page(`$("[data-agreement-reaccept]").click(); await tick(); $$("[data-agreement-admin] button").find((b) => b.textContent.trim() === "Kaydet").click(); return true;`);
  check("Kaydedilir (herkes yeniden onaylasın)", await waitFor(() => page(`return document.body.textContent.includes("Diğer tüm kullanıcılar bir sonraki girişte yeniden onaylayacak") && $("[data-agreement-status]").textContent.includes("Yayındaki sürüm") && !$("[data-agreement-dirty]");`), 4000).catch(() => false));
  check("Kaydeden yönetici onaylamış, diğerleri bekliyor", await page(`return $$("[data-agreement-person='accepted']").length === 1 && $$("[data-agreement-person='pending']").length >= 3;`));
  await logoutFromPanel();

  /* Daha önce onaylamış müşteri: metin değiştiği için yeniden onaylar */
  await login("musteri@demo.test");
  await waitFor(() => page(`return location.pathname === "/sozlesme";`), 8000).catch(() => {});
  check("Yeniden onay: müşteri yeni metni görür", await onAgreement() && await page(`const t = $("[data-agreement]").textContent; return t.includes("Atlas Dijital Ajans Ltd. Şti.") && t.includes("15. Ek Hüküm") && !t.includes("[Şirket Unvanı]");`), await path());
  await page(`$("[data-agreement-consent]").click(); await tick(); exact("button", "Onaylıyorum, Devam Et").click(); return true;`);
  await waitFor(() => page(`return location.pathname === "/onay";`), 8000).catch(() => {});
  check("Onaydan sonra müşteri /onay'a gider", (await path()) === "/onay?authdemo" && !(await page(`return !!$("[data-agreement]");`)), await path());

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
