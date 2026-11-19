// A106 Resoconto prima/dopo del pilota: due "fotografie" dello stesso negozio (giorno 1 e oggi) → cosa è cambiato,
// voce per voce, in parole del negoziante. Puro: niente rete, niente browser, niente file (li fa scripts/resoconto.ts).
import { oggetto } from "../../src/piattaforma/core/negozio.ts";
import type { Profilo, Sito } from "../analisi/core.ts";

export const DATA = /^\d{4}-\d{2}-\d{2}$/;

export interface Fotografia {
  versione: 1;
  data: string; // AAAA-MM-GG, Europe/Rome
  profilo: Profilo;
  sito: Sito | null;
}

export type Verso = "meglio" | "uguale" | "peggio";
export interface Cambio {
  voce: string;
  prima: string;
  dopo: string;
  verso: Verso;
}

const virgola = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 });
const sino = (b: boolean) => (b ? "sì" : "no");
const verso = (d: number): Verso => (d > 0 ? "meglio" : d < 0 ? "peggio" : "uguale");

/** Una fotografia letta da file: null se non è nostra o è rotta (mai indovinare un numero). */
export function leggiFotografia(x: unknown): Fotografia | null {
  if (!oggetto(x) || x.versione !== 1 || typeof x.data !== "string" || !DATA.test(x.data)) return null;
  const p = x.profilo;
  if (!oggetto(p) || typeof p.nome !== "string" || typeof p.recensioni !== "number" || typeof p.foto !== "number") return null;
  if (typeof p.orari !== "boolean" || (p.media !== null && typeof p.media !== "number")) return null;
  const s = x.sito;
  if (s !== null && !(oggetto(s) && typeof s.raggiunto === "boolean" && typeof s.mobile === "boolean" && typeof s.problemi === "number" && typeof s.contrasto === "number")) return null;
  return x as unknown as Fotografia;
}

/** Giorni fra due date AAAA-MM-GG. */
export function giorni(da: string, a: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${da}T12:00:00Z`)) / 86_400_000);
}

/** Cosa è cambiato fra la prima e l'ultima fotografia, nell'ordine in cui interessa al negoziante. */
export function confronta(prima: Fotografia, dopo: Fotografia): Cambio[] {
  const a = prima.profilo;
  const b = dopo.profilo;
  const c: Cambio[] = [];
  const nuove = b.recensioni - a.recensioni;
  c.push({ voce: "Recensioni su Google", prima: String(a.recensioni), dopo: nuove > 0 ? `${b.recensioni} (+${nuove})` : String(b.recensioni), verso: verso(nuove) });
  const ma = a.media ?? 0;
  const mb = b.media ?? 0;
  // la media di Google ha un decimale: sotto 0,1 è rumore, non un cambio
  const dm = Math.abs(mb - ma) < 0.1 ? 0 : mb - ma;
  c.push({ voce: "Media delle stelle", prima: a.media === null ? "senza voto" : virgola(ma), dopo: b.media === null ? "senza voto" : virgola(mb), verso: verso(dm) });
  const foto = (n: number) => (n >= 10 ? "10 o più" : String(n));
  c.push({ voce: "Foto su Google", prima: foto(a.foto), dopo: foto(b.foto), verso: verso(Math.min(b.foto, 10) - Math.min(a.foto, 10)) });
  c.push({ voce: "Orari su Google", prima: sino(a.orari), dopo: sino(b.orari), verso: verso(Number(b.orari) - Number(a.orari)) });
  const sa = prima.sito?.raggiunto === true;
  const sb = dopo.sito?.raggiunto === true;
  c.push({ voce: "Sito raggiungibile", prima: sino(sa), dopo: sino(sb), verso: verso(Number(sb) - Number(sa)) });
  if (sa || sb) {
    const ma = sa && prima.sito!.mobile;
    const mb = sb && dopo.sito!.mobile;
    c.push({ voce: "Sito leggibile dal telefono", prima: sino(ma), dopo: sino(mb), verso: verso(Number(mb) - Number(ma)) });
    const pa = sa ? prima.sito!.problemi + prima.sito!.contrasto : null;
    const pb = sb ? dopo.sito!.problemi + dopo.sito!.contrasto : null;
    if (pa !== null && pb !== null) c.push({ voce: "Problemi di leggibilità del sito", prima: String(pa), dopo: String(pb), verso: verso(pa - pb) });
  }
  return c;
}

/** La frase in alto: il risultato più importante, detto in una riga. */
export function titolo(prima: Fotografia, dopo: Fotografia): string {
  const nuove = dopo.profilo.recensioni - prima.profilo.recensioni;
  const g = giorni(prima.data, dopo.data);
  if (nuove > 0) return `+${nuove} recensioni in ${g} giorni`;
  const meglio = confronta(prima, dopo).filter((x) => x.verso === "meglio").length;
  if (meglio === 1) return `1 cosa migliorata in ${g} giorni`;
  return meglio ? `${meglio} cose migliorate in ${g} giorni` : `Situazione dopo ${g} giorni`;
}

/** Senza chiave Google: due fotografie DI ESEMPIO, dichiarate tali nel PDF. */
export function esempio(profilo: Profilo): [Fotografia, Fotografia] {
  return [
    { versione: 1, data: "2026-10-01", profilo, sito: null },
    { versione: 1, data: "2026-10-31", profilo: { ...profilo, recensioni: profilo.recensioni + 14, media: 4.5, foto: 10 }, sito: null },
  ];
}
