import { perCategoria } from "./filtri.ts";
import { finitoOggi } from "./finito.ts";
import type { DatiMenu, Piatto } from "./tipi.ts";

/**
 * Una riga del menu sulla TV; `segue` = titolo ripetuto perché la categoria continua dalla pagina prima;
 * `colonna` = la riga apre la seconda colonna della pagina.
 */
export type Riga = ({ tipo: "categoria"; nome: string; segue?: boolean } | { tipo: "piatto"; piatto: Piatto }) & { colonna?: boolean };

/** Le righe del "Menu del giorno" sulla TV, in fila: titolo di categoria e i suoi piatti non finiti oggi. */
export function righeTv(menu: DatiMenu, istante = Date.now()): Riga[] {
  return perCategoria(menu.categorie, menu.piatti.filter((p) => !finitoOggi(p, istante))).flatMap(({ categoria, piatti }) =>
    piatti.length ? [{ tipo: "categoria", nome: categoria.nome } as Riga, ...piatti.map((piatto): Riga => ({ tipo: "piatto", piatto }))] : [],
  );
}

/**
 * Impagina le righe misurando (A136(8)): `quanteStanno(righe)` dice quante righe iniziali stanno in una pagina (la
 * TV le prova davvero: due colonne, nomi che vanno a capo, qualsiasi misura). Un titolo di categoria non resta mai
 * solo in fondo; se la categoria continua, la pagina dopo riparte col titolo e "segue". Poi si ripartisce alla pari:
 * stesse pagine ma righe uguali (7 = 4 + 3, mai 6 + 1: una pagina con due piatti sembra un errore).
 */
export function impagina(righe: Riga[], quanteStanno: (righe: Riga[]) => number): Riga[][] {
  const piene = passata(righe, quanteStanno, 0);
  if (piene.length <= 1) return piene;
  const pari = passata(righe, quanteStanno, piene.length);
  return pari.length === piene.length ? pari : piene;
}

function passata(righe: Riga[], quanteStanno: (righe: Riga[]) => number, pagineAttese: number): Riga[][] {
  const pagine: Riga[][] = [];
  let categoria = "";
  for (let i = 0; i < righe.length; ) {
    const testa: Riga[] = righe[i]!.tipo === "piatto" && categoria ? [{ tipo: "categoria", nome: categoria, segue: true }] : [];
    let resto = righe.slice(i);
    const restanti = pagineAttese - pagine.length;
    if (pagineAttese && restanti > 0) resto = resto.slice(0, Math.ceil(resto.length / restanti));
    let n = Math.min(resto.length, quanteStanno([...testa, ...resto]) - testa.length);
    while (n > 0 && resto[n - 1]!.tipo === "categoria") n--;
    if (n <= 0) n = Math.min(resto.length, resto[0]!.tipo === "categoria" ? 2 : 1); // almeno un piatto per pagina
    const presa = resto.slice(0, n);
    for (const r of presa) if (r.tipo === "categoria") categoria = r.nome;
    pagine.push([...testa, ...presa]);
    i += n;
  }
  return pagine;
}

/** Pagine a righe fisse (per chi non può misurare, e per i test): ogni pagina al massimo `righePerPagina` righe. */
export function pagineTv(menu: DatiMenu, righePerPagina: number, istante = Date.now()): Riga[][] {
  const max = Math.max(2, Math.floor(righePerPagina));
  return impagina(righeTv(menu, istante), () => max);
}
