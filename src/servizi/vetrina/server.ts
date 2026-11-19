// Rotte della Vetrina. /api/vetrina (token) = i dati per il pannello; /api/vetrina/tv e /api/vetrina/sito = ciò che
// mostrano TV e sito, senza token (come la config dello Schermo). La password del Wi-Fi esce solo da /api/vetrina
// (token) e da /tv (la TV è in negozio, e il QR sul cartello la rende comunque visibile ai clienti); /sito non la dà mai.
import { dentro } from "../../piattaforma/server/app.ts";
import type { Cliente } from "../../piattaforma/server/archivio.ts";
import type { Contesto, ModuloServer } from "../../piattaforma/server/modulo.ts";
import { validaNegozio } from "../../piattaforma/core/negozio.ts";
import { linkMappe, vociQr } from "./core/qr.ts";
import { LINK_MENU_PREDEFINITO, type DatiVetrina, type RispostaVetrina } from "./core/tipi.ts";
import { valida, validaVetrina } from "./core/valida.ts";
import { recensioni, type Opzioni } from "./recensioni.ts";

export function leggiVetrina(cliente: Cliente, prec = false): DatiVetrina | null {
  try {
    const v = validaVetrina(JSON.parse(cliente.leggi("vetrina", prec) ?? "null"));
    return v.ok ? v.dati : null;
  } catch {
    return null;
  }
}

/** Opzioni delle recensioni: i test mettono qui una `fetch` finta o una chiave; in produzione non si toccano. */
export const opzioniRecensioni: Opzioni = {};

export async function risposta(cliente: Cliente, d: DatiVetrina, conWifi: boolean): Promise<RispostaVetrina> {
  const n = validaNegozio(JSON.parse(cliente.leggi("negozio") ?? "null"));
  const nome = n.ok ? n.dati.negozio.nome : undefined;
  const mappe = linkMappe(d.contatti, d.placeId, nome);
  return {
    ...(d.storia ? { storia: d.storia } : {}),
    orari: d.orari,
    contatti: d.contatti,
    linkMenu: d.linkMenu,
    ...(mappe ? { mappe } : {}),
    qr: vociQr(d, conWifi),
    recensioni: await recensioni(d.placeId, opzioniRecensioni),
    secondiPerSlide: d.secondiPerSlide,
  };
}

async function salva(c: Contesto): Promise<void> {
  if (!c.autorizzato()) return;
  const corpo = await c.leggiCorpo();
  if (corpo === null) return c.json(413, { errori: ["Dati troppo grandi"] });
  let dati: unknown;
  try {
    dati = JSON.parse(corpo.toString("utf8"));
  } catch {
    return c.json(400, { errori: ["Dati non leggibili"] });
  }
  const esito = validaVetrina(dati);
  if (!esito.ok) return c.json(422, { errori: esito.errori });
  const foto = esito.dati.storia?.foto;
  if (foto && !dentro(c.cliente.foto, foto)) return c.json(422, { errori: ["Foto della storia non trovata, caricala di nuovo"] });
  c.cliente.scrivi("vetrina", JSON.stringify(esito.dati, null, 2));
  c.puliziaFoto();
  c.json(200, esito.dati);
}

export const modulo: ModuloServer = {
  id: "vetrina",
  valida: (dati) => valida(dati),
  iniziali: () =>
    ({
      versione: 1,
      orari: [{ giorni: [1, 2, 3, 4, 5, 6], da: "07:00", a: "19:30" }],
      contatti: {},
      linkMenu: LINK_MENU_PREDEFINITO,
      secondiPerSlide: 10,
    }) satisfies DatiVetrina,
  // demo e kit proposta (A102): valgono per ogni settore, si riscrivono alla visita dal pannello
  esempio: () =>
    ({
      versione: 1,
      storia: { anno: 1987, testo: "Siamo nel quartiere dal 1987. Qui raccontate chi siete e cosa vi rende diversi." },
      placeId: "ChIJ-esempio_FINTO123",
      instagram: "il.vostro.negozio",
      orari: [{ giorni: [1, 2, 3, 4, 5, 6], da: "07:00", a: "19:30" }],
      contatti: { indirizzo: "Via Esempio 12, 00100 Roma" },
      linkMenu: LINK_MENU_PREDEFINITO,
      secondiPerSlide: 10,
    }) satisfies DatiVetrina,
  async gestisci(c) {
    const p = c.percorso;
    if (p !== "/api/vetrina" && p !== "/api/vetrina/tv" && p !== "/api/vetrina/sito") return false;
    if (p === "/api/vetrina" && c.req.method === "PUT") return void (await salva(c)), true;
    if (c.req.method !== "GET") return c.json(405, { errori: ["Metodo non permesso"] }), true;
    if (p === "/api/vetrina" && !c.autorizzato()) return true;
    const d = leggiVetrina(c.cliente);
    if (!d) return c.invia(404, "Non trovato", "text/plain; charset=utf-8"), true;
    c.json(200, p === "/api/vetrina" ? d : await risposta(c.cliente, d, p === "/api/vetrina/tv"), { "Cache-Control": "no-store" });
    return true;
  },
  fotoUsate: (cliente) => [leggiVetrina(cliente)?.storia?.foto, leggiVetrina(cliente, true)?.storia?.foto].filter((f): f is string => !!f),
};
