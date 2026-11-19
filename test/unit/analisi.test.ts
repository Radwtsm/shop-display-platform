import { describe, expect, it, vi } from "vitest";
import { leggiProfilo, PROFILO_ESEMPIO, valuta, type Profilo, type Sito } from "../../scripts/analisi/core.ts";
import { profilo } from "../../scripts/analisi.ts";

const GOOGLE = {
  displayName: { text: "Forno Esempio" },
  primaryType: "bakery",
  primaryTypeDisplayName: { text: "Panetteria" },
  regularOpeningHours: { weekdayDescriptions: ["lunedì: 07:00–13:00"] },
  photos: Array.from({ length: 10 }, (_, i) => ({ name: `p${i}` })),
  rating: 4.7,
  userRatingCount: 120,
  websiteUri: "https://forno.example",
};
const BUON_SITO: Sito = { indirizzo: "https://forno.example", raggiunto: true, mobile: true, lcpMs: 1200, problemi: 0, contrasto: 0 };
const p = (x: Partial<Profilo> = {}): Profilo => ({ ...leggiProfilo(GOOGLE)!, ...x });
const esito = (r: ReturnType<typeof valuta>, voce: string) => r.righe.find((x) => x.voce === voce)?.esito;

describe("leggiProfilo", () => {
  it("prende i dati pubblici di Google", () => {
    expect(leggiProfilo(GOOGLE)).toEqual({ fonte: "google", nome: "Forno Esempio", categoria: "Panetteria", tipo: "bakery", orari: true, foto: 10, recensioni: 120, media: 4.7, sito: "https://forno.example" });
  });
  it("ciò che manca resta vuoto, mai inventato", () => {
    expect(leggiProfilo({ displayName: { text: "X" }, rating: 9, websiteUri: "javascript:alert(1)" })).toEqual({ fonte: "google", nome: "X", categoria: "", tipo: "", orari: false, foto: 0, recensioni: 0, media: null, sito: "" });
  });
  it("senza nome non è un profilo", () => {
    expect(leggiProfilo({ rating: 4 })).toBeNull();
    expect(leggiProfilo([])).toBeNull();
  });
});

describe("valuta", () => {
  it("negozio a posto con buon sito: tutto bene, resta solo il menu QR (fa cibo) e le risposte", () => {
    const r = valuta(p(), BUON_SITO);
    expect(r.righe.filter((x) => x.esito !== "bene").map((x) => x.voce)).toEqual(["Risposte alle recensioni"]);
    expect(r.mancanze).toEqual(["Risposte alle recensioni già scritte, da approvare con un tocco", "Menu dal QR con i 14 allergeni, aggiornato dal telefono"]);
  });
  it("senza sito: manca, e proponiamo il minisito una volta sola", () => {
    const r = valuta(p({ orari: false }), null);
    expect(esito(r, "Sito")).toBe("manca");
    expect(r.mancanze.filter((m) => m.startsWith("Minisito"))).toHaveLength(1);
  });
  it("sito lento, non da telefono, con problemi di contrasto", () => {
    const r = valuta(p(), { ...BUON_SITO, mobile: false, lcpMs: 5200, contrasto: 3 });
    expect([esito(r, "Sito sul telefono"), esito(r, "Velocità del sito"), esito(r, "Accessibilità del sito")]).toEqual(["manca", "manca", "migliorabile"]);
    expect(r.righe.find((x) => x.voce === "Velocità del sito")!.testo).toContain("5,2 s");
    expect(r.mancanze).toContain("Minisito veloce, leggibile dal telefono e da tutti");
  });
  it("poche foto e poche recensioni: QR al banco e foto delle offerte", () => {
    const r = valuta(p({ foto: 3, recensioni: 12, media: 4.1 }), BUON_SITO);
    expect([esito(r, "Foto su Google"), esito(r, "Recensioni")]).toEqual(["migliorabile", "migliorabile"]);
    expect(r.righe.find((x) => x.voce === "Recensioni")!.testo).toBe("12, media 4,1.");
    expect(r.mancanze).toContain("Un QR al banco che porta i clienti contenti a lasciare la recensione");
  });
  it("chi non fa cibo non riceve il menu QR", () => {
    expect(valuta(p({ tipo: "hardware_store" }), BUON_SITO).mancanze.some((m) => m.startsWith("Menu"))).toBe(false);
  });
});

describe("profilo", () => {
  it("senza chiave: il negozio di esempio, nessuna chiamata", async () => {
    const f = vi.fn();
    expect(await profilo("ChIJ_esempio", undefined, f)).toBe(PROFILO_ESEMPIO);
    expect(f).not.toHaveBeenCalled();
  });
  it("con chiave: la chiave va nell'intestazione, mai nell'indirizzo", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(GOOGLE)));
    expect((await profilo("ChIJ_esempio", "chiave-finta", f as unknown as typeof fetch)).nome).toBe("Forno Esempio");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("chiave-finta");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("chiave-finta");
  });
  it("Place ID strano: errore prima di chiamare Google", async () => {
    const f = vi.fn();
    await expect(profilo("../x?y", "k", f)).rejects.toThrow("Place ID");
    expect(f).not.toHaveBeenCalled();
  });
});
