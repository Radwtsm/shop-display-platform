// Lo Schermo sulla TV: offerte a rotazione o a listino. Si monta nella sua zona del guscio (public/player.html);
// nome, logo, colori, tema e QR sono del negozio e li disegna il guscio.
import { frammento } from "../../piattaforma/client/dom.ts";
import { indiceCorrente } from "../../piattaforma/core/orario.ts";
import { formatta } from "../../piattaforma/core/prezzo.ts";
import { descriviQuantita, prezzoPerUnita } from "../../piattaforma/core/unita.ts";
import type { ContestoTv, ServizioTv } from "../../piattaforma/tv/contratto.ts";
import { adattaZona } from "../../piattaforma/tv/adatta.ts";
import { paginaListino, pagineListino } from "./core/aspetto.ts";
import { animaEntrata, applicaAspetto, cache, salvaCache } from "./core/client.ts";
import { slideAttive } from "./core/offerte.ts";
import type { Config, Slide } from "./core/tipi.ts";
import { valida } from "./core/valida.ts";
import { MARKUP_TV } from "./tv-markup.ts";

const AGGIORNA_MS = 5000;

const prezzoTesto = (s: Slide) => (s.prezzo !== undefined ? formatta(s.prezzo) : "");
function unitaTesto(s: Slide) {
  const u = s.prezzo !== undefined && s.quantita ? prezzoPerUnita(s.prezzo, s.quantita) : null;
  return u && s.quantita ? `${descriviQuantita(s.quantita)} · ${formatta(u.centesimi)}/${u.per}` : "";
}

function monta(zona: HTMLElement, ctx: ContestoTv) {
  zona.append(frammento(MARKUP_TV));
  const adatta = adattaZona(zona);
  const $ = (id: string) => zona.querySelector<HTMLElement>(`#${id}`)!;
  let config: Config | null = cache();
  let etag = "";
  let mostrata = "";

  async function scarica() {
    try {
      // /api/config: il percorso della versione prima, che le TV già installate usano ancora
      const r = await fetch("/api/config", { headers: etag ? { "If-None-Match": etag } : {}, cache: "no-store" });
      if (r.status === 200) {
        const e = valida(await r.json());
        if (e.ok) {
          config = e.config;
          etag = r.headers.get("ETag") ?? "";
          salvaCache(config);
          mostrata = "";
          precarica(config);
        }
      }
      ctx.rete(r.ok || r.status === 304);
    } catch {
      ctx.rete(false); // rete o server giù: si continua con l'ultima configurazione buona
    }
  }

  /** Tutte le foto in memoria subito: nessun buco quando cambia offerta, e restano anche se cade la rete. */
  function precarica(c: Config) {
    for (const s of c.slides) if (s.foto) new Image().src = `/foto/${encodeURIComponent(s.foto)}`;
  }

  /** Listino: più offerte insieme, a righe; con tante offerte le pagine girano. */
  function mostraListino(c: Config, voci: Slide[]) {
    const chiave = JSON.stringify([c.aspetto, voci]);
    if (chiave === mostrata) return;
    const primaPagina = $("righe").dataset.pagina;
    mostrata = chiave;
    applicaAspetto(document.body, c.aspetto);
    $("slide").hidden = true;
    $("listino").hidden = !voci.length;
    $("riposo").hidden = !!voci.length;
    $("righe").replaceChildren(
      ...voci.map((s) => {
        const li = document.createElement("li");
        const nome = document.createElement("span");
        nome.className = "l-nome";
        Object.assign(nome.dataset, { righe: "2", min: "3" });
        nome.textContent = s.titolo;
        const sotto = document.createElement("span");
        sotto.className = "l-sotto";
        Object.assign(sotto.dataset, { righe: "1", min: "2.4" });
        sotto.textContent = [unitaTesto(s), s.nota].filter(Boolean).join(" · ");
        const testi = document.createElement("span");
        testi.className = "l-testi";
        testi.append(nome, sotto);
        const prezzo = document.createElement("span");
        prezzo.className = "l-prezzo";
        prezzo.dataset.larghezza = "";
        prezzo.textContent = prezzoTesto(s);
        li.append(testi, prezzo);
        return li;
      }),
    );
    const pagina = voci.map((s) => s.id).join(",");
    if (primaPagina && primaPagina !== pagina) animaEntrata([$("listino")], c.aspetto?.passaggio);
    $("righe").dataset.pagina = pagina;
    document.body.dataset.slide = "";
    document.body.dataset.foto = "0";
    adatta();
  }

  function mostraSlide(c: Config, s: Slide | undefined) {
    const chiave = JSON.stringify([c.aspetto, s]);
    if (chiave === mostrata) return;
    mostrata = chiave;
    applicaAspetto(document.body, c.aspetto);
    $("listino").hidden = true;
    $("righe").dataset.pagina = "";
    $("slide").hidden = !s;
    $("riposo").hidden = !!s;
    $("titolo").textContent = s?.titolo ?? "";
    $("prezzo").textContent = s ? prezzoTesto(s) : "";
    $("per-unita").textContent = s ? unitaTesto(s) : "";
    $("nota").textContent = s?.nota ?? "";
    const foto = $("foto") as HTMLImageElement;
    foto.hidden = !s?.foto;
    document.body.dataset.foto = s?.foto ? "1" : "0";
    if (s?.foto) foto.src = `/foto/${encodeURIComponent(s.foto)}`;
    if (s && document.body.dataset.slide && document.body.dataset.slide !== s.id) animaEntrata([$("slide")], c.aspetto?.passaggio);
    document.body.dataset.slide = s?.id ?? "";
    adatta();
  }

  function giro() {
    if (!config) return;
    const ora = Date.now();
    const attive = slideAttive(config, ora);
    const listino = config.aspetto?.layout === "listino";
    ctx.pagine(listino ? pagineListino(attive.length) : attive.length, config.secondiPerSlide);
    if (listino) mostraListino(config, paginaListino(attive, ora, config.secondiPerSlide));
    else mostraSlide(config, attive[indiceCorrente(attive.length, ora, config.secondiPerSlide)]);
  }

  void scarica().then(giro);
  setInterval(() => void scarica(), AGGIORNA_MS);
  setInterval(giro, 1000);
  giro();
}

export const servizioTv: ServizioTv = { id: "schermo", etichetta: "Offerte", monta };
