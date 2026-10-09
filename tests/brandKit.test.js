import { test } from "node:test";
import assert from "node:assert/strict";
import { createBrandKitStore, createMemoryBrandKit, normalizeHex, validateDriveUrl, validateHttpsUrl, validateUpload } from "../brandKit.js";
import { canEditBrandKit, canViewBrandKit, permissionsFor, scopeBrandKit } from "../rbac.js";

const file = (name, type, size = 1000) => new File([new Uint8Array(size)], name, { type });

test("HEX doğrulama", () => {
  assert.equal(normalizeHex("ea580c"), "#EA580C");
  assert.equal(normalizeHex("#fff"), "#FFFFFF");
  assert.equal(normalizeHex("#12345"), null);
  assert.equal(normalizeHex("kırmızı"), null);
});

test("Drive bağlantısı doğrulama", () => {
  assert.equal(validateDriveUrl("https://drive.google.com/drive/folders/abc").ok, true);
  assert.equal(validateDriveUrl("https://docs.google.com/document/d/x").ok, true);
  assert.equal(validateDriveUrl("http://drive.google.com/x").ok, false);
  assert.equal(validateDriveUrl("https://drive.google.com.evil.com/x").ok, false);
  assert.equal(validateDriveUrl("javascript:alert(1)").ok, false);
  assert.equal(validateHttpsUrl("").ok, true);
  assert.equal(validateHttpsUrl("ftp://x").ok, false);
});

test("Dosya yükleme doğrulaması: tür, uzantı ve boyut", () => {
  assert.equal(validateUpload(file("logo.png", "image/png")).ok, true);
  assert.equal(validateUpload(file("font.woff2", "")).ok, true); // Windows fontlarda tür boş gelebilir
  assert.equal(validateUpload(file("site.html", "text/html")).ok, false);
  assert.equal(validateUpload(file("run.exe", "application/x-msdownload")).ok, false);
  assert.equal(validateUpload(file("sahte.png", "text/html")).ok, false); // uzantı/tür uyuşmazlığı
  assert.equal(validateUpload(file("bos.pdf", "application/pdf", 0)).ok, false);
  assert.equal(validateUpload(file("dev.pdf", "application/pdf", 26 * 1024 * 1024)).ok, false);
});

/* ───────── Rol kuralları ───────── */

const users = {
  admin: { id: "a", role: "admin" },
  emp: { id: "e", role: "employee" }, // varsayılan izinler: düzenleme kapalı
  editor: { id: "ed", role: "employee", permissions: [...permissionsFor({ id: "x", role: "employee" })].filter((p) => p.startsWith("can")).concat("canEditBrandKit", "canViewTasks", "canViewBrandFiles", "canEditContent") },
  stranger: { id: "s", role: "employee" },
  client: { id: "c", role: "client" },
  otherClient: { id: "c2", role: "client" },
};
const state = {
  memberships: [{ brandId: "b1", userId: "e" }, { brandId: "b1", userId: "ed" }, { brandId: "b1", userId: "c" }, { brandId: "b2", userId: "c2" }],
  tasks: [{ id: "t", brandId: "b1", assigneeId: "e" }],
};

test("kılavuz görüntüleme marka bazında izole", () => {
  assert.equal(canViewBrandKit(users.admin, "b2", state), true);
  assert.equal(canViewBrandKit(users.emp, "b1", state), true);
  assert.equal(canViewBrandKit(users.stranger, "b1", state), false);
  assert.equal(canViewBrandKit(users.client, "b1", state), true);
  assert.equal(canViewBrandKit(users.client, "b2", state), false); // başka müşterinin markası
});

test("düzenleme yalnızca admin ve açıkça izin verilen çalışan", () => {
  assert.equal(canEditBrandKit(users.admin, "b1", state), true);
  assert.equal(canEditBrandKit(users.emp, "b1", state), false);
  assert.equal(canEditBrandKit(users.editor, "b1", state), true);
  assert.equal(canEditBrandKit(users.editor, "b2", state), false);
  assert.equal(canEditBrandKit(users.client, "b1", state), false);
});

test("müşteri ekip içi talimat, dosya ve bağlantıları görmez", () => {
  const data = {
    kit: {}, colors: [{ id: "k" }],
    fonts: [{ id: "f", assetId: "secret" }],
    instructions: [{ id: "i1", visibility: "internal" }, { id: "i2", visibility: "shared" }],
    assets: [{ id: "secret", visibility: "internal" }, { id: "pub", visibility: "shared" }],
    links: [{ id: "l1", visibility: "internal" }, { id: "l2", visibility: "shared" }],
  };
  const c = scopeBrandKit(users.client, data);
  assert.deepEqual(c.instructions.map((x) => x.id), ["i2"]);
  assert.deepEqual(c.assets.map((x) => x.id), ["pub"]);
  assert.deepEqual(c.links.map((x) => x.id), ["l2"]);
  assert.equal(c.fonts[0].assetId, null); // gizli font dosyasına bağ da görünmez
  const e = scopeBrandKit(users.emp, data);
  assert.equal(e.instructions.length, 2);
  assert.equal(e.assets.length, 2);
});

/* ───────── Mağaza: kalıcılık, izolasyon, geri alma ───────── */

test("renk ekle/düzenle/sırala/sil ve markalar arası izolasyon", async () => {
  const store = createBrandKitStore(createMemoryBrandKit());
  await store.load("b1");
  await store.createKit("b1", "a");
  await store.save("colors", { id: "c1", brandId: "b1", name: "Ana", hex: "#EA580C", type: "primary", sortOrder: 0 }, "a");
  await store.save("colors", { id: "c2", brandId: "b1", name: "Koyu", hex: "#0F172A", type: "secondary", sortOrder: 1 }, "a");
  await store.save("colors", { id: "c1", brandId: "b1", name: "Ana Turuncu", hex: "#EA580C", type: "primary", sortOrder: 0 }, "a");
  await store.reorder("colors", "b1", ["c2", "c1"], "a");
  const fresh = await store.load("b1", { force: true }); // "sayfa yenileme": kaynaktan tekrar okunur
  assert.deepEqual(fresh.colors.map((c) => c.name), ["Koyu", "Ana Turuncu"]);
  assert.equal(fresh.kit.updatedBy, "a");
  const other = await store.load("b2");
  assert.equal(other.kit, null);
  assert.equal(other.colors.length, 0);
  await store.remove("colors", fresh.colors[0], "a");
  assert.equal((await store.load("b1", { force: true })).colors.length, 1);
});

test("başarısız kayıtta iyimser değişiklik geri alınır", async () => {
  const api = createMemoryBrandKit();
  const store = createBrandKitStore({ ...api, save: async () => { throw new Error("Bu işlem için yetkiniz yok."); } });
  await store.load("b1");
  await api.createKit("b1", "a");
  await store.load("b1", { force: true });
  await assert.rejects(store.save("colors", { id: "x", brandId: "b1", name: "X", hex: "#000000", type: "primary" }, "a"));
  assert.equal(store.get("b1").data.colors.length, 0);
});

test("dosya yükleme: ilerleme, kayıt ve silinince font bağının kalkması", async () => {
  const store = createBrandKitStore(createMemoryBrandKit());
  await store.load("b1");
  await store.createKit("b1", "a");
  const progress = [];
  const asset = await store.upload("b1", file("Marka.woff2", "font/woff2"), { category: "fonts", visibility: "shared" }, { userId: "a", onProgress: (p) => progress.push(p) });
  assert.ok(progress.length > 1 && progress.at(-1) === 1);
  assert.ok(asset.storagePath.startsWith("b1/"));
  assert.equal(asset.fileType, "Font");
  await store.save("fonts", { id: "f1", brandId: "b1", family: "Marka", role: "heading", weights: [700], assetId: asset.id }, "a");
  await store.remove("assets", asset, "a");
  const d = store.get("b1").data;
  assert.equal(d.assets.length, 0);
  assert.equal(d.fonts[0].assetId, null);
  await assert.rejects(store.upload("b1", file("x.html", "text/html"), { category: "other", visibility: "shared" }, { userId: "a" }));
});
