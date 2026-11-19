// Le regole di layout di DESIGN.md ("Più dispositivi", "Niente salti", "Tocchi", "Leggibilità") applicate a OGNI
// pagina, a ogni misura, in chiaro e scuro. Una pagina nuova in public/ senza una voce qui fa fallire il test.
import { readdirSync } from "node:fs";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PORTA_DUE, TOKEN } from "../../playwright.config.ts";
import { imposta, MARTEDI_9 } from "./aiuti.ts";

interface Pagina {
  url: string;
  pronta: (p: Page) => Promise<void>;
  /** La TV si guarda da lontano e non si tocca: niente regole di tocco e testo minimo. */
  tv?: boolean;
  /** Prima di aprire la pagina (per esempio risposte finte di un servizio che il server di prova non ha acceso). */
  prima?: (p: Page) => Promise<void>;
}

// Eliminacode vive nel secondo server (Schermo + Eliminacode, porta PORTA_DUE): TV affiancata allo Schermo vero.
const DUE = `http://127.0.0.1:${PORTA_DUE}`;
async function affianca(p: Page) {
  const n = await (await p.request.get(`${DUE}/api/negozio`)).json();
  delete n.servizi;
  await p.request.put(`${DUE}/api/negozio`, { data: { ...n, disposizione: "affiancato" }, headers: { "X-Token": TOKEN } });
  await p.request.post(`${DUE}/api/eliminacode/azione`, { data: { azione: "azzera", banco: 0 }, headers: { "X-Token": TOKEN } });
  await p.request.post(`${DUE}/api/eliminacode/azione`, { data: { azione: "prossimo", banco: 0 }, headers: { "X-Token": TOKEN } });
}
// Risposta pubblica della Vetrina con dati finti, lunghi quanto serve a mettere alla prova il layout.
const VETRINA_FINTA = {
  storia: { anno: 1987, testo: "Dal 1987 facciamo il pane la mattina presto, con lievito madre e farine macinate a pietra. ".repeat(3) },
  orari: [{ giorni: [1, 2, 3, 4, 5, 6], da: "07:00", a: "19:30" }],
  contatti: { indirizzo: "Via Esempio 12, 00100 Roma (RM)", telefono: "+39 06 0000 0000", email: "ciao@panificio-esempio.example" },
  linkMenu: "/menu.html",
  mappe: { google: "https://www.google.com/maps/search/?api=1&query=Via+Esempio+12", osm: "https://www.openstreetmap.org/search?query=Via+Esempio+12" },
  qr: [{ id: "recensione", titolo: "Ti è piaciuto?", sotto: "Inquadra", testo: "https://search.google.com/local/writereview?placeid=ChIJ-esempio_FINTO123" }],
  recensioni: {
    fonte: "finte",
    voto: 4.6,
    totale: 128,
    elenco: [
      { autore: "Anna Esempio", voto: 5, testo: "Il pane migliore del quartiere, la focaccia è una meraviglia e il personale è gentilissimo ogni mattina.", quando: "2 settimane fa" },
      { autore: "Marco Finto", voto: 3, testo: "Buono ma c'era troppa fila alle otto.", quando: "un mese fa" },
      { autore: "Luisa Demo", voto: 4, testo: "", quando: "2 mesi fa" },
    ],
  },
  secondiPerSlide: 10,
};

const PAGINE: Record<string, Pagina[]> = {
  "player.html": [
    { url: "/player.html", tv: true, pronta: (p) => expect(p.locator("#titolo")).not.toHaveText("") },
    {
      url: `${DUE}/player.html`,
      tv: true,
      pronta: async (p) => {
        await affianca(p);
        await p.reload();
        await expect(p.locator(".eq-numero")).toHaveText("1");
      },
    },
  ],
  "panel.html": [
    { url: `/panel.html#t=${TOKEN}`, pronta: (p) => expect(p.locator("#offerte li")).toHaveCount(5) },
    { url: `${DUE}/panel.html#t=${TOKEN}`, pronta: (p) => expect(p.locator(".eq-prossimo")).toBeEnabled() },
  ],
  "sito.html": [
    {
      url: "/sito.html",
      prima: async (p) => {
        await p.route("**/api/vetrina/sito", (r) => r.fulfill({ json: VETRINA_FINTA }));
      },
      pronta: (p) => expect(p.locator("#rec-elenco li")).toHaveCount(3),
    },
  ],
  // il kit proposta con tutti i servizi che mostra (qui finti: il server di prova ha solo lo Schermo), una voce per sezione
  "proposta.html": ["sito", "tv", "cartello", "volantino"].map((s) => ({
    url: `/proposta.html#${s}`,
    prima: async (p: Page) => {
      await p.route("**/api/negozio", async (r) => r.fulfill({ json: { ...(await (await r.fetch()).json()), servizi: ["schermo", "vetrina", "menu-qr"] } }));
      await p.route("**/api/vetrina/sito", (r) => r.fulfill({ json: VETRINA_FINTA }));
    },
    pronta: async (p: Page) => {
      await expect(p.locator("body")).toHaveAttribute("data-pronto", "1");
      await expect(p.locator(`#sez-${s}`)).toBeVisible();
    },
  })),
  "menu.html": [{ url: "/menu.html", pronta: (p) => expect(p.locator("body")).toHaveAttribute("data-pronto", "1") }],
  "admin.html": ["panoramica", "clienti", "servizi"].map((s) => ({
    url: `/admin.html#${s}`,
    pronta: (p: Page) => expect(p.locator("body")).toHaveAttribute("data-pronto", "1"),
  })),
};
const MISURE = { "telefono-320": { width: 320, height: 640 }, "iphone-xr": { width: 414, height: 896 }, ipad: { width: 820, height: 1180 }, mac: { width: 1440, height: 900 } };
const TV = { "tv-1080": { width: 1920, height: 1080 } };

/**
 * Disallineamenti NOTI delle regole di layout, per pagina: ognuno ha una voce D in TASKLIST. Può solo calare:
 * un problema nuovo fa fallire il test, uno corretto va tolto da qui (altrimenti fallisce lo stesso).
 */
const NOTI: Record<string, string[]> = {};

test("ogni pagina di public/ è coperta da questo test", () => {
  expect(readdirSync("public").filter((f) => f.endsWith(".html")).sort()).toEqual(Object.keys(PAGINE).sort());
});

test.beforeEach(async ({ request }) => imposta(request));

async function controlla(page: Page, tv: boolean, chiave: string) {
  const r = await page.evaluate((tv) => {
    const out: string[] = [];
    const visibili = [...document.querySelectorAll<HTMLElement>("body *")].filter((e) => e.offsetParent || getComputedStyle(e).position === "fixed");
    if (document.documentElement.scrollWidth > innerWidth) out.push(`scroll orizzontale ${document.documentElement.scrollWidth} > ${innerWidth}`);
    for (const e of visibili) {
      const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX === "visible" && e.clientWidth > 0 && !["SPAN", "svg"].includes(e.tagName))
        out.push(`deborda: <${e.tagName.toLowerCase()} class="${e.className}"> ${e.textContent?.trim().slice(0, 30)}`);
      if (tv) continue;
      const toccabile = e.matches("button, a[href], input:not([type=checkbox]), select, .interruttore-zona");
      const b = e.getBoundingClientRect();
      if (toccabile && b.width > 0 && (b.height < 48 || b.width < 48)) out.push(`tocco piccolo ${Math.round(b.width)}×${Math.round(b.height)}: ${e.textContent?.trim().slice(0, 30) || e.className}`);
      const haTesto = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (haTesto && parseFloat(cs.fontSize) < 15) out.push(`testo piccolo ${cs.fontSize}: ${e.textContent?.trim().slice(0, 30)}`);
    }
    return out;
  }, tv);
  const noti = NOTI[chiave] ?? [];
  expect(r.filter((p) => !noti.includes(p)), "problemi nuovi").toEqual([]);
  expect(noti.filter((n) => !r.includes(n)), "corretti: toglili da NOTI e chiudi la voce D").toEqual([]);
}

for (const [file, pagine] of Object.entries(PAGINE))
  for (const pagina of pagine)
    for (const [nome, vista] of Object.entries(pagina.tv ? TV : MISURE))
      for (const schema of ["light", "dark"] as const)
        test(`${pagina.url.split("#")[0]}${pagina.url.includes("#") && (file === "admin.html" || file === "proposta.html") ? "#" + pagina.url.split("#")[1] : ""} · ${nome} · ${schema}`, async ({ page }) => {
          await page.setViewportSize(vista);
          await page.emulateMedia({ colorScheme: schema, reducedMotion: "reduce" });
          await page.clock.install({ time: file === "admin.html" ? new Date("2026-10-27T09:00:00Z") : MARTEDI_9 });
          await pagina.prima?.(page);
          await page.goto(pagina.url);
          await pagina.pronta(page);
          await controlla(page, !!pagina.tv, `${pagina.url.split("#t=")[0]} ${nome} ${schema}`);
          const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
          expect(a.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
        });

// "Niente salti": cambiare la voce attiva di un menu cambia colore o sfondo, mai la posizione o la larghezza delle voci.
for (const [nome, vista] of Object.entries(MISURE))
  test(`menu: le voci non si muovono cambiando sezione · ${nome}`, async ({ page }) => {
    await page.setViewportSize(vista);
    await page.clock.install({ time: new Date("2026-10-27T09:00:00Z") });
    await page.goto("/admin.html");
    await expect(page.locator("body")).toHaveAttribute("data-pronto", "1");
    const voci = page.locator("nav a");
    const posizioni = async () =>
      voci.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }));
    const prima = await posizioni();
    for (let i = 0; i < (await voci.count()); i++) {
      await voci.nth(i).click();
      await expect(voci.nth(i)).toHaveAttribute("aria-current", "page");
      expect(await posizioni(), `dopo aver scelto la voce ${i + 1}`).toEqual(prima);
    }
  });
