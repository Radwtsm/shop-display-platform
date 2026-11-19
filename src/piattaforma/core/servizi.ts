// Catalogo dei servizi dell'agenzia: uno solo per piattaforma, dashboard e pannello.
// Un servizio nuovo = una voce qui; "attivo" o "in arrivo" lo dicono i dati (se qualche cliente lo usa), non il catalogo.

export type IdServizio =
  | "schermo" | "eliminacode" | "menu-qr" | "haccp" | "fidelity" | "prenotazioni" | "magazzino" | "it-gestito" | "vetrina";

/** Come si chiamano i dispositivi del servizio, con le parole del negozio (accordate al nome). */
export interface ParoleDispositivo {
  plurale: string;
  acceso: string;
  spento: string;
  cosaFare: string;
}

export interface Servizio {
  id: IdServizio;
  nome: string;
  /** Una riga: cosa fa per il negozio. */
  cosa: string;
  /** Solo per i servizi con apparecchi in negozio (TV, display, sensori). */
  dispositivi?: ParoleDispositivo;
}

export const SERVIZI: readonly Servizio[] = [
  { id: "schermo", nome: "Schermo", cosa: "Offerte e prezzi sulla TV, cambiati dal telefono",
    dispositivi: { plurale: "TV", acceso: "Accesa", spento: "Spenta", cosaFare: "Chiama il negozio: spesso è la TV staccata o la Wi-Fi cambiata." } },
  { id: "eliminacode", nome: "Eliminacode", cosa: "Il numerino: chiama il prossimo cliente",
    dispositivi: { plurale: "display", acceso: "Acceso", spento: "Spento", cosaFare: "Chiama il negozio: il display è staccato o senza Wi-Fi." } },
  { id: "menu-qr", nome: "Menu QR", cosa: "Menu e allergeni dal telefono del cliente" },
  { id: "haccp", nome: "Temperature HACCP", cosa: "Registro dei frigo con avvisi",
    dispositivi: { plurale: "sensori", acceso: "Attivo", spento: "Fermo", cosaFare: "Controlla la batteria o la Wi-Fi del sensore." } },
  { id: "fidelity", nome: "Fidelity nel Wallet", cosa: "Tessera punti senza app da installare" },
  { id: "prenotazioni", nome: "Prenotazioni", cosa: "Appuntamenti con promemoria" },
  { id: "magazzino", nome: "Magazzino", cosa: "Scorte ed etichette con codice a barre" },
  { id: "it-gestito", nome: "IT gestito", cosa: "Backup, NAS e accesso remoto per l'ufficio",
    dispositivi: { plurale: "apparati", acceso: "Attivo", spento: "Fermo", cosaFare: "Controlla corrente e rete dell'apparato." } },
  { id: "vetrina", nome: "Pacchetto vetrina", cosa: "Sito, profilo Google e recensioni" },
];

const PER_ID = new Map(SERVIZI.map((s) => [s.id, s]));

export function servizio(id: IdServizio): Servizio {
  const s = PER_ID.get(id);
  if (!s) throw new Error(`servizio sconosciuto: ${id}`);
  return s;
}
