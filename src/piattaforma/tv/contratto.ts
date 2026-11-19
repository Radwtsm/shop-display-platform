// Contratto tra il guscio della TV (public/player.html) e i servizi. Un servizio con uno schermo sulla TV
// esporta da `src/servizi/<id>/tv.ts` una costante `servizioTv`; il guscio gli dà una zona e basta.
import type { RispostaNegozio } from "../core/negozio.ts";
import type { IdServizio } from "../core/servizi.ts";

export interface ContestoTv {
  /** Il negozio com'è adesso: nome, logo, colori, tema, QR, disposizione (e quali servizi sono attivi). */
  negozio(): RispostaNegozio;
  /** `ascolta` parte subito e poi a ogni cambio del negozio. */
  sulNegozio(ascolta: (n: RispostaNegozio) => void): void;
  /**
   * Il servizio dice se l'ultima richiesta al server è riuscita. Se per 60 s nessuna riesce, compare il pallino
   * rosso della TV offline. Un servizio che parla col server lo chiama sempre, altrimenti non si accorge di nulla.
   */
  rete(ok: boolean): void;
  /**
   * Il servizio prende tutto lo schermo per PRIMO_PIANO_MS (zone.ts), poi torna com'era; una nuova chiamata
   * riparte da capo. Con un solo servizio sulla TV non fa nulla: lo schermo è già suo.
   */
  primoPiano(): void;
  /**
   * Quante pagine il servizio fa girare e quanti secondi dura ognuna (sempre con `indiceCorrente`, così TV e
   * pallini contano lo stesso tempo). Si può chiamare a ogni giro: il guscio ridisegna solo se cambia. Senza
   * chiamarla il servizio vale una pagina. Serve ai pallini del piede (A136(9)).
   */
  pagine(totale: number, secondi: number): void;
}

export interface ServizioTv {
  id: IdServizio;
  /**
   * Chiamata UNA volta, quando il cliente ha il servizio attivo. Mette il suo contenuto dentro `zona` (un
   * elemento solo suo, fino a mezzo contenuto se la disposizione è "affiancato") e da lì in poi lo aggiorna da solo.
   * Niente dati o ascoltatori fuori da `zona` tranne gli attributi `data-*` del body che già usa. Il QR sta nel
   * piede e i riquadri nella colonna destra della griglia (player.css): la zona non ci finisce mai sotto, non deve lasciare
   * spazio. `zona.dataset.forma` dice come si vede (FormaZona in zone.ts): lo stile del servizio si adatta con
   * `.zona[data-forma="riquadro"] …` (il guscio sposta la zona nella colonna destra, `#lato`).
   */
  monta(zona: HTMLElement, ctx: ContestoTv): void;
  /**
   * Il servizio sa stare in un riquadro piccolo, sempre visibile nella colonna destra, mentre gli altri girano o
   * stanno affiancati: per cose che non possono sparire per 20 s, come il numero dell'Eliminacode.
   */
  riquadro?: boolean;
  /** Come si chiama per chi guarda la TV, accanto ai pallini ("Menu 2/3"): parole del negozio, non del prodotto. */
  etichetta?: string;
  /**
   * QR che il servizio vuole nel piede quando il negozio non ne ha impostato uno suo. L'indirizzo è dello stesso
   * server della TV, non scritto da nessuno: per questo non passa dalla regola "solo https" del QR del negozio.
   */
  qrPredefinito?(origine: string): { url: string; testo: string };
}
