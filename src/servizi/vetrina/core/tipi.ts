import type { Fascia } from "../../../piattaforma/core/orario.ts";

export type { Fascia } from "../../../piattaforma/core/orario.ts";

/** «Dal 1987» + due righe sull'attività; la foto sta nella cartella foto del cliente (nome dato dal server). */
export interface Storia {
  anno?: number;
  testo: string;
  foto?: string;
}

/** Senza password = rete aperta (formato WIFI: `T:nopass`). */
export interface Wifi {
  ssid: string;
  password?: string;
}

export interface Contatti {
  indirizzo?: string;
  telefono?: string;
  email?: string;
}

/** Il file servizi/vetrina.json di un cliente: ciò che è della Vetrina (nome, logo e colori sono del negozio). */
export interface DatiVetrina {
  versione: 1;
  storia?: Storia;
  /** Place ID di Google: serve per il link «scrivi una recensione» e per leggere le recensioni. */
  placeId?: string;
  wifi?: Wifi;
  /** Solo il nome utente, senza @. */
  instagram?: string;
  /** Orari di apertura (stessa forma delle fasce delle offerte, ora di Roma). */
  orari: Fascia[];
  contatti: Contatti;
  /** Dove porta il bottone «Menu» del sito: un percorso del sito ("/menu.html") o un indirizzo https. */
  linkMenu: string;
  secondiPerSlide: number;
}

export const LINK_MENU_PREDEFINITO = "/menu.html";

/** Un QR da mostrare: `testo` è ciò che contiene (un indirizzo o la stringa WIFI:). */
export interface VoceQr {
  id: "recensione" | "wifi" | "instagram";
  titolo: string;
  sotto: string;
  testo: string;
}

export interface Recensione {
  autore: string;
  /** Da 1 a 5, com'è su Google: mai ritoccato. */
  voto: number;
  /** Può essere vuoto (voto senza testo). */
  testo: string;
  /** «2 settimane fa», come lo scrive Google. */
  quando: string;
}

export interface Recensioni {
  /** `finte` = dati di esempio (chiave Google mancante): il sito e la TV lo dicono. */
  fonte: "google" | "finte";
  elenco: Recensione[];
  voto?: number;
  totale?: number;
}

/** Cosa rispondono /api/vetrina/tv e /api/vetrina/sito (la TV in più ha il QR del Wi-Fi, solo in rete locale). */
export interface RispostaVetrina {
  storia?: Storia;
  orari: Fascia[];
  contatti: Contatti;
  linkMenu: string;
  mappe?: { google: string; osm: string };
  qr: VoceQr[];
  recensioni: Recensioni;
  secondiPerSlide: number;
}
