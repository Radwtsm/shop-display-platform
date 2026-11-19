// Lettura del menu dal browser (pagina del cliente, TV): ultimo menu buono tenuto nel browser, per ripartire senza rete.
import { valida } from "./core/valida.ts";
import type { DatiMenu } from "./core/tipi.ts";

const CHIAVE = "menu-qr.menu";

export function cacheMenu(): DatiMenu | null {
  try {
    const e = valida(JSON.parse(localStorage.getItem(CHIAVE) ?? "null"));
    return e.ok ? e.dati : null;
  } catch {
    return null;
  }
}

function salvaCache(m: DatiMenu) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(m));
  } catch {
    // storage pieno o bloccato: si va avanti con la copia in memoria
  }
}

export type Scaricato = { stato: "nuovo"; menu: DatiMenu; etag: string } | { stato: "uguale" } | { stato: "assente" } | { stato: "errore" };

/** 404 = il cliente non ha il servizio ("assente"); 304 = invariato. Mai un'eccezione. */
export async function scaricaMenu(etag = ""): Promise<Scaricato> {
  try {
    const r = await fetch("/api/menu-qr/menu", { headers: etag ? { "If-None-Match": etag } : {}, cache: "no-store" });
    if (r.status === 304) return { stato: "uguale" };
    if (r.status === 404) return { stato: "assente" };
    if (!r.ok) return { stato: "errore" };
    const e = valida(await r.json());
    if (!e.ok) return { stato: "errore" };
    salvaCache(e.dati);
    return { stato: "nuovo", menu: e.dati, etag: r.headers.get("ETag") ?? "" };
  } catch {
    return { stato: "errore" };
  }
}
