import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { creaServer, CSP_PAGINA, dentro, FINESTRA_MS, Limitatore, MAX_BODY, MAX_TENTATIVI, SICUREZZA, soloLocale } from "../../src/piattaforma/server/app.ts";
import { Archivio } from "../../src/piattaforma/server/archivio.ts";
import { leggiVista, modulo as schermo, salvaVista } from "../../src/servizi/schermo/server.ts";
import type { Config } from "../../src/servizi/schermo/core/tipi.ts";
import demo from "../../fixtures/demo.json" with { type: "json" };
import { pngFinto } from "../foto-finte.ts";
import { utimesSync, readdirSync } from "node:fs";

const TOKEN = "token-di-prova";
const pub = mkdtempSync(join(tmpdir(), "pub-"));
const data = mkdtempSync(join(tmpdir(), "data-"));
const cliente = new Archivio(data).cliente("demo");
const moduli = [schermo];
mkdirSync(cliente.logo, { recursive: true });
writeFileSync(join(pub, "player.html"), "<p>tv</p>");
writeFileSync(join(pub, "segreto.txt"), "no");
writeFileSync(cliente.fileToken, TOKEN);
writeFileSync(join(cliente.logo, "logo.png"), "PNG");
// fuori dalla cartella dei loghi, con un'estensione servibile: se esce, il test lo vede
writeFileSync(join(cliente.dir, "rubami.png"), TOKEN);
const server = creaServer({ publicDir: pub, cliente, token: TOKEN, moduli });
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const porta = (server.address() as AddressInfo).port;
afterAll(() => server.close());

beforeEach(() => {
  salvaVista(cliente, demo as Config);
  cliente.scrivi("cliente", JSON.stringify({ versione: 1, servizi: ["schermo"] }));
});
const salvata = (prec = false) => leggiVista(cliente, prec)!;

function chiama(metodo: string, path: string, corpo?: string | Buffer, headers: Record<string, string> = {}) {
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
const put = (dati: unknown, token = TOKEN) =>
  chiama("PUT", "/api/config", typeof dati === "string" ? dati : JSON.stringify(dati), { "x-token": token });

describe("GET", () => {
  it("config con ETag e 304", async () => {
    const r = await chiama("GET", "/api/config");
    expect(r.stato).toBe(200);
    expect(JSON.parse(r.testo).negozio.nome).toBe("Panificio Demo");
    const r2 = await chiama("GET", "/api/config", undefined, { "if-none-match": String(r.h.etag) });
    expect(r2.stato).toBe(304);
  });
  it("pagine con intestazioni di sicurezza", async () => {
    const r = await chiama("GET", "/player.html");
    expect(r.stato).toBe(200);
    expect(r.h["content-security-policy"]).toContain("default-src 'none'");
    expect(r.h["x-content-type-options"]).toBe("nosniff");
  });
  it("/ porta al player", async () => {
    expect((await chiama("GET", "/")).h.location).toBe("/player.html");
  });
  it("logo dalla cartella dati", async () => {
    expect((await chiama("GET", "/logo/logo.png")).testo).toBe("PNG");
  });
  it.each(["/../package.json", "/%2e%2e/package.json", "/%2e%2e%2fpackage.json", "/logo/../token", "/logo/%2e%2e%2ftoken", "/logo/%2e%2e%2frubami.png", "/logo/..%2frubami.png", "/segreto.txt", "/nessuno.html", "/%"])(
    "%s non esce",
    async (p) => {
      const r = await chiama("GET", p);
      expect(r.stato).not.toBe(200);
      expect(r.testo).not.toContain(TOKEN);
    },
  );
});

describe("intestazioni di sicurezza", () => {
  it.each([
    ["GET", "/player.html"],
    ["GET", "/api/config"],
    ["GET", "/logo/logo.png"],
    ["GET", "/nessuno.html"],
    ["PUT", "/api/config"],
    ["DELETE", "/api/config"],
  ])("%s %s", async (m, p) => {
    const r = await chiama(m, p);
    const attese = { ...SICUREZZA, ...(CSP_PAGINA[p.slice(1)] ? { "Content-Security-Policy": CSP_PAGINA[p.slice(1)] } : {}) };
    for (const [k, v] of Object.entries(attese)) expect(r.h[k.toLowerCase()], k).toBe(v);
  });
  it("solo il kit proposta incornicia, e solo sito, menu e TV si fanno incorniciare (A102)", async () => {
    writeFileSync(join(pub, "proposta.html"), "<p>kit</p>");
    writeFileSync(join(pub, "panel.html"), "<p>pannello</p>");
    const csp = async (p: string) => String((await chiama("GET", p)).h["content-security-policy"]);
    expect(await csp("/proposta.html")).toContain("frame-src 'self'");
    expect(await csp("/proposta.html")).toContain("frame-ancestors 'none'");
    expect(await csp("/player.html")).toContain("frame-ancestors 'self'");
    expect(await csp("/player.html")).not.toContain("frame-src");
    expect(await csp("/panel.html")).toBe(SICUREZZA["Content-Security-Policy"]);
    expect(await csp("/api/config")).toBe(SICUREZZA["Content-Security-Policy"]);
    for (const v of Object.values(CSP_PAGINA)) expect(v).not.toMatch(/unsafe|\*/);
  });
  it("CSP senza unsafe-inline né unsafe-eval", () => {
    expect(SICUREZZA["Content-Security-Policy"]).not.toMatch(/unsafe/);
    expect(SICUREZZA["Content-Security-Policy"]).toContain("default-src 'none'");
  });
});

describe("PUT", () => {
  const nuova = () => {
    const c = structuredClone(demo);
    c.slides[1]!.prezzo = 320;
    return c;
  };
  it("salva e rilegge; la versione prima resta in .prec", async () => {
    const r = await put(nuova());
    expect(r.stato).toBe(200);
    expect(salvata().slides[1]!.prezzo).toBe(320);
    expect(salvata(true).slides[1]!.prezzo).toBe(250);
    expect(existsSync(join(cliente.dir, "servizi", "schermo.json.tmp"))).toBe(false);
    expect(existsSync(join(cliente.dir, "negozio.json.tmp"))).toBe(false);
  });
  it.each([["", "senza"], ["sbagliato", "sbagliato"], [TOKEN + "x", "più lungo"]])("token %s (%s) = 401, nulla salvato", async (t) => {
    const r = await put(nuova(), t);
    expect(r.stato).toBe(401);
    expect(salvata().slides[1]!.prezzo).toBe(250);
  });
  it("dati non validi = 422 con gli errori", async () => {
    const c = nuova();
    c.slides[1]!.prezzo = 2.5;
    const r = await put(c);
    expect(r.stato).toBe(422);
    expect(JSON.parse(r.testo).errori).toEqual(["Offerta 2: prezzo non valido"]);
  });
  it("JSON rotto = 400", async () => {
    expect((await put("{")).stato).toBe(400);
  });
  it("corpo troppo grande = rifiutato", async () => {
    const r = await put("x".repeat(MAX_BODY + 1)).catch(() => ({ stato: 413 }));
    expect(r.stato).toBe(413);
  });
  it("logo che non esiste = 422", async () => {
    const c = nuova() as any;
    c.negozio.logo = "manca.png";
    expect((await put(c)).stato).toBe(422);
  });
  it("altri metodi = 405", async () => {
    expect((await chiama("DELETE", "/api/config")).stato).toBe(405);
    expect((await chiama("POST", "/player.html")).stato).toBe(405);
  });
});

describe("dentro", () => {
  it("solo file dentro la cartella", () => {
    expect(dentro(pub, "player.html")).toBeTruthy();
    expect(dentro(join(data, "logo"), "../rubami.png")).toBeNull();
    expect(dentro(join(data, "logo"), "%2e%2e/rubami.png")).toBeNull();
    expect(dentro(pub, "/etc/passwd")).toBeNull();
    expect(dentro(pub, "")).toBeNull();
  });
});

describe("limite tentativi", () => {
  it("dopo 10 token sbagliati: 429 anche col token giusto, poi passa dopo un minuto", async () => {
    let ora = 1_000_000;
    const lim = new Limitatore(() => ora);
    const srv = creaServer({ publicDir: pub, cliente, token: TOKEN, moduli, limitatore: lim });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const p = (srv.address() as AddressInfo).port;
    const invia = (t: string) =>
      new Promise<number>((ok, ko) => {
        const r = request({ host: "127.0.0.1", port: p, method: "PUT", path: "/api/config", headers: { "x-token": t } }, (res) => {
          res.resume();
          res.on("end", () => ok(res.statusCode ?? 0));
        });
        r.on("error", ko);
        r.end(JSON.stringify(demo));
      });
    for (let i = 0; i < MAX_TENTATIVI; i++) expect(await invia("sbagliato")).toBe(401);
    expect(await invia("sbagliato")).toBe(429);
    expect(await invia(TOKEN)).toBe(429);
    ora += FINESTRA_MS;
    expect(await invia(TOKEN)).toBe(200);
    srv.close();
  });
  it("il limitatore dimentica i vecchi tentativi", () => {
    let ora = 0;
    const lim = new Limitatore(() => ora);
    for (let i = 0; i < MAX_TENTATIVI - 1; i++) lim.fallito("a");
    ora = FINESTRA_MS - 1;
    lim.fallito("a");
    expect(lim.bloccato("a")).toBe(true);
    expect(lim.bloccato("b")).toBe(false);
    ora = 2 * FINESTRA_MS;
    expect(lim.bloccato("a")).toBe(false);
  });
});

describe("dashboard solo per l'owner", () => {
  const adminDati = join(data, "admin.json");
  writeFileSync(adminDati, '{"clienti":[]}');
  writeFileSync(join(pub, "admin.html"), "<p>admin</p>");
  async function con(ammesso: boolean) {
    const srv = creaServer({ publicDir: pub, cliente, token: TOKEN, moduli, adminDati, adminConsentito: () => ammesso });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const p = (srv.address() as AddressInfo).port;
    const get = (path: string, method = "GET") =>
      new Promise<{ stato: number; testo: string }>((ok) => {
        const r = request({ host: "127.0.0.1", port: p, path, method }, (res) => {
          let t = "";
          res.on("data", (c) => (t += c));
          res.on("end", () => ok({ stato: res.statusCode ?? 0, testo: t }));
        });
        r.end();
      });
    return { srv, get };
  }
  it.each(["/admin.html", "/api/admin", "/admin.css", "/assets/admin.js"])("da fuori %s = 404, come se non esistesse", async (p) => {
    const { srv, get } = await con(false);
    const r = await get(p);
    expect(r.stato).toBe(404);
    expect(r.testo).not.toContain("clienti");
    srv.close();
  });
  it("da questo computer: pagina e dati", async () => {
    const { srv, get } = await con(true);
    expect((await get("/admin.html")).testo).toContain("admin");
    expect(JSON.parse((await get("/api/admin")).testo)).toEqual({ clienti: [] });
    expect((await get("/api/admin", "PUT")).stato).toBe(405);
    srv.close();
  });
  it("senza dati configurati la dashboard non esiste", async () => {
    const srv = creaServer({ publicDir: pub, cliente, token: TOKEN, moduli, adminConsentito: () => true });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const port = (srv.address() as AddressInfo).port;
    const stato = await new Promise<number>((ok) => request({ host: "127.0.0.1", port, path: "/admin.html" }, (res) => { res.resume(); ok(res.statusCode ?? 0); }).end());
    expect(stato).toBe(404);
    srv.close();
  });
  it("soloLocale", () => {
    expect(["127.0.0.1", "::1", "::ffff:127.0.0.1"].every(soloLocale)).toBe(true);
    expect(["192.168.1.9", "100.64.0.1", "::ffff:192.168.1.9", ""].some(soloLocale)).toBe(false);
  });
});

describe("foto", () => {
  const carica = (b: Buffer, token = TOKEN) =>
    chiama("POST", "/api/foto", b, { "x-token": token, "content-type": "image/png", "content-length": String(b.length) });
  const conFoto = (foto: string) => ({ ...demo, slides: demo.slides.map((x, i) => (i === 1 ? { ...x, foto } : x)) });

  it("caricata col link giusto: nome casuale, servita con cache lunga, usabile in un'offerta", async () => {
    const r = await carica(pngFinto(800, 600));
    expect(r.stato).toBe(201);
    const { foto } = JSON.parse(r.testo);
    expect(foto).toMatch(/^[a-f0-9]{16}\.png$/);
    const g = await chiama("GET", `/foto/${foto}`);
    expect(g.stato).toBe(200);
    expect(g.h["content-type"]).toBe("image/png");
    expect(g.h["cache-control"]).toContain("immutable");
    expect(g.h["content-security-policy"]).toContain("default-src 'none'");
    expect((await put(conFoto(foto))).stato).toBe(200);
  });
  it("senza link giusto: 401, niente salvato", async () => {
    const prima = existsSync(cliente.foto) ? readdirSync(cliente.foto).length : 0;
    expect((await carica(pngFinto(10, 10), "sbagliato")).stato).toBe(401);
    expect(existsSync(cliente.foto) ? readdirSync(cliente.foto).length : 0).toBe(prima);
  });
  it("non una foto, o con i dati del telefono: 422 con il motivo", async () => {
    const svg = await carica(Buffer.from("<svg onload=alert(1)>"));
    expect(svg.stato).toBe(422);
    expect(JSON.parse(svg.testo).errori[0]).toContain("non è una foto");
    expect(JSON.parse((await carica(pngFinto(10, 10, [0, 0, 0], true))).testo).errori[0]).toContain("dati del telefono");
  });
  it("troppo pesante: 413 subito, dalla dimensione dichiarata, senza leggere il file", async () => {
    // mandare davvero 3 MB fa una corsa: il server risponde e chiude mentre il client scrive ancora (ECONNRESET)
    const r = await chiama("POST", "/api/foto", pngFinto(4, 4), { "x-token": TOKEN, "content-length": String(3 * 1024 * 1024) });
    expect(r.stato).toBe(413);
    expect(r.testo).toContain("troppo pesante");
  });
  it("offerta con una foto che non esiste: 422", async () => {
    const r = await put(conFoto("0123456789abcdef.png"));
    expect(r.stato).toBe(422);
    expect(r.testo).toContain("foto non trovata");
  });
  it("percorsi strani sotto /foto/: 404", async () => {
    for (const p of ["/foto/../token", "/foto/..%2Ftoken", "/foto/x.png", "/foto/"]) expect((await chiama("GET", p)).stato).toBe(404);
  });
  it("una foto non usata da più di un giorno si cancella al salvataggio; quella in uso e quella di prima (Annulla) restano", async () => {
    const nomi = await Promise.all([1, 2, 3].map(async () => JSON.parse((await carica(pngFinto(10, 10))).testo).foto as string));
    const [inUso, diPrima, orfana] = nomi as [string, string, string];
    const vecchia = new Date(Date.now() - 2 * 86_400_000);
    for (const f of [diPrima, orfana]) utimesSync(join(cliente.foto, f), vecchia, vecchia); // inUso: appena caricata
    expect((await put(conFoto(diPrima))).stato).toBe(200);
    expect((await put(conFoto(inUso))).stato).toBe(200);
    const restano = readdirSync(cliente.foto);
    expect(restano).toContain(inUso);
    expect(restano).toContain(diPrima);
    expect(restano).not.toContain(orfana);
  });
});
