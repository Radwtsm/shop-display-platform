import { describe, expect, it } from "vitest";
import { aspettoCompleto, consigliata, erroriAspetto, GRUPPI_ASPETTO, paginaListino, PER_PAGINA_LISTINO, riassuntoAspetto, SECONDI } from "../core/aspetto.ts";

describe("elenco delle scelte d'aspetto", () => {
  it.each(GRUPPI_ASPETTO.map((g) => [g.titolo, g] as const))("%s: opzioni in numero pari (miniature a coppie), valori unici", (_, g) => {
    expect(g.opzioni.length % 2).toBe(0);
    expect(new Set(g.opzioni.map((o) => o.valore)).size).toBe(g.opzioni.length);
  });
  it("chiavi uniche", () => expect(new Set(GRUPPI_ASPETTO.map((g) => g.chiave)).size).toBe(GRUPPI_ASPETTO.length));
});

describe("aspettoCompleto", () => {
  it("senza scelte: le consigliate", () => {
    expect(aspettoCompleto(undefined)).toEqual(Object.fromEntries(GRUPPI_ASPETTO.map((g) => [g.chiave, consigliata(g)])));
  });
  it("una scelta non valida torna alla consigliata", () => expect(aspettoCompleto({ testata: "storta" }).testata).toBe("sinistra"));
});

describe("erroriAspetto", () => {
  it("valori dell'elenco: nessun errore", () => expect(erroriAspetto({ testata: "basso", logo: "grande" })).toEqual([]));
  it("chiave o valore sconosciuti", () => {
    expect(erroriAspetto({ sfondo: "x" })).toEqual(["Aspetto: scelta sconosciuta (sfondo)"]);
    expect(erroriAspetto({ testata: "storta" })).toEqual(["Nome e logo: scelta non valida"]);
    expect(erroriAspetto("basso")).toEqual(["Aspetto non valido"]);
  });
});

it("riassunto: solo ciò che è diverso dal consigliato", () => {
  expect(riassuntoAspetto(undefined)).toBe("Consigliato");
  expect(riassuntoAspetto({ testata: "basso" })).toBe("Nome e logo: in basso");
});

it("passaggio: consigliata la dissolvenza; secondi in numero pari, 8 consigliato", () => {
  expect(aspettoCompleto(undefined).passaggio).toBe("dissolvenza");
  expect(erroriAspetto({ passaggio: "zoom" })).toEqual([]);
  expect(SECONDI.length % 2).toBe(0);
  expect(SECONDI[0]).toBe(8);
});

describe("paginaListino", () => {
  const voci = Array.from({ length: 8 }, (_, i) => i);
  it("fino a 6 offerte: una pagina sola, sempre quella", () => {
    expect(paginaListino(voci.slice(0, 6), 0, 8)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(paginaListino(voci.slice(0, 6), 8000, 8)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("8 offerte: 4 + 4, cambiando ogni `secondi`", () => {
    expect(paginaListino(voci, 0, 8)).toEqual([0, 1, 2, 3]);
    expect(paginaListino(voci, 8000, 8)).toEqual([4, 5, 6, 7]);
    expect(paginaListino(voci, 16000, 8)).toEqual([0, 1, 2, 3]);
  });
  it("7 offerte: 4 + 3, mai una riga da sola; nessuna pagina oltre il massimo", () => {
    expect([paginaListino(voci.slice(0, 7), 0, 8).length, paginaListino(voci.slice(0, 7), 8000, 8).length]).toEqual([4, 3]);
    for (let n = 1; n <= 30; n++)
      for (let t = 0; t < 5; t++) {
        const pag = paginaListino(Array.from({ length: n }, (_, i) => i), t * 8000, 8);
        expect(pag.length).toBeLessThanOrEqual(PER_PAGINA_LISTINO);
        if (n > 1) expect(pag.length).toBeGreaterThan(1);
      }
  });
  it("nessuna offerta: pagina vuota", () => expect(paginaListino([], 0, 8)).toEqual([]));
});
