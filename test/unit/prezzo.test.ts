import { describe, expect, it } from "vitest";
import { formatta, formattaBreve, leggi, perCampo } from "../../src/piattaforma/core/prezzo.ts";

describe("prezzo", () => {
  it("formatta in italiano", () => {
    expect(formatta(250)).toBe("2,50 €");
    expect(formatta(123456)).toBe("1234,56 €");
  });
  it.each([
    ["2,50", 250], ["2.50", 250], ["2,5", 250], ["2", 200], ["€ 3,20", 320], ["0,10", 10], ["0,07", 7], [" 4,2 € ", 420],
  ])("legge %j", (txt, cent) => {
    expect(leggi(txt)).toBe(cent);
  });
  it.each(["", "abc", "-1", "2,505", "1.000,00", "2,,5", "100000"])("rifiuta %j", (txt) => {
    expect(leggi(txt)).toBeNull();
  });
  it("niente errori di virgola mobile", () => {
    expect(leggi("0,29")).toBe(29);
    expect(leggi("1,15")).toBe(115);
  });
  it("andata e ritorno nel campo del pannello", () => {
    for (const c of [0, 5, 10, 99, 250, 99999]) expect(leggi(perCampo(c))).toBe(c);
  });
});

describe("formattaBreve", () => {
  it.each([[23400, "234\u00a0€"], [23450, "234,50\u00a0€"], [0, "0\u00a0€"]])("%i", (c, t) => {
    expect(formattaBreve(c)).toBe(t);
  });
});
