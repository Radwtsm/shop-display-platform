// A106 Resoconto prima/dopo del pilota → materiali/out/resoconto-<nome>.pdf, una pagina.
//   npm run resoconto -- --cliente <id> --place <Place ID> [--sito https://…]     fotografia di oggi (il giorno 1 e a 30 giorni)
//   npm run resoconto -- --cliente <id> --pdf [--fatto "QR recensioni al banco" …] confronto fra la prima e l'ultima
// Le fotografie stanno nei dati del cliente (data/clienti/<id>/fotografie/, mai in git). Chiave Google come per
// l'analisi (GOOGLE_PLACES_API_KEY nell'ambiente); senza chiave: due fotografie DI ESEMPIO, scritto così nel PDF.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Browser } from "@playwright/test";
import { dataLocale } from "../src/piattaforma/core/orario.ts";
import { Archivio, type Cliente } from "../src/piattaforma/server/archivio.ts";
import { misuraSito, profilo } from "./analisi.ts";
import { confronta, esempio, leggiFotografia, titolo, type Fotografia } from "./resoconto/core.ts";

const radice = resolve(import.meta.dirname, "..");
const OUT = join(radice, "materiali", "out");

/** Tutte le fotografie valide del cliente, dalla più vecchia; quelle rotte si saltano (e si dice quante). */
export function fotografie(c: Cliente): { buone: Fotografia[]; rotte: number } {
  const buone: Fotografia[] = [];
  let rotte = 0;
  for (const testo of c.fotografie()) {
    let f: Fotografia | null = null;
    try {
      f = leggiFotografia(JSON.parse(testo));
    } catch {
      // resta null
    }
    if (f) buone.push(f);
    else rotte++;
  }
  return { buone: buone.sort((a, b) => a.data.localeCompare(b.data)), rotte };
}

export async function creaResoconto(browser: Browser, prima: Fotografia, dopo: Fotografia, fatto: string[], diEsempio: boolean): Promise<string> {
  mkdirSync(OUT, { recursive: true });
  const agenzia = JSON.parse(readFileSync(join(radice, "materiali", "agenzia.json"), "utf8"));
  const it = (d: string) => d.split("-").reverse().join("/");
  const fonte = diEsempio ? "DATI DI ESEMPIO: negozio inventato, senza chiave Google." : `Dati pubblici di Google e del sito, letti il ${it(prima.data)} e il ${it(dopo.data)}.`;
  copyFileSync(join(radice, "materiali", "resoconto-a4.html"), join(OUT, "resoconto-a4.html"));
  const page = await browser.newPage();
  try {
    await page.goto(`file://${join(OUT, "resoconto-a4.html")}`);
    const VERSO = { meglio: "▲ Meglio", uguale: "= Uguale", peggio: "▼ Peggio" } as const;
    const dati = {
      nome: dopo.profilo.nome,
      fonte,
      titolo: titolo(prima, dopo),
      dal: it(prima.data),
      al: it(dopo.data),
      agenzia: String(agenzia.nome ?? ""),
      contatto: String(agenzia.contatto ?? ""),
      righe: confronta(prima, dopo).map((c) => ({ ...c, segno: VERSO[c.verso] })),
      fatto,
    };
    await page.evaluate((d) => {
      for (const k of ["nome", "fonte", "titolo", "dal", "al", "agenzia", "contatto"] as const) document.querySelector(`[data-campo=${k}]`)!.textContent = d[k];
      const corpo = document.querySelector("#voci")!;
      for (const r of d.righe) {
        const tr = corpo.appendChild(document.createElement("tr"));
        tr.className = r.verso;
        for (const t of [r.voce, r.prima, r.dopo, r.segno]) tr.appendChild(document.createElement("td")).textContent = t;
      }
      const lista = document.querySelector("#fatto")!;
      if (!d.fatto.length) {
        lista.previousElementSibling!.remove();
        lista.remove();
      }
      for (const t of d.fatto) lista.appendChild(document.createElement("li")).textContent = t;
    }, dati);
    const nome = dopo.profilo.nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "negozio";
    const pdf = join(OUT, `resoconto-${nome}.pdf`);
    await page.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });
    return pdf;
  } finally {
    await page.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: v } = parseArgs({
    options: {
      cliente: { type: "string", default: "" },
      place: { type: "string", default: "" },
      sito: { type: "string" },
      pdf: { type: "boolean", default: false },
      fatto: { type: "string", multiple: true, default: [] },
      data: { type: "string", default: join(radice, "data") },
    },
  });
  const chiave = process.env.GOOGLE_PLACES_API_KEY;
  const browser = await chromium.launch();
  try {
    if (!chiave) {
      const [a, b] = esempio(await profilo("", undefined));
      console.log(`✅ ${await creaResoconto(browser, a, b, v.fatto!, true)} (DATI DI ESEMPIO: senza chiave Google)`);
    } else {
      const c = new Archivio(resolve(v.data!)).cliente(v.cliente!);
      if (v.pdf) {
        const { buone, rotte } = fotografie(c);
        if (rotte) console.error(`⚠️ ${rotte} fotografie illeggibili saltate`);
        if (buone.length < 2) throw new Error("servono due fotografie (il giorno 1 e oggi): prima npm run resoconto -- --cliente … --place …");
        console.log(`✅ ${await creaResoconto(browser, buone[0]!, buone.at(-1)!, v.fatto!, false)}`);
      } else {
        const p = await profilo(v.place!, chiave);
        const indirizzo = v.sito ?? p.sito;
        const f: Fotografia = { versione: 1, data: dataLocale(Date.now()), profilo: p, sito: indirizzo ? await misuraSito(browser, indirizzo) : null };
        c.salvaFotografia(f.data, JSON.stringify(f, null, 2));
        console.log(`✅ Fotografia del ${f.data} salvata per ${c.id}: ${p.recensioni} recensioni, media ${p.media ?? "—"}`);
      }
    }
  } finally {
    await browser.close();
  }
}
