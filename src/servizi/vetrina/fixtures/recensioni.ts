// DATI DI ESEMPIO: servono finché non c'è la chiave Google (nessuna recensione vera, nessun nome vero).
// Includono anche un voto basso e uno senza testo, com'è su Google: le recensioni non si scelgono.
import type { Recensione, Recensioni } from "../core/tipi.ts";

export const RECENSIONI_FINTE: Recensione[] = [
  { autore: "Giulia R.", voto: 5, testo: "Pane sempre fragrante e personale gentilissimo. Il mio posto della domenica mattina.", quando: "2 settimane fa" },
  { autore: "Marco T.", voto: 5, testo: "I cornetti alla crema valgono il viaggio. Prezzi onesti.", quando: "un mese fa" },
  { autore: "Elena B.", voto: 4, testo: "Ottimi prodotti, il sabato però c'è un po' di coda.", quando: "un mese fa" },
  { autore: "Paolo D.", voto: 3, testo: "Buono, ma l'ho trovato chiuso all'orario scritto online.", quando: "2 mesi fa" },
  { autore: "Sara L.", voto: 5, testo: "", quando: "3 mesi fa" },
];

export const FINTE: Recensioni = { fonte: "finte", elenco: RECENSIONI_FINTE, voto: 4.4, totale: 5 };
