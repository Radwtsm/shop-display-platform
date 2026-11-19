// Prepara la demo per un negozio prima di una visita: nome, colori, logo, offerte.
//   npm run personalizza -- --modello bar --nome "Bar Esempio" --primario "#123456" --logo ~/Desktop/logo.png \
//     --offerta "Cappuccino|1,40" --offerta "Brioche|1,20|appena sfornate"
// Con --logo e nessun colore scritto, i colori si prendono dal logo (colorePrincipale → daUnColore).
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, closeSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Browser } from "@playwright/test";
import { colorePrincipale, daUnColore } from "../../piattaforma/core/colori.ts";
import { controllaFoto } from "../../piattaforma/core/foto.ts";
import { leggi } from "../../piattaforma/core/prezzo.ts";
import type { Config, Slide } from "./core/tipi.ts";
import { valida } from "./core/valida.ts";
import { Archivio } from "../../piattaforma/server/archivio.ts";
import { migraConfigUnica, salvaVista } from "./server.ts";

export const LOGO_MAX = 2 * 1024 * 1024;
const radice = resolve(import.meta.dirname, "../../..");

export const MODELLI = ["panificio", "bar", "parrucchiere", "farmacia"] as const;

export interface Opzioni {
  dataDir: string;
  /** Punto di partenza per settore (fixtures/modelli/); senza, la demo del panificio. */
  modello?: string;
  nome?: string;
  colori?: Partial<Config["negozio"]["colori"]>;
  logo?: string;
  offerte?: string[];
}

/** Tipo dell'immagine dai primi byte, non dal nome del file. */
export function tipoImmagine(file: string): "png" | "jpg" | "webp" | null {
  const b = Buffer.alloc(12);
  const fd = openSync(file, "r");
  try {
    readSync(fd, b, 0, 12, 0);
  } finally {
    closeSync(fd);
  }
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Pixel RGBA del logo (rimpicciolito a ≤ 160 px) letti dal browser: png, jpg e webp senza dipendenze in più. */
export async function pixelDelLogo(browser: Browser, file: string): Promise<number[]> {
  const tipo = tipoImmagine(file);
  if (!tipo) throw new Error("il file non è un'immagine png, jpg o webp");
  const url = `data:image/${tipo === "jpg" ? "jpeg" : tipo};base64,${readFileSync(file).toString("base64")}`;
  const pagina = await browser.newPage();
  try {
    return await pagina.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const k = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
      const tela = document.createElement("canvas");
      tela.width = Math.max(1, Math.round(img.naturalWidth * k));
      tela.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = tela.getContext("2d")!;
      ctx.drawImage(img, 0, 0, tela.width, tela.height);
      return Array.from(ctx.getImageData(0, 0, tela.width, tela.height).data);
    }, url);
  } finally {
    await pagina.close();
  }
}

/** Colori della TV dal logo; null se il logo non ha un colore vivo (si tengono quelli del modello). */
export async function coloriDalLogo(browser: Browser, file: string): Promise<Config["negozio"]["colori"] | null> {
  const c = colorePrincipale(await pixelDelLogo(browser, file));
  return c ? daUnColore(c) : null;
}

export function offerta(testo: string, i: number): Slide | string {
  const [titolo = "", prezzo = "", nota = ""] = testo.split("|").map((x) => x.trim());
  const s: Slide = { id: `offerta-${i + 1}`, titolo, attiva: true };
  if (prezzo) {
    const c = leggi(prezzo);
    if (c === null) return `Offerta ${i + 1}: prezzo "${prezzo}" non valido (es. 2,50)`;
    s.prezzo = c;
  }
  if (nota) s.nota = nota;
  return s;
}

/** Scrive negozio e Schermo del cliente demo (+ logo e foto) solo se tutto è valido; altrimenti restituisce gli errori e non tocca nulla. */
export function personalizza(o: Opzioni): { ok: true; config: Config } | { ok: false; errori: string[] } {
  const errori: string[] = [];
  if (o.modello !== undefined && !(MODELLI as readonly string[]).includes(o.modello))
    return { ok: false, errori: [`Modello "${o.modello}" sconosciuto: ${MODELLI.join(", ")}`] };
  const base = o.modello ? `fixtures/modelli/${o.modello}.json` : "fixtures/demo.json";
  const c = JSON.parse(readFileSync(join(radice, base), "utf8")) as Config;
  if (o.nome !== undefined) c.negozio.nome = o.nome.trim();
  Object.assign(c.negozio.colori, Object.fromEntries(Object.entries(o.colori ?? {}).filter(([, v]) => v)));
  c.negozio.marchio = { ...c.negozio.colori }; // "Torna ai colori del negozio" nel pannello
  let tipo: string | null = null;
  if (o.logo) {
    try {
      if (statSync(o.logo).size > LOGO_MAX) errori.push("Logo: massimo 2 MB");
      else if (!(tipo = tipoImmagine(o.logo))) errori.push("Logo: il file non è un'immagine png, jpg o webp");
      else c.negozio.logo = `logo.${tipo}`;
    } catch {
      errori.push(`Logo: file non trovato (${o.logo})`);
    }
  }
  if (o.offerte?.length) {
    const lette = o.offerte.map(offerta);
    errori.push(...lette.filter((x): x is string => typeof x === "string"));
    c.slides = lette.filter((x): x is Slide => typeof x !== "string");
  }
  // foto "tipo" del modello (fixtures/foto-demo): solo per le offerte del modello, non per quelle scritte a mano
  const foto: [string, string][] = [];
  if (!o.offerte?.length) {
    const mappa = JSON.parse(readFileSync(join(radice, "fixtures/foto-demo/foto.json"), "utf8")) as Record<string, Record<string, string>>;
    for (const s of c.slides) {
      const file = mappa[o.modello ?? "panificio"]?.[s.id];
      if (!file) continue;
      const percorso = join(radice, "fixtures/foto-demo", file);
      const b = existsSync(percorso) ? readFileSync(percorso) : Buffer.alloc(0);
      const esito = controllaFoto(b);
      if (!esito.ok) {
        errori.push(`Foto demo ${file}: ${esito.errore}`);
        continue;
      }
      s.foto = `${createHash("sha256").update(b).digest("hex").slice(0, 16)}.${esito.tipo}`;
      foto.push([percorso, s.foto]);
    }
  }
  const e = valida(c);
  if (!e.ok) errori.push(...e.errori);
  if (errori.length) return { ok: false, errori };
  const cliente = new Archivio(o.dataDir).cliente("demo");
  migraConfigUnica(o.dataDir, cliente);
  mkdirSync(cliente.logo, { recursive: true, mode: 0o700 });
  if (o.logo && tipo) copyFileSync(o.logo, join(cliente.logo, `logo.${tipo}`));
  mkdirSync(cliente.foto, { recursive: true, mode: 0o700 });
  for (const [da, nome] of foto) copyFileSync(da, join(cliente.foto, nome));
  salvaVista(cliente, c);
  if (!cliente.esiste()) cliente.scrivi("cliente", JSON.stringify({ versione: 1, servizi: ["schermo"] }, null, 2));
  return { ok: true, config: c };
}

if (import.meta.main) {
  const { values: v } = parseArgs({
    options: {
      modello: { type: "string" },
      nome: { type: "string" },
      primario: { type: "string" },
      accento: { type: "string" },
      sfondo: { type: "string" },
      testo: { type: "string" },
      logo: { type: "string" },
      offerta: { type: "string", multiple: true },
      data: { type: "string", default: join(radice, "data") },
    },
  });
  let colori: Opzioni["colori"] = { primario: v.primario, accento: v.accento, sfondo: v.sfondo, testo: v.testo };
  const scritti = Object.values(colori).some(Boolean);
  if (v.logo && !scritti && existsSync(v.logo) && statSync(v.logo).size <= LOGO_MAX && tipoImmagine(v.logo)) {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const dalLogo = await coloriDalLogo(browser, v.logo);
      if (dalLogo) {
        colori = dalLogo;
        console.log(`🎨 Colori presi dal logo: barra ${dalLogo.primario}, prezzi ${dalLogo.accento} (per cambiarli: --primario "#…")`);
      } else console.log("🎨 Il logo non ha un colore vivo: tengo i colori del modello (per sceglierli: --primario \"#…\")");
    } finally {
      await browser.close();
    }
  }
  const r = personalizza({
    dataDir: resolve(v.data!),
    modello: v.modello,
    nome: v.nome,
    colori,
    logo: v.logo,
    offerte: v.offerta,
  });
  if (!r.ok) {
    console.error("Niente cambiato:\n- " + r.errori.join("\n- "));
    process.exit(1);
  }
  console.log(`✅ Demo pronta per "${r.config.negozio.nome}" (${r.config.slides.length} offerte). Avvia: npm start (con sito, menu e kit proposta: npm run proposta)`);
}
