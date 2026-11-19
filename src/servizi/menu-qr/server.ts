// Rotte del Menu QR: /api/menu-qr/menu. La lettura è pubblica (la apre chiunque inquadri il QR, sola lettura);
// la scrittura chiede il token del pannello.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dataLocale } from "../../piattaforma/core/orario.ts";
import type { Cliente } from "../../piattaforma/server/archivio.ts";
import type { Contesto, ModuloServer } from "../../piattaforma/server/modulo.ts";
import type { DatiMenu } from "./core/tipi.ts";
import { valida } from "./core/valida.ts";

export const PERCORSO_MENU = "/api/menu-qr/menu";

/** Il menu com'è salvato adesso, o null se manca o non è valido. */
export function leggiMenu(cliente: Cliente): DatiMenu | null {
  try {
    const e = valida(JSON.parse(cliente.leggi("menu-qr") ?? "null"));
    return e.ok ? e.dati : null;
  } catch {
    return null;
  }
}

async function menu(c: Contesto): Promise<void> {
  if (c.req.method === "GET") {
    const m = leggiMenu(c.cliente);
    if (!m) return c.invia(404, "Non trovato", "text/plain; charset=utf-8");
    const testo = JSON.stringify(m, null, 2);
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
  const esito = valida(dati);
  if (!esito.ok) return c.json(422, { errori: esito.errori });
  c.cliente.scrivi("menu-qr", JSON.stringify(esito.dati, null, 2));
  c.json(200, esito.dati);
}

export const modulo: ModuloServer = {
  id: "menu-qr",
  valida: (dati) => {
    const e = valida(dati);
    return e.ok ? [] : e.errori;
  },
  iniziali: () => ({ versione: 1, categorie: [], piatti: [] }) satisfies DatiMenu,
  // il piatto "finito" della demo è finito il giorno in cui si accende, non quello in cui è stato scritto il file
  esempio: () => {
    const m = JSON.parse(readFileSync(new URL("./demo.json", import.meta.url), "utf8")) as DatiMenu;
    const oggi = dataLocale(Date.now());
    return { ...m, piatti: m.piatti.map((p) => (p.finitoIl ? { ...p, finitoIl: oggi } : p)) } satisfies DatiMenu;
  },
  async gestisci(c) {
    if (c.percorso !== PERCORSO_MENU) return false;
    await menu(c);
    return true;
  },
  fotoUsate: () => [],
};
