import { anima, PASSAGGI, type Passaggio } from "../../../piattaforma/client/movimento.ts";
import { aspettoCompleto, type Aspetto } from "./aspetto.ts";
import type { Config } from "./tipi.ts";
import { valida } from "./valida.ts";

const CHIAVE = "schermo.config";

/** Ultima configurazione buona salvata nel browser: lo schermo riparte anche senza server. */
export function cache(): Config | null {
  try {
    const e = valida(JSON.parse(localStorage.getItem(CHIAVE) ?? "null"));
    return e.ok ? e.config : null;
  } catch {
    return null;
  }
}

export function salvaCache(c: Config) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(c));
  } catch {
    // storage pieno o bloccato: si continua con la copia in memoria
  }
}

export function applicaColori(c: Config) {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(c.negozio.colori)) s.setProperty(`--${k}`, v);
}

/** Sulla TV e nelle miniature: data-<chiave>="valore" per ogni scelta d'aspetto. */
export function applicaAspetto(el: HTMLElement, a: Aspetto | undefined) {
  for (const [k, v] of Object.entries(aspettoCompleto(a))) el.dataset[k] = v;
}

/** Entrata della nuova offerta: solo opacità e trasformazioni (niente salti); niente con "riduci movimento". */
export function animaEntrata(els: HTMLElement[], passaggio: string | undefined) {
  const p = passaggio ?? "dissolvenza";
  if (p === "nessuno" || !(p in PASSAGGI)) return;
  for (const el of els) anima(el, p as Passaggio);
}
