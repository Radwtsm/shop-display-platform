// Colori della TV: combinazioni pronte, palette da un solo colore, "Sistema tu" e i motivi quando qualcosa si legge
// male. Il cliente ha l'ultima parola (DESIGN → Personalizzazione): qui si consiglia e si spiega, non si vieta.
import type { Colori } from "./negozio.ts";

export const CONTRASTO_TESTO = 4.5;
export const CONTRASTO_PREZZI = 3;

function luminanza(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]!;
}

/** Rapporto di contrasto WCAG tra due colori #rrggbb (1-21). */
export function contrasto(a: string, b: string): number {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** Nero o bianco, quello che si legge meglio sul colore pieno `fondo` (sempre ≥ 4,58:1 per come è fatta la formula WCAG). */
export function suColore(fondo: string): "#000000" | "#ffffff" {
  return contrasto(fondo, "#000000") >= contrasto(fondo, "#ffffff") ? "#000000" : "#ffffff";
}

/**
 * Colore delle decorazioni (neve…) sullo sfondo: su uno sfondo chiaro un colore scuro pieno sembra sporco (macchie),
 * quindi diventa una tinta tenue (40% colore, 60% sfondo), come brina. Su sfondo scuro resta com'è.
 */
export function coloreDecorazione(colore: string, sfondo: string): string {
  const hex = /^#[0-9a-f]{6}$/i;
  if (!hex.test(colore) || !hex.test(sfondo) || suColore(sfondo) === "#ffffff" || suColore(colore) === "#000000") return colore;
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return "#" + [1, 3, 5].map((i) => Math.round(c(colore, i) * 0.4 + c(sfondo, i) * 0.6).toString(16).padStart(2, "0")).join("");
}

/** Cosa si legge male, con le parole del negozio; vuoto = tutto bene. */
export function problemiColori(c: Colori): string[] {
  const p: string[] = [];
  if (contrasto(c.testo, c.sfondo) < CONTRASTO_TESTO) p.push("Le scritte si confondono con lo sfondo: da lontano non si leggono");
  if (contrasto(c.testo, c.primario) < CONTRASTO_TESTO) p.push("Il nome del negozio si confonde con la barra in alto");
  if (contrasto(c.accento, c.sfondo) < CONTRASTO_PREZZI) p.push("I prezzi si confondono con lo sfondo");
  return p;
}

type Hsl = [number, number, number];

function hsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hex([h, s, l]: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return "#" + [0, 8, 4].map((n) => Math.round(f(n) * 255).toString(16).padStart(2, "0")).join("");
}

/**
 * Stesso colore, luminosità cambiata il meno possibile finché contrasta abbastanza con tutti i `contro`.
 * null se nessuna luminosità ci riesce.
 */
function regola(colore: string, contro: string[], min: number): string | null {
  if (contro.every((x) => contrasto(colore, x) >= min)) return colore;
  const [h, s, l] = hsl(colore);
  for (let passo = 0.01; passo <= 1; passo += 0.01)
    for (const nl of [l + passo, l - passo]) {
      if (nl < 0 || nl > 1) continue;
      const c = hex([h, s, nl]);
      if (contro.every((x) => contrasto(c, x) >= min)) return c;
    }
  return null;
}

/** "Sistema tu": cambia solo la luminosità dei colori che si leggono male, il meno possibile. */
export function sistema(c: Colori): Colori {
  let { primario, testo } = c;
  let t = regola(testo, [c.sfondo, primario], CONTRASTO_TESTO);
  if (!t) {
    // scritte e barra non possono convivere: la barra cede (resta del suo colore, più scura o più chiara)
    t = regola(testo, [c.sfondo], CONTRASTO_TESTO) ?? (contrasto("#ffffff", c.sfondo) > contrasto("#000000", c.sfondo) ? "#ffffff" : "#000000");
    primario = regola(primario, [t], CONTRASTO_TESTO) ?? primario;
  }
  testo = t;
  const accento = regola(c.accento, [c.sfondo], CONTRASTO_PREZZI) ?? testo;
  return { primario, accento, sfondo: c.sfondo, testo };
}

/** Palette completa da un solo colore: barra di quel colore, sfondo scuro della stessa tinta, prezzi chiari e caldi. */
export function daUnColore(principale: string): Colori {
  const [h, s] = hsl(principale);
  return sistema({
    primario: principale.toLowerCase(),
    sfondo: hex([h, Math.min(s, 0.45), 0.08]),
    testo: hex([h, Math.min(s, 0.5), 0.97]),
    accento: hex([h, Math.max(s, 0.7), 0.72]),
  });
}

export interface Combinazione {
  id: string;
  nome: string;
  colori: Colori;
}

/** Combinazioni pronte: ognuna si legge bene (test). Prima quelle scure, poi una chiara. */
export const COMBINAZIONI: readonly Combinazione[] = [
  { id: "forno", nome: "Forno", colori: { primario: "#7a3e12", accento: "#ffd27a", sfondo: "#1f140c", testo: "#fff8ee" } },
  { id: "bottega", nome: "Bottega", colori: { primario: "#14532d", accento: "#fbbf24", sfondo: "#0b1f14", testo: "#f0fdf4" } },
  { id: "elegante", nome: "Elegante", colori: { primario: "#2b2b2b", accento: "#e9c46a", sfondo: "#111111", testo: "#fafafa" } },
  { id: "salute", nome: "Salute", colori: { primario: "#0f5132", accento: "#7ee2a8", sfondo: "#06281a", testo: "#f1fff7" } },
  { id: "mare", nome: "Mare", colori: { primario: "#0b4f8a", accento: "#7cc8ff", sfondo: "#071a2e", testo: "#f0f7ff" } },
  { id: "vino", nome: "Vino", colori: { primario: "#7b1e3a", accento: "#ffb3c7", sfondo: "#240a12", testo: "#fff0f4" } },
  { id: "vivace", nome: "Vivace", colori: { primario: "#5b21b6", accento: "#fde047", sfondo: "#1a0b3b", testo: "#faf5ff" } },
  { id: "chiaro", nome: "Chiaro", colori: { primario: "#e7e1d5", accento: "#b42318", sfondo: "#fafaf7", testo: "#111827" } },
];

export const stessiColori = (a: Colori, b: Colori) =>
  (["primario", "accento", "sfondo", "testo"] as const).every((k) => a[k].toLowerCase() === b[k].toLowerCase());

/**
 * Colore del marchio da un logo (pixel RGBA): il colore vivo che copre più superficie. Si scartano trasparenze,
 * bianchi, neri e grigi (sfondo e scritte). null = logo senza un colore vivo (es. solo nero su bianco).
 */
export function colorePrincipale(px: ArrayLike<number>): string | null {
  const gruppi = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < px.length; i += 4) {
    const [r, g, b, a] = [px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!];
    if (a < 128) continue;
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    if (s < 0.25 || l < 0.1 || l > 0.93) continue;
    const k = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const x = gruppi.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    x.n++;
    x.r += r;
    x.g += g;
    x.b += b;
    gruppi.set(k, x);
  }
  let migliore: { n: number; r: number; g: number; b: number } | undefined;
  for (const x of gruppi.values()) if (!migliore || x.n > migliore.n) migliore = x;
  // meno dell'1% dei pixel visibili colorati = sbavature dell'antialiasing, non un colore del marchio
  const visibili = Array.from({ length: px.length / 4 }, (_, i) => px[i * 4 + 3]! >= 128).filter(Boolean).length;
  if (!migliore || migliore.n < Math.max(1, visibili * 0.01)) return null;
  const m = migliore;
  return "#" + [m.r, m.g, m.b].map((v) => Math.round(v / m.n).toString(16).padStart(2, "0")).join("");
}
