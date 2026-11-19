/** Fascia oraria nell'ora di Roma. giorni: 1 = lunedì … 7 = domenica. `a` < `da` = passa la mezzanotte. */
export interface Fascia {
  giorni: number[];
  da: string;
  a: string;
}

export const FUSO = "Europe/Rome";
const GIORNI: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Giorno (1-7) e minuti dalla mezzanotte nell'ora di Roma, ora legale compresa. */
export function oraLocale(istante: number): { giorno: number; minuti: number } {
  const p = Object.fromEntries(fmt.formatToParts(istante).map((x) => [x.type, x.value]));
  return { giorno: GIORNI[p.weekday ?? ""] ?? 0, minuti: Number(p.hour) * 60 + Number(p.minute) };
}

const fmtData = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });

const fmtGiorno = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });

/** Il giorno a Roma da mostrare ("Mercoledì 11 novembre"), sopra il titolo del menu sulla TV. */
export function giornoLungo(istante: number): string {
  const s = fmtGiorno.format(istante);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** La data di oggi a Roma ("2026-11-06"): un "solo per oggi" scade a mezzanotte di Roma. */
export function dataLocale(istante: number): string {
  return fmtData.format(istante);
}

export function minuti(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function inFascia(f: Fascia, istante: number): boolean {
  const { giorno, minuti: m } = oraLocale(istante);
  const da = minuti(f.da);
  const a = minuti(f.a);
  if (da <= a) return f.giorni.includes(giorno) && m >= da && m < a;
  const ieri = giorno === 1 ? 7 : giorno - 1;
  return (f.giorni.includes(giorno) && m >= da) || (f.giorni.includes(ieri) && m < a);
}

/** Dipende solo dall'orologio: più schermi restano allineati e i test sono deterministici. */
export function indiceCorrente(quante: number, istante: number, secondiPerSlide: number): number {
  if (quante <= 0) return -1;
  return Math.floor(istante / 1000 / secondiPerSlide) % quante;
}

/** Le fasce in parole per il negoziante ("dalle 06:30 alle 11:00"). */
export function descriviFasce(fasce?: Fascia[]): string {
  if (!fasce?.length) return "";
  if (fasce.length === 1) {
    const f = fasce[0]!;
    const g = [...f.giorni].sort().join("");
    if (g === "1234567") return `dalle ${f.da} alle ${f.a}`;
    if (g === "123456") return `lun–sab, dalle ${f.da} alle ${f.a}`;
    if (g === "12345") return `lun–ven, dalle ${f.da} alle ${f.a}`;
  }
  return "solo in alcuni giorni e orari";
}
