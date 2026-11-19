import { describe, expect, it } from "vitest";
import { controllaFoto, FOTO_MAX_BYTE, infoFoto, tipoFoto } from "../../src/piattaforma/core/foto.ts";
import { jpgTestata, pngFinto, webpTestata } from "../foto-finte.ts";

describe("tipo dai primi byte", () => {
  it.each([
    ["png", pngFinto(4, 4)],
    ["jpg", jpgTestata(10, 10)],
    ["webp", webpTestata(10, 10)],
  ] as const)("%s", (tipo, b) => expect(tipoFoto(b)).toBe(tipo));
  it("un SVG o un testo chiamato .jpg non è una foto", () => {
    expect(tipoFoto(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(controllaFoto(Buffer.from("<svg onload=alert(1)>"))).toEqual({ ok: false, errore: expect.stringContaining("non è una foto") });
  });
});

describe("misure e metadati", () => {
  it("misure lette dalla testata", () => {
    expect(infoFoto(pngFinto(800, 600), "png")).toEqual({ larghezza: 800, altezza: 600, metadati: false });
    expect(infoFoto(jpgTestata(1600, 1200), "jpg")).toEqual({ larghezza: 1600, altezza: 1200, metadati: false });
    expect(infoFoto(webpTestata(1600, 900), "webp")).toEqual({ larghezza: 1600, altezza: 900, metadati: false });
  });
  it.each([
    ["png", pngFinto(8, 8, [1, 2, 3], true)],
    ["jpg prima delle misure", jpgTestata(10, 10, "prima")],
    ["jpg dopo le misure", jpgTestata(10, 10, "dopo")],
    ["webp", webpTestata(10, 10, true)],
  ])("EXIF trovato: %s", (_, b) => {
    expect(controllaFoto(b)).toEqual({ ok: false, errore: expect.stringContaining("dati del telefono") });
  });
});

describe("controllaFoto", () => {
  it("una foto giusta passa", () => expect(controllaFoto(pngFinto(800, 600))).toEqual({ ok: true, tipo: "png" }));
  it("troppo grande da disegnare (anche se il file è piccolo)", () => {
    expect(controllaFoto(jpgTestata(20000, 20000))).toEqual({ ok: false, errore: expect.stringContaining("troppo grande") });
  });
  it("troppo pesante", () => {
    const b = Buffer.concat([pngFinto(4, 4), Buffer.alloc(FOTO_MAX_BYTE)]);
    expect(controllaFoto(b)).toEqual({ ok: false, errore: expect.stringContaining("troppo pesante") });
  });
  it("testata rotta", () => {
    expect(controllaFoto(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toEqual({ ok: false, errore: expect.stringContaining("rovinata") });
  });
});
