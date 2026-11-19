// Guscio TV a zone: quale zona si vede, quando la TV sembra offline, la disposizione nel negozio, l'attivazione di un servizio.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validaNegozio, validaRispostaNegozio } from "../../src/piattaforma/core/negozio.ts";
import { Archivio } from "../../src/piattaforma/server/archivio.ts";
import { attivaServizio, type ModuloServer } from "../../src/piattaforma/server/modulo.ts";
import { formeZone, OFFLINE_DOPO_MS, SECONDI_PER_ZONA, sembraOffline, zoneVisibili } from "../../src/piattaforma/tv/zone.ts";
import demo from "../../fixtures/demo.json" with { type: "json" };
import { modulo as schermo } from "../../src/servizi/schermo/server.ts";

const NEGOZIO = { versione: 1, negozio: demo.negozio };

describe("zoneVisibili", () => {
  it("un servizio solo: sempre visibile, qualunque disposizione", () => {
    expect(zoneVisibili(1, undefined, 0)).toEqual([true]);
    expect(zoneVisibili(1, "intero", 123456)).toEqual([true]);
  });
  it("intero: una zona per volta, a rotazione ogni SECONDI_PER_ZONA", () => {
    expect(zoneVisibili(2, "intero", 0)).toEqual([true, false]);
    expect(zoneVisibili(2, undefined, 0)).toEqual([true, false]);
    expect(zoneVisibili(2, "intero", SECONDI_PER_ZONA * 1000)).toEqual([false, true]);
    expect(zoneVisibili(2, "intero", 2 * SECONDI_PER_ZONA * 1000)).toEqual([true, false]);
    expect(zoneVisibili(3, "intero", 2 * SECONDI_PER_ZONA * 1000)).toEqual([false, false, true]);
  });
  it("affiancato: due alla volta (a 960×540 tre colonne non si leggono), a coppie che girano", () => {
    expect(zoneVisibili(2, "affiancato", SECONDI_PER_ZONA * 1000)).toEqual([true, true]);
    expect(zoneVisibili(3, "affiancato", 0)).toEqual([true, true, false]);
    expect(zoneVisibili(3, "affiancato", SECONDI_PER_ZONA * 1000)).toEqual([false, false, true]);
    expect(zoneVisibili(4, "affiancato", SECONDI_PER_ZONA * 1000)).toEqual([false, false, true, true]);
  });
});

describe("formeZone", () => {
  const giro = SECONDI_PER_ZONA * 1000;
  it("intero: chi sa stare in un riquadro resta sempre visibile lì, gli altri girano", () => {
    expect(formeZone([false, true], "intero", 0)).toEqual(["pieno", "riquadro"]);
    expect(formeZone([false, true], "intero", giro)).toEqual(["pieno", "riquadro"]);
    expect(formeZone([false, false, true], "intero", 0)).toEqual(["pieno", "nascosta", "riquadro"]);
    expect(formeZone([false, false, true], "intero", giro)).toEqual(["nascosta", "pieno", "riquadro"]);
  });
  it("da solo, o con soli servizi da riquadro, niente riquadro: schermo pieno o rotazione come prima", () => {
    expect(formeZone([true], "intero", 0)).toEqual(["pieno"]);
    expect(formeZone([true, true], "intero", giro)).toEqual(["nascosta", "pieno"]);
  });
  it("affiancato: il riquadro resta nella colonna destra, gli altri affiancati", () => {
    expect(formeZone([false, true], "affiancato", giro)).toEqual(["pieno", "riquadro"]);
    expect(formeZone([false, true, false], "affiancato", 0)).toEqual(["pieno", "riquadro", "pieno"]);
  });
  it("in primo piano: quella zona prende lo schermo, le altre restano come sono sotto", () => {
    expect(formeZone([false, true], "intero", 0, 1)).toEqual(["pieno", "primo-piano"]);
    expect(formeZone([false, true], "affiancato", 0, 1)).toEqual(["pieno", "primo-piano"]);
    expect(formeZone([true], "intero", 0, 0)).toEqual(["pieno"]); // da sola ha già tutto lo schermo
  });
});

describe("sembraOffline", () => {
  it("serve una sola fonte muta da più di 60 s", () => {
    const ora = 1_000_000;
    expect(sembraOffline([ora, ora - OFFLINE_DOPO_MS], ora)).toBe(false);
    expect(sembraOffline([ora, ora - OFFLINE_DOPO_MS - 1], ora)).toBe(true);
    expect(sembraOffline([], ora)).toBe(false);
  });
});

describe("disposizione nel negozio", () => {
  it("ammette intero e affiancato, rifiuta il resto", () => {
    expect(validaNegozio({ ...NEGOZIO, disposizione: "affiancato" }).ok).toBe(true);
    expect(validaNegozio({ ...NEGOZIO, disposizione: "intero" }).ok).toBe(true);
    expect(validaNegozio(NEGOZIO).ok).toBe(true);
    const e = validaNegozio({ ...NEGOZIO, disposizione: "a-tre" });
    expect(e.ok).toBe(false);
  });
  it("la risposta di /api/negozio porta solo servizi del catalogo", () => {
    expect(validaRispostaNegozio({ ...NEGOZIO, servizi: ["schermo"] }).ok).toBe(true);
    expect(validaRispostaNegozio({ ...NEGOZIO, servizi: ["inventato"] }).ok).toBe(false);
    expect(validaRispostaNegozio({ ...NEGOZIO }).ok).toBe(false);
  });
});

describe("attivaServizio", () => {
  const nuovo = () => {
    const c = new Archivio(mkdtempSync(join(tmpdir(), "att-"))).cliente("demo");
    c.scrivi("negozio", JSON.stringify(NEGOZIO));
    return c;
  };
  it("crea i dati iniziali del servizio e lo mette tra i servizi attivi", () => {
    const c = nuovo();
    expect(c.servizi()).toEqual([]);
    attivaServizio(c, schermo);
    expect(c.servizi()).toEqual(["schermo"]);
    expect(JSON.parse(c.leggi("schermo")!)).toEqual({ versione: 1, secondiPerSlide: 8, slides: [] });
  });
  it("ripetuta non cambia niente e non sovrascrive i dati del cliente", () => {
    const c = nuovo();
    attivaServizio(c, schermo);
    const miei = { versione: 1, secondiPerSlide: 12, slides: [] };
    c.scrivi("schermo", JSON.stringify(miei));
    attivaServizio(c, schermo);
    expect(c.servizi()).toEqual(["schermo"]);
    expect(JSON.parse(c.leggi("schermo")!)).toEqual(miei);
  });
  it("dati iniziali non validi: errore, il servizio non si attiva", () => {
    const c = nuovo();
    const rotto: ModuloServer = { ...schermo, iniziali: () => ({ versione: 1 }) };
    expect(() => attivaServizio(c, rotto)).toThrow(/non validi/);
    expect(c.servizi()).toEqual([]);
    expect(c.leggi("schermo")).toBeNull();
  });
});
