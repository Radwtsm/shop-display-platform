// Dati per cliente × servizio. Ogni lettura e scrittura passa da qui con il cliente esplicito: niente percorsi
// costruiti altrove, così un cliente non può leggere i file di un altro (test con due clienti finti).
//   <dati>/clienti/<cliente>/cliente.json        servizi attivi
//                            negozio.json        nome, logo, colori, tema, QR: comuni a tutti i servizi
//                            servizi/<id>.json   dati di un servizio
//                            foto/ logo/ token
//                            fotografie/<AAAA-MM-GG>.json   dati pubblici del negozio a una data (A106)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SERVIZI, type IdServizio } from "../core/servizi.ts";

export const ID_CLIENTE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export interface DatiCliente {
  versione: 1;
  /** Servizi attivi: le rotte, la sezione del pannello e la zona della TV degli altri non esistono. */
  servizi: IdServizio[];
}

/** Scrittura atomica: un'interruzione a metà non lascia mai un file rotto; la versione prima resta in `.prec`. */
export function salvaAtomico(file: string, testo: string) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, testo, { mode: 0o600 });
  if (existsSync(file)) copyFileSync(file, `${file}.prec`);
  renameSync(tmp, file);
}

const leggiSe = (file: string): string | null => (existsSync(file) ? readFileSync(file, "utf8") : null);

export class Cliente {
  readonly id: string;
  readonly dir: string;
  constructor(radice: string, id: string) {
    if (!ID_CLIENTE.test(id)) throw new Error(`cliente non valido: ${id}`);
    this.id = id;
    this.dir = join(radice, "clienti", id);
  }
  get foto() {
    return join(this.dir, "foto");
  }
  get logo() {
    return join(this.dir, "logo");
  }
  get fileToken() {
    return join(this.dir, "token");
  }
  private file(nome: "cliente" | "negozio" | IdServizio, prec = false): string {
    const base = nome === "cliente" || nome === "negozio" ? join(this.dir, `${nome}.json`) : join(this.dir, "servizi", `${nome}.json`);
    return prec ? `${base}.prec` : base;
  }
  /** Testo del file, o null se non c'è; `prec` = la versione prima dell'ultimo salvataggio. */
  leggi(nome: "cliente" | "negozio" | IdServizio, prec = false): string | null {
    return leggiSe(this.file(nome, prec));
  }
  scrivi(nome: "cliente" | "negozio" | IdServizio, testo: string) {
    mkdirSync(join(this.dir, "servizi"), { recursive: true, mode: 0o700 });
    salvaAtomico(this.file(nome), testo);
  }
  /** Testi delle fotografie (A106), in ordine di nome = di data; il controllo del contenuto lo fa chi le legge. */
  fotografie(): string[] {
    const dir = join(this.dir, "fotografie");
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => readFileSync(join(dir, f), "utf8"));
  }
  salvaFotografia(data: string, testo: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error(`data non valida: ${data}`);
    mkdirSync(join(this.dir, "fotografie"), { recursive: true, mode: 0o700 });
    salvaAtomico(join(this.dir, "fotografie", `${data}.json`), testo);
  }
  esiste(): boolean {
    return existsSync(this.file("cliente"));
  }
  servizi(): IdServizio[] {
    try {
      const d = JSON.parse(this.leggi("cliente") ?? "null") as DatiCliente | null;
      const noti = new Set(SERVIZI.map((s) => s.id));
      return d?.versione === 1 && Array.isArray(d.servizi) ? d.servizi.filter((s) => noti.has(s)) : [];
    } catch {
      return [];
    }
  }
  /** Scrive l'elenco dei servizi attivi (in ordine di catalogo). */
  impostaServizi(ids: IdServizio[]) {
    const d: DatiCliente = { versione: 1, servizi: SERVIZI.map((s) => s.id).filter((i) => ids.includes(i)) };
    this.scrivi("cliente", JSON.stringify(d, null, 2));
  }
  /** Il punto unico per "questo cliente ha questo servizio": con A12 ci si aggiungono piani ed extra. */
  attivo(servizio: IdServizio): boolean {
    return this.servizi().includes(servizio);
  }
}

export class Archivio {
  readonly radice: string;
  constructor(radice: string) {
    this.radice = radice;
  }
  cliente(id: string): Cliente {
    return new Cliente(this.radice, id);
  }
  clienti(): string[] {
    const dir = join(this.radice, "clienti");
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((d) => ID_CLIENTE.test(d) && statSync(join(dir, d)).isDirectory()).sort();
  }
}
