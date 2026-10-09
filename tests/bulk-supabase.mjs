// Toplu görev kaydı — GELİŞTİRME Supabase projesine karşı entegrasyon testi (gerçek PostgREST + RLS).
//   npm run test:bulk:dev
// Gerekli dosyalar (ikisi de .gitignore kapsamında):
//   .env.development.local → VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (geliştirme projesi)
//   .env.test.local        → DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD / DEV_EMPLOYEE_EMAIL / DEV_EMPLOYEE_PASSWORD
// Güvenlik: adres .env'deki (canlı) projeyle aynıysa test çalışmaz. Oluşturulan test görevleri sonunda silinir.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseSource } from "../workspaceData.js";
import { newRow, toTask } from "../bulkTasks.js";

const env = (f) => (existsSync(f) ? Object.fromEntries(readFileSync(f, "utf8").split(/\r?\n/).filter((l) => /^\s*[A-Z_]+\s*=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })) : {});
const prod = env(".env"), dev = env(".env.development.local"), cred = env(".env.test.local");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`); };

if (!dev.VITE_SUPABASE_URL || !dev.VITE_SUPABASE_ANON_KEY || !cred.DEV_ADMIN_EMAIL || !cred.DEV_ADMIN_PASSWORD) {
  console.log("ATLANDI: .env.development.local ve .env.test.local bulunamadı (geliştirme projesi henüz yapılandırılmadı).");
  process.exit(2);
}
if (prod.VITE_SUPABASE_URL && new URL(prod.VITE_SUPABASE_URL).host === new URL(dev.VITE_SUPABASE_URL).host) {
  console.log("DURDURULDU: geliştirme adresi canlı projeyle aynı. Bu test canlı veritabanına yazmaz.");
  process.exit(3);
}

const client = () => createClient(dev.VITE_SUPABASE_URL, dev.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const created = [];
let admin;
try {
  admin = client();
  const { error: le } = await admin.auth.signInWithPassword({ email: cred.DEV_ADMIN_EMAIL, password: cred.DEV_ADMIN_PASSWORD });
  check("Geliştirme projesine admin girişi", !le, le?.message);
  const source = createSupabaseSource(admin, { storage: { url: dev.VITE_SUPABASE_URL, key: dev.VITE_SUPABASE_ANON_KEY } });
  const { state } = await source.load();
  const brand = state.brands[0];
  const worker = state.users.find((u) => u.role === "employee" && u.active);
  check("Mevcut markalar ve ekip üyeleri okunur", !!brand && !!worker, `${state.brands.length} marka, ${state.users.length} kullanıcı`);
  check("Taslak kapsamı geliştirme projesine özel", source.draftScope === new URL(dev.VITE_SUPABASE_URL).host, source.draftScope);

  const stamp = Date.now();
  const rows = Array.from({ length: 30 }, (_, i) => ({ ...newRow(), brandId: brand.id, title: `[TEST ${stamp}] Toplu görev ${i + 1}`, format: i % 2 ? "Reels" : "Gönderi", dueDate: "2026-11-12", dueTime: "16:30", assigneeId: worker.id }));
  const tasks = rows.map((r) => toTask(r));
  created.push(...tasks.map((t) => t.id));
  const t0 = Date.now();
  const res = await source.createTasks(tasks, { activity: [], notifications: [] });
  check(`30 görev tek işlemde kaydedilir (${Date.now() - t0} ms)`, Object.keys(res.codes).length === 30 && Object.values(res.codes).every((c) => /^CW-\d+$/.test(c)));
  const again = await source.createTasks(tasks, {});
  const { count } = await admin.from("tasks").select("id", { count: "exact", head: true }).like("title", `[TEST ${stamp}]%`);
  check("Aynı görevlerle tekrar deneme çift kayıt oluşturmaz", count === 30 && JSON.stringify(again.codes) === JSON.stringify(res.codes), `${count} kayıt`);
  const { data: one } = await admin.from("tasks").select("*").eq("id", tasks[3].id).single();
  check("Alanlar mevcut şemaya doğru yazılır", one.title === tasks[3].title && one.format === "Reels" && one.due_date === "2026-11-12" && String(one.due_time).startsWith("16:30") && one.assignee_id === worker.id && one.status === "Başlanmadı");

  const bad = [{ ...toTask({ ...newRow(), brandId: brand.id, title: `[TEST ${stamp}] geçerli`, dueDate: "2026-11-12" }) }, { ...toTask({ ...newRow(), brandId: brand.id, title: `[TEST ${stamp}] hatalı`, dueDate: "2026-11-12" }), format: "Podcast" }];
  created.push(...bad.map((t) => t.id));
  let err = null;
  try { await source.createTasks(bad, {}); } catch (e) { err = e; }
  const { count: badCount } = await admin.from("tasks").select("id", { count: "exact", head: true }).in("id", bad.map((t) => t.id));
  check("Hatalı satır içeren toplu kayıt tümüyle reddedilir (atomik)", !!err && badCount === 0, err?.message);

  if (cred.DEV_EMPLOYEE_EMAIL && cred.DEV_EMPLOYEE_PASSWORD) {
    const emp = client();
    await emp.auth.signInWithPassword({ email: cred.DEV_EMPLOYEE_EMAIL, password: cred.DEV_EMPLOYEE_PASSWORD });
    const empSource = createSupabaseSource(emp, { storage: { url: dev.VITE_SUPABASE_URL, key: dev.VITE_SUPABASE_ANON_KEY } });
    const t = toTask({ ...newRow(), brandId: brand.id, title: `[TEST ${stamp}] çalışan`, dueDate: "2026-11-12" });
    created.push(t.id);
    let e2 = null;
    try { await empSource.createTasks([t], {}); } catch (e) { e2 = e; }
    check("Çalışan doğrudan API ile toplu görev oluşturamaz (RLS)", !!e2, e2?.message);
    await emp.auth.signOut();
  } else console.log("- Çalışan kimlik bilgisi yok; RLS çalışan testi atlandı.");
} catch (e) {
  check(`Beklenmeyen hata: ${e.message}`, false);
} finally {
  if (admin && created.length) {
    const { error } = await admin.from("tasks").delete().in("id", created);
    console.log(error ? `! Test görevleri silinemedi: ${error.message}` : `Test görevleri temizlendi (${created.length} kimlik).`);
  }
  await admin?.auth.signOut();
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} kontrol geçti.`);
  process.exit(failed ? 1 : 0);
}
