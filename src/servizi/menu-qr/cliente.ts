// La pagina del menu per il cliente (public/menu.html), da aprire con il QR: sola lettura, niente token.
// Nome, logo e colori sono del negozio. Tutto il testo del menu entra con textContent.
import { applicaColori, cacheNegozio, salvaCacheNegozio } from "../../piattaforma/client/dom.ts";
import { validaRispostaNegozio } from "../../piattaforma/core/negozio.ts";
import { formatta } from "../../piattaforma/core/prezzo.ts";
import { ALLERGENI, allergene, type IdAllergene } from "./core/allergeni.ts";
import { finitoOggi } from "./core/finito.ts";
import { perCategoria, senzaAllergeni } from "./core/filtri.ts";
import type { DatiMenu, Piatto } from "./core/tipi.ts";
import { cacheMenu, scaricaMenu } from "./client.ts";
import { iconaAllergene } from "./icone.ts";

const AGGIORNA_MS = 30_000;
const CHIAVE_NEGOZIO = "menu-qr.negozio";
const $ = (id: string) => document.getElementById(id)!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, testo = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = classe;
  if (testo) e.textContent = testo;
  return e;
}

let menu: DatiMenu | null = cacheMenu();
let etag = "";
const esclusi = new Set<IdAllergene>();

function chip(id: IdAllergene): HTMLSpanElement {
  const a = allergene(id);
  const s = el("span", "mn-chip");
  s.append(iconaAllergene(a), el("span", "", a.breve));
  return s;
}

function righeAllergeni(p: Piatto): HTMLElement {
  if (p.allergeni === null) return el("p", "mn-allergeni mn-ignoti", "Allergeni non indicati: chiedi al personale.");
  if (!p.allergeni.length) return el("p", "mn-allergeni", "Nessun allergene indicato.");
  const d = el("div", "mn-allergeni");
  d.append(el("span", "mn-contiene", "Contiene:"));
  const lista = el("ul", "mn-chips");
  lista.setAttribute("aria-label", "Allergeni contenuti");
  for (const id of p.allergeni) {
    const li = document.createElement("li");
    li.append(chip(id));
    lista.append(li);
  }
  d.append(lista);
  return d;
}

function scheda(p: Piatto): HTMLLIElement {
  const finito = finitoOggi(p);
  const li = el("li", "mn-piatto" + (finito ? " mn-finito" : ""));
  li.dataset.id = p.id;
  const testa = el("div", "mn-testa");
  testa.append(el("h3", "mn-nome", p.nome), el("span", "mn-prezzo", formatta(p.prezzo)));
  li.append(testa);
  if (finito) li.append(el("p", "mn-etichetta-finito", "Finito oggi"));
  if (p.descrizione) li.append(el("p", "mn-descrizione", p.descrizione));
  li.append(righeAllergeni(p));
  return li;
}

function disegna() {
  const radice = $("menu");
  if (!menu || !menu.piatti.length) {
    radice.replaceChildren(el("p", "mn-vuoto", "Il menu non è ancora disponibile. Chiedi al personale."));
    $("esito").textContent = "";
    return;
  }
  const visibili = senzaAllergeni(menu.piatti, esclusi);
  const gruppi = perCategoria(menu.categorie, visibili);
  const sezioni = gruppi.map(({ categoria, piatti }) => {
    const s = el("section", "mn-categoria");
    const titolo = el("h2", "mn-titolo-categoria", categoria.nome);
    titolo.id = `mn-cat-${categoria.id}`;
    s.setAttribute("aria-labelledby", titolo.id);
    const ul = el("ul", "mn-piatti");
    ul.append(...piatti.map(scheda));
    s.append(titolo, ul);
    return s;
  });
  radice.replaceChildren(...sezioni);
  if (!esclusi.size) {
    $("esito").textContent = "";
    return;
  }
  const nomi = [...esclusi].map((id) => allergene(id).breve.toLowerCase()).join(", ");
  const nascostiIgnoti = menu.piatti.filter((p) => p.allergeni === null).length;
  const parti = [visibili.length ? `${visibili.length} ${visibili.length === 1 ? "piatto" : "piatti"} senza ${nomi}.` : `Nessun piatto senza ${nomi}.`];
  if (nascostiIgnoti) parti.push("I piatti con allergeni non indicati non compaiono: chiedi al personale.");
  $("esito").textContent = parti.join(" ");
}

function filtri() {
  const gruppo = $("filtri");
  gruppo.replaceChildren(
    ...ALLERGENI.map((a) => {
      const b = el("button", "mn-filtro");
      b.type = "button";
      b.dataset.allergene = a.id;
      b.setAttribute("aria-pressed", "false");
      b.append(iconaAllergene(a), el("span", "", a.breve));
      b.addEventListener("click", () => {
        if (esclusi.has(a.id)) esclusi.delete(a.id);
        else esclusi.add(a.id);
        b.setAttribute("aria-pressed", String(esclusi.has(a.id)));
        $("togli").hidden = !esclusi.size;
        disegna();
      });
      return b;
    }),
  );
  $("togli").addEventListener("click", () => {
    esclusi.clear();
    for (const b of gruppo.querySelectorAll("button")) b.setAttribute("aria-pressed", "false");
    $("togli").hidden = true;
    disegna();
  });
}

function elenco() {
  $("elenco").replaceChildren(
    ...ALLERGENI.map((a) => {
      const li = el("li", "mn-voce");
      li.append(iconaAllergene(a), el("span", "", a.nome));
      return li;
    }),
  );
}

async function negozio() {
  const mostra = (n: NonNullable<ReturnType<typeof cacheNegozio>>) => {
    applicaColori(n.negozio.colori);
    $("nome").textContent = n.negozio.nome;
    document.title = `Menu · ${n.negozio.nome}`;
    const logo = $("logo") as HTMLImageElement;
    logo.hidden = !n.negozio.logo;
    if (n.negozio.logo) logo.src = `/logo/${encodeURIComponent(n.negozio.logo)}`;
  };
  const vecchio = cacheNegozio(CHIAVE_NEGOZIO);
  if (vecchio) mostra(vecchio);
  try {
    const r = await fetch("/api/negozio", { cache: "no-store" });
    const e = r.ok ? validaRispostaNegozio(await r.json()) : null;
    if (e?.ok) {
      salvaCacheNegozio(CHIAVE_NEGOZIO, e.dati);
      mostra(e.dati);
    }
  } catch {
    // senza rete: resta l'ultimo negozio buono
  }
}

async function aggiorna() {
  const r = await scaricaMenu(etag);
  if (r.stato === "nuovo") {
    menu = r.menu;
    etag = r.etag;
    disegna();
  } else if (r.stato === "assente" && menu) {
    menu = null;
    disegna();
  }
  document.body.dataset.pronto = "1";
}

filtri();
elenco();
disegna();
void negozio();
void aggiorna();
setInterval(() => void aggiorna(), AGGIORNA_MS);
