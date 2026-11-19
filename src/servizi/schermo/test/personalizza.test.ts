import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELLI, offerta, personalizza, tipoImmagine } from "../personalizza.ts";
import { controllaFoto } from "../../../piattaforma/core/foto.ts";
import { readFileSync as leggiFile } from "node:fs";
import { valida } from "../core/valida.ts";
import { Archivio } from "../../../piattaforma/server/archivio.ts";
import { leggiVista } from "../server.ts";

const cartella = () => mkdtempSync(join(tmpdir(), "pers-"));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const demo = (d: string) => new Archivio(d).cliente("demo");
const config = (d: string) => leggiVista(demo(d))!;

describe("personalizza", () => {
  it("nome, colori, logo e offerte", () => {
    const d = cartella();
    const logo = join(d, "mio logo.PNG");
    writeFileSync(logo, PNG);
    const r = personalizza({
      dataDir: d,
      nome: " Bar Esempio ",
      colori: { primario: "#0b3d2e" },
      logo,
      offerte: ["Cappuccino|1,40", "Brioche | 1,2 | appena sfornate", "Aperitivo"],
    });
    expect(r.ok).toBe(true);
    const c = config(d);
    expect(c.negozio).toMatchObject({ nome: "Bar Esempio", logo: "logo.png" });
    expect(c.negozio.colori.primario).toBe("#0b3d2e");
    expect(c.slides).toEqual([
      { id: "offerta-1", titolo: "Cappuccino", prezzo: 140, attiva: true },
      { id: "offerta-2", titolo: "Brioche", prezzo: 120, nota: "appena sfornate", attiva: true },
      { id: "offerta-3", titolo: "Aperitivo", attiva: true },
    ]);
    expect(readFileSync(join(demo(d).logo, "logo.png"))).toEqual(PNG);
  });
  it("modello panificio: le 5 foto della demo copiate e collegate, ognuna passa il controllo del server", () => {
    const d = cartella();
    expect(personalizza({ dataDir: d, modello: "panificio" }).ok).toBe(true);
    const c = config(d) as { slides: { foto?: string }[] };
    expect(c.slides.map((s) => s.foto)).toEqual(c.slides.map(() => expect.stringMatching(/^[a-f0-9]{16}\.jpg$/)));
    for (const s of c.slides) expect(controllaFoto(readFileSync(join(demo(d).foto, s.foto!)))).toEqual({ ok: true, tipo: "jpg" });
  });
  it("offerte scritte a mano: niente foto pronte", () => {
    const d = cartella();
    expect(personalizza({ dataDir: d, modello: "panificio", offerte: ["Focaccia|2,50"] }).ok).toBe(true);
    expect(config(d).slides[0]!.foto).toBeUndefined();
  });
  it("errori = niente scritto", () => {
    const d = cartella();
    const r = personalizza({ dataDir: d, colori: { testo: "#1f140c" }, offerte: ["Caffè|uno"] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errori).toContain('Offerta 1: prezzo "uno" non valido (es. 2,50)');
      expect(r.errori.some((e) => e.includes("si confondono"))).toBe(true);
    }
    expect(existsSync(join(d, "clienti"))).toBe(false);
  });
  it("un file che si chiama .png ma non è un'immagine viene rifiutato", () => {
    const d = cartella();
    const finto = join(d, "logo.png");
    writeFileSync(finto, "<svg onload=alert(1)>");
    const r = personalizza({ dataDir: d, logo: finto });
    expect(r.ok ? [] : r.errori).toEqual(["Logo: il file non è un'immagine png, jpg o webp"]);
  });
  it("logo mancante", () => {
    const r = personalizza({ dataDir: cartella(), logo: "/non/esiste.png" });
    expect(r.ok).toBe(false);
  });
  it("tipoImmagine riconosce jpg e webp", () => {
    const d = cartella();
    writeFileSync(join(d, "a"), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]));
    writeFileSync(join(d, "b"), Buffer.from("RIFF\0\0\0\0WEBP", "latin1"));
    expect([tipoImmagine(join(d, "a")), tipoImmagine(join(d, "b"))]).toEqual(["jpg", "webp"]);
  });
  it("offerta senza titolo", () => {
    expect(offerta("|2,50", 0)).toMatchObject({ titolo: "" });
  });
});

describe("modelli per settore", () => {
  it.each(MODELLI)("%s è valido (contrasto compreso) e ha 4 offerte", (m) => {
    const c = JSON.parse(leggiFile(`fixtures/modelli/${m}.json`, "utf8"));
    expect(valida(c)).toMatchObject({ ok: true });
    expect(c.slides.length).toBeGreaterThanOrEqual(4);
  });
  it("si parte da un modello e si cambia il nome", () => {
    const d = cartella();
    const r = personalizza({ dataDir: d, modello: "bar", nome: "Bar Stazione" });
    expect(r.ok).toBe(true);
    expect(config(d).negozio.nome).toBe("Bar Stazione");
    expect(config(d).slides[0]!.titolo).toBe("Cappuccino + brioche");
  });
  it.each(["../demo", "/etc/passwd", "ristorante"])("modello %j rifiutato", (m) => {
    const r = personalizza({ dataDir: cartella(), modello: m });
    expect(r.ok ? [] : r.errori[0]).toMatch(/sconosciuto/);
  });
});
