// Kit proposta (public/proposta.html, A102): sito, menu, TV, cartello A5 e volantino col marchio del negozio, da
// mostrare sul telefono per chiudere la visita. Sta fuori da piattaforma e servizi perché li mette insieme. Legge solo
// le API pubbliche (niente token, niente Wi-Fi); una sezione compare solo se il suo servizio è acceso.
import { applicaColori } from "../piattaforma/client/dom.ts";
import { validaRispostaNegozio, type RispostaNegozio } from "../piattaforma/core/negozio.ts";
import { descriviFasce } from "../piattaforma/core/orario.ts";
import { formatta } from "../piattaforma/core/prezzo.ts";
import { percorsoQr } from "../piattaforma/core/qr.ts";
import type { IdServizio } from "../piattaforma/core/servizi.ts";
import { valida as validaSchermo } from "../servizi/schermo/core/valida.ts";
import type { Config } from "../servizi/schermo/core/tipi.ts";
import { validaRisposta } from "../servizi/vetrina/core/valida.ts";
import type { RispostaVetrina } from "../servizi/vetrina/core/tipi.ts";

const MARGINE_QR = 2; // zona di silenzio attorno al QR
const SEZIONI: { id: string; serve: IdServizio }[] = [
  { id: "sito", serve: "vetrina" },
  { id: "menu", serve: "menu-qr" },
  { id: "tv", serve: "schermo" },
  { id: "cartello", serve: "vetrina" },
  { id: "volantino", serve: "schermo" },
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

async function leggi(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: "no-store" });
  return r.ok ? r.json() : null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, testo = "", classe = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (testo) e.textContent = testo;
  if (classe) e.className = classe;
  return e;
}

function qr(testo: string): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const q = percorsoQr(testo);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `${-MARGINE_QR} ${-MARGINE_QR} ${q.lato + 2 * MARGINE_QR} ${q.lato + 2 * MARGINE_QR}`);
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", q.d);
  svg.append(p);
  return svg;
}

function marchio(n: RispostaNegozio) {
  const { nome, logo, colori } = n.negozio;
  applicaColori(colori);
  document.title = `Proposta per ${nome}`;
  $("nome").textContent = nome;
  for (const e of document.querySelectorAll<HTMLElement>("[data-nome]")) e.textContent = nome;
  const logi = [$<HTMLImageElement>("logo"), ...document.querySelectorAll<HTMLImageElement>("[data-logo]")];
  for (const img of logi) {
    img.hidden = !logo;
    if (logo) img.src = `/logo/${encodeURIComponent(logo)}`;
  }
}

function cartello(v: RispostaVetrina) {
  const voci = [
    ...v.qr.map((q) => ({ titolo: q.titolo, sotto: q.sotto, testo: q.testo })),
    { titolo: "Il nostro sito", sotto: "Orari, menu e dove siamo", testo: new URL("/sito.html", location.origin).href },
  ];
  $("cartello-qr").replaceChildren(
    ...voci.map((q) => {
      const f = el("figure", "", "voce-qr");
      const c = el("figcaption");
      c.append(el("strong", q.titolo), el("span", q.sotto));
      f.append(qr(q.testo), c);
      return f;
    }),
  );
}

function volantino(c: Config, v: RispostaVetrina | null) {
  const offerte = c.slides.filter((s) => s.attiva).slice(0, 6);
  $("volantino-offerte").replaceChildren(
    ...offerte.map((s) => {
      const li = el("li");
      const foto = el("img");
      foto.alt = "";
      if (s.foto) foto.src = `/foto/${encodeURIComponent(s.foto)}`;
      foto.hidden = !s.foto;
      const testi = el("span");
      testi.append(el("span", s.titolo, "titolo"));
      if (s.nota) testi.append(el("span", s.nota, "nota"));
      li.append(foto, testi, el("span", s.prezzo !== undefined ? formatta(s.prezzo) : "", "prezzo"));
      return li;
    }),
  );
  const orari = v?.orari.length ? v.orari : c.negozio.orari;
  $("volantino-orari").textContent = orari?.length ? `Aperti ${descriviFasce(orari)}` : "";
  $("volantino-dove").textContent = v?.contatti.indirizzo ?? "";
}

/** La TV gira a 1920×1080 dentro l'iframe; qui si rimpicciolisce alla larghezza della cornice. */
function scalaTv() {
  const schermo = $("schermo-tv");
  const f = $("f-tv");
  const adatta = () => (f.style.transform = `scale(${schermo.clientWidth / 1920})`);
  new ResizeObserver(adatta).observe(schermo);
  adatta();
}

function mostra(attive: string[]) {
  const scelta = attive.includes(location.hash.slice(1)) ? location.hash.slice(1) : attive[0];
  for (const a of document.querySelectorAll<HTMLAnchorElement>(".navigazione a")) {
    const id = a.dataset.sezione!;
    a.hidden = !attive.includes(id);
    if (id === scelta) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  for (const { id } of SEZIONI) {
    const s = $(`sez-${id}`);
    s.hidden = id !== scelta;
    // l'iframe si carica solo quando la sua sezione si apre: la pagina parte leggera sul telefono
    const f = s.querySelector<HTMLIFrameElement>("iframe[data-src]");
    if (f && !s.hidden && !f.getAttribute("src")) f.src = f.dataset.src!;
  }
  window.scrollTo(0, 0);
}

async function avvia() {
  try {
    const n = validaRispostaNegozio(await leggi("/api/negozio"));
    if (!n.ok) throw new Error("negozio");
    marchio(n.dati);
    const accesi = new Set<IdServizio>(n.dati.servizi);
    const [cfg, vet] = await Promise.all([
      accesi.has("schermo") ? leggi("/api/schermo/config") : null,
      accesi.has("vetrina") ? leggi("/api/vetrina/sito") : null,
    ]);
    const c = cfg ? validaSchermo(cfg) : null;
    const v = vet ? validaRisposta(vet) : null;
    const vetrina = v?.ok ? v.dati : null;
    if (vetrina) cartello(vetrina);
    else accesi.delete("vetrina");
    if (c?.ok) volantino(c.config, vetrina);
    else accesi.delete("schermo");
    const attive = SEZIONI.filter((s) => accesi.has(s.serve)).map((s) => s.id);
    if (!attive.length) throw new Error("nessun servizio");
    scalaTv();
    mostra(attive);
    addEventListener("hashchange", () => mostra(attive));
  } catch {
    $("errore").hidden = false;
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-stampa]")) b.addEventListener("click", () => window.print());
  document.body.dataset.pronto = "1";
}

void avvia();
