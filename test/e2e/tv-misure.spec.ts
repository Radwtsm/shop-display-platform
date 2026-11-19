// A136(11): la TV vera (Google TV di casa) apre il player a 960×540 CSS px. Con tutti i servizi, in ogni
// disposizione e a ogni misura, nessun testo copre un altro, nessuna parola si spezza, niente esce dallo schermo.
import { expect, test, type Page } from "@playwright/test";
import { PORTA_TUTTI, TOKEN } from "../../playwright.config.ts";

const BASE = `http://127.0.0.1:${PORTA_TUTTI}`;
test.use({ baseURL: BASE });
const MISURE = { "tv-vera-960": { width: 960, height: 540 }, "tv-1080": { width: 1920, height: 1080 } };

async function disposizione(page: Page, d: "intero" | "affiancato") {
  const { servizi: _, ...n } = await (await page.request.get("/api/negozio")).json();
  expect((await page.request.put("/api/negozio", { data: { ...n, disposizione: d }, headers: { "X-Token": TOKEN } })).ok()).toBe(true);
  for (const a of ["azzera", "prossimo"])
    await page.request.post("/api/eliminacode/azione", { data: { azione: a, banco: 0 }, headers: { "X-Token": TOKEN } });
}

/** Problemi del layout visibile adesso: testi sovrapposti, parole spezzate, testo fuori schermo. */
function problemi(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const nome = (e: Element) => `<${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : ""}> «${e.textContent!.trim().slice(0, 20)}»`;
    const visibile = (e: Element) => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      for (let a: Element | null = e; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.05) return false;
      }
      return true;
    };
    const testi = [...document.querySelectorAll("body *")].filter(
      (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && visibile(e) && !e.closest("svg, .sprite, [aria-hidden=true]"),
    );
    for (const e of testi) {
      const r = e.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push(`fuori schermo: ${nome(e)}`);
      for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.textContent!.trim()) continue;
        const parole = n.textContent!.trim().split(/\s+/).length;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        const righe = new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
        if (righe > parole) out.push(`parola spezzata (${righe} righe, ${parole} parole): ${nome(e)}`);
      }
    }
    for (let i = 0; i < testi.length; i++)
      for (let j = i + 1; j < testi.length; j++) {
        const [a, b] = [testi[i]!, testi[j]!];
        if (a.contains(b) || b.contains(a)) continue;
        const [x, y] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
        const w = Math.min(x.right, y.right) - Math.max(x.left, y.left);
        const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
        if (w > 2 && h > 2) out.push(`sovrapposti: ${nome(a)} / ${nome(b)}`);
      }
    return out;
  });
}

for (const [misura, viewport] of Object.entries(MISURE))
  for (const d of ["intero", "affiancato"] as const)
    test(`TV ${misura} · ${d}: niente testi sovrapposti, spezzati o fuori schermo`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.clock.install();
      await disposizione(page, d);
      await page.goto("/player.html");
      await expect(page.locator(".eq-numero")).toHaveText("1");
      // in "intero" i servizi girano ogni 20 s: si controlla ogni pagina
      for (let giro = 0; giro < (d === "intero" ? 4 : 1); giro++) {
        await page.clock.runFor(giro ? 20_000 : 1000);
        await page.evaluate(() => document.fonts.ready);
        expect(await problemi(page), `giro ${giro}`).toEqual([]);
      }
    });

// A141: piede «Dove sono» = la sezione di adesso, solo i suoi pallini (max 5, poi 1 + «3/9»), cosa viene dopo.
test("piede «Dove sono»: la sezione visibile, i suoi pallini e la sezione dopo, senza spostare il piede", async ({ page }) => {
  await page.setViewportSize(MISURE["tv-vera-960"]);
  await page.clock.install();
  await disposizione(page, "intero");
  await page.goto("/player.html");
  await expect(page.locator(".eq-numero")).toHaveText("1");
  // eliminacode sta nel riquadro e non gira: girano offerte, menu, vetrina nell'ordine del catalogo
  const ORDINE = ["schermo", "menu-qr", "vetrina"];
  const ETICHETTE: Record<string, string> = { schermo: "Offerte", "menu-qr": "Menu", vetrina: "Chi siamo" };
  const visti = new Set<string>();
  const posti = new Set<string>();
  for (let giro = 0; giro < 3; giro++) {
    await page.clock.runFor(giro ? 20_000 : 1000);
    const servizio = (await page.locator("#zone > .zona:not([hidden])").getAttribute("data-servizio"))!;
    await expect(page.locator("#dove")).toHaveText(ETICHETTE[servizio]!);
    await expect(page.locator("#poi-dove")).toHaveText(ETICHETTE[ORDINE[(ORDINE.indexOf(servizio) + 1) % ORDINE.length]!]!);
    const n = await page.locator("#pallini .pallino").count();
    expect(n, servizio).toBeGreaterThanOrEqual(1);
    expect(n, servizio).toBeLessThanOrEqual(5);
    await expect(page.locator("#pallini .pallino.ora")).toHaveCount(1);
    const stato = await page.locator("#pallini .pallino").evaluateAll((els) => els.map((e) => (e.classList.contains("ora") ? "O" : e.classList.contains("fatto") ? "x" : ".")).join(""));
    expect(stato, servizio).toMatch(/^x*O\.*$/);
    visti.add(servizio);
    const box = async (sel: string) => JSON.stringify(await page.locator(sel).boundingBox().then((b) => b && [Math.round(b.x), Math.round(b.width)]));
    posti.add(`${await box("#dove")} ${await box("#segno")} ${await box("#poi")}`);
  }
  expect(visti.size).toBe(3);
  expect([...posti], "le scritte cambiano ma non spostano il piede").toHaveLength(1);
});

// A136(12) «riempi l'area»: il contenuto di ogni servizio usa l'altezza che ha. Nella zona visibile la banda vuota più
// alta (sopra, sotto o fra due blocchi) non supera il 15% dell'altezza: il testo cresce fino al tetto, poi si centra.
const VUOTO_MAX = 0.15;
function bandaVuota(page: Page) {
  return page.evaluate(() => {
    const zona = document.querySelector<HTMLElement>("#zone > .zona:not([hidden])");
    if (!zona) return null;
    const main = zona.parentElement!;
    // in "intero" la zona è display: contents e lo spazio è quello di main (senza il suo padding)
    const box = getComputedStyle(zona).display === "contents" ? main : zona;
    const cs = getComputedStyle(box);
    const r = box.getBoundingClientRect();
    const alto = r.top + parseFloat(cs.paddingTop);
    const basso = r.bottom - parseFloat(cs.paddingBottom);
    const visibile = (e: Element) => {
      const b = e.getBoundingClientRect();
      if (!b.width || !b.height) return false;
      for (let a: Element | null = e; a && a !== box; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) < 0.05) return false;
      }
      return true;
    };
    const pezzi = [...zona.querySelectorAll("*")].filter(
      (e) => (["IMG", "svg", "CANVAS", "FIGURE"].includes(e.tagName) || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) && visibile(e) && !e.closest("svg *"),
    );
    const fasce = pezzi.map((e) => e.getBoundingClientRect()).map((b) => [Math.max(alto, b.top), Math.min(basso, b.bottom)] as const).sort((a, b) => a[0] - b[0]);
    let peggio = 0;
    let dove = "";
    let fin = alto;
    for (const [t, b] of fasce) {
      if (t - fin > peggio) { peggio = t - fin; dove = fin === alto ? "sopra" : "in mezzo"; }
      fin = Math.max(fin, b);
    }
    if (basso - fin > peggio) { peggio = basso - fin; dove = "sotto"; }
    return { servizio: zona.dataset.servizio, vuoto: Math.round((peggio / (basso - alto)) * 100) / 100, dove };
  });
}

for (const [misura, viewport] of Object.entries(MISURE))
  test(`TV ${misura}: ogni servizio riempie la sua area (banda vuota ≤ ${VUOTO_MAX * 100}%)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    await disposizione(page, "intero");
    await page.goto("/player.html");
    await expect(page.locator(".eq-numero")).toHaveText("1");
    const male: string[] = [];
    const visti = new Set<string>();
    // un giro intero dei servizi (20 s ciascuno), una misura ogni 5 s: ogni pagina di menu e recensioni
    for (let t = 0; t < 64; t++) {
      await page.clock.runFor(t ? 5000 : 1500);
      await page.evaluate(async () => { await document.fonts.ready; document.getAnimations().forEach((a) => a.effect?.getTiming().iterations !== Infinity && a.finish()); });
      const b = await bandaVuota(page);
      if (!b) continue;
      visti.add(b.servizio!);
      if (b.vuoto > VUOTO_MAX) male.push(`${b.servizio} ${t * 5}s: vuoto ${b.dove} ${b.vuoto}`);
    }
    expect(visti.size).toBe(3);
    expect(male).toEqual([]);
  });

// A136(6): misurare i testi costa decine di layout forzati (50–60 ms su una TV lenta, `npm run misura -- --fluidita`)
// e cadeva proprio al cambio pagina: la transizione scattava. Le pagine girano sempre uguali: dal secondo giro le misure
// si rimettono dalla cache. Ogni misura vera lascia un segno `tv-misura`: viste tutte le pagine, non ce ne sono più.
for (const d of ["intero", "affiancato"] as const)
  test(`TV · ${d}: viste tutte le pagine, i cambi non rimisurano (niente scatti sulla TV lenta)`, async ({ page }) => {
    await page.setViewportSize(MISURE["tv-vera-960"]);
    await page.addInitScript(() => {
      const w = window as unknown as { __misure: string[] };
      w.__misure = [];
      addEventListener("tv-misura", (e) => w.__misure.push((e as CustomEvent<string>).detail));
    });
    await page.clock.install();
    await disposizione(page, d);
    await page.goto("/player.html");
    await expect(page.locator(".eq-numero")).toHaveText("1");
    await page.evaluate(() => document.fonts.ready);
    // le pagine di ogni servizio girano col loro passo (servizi 20 s, offerte 8 s, vetrina 10 s): finché un giro di
    // 2 minuti mostra ancora pagine mai viste si scalda; poi due giri di fila senza nessuna misura
    const giro = async () => { for (let s = 0; s < 120; s++) await page.clock.runFor(1000); };
    const misure = () => page.evaluate(() => (window as unknown as { __misure: string[] }).__misure.splice(0));
    const visti: number[] = [];
    for (let n = 0; n < 8 && visti.slice(-2).join() !== "0,0"; n++) { await giro(); visti.push((await misure()).length); }
    expect(visti[0], "il primo giro misura davvero").toBeGreaterThan(0);
    expect(visti.slice(-2), `misure per giro: ${visti}`).toEqual([0, 0]);
  });

// A141 (owner 12/11 «layout totale come insiemi di tiles, separate e consistenti»): ogni blocco è un tile con lo
// stesso raggio, lo stesso spazio fra tutti, dentro lo stesso margine; i bordi coincidono (il piede finisce col
// contenuto, la colonna destra parte col contenuto e il QR chiude in basso col piede).
for (const [misura, viewport] of Object.entries(MISURE))
  for (const d of ["intero", "affiancato"] as const)
    test(`TV ${misura} · ${d}: tile allineati, stesso spazio e raggio`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await disposizione(page, d);
      await page.goto("/player.html");
      await expect(page.locator(".eq-numero")).toHaveText("1");
      const g = await page.evaluate(() => {
        const px = (v: string) => { const e = document.createElement("div"); e.style.width = v; document.body.append(e); const w = e.getBoundingClientRect().width; e.remove(); return w; };
        const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const qr = !document.getElementById("qr")!.hidden;
        const tile = ["header", "#barra", "main", "#piede", "#lato > .zona", ...(qr ? ["#lato > #qr"] : [])];
        return {
          m: px("var(--tv-misura-margine)"), s: px("var(--tv-misura-spazio)"), w: innerWidth, h: innerHeight,
          raggi: [...new Set(tile.map((t) => getComputedStyle(document.querySelector(t)!).borderTopLeftRadius))],
          fondi: tile.filter((t) => getComputedStyle(document.querySelector(t)!).backgroundColor === "rgba(0, 0, 0, 0)"),
          testa: r("header"), barra: r("#barra"), main: r("main"), piede: r("#piede"), coda: r("#lato > .zona"), qr: qr ? r("#lato > #qr") : null,
        };
      });
      const vicino = (a: number, b: number, cosa: string) => expect(Math.abs(a - b), `${cosa}: ${a} invece di ${b}`).toBeLessThanOrEqual(1.5);
      expect(g.raggi).toHaveLength(1);
      expect(g.fondi).toEqual([]);
      for (const t of [g.testa, g.main, g.piede]) vicino(t.left, g.m, "bordo sinistro");
      for (const t of [g.barra, g.coda]) vicino(t.right, g.w - g.m, "bordo destro");
      for (const t of [g.testa, g.barra]) vicino(t.top, g.m, "bordo alto");
      for (const t of [g.piede, g.qr ?? g.coda]) vicino(t.bottom, g.h - g.m, "bordo basso");
      vicino(g.piede.right, g.main.right, "piede col contenuto");
      vicino(g.testa.right, g.main.right, "testata col contenuto");
      vicino(g.coda.top, g.main.top, "coda col contenuto");
      vicino(g.coda.left, g.main.right + g.s, "spazio contenuto–colonna");
      vicino(g.barra.left, g.coda.left, "barra con la colonna");
      vicino(g.main.top, g.testa.bottom + g.s, "spazio testata–contenuto");
      vicino(g.piede.top, g.main.bottom + g.s, "spazio contenuto–piede");
      if (g.qr) { vicino(g.qr.right, g.w - g.m, "bordo destro QR"); vicino(g.qr.top, g.coda.bottom + g.s, "spazio coda–QR"); }
    });

// A141, proposta approvata «Solo menu» e «Solo salta coda»: stessa griglia, i tile che non servono spariscono. Solo
// menu: contenuto largo fino al margine, QR tile nella colonna destra accanto al piede e alto come lui. Solo coda: la
// coda (piena) prende il contenuto fino in fondo, «Prima» e ritmo nel tile a destra, sopra il QR se c'è.
for (const [misura, viewport] of Object.entries(MISURE))
  for (const solo of ["menu-qr", "eliminacode"] as const)
    test(`TV ${misura} · solo ${solo}: tile allineati`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await disposizione(page, "intero");
      for (let i = 0; i < 3; i++) await page.request.post("/api/eliminacode/azione", { data: { azione: "prossimo", banco: 0 }, headers: { "X-Token": TOKEN } }); // «Prima» con 3 numeri
      await page.route("**/api/negozio", async (r) => r.fulfill({ json: { ...(await (await r.fetch()).json()), servizi: [solo], origineTelefono: "http://192.168.1.10:8080" } })); // QR del menu: su 127.0.0.1 non c'è
      await page.goto("/player.html");
      await expect(page.locator("main > .zona:not([hidden])")).toHaveCount(1);
      await expect(page.locator("body")).toHaveAttribute("data-solo", solo === "eliminacode" ? "1" : "0");
      const vicino = (a: number, b: number, cosa: string) => expect(Math.abs(a - b), `${cosa}: ${a} invece di ${b}`).toBeLessThanOrEqual(1.5);
      await expect(async () => {
        const g = await page.evaluate(() => {
          const px = (v: string) => { const e = document.createElement("div"); e.style.width = v; document.body.append(e); const w = e.getBoundingClientRect().width; e.remove(); return w; };
          const r = (s: string) => { const e = document.querySelector<HTMLElement>(s); return e && e.offsetParent !== null ? e.getBoundingClientRect().toJSON() as DOMRect : null; };
          const cs = (s: string) => getComputedStyle(document.querySelector(s)!);
          return {
            m: px("var(--tv-misura-margine)"), s: px("var(--tv-misura-spazio)"), w: innerWidth, h: innerHeight,
            main: r("main")!, piede: r("#piede"), qr: r("#qr"), pezzo: r("#lato > .eq-lato"), testa: r("header")!,
            raggi: [...new Set(["main", "header", "#qr", "#lato > .eq-lato", "#piede"].filter((t) => r(t)).map((t) => cs(t).borderTopLeftRadius))],
            fondoMain: cs("main").backgroundColor,
            // A142: forma di «Ora serviamo» (come nel riquadro) e quanto del tile a destra usano «Prima» e ritmo
            etichetta: document.querySelector(".eq-etichetta") ? `${cs(".eq-etichetta").textTransform} ${cs(".eq-etichetta").letterSpacing}` : "",
            // A143 foto TV: pillole di «Prima» strette a sinistra e un buco fra l'ultima e i serviti
            pillole: (() => { const t = document.querySelector<HTMLElement>("#lato > .eq-lato"); if (!t) return { largo: 0, buco: 1 }; const cs = getComputedStyle(t); const dentro = t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); const c = [...t.querySelectorAll(".eq-chip, .eq-ritmo")].map((e) => e.getBoundingClientRect()); const chip = c.slice(0, -1); let buco = 0; for (let i = 1; i < c.length; i++) buco = Math.max(buco, c[i]!.top - c[i - 1]!.bottom); return { largo: chip.length ? Math.min(...chip.map((b) => b.width)) / dentro : 0, buco: buco / t.clientHeight }; })(),
            pieno: (() => { const t = document.querySelector<HTMLElement>("#lato > .eq-lato"); if (!t) return 0; const f = [...t.children].map((e) => e.getBoundingClientRect()).filter((b) => b.height); return f.length ? (Math.max(...f.map((b) => b.bottom)) - Math.min(...f.map((b) => b.top))) / t.clientHeight : 0; })(),
            accento: (() => { const e = document.createElement("i"); e.style.background = "var(--accento)"; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; })(),
          };
        });
        expect(g.raggi).toHaveLength(1);
        vicino(g.main.left, g.m, "contenuto a sinistra");
        vicino(g.main.top, g.testa.bottom + g.s, "spazio testata–contenuto");
        if (solo === "menu-qr") {
          expect(g.qr, "il menu porta il suo QR").not.toBeNull();
          vicino(g.main.right, g.w - g.m, "contenuto fino al margine destro");
          vicino(g.piede!.left, g.m, "piede a sinistra");
          vicino(g.piede!.top, g.main.bottom + g.s, "spazio contenuto–piede");
          vicino(g.piede!.bottom, g.h - g.m, "piede in fondo");
          vicino(g.qr!.left, g.piede!.right + g.s, "spazio piede–QR");
          vicino(g.qr!.right, g.w - g.m, "QR al margine destro");
          vicino(g.qr!.top, g.piede!.top, "QR alto come il piede");
          vicino(g.qr!.bottom, g.piede!.bottom, "QR chiude col piede");
        } else {
          expect(g.piede, "solo coda: niente piede").toBeNull();
          expect(g.pezzo, "«Prima» e ritmo nel tile a destra").not.toBeNull();
          vicino(g.main.bottom, g.h - g.m, "coda fino in fondo");
          vicino(g.pezzo!.top, g.main.top, "tile a destra col contenuto");
          vicino(g.pezzo!.left, g.main.right + g.s, "spazio coda–tile");
          vicino(g.pezzo!.right, g.w - g.m, "tile al margine destro");
          if (g.qr) { vicino(g.qr.top, g.pezzo!.bottom + g.s, "spazio tile–QR"); vicino(g.qr.bottom, g.h - g.m, "QR in fondo"); }
          else vicino(g.pezzo!.bottom, g.h - g.m, "tile in fondo");
          expect(g.fondoMain, "coda piena nel colore del negozio").toBe(g.accento);
          expect(g.etichetta, "«Ora serviamo» come nel riquadro").toBe("none normal");
          expect(g.pieno, "«Prima» e ritmo usano il tile, non galleggiano nel vuoto").toBeGreaterThan(0.6);
          expect(g.pillole.largo, "pillole di «Prima» larghe quanto il tile").toBeGreaterThan(0.9);
          expect(g.pillole.buco, "nessun buco fra pillole e serviti").toBeLessThan(0.12);
        }
      }).toPass();
      expect(await problemi(page)).toEqual([]);
    });

// A142 foto TV: menu + coda, colonne strette mandavano a capo «Torta di mandorle» e «Calice di vino bianco», col
// prezzo a metà altezza. Due colonne solo se nessun nome va a capo, se no una.
for (const [misura, viewport] of Object.entries(MISURE))
  test(`TV ${misura} · menu + coda: nessun nome di piatto va a capo, stessa grandezza su ogni pagina`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    await disposizione(page, "intero");
    await page.route("**/api/negozio", async (r) => r.fulfill({ json: { ...(await (await r.fetch()).json()), servizi: ["menu-qr", "eliminacode"] } }));
    await page.goto("/player.html");
    const menu = page.locator('#zone [data-servizio="menu-qr"]');
    await expect(menu.locator(".mn-tv-piatto").first()).toBeVisible();
    await expect(page.locator("#lato > .zona[data-servizio=eliminacode]")).toBeVisible();
    const pagine = Number(await menu.locator(".mn-tv").getAttribute("data-pagine"));
    const grandezze = new Set<string>(); // A143 foto TV: la pagina con meno piatti aveva testi più grandi
    for (let k = 0; k < pagine; k++) {
      await expect(async () => {
        const grandezza = await menu.locator(".mn-tv-nome").first().evaluate((n) => getComputedStyle(n).fontSize);
        expect(grandezza, "nome staccato durante il cambio pagina: riprova").not.toBe("");
        const aCapo = await menu.locator(".mn-tv-nome").evaluateAll((els) => els.filter((n) => {
          const r = document.createRange();
          r.selectNodeContents(n);
          return new Set([...r.getClientRects()].filter((x) => x.width).map((x) => Math.round(x.top))).size > 1;
        }).map((n) => n.textContent));
        expect(aCapo, `pagina ${k + 1} di ${pagine}`).toEqual([]);
        grandezze.add(grandezza);
      }).toPass();
      await page.clock.runFor(10_000); // SECONDI_PER_PAGINA del menu
    }
    expect([...grandezze], "stessa grandezza dei piatti su ogni pagina").toHaveLength(1);
    expect(await problemi(page)).toEqual([]);
  });

// A141, foto della TV vera 12/11: con l'aspetto «Foto grande» il body tiene data-foto="1" anche quando gira un altro
// servizio, e il menu perdeva il suo tile (niente fondo, testi fino al bordo). La foto è il tile solo per lo Schermo.
test("«Foto grande»: gli altri servizi tengono il loro tile", async ({ page }) => {
  await page.setViewportSize(MISURE["tv-1080"]);
  await page.clock.install();
  await disposizione(page, "intero");
  await page.goto("/player.html");
  await expect(page.locator(".eq-numero")).toHaveText("1");
  for (let giro = 0; giro < 4; giro++) {
    await page.clock.runFor(giro ? 20_000 : 1000);
    const m = await page.evaluate(() => {
      Object.assign(document.body.dataset, { layout: "foto", foto: "1" }); // quello che lascia lo Schermo con una foto
      const main = document.querySelector("main")!, cs = getComputedStyle(main);
      const altri = [...main.querySelectorAll<HTMLElement>(":scope > .zona:not([hidden])")].filter((z) => z.dataset.servizio !== "schermo");
      return { altri: altri.length, fondo: cs.backgroundColor, padding: parseFloat(cs.paddingLeft) };
    });
    if (!m.altri) continue;
    expect(m.fondo, `giro ${giro}: fondo del tile`).not.toBe("rgba(0, 0, 0, 0)");
    expect(m.padding, `giro ${giro}: respiro nel tile`).toBeGreaterThan(0);
  }
});
