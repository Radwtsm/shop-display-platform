// Il Menu del giorno sulla TV: i piatti disponibili, per categoria, a pagine che girano. Si monta nella sua zona
// del guscio (public/player.html); nome, logo, colori, tema e QR sono del negozio e li disegna il guscio.
import { frammento } from "../../piattaforma/client/dom.ts";
import { dataLocale, indiceCorrente } from "../../piattaforma/core/orario.ts";
import { formatta } from "../../piattaforma/core/prezzo.ts";
import { allergene } from "./core/allergeni.ts";
import { osservaMisura, segnaMisura } from "../../piattaforma/tv/adatta.ts";
import { contestoMisure, riempi } from "../../piattaforma/tv/riempi.ts";
import type { ContestoTv, ServizioTv } from "../../piattaforma/tv/contratto.ts";
import { cacheMenu, scaricaMenu } from "./client.ts";
import { impagina, pagineTv, righeTv, type Riga } from "./core/pagine.ts";
import type { DatiMenu } from "./core/tipi.ts";
import { caricaStile } from "./stile.ts";

const AGGIORNA_MS = 5000;
const SECONDI_PER_PAGINA = 10;
const ARIA_MAX = 4; // vh sopra e sotto un piatto: oltre, i piatti non sembrano più un elenco
const RIGHE_PRIMA_DI_MISURARE = 9; // solo finché la zona non si vede: poi le pagine le fa la misura
const MARKUP = `
<section class="mn-tv" hidden>
  <div class="mn-tv-testa"><h2 class="mn-tv-titolo">Menu del giorno</h2></div>
  <ul class="mn-tv-righe"></ul>
  <p class="mn-tv-nota">Allergeni: chiedi al personale o scansiona il QR.</p>
</section>`;

function monta(zona: HTMLElement, ctx: ContestoTv) {
  zona.append(frammento(MARKUP));
  const radice = zona.querySelector<HTMLElement>(".mn-tv")!;
  const righe = zona.querySelector<HTMLElement>(".mn-tv-righe")!;
  let menu: DatiMenu | null = cacheMenu();
  let etag = "";
  let pagine: Riga[][] = menu ? pagineTv(menu, RIGHE_PRIMA_DI_MISURARE) : [];
  let scale: number[] = []; // A136(12)/A143: fattore dei font, uguale per ogni pagina (la più piena riempie l'altezza)
  let arie: number[] = []; // A143: px aggiunti sopra e sotto ogni piatto, così anche la pagina più corta riempie
  let mostrata = "";
  let giorno = dataLocale(Date.now());

  function riga(r: Riga): HTMLLIElement {
    const li = document.createElement("li");
    if (r.colonna) li.classList.add("mn-tv-colonna");
    if (r.tipo === "categoria") {
      li.classList.add("mn-tv-cat");
      li.textContent = r.segue ? `${r.nome} (segue)` : r.nome;
      return li;
    }
    li.classList.add("mn-tv-piatto");
    const nome = document.createElement("span");
    nome.className = "mn-tv-nome";
    nome.textContent = r.piatto.nome;
    const prezzo = document.createElement("span");
    prezzo.className = "mn-tv-prezzo";
    prezzo.textContent = formatta(r.piatto.prezzo);
    const punti = document.createElement("span");
    punti.className = "mn-tv-punti"; // puntini fra piatto e prezzo, come il mockup: il prezzo resta accanto al suo piatto
    li.append(nome, punti, prezzo);
    if (r.piatto.allergeni?.length) {
      const sotto = document.createElement("span");
      sotto.className = "mn-tv-allergeni";
      sotto.textContent = r.piatto.allergeni.map((a) => allergene(a).breve.toLocaleLowerCase("it-IT")).join(" · ");
      li.append(sotto);
    }
    return li;
  }

  function mostra() {
    const i = pagine.length ? indiceCorrente(pagine.length, Date.now(), SECONDI_PER_PAGINA) : -1;
    ctx.pagine(pagine.length, SECONDI_PER_PAGINA);
    const chiave = `${i}|${pagine.length}|${JSON.stringify(pagine[i] ?? null)}`;
    if (chiave === mostrata) return;
    mostrata = chiave;
    radice.dataset.pagine = String(pagine.length);
    if (i < 0) {
      const v = document.createElement("li");
      v.className = "mn-tv-vuoto";
      v.textContent = "Menu in aggiornamento";
      righe.replaceChildren(v);
      return;
    }
    righe.style.setProperty("--riempi", String(scale[i] ?? 1));
    righe.style.setProperty("--aria", `${arie[i] ?? 0}px`);
    righe.replaceChildren(...pagine[i]!.map((r, k) => { const li = riga(r); li.style.setProperty("--i", String(k)); return li; }));
  }

  // Impaginazione misurata (A136(8)): le righe si provano davvero nella lista (due colonne se c'è spazio, nomi che
  // vanno a capo) e si conta quante stanno. Si rifà quando cambia il menu, il giorno o la misura (zona che compare,
  // affiancato, font pronti): così le pagine scendono E risalgono. Una zona nascosta non si misura: restano le pagine
  // di prima. Tutto nello stesso giro di JS: la prova non arriva mai sullo schermo.
  function quanteStanno(candidate: Riga[]): number {
    righe.replaceChildren(...candidate.map(riga));
    const box = righe.getBoundingClientRect();
    let n = 0;
    for (const li of righe.children) {
      const r = li.getBoundingClientRect();
      if (r.right > box.right + 1 || r.bottom > box.bottom + 1) break;
      n++;
    }
    return n;
  }

  // Due colonne pari (A141, owner 12/11 «disordinato»): il browser bilancia male righe alte diverse e la colonna
  // destra può partire con un piatto. Si sceglie il taglio con la colonna più alta più bassa, misurando le righe;
  // la destra parte sempre con un titolo (ripetuto se il taglio cade dentro una categoria). Se così la pagina non sta
  // più, resta com'era.
  function dividi(p: Riga[]): Riga[] {
    const cs = getComputedStyle(righe);
    const gap = parseFloat(cs.columnGap) || 0;
    if (p.length < 3 || righe.dataset.colonne || righe.clientWidth + gap < 2 * ((parseFloat(cs.columnWidth) || 0) + gap)) return p;
    righe.replaceChildren(...p.map(riga));
    const li = [...righe.children] as HTMLElement[];
    const alto = li.map((e) => e.getBoundingClientRect().height);
    const sopra = li.map((e, k) => (k ? parseFloat(getComputedStyle(e).marginTop) || 0 : 0));
    const titolo = Math.max(0, ...p.map((r, k) => (r.tipo === "categoria" ? alto[k]! : 0)));
    const somma = (da: number, a: number) => { let t = 0; for (let k = da; k < a; k++) t += alto[k]! + (k > da ? sopra[k]! : 0); return t; };
    let meglio = -1, punti = Infinity;
    for (let i = 1; i < p.length; i++) {
      if (p[i - 1]!.tipo === "categoria") continue; // un titolo non resta solo in fondo alla colonna
      const piatto = p[i]!.tipo === "piatto";
      const v = Math.max(somma(0, i), somma(i, p.length) + (piatto ? titolo : 0)) + (piatto ? 0.5 : 0);
      if (v < punti) { punti = v; meglio = i; }
    }
    if (meglio < 0) return p;
    const r = p[meglio]!;
    const nome = [...p.slice(0, meglio)].reverse().find((x) => x.tipo === "categoria");
    const destra: Riga[] = r.tipo === "categoria" ? [{ ...r, colonna: true }]
      : nome?.tipo === "categoria" ? [{ tipo: "categoria", nome: nome.nome, colonna: true }, r] : [{ ...r, colonna: true }];
    const d = [...p.slice(0, meglio), ...destra, ...p.slice(meglio + 1)];
    return quanteStanno(d) === d.length ? d : p;
  }

  // A142 foto TV: due colonne strette (menu accanto alla coda) mandavano a capo i nomi, col prezzo a metà altezza.
  // Due colonne solo se a font di base nessun nome del menu va a capo; se no una (data-colonne, menu.css).
  function aCapo(): boolean {
    const r = document.createRange();
    return [...righe.querySelectorAll(".mn-tv-nome")].some((n) => {
      r.selectNodeContents(n);
      return new Set([...r.getClientRects()].filter((x) => x.width).map((x) => Math.round(x.top))).size > 1;
    });
  }
  function scegliColonne(tutte: Riga[]) {
    delete righe.dataset.colonne;
    righe.replaceChildren(...tutte.map(riga));
    if (aCapo()) righe.dataset.colonne = "1";
  }

  // Capienza a font di base (meno pagine possibili), poi ogni pagina cresce finché tutte le sue righe stanno.
  // Costa decine di layout forzati: il risultato si ricorda per menu + spazio + contesto (A136(6)), così la zona
  // che ricompare a ogni giro della disposizione "intero" non rifà l'impaginazione proprio durante il passaggio.
  const fatte = new Map<string, { pagine: Riga[][]; scale: number[]; arie: number[]; colonne: string | undefined }>();
  function rifaiPagine() {
    if (!menu || radice.hidden || !righe.clientHeight) return;
    const chiave = `${contestoMisure()}|${righe.clientWidth}×${righe.clientHeight}|${JSON.stringify(righeTv(menu))}`;
    const f = fatte.get(chiave);
    if (f) {
      if (f.pagine !== pagine) ({ pagine, scale, arie } = f);
      else return;
      if (f.colonne) righe.dataset.colonne = f.colonne;
      else delete righe.dataset.colonne;
      mostrata = "";
      mostra();
      return;
    }
    segnaMisura("menu-qr");
    righe.dataset.misura = "1";
    righe.style.setProperty("--riempi", "1");
    righe.style.setProperty("--aria", "0px");
    scegliColonne(righeTv(menu));
    pagine = impagina(righeTv(menu), quanteStanno).map(dividi);
    const due = !righe.dataset.colonne;
    // una scala sola per tutto il giro, quella della pagina più piena (A143: la pagina con meno piatti era più grande)
    const scala = Math.min(...pagine.map((p) => {
      righe.replaceChildren(...p.map(riga));
      return riempi(righe, () => quanteStanno(p) === p.length && !(due && aCapo())); // crescendo non va a capo
    }));
    scale = pagine.map(() => scala);
    // poi ogni pagina più corta allarga lo spazio fra i piatti (testo uguale) finché tutto sta, fino a ARIA_MAX vh
    righe.style.setProperty("--riempi", String(scala));
    arie = pagine.map((p) => {
      const sta = (px: number) => { righe.style.setProperty("--aria", `${px}px`); return quanteStanno(p) === p.length; };
      let ok = 0;
      let ko = (innerHeight * ARIA_MAX) / 100;
      if (sta(ko)) ok = ko;
      else for (let k = 0; k < 6; k++) { const m = (ok + ko) / 2; if (sta(m)) ok = m; else ko = m; }
      return Math.floor(ok);
    });
    delete righe.dataset.misura;
    if (fatte.size > 20) fatte.clear();
    fatte.set(chiave, { pagine, scale, arie, colonne: righe.dataset.colonne });
    mostrata = "";
    mostra();
  }

  function giro() {
    // a mezzanotte di Roma i "finito oggi" di ieri tornano sulla TV senza aspettare un cambio del menu
    const adesso = dataLocale(Date.now());
    if (adesso !== giorno && menu) {
      giorno = adesso;
      pagine = pagineTv(menu, RIGHE_PRIMA_DI_MISURARE);
      rifaiPagine();
    }
    mostra();
  }

  async function scarica() {
    const r = await scaricaMenu(etag);
    if (r.stato === "nuovo") {
      menu = r.menu;
      etag = r.etag;
      pagine = pagineTv(menu, RIGHE_PRIMA_DI_MISURARE);
      mostrata = "";
      rifaiPagine();
    }
    ctx.rete(r.stato === "nuovo" || r.stato === "uguale");
  }

  void caricaStile().then(() => {
    radice.hidden = false;
    rifaiPagine();
    giro();
  });
  osservaMisura(radice, rifaiPagine);
  void scarica().then(giro);
  setInterval(() => void scarica(), AGGIORNA_MS);
  setInterval(giro, 1000);
}

export const servizioTv: ServizioTv = {
  id: "menu-qr",
  etichetta: "Menu",
  monta,
  qrPredefinito: (origine) => ({ url: `${origine}/menu.html`, testo: "Menu e allergeni" }),
};
