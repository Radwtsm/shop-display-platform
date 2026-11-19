// L'Eliminacode sulla TV: "Ora serviamo 42" enorme, con il banco, gli ultimi chiamati e il ritmo (coda viva, A138). Si monta nella sua zona del guscio: da solo,
// accanto allo Schermo, o con altri servizi "intero" in un riquadro fisso; a ogni numero nuovo prende lo schermo
// per qualche secondo (primo piano). Nome, logo, colori e QR sono del guscio.
import { frammento } from "../../piattaforma/client/dom.ts";
import type { ContestoTv, ServizioTv } from "../../piattaforma/tv/contratto.ts";
import { adattaZona } from "../../piattaforma/tv/adatta.ts";
import { PRIMO_PIANO_MS } from "../../piattaforma/tv/zone.ts";
import { anima } from "../../piattaforma/client/movimento.ts";
import { ascolta, cache, leggi, minutiTesto, salvaCache } from "./core/client.ts";
import { descrivi, NUMERO_MAX, type DatiEliminacode } from "./core/tipi.ts";
import { ritmo } from "./core/valida.ts";
import { MARKUP_TV } from "./tv-markup.ts";

/** Il numero arriva con gli eventi del server; questa lettura è solo di riserva (eventi bloccati da una rete strana). */
const RISERVA_MS = 20_000;
/** Il ritmo dipende dall'ora (chiamate vecchie non contano): si ricalcola anche se non arriva niente. */
const RITMO_MS = 30_000;

const FOGLIO = "/eliminacode-tv.css";

// il vecchio numero esce in alto, il nuovo entra dal basso (mockup A138)

/** Un "din-don" leggero con WebAudio (nessun file). Se il browser blocca l'audio senza un tocco, non succede nulla. */
function creaSuono() {
  let audio: AudioContext | null = null;
  const nuovo = () => {
    try {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return C ? new C() : null;
    } catch {
      return null;
    }
  };
  // un tocco o un tasto del telecomando sblocca l'audio per sempre
  const sblocca = () => {
    audio ??= nuovo();
    void audio?.resume().catch(() => undefined);
  };
  for (const e of ["pointerdown", "keydown"]) document.addEventListener(e, sblocca, { once: true });

  return async function suona(): Promise<boolean> {
    audio ??= nuovo();
    if (!audio) return false;
    try {
      // senza un tocco prima, resume() resta in attesa: non si aspetta oltre
      if (audio.state !== "running") await Promise.race([audio.resume(), new Promise((ok) => setTimeout(ok, 250))]);
      if (audio.state !== "running") return false;
      const t0 = audio.currentTime;
      [659.25, 523.25].forEach((hz, i) => {
        const osc = audio!.createOscillator();
        const volume = audio!.createGain();
        osc.type = "sine";
        osc.frequency.value = hz;
        const inizio = t0 + i * 0.28;
        volume.gain.setValueAtTime(0.0001, inizio);
        volume.gain.exponentialRampToValueAtTime(0.12, inizio + 0.03);
        volume.gain.exponentialRampToValueAtTime(0.0001, inizio + 0.9);
        osc.connect(volume).connect(audio!.destination);
        osc.start(inizio);
        osc.stop(inizio + 1);
      });
      return true;
    } catch {
      return false;
    }
  };
}

function monta(zona: HTMLElement, ctx: ContestoTv) {
  // Foglio di stile solo dell'Eliminacode (public/eliminacode-tv.css): un file, non un foglio costruito dal codice,
  // perché Safari applica la CSP `style-src 'self'` anche a quelli. La zona compare quando il foglio è caricato.
  const foglio = document.createElement("link");
  foglio.rel = "stylesheet";
  foglio.href = FOGLIO;
  zona.append(frammento(MARKUP_TV));
  const radice = zona.querySelector<HTMLElement>(".eq-tv")!;
  radice.hidden = true;
  const mostraZona = () => (radice.hidden = false);
  foglio.addEventListener("load", mostraZona);
  foglio.addEventListener("error", mostraZona);
  document.head.append(foglio);
  const numero = zona.querySelector<HTMLElement>(".eq-numero")!;
  const cifre = zona.querySelector<HTMLElement>(".eq-cifre")!;
  const banco = zona.querySelector<HTMLElement>(".eq-banco")!;
  const prima = zona.querySelector<HTMLElement>(".eq-prima")!;
  const serviti = zona.querySelector<HTMLElement>(".eq-serviti")!;
  const passo = zona.querySelector<HTMLElement>(".eq-passo")!;
  const barra = zona.querySelector<HTMLElement>(".eq-barra i")!;
  const adatta = adattaZona(zona);
  const suona = creaSuono();
  let mostrati: DatiEliminacode | null = null;
  let etag = "";

  function scorri(testo: string) {
    const vecchio = cifre.textContent ?? "";
    cifre.textContent = testo;
    if (vecchio === testo) return;
    const via = document.createElement("span");
    via.className = "eq-via";
    via.textContent = vecchio;
    numero.append(via);
    const a = anima(via, "esce-in-alto", { durata: "scorre", resta: true });
    if (!a) return via.remove(); // movimento ridotto o durata 0
    a.onfinish = () => via.remove();
    anima(cifre, "entra-dal-basso", { durata: "scorre" });
  }

  function disegnaRitmo() {
    if (!mostrati) return;
    const r = ritmo(mostrati, Date.now());
    serviti.textContent = r.serviti ? `${r.serviti} serviti oggi` : "";
    passo.textContent = r.minuti === null ? "" : `1 ogni ${minutiTesto(r.minuti)} min`;
  }

  function mostra(d: DatiEliminacode) {
    const ieri = mostrati;
    mostrati = d;
    scorri(d.numero === 0 ? "—" : String(d.numero));
    banco.textContent = d.banchi.length > 1 && d.numero > 0 ? d.banchi[d.banco]! : "";
    const storico = d.storico ?? [];
    prima.replaceChildren(
      ...(storico.length ? [Object.assign(document.createElement("span"), { textContent: "Prima:" })] : []),
      ...storico.map((n) => Object.assign(document.createElement("span"), { className: "eq-chip", textContent: String(n) })),
    );
    disegnaRitmo();
    radice.setAttribute("aria-label", descrivi(d));
    adatta();
    if (!ieri || (ieri.numero === d.numero && ieri.banco === d.banco)) return; // la prima volta niente festa
    // il suono solo quando si chiama qualcuno (non per "Indietro" o "Azzera")
    const avanti = d.numero > ieri.numero || (ieri.numero === NUMERO_MAX && d.numero === 1);
    if (!avanti) return;
    ctx.primoPiano(); // con altri servizi sulla TV il numero nuovo prende lo schermo per qualche secondo
    anima(barra, "riempie", { ms: PRIMO_PIANO_MS, curva: "lineare" });
    void suona().then((ok) => (radice.dataset.suono = ok ? "si" : "no"));
  }

  function nuovi(d: DatiEliminacode) {
    salvaCache(d);
    mostra(d);
  }

  // Una lettura partita prima di un evento può arrivare dopo: sarebbe più vecchia e riporterebbe indietro il numero.
  let ultimoEvento = 0;
  let linea = false;
  function evento(d: DatiEliminacode) {
    ultimoEvento = performance.now();
    nuovi(d);
  }

  async function scarica() {
    const partita = performance.now();
    const r = await leggi(etag);
    ctx.rete(r.stato !== "errore" || linea);
    if (r.stato !== "nuovo" || ultimoEvento >= partita) return;
    etag = r.etag;
    nuovi(r.dati);
  }

  const vecchio = cache();
  if (vecchio) mostra(vecchio);
  ascolta(evento, (ok) => {
    linea = ok;
    if (ok) ctx.rete(true);
  });
  void scarica();
  // con la linea aperta non serve leggere, ma il guscio va avvisato lo stesso: a coda ferma non arrivano eventi
  // (il ": vivo" del server non arriva al codice) e dopo 60 s la TV si direbbe offline (bug 12/11)
  setInterval(() => (linea ? ctx.rete(true) : void scarica()), RISERVA_MS);
  setInterval(disegnaRitmo, RITMO_MS);
}

export const servizioTv: ServizioTv = { id: "eliminacode", monta, riquadro: true };
