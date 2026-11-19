import { expect, test } from "vitest";
import { MAX_PALLINI, pallini, SECONDI_PER_ZONA } from "../../src/piattaforma/tv/zone.ts";

const t = (s: number) => s * 1000;
const segni = (r: ReturnType<typeof pallini>) => r.pallini.map((p) => (p.ora ? "O" : p.fatto ? "x" : ".")).join("");

test("niente piede se non gira niente: una zona di una pagina", () => {
  expect(pallini([{ totale: 1, secondi: 8, visibile: true }], 0)).toEqual({ gira: false, dove: "", pallini: [], conto: "", poi: "" });
});

test("una zona con 3 pagine: dove = la zona, quello attuale si riempie nel tempo della pagina, niente «poi»", () => {
  const r = pallini([{ totale: 3, secondi: 10, etichetta: "Menu", visibile: true }], t(13));
  expect(segni(r)).toBe("xO.");
  expect(r.pallini[1]).toMatchObject({ durataMs: 10_000, trascorsiMs: 3000 });
  expect(r).toMatchObject({ gira: true, dove: "Menu", conto: "", poi: "" });
});

test("più zone che girano: solo i pallini della zona visibile, «poi» = la zona dopo", () => {
  const zone = (v: number) => [
    { totale: 2, secondi: 8, etichetta: "Offerte", visibile: v === 0 },
    { totale: 1, secondi: 10, etichetta: "Chi siamo", visibile: v === 1 },
    { totale: 3, secondi: 10, etichetta: "Menu", visibile: v === 2 },
  ];
  const r = pallini(zone(1), t(45));
  expect(segni(r)).toBe("O");
  expect(r.pallini[0]).toMatchObject({ durataMs: SECONDI_PER_ZONA * 1000, trascorsiMs: 5000 });
  expect(r).toMatchObject({ dove: "Chi siamo", poi: "Menu" });
  expect(pallini(zone(2), t(45))).toMatchObject({ dove: "Menu", poi: "Offerte" }); // dall'ultima si torna alla prima
});

test(`oltre ${MAX_PALLINI} pagine: un pallino solo e il conto`, () => {
  const r = pallini([{ totale: 9, secondi: 10, etichetta: "Menu", visibile: true }, { totale: 1, secondi: 0, etichetta: "Offerte", visibile: false }], t(25));
  expect(segni(r)).toBe("O");
  expect(r.pallini[0]).toMatchObject({ durataMs: 10_000, trascorsiMs: 5000 });
  expect(r).toMatchObject({ conto: "3/9", poi: "Offerte" });
  expect(segni(pallini([{ totale: MAX_PALLINI, secondi: 10, visibile: true }], 0))).toHaveLength(MAX_PALLINI);
});

test("affiancato: due zone insieme, niente scritta né pallini; «poi» = le zone del giro dopo", () => {
  const r = pallini(
    [
      { totale: 2, secondi: 8, etichetta: "Offerte", visibile: true },
      { totale: 2, secondi: 10, etichetta: "Menu", visibile: true },
      { totale: 1, secondi: 10, etichetta: "Chi siamo", visibile: false },
    ],
    t(9),
  );
  expect(r).toEqual({ gira: true, dove: "", pallini: [], conto: "", poi: "Chi siamo" });
  expect(pallini([{ totale: 2, secondi: 8, visibile: true }, { totale: 2, secondi: 8, visibile: true }], 0).poi).toBe("");
});
