// La Vetrina sulla TV: storia, QR (recensione, Wi-Fi, Instagram) e «Dicono di noi», a rotazione nella sua zona.
// Nome, logo, colori e il QR d'angolo sono del negozio e li disegna il guscio.
import { frammento } from "../../piattaforma/client/dom.ts";
import { indiceCorrente } from "../../piattaforma/core/orario.ts";
import { percorsoQr } from "../../piattaforma/core/qr.ts";
import type { ContestoTv, ServizioTv } from "../../piattaforma/tv/contratto.ts";
import { anima } from "../../piattaforma/client/movimento.ts";
import { adattaZona } from "../../piattaforma/tv/adatta.ts";
import { schermate, stelle, type Schermata } from "./core/schermate.ts";
import type { RispostaVetrina } from "./core/tipi.ts";
import { validaRisposta } from "./core/valida.ts";
import { MARKUP_TV } from "./tv-markup.ts";

const AGGIORNA_MS = 10_000;
const CHIAVE_CACHE = "vetrina.tv";
const FOGLIO = "/vetrina-tv.css";
const MARGINE_QR = 2; // zona di silenzio: senza bordo chiaro molti telefoni non lo leggono

function dallaCache(): RispostaVetrina | null {
  try {
    const e = validaRisposta(JSON.parse(localStorage.getItem(CHIAVE_CACHE) ?? "null"));
    return e.ok ? e.dati : null;
  } catch {
    return null;
  }
}

function monta(zona: HTMLElement, ctx: ContestoTv) {
  // Il foglio di stile è un file solo della Vetrina (public/vetrina-tv.css): la zona compare quando è caricato.
  const foglio = document.createElement("link");
  foglio.rel = "stylesheet";
  foglio.href = FOGLIO;
  document.head.append(foglio);
  zona.append(frammento(MARKUP_TV));
  const adatta = adattaZona(zona);
  const radice = zona.querySelector<HTMLElement>(".v-tv")!;
  const $ = (c: string) => radice.querySelector<HTMLElement>(`.${c}`)!;
  let dati: RispostaVetrina | null = dallaCache();
  let corpo = "";
  let mostrata = "";
  let pronta = false;

  async function scarica() {
    try {
      const r = await fetch("/api/vetrina/tv", { cache: "no-store" });
      if (r.status === 200) {
        const testo = await r.text();
        if (testo !== corpo) {
          const e = validaRisposta(JSON.parse(testo));
          if (e.ok) {
            corpo = testo;
            dati = e.dati;
            mostrata = "";
            try {
              localStorage.setItem(CHIAVE_CACHE, testo);
            } catch {
              // memoria piena o bloccata: si continua con quella in uso
            }
            if (dati.storia?.foto) new Image().src = `/foto/${encodeURIComponent(dati.storia.foto)}`;
          }
        }
      }
      ctx.rete(r.ok);
    } catch {
      ctx.rete(false); // rete o server giù: si continua con l'ultima versione buona
    }
  }

  function disegnaQr(s: Extract<Schermata, { tipo: "qr" }>) {
    $("v-qr").querySelector(".v-titolo")!.textContent = s.voce.titolo;
    $("v-sotto").textContent = s.voce.sotto;
    const q = percorsoQr(s.voce.testo);
    const svg = $("v-svg");
    svg.setAttribute("viewBox", `${-MARGINE_QR} ${-MARGINE_QR} ${q.lato + 2 * MARGINE_QR} ${q.lato + 2 * MARGINE_QR}`);
    svg.querySelector("path")!.setAttribute("d", q.d);
  }

  function disegnaRecensioni(s: Extract<Schermata, { tipo: "recensioni" }>) {
    $("v-media").textContent = s.media ? `${s.media.toLocaleString("it-IT", { minimumFractionDigits: 1 })} su 5${s.totale ? ` · ${s.totale} recensioni` : ""}` : "";
    $("v-elenco").replaceChildren(
      ...s.recensioni.map((r) => {
        const li = document.createElement("li");
        const voto = document.createElement("span");
        voto.className = "v-voto";
        voto.textContent = stelle(r.voto);
        voto.setAttribute("role", "img");
        voto.setAttribute("aria-label", `${r.voto} stelle su 5`);
        const t = document.createElement("p");
        t.className = "v-rtesto";
        Object.assign(t.dataset, { righe: "5", min: "3.6" });
        t.textContent = `“${r.testo}”`;
        const chi = document.createElement("p");
        chi.className = "v-autore";
        chi.textContent = [r.autore, r.quando].filter(Boolean).join(" · ");
        li.append(voto, ...(r.testo ? [t] : []), chi);
        return li;
      }),
    );
    $("v-fonte").textContent = s.finte ? "Recensioni di esempio" : "Recensioni da Google";
    $("v-rec").dataset.testo = s.recensioni.some((r) => r.testo) ? "1" : "0"; // senza testo le stelle diventano grandi
  }

  function disegna(s: Schermata | undefined) {
    const chiave = JSON.stringify(s ?? null);
    if (chiave === mostrata) return;
    const cambio = mostrata !== "" && mostrata !== "null" && !!s; // la prima comparsa non si anima
    mostrata = chiave;
    for (const c of ["v-storia", "v-qr", "v-rec"]) $(c).hidden = true;
    radice.hidden = !s || !pronta;
    if (!s) return;
    radice.dataset.schermata = s.tipo;
    if (s.tipo === "storia") {
      $("v-storia").hidden = false;
      $("v-anno").textContent = s.storia.anno ? `Dal ${s.storia.anno}` : "";
      $("v-testo").textContent = s.storia.testo;
      const foto = $("v-foto") as HTMLImageElement;
      foto.hidden = !s.storia.foto;
      $("v-storia").dataset.foto = s.storia.foto ? "1" : "0";
      if (s.storia.foto) foto.src = `/foto/${encodeURIComponent(s.storia.foto)}`;
    } else if (s.tipo === "qr") {
      $("v-qr").hidden = false;
      disegnaQr(s);
    } else {
      $("v-rec").hidden = false;
      disegnaRecensioni(s);
    }
    adatta();
    if (cambio) anima(radice, "dissolvenza");
  }

  function giro() {
    if (!dati) return;
    const lista = schermate(dati);
    ctx.pagine(lista.length, dati.secondiPerSlide);
    disegna(lista[indiceCorrente(lista.length, Date.now(), dati.secondiPerSlide)]);
  }

  const parti = () => {
    pronta = true;
    mostrata = "";
    giro();
  };
  foglio.addEventListener("load", parti);
  foglio.addEventListener("error", parti);
  void scarica().then(giro);
  setInterval(() => void scarica(), AGGIORNA_MS);
  setInterval(giro, 1000);
}

export const servizioTv: ServizioTv = { id: "vetrina", etichetta: "Chi siamo", monta };
