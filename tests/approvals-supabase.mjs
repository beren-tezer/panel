// Müşteri onay akışı — GELİŞTİRME Supabase projesine karşı entegrasyon testi (gerçek PostgREST + RLS + Storage).
//   npm run test:approvals:dev
// Gerekli (ikisi de .gitignore kapsamında):
//   .env.development.local → VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (geliştirme projesi; 001–007 çalıştırılmış)
//   .env.test.local        → DEV_ADMIN_*, DEV_EMPLOYEE_*, DEV_CLIENT_EMAIL / DEV_CLIENT_PASSWORD, isteğe bağlı DEV_CLIENT2_*
// Güvenlik: adres .env'deki (canlı) projeyle aynıysa çalışmaz. Test kendi markasını oluşturur ve sonunda siler.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = (f) => (existsSync(f) ? Object.fromEntries(readFileSync(f, "utf8").split(/\r?\n/).filter((l) => /^\s*[A-Z0-9_]+\s*=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })) : {});
const prod = env(".env"), dev = env(".env.development.local"), cred = env(".env.test.local");
const need = ["DEV_ADMIN_EMAIL", "DEV_ADMIN_PASSWORD", "DEV_EMPLOYEE_EMAIL", "DEV_EMPLOYEE_PASSWORD", "DEV_CLIENT_EMAIL", "DEV_CLIENT_PASSWORD"];
if (!dev.VITE_SUPABASE_URL || !dev.VITE_SUPABASE_ANON_KEY || need.some((k) => !cred[k])) {
  console.log(`ATLANDI: geliştirme projesi yapılandırılmadı (gerekli: .env.development.local ve .env.test.local içinde ${need.join(", ")}).`);
  process.exit(2);
}
if (prod.VITE_SUPABASE_URL && new URL(prod.VITE_SUPABASE_URL).host === new URL(dev.VITE_SUPABASE_URL).host) {
  console.log("DURDURULDU: geliştirme adresi canlı projeyle aynı. Bu test canlı veritabanına yazmaz.");
  process.exit(3);
}

const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`); };
const login = async (email, password) => {
  const c = createClient(dev.VITE_SUPABASE_URL, dev.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} giriş yapamadı: ${error.message}`);
  return { c, id: data.user.id };
};
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const fails = async (p) => { const r = await p; return !!r.error || (Array.isArray(r.data) && r.data.length === 0); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let admin, brandId, taskId;
const files = [];
try {
  admin = await login(cred.DEV_ADMIN_EMAIL, cred.DEV_ADMIN_PASSWORD);
  const emp = await login(cred.DEV_EMPLOYEE_EMAIL, cred.DEV_EMPLOYEE_PASSWORD);
  const cli = await login(cred.DEV_CLIENT_EMAIL, cred.DEV_CLIENT_PASSWORD);
  const cli2 = cred.DEV_CLIENT2_EMAIL ? await login(cred.DEV_CLIENT2_EMAIL, cred.DEV_CLIENT2_PASSWORD) : null;
  const stamp = Date.now().toString(36);

  // 1. Admin marka oluşturur (adres sunucuda üretilir) ve çalışan + müşteriyi bağlar.
  const brand = must(await admin.c.from("brands").insert({ name: `Test Marka ${stamp}`, initials: "TM", sector: "Test", color: "orange" }).select().single());
  brandId = brand.id;
  check("Marka oluşturulur, onay adresi sunucuda üretilir", /^test-marka-/.test(brand.slug), brand.slug);
  must(await admin.c.from("brand_members").insert([{ brand_id: brandId, user_id: emp.id }, { brand_id: brandId, user_id: cli.id }]));
  check("Müşteri adresle yalnızca kendi markasını bulur", (must(await cli.c.from("brands").select("id").eq("slug", brand.slug))).length === 1
    && (!cli2 || (must(await cli2.c.from("brands").select("id").eq("slug", brand.slug))).length === 0));

  // 2. Admin görev oluşturur.
  const task = must(await admin.c.from("tasks").insert({ brand_id: brandId, title: `[TEST ${stamp}] Onay akışı`, platform: "Instagram", format: "Gönderi", assignee_id: emp.id, due_date: "2026-11-12" }).select().single());
  taskId = task.id;

  // 3. Çalışan sürüm oluşturur ve dosya yükler.
  const v1 = must(await emp.c.rpc("create_content_version", { p_task: taskId }));
  must(await emp.c.from("task_content_versions").update({ caption: "Sürüm 1 metni" }).eq("id", v1));
  const p1 = `${taskId}/${v1}/${crypto.randomUUID()}.png`;
  must(await emp.c.storage.from("content-assets").upload(p1, PNG, { contentType: "image/png" }));
  files.push(p1);
  must(await emp.c.from("task_content_assets").insert({ version_id: v1, task_id: taskId, storage_path: p1, file_name: "kapak.png", mime_type: "image/png", file_size: PNG.length, created_by: emp.id }));
  check("Çalışan sürüm oluşturur ve dosyayı Storage'a yükler", (must(await emp.c.from("task_content_assets").select("id").eq("version_id", v1))).length === 1);
  check("Müşteri taslak sürümü ve dosyasını göremez", (must(await cli.c.from("task_content_versions").select("id").eq("task_id", taskId))).length === 0
    && !!(await cli.c.storage.from("content-assets").createSignedUrl(p1, 60)).error);
  const svg = await emp.c.storage.from("content-assets").upload(`${taskId}/${v1}/x.svg`, Buffer.from("<svg/>"), { contentType: "image/svg+xml" });
  check("Kova izin verilmeyen türü reddeder (SVG)", !!svg.error, svg.error?.message);

  // 4. Kontrol listesi tamamlanır, çalışan iç onaya gönderir; 5. admin müşteriye gönderir.
  must(await emp.c.from("task_checklist_items").update({ is_completed: true }).eq("task_id", taskId).eq("is_completed", false));
  must(await emp.c.rpc("submit_task_for_approval", { p_task: taskId, p_status: "Yönetici Onayı" }));
  const sent1 = must(await admin.c.rpc("submit_task_for_approval", { p_task: taskId, p_status: "Müşteri Onayı" }));
  check("Admin müşteriye gönderir: Sürüm 1 kilitlenir, onay isteği oluşur", sent1.version_no === 1 && !!sent1.request_id);
  check("Kilitli sürüme dosya yüklenemez", !!(await emp.c.storage.from("content-assets").upload(`${taskId}/${v1}/sonradan.png`, PNG, { contentType: "image/png" })).error);

  // 6–7. Müşteri sürümü ve dosyayı görür (imzalı adres).
  const signed = await cli.c.storage.from("content-assets").createSignedUrl(p1, 60);
  const fetched = signed.data ? await fetch(signed.data.signedUrl) : null;
  check("Müşteri gönderilen sürümün dosyasını imzalı adresle açar", fetched?.ok && (await fetched.arrayBuffer()).byteLength === PNG.length);
  if (cli2) {
    check("Başka markanın müşterisi sürüm, istek ve dosyayı göremez", (must(await cli2.c.from("task_content_versions").select("id").eq("task_id", taskId))).length === 0
      && (must(await cli2.c.from("approval_requests").select("id").eq("task_id", taskId))).length === 0
      && !!(await cli2.c.storage.from("content-assets").createSignedUrl(p1, 60)).error);
    check("Başka markanın müşterisi karar veremez", await fails(cli2.c.from("approvals").insert({ task_id: taskId, user_id: cli2.id, decision: "approved", request_id: sent1.request_id })));
  }
  check("Çalışan doğrudan API ile müşteri kararı veremez", await fails(emp.c.from("approvals").insert({ task_id: taskId, user_id: emp.id, decision: "approved" })));

  // 8. Müşteri revize ister (eşzamanlı ikinci karar reddedilir).
  const [r1, r2] = await Promise.all([
    cli.c.from("approvals").insert({ task_id: taskId, user_id: cli.id, decision: "revision", note: "Logo büyüsün", request_id: sent1.request_id, version_id: v1 }),
    cli.c.from("approvals").insert({ task_id: taskId, user_id: cli.id, decision: "approved", request_id: sent1.request_id, version_id: v1 }),
  ]);
  check("Aynı isteğe eşzamanlı iki karardan yalnızca biri kabul edilir", [r1, r2].filter((r) => !r.error).length === 1, [r1.error?.message, r2.error?.message].filter(Boolean).join(" | "));
  const firstDecision = !r1.error ? "revision" : "approved";
  if (firstDecision === "approved") { console.log("- Eşzamanlı yarışta onay kazandı; revizyon adımları atlandı."); throw new Error("SKIP_REVISION"); }
  const t1 = must(await emp.c.from("tasks").select("status").eq("id", taskId).single());
  check("Revize sonrası görev Revizyon, istek revision_requested", t1.status === "Revizyon"
    && must(await admin.c.from("approval_requests").select("status").eq("id", sent1.request_id).single()).status === "revision_requested");

  // 9–10. Çalışan Sürüm 2'yi hazırlar; admin gönderir.
  const v2 = must(await emp.c.rpc("create_content_version", { p_task: taskId }));
  const p2 = `${taskId}/${v2}/${crypto.randomUUID()}.png`;
  must(await emp.c.storage.from("content-assets").upload(p2, PNG, { contentType: "image/png" }));
  files.push(p2);
  must(await emp.c.from("task_content_assets").insert({ version_id: v2, task_id: taskId, storage_path: p2, file_name: "kapak-v2.png", mime_type: "image/png", file_size: PNG.length, created_by: emp.id }));
  must(await emp.c.from("task_checklist_items").update({ is_completed: true }).eq("task_id", taskId).eq("is_completed", false));
  must(await emp.c.rpc("submit_task_for_approval", { p_task: taskId, p_status: "Yönetici Onayı" }));
  const sent2 = must(await admin.c.rpc("submit_task_for_approval", { p_task: taskId, p_status: "Müşteri Onayı" }));
  check("Sürüm 2 müşteriye gönderilir", sent2.version_no === 2);
  check("Eski isteğe / eski sürüme karar verilemez",
    await fails(cli.c.from("approvals").insert({ task_id: taskId, user_id: cli.id, decision: "approved", request_id: sent1.request_id }))
    && await fails(cli.c.from("approvals").insert({ task_id: taskId, user_id: cli.id, decision: "approved", request_id: sent2.request_id, version_id: v1 })));

  // 11–14. Müşteri onaylar; tüm roller aynı sonucu görür; geçmiş korunur.
  must(await cli.c.from("approvals").insert({ task_id: taskId, user_id: cli.id, decision: "approved", request_id: sent2.request_id, version_id: v2 }));
  check("Tekrar onay (çift tıklama) reddedilir", await fails(cli.c.from("approvals").insert({ task_id: taskId, user_id: cli.id, decision: "approved", request_id: sent2.request_id })));
  const view = async (c) => (must(await c.from("approval_requests").select("status, task_content_versions(version_no)").eq("task_id", taskId).order("requested_at"))).map((r) => `${r.task_content_versions.version_no}:${r.status}`).join(",");
  const expected = "1:revision_requested,2:approved";
  const [va, ve, vc] = [await view(admin.c), await view(emp.c), await view(cli.c)];
  check("Admin, çalışan ve müşteri aynı geçmişi görür (başka cihaz / yeni oturum)", va === expected && ve === expected && vc === expected, `${va} | ${ve} | ${vc}`);
  check("Görev Onaylandı", must(await cli.c.from("tasks").select("status").eq("id", taskId).single()).status === "Onaylandı");

  // Erişim iptali: müşteri üyeliği kaldırılınca hiçbir şey görünmez.
  must(await admin.c.from("brand_members").delete().eq("brand_id", brandId).eq("user_id", cli.id));
  check("Erişimi iptal edilen müşteri görev, sürüm ve dosyaya erişemez", (must(await cli.c.from("tasks").select("id").eq("id", taskId))).length === 0
    && (must(await cli.c.from("task_content_versions").select("id").eq("task_id", taskId))).length === 0
    && !!(await cli.c.storage.from("content-assets").createSignedUrl(p2, 60)).error);
  const anon = createClient(dev.VITE_SUPABASE_URL, dev.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  check("Oturumsuz istek hiçbir veriye erişemez", (await anon.from("approval_requests").select("id").eq("task_id", taskId)).data?.length === 0
    && !!(await anon.rpc("create_content_version", { p_task: taskId })).error);
} catch (e) {
  if (e.message !== "SKIP_REVISION") check(`Beklenmeyen hata: ${e.message}`, false);
} finally {
  if (admin) {
    if (files.length) await admin.c.storage.from("content-assets").remove(files);
    if (taskId) await admin.c.from("tasks").delete().eq("id", taskId);
    if (brandId) { await admin.c.from("brand_members").delete().eq("brand_id", brandId); await admin.c.from("brands").delete().eq("id", brandId); }
    console.log("Test verisi temizlendi.");
  }
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
  process.exit(failed ? 1 : 0);
}
