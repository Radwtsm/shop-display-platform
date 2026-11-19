// A101 Analisi gratuita della presenza online: dai dati PUBBLICI (Google Places + il sito misurato) a un giudizio per voce
// e a "cosa vi manca", collegato ai nostri servizi. Puro: niente rete, niente browser (li fa scripts/analisi.ts).
import { oggetto } from "../../src/piattaforma/core/negozio.ts";

export interface Profilo {
  fonte: "google" | "esempio";
  nome: string;
  categoria: string; // come la scrive Google ("Panetteria"), vuota se non c'è
  tipo: string; // tipo primario di Google ("bakery"), per capire se fa cibo
  orari: boolean;
  foto: number; // Google ne restituisce al massimo 10: 10 = "10 o più"
  recensioni: number;
  media: number | null;
  sito: string;
}

export interface Sito {
  indirizzo: string;
  raggiunto: boolean;
  mobile: boolean; // viewport per telefono e niente scorrimento di lato a 375 px
  lcpMs: number | null; // Largest Contentful Paint dal nostro computer, su telefono simulato
  problemi: number; // violazioni axe gravi o critiche
  contrasto: number; // elementi con contrasto insufficiente (axe color-contrast)
}

export type Esito = "bene" | "migliorabile" | "manca";
export interface Riga {
  voce: string;
  esito: Esito;
  testo: string;
}

const CIBO = /bakery|restaurant|cafe|coffee|bar|pizza|food|ice_cream|pastry|deli|meal|sandwich|confection/;
export const LCP_BENE = 2500;
export const LCP_LENTO = 4000;
const FOTO_MINIME = 10;
const RECENSIONI_MINIME = 50;
const MEDIA_BUONA = 4.5;

const testo = (x: unknown, max = 120) => (typeof x === "string" ? x.trim().slice(0, max) : "");

/** Da Place Details (Places API New) al profilo; ciò che manca resta vuoto, mai inventato. */
export function leggiProfilo(x: unknown): Profilo | null {
  if (!oggetto(x)) return null;
  const nome = oggetto(x.displayName) ? testo(x.displayName.text) : "";
  if (!nome) return null;
  const media = typeof x.rating === "number" && x.rating >= 1 && x.rating <= 5 ? x.rating : null;
  const orari = oggetto(x.regularOpeningHours) && Array.isArray(x.regularOpeningHours.weekdayDescriptions) && x.regularOpeningHours.weekdayDescriptions.length > 0;
  const sito = testo(x.websiteUri, 300);
  return {
    fonte: "google",
    nome,
    categoria: oggetto(x.primaryTypeDisplayName) ? testo(x.primaryTypeDisplayName.text, 60) : "",
    tipo: testo(x.primaryType, 60),
    orari,
    foto: Array.isArray(x.photos) ? x.photos.length : 0,
    recensioni: Number.isInteger(x.userRatingCount) && (x.userRatingCount as number) >= 0 ? (x.userRatingCount as number) : 0,
    media,
    sito: /^https?:\/\//.test(sito) ? sito : "",
  };
}

const virgola = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 });

/** Il giudizio per voce e la lista di "cosa vi manca" (nomi dei nostri servizi, senza sigle interne). */
export function valuta(p: Profilo, s: Sito | null): { righe: Riga[]; mancanze: string[] } {
  const righe: Riga[] = [];
  const manca = new Set<string>();
  const cibo = CIBO.test(p.tipo);

  righe.push({ voce: "Categoria su Google", esito: p.categoria ? "bene" : "manca", testo: p.categoria || "Non indicata: chi cerca «panetteria vicino a me» non vi trova." });
  righe.push({ voce: "Orari su Google", esito: p.orari ? "bene" : "manca", testo: p.orari ? "Presenti." : "Mancano: il cliente non sa se siete aperti." });
  if (!p.orari) manca.add("Minisito con orari sempre giusti, «aperto ora» e mappa");
  const fotoBene = p.foto >= FOTO_MINIME;
  righe.push({ voce: "Foto su Google", esito: fotoBene ? "bene" : p.foto ? "migliorabile" : "manca", testo: fotoBene ? "10 o più." : `${p.foto}: poche per far venire voglia di entrare.` });
  if (!fotoBene) manca.add("Le foto delle offerte della TV, pronte da pubblicare su Google e Instagram");

  const media = p.media === null ? "senza voto" : `media ${virgola(p.media)}`;
  const recBene = p.recensioni >= RECENSIONI_MINIME && (p.media ?? 0) >= MEDIA_BUONA;
  righe.push({ voce: "Recensioni", esito: recBene ? "bene" : p.recensioni ? "migliorabile" : "manca", testo: `${p.recensioni}, ${media}.` });
  if (!recBene) manca.add("Un QR al banco che porta i clienti contenti a lasciare la recensione");
  // Places API non dice se il negozio risponde: si guarda a mano sul profilo, mai indovinato.
  righe.push({ voce: "Risposte alle recensioni", esito: "migliorabile", testo: "Da guardare insieme sul profilo: Google non lo dice ai programmi." });
  if (p.recensioni) manca.add("Risposte alle recensioni già scritte, da approvare con un tocco");

  if (!s || !s.raggiunto) {
    righe.push({ voce: "Sito", esito: "manca", testo: s ? `${s.indirizzo} non risponde.` : "Nessun sito: su Google manca il link." });
    manca.add("Minisito con orari sempre giusti, «aperto ora» e mappa");
  } else {
    righe.push({ voce: "Sito sul telefono", esito: s.mobile ? "bene" : "manca", testo: s.mobile ? "Si legge bene." : "Va ingrandito o scorre di lato." });
    const lcp = s.lcpMs;
    const esitoLcp: Esito = lcp === null ? "migliorabile" : lcp <= LCP_BENE ? "bene" : lcp <= LCP_LENTO ? "migliorabile" : "manca";
    righe.push({ voce: "Velocità del sito", esito: esitoLcp, testo: lcp === null ? "Non misurata." : `${virgola(lcp / 1000)} s per vedere la pagina (bene sotto 2,5 s).` });
    const accBene = s.problemi === 0 && s.contrasto === 0;
    righe.push({
      voce: "Accessibilità del sito",
      esito: accBene ? "bene" : "migliorabile",
      testo: accBene ? "Nessun problema grave trovato." : `${s.problemi} problemi gravi, ${s.contrasto} testi poco leggibili (contrasto).`,
    });
    if (!s.mobile || esitoLcp !== "bene" || !accBene) manca.add("Minisito veloce, leggibile dal telefono e da tutti");
  }
  if (cibo) manca.add("Menu dal QR con i 14 allergeni, aggiornato dal telefono");
  return { righe, mancanze: [...manca] };
}

/** Senza chiave Google: un negozio DI ESEMPIO, dichiarato tale nel PDF. */
export const PROFILO_ESEMPIO: Profilo = {
  fonte: "esempio",
  nome: "Panificio Demo",
  categoria: "Panetteria",
  tipo: "bakery",
  orari: true,
  foto: 4,
  recensioni: 23,
  media: 4.3,
  sito: "",
};
