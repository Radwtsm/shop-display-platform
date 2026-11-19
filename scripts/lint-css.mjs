// The CSS uses only tokens (design/tokens.json): no hand-written colors or font sizes outside tokens.css.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const VIETATI = [
  [/#[0-9a-fA-F]{3,8}\b/, "colore scritto a mano"],
  [/\b(rgba?|hsla?|oklch|oklab|lab|lch|color)\(/, "colore scritto a mano"],
  [/:\s*(white|black|red|blue|green|gray|grey|yellow|orange)\b/, "colore con nome"],
  // unica eccezione: un token moltiplicato per --riempi (A136(12), src/piattaforma/tv/riempi.ts), mai numeri a mano
  [/font-size:(?!\s*var\()(?!\s*calc\(var\(--[\w-]+(, var\(--[\w-]+\))?\) \* var\(--riempi, 1\)\))/, "font-size senza token"],
  [/font-family:(?!\s*(var\(|inherit))/, "font-family senza token"],
  // movimento (A136(6)): durate e curve solo dai token --durata-* e --curva-* (linear ammesso: moto a velocità fissa)
  [/(?:^|[;{\s])(transition|animation)(-duration|-delay)?\s*:[^;]*(?<![\w(-])\d*\.?\d+m?s\b/, "durata senza token"],
  [/(?:^|[;{\s])(transition|animation)(-timing-function)?\s*:[^;]*(cubic-bezier\(|\bease(-in|-out|-in-out)?\b|steps\()/, "curva senza token"],
];

// Una transizione su una misura rifà il layout a ogni fotogramma (sulla TV lenta scatta): solo opacità,
// trasformazioni e colori. Eccezione scritta qui col perché: il pallino sta in #pallini con contain: strict.
const MISURE = /\b(width|height|min-width|max-width|min-height|max-height|top|left|right|bottom|inset|margin[a-z-]*|padding[a-z-]*|font-size|gap|flex[a-z-]*|grid[a-z-]*)\b/;
const MISURE_CONTENUTE = new Set([".pallino"]);

export function transizioniDiMisure(css, file = "") {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selettore = m[1].trim().split("\n").pop().trim();
    const t = /(?:^|;)\s*transition(?:-property)?:([^;]*)/.exec(m[2]);
    if (t && MISURE.test(t[1]) && !MISURE_CONTENUTE.has(selettore)) out.push(`${file}: "${selettore}" anima una misura (rifà il layout a ogni fotogramma)`);
  }
  return out;
}

// Uno stato (attivo, premuto, hover, fuoco, selezionato) cambia colore/sfondo/ombra/opacità/trasformazione,
// mai ciò che sposta il layout: grassetto o misure diverse fanno muovere le voci vicine (DESIGN → Niente salti).
const STATO = /:(hover|active|focus|focus-visible|focus-within|checked)\b|\[aria-(current|selected|pressed|expanded|checked)|\.(attiv|selezion)/;
const SPOSTA = /(^|;)\s*(font-weight|font-size|letter-spacing|line-height|padding[a-z-]*|margin[a-z-]*|border(-width|-top|-right|-bottom|-left)?|width|height|min-width|min-height)\s*:/;

export function statiCheSpostano(css, file = "") {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selettore = m[1].trim().split("\n").pop().trim();
    if (STATO.test(selettore) && SPOSTA.test(m[2])) out.push(`${file}: lo stato "${selettore}" cambia misure o grassetto (sposta il layout)`);
  }
  return out;
}

export function controlla(dir = "public") {
  const problemi = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".css") && x !== "tokens.css")) {
    readFileSync(join(dir, f), "utf8")
      .split("\n")
      .forEach((riga, i) => {
        for (const [re, cosa] of VIETATI) if (re.test(riga)) problemi.push(`${f}:${i + 1}: ${cosa}: ${riga.trim()}`);
      });
    problemi.push(...statiCheSpostano(readFileSync(join(dir, f), "utf8"), f), ...transizioniDiMisure(readFileSync(join(dir, f), "utf8"), f));
  }
  return problemi;
}

/** Baseline che può solo calare: [nuovi problemi, voci della baseline ormai corrette]. */
export function confronta(problemi, baseline) {
  const noti = baseline.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  return [problemi.filter((p) => !noti.includes(p)), noti.filter((n) => !problemi.includes(n))];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problemi = controlla();
  const [nuovi, corretti] = confronta(problemi, readFileSync("design/lint-baseline.txt", "utf8"));
  if (corretti.length) console.error("lint-css: corretti, toglili da design/lint-baseline.txt (e chiudi la voce D in TASKLIST):\n" + corretti.join("\n"));
  if (nuovi.length) console.error("lint-css: problemi NUOVI (usa i token; niente stati che spostano il layout):\n" + nuovi.join("\n"));
  const noti = problemi.length - nuovi.length;
  if (noti) console.error(`lint-css: ${noti} disallineamenti noti ancora aperti (design/lint-baseline.txt)`);
  if (nuovi.length || corretti.length) process.exit(1);
}
