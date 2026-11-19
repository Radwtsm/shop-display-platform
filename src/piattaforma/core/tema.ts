import { contrasto } from "./colori.ts";

export const MIN_TESTO = 4.5;

/** Sfondi del pannello su cui l'accento viene usato come testo e come riempimento dei bottoni. */
export const SFONDI_PANNELLO = {
  chiaro: ["#ffffff", "#f2f2f7"],
  scuro: ["#1c1c1e", "#000000"],
} as const;

export interface Accento {
  azione: string;
  suAzione: string;
}

/**
 * Il colore del marchio diventa l'accento del pannello solo dove si legge bene; altrimenti resta quello di
 * sistema (null). Il testo sopra il bottone è bianco o nero, quello che contrasta di più.
 */
export function accentoPannello(marchio: string): { chiaro: Accento | null; scuro: Accento | null } {
  const per = (sfondi: readonly string[]): Accento | null => {
    if (!sfondi.every((s) => contrasto(marchio, s) >= MIN_TESTO)) return null;
    const su = contrasto(marchio, "#ffffff") >= contrasto(marchio, "#000000") ? "#ffffff" : "#000000";
    return contrasto(marchio, su) >= MIN_TESTO ? { azione: marchio, suAzione: su } : null;
  };
  return { chiaro: per(SFONDI_PANNELLO.chiaro), scuro: per(SFONDI_PANNELLO.scuro) };
}
