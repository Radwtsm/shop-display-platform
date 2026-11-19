// design/tokens.json -> CSS custom properties. base in :root, chiaro in :root, scuro under prefers-color-scheme.
import { readFileSync } from "node:fs";

/** Design Tokens 2025.10: una curva (cubicBezier) è [x1, y1, x2, y2]; in CSS diventa cubic-bezier(…). */
const valoreCss = (v) => (Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number") ? `cubic-bezier(${v.join(", ")})` : v);

export function appiattisci(gruppo, prefisso = [], out = {}) {
  for (const [k, v] of Object.entries(gruppo)) {
    if (k.startsWith("$")) continue;
    if (v && typeof v === "object" && "$value" in v) out[[...prefisso, k].join("-")] = valoreCss(v.$value);
    else if (v && typeof v === "object") appiattisci(v, [...prefisso, k], out);
  }
  return out;
}

/** Risolve gli alias "{gruppo.nome}" (anche a catena); un alias che non esiste è un errore. */
export function risolvi(valori, tutti) {
  const out = {};
  const uno = (v, visti = new Set()) => {
    if (typeof v !== "string") return v;
    const m = /^\{([^}]+)\}$/.exec(v);
    if (!m) return v;
    const nome = m[1].replaceAll(".", "-");
    if (visti.has(nome) || !(nome in tutti)) throw new Error(`alias non valido: ${v}`);
    visti.add(nome);
    return uno(tutti[nome], visti);
  };
  for (const [k, v] of Object.entries(valori)) out[k] = uno(v);
  return out;
}

export function carica(file = "design/tokens.json") {
  const t = JSON.parse(readFileSync(file, "utf8"));
  const base = appiattisci(t.base);
  const chiaro = appiattisci(t.chiaro);
  const scuro = appiattisci(t.scuro);
  return {
    base: risolvi(base, { ...base, ...chiaro }),
    chiaro: risolvi(chiaro, { ...base, ...chiaro }),
    scuro: risolvi(scuro, { ...base, ...scuro }),
    font: (t.fontFace?.file ?? []).map((f) => ({ famiglia: String(f.famiglia), peso: Number(f.peso), file: String(f.file) })),
    temi: Object.fromEntries(Object.entries(t.temi ?? {}).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, appiattisci(v)])),
    /** { natale: { elegante: {4 colori} } } */
    varianti: Object.fromEntries(
      Object.entries(t.variantiTemi ?? {})
        .filter(([k]) => !k.startsWith("$"))
        .map(([tema, vs]) => [tema, Object.fromEntries(Object.entries(vs).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, appiattisci(v)]))]),
    ),
  };
}

/** Nero o bianco sull'accento, come suColore() in src/piattaforma/core/colori.ts (un test li confronta). */
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const suAccento = (hex) => ((lum(hex) + 0.05) / 0.05 >= 1.05 / (lum(hex) + 0.05) ? "#000000" : "#ffffff");
/** Palette di un tema: i 4 colori + le scritte sull'accento (la TV calcola --su-accento solo dai colori del negozio). */
const palette = (v) => ({ ...v, "su-accento": suAccento(v.accento) });

const blocco = (vars) => Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join("\n");

// font serviti da noi (CSP 'self', TV offline): solo file sotto /fonts/, nomi semplici
const fontFace = (font = []) =>
  font
    .filter((f) => /^[A-Za-z ]+$/.test(f.famiglia) && /^\/fonts\/[a-z0-9-]+\.woff2$/.test(f.file) && Number.isInteger(f.peso))
    .map((f) => `@font-face { font-family: "${f.famiglia}"; font-style: normal; font-weight: ${f.peso}; font-display: swap; src: url("${f.file}") format("woff2"); }`)
    .join("\n");

export function css(t = carica()) {
  return `/* Generato da scripts/tokens.mjs da design/tokens.json: non modificare a mano. */
${fontFace(t.font)}
:root {
  color-scheme: light dark;
${blocco(t.base)}
${blocco(t.chiaro)}
}
@media (prefers-color-scheme: dark) {
  :root {
${blocco(t.scuro).replaceAll("\n", "\n  ").replace(/^/, "  ")}
  }
}
${Object.entries(t.temi ?? {})
  .map(([nome, v]) => `[data-tema="${nome}"]:not([data-tema-colori="negozio"]) {\n${blocco(palette(v))}\n}`)
  .join("\n")}
${Object.entries(t.varianti ?? {})
  .flatMap(([tema, vs]) => Object.entries(vs).map(([nome, v]) => `[data-tema="${tema}"][data-tema-variante="${nome}"]:not([data-tema-colori="negozio"]) {\n${blocco(palette(v))}\n}`))
  .join("\n")}
`;
}
