import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { controllaFoto, FOTO, FOTO_MAX_BYTE } from "../core/foto.ts";
import type { Cliente } from "./archivio.ts";
import type { Contesto, ModuloServer } from "./modulo.ts";
import { creaMeteo, type ServizioMeteo } from "./meteo.ts";
import { leggiNegozio, rottaNegozio } from "./negozio.ts";

export const MAX_BODY = 64 * 1024;

const TIPI: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

export const SICUREZZA = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; " +
    "base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

// Il kit proposta (A102) mostra sito, menu e TV dentro le sue cornici: solo lui può incorniciare, solo quelle tre pagine.
const CSP = SICUREZZA["Content-Security-Policy"];
export const CSP_PAGINA: Record<string, string> = {
  "proposta.html": CSP.replace("default-src 'none';", "default-src 'none'; frame-src 'self';"),
  ...Object.fromEntries(["sito.html", "menu.html", "player.html"].map((f) => [f, CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'")])),
};

export const MAX_TENTATIVI = 10;
export const FINESTRA_MS = 60_000;

/** Tentativi falliti per indirizzo: dopo MAX_TENTATIVI nella finestra, il token non viene più provato. */
export class Limitatore {
  private falliti = new Map<string, number[]>();
  private ora: () => number;
  constructor(ora: () => number = Date.now) {
    this.ora = ora;
  }
  bloccato(ip: string): boolean {
    const recenti = (this.falliti.get(ip) ?? []).filter((t) => this.ora() - t < FINESTRA_MS);
    if (recenti.length) this.falliti.set(ip, recenti);
    else this.falliti.delete(ip);
    return recenti.length >= MAX_TENTATIVI;
  }
  fallito(ip: string) {
    this.falliti.set(ip, [...(this.falliti.get(ip) ?? []), this.ora()]);
  }
}

export const soloLocale = (ip: string) => ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

/** Percorsi della dashboard: per chi non è ammesso rispondono come se non esistessero (404, non 403). */
export const ADMIN = /^\/(admin\.(html|css)|assets\/admin\.js(\.map)?|api\/admin)$/;

export interface Opzioni {
  publicDir: string;
  /** Il cliente servito da questo processo (più clienti per processo: con A7). */
  cliente: Cliente;
  token: string;
  /** Servizi con codice (caricaModuli); rispondono solo quelli attivi per il cliente. */
  moduli: ModuloServer[];
  limitatore?: Limitatore;
  /** File dei dati della dashboard dell'owner; senza, la dashboard non esiste. */
  adminDati?: string;
  /** Chi può vedere la dashboard: di default solo questo computer (poi Tailscale). */
  adminConsentito?: (ip: string) => boolean;
  /** Meteo e ricerca città (Open-Meteo); nei test si passa uno finto. */
  meteo?: ServizioMeteo;
  /** Indirizzo del server raggiungibile dal telefono (es. http://192.168.1.50:8080): base dei QR predefiniti. */
  origineTelefono?: string;
}

/** File dentro `dir`, o null: niente `..`, niente percorsi assoluti, niente cartelle. */
export function dentro(dir: string, rel: string): string | null {
  const base = resolve(dir);
  const p = resolve(base, "." + sep + rel);
  if (!p.startsWith(base + sep)) return null;
  try {
    return statSync(p).isFile() ? p : null;
  } catch {
    return null;
  }
}

function invia(res: ServerResponse, stato: number, corpo: string | Buffer, tipo: string, extra: Record<string, string> = {}) {
  res.writeHead(stato, { ...SICUREZZA, "Content-Type": tipo, ...extra });
  res.end(corpo);
}

const json = (res: ServerResponse, stato: number, dati: unknown, extra: Record<string, string> = {}) =>
  invia(res, stato, JSON.stringify(dati), "application/json; charset=utf-8", { "Cache-Control": "no-store", ...extra });

function tokenOk(ricevuto: unknown, atteso: string): boolean {
  if (typeof ricevuto !== "string") return false;
  const a = createHash("sha256").update(ricevuto).digest();
  const b = createHash("sha256").update(atteso).digest();
  return timingSafeEqual(a, b);
}

function leggiCorpo(req: IncomingMessage, max = MAX_BODY): Promise<Buffer | null> {
  return new Promise((ok) => {
    const parti: Buffer[] = [];
    let n = 0;
    req.on("data", (c: Buffer) => {
      n += c.length;
      if (n > max) {
        ok(null);
        req.destroy();
      } else parti.push(c);
    });
    req.on("end", () => ok(Buffer.concat(parti)));
    req.on("error", () => ok(null));
  });
}

/** Foto che nessun servizio usa più (né nei dati nuovi né in quelli di prima, per "Annulla"), da più di un giorno. */
export const FOTO_ORFANA_MS = 24 * 3600_000;

function puliziaFoto(cliente: Cliente, moduli: ModuloServer[], ora = Date.now()) {
  const dir = cliente.foto;
  const usate = new Set(moduli.flatMap((m) => m.fotoUsate(cliente)));
  for (const f of existsSync(dir) ? readdirSync(dir) : [])
    if (FOTO.test(f) && !usate.has(f) && ora - statSync(join(dir, f)).mtimeMs > FOTO_ORFANA_MS) unlinkSync(join(dir, f));
}

export function creaServer(o: Opzioni): Server {
  const limitatore = o.limitatore ?? new Limitatore();
  const meteo = o.meteo ?? creaMeteo({ chiave: process.env.METEO_CHIAVE, base: process.env.METEO_BASE, baseGeo: process.env.METEO_BASE_GEO });
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      const percorso = decodeURIComponent(url.pathname);
      if (ADMIN.test(percorso)) {
        const ammesso = (o.adminConsentito ?? soloLocale)(req.socket.remoteAddress ?? "");
        if (!ammesso || !o.adminDati) return invia(res, 404, "Non trovato", "text/plain; charset=utf-8");
        if (percorso === "/api/admin") {
          if (req.method !== "GET") return json(res, 405, { errori: ["Metodo non permesso"] });
          return invia(res, 200, readFileSync(o.adminDati, "utf8"), "application/json; charset=utf-8", { "Cache-Control": "no-store" });
        }
      }
      const autorizzato = (): boolean => {
        const ip = req.socket.remoteAddress ?? "?";
        if (limitatore.bloccato(ip)) {
          json(res, 429, { errori: ["Troppi tentativi con un link sbagliato. Riprova tra un minuto."] }, { "Retry-After": "60" });
          return false;
        }
        if (!tokenOk(req.headers["x-token"], o.token)) {
          limitatore.fallito(ip);
          json(res, 401, { errori: ["Link del pannello non valido"] });
          return false;
        }
        return true;
      };
      if (percorso === "/api/foto") {
        if (req.method !== "POST") return json(res, 405, { errori: ["Metodo non permesso"] });
        if (!autorizzato()) return;
        // dimensione dichiarata: si risponde subito invece di chiudere a metà (il telefono vedrebbe "errore di rete")
        if (Number(req.headers["content-length"]) > FOTO_MAX_BYTE)
          return json(res, 413, { errori: ["La foto è troppo pesante (massimo 2 MB)."] }, { Connection: "close" });
        const corpo = await leggiCorpo(req, FOTO_MAX_BYTE);
        if (corpo === null) return json(res, 413, { errori: ["La foto è troppo pesante (massimo 2 MB)."] });
        const esito = controllaFoto(corpo);
        if (!esito.ok) return json(res, 422, { errori: [esito.errore] });
        const dir = o.cliente.foto;
        mkdirSync(dir, { recursive: true, mode: 0o700 });
        const nome = `${randomBytes(8).toString("hex")}.${esito.tipo}`;
        writeFileSync(join(dir, nome), corpo, { mode: 0o600 });
        return json(res, 201, { foto: nome });
      }
      const c: Contesto = {
        req, res, percorso, cliente: o.cliente, autorizzato,
        json: (stato, dati, extra) => json(res, stato, dati, extra),
        invia: (stato, corpo, tipo, extra) => invia(res, stato, corpo, tipo, extra),
        leggiCorpo: (max) => leggiCorpo(req, max),
        puliziaFoto: () => puliziaFoto(o.cliente, o.moduli),
        flusso: () => {
          res.writeHead(200, { ...SICUREZZA, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" });
          req.socket.setTimeout(0);
          const vivo = setInterval(() => res.write(": vivo\n\n"), 25_000);
          res.on("close", () => clearInterval(vivo));
          return { scrivi: (dati) => void res.write(`data: ${dati.replace(/[\r\n]/g, " ")}\n\n`), chiuso: (fai) => void res.on("close", fai) };
        },
      };
      if (percorso === "/api/meteo" || percorso === "/api/citta") {
        if (req.method !== "GET") return json(res, 405, { errori: ["Metodo non permesso"] });
        if (percorso === "/api/citta") {
          // il pannello cerca la città per nome; chi ha il token e nessun altro
          if (!autorizzato()) return;
          return json(res, 200, { citta: await meteo.cerca(url.searchParams.get("q") ?? "") });
        }
        // la TV non manda coordinate: usa la città salvata, quindi nessuno può usare il server per chiamare Open-Meteo a caso
        const citta = leggiNegozio(o.cliente)?.negozio.citta;
        if (!citta) return json(res, 404, { errori: ["Nessuna città scelta"] });
        const m = await meteo.meteo(citta.lat, citta.lon);
        return m ? json(res, 200, m) : json(res, 503, { errori: ["Meteo non disponibile"] });
      }
      if (percorso === "/api/negozio") return void (await rottaNegozio(c, o.origineTelefono));
      for (const m of o.moduli) if (o.cliente.attivo(m.id) && (await m.gestisci(c))) return;
      // di nessun servizio attivo: come se non esistesse, anche in scrittura
      if (percorso.startsWith("/api/")) return json(res, 404, { errori: ["Non trovato"] });
      if (req.method !== "GET" && req.method !== "HEAD") return invia(res, 405, "", "text/plain");
      if (percorso === "/") return invia(res, 302, "", "text/plain", { Location: "/player.html" });
      // una foto non cambia mai (nome nuovo a ogni caricamento): la TV la tiene e la mostra anche senza rete
      if (percorso.startsWith("/foto/")) {
        const nome = percorso.slice(6);
        const file = FOTO.test(nome) ? dentro(o.cliente.foto, nome) : null;
        if (!file) return invia(res, 404, "Non trovato", "text/plain; charset=utf-8");
        return invia(res, 200, readFileSync(file), TIPI[extname(file)]!, { "Cache-Control": "public, max-age=31536000, immutable" });
      }
      const file = percorso.startsWith("/logo/")
        ? dentro(o.cliente.logo, percorso.slice(6))
        : dentro(o.publicDir, percorso.slice(1));
      const tipo = file && TIPI[extname(file).toLowerCase()];
      if (!file || !tipo) return invia(res, 404, "Non trovato", "text/plain; charset=utf-8");
      const csp = percorso.startsWith("/logo/") ? undefined : CSP_PAGINA[percorso.slice(1)];
      return invia(res, 200, readFileSync(file), tipo, { "Cache-Control": "no-cache", ...(csp ? { "Content-Security-Policy": csp } : {}) });
    } catch (e) {
      console.error(e);
      if (!res.headersSent) invia(res, 500, "Errore", "text/plain; charset=utf-8");
    }
  });
}
