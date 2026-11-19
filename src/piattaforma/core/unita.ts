// Prezzo per unità di misura (€/kg, €/l): per gli alimentari va indicato accanto al prezzo di vendita.

export interface Quantita {
  /** Grammi o millilitri, intero. */
  valore: number;
  unita: "g" | "ml";
}

export const QUANTITA_MAX = 100_000;

/** "100 g", "1 kg", "1,5 kg", "500ml", "1 l", "0,75 l" -> grammi/millilitri; null se non si capisce. */
export function leggiQuantita(testo: string): Quantita | null {
  const m = /^(\d{1,6})(?:[.,](\d{1,3}))?\s*(g|gr|kg|ml|l|lt)$/i.exec(testo.trim().replace(/\s+/g, " "));
  if (!m) return null;
  const numero = Number(`${m[1]}.${m[2] ?? "0"}`);
  const u = m[3]!.toLowerCase();
  const per = u === "kg" || u === "l" || u === "lt" ? 1000 : 1;
  const valore = Math.round(numero * per);
  if (valore < 1 || valore > QUANTITA_MAX || !Number.isInteger(numero * per)) return null;
  return { valore, unita: u === "g" || u === "gr" || u === "kg" ? "g" : "ml" };
}

export function descriviQuantita(q: Quantita): string {
  const grande = q.unita === "g" ? "kg" : "l";
  if (q.valore >= 1000) return `${String(q.valore / 1000).replace(".", ",")} ${grande}`;
  return `${q.valore} ${q.unita}`;
}

/** Centesimi al kg o al litro, arrotondati al centesimo. */
export function prezzoPerUnita(prezzo: number, q: Quantita): { centesimi: number; per: "kg" | "l" } {
  return { centesimi: Math.round((prezzo * 1000) / q.valore), per: q.unita === "g" ? "kg" : "l" };
}
