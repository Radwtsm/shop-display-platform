import { describe, expect, it } from "vitest";
import { linkInstagram, linkMappe, linkRecensione, testoWifi, vociQr } from "../core/qr.ts";
import type { DatiVetrina } from "../core/tipi.ts";
import { BASE } from "../fixtures/esempio.ts";
import { INSTAGRAM, linkMenuValido, pulisciInstagram, valida, validaRisposta } from "../core/valida.ts";

const copia = () => structuredClone(BASE) as any;

describe("valida", () => {
  it("l'esempio è valido", () => expect(valida(BASE)).toEqual([]));
  it("i campi facoltativi possono mancare", () => {
    const d = { versione: 1, orari: [], contatti: {}, linkMenu: "/menu.html", secondiPerSlide: 8 };
    expect(valida(d)).toEqual([]);
  });
  it.each([null, [], "x", { versione: 2 }])("rifiuta %j", (x) => expect(valida(x)).not.toEqual([]));
  it("storia vuota, anno e foto sbagliati", () => {
    const d = copia();
    d.storia = { testo: "  ", anno: 1066, foto: "../x.png" };
    expect(valida(d)).toHaveLength(3);
  });
  it("Place ID con caratteri strani (iniezione nel link)", () => {
    const d = copia();
    d.placeId = "abc&evil=1 ./";
    expect(valida(d)).toEqual(["Place ID: lettere e numeri, da 10 a 200 caratteri"]);
  });
  it("Wi-Fi: rete vuota e password corta; password assente = rete aperta", () => {
    const d = copia();
    d.wifi = { ssid: "", password: "x" };
    expect(valida(d)).toHaveLength(1);
    d.wifi = { ssid: "Aperta" };
    expect(valida(d)).toEqual([]);
    d.wifi = { ssid: "R", password: "corta" };
    expect(valida(d)[0]).toMatch(/Password Wi-Fi/);
  });
  it("Instagram: solo il nome utente", () => {
    expect(INSTAGRAM.test("panificio.demo")).toBe(true);
    for (const x of ["@a", "a b", "https://instagram.com/a", "a/b", ""]) expect(INSTAGRAM.test(x)).toBe(false);
    expect(pulisciInstagram(" @panificio.demo ")).toBe("panificio.demo");
    expect(pulisciInstagram("https://www.instagram.com/panificio.demo/?hl=it")).toBe("panificio.demo");
  });
  it("orari: giorno 8, ora 25:00, apertura = chiusura, più di 10 righe", () => {
    const d = copia();
    d.orari = [{ giorni: [8], da: "07:00", a: "19:00" }, { giorni: [1], da: "25:00", a: "19:00" }, { giorni: [1], da: "08:00", a: "08:00" }];
    expect(valida(d)).toHaveLength(3);
    d.orari = Array(11).fill({ giorni: [1], da: "07:00", a: "08:00" });
    expect(valida(d)).toEqual(["Orari: al massimo 10 righe"]);
  });
  it("contatti: telefono ed email sbagliati", () => {
    const d = copia();
    d.contatti = { telefono: "chiama!", email: "senza chiocciola" };
    expect(valida(d)).toHaveLength(2);
  });
  it("link del menu: pagina del sito o https, mai javascript: né //host", () => {
    for (const ok of ["/menu.html", "/m/carta", "https://menu.esempio.it/carta"]) expect(linkMenuValido(ok)).toBe(true);
    for (const no of ["javascript:alert(1)", "//evil.example/x", "http://esempio.it", "menu.html", "/a b", 5]) expect(linkMenuValido(no)).toBe(false);
  });
  it("secondi per schermata da 3 a 120", () => {
    const d = copia();
    d.secondiPerSlide = 2;
    expect(valida(d)).toHaveLength(1);
  });
});

describe("QR", () => {
  it("Wi-Fi: formato standard", () => {
    expect(testoWifi({ ssid: "Panificio Ospiti", password: "pane-caldo-24" })).toBe("WIFI:T:WPA;S:Panificio Ospiti;P:pane-caldo-24;;");
  });
  it("Wi-Fi: caratteri speciali con la barra", () => {
    expect(testoWifi({ ssid: 'a;b,c:d"e\\f', password: "p;q" })).toBe(String.raw`WIFI:T:WPA;S:a\;b\,c\:d\"e\\f;P:p\;q;;`);
  });
  it("Wi-Fi aperta", () => expect(testoWifi({ ssid: "Aperta" })).toBe("WIFI:T:nopass;S:Aperta;;"));
  it("link di recensione dal Place ID, Instagram dal nome", () => {
    expect(linkRecensione("ChIJ123")).toBe("https://search.google.com/local/writereview?placeid=ChIJ123");
    expect(linkInstagram("panificio.demo")).toBe("https://www.instagram.com/panificio.demo/");
  });
  it("voci: solo quelle configurate; il Wi-Fi solo se richiesto", () => {
    expect(vociQr(BASE, true).map((v) => v.id)).toEqual(["recensione", "wifi", "instagram"]);
    expect(vociQr(BASE, false).map((v) => v.id)).toEqual(["recensione", "instagram"]);
    expect(vociQr({ ...BASE, placeId: undefined, instagram: undefined } as DatiVetrina, true).map((v) => v.id)).toEqual(["wifi"]);
  });
  it("mappe: solo link https; niente indirizzo = niente mappa", () => {
    const m = linkMappe(BASE.contatti, BASE.placeId, "Panificio Demo")!;
    expect(m.google).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Panificio%20Demo%2C%20Via/);
    expect(m.osm).toMatch(/^https:\/\/www\.openstreetmap\.org\/search\?query=Via/);
    expect(linkMappe({})).toBeUndefined();
  });
});

describe("validaRisposta (TV e sito non si fidano del server)", () => {
  const ok = { orari: BASE.orari, contatti: BASE.contatti, linkMenu: "/menu.html", qr: [], recensioni: { fonte: "finte", elenco: [] }, secondiPerSlide: 10 };
  it("accetta una risposta giusta", () => expect(validaRisposta(ok).ok).toBe(true));
  it("rifiuta link di menu e mappe pericolosi, voti fuori scala", () => {
    expect(validaRisposta({ ...ok, linkMenu: "javascript:1" }).ok).toBe(false);
    expect(validaRisposta({ ...ok, mappe: { google: "javascript:1", osm: "https://a.it/x" } }).ok).toBe(false);
    expect(validaRisposta({ ...ok, recensioni: { fonte: "google", elenco: [{ autore: "A", voto: 7, testo: "", quando: "" }] } }).ok).toBe(false);
    expect(validaRisposta(null).ok).toBe(false);
  });
});
