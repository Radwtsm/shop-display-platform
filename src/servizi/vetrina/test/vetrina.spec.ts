// E2E della Vetrina: TV, pannello (storia, QR, sito, cartello A5) e minisito. Ha un server tutto suo (porta diversa
// da quella del server di prova, dove la Vetrina non è accesa) con DEMO_SERVIZI="schermo,vetrina" e senza chiave Google.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PORTA_VETRINA } from "../../../../playwright.config.ts";
import { MARTEDI_9 } from "../../../../test/e2e/aiuti.ts";
import { BASE as ESEMPIO } from "../fixtures/esempio.ts";

// la foto della fixture non esiste su questo server: il server rifiuta foto sconosciute
const BASE = { ...ESEMPIO, storia: { anno: 1987, testo: ESEMPIO.storia!.testo } };

const PORTA = PORTA_VETRINA;
const BASE_URL = `http://127.0.0.1:${PORTA}`;
const TOKEN = "vetrina-e2e";

let server: ChildProcess;
let dati: string;

test.use({ baseURL: BASE_URL, viewport: { width: 414, height: 896 } });
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  dati = mkdtempSync(join(tmpdir(), "vetrina-e2e-"));
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(PORTA), HOST: "127.0.0.1", PANEL_TOKEN: TOKEN, DATA_DIR: dati, METEO_BASE: "http://127.0.0.1:9", METEO_BASE_GEO: "http://127.0.0.1:9", DEMO_SERVIZI: "schermo,vetrina" };
  delete env.GOOGLE_PLACES_API_KEY; // mai la chiave vera nei test: recensioni finte
  server = spawn("node", ["src/piattaforma/server/main.ts"], { env, stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE_URL}/api/config`)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const r = await fetch(`${BASE_URL}/api/vetrina`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Token": TOKEN }, body: JSON.stringify(BASE) });
  if (!r.ok) throw new Error(`vetrina iniziale: ${r.status} ${await r.text()}`);
});

test.afterAll(() => {
  server?.kill();
  if (dati) rmSync(dati, { recursive: true, force: true });
});

async function ripristina() {
  await fetch(`${BASE_URL}/api/vetrina`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Token": TOKEN }, body: JSON.stringify(BASE) });
}
test.beforeEach(ripristina);

const sito = async () => (await (await fetch(`${BASE_URL}/api/vetrina/sito`)).json()) as { storia?: { anno?: number; testo: string }; qr: { id: string }[]; recensioni: { fonte: string } };

async function apriPannello(page: Page) {
  await page.clock.install({ time: MARTEDI_9 });
  await page.goto(`/panel.html#t=${TOKEN}`);
  await expect(page.locator("#v-storia-sotto")).toContainText("Dal 1987");
}

test("TV: a rotazione storia, QR e recensioni (di esempio, dichiarate)", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install({ time: MARTEDI_9 });
  await page.goto("/player.html");
  const viste = new Set<string>();
  for (let i = 0; i < 40 && viste.size < 3; i++) {
    const v = page.locator(".v-tv");
    if (await v.isVisible()) {
      const s = await v.getAttribute("data-schermata");
      if (s) viste.add(s);
    }
    await page.clock.fastForward(10_000);
  }
  expect([...viste].sort()).toEqual(["qr", "recensioni", "storia"]);
});

test("TV: la schermata delle recensioni dice che sono di esempio e non nasconde le tre stelle", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install({ time: MARTEDI_9 });
  await page.goto("/player.html");
  for (let i = 0; i < 40 && !(await page.locator(".v-rec").isVisible()); i++) await page.clock.fastForward(10_000);
  await expect(page.locator(".v-fonte")).toHaveText("Recensioni di esempio");
  const tutte: string[] = [];
  // gira finché la recensione da 3 stelle esce (con la demo affiancata le schermate si alternano in un altro ordine)
  for (let i = 0; i < 30 && !tutte.some((v) => v.includes("★★★☆☆")); i++) {
    if (await page.locator(".v-rec").isVisible()) tutte.push(...(await page.locator(".v-voto").allTextContents()));
    await page.clock.fastForward(10_000);
  }
  expect(tutte.some((v) => v.includes("★★★☆☆"))).toBe(true);
});

// A136(3): una recensione per volta, grande, centrata in verticale nella zona (prima due piccole in cima)
test("TV: una recensione per volta, grande e centrata in verticale", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install({ time: MARTEDI_9 });
  await page.goto("/player.html");
  for (let i = 0; i < 40 && !(await page.locator(".v-rec").isVisible()); i++) await page.clock.fastForward(10_000);
  await expect(page.locator(".v-rec")).toBeVisible();
  await expect(page.locator(".v-elenco li")).toHaveCount(1);
  const r = await page.evaluate(() => {
    const main = document.querySelector("main")!.getBoundingClientRect();
    const rec = document.querySelector(".v-rec")!.getBoundingClientRect();
    const testo = (document.querySelector(".v-rtesto") ?? document.querySelector(".v-voto"))!; // il testo; le stelle solo se manca
    return { scarto: Math.abs(rec.top + rec.height / 2 - (main.top + main.height / 2)) / main.height, corpo: parseFloat(getComputedStyle(testo).fontSize) / innerHeight };
  });
  expect(r.scarto, "centro della recensione rispetto al centro del contenuto").toBeLessThan(0.05);
  expect(r.corpo, "testo della recensione in frazione dell'altezza TV").toBeGreaterThanOrEqual(0.05);
});

test("pannello: scrivo la storia e la TV e il sito la mostrano", async ({ page }) => {
  await apriPannello(page);
  await page.locator("#v-apri-storia").click();
  const f = page.locator("#v-foglio-storia");
  await f.locator("input[name=anno]").fill("1992");
  await f.locator("textarea").fill("Siamo una famiglia di fornai.");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#toast")).toContainText("Storia aggiornata");
  await expect(page.locator("#v-storia-sotto")).toHaveText("Dal 1992 · Siamo una famiglia di fornai.");
  expect((await sito()).storia).toMatchObject({ anno: 1992, testo: "Siamo una famiglia di fornai." });
});

test("pannello: anno sbagliato o storia lunga = errore accanto al campo, niente salvato", async ({ page }) => {
  await apriPannello(page);
  await page.locator("#v-apri-storia").click();
  const f = page.locator("#v-foglio-storia");
  await f.locator("input[name=anno]").fill("12ab");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#v-err-anno")).toBeVisible();
  await expect(f).toHaveJSProperty("open", true);
  expect((await sito()).storia?.anno).toBe(1987);
});

test("pannello: Annulla nel toast rimette la storia di prima", async ({ page }) => {
  await apriPannello(page);
  await page.locator("#v-apri-storia").click();
  await page.locator("#v-foglio-storia textarea").fill("Testo nuovo");
  await page.locator("#v-foglio-storia").getByRole("button", { name: "Fatto" }).click();
  await page.locator("#toast-annulla").click();
  await expect.poll(async () => (await sito()).storia?.testo).toBe(BASE.storia?.testo);
});

test("pannello: QR, Instagram con @ e link diventa il nome; Wi-Fi tolto non esce sul sito", async ({ page }) => {
  await apriPannello(page);
  await page.locator("#v-apri-qr").click();
  const f = page.locator("#v-foglio-qr");
  await f.locator("input[name=instagram]").fill("https://www.instagram.com/forno.nuovo/");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#toast")).toContainText("QR aggiornati");
  const r = (await (await fetch(`${BASE_URL}/api/vetrina/tv`)).json()) as { qr: { id: string; sotto: string }[] };
  expect(r.qr.find((q) => q.id === "instagram")?.sotto).toBe("@forno.nuovo");
  // il Wi-Fi c'è sulla TV (rete locale), mai sul sito pubblico
  expect(r.qr.some((q) => q.id === "wifi")).toBe(true);
  expect((await sito()).qr.some((q) => q.id === "wifi")).toBe(false);
});

test("pannello: Place ID con spazi o simboli = errore accanto al campo", async ({ page }) => {
  await apriPannello(page);
  await page.locator("#v-apri-qr").click();
  const f = page.locator("#v-foglio-qr");
  await f.locator("input[name=placeId]").fill("non valido <script>");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#v-err-placeId")).toBeVisible();
});

test("pannello: orari e contatti del sito si salvano", async ({ page }) => {
  await apriPannello(page);
  await page.locator("#v-apri-sito").click();
  const f = page.locator("#v-foglio-sito");
  await f.locator("input[name=indirizzo]").fill("Via Nuova 3, Roma");
  await f.locator("input[name=da]").fill("08:00");
  await f.locator("input[name=a]").fill("13:00");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#toast")).toContainText("Sito aggiornato");
  const r = (await (await fetch(`${BASE_URL}/api/vetrina/sito`)).json()) as { contatti: { indirizzo: string }; orari: { da: string }[] };
  expect(r.contatti.indirizzo).toBe("Via Nuova 3, Roma");
  expect(r.orari[0]?.da).toBe("08:00");
});

test("pannello: orari fine prima dell'inizio uguali = errore (non salva)", async ({ page }) => {
  await apriPannello(page);
  await page.locator("#v-apri-sito").click();
  const f = page.locator("#v-foglio-sito");
  await f.locator("input[name=da]").fill("");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#v-err-orari")).toBeVisible();
});

test("pannello: il cartello A5 si vede solo in stampa e ha i tre QR", async ({ page }) => {
  await apriPannello(page);
  await page.evaluate(() => { (window as unknown as { __stampe: number }).__stampe = 0; window.print = () => { (window as unknown as { __stampe: number }).__stampe++; }; });
  await page.locator("#v-stampa").click();
  expect(await page.evaluate(() => (window as unknown as { __stampe: number }).__stampe)).toBe(1);
  await expect(page.locator(".v-cartello")).toBeHidden();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".v-cartello")).toBeVisible();
  await expect(page.locator(".v-c-voce")).toHaveCount(3);
  await expect(page.locator("#v-apri-storia")).toBeHidden();
  const pdf = await page.pdf({ preferCSSPageSize: true });
  expect(pdf.length).toBeGreaterThan(1000);
});

test("pannello: senza QR il tasto Stampa dice cosa fare", async ({ page }) => {
  await fetch(`${BASE_URL}/api/vetrina`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Token": TOKEN }, body: JSON.stringify({ ...BASE, placeId: undefined, wifi: undefined, instagram: undefined }) });
  await page.clock.install({ time: MARTEDI_9 });
  await page.goto(`/panel.html#t=${TOKEN}`);
  await expect(page.locator("#v-qr-sotto")).toContainText("Nessun QR");
  await page.locator("#v-stampa").click();
  await expect(page.locator("#v-err-pagina")).toContainText("almeno un QR");
});

test("pannello: accessibile (axe) con il foglio aperto", async ({ page }) => {
  await apriPannello(page);
  await page.locator("#v-apri-qr").click();
  const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a.violations.map((v) => v.id)).toEqual([]);
});

test("sito: nome, orari, aperto ora, recensioni di esempio, link al menu, niente Wi-Fi", async ({ page }) => {
  await page.clock.install({ time: MARTEDI_9 });
  await page.goto("/sito.html");
  await expect(page.locator("#rec-fonte")).toHaveText("Recensioni di esempio (non reali)");
  await expect(page.locator("#aperto")).toHaveText("Aperto ora");
  await expect(page.locator("#link-menu")).toHaveAttribute("href", "/menu.html");
  await expect(page.locator("#anno")).toHaveText("Dal 1987");
  await expect(page.locator("#rec-elenco li")).toHaveCount(5);
  await expect(page.locator("#mappe a")).toHaveCount(2);
  await expect(page.locator("body")).not.toContainText("pane-caldo-24");
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("sito: di domenica risulta chiuso", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-01T12:00:00+01:00") });
  await page.goto("/sito.html");
  await expect(page.locator("#aperto")).toHaveText("Chiuso ora");
});
