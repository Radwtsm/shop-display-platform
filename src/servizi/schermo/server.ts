// Rotte dello Schermo: TV e pannello leggono e scrivono la vista negozio + offerte (`Config`), salvata in due file.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { validaNegozio } from "../../piattaforma/core/negozio.ts";
import type { Cliente } from "../../piattaforma/server/archivio.ts";
import { dentro } from "../../piattaforma/server/app.ts";
import type { Contesto, ModuloServer } from "../../piattaforma/server/modulo.ts";
import { componi, dividi, type Config, type DatiSchermo } from "./core/tipi.ts";
import { valida, validaSchermo } from "./core/valida.ts";

// /api/config: il percorso della versione prima, per le TV non ancora aggiornate (METODO → Versioni e rilasci)
const CONFIG = new Set(["/api/schermo/config", "/api/config"]);

/** La vista com'è salvata adesso (o nella versione prima), o null se manca o non è valida. */
export function leggiVista(cliente: Cliente, prec = false): Config | null {
  try {
    const n = validaNegozio(JSON.parse(cliente.leggi("negozio", prec) ?? "null"));
    const s = validaSchermo(JSON.parse(cliente.leggi("schermo", prec) ?? "null"));
    return n.ok && s.ok ? componi(n.dati, s.dati) : null;
  } catch {
    return null;
  }
}

/** Salva una vista già validata: prima lo Schermo, poi il negozio (ognuno atomico, con la sua versione prima). */
export function salvaVista(cliente: Cliente, c: Config) {
  const { negozio, schermo } = dividi(c);
  cliente.scrivi("schermo", JSON.stringify(schermo, null, 2));
  cliente.scrivi("negozio", JSON.stringify(negozio, null, 2));
}

async function config(c: Contesto): Promise<void> {
  if (c.req.method === "GET") {
    const vista = leggiVista(c.cliente);
    if (!vista) return c.invia(404, "Non trovato", "text/plain; charset=utf-8");
    const testo = JSON.stringify(vista, null, 2);
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
  if (esito.config.negozio.logo && !dentro(c.cliente.logo, esito.config.negozio.logo))
    return c.json(422, { errori: ["Logo non trovato"] });
  const senza = esito.config.slides.filter((s) => s.foto && !dentro(c.cliente.foto, s.foto));
  if (senza.length) return c.json(422, { errori: senza.map((s) => `${s.titolo}: foto non trovata, caricala di nuovo`) });
  salvaVista(c.cliente, esito.config);
  c.puliziaFoto();
  c.json(200, esito.config);
}

const fotoDi = (v: Config | null) => (v?.slides ?? []).flatMap((s) => (s.foto ? [s.foto] : []));

export const modulo: ModuloServer = {
  id: "schermo",
  valida: (dati) => {
    const e = validaSchermo(dati);
    return e.ok ? [] : e.errori;
  },
  // senza offerte: la TV mostra "Benvenuti" finché il negoziante non aggiunge la prima
  iniziali: () => ({ versione: 1, secondiPerSlide: 8, slides: [] }) satisfies DatiSchermo,
  async gestisci(c) {
    if (!CONFIG.has(c.percorso)) return false;
    await config(c);
    return true;
  },
  fotoUsate: (cliente) => [...fotoDi(leggiVista(cliente)), ...fotoDi(leggiVista(cliente, true))],
};

/**
 * Dalla versione prima (un solo negozio: <dati>/config.json, foto/, logo/, token) al cliente `id`. Il vecchio
 * config.json resta come config.json.migrato: niente si cancella.
 */
export function migraConfigUnica(dataDir: string, cliente: Cliente): boolean {
  const vecchio = join(dataDir, "config.json");
  if (!existsSync(vecchio) || cliente.esiste()) return false;
  const e = valida(JSON.parse(readFileSync(vecchio, "utf8")));
  if (!e.ok) throw new Error(`config.json non valido, migrazione fermata: ${e.errori.join("; ")}`);
  mkdirSync(cliente.dir, { recursive: true, mode: 0o700 });
  for (const n of ["foto", "logo", "token"]) if (existsSync(join(dataDir, n))) renameSync(join(dataDir, n), join(cliente.dir, n));
  salvaVista(cliente, e.config);
  cliente.scrivi("cliente", JSON.stringify({ versione: 1, servizi: ["schermo"] }, null, 2));
  renameSync(vecchio, `${vecchio}.migrato`);
  return true;
}
