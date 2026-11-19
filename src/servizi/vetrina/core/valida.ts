// Unico controllo dei dati della Vetrina: lo usano server, pannello, TV e sito.
import { FOTO } from "../../../piattaforma/core/foto.ts";
import { oggetto, testo } from "../../../piattaforma/core/negozio.ts";
import { urlQrValido } from "../../../piattaforma/core/qr.ts";
import type { Contatti, DatiVetrina, Fascia, Recensioni, RispostaVetrina, VoceQr } from "./tipi.ts";

export const PLACE_ID = /^[A-Za-z0-9_-]{10,200}$/;
export const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;
const TELEFONO = /^\+?[0-9 ()-]{5,20}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,200}\.[^\s@]{2,}$/;
const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Un errore, col campo a cui sta accanto (il pannello lo mette sotto il campo). */
export interface Errore {
  campo?: string;
  testo: string;
}

/** Dal nome scritto dal negoziante (anche «@nome» o l'indirizzo del profilo) al solo nome utente. */
export function pulisciInstagram(s: string): string {
  const t = s.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return t;
}

/** Link di una pagina del sito (percorso che inizia con una sola «/») o un indirizzo https completo. */
export const linkMenuValido = (u: unknown): u is string =>
  typeof u === "string" && ((/^\/[A-Za-z0-9._~/-]{0,100}$/.test(u) && !u.startsWith("//")) || urlQrValido(u));

function erroriFascia(f: unknown, i: number, out: Errore[]) {
  const dove = `Orari, riga ${i + 1}`;
  if (!oggetto(f)) return void out.push({ campo: "orari", testo: `${dove}: non valida` });
  const g = f.giorni;
  if (!Array.isArray(g) || !g.length || !g.every((x) => Number.isInteger(x) && x >= 1 && x <= 7))
    out.push({ campo: "orari", testo: `${dove}: giorni da 1 (lunedì) a 7 (domenica)` });
  if (typeof f.da !== "string" || !ORA.test(f.da) || typeof f.a !== "string" || !ORA.test(f.a))
    out.push({ campo: "orari", testo: `${dove}: orari nel formato HH:MM` });
  else if (f.da === f.a) out.push({ campo: "orari", testo: `${dove}: apertura e chiusura uguali` });
}

function erroriContatti(c: unknown): Errore[] {
  if (!oggetto(c)) return [{ testo: "Contatti mancanti" }];
  const out: Errore[] = [];
  if (c.indirizzo !== undefined && !testo(c.indirizzo, 1, 120)) out.push({ campo: "indirizzo", testo: "Indirizzo da 1 a 120 caratteri" });
  if (c.telefono !== undefined && !(typeof c.telefono === "string" && TELEFONO.test(c.telefono)))
    out.push({ campo: "telefono", testo: "Telefono: solo numeri, per esempio 06 1234567" });
  if (c.email !== undefined && !(typeof c.email === "string" && c.email.length <= 120 && EMAIL.test(c.email)))
    out.push({ campo: "email", testo: "Email: scrivila così nome@esempio.it" });
  return out;
}

/** Tutti gli errori, con le parole del negoziante; vuoto = valido. */
export function controlla(x: unknown): Errore[] {
  if (!oggetto(x) || x.versione !== 1) return [{ testo: "Dati della Vetrina non validi (versione)" }];
  const out: Errore[] = [];
  const s = x.storia;
  if (s !== undefined) {
    if (!oggetto(s)) out.push({ campo: "storia", testo: "Storia non valida" });
    else {
      if (!testo(s.testo, 1, 400)) out.push({ campo: "storia", testo: "Racconta la storia in 1–400 caratteri" });
      if (s.anno !== undefined && !(Number.isInteger(s.anno) && (s.anno as number) >= 1800 && (s.anno as number) <= 2100))
        out.push({ campo: "anno", testo: "Anno: quattro cifre, per esempio 1987" });
      if (s.foto !== undefined && !(typeof s.foto === "string" && FOTO.test(s.foto))) out.push({ campo: "foto", testo: "Foto non valida" });
    }
  }
  if (x.placeId !== undefined && !(typeof x.placeId === "string" && PLACE_ID.test(x.placeId)))
    out.push({ campo: "placeId", testo: "Place ID: lettere e numeri, da 10 a 200 caratteri" });
  const w = x.wifi;
  if (w !== undefined) {
    if (!oggetto(w) || !testo(w.ssid, 1, 32)) out.push({ campo: "ssid", testo: "Nome della rete Wi-Fi da 1 a 32 caratteri" });
    else if (w.password !== undefined && !(typeof w.password === "string" && w.password.length >= 8 && w.password.length <= 63))
      out.push({ campo: "password", testo: "Password Wi-Fi da 8 a 63 caratteri (o lascia vuoto se la rete è aperta)" });
  }
  if (x.instagram !== undefined && !(typeof x.instagram === "string" && INSTAGRAM.test(x.instagram)))
    out.push({ campo: "instagram", testo: "Instagram: solo il nome utente, per esempio panificiodemo" });
  if (!Array.isArray(x.orari) || x.orari.length > 10) out.push({ campo: "orari", testo: "Orari: al massimo 10 righe" });
  else x.orari.forEach((f, i) => erroriFascia(f, i, out));
  out.push(...erroriContatti(x.contatti));
  if (!linkMenuValido(x.linkMenu)) out.push({ campo: "linkMenu", testo: "Link del menu: una pagina del sito (/menu.html) o un indirizzo https://" });
  if (!Number.isInteger(x.secondiPerSlide) || (x.secondiPerSlide as number) < 3 || (x.secondiPerSlide as number) > 120)
    out.push({ testo: "Secondi per schermata da 3 a 120" });
  return out;
}

/** Contratto del modulo: elenco di frasi, vuoto = valido. */
export const valida = (x: unknown): string[] => controlla(x).map((e) => e.testo);

export const validaVetrina = (x: unknown): { ok: true; dati: DatiVetrina } | { ok: false; errori: string[] } => {
  const e = valida(x);
  return e.length ? { ok: false, errori: e } : { ok: true, dati: x as DatiVetrina };
};

const SOLO_HTTPS = (u: unknown) => typeof u === "string" && urlQrValido(u);

function vociQrValide(q: unknown): q is VoceQr[] {
  return (
    Array.isArray(q) && q.length <= 3 &&
    q.every((v) => oggetto(v) && ["recensione", "wifi", "instagram"].includes(v.id as string) && testo(v.titolo, 1, 60) && testo(v.sotto, 0, 120) && testo(v.testo, 1, 400))
  );
}

function recensioniValide(r: unknown): r is Recensioni {
  return (
    oggetto(r) && (r.fonte === "google" || r.fonte === "finte") && Array.isArray(r.elenco) && r.elenco.length <= 5 &&
    r.elenco.every((x) => oggetto(x) && testo(x.autore, 1, 80) && Number.isInteger(x.voto) && (x.voto as number) >= 1 && (x.voto as number) <= 5 &&
      typeof x.testo === "string" && x.testo.length <= 2000 && typeof x.quando === "string" && x.quando.length <= 60)
  );
}

/** Controllo di ciò che TV e sito ricevono dal server (stessa regola: niente si fida del server). */
export function validaRisposta(x: unknown): { ok: true; dati: RispostaVetrina } | { ok: false } {
  if (!oggetto(x)) return { ok: false };
  const o: Errore[] = [];
  (x.orari as unknown[] | undefined)?.forEach?.((f, i) => erroriFascia(f, i, o));
  const ok =
    Array.isArray(x.orari) && !o.length && erroriContatti(x.contatti).length === 0 && linkMenuValido(x.linkMenu) &&
    vociQrValide(x.qr) && recensioniValide(x.recensioni) && Number.isInteger(x.secondiPerSlide) && (x.secondiPerSlide as number) >= 3 &&
    (x.storia === undefined || (oggetto(x.storia) && testo(x.storia.testo, 1, 400))) &&
    (x.mappe === undefined || (oggetto(x.mappe) && SOLO_HTTPS(x.mappe.google) && SOLO_HTTPS(x.mappe.osm)));
  return ok ? { ok: true, dati: x as unknown as RispostaVetrina } : { ok: false };
}

export type { Contatti, Fascia };
