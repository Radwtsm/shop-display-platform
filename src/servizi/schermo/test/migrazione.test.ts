import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Archivio } from "../../../piattaforma/server/archivio.ts";
import { componi, dividi, type Config } from "../core/tipi.ts";
import { valida } from "../core/valida.ts";
import { leggiVista, migraConfigUnica } from "../server.ts";

const fixture = (f: string) => JSON.parse(readFileSync(f, "utf8")) as Config;
const tutte = ["fixtures/demo.json", ...readdirSync("fixtures/modelli").map((f) => `fixtures/modelli/${f}`)];

describe("negozio comune + dati dello Schermo", () => {
  it.each(tutte)("%s: diviso e ricomposto è uguale, e il negozio non finisce nello Schermo", (f) => {
    const c = { ...fixture(f), tema: "natale" as const, aspetto: { layout: "lavagna" } };
    const { negozio, schermo } = dividi(c);
    expect(componi(negozio, schermo)).toEqual(c);
    expect(Object.keys(schermo).sort()).toEqual(["aspetto", "secondiPerSlide", "slides", "versione"]);
    expect(Object.keys(negozio).sort()).toEqual(["negozio", "tema", "versione"]);
  });
});

describe("dalla versione prima (un solo config.json) al cliente demo", () => {
  function vecchio() {
    const d = mkdtempSync(join(tmpdir(), "migra-"));
    const c = { ...fixture("fixtures/demo.json"), negozio: { ...fixture("fixtures/demo.json").negozio, logo: "logo.png" } };
    c.slides[0]!.foto = "0123456789abcdef.jpg";
    writeFileSync(join(d, "config.json"), JSON.stringify(c));
    mkdirSync(join(d, "foto"));
    mkdirSync(join(d, "logo"));
    writeFileSync(join(d, "foto", "0123456789abcdef.jpg"), "foto");
    writeFileSync(join(d, "logo", "logo.png"), "logo");
    writeFileSync(join(d, "token"), "tok");
    return { d, c };
  }
  it("tutto passa al cliente, niente si perde, il vecchio file resta come .migrato", () => {
    const { d, c } = vecchio();
    const cliente = new Archivio(d).cliente("demo");
    expect(migraConfigUnica(d, cliente)).toBe(true);
    expect(leggiVista(cliente)).toEqual(c);
    expect(cliente.servizi()).toEqual(["schermo"]);
    expect(readFileSync(join(cliente.foto, "0123456789abcdef.jpg"), "utf8")).toBe("foto");
    expect(readFileSync(join(cliente.logo, "logo.png"), "utf8")).toBe("logo");
    expect(readFileSync(cliente.fileToken, "utf8")).toBe("tok");
    expect(existsSync(join(d, "config.json"))).toBe(false);
    expect(valida(JSON.parse(readFileSync(join(d, "config.json.migrato"), "utf8"))).ok).toBe(true);
    expect(migraConfigUnica(d, cliente)).toBe(false);
  });
  it("config.json rotto: si ferma senza spostare niente", () => {
    const { d } = vecchio();
    writeFileSync(join(d, "config.json"), JSON.stringify({ versione: 1 }));
    expect(() => migraConfigUnica(d, new Archivio(d).cliente("demo"))).toThrow("migrazione fermata");
    expect(readdirSync(d).sort()).toEqual(["config.json", "foto", "logo", "token"]);
  });
});
