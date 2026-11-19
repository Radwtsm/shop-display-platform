// /api/negozio: GET senza token con ETag, PUT con token e validazione; /api/config resta compatibile.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, expect, it } from "vitest";
import { creaServer } from "../../src/piattaforma/server/app.ts";
import { Archivio } from "../../src/piattaforma/server/archivio.ts";
import { attivaServizio } from "../../src/piattaforma/server/modulo.ts";
import { modulo as schermo, salvaVista } from "../../src/servizi/schermo/server.ts";
import type { Config } from "../../src/servizi/schermo/core/tipi.ts";
import demo from "../../fixtures/demo.json" with { type: "json" };

const TOKEN = "token-di-prova";
const data = mkdtempSync(join(tmpdir(), "neg-"));
const cliente = new Archivio(data).cliente("demo");
mkdirSync(cliente.logo, { recursive: true });
writeFileSync(cliente.fileToken, TOKEN);
writeFileSync(join(cliente.logo, "logo.png"), "PNG");
const server = creaServer({ publicDir: mkdtempSync(join(tmpdir(), "pub-")), cliente, token: TOKEN, moduli: [schermo] });
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const porta = (server.address() as AddressInfo).port;
afterAll(() => server.close());

beforeEach(() => {
  salvaVista(cliente, demo as Config);
  attivaServizio(cliente, schermo);
});

function chiama(metodo: string, path: string, corpo?: string, headers: Record<string, string> = {}) {
  return new Promise<{ stato: number; testo: string; h: Record<string, unknown> }>((ok, ko) => {
    const r = request({ host: "127.0.0.1", port: porta, method: metodo, path, headers }, (res) => {
      let t = "";
      res.on("data", (c) => (t += c));
      res.on("end", () => ok({ stato: res.statusCode ?? 0, testo: t, h: res.headers }));
    });
    r.on("error", ko);
    if (corpo !== undefined) r.write(corpo);
    r.end();
  });
}
const base = () => JSON.parse(cliente.leggi("negozio")!) as { versione: 1; negozio: Record<string, unknown>; disposizione?: string };
const put = (dati: unknown, token = TOKEN) => chiama("PUT", "/api/negozio", typeof dati === "string" ? dati : JSON.stringify(dati), { "x-token": token });

it("GET: negozio + servizi attivi, ETag e 304, senza token", async () => {
  const r = await chiama("GET", "/api/negozio");
  expect(r.stato).toBe(200);
  const corpo = JSON.parse(r.testo);
  expect(corpo.negozio.nome).toBe("Panificio Demo");
  expect(corpo.servizi).toEqual(["schermo"]);
  const r2 = await chiama("GET", "/api/negozio", undefined, { "if-none-match": String(r.h.etag) });
  expect(r2.stato).toBe(304);
});

it("PUT: serve il token", async () => {
  expect((await put(base(), "sbagliato")).stato).toBe(401);
});

it("PUT: salva la disposizione e /api/config la riporta", async () => {
  const r = await put({ ...base(), disposizione: "affiancato" });
  expect(r.stato).toBe(200);
  expect(JSON.parse(r.testo).disposizione).toBe("affiancato");
  expect(JSON.parse((await chiama("GET", "/api/config")).testo).disposizione).toBe("affiancato");
});

it("PUT: dati non validi 422 con le parole del negoziante, JSON rotto 400, file invariato", async () => {
  const prima = cliente.leggi("negozio");
  const nome = await put({ ...base(), negozio: { ...base().negozio, nome: "" } });
  expect(nome.stato).toBe(422);
  expect((await put({ ...base(), disposizione: "a-tre" })).stato).toBe(422);
  expect((await put("{rotto")).stato).toBe(400);
  expect(cliente.leggi("negozio")).toBe(prima);
});

it("PUT: un logo che non c'è è rifiutato, uno che c'è passa", async () => {
  expect((await put({ ...base(), negozio: { ...base().negozio, logo: "non-esiste.png" } })).stato).toBe(422);
  expect((await put({ ...base(), negozio: { ...base().negozio, logo: "logo.png" } })).stato).toBe(200);
});

it("PUT: i campi in più della richiesta non finiscono nel file", async () => {
  await put({ ...base(), servizi: ["haccp"], intruso: 1 });
  expect(Object.keys(base()).sort()).not.toContain("intruso");
  expect(cliente.servizi()).toEqual(["schermo"]);
});

it("metodi diversi: 405", async () => {
  expect((await chiama("DELETE", "/api/negozio", undefined, { "x-token": TOKEN })).stato).toBe(405);
});
