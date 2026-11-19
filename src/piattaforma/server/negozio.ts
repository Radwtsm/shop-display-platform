// /api/negozio: il negozio (nome, logo, colori, tema, QR, disposizione) è uno per cliente e vale per tutti i servizi,
// quindi lo legge e lo salva la piattaforma, non un servizio. GET senza token (la TV lo legge ogni pochi secondi,
// come la config dello Schermo); PUT con token. La risposta aggiunge i servizi attivi: TV e pannello montano solo quelli.
import { createHash } from "node:crypto";
import { sceltaTema, validaNegozio, type RispostaNegozio } from "../core/negozio.ts";
import { dentro } from "./app.ts";
import type { Cliente } from "./archivio.ts";
import type { Contesto } from "./modulo.ts";

/** Il negozio salvato + i servizi attivi, o null se manca o non è valido. */
export function leggiNegozio(cliente: Cliente): RispostaNegozio | null {
  try {
    const n = validaNegozio(JSON.parse(cliente.leggi("negozio") ?? "null"));
    return n.ok ? { ...n.dati, servizi: cliente.servizi() } : null;
  } catch {
    return null;
  }
}

export async function rottaNegozio(c: Contesto, origineTelefono?: string): Promise<void> {
  if (c.req.method === "GET") {
    const r = leggiNegozio(c.cliente);
    if (!r) return c.invia(404, "Non trovato", "text/plain; charset=utf-8");
    const testo = JSON.stringify(origineTelefono ? { ...r, origineTelefono } : r, null, 2);
    const etag = `"${createHash("sha1").update(testo).digest("hex")}"`;
    if (c.req.headers["if-none-match"] === etag) return c.invia(304, "", "text/plain", { ETag: etag });
    return c.invia(200, testo, "application/json; charset=utf-8", { ETag: etag, "Cache-Control": "no-store" });
  }
  if (c.req.method !== "PUT") return c.json(405, { errori: ["Metodo non permesso"] });
  if (!c.autorizzato()) return;
  const corpo = await c.leggiCorpo();
  if (corpo === null) return c.json(413, { errori: ["Dati troppo grandi"] });
  let dati: unknown;
  try {
    dati = JSON.parse(corpo.toString("utf8"));
  } catch {
    return c.json(400, { errori: ["Dati non leggibili"] });
  }
  const esito = validaNegozio(dati);
  if (!esito.ok) return c.json(422, { errori: esito.errori });
  const { negozio, disposizione } = esito.dati;
  if (negozio.logo && !dentro(c.cliente.logo, negozio.logo)) return c.json(422, { errori: ["Logo non trovato"] });
  // si salva solo ciò che si conosce: i campi in più della richiesta (come "servizi") non finiscono nel file
  c.cliente.scrivi("negozio", JSON.stringify({ versione: 1, negozio, ...sceltaTema(esito.dati), ...(disposizione ? { disposizione } : {}) }, null, 2));
  c.json(200, leggiNegozio(c.cliente));
}
