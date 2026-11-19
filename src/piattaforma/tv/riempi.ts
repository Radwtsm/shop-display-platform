// A136(12) «riempi l'area»: una zona della TV usa tutta l'altezza che ha. L'elemento con `data-riempi` riceve la
// variabile CSS `--riempi` (1 = misure dei token) e il suo CSS ci moltiplica i font: si cerca la più grande che
// sta nello spazio, fino al tetto `--tv-riempi-max` (token). Poi il blocco si centra in verticale (lo fa il CSS).
// Ogni prova ripassa adatta(): un testo che a quella scala andrebbe ridotto o tagliato vuol dire «non sta».
import { adattaTutti } from "./adatta.ts";

const PASSI = 7; // ricerca a metà: 7 passi = precisione di circa 1% sul fattore

/** Lo spazio in cui `el` deve stare: il primo antenato con un box vero (le zone "intero" sono display: contents). */
export function spazio(el: HTMLElement): { largo: number; alto: number } {
  let a = el.parentElement;
  while (a && getComputedStyle(a).display === "contents") a = a.parentElement;
  if (!a) return { largo: innerWidth, alto: innerHeight };
  const cs = getComputedStyle(a);
  return {
    largo: a.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    alto: a.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
  };
}

/** Una parola spezzata a metà (più righe che parole): a quella scala il testo non sta in larghezza. */
function spezzato(el: HTMLElement): boolean {
  const giro = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  for (let n = giro.nextNode(); n; n = giro.nextNode()) {
    const t = n.textContent!.trim();
    if (!t) continue;
    r.selectNodeContents(n);
    const righe = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
    if (righe > t.split(/\s+/).length) return true;
  }
  return false;
}

/**
 * Di serie: non più grande dello spazio del genitore (una colonna di griglia "auto" si allarga con la parola più
 * lunga: va confrontata col genitore, non con sé), niente che esce dal box, nessuna parola spezzata.
 */
export function staNelloSpazio(el: HTMLElement): boolean {
  const cs = getComputedStyle(el);
  const b = el.getBoundingClientRect();
  const s = spazio(el);
  const alto = b.height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
  return alto <= s.alto + 1 && b.width <= s.largo + 1 && el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1 && !spezzato(el) && !scappa(el, b);
}

/** Un discendente fuori dal blocco in qualunque direzione: uno sforamento in alto o a sinistra (testo in basso con
 *  position: absolute, "Foto grande") non fa scroll, scrollHeight non lo vede. */
function scappa(el: HTMLElement, b: DOMRect): boolean {
  for (const d of el.querySelectorAll("*")) {
    // solo i testi: una foto ingrandita dal movimento esce dal suo rettangolo ma la cornice la ritaglia
    if (![...d.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
    const r = d.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.top < b.top - 1 || r.bottom > b.bottom + 1 || r.left < b.left - 1 || r.right > b.right + 1) return true;
  }
  return false;
}

const ristretti = (el: HTMLElement) => el.querySelectorAll(".ridotto, .tagliato").length;

/**
 * Trova e applica il fattore più grande (tra 1 e il tetto) per cui `entra()` è vero. Se già a 1 non entra resta 1:
 * da lì in giù ci pensa adatta(). Ritorna il fattore scelto. `entra` di serie: staNelloSpazio(el).
 */
export function riempi(el: HTMLElement, entra: () => boolean = () => staNelloSpazio(el)): number {
  const cqh = innerHeight / 100;
  const tetto = Math.max(1, parseFloat(getComputedStyle(el).getPropertyValue("--tv-riempi-max")) || 1);
  const prova = (f: number) => {
    el.style.setProperty("--riempi", String(f));
    adattaTutti(el, cqh);
  };
  prova(1);
  const base = ristretti(el);
  const va = (f: number) => {
    prova(f);
    return ristretti(el) <= base && entra();
  };
  let ok = 1;
  if (va(tetto)) ok = tetto;
  else {
    let ko = tetto;
    for (let i = 0; i < PASSI; i++) {
      const m = (ok + ko) / 2;
      if (va(m)) ok = m;
      else ko = m;
    }
  }
  prova(ok);
  return ok;
}

/**
 * Tutto ciò che, fuori dal contenuto, cambia le misure dei testi: misura della TV (vh), font pronti o di riserva,
 * attributi del body (disposizione, tema, layout) e variabili del negozio sul root. Chiave delle cache di misura.
 */
export function contestoMisure(): string {
  // fuori: ciò che cambia a ogni pagina senza toccare le misure (id dell'offerta, pallino offline), altrimenti ogni
  // offerta dello Schermo farebbe rimisurare tutte le altre zone (A136(6))
  const { slide: _s, offline: _o, ...attributi } = document.body.dataset;
  return `${innerWidth}×${innerHeight}|${document.fonts?.status}|${document.body.className}|${JSON.stringify(attributi)}|${document.documentElement.getAttribute("style") ?? ""}`;
}

// Scala già trovata per lo stesso contenuto nello stesso spazio: la ricerca (fino a 9 giri di layout) costa
// 50–150 ms su una TV lenta proprio al cambio pagina e fa scattare le transizioni; le pagine girano sempre uguali.
const trovate = new WeakMap<HTMLElement, Map<string, number>>();

/** Riempie ogni `[data-riempi]` visibile dentro `radice`. */
export function riempiTutti(radice: ParentNode): void {
  radice.querySelectorAll<HTMLElement>("[data-riempi]").forEach((e) => {
    if (!e.getClientRects().length) return;
    const s = spazio(e);
    // i font in arrivo cambiano le misure: una scala trovata coi font di riserva non vale dopo
    const chiave = `${contestoMisure()}|${Math.round(s.largo)}×${Math.round(s.alto)}|${e.textContent}`;
    const mappa = trovate.get(e) ?? new Map<string, number>();
    trovate.set(e, mappa);
    const f = mappa.get(chiave);
    if (f === undefined) {
      if (mappa.size > 50) mappa.clear();
      mappa.set(chiave, riempi(e));
    } else {
      e.style.setProperty("--riempi", String(f));
      adattaTutti(e, innerHeight / 100);
      if (!staNelloSpazio(e)) mappa.set(chiave, riempi(e)); // cambiato qualcosa che la chiave non vede: si ricerca
    }
  });
}
