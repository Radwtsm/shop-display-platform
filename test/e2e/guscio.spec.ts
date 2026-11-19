// I gusci di TV e pannello con più servizi. Il catalogo ne ha uno solo montato (Schermo), quindi qui se ne aggiunge
// uno FINTO (solo nel test): il bundle della pagina è rifatto con Schermo + il finto, e /api/negozio dichiara
// entrambi attivi. Cosa prova: zone "intero" a rotazione, "affiancato" insieme, un servizio muto fa il pallino
// offline, e il pannello monta una sezione per servizio.
import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { PORTA_DUE, TOKEN } from "../../playwright.config.ts";
import { imposta, MARTEDI_9, TV } from "./aiuti.ts";

const FINTO_TV = `
export const servizioTv = { id: "eliminacode", monta(zona, ctx) {
  zona.textContent = "FINTO-TV";
  window.__reteFinto = ctx.rete;
  ctx.rete(true);
} };`;
const FINTO_PANNELLO = `
export const servizioPannello = { id: "eliminacode", montaPannello(sezione, ctx) {
  sezione.textContent = "FINTO-PANNELLO";
  sezione.dataset.servizi = ctx.servizi().join();
} };`;

async function bundle(finto: string, esporta: string, avvia: string, file: string, guscio: string, schermo: string) {
  const r = await build({
    stdin: {
      contents: `import { ${esporta} as schermo } from "./servizi/schermo/${schermo}";
import { ${esporta} as finto } from "./finto.ts";
import { ${avvia} } from "${guscio}";
${avvia}([schermo, finto]);`,
      resolveDir: "src",
      sourcefile: file,
    },
    plugins: [{ name: "finto", setup: (b) => { b.onResolve({ filter: /^\.\/finto\.ts$/ }, () => ({ path: "finto", namespace: "finto" })); b.onLoad({ filter: /.*/, namespace: "finto" }, () => ({ contents: finto, loader: "js" })); } }],
    bundle: true, format: "esm", target: "es2020", write: false, logLevel: "silent",
  });
  return r.outputFiles[0]!.text;
}

async function conServiziFinti(page: Page, disposizione: "intero" | "affiancato") {
  const player = await bundle(FINTO_TV, "servizioTv", "avviaTv", "player.js", "./piattaforma/tv/guscio.ts", "tv.ts");
  const panel = await bundle(FINTO_PANNELLO, "servizioPannello", "avviaPannello", "panel.js", "./piattaforma/pannello/guscio.ts", "pannello.ts");
  await page.route("**/assets/player.js", (r) => r.fulfill({ contentType: "text/javascript", body: player }));
  await page.route("**/assets/panel.js", (r) => r.fulfill({ contentType: "text/javascript", body: panel }));
  await page.route("**/api/negozio", async (r) => {
    if (r.request().method() !== "GET") return r.continue();
    const vero = await (await r.fetch()).json();
    return r.fulfill({ json: { ...vero, disposizione, servizi: ["schermo", "eliminacode"] } });
  });
}

test.beforeEach(async ({ request }) => imposta(request));

test.describe("TV con due servizi", () => {
  test.use({ viewport: TV });

  test("intero: una zona per volta, a rotazione", async ({ page }) => {
    await page.clock.install({ time: MARTEDI_9 });
    await conServiziFinti(page, "intero");
    await page.goto("/player.html");
    const zone = page.locator("#zone > .zona");
    await expect(zone).toHaveCount(2);
    await expect(zone.nth(0)).toBeVisible(); // schermo
    await expect(zone.nth(1)).toBeHidden();
    await page.clock.runFor(20_000);
    await expect(zone.nth(0)).toBeHidden();
    await expect(zone.nth(1)).toBeVisible();
    await expect(zone.nth(1)).toHaveText("FINTO-TV");
  });

  test("affiancato: due zone insieme, una accanto all'altra, senza uscire dallo schermo", async ({ page }) => {
    await page.clock.install({ time: MARTEDI_9 });
    await conServiziFinti(page, "affiancato");
    await page.goto("/player.html");
    const zone = page.locator("#zone > .zona");
    await expect(zone).toHaveCount(2);
    await expect(zone.nth(0)).toBeVisible();
    await expect(zone.nth(1)).toBeVisible();
    await expect(zone.nth(1)).toHaveJSProperty("hidden", false); // visibile perché non nascosta, non per un caso di CSS
    const [a, b] = await Promise.all([zone.nth(0).boundingBox(), zone.nth(1).boundingBox()]);
    expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x + 1); // colonne, non una sopra l'altra
    expect(b!.x + b!.width).toBeLessThanOrEqual(TV.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(TV.width);
  });

  test("un servizio muto per più di 60 s accende il pallino offline anche se il resto va", async ({ page }) => {
    await page.clock.install({ time: MARTEDI_9 });
    await conServiziFinti(page, "affiancato");
    await page.goto("/player.html");
    await expect(page.locator("#zone > .zona")).toHaveCount(2);
    await page.clock.runFor(30_000);
    await expect(page.locator("body")).toHaveAttribute("data-offline", "0");
    await page.clock.runFor(45_000); // lo Schermo e il guscio rispondono, il finto no
    await expect(page.locator("body")).toHaveAttribute("data-offline", "1");
    await page.evaluate(() => (window as unknown as { __reteFinto(ok: boolean): void }).__reteFinto(true));
    await page.clock.runFor(2_000);
    await expect(page.locator("body")).toHaveAttribute("data-offline", "0");
  });
});

test.describe("TV con l'Eliminacode vero", () => {
  test.use({ viewport: TV, baseURL: `http://127.0.0.1:${PORTA_DUE}` });

  // bug 12/11: con la linea degli eventi aperta e la coda ferma il servizio non diceva più "ci sono" (il ": vivo"
  // del server non arriva al codice) e dopo 60 s la TV accendeva il pallino offline con tutto funzionante
  test("coda ferma con la linea aperta: niente pallino offline", async ({ page }) => {
    await page.clock.install({ time: MARTEDI_9 });
    await page.goto("/player.html");
    await expect(page.locator(".eq-tv")).toBeAttached();
    await page.clock.runFor(90_000);
    await expect(page.locator("body")).toHaveAttribute("data-offline", "0");
  });
});

test.describe("pannello con due servizi", () => {
  test("una sezione per servizio attivo, nell'ordine del catalogo", async ({ page }) => {
    await conServiziFinti(page, "intero");
    await page.goto(`/panel.html#t=${TOKEN}`);
    const sezioni = page.locator("#sezioni > section.servizio");
    await expect(sezioni).toHaveCount(2);
    await expect(sezioni.nth(0)).toHaveAttribute("data-servizio", "schermo");
    await expect(sezioni.nth(1)).toHaveAttribute("data-servizio", "eliminacode");
    await expect(sezioni.nth(1)).toHaveText("FINTO-PANNELLO");
  });

  test("con due servizi l'Aspetto offre la disposizione e la salva nel negozio", async ({ page, request }) => {
    await conServiziFinti(page, "intero");
    await page.goto(`/panel.html#t=${TOKEN}`);
    await expect(page.locator("#offerte li")).toHaveCount(5);
    await page.locator("#apri-aspetto").click();
    await expect(page.locator("#fa-zona-disposizione")).toBeVisible();
    await page.locator("#fa-disposizione").getByRole("button", { name: /Affiancati/ }).click();
    await page.locator("#modulo-aspetto").getByRole("button", { name: "Fatto" }).click();
    await expect(page.locator("#foglio-aspetto")).toBeHidden();
    const negozio = await (await request.get("/api/negozio")).json();
    expect(negozio.disposizione).toBe("affiancato");
  });

  test("con un servizio solo la disposizione non si vede", async ({ page }) => {
    await page.goto(`/panel.html#t=${TOKEN}`);
    await expect(page.locator("#offerte li")).toHaveCount(5);
    await page.locator("#apri-aspetto").click();
    await expect(page.locator("#fa-zona-disposizione")).toBeHidden();
  });
});
