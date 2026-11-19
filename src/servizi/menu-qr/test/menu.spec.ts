// Menu QR end-to-end: pagina del cliente, pannello, TV. Il Menu non è attivo nella demo di tutti i test (una seconda
// sezione cambierebbe ciò che gli altri si aspettano): qui si avvia un server a parte con DEMO_SERVIZI=schermo,menu-qr e dati nuovi.
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import demo from "../demo.json" with { type: "json" };
import type { DatiMenu } from "../core/tipi.ts";
import { dataLocale } from "../../../piattaforma/core/orario.ts";
import { SECONDI_PER_ZONA } from "../../../piattaforma/tv/zone.ts";
import { PORTA_MENU } from "../../../../playwright.config.ts";

const PORTA = PORTA_MENU;
const BASE = `http://127.0.0.1:${PORTA}`;
// indirizzo con cui il telefono raggiunge il server (la TV apre 127.0.0.1, che sul telefono non porta da nessuna parte)
const TELEFONO = "http://192.168.1.50:8080";
const TOKEN = "menu-token";
const MISURE = { 320: 640, 414: 896, 820: 1180, 1440: 900 };
let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn(process.execPath, ["src/piattaforma/server/main.ts"], {
    env: { ...process.env, PORT: String(PORTA), HOST: "127.0.0.1", PANEL_TOKEN: TOKEN, INDIRIZZO_TELEFONO: TELEFONO, DEMO_SERVIZI: "schermo,menu-qr", METEO_BASE: "http://127.0.0.1:9", METEO_BASE_GEO: "http://127.0.0.1:9", DATA_DIR: mkdtempSync(join(tmpdir(), "menu-e2e-")) },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/menu-qr/menu`)).ok) return;
    } catch {
      // non ancora pronto
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server del menu non partito");
});
test.afterAll(() => server?.kill());

async function scrivi(menu: DatiMenu) {
  const r = await fetch(`${BASE}/api/menu-qr/menu`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Token": TOKEN }, body: JSON.stringify(menu) });
  if (!r.ok) throw new Error(`reset menu: ${r.status}`);
}
async function disposizione(valore?: "affiancato") {
  const n = (await (await fetch(`${BASE}/api/negozio`)).json()) as Record<string, unknown>;
  delete n.servizi;
  delete n.disposizione;
  if (valore) n.disposizione = valore;
  const r = await fetch(`${BASE}/api/negozio`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Token": TOKEN }, body: JSON.stringify(n) });
  if (!r.ok) throw new Error(`reset negozio: ${r.status} ${await r.text()}`);
}
const oggi = () => dataLocale(Date.now());
// il menu di esempio con il suo piatto finito oggi, qualunque giorno girino i test
const esempio = (): DatiMenu => {
  const m = structuredClone(demo) as DatiMenu;
  m.piatti = m.piatti.map((p) => (p.finitoIl ? { ...p, finitoIl: oggi() } : p));
  return m;
};
const letto = async () => (await (await fetch(`${BASE}/api/menu-qr/menu`)).json()) as DatiMenu;
test.beforeEach(async () => {
  await scrivi(esempio());
  await disposizione();
});

const piatto = (page: Page, nome: string) => page.locator("#menu .mn-piatto", { has: page.getByRole("heading", { name: nome, exact: true }) });

test.describe("pagina del cliente", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mostra negozio, categorie, prezzi, nota prudente e allergeni con testo", async ({ page }) => {
    await page.goto(`${BASE}/menu.html`);
    await expect(page.locator("#nome")).toHaveText("Panificio Demo");
    await expect(page.getByRole("heading", { name: "Colazione" })).toBeVisible();
    await expect(piatto(page, "Cornetto alla crema")).toContainText("1,50");
    await expect(piatto(page, "Cornetto alla crema")).toContainText("Glutine");
    await expect(piatto(page, "Cornetto alla crema")).toContainText("Latte");
    await expect(page.locator(".mn-legale")).toContainText("Chiedi al personale");
    await expect(page.locator("#filtri button")).toHaveCount(14);
    await page.locator(".mn-allergeni-tutti summary").click();
    await expect(page.locator("#elenco li")).toHaveCount(14);
    await expect(page.locator("#elenco")).toContainText("Anidride solforosa e solfiti");
  });

  test("funziona senza token: nessuna richiesta porta X-Token", async ({ page }) => {
    const conToken: string[] = [];
    page.on("request", (r) => r.headers()["x-token"] && conToken.push(r.url()));
    await page.goto(`${BASE}/menu.html`);
    await expect(piatto(page, "Caffè")).toBeVisible();
    expect(conToken).toEqual([]);
  });

  test("'Senza glutine' toglie chi lo contiene E chi ha gli allergeni non indicati; dice perché", async ({ page }) => {
    await page.goto(`${BASE}/menu.html`);
    await expect(piatto(page, "Panino del giorno")).toBeVisible();
    const glutine = page.locator('#filtri button[data-allergene="glutine"]');
    await glutine.click();
    await expect(glutine).toHaveAttribute("aria-pressed", "true");
    await expect(piatto(page, "Focaccia genovese")).toHaveCount(0);
    await expect(piatto(page, "Cornetto alla crema")).toHaveCount(0);
    await expect(piatto(page, "Panino del giorno")).toHaveCount(0); // allergeni non indicati: mai "senza"
    await expect(piatto(page, "Insalata mista")).toBeVisible();
    await expect(piatto(page, "Caffè")).toBeVisible();
    await expect(page.locator("#esito")).toContainText("non indicati");
    await page.getByRole("button", { name: "Togli i filtri" }).click();
    await expect(piatto(page, "Focaccia genovese")).toBeVisible();
    await expect(piatto(page, "Panino del giorno")).toContainText("Allergeni non indicati");
    await expect(page.locator("#esito")).toHaveText("");
  });

  test("più filtri insieme si sommano", async ({ page }) => {
    await page.goto(`${BASE}/menu.html`);
    await page.locator('#filtri button[data-allergene="latte"]').click();
    await page.locator('#filtri button[data-allergene="solfiti"]').click();
    await expect(piatto(page, "Calice di vino bianco")).toHaveCount(0);
    await expect(piatto(page, "Cappuccino")).toHaveCount(0);
    await expect(piatto(page, "Caffè")).toBeVisible();
  });

  test("'finito oggi' resta nel menu, segnato", async ({ page }) => {
    await page.goto(`${BASE}/menu.html`);
    await expect(piatto(page, "Cornetto vegano")).toContainText("Finito oggi");
    await expect(piatto(page, "Cornetto alla crema")).not.toContainText("Finito oggi");
  });

  test("scegliere un filtro non sposta intestazione e filtri", async ({ page }) => {
    await page.goto(`${BASE}/menu.html`);
    await expect(piatto(page, "Caffè")).toBeVisible();
    const pos = () => page.locator("#filtri button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }));
    const prima = await pos();
    await page.locator('#filtri button[data-allergene="uova"]').click();
    expect(await pos()).toEqual(prima);
  });

  test("senza server o menu: messaggio chiaro, non pagina vuota", async ({ page }) => {
    await page.route("**/api/menu-qr/menu", (r) => r.fulfill({ status: 404, body: "Non trovato" }));
    await page.goto(`${BASE}/menu.html`);
    await expect(page.locator("#menu")).toContainText("Chiedi al personale");
  });

  for (const [larghezza, altezza] of Object.entries(MISURE))
    for (const schema of ["light", "dark"] as const)
      test(`layout e axe · ${larghezza} · ${schema}`, async ({ page }) => {
        await page.setViewportSize({ width: Number(larghezza), height: altezza });
        await page.emulateMedia({ colorScheme: schema, reducedMotion: "reduce" });
        await page.goto(`${BASE}/menu.html`);
        await expect(piatto(page, "Caffè")).toBeVisible();
        await page.locator('#filtri button[data-allergene="glutine"]').click();
        const problemi = await page.evaluate(() => {
          const out: string[] = [];
          if (document.documentElement.scrollWidth > innerWidth) out.push("scroll orizzontale");
          for (const e of document.querySelectorAll<HTMLElement>("body *")) {
            if (!e.offsetParent) continue;
            const b = e.getBoundingClientRect();
            if (e.matches("button, summary, a[href]") && (b.height < 48 || b.width < 48)) out.push(`tocco piccolo ${Math.round(b.width)}×${Math.round(b.height)}: ${e.textContent?.trim().slice(0, 25)}`);
            if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(e).fontSize) < 15) out.push(`testo piccolo: ${e.textContent?.trim().slice(0, 25)}`);
            if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible" && e.clientWidth > 0 && !["SPAN", "svg"].includes(e.tagName)) out.push(`deborda: ${e.tagName} ${e.textContent?.trim().slice(0, 25)}`);
          }
          return out;
        });
        expect(problemi).toEqual([]);
        const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(a.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
      });
});

test.describe("pannello", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const sezione = (page: Page) => page.locator('section[data-servizio="menu-qr"]');

  test("QR del menu e indirizzo stabile /menu.html", async ({ page }) => {
    await page.goto(`${BASE}/panel.html#t=${TOKEN}`);
    await expect(sezione(page).locator("#mn-link")).toHaveText(`${BASE}/menu.html`);
    await expect(sezione(page).locator("#mn-qr")).toBeVisible();
    expect(await sezione(page).locator("#mn-qr-path").getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
  });

  test("segnare 'finito oggi' dal pannello arriva alla pagina del cliente", async ({ page }) => {
    await page.goto(`${BASE}/panel.html#t=${TOKEN}`);
    const riga = sezione(page).locator('li[data-id="caffe"]');
    await riga.locator('input[role="switch"]').click();
    await expect(riga).toContainText("finito oggi");
    await expect.poll(async () => (await letto()).piatti.find((p) => p.id === "caffe")!.finitoIl).toBe(oggi());
    await page.goto(`${BASE}/menu.html`);
    await expect(piatto(page, "Caffè")).toContainText("Finito oggi");
  });

  test("aggiunge una categoria e un piatto con allergeni; poi lo modifica ed elimina", async ({ page }) => {
    await page.goto(`${BASE}/panel.html#t=${TOKEN}`);
    const s = sezione(page);
    await s.locator("#mn-nuova-cat").click();
    await s.locator('#mn-form-cat input[name="nome"]').fill("Primi");
    await s.getByRole("button", { name: "Fatto" }).last().click();
    await expect(s.getByRole("heading", { name: "Primi", exact: true })).toBeVisible();

    await s.locator("#mn-nuovo-piatto").click();
    const f = s.locator("#mn-form-piatto");
    await f.locator('input[name="nome"]').fill("Lasagne");
    await f.locator('input[name="prezzo"]').fill("9,50");
    await f.locator('select[name="categoria"]').selectOption({ label: "Primi" });
    await f.locator('input[name="controllati"]').check();
    await f.locator('input[name="allergene-glutine"]').check();
    await f.locator('input[name="allergene-latte"]').check();
    await f.getByRole("button", { name: "Fatto" }).click();
    await expect(s.locator("#mn-foglio-piatto")).toBeHidden();
    let l = (await letto()).piatti.find((p) => p.nome === "Lasagne")!;
    expect(l).toMatchObject({ prezzo: 950, allergeni: ["glutine", "latte"] });
    expect(l.finitoIl).toBeUndefined();

    await s.locator('li[data-id="lasagne"] button.riga').click();
    await f.locator('input[name="prezzo"]').fill("10");
    await f.locator('input[name="allergene-latte"]').uncheck();
    await f.getByRole("button", { name: "Fatto" }).click();
    await expect.poll(async () => (await letto()).piatti.find((p) => p.id === "lasagne")?.prezzo).toBe(1000);
    l = (await letto()).piatti.find((p) => p.id === "lasagne")!;
    expect(l.allergeni).toEqual(["glutine"]);

    await s.locator('li[data-id="lasagne"] button.riga').click();
    await s.locator("#mn-elimina-piatto").click();
    await s.locator("#mn-conf-si").click();
    await expect.poll(async () => (await letto()).piatti.some((p) => p.id === "lasagne")).toBe(false);
  });

  test("allergeni 'non controllati' restano null e non diventano 'nessuno'", async ({ page }) => {
    await page.goto(`${BASE}/panel.html#t=${TOKEN}`);
    const s = sezione(page);
    await s.locator("#mn-nuovo-piatto").click();
    const f = s.locator("#mn-form-piatto");
    await f.locator('input[name="nome"]').fill("Piatto misterioso");
    await f.locator('input[name="prezzo"]').fill("7");
    await f.getByRole("button", { name: "Fatto" }).click();
    await expect.poll(async () => (await letto()).piatti.find((p) => p.nome === "Piatto misterioso")?.allergeni).toBeNull();
  });

  test("nome o prezzo mancanti: errore, niente salvato", async ({ page }) => {
    await page.goto(`${BASE}/panel.html#t=${TOKEN}`);
    const s = sezione(page);
    const prima = (await letto()).piatti.length;
    await s.locator("#mn-nuovo-piatto").click();
    await s.locator("#mn-form-piatto").getByRole("button", { name: "Fatto" }).click();
    await expect(s.locator("#mn-err-nome")).toBeVisible();
    expect((await letto()).piatti.length).toBe(prima);
  });

  test("senza token nel link: non salva e lo dice", async ({ page }) => {
    await page.goto(`${BASE}/panel.html`);
    const riga = sezione(page).locator('li[data-id="caffe"]');
    await riga.locator('input[role="switch"]').click();
    await expect(page.locator("#avviso, .avviso").first()).toContainText("link completo");
    expect((await letto()).piatti.find((p) => p.id === "caffe")!.finitoIl).toBeUndefined();
  });
});

test.describe("TV", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  const zona = (page: Page) => page.locator('#zone [data-servizio="menu-qr"]');
  // Menu corto: sta in una pagina, così i test non dipendono da quale pagina sta girando.
  const corto = async () => {
    const m = esempio();
    m.categorie = m.categorie.filter((c) => ["colazione", "bevande"].includes(c.id));
    m.piatti = m.piatti.filter((p) => ["cornetto", "cornetto-vegano", "caffe"].includes(p.id));
    await scrivi(m);
  };

  test("Menu del giorno: solo i piatti disponibili, per categoria, con prezzi", async ({ page }) => {
    await corto();
    // l'orologio parte nel turno del menu: togliere "hidden" a mano non regge, il guscio lo rimette al primo giro
    const giro = 2 * SECONDI_PER_ZONA * 1000;
    await page.clock.install({ time: Math.floor(Date.now() / giro) * giro + SECONDI_PER_ZONA * 1000 + 500 });
    await page.goto(`${BASE}/player.html`);
    await expect(zona(page).getByRole("heading", { name: "Menu del giorno" })).toBeVisible();
    await expect(zona(page).locator(".mn-tv-righe")).toContainText("Cornetto alla crema");
    await expect(zona(page).locator(".mn-tv-righe")).toContainText("1,50");
    await expect(zona(page).locator(".mn-tv-righe")).not.toContainText("Cornetto vegano"); // finito oggi
  });

  test("a mezzo schermo (affiancato) le righe stanno nella zona, leggibili da lontano", async ({ page }) => {
    await disposizione("affiancato");
    await page.goto(`${BASE}/player.html`);
    await expect(zona(page).locator(".mn-tv-piatto").first()).toBeVisible();
    const r = await zona(page).locator(".mn-tv").evaluate((e) => {
      const b = e.getBoundingClientRect();
      const righe = [...e.querySelectorAll<HTMLElement>(".mn-tv-piatto, .mn-tv-cat")];
      return { sfora: righe.filter((x) => x.getBoundingClientRect().bottom > innerHeight || x.scrollWidth > x.clientWidth + 1).map((x) => `${x.className}:${Math.round(x.getBoundingClientRect().bottom)}:${x.scrollWidth}/${x.clientWidth}`), larghezza: b.width, testo: parseFloat(getComputedStyle(righe[1]!).fontSize), scrollO: document.documentElement.scrollWidth > innerWidth };
    });
    expect(r.sfora).toEqual([]);
    expect(r.scrollO).toBe(false);
    expect(r.larghezza).toBeLessThan(1920 * 0.6);
    expect(r.testo).toBeGreaterThanOrEqual(40); // 1080 px di altezza: ≥ 40 px si legge da qualche metro
    await expect(page.locator("#zone .zona:visible")).toHaveCount(2);
  });

  test("senza QR del negozio la TV mostra da sola il QR del menu, leggibile (prova TV 11/11)", async ({ page }) => {
    const modulo = (await import("jsqr")) as unknown as { default: typeof import("jsqr").default | { default: typeof import("jsqr").default } };
    const jsQR = "default" in modulo.default ? modulo.default.default : modulo.default;
    const { PNG } = await import("pngjs");
    await page.goto(`${BASE}/player.html`);
    await expect(page.locator("#qr")).toBeVisible();
    await expect(page.locator("#qr-testo")).toHaveText("Menu e allergeni");
    const png = PNG.sync.read(await page.locator("#qr-svg").screenshot());
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(`${TELEFONO}/menu.html`);
  });

  // A136(5)/A141: senza coda il QR è un tile piccolo nella riga del piede (alto come lui) e il contenuto prende tutta la larghezza;
  // il menu non ha un QR grande suo (rubava le due colonne: 3 pagine invece di 2, foto TV 11/11)
  for (const [w, h] of [[960, 540], [1920, 1080]] as const)
  test(`${w}×${h}: senza coda QR piccolo nella riga del piede, nessun QR grande nel menu, niente colonna vuota`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const giro = 2 * SECONDI_PER_ZONA * 1000;
    await page.clock.install({ time: Math.floor(Date.now() / giro) * giro + SECONDI_PER_ZONA * 1000 + 500 });
    await page.goto(`${BASE}/player.html`);
    await expect(page.locator("#qr")).toBeVisible();
    await expect(zona(page).locator(".mn-tv-righe li").first()).toBeVisible();
    await expect(zona(page).locator(".mn-tv-qr")).toHaveCount(0);
    const r = await page.evaluate(() => {
      const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const qr = box("#qr"), piede = box("#piede");
      return { nelPiede: qr.top >= piede.top - 1 && qr.bottom <= piede.bottom + 1, lato: box("#qr-svg").height / innerHeight, destra: box("main").right / innerWidth };
    });
    expect(r.nelPiede, "QR fisso nella riga del piede").toBe(true);
    expect(r.lato).toBeLessThan(0.08);
    expect(r.destra, "senza coda il contenuto arriva al bordo destro").toBeGreaterThan(0.95);
  });

  // mockup approvato: titolo a sinistra (la data sopra tolta, A141), puntini tra piatto e prezzo (prezzo accanto al suo piatto)
  test("1920: titolo del menu a sinistra, puntini tra piatto e prezzo", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const giro = 2 * SECONDI_PER_ZONA * 1000;
    await page.clock.install({ time: Math.floor(Date.now() / giro) * giro + SECONDI_PER_ZONA * 1000 + 500 });
    await page.goto(`${BASE}/player.html`);
    await expect(zona(page).locator(".mn-tv-piatto").first()).toBeVisible();
    const r = await zona(page).evaluate((z) => {
      const b = (e: Element) => e.getBoundingClientRect();
      const titolo = b(z.querySelector(".mn-tv-titolo")!), righe = b(z.querySelector(".mn-tv-righe")!);
      const piatti = [...z.querySelectorAll(".mn-tv-piatto")].map((li) => {
        const n = b(li.querySelector(".mn-tv-nome")!), p = b(li.querySelector(".mn-tv-prezzo")!), d = li.querySelector(".mn-tv-punti");
        return { punti: d ? b(d).width : 0, buco: p.left - n.right - (d ? b(d).width : 0) };
      });
      const range = document.createRange(); range.selectNodeContents(z.querySelector(".mn-tv-titolo")!);
      return { sinistra: range.getBoundingClientRect().left - righe.left, titolo: titolo.left, piatti };
    });
    expect(Math.abs(r.sinistra), "titolo allineato alla lista").toBeLessThan(4);
    for (const p of r.piatti) {
      expect(p.punti, "puntini fra piatto e prezzo").toBeGreaterThan(10);
      expect(p.buco, "il prezzo segue i puntini").toBeLessThan(80);
    }
  });

  for (const [w, h] of [[1280, 720], [1366, 768], [1920, 1080], [3840, 2160]] as const)
  test(`a schermo intero ${w}×${h}, menu lungo e QR acceso: nessuna riga sotto la barra o sotto il QR (prova TV 11/11)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    // schermo e menu si alternano ogni SECONDI_PER_ZONA: l'orologio parte all'inizio del turno del menu (il secondo)
    const giro = 2 * SECONDI_PER_ZONA * 1000;
    await page.clock.install({ time: Math.floor(Date.now() / giro) * giro + SECONDI_PER_ZONA * 1000 + 500 });
    await page.goto(`${BASE}/player.html`);
    await expect(page.locator("#qr")).toBeVisible();
    await expect(zona(page).locator(".mn-tv-piatto").first()).toBeVisible();
    await page.clock.runFor(3000); // il giro che toglie righe parte ogni secondo
    const r = await page.evaluate(() => {
      const main = document.querySelector("main")!.getBoundingClientRect();
      const qr = document.getElementById("qr")!.getBoundingClientRect();
      const tocca = (b: DOMRect) => b.right > qr.left && b.bottom > qr.top && b.top < qr.bottom;
      const el = [...document.querySelectorAll<HTMLElement>('[data-servizio="menu-qr"] .mn-tv-piatto, [data-servizio="menu-qr"] .mn-tv-cat, [data-servizio="menu-qr"] .mn-tv-nota')];
      return el.filter((e) => { const b = e.getBoundingClientRect(); return b.bottom > main.bottom + 1 || tocca(b); }).map((e) => e.textContent);
    });
    expect(r).toEqual([]);
  });

  // A136(8): menu a due colonne a schermo intero, pagine fatte misurando; rimpicciolendo e tornando grande le pagine
  // tornano quelle di prima (prima la capienza scendeva e non risaliva più: TV con 2 piatti per pagina).
  test("a schermo intero 1920: due colonne; dopo uno schermo stretto le pagine risalgono", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const giro = 2 * SECONDI_PER_ZONA * 1000;
    await page.clock.install({ time: Math.floor(Date.now() / giro) * giro + SECONDI_PER_ZONA * 1000 + 500 });
    await page.goto(`${BASE}/player.html`);
    await expect(zona(page).locator(".mn-tv-piatto").first()).toBeVisible();
    await page.clock.runFor(2000);
    const colonne = () => zona(page).locator(".mn-tv-piatto").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
    const pagine = () => zona(page).locator(".mn-tv").getAttribute("data-pagine");
    // la misura arriva dal ResizeObserver, che va coi frame veri e non con l'orologio finto: si aspetta il risultato
    await expect.poll(colonne).toBe(2);
    const grandi = await pagine();
    await page.setViewportSize({ width: 1000, height: 1080 }); // stretta: una colonna sola, più pagine
    await page.clock.runFor(2000);
    await expect.poll(colonne).toBe(1);
    await expect.poll(async () => Number(await pagine())).toBeGreaterThan(Number(grandi));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.clock.runFor(2000);
    await expect.poll(pagine).toBe(grandi);
  });

  // A141 owner 12/11 «menu disordinato»: colonne sbilanciate, data e categorie maiuscole. Ogni pagina: due colonne che
  // partono alla stessa altezza, ognuna col titolo di una categoria, finiscono a meno di una riga l'una dall'altra.
  test("a schermo intero 1920 ogni pagina del menu ha due colonne pari, senza data né maiuscole", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const giro = 2 * SECONDI_PER_ZONA * 1000;
    await page.clock.install({ time: Math.floor(Date.now() / giro) * giro + SECONDI_PER_ZONA * 1000 + 500 });
    await page.goto(`${BASE}/player.html`);
    await expect(zona(page).locator(".mn-tv-piatto").first()).toBeVisible();
    await expect(zona(page).locator(".mn-tv-data")).toHaveCount(0);
    const pagine = Number(await zona(page).locator(".mn-tv").getAttribute("data-pagine"));
    expect(pagine).toBeGreaterThan(1);
    for (let k = 0; k < pagine; k++) {
      await expect(async () => {
        const c = await zona(page).locator(".mn-tv-righe").evaluate((ul) => {
          const li = [...ul.children] as HTMLElement[];
          const sx = Math.min(...li.map((e) => e.getBoundingClientRect().left));
          const col = [li.filter((e) => e.getBoundingClientRect().left < sx + 5), li.filter((e) => e.getBoundingClientRect().left >= sx + 5)];
          const alta = Math.max(...li.filter((e) => e.classList.contains("mn-tv-piatto")).map((e) => e.getBoundingClientRect().height));
          return {
            maiuscole: li.filter((e) => getComputedStyle(e).textTransform === "uppercase").length,
            animano: li.some((e) => e.getAnimations().some((a) => a.playState === "running")),
            prime: col.map((c) => (c[0]?.classList.contains("mn-tv-cat") ? "cat" : c[0] ? "piatto" : "vuota")),
            cima: col.map((c) => Math.round(c[0]?.getBoundingClientRect().top ?? 0)),
            fondo: col.map((c) => Math.round(Math.max(...c.map((e) => e.getBoundingClientRect().bottom)))),
            alta,
          };
        });
        expect(c.animano).toBe(false);
        expect(c.maiuscole, "categorie non maiuscole").toBe(0);
        expect(c.prime, `pagina ${k + 1}: ogni colonna parte con una categoria`).toEqual(["cat", "cat"]);
        expect(Math.abs(c.cima[0]! - c.cima[1]!), `pagina ${k + 1}: colonne alla stessa altezza`).toBeLessThan(3);
        expect(Math.abs(c.fondo[0]! - c.fondo[1]!), `pagina ${k + 1}: colonne pari`).toBeLessThan(c.alta);
      }).toPass();
      await page.clock.runFor(10_000); // SECONDI_PER_PAGINA di tv.ts
    }
  });

  // foto TV 11/11: nomi a capo e categorie centrati su tutta la pagina, lontani dalla loro colonna
  test("a schermo intero le righe del menu partono dal bordo sinistro della loro colonna", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const giro = 2 * SECONDI_PER_ZONA * 1000;
    await page.clock.install({ time: Math.floor(Date.now() / giro) * giro + SECONDI_PER_ZONA * 1000 + 500 });
    await page.goto(`${BASE}/player.html`);
    await expect(zona(page).locator(".mn-tv-piatto").first()).toBeVisible();
    await page.clock.runFor(2000);
    const storti = await zona(page).locator(".mn-tv-cat, .mn-tv-nome").evaluateAll((els) =>
      els.flatMap((e) => {
        const box = (e.classList.contains("mn-tv-nome") ? e.parentElement! : e).getBoundingClientRect();
        const r = document.createRange();
        r.selectNodeContents(e);
        return [...r.getClientRects()].filter((x) => x.left - box.left > 2).map(() => e.textContent);
      }),
    );
    expect(storti).toEqual([]);
  });

  test("un piatto finito sparisce dalla TV entro pochi secondi", async ({ page }) => {
    await corto();
    await page.goto(`${BASE}/player.html`);
    await expect(zona(page).locator(".mn-tv-righe")).toContainText("Caffè");
    const m = await letto();
    m.piatti.find((p) => p.id === "caffe")!.finitoIl = oggi();
    await scrivi(m);
    await expect(zona(page).locator(".mn-tv-righe")).not.toContainText("Caffè", { timeout: 15_000 });
  });

  test("a mezzanotte di Roma il 'finito oggi' di ieri torna sulla TV da solo", async ({ page }) => {
    await corto();
    const m = await letto();
    m.piatti.find((p) => p.id === "caffe")!.finitoIl = "2026-11-06";
    await scrivi(m);
    await page.clock.install({ time: new Date("2026-11-06T22:59:50Z") }); // 23:59:50 a Roma
    await page.goto(`${BASE}/player.html`);
    await expect(zona(page).locator(".mn-tv-righe")).toContainText("Cornetto");
    await expect(zona(page).locator(".mn-tv-righe")).not.toContainText("Caffè");
    await page.clock.runFor(15_000);
    await expect(zona(page).locator(".mn-tv-righe")).toContainText("Caffè");
  });
});
