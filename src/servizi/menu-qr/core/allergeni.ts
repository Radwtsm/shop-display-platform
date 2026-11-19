// I 14 allergeni da indicare (Reg. UE 1169/2011, Allegato II), con il nome ufficiale in italiano.
// L'icona è un tracciato SVG nostro su griglia 24×24 (linee, nessun riempimento): si mostra sempre con il testo.

export const ID_ALLERGENI = [
  "glutine", "crostacei", "uova", "pesce", "arachidi", "soia", "latte",
  "frutta-a-guscio", "sedano", "senape", "sesamo", "solfiti", "lupini", "molluschi",
] as const;
export type IdAllergene = (typeof ID_ALLERGENI)[number];

export interface Allergene {
  id: IdAllergene;
  /** Nome ufficiale (voce dell'Allegato II). */
  nome: string;
  /** Voce intera dell'Allegato II, con gli esempi. */
  ufficiale: string;
  /** Una o due parole, per le etichette strette. */
  breve: string;
  /** Tracciato SVG (griglia 24×24). */
  icona: string;
}

export const ALLERGENI: readonly Allergene[] = [
  { id: "glutine", nome: "Cereali contenenti glutine", breve: "Glutine",
    ufficiale: "Cereali contenenti glutine, cioè grano, segale, orzo, avena, farro, kamut o i loro ceppi ibridati, e prodotti derivati",
    icona: "M12 21V5M12 9c-3 0-4-2-4-4 3 0 4 2 4 4zM12 9c3 0 4-2 4-4-3 0-4 2-4 4zM12 14c-3 0-4-2-4-4 3 0 4 2 4 4zM12 14c3 0 4-2 4-4-3 0-4 2-4 4zM12 19c-3 0-4-2-4-4 3 0 4 2 4 4zM12 19c3 0 4-2 4-4-3 0-4 2-4 4z" },
  { id: "crostacei", nome: "Crostacei", breve: "Crostacei",
    ufficiale: "Crostacei e prodotti a base di crostacei",
    icona: "M5 9c3-4 10-4 13 1 1 4-1 8-5 8M13 18l-2 3M13 18l3 2M5 9l-2 1M9 9l1 4M13 8l1 3" },
  { id: "uova", nome: "Uova", breve: "Uova",
    ufficiale: "Uova e prodotti a base di uova",
    icona: "M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z" },
  { id: "pesce", nome: "Pesce", breve: "Pesce",
    ufficiale: "Pesce e prodotti a base di pesce",
    icona: "M3 12c3-5 9-6 13-2l5-3v10l-5-3c-4 4-10 3-13-2zM8 11h.01" },
  { id: "arachidi", nome: "Arachidi", breve: "Arachidi",
    ufficiale: "Arachidi e prodotti a base di arachidi",
    icona: "M10 3c-3 0-4 3-3 5s1 3 0 5-1 5 2 7c3 2 6 0 6-3s-1-3 0-5 2-5-1-7c-2-2-3-2-4-2zM10 8h2M10 15h2" },
  { id: "soia", nome: "Soia", breve: "Soia",
    ufficiale: "Soia e prodotti a base di soia",
    icona: "M5 15c0-6 5-10 14-10 0 9-4 14-10 14-2 0-4-1-4-4zM5 19l6-6" },
  { id: "latte", nome: "Latte", breve: "Latte",
    ufficiale: "Latte e prodotti a base di latte (incluso il lattosio)",
    icona: "M9 3h6v3l2 3v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9l2-3zM7 12h10" },
  { id: "frutta-a-guscio", nome: "Frutta a guscio", breve: "Frutta a guscio",
    ufficiale: "Frutta a guscio, cioè mandorle, nocciole, noci, noci di acagiù, noci pecan, noci del Brasile, pistacchi, noci macadamia o noci del Queensland, e prodotti derivati",
    icona: "M12 3c4 2 7 5 7 10a7 7 0 0 1-14 0c0-5 3-8 7-10zM12 3v18M8 9l4 3 4-3" },
  { id: "sedano", nome: "Sedano", breve: "Sedano",
    ufficiale: "Sedano e prodotti a base di sedano",
    icona: "M12 21V9M12 9C9 9 7 7 7 3M12 9c3 0 5-2 5-6M12 14c-3 0-5-2-5-5M12 14c3 0 5-2 5-5" },
  { id: "senape", nome: "Senape", breve: "Senape",
    ufficiale: "Senape e prodotti a base di senape",
    icona: "M8 5h8v3H8zM7 8h10v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM7 13h10" },
  { id: "sesamo", nome: "Semi di sesamo", breve: "Sesamo",
    ufficiale: "Semi di sesamo e prodotti a base di semi di sesamo",
    icona: "M6 7c1-2 3-2 4 0-1 2-3 2-4 0zM14 9c1-2 3-2 4 0-1 2-3 2-4 0zM6 16c1-2 3-2 4 0-1 2-3 2-4 0zM14 18c1-2 3-2 4 0-1 2-3 2-4 0z" },
  { id: "solfiti", nome: "Anidride solforosa e solfiti", breve: "Solfiti",
    ufficiale: "Anidride solforosa e solfiti in concentrazioni superiori a 10 mg/kg o 10 mg/litro espressi come SO2",
    icona: "M7 3h10v6a5 5 0 0 1-10 0zM12 14v7M8 21h8" },
  { id: "lupini", nome: "Lupini", breve: "Lupini",
    ufficiale: "Lupini e prodotti a base di lupini",
    icona: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM8 12h8" },
  { id: "molluschi", nome: "Molluschi", breve: "Molluschi",
    ufficiale: "Molluschi e prodotti a base di molluschi",
    icona: "M3 17c0-8 4-13 9-13s9 5 9 13zM12 4v13M7.5 6.5L9 17M16.5 6.5L15 17" },
];

const PER_ID = new Map(ALLERGENI.map((a) => [a.id, a]));
export const allergene = (id: IdAllergene): Allergene => PER_ID.get(id)!;
export const eAllergene = (x: unknown): x is IdAllergene => typeof x === "string" && PER_ID.has(x as IdAllergene);
