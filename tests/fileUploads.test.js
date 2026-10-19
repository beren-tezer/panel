// Dosya yükleme: doğrulama, bağlantı biçimleri, klasör seçimi, hata iletileri, demo kaynağı (fileUploads.js)
import test from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_FILE_TYPES, MAX_UPLOAD_BYTES, TASK_FILE_TYPES, acceptOf, assetFromUpload, attachmentFromUpload, cleanFileName,
  createMemoryFiles, embedUrlOf, fileIdOf, folderForUpload, formatBytes, imageUrlOf, isUploadedFile, mimeOf, uploadErrorMessage, validateUploadFile,
} from "../fileUploads.js";

const file = (name, size, type = "") => ({ name, size, type });

test("Görev eki: görsel, video, PDF kabul; diğerleri ret", () => {
  assert.equal(validateUploadFile(file("a.PNG", 10, "image/png")).type, "Görsel");
  assert.equal(validateUploadFile(file("kurgu.mov", 10, "video/quicktime")).type, "Video");
  assert.equal(validateUploadFile(file("brief.pdf", 10, "application/pdf")).type, "PDF");
  assert.match(validateUploadFile(file("x.exe", 10)).error, /yüklenemez/);
  assert.match(validateUploadFile(file("logo.svg", 10, "image/svg+xml")).error, /yüklenemez/, "SVG görev ekinde yok");
  assert.match(validateUploadFile(file("x.html", 10, "text/html")).error, /yüklenemez/);
});

test("Boyut ve tür tutarlılığı", () => {
  assert.match(validateUploadFile(file("a.png", 0, "image/png")).error, /boş/);
  assert.match(validateUploadFile(file("a.png", MAX_UPLOAD_BYTES + 1, "image/png")).error, /çok büyük.*50,0 MB/);
  assert.ok(validateUploadFile(file("a.png", MAX_UPLOAD_BYTES, "image/png")).ok, "tam sınır kabul");
  assert.match(validateUploadFile(file("a.png", 10, "application/pdf")).error, /uyuşmuyor/);
  assert.ok(validateUploadFile(file("a.jpg", 10, "image/pjpeg")).ok, "tarayıcı takma adı kabul");
  assert.ok(validateUploadFile(file("a.png", 10, "")).ok, "tür bildirilmezse uzantı esas");
});

test("Marka dosyası: vektör, font, arşiv, ofis kabul", () => {
  assert.equal(validateUploadFile(file("logo.svg", 10, "image/svg+xml"), BRAND_FILE_TYPES).type, "Vektör");
  assert.equal(validateUploadFile(file("logo.ai", 10, "application/postscript"), BRAND_FILE_TYPES).type, "Vektör");
  assert.equal(validateUploadFile(file("font.woff2", 10, ""), BRAND_FILE_TYPES).type, "Font");
  assert.equal(validateUploadFile(file("paket.zip", 10, "application/x-zip-compressed"), BRAND_FILE_TYPES).type, "Arşiv");
  assert.equal(validateUploadFile(file("sunum.pptx", 10, ""), BRAND_FILE_TYPES).type, "Şablon");
  assert.ok(acceptOf(TASK_FILE_TYPES).includes(".mp4") && !acceptOf(TASK_FILE_TYPES).includes(".zip"));
});

test("Dosya adı temizlenir", () => {
  assert.equal(cleanFileName("../../etc/passwd"), ".. .. etc passwd");
  assert.equal(cleanFileName(""), "dosya");
});

test("Bağlantı biçimleri: yüklenen dosya, kimlik, önizleme, görsel", () => {
  const up = { name: "Afiş.PNG", driveUrl: "https://drive.google.com/uc?id=1AbC-d_9xYz&export=download" };
  const old = { name: "brief.pdf", driveUrl: "https://drive.google.com/file/d/1Old_Id-77/view" };
  assert.equal(fileIdOf(up.driveUrl), "1AbC-d_9xYz");
  assert.equal(fileIdOf(old.driveUrl), "1Old_Id-77");
  assert.equal(fileIdOf("https://example.com/x"), null);
  assert.ok(isUploadedFile(up) && !isUploadedFile(old) && !isUploadedFile({ driveUrl: "" }), "yalnızca panelden yüklenen biçim");
  assert.equal(embedUrlOf(up), "https://drive.google.com/file/d/1AbC-d_9xYz/preview");
  assert.equal(imageUrlOf(up, 800), "https://drive.google.com/thumbnail?id=1AbC-d_9xYz&sz=w800");
  assert.equal(imageUrlOf({ ...up, thumbnail: "blob:http://x/1" }), "blob:http://x/1", "demo nesne adresi");
  assert.equal(mimeOf(up), "image/png");
  assert.equal(mimeOf({ name: "logo.svg" }), "image/svg+xml");
});

test("Klasör: açık klasör, yoksa türe göre", () => {
  assert.equal(folderForUpload("Vektör", "kampanyalar"), "kampanyalar");
  assert.equal(folderForUpload("Vektör", null), "logolar");
  assert.equal(folderForUpload("Video", null), "video");
  assert.equal(folderForUpload("Font", null), "fontlar");
});

test("Kayıt biçimleri", () => {
  const link = "https://drive.google.com/uc?id=1Fx&export=download";
  const check = validateUploadFile(file("Kampanya Görseli.png", 2048, "image/png"));
  const a = attachmentFromUpload({ id: "x", taskId: "t1", file: file("Kampanya Görseli.png", 2048), check, link, userId: "u1", internal: true });
  assert.deepEqual([a.name, a.type, a.size, a.driveUrl, a.internal, a.addedBy], ["Kampanya Görseli.png", "Görsel", "2 KB", link, true, "u1"]);
  const s = assetFromUpload({ id: "y", brandId: "b1", folderId: null, file: file("logo.svg", 900), check: validateUploadFile(file("logo.svg", 900), BRAND_FILE_TYPES), link, userId: "u2" });
  assert.deepEqual([s.folderId, s.approvalStatus, s.owner, s.driveFileId], ["logolar", "Onay Bekliyor", "u2", "1Fx"]);
});

test("Sunucu hata iletileri anlaşılır; depo adı geçmez", () => {
  assert.equal(uploadErrorMessage(403, JSON.stringify({ error: "Bu göreve dosya ekleme yetkiniz yok." })), "Bu göreve dosya ekleme yetkiniz yok.", "fonksiyon iletisi aynen");
  assert.match(uploadErrorMessage(413, ""), /çok büyük/);
  assert.match(uploadErrorMessage(404, JSON.stringify({ message: "Requested function was not found" })), /yapılandırılmadı/);
  assert.match(uploadErrorMessage(404, ""), /yapılandırılmadı/);
  assert.match(uploadErrorMessage(401, ""), /Oturumunuz/);
  assert.match(uploadErrorMessage(0, ""), /ağ hatası/);
  assert.equal(formatBytes(1536), "2 KB");
});

test("Demo kaynağı: ilerleme, iptal, ağ hatası", async () => {
  const api = createMemoryFiles();
  const steps = [];
  const rec = await api.uploadAttachment({ id: "t1" }, { name: "a.pdf", size: 10, type: "application/pdf" }, { userId: "u1", onProgress: (p) => steps.push(p) });
  assert.equal(rec.taskId, "t1");
  assert.ok(isUploadedFile(rec), "demo kaydı da yüklenen dosya biçiminde");
  assert.equal(steps.at(-1), 1);
  assert.ok(steps.length > 2 && steps.every((p, i) => i === 0 || p >= steps[i - 1]), "ilerleme artarak 1'e ulaşır");
  const ctrl = new AbortController();
  const pending = api.uploadAsset("b1", null, { name: "a.png", size: 10, type: "image/png" }, { signal: ctrl.signal });
  ctrl.abort();
  await assert.rejects(pending, (e) => e.aborted === true);
  globalThis.__cwSimulateUploadError = true;
  await assert.rejects(api.uploadAttachment({ id: "t1" }, { name: "a.png", size: 10, type: "image/png" }), /Bağlantı hatası/);
  await assert.rejects(api.uploadAttachment({ id: "t1" }, { name: "a.exe", size: 10 }), /yüklenemez/);
});
