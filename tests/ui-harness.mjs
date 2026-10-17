// Tarayıcı testleri için ortak altyapı: Vite geliştirme sunucusu + başsız Edge/Chrome (DevTools protokolü).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(fn, timeout = 15000, step = 100) {
  const end = Date.now() + timeout;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* tekrar dene */ }
    if (Date.now() > end) throw new Error("zaman aşımı");
    await sleep(step);
  }
}

/* Sayfa içi yardımcılar: React kontrollü alanlara değer yazma, metne göre öğe bulma. */
export const HELPERS = `
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const byText = (sel, text, r = document) => $$(sel, r).find((el) => el.textContent.trim().includes(text));
  const exact = (sel, text, r = document) => $$(sel, r).find((el) => el.textContent.trim() === text);
  const setValue = (el, v) => {
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  };
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; };
  const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));
`;

// viteArgs: varsayılan geliştirme sunucusu; ör. ["preview", "--outDir", klasör] ile derlenmiş sürüm sunulur.
export async function startHarness({ port = 5179, debugPort = 9333, viteArgs = [] } = {}) {
  const results = [];
  const consoleProblems = [];
  let reported = 0;
  const check = (name, ok, detail = "") => {
    results.push({ name, ok: !!ok, detail });
    console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
    // Başarısız kontrolde o ana kadarki yeni konsol hataları da yazdırılır (teşhis için).
    if (!ok && consoleProblems.length > reported) console.log("   konsol:", consoleProblems.slice(reported, reported + 3).join(" || "));
    reported = consoleProblems.length;
  };
  const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...viteArgs, "--port", String(port), "--strictPort"], { stdio: "ignore" });
  const profile = mkdtempSync(join(tmpdir(), "cw-ui-"));
  const exe = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"]
    .filter(Boolean).find((p) => existsSync(p));
  if (!exe) throw new Error("Edge/Chrome bulunamadı (BROWSER ortam değişkeniyle yol verin).");
  const browser = spawn(exe, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });

  let ws, seq = 0;
  const pending = new Map();
  const send = (method, params = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); };
  const js = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const page = (body) => js(HELPERS + body);
  const viewport = async (width, height, mobile = false) => {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
    await sleep(400);
  };
  const key = async (k) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: k === "Escape" ? 27 : 0 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: k === "Escape" ? 27 : 0 });
  };

  await waitFor(() => fetch(`http://localhost:${port}/`).then((r) => r.ok));
  // Büyük ana dosya ilk istekte uzun derlenir; sayfa açılmadan önce ısıtılır (ilk bekleme zaman aşımına düşmesin).
  if (!viteArgs.includes("preview")) await fetch(`http://localhost:${port}/AgencyWorkspace.jsx`).catch(() => {});
  const target = await waitFor(() => fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json()));
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); return; }
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(msg.params.type)) {
      consoleProblems.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
    }
    if (msg.method === "Runtime.exceptionThrown") consoleProblems.push(msg.params.exceptionDetails.exception?.description?.slice(0, 300) || "exception");
    if (msg.method === "Page.javascriptDialogOpening") send("Page.handleJavaScriptDialog", { accept: true });
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin: `http://localhost:${port}` }).catch(() => {});

  const close = async () => {
    try { ws?.close(); } catch { /* yok say */ }
    browser.kill(); vite.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* tarayıcı kilidi */ }
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti.`);
    process.exit(failed.length ? 1 : 0);
  };
  return { send, page, viewport, key, check, results, consoleProblems, close, url: `http://localhost:${port}/?demo` };
}
