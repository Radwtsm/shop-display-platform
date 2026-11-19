import { FOTO } from "../../../piattaforma/core/foto.ts";
import { erroriDisposizione, erroriNegozio, erroriSceltaTema, oggetto, testo, validaFascia } from "../../../piattaforma/core/negozio.ts";
import { PREZZO_MAX } from "../../../piattaforma/core/prezzo.ts";
import { QUANTITA_MAX } from "../../../piattaforma/core/unita.ts";
import { erroriAspetto } from "./aspetto.ts";
import type { Config, DatiSchermo, Fascia, Slide } from "./tipi.ts";

export { contrasto } from "../../../piattaforma/core/colori.ts";
export { LOGO } from "../../../piattaforma/core/negozio.ts";

export type Esito = { ok: true; config: Config } | { ok: false; errori: string[] };

export const MAX_SLIDE = 50;
const ID = /^[a-z0-9-]{1,40}$/;

function validaSlide(s: unknown, i: number, errori: string[]): s is Slide {
  const dove = `Offerta ${i + 1}`;
  if (!oggetto(s)) return !errori.push(`${dove}: non valida`);
  if (typeof s.id !== "string" || !ID.test(s.id)) errori.push(`${dove}: id non valido`);
  if (!testo(s.titolo, 1, 80)) errori.push(`${dove}: titolo da 1 a 80 caratteri`);
  if (s.prezzo !== undefined && !(Number.isInteger(s.prezzo) && (s.prezzo as number) >= 0 && (s.prezzo as number) <= PREZZO_MAX))
    errori.push(`${dove}: prezzo non valido`);
  if (s.nota !== undefined && !testo(s.nota, 0, 120)) errori.push(`${dove}: nota fino a 120 caratteri`);
  if (s.quantita !== undefined) {
    const q = s.quantita;
    if (!oggetto(q) || !Number.isInteger(q.valore) || (q.valore as number) < 1 || (q.valore as number) > QUANTITA_MAX || (q.unita !== "g" && q.unita !== "ml"))
      errori.push(`${dove}: quantità non valida`);
    else if (s.prezzo === undefined) errori.push(`${dove}: la quantità serve solo se c'è un prezzo`);
  }
  if (s.foto !== undefined && (typeof s.foto !== "string" || !FOTO.test(s.foto))) errori.push(`${dove}: foto non valida`);
  if (typeof s.attiva !== "boolean") errori.push(`${dove}: attiva deve essere sì/no`);
  if (s.fasce !== undefined) {
    if (!Array.isArray(s.fasce) || s.fasce.length > 10) errori.push(`${dove}: fasce non valide`);
    else s.fasce.forEach((f, j) => validaFascia(f, `${dove}, fascia ${j + 1}`, errori));
  }
  return true;
}

function erroriOfferte(x: Record<string, unknown>): string[] {
  const errori: string[] = [];
  const sec = x.secondiPerSlide;
  if (!Number.isInteger(sec) || (sec as number) < 3 || (sec as number) > 120) errori.push("Secondi per offerta da 3 a 120");
  if (!Array.isArray(x.slides) || x.slides.length > MAX_SLIDE) errori.push(`Offerte: da 0 a ${MAX_SLIDE}`);
  else {
    x.slides.forEach((s, i) => validaSlide(s, i, errori));
    const ids = x.slides.map((s) => (oggetto(s) ? s.id : undefined));
    if (new Set(ids).size !== ids.length) errori.push("Offerte: id ripetuti");
  }
  return errori;
}

/** Unico controllo dei dati: lo usano server, pannello, player e personalizza. */
export function valida(x: unknown): Esito {
  if (!oggetto(x) || x.versione !== 1) return { ok: false, errori: ["Configurazione non valida (versione)"] };
  const errori = [...erroriNegozio(x.negozio), ...erroriAspetto(x.aspetto), ...erroriSceltaTema(x), ...erroriDisposizione(x.disposizione), ...erroriOfferte(x)];
  return errori.length ? { ok: false, errori } : { ok: true, config: x as unknown as Config };
}

/** Il file servizi/schermo.json da solo. */
export function validaSchermo(x: unknown): { ok: true; dati: DatiSchermo } | { ok: false; errori: string[] } {
  if (!oggetto(x) || x.versione !== 1) return { ok: false, errori: ["Dati dello Schermo non validi (versione)"] };
  const errori = [...erroriAspetto(x.aspetto), ...erroriOfferte(x)];
  return errori.length ? { ok: false, errori } : { ok: true, dati: x as unknown as DatiSchermo };
}
