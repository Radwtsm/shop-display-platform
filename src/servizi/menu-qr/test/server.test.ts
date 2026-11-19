import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { creaServer } from "../../../piattaforma/server/app.ts";
import { Archivio } from "../../../piattaforma/server/archivio.ts";
import { attivaServizio } from "../../../piattaforma/server/modulo.ts";
import { modulo as schermo, salvaVista } from "../../schermo/server.ts";
import demoSchermo from "../../../../fixtures/demo.json" with { type: "json" };
import type { Config } from "../../schermo/core/tipi.ts";
import demo from "../demo.json" with { type: "json" };
import { leggiMenu, modulo, PERCORSO_MENU } from "../server.ts";
import { dataLocale } from "../../../piattaforma/core/orario.ts";

const TOKEN = "token-di-prova";
const archivio = new Archivio(mkdtempSync(join(tmpdir(), "menu-")));
const pub = mkdtempSync(join(tmpdir(), "pub-"));

function cliente(id: string, conMenu: boolean) {
  const c = archivio.cliente(id);
  salvaVista(c, demoSchermo as Config);
  attivaServizio(c, schermo);
  if (conMenu) {
    c.scrivi("menu-qr", JSON.stringify(demo));
    attivaServizio(c, modulo);
  }
  return c;
}
const avvia = (id: string, conMenu: boolean) =>
  new Promise<{ url: string; chiudi: () => void }>((ok) => {
    const s = creaServer({ publicDir: pub, cliente: cliente(id, conMenu), token: TOKEN, moduli: [schermo, modulo] });
    s.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, chiudi: () => s.close() }));
  });
const con = await avvia("con", true);
const senza = await avvia("senza", false);
afterAll(() => [con, senza].forEach((s) => s.chiudi()));

describe("API del menu", () => {
  it("la lettura è pubblica: senza token, senza intestazioni speciali", async () => {
    const r = await fetch(con.url + PERCORSO_MENU);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { piatti: unknown[] }).piatti.length).toBe(demo.piatti.length);
  });
  it("ETag: richiesta uguale = 304", async () => {
    const etag = (await fetch(con.url + PERCORSO_MENU)).headers.get("etag")!;
    expect((await fetch(con.url + PERCORSO_MENU, { headers: { "If-None-Match": etag } })).status).toBe(304);
  });
  it("scrivere senza token o col token sbagliato: rifiutato, il menu non cambia", async () => {
    for (const headers of [{} as Record<string, string>, { "X-Token": "sbagliato" }]) {
      const r = await fetch(con.url + PERCORSO_MENU, { method: "PUT", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ versione: 1, categorie: [], piatti: [] }) });
      expect(r.status).toBe(401);
    }
    expect((await (await fetch(con.url + PERCORSO_MENU)).json() as { piatti: unknown[] }).piatti.length).toBe(demo.piatti.length);
  });
  it("scrivere dati non validi: 422 con le parole del negoziante, menu invariato", async () => {
    const m = structuredClone(demo);
    m.piatti[0]!.prezzo = 8.5;
    const r = await fetch(con.url + PERCORSO_MENU, { method: "PUT", headers: { "Content-Type": "application/json", "X-Token": TOKEN }, body: JSON.stringify(m) });
    expect(r.status).toBe(422);
    expect(((await r.json()) as { errori: string[] }).errori.join()).toContain("prezzo");
  });
  it("scrittura valida col token: salvata e riletta", async () => {
    const m = structuredClone(demo);
    m.piatti[0]!.finitoIl = "2026-11-06";
    const r = await fetch(con.url + PERCORSO_MENU, { method: "PUT", headers: { "Content-Type": "application/json", "X-Token": TOKEN }, body: JSON.stringify(m) });
    expect(r.status).toBe(200);
    const letto = (await (await fetch(con.url + PERCORSO_MENU)).json()) as typeof demo;
    expect(letto.piatti[0]!.finitoIl).toBe("2026-11-06");
  });
  it("cliente senza il servizio: come se non esistesse (404, anche in scrittura)", async () => {
    expect((await fetch(senza.url + PERCORSO_MENU)).status).toBe(404);
    const r = await fetch(senza.url + PERCORSO_MENU, { method: "PUT", headers: { "Content-Type": "application/json", "X-Token": TOKEN }, body: JSON.stringify(demo) });
    expect(r.status).toBe(404);
  });
  it("leggiMenu ignora un file rovinato", () => {
    const c = archivio.cliente("rovinato");
    c.scrivi("menu-qr", "{non json");
    expect(leggiMenu(c)).toBeNull();
  });
  it("menu di esempio della demo: valido, e il piatto finito è finito oggi (non il giorno in cui è stato scritto)", () => {
    const e = modulo.esempio!() as typeof demo;
    expect(modulo.valida(e)).toEqual([]);
    const finiti = e.piatti.filter((p) => "finitoIl" in p);
    expect(finiti.length).toBeGreaterThan(0);
    for (const p of finiti) expect(p.finitoIl).toBe(dataLocale(Date.now()));
  });
});
