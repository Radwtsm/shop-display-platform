// Minisito pubblico del negozio (public/sito.html): nome, logo, storia, orari, dove siamo, menu, recensioni.
// Legge /api/negozio e /api/vetrina/sito (dati pubblici: niente Wi-Fi). Niente innerHTML, niente risorse di terzi.
import { applicaColori } from "../../piattaforma/client/dom.ts";
import { validaRispostaNegozio } from "../../piattaforma/core/negozio.ts";
import { descriviFasce, inFascia } from "../../piattaforma/core/orario.ts";
import { stelle } from "./core/schermate.ts";
import { validaRisposta } from "./core/valida.ts";
import { linkRecensione } from "./core/qr.ts";
import type { RispostaVetrina } from "./core/tipi.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el(tag: string, testo: string, classe?: string): HTMLElement {
  const e = document.createElement(tag);
  e.textContent = testo;
  if (classe) e.className = classe;
  return e;
}

function link(testo: string, href: string, esterno = false): HTMLAnchorElement {
  const a = document.createElement("a");
  a.textContent = testo;
  a.href = href;
  if (esterno) a.rel = "noopener noreferrer";
  return a;
}

/** Il link al menu è un percorso del sito o https (lo controlla già il server); qui ancora una guardia. */
const linkSicuro = (l: string) => (l.startsWith("/") && !l.startsWith("//")) || l.startsWith("https://");

function disegna(nome: string, r: RispostaVetrina, placeId?: string) {
  const s = r.storia;
  if (s) {
    $("storia").hidden = false;
    $("storia-testo").textContent = s.testo;
    $("anno").hidden = !s.anno;
    $("anno").textContent = s.anno ? `Dal ${s.anno}` : "";
    const foto = $<HTMLImageElement>("foto");
    foto.hidden = !s.foto;
    if (s.foto) foto.src = `/foto/${encodeURIComponent(s.foto)}`;
  }

  if (r.orari.length) {
    $("orari").hidden = false;
    const aperto = r.orari.some((f) => inFascia(f, Date.now()));
    $("orari-testo").textContent = descriviFasce(r.orari) || "";
    const ora = $("aperto");
    ora.hidden = false;
    ora.textContent = aperto ? "Aperto ora" : "Chiuso ora";
  }

  const c = r.contatti;
  const righe: HTMLElement[] = [];
  if (c.indirizzo) righe.push(el("span", c.indirizzo));
  if (c.telefono) righe.push(link(c.telefono, `tel:${c.telefono.replace(/[^+\d]/g, "")}`));
  if (c.email) righe.push(link(c.email, `mailto:${c.email}`));
  if (righe.length) {
    $("dove").hidden = false;
    $("contatti").replaceChildren(...righe);
  }
  if (r.mappe) {
    const voci = [link("Apri su Google Maps", r.mappe.google, true), link("Apri su OpenStreetMap", r.mappe.osm, true)];
    $("mappe").replaceChildren(...voci.map((a) => { const li = document.createElement("li"); a.className = "bottone"; li.append(a); return li; }));
  }

  if (linkSicuro(r.linkMenu)) {
    $("menu").hidden = false;
    $<HTMLAnchorElement>("link-menu").href = r.linkMenu;
  }

  const rec = r.recensioni;
  if (rec.elenco.length) {
    $("recensioni").hidden = false;
    if (rec.voto) {
      $("rec-media").hidden = false;
      $("rec-media").textContent = `${rec.voto.toLocaleString("it-IT", { minimumFractionDigits: 1 })} su 5${rec.totale ? ` · ${rec.totale} recensioni` : ""}`;
    }
    $("rec-elenco").replaceChildren(
      ...rec.elenco.map((x) => {
        const li = document.createElement("li");
        const st = el("span", stelle(x.voto), "stelle");
        st.setAttribute("role", "img");
        st.setAttribute("aria-label", `${x.voto} stelle su 5`);
        li.append(st);
        if (x.testo) li.append(el("p", x.testo));
        li.append(el("span", x.autore, "autore"), el("span", x.quando, "quando"));
        return li;
      }),
    );
    // Attribuzione richiesta da Google; per i dati di esempio lo diciamo chiaramente.
    $("rec-fonte").textContent = rec.fonte === "google" ? "Recensioni da Google" : "Recensioni di esempio (non reali)";
    if (placeId) {
      const a = $<HTMLAnchorElement>("rec-scrivi");
      a.href = linkRecensione(placeId);
      a.hidden = false;
    }
  }
  $("piede").textContent = `${nome} · ${c.indirizzo ?? ""}`.replace(/ · $/, "");
}

async function avvia() {
  try {
    const [rn, rv] = await Promise.all([fetch("/api/negozio", { cache: "no-store" }), fetch("/api/vetrina/sito", { cache: "no-store" })]);
    const n = validaRispostaNegozio(await rn.json());
    const v = validaRisposta(await rv.json());
    if (!rn.ok || !rv.ok || !n.ok || !v.ok) throw new Error("risposta non valida");
    applicaColori(n.dati.negozio.colori);
    document.title = n.dati.negozio.nome;
    $("nome").textContent = n.dati.negozio.nome;
    const logo = $<HTMLImageElement>("logo");
    logo.hidden = !n.dati.negozio.logo;
    if (n.dati.negozio.logo) logo.src = `/logo/${encodeURIComponent(n.dati.negozio.logo)}`;
    const qrRec = v.dati.qr.find((q) => q.id === "recensione");
    const placeId = qrRec ? new URL(qrRec.testo).searchParams.get("placeid") ?? undefined : undefined;
    disegna(n.dati.negozio.nome, v.dati, placeId);
  } catch {
    $("errore").hidden = false;
  }
}

void avvia();
