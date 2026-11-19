// Rotte dell'Eliminacode: GET /api/eliminacode (la TV e il pannello, senza token, con ETag come /api/negozio),
// GET /api/eliminacode/eventi (Server-Sent Events: lo stato subito e poi a ogni cambio, senza token),
// POST /api/eliminacode/azione e PUT /api/eliminacode/banchi (con token).
import { createHash } from "node:crypto";
import type { Cliente } from "../../piattaforma/server/archivio.ts";
import type { Contesto, ModuloServer } from "../../piattaforma/server/modulo.ts";
import { ROTTA, type DatiEliminacode } from "./core/tipi.ts";
import { applica, nomiBanchi, valida, validaAzione } from "./core/valida.ts";

const INIZIALI: DatiEliminacode = { versione: 1, banchi: nomiBanchi(1), numero: 0, banco: 0 };

/** I dati salvati, o null se mancano o non sono validi. */
export function leggiCoda(cliente: Cliente): DatiEliminacode | null {
  try {
    const e = valida(JSON.parse(cliente.leggi("eliminacode") ?? "null"));
    return e.ok ? e.dati : null;
  } catch {
    return null;
  }
}

/** Chi ascolta gli eventi, per cliente: a ogni salvataggio riceve i dati nuovi (la TV non chiede più ogni 1,5 s). */
const ascolto = new Map<string, Set<(dati: string) => void>>();
/** Più TV e telefoni dello stesso negozio vanno bene; oltre, è un errore o un abuso. */
export const ASCOLTO_MAX = 20;

function salva(cliente: Cliente, d: DatiEliminacode) {
  cliente.scrivi("eliminacode", JSON.stringify(d, null, 2));
  const testo = JSON.stringify(d);
  for (const manda of ascolto.get(cliente.id) ?? []) manda(testo);
}

function eventi(c: Contesto) {
  if (c.req.method !== "GET") return c.json(405, { errori: ["Metodo non permesso"] });
  const d = leggiCoda(c.cliente);
  if (!d) return c.invia(404, "Non trovato", "text/plain; charset=utf-8");
  const tutti = ascolto.get(c.cliente.id) ?? new Set();
  if (tutti.size >= ASCOLTO_MAX) return c.json(503, { errori: ["Troppi schermi collegati"] }, { "Retry-After": "30" });
  ascolto.set(c.cliente.id, tutti);
  const f = c.flusso();
  f.scrivi(JSON.stringify(d));
  tutti.add(f.scrivi);
  f.chiuso(() => {
    tutti.delete(f.scrivi);
    if (!tutti.size) ascolto.delete(c.cliente.id);
  });
}

async function corpoJson(c: Contesto): Promise<unknown | undefined> {
  const corpo = await c.leggiCorpo(4 * 1024);
  if (corpo === null) return void c.json(413, { errori: ["Dati troppo grandi"] });
  try {
    return JSON.parse(corpo.toString("utf8"));
  } catch {
    return void c.json(400, { errori: ["Dati non leggibili"] });
  }
}

async function gestisci(c: Contesto): Promise<void> {
  if (c.percorso === ROTTA) {
    if (c.req.method !== "GET") return c.json(405, { errori: ["Metodo non permesso"] });
    const d = leggiCoda(c.cliente);
    if (!d) return c.invia(404, "Non trovato", "text/plain; charset=utf-8");
    const testo = JSON.stringify(d);
    const etag = `"${createHash("sha1").update(testo).digest("hex")}"`;
    if (c.req.headers["if-none-match"] === etag) return c.invia(304, "", "text/plain", { ETag: etag });
    return c.invia(200, testo, "application/json; charset=utf-8", { ETag: etag, "Cache-Control": "no-store" });
  }
  if (c.percorso === `${ROTTA}/eventi`) return eventi(c);
  // scritture: metodo, poi token, poi dati (un link sbagliato non deve poter provare i dati)
  const azione = c.percorso === `${ROTTA}/azione`;
  if (c.req.method !== (azione ? "POST" : "PUT")) return c.json(405, { errori: ["Metodo non permesso"] });
  if (!c.autorizzato()) return;
  const attuale = leggiCoda(c.cliente);
  if (!attuale) return c.json(404, { errori: ["Eliminacode non pronta"] });
  const dati = await corpoJson(c);
  if (dati === undefined) return;
  if (azione) {
    const a = validaAzione(dati);
    if (!a.ok) return c.json(422, { errori: a.errori });
    // si rilegge dopo aver atteso il corpo: due telefoni insieme si sommano, non si sovrascrivono
    const ora = leggiCoda(c.cliente) ?? attuale;
    const nuovo = applica(ora, a.azione, a.banco);
    if (!nuovo) return c.json(422, { errori: ["Banco non trovato"] });
    salva(c.cliente, nuovo);
    return c.json(200, nuovo);
  }
  const b = (dati as { banchi?: unknown } | null)?.banchi;
  const ora = leggiCoda(c.cliente) ?? attuale;
  const nuovo = valida({ ...ora, banchi: b, banco: Math.min(ora.banco, Array.isArray(b) ? Math.max(0, b.length - 1) : 0) });
  if (!nuovo.ok) return c.json(422, { errori: nuovo.errori });
  salva(c.cliente, nuovo.dati);
  c.json(200, nuovo.dati);
}

export const modulo: ModuloServer = {
  id: "eliminacode",
  valida: (dati) => {
    const e = valida(dati);
    return e.ok ? [] : e.errori;
  },
  iniziali: () => INIZIALI,
  async gestisci(c) {
    if (c.percorso !== ROTTA && !c.percorso.startsWith(`${ROTTA}/`)) return false;
    if (c.percorso !== ROTTA && c.percorso !== `${ROTTA}/azione` && c.percorso !== `${ROTTA}/banchi` && c.percorso !== `${ROTTA}/eventi`) return false;
    await gestisci(c);
    return true;
  },
  fotoUsate: () => [],
};
