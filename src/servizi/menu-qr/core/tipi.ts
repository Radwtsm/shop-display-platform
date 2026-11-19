import type { IdAllergene } from "./allergeni.ts";

export interface Categoria {
  id: string;
  nome: string;
}

export interface Piatto {
  id: string;
  nome: string;
  descrizione?: string;
  /** Centesimi interi. */
  prezzo: number;
  /** Id di una categoria del menu. */
  categoria: string;
  /**
   * I tra i 14 allergeni che contiene. `null` = non ancora indicati: mai letto come "nessuno" (il filtro
   * "senza X" non lo mostra, la pagina dice di chiedere al personale). `[]` = verificato, nessuno dei 14.
   */
  allergeni: IdAllergene[] | null;
  /**
   * Il giorno (data di Roma, "2026-11-06") in cui è stato segnato "finito oggi": vale solo quel giorno, poi torna
   * disponibile da solo (`finitoOggi`). Assente = disponibile. Resta nel menu, segnato.
   */
  finitoIl?: string;
}

/** Il file servizi/menu-qr.json di un cliente. */
export interface DatiMenu {
  versione: 1;
  categorie: Categoria[];
  piatti: Piatto[];
}

export const MAX_CATEGORIE = 20;
export const MAX_PIATTI = 200;
