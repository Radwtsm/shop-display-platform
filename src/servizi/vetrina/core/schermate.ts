// Le schermate della TV a rotazione, in ordine: storia, QR (uno per volta), «Dicono di noi» (una recensione per volta, grande).
// Funzione pura: la usano la TV e i test.
import type { Recensione, RispostaVetrina, Storia, VoceQr } from "./tipi.ts";

export type Schermata =
  | { tipo: "storia"; storia: Storia }
  | { tipo: "qr"; voce: VoceQr }
  | { tipo: "recensioni"; recensioni: Recensione[]; media?: number; totale?: number; finte: boolean };

export const RECENSIONI_PER_SCHERMATA = 1;

export function schermate(r: RispostaVetrina): Schermata[] {
  const out: Schermata[] = [];
  if (r.storia) out.push({ tipo: "storia", storia: r.storia });
  for (const voce of r.qr) out.push({ tipo: "qr", voce });
  const { elenco, voto, totale, fonte } = r.recensioni;
  for (let i = 0; i < elenco.length; i += RECENSIONI_PER_SCHERMATA)
    out.push({
      tipo: "recensioni",
      recensioni: elenco.slice(i, i + RECENSIONI_PER_SCHERMATA),
      ...(voto !== undefined ? { media: voto } : {}),
      ...(totale !== undefined ? { totale } : {}),
      finte: fonte === "finte",
    });
  return out;
}

/** «★★★★☆»: il voto così com'è su Google, mai arrotondato per eccesso. */
export const stelle = (voto: number): string => "★".repeat(voto) + "☆".repeat(5 - voto);
