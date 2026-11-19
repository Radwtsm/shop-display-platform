import type { Aspetto } from "./aspetto.ts";
import type { Fascia } from "../../../piattaforma/core/orario.ts";
import { sceltaTema, type DatiNegozio, type Negozio, type SceltaTema } from "../../../piattaforma/core/negozio.ts";
import type { Quantita } from "../../../piattaforma/core/unita.ts";

export type { Fascia } from "../../../piattaforma/core/orario.ts";
export { TEMI, type Colori, type Tema } from "../../../piattaforma/core/negozio.ts";

export interface Slide {
  id: string;
  titolo: string;
  /** Centesimi di euro, mai float. */
  prezzo?: number;
  nota?: string;
  /** A che quantità si riferisce il prezzo: la TV mostra anche il prezzo al kg o al litro. */
  quantita?: Quantita;
  /** Foto del prodotto nella cartella foto del cliente (nome dato dal server). */
  foto?: string;
  attiva: boolean;
  fasce?: Fascia[];
}

/** Il file servizi/schermo.json di un cliente: solo ciò che è dello Schermo. */
export interface DatiSchermo {
  versione: 1;
  /** Scelte d'aspetto della TV (GRUPPI_ASPETTO); senza, le consigliate. */
  aspetto?: Aspetto;
  secondiPerSlide: number;
  slides: Slide[];
}

/** Ciò che TV e pannello dello Schermo leggono e scrivono: il negozio comune + i dati dello Schermo. */
export interface Config extends DatiSchermo, SceltaTema {
  disposizione?: DatiNegozio["disposizione"];
  negozio: Negozio;
}

export function componi(n: DatiNegozio, s: DatiSchermo): Config {
  const { disposizione, negozio } = n;
  const { aspetto, secondiPerSlide, slides } = s;
  return { versione: 1, ...sceltaTema(n), ...(disposizione ? { disposizione } : {}), negozio, ...(aspetto ? { aspetto } : {}), secondiPerSlide, slides };
}

export function dividi(c: Config): { negozio: DatiNegozio; schermo: DatiSchermo } {
  const { disposizione, negozio, aspetto, secondiPerSlide, slides } = c;
  return {
    negozio: { versione: 1, negozio, ...sceltaTema(c), ...(disposizione ? { disposizione } : {}) },
    schermo: { versione: 1, ...(aspetto ? { aspetto } : {}), secondiPerSlide, slides },
  };
}
