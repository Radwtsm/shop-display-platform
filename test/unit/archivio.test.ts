import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SERVIZI } from "../../src/piattaforma/core/servizi.ts";
import { creaServer } from "../../src/piattaforma/server/app.ts";
import { Archivio, type Cliente } from "../../src/piattaforma/server/archivio.ts";
import { caricaModuli, cartelleServizi } from "../../src/piattaforma/server/modulo.ts";
import { modulo as schermo, salvaVista } from "../../src/servizi/schermo/server.ts";
import type { Config } from "../../src/servizi/schermo/core/tipi.ts";
import demo from "../../fixtures/demo.json" with { type: "json" };

const TOKEN = "token-di-prova";
const archivio = new Archivio(mkdtempSync(join(tmpdir(), "archivio-")));
const pub = mkdtempSync(join(tmpdir(), "pub-"));

function nuovo(id: string, nome: string, servizi: string[]): Cliente {
  const c = archivio.cliente(id);
  salvaVista(c, { ...(demo as Config), negozio: { ...demo.negozio, nome } });
  c.scrivi("cliente", JSON.stringify({ versione: 1, servizi }));
  return c;
}
const a = nuovo("bar-a", "Bar A", ["schermo"]);
const b = nuovo("bar-b", "Bar B", ["schermo"]);
const senzaSchermo = nuovo("senza", "Senza Schermo", []);

const server = (cliente: Cliente) =>
  new Promise<{ porta: number; chiudi: () => void }>((ok) => {
    const s = creaServer({ publicDir: pub, cliente, token: TOKEN, moduli: [schermo] });
    s.listen(0, "127.0.0.1", () => ok({ porta: (s.address() as AddressInfo).port, chiudi: () => s.close() }));
  });
const chiama = (porta: number, metodo: string, path: string, corpo?: string) =>
  new Promise<{ stato: number; testo: string }>((ok, ko) => {
    const r = request({ host: "127.0.0.1", port: porta, method: metodo, path, headers: { "x-token": TOKEN } }, (res) => {
      let t = "";
      res.on("data", (x) => (t += x));
      res.on("end", () => ok({ stato: res.statusCode ?? 0, testo: t }));
    });
    r.on("error", ko);
    r.end(corpo);
  });

const srvA = await server(a);
const srvSenza = await server(senzaSchermo);
afterAll(() => [srvA, srvSenza].forEach((s) => s.chiudi()));

describe("dati per cliente", () => {
  it("ogni cliente ha i suoi file: scrivere in A non cambia B", () => {
    a.scrivi("schermo", JSON.stringify({ versione: 1, secondiPerSlide: 9, slides: [] }));
    expect(JSON.parse(b.leggi("schermo")!).secondiPerSlide).toBe(8);
    expect(JSON.parse(b.leggi("negozio")!).negozio.nome).toBe("Bar B");
    expect(archivio.clienti()).toEqual(["bar-a", "bar-b", "senza"]);
  });
  it.each(["../bar-b", "bar-a/../bar-b", "Bar-A", "", "-x", "a".repeat(41)])("id cliente %j rifiutato", (id) => {
    expect(() => archivio.cliente(id)).toThrow("cliente non valido");
  });
  it("il server di A non dà le foto né il logo di B", async () => {
    mkdirSync(b.foto, { recursive: true });
    mkdirSync(b.logo, { recursive: true });
    writeFileSync(join(b.foto, "0123456789abcdef.png"), "di B");
    writeFileSync(join(b.logo, "logo.png"), "di B");
    for (const p of ["/foto/0123456789abcdef.png", "/logo/logo.png", "/logo/../../bar-b/logo/logo.png", "/logo/..%2f..%2fbar-b%2flogo%2flogo.png"]) {
      const r = await chiama(srvA.porta, "GET", p);
      expect(r.stato, p).toBe(404);
      expect(r.testo).not.toContain("di B");
    }
  });
  it("la TV di A legge il negozio di A", async () => {
    expect(JSON.parse((await chiama(srvA.porta, "GET", "/api/config")).testo).negozio.nome).toBe("Bar A");
  });
});

describe("servizio attivo sì/no", () => {
  it("servizio non attivo: le sue rotte non esistono (404) e niente si salva", async () => {
    const prima = senzaSchermo.leggi("schermo");
    expect((await chiama(srvSenza.porta, "GET", "/api/config")).stato).toBe(404);
    expect((await chiama(srvSenza.porta, "PUT", "/api/schermo/config", JSON.stringify(demo))).stato).toBe(404);
    expect(senzaSchermo.leggi("schermo")).toBe(prima);
  });
  it("servizi sconosciuti o file rotto: nessuno attivo", () => {
    const c = archivio.cliente("rotto");
    c.scrivi("cliente", JSON.stringify({ versione: 1, servizi: ["schermo", "inventato"] }));
    expect(c.servizi()).toEqual(["schermo"]);
    c.scrivi("cliente", "{");
    expect(c.attivo("schermo")).toBe(false);
  });
  it("il nuovo percorso e quello della versione prima danno gli stessi dati", async () => {
    const vecchio = await chiama(srvA.porta, "GET", "/api/config");
    expect((await chiama(srvA.porta, "GET", "/api/schermo/config")).testo).toBe(vecchio.testo);
  });
});

describe("un servizio = una cartella + una voce nel catalogo", () => {
  const ids = SERVIZI.map((s) => s.id as string);
  it("ogni cartella di src/servizi è nel catalogo e ha il suo server.ts", () => {
    for (const d of cartelleServizi("src/servizi")) {
      expect(ids, `src/servizi/${d}: aggiungi la voce in src/piattaforma/core/servizi.ts`).toContain(d);
      expect(statSync(`src/servizi/${d}/server.ts`).isFile()).toBe(true);
    }
  });
  it("i moduli si caricano dalle cartelle, ognuno col suo id", async () => {
    expect((await caricaModuli("src/servizi")).map((m) => m.id)).toEqual(cartelleServizi("src/servizi").sort((x, y) => ids.indexOf(x) - ids.indexOf(y)));
  });
  it("la piattaforma non importa dai servizi (tranne il punto d'avvio)", () => {
    const tutti = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tutti(join(dir, e.name)) : [join(dir, e.name)]));
    const colpevoli = tutti("src/piattaforma")
      .filter((f) => f.endsWith(".ts") && f !== join("src/piattaforma/server/main.ts"))
      .filter((f) => /(from|import)\s*\(?\s*["'][./]*servizi\//.test(readFileSync(f, "utf8")));
    expect(colpevoli).toEqual([]);
  });
});
