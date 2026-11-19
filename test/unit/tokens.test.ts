import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error script JS senza tipi
import { carica, css } from "../../scripts/tokens.mjs";
// @ts-expect-error script JS senza tipi
import { confronta, controlla, statiCheSpostano } from "../../scripts/lint-css.mjs";
import { accentoPannello } from "../../src/piattaforma/core/tema.ts";
import { contrasto, valida } from "../../src/servizi/schermo/core/valida.ts";
import demo from "../../fixtures/demo.json" with { type: "json" };

const t = carica() as Record<"base" | "chiaro" | "scuro", Record<string, string>> & { temi: Record<string, Record<string, string>>; varianti: Record<string, Record<string, Record<string, string>>> };

// [testo, sfondo, minimo]: ogni coppia usata nel pannello, controllata in tutti e due i modi
const COPPIE: [string, string, number][] = [
  ["colore-testo-primario", "colore-sfondo-pagina", 4.5],
  ["colore-testo-primario", "colore-sfondo-gruppo", 4.5],
  ["colore-testo-secondario", "colore-sfondo-pagina", 4.5],
  ["colore-testo-secondario", "colore-sfondo-gruppo", 4.5],
  ["colore-azione", "colore-sfondo-gruppo", 4.5],
  ["colore-azione", "colore-sfondo-pagina", 4.5],
  ["colore-su-azione", "colore-azione", 4.5],
  ["colore-pericolo", "colore-sfondo-gruppo", 4.5],
  ["colore-successo", "colore-sfondo-gruppo", 3],
  ["colore-interruttore-spento", "colore-sfondo-gruppo", 3],
  ["colore-toast-testo", "colore-toast-sfondo", 4.5],
  ["colore-toast-azione", "colore-toast-sfondo", 4.5],
  ["colore-avviso-testo", "colore-avviso-sfondo", 4.5],
  ["colore-fuoco", "colore-sfondo-pagina", 3],
  ["colore-suite-accento", "colore-sfondo-gruppo", 3],
  ["colore-su-admin-azione", "colore-admin-azione", 4.5],
  ["colore-admin-link", "colore-sfondo-gruppo", 4.5],
  ["colore-admin-link", "colore-sfondo-pagina", 4.5],
  ["colore-stato-ok", "colore-stato-ok-sfondo", 4.5],
  ["colore-stato-ok", "colore-sfondo-gruppo", 4.5],
  ["colore-stato-attenzione", "colore-stato-attenzione-sfondo", 4.5],
  ["colore-stato-attenzione", "colore-sfondo-gruppo", 4.5],
  ["colore-stato-problema", "colore-stato-problema-sfondo", 4.5],
  ["colore-stato-problema", "colore-sfondo-gruppo", 4.5],
];

describe("token", () => {
  it("chiaro e scuro hanno gli stessi nomi", () => {
    expect(Object.keys(t.scuro).sort()).toEqual(Object.keys(t.chiaro).sort());
  });
  it.each(["chiaro", "scuro"] as const)("contrasto delle coppie in modo %s", (modo) => {
    const male = COPPIE.filter(([a, b, min]) => contrasto(t[modo][a]!.slice(0, 7), t[modo][b]!.slice(0, 7)) < min).map(
      ([a, b, min]) => `${a} su ${b}: ${contrasto(t[modo][a]!.slice(0, 7), t[modo][b]!.slice(0, 7)).toFixed(2)} < ${min}`,
    );
    expect(male).toEqual([]);
  });
  it("tocchi minimi da 48 px e testo base da 18 px", () => {
    expect(t.base["tocco-minimo"]).toBe("3rem");
    expect(t.base["testo-corpo"]).toBe("1.125rem");
  });
  it("il CSS generato contiene tutti i token", () => {
    const out = css();
    for (const k of [...Object.keys(t.base), ...Object.keys(t.chiaro)]) expect(out).toContain(`--${k}:`);
    expect(out).toContain("prefers-color-scheme: dark");
  });
  it("un alias inesistente è un errore", () => {
    const d = mkdtempSync(join(tmpdir(), "tok-"));
    const f = join(d, "t.json");
    writeFileSync(f, JSON.stringify({ base: { a: { $value: "{non.esiste}" } }, chiaro: {}, scuro: {} }));
    expect(() => carica(f)).toThrow(/alias non valido/);
  });
  it("gli alias si risolvono", () => {
    const d = mkdtempSync(join(tmpdir(), "tok-"));
    const f = join(d, "t.json");
    writeFileSync(f, JSON.stringify({ base: { a: { $value: "#123456" } }, chiaro: { b: { $value: "{a}" } }, scuro: { b: { $value: "{a}" } } }));
    expect(carica(f).chiaro.b).toBe("#123456");
  });
});

describe("lint-css", () => {
  it("nessun problema fuori dalla baseline, nessuna voce della baseline già corretta", () => {
    expect(confronta(controlla(), readFileSync("design/lint-baseline.txt", "utf8"))).toEqual([[], []]);
  });
  it("baseline: un problema nuovo blocca, uno corretto va tolto", () => {
    expect(confronta(["a", "b"], "# commento\na\n")).toEqual([["b"], []]);
    expect(confronta([], "a\n")).toEqual([[], ["a"]]);
  });
  it("trova colori e misure scritti a mano", () => {
    const d = mkdtempSync(join(tmpdir(), "css-"));
    writeFileSync(join(d, "x.css"), "a { color: #fff; }\nb { background: rgb(0 0 0); }\nc { font-size: 14px; }\nd { color: white; }\ne { font-size: var(--testo-corpo); }\n");
    expect(controlla(d)).toHaveLength(4);
  });
});

describe("accentoPannello", () => {
  it("marrone scuro del panificio: sì in chiaro, no in scuro", () => {
    const a = accentoPannello("#7a3e12");
    expect(a.chiaro).toEqual({ azione: "#7a3e12", suAzione: "#ffffff" });
    expect(a.scuro).toBeNull();
  });
  it("giallo chiaro: no in chiaro (illeggibile su bianco), sì in scuro con testo nero", () => {
    const a = accentoPannello("#ffd27a");
    expect(a.chiaro).toBeNull();
    expect(a.scuro).toEqual({ azione: "#ffd27a", suAzione: "#000000" });
  });
  it("grigio medio: no in tutti e due", () => {
    expect(accentoPannello("#808080")).toEqual({ chiaro: null, scuro: null });
  });
});

describe("stati che spostano il layout", () => {
  it.each([
    "a[aria-current=page] { color: red; font-weight: 600; }",
    "button:hover { padding: 4px; }",
    ".voce.attiva { border: 2px solid; }",
    "x:focus-visible { width: 10px }",
  ])("vietato: %s", (css) => expect(statiCheSpostano(css)).toHaveLength(1));
  it.each([
    "a[aria-current=page] { color: red; background: blue; }",
    "button:active { filter: brightness(.9); transform: scale(.98); }",
    ":focus-visible { outline: 3px solid; outline-offset: 2px; }",
    "a { font-weight: 600; }",
    "x:checked::after { transform: translateX(1rem); border-color: red; }",
  ])("ammesso: %s", (css) => expect(statiCheSpostano(css)).toEqual([]));
});

describe("temi stagionali della TV", () => {
  it.each(Object.keys(t.temi))("%s: contrasto come i colori del negozio (passa valida)", (nome) => {
    const c = structuredClone(demo) as any;
    c.negozio.colori = t.temi[nome];
    c.tema = nome;
    expect(valida(c)).toMatchObject({ ok: true });
  });
  it("ogni tema ha i 4 colori e finisce nel CSS", () => {
    const out = css();
    for (const [nome, v] of Object.entries(t.temi)) {
      expect(Object.keys(v).sort()).toEqual(["accento", "primario", "sfondo", "testo"]);
      expect(out).toContain(`[data-tema="${nome}"]`);
    }
  });
  it.each(Object.entries(t.varianti).flatMap(([tema, vs]) => Object.keys(vs).map((v) => [tema, v])))("variante %s %s: contrasto come i colori del negozio, nel CSS", (tema, v) => {
    const c = structuredClone(demo) as any;
    c.negozio.colori = t.varianti[tema]![v];
    c.tema = tema;
    c.temaVariante = v;
    expect(valida(c)).toMatchObject({ ok: true });
    expect(css()).toContain(`[data-tema="${tema}"][data-tema-variante="${v}"]`);
  });
  it("ogni palette di tema porta il suo --su-accento (scritte sul tile della coda), come suColore()", async () => {
    const { suColore } = await import("../../src/piattaforma/core/colori.ts");
    const out = css();
    const tutte = [...Object.entries(t.temi), ...Object.values(t.varianti).flatMap((vs) => Object.entries(vs))];
    for (const [, v] of tutte) expect(out).toContain(`--accento: ${v.accento};\n  --sfondo: ${v.sfondo};\n  --testo: ${v.testo};\n  --su-accento: ${suColore(v.accento!)};`);
    expect(suColore("#c1121f")).toBe("#ffffff"); // saldi: rosso scuro → bianco (prima restava il nero del negozio)
  });
  it("varianti: le stesse in tokens.json e in VARIANTI_TEMA", async () => {
    const { VARIANTI_TEMA } = await import("../../src/piattaforma/core/negozio.ts");
    expect(Object.fromEntries(Object.entries(t.varianti).map(([k, vs]) => [k, Object.keys(vs)]))).toEqual(VARIANTI_TEMA);
  });
  it("tema sconosciuto rifiutato", () => {
    const c = structuredClone(demo) as any;
    c.tema = "halloween";
    expect(valida(c)).toEqual({ ok: false, errori: ["Tema: uno tra natale, pasqua, estate, saldi, blackfriday"] });
  });
});

describe("negozio: orari, città e barra della TV", () => {
  const con = (extra: object) => valida({ ...structuredClone(demo), negozio: { ...(demo as any).negozio, ...extra } } as any);
  it("accetta dati giusti", () => {
    expect(con({ orari: [{ giorni: [1, 2], da: "08:00", a: "19:00" }], citta: { nome: "Torino", lat: 45.07, lon: 7.69 }, barra: { posizione: "sopra", testo: "Ciao" } }).ok).toBe(true);
  });
  it("rifiuta orari, città e barra sbagliati", () => {
    expect(con({ orari: [{ giorni: [8], da: "08:00", a: "19:00" }] }).ok).toBe(false);
    expect(con({ orari: Array.from({ length: 11 }, () => ({ giorni: [1], da: "08:00", a: "09:00" })) }).ok).toBe(false);
    expect(con({ citta: { nome: "Torino", lat: 95, lon: 7 } }).ok).toBe(false);
    expect(con({ citta: { nome: "", lat: 45, lon: 7 } }).ok).toBe(false);
    expect(con({ barra: { posizione: "dietro" } }).ok).toBe(false);
    expect(con({ barra: { testo: "x".repeat(201) } }).ok).toBe(false);
  });
});

// Quattro livelli di testo della TV (A141, owner 12/11 «regole consistenti di dimensione»): ogni tv-testo è un alias di
// un livello; in affiancato min(livello, tetto in vw). Fuori scala solo quelli qui sotto, con il loro perché.
const FUORI_SCALA: Record<string, string> = {
  "eq-numero": "coda da sola: il numero è tutta la TV (2 × livello 1)",
  "eq-numero-affiancato": "coda da sola in mezza TV",
  "qr-sotto": "da vicino (~1 m), sotto il QR",
  "barra-credito": "da vicino, crediti del meteo",
};
const VICINO_MIN = 1.7;
const grezzi = (() => {
  const j = JSON.parse(readFileSync("design/tokens.json", "utf8")) as { base: Record<string, Record<string, { $value: string }>> };
  const g = Object.values(j).find((x) => typeof x === "object" && x && "tv-testo" in x) as Record<string, Record<string, { $value: string }>>;
  return { testi: Object.entries(g["tv-testo"]!).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, v.$value] as const), livelli: g["tv-livello"]! };
})();
/** Il valore più piccolo che il token può prendere su una TV 16:9, in vh (min(a, b) = il più piccolo dei due). */
function vhMinimo(v: string): number {
  const n = [...v.matchAll(/([\d.]+)(vh|vw)/g)].map(([, x, u]) => Number(x) * (u === "vw" ? 16 / 9 : 1));
  return Math.min(...n);
}

describe("quattro livelli di testo della TV", () => {
  const livelli = Object.entries(grezzi.livelli).filter(([k]) => !k.startsWith("$")).map(([, v]) => v.$value);
  it("sono 4, dal più grande al più piccolo", () => {
    expect(livelli).toHaveLength(4);
    expect([...livelli].sort((a, b) => parseFloat(b) - parseFloat(a))).toEqual(livelli);
  });
  it.each(grezzi.testi)("%s è un livello", (nome, v) => {
    if (nome in FUORI_SCALA) return expect(vhMinimo(t.base[`tv-testo-${nome}`]!), FUORI_SCALA[nome]).toBeGreaterThanOrEqual(VICINO_MIN);
    const vh = /^\{tv-livello\.[1-4]\}$/.test(v) ? null : /^min\(([\d.]+vh), [\d.]+vw\)$/.exec(v)?.[1];
    expect(vh === null || livelli.includes(vh!), `${nome} = ${v}: usa {tv-livello.N} (o min(livello, …vw) in affiancato)`).toBe(true);
  });
  it("il riquadro della coda usa solo misure in vh (stessa scala, niente cqi che la rimpicciolisce)", () => {
    for (const [k, v] of Object.entries(t.base).filter(([k]) => k.startsWith("tv-testo-eq-") && k.endsWith("-riquadro")))
      expect(v, k).toMatch(/^[\d.]+vh$/);
  });
  it("colonna della coda larga almeno un quarto dello schermo", () => expect(vhMinimo(t.base["tv-misura-lato"]!)).toBeGreaterThanOrEqual(0.24 * 1920 / 10.8));
  it("scritte sul colore pieno della coda leggibili (anche Lavagna)", () => {
    expect(contrasto(t.base["tv-su-accento"]!, t.base["tv-accento"]!)).toBeGreaterThanOrEqual(4.5);
    expect(contrasto(t.base["tv-su-gesso-prezzo"]!, t.base["tv-gesso-prezzo"]!)).toBeGreaterThanOrEqual(4.5);
  });
});
