// Dati dell'Eliminacode di un cliente (servizi/eliminacode.json): quanti banchi ci sono e a che numero siamo.
export const NUMERO_MAX = 999;
export const BANCHI_MAX = 4;

export interface DatiEliminacode {
  versione: 1;
  /** Nomi dei banchi (1–4): con un banco solo la TV non lo scrive. */
  banchi: string[];
  /** Ultimo numero chiamato: 0 = nessuno ancora. Dopo NUMERO_MAX si riparte da 1. */
  numero: number;
  /** Posizione (in `banchi`) del banco che ha chiamato l'ultimo numero. */
  banco: number;
  /** Coda viva (A138): numeri chiamati prima, dal più recente (al massimo STORICO_MAX). */
  storico?: number[];
  /** Istanti (ms) degli ultimi CHIAMATE_MAX «Prossimo»: danno il ritmo. */
  chiamate?: number[];
  /** Quanti «Prossimo» oggi (giorno di Europe/Rome, AAAA-MM-GG). */
  oggi?: { giorno: string; serviti: number };
}

export const STORICO_MAX = 3;
export const CHIAMATE_MAX = 5;
/** Il ritmo si mostra solo con chiamate più recenti di così: una coda ferma non ha ritmo. */
export const RITMO_FINESTRA_MS = 30 * 60_000;

export type Azione = "prossimo" | "indietro" | "azzera";
export const AZIONI: readonly Azione[] = ["prossimo", "indietro", "azzera"];

export const ROTTA = "/api/eliminacode";

/** Il testo che si legge a voce: "Tocca al numero 42, Banco 2". */
export function descrivi(d: DatiEliminacode): string {
  if (d.numero === 0) return "Nessun numero chiamato";
  return `Tocca al numero ${d.numero}` + (d.banchi.length > 1 ? `, ${d.banchi[d.banco]}` : "");
}
