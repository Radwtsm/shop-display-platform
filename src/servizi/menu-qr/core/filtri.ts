import type { IdAllergene } from "./allergeni.ts";
import type { Categoria, Piatto } from "./tipi.ts";

/**
 * "Senza X": i piatti che non contengono nessuno degli allergeni scelti. Un piatto con allergeni non indicati
 * (`null`) sparisce appena si sceglie un filtro: dire "senza" senza saperlo sarebbe un rischio.
 */
export function senzaAllergeni(piatti: readonly Piatto[], esclusi: ReadonlySet<IdAllergene>): Piatto[] {
  if (!esclusi.size) return [...piatti];
  return piatti.filter((p) => p.allergeni !== null && !p.allergeni.some((a) => esclusi.has(a)));
}

/** Categorie con i loro piatti, nell'ordine del menu; una categoria senza piatti non compare. */
export function perCategoria(categorie: readonly Categoria[], piatti: readonly Piatto[]): Array<{ categoria: Categoria; piatti: Piatto[] }> {
  return categorie
    .map((categoria) => ({ categoria, piatti: piatti.filter((p) => p.categoria === categoria.id) }))
    .filter((g) => g.piatti.length);
}

/** Elimina una categoria con i suoi piatti. */
export function senzaCategoria<T extends { categorie: Categoria[]; piatti: Piatto[] }>(m: T, id: string): T {
  return { ...m, categorie: m.categorie.filter((c) => c.id !== id), piatti: m.piatti.filter((p) => p.categoria !== id) };
}
