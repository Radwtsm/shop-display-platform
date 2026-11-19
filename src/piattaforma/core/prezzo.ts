const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

const euroInteri = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Per i riepiloghi: 23400 -> "234 €" (i centesimi solo se ci sono). */
export function formattaBreve(centesimi: number): string {
  return centesimi % 100 ? formatta(centesimi) : euroInteri.format(centesimi / 100);
}

export const PREZZO_MAX = 9_999_999;

export function formatta(centesimi: number): string {
  return euro.format(centesimi / 100);
}

/** "2,50", "2.50", "€ 2", "2,5 €" -> centesimi; null se non è un prezzo valido. */
export function leggi(testo: string): number | null {
  const t = testo.replace(/€/g, "").replace(/\s/g, "");
  const m = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const cent = Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
  return cent <= PREZZO_MAX ? cent : null;
}

/** Per i campi del pannello: 250 -> "2,50". */
export function perCampo(centesimi: number): string {
  return `${Math.floor(centesimi / 100)},${String(centesimi % 100).padStart(2, "0")}`;
}
