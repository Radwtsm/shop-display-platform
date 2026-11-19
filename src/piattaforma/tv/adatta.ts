// Testi lunghi sulla TV: il font scende a gradini fino a un minimo, poi il testo si taglia (ellissi).
// `data-righe` = righe massime, `data-min` = font minimo in cqh (1% dell'altezza della TV, `cqh` = quel valore in px).
// Solo CSSOM (e.style.x = …): la CSP 'self' vieta l'attributo style. Regole CSS necessarie: public/adatta.css (in player.html).
// Ogni misura riparte dal font del CSS: ripetere adatta() dopo un resize fa anche RISALIRE il font (A137).
import { contestoMisure, riempiTutti, spazio } from "./riempi.ts";

const GRADINO = 0.88;

function altezzaRiga(e: HTMLElement, fs: number): number {
  const lh = parseFloat(getComputedStyle(e).lineHeight);
  return Number.isFinite(lh) && lh > 0 ? lh : 1.2 * fs; // "normal"
}

function troppo(e: HTMLElement, righe: number, fs: number): boolean {
  if (righe === 1) return e.scrollWidth > e.clientWidth + 1;
  return Math.round(e.scrollHeight / altezzaRiga(e, fs)) > righe;
}

export function adatta(e: HTMLElement, cqh: number): void {
  const righe = Math.max(1, Number(e.dataset.righe) || 1);
  e.style.fontSize = "";
  e.style.webkitLineClamp = "";
  e.classList.remove("tagliato", "ridotto");
  const base = parseFloat(getComputedStyle(e).fontSize);
  const min = Math.min(base, (Number(e.dataset.min) || 0) * cqh);
  let fs = base;
  while (troppo(e, righe, fs) && fs > min) {
    fs = Math.max(min, fs * GRADINO);
    e.style.fontSize = `${fs}px`;
  }
  if (fs < base) e.classList.add("ridotto");
  if (troppo(e, righe, fs)) {
    e.classList.add("tagliato");
    if (righe > 1) e.style.webkitLineClamp = String(righe);
  }
}

export function adattaTutti(radice: ParentNode, cqh: number): void {
  radice.querySelectorAll<HTMLElement>("[data-righe]").forEach((e) => adatta(e, cqh));
}

/** Un numero che non si taglia mai: se è più largo del box il font scende in proporzione. */
export function adattaLarghezza(box: HTMLElement, cqh: number): void {
  void cqh;
  box.style.fontSize = "";
  if (box.scrollWidth <= box.clientWidth) return;
  const fs = parseFloat(getComputedStyle(box).fontSize);
  box.style.fontSize = `${Math.floor(fs * (box.clientWidth / box.scrollWidth) * 100) / 100}px`;
  if (box.scrollWidth > box.clientWidth) box.style.fontSize = `${Math.floor(parseFloat(box.style.fontSize) * (box.clientWidth / box.scrollWidth) * 100) / 100}px`;
}

/** Rifà la misura quando la radice cambia misura e quando i font sono pronti. Ritorna la funzione che stacca tutto. */
export function osservaMisura(radice: HTMLElement, rifai: () => void): () => void {
  let frame = 0;
  let attivo = true;
  const pianifica = () => {
    if (!attivo || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; if (attivo) rifai(); });
  };
  const ro = new ResizeObserver(pianifica);
  ro.observe(radice);
  // una zona "intero" è display: contents (nessun box): quando ricompare scattano solo i figli, non lei
  for (const figlio of radice.children) ro.observe(figlio);
  void document.fonts?.ready.then(pianifica);
  return () => { attivo = false; ro.disconnect(); if (frame) cancelAnimationFrame(frame); frame = 0; };
}

const MISURATI = "[data-riempi],[data-righe],[data-larghezza]";
type Fotografia = Array<[font: string, clamp: string, riempi: string, classi: string]>;

/** Il risultato delle misure di una zona: solo ciò che adatta() e riempi() scrivono. */
function fotografa(zona: HTMLElement): Fotografia {
  return [...zona.querySelectorAll<HTMLElement>(MISURATI)].map((e) => [
    e.style.fontSize, e.style.webkitLineClamp, e.style.getPropertyValue("--riempi"),
    ["ridotto", "tagliato"].filter((c) => e.classList.contains(c)).join(" "),
  ]);
}

/** Rimette una fotografia: solo scritture, nessuna lettura di misure (nessun layout forzato). Falso se non combacia. */
function rimetti(zona: HTMLElement, f: Fotografia): boolean {
  const els = zona.querySelectorAll<HTMLElement>(MISURATI);
  if (els.length !== f.length) return false;
  els.forEach((e, i) => {
    const [font, clamp, riempi, classi] = f[i]!;
    e.style.fontSize = font;
    e.style.webkitLineClamp = clamp;
    if (riempi) e.style.setProperty("--riempi", riempi);
    else e.style.removeProperty("--riempi");
    e.classList.toggle("ridotto", classi.includes("ridotto"));
    e.classList.toggle("tagliato", classi.includes("tagliato"));
  });
  return true;
}

/** Ogni misura vera (cara, non dalla cache) lascia un segno: lo vede DevTools (mark) e lo conta l'e2e (evento:
 *  l'orologio finto di Playwright rende `performance.mark` muto). */
export const MISURA = "tv-misura";
export function segnaMisura(chi: string): void {
  performance.mark(MISURA, { detail: chi });
  dispatchEvent(new CustomEvent(MISURA, { detail: chi }));
}

/** Il testo che si vede: le sezioni `hidden` tengono il testo della pagina di prima e renderebbero la chiave diversa
 *  a ogni giro (vetrina: storia/QR/recensioni nascoste a turno). */
function testoVisibile(zona: HTMLElement): string {
  const w = document.createTreeWalker(zona, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n instanceof HTMLElement && n.hidden ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let t = "";
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeType === 3) t += n.nodeValue;
  return t;
}

const nascosta = (zona: HTMLElement) => !!zona.closest("[hidden]");

/**
 * Collega una zona di un servizio: i blocchi con `data-riempi` crescono fino a riempire lo spazio (riempi.ts), i
 * testi con `data-righe` si adattano, quelli con `data-larghezza` (prezzi, numeri) scendono finché stanno interi. Rifà da sola a ogni cambio di misura (zona che compare,
 * affiancato, font pronti); il servizio chiama la funzione che ritorna dopo ogni disegno. Unità di `data-min`: 1% dell'altezza
 * della TV.
 *
 * A136(6): misurare costa decine di layout forzati (50–60 ms su una TV lenta, proprio al cambio pagina: la
 * transizione scatta). Le pagine girano sempre uguali: il risultato si ricorda per contenuto + spazio + contesto e
 * dal secondo giro si rimette con sole scritture. Una zona nascosta non si misura (le misure sarebbero zero): la
 * rifà l'osservatore quando ricompare.
 */
export function adattaZona(zona: HTMLElement): () => void {
  const fatte = new Map<string, Fotografia>();
  const rifai = () => {
    if (nascosta(zona)) return;
    const s = spazio(zona.firstElementChild instanceof HTMLElement ? zona.firstElementChild : zona);
    const chiave = `${contestoMisure()}|${zona.dataset.forma}|${Math.round(s.largo)}×${Math.round(s.alto)}|${testoVisibile(zona)}`;
    const f = fatte.get(chiave);
    if (f && rimetti(zona, f)) return;
    segnaMisura(zona.dataset.servizio ?? "");
    const cqh = innerHeight / 100;
    riempiTutti(zona);
    adattaTutti(zona, cqh);
    zona.querySelectorAll<HTMLElement>("[data-larghezza]").forEach((b) => adattaLarghezza(b, cqh));
    if (fatte.size > 60) fatte.clear();
    fatte.set(chiave, fotografa(zona));
  };
  osservaMisura(zona, rifai);
  return rifai;
}
