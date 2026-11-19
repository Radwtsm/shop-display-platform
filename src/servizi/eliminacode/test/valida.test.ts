import { describe, expect, it } from "vitest";
import { NUMERO_MAX, descrivi, type DatiEliminacode } from "../core/tipi.ts";
import { applica, nomiBanchi, ritmo, valida, validaAzione } from "../core/valida.ts";

const base: DatiEliminacode = { versione: 1, banchi: ["Banco 1", "Banco 2"], numero: 41, banco: 0 };

describe("valida", () => {
  it("accetta dati buoni e toglie gli spazi dai nomi", () => {
    const e = valida({ ...base, banchi: ["  Cassa  "] });
    expect(e).toEqual({ ok: true, dati: { ...base, banchi: ["Cassa"] } });
  });
  it.each([
    ["non è un oggetto", null],
    ["versione", { ...base, versione: 2 }],
    ["nessun banco", { ...base, banchi: [] }],
    ["troppi banchi", { ...base, banchi: ["a", "b", "c", "d", "e"] }],
    ["nome vuoto", { ...base, banchi: [" "] }],
    ["nome lungo", { ...base, banchi: ["x".repeat(21)] }],
    ["nomi uguali", { ...base, banchi: ["Cassa", "cassa"] }],
    ["numero negativo", { ...base, numero: -1 }],
    ["numero oltre il massimo", { ...base, numero: NUMERO_MAX + 1 }],
    ["numero con la virgola", { ...base, numero: 1.5 }],
    ["numero testo", { ...base, numero: "7" }],
    ["banco fuori elenco", { ...base, banco: 2 }],
  ])("rifiuta: %s", (_, x) => expect(valida(x).ok).toBe(false));
});

describe("applica", () => {
  it("prossimo: sale di uno e ricorda il banco che ha chiamato", () => {
    expect(applica(base, "prossimo", 1)).toMatchObject({ numero: 42, banco: 1 });
  });
  it("dopo il massimo si riparte da 1", () => {
    expect(applica({ ...base, numero: NUMERO_MAX }, "prossimo")!.numero).toBe(1);
  });
  it("indietro: scende di uno ma non sotto zero, il banco non cambia", () => {
    expect(applica({ ...base, banco: 1 }, "indietro")).toMatchObject({ numero: 40, banco: 1 });
    expect(applica({ ...base, numero: 0 }, "indietro")!.numero).toBe(0);
  });
  it("azzera: zero e primo banco", () => {
    expect(applica({ ...base, banco: 1 }, "azzera")).toMatchObject({ numero: 0, banco: 0 });
  });
  it("un banco che non c'è non si chiama", () => {
    expect(applica({ ...base, banchi: ["Cassa"] }, "prossimo", 1)).toBeNull();
  });
});

describe("validaAzione e testi", () => {
  it("accetta solo le tre azioni", () => {
    expect(validaAzione({ azione: "prossimo", banco: 1 })).toEqual({ ok: true, azione: "prossimo", banco: 1 });
    expect(validaAzione({ azione: "cancella" }).ok).toBe(false);
    expect(validaAzione({ azione: "prossimo", banco: 9 }).ok).toBe(false);
    expect(validaAzione("prossimo").ok).toBe(false);
  });
  it("descrive a voce, con il banco solo se ce n'è più di uno", () => {
    expect(descrivi(base)).toBe("Tocca al numero 41, Banco 1");
    expect(descrivi({ ...base, banchi: ["Cassa"] })).toBe("Tocca al numero 41");
    expect(descrivi({ ...base, numero: 0 })).toBe("Nessun numero chiamato");
    expect(nomiBanchi(2)).toEqual(["Banco 1", "Banco 2"]);
  });
});

describe("coda viva (A138)", () => {
  const ore10 = Date.parse("2026-11-12T10:00:00+01:00");
  const min = 60_000;
  it("prossimo: il numero di prima va nello storico (ultimi 3), conta i serviti di oggi e ricorda quando", () => {
    let d: DatiEliminacode = base;
    for (let i = 0; i < 4; i++) d = applica(d, "prossimo", 0, ore10 + i * min)!;
    expect(d).toMatchObject({ numero: 45, storico: [44, 43, 42], oggi: { giorno: "2026-11-12", serviti: 4 } });
    expect(d.chiamate).toEqual([0, 1, 2, 3].map((i) => ore10 + i * min));
    for (let i = 4; i < 9; i++) d = applica(d, "prossimo", 0, ore10 + i * min)!;
    expect(d.chiamate).toHaveLength(5);
  });
  it("il giorno dopo i serviti ripartono da 1", () => {
    const ieri = applica(base, "prossimo", 0, ore10 - 24 * 60 * min)!;
    expect(applica(ieri, "prossimo", 0, ore10)!.oggi).toEqual({ giorno: "2026-11-12", serviti: 1 });
  });
  it("indietro annulla l'ultima chiamata: storico, ritmo e serviti tornano com'erano", () => {
    const prima = applica(applica(base, "prossimo", 0, ore10)!, "prossimo", 0, ore10 + min)!;
    const dopo = applica(applica(prima, "prossimo", 0, ore10 + 2 * min)!, "indietro")!;
    expect(dopo).toEqual(prima);
  });
  it("azzera: niente storico né ritmo, i serviti di oggi restano", () => {
    const d = applica(applica(base, "prossimo", 0, ore10)!, "azzera")!;
    expect(d).toMatchObject({ numero: 0, storico: [], chiamate: [], oggi: { serviti: 1 } });
  });
  it("ritmo: media tra le ultime chiamate, solo se recenti (30 min) e almeno 3", () => {
    let d: DatiEliminacode = base;
    for (const t of [0, 2, 3, 5]) d = applica(d, "prossimo", 0, ore10 + t * min)!;
    expect(ritmo(d, ore10 + 6 * min)).toEqual({ minuti: 5 / 3, serviti: 4 });
    expect(ritmo(d, ore10 + 60 * min)).toEqual({ minuti: null, serviti: 4 });
    expect(ritmo(d, ore10 + 24 * 60 * min)).toEqual({ minuti: null, serviti: 0 });
    expect(ritmo(applica(base, "prossimo", 0, ore10)!, ore10)).toEqual({ minuti: null, serviti: 1 });
  });
  it("valida accetta i dati vecchi senza storico e rifiuta storico e chiamate sbagliati", () => {
    expect(valida(base)).toEqual({ ok: true, dati: base });
    expect(valida({ ...base, storico: [1, 2, 3, 4] }).ok).toBe(false);
    expect(valida({ ...base, storico: [0] }).ok).toBe(false);
    expect(valida({ ...base, chiamate: [1, 2, 3, 4, 5, 6] }).ok).toBe(false);
    expect(valida({ ...base, chiamate: [-1] }).ok).toBe(false);
    expect(valida({ ...base, oggi: { giorno: "ieri", serviti: 1 } }).ok).toBe(false);
    expect(valida({ ...base, oggi: { giorno: "2026-11-12", serviti: -1 } }).ok).toBe(false);
  });
});
