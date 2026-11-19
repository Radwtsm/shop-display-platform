import { describe, expect, it } from "vitest";
import { schermate, stelle } from "../core/schermate.ts";
import { FINTE } from "../fixtures/recensioni.ts";
import type { RispostaVetrina } from "../core/tipi.ts";

const base: RispostaVetrina = {
  storia: { testo: "x" },
  orari: [],
  contatti: {},
  linkMenu: "/menu.html",
  qr: [
    { id: "recensione", titolo: "a", sotto: "b", testo: "c" },
    { id: "instagram", titolo: "a", sotto: "b", testo: "d" },
  ],
  recensioni: FINTE,
  secondiPerSlide: 10,
};

describe("schermate", () => {
  it("storia, un QR per volta, una recensione per volta (A136(3)), in quest'ordine", () => {
    const s = schermate(base);
    expect(s.map((x) => x.tipo)).toEqual(["storia", "qr", "qr", ...Array(FINTE.elenco.length).fill("recensioni")]);
    expect(s.every((x) => x.tipo !== "recensioni" || x.recensioni.length === 1)).toBe(true);
  });
  it("senza storia né QR restano le recensioni; le finte sono dichiarate", () => {
    const s = schermate({ ...base, storia: undefined, qr: [] });
    expect(s.every((x) => x.tipo === "recensioni" && x.finte)).toBe(true);
  });
  it("non scarta le recensioni brutte", () => {
    const voti = schermate(base).flatMap((x) => (x.tipo === "recensioni" ? x.recensioni.map((r) => r.voto) : []));
    expect(voti.sort()).toEqual(FINTE.elenco.map((r) => r.voto).sort());
  });
  it("stelle", () => expect(stelle(3)).toBe("★★★☆☆"));
});
