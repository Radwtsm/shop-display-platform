// Contratto tra piattaforma e servizi lato server. Un servizio = src/servizi/<id>/server.ts che esporta `modulo`;
// la piattaforma lo trova dalla cartella (il suo id deve essere nel catalogo) e lo chiama solo se il cliente lo ha.
import { existsSync, readdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { validaNegozio, type DatiNegozio } from "../core/negozio.ts";
import { SERVIZI, type IdServizio } from "../core/servizi.ts";
import type { Cliente } from "./archivio.ts";

export interface Contesto {
  req: IncomingMessage;
  res: ServerResponse;
  /** Percorso già decodificato, senza query. */
  percorso: string;
  cliente: Cliente;
  /** Controlla il token del pannello; se manca o è sbagliato ha già risposto (401 o 429). */
  autorizzato(): boolean;
  json(stato: number, dati: unknown, extra?: Record<string, string>): void;
  invia(stato: number, corpo: string | Buffer, tipo: string, extra?: Record<string, string>): void;
  leggiCorpo(max?: number): Promise<Buffer | null>;
  /** Risposta che resta aperta (Server-Sent Events, con le intestazioni di sicurezza): `scrivi` manda un messaggio
   * (testo su una riga, es. JSON), `chiuso` scatta quando la TV se ne va. Un commento ogni 25 s la tiene viva. */
  flusso(): { scrivi(dati: string): void; chiuso(fai: () => void): void };
  /** Dopo un salvataggio: cancella le foto vecchie che nessun servizio usa più. */
  puliziaFoto(): void;
}

export interface ModuloServer {
  id: IdServizio;
  /** Risponde se la rotta è sua (true), altrimenti false e passa al prossimo. */
  gestisci(c: Contesto): boolean | Promise<boolean>;
  /** Controllo dei suoi dati (unica `valida()` del servizio): elenco di errori, vuoto = validi. */
  valida(dati: unknown): string[];
  /** Dati con cui parte quando un cliente attiva il servizio (devono passare `valida`); il negozio c'è già. */
  iniziali(negozio: DatiNegozio): unknown;
  /** Dati di esempio per la demo (DEMO_SERVIZI), scritti solo se il cliente non ne ha ancora; devono passare `valida`. */
  esempio?(): unknown;
  /** Foto che i suoi dati usano, anche nella versione prima ("Annulla"): la pulizia non le tocca. */
  fotoUsate(cliente: Cliente): string[];
}

/** Le cartelle in src/servizi: ognuna deve avere la sua voce nel catalogo (test). */
export const cartelleServizi = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];

export async function caricaModuli(dir: string): Promise<ModuloServer[]> {
  const moduli: ModuloServer[] = [];
  for (const s of SERVIZI) {
    const file = join(dir, s.id, "server.ts");
    if (!existsSync(file)) continue; // servizio in arrivo: nel catalogo, senza codice
    const m = ((await import(pathToFileURL(file).href)) as { modulo?: ModuloServer }).modulo;
    if (m?.id !== s.id) throw new Error(`${file}: deve esportare modulo con id "${s.id}"`);
    moduli.push(m);
  }
  return moduli;
}

/**
 * Attiva `modulo` per `cliente`: se non ha ancora dati suoi li crea da `iniziali` (mai sovrascritti), poi lo mette
 * tra i servizi attivi. Un'attivazione ripetuta non cambia niente.
 */
export function attivaServizio(cliente: Cliente, modulo: ModuloServer): void {
  if (cliente.leggi(modulo.id) === null) {
    const negozio = validaNegozio(JSON.parse(cliente.leggi("negozio") ?? "null"));
    if (!negozio.ok) throw new Error(`negozio di ${cliente.id} non valido: ${negozio.errori.join("; ")}`);
    const dati = modulo.iniziali(negozio.dati);
    const errori = modulo.valida(dati);
    if (errori.length) throw new Error(`dati iniziali di ${modulo.id} non validi: ${errori.join("; ")}`);
    cliente.scrivi(modulo.id, JSON.stringify(dati, null, 2));
  }
  cliente.impostaServizi([...new Set([...cliente.servizi(), modulo.id])]);
}
