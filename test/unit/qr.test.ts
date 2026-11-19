import { describe, expect, it } from "vitest";
import { origineQr, percorsoQr, urlQrValido } from "../../src/piattaforma/core/qr.ts";
import { valida } from "../../src/servizi/schermo/core/valida.ts";
import demo from "../../fixtures/demo.json" with { type: "json" };

describe("urlQrValido", () => {
  it.each(["https://g.page/r/abc/review", "https://www.esempio.it/menu?x=1", "https://esempio.it"])("ok %s", (u) => expect(urlQrValido(u)).toBe(true));
  it.each(["http://esempio.it", "javascript:alert(1)", "https://localhost/x", "https://a b.it", "esempio.it", "https://user:pw@esempio.it", "", 5, "https://" + "a".repeat(300) + ".it"])(
    "rifiuta %j",
    (u) => expect(urlQrValido(u)).toBe(false),
  );
});

describe("percorsoQr", () => {
  it("deterministico, quadrato, con i tre angoli di riferimento", () => {
    const a = percorsoQr("https://esempio.it");
    expect(percorsoQr("https://esempio.it")).toEqual(a);
    expect(a.lato).toBeGreaterThanOrEqual(21);
    for (const [c, r] of [[0, 0], [a.lato - 7, 0], [0, a.lato - 7]]) expect(a.d).toContain(`M${c} ${r}h1v1h-1z`);
  });
  it("link più lunghi = QR più grande", () => {
    expect(percorsoQr("https://esempio.it/" + "x".repeat(150)).lato).toBeGreaterThan(percorsoQr("https://esempio.it").lato);
  });
});

describe("valida qr", () => {
  const con = (qr: unknown) => {
    const c = structuredClone(demo) as any;
    c.negozio.qr = qr;
    const e = valida(c);
    return e.ok ? [] : e.errori;
  };
  it("valido", () => expect(con({ url: "https://g.page/r/abc", testo: "Lasciaci una recensione" })).toEqual([]));
  it("url non https", () => expect(con({ url: "http://x.it", testo: "x" })).toEqual(["QR: serve un indirizzo completo che inizia con https://"]));
  it("scritta vuota o lunga", () => {
    expect(con({ url: "https://x.it", testo: " " })).toEqual(["QR: scritta da 1 a 40 caratteri"]);
    expect(con({ url: "https://x.it", testo: "x".repeat(41) })).toEqual(["QR: scritta da 1 a 40 caratteri"]);
  });
});

describe("origineQr (QR predefinito: deve aprirsi dal telefono)", () => {
  it("usa l'indirizzo dato dal server", () => expect(origineQr("http://192.168.1.50:8080", "http://localhost:8080")).toBe("http://192.168.1.50:8080"));
  it.each(["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080", "http://127.5.0.1"])("niente QR se la TV ha aperto %s (sul telefono è il telefono)", (o) =>
    expect(origineQr(undefined, o)).toBeNull());
  it("altrimenti l'indirizzo della TV", () => expect(origineQr(undefined, "http://192.168.1.50:8080")).toBe("http://192.168.1.50:8080"));
});
