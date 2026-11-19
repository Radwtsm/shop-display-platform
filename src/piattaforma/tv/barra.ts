// La barra della TV, comune a tutti i servizi: ora, orari di oggi, testo che scorre, meteo. Il guscio la monta una
// volta; qui sta tutto ciò che la riguarda. Larghezze fisse (public/player.css): quando arrivano meteo o testo nulla si sposta.
import { calmo, suCalmo } from "../client/movimento.ts";
import { gradi, iconaMeteo, METEO_VECCHIO_MS, orologio, paginaTesto, statoOrari, validaMeteo, type Meteo } from "../core/barra.ts";
import type { RispostaNegozio } from "../core/negozio.ts";

export const METEO_OGNI_MS = 10 * 60_000;
/** Velocità dello scorrimento in vh al secondo: uguale per ogni lunghezza di testo. */
const VH_AL_SECONDO = 9;

const $ = (id: string) => document.getElementById(id)!;

export function avviaBarra() {
  let n: RispostaNegozio | null = null;
  let meteo: Meteo | null = null;
  let testoMostrato = "";

  function testo(ora: number) {
    const t = n?.negozio.barra?.testo ?? "";
    $("b-testo").hidden = !t;
    if (!t) return void ($("b-testo-t").textContent = "");
    const scritta = calmo() ? paginaTesto(t, ora) : t;
    const chiave = `${calmo() ? "p" : "s"}${scritta}`;
    if (chiave === testoMostrato) return;
    testoMostrato = chiave;
    const el = $("b-testo-t");
    el.textContent = scritta;
    el.style.removeProperty("--scorri-durata");
    el.dataset.scorre = "0";
    if (calmo()) return;
    // scorre solo se non ci sta; la durata dipende dalla lunghezza, quindi la velocità è sempre quella
    requestAnimationFrame(() => {
      const spazio = $("b-testo").clientWidth;
      if (el.scrollWidth <= spazio) return;
      const px = spazio + el.scrollWidth;
      const vh = px / (innerHeight / 100);
      el.style.setProperty("--scorri-durata", `${Math.round(vh / VH_AL_SECONDO)}s`);
      el.dataset.scorre = "1";
    });
  }

  function disegnaMeteo(ora: number) {
    const ce = !!n?.negozio.citta;
    $("b-meteo").hidden = !ce;
    if (!ce) return;
    const m = meteo;
    $("b-meteo").dataset.stato = !m ? "attesa" : ora - m.aggiornato > METEO_VECCHIO_MS ? "vecchio" : "ok";
    // un cambio di icona sposta solo il <use>: la scatola resta quella
    $("b-icona-uso").setAttribute("href", m ? `#m-${iconaMeteo(m.codice, m.giorno)}` : "#m-nuvole");
    $("b-gradi").textContent = m ? gradi(m.temperatura) : "";
    $("b-meteo").setAttribute("aria-label", m ? `Fuori ${gradi(m.temperatura)}` : "");
  }

  function giro(ora: number) {
    if (!n) return;
    $("b-ora").textContent = orologio(ora);
    const s = statoOrari(n.negozio.orari, ora);
    $("b-orari").hidden = !s;
    $("b-orari").textContent = s;
    $("b-orari").dataset.aperto = s.startsWith("Aperto") ? "1" : "0";
    testo(ora);
    disegnaMeteo(ora);
  }

  async function scaricaMeteo() {
    if (!n?.negozio.citta) return;
    try {
      const r = await fetch("/api/meteo", { cache: "no-store" });
      const j = (await r.json()) as unknown;
      if (r.ok && validaMeteo(j)) meteo = j;
    } catch {
      // rete o server giù: resta l'ultimo valore, stesso spazio
    }
    giro(Date.now());
  }

  setInterval(() => giro(Date.now()), 1000);
  setInterval(() => void scaricaMeteo(), METEO_OGNI_MS);
  suCalmo(() => {
    testoMostrato = "";
    giro(Date.now());
  });

  return {
    /** Il negozio è cambiato (o è lo stesso). */
    negozio(nuovo: RispostaNegozio) {
      const primaCitta = n?.negozio.citta ? `${n.negozio.citta.lat},${n.negozio.citta.lon}` : "";
      n = nuovo;
      const cittaOra = nuovo.negozio.citta ? `${nuovo.negozio.citta.lat},${nuovo.negozio.citta.lon}` : "";
      if (cittaOra !== primaCitta) {
        meteo = null;
        void scaricaMeteo();
      }
      testoMostrato = "";
      giro(Date.now());
    },
  };
}
