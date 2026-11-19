// Barra della TV (comune a tutti i servizi): cosa dice, calcolato solo dall'orologio e dai dati: senza DOM né rete.
import { minuti, oraLocale, type Fascia } from "./orario.ts";
import { BARRA_CONSIGLIATA, type PosizioneBarra } from "./negozio.ts";

/** Posizione in uso: quella scelta, altrimenti la consigliata (sopra, accanto al nome: A136). */
export const posizioneBarra = (p: PosizioneBarra | undefined): PosizioneBarra => p ?? BARRA_CONSIGLIATA;

const GIORNI = ["", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** "12:05" nell'ora di Roma. */
export const orologio = (istante: number): string => hhmm(oraLocale(istante).minuti);

/**
 * Lo stato del negozio in parole: "Aperto fino alle 19:30", "Chiuso · apre alle 16:00", "Chiuso · apre domani alle
 * 08:00". Senza orari non dice niente (stringa vuota). Le fasce attaccate (08–13 e 13–19) contano come una.
 */
export function statoOrari(fasce: Fascia[] | undefined, istante: number): string {
  if (!fasce?.length) return "";
  const SETT = 7 * 1440;
  const { giorno, minuti: m } = oraLocale(istante);
  const t = (giorno - 1) * 1440 + m;
  // intervalli in minuti dall'inizio della settimana (lunedì 00:00), copiati ±1 settimana per le fasce che la scavalcano
  const interv: [number, number][] = [];
  for (const f of fasce)
    for (const g of f.giorni) {
      const da = (g - 1) * 1440 + minuti(f.da);
      const durata = (minuti(f.a) - minuti(f.da) + 1440) % 1440 || 1440;
      for (const k of [-SETT, 0, SETT]) interv.push([da + k, da + k + durata]);
    }
  interv.sort((x, y) => x[0] - y[0]);
  // fasce attaccate o sovrapposte = una sola
  const uniti: [number, number][] = [];
  for (const i of interv) {
    const u = uniti[uniti.length - 1];
    if (u && i[0] <= u[1]) u[1] = Math.max(u[1], i[1]);
    else uniti.push([...i]);
  }
  const dentro = uniti.find(([s, e]) => s <= t && t < e);
  if (dentro) return dentro[1] - dentro[0] >= SETT ? "Aperto" : `Aperto fino alle ${hhmm(dentro[1] % 1440)}`;
  const prossimo = uniti.find(([s]) => s > t);
  if (!prossimo) return "Chiuso";
  const giorni = Math.floor(prossimo[0] / 1440) - Math.floor(t / 1440);
  const quando = giorni === 0 ? "" : giorni === 1 ? "domani " : `${GIORNI[((giorno - 1 + giorni) % 7) + 1]} `;
  return `Chiuso · apre ${quando}alle ${hhmm(prossimo[0] % 1440)}`;
}

export const TESTO_PAGINA_CARATTERI = 44;
export const TESTO_PAGINA_SECONDI = 6;

/** Il testo diviso in pagine di parole intere (per chi ha "riduci movimento": niente scorrimento). */
export function paginaTesto(testo: string, istante: number, max = TESTO_PAGINA_CARATTERI, secondi = TESTO_PAGINA_SECONDI): string {
  const pagine: string[] = [];
  let corrente = "";
  for (const parola of testo.split(/\s+/).filter(Boolean)) {
    for (let p = parola; p; p = p.slice(max)) {
      const pezzo = p.slice(0, max);
      if (corrente && corrente.length + 1 + pezzo.length > max) {
        pagine.push(corrente);
        corrente = pezzo;
      } else corrente = corrente ? `${corrente} ${pezzo}` : pezzo;
    }
  }
  if (corrente) pagine.push(corrente);
  return pagine.length ? pagine[Math.floor(istante / 1000 / secondi) % pagine.length]! : "";
}

// ---- Meteo ----

/** Cosa risponde /api/meteo (dati di Open-Meteo, ripuliti dal server). */
export interface Meteo {
  temperatura: number;
  /** Codice WMO del tempo (0 sereno … 99 temporale). */
  codice: number;
  giorno: boolean;
  /** Quando il server l'ha avuto da Open-Meteo (ms). */
  aggiornato: number;
}

export const METEO_VECCHIO_MS = 3 * 3600_000;

export function validaMeteo(x: unknown): x is Meteo {
  if (typeof x !== "object" || x === null) return false;
  const m = x as Record<string, unknown>;
  return (
    typeof m.temperatura === "number" && Number.isFinite(m.temperatura) && m.temperatura >= -90 && m.temperatura <= 60 &&
    Number.isInteger(m.codice) && (m.codice as number) >= 0 && (m.codice as number) <= 99 &&
    typeof m.giorno === "boolean" && typeof m.aggiornato === "number" && Number.isFinite(m.aggiornato)
  );
}

export const ICONE_METEO = ["sole", "luna", "parziale", "nuvole", "nebbia", "pioggia", "neve", "temporale"] as const;
export type IconaMeteo = (typeof ICONE_METEO)[number];

/** Le icone sono nostre (sprite in public/player.html), una per famiglia di codici WMO. */
export function iconaMeteo(codice: number, giorno: boolean): IconaMeteo {
  if (codice === 0 || codice === 1) return giorno ? "sole" : "luna";
  if (codice === 2) return giorno ? "parziale" : "luna";
  if (codice === 3) return "nuvole";
  if (codice === 45 || codice === 48) return "nebbia";
  if ((codice >= 71 && codice <= 77) || codice === 85 || codice === 86) return "neve";
  if (codice >= 95) return "temporale";
  return "pioggia"; // 51–67 pioviggine e pioggia, 80–82 rovesci
}

/** "21°" (arrotondata; "-0" non esiste). */
export const gradi = (t: number): string => `${Math.round(t) || 0}°`;
