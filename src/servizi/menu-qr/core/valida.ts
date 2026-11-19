import { oggetto, testo } from "../../../piattaforma/core/negozio.ts";
import { PREZZO_MAX } from "../../../piattaforma/core/prezzo.ts";
import { eAllergene } from "./allergeni.ts";
import { MAX_CATEGORIE, MAX_PIATTI, type DatiMenu } from "./tipi.ts";

export type Esito = { ok: true; dati: DatiMenu } | { ok: false; errori: string[] };

const ID = /^[a-z0-9-]{1,40}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Unica regola sui dati del menu (server, pannello, pagina del cliente, TV). Errori con le parole del negoziante. */
export function valida(x: unknown): Esito {
  if (!oggetto(x) || x.versione !== 1) return { ok: false, errori: ["Menu non valido (versione)"] };
  const errori: string[] = [];
  const idCategorie = new Set<string>();
  if (!Array.isArray(x.categorie) || x.categorie.length > MAX_CATEGORIE) errori.push(`Categorie: da 0 a ${MAX_CATEGORIE}`);
  else
    x.categorie.forEach((c, i) => {
      const dove = `Categoria ${i + 1}`;
      if (!oggetto(c)) return void errori.push(`${dove}: non valida`);
      if (typeof c.id !== "string" || !ID.test(c.id)) errori.push(`${dove}: id non valido`);
      else if (idCategorie.has(c.id)) errori.push(`${dove}: id ripetuto`);
      else idCategorie.add(c.id);
      if (!testo(c.nome, 1, 40)) errori.push(`${dove}: nome da 1 a 40 caratteri`);
    });
  if (!Array.isArray(x.piatti) || x.piatti.length > MAX_PIATTI) errori.push(`Piatti: da 0 a ${MAX_PIATTI}`);
  else {
    const visti = new Set<string>();
    x.piatti.forEach((p, i) => {
      const dove = `Piatto ${i + 1}`;
      if (!oggetto(p)) return void errori.push(`${dove}: non valido`);
      if (typeof p.id !== "string" || !ID.test(p.id)) errori.push(`${dove}: id non valido`);
      else if (visti.has(p.id)) errori.push(`${dove}: id ripetuto`);
      else visti.add(p.id);
      if (!testo(p.nome, 1, 60)) errori.push(`${dove}: nome da 1 a 60 caratteri`);
      if (p.descrizione !== undefined && !testo(p.descrizione, 0, 140)) errori.push(`${dove}: descrizione fino a 140 caratteri`);
      if (!Number.isInteger(p.prezzo) || (p.prezzo as number) < 0 || (p.prezzo as number) > PREZZO_MAX) errori.push(`${dove}: prezzo non valido`);
      if (typeof p.categoria !== "string" || !idCategorie.has(p.categoria)) errori.push(`${dove}: categoria non trovata`);
      if (p.allergeni !== null) {
        const a = p.allergeni;
        if (!Array.isArray(a) || !a.every(eAllergene) || new Set(a).size !== a.length) errori.push(`${dove}: allergeni non validi`);
      }
      // il vecchio `disponibile` (prima del 06/11) si ignora: un "finito" di un altro giorno è già scaduto
      if (p.finitoIl !== undefined && (typeof p.finitoIl !== "string" || !DATA.test(p.finitoIl))) errori.push(`${dove}: data di "finito oggi" non valida`);
    });
  }
  return errori.length ? { ok: false, errori } : { ok: true, dati: x as unknown as DatiMenu };
}
