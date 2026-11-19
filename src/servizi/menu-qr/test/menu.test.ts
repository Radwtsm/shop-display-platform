import { describe, expect, it } from "vitest";
import demo from "../demo.json" with { type: "json" };
import { ALLERGENI, ID_ALLERGENI } from "../core/allergeni.ts";
import { perCategoria, senzaAllergeni, senzaCategoria } from "../core/filtri.ts";
import { idDa } from "../core/id.ts";
import { impagina, pagineTv, righeTv, type Riga } from "../core/pagine.ts";
import type { DatiMenu, Piatto } from "../core/tipi.ts";
import { valida } from "../core/valida.ts";
import { finitoOggi } from "../core/finito.ts";
import { dataLocale } from "../../../piattaforma/core/orario.ts";

// 06/11/2026 alle 23:59 a Roma (UTC+1): l'ultimo minuto di un giorno
const ORA = Date.parse("2026-11-06T22:59:00Z");

const base = (): DatiMenu => ({
  versione: 1,
  categorie: [{ id: "primi", nome: "Primi" }],
  piatti: [{ id: "pasta", nome: "Pasta", prezzo: 850, categoria: "primi", allergeni: ["glutine"] }],
});
const errori = (x: unknown) => {
  const e = valida(x);
  return e.ok ? [] : e.errori;
};
const piatto = (id: string, allergeni: Piatto["allergeni"], extra: Partial<Piatto> = {}): Piatto => ({
  id, nome: id, prezzo: 100, categoria: "primi", allergeni, ...extra,
});

describe("i 14 allergeni (Reg. UE 1169/2011, Allegato II)", () => {
  it("sono 14, con i nomi ufficiali in italiano", () => {
    expect(ALLERGENI.map((a) => a.nome)).toEqual([
      "Cereali contenenti glutine", "Crostacei", "Uova", "Pesce", "Arachidi", "Soia", "Latte", "Frutta a guscio",
      "Sedano", "Senape", "Semi di sesamo", "Anidride solforosa e solfiti", "Lupini", "Molluschi",
    ]);
    expect(ID_ALLERGENI).toHaveLength(14);
    expect(new Set(ALLERGENI.map((a) => a.id)).size).toBe(14);
  });
  it("ognuno ha un'icona e un'etichetta breve: mai solo icona", () => {
    for (const a of ALLERGENI) {
      expect(a.icona.length, a.id).toBeGreaterThan(10);
      expect(a.breve.length, a.id).toBeGreaterThan(2);
    }
  });
});

describe("valida", () => {
  it("accetta un menu corretto e la demo", () => {
    expect(errori(base())).toEqual([]);
    expect(errori(demo)).toEqual([]);
  });
  it("rifiuta prezzo non intero, negativo o enorme", () => {
    for (const prezzo of [8.5, -1, 1e12, "8", NaN]) {
      const m = base();
      (m.piatti[0] as unknown as { prezzo: unknown }).prezzo = prezzo;
      expect(errori(m).join(), String(prezzo)).toContain("prezzo");
    }
  });
  it("rifiuta allergeni sconosciuti o ripetuti; null è ammesso (non indicati)", () => {
    const m = base();
    (m.piatti[0] as unknown as { allergeni: unknown }).allergeni = ["glutine", "cipolla"];
    expect(errori(m).join()).toContain("allergeni");
    m.piatti[0]!.allergeni = ["latte", "latte"];
    expect(errori(m).join()).toContain("allergeni");
    m.piatti[0]!.allergeni = null;
    expect(errori(m)).toEqual([]);
  });
  it("gli allergeni mancanti non valgono come 'nessuno'", () => {
    const m = base();
    delete (m.piatti[0] as unknown as { allergeni?: unknown }).allergeni;
    expect(errori(m).join()).toContain("allergeni");
  });
  it("rifiuta categoria inesistente, id ripetuti o con caratteri strani, nomi vuoti", () => {
    let m = base();
    m.piatti[0]!.categoria = "boh";
    expect(errori(m).join()).toContain("categoria");
    m = base();
    m.piatti.push({ ...m.piatti[0]! });
    expect(errori(m).join()).toContain("id ripetuto");
    m = base();
    m.piatti[0]!.id = "Pasta<script>";
    expect(errori(m).join()).toContain("id non valido");
    m = base();
    m.piatti[0]!.nome = "   ";
    expect(errori(m).join()).toContain("nome");
  });
  it("rifiuta ciò che non è un menu", () => {
    for (const x of [null, [], "x", { versione: 2, categorie: [], piatti: [] }, { versione: 1 }]) expect(errori(x).length).toBeGreaterThan(0);
  });
});

describe("filtro 'senza'", () => {
  const piatti = [piatto("a", ["glutine", "latte"]), piatto("b", ["uova"]), piatto("c", []), piatto("d", null)];
  const ids = (p: Piatto[]) => p.map((x) => x.id);
  it("senza filtri mostra tutto, anche gli allergeni non indicati", () => {
    expect(ids(senzaAllergeni(piatti, new Set()))).toEqual(["a", "b", "c", "d"]);
  });
  it("toglie i piatti che contengono uno qualsiasi degli allergeni scelti", () => {
    expect(ids(senzaAllergeni(piatti, new Set(["glutine"] as const)))).toEqual(["b", "c"]);
    expect(ids(senzaAllergeni(piatti, new Set(["glutine", "uova"] as const)))).toEqual(["c"]);
  });
  it("un piatto con allergeni NON indicati non è mai 'senza' niente", () => {
    expect(ids(senzaAllergeni(piatti, new Set(["pesce"] as const)))).toEqual(["a", "b", "c"]);
  });
  it("categorie nell'ordine del menu, vuote escluse; eliminare una categoria porta via i suoi piatti", () => {
    const cat = [{ id: "primi", nome: "P" }, { id: "dolci", nome: "D" }, { id: "vuota", nome: "V" }];
    const tutti = [piatto("a", []), piatto("b", [], { categoria: "dolci" })];
    expect(perCategoria(cat, tutti).map((g) => g.categoria.id)).toEqual(["primi", "dolci"]);
    const m = senzaCategoria({ categorie: cat, piatti: tutti }, "dolci");
    expect(m.categorie.map((c) => c.id)).toEqual(["primi", "vuota"]);
    expect(m.piatti.map((p) => p.id)).toEqual(["a"]);
  });
});

const menu = (n: number, extra: Partial<Piatto> = {}): DatiMenu => ({
  versione: 1,
  categorie: [{ id: "primi", nome: "Primi" }, { id: "dolci", nome: "Dolci" }],
  piatti: Array.from({ length: n }, (_, i) => piatto(`p${i}`, [], extra)),
});
describe("Menu del giorno sulla TV (pagine)", () => {
  it("solo i piatti disponibili", () => {
    const m = menu(3);
    m.piatti[1]!.finitoIl = "2026-11-06";
    const righe = pagineTv(m, 9, ORA).flat();
    expect(righe.filter((r) => r.tipo === "piatto")).toHaveLength(2);
  });
  it("mai più righe del massimo, mai un titolo di categoria solo in fondo; il titolo si ripete se la categoria continua", () => {
    const pagine = pagineTv(menu(11), 4, ORA);
    for (const p of pagine) {
      expect(p.length).toBeLessThanOrEqual(4);
      expect(p[0]!.tipo).toBe("categoria");
      expect(p.at(-1)!.tipo).toBe("piatto");
    }
    expect(pagine.flat().filter((r) => r.tipo === "piatto")).toHaveLength(11);
  });
  it("menu vuoto o tutto finito: nessuna pagina", () => {
    expect(pagineTv(menu(0), 9, ORA)).toEqual([]);
    expect(pagineTv(menu(3, { finitoIl: "2026-11-06" }), 9, ORA)).toEqual([]);
  });
  it("finito ieri: dopo la mezzanotte di Roma torna sulla TV da solo", () => {
    expect(pagineTv(menu(3, { finitoIl: "2026-11-06" }), 9, ORA + 60_000).flat().filter((r) => r.tipo === "piatto")).toHaveLength(3);
  });
});

describe("'finito oggi' vale solo oggi (A19)", () => {
  it("la data è quella di Roma, anche a cavallo della mezzanotte e con l'ora legale", () => {
    expect(dataLocale(ORA)).toBe("2026-11-06");
    expect(dataLocale(ORA + 60_000)).toBe("2026-11-07");
    expect(dataLocale(Date.parse("2026-07-01T22:30:00Z"))).toBe("2026-07-02"); // 00:30 ora legale
  });
  it("segnato oggi = finito; segnato ieri o mai = disponibile", () => {
    expect(finitoOggi(piatto("a", [], { finitoIl: "2026-11-06" }), ORA)).toBe(true);
    expect(finitoOggi(piatto("a", [], { finitoIl: "2026-11-06" }), ORA + 60_000)).toBe(false);
    expect(finitoOggi(piatto("a", []), ORA)).toBe(false);
  });
  it("valida: finitoIl solo come data AAAA-MM-GG; il vecchio campo disponibile non blocca il menu", () => {
    const m = base();
    (m.piatti[0] as unknown as { finitoIl: unknown }).finitoIl = "ieri";
    expect(errori(m).join()).toContain("finito");
    const vecchio = base();
    (vecchio.piatti[0] as unknown as { disponibile: unknown }).disponibile = false;
    expect(errori(vecchio)).toEqual([]);
  });
});

describe("idDa", () => {
  it("id validi da nomi con accenti e simboli, mai ripetuti", () => {
    expect(idDa("Crème brûlée!", new Set())).toBe("creme-brulee");
    expect(idDa("Pasta", new Set(["pasta"]))).toBe("pasta-2");
    expect(idDa("???", new Set())).toBe("voce");
    const lungo = idDa("a".repeat(100), new Set());
    expect(/^[a-z0-9-]{1,40}$/.test(lungo)).toBe(true);
  });
});

describe("impaginazione misurata della TV (A136(8))", () => {
  const righe = (n: number) => righeTv(menu(n), ORA);
  it("alla pari: 7 piatti in pagine da 6 righe → 4 + 3 piatti, mai 5 + 2", () => {
    const pagine = impagina(righe(7), () => 6);
    const piatti = pagine.map((p) => p.filter((r) => r.tipo === "piatto").length);
    expect(piatti).toHaveLength(2);
    expect(Math.max(...piatti) - Math.min(...piatti), String(piatti)).toBeLessThanOrEqual(1);
  });
  it("la categoria che continua riparte col titolo e 'segue'; nessun titolo solo in fondo", () => {
    const pagine = impagina(righe(7), () => 6);
    expect(pagine[1]![0]).toMatchObject({ tipo: "categoria", segue: true });
    expect(pagine[0]![0]).not.toHaveProperty("segue");
    for (const p of pagine) expect(p.at(-1)!.tipo).toBe("piatto");
  });
  it("anche se in pagina non sta niente, almeno un piatto per pagina (mai un giro infinito)", () => {
    const pagine = impagina(righe(3), () => 0);
    expect(pagine.flat().filter((r) => r.tipo === "piatto")).toHaveLength(3);
  });
  it("la misura decide: quanteStanno riceve la pagina candidata col titolo ripetuto davanti", () => {
    const viste: Riga[][] = [];
    impagina(righe(5), (r) => (viste.push(r), 4));
    expect(viste.slice(1).every((v) => v[0]!.tipo === "categoria")).toBe(true);
  });
});
