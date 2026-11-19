// Meteo e ricerca della città, chiamati dal SERVER (la TV ha connect-src 'self': non può parlare con Open-Meteo).
// Open-Meteo: gratis solo per uso non commerciale; per i negozi serve il piano a pagamento (METEO_CHIAVE e METEO_BASE
// dall'ambiente). Attribuzione CC BY 4.0 nella barra. Limiti: 10.000/giorno, 5.000/ora per IP: la cache da 30 minuti
// li tiene lontani anche con molti clienti nella stessa città.
import { validaMeteo, type Meteo } from "../core/barra.ts";
import type { Citta } from "../core/negozio.ts";

export const METEO_CACHE_MS = 30 * 60_000;
export const METEO_TIMEOUT_MS = 5_000;

export type Scarica = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export interface ServizioMeteo {
  /** Tempo adesso a quelle coordinate, o null se non si sa (rete giù e niente in cache). */
  meteo(lat: number, lon: number): Promise<Meteo | null>;
  /** Città con quel nome (massimo 5), o [] se non trovate o rete giù. */
  cerca(nome: string): Promise<Citta[]>;
}

export interface OpzioniMeteo {
  scarica?: Scarica;
  ora?: () => number;
  chiave?: string;
  base?: string;
  baseGeo?: string;
}

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const arrotonda = (x: number) => Math.round(x * 100) / 100; // ~1 km: città vicine condividono la cache

export function creaMeteo(o: OpzioniMeteo = {}): ServizioMeteo {
  const scarica = o.scarica ?? ((u, i) => fetch(u, i));
  const ora = o.ora ?? Date.now;
  const chiave = o.chiave ? `&apikey=${encodeURIComponent(o.chiave)}` : "";
  const base = o.base ?? (o.chiave ? "https://customer-api.open-meteo.com" : "https://api.open-meteo.com");
  const baseGeo = o.baseGeo ?? (o.chiave ? "https://customer-geocoding-api.open-meteo.com" : "https://geocoding-api.open-meteo.com");
  const cache = new Map<string, Meteo>();
  const inCorso = new Map<string, Promise<Meteo | null>>();

  async function chiedi(url: string): Promise<unknown> {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), METEO_TIMEOUT_MS);
    try {
      const r = await scarica(url, { signal: stop.signal });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function prendi(lat: number, lon: number, k: string): Promise<Meteo | null> {
    const j = (await chiedi(
      `${base}/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto${chiave}`,
    )) as { current?: Record<string, unknown> } | null;
    const c = j?.current;
    const t = num(c?.temperature_2m);
    const codice = num(c?.weather_code);
    if (t === null || codice === null) return cache.get(k) ?? null; // rete giù: l'ultimo valore, anche se vecchio
    const m = { temperatura: Math.round(t * 10) / 10, codice, giorno: c?.is_day === 1, aggiornato: ora() };
    if (!validaMeteo(m)) return cache.get(k) ?? null;
    cache.set(k, m);
    return m;
  }

  return {
    async meteo(lat, lon) {
      const la = arrotonda(lat);
      const lo = arrotonda(lon);
      const k = `${la},${lo}`;
      const c = cache.get(k);
      if (c && ora() - c.aggiornato < METEO_CACHE_MS) return c;
      // più TV che chiedono insieme = una sola chiamata
      let p = inCorso.get(k);
      if (!p) inCorso.set(k, (p = prendi(la, lo, k).finally(() => inCorso.delete(k))));
      return p;
    },
    async cerca(nome) {
      const q = nome.trim().slice(0, 60);
      if (q.length < 2) return [];
      const j = (await chiedi(`${baseGeo}/v1/search?name=${encodeURIComponent(q)}&count=5&language=it&format=json${chiave}`)) as
        | { results?: Record<string, unknown>[] }
        | null;
      const fuori: Citta[] = [];
      for (const r of j?.results ?? []) {
        const lat = num(r.latitude);
        const lon = num(r.longitude);
        if (typeof r.name !== "string" || lat === null || lon === null) continue;
        const area = typeof r.admin1 === "string" && r.admin1 !== r.name ? `, ${r.admin1}` : "";
        fuori.push({ nome: `${r.name}${area}`.slice(0, 60), lat: arrotonda(lat), lon: arrotonda(lon) });
      }
      return fuori;
    },
  };
}

/** Per i test e per chi non vuole il meteo: non sa niente. */
export const senzaMeteo: ServizioMeteo = { meteo: async () => null, cerca: async () => [] };
