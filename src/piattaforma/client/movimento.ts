// Il sistema di movimento (A136(6)): ogni animazione della piattaforma e dei servizi (TV e pannello) passa da qui.
// - durate e curve solo dai token (design/tokens.json → --durata-*, --curva-*), mai numeri scritti nel codice;
// - solo opacità e trasformazioni (le fa il compositore: la TV lenta non scatta), il tipo non accetta altro;
// - "riduci movimento" in un punto solo: con la preferenza attiva non parte niente (lo stato finale c'è già);
// - i passaggi sono predefiniti per nome, uguali per tutti i prodotti (DESIGN → Movimento).
// Un controllo (test/unit/movimento.test.ts) fallisce se `.animate(` o il media query compaiono fuori da qui.

/** Fotogramma ammesso: niente proprietà che rifanno il layout o il disegno (larghezza, colori, ombre, filtri). */
export type Fotogramma = { opacity?: number; transform?: string; offset?: number };
export type Durata = "breve" | "media" | "passaggio" | "entrata" | "scorre";
export type Curva = "entra" | "lenta" | "lineare";

const RIDUCI = "(prefers-reduced-motion: reduce)";
export const calmo = (): boolean => matchMedia(RIDUCI).matches;
/** `ascolta` parte quando la persona cambia "riduci movimento" (le animazioni continue si fermano o ripartono). */
export const suCalmo = (ascolta: () => void): void => matchMedia(RIDUCI).addEventListener("change", ascolta);

const letti = new Map<string, string>();
/** Un token di movimento come lo vede il CSS (`--durata-passaggio`); letto una volta sola (non cambia). */
function token(nome: string): string {
  let v = letti.get(nome);
  if (v === undefined) {
    v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    if (v) letti.set(nome, v);
  }
  return v;
}

/** Durata in millisecondi da un token: "700ms" o "1.2s". Senza token (pagina senza tokens.css) 0 = nessun movimento. */
export function durata(nome: Durata): number {
  const m = /^([\d.]+)(ms|s)$/.exec(token(`--durata-${nome}`));
  return m ? Number(m[1]) * (m[2] === "s" ? 1000 : 1) : 0;
}

const curva = (nome: Curva) => (nome === "lineare" ? "linear" : token(`--curva-${nome}`) || "ease");

/** I passaggi della piattaforma: un nome, gli stessi movimenti su ogni prodotto. */
export const PASSAGGI = {
  dissolvenza: [{ opacity: 0 }, { opacity: 1 }],
  scorrimento: [{ opacity: 0, transform: "translateX(6%)" }, { opacity: 1, transform: "none" }],
  zoom: [{ opacity: 0, transform: "scale(1.06)" }, { opacity: 1, transform: "none" }],
  "primo-piano": [{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "none" }],
  riquadro: [{ opacity: 0, transform: "scale(.8)" }, { opacity: 1, transform: "none" }],
  "entra-dal-basso": [{ transform: "translateY(100%)", opacity: 0 }, { transform: "none", opacity: 1 }],
  "esce-in-alto": [{ transform: "none", opacity: 1 }, { transform: "translateY(-100%)", opacity: 0 }],
  riempie: [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
} satisfies Record<string, Fotogramma[]>;
export type Passaggio = keyof typeof PASSAGGI;

export interface Opzioni {
  durata?: Durata;
  /** Millisecondi esatti invece di un token: solo per tempi che vengono dai dati (una pagina, il primo piano). */
  ms?: number;
  curva?: Curva;
  /** Resta allo stato finale (un elemento che esce e poi si toglie). */
  resta?: boolean;
  /** Parte già avanti di tanti ms (una barra che riprende dopo un ridisegno). */
  da?: number;
}

/**
 * Anima `el` con un passaggio della piattaforma. Con "riduci movimento" non fa niente e ritorna null: chi aspetta
 * la fine (per togliere l'elemento) deve gestire anche quel caso.
 */
export function anima(el: Element, passaggio: Passaggio | Fotogramma[], o: Opzioni = {}): Animation | null {
  if (calmo()) return null;
  const ms = o.ms ?? durata(o.durata ?? "passaggio");
  if (!ms) return null;
  const k = typeof passaggio === "string" ? PASSAGGI[passaggio] : passaggio;
  const a = el.animate(k, { duration: ms, easing: curva(o.curva ?? "entra"), fill: o.resta ? "forwards" : "none" });
  if (o.da) a.currentTime = o.da;
  return a;
}
