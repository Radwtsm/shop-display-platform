// DATI DI ESEMPIO (finti): usati da test, demo e schermate. Nessun dato di un cliente vero.
import type { DatiVetrina } from "../core/tipi.ts";

export const BASE: DatiVetrina = {
  versione: 1,
  storia: { anno: 1987, testo: "Dal 1987 facciamo il pane come una volta.", foto: "0123456789abcdef.jpg" },
  placeId: "ChIJ-esempio_FINTO123",
  wifi: { ssid: "Panificio Ospiti", password: "pane-caldo-24" },
  instagram: "panificio.demo",
  orari: [{ giorni: [1, 2, 3, 4, 5, 6], da: "07:00", a: "19:30" }],
  contatti: { indirizzo: "Via del Forno 12, 00100 Roma", telefono: "06 1234567", email: "ciao@panificio-demo.example" },
  linkMenu: "/menu.html",
  secondiPerSlide: 10,
};
