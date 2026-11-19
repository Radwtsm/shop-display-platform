import { describe, expect, it } from "vitest";
import { gradi, iconaMeteo, orologio, paginaTesto, statoOrari, validaMeteo } from "../../src/piattaforma/core/barra.ts";
import type { Fascia } from "../../src/piattaforma/core/orario.ts";

const t = (iso: string) => Date.parse(iso);
// 2026-10-27 = martedì; ottobre dopo il cambio d'ora = CET (+1)
const feriali: Fascia[] = [
  { giorni: [1, 2, 3, 4, 5], da: "08:00", a: "13:00" },
  { giorni: [1, 2, 3, 4, 5], da: "16:00", a: "19:30" },
];

describe("orologio", () => {
  it("ora di Roma", () => expect(orologio(t("2026-10-27T08:05:00Z"))).toBe("09:05"));
});

describe("statoOrari", () => {
  it("senza orari non dice niente", () => {
    expect(statoOrari(undefined, 0)).toBe("");
    expect(statoOrari([], 0)).toBe("");
  });
  it("aperto: fino a quando", () => expect(statoOrari(feriali, t("2026-10-27T09:00:00Z"))).toBe("Aperto fino alle 13:00"));
  it("pausa pranzo: riapre oggi", () => expect(statoOrari(feriali, t("2026-10-27T12:30:00Z"))).toBe("Chiuso · apre alle 16:00"));
  it("sera: riapre domani", () => expect(statoOrari(feriali, t("2026-10-27T19:00:00Z"))).toBe("Chiuso · apre domani alle 08:00"));
  it("venerdì sera: riapre lunedì", () => expect(statoOrari(feriali, t("2026-10-30T19:00:00Z"))).toBe("Chiuso · apre lunedì alle 08:00"));
  it("fasce attaccate valgono una", () => {
    const attaccate: Fascia[] = [
      { giorni: [2], da: "08:00", a: "13:00" },
      { giorni: [2], da: "13:00", a: "19:00" },
    ];
    expect(statoOrari(attaccate, t("2026-10-27T09:00:00Z"))).toBe("Aperto fino alle 19:00");
  });
  it("notte che passa la mezzanotte", () => {
    const bar: Fascia[] = [{ giorni: [2], da: "20:00", a: "02:00" }];
    expect(statoOrari(bar, t("2026-10-27T22:00:00Z"))).toBe("Aperto fino alle 02:00"); // mar 23:00
    expect(statoOrari(bar, t("2026-10-27T23:30:00Z"))).toBe("Aperto fino alle 02:00"); // mer 00:30
  });
  it("sempre chiuso quel giorno solo: apre il giorno giusto", () => {
    expect(statoOrari([{ giorni: [6], da: "10:00", a: "12:00" }], t("2026-10-27T09:00:00Z"))).toBe("Chiuso · apre sabato alle 10:00");
  });
});

describe("paginaTesto", () => {
  const testo = "Oggi cornetti caldi alla crema e al cioccolato, caffè in omaggio con la colazione completa";
  it("pagine di parole intere, mai oltre il massimo", () => {
    for (let s = 0; s < 40; s += 6) expect(paginaTesto(testo, s * 1000, 30).length).toBeLessThanOrEqual(30);
  });
  it("cambia pagina ogni 6 secondi e ricomincia", () => {
    const a = paginaTesto(testo, 0, 30);
    expect(paginaTesto(testo, 5_000, 30)).toBe(a);
    expect(paginaTesto(testo, 6_000, 30)).not.toBe(a);
    expect(paginaTesto(testo, 6_000 * 4, 30)).toBe(a);
  });
  it("una parola più lunga della pagina viene spezzata", () => expect(paginaTesto("a".repeat(100), 0, 44)).toHaveLength(44));
  it("vuoto resta vuoto", () => expect(paginaTesto("  ", 0)).toBe(""));
});

describe("meteo", () => {
  it("icone per famiglia di codici WMO", () => {
    expect(iconaMeteo(0, true)).toBe("sole");
    expect(iconaMeteo(0, false)).toBe("luna");
    expect(iconaMeteo(2, true)).toBe("parziale");
    expect(iconaMeteo(3, false)).toBe("nuvole");
    expect(iconaMeteo(45, true)).toBe("nebbia");
    expect(iconaMeteo(63, true)).toBe("pioggia");
    expect(iconaMeteo(81, true)).toBe("pioggia");
    expect(iconaMeteo(73, true)).toBe("neve");
    expect(iconaMeteo(95, true)).toBe("temporale");
  });
  it("gradi arrotondati, mai -0", () => {
    expect(gradi(21.6)).toBe("22°");
    expect(gradi(-0.2)).toBe("0°");
    expect(gradi(-3.4)).toBe("-3°");
  });
  it("valida la risposta del server", () => {
    const ok = { temperatura: 18, codice: 3, giorno: true, aggiornato: 1 };
    expect(validaMeteo(ok)).toBe(true);
    expect(validaMeteo({ ...ok, temperatura: "18" })).toBe(false);
    expect(validaMeteo({ ...ok, codice: 120 })).toBe(false);
    expect(validaMeteo(null)).toBe(false);
  });
});
