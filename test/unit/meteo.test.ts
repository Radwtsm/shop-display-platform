// Meteo lato server: cache 30 minuti, ultimo valore se la rete cade, una sola chiamata per più richieste; mai rete vera.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { creaServer } from "../../src/piattaforma/server/app.ts";
import { Archivio } from "../../src/piattaforma/server/archivio.ts";
import { attivaServizio } from "../../src/piattaforma/server/modulo.ts";
import { creaMeteo, METEO_CACHE_MS, type Scarica } from "../../src/piattaforma/server/meteo.ts";
import { modulo as schermo, salvaVista } from "../../src/servizi/schermo/server.ts";
import type { Config } from "../../src/servizi/schermo/core/tipi.ts";
import demo from "../../fixtures/demo.json" with { type: "json" };

const risposta = (t: number, codice = 3, giorno = 1) => ({ current: { temperature_2m: t, weather_code: codice, is_day: giorno } });

function finto(...risposte: (unknown | Error)[]) {
  const urls: string[] = [];
  let i = 0;
  const scarica: Scarica = async (url) => {
    urls.push(url);
    const r = risposte[Math.min(i++, risposte.length - 1)];
    if (r instanceof Error) throw r;
    return { ok: r !== null, json: async () => r };
  };
  return { scarica, urls };
}

describe("creaMeteo", () => {
  it("chiede a Open-Meteo e ripulisce la risposta", async () => {
    const f = finto(risposta(18.46, 61, 0));
    const m = await creaMeteo({ scarica: f.scarica, ora: () => 1000 }).meteo(45.4642, 9.19);
    expect(m).toEqual({ temperatura: 18.5, codice: 61, giorno: false, aggiornato: 1000 });
    expect(f.urls[0]).toContain("https://api.open-meteo.com/v1/forecast?latitude=45.46&longitude=9.19");
  });
  it("cache 30 minuti: la seconda richiesta non chiama", async () => {
    const f = finto(risposta(10), risposta(20));
    let ora = 0;
    const s = creaMeteo({ scarica: f.scarica, ora: () => ora });
    await s.meteo(45, 9);
    ora = METEO_CACHE_MS - 1;
    expect((await s.meteo(45, 9))?.temperatura).toBe(10);
    expect(f.urls).toHaveLength(1);
    ora = METEO_CACHE_MS;
    expect((await s.meteo(45, 9))?.temperatura).toBe(20);
    expect(f.urls).toHaveLength(2);
  });
  it("più richieste insieme = una chiamata", async () => {
    const f = finto(risposta(10));
    const s = creaMeteo({ scarica: f.scarica });
    await Promise.all([s.meteo(45, 9), s.meteo(45, 9), s.meteo(45.001, 9.001)]);
    expect(f.urls).toHaveLength(1);
  });
  it("rete giù: l'ultimo valore, anche vecchio; senza niente in cache null", async () => {
    const f = finto(risposta(10), new Error("rete"));
    let ora = 0;
    const s = creaMeteo({ scarica: f.scarica, ora: () => ora });
    expect(await creaMeteo({ scarica: finto(new Error("x")).scarica }).meteo(1, 1)).toBeNull();
    await s.meteo(45, 9);
    ora = 5 * METEO_CACHE_MS;
    expect((await s.meteo(45, 9))?.temperatura).toBe(10);
  });
  it("risposta strana = come rete giù", async () => {
    expect(await creaMeteo({ scarica: finto({ current: { temperature_2m: "caldo" } }).scarica }).meteo(1, 1)).toBeNull();
    expect(await creaMeteo({ scarica: finto(null).scarica }).meteo(1, 1)).toBeNull();
  });
  it("con la chiave usa gli indirizzi a pagamento", async () => {
    const f = finto(risposta(10));
    await creaMeteo({ scarica: f.scarica, chiave: "k" }).meteo(1, 1);
    expect(f.urls[0]).toContain("https://customer-api.open-meteo.com/");
    expect(f.urls[0]).toContain("apikey=k");
  });
  it("cerca: nome, zona e coordinate; scarta le voci rotte", async () => {
    const f = finto({
      results: [
        { name: "Milano", admin1: "Lombardia", latitude: 45.46427, longitude: 9.18951 },
        { name: "Rotta" },
        { name: "Roma", admin1: "Roma", latitude: 41.89, longitude: 12.48 },
      ],
    });
    const r = await creaMeteo({ scarica: f.scarica }).cerca("Mil");
    expect(r).toEqual([
      { nome: "Milano, Lombardia", lat: 45.46, lon: 9.19 },
      { nome: "Roma", lat: 41.89, lon: 12.48 },
    ]);
  });
  it("cerca: sotto 2 lettere non chiama", async () => {
    const f = finto({});
    expect(await creaMeteo({ scarica: f.scarica }).cerca("M")).toEqual([]);
    expect(f.urls).toHaveLength(0);
  });
});

describe("rotte /api/meteo e /api/citta", () => {
  const TOKEN = "token-di-prova";
  const cliente = new Archivio(mkdtempSync(join(tmpdir(), "met-"))).cliente("demo");
  mkdirSync(cliente.logo, { recursive: true });
  writeFileSync(cliente.fileToken, TOKEN);
  const f = finto(risposta(21, 0));
  const server = creaServer({
    publicDir: mkdtempSync(join(tmpdir(), "pub-")), cliente, token: TOKEN, moduli: [schermo],
    meteo: creaMeteo({ scarica: f.scarica }),
  });
  const pronto = new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  afterAll(() => server.close());
  const chiama = async (path: string, headers: Record<string, string> = {}) => {
    await pronto;
    return new Promise<{ stato: number; corpo: unknown }>((ok, ko) => {
      request({ host: "127.0.0.1", port: (server.address() as AddressInfo).port, path, headers }, (res) => {
        let t = "";
        res.on("data", (c) => (t += c));
        res.on("end", () => ok({ stato: res.statusCode ?? 0, corpo: JSON.parse(t) }));
      }).on("error", ko).end();
    });
  };

  it("senza città scelta: 404, e non chiama Open-Meteo", async () => {
    salvaVista(cliente, demo as Config);
    attivaServizio(cliente, schermo);
    expect((await chiama("/api/meteo")).stato).toBe(404);
    expect(f.urls).toHaveLength(0);
  });
  it("con la città salvata: il tempo, senza token, ignorando coordinate della richiesta", async () => {
    const n = JSON.parse(cliente.leggi("negozio")!);
    n.negozio.citta = { nome: "Milano", lat: 45.46, lon: 9.19 };
    cliente.scrivi("negozio", JSON.stringify(n));
    const r = await chiama("/api/meteo?lat=1&lon=2");
    expect(r.stato).toBe(200);
    expect(r.corpo).toMatchObject({ temperatura: 21, codice: 0, giorno: true });
    expect(f.urls[0]).toContain("latitude=45.46");
  });
  it("la ricerca città vuole il token", async () => {
    expect((await chiama("/api/citta?q=mil")).stato).toBe(401);
    expect((await chiama("/api/citta?q=mil", { "x-token": TOKEN })).stato).toBe(200);
  });
});
