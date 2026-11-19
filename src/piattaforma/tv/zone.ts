import { indiceCorrente } from "../core/orario.ts";
import type { Disposizione } from "../core/negozio.ts";

/** Ogni quanto "intero" passa al servizio dopo, con due o più servizi sulla TV. */
export const SECONDI_PER_ZONA = 20;
/** Dopo tanto senza una richiesta riuscita la TV segna il pallino rosso. */
export const OFFLINE_DOPO_MS = 60_000;

/** Zone affiancate al massimo: a 960×540 (la TV vera) tre colonne spezzano le parole. */
export const MAX_AFFIANCATE = 2;

/** Quali zone si vedono, per posizione: una per volta ("intero") o a gruppi di MAX_AFFIANCATE ("affiancato"). */
export function zoneVisibili(quante: number, disposizione: Disposizione | undefined, istante: number): boolean[] {
  const perPagina = disposizione === "affiancato" ? MAX_AFFIANCATE : 1;
  if (quante <= perPagina) return Array.from({ length: quante }, () => true);
  const ora = indiceCorrente(Math.ceil(quante / perPagina), istante, SECONDI_PER_ZONA);
  return Array.from({ length: quante }, (_, i) => Math.floor(i / perPagina) === ora);
}

/** Offline se il guscio o uno dei servizi montati non ha avuto una risposta buona negli ultimi 60 s. */
export function sembraOffline(ultimiOk: number[], ora: number): boolean {
  return ultimiOk.some((t) => ora - t > OFFLINE_DOPO_MS);
}

/** Quanto una zona tiene lo schermo quando lo chiede (es. numero nuovo dell'Eliminacode). */
export const PRIMO_PIANO_MS = 4000;

/**
 * Come si vede ogni zona: "pieno" (nel contenuto), "riquadro" (piccola, nella colonna destra, sempre visibile),
 * "primo-piano" (per qualche secondo copre tutto), "nascosta". Un servizio che sa stare in un riquadro non gira
 * con gli altri, in nessuna disposizione: un numero da aspettare non può sparire per 20 s.
 */
export type FormaZona = "pieno" | "riquadro" | "primo-piano" | "nascosta";

export function formeZone(riquadri: boolean[], disposizione: Disposizione | undefined, istante: number, primoPiano = -1): FormaZona[] {
  const usaRiquadri = riquadri.length > 1 && riquadri.some((r) => !r);
  const giranti = riquadri.map((r, i) => (usaRiquadri && r ? -1 : i)).filter((i) => i >= 0);
  const visibili = zoneVisibili(giranti.length, disposizione, istante);
  return riquadri.map((r, i) => {
    if (i === primoPiano && riquadri.length > 1) return "primo-piano";
    if (usaRiquadri && r) return "riquadro";
    return visibili[giranti.indexOf(i)] ? "pieno" : "nascosta";
  });
}

/** Pagine di un servizio sulla TV (ctx.pagine): quante, quanto dura ognuna, come si chiama per chi guarda. */
export interface PagineZona {
  totale: number;
  secondi: number;
  etichetta?: string;
}
/** Un pallino del piede: `ora` si allunga e si riempie in `durataMs`, partendo da `trascorsiMs`. */
export interface Pallino {
  ora: boolean;
  fatto: boolean;
  durataMs: number;
  trascorsiMs: number;
}
/** Pallini oltre i quali la sezione mostra un pallino solo e il conto («3/9»). */
export const MAX_PALLINI = 5;

/** Il piede «Dove sono» (A141): sezione di adesso, i suoi pallini (o il conto), cosa viene dopo. */
export interface Piede {
  /** C'è qualcosa che gira: il piede tiene il posto a scritte e pallini anche quando cambiano. */
  gira: boolean;
  dove: string;
  pallini: Pallino[];
  conto: string;
  poi: string;
}

/**
 * Piede (A141, proposta approvata 12/11 «Menu ▬○ · poi: Offerte»): solo i pallini della zona che si vede, uno per
 * pagina (oltre MAX_PALLINI uno solo che si riempie + «3/9»); quello attuale si allunga e si riempie nel suo tempo,
 * quelli prima sono "fatti". Una zona di una pagina vale un pallino che dura il suo turno (SECONDI_PER_ZONA). `poi`
 * = la zona (in affiancato le zone) che viene dopo, se ce n'è un'altra. Due zone insieme: niente scritta né pallini.
 */
export function pallini(zone: Array<PagineZona & { visibile: boolean }>, istante: number): Piede {
  const vuoto: Piede = { gira: false, dove: "", pallini: [], conto: "", poi: "" };
  const totale = zone.reduce((s, z) => s + Math.max(1, z.totale), 0);
  if (totale <= 1) return vuoto;
  const visibili = zone.flatMap((z, i) => (z.visibile ? [i] : []));
  if (!visibili.length) return { ...vuoto, gira: true };
  const ultima = visibili[visibili.length - 1]!;
  const dopo: string[] = [];
  if (visibili.length < zone.length)
    for (let i = ultima + 1 >= zone.length ? 0 : ultima + 1; i < zone.length && dopo.length < visibili.length; i++) dopo.push(zone[i]!.etichetta ?? "");
  const poi = dopo.filter(Boolean).join(" · ");
  if (visibili.length > 1) return { ...vuoto, gira: true, poi };
  const z = zone[ultima]!;
  const n = Math.max(1, z.totale);
  const durataMs = (n > 1 ? z.secondi : SECONDI_PER_ZONA) * 1000;
  const attuale = n > 1 ? indiceCorrente(n, istante, z.secondi) : 0;
  const ora = { ora: true, fatto: false, durataMs, trascorsiMs: istante % durataMs };
  const punti = n > MAX_PALLINI ? [ora] : Array.from({ length: n }, (_, k) => (k === attuale ? ora : { ora: false, fatto: k < attuale, durataMs, trascorsiMs: 0 }));
  return { gira: true, dove: z.etichetta ?? "", pallini: punti, conto: n > MAX_PALLINI ? `${attuale + 1}/${n}` : "", poi };
}
