// Rotte /api/vetrina: dati per il pannello (token), TV e sito (pubblici), Wi-Fi solo dove deve stare.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { creaServer } from "../../../piattaforma/server/app.ts";
import { Archivio } from "../../../piattaforma/server/archivio.ts";
import { attivaServizio } from "../../../piattaforma/server/modulo.ts";
import { modulo, opzioniRecensioni } from "../server.ts";
import { azzeraRecensioni } from "../recensioni.ts";
import { BASE } from "../fixtures/esempio.ts";

const TOKEN = "token-di-prova";
const data = mkdtempSync(join(tmpdir(), "vet-"));
const cliente = new Archivio(data).cliente("demo");
mkdirSync(cliente.foto, { recursive: true });
mkdirSync(cliente.dir, { recursive: true });
writeFileSync(cliente.fileToken, TOKEN);
writeFileSync(join(cliente.foto, "0123456789abcdef.jpg"), "JPG");
cliente.scrivi("negozio", JSON.stringify({
  versione: 1,
  negozio: { nome: "Panificio Demo", colori: { primario: "#7a3e12", accento: "#ffd27a", sfondo: "#1f140c", testo: "#fff8ee" } },
}));
const server = creaServer({ publicDir: mkdtempSync(join(tmpdir(), "pub-")), cliente, token: TOKEN, moduli: [modulo] });
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const porta = (server.address() as AddressInfo).port;
afterAll(() => server.close());

beforeEach(() => {
  azzeraRecensioni();
  opzioniRecensioni.chiave = undefined;
  opzioniRecensioni.log = vi.fn();
  attivaServizio(cliente, modulo);
});

function chiama(metodo: string, path: string, corpo?: unknown, token?: string) {
  return new Promise<{ stato: number; json: any; testo: string }>((ok, ko) => {
    const r = request({ host: "127.0.0.1", port: porta, method: metodo, path, headers: token ? { "x-token": token } : {} }, (res) => {
      let t = "";
      res.on("data", (c) => (t += c));
      res.on("end", () => ok({ stato: res.statusCode ?? 0, testo: t, json: t.startsWith("{") ? JSON.parse(t) : null }));
    });
    r.on("error", ko);
    if (corpo !== undefined) r.write(JSON.stringify(corpo));
    r.end();
  });
}
const salva = (d: unknown, token = TOKEN) => chiama("PUT", "/api/vetrina", d, token);

it("attivando parte con dati validi", async () => {
  const r = await chiama("GET", "/api/vetrina", undefined, TOKEN);
  expect(r.stato).toBe(200);
  expect(r.json.linkMenu).toBe("/menu.html");
});

it("PUT: serve il token, rifiuta dati sbagliati, foto inesistente", async () => {
  expect((await salva(BASE, "sbagliato")).stato).toBe(401);
  expect((await salva({ ...BASE, placeId: "x" })).stato).toBe(422);
  const senza = { ...BASE, storia: { ...BASE.storia!, foto: "ffffffffffffffff.jpg" } };
  const r = await salva(senza);
  expect(r.stato).toBe(422);
  expect(r.json.errori[0]).toMatch(/Foto/);
});

it("GET /api/vetrina: senza token 401 (la password Wi-Fi non è pubblica)", async () => {
  await salva(BASE);
  expect((await chiama("GET", "/api/vetrina")).stato).toBe(401);
});

it("sito: pubblico, con mappe e menu, SENZA QR del Wi-Fi né password", async () => {
  await salva(BASE);
  const r = await chiama("GET", "/api/vetrina/sito");
  expect(r.stato).toBe(200);
  expect(r.json.qr.map((q: any) => q.id)).toEqual(["recensione", "instagram"]);
  expect(r.testo).not.toContain(BASE.wifi!.password);
  expect(r.json.mappe.osm).toMatch(/^https:\/\/www\.openstreetmap\.org/);
  expect(r.json.linkMenu).toBe("/menu.html");
});

it("TV: ha anche il QR del Wi-Fi", async () => {
  await salva(BASE);
  const r = await chiama("GET", "/api/vetrina/tv");
  expect(r.json.qr.map((q: any) => q.id)).toEqual(["recensione", "wifi", "instagram"]);
  expect(r.json.qr[1].testo).toBe("WIFI:T:WPA;S:Panificio Ospiti;P:pane-caldo-24;;");
});

it("senza chiave Google le recensioni sono finte e la risposta lo dice", async () => {
  await salva(BASE);
  const r = await chiama("GET", "/api/vetrina/sito");
  expect(r.json.recensioni.fonte).toBe("finte");
  expect(r.json.recensioni.elenco).toHaveLength(5);
});

it("con la chiave le recensioni vengono da Google e la chiave non esce mai", async () => {
  await salva(BASE);
  opzioniRecensioni.chiave = "K-segreta-di-prova";
  opzioniRecensioni.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ rating: 4, userRatingCount: 3, reviews: [{ authorAttribution: { displayName: "Z" }, rating: 4, text: { text: "ok" }, relativePublishTimeDescription: "ieri" }] }) })) as never;
  const r = await chiama("GET", "/api/vetrina/tv");
  expect(r.json.recensioni.fonte).toBe("google");
  expect(r.testo).not.toContain("K-segreta-di-prova");
  delete opzioniRecensioni.fetch;
});

it("servizio non attivo: 404", async () => {
  const altro = new Archivio(mkdtempSync(join(tmpdir(), "vet2-"))).cliente("x");
  mkdirSync(altro.dir, { recursive: true });
  writeFileSync(altro.fileToken, TOKEN);
  altro.scrivi("negozio", cliente.leggi("negozio")!);
  altro.impostaServizi([]);
  const s = creaServer({ publicDir: mkdtempSync(join(tmpdir(), "pub-")), cliente: altro, token: TOKEN, moduli: [modulo] });
  await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  const p = (s.address() as AddressInfo).port;
  const st = await new Promise<number>((ok) => request({ host: "127.0.0.1", port: p, path: "/api/vetrina/sito" }, (r) => (r.resume(), ok(r.statusCode ?? 0))).end());
  s.close();
  expect(st).toBe(404);
});
