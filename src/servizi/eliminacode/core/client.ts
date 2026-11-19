// Pezzi del browser comuni a TV e pannello dell'Eliminacode.
import { ROTTA, type DatiEliminacode } from "./tipi.ts";
import { valida } from "./valida.ts";

const CHIAVE = "eliminacode.dati";

/** Ultimi dati buoni salvati nel browser: la TV riparte col numero giusto anche senza server. */
export function cache(): DatiEliminacode | null {
  try {
    const e = valida(JSON.parse(localStorage.getItem(CHIAVE) ?? "null"));
    return e.ok ? e.dati : null;
  } catch {
    return null;
  }
}

export function salvaCache(d: DatiEliminacode) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(d));
  } catch {
    // storage pieno o bloccato: si continua con i dati in memoria
  }
}

export type Letto = { stato: "nuovo"; dati: DatiEliminacode; etag: string } | { stato: "uguale" } | { stato: "errore" };

/** Legge lo stato (con ETag: se non è cambiato il server risponde 304 senza corpo). */
export async function leggi(etag: string): Promise<Letto> {
  try {
    const r = await fetch(ROTTA, { headers: etag ? { "If-None-Match": etag } : {}, cache: "no-store" });
    if (r.status === 304) return { stato: "uguale" };
    if (r.status !== 200) return { stato: "errore" };
    const e = valida(await r.json());
    return e.ok ? { stato: "nuovo", dati: e.dati, etag: r.headers.get("ETag") ?? "" } : { stato: "errore" };
  } catch {
    return { stato: "errore" };
  }
}

/** Eventi del server (A138): lo stato subito e poi a ogni cambio. Il browser si ricollega da solo se cade;
 * `collegato` dice se la linea è aperta (per l'avviso "offline" del guscio). */
export function ascolta(su: (d: DatiEliminacode) => void, collegato: (ok: boolean) => void): void {
  if (typeof EventSource === "undefined") return;
  const es = new EventSource(`${ROTTA}/eventi`);
  es.addEventListener("open", () => collegato(true));
  es.addEventListener("error", () => collegato(false));
  es.addEventListener("message", (e) => {
    try {
      const v = valida(JSON.parse(String(e.data)));
      if (v.ok) su(v.dati);
    } catch {
      // messaggio rotto: si aspetta il prossimo
    }
  });
}

/** «1,5» con una cifra dopo la virgola, «<1» sotto il minuto (corto: sta in una riga del riquadro). */
export const minutiTesto = (m: number) => (m < 1 ? "<1" : m.toLocaleString("it-IT", { maximumFractionDigits: 1 }));
