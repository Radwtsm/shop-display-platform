// Foglio A4 per le visite: fotografa la demo vera (TV + pannello) e stampa materiali/out/foglio-a4.pdf.
//   npm run foglio
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const radice = resolve(import.meta.dirname, "..");
const OUT = join(radice, "materiali", "out");
const MARTEDI_9 = new Date("2026-10-27T09:00:00+01:00"); // ora fissa: in foto c'è sempre un'offerta con prezzo

/** Scatta TV e telefono da una demo già avviata e impagina il PDF. Restituisce il percorso del PDF. */
export async function creaFoglio(baseURL, token) {
  mkdirSync(OUT, { recursive: true });
  const agenzia = JSON.parse(readFileSync(join(radice, "materiali", "agenzia.json"), "utf8"));
  const browser = await chromium.launch();
  try {
    const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await tv.clock.install({ time: MARTEDI_9 });
    await tv.goto(`${baseURL}/player.html`);
    await tv.locator("#prezzo").filter({ hasText: "€" }).waitFor();
    await tv.screenshot({ path: join(OUT, "tv.png") });
    const tel = await browser.newPage({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce" });
    await tel.clock.install({ time: MARTEDI_9 });
    await tel.goto(`${baseURL}/panel.html#t=${token}`);
    await tel.locator("#offerte li").first().waitFor();
    await tel.screenshot({ path: join(OUT, "telefono.png"), clip: { x: 0, y: 0, width: 414, height: 620 } });

    copyFileSync(join(radice, "materiali", "foglio-a4.html"), join(OUT, "foglio-a4.html"));
    const foglio = await browser.newPage();
    await foglio.goto(`file://${join(OUT, "foglio-a4.html")}`);
    for (const campo of ["nome", "contatto", "proposta"])
      await foglio.locator(`[data-campo=${campo}]`).evaluate((e, v) => (e.textContent = v), String(agenzia[campo] ?? ""));
    await foglio.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    const pdf = join(OUT, "foglio-a4.pdf");
    await foglio.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });
    await foglio.setViewportSize({ width: 794, height: 1123 });
    await foglio.screenshot({ path: join(OUT, "foglio-a4-anteprima.png"), fullPage: true });
    return pdf;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = mkdtempSync(join(tmpdir(), "foglio-"));
  const token = "foglio-" + Date.now();
  const porta = "4199";
  const server = spawn(process.execPath, ["src/piattaforma/server/main.ts"], {
    cwd: radice,
    env: { ...process.env, PORT: porta, HOST: "127.0.0.1", DATA_DIR: data, PANEL_TOKEN: token },
    stdio: "ignore",
  });
  try {
    const base = `http://127.0.0.1:${porta}`;
    for (let i = 0; i < 50; i++) {
      try {
        // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request -- solo 127.0.0.1: server locale appena avviato
        if ((await fetch(`${base}/api/config`)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`✅ ${await creaFoglio(base, token)}`);
  } finally {
    server.kill();
  }
}
