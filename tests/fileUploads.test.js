// Dosya yükleme: doğrulama, depolama yolu, klasör seçimi, hata iletileri, demo kaynağı (fileUploads.js)
import test from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_FILE_TYPES, MAX_UPLOAD_BYTES, TASK_FILE_TYPES, acceptOf, assetFromUpload, attachmentFromUpload, bucketOf, cleanFileName,
  createMemoryFiles, folderForUpload, formatBytes, storagePathFor, uploadErrorMessage, validateUploadFile,
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

test("Depolama yolu sahibin kimliğiyle başlar; dosya adı yola girmez", () => {
  assert.equal(storagePathFor("t1", "f1", "png"), "t1/f1.png");
  assert.equal(cleanFileName("../../etc/passwd"), ".. .. etc passwd");
  assert.equal(cleanFileName(""), "dosya");
});

test("Klasör: açık klasör, yoksa türe göre", () => {
  assert.equal(folderForUpload("Vektör", "kampanyalar"), "kampanyalar");
  assert.equal(folderForUpload("Vektör", null), "logolar");
  assert.equal(folderForUpload("Video", null), "video");
  assert.equal(folderForUpload("Font", null), "fontlar");
});

test("Kayıt biçimleri ve kova", () => {
  const check = validateUploadFile(file("Kampanya Görseli.png", 2048, "image/png"));
  const a = attachmentFromUpload({ id: "x", taskId: "t1", file: file("Kampanya Görseli.png", 2048), check, path: "t1/x.png", userId: "u1", internal: true });
  assert.deepEqual([a.name, a.type, a.size, a.driveUrl, a.storagePath, a.internal, bucketOf(a)], ["Kampanya Görseli.png", "Görsel", "2 KB", "", "t1/x.png", true, "task-files"]);
  const s = assetFromUpload({ id: "y", brandId: "b1", folderId: null, file: file("logo.svg", 900), check: validateUploadFile(file("logo.svg", 900), BRAND_FILE_TYPES), path: "b1/y.svg", userId: "u2" });
  assert.deepEqual([s.folderId, s.approvalStatus, s.owner, bucketOf(s)], ["logolar", "Onay Bekliyor", "u2", "brand-files"]);
});

test("Sunucu hata iletileri anlaşılır", () => {
  assert.match(uploadErrorMessage(413, ""), /çok büyük/);
  assert.match(uploadErrorMessage(400, JSON.stringify({ message: "new row violates row-level security policy" })), /yetkiniz yok/);
  assert.match(uploadErrorMessage(400, JSON.stringify({ message: "Bucket not found" })), /014_file_uploads/);
  assert.match(uploadErrorMessage(400, JSON.stringify({ message: "mime type image/svg+xml is not supported" })), /türü yüklenemez/);
  assert.match(uploadErrorMessage(0, ""), /ağ hatası/);
  assert.equal(formatBytes(1536), "2 KB");
});

test("Demo kaynağı: ilerleme, iptal, ağ hatası", async () => {
  const api = createMemoryFiles();
  const steps = [];
  const rec = await api.uploadAttachment({ id: "t1" }, { name: "a.pdf", size: 10, type: "application/pdf" }, { userId: "u1", onProgress: (p) => steps.push(p) });
  assert.equal(rec.taskId, "t1");
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
