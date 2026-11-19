// Recensioni Google del posto, lette dal SERVER (Places API New, Place Details). La chiave resta qui: mai nel browser
// (la CSP del sito e della TV vieta comunque ogni richiesta fuori dalla propria origine).
//
// Chiave: variabile d'ambiente GOOGLE_PLACES_API_KEY (con restrizione «solo Places API» e «solo IP del server» sulla
// console Google). Senza chiave: recensioni FINTE di esempio (fonte "finte"), dette nel log e sul sito/TV.
//
// Condizioni Google (da verificare prima del primo cliente vero, versione in vigore delle «Places API policies»):
//  - mostrare per ogni recensione nome dell'autore, voto, testo e data relativa, e l'attribuzione «Recensioni da Google»;
//  - non scegliere solo le belle, non modificare il testo (qui: nessun filtro, solo le 5 che Google restituisce);
//  - la conservazione dei contenuti è limitata: qui solo una cache in MEMORIA di breve durata (1 ora), mai su disco.
//    Se Google ammette meno (da verificare), abbassare DURATA_CACHE_MS.
import { oggetto } from "../../piattaforma/core/negozio.ts";
import { FINTE } from "./fixtures/recensioni.ts";
import { PLACE_ID } from "./core/valida.ts";
import type { Recensione, Recensioni } from "./core/tipi.ts";

export const VARIABILE_CHIAVE = "GOOGLE_PLACES_API_KEY";
export const DURATA_CACHE_MS = 60 * 60 * 1000;
const MASSIMO = 5;
const ATTESA_MS = 5000;

type Fetch = typeof fetch;
export interface Opzioni {
  chiave?: string | undefined;
  fetch?: Fetch;
  adesso?: () => number;
  log?: (riga: string) => void;
}

const cache = new Map<string, { fino: number; valore: Recensioni }>();
let avvisoFinte = false;

/** Per i test: svuota la cache e l'avviso unico. */
export function azzeraRecensioni() {
  cache.clear();
  avvisoFinte = false;
}

/** Dalla risposta di Place Details alle nostre recensioni; ciò che non torna si scarta, mai si inventa. */
export function leggiRisposta(x: unknown): Recensioni | null {
  if (!oggetto(x)) return null;
  const grezze = Array.isArray(x.reviews) ? x.reviews : [];
  const elenco: Recensione[] = [];
  for (const r of grezze.slice(0, MASSIMO)) {
    if (!oggetto(r)) continue;
    const autore = oggetto(r.authorAttribution) && typeof r.authorAttribution.displayName === "string" ? r.authorAttribution.displayName.trim() : "";
    const voto = r.rating;
    if (!autore || !Number.isInteger(voto) || (voto as number) < 1 || (voto as number) > 5) continue;
    const t = oggetto(r.text) && typeof r.text.text === "string" ? r.text.text : oggetto(r.originalText) && typeof r.originalText.text === "string" ? r.originalText.text : "";
    elenco.push({
      autore: autore.slice(0, 80),
      voto: voto as number,
      testo: t.slice(0, 2000),
      quando: typeof r.relativePublishTimeDescription === "string" ? r.relativePublishTimeDescription.slice(0, 60) : "",
    });
  }
  const out: Recensioni = { fonte: "google", elenco };
  if (typeof x.rating === "number" && x.rating >= 1 && x.rating <= 5) out.voto = x.rating;
  if (Number.isInteger(x.userRatingCount) && (x.userRatingCount as number) >= 0) out.totale = x.userRatingCount as number;
  return out;
}

export async function recensioni(placeId: string | undefined, o: Opzioni = {}): Promise<Recensioni> {
  const chiave = "chiave" in o ? o.chiave : process.env[VARIABILE_CHIAVE];
  const log = o.log ?? ((r) => console.warn(r));
  const adesso = o.adesso ?? Date.now;
  if (!chiave) {
    if (!avvisoFinte) {
      avvisoFinte = true;
      log(`vetrina: ${VARIABILE_CHIAVE} non impostata, uso recensioni FINTE di esempio`);
    }
    return FINTE;
  }
  if (!placeId || !PLACE_ID.test(placeId)) return { fonte: "google", elenco: [] };
  const c = cache.get(placeId);
  if (c && c.fino > adesso()) return c.valore;
  try {
    const r = await (o.fetch ?? fetch)(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=it`, {
      headers: { "X-Goog-Api-Key": chiave, "X-Goog-FieldMask": "rating,userRatingCount,reviews" },
      signal: AbortSignal.timeout(ATTESA_MS),
    });
    if (!r.ok) throw new Error(`Google ha risposto ${r.status}`);
    const valore = leggiRisposta(await r.json());
    if (!valore) throw new Error("risposta di Google non riconosciuta");
    cache.set(placeId, { fino: adesso() + DURATA_CACHE_MS, valore });
    return valore;
  } catch (e) {
    // La chiave non finisce mai nel log (non è nel messaggio). Se c'è una copia ancora in memoria la teniamo, anche scaduta.
    log(`vetrina: recensioni Google non lette (${e instanceof Error ? e.message : "errore"})`);
    return c?.valore ?? { fonte: "google", elenco: [] };
  }
}
