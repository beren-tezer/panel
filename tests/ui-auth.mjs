// Giriş / çıkış / rol bazlı yönlendirme — tarayıcı testleri (yalnızca geliştirme: ?authdemo, bellek içi oturum).
//   npm run test:ui:auth
// Gerçek Supabase Auth (oturumun sayfa yenilemede korunması, süre dolması) canlı / geliştirme projesinde doğrulanır.
import { startHarness, waitFor, sleep } from "./ui-harness.mjs";

const h = await startHarness({ port: 5186, debugPort: 9340 });
const { page, viewport, check, consoleProblems, send } = h;
const base = h.url.replace("/?demo", "");
// Ekran parametreleri (?sayfa, ?marka … — sayfa yenilemede kalınan ekran) yönlendirme kararının parçası değildir.
const path = () => page(`const q = new URLSearchParams(location.search); ["sayfa", "sekme", "marka", "gorev", "icerik", "toplu"].forEach((k) => q.delete(k));
  const s = q.toString().replace(/=(&|$)/g, "$1"); return location.pathname + (s ? "?" + s : "");`);
const login = async (email, password) => {
  await waitFor(() => page(`return !!$("input[aria-label='Şifre']");`), 5000);
  await page(`setValue($("input[aria-label='E-posta']"), ${JSON.stringify(email)}); setValue($("input[aria-label='Şifre']"), ${JSON.stringify(password)}); exact("button", "Giriş Yap").click(); return true;`);
};
const logout = async () => {
  await page(`$$("aside button").find((b) => b.querySelector("svg") && b.textContent.includes("·") || b.getAttribute("aria-haspopup"))?.click(); return true;`);
  await page(`const b = $$("aside button").at(-1); b.click(); await tick(200); const out = $$("[data-cw-popover] button").find((x) => x.textContent.includes("Çıkış Yap")); out.click(); return !!out;`);
};

try {
  await viewport(1440, 900);
  await send("Page.navigate", { url: `${base}/dashboard?authdemo` });
  await waitFor(() => page(`return location.pathname === "/login";`), 8000).catch(() => {});
  const p0 = await path();
  check("Giriş yapmamış kullanıcı /dashboard → /login (dönüş adresi saklanır)", p0 === "/login?next=%2Fdashboard&authdemo", p0);
  check("Giriş ekranı: e-posta + şifre", await page(`return !!$("input[aria-label='E-posta']") && !!$("input[type='password'][aria-label='Şifre']") && !$("[data-brand-card]");`));
  check("E-postayla giriş bağlantısı seçeneği yok (yalnızca şifre)", await page(`return !document.body.textContent.includes("giriş bağlantısı");`));

  await page(`exact("button", "Giriş Yap").click(); return true;`);
  check("Boş alan doğrulaması", await waitFor(() => page(`return document.body.textContent.includes("Geçerli bir e-posta adresi girin.");`), 2000).catch(() => false));
  await login("musteri@demo.test", "yanlis-sifre");
  check("Hatalı şifre: Türkçe hata, giriş yok", await waitFor(() => page(`return document.body.textContent.includes("E-posta veya şifre hatalı.");`), 3000).catch(() => false) && (await path()).startsWith("/login"));
  await page(`$("button[aria-label='Şifreyi göster']").click(); return true;`);
  check("Şifreyi göster / gizle", await page(`return $("input[aria-label='Şifre']").type === "text";`));

  /* Müşteri */
  await page(`setValue($("input[aria-label='Şifre']"), "Demo1234"); exact("button", "Giriş Yap").click(); return true;`);
  await waitFor(() => page(`return location.pathname === "/onay" && document.body.textContent.includes("Onay Bekleyen İçerikler");`), 8000).catch(() => {});
  check("Senaryo 1: müşteri girişte /onay'a gider (dashboard dönüş adresi müşteri için yok sayılır)", (await path()) === "/onay?authdemo" && !(await page(`return !!$("[data-brand-card]");`)), await path());
  await page(`history.pushState(null, "", "/dashboard?authdemo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(500);
  check("Senaryo 2: müşteri /dashboard'a giremez", (await path()) === "/onay?authdemo" && !(await page(`return !!$("[data-brand-card]");`)));
  const secret = "Kira artış oranı"; // müşterinin gördüğü bir içerik
  check("Müşteri kendi onay bekleyen içeriğini görür", await page(`return document.body.textContent.includes(${JSON.stringify(secret)});`));

  /* Çıkış */
  await logout();
  await waitFor(() => page(`return location.pathname === "/login";`), 5000).catch(() => {});
  check("Senaryo 5: çıkışta /login'e döner; önceki kullanıcının verisi ekranda yok", (await path()).startsWith("/login") && !(await page(`return document.body.textContent.includes(${JSON.stringify(secret)});`)), await path());
  await page(`history.back(); return true;`);
  await sleep(500);
  check("Çıkıştan sonra geri tuşu korumalı sayfayı açmaz", (await path()).startsWith("/login") && !(await page(`return document.body.textContent.includes(${JSON.stringify(secret)});`)), await path());

  /* Admin: dönüş adresi */
  await page(`history.pushState(null, "", "/onay/tepe-emlak?authdemo"); dispatchEvent(new PopStateEvent("popstate")); return true;`);
  await sleep(400);
  check("Oturumsuz marka bağlantısı → /login (bağlantı saklanır)", (await path()) === "/login?next=%2Fonay%2Ftepe-emlak&authdemo", await path());
  await login("admin@demo.test", "Demo1234");
  await waitFor(() => page(`return location.pathname === "/dashboard" && $("main").textContent.includes("İçeriklerin iç onaydan");`), 8000).catch(() => {});
  check("Senaryo 3: admin /dashboard'a gider; saklanan marka bağlantısı ajans onay ekranını açar", (await path()) === "/dashboard?authdemo" && await page(`const m = $("main").textContent; return m.includes("Kira artış oranı") && !m.includes("Makarna çeşitleri");`), await path());
  await page(`$$("aside button").find((b) => b.textContent.includes("Ekip & Marka Yönetimi"))?.click(); return true;`);
  await sleep(500);
  check("İzin listesinde olmayan admin başka hesaba geçemez: rol değiştirici ve 'Portalı Görüntüle' yok",
    await page(`return !$("select[aria-label='Rol']") && !$("select[aria-label='Görüntülenen kullanıcı']") && !$("button[aria-label='Portalı Görüntüle'], button[title='Portalı Görüntüle']") && $$("aside button").some((b) => b.textContent.includes("Ekip & Marka Yönetimi"));`));
  await logout();
  await waitFor(() => page(`return location.pathname === "/login";`), 5000).catch(() => {});

  /* Çalışan */
  await login("calisan@demo.test", "Demo1234");
  await waitFor(() => page(`return location.pathname === "/dashboard" && !!$("[data-employee-boxes]");`), 8000).catch(() => {});
  check("Çalışan /dashboard'a gider (8 kutu)", (await path()) === "/dashboard?authdemo" && await page(`return $$("[data-employee-box]").length === 8;`), await path());
  /* Şifremi Değiştir */
  const openPw = async () => {
    await page(`const b = $$("aside button").at(-1); b.click(); await tick(200); const x = $$("[data-cw-popover] button").find((y) => y.textContent.includes("Şifremi Değiştir")); x.click(); return !!x;`);
    await waitFor(() => page(`return !!$("[data-password-form]");`), 3000);
  };
  const pwSet = (cur, next, rep) => page(`const f = $("[data-password-form]"); const i = $$("input[type='password'], input[type='text']", f);
    setValue(i[0], ${JSON.stringify(cur)}); setValue(i[1], ${JSON.stringify(next)}); setValue(i[2], ${JSON.stringify(rep)}); exact("button", "Şifreyi Güncelle").click(); return true;`);
  await openPw();
  check("Profil menüsünde “Şifremi Değiştir”; şifreyle girişte mevcut şifre sorulur", await page(`return $("[data-password-form]").textContent.includes("Mevcut Şifre");`));
  await pwSet("Demo1234", "Yeni12345", "Yeni1234");
  check("Tekrar eşleşmezse kaydedilmez", await waitFor(() => page(`return $("[data-password-form]").textContent.includes("Şifreler eşleşmiyor.");`), 2000).catch(() => false));
  await pwSet("yanlis-sifre", "Yeni12345", "Yeni12345");
  check("Mevcut şifre yanlışsa kaydedilmez", await waitFor(() => page(`return $("[data-password-form]").textContent.includes("Mevcut şifreniz hatalı.");`), 3000).catch(() => false));
  await pwSet("Demo1234", "kisa", "kisa");
  check("Zayıf şifre reddedilir", await waitFor(() => page(`return $("[data-password-form]").textContent.includes("en az 8");`), 2000).catch(() => false));
  await pwSet("Demo1234", "Yeni12345", "Yeni12345");
  check("Şifre güncellenir", await waitFor(() => page(`return !$("[data-password-form]") && document.body.textContent.includes("Şifreniz güncellendi");`), 3000).catch(() => false));
  await logout();
  await waitFor(() => page(`return location.pathname === "/login";`), 5000).catch(() => {});
  await login("calisan@demo.test", "Demo1234");
  check("Eski şifreyle giriş yapılamaz", await waitFor(() => page(`return document.body.textContent.includes("E-posta veya şifre hatalı.");`), 3000).catch(() => false));
  await page(`setValue($("input[aria-label='Şifre']"), "Yeni12345"); exact("button", "Giriş Yap").click(); return true;`);
  check("Yeni şifreyle giriş yapılır", await waitFor(() => page(`return location.pathname === "/dashboard" && !!$("[data-employee-boxes]");`), 6000).catch(() => false));

  check("Çalışanda yönetim menüleri yok", await page(`return !$$("aside button").some((b) => /Ekip & Marka|Kullanıcılar & Yetkiler/.test(b.textContent));`));

  check("Konsolda hata yok", consoleProblems.length === 0, consoleProblems.slice(0, 3).join(" || "));
} catch (err) {
  check(`Beklenmeyen hata: ${err.message}`, false);
} finally {
  await h.close();
}
