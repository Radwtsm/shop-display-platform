import { describe, expect, it } from "vitest";
import { descriviFasce, indiceCorrente, inFascia, oraLocale } from "../../src/piattaforma/core/orario.ts";
import { slideAttive } from "../../src/servizi/schermo/core/offerte.ts";
import type { Config, Fascia } from "../../src/servizi/schermo/core/tipi.ts";
import demo from "../../fixtures/demo.json" with { type: "json" };

const t = (iso: string) => Date.parse(iso);
const colazione: Fascia = { giorni: [1, 2, 3, 4, 5, 6, 7], da: "07:00", a: "11:00" };

describe("oraLocale", () => {
  it("usa l'ora di Roma, non UTC", () => {
    expect(oraLocale(t("2026-10-27T08:00:00Z"))).toEqual({ giorno: 2, minuti: 9 * 60 });
  });
  it("ora legale (CEST, +2)", () => {
    expect(oraLocale(t("2026-07-15T08:00:00Z"))).toEqual({ giorno: 3, minuti: 10 * 60 });
  });
});

describe("cambio d'ora", () => {
  // 25/10/2026: alle 03:00 CEST si torna alle 02:00 CET
  it("ottobre: le 07:30 locali sono attive prima e dopo il cambio", () => {
    expect(inFascia(colazione, t("2026-10-24T05:30:00Z"))).toBe(true); // 07:30 CEST
    expect(inFascia(colazione, t("2026-10-25T06:30:00Z"))).toBe(true); // 07:30 CET
  });
  it("ottobre: la stessa ora UTC del giorno prima ora è un'ora prima", () => {
    expect(inFascia(colazione, t("2026-10-25T05:30:00Z"))).toBe(false); // 06:30 CET
  });
  it("ottobre: le 02:30 esistono due volte, tutte e due nella fascia notturna", () => {
    const notte: Fascia = { giorni: [7], da: "02:00", a: "03:00" };
    expect(inFascia(notte, t("2026-10-25T00:30:00Z"))).toBe(true);
    expect(inFascia(notte, t("2026-10-25T01:30:00Z"))).toBe(true);
  });
  // 29/03/2026: alle 02:00 CET si passa alle 03:00 CEST
  it("marzo: la fascia delle 7 parte alle 7 locali", () => {
    expect(inFascia(colazione, t("2026-03-29T04:59:00Z"))).toBe(false); // 06:59 CEST
    expect(inFascia(colazione, t("2026-03-29T05:00:00Z"))).toBe(true); // 07:00 CEST
  });
});

describe("inFascia", () => {
  it("fine esclusa", () => {
    expect(inFascia(colazione, t("2026-10-27T09:59:00Z"))).toBe(true);
    expect(inFascia(colazione, t("2026-10-27T10:00:00Z"))).toBe(false);
  });
  it("giorno non incluso", () => {
    expect(inFascia({ ...colazione, giorni: [1] }, t("2026-10-27T08:00:00Z"))).toBe(false);
  });
  it("oltre la mezzanotte conta il giorno di inizio", () => {
    const sera: Fascia = { giorni: [5], da: "22:00", a: "02:00" }; // venerdì sera
    expect(inFascia(sera, t("2026-10-30T22:30:00Z"))).toBe(true); // ven 23:30
    expect(inFascia(sera, t("2026-10-31T00:30:00Z"))).toBe(true); // sab 01:30
    expect(inFascia(sera, t("2026-10-31T01:30:00Z"))).toBe(false); // sab 02:30
    expect(inFascia(sera, t("2026-10-31T22:30:00Z"))).toBe(false); // sab 23:30
  });
  it("domenica -> lunedì oltre la mezzanotte", () => {
    const sera: Fascia = { giorni: [7], da: "23:00", a: "01:00" };
    expect(inFascia(sera, t("2026-11-01T23:30:00Z"))).toBe(true); // lun 00:30
  });
});

describe("slideAttive", () => {
  const c = demo as Config;
  it("martedì 09:00: colazione sì, pizza no", () => {
    const ids = slideAttive(c, t("2026-10-27T08:00:00Z")).map((s) => s.id);
    expect(ids).toEqual(["colazione", "focaccia", "altamura", "torte"]);
  });
  it("domenica 12:00: niente pizza", () => {
    expect(slideAttive(c, t("2026-11-01T11:00:00Z")).map((s) => s.id)).not.toContain("pizza");
  });
  it("le offerte spente non compaiono", () => {
    const spenta = { ...c, slides: c.slides.map((s) => ({ ...s, attiva: false })) };
    expect(slideAttive(spenta, t("2026-10-27T08:00:00Z"))).toEqual([]);
  });
});

describe("indiceCorrente", () => {
  it("ruota ogni N secondi e ricomincia", () => {
    expect([0, 7999, 8000, 16000, 24000].map((ms) => indiceCorrente(3, ms, 8))).toEqual([0, 0, 1, 2, 0]);
  });
  it("nessuna offerta = -1", () => {
    expect(indiceCorrente(0, 123, 8)).toBe(-1);
  });
});

describe("descriviFasce", () => {
  it.each([
    [undefined, ""],
    [[], ""],
    [[{ giorni: [1, 2, 3, 4, 5, 6, 7], da: "06:30", a: "11:00" }], "dalle 06:30 alle 11:00"],
    [[{ giorni: [6, 5, 4, 3, 2, 1], da: "11:30", a: "14:30" }], "lun–sab, dalle 11:30 alle 14:30"],
    [[{ giorni: [1, 2, 3, 4, 5], da: "08:00", a: "12:00" }], "lun–ven, dalle 08:00 alle 12:00"],
    [[{ giorni: [7], da: "08:00", a: "12:00" }], "solo in alcuni giorni e orari"],
    [[{ giorni: [1], da: "08:00", a: "12:00" }, { giorni: [2], da: "08:00", a: "12:00" }], "solo in alcuni giorni e orari"],
  ])("%j", (fasce, testo) => {
    expect(descriviFasce(fasce as Fascia[] | undefined)).toBe(testo);
  });
});
