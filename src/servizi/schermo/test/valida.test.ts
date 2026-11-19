import { describe, expect, it } from "vitest";
import { contrasto, valida } from "../core/valida.ts";
import demo from "../../../../fixtures/demo.json" with { type: "json" };

const copia = () => structuredClone(demo) as any;
const errori = (x: unknown) => {
  const e = valida(x);
  return e.ok ? [] : e.errori;
};

describe("valida", () => {
  it("la demo è valida", () => {
    expect(errori(demo)).toEqual([]);
  });
  it.each([null, [], "x", { versione: 2 }])("rifiuta %j", (x) => {
    expect(valida(x).ok).toBe(false);
  });
  it("prezzo float rifiutato (solo centesimi interi)", () => {
    const c = copia();
    c.slides[1].prezzo = 2.5;
    expect(errori(c)).toContain("Offerta 2: prezzo non valido");
  });
  it("prezzo negativo rifiutato", () => {
    const c = copia();
    c.slides[1].prezzo = -1;
    expect(errori(c)).toHaveLength(1);
  });
  it("id ripetuti", () => {
    const c = copia();
    c.slides[1].id = "colazione";
    expect(errori(c)).toContain("Offerte: id ripetuti");
  });
  it("titolo vuoto o troppo lungo", () => {
    const c = copia();
    c.slides[0].titolo = "   ";
    c.slides[1].titolo = "x".repeat(81);
    expect(errori(c)).toEqual(["Offerta 1: titolo da 1 a 80 caratteri", "Offerta 2: titolo da 1 a 80 caratteri"]);
  });
  it("colori non hex", () => {
    const c = copia();
    c.negozio.colori.sfondo = "red";
    expect(errori(c)).toEqual(["Colori: quattro colori nel formato #rrggbb"]);
  });
  it("poco contrasto testo/sfondo", () => {
    const c = copia();
    c.negozio.colori.testo = "#2a1d12";
    expect(errori(c)[0]).toMatch(/Le scritte si confondono con lo sfondo/);
  });
  it("poco contrasto testo/principale (intestazione)", () => {
    const c = copia();
    c.negozio.colori.primario = "#f5efe6";
    expect(errori(c)).toEqual(["Colori: Il nome del negozio si confonde con la barra in alto"]);
  });
  it("colori che si leggono male accettati solo se il negoziante li ha scelti apposta (Usa lo stesso)", () => {
    const c = copia();
    c.negozio.colori.testo = "#2a1d12";
    (c.negozio as { contrastoLibero?: unknown }).contrastoLibero = true;
    expect(valida(c).ok).toBe(true);
    (c.negozio as { contrastoLibero?: unknown }).contrastoLibero = "sì";
    expect(errori(c)).toContain("Colori: scelta non valida");
  });
  it("colori del marchio: quattro colori validi", () => {
    const c = copia();
    (c.negozio as { marchio?: unknown }).marchio = { primario: "#000000" };
    expect(errori(c)).toEqual(["Colori del negozio: quattro colori nel formato #rrggbb"]);
  });
  it.each(["logo.svg", "../x.png", "/etc/x.png", "a b.png", "x.png.exe"])("logo rifiutato %j", (logo) => {
    const c = copia();
    c.negozio.logo = logo;
    expect(errori(c)).toEqual(["Logo: solo file png, jpg o webp con nome semplice"]);
  });
  it("logo semplice accettato", () => {
    const c = copia();
    c.negozio.logo = "logo.png";
    expect(errori(c)).toEqual([]);
  });
  it("fasce sbagliate", () => {
    const c = copia();
    c.slides[0].fasce = [{ giorni: [0, 8], da: "24:00", a: "7:00" }];
    expect(errori(c)).toEqual(["Offerta 1, fascia 1: giorni da 1 (lunedì) a 7 (domenica)", "Offerta 1, fascia 1: orari nel formato HH:MM"]);
  });
  it("troppe offerte", () => {
    const c = copia();
    c.slides = Array.from({ length: 51 }, (_, i) => ({ id: `s${i}`, titolo: "x", attiva: true }));
    expect(errori(c)).toEqual(["Offerte: da 0 a 50"]);
  });
  it("secondi fuori intervallo", () => {
    const c = copia();
    c.secondiPerSlide = 1;
    expect(errori(c)).toEqual(["Secondi per offerta da 3 a 120"]);
  });
});

describe("contrasto", () => {
  it("valori WCAG noti", () => {
    expect(contrasto("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrasto("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrasto("#123456", "#123456")).toBe(1);
  });
});

describe("colori del tema (A9)", () => {
  it("neve su sfondo chiaro: tinta tenue, non macchie scure; su sfondo scuro resta", async () => {
    const { coloreDecorazione } = await import("../../../piattaforma/core/colori.ts");
    expect(coloreDecorazione("#1d2b3a", "#f7f9fb")).toBe("#a0a7ae");
    expect(coloreDecorazione("#fff8ee", "#0e2a1f")).toBe("#fff8ee");
    expect(coloreDecorazione("#ffd27a", "#ffffff")).toBe("#ffd27a");
  });
  it("solo «negozio» è valido e sceltaTema lo tiene", async () => {
    const { erroriSceltaTema, sceltaTema } = await import("../../../piattaforma/core/negozio.ts");
    expect(erroriSceltaTema({ tema: "natale", temaColori: "negozio" })).toEqual([]);
    expect(erroriSceltaTema({ temaColori: "tema" })).toHaveLength(1);
    expect(sceltaTema({ tema: "natale", temaColori: "negozio", altro: 1 } as never)).toEqual({ tema: "natale", temaColori: "negozio" });
  });
  it("variante: solo quelle del tema scelto; sceltaTema la tiene solo col suo tema", async () => {
    const { erroriSceltaTema, sceltaTema } = await import("../../../piattaforma/core/negozio.ts");
    expect(erroriSceltaTema({ tema: "natale", temaVariante: "nordico" })).toEqual([]);
    expect(erroriSceltaTema({ tema: "pasqua", temaVariante: "nordico" })).toEqual(["Variante del tema: non esiste per questo tema"]);
    expect(erroriSceltaTema({ temaVariante: "caldo" })).toHaveLength(1);
    expect(erroriSceltaTema({ tema: "natale", temaVariante: "classico" })).toHaveLength(1);
    expect(sceltaTema({ tema: "natale", temaVariante: "caldo" })).toEqual({ tema: "natale", temaVariante: "caldo" });
    expect(sceltaTema({ tema: "pasqua", temaVariante: "caldo" } as never)).toEqual({ tema: "pasqua" });
  });
});
