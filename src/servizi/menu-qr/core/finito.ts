import { dataLocale } from "../../../piattaforma/core/orario.ts";
import type { Piatto } from "./tipi.ts";

/** Finito oggi = segnato oggi (data di Roma); da domani torna disponibile senza che nessuno lo tocchi. */
export function finitoOggi(p: Piatto, istante = Date.now()): boolean {
  return p.finitoIl === dataLocale(istante);
}

/** Il piatto segnato finito oggi (o di nuovo disponibile). */
export function segnaFinito(p: Piatto, finito: boolean, istante = Date.now()): Piatto {
  const { finitoIl: _, ...resto } = p;
  return finito ? { ...resto, finitoIl: dataLocale(istante) } : resto;
}
