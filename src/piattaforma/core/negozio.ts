// Il negozio è uno per cliente e vale per tutti i servizi: nome, logo, colori, tema e QR si impostano una volta.
import { problemiColori } from "./colori.ts";
import { SERVIZI, type IdServizio } from "./servizi.ts";
import { QR_TESTO_MAX, urlQrValido } from "./qr.ts";
import type { Fascia } from "./orario.ts";

export interface Colori {
  primario: string;
  accento: string;
  sfondo: string;
  testo: string;
}

export const TEMI = ["natale", "pasqua", "estate", "saldi", "blackfriday"] as const;
export type Tema = (typeof TEMI)[number];

/** Varianti di palette di un tema (A9): la prima voce, senza nome salvato, è la palette base ("Classico"). */
export const VARIANTI_TEMA = { natale: ["elegante", "nordico", "caldo"] } as const satisfies Partial<Record<Tema, readonly string[]>>;
export type VarianteTema = (typeof VARIANTI_TEMA)[keyof typeof VARIANTI_TEMA][number];
export const variantiDi = (tema: Tema | undefined): readonly VarianteTema[] =>
  (tema && (VARIANTI_TEMA as Partial<Record<Tema, readonly VarianteTema[]>>)[tema]) || [];

/** Le scelte del tema (A9): quale, con quale palette e se tiene i colori del negozio. */
export interface SceltaTema {
  /** Tema stagionale: senza, i colori del negozio. */
  tema?: Tema;
  /** Variante della palette del tema (solo i temi in VARIANTI_TEMA); senza, la palette base. */
  temaVariante?: VarianteTema;
  /** "negozio" = decorazioni del tema (neve, bordi, font) sopra i colori del negozio invece della palette del tema. */
  temaColori?: "negozio";
}

/** Solo le scelte del tema impostate: si salvano e si copiano senza perderne nessuna. */
export function sceltaTema(x: SceltaTema): SceltaTema {
  return {
    ...(x.tema ? { tema: x.tema } : {}),
    ...(x.temaVariante && variantiDi(x.tema).includes(x.temaVariante) ? { temaVariante: x.temaVariante } : {}),
    ...(x.temaColori === "negozio" ? { temaColori: "negozio" as const } : {}),
  };
}

/** Come la TV ospita più servizi: uno per volta a schermo intero (a rotazione) o uno accanto all'altro. */
export const DISPOSIZIONI = ["intero", "affiancato"] as const;
export type Disposizione = (typeof DISPOSIZIONI)[number];

/** Barra in alto o in basso sulla TV (orologio, orari, meteo); la prima è la "Consigliata", usata se non si sceglie. */
export const POSIZIONI_BARRA = ["sopra", "sotto", "nascosta"] as const;
export const BARRA_CONSIGLIATA = POSIZIONI_BARRA[0];
export type PosizioneBarra = (typeof POSIZIONI_BARRA)[number];
export const BARRA_TESTO_MAX = 200;
export const CITTA_NOME_MAX = 60;

export interface Citta {
  nome: string;
  lat: number;
  lon: number;
}

export interface Negozio {
  nome: string;
  logo?: string;
  colori: Colori;
  /** Colori del marchio messi da noi all'avvio: "Torna ai colori del negozio". */
  marchio?: Colori;
  /** Il negoziante ha scelto lo stesso colori che si leggono male ("Usa lo stesso"). */
  contrastoLibero?: boolean;
  /** QR nell'angolo della TV (recensioni, menu, Wi-Fi…): solo https. */
  qr?: { url: string; testo: string };
  /** Orari di apertura (ora di Roma): la barra della TV dice "aperto fino alle…" / "apre alle…". */
  orari?: Fascia[];
  /** Città del meteo nella barra (nome + coordinate, trovate dal server): senza, niente meteo. */
  citta?: Citta;
  /** Barra della TV: dove sta (senza, "sotto") e il testo che scorre. */
  barra?: { posizione?: PosizioneBarra; testo?: string };
}

/** Il file negozio.json di un cliente. */
export interface DatiNegozio extends SceltaTema {
  versione: 1;
  negozio: Negozio;
  /** Senza, "intero". Conta solo con due o più servizi sulla TV. */
  disposizione?: Disposizione;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
// Niente SVG: può contenere script e verrebbe servito dalla stessa origine del pannello.
export const LOGO = /^[a-z0-9][a-z0-9._-]{0,60}\.(png|jpe?g|webp)$/;

export const oggetto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function testo(x: unknown, min: number, max: number): x is string {
  return typeof x === "string" && x.trim().length >= min && x.length <= max;
}

const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Una fascia oraria valida; se no aggiunge l'errore (con `dove` davanti) e dà false. */
export function validaFascia(f: unknown, dove: string, errori: string[]): f is Fascia {
  if (!oggetto(f)) return !errori.push(`${dove}: fascia non valida`);
  const giorni = f.giorni;
  if (!Array.isArray(giorni) || !giorni.length || !giorni.every((g) => Number.isInteger(g) && g >= 1 && g <= 7))
    errori.push(`${dove}: giorni da 1 (lunedì) a 7 (domenica)`);
  if (typeof f.da !== "string" || !ORA.test(f.da) || typeof f.a !== "string" || !ORA.test(f.a))
    errori.push(`${dove}: orari nel formato HH:MM`);
  else if (f.da === f.a) errori.push(`${dove}: inizio e fine uguali`);
  return true;
}

export function erroriCitta(c: unknown): string[] {
  if (!oggetto(c) || !testo(c.nome, 1, CITTA_NOME_MAX)) return ["Città: nome da 1 a 60 caratteri"];
  const ok = (x: unknown, max: number) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= max;
  return ok(c.lat, 90) && ok(c.lon, 180) ? [] : ["Città: coordinate non valide"];
}

function erroriBarra(b: unknown): string[] {
  if (!oggetto(b)) return ["Barra non valida"];
  const out: string[] = [];
  if (b.posizione !== undefined && !(POSIZIONI_BARRA as readonly unknown[]).includes(b.posizione)) out.push(`Barra: una tra ${POSIZIONI_BARRA.join(", ")}`);
  if (b.testo !== undefined && !testo(b.testo, 1, BARRA_TESTO_MAX)) out.push(`Barra: testo da 1 a ${BARRA_TESTO_MAX} caratteri`);
  return out;
}

const quattroColori = (c: unknown): c is Colori =>
  oggetto(c) && ["primario", "accento", "sfondo", "testo"].every((k) => typeof c[k] === "string" && HEX.test(c[k] as string));

export const erroriTema = (tema: unknown): string[] =>
  tema === undefined || (TEMI as readonly unknown[]).includes(tema) ? [] : [`Tema: uno tra ${TEMI.join(", ")}`];

/** Errori di tema, variante e colori del tema. */
export const erroriSceltaTema = (x: Record<string, unknown>): string[] => [
  ...erroriTema(x.tema),
  ...(x.temaVariante === undefined || (variantiDi(erroriTema(x.tema).length ? undefined : (x.tema as Tema | undefined)) as readonly unknown[]).includes(x.temaVariante)
    ? []
    : ["Variante del tema: non esiste per questo tema"]),
  ...(x.temaColori === undefined || x.temaColori === "negozio" ? [] : ["Colori del tema: scelta non valida"]),
];

export const erroriDisposizione = (d: unknown): string[] =>
  d === undefined || (DISPOSIZIONI as readonly unknown[]).includes(d) ? [] : [`Disposizione: una tra ${DISPOSIZIONI.join(", ")}`];

/** Errori del negozio, con le parole del negoziante; vuoto = valido. */
export function erroriNegozio(n: unknown): string[] {
  const errori: string[] = [];
  if (!oggetto(n)) errori.push("Negozio mancante");
  else {
    if (!testo(n.nome, 1, 60)) errori.push("Nome del negozio da 1 a 60 caratteri");
    if (n.logo !== undefined && (typeof n.logo !== "string" || !LOGO.test(n.logo)))
      errori.push("Logo: solo file png, jpg o webp con nome semplice");
    if (n.qr !== undefined) {
      const q = n.qr;
      if (!oggetto(q) || !urlQrValido(q.url)) errori.push("QR: serve un indirizzo completo che inizia con https://");
      else if (!testo(q.testo, 1, QR_TESTO_MAX)) errori.push(`QR: scritta da 1 a ${QR_TESTO_MAX} caratteri`);
    }
    if (n.orari !== undefined) {
      if (!Array.isArray(n.orari) || n.orari.length > 10) errori.push("Orari: da 0 a 10 fasce");
      else n.orari.forEach((f, i) => validaFascia(f, `Orari, fascia ${i + 1}`, errori));
    }
    if (n.citta !== undefined) errori.push(...erroriCitta(n.citta));
    if (n.barra !== undefined) errori.push(...erroriBarra(n.barra));
    if (!quattroColori(n.colori)) errori.push("Colori: quattro colori nel formato #rrggbb");
    // si legge male: si accetta solo se il negoziante l'ha scelto apposta ("Usa lo stesso")
    else if (n.contrastoLibero !== true) errori.push(...problemiColori(n.colori).map((p) => `Colori: ${p}`));
    if (n.contrastoLibero !== undefined && typeof n.contrastoLibero !== "boolean") errori.push("Colori: scelta non valida");
    if (n.marchio !== undefined && !quattroColori(n.marchio)) errori.push("Colori del negozio: quattro colori nel formato #rrggbb");
  }
  return errori;
}

export function validaNegozio(x: unknown): { ok: true; dati: DatiNegozio } | { ok: false; errori: string[] } {
  if (!oggetto(x) || x.versione !== 1) return { ok: false, errori: ["Negozio non valido (versione)"] };
  const errori = [...erroriNegozio(x.negozio), ...erroriSceltaTema(x), ...erroriDisposizione(x.disposizione)];
  return errori.length ? { ok: false, errori } : { ok: true, dati: x as unknown as DatiNegozio };
}

/** Cosa risponde /api/negozio: il negozio più i servizi attivi per il cliente (la TV e il pannello montano solo quelli). */
export interface RispostaNegozio extends DatiNegozio {
  servizi: IdServizio[];
  /** Indirizzo del server raggiungibile dal telefono (per i QR predefiniti), se il server lo conosce. */
  origineTelefono?: string;
}

export function validaRispostaNegozio(x: unknown): { ok: true; dati: RispostaNegozio } | { ok: false; errori: string[] } {
  const n = validaNegozio(x);
  if (!n.ok) return n;
  const noti = new Set<unknown>(SERVIZI.map((s) => s.id));
  const servizi = (x as Record<string, unknown>).servizi;
  if (!Array.isArray(servizi) || !servizi.every((i) => noti.has(i))) return { ok: false, errori: ["Servizi non validi"] };
  const o = (x as Record<string, unknown>).origineTelefono;
  if (o !== undefined && (typeof o !== "string" || !/^https?:\/\/[^\s/]+$/.test(o))) return { ok: false, errori: ["Indirizzo per il telefono non valido"] };
  return { ok: true, dati: x as RispostaNegozio };
}
