// A101 Analisi gratuita della presenza online di un negozio → materiali/out/analisi-<nome>.pdf, una pagina.
//   npm run analisi -- --place <Place ID di Google> [--sito https://…]
// Chiave Google: GOOGLE_PLACES_API_KEY nell'ambiente (mai negli argomenti, mai nel PDF o nel log). Senza chiave: un
// negozio DI ESEMPIO, scritto così nel PDF. Il sito si misura dal nostro computer, su un telefono simulato.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser } from "@playwright/test";
import { dataLocale } from "../src/piattaforma/core/orario.ts";
import { PLACE_ID } from "../src/servizi/vetrina/core/valida.ts";
import { leggiProfilo, PROFILO_ESEMPIO, valuta, type Profilo, type Sito } from "./analisi/core.ts";

const radice = resolve(import.meta.dirname, "..");
const OUT = join(radice, "materiali", "out");
const CAMPI = "displayName,primaryType,primaryTypeDisplayName,regularOpeningHours,photos,rating,userRatingCount,websiteUri";

export async function profilo(placeId: string, chiave: string | undefined, f: typeof fetch = fetch): Promise<Profilo> {
  if (!chiave) return PROFILO_ESEMPIO;
  if (!PLACE_ID.test(placeId)) throw new Error("Place ID non valido");
  const r = await f(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=it`, {
    headers: { "X-Goog-Api-Key": chiave, "X-Goog-FieldMask": CAMPI },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`Google ha risposto ${r.status}`);
  const p = leggiProfilo(await r.json());
  if (!p) throw new Error("risposta di Google non riconosciuta");
  return p;
}

/** Apre il sito come un telefono: si legge senza zoom? quanto ci mette? axe trova problemi? */
export async function misuraSito(browser: Browser, indirizzo: string): Promise<Sito> {
  const sito: Sito = { indirizzo, raggiunto: false, mobile: false, lcpMs: null, problemi: 0, contrasto: 0 };
  if (!/^https?:\/\//.test(indirizzo)) return sito;
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: "it-IT" });
  try {
    const page = await ctx.newPage();
    const r = await page.goto(indirizzo, { waitUntil: "load", timeout: 20_000 });
    if (!r || !r.ok()) return sito;
    sito.raggiunto = true;
    sito.lcpMs = await page.evaluate(
      () =>
        new Promise<number | null>((ok) => {
          let v: number | null = null;
          new PerformanceObserver((l) => l.getEntries().forEach((e) => (v = Math.round(e.startTime)))).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => ok(v), 500);
        }),
    );
    sito.mobile = await page.evaluate(
      () => /width=device-width/.test(document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "") && document.documentElement.scrollWidth <= innerWidth + 1,
    );
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    sito.problemi = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").length;
    sito.contrasto = axe.violations.find((v) => v.id === "color-contrast")?.nodes.length ?? 0;
  } catch {
    // irraggiungibile o troppo lento: resta "non raggiunto"
  } finally {
    await ctx.close();
  }
  return sito;
}

const SEGNO = { bene: "✓ Bene", migliorabile: "! Da migliorare", manca: "✗ Manca" } as const;

/** Impagina il PDF dal modello materiali/analisi-a4.html; tutto il testo entra con textContent. */
export async function creaAnalisi(browser: Browser, p: Profilo, s: Sito | null, istante = Date.now()): Promise<string> {
  mkdirSync(OUT, { recursive: true });
  const agenzia = JSON.parse(readFileSync(join(radice, "materiali", "agenzia.json"), "utf8"));
  const { righe, mancanze } = valuta(p, s);
  const [a, m, g] = dataLocale(istante).split("-");
  const fonte = p.fonte === "esempio" ? "DATI DI ESEMPIO: negozio inventato, senza chiave Google." : `Dati pubblici di Google e del sito, letti il ${g}/${m}/${a}.`;
  copyFileSync(join(radice, "materiali", "analisi-a4.html"), join(OUT, "analisi-a4.html"));
  const page = await browser.newPage();
  try {
    await page.goto(`file://${join(OUT, "analisi-a4.html")}`);
    const dati = { nome: p.nome, fonte, agenzia: String(agenzia.nome ?? ""), contatto: String(agenzia.contatto ?? ""), righe: righe.map((r) => ({ ...r, segno: SEGNO[r.esito] })), mancanze };
    await page.evaluate((d) => {
      for (const k of ["nome", "fonte", "agenzia", "contatto"] as const) document.querySelector(`[data-campo=${k}]`)!.textContent = d[k];
      const corpo = document.querySelector("#voci")!;
      for (const r of d.righe) {
        const tr = corpo.appendChild(document.createElement("tr"));
        tr.className = r.esito;
        for (const t of [r.voce, r.segno, r.testo]) tr.appendChild(document.createElement("td")).textContent = t;
      }
      const lista = document.querySelector("#mancanze")!;
      for (const t of d.mancanze) lista.appendChild(document.createElement("li")).textContent = t;
    }, dati);
    const nome = p.nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "negozio";
    const pdf = join(OUT, `analisi-${nome}.pdf`);
    await page.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });
    return pdf;
  } finally {
    await page.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { place: { type: "string", default: "" }, sito: { type: "string" } } });
  const p = await profilo(values.place, process.env.GOOGLE_PLACES_API_KEY);
  const browser = await chromium.launch();
  try {
    const indirizzo = values.sito ?? p.sito;
    const s = indirizzo ? await misuraSito(browser, indirizzo) : null;
    console.log(`✅ ${await creaAnalisi(browser, p, s)}`);
  } finally {
    await browser.close();
  }
}
