// Aiuti del browser comuni a guscio TV, guscio pannello e servizi. Niente `innerHTML` (regola Semgrep): il markup
// fisso di un servizio entra da qui, il testo dell'utente solo con `textContent`.
import { suColore } from "../core/colori.ts";
import { validaRispostaNegozio, type Colori, type RispostaNegozio } from "../core/negozio.ts";

/**
 * Elementi da un HTML scritto da noi (costante nel codice, MAI testo di un utente). Analizzato come documento a
 * parte: gli script non partono; la CSP vieta comunque ogni script inline.
 */
export function frammento(html: string): DocumentFragment {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, "text/html");
  const out = document.createDocumentFragment();
  out.append(...[...doc.body.childNodes].map((n) => document.importNode(n, true)));
  return out;
}

/** I colori del negozio diventano le variabili CSS (--primario, --accento, --sfondo, --testo), più --su-accento
 *  (nero o bianco) per le scritte sul colore pieno dell'accento (riquadro della coda). */
export function applicaColori(colori: Colori) {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(colori)) s.setProperty(`--${k}`, v);
  s.setProperty("--su-accento", suColore(colori.accento));
}

/** Ultimo negozio buono salvato nel browser: TV e pannello ripartono anche senza server. */
export function cacheNegozio(chiave: string): RispostaNegozio | null {
  try {
    const e = validaRispostaNegozio(JSON.parse(localStorage.getItem(chiave) ?? "null"));
    return e.ok ? e.dati : null;
  } catch {
    return null;
  }
}

export function salvaCacheNegozio(chiave: string, n: RispostaNegozio) {
  try {
    localStorage.setItem(chiave, JSON.stringify(n));
  } catch {
    // storage pieno o bloccato: si continua con la copia in memoria
  }
}
