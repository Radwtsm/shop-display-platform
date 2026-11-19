import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROFILO_ESEMPIO, type Sito } from "../../scripts/analisi/core.ts";
import { confronta, giorni, leggiFotografia, titolo, type Fotografia } from "../../scripts/resoconto/core.ts";
import { fotografie } from "../../scripts/resoconto.ts";
import { Archivio } from "../../src/piattaforma/server/archivio.ts";

const SITO: Sito = { indirizzo: "https://forno.example", raggiunto: true, mobile: false, lcpMs: 3000, problemi: 2, contrasto: 3 };
const foto = (data: string, x: Partial<Fotografia["profilo"]> = {}, sito: Sito | null = null): Fotografia => ({ versione: 1, data, profilo: { ...PROFILO_ESEMPIO, ...x }, sito });
const verso = (c: ReturnType<typeof confronta>, voce: string) => c.find((x) => x.voce === voce)?.verso;

describe("confronta", () => {
  it("più recensioni, media su, foto e sito sistemati: tutto meglio", () => {
    const c = confronta(foto("2026-10-01", { recensioni: 23, media: 4.3, foto: 4 }, SITO), foto("2026-10-31", { recensioni: 37, media: 4.5, foto: 12 }, { ...SITO, mobile: true, problemi: 0, contrasto: 0 }));
    expect(c.find((x) => x.voce === "Recensioni su Google")).toEqual({ voce: "Recensioni su Google", prima: "23", dopo: "37 (+14)", verso: "meglio" });
    expect(c.find((x) => x.voce === "Foto su Google")).toMatchObject({ prima: "4", dopo: "10 o più", verso: "meglio" });
    for (const v of ["Media delle stelle", "Sito leggibile dal telefono", "Problemi di leggibilità del sito"]) expect(verso(c, v)).toBe("meglio");
    expect(verso(c, "Sito raggiungibile")).toBe("uguale");
  });
  it("la media che oscilla di meno di 0,1 è uguale, non peggio", () => {
    expect(verso(confronta(foto("2026-10-01", { media: 4.34 }), foto("2026-10-31", { media: 4.28 })), "Media delle stelle")).toBe("uguale");
    expect(verso(confronta(foto("2026-10-01", { media: 4.5 }), foto("2026-10-31", { media: 4.3 })), "Media delle stelle")).toBe("peggio");
  });
  it("senza sito né prima né dopo: niente righe sul telefono", () => {
    const c = confronta(foto("2026-10-01"), foto("2026-10-31"));
    expect(c.map((x) => x.voce)).not.toContain("Sito leggibile dal telefono");
    expect(verso(c, "Sito raggiungibile")).toBe("uguale");
  });
  it("minisito nuovo: raggiungibile meglio", () => {
    expect(verso(confronta(foto("2026-10-01"), foto("2026-10-31", {}, { ...SITO, mobile: true })), "Sito raggiungibile")).toBe("meglio");
  });
});

describe("titolo e giorni", () => {
  it("il risultato più importante in una riga", () => {
    expect(giorni("2026-10-01", "2026-10-31")).toBe(30);
    expect(giorni("2026-10-20", "2026-10-27")).toBe(7); // attraverso il cambio d'ora
    expect(titolo(foto("2026-10-01", { recensioni: 23 }), foto("2026-10-31", { recensioni: 37 }))).toBe("+14 recensioni in 30 giorni");
    expect(titolo(foto("2026-10-01", { foto: 2 }), foto("2026-10-31", { foto: 10 }))).toBe("1 cosa migliorata in 30 giorni");
    expect(titolo(foto("2026-10-01"), foto("2026-10-31"))).toBe("Situazione dopo 30 giorni");
  });
});

describe("fotografie del cliente", () => {
  it("lette dai dati del cliente, dalla più vecchia; rotte saltate e contate; mai di un altro cliente", () => {
    const d = mkdtempSync(join(tmpdir(), "foto-"));
    const a = new Archivio(d).cliente("forno-a");
    a.salvaFotografia("2026-10-31", JSON.stringify(foto("2026-10-31", { recensioni: 37 })));
    a.salvaFotografia("2026-10-01", JSON.stringify(foto("2026-10-01", { recensioni: 23 })));
    mkdirSync(join(a.dir, "fotografie"), { recursive: true });
    writeFileSync(join(a.dir, "fotografie", "2026-10-15.json"), "{rotto");
    new Archivio(d).cliente("forno-b").salvaFotografia("2026-10-20", JSON.stringify(foto("2026-10-20")));
    const r = fotografie(a);
    expect(r.buone.map((f) => f.data)).toEqual(["2026-10-01", "2026-10-31"]);
    expect(r.rotte).toBe(1);
  });
  it("data non valida: rifiutata prima di scrivere (niente percorsi fuori)", () => {
    const a = new Archivio(mkdtempSync(join(tmpdir(), "foto-"))).cliente("forno-a");
    expect(() => a.salvaFotografia("../../x", "{}")).toThrow();
  });
  it("leggiFotografia: niente numeri indovinati", () => {
    expect(leggiFotografia({ versione: 1, data: "2026-10-01", profilo: { nome: "X" } })).toBeNull();
    expect(leggiFotografia(foto("2026-10-01"))).not.toBeNull();
  });
});
