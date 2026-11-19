// Misura una pagina com'è davvero, senza toccare gli spec: server proprio con dati finti (cartella temporanea),
// pagina a una misura, poi stampa body[data-*], griglia, scroll orizzontale, riquadri dei selettori ed elementi fuori.
// Prima: console.log dentro uno spec, rilancio, ripristino (3 giri per un bug, A136 11/11).
//   node scripts/misura.mjs [--pagina player.html] [--misura 960x540] [--servizi schermo,eliminacode,menu-qr,vetrina]
//        [--negozio '{"disposizione":"affiancato"}'] [--chiamate 5 (numeri già chiamati dall'Eliminacode)] [--sel "#zone,#lato,.eq-numero"] [--attesa 3000] [--foto out.png]
//        [--giri 4 --passo 20000]  (orologio finto: misura e foto ogni `passo` ms, foto out-1.png, out-2.png…)
//        [--fluidita 40 --cpu 6]  (A136(6): tempo vero, CPU rallentata come la TV; stampa i fotogrammi persi e i
//        compiti lunghi intorno a ogni cambio pagina; esce 1 se un cambio blocca più di --budget ms, di serie 50)
// Non compila: prima `node scripts/build.mjs` se hai cambiato i sorgenti. Mai sui dati veri (DATA_DIR temporanea).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const [w, h] = arg("misura", "960x540").split("x").map(Number);
const pagina = arg("pagina", "player.html");
const sel = arg("sel", "header,#barra,#zone,#lato,#lato > .zona,#qr,#piede").split(",");
const TOKEN = "misura";
const porta = await new Promise((ok) => { const s = createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
const dati = mkdtempSync(join(tmpdir(), "misura-"));
const base = `http://127.0.0.1:${porta}`;
const server = spawn("node", ["src/piattaforma/server/main.ts"], {
  stdio: "ignore",
  env: { ...process.env, PORT: String(porta), HOST: "127.0.0.1", PANEL_TOKEN: TOKEN, DATA_DIR: dati, METEO_BASE: "http://127.0.0.1:9", METEO_BASE_GEO: "http://127.0.0.1:9", DEMO_SERVIZI: arg("servizi", "schermo,eliminacode,menu-qr,vetrina") },
});
const fine = () => { server.kill(); rmSync(dati, { recursive: true, force: true }); };
try {
  for (let i = 0; ; i++) { try { if ((await fetch(`${base}/api/negozio`)).ok) break; } catch {} if (i > 100) throw new Error("server non partito"); await new Promise((r) => setTimeout(r, 100)); }
  const extra = arg("negozio");
  if (extra) {
    const { servizi: _, ...n } = await (await fetch(`${base}/api/negozio`)).json();
    const r = await fetch(`${base}/api/negozio`, { method: "PUT", headers: { "X-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ ...n, ...JSON.parse(extra) }) });
    if (!r.ok) throw new Error(`PUT /api/negozio: ${r.status} ${await r.text()}`);
  }
  for (let i = 0; i < Number(arg("chiamate", "0")); i++)
    await fetch(`${base}/api/eliminacode/azione`, { method: "POST", headers: { "X-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ azione: "prossimo", banco: 0 }) });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on("console", (m) => m.type() !== "log" && console.log(`console.${m.type()}: ${m.text()}`));
  p.on("pageerror", (e) => console.log("errore:", e.message));
  const giri = Number(arg("giri", "1"));
  if (giri > 1) await p.clock.install();
  const fluidita = Number(arg("fluidita", "0"));
  if (fluidita) {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(arg("cpu", "6")) });
    await p.addInitScript(() => {
      const m = (window.__fl = { frame: [], lunghi: [], cambi: [] });
      let prima = 0;
      const giro = (t) => { if (prima) m.frame.push([prima, t - prima]); prima = t; requestAnimationFrame(giro); };
      requestAnimationFrame(giro);
      new PerformanceObserver((l) => l.getEntries().forEach((e) => m.lunghi.push([e.startTime, e.duration]))).observe({ type: "longtask", buffered: true });
      addEventListener("DOMContentLoaded", () => new MutationObserver(() => { const t = performance.now(); if (!m.cambi.length || t - m.cambi.at(-1) > 1500) m.cambi.push(t); })
        .observe(document.getElementById("zone"), { childList: true, subtree: true, characterData: true }));
    });
  }
  await p.goto(`${base}/${pagina}${pagina.startsWith("panel") ? `#${TOKEN}` : ""}`);
  await p.waitForTimeout(Number(arg("attesa", "3000")));
  const traccia = arg("traccia"); // con --fluidita: traccia di Chrome (apri in DevTools → Performance)
  if (fluidita && traccia) await b.startTracing(p, { path: traccia, categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8.execute"] });
  if (fluidita) {
    const da = await p.evaluate(() => performance.now());
    await p.waitForTimeout(fluidita * 1000);
    const { frame, lunghi, cambi } = await p.evaluate(() => window.__fl);
    const budget = Number(arg("budget", "50"));
    const vicino = (t, c) => t >= c - 50 && t <= c + 1000;
    const righe = cambi.filter((c) => c > da).map((c) => {
      const f = frame.filter(([t]) => vicino(t, c)).map(([, d]) => d);
      const l = lunghi.filter(([t]) => vicino(t, c)).map(([, d]) => Math.round(d));
      return { a: Math.round(c - da), fotogrammaPeggiore: Math.round(Math.max(0, ...f)), persi: f.filter((d) => d > 34).length, compitiLunghi: l };
    });
    const tutti = frame.filter(([t]) => t > da).map(([, d]) => d).sort((a, b) => a - b);
    console.log(righe.map((r) => `  ${(r.a / 1000).toFixed(1)} s  peggiore ${r.fotogrammaPeggiore} ms  persi ${r.persi}  lunghi [${r.compitiLunghi}]`).join("\n"));
    console.log(JSON.stringify({ fotogrammi: tutti.length, p95: Math.round(tutti[Math.floor(tutti.length * 0.95)] ?? 0), peggiore: Math.round(tutti.at(-1) ?? 0) }));
    const ko = righe.filter((r) => r.fotogrammaPeggiore > budget);
    console.log(ko.length ? `❌ ${ko.length}/${righe.length} cambi oltre ${budget} ms` : `✅ ${righe.length} cambi entro ${budget} ms`);
    process.exitCode = ko.length ? 1 : 0;
    if (traccia) { await b.stopTracing(); console.log("traccia:", traccia); }
  }
  for (let giro = 1; giro <= giri; giro++) {
  if (giro > 1) { await p.clock.runFor(Number(arg("passo", "20000"))); await p.waitForTimeout(300); }
  const r = await p.evaluate((sel) => {
    const cs = getComputedStyle(document.body);
    const box = (e) => { const b = e.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}×${Math.round(b.height)}`; };
    return {
      body: { ...document.body.dataset },
      griglia: { colonne: cs.gridTemplateColumns, righe: cs.gridTemplateRows },
      scroll: { larghezza: document.documentElement.scrollWidth, altezza: document.documentElement.scrollHeight },
      riquadri: Object.fromEntries(sel.map((q) => { const e = document.querySelector(q); return [q, !e ? "assente" : e.getClientRects().length ? box(e) : "nascosto"]; })),
      fuori: [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); return e.getClientRects().length && (b.right > innerWidth + 1 || b.bottom > innerHeight + 1); })
        .slice(0, 10).map((e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${typeof e.className === "string" && e.className ? "." + e.className.split(" ")[0] : ""} ${box(e)}`),
    };
  }, sel);
  console.log(giri > 1 ? `giro ${giro}: ${JSON.stringify(r.riquadri)}` : JSON.stringify(r, null, 2));
  const foto = giri > 1 && arg("foto") ? arg("foto").replace(/(\.png)?$/, `-${giro}.png`) : arg("foto");
  if (foto) { await p.screenshot({ path: foto }); console.log("foto:", foto); }
  }
  await b.close();
} finally { fine(); }
