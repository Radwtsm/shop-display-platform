// Contratto tra il guscio del pannello (public/panel.html) e i servizi. Un servizio con una parte nel pannello
// esporta da `src/servizi/<id>/pannello.ts` una costante `servizioPannello`; il guscio gli dà una sezione.
import type { DatiNegozio, RispostaNegozio } from "../core/negozio.ts";
import type { IdServizio } from "../core/servizi.ts";

export type Esito = { ok: true } | { ok: false; errore: string };

/** Il messaggio quando il telefono non raggiunge il server: uguale per tutti i servizi. */
export const NON_RAGGIUNGIBILE = "Non riesco a raggiungere la TV. Controlla di essere sulla Wi-Fi del negozio.";

export interface ContestoPannello {
  /** Il token del pannello (dal link), o "" se manca: va in `X-Token` in ogni scrittura. */
  token(): string;
  /** Il negozio com'è adesso (nome, logo, colori, tema, QR, disposizione). */
  negozio(): RispostaNegozio;
  /** I servizi che hanno una sezione in questo pannello, nell'ordine del catalogo. */
  servizi(): IdServizio[];
  /** Salva il negozio (PUT /api/negozio, validato dal server) e aggiorna barra e colori del pannello. */
  salvaNegozio(dati: DatiNegozio): Promise<Esito>;
  /** Il servizio ha salvato per conto suo dati che contengono anche il negozio (es. /api/config dello Schermo). */
  negozioCambiato(dati: DatiNegozio): void;
  /** Striscia di avviso in alto; con `riprova` compare il bottone "Riprova". */
  avviso(testo: string, riprova?: () => void): void;
  nascondiAvviso(): void;
  /** Conferma in basso per 6 secondi; con `annulla` compare "Annulla". */
  toast(testo: string, annulla?: () => void): void;
}

export interface ServizioPannello {
  id: IdServizio;
  /**
   * Chiamata UNA volta, quando il cliente ha il servizio attivo. Costruisce la sua parte dentro `sezione` (un
   * elemento solo suo, dentro `<main>`, sotto la barra con nome e logo del negozio) e da lì in poi la gestisce.
   * Fogli e dialoghi (`<dialog>`) li mette dentro la sezione.
   */
  montaPannello(sezione: HTMLElement, ctx: ContestoPannello): void | Promise<void>;
}
