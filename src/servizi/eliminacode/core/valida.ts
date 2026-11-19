import { oggetto, testo } from "../../../piattaforma/core/negozio.ts";
import { dataLocale } from "../../../piattaforma/core/orario.ts";
import { AZIONI, BANCHI_MAX, CHIAMATE_MAX, NUMERO_MAX, RITMO_FINESTRA_MS, STORICO_MAX, type Azione, type DatiEliminacode } from "./tipi.ts";

export type Esito = { ok: true; dati: DatiEliminacode } | { ok: false; errori: string[] };

/** Unica regola sui dati dell'Eliminacode: server, pannello e TV passano da qui. */
export function valida(x: unknown): Esito {
  if (!oggetto(x)) return { ok: false, errori: ["Dati dell'eliminacode non validi"] };
  const errori: string[] = [];
  if (x.versione !== 1) errori.push("Versione non supportata");
  const banchi = x.banchi;
  if (!Array.isArray(banchi) || banchi.length < 1 || banchi.length > BANCHI_MAX) errori.push(`Banchi: da 1 a ${BANCHI_MAX}`);
  else if (!banchi.every((b) => testo(b, 1, 20))) errori.push("Ogni banco ha un nome da 1 a 20 caratteri");
  else if (new Set(banchi.map((b: string) => b.trim().toLowerCase())).size !== banchi.length) errori.push("I banchi devono avere nomi diversi");
  if (!Number.isInteger(x.numero) || (x.numero as number) < 0 || (x.numero as number) > NUMERO_MAX) errori.push(`Numero da 0 a ${NUMERO_MAX}`);
  if (!Number.isInteger(x.banco) || (x.banco as number) < 0 || (Array.isArray(banchi) && (x.banco as number) >= banchi.length))
    errori.push("Banco non valido");
  const interi = (v: unknown, max: number, min: number, alto: number) =>
    v === undefined || (Array.isArray(v) && v.length <= max && v.every((n) => Number.isInteger(n) && n >= min && n <= alto));
  if (!interi(x.storico, STORICO_MAX, 1, NUMERO_MAX)) errori.push("Storico non valido");
  if (!interi(x.chiamate, CHIAMATE_MAX, 0, Number.MAX_SAFE_INTEGER)) errori.push("Chiamate non valide");
  const oggi = x.oggi;
  if (oggi !== undefined && !(oggi && typeof oggi === "object" && /^\d{4}-\d{2}-\d{2}$/.test(String((oggi as { giorno?: unknown }).giorno))
    && Number.isInteger((oggi as { serviti?: unknown }).serviti) && ((oggi as { serviti: number }).serviti) >= 0 && (oggi as { serviti: number }).serviti <= 99_999))
    errori.push("Serviti di oggi non validi");
  if (errori.length) return { ok: false, errori };
  const o = oggi as DatiEliminacode["oggi"];
  return {
    ok: true,
    dati: {
      versione: 1, banchi: (banchi as string[]).map((b) => b.trim()), numero: x.numero as number, banco: x.banco as number,
      ...(x.storico !== undefined ? { storico: [...(x.storico as number[])] } : {}),
      ...(x.chiamate !== undefined ? { chiamate: [...(x.chiamate as number[])] } : {}),
      ...(o ? { oggi: { giorno: o.giorno, serviti: o.serviti } } : {}),
    },
  };
}

export function validaAzione(x: unknown): { ok: true; azione: Azione; banco?: number } | { ok: false; errori: string[] } {
  if (!oggetto(x) || !(AZIONI as readonly unknown[]).includes(x.azione)) return { ok: false, errori: ["Azione non valida"] };
  if (x.banco !== undefined && !(Number.isInteger(x.banco) && (x.banco as number) >= 0 && (x.banco as number) < BANCHI_MAX))
    return { ok: false, errori: ["Banco non valido"] };
  return { ok: true, azione: x.azione as Azione, ...(x.banco !== undefined ? { banco: x.banco as number } : {}) };
}

/** Il nuovo stato dopo un'azione, o null se il banco non esiste. "Indietro" non cambia il banco: torna solo il numero
 * e annulla l'ultima chiamata (storico, ritmo, serviti). `ora` = istante dell'azione (il server passa Date.now()). */
export function applica(d: DatiEliminacode, azione: Azione, banco = d.banco, ora = Date.now()): DatiEliminacode | null {
  if (banco >= d.banchi.length) return null;
  const storico = d.storico ?? [], chiamate = d.chiamate ?? [];
  if (azione === "prossimo") {
    const giorno = dataLocale(ora);
    return {
      ...d, numero: d.numero >= NUMERO_MAX ? 1 : d.numero + 1, banco,
      storico: (d.numero > 0 ? [d.numero, ...storico] : storico).slice(0, STORICO_MAX),
      chiamate: [...chiamate, ora].slice(-CHIAMATE_MAX),
      oggi: { giorno, serviti: (d.oggi?.giorno === giorno ? d.oggi.serviti : 0) + 1 },
    };
  }
  if (azione === "indietro") {
    if (d.numero === 0) return { ...d };
    const giu = Math.max(0, d.numero - 1);
    const r: DatiEliminacode = { ...d, numero: giu };
    if (d.storico) r.storico = storico[0] === giu ? storico.slice(1) : storico;
    if (d.chiamate) r.chiamate = chiamate.slice(0, -1);
    if (d.oggi) r.oggi = { ...d.oggi, serviti: Math.max(0, d.oggi.serviti - 1) };
    return r;
  }
  return { ...d, numero: 0, banco: 0, storico: [], chiamate: [] };
}

/** Ritmo della coda: minuti tra un «Prossimo» e l'altro (media delle ultime chiamate, se almeno 3 negli ultimi
 * 30 minuti, se no null) e serviti di oggi. Non è un'attesa: per quella serve sapere quanti aspettano. */
export function ritmo(d: DatiEliminacode, ora: number): { minuti: number | null; serviti: number } {
  const serviti = d.oggi?.giorno === dataLocale(ora) ? d.oggi.serviti : 0;
  const recenti = (d.chiamate ?? []).filter((t) => ora - t <= RITMO_FINESTRA_MS && t <= ora);
  if (recenti.length < 3) return { minuti: null, serviti };
  return { minuti: (recenti.at(-1)! - recenti[0]!) / (recenti.length - 1) / 60_000, serviti };
}

/** Nomi dei banchi per "uno" o "due banchi" (l'interruttore del pannello). */
export const nomiBanchi = (quanti: 1 | 2): string[] => (quanti === 1 ? ["Banco 1"] : ["Banco 1", "Banco 2"]);
