// Dashboard dell'owner: tutto si calcola dai dati, così i numeri sono testabili e uguali ovunque.
import { SERVIZI, servizio, type IdServizio, type Servizio } from "./servizi.ts";

/** Un apparecchio in negozio (TV, display, sensore): manda un segnale di vita. */
export interface Dispositivo {
  id: string;
  nome: string;
  servizio: IdServizio;
  ultimoSegnale: string;
  versione: string;
}

export interface Abbonamento {
  servizio: IdServizio;
  /** Centesimi al mese. */
  canone: number;
}

export interface Cliente {
  id: string;
  nome: string;
  settore: string;
  zona: string;
  servizi: Abbonamento[];
  cliente_dal: string;
  dispositivi: Dispositivo[];
  backup: { ultimo: string; provaRipristino: string };
}

export interface DatiAdmin {
  /** Solo nei dati finti: l'istante in cui sono stati scritti; la demo li fa scorrere fino ad adesso. */
  riferimento?: string;
  versioneAttuale: string;
  clienti: Cliente[];
}

export type Livello = "problema" | "attenzione";

export interface Avviso {
  livello: Livello;
  clienteId: string;
  cliente: string;
  titolo: string;
  cosaFare: string;
  /** Solo per gli avvisi di un apparecchio: il servizio a cui appartiene. */
  servizio?: IdServizio;
}

const MIN = 60_000;
export const SPENTO_DOPO_MS = 5 * MIN;
export const PROBLEMA_DOPO_MS = 30 * MIN;
export const BACKUP_VECCHIO_MS = 26 * 60 * MIN;
export const RIPRISTINO_VECCHIO_MS = 30 * 24 * 60 * MIN;

export const online = (s: Dispositivo, ora: number) => ora - Date.parse(s.ultimoSegnale) < SPENTO_DOPO_MS;

/** "2 min", "3 h", "5 giorni": come lo direbbe una persona. */
export function durata(ms: number): string {
  const m = Math.floor(ms / MIN);
  if (m < 1) return "meno di un minuto";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} giorni`;
}

/** Solo ciò che chiede un'azione (regola avvisi dell'owner): niente stati passeggeri. */
export function avvisi(d: DatiAdmin, ora: number): Avviso[] {
  const out: Avviso[] = [];
  for (const c of d.clienti) {
    for (const s of c.dispositivi) {
      const fermo = ora - Date.parse(s.ultimoSegnale);
      const parole = servizio(s.servizio).dispositivi;
      if (fermo >= PROBLEMA_DOPO_MS && parole)
        out.push({
          livello: "problema", clienteId: c.id, cliente: c.nome,
          titolo: `${s.nome} ${parole.spento.toLowerCase()} da ${durata(fermo)}`,
          cosaFare: parole.cosaFare,
          servizio: s.servizio,
        });
    }
    if (ora - Date.parse(c.backup.ultimo) >= BACKUP_VECCHIO_MS)
      out.push({
        livello: "problema", clienteId: c.id, cliente: c.nome,
        titolo: `Backup fermo da ${durata(ora - Date.parse(c.backup.ultimo))}`,
        cosaFare: "Controlla il job di backup sul server.",
      });
    if (ora - Date.parse(c.backup.provaRipristino) >= RIPRISTINO_VECCHIO_MS)
      out.push({
        livello: "attenzione", clienteId: c.id, cliente: c.nome,
        titolo: `Prova di ripristino di ${durata(ora - Date.parse(c.backup.provaRipristino))} fa`,
        cosaFare: "Fai la prova di ripristino del mese.",
      });
    for (const sv of new Set(c.dispositivi.map((s) => s.servizio))) {
      const vecchi = c.dispositivi.filter((s) => s.servizio === sv && s.versione !== d.versioneAttuale);
      if (vecchi.length)
        out.push({
          livello: "attenzione", clienteId: c.id, cliente: c.nome,
          titolo: `${vecchi.map((s) => s.nome).join(", ")} su versione ${vecchi[0]!.versione}`,
          cosaFare: `Aggiorna alla ${d.versioneAttuale} a negozio chiuso.`,
          servizio: sv,
        });
    }
  }
  return out.sort((a, b) => (a.livello === b.livello ? 0 : a.livello === "problema" ? -1 : 1));
}

export const canone = (c: Cliente) => c.servizi.reduce((t, a) => t + a.canone, 0);

export function riepilogo(d: DatiAdmin, ora: number) {
  const dispositivi = d.clienti.flatMap((c) => c.dispositivi);
  return {
    clienti: d.clienti.length,
    abbonamenti: d.clienti.reduce((n, c) => n + c.servizi.length, 0),
    dispositiviOnline: dispositivi.filter((s) => online(s, ora)).length,
    dispositiviTotali: dispositivi.length,
    canoniMese: d.clienti.reduce((t, c) => t + canone(c), 0),
    avvisi: avvisi(d, ora),
  };
}

export interface StatoServizio {
  servizio: Servizio;
  /** Clienti che lo usano, nell'ordine dei dati. */
  clienti: Cliente[];
  canoniMese: number;
  dispositiviOnline: number;
  dispositiviTotali: number;
  /** Avvisi che riguardano i suoi dispositivi. */
  problemi: number;
}

/** Ogni servizio del catalogo con i suoi numeri; "attivo" = almeno un cliente. Prima gli attivi, nell'ordine del catalogo. */
export function perServizio(d: DatiAdmin, ora: number): { attivi: StatoServizio[]; inArrivo: Servizio[] } {
  const tutti = SERVIZI.map((sv): StatoServizio => {
    const clienti = d.clienti.filter((c) => c.servizi.some((a) => a.servizio === sv.id));
    const disp = d.clienti.flatMap((c) => c.dispositivi).filter((x) => x.servizio === sv.id);
    return {
      servizio: sv,
      clienti,
      canoniMese: clienti.reduce((t, c) => t + c.servizi.filter((a) => a.servizio === sv.id).reduce((u, a) => u + a.canone, 0), 0),
      dispositiviOnline: disp.filter((x) => online(x, ora)).length,
      dispositiviTotali: disp.length,
      problemi: disp.filter((x) => ora - Date.parse(x.ultimoSegnale) >= PROBLEMA_DOPO_MS).length,
    };
  });
  return { attivi: tutti.filter((t) => t.clienti.length), inArrivo: tutti.filter((t) => !t.clienti.length).map((t) => t.servizio) };
}

/** Ricerca tollerante: senza accenti né maiuscole, su nome, settore, zona e servizi. */
export function cerca(clienti: Cliente[], testo: string): Cliente[] {
  const norm = (x: string) => x.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const parole = norm(testo).split(/\s+/).filter(Boolean);
  if (!parole.length) return clienti;
  return clienti.filter((c) => {
    const tutto = norm([c.nome, c.settore, c.zona, ...c.servizi.map((a) => servizio(a.servizio).nome)].join(" "));
    return parole.every((p) => tutto.includes(p));
  });
}

/** Dati finti sempre "vivi": ogni data si sposta di (ora - riferimento). Senza riferimento restano come sono. */
export function spostaDemo(d: DatiAdmin, ora: number): DatiAdmin {
  if (!d.riferimento) return d;
  const delta = ora - Date.parse(d.riferimento);
  const sposta = (iso: string) => new Date(Date.parse(iso) + delta).toISOString();
  return {
    ...d,
    riferimento: new Date(ora).toISOString(),
    clienti: d.clienti.map((c) => ({
      ...c,
      dispositivi: c.dispositivi.map((s) => ({ ...s, ultimoSegnale: sposta(s.ultimoSegnale) })),
      backup: { ultimo: sposta(c.backup.ultimo), provaRipristino: sposta(c.backup.provaRipristino) },
    })),
  };
}
