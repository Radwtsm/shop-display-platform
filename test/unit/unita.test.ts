import { describe, expect, it } from "vitest";
import { descriviQuantita, leggiQuantita, prezzoPerUnita } from "../../src/piattaforma/core/unita.ts";
import { valida } from "../../src/servizi/schermo/core/valida.ts";
import demo from "../../fixtures/demo.json" with { type: "json" };

describe("leggiQuantita", () => {
  it.each([
    ["100 g", { valore: 100, unita: "g" }], ["100g", { valore: 100, unita: "g" }], ["1 kg", { valore: 1000, unita: "g" }],
    ["1,5 kg", { valore: 1500, unita: "g" }], ["0.25 KG", { valore: 250, unita: "g" }], ["500 ml", { valore: 500, unita: "ml" }],
    ["1 l", { valore: 1000, unita: "ml" }], ["0,75 l", { valore: 750, unita: "ml" }], ["2 lt", { valore: 2000, unita: "ml" }], ["200 gr", { valore: 200, unita: "g" }],
  ])("%j", (t, q) => expect(leggiQuantita(t)).toEqual(q));
  it.each(["", "kg", "0 g", "1,0005 kg", "100", "3 pezzi", "-1 kg", "1000 kg"])("rifiuta %j", (t) => expect(leggiQuantita(t)).toBeNull());
});

describe("prezzoPerUnita", () => {
  it("2,50 € all'etto = 25,00 €/kg", () => expect(prezzoPerUnita(250, { valore: 100, unita: "g" })).toEqual({ centesimi: 2500, per: "kg" }));
  it("1,29 € per 750 ml = 1,72 €/l (arrotondato)", () => expect(prezzoPerUnita(129, { valore: 750, unita: "ml" })).toEqual({ centesimi: 172, per: "l" }));
  it("niente virgola mobile: 0,29 € per 100 g = 2,90 €/kg", () => expect(prezzoPerUnita(29, { valore: 100, unita: "g" }).centesimi).toBe(290));
});

describe("descriviQuantita", () => {
  it.each([[{ valore: 100, unita: "g" }, "100 g"], [{ valore: 1500, unita: "g" }, "1,5 kg"], [{ valore: 750, unita: "ml" }, "750 ml"], [{ valore: 1000, unita: "ml" }, "1 l"]] as const)("%j", (q, t) =>
    expect(descriviQuantita(q)).toBe(t));
  it("andata e ritorno", () => {
    for (const t of ["100 g", "1,5 kg", "750 ml", "2 l"]) expect(descriviQuantita(leggiQuantita(t)!)).toBe(t);
  });
});

describe("valida quantità", () => {
  const con = (q: unknown, prezzo: number | null = 250) => {
    const c = structuredClone(demo) as any;
    c.slides[1].quantita = q;
    if (prezzo === null) delete c.slides[1].prezzo;
    else c.slides[1].prezzo = prezzo;
    const e = valida(c);
    return e.ok ? [] : e.errori;
  };
  it("valida", () => expect(con({ valore: 100, unita: "g" })).toEqual([]));
  it.each([[{ valore: 0, unita: "g" }], [{ valore: 1.5, unita: "g" }], [{ valore: 100, unita: "pz" }], ["100 g"]])("rifiuta %j", (q) =>
    expect(con(q)).toEqual(["Offerta 2: quantità non valida"]));
  it("senza prezzo non ha senso", () => expect(con({ valore: 100, unita: "g" }, null)).toEqual(["Offerta 2: la quantità serve solo se c'è un prezzo"]));
});
