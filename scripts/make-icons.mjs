// PWA simgelerini üretir: public/icons/*.png + favicon.svg (yalnızca geliştirme; başsız Edge/Chrome ile SVG → PNG).
//   node scripts/make-icons.mjs
// Gerçek logo geldiğinde GLYPH yerine logonun SVG içeriğini (24×24 görüntü alanı) koyup yeniden çalıştırın.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BRAND = "#f97316"; // Tailwind orange-500 (paneldeki logo rengi)
const GLYPH = `<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/>
  <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/>
  <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></g>`;

// rounded: köşeleri yuvarlatılmış simge (purpose "any"); full: tam dolu kare (maskable / iOS — köşeyi sistem keser).
// glyph: simgenin kenarına göre çizim alanı oranı (maskable güvenli alan ≤ %80 → %56 kullanılır).
const svg = ({ rounded, glyph }) => {
  const g = 100 * glyph, o = (100 - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" ${rounded ? 'rx="22"' : ""} fill="${BRAND}"/>
  <svg x="${o}" y="${o}" width="${g}" height="${g}" viewBox="0 0 24 24">${GLYPH}</svg></svg>`;
};

const OUT = resolve("public/icons");
const ICONS = [
  { file: "icon-192.png", size: 192, rounded: true, glyph: 0.62 },
  { file: "icon-512.png", size: 512, rounded: true, glyph: 0.62 },
  { file: "icon-maskable-512.png", size: 512, rounded: false, glyph: 0.5 },
  { file: "apple-touch-icon.png", size: 180, rounded: false, glyph: 0.56 },
];
writeFileSync(join(OUT, "favicon.svg"), svg({ rounded: true, glyph: 0.66 }));

const exe = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"]
  .filter(Boolean).find((p) => existsSync(p));
if (!exe) throw new Error("Edge/Chrome bulunamadı (BROWSER ortam değişkeniyle yol verin).");
const tmp = mkdtempSync(join(tmpdir(), "cw-icons-"));
try {
  for (const i of ICONS) {
    const html = join(tmp, `${i.file}.html`);
    writeFileSync(html, `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${i.size}px;height:${i.size}px}</style>${svg(i)}`);
    const r = spawnSync(exe, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--default-background-color=00000000",
      `--user-data-dir=${join(tmp, "profile")}`, `--window-size=${i.size},${i.size}`, `--screenshot=${join(OUT, i.file)}`, pathToFileURL(html).href], { stdio: "ignore", timeout: 30000 });
    if (r.status !== 0 || !existsSync(join(OUT, i.file))) throw new Error(`${i.file} üretilemedi`);
    console.log("✓", i.file);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
