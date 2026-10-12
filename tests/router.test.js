import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRoute, safeNext } from "../router.js";

const r = (path, phase, role, search = "") => resolveRoute({ path, phase, role, search });

test("giriş yapmamış kullanıcı her korumalı adreste /login'e gider (gideceği sayfa korunur)", () => {
  assert.deepEqual(r("/dashboard", "auth"), { redirect: "/login?next=%2Fdashboard", portal: null });
  assert.equal(r("/onay/tepe-emlak", "auth").redirect, "/login?next=%2Fonay%2Ftepe-emlak");
  assert.equal(r("/", "auth").redirect, "/login");
  assert.equal(r("/rastgele", "auth").redirect, "/login");
  assert.equal(r("/login", "auth").redirect, null);
});

test("Senaryo 1–2: müşteri /onay'a gider; /dashboard ve diğer adresler /onay'a yönlenir", () => {
  assert.deepEqual(r("/login", "ready", "client"), { redirect: "/onay", portal: "*" });
  assert.deepEqual(r("/dashboard", "ready", "client"), { redirect: "/onay", portal: "*" });
  assert.deepEqual(r("/", "ready", "client"), { redirect: "/onay", portal: "*" });
  assert.deepEqual(r("/onay", "ready", "client"), { redirect: null, portal: "*" });
  assert.deepEqual(r("/onay/tepe-emlak", "ready", "client"), { redirect: null, portal: "tepe-emlak" });
  assert.deepEqual(r("/login", "ready", "client", "?next=%2Fonay%2Ftepe-emlak"), { redirect: "/onay/tepe-emlak", portal: "tepe-emlak" });
  assert.deepEqual(r("/login", "ready", "client", "?next=%2Fdashboard"), { redirect: "/onay", portal: "*" }, "müşteri next ile dashboard'a gidemez");
});

test("Senaryo 3: admin / çalışan /dashboard'a gider; müşteri portalı açılmaz", () => {
  for (const role of ["admin", "employee"]) {
    assert.deepEqual(r("/login", "ready", role), { redirect: "/dashboard", portal: null });
    assert.deepEqual(r("/", "ready", role), { redirect: "/dashboard", portal: null });
    assert.deepEqual(r("/dashboard", "ready", role), { redirect: null, portal: null });
    assert.deepEqual(r("/onay/tepe-emlak", "ready", role), { redirect: "/dashboard", portal: "tepe-emlak" }, "marka bağlantısı ajans onay ekranını açar");
    assert.deepEqual(r("/login", "ready", role, "?next=%2Fonay%2Ftepe-emlak"), { redirect: "/dashboard", portal: "tepe-emlak" });
  }
});

test("Senaryo 7: rolü geçersiz / eksik kullanıcıya varsayılan yetki verilmez; yüklenirken / hatada yönlendirme yok", () => {
  assert.deepEqual(r("/dashboard", "ready", null), { redirect: null, portal: null });
  assert.deepEqual(r("/dashboard", "ready", "superadmin"), { redirect: null, portal: null });
  assert.deepEqual(r("/dashboard", "loading", null), { redirect: null, portal: null });
  assert.deepEqual(r("/onay", "error", null), { redirect: null, portal: null });
});

test("güvenli dönüş adresi: yalnızca bilinen iç yollar (açık yönlendirme yok)", () => {
  assert.equal(safeNext("/dashboard"), "/dashboard");
  assert.equal(safeNext("/onay"), "/onay");
  assert.equal(safeNext("/onay/tepe-emlak"), "/onay/tepe-emlak");
  assert.equal(safeNext("https://kotu.site"), null);
  assert.equal(safeNext("//kotu.site/onay"), null);
  assert.equal(safeNext("/onay/%3Cscript%3E"), null);
  assert.equal(safeNext("/users"), null);
});

test("yönlendirme döngüsü yok: yönlendirilen adres aynı rol için tekrar yönlenmez", () => {
  for (const role of ["admin", "employee", "client"]) {
    for (const path of ["/", "/login", "/dashboard", "/onay", "/onay/x-marka", "/baska"]) {
      const first = r(path, "ready", role);
      if (first.redirect) assert.equal(r(first.redirect.split("?")[0], "ready", role).redirect, null, `${role} ${path} → ${first.redirect}`);
    }
  }
  for (const path of ["/", "/dashboard", "/onay/x"]) {
    const first = r(path, "auth");
    assert.equal(r(first.redirect.split("?")[0], "auth").redirect, null);
  }
});

const ra = (path, role, agreementAccepted, search = "") => resolveRoute({ path, phase: "ready", role, search, agreementAccepted });

test("Sözleşme onaylanmadan hiçbir rol panel ekranına giremez; gideceği adres ?next ile korunur", () => {
  for (const role of ["admin", "employee", "client"]) {
    assert.deepEqual(ra("/dashboard", role, false), { redirect: "/sozlesme?next=%2Fdashboard", portal: null });
    assert.deepEqual(ra("/", role, false), { redirect: "/sozlesme", portal: null });
    assert.deepEqual(ra("/onay/tepe-emlak", role, false), { redirect: "/sozlesme?next=%2Fonay%2Ftepe-emlak", portal: null });
    assert.deepEqual(ra("/login", role, false, "?next=%2Fonay"), { redirect: "/sozlesme?next=%2Fonay", portal: null });
    assert.deepEqual(ra("/sozlesme", role, false), { redirect: null, portal: null, agreement: true });
  }
});

test("Onaydan sonra /sozlesme rolün sayfasına (veya saklanan adrese) yönlenir", () => {
  assert.deepEqual(ra("/sozlesme", "admin", true), { redirect: "/dashboard", portal: null });
  assert.deepEqual(ra("/sozlesme", "employee", true, "?next=%2Fonay%2Ftepe-emlak"), { redirect: "/dashboard", portal: "tepe-emlak" });
  assert.deepEqual(ra("/sozlesme", "client", true), { redirect: "/onay", portal: "*" });
  assert.deepEqual(ra("/sozlesme", "client", true, "?next=%2Fonay%2Ftepe-emlak"), { redirect: "/onay/tepe-emlak", portal: "tepe-emlak" });
  assert.deepEqual(ra("/sozlesme", "client", true, "?next=%2Fdashboard"), { redirect: "/onay", portal: "*" }, "müşteri next ile dashboard'a gidemez");
});

test("Sözleşme özelliği yoksa (009 çalıştırılmamış / demo) davranış değişmez; oturumsuz /sozlesme → /login", () => {
  assert.deepEqual(ra("/dashboard", "admin", undefined), { redirect: null, portal: null });
  assert.deepEqual(ra("/dashboard", null, false), { redirect: null, portal: null }, "rolü geçersiz kullanıcıya sözleşme ekranı da açılmaz");
  assert.equal(r("/sozlesme", "auth").redirect, "/login");
  assert.equal(safeNext("/sozlesme"), null, "sözleşme ekranı dönüş adresi olamaz");
});
