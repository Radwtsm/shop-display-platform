import { describe, expect, it } from "vitest";
import { COMBINAZIONI, colorePrincipale, contrasto, daUnColore, problemiColori, sistema, stessiColori, suColore } from "../../src/piattaforma/core/colori.ts";

describe("combinazioni pronte", () => {
  it.each(COMBINAZIONI.map((c) => [c.nome, c] as const))("%s si legge bene", (_, c) => expect(problemiColori(c.colori)).toEqual([]));
  it("id e nomi diversi", () => {
    expect(new Set(COMBINAZIONI.map((c) => c.id)).size).toBe(COMBINAZIONI.length);
    expect(new Set(COMBINAZIONI.map((c) => c.nome)).size).toBe(COMBINAZIONI.length);
  });
});

describe("daUnColore", () => {
  // tinte di tutto il cerchio, scure e chiare, grigi compresi: la palette calcolata si legge sempre
  const prove = ["#ff0000", "#ffcc00", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffffff", "#000000", "#808080", "#7a3e12", "#f5efe6", "#123456"];
  it.each(prove)("%s", (h) => {
    const c = daUnColore(h);
    expect(problemiColori(c)).toEqual([]);
    expect(c.sfondo).not.toBe(c.testo);
  });
  it("tiene il colore scelto quando si legge bene", () => expect(daUnColore("#7a3e12").primario).toBe("#7a3e12"));
});

describe("sistema", () => {
  it("cambia solo ciò che si legge male, il meno possibile", () => {
    const buono = COMBINAZIONI[0]!.colori;
    expect(stessiColori(sistema(buono), buono)).toBe(true);
    const giallo = { ...buono, accento: "#2a1d12" }; // prezzi scuri su sfondo scuro
    const s = sistema(giallo);
    expect(problemiColori(s)).toEqual([]);
    expect({ ...s, accento: buono.accento }).toEqual(buono);
  });
  it("anche i casi impossibili (scritte bianche, barra bianca, sfondo bianco) diventano leggibili", () => {
    const s = sistema({ primario: "#ffffff", accento: "#ffffff", sfondo: "#ffffff", testo: "#ffffff" });
    expect(problemiColori(s)).toEqual([]);
  });
});

describe("problemiColori", () => {
  it("dice cosa si legge male con parole del negozio", () => {
    expect(problemiColori({ primario: "#ffffff", accento: "#111111", sfondo: "#000000", testo: "#ffffff" })).toEqual([
      "Il nome del negozio si confonde con la barra in alto",
      "I prezzi si confondono con lo sfondo",
    ]);
    expect(contrasto("#000000", "#ffffff")).toBeCloseTo(21);
  });
});

describe("colorePrincipale (colori dal logo)", () => {
  const px = (...zone: [number, [number, number, number, number]][]) =>
    zone.flatMap(([n, c]) => Array.from({ length: n }, () => c).flat());
  it("il colore vivo più esteso, ignorando sfondo bianco, scritte nere e trasparenza", () => {
    const logo = px([500, [255, 255, 255, 255]], [200, [0, 0, 0, 255]], [300, [0, 0, 255, 0]], [120, [200, 30, 40, 255]], [40, [20, 120, 60, 255]]);
    expect(colorePrincipale(logo)).toBe("#c81e28");
  });
  it("solo bianco, nero e grigi: null (si tengono i colori del modello)", () => {
    expect(colorePrincipale(px([500, [255, 255, 255, 255]], [300, [20, 20, 20, 255]], [100, [128, 128, 128, 255]]))).toBeNull();
  });
  it("pochi pixel colorati (antialiasing) non bastano", () => {
    expect(colorePrincipale(px([1000, [255, 255, 255, 255]], [3, [200, 30, 40, 255]]))).toBeNull();
  });
  it("la palette che ne esce si legge bene", () => {
    const c = colorePrincipale(px([100, [255, 200, 0, 255]]))!;
    expect(problemiColori(daUnColore(c))).toEqual([]);
  });
});

describe("suColore (scritte sul colore pieno, es. riquadro della coda)", () => {
  const prove = ["#ff0000", "#ffcc00", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffffff", "#000000", "#808080", "#7a3e12", "#f5efe6", "#123456", "#777777"];
  it.each(prove)("%s: nero o bianco con contrasto ≥ 4,5", (h) => {
    const su = suColore(h);
    expect(["#000000", "#ffffff"]).toContain(su);
    expect(contrasto(su, h)).toBeGreaterThanOrEqual(4.5);
  });
});
