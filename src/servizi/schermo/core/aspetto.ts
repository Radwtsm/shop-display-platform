// Aspetto della TV scelto dal negoziante: un solo elenco di scelte per pannello (miniature), server (validazione) e
// TV (data-* sul body). Una scelta nuova = un gruppo qui + il suo CSS sulla TV e nella miniatura.

export interface Opzione {
  valore: string;
  nome: string;
}

export interface Gruppo {
  chiave: string;
  titolo: string;
  /** La prima è la "Consigliata": è anche quella usata quando il negoziante non ha scelto. */
  opzioni: readonly Opzione[];
}

export const GRUPPI_ASPETTO = [
  {
    chiave: "testata",
    titolo: "Nome e logo",
    opzioni: [
      { valore: "sinistra", nome: "In alto a sinistra" },
      { valore: "centro", nome: "In alto al centro" },
      { valore: "basso", nome: "In basso" },
      { valore: "nascosta", nome: "Nascosti" },
    ],
  },
  {
    chiave: "logo",
    titolo: "Misura del nome e del logo",
    opzioni: [
      { valore: "piccolo", nome: "Normale" },
      { valore: "grande", nome: "Grande" },
    ],
  },
  {
    chiave: "layout",
    titolo: "Disposizione",
    opzioni: [
      { valore: "classico", nome: "Classico" },
      { valore: "foto", nome: "Foto grande" },
      { valore: "listino", nome: "Listino" },
      { valore: "lavagna", nome: "Lavagna" },
    ],
  },
  {
    chiave: "passaggio",
    titolo: "Passaggio tra le offerte",
    opzioni: [
      { valore: "dissolvenza", nome: "Dissolvenza" },
      { valore: "scorrimento", nome: "Scorre di lato" },
      { valore: "zoom", nome: "Avvicina" },
      { valore: "nessuno", nome: "Nessuno" },
    ],
  },
] as const satisfies readonly Gruppo[];

export type ChiaveAspetto = (typeof GRUPPI_ASPETTO)[number]["chiave"];
export type Aspetto = Partial<Record<ChiaveAspetto, string>>;

export const consigliata = (g: Gruppo) => g.opzioni[0]!.valore;

/** Valore in uso per ogni gruppo: quello scelto se valido, altrimenti il consigliato. */
export function aspettoCompleto(a: Aspetto | undefined): Record<ChiaveAspetto, string> {
  return Object.fromEntries(
    GRUPPI_ASPETTO.map((g) => {
      const v = a?.[g.chiave];
      return [g.chiave, (g.opzioni as readonly Opzione[]).some((o) => o.valore === v) ? v! : consigliata(g)];
    }),
  ) as Record<ChiaveAspetto, string>;
}

/** Errori per valida(): solo chiavi e valori dell'elenco. */
export function erroriAspetto(a: unknown): string[] {
  if (a === undefined) return [];
  if (typeof a !== "object" || a === null || Array.isArray(a)) return ["Aspetto non valido"];
  const out: string[] = [];
  for (const [k, v] of Object.entries(a)) {
    const g = (GRUPPI_ASPETTO as readonly Gruppo[]).find((x) => x.chiave === k);
    if (!g) out.push(`Aspetto: scelta sconosciuta (${k})`);
    else if (!g.opzioni.some((o) => o.valore === v)) out.push(`${g.titolo}: scelta non valida`);
  }
  return out;
}

/** Riassunto per la riga del pannello: solo ciò che è diverso dal consigliato. */
export function riassuntoAspetto(a: Aspetto | undefined): string {
  const c = aspettoCompleto(a);
  const diversi = GRUPPI_ASPETTO.filter((g) => c[g.chiave] !== consigliata(g)).map(
    (g) => `${g.titolo}: ${(g.opzioni as readonly Opzione[]).find((o) => o.valore === c[g.chiave])!.nome.toLowerCase()}`,
  );
  return diversi.length ? diversi.join(" · ") : "Consigliato";
}

/** Tempi proposti per ogni offerta (secondiPerSlide): in numero pari, il consigliato per primo. */
export const SECONDI = [8, 5, 10, 15, 20, 30] as const;

/** Listino: quante offerte per pagina sulla TV (righe leggibili da lontano). */
export const PER_PAGINA_LISTINO = 6;

/**
 * La pagina del listino da mostrare adesso: con più di 6 offerte le pagine girano ogni `secondi`, divise in parti
 * uguali (7 = 4 + 3, mai 6 + 1: una riga sola su uno schermo vuoto sembra un errore).
 */
export function pagineListino(voci: number): number {
  return Math.max(1, Math.ceil(voci / PER_PAGINA_LISTINO));
}
export function paginaListino<T>(voci: T[], istante: number, secondi: number): T[] {
  const pagine = pagineListino(voci.length);
  const perPagina = Math.ceil(voci.length / pagine);
  const p = Math.floor(istante / 1000 / secondi) % pagine;
  return voci.slice(p * perPagina, (p + 1) * perPagina);
}
