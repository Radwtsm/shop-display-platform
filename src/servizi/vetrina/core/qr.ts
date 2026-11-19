// Cosa contengono i QR della Vetrina e i link alle mappe: funzioni pure, usate da server, TV, sito e cartello.
import type { Contatti, DatiVetrina, VoceQr, Wifi } from "./tipi.ts";

/** Nel formato WIFI: questi caratteri vanno preceduti da «\» (standard ZXing, letto da iPhone e Android). */
const speciali = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

/** `WIFI:T:WPA;S:<rete>;P:<password>;;` — senza password la rete è aperta (`T:nopass`). */
export function testoWifi(w: Wifi): string {
  return w.password ? `WIFI:T:WPA;S:${speciali(w.ssid)};P:${speciali(w.password)};;` : `WIFI:T:nopass;S:${speciali(w.ssid)};;`;
}

/** Apre direttamente la finestra «scrivi una recensione» del posto. */
export const linkRecensione = (placeId: string): string =>
  `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;

export const linkInstagram = (utente: string): string => `https://www.instagram.com/${encodeURIComponent(utente)}/`;

/** Solo link (niente iframe di terzi: la CSP del sito non li permette e non servono). */
export function linkMappe(c: Contatti, placeId?: string, nome?: string): { google: string; osm: string } | undefined {
  if (!c.indirizzo) return undefined;
  const q = encodeURIComponent([nome, c.indirizzo].filter(Boolean).join(", "));
  const pid = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : "";
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}${pid}`,
    osm: `https://www.openstreetmap.org/search?query=${encodeURIComponent(c.indirizzo)}`,
  };
}

/** I QR da mostrare, nell'ordine in cui il cliente li usa: recensione, Wi-Fi, Instagram (solo quelli configurati). */
export function vociQr(d: DatiVetrina, conWifi: boolean): VoceQr[] {
  const v: VoceQr[] = [];
  if (d.placeId) v.push({ id: "recensione", titolo: "Ti è piaciuto? Lascia una recensione", sotto: "Inquadra con la fotocamera", testo: linkRecensione(d.placeId) });
  if (conWifi && d.wifi) v.push({ id: "wifi", titolo: "Wi-Fi per gli ospiti", sotto: `Rete: ${d.wifi.ssid}`, testo: testoWifi(d.wifi) });
  if (d.instagram) v.push({ id: "instagram", titolo: "Seguici su Instagram", sotto: `@${d.instagram}`, testo: linkInstagram(d.instagram) });
  return v;
}
