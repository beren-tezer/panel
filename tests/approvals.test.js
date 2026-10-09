import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REQUEST_STATUS, assetsOf, createMemoryContent, latestVersion, parsePortalPath, pendingRequest, portalPath, reviewTarget, rotatedSlug, slugify,
  validateContentFile, validateRevisionNote, versionStatus, versionsOf,
} from "../approvals.js";
import { authorize, canEditContentVersion, scopeState } from "../rbac.js";
import { createMemorySource } from "../workspaceData.js";

const STATUSES = ["Başlanmadı", "Çalışılıyor", "Yönetici Onayı", "Müşteri Onayı", "Revizyon", "Onaylandı", "Tamamlandı", "Gecikti"];
const admin = { id: "a", role: "admin" }, emp = { id: "e", role: "employee" }, other = { id: "o", role: "employee" };
const client = { id: "c", role: "client" }, client2 = { id: "c2", role: "client" };
const T = "2026-10-10T10:00:00.000Z";

function world(status = "Müşteri Onayı") {
  const v1 = { id: "v1", taskId: "t1", versionNo: 1, caption: "v1 metni", createdAt: T, lockedAt: T };
  const v2 = { id: "v2", taskId: "t1", versionNo: 2, caption: "v2 metni", createdAt: T, lockedAt: status === "Müşteri Onayı" ? T : null };
  return {
    users: [admin, emp, other, client, client2], brands: [{ id: "b1" }, { id: "b2" }],
    memberships: [{ brandId: "b1", userId: "c" }, { brandId: "b2", userId: "c2" }, { brandId: "b1", userId: "e" }],
    tasks: [{ id: "t1", brandId: "b1", title: "Reels", status, assigneeId: "e" }],
    comments: [], activity: [], attachments: [], assets: [], notifications: [], checklists: [], checklistItems: [],
    approvals: [{ id: "d1", taskId: "t1", userId: "c", decision: "revision", note: "Logo büyüsün", requestId: "r1", versionId: "v1", createdAt: T }],
    contentVersions: [v1, v2],
    contentAssets: [{ id: "a1", versionId: "v1", taskId: "t1", mimeType: "image/png" }, { id: "a2", versionId: "v2", taskId: "t1", mimeType: "video/mp4" }],
    approvalRequests: [
      { id: "r1", taskId: "t1", versionId: "v1", status: "revision_requested", requestedAt: "2026-10-09T10:00:00Z", closedAt: T },
      ...(status === "Müşteri Onayı" ? [{ id: "r2", taskId: "t1", versionId: "v2", status: "pending", requestedAt: T, closedAt: null }] : []),
    ],
    features: { approvals: true },
  };
}

test("dosya doğrulama: tür, uzantı uyumu, 50 MB, çalıştırılabilir içerik reddedilir", () => {
  assert.equal(validateContentFile({ name: "a.png", type: "image/png", size: 10 }).kind, "image");
  assert.equal(validateContentFile({ name: "a.MOV", type: "video/quicktime", size: 10 }).kind, "video");
  assert.equal(validateContentFile({ name: "a.pdf", type: "", size: 10 }).kind, "pdf");
  assert.match(validateContentFile({ name: "a.svg", type: "image/svg+xml", size: 10 }).error, /yüklenemez/);
  assert.match(validateContentFile({ name: "a.html", type: "text/html", size: 10 }).error, /yüklenemez/);
  assert.match(validateContentFile({ name: "a.png", type: "application/pdf", size: 10 }).error, /uyuşmuyor/);
  assert.match(validateContentFile({ name: "a.mp4", type: "video/mp4", size: 50 * 1024 * 1024 + 1 }).error, /50 MB/);
  assert.match(validateContentFile({ name: "a.png", type: "image/png", size: 0 }).error, /boş/);
});

test("sürüm ve istek durumları; müşteri güncel sürümü inceler", () => {
  const s = world();
  assert.deepEqual(versionsOf(s.contentVersions, "t1").map((v) => v.versionNo), [1, 2]);
  assert.equal(latestVersion(s.contentVersions, "t1").id, "v2");
  assert.equal(versionStatus(s.contentVersions[0], s.approvalRequests), "revision_requested");
  assert.equal(versionStatus(s.contentVersions[1], s.approvalRequests), "pending");
  assert.equal(versionStatus({ ...s.contentVersions[1], lockedAt: null }, []), "draft");
  assert.equal(REQUEST_STATUS.revision_requested, "Revizyon İstendi");
  assert.equal(pendingRequest(s.approvalRequests, "t1").id, "r2");
  const target = reviewTarget(s, "t1");
  assert.deepEqual([target.request.id, target.version.id], ["r2", "v2"]);
  assert.equal(reviewTarget(world("Revizyon"), "t1"), null);
  assert.deepEqual(assetsOf(s.contentAssets, "v2").map((a) => a.id), ["a2"]);
});

test("revize notu doğrulaması", () => {
  assert.match(validateRevisionNote("  "), /açıklayın/);
  assert.match(validateRevisionNote("abc"), /açıklayın/);
  assert.equal(validateRevisionNote("Logo büyüsün"), null);
  assert.match(validateRevisionNote("x".repeat(2001)), /2000/);
});

test("müşteri onay bağlantısı: /onay ve /onay/<adres>", () => {
  assert.equal(slugify("Gürel Altyapı İnşaat"), "gurel-altyapi-insaat");
  assert.equal(slugify("3 Kartal Perde"), "3-kartal-perde");
  assert.equal(slugify("!!!"), "marka");
  const r = rotatedSlug("Tepe Emlak");
  assert.match(r, /^tepe-emlak-[a-z0-9]{7}$/);
  assert.notEqual(r, rotatedSlug("Tepe Emlak"));
  assert.equal(portalPath("tepe-emlak"), "/onay/tepe-emlak");
  assert.equal(portalPath(null), "/onay");
  assert.equal(parsePortalPath("/onay"), "*");
  assert.equal(parsePortalPath("/onay/"), "*");
  assert.equal(parsePortalPath("/onay/tepe-emlak"), "tepe-emlak");
  assert.equal(parsePortalPath("/onay/Tepe-Emlak/"), "tepe-emlak");
  assert.equal(parsePortalPath("/onay/%3Cscript%3E"), "", "geçersiz adres: erişim yok mesajı");
  assert.equal(parsePortalPath("/"), null);
  assert.equal(parsePortalPath("/onaylar"), null);
});

test("müşteri yalnızca kendisine gönderilmiş sürümleri görür; taslak ve başka marka gizli", () => {
  const draft = world("Revizyon"); // v2 taslak, gönderilmedi
  const v = scopeState(client, draft);
  assert.deepEqual(v.contentVersions.map((x) => x.id), ["v1"]);
  assert.deepEqual(v.contentAssets.map((x) => x.id), ["a1"]);
  assert.deepEqual(v.approvalRequests.map((x) => x.id), ["r1"]);
  const v2 = scopeState(client2, world());
  assert.deepEqual([v2.tasks.length, v2.contentVersions.length, v2.contentAssets.length, v2.approvalRequests.length], [0, 0, 0, 0]);
  assert.equal(scopeState(emp, draft).contentVersions.length, 2, "sorumlu çalışan taslağı görür");
  assert.equal(scopeState(other, draft).contentVersions.length, 0);
});

test("karar yalnızca bekleyen isteğe ve onun sürümüne; yetkisiz roller karar veremez", () => {
  const s = world();
  const review = (u, extra) => authorize(u, { type: "REVIEW_CONTENT", taskId: "t1", decision: "approved", ...extra }, s, STATUSES);
  assert.equal(review(client, { requestId: "r2", versionId: "v2" }), null);
  assert.match(review(client, { requestId: "r1", versionId: "v1" }), /artık geçerli değil/);
  assert.match(review(client, { requestId: "r2", versionId: "v1" }), /Eski bir sürüme/);
  assert.match(authorize(client, { type: "REVIEW_CONTENT", taskId: "t1", decision: "revision", note: "", requestId: "r2" }, s, STATUSES), /açıklayın/);
  assert.equal(authorize(client, { type: "REVIEW_CONTENT", taskId: "t1", decision: "revision", note: "Logo büyüsün", requestId: "r2" }, s, STATUSES), null);
  assert.notEqual(review(client2, { requestId: "r2" }), null, "başka markanın müşterisi");
  assert.notEqual(review(emp, { requestId: "r2" }), null, "çalışan karar veremez");
  const noRequest = { ...s, approvalRequests: s.approvalRequests.filter((r) => r.status !== "pending") };
  assert.match(authorize(client, { type: "REVIEW_CONTENT", taskId: "t1", decision: "approved" }, noRequest, STATUSES), /onay beklemiyor/);
});

test("sürüm metni: yalnızca taslak, yalnızca admin / sorumlu", () => {
  const s = world("Revizyon");
  const edit = (u, id) => authorize(u, { type: "UPDATE_VERSION", id, patch: { caption: "yeni" } }, s, STATUSES);
  assert.equal(edit(emp, "v2"), null);
  assert.equal(edit(admin, "v2"), null);
  assert.match(edit(emp, "v1"), /değiştirilemez/);
  assert.notEqual(edit(other, "v2"), null);
  assert.notEqual(edit(client, "v2"), null);
  assert.ok(canEditContentVersion(emp, s.tasks[0], s));
  assert.ok(!canEditContentVersion(client, s.tasks[0], s));
  assert.ok(!canEditContentVersion({ ...emp, permissions: ["canViewTasks", "canUpdateTasks"] }, s.tasks[0], s), "içerik düzenleme izni yoksa");
});

test("demo kaynağı 007 kurallarını uygular: gönderimde kilit + istek, karar, geri çekme", async () => {
  const content = createMemoryContent();
  const source = createMemorySource(() => ({ users: [], me: "a", state: {} }), { content });
  const merged = [];
  const helpers = { patchTask() {}, merge: (p) => merged.push(p), actorId: "a" };
  const base = world("Revizyon");
  await source.persist({ type: "SUBMIT_TASK", id: "t1", status: "Müşteri Onayı" }, base, base, helpers);
  const sent = merged.at(-1);
  assert.equal(sent.contentVersions[0].id, "v2");
  assert.ok(sent.contentVersions[0].lockedAt);
  assert.equal(sent.approvalRequests.at(-1).status, "pending");
  const pend = world();
  await assert.rejects(source.persist({ type: "REVIEW_CONTENT", taskId: "t1", decision: "approved", requestId: "r1" }, pend, pend, helpers), /artık geçerli değil/);
  await source.persist({ type: "REVIEW_CONTENT", taskId: "t1", decision: "approved", requestId: "r2" }, pend, pend, helpers);
  assert.equal(merged.at(-1).approvalRequests[0].status, "approved");
  await source.persist({ type: "UPDATE_TASK", id: "t1", patch: { status: "Çalışılıyor" } }, pend, pend, helpers);
  assert.equal(merged.at(-1).approvalRequests[0].status, "withdrawn");
  assert.equal((await content.createVersion({ id: "t1" }, base, "e")).contentVersions[0].id, "v2", "açık taslak varken aynı sürüm");
  assert.equal((await content.createVersion({ id: "t1" }, pend, "e")).contentVersions[0].versionNo, 3);
  await assert.rejects(content.upload({ id: "t1" }, pend.contentVersions[1], { name: "a.png", type: "image/png", size: 5 }), /yetkiniz yok/);
});
