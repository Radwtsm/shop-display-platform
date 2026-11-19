import { describe, expect, it } from "vitest";
import { avvisi, cerca, durata, online, perServizio, riepilogo, spostaDemo, type DatiAdmin } from "../../src/piattaforma/core/admin.ts";
import { SERVIZI } from "../../src/piattaforma/core/servizi.ts";
import demo from "../../fixtures/admin-demo.json" with { type: "json" };

const d = demo as DatiAdmin;
const ORA = Date.parse("2026-10-27T09:00:00Z");

describe("riepilogo", () => {
  it("numeri della demo", () => {
    const r = riepilogo(d, ORA);
    expect({ ...r, avvisi: r.avvisi.length }).toEqual({ clienti: 6, abbonamenti: 8, dispositiviOnline: 8, dispositiviTotali: 9, canoniMese: 23400, avvisi: 3 });
  });
});

describe("avvisi", () => {
  it("solo ciò che chiede un'azione, prima i problemi", () => {
    expect(avvisi(d, ORA).map((a) => [a.livello, a.cliente, a.titolo])).toEqual([
      ["problema", "Bar Esempio", "TV cassa spenta da 2 h"],
      ["attenzione", "Panificio Demo", "Prova di ripristino di 36 giorni fa"],
      ["attenzione", "Macelleria Prova", "TV banco su versione 0.2.1"],
    ]);
  });
  it("una TV ferma da meno di 30 minuti non è un avviso (stato passeggero)", () => {
    const c = structuredClone(d);
    c.clienti[1]!.dispositivi[0]!.ultimoSegnale = "2026-10-27T08:40:00Z";
    expect(avvisi(c, ORA).some((a) => a.titolo.includes("TV cassa"))).toBe(false);
  });
  it("backup fermo da più di 26 h", () => {
    const c = structuredClone(d);
    c.clienti[3]!.backup.ultimo = "2026-10-25T03:00:00Z";
    expect(avvisi(c, ORA).find((a) => a.cliente === "Farmacia Modello")).toMatchObject({ livello: "problema", titolo: "Backup fermo da 2 giorni" });
  });
});

describe("perServizio", () => {
  it("numeri di ogni servizio attivo; i canoni dei servizi fanno il totale", () => {
    const { attivi, inArrivo } = perServizio(d, ORA);
    expect(attivi.map((a) => [a.servizio.id, a.clienti.length, a.canoniMese, `${a.dispositiviOnline}/${a.dispositiviTotali}`, a.problemi])).toEqual([
      ["schermo", 5, 14500, "6/7", 1],
      ["eliminacode", 2, 6900, "2/2", 0],
      ["menu-qr", 1, 2000, "0/0", 0],
    ]);
    expect(attivi.reduce((t, a) => t + a.canoniMese, 0)).toBe(riepilogo(d, ORA).canoniMese);
    expect(inArrivo).toHaveLength(SERVIZI.length - 3);
  });
  it("un display dell'eliminacode spento usa le sue parole", () => {
    const c = structuredClone(d);
    c.clienti[3]!.dispositivi[0]!.ultimoSegnale = "2026-10-27T07:00:00Z";
    expect(avvisi(c, ORA).find((a) => a.cliente === "Farmacia Modello")).toMatchObject({ titolo: "Sala d'attesa spento da 2 h" });
  });
  it("ogni servizio usato nei dati esiste nel catalogo", () => {
    const ids = new Set(SERVIZI.map((s) => s.id));
    for (const c of d.clienti) for (const x of [...c.servizi, ...c.dispositivi]) expect(ids).toContain(x.servizio);
  });
});

describe("online e durata", () => {
  it("online se l'ultimo segnale è di meno di 5 minuti fa", () => {
    expect(online({ id: "", nome: "", servizio: "schermo", versione: "", ultimoSegnale: "2026-10-27T08:55:01Z" }, ORA)).toBe(true);
    expect(online({ id: "", nome: "", servizio: "schermo", versione: "", ultimoSegnale: "2026-10-27T08:55:00Z" }, ORA)).toBe(false);
  });
  it.each([[30_000, "meno di un minuto"], [120_000, "2 min"], [3 * 3600_000, "3 h"], [47 * 3600_000, "47 h"], [5 * 86400_000, "5 giorni"]])("%i ms", (ms, t) => {
    expect(durata(ms)).toBe(t);
  });
});

describe("cerca", () => {
  it.each([["", 6], ["bar", 1], ["CENTRO", 2], ["eliminacode", 2], ["menu qr", 1], ["macelleria mercato", 1], ["càffè", 0], ["farmàcia", 1]])("%j", (q, n) => {
    expect(cerca(d.clienti, q)).toHaveLength(n);
  });
});

describe("spostaDemo", () => {
  it("un giorno dopo, gli avvisi sono gli stessi (la demo resta viva)", () => {
    const dopo = ORA + 86_400_000;
    expect(avvisi(spostaDemo(d, dopo), dopo)).toEqual(avvisi(d, ORA));
  });
  it("senza riferimento non sposta niente", () => {
    const { riferimento: _, ...senza } = d;
    expect(spostaDemo(senza, ORA + 1e9)).toBe(senza);
  });
});
