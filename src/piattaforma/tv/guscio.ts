// Il guscio della TV (public/player.html): ciò che è del negozio (barra con nome e logo, colori, tema, QR, pallino
// offline) e le zone dove i servizi attivi si montano. Non sa niente di nessun servizio.
import { posizioneBarra } from "../core/barra.ts";
import { validaRispostaNegozio, type RispostaNegozio } from "../core/negozio.ts";
import { origineQr, percorsoQr } from "../core/qr.ts";
import type { IdServizio } from "../core/servizi.ts";
import { applicaColori, cacheNegozio, salvaCacheNegozio } from "../client/dom.ts";
import type { ContestoTv, ServizioTv } from "./contratto.ts";
import { avviaBarra } from "./barra.ts";
import { avviaParticelle } from "./particelle.ts";
import { anima, calmo } from "../client/movimento.ts";
import { formeZone, pallini, PRIMO_PIANO_MS, sembraOffline, type PagineZona } from "./zone.ts";

const AGGIORNA_MS = 5000;
const CHIAVE_CACHE = "guscio.negozio";
const $ = (id: string) => document.getElementById(id)!;

export function avviaTv(registrati: ServizioTv[]) {
  const per = new Map(registrati.map((s) => [s.id, s]));
  let negozio = cacheNegozio(CHIAVE_CACHE);
  let etag = "";
  const ultimoOk = new Map<string, number>([["guscio", Date.now()]]);
  const ascoltatori: Array<(n: RispostaNegozio) => void> = [];
  const zone = new Map<IdServizio, HTMLElement>();
  let primoPiano: { id: IdServizio; fino: number } | null = null;
  let finePrimoPiano = 0;
  const pagine = new Map<IdServizio, PagineZona>();

  const ctxPer = (id: IdServizio): ContestoTv => {
    ultimoOk.set(id, Date.now()); // da adesso il servizio ha 60 secondi per farsi sentire
    return {
    negozio: () => negozio!,
    sulNegozio: (ascolta) => {
      ascoltatori.push(ascolta);
      if (negozio) ascolta(negozio);
    },
    rete: (ok) => {
      if (ok) ultimoOk.set(id, Date.now());
    },
    pagine: (totale, secondi) => {
      const p = pagine.get(id);
      if (p?.totale === totale && p.secondi === secondi) return;
      pagine.set(id, { totale, secondi, etichetta: per.get(id)?.etichetta });
      giroZone(); // subito, non al prossimo secondo: i pallini che arrivano dopo spostano la barra (salto)
    },
    primoPiano: () => {
      primoPiano = { id, fino: Date.now() + PRIMO_PIANO_MS };
      clearTimeout(finePrimoPiano);
      finePrimoPiano = window.setTimeout(giroZone, PRIMO_PIANO_MS);
      giroZone();
    },
    };
  };

  const barra = avviaBarra();
  const fx = avviaParticelle($("fx") as HTMLCanvasElement);

  let qrMostrato = "";
  /** Pezzi di un servizio spostati nella colonna destra (solo coda), con dove tornano. */
  const pezzi = new Map<HTMLElement, { padre: HTMLElement; dopo: Node | null }>();
  function mostraQr(n: RispostaNegozio) {
    const base = origineQr(n.origineTelefono, location.origin);
    const qr = n.negozio.qr ?? (base ? n.servizi.map((id) => per.get(id)?.qrPredefinito?.(base)).find(Boolean) : undefined);
    const chiave = JSON.stringify(qr ?? null);
    document.body.dataset.qr = qr ? "1" : "0";
    if (chiave === qrMostrato) return;
    qrMostrato = chiave;
    $("qr").hidden = !qr;
    if (!qr) return;
    const q = percorsoQr(qr.url);
    const margine = 2; // zona di silenzio: senza bordo chiaro molti telefoni non lo leggono
    $("qr-svg").setAttribute("viewBox", `${-margine} ${-margine} ${q.lato + 2 * margine} ${q.lato + 2 * margine}`);
    $("qr-path").setAttribute("d", q.d);
    $("qr-testo").textContent = qr.testo;
  }

  /** Una zona per ogni servizio attivo che il guscio conosce, nell'ordine del catalogo; si monta una volta sola. */
  function sistemaZone(n: RispostaNegozio) {
    const main = $("zone");
    const attivi = n.servizi.filter((id) => per.has(id));
    for (const [id, z] of zone)
      if (!attivi.includes(id)) {
        z.remove();
        zone.delete(id);
        ultimoOk.delete(id);
      }
    for (const id of attivi) {
      if (zone.has(id)) continue;
      const z = document.createElement("div");
      z.className = "zona";
      z.dataset.servizio = id;
      zone.set(id, z);
      main.append(z);
      per.get(id)!.monta(z, ctxPer(id));
    }
    main.append(...attivi.map((id) => zone.get(id)!)); // l'ordine è quello del catalogo anche per i servizi arrivati dopo
    main.dataset.disposizione = n.disposizione ?? "intero";
    giroZone();
  }

  /** Tema e palette: del tema o del negozio ("I miei colori": solo le decorazioni del tema). */
  function applicaTema(n: RispostaNegozio) {
    const tema = n.tema ?? "";
    const colori = n.temaColori ?? "";
    const variante = (tema && n.temaVariante) || "";
    const b = document.body.dataset;
    if (b.tema === tema && b.temaColori === colori && (b.temaVariante ?? "") === variante) return;
    b.tema = tema;
    b.temaColori = colori;
    if (variante) b.temaVariante = variante;
    else delete b.temaVariante;
    fx.tema(tema || undefined);
  }

  function mostra(n: RispostaNegozio) {
    applicaColori(n.negozio.colori);
    applicaTema(n);
    document.body.dataset.barra = posizioneBarra(n.negozio.barra?.posizione);
    barra.negozio(n);
    mostraQr(n);
    $("nome").textContent = n.negozio.nome;
    const logo = $("logo") as HTMLImageElement;
    logo.hidden = !n.negozio.logo;
    if (n.negozio.logo) logo.src = `/logo/${encodeURIComponent(n.negozio.logo)}`;
    // senza logo un quadrato col colore del marchio e l'iniziale (mockup A136): la testata non resta nuda
    const iniziale = $("iniziale");
    iniziale.hidden = !!n.negozio.logo;
    iniziale.textContent = [...n.negozio.nome.trim()][0]?.toLocaleUpperCase("it-IT") ?? "";
    sistemaZone(n);
    for (const a of ascoltatori) a(n);
  }

  function giroZone() {
    if (!negozio) return;
    const ora = Date.now();
    if (primoPiano && ora >= primoPiano.fino) primoPiano = null;
    const ids = [...zone.keys()];
    const forme = formeZone(ids.map((id) => !!per.get(id)?.riquadro), negozio.disposizione, ora, primoPiano ? ids.indexOf(primoPiano.id) : -1);
    // il riquadro (e il primo piano che ne nasce) sta nella colonna destra, sopra il QR; il resto nel contenuto,
    // nell'ordine del catalogo. Spostare un elemento non lo rimonta: il servizio tiene i suoi riferimenti.
    const main = $("zone");
    const lato = $("lato");
    ids.forEach((id, i) => {
      const z = zone.get(id)!;
      const dove = forme[i] === "riquadro" || (forme[i] === "primo-piano" && z.parentElement === lato) ? lato : main;
      if (z.parentElement !== dove) {
        if (dove === lato) lato.prepend(z);
        else main.append(...ids.map((x) => zone.get(x)!).filter((x) => x === z || x.parentElement === main));
      }
      const prima = z.dataset.forma;
      z.hidden = forme[i] === "nascosta";
      z.dataset.forma = forme[i]!;
      // si anima solo l'entrata in primo piano e il ritorno nel riquadro, non la prima comparsa
      const f = forme[i]!;
      if (prima && prima !== f && (f === "primo-piano" || f === "riquadro")) anima(z, f, { durata: "entrata" });
    });
    // solo coda (A141, proposta «Solo salta coda»): un servizio da riquadro da solo prende il contenuto e il suo pezzo
    // [data-lato] («Prima» e ritmo) va nel tile della colonna destra, sopra il QR; con altri servizi torna al suo posto
    const solo = ids.length === 1 && per.get(ids[0]!)?.riquadro ? zone.get(ids[0]!)! : null;
    for (const [p, c] of pezzi) {
      if (solo?.contains(c.padre)) continue;
      pezzi.delete(p);
      if (c.padre.isConnected) c.padre.insertBefore(p, c.dopo);
      else p.remove();
    }
    const pezzo = solo?.querySelector<HTMLElement>("[data-lato]");
    if (pezzo) {
      pezzi.set(pezzo, { padre: pezzo.parentElement!, dopo: pezzo.nextSibling });
      lato.prepend(pezzo);
    }
    const b = document.body.dataset;
    b.solo = solo ? "1" : "0";
    // dalla colonna, non dalle forme: in primo piano la zona resta in #lato e la colonna non deve chiudersi (salto)
    b.riquadro = lato.querySelector(":scope > .zona, :scope > [data-lato]") ? "1" : "0";
    // QR = tile della colonna destra (A141): sotto la coda, o senza coda accanto al piede e alto come lui; nel piede
    // solo se la barra occupa già quel posto (barra sotto, testata non in basso)
    const qr = $("qr"), piede = $("piede");
    b.qrDove = b.riquadro === "1" ? "lato" : b.barra === "sotto" && b.testata !== "basso" ? "piede" : "tile";
    if (b.qrDove === "tile") {
      if (qr.parentElement !== document.body) piede.after(qr);
    } else {
      const casa = b.qrDove === "lato" ? lato : piede;
      if (qr.parentElement !== casa) casa.append(qr);
    }
    // pallini: solo le zone che girano nel contenuto (il riquadro della colonna non gira)
    const giranti = ids.filter((id) => zone.get(id)!.parentElement === main);
    disegnaPallini(giranti.map((id) => ({ ...(pagine.get(id) ?? { totale: 1, secondi: 0, etichetta: per.get(id)?.etichetta }), visibile: !zone.get(id)!.hidden })), ora);
  }

  let quantiPallini = -1;
  function disegnaPallini(gruppi: Parameters<typeof pallini>[0], ora: number) {
    const r = pallini(gruppi, ora);
    const box = $("pallini");
    document.body.dataset.gira = r.gira ? "1" : "0";
    if (r.pallini.length !== quantiPallini) {
      quantiPallini = r.pallini.length;
      box.replaceChildren(
        ...r.pallini.map(() => {
          const d = document.createElement("span");
          d.className = "pallino";
          d.append(document.createElement("i"));
          return d;
        }),
      );
    }
    box.querySelectorAll<HTMLElement>(".pallino").forEach((d, k) => {
      const p = r.pallini[k]!;
      d.classList.toggle("ora", p.ora);
      d.classList.toggle("fatto", p.fatto);
      const avvio = p.ora ? String(ora - p.trascorsiMs) : "";
      if (d.dataset.avvio === avvio) return; // stessa pagina: l'animazione in corso va bene
      d.dataset.avvio = avvio;
      const fill = d.firstElementChild as HTMLElement;
      fill.getAnimations().forEach((a) => a.cancel());
      if (!p.ora || calmo()) return; // con riduci movimento il pallino attuale è pieno e fermo (CSS)
      anima(fill, "riempie", { ms: p.durataMs, curva: "lineare", resta: true, da: p.trascorsiMs });
    });
    $("dove").textContent = r.dove;
    $("conto").textContent = r.conto;
    $("poi-dove").textContent = r.poi;
    $("poi").hidden = !r.poi;
  }

  async function scarica() {
    try {
      const r = await fetch("/api/negozio", { headers: etag ? { "If-None-Match": etag } : {}, cache: "no-store" });
      if (r.status === 200) {
        const dati = (await r.json()) as unknown;
        const e = validaRispostaNegozio(dati);
        if (e.ok) {
          negozio = e.dati;
          etag = r.headers.get("ETag") ?? "";
          salvaCacheNegozio(CHIAVE_CACHE, negozio);
          mostra(negozio);
        }
      }
      if (r.ok || r.status === 304) ultimoOk.set("guscio", Date.now());
    } catch {
      // rete o server giù: si continua con l'ultimo negozio buono
    }
  }

  function giro() {
    document.body.dataset.offline = sembraOffline([...ultimoOk.values()], Date.now()) ? "1" : "0";
    giroZone();
  }

  if (negozio) mostra(negozio);
  void scarica();
  setInterval(() => void scarica(), AGGIORNA_MS);
  setInterval(giro, 1000);
}
