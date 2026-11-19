import { beforeEach, describe, expect, it, vi } from "vitest";
import { RECENSIONI_FINTE } from "../fixtures/recensioni.ts";
import { azzeraRecensioni, DURATA_CACHE_MS, leggiRisposta, recensioni } from "../recensioni.ts";

const PLACE = "ChIJ-esempio_FINTO123";
const googleOk = {
  rating: 4.6,
  userRatingCount: 212,
  reviews: [
    { authorAttribution: { displayName: "Anna F." }, rating: 5, text: { text: "Splendido" }, relativePublishTimeDescription: "una settimana fa" },
    { authorAttribution: { displayName: "Luca" }, rating: 2, relativePublishTimeDescription: "un mese fa" },
    { authorAttribution: { displayName: "" }, rating: 5 },
    { authorAttribution: { displayName: "Rotto" }, rating: 9 },
  ],
};
const risposta = (corpo: unknown, ok = true, stato = 200) => ({ ok, status: stato, json: async () => corpo }) as Response;

beforeEach(azzeraRecensioni);

describe("recensioni", () => {
  it("senza chiave: recensioni FINTE e lo dice nel log (una volta sola)", async () => {
    const log = vi.fn();
    const f = vi.fn();
    const a = await recensioni(PLACE, { chiave: undefined, log, fetch: f as never });
    await recensioni(PLACE, { chiave: undefined, log, fetch: f as never });
    expect(a.fonte).toBe("finte");
    expect(a.elenco).toEqual(RECENSIONI_FINTE);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toMatch(/GOOGLE_PLACES_API_KEY.*FINTE/);
    expect(f).not.toHaveBeenCalled();
  });
  it("le finte non sono tutte da cinque stelle (niente selezione)", () => {
    expect(RECENSIONI_FINTE.some((r) => r.voto < 5)).toBe(true);
  });
  it("con la chiave: chiama Places API (New) con chiave e campi solo negli header", async () => {
    const f = vi.fn(async () => risposta(googleOk));
    const r = await recensioni(PLACE, { chiave: "K-segreta", fetch: f as never, log: vi.fn() });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://places.googleapis.com/v1/places/${PLACE}?languageCode=it`);
    expect(url).not.toContain("K-segreta");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("K-segreta");
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe("rating,userRatingCount,reviews");
    expect(r).toEqual({
      fonte: "google", voto: 4.6, totale: 212,
      elenco: [
        { autore: "Anna F.", voto: 5, testo: "Splendido", quando: "una settimana fa" },
        { autore: "Luca", voto: 2, testo: "", quando: "un mese fa" },
      ],
    });
  });
  it("tiene la voce da 2 stelle: nessun filtro sulle buone", () => {
    expect(leggiRisposta(googleOk)!.elenco.map((r) => r.voto)).toContain(2);
  });
  it("massimo 5 recensioni", () => {
    const molte = { reviews: Array.from({ length: 9 }, (_, i) => ({ authorAttribution: { displayName: `A${i}` }, rating: 4 })) };
    expect(leggiRisposta(molte)!.elenco).toHaveLength(5);
  });
  it("cache in memoria: la seconda richiesta non richiama Google; scaduta sì", async () => {
    let t = 1000;
    const f = vi.fn(async () => risposta(googleOk));
    const o = { chiave: "K", fetch: f as never, adesso: () => t, log: vi.fn() };
    await recensioni(PLACE, o);
    await recensioni(PLACE, o);
    expect(f).toHaveBeenCalledTimes(1);
    t += DURATA_CACHE_MS + 1;
    await recensioni(PLACE, o);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("errore di Google: elenco vuoto (mai finte con la chiave), niente chiave nel log", async () => {
    const log = vi.fn();
    const r = await recensioni(PLACE, { chiave: "K-segreta", fetch: (async () => risposta({}, false, 403)) as never, log });
    expect(r).toEqual({ fonte: "google", elenco: [] });
    expect(log.mock.calls[0]![0]).toMatch(/403/);
    expect(JSON.stringify(log.mock.calls)).not.toContain("K-segreta");
  });
  it("errore dopo una lettura buona: tiene la copia in memoria", async () => {
    let t = 0;
    let rotto = false;
    const f = async () => {
      if (rotto) throw new Error("rete assente");
      return risposta(googleOk);
    };
    const o = { chiave: "K", fetch: f as never, adesso: () => t, log: vi.fn() };
    const prima = await recensioni(PLACE, o);
    rotto = true;
    t += DURATA_CACHE_MS + 1;
    expect(await recensioni(PLACE, o)).toEqual(prima);
  });
  it("Place ID non valido o assente con la chiave: nessuna chiamata", async () => {
    const f = vi.fn();
    expect((await recensioni("../../x", { chiave: "K", fetch: f as never })).elenco).toEqual([]);
    expect((await recensioni(undefined, { chiave: "K", fetch: f as never })).elenco).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
