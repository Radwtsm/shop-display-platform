// A136(6): un sistema di movimento solo (src/piattaforma/client/movimento.ts), durate e curve dai token.
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error script JS senza tipi
import { carica } from "../../scripts/tokens.mjs";
// @ts-expect-error script JS senza tipi
import { controlla, transizioniDiMisure } from "../../scripts/lint-css.mjs";

const MOVIMENTO = join("src", "piattaforma", "client", "movimento.ts");

function sorgenti(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "test" ? [] : sorgenti(p);
    return p.endsWith(".ts") ? [p] : [];
  });
}

describe("un punto solo per il movimento", () => {
  it.each([
    [/\.animate\(/, ".animate("],
    [/prefers-reduced-motion/, "il media query di riduci movimento"],
  ])("%s solo in movimento.ts", (re) => {
    const fuori = sorgenti("src").filter((f) => f !== MOVIMENTO && re.test(readFileSync(f, "utf8")));
    expect(fuori).toEqual([]);
  });

  it("ogni durata che il codice può chiedere esiste nei token", () => {
    const tipo = /export type Durata = ([^;]+);/.exec(readFileSync(MOVIMENTO, "utf8"))![1]!;
    const nomi = [...tipo.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    const base = (carica() as { base: Record<string, string> }).base;
    for (const n of nomi) expect(base[`durata-${n}`], n).toMatch(/^\d+(\.\d+)?m?s$/);
    expect(base["curva-entra"]).toMatch(/^cubic-bezier\(/);
    expect(base["curva-lenta"]).toMatch(/^cubic-bezier\(/);
  });
});

describe("lint dei CSS: movimento", () => {
  const prova = (css: string) => {
    const d = mkdtempSync(join(tmpdir(), "mov-"));
    writeFileSync(join(d, "a.css"), css);
    return controlla(d) as string[];
  };
  it.each([
    [".x { transition: opacity 300ms var(--curva-entra); }", "durata senza token"],
    [".x { animation: k var(--durata-media) cubic-bezier(.2,.8,.2,1); }", "curva senza token"],
    [".x { animation: k var(--durata-media) ease-out; }", "curva senza token"],
    [".x { animation-delay: calc(var(--i) * 60ms); }", "durata senza token"],
    [".x { animation: k 16s var(--curva-lenta) infinite; }", "durata senza token"],
  ])("vietato: %s", (css, cosa) => expect(prova(css).join("\n")).toContain(cosa));
  it.each([
    ".x { animation: k var(--durata-media) var(--curva-entra) both; animation-delay: calc(var(--i, 0) * var(--durata-scaglione)); }",
    ".x { animation: scorri var(--scorri-durata) linear infinite; }",
    ".x { transition: transform var(--durata-breve); }",
  ])("ammesso: %s", (css) => expect(prova(css)).toEqual([]));

  it("una transizione su una misura è vietata, tranne le eccezioni contenute", () => {
    expect(transizioniDiMisure(".x { transition: width var(--durata-media) var(--curva-entra); }")).toHaveLength(1);
    expect(transizioniDiMisure(".x { transition: opacity var(--durata-media), transform var(--durata-media); }")).toEqual([]);
    expect(transizioniDiMisure(".pallino { transition: width var(--durata-media) var(--curva-entra); }")).toEqual([]);
  });
});
