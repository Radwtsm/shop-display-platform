// Rotte dell'Eliminacode, anche con due clienti: i numeri di uno non toccano quelli dell'altro.
import { mkdtempSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { creaServer } from "../../../piattaforma/server/app.ts";
import { Archivio } from "../../../piattaforma/server/archivio.ts";
import { attivaServizio } from "../../../piattaforma/server/modulo.ts";
import { ASCOLTO_MAX, leggiCoda, modulo } from "../server.ts";

const TOKEN = "token-di-prova";
const data = mkdtempSync(join(tmpdir(), "eq-"));
const pub = mkdtempSync(join(tmpdir(), "eq-pub-"));
const archivio = new Archivio(data);
const cliente = archivio.cliente("demo");
const altro = archivio.cliente("altro");
for (const c of [cliente, altro]) {
  c.scrivi("negozio", JSON.stringify({ versione: 1, negozio: { nome: "Panificio Demo", colori: { primario: "#333333", accento: "#ffcc00", sfondo: "#111111", testo: "#ffffff" } } }));
  attivaServizio(c, modulo);
}
const server = creaServer({ publicDir: pub, cliente, token: TOKEN, moduli: [modulo] });
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const porta = (server.address() as AddressInfo).port;
afterAll(() => server.close());
beforeEach(() => cliente.scrivi("eliminacode", JSON.stringify({ versione: 1, banchi: ["Banco 1"], numero: 0, banco: 0 })));

function chiama(metodo: string, path: string, corpo?: unknown, headers: Record<string, string> = {}) {
  return new Promise<{ stato: number; json: any; h: Record<string, unknown> }>((ok, ko) => {
    const r = request({ host: "127.0.0.1", port: porta, method: metodo, path, headers }, (res) => {
      let t = "";
      res.on("data", (c) => (t += c));
      res.on("end", () => ok({ stato: res.statusCode ?? 0, json: t && t.startsWith("{") ? JSON.parse(t) : null, h: res.headers }));
    });
    r.on("error", ko);
    if (corpo !== undefined) r.write(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
    r.end();
  });
}
const azione = (a: string, banco?: number, token = TOKEN) => chiama("POST", "/api/eliminacode/azione", { azione: a, banco }, { "x-token": token });

describe("lettura", () => {
  it("senza token, con ETag e 304", async () => {
    const r = await chiama("GET", "/api/eliminacode");
    expect(r.stato).toBe(200);
    expect(r.json).toEqual({ versione: 1, banchi: ["Banco 1"], numero: 0, banco: 0 });
    expect((await chiama("GET", "/api/eliminacode", undefined, { "if-none-match": String(r.h.etag) })).stato).toBe(304);
  });
  it("l'ETag cambia quando cambia il numero", async () => {
    const prima = (await chiama("GET", "/api/eliminacode")).h.etag;
    await azione("prossimo");
    expect((await chiama("GET", "/api/eliminacode")).h.etag).not.toBe(prima);
  });
  it("non si scrive con GET e non si legge con POST", async () => {
    expect((await chiama("POST", "/api/eliminacode", {})).stato).toBe(405);
    expect((await chiama("GET", "/api/eliminacode/azione")).stato).toBe(405);
  });
});

describe("scrittura", () => {
  it("serve il token: senza o sbagliato il numero non cambia", async () => {
    expect((await chiama("POST", "/api/eliminacode/azione", { azione: "prossimo" })).stato).toBe(401);
    expect((await azione("prossimo", undefined, "sbagliato")).stato).toBe(401);
    expect(leggiCoda(cliente)!.numero).toBe(0);
  });
  it("prossimo, indietro, azzera", async () => {
    expect((await azione("prossimo")).json.numero).toBe(1);
    expect((await azione("prossimo")).json.numero).toBe(2);
    expect((await azione("indietro")).json.numero).toBe(1);
    expect((await azione("azzera")).json.numero).toBe(0);
    expect(leggiCoda(cliente)!.numero).toBe(0);
  });
  it("due richieste insieme si sommano", async () => {
    await Promise.all([azione("prossimo"), azione("prossimo"), azione("prossimo")]);
    expect(leggiCoda(cliente)!.numero).toBe(3);
  });
  it("azione o banco sbagliati: 422 e niente cambia", async () => {
    expect((await azione("cancella")).stato).toBe(422);
    expect((await azione("prossimo", 1)).stato).toBe(422); // un banco solo
    expect((await chiama("POST", "/api/eliminacode/azione", "{rotto", { "x-token": TOKEN })).stato).toBe(400);
    expect(leggiCoda(cliente)!.numero).toBe(0);
  });
  it("banchi: due banchi, poi uno solo riporta il banco chiamante a 0", async () => {
    const due = await chiama("PUT", "/api/eliminacode/banchi", { banchi: ["Banco 1", "Banco 2"] }, { "x-token": TOKEN });
    expect(due.json.banchi).toHaveLength(2);
    await azione("prossimo", 1);
    const uno = await chiama("PUT", "/api/eliminacode/banchi", { banchi: ["Banco 1"] }, { "x-token": TOKEN });
    expect(uno.json).toMatchObject({ numero: 1, banco: 0 });
    expect((await chiama("PUT", "/api/eliminacode/banchi", { banchi: [] }, { "x-token": TOKEN })).stato).toBe(422);
    expect((await chiama("PUT", "/api/eliminacode/banchi", {}, { "x-token": TOKEN })).stato).toBe(422);
  });
});

describe("clienti separati e servizio non attivo", () => {
  it("i numeri di un cliente non toccano quelli di un altro", async () => {
    altro.scrivi("eliminacode", JSON.stringify({ versione: 1, banchi: ["Banco 1"], numero: 7, banco: 0 }));
    await azione("prossimo");
    expect(leggiCoda(altro)!.numero).toBe(7);
  });
  it("senza il servizio attivo le rotte non esistono, nemmeno in scrittura", async () => {
    cliente.impostaServizi(["schermo"]);
    try {
      expect((await chiama("GET", "/api/eliminacode")).stato).toBe(404);
      expect((await azione("prossimo")).stato).toBe(404);
    } finally {
      cliente.impostaServizi(["eliminacode"]);
    }
  });
  it("i dati iniziali passano dalla valida e partono da zero", () => {
    expect(modulo.valida(modulo.iniziali({} as never))).toEqual([]);
    expect(modulo.valida({ versione: 1 }).length).toBeGreaterThan(0);
  });
});

describe("eventi (A138: la TV riceve il numero appena cambia)", () => {
  /** Apre /api/eliminacode/eventi e raccoglie i messaggi `data:` finché non ne ha `quanti`. */
  function ascolta(quanti: number, intanto?: () => Promise<unknown>) {
    return new Promise<{ h: Record<string, unknown>; dati: any[] }>((ok, ko) => {
      const dati: any[] = [];
      const r = request({ host: "127.0.0.1", port: porta, method: "GET", path: "/api/eliminacode/eventi" }, (res) => {
        let resto = "";
        res.on("data", (c) => {
          resto += c;
          let i;
          while ((i = resto.indexOf("\n\n")) >= 0) {
            const blocco = resto.slice(0, i);
            resto = resto.slice(i + 2);
            if (blocco.startsWith("data: ")) dati.push(JSON.parse(blocco.slice(6)));
            if (dati.length === 1 && intanto) void intanto();
            if (dati.length === quanti) {
              ok({ h: res.headers, dati });
              r.destroy();
            }
          }
        });
      });
      r.on("error", (e) => (dati.length >= quanti ? undefined : ko(e)));
      r.end();
    });
  }
  it("manda subito lo stato e poi ogni cambio, con le intestazioni di sicurezza", async () => {
    const { h, dati } = await ascolta(3, async () => {
      await azione("prossimo");
      await azione("prossimo");
    });
    expect(h["content-type"]).toContain("text/event-stream");
    expect(h["content-security-policy"]).toContain("default-src 'none'");
    expect(h["cache-control"]).toBe("no-store");
    expect(dati.map((d) => d.numero)).toEqual([0, 1, 2]);
    expect(dati[2].storico).toEqual([1]);
  });
  it(`oltre ${ASCOLTO_MAX} schermi collegati risponde 503, chiusi si libera il posto`, async () => {
    const aperti = await Promise.all(Array.from({ length: ASCOLTO_MAX }, () => new Promise<ReturnType<typeof request>>((ok) => {
      const r = request({ host: "127.0.0.1", port: porta, path: "/api/eliminacode/eventi" }, () => ok(r));
      r.end();
    })));
    expect((await chiama("GET", "/api/eliminacode/eventi", undefined, {})).stato).toBe(503);
    aperti.forEach((r) => r.destroy());
    await new Promise((ok) => setTimeout(ok, 100));
    const r = await new Promise<number>((ok) => {
      const q = request({ host: "127.0.0.1", port: porta, path: "/api/eliminacode/eventi" }, (res) => { ok(res.statusCode ?? 0); q.destroy(); });
      q.end();
    });
    expect(r).toBe(200);
  });
  it("i cambi di un cliente non arrivano a chi ascolta un altro", async () => {
    const altroServer = creaServer({ publicDir: pub, cliente: altro, token: TOKEN, moduli: [modulo] });
    await new Promise<void>((ok) => altroServer.listen(0, "127.0.0.1", ok));
    const p = (altroServer.address() as AddressInfo).port;
    const ricevuti: string[] = [];
    const r = request({ host: "127.0.0.1", port: p, path: "/api/eliminacode/eventi" }, (res) => res.on("data", (c) => ricevuti.push(String(c))));
    r.end();
    await new Promise((ok) => setTimeout(ok, 100));
    await azione("prossimo");
    await new Promise((ok) => setTimeout(ok, 100));
    r.destroy();
    altroServer.close();
    expect(ricevuti.join("").match(/^data: /gm)).toHaveLength(1); // solo lo stato iniziale
  });
});
