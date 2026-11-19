// Eliminacode sulla TV e nel pannello, nel server con Schermo + Eliminacode attivi (secondo webServer di
// playwright.config.ts). Tempi veri: la TV scarica ogni 1,5 s.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { PORTA_DUE, TOKEN } from "../../../../playwright.config.ts";

const BASE = `http://127.0.0.1:${PORTA_DUE}`;
const TV = { width: 1920, height: 1080 };
const IPHONE = { viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
test.use({ baseURL: BASE });

const intestazioni = { "X-Token": TOKEN };
const azione = (request: APIRequestContext, a: string, banco = 0) =>
  request.post("/api/eliminacode/azione", { data: { azione: a, banco }, headers: intestazioni });
async function negozioCon(request: APIRequestContext, disposizione: "intero" | "affiancato") {
  const { servizi: _, ...n } = await (await request.get("/api/negozio")).json();
  const r = await request.put("/api/negozio", { data: { ...n, disposizione }, headers: intestazioni });
  expect(r.ok()).toBe(true);
}
async function banchi(request: APIRequestContext, quanti: 1 | 2) {
  const nomi = quanti === 1 ? ["Banco 1"] : ["Banco 1", "Banco 2"];
  expect((await request.put("/api/eliminacode/banchi", { data: { banchi: nomi }, headers: intestazioni })).ok()).toBe(true);
}
test.beforeEach(async ({ request }) => {
  await banchi(request, 1);
  await azione(request, "azzera");
  await negozioCon(request, "intero");
});

/** Audio finto: conta i suoni; `consentito` = false imita la TV che blocca l'autoplay (resta "suspended"). */
async function audioFinto(page: Page, consentito: boolean) {
  await page.addInitScript((consentito) => {
    const w = window as unknown as { __suoni: number; __errori: string[] };
    w.__suoni = 0;
    w.__errori = [];
    addEventListener("error", (e) => w.__errori.push(String(e.message)));
    addEventListener("unhandledrejection", (e) => w.__errori.push(String(e.reason)));
    class Finto {
      state = consentito ? "running" : "suspended";
      currentTime = 0;
      destination = {};
      resume() { return consentito ? Promise.resolve() : new Promise(() => undefined); } // come Chrome senza un tocco
      createOscillator() { return { frequency: {}, connect: (x: unknown) => x, start: () => w.__suoni++, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }; }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = Finto;
  }, consentito);
}
const suoni = (page: Page) => page.evaluate(() => (window as unknown as { __suoni: number }).__suoni);

test.describe("TV", () => {
  test.use({ viewport: TV });

  test("mostra il numero enorme e lo aggiorna da solo entro 2 secondi", async ({ page, request }) => {
    await negozioCon(request, "affiancato");
    await page.goto("/player.html");
    const zona = page.locator('.zona[data-servizio="eliminacode"]');
    await expect(zona.locator(".eq-numero")).toHaveText("—");
    await azione(request, "prossimo");
    await azione(request, "prossimo");
    await expect(zona.locator(".eq-numero")).toHaveText("2", { timeout: 2500 });
    await expect(zona.getByRole("status")).toHaveAccessibleName("Tocca al numero 2");
    // leggibile a 5 m: il numero occupa almeno il 20% dell'altezza dello schermo
    const b = await zona.locator(".eq-numero").boundingBox();
    expect(b!.height).toBeGreaterThan(TV.height * 0.2);
  });

  test("coda viva (A138): il numero arriva spinto dal server, Prima e serviti di oggi nel riquadro, barra nel primo piano", async ({ page, request }) => {
    const letture: string[] = [];
    page.on("request", (r) => r.url().includes("/api/eliminacode") && letture.push(new URL(r.url()).pathname));
    await page.goto("/player.html");
    const zona = page.locator('.zona[data-servizio="eliminacode"]');
    await expect(zona).toHaveAttribute("data-forma", "riquadro");
    // A142 foto TV: «ORA SERVIAMO» spaziato nel riquadro, «Ora serviamo» da sola: una sola forma, quella normale
    await expect(zona.locator(".eq-etichetta")).toHaveText("Ora serviamo", { useInnerText: true });
    await expect(zona.locator(".eq-etichetta")).toHaveCSS("letter-spacing", "normal");
    await expect(zona.locator(".eq-numero")).toHaveText("—");
    // niente domande ogni 1,5 s: in 4 secondi al massimo una lettura di riserva oltre agli eventi
    const prima = letture.length;
    await page.waitForTimeout(4000);
    expect(letture.slice(prima).filter((x) => x === "/api/eliminacode").length).toBeLessThanOrEqual(1);
    expect(letture).toContain("/api/eliminacode/eventi");
    for (let i = 0; i < 4; i++) await azione(request, "prossimo");
    await expect(zona.locator(".eq-numero")).toHaveText("4", { timeout: 1000 });
    await expect(zona).toHaveAttribute("data-forma", "primo-piano");
    await expect(zona.locator(".eq-etichetta")).toHaveText("Tocca al numero", { useInnerText: true });
    await expect(zona.locator(".eq-barra")).toBeVisible();
    await expect(zona.locator(".eq-prima")).toBeHidden();
    await expect(zona).toHaveAttribute("data-forma", "riquadro", { timeout: 6000 });
    await expect(zona.locator(".eq-barra")).toBeHidden();
    await expect(zona.locator(".eq-prima")).toHaveText("Prima: 3 2 1", { useInnerText: true });
    // «serviti oggi» non si azzera con Azzera (gli altri test ne hanno già chiamati): si confronta col server
    const { oggi } = await (await request.get("/api/eliminacode")).json();
    expect(oggi.serviti).toBeGreaterThanOrEqual(4);
    await expect(zona.locator(".eq-ritmo")).toContainText(`${oggi.serviti} serviti oggi`);
    await expect(zona.locator(".eq-ritmo")).toContainText("1 ogni");
    // foto TV 12/11: «1 ogni meno di …», «1 ogni 3,4 m…» → serviti e ritmo su due righe, mai tagliati
    await expect(zona.locator(".eq-ritmo .tagliato")).toHaveCount(0);
    for (const t of ["99999 serviti oggi", "1 ogni 29,5 min"]) {
      const largo = await zona.locator(".eq-passo").evaluate((e, t) => { e.textContent = t; return e.scrollWidth <= e.clientWidth; }, t);
      expect(largo, t).toBe(true);
    }
    // tutto dentro il riquadro, niente esce di lato o sotto
    const box = (await zona.boundingBox())!;
    for (const sel of [".eq-numero", ".eq-prima", ".eq-ritmo"]) {
      const b = (await zona.locator(sel).boundingBox())!;
      expect(b.x, sel).toBeGreaterThanOrEqual(box.x - 1);
      expect(b.x + b.width, sel).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(b.y + b.height, sel).toBeLessThanOrEqual(box.y + box.height + 1);
    }
  });

  // owner 12/11 «una persona potrebbe non vedere il numero, non capisce la divisione dello schermo e salta la fila»:
  // il riquadro è un blocco pieno nel colore del negozio (il contenuto no), largo un quarto dello schermo, ogni
  // scritta ≥ 3,2% dell'altezza (si legge da ~4 m) e a contrasto ≥ 4,5 sul colore pieno.
  test("riquadro inconfondibile: colore pieno, scritte grandi e leggibili", async ({ page, request }) => {
    await page.goto("/player.html");
    const zona = page.locator('.zona[data-servizio="eliminacode"]');
    await expect(zona).toHaveAttribute("data-forma", "riquadro");
    for (let i = 0; i < 3; i++) await azione(request, "prossimo"); // Prima e ritmo pieni
    await expect(zona).toHaveAttribute("data-forma", "riquadro", { timeout: 8000 });
    await expect(zona.locator(".eq-ritmo")).toContainText("1 ogni");
    await expect(zona.locator(".eq-chip")).toHaveCount(2);
    const m = await zona.evaluate((z) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (c: string) => { const l = rgb(c).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]!; };
      const contrasto = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
      const sfondo = getComputedStyle(z).backgroundColor;
      const prova = document.createElement("i"); prova.style.color = "var(--accento)"; document.body.append(prova);
      const accento = getComputedStyle(prova).color; prova.remove();
      const testi = [...z.querySelectorAll<HTMLElement>("*")].filter((e) => e.checkVisibility() && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()));
      return {
        sfondo, accento, largo: z.getBoundingClientRect().width / innerWidth,
        piccoli: testi.filter((e) => parseFloat(getComputedStyle(e).fontSize) < innerHeight * 0.032).map((e) => `${e.className} ${getComputedStyle(e).fontSize}`),
        illeggibili: testi.filter((e) => contrasto(getComputedStyle(e).color, sfondo) < 4.5).map((e) => e.className),
        quanti: testi.length,
      };
    });
    expect(m.sfondo, "riquadro pieno nel colore del negozio").toBe(m.accento);
    expect(m.largo).toBeGreaterThanOrEqual(0.2);
    expect(m.quanti).toBeGreaterThanOrEqual(5);
    expect(m.piccoli, "scritte sotto 3,2 vh").toEqual([]);
    expect(m.illeggibili, "scritte a contrasto < 4,5").toEqual([]);
  });

  test("i banchi: con due la TV scrive anche il banco che ha chiamato", async ({ page, request }) => {
    await banchi(request, 2);
    await negozioCon(request, "affiancato");
    await page.goto("/player.html");
    await expect(page.locator(".eq-numero")).toHaveText("—");
    await azione(request, "prossimo", 1);
    await expect(page.locator(".eq-banco")).toHaveText("Banco 2", { timeout: 2500 });
    await expect(page.getByRole("status", { name: "Tocca al numero 1, Banco 2" })).toBeVisible();
  });

  test("al cambio: animazione morbida e suono; Indietro e Azzera non suonano", async ({ page, request }) => {
    await audioFinto(page, true);
    await page.goto("/player.html");
    const numero = page.locator(".eq-numero");
    await expect(numero).toHaveText("—");
    expect(await suoni(page)).toBe(0); // alla partenza niente suono
    await azione(request, "prossimo");
    await expect(numero.locator(".eq-cifre")).toHaveText("1", { timeout: 2500 }); // il vecchio sta ancora uscendo
    expect(await numero.evaluate((e) => e.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
    await expect.poll(() => suoni(page)).toBe(2); // un "din-don" = due note
    await expect(page.locator(".eq-tv")).toHaveAttribute("data-suono", "si");
    await azione(request, "indietro");
    await expect(numero).toHaveText("—", { timeout: 2500 });
    expect(await suoni(page)).toBe(2);
  });

  test("con «riduci movimento» il numero cambia senza animazione", async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/player.html");
    await expect(page.locator(".eq-numero")).toHaveText("—");
    await azione(request, "prossimo");
    await expect(page.locator(".eq-numero")).toHaveText("1", { timeout: 2500 });
    expect(await page.locator(".eq-numero").evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0);
  });

  test("audio bloccato dalla TV: nessun errore, il numero si aggiorna lo stesso", async ({ page, request }) => {
    await audioFinto(page, false);
    const errori: string[] = [];
    page.on("pageerror", (e) => errori.push(e.message));
    await page.goto("/player.html");
    await expect(page.locator(".eq-numero")).toHaveText("—");
    await azione(request, "prossimo");
    await expect(page.locator(".eq-numero")).toHaveText("1", { timeout: 2500 });
    await expect(page.locator(".eq-tv")).toHaveAttribute("data-suono", "no");
    expect(await suoni(page)).toBe(0);
    expect(errori).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __errori: string[] }).__errori)).toEqual([]);
  });

  test("cambiare numero non sposta nient'altro (9 → 10 → 100)", async ({ page, request }) => {
    await negozioCon(request, "affiancato");
    await page.goto("/player.html");
    for (let i = 0; i < 9; i++) await azione(request, "prossimo");
    const y = async () => (await Promise.all([".eq-etichetta", ".eq-numero", ".eq-banco"].map((s) => page.locator(s).boundingBox()))).map((b) => Math.round(b!.y));
    await expect(page.locator(".eq-numero")).toHaveText("9", { timeout: 2500 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const ferme = () => page.locator(".eq-numero").evaluate((e) => e.getAnimations({ subtree: true }).length);
    await expect.poll(ferme).toBe(0);
    const prima = await y();
    await azione(request, "prossimo");
    await expect(page.locator(".eq-numero")).toHaveText("10", { timeout: 2500 });
    await expect.poll(ferme).toBe(0);
    expect(await y()).toEqual(prima);
    for (let i = 0; i < 90; i++) await azione(request, "prossimo");
    await expect(page.locator(".eq-numero")).toHaveText("100", { timeout: 2500 });
    await expect.poll(ferme).toBe(0);
    expect(await y()).toEqual(prima);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(TV.width);
  });

  test("intero con lo Schermo: il numero resta sempre in un riquadro fisso, fuori dalle offerte e dal QR", async ({ page, request }) => {
    for (let i = 0; i < 128; i++) await azione(request, "prossimo");
    await banchi(request, 2);
    await page.clock.install({ time: new Date("2026-10-27T09:00:00+01:00") });
    await page.goto("/player.html");
    await expect(page.locator(".zona")).toHaveCount(2);
    const eq = page.locator('.zona[data-servizio="eliminacode"]');
    await expect(eq).toHaveAttribute("data-forma", "riquadro");
    await expect(page.locator("#lato > .zona")).toHaveCount(1); // nella colonna destra, sopra il QR
    await expect(page.locator(".eq-numero")).toHaveText("128");
    const dentro = async () => {
      const r = (await eq.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(TV.width);
      expect(r.y + r.height).toBeLessThanOrEqual(TV.height);
      expect(r.x).toBeGreaterThanOrEqual((await page.locator("#zone").boundingBox())!.x + (await page.locator("#zone").boundingBox())!.width - 1); // colonna destra, fuori dal contenuto
      const n = (await page.locator(".eq-numero").boundingBox())!;
      expect(n.x).toBeGreaterThanOrEqual(r.x);
      expect(n.x + n.width).toBeLessThanOrEqual(r.x + r.width); // tre cifre dentro il riquadro
      expect(n.height).toBeGreaterThan(TV.height * 0.08); // leggibile a 5 m
      for (const altro of ["#qr", "#titolo", "#prezzo", "#riposo p"]) {
        const a = page.locator(altro);
        if (!(await a.isVisible())) continue;
        const b = (await a.boundingBox())!;
        const sovrapposti = b.x < r.x + r.width && r.x < b.x + b.width && b.y < r.y + r.height && r.y < b.y + b.height;
        expect(sovrapposti, `${altro} sotto il riquadro`).toBe(false);
      }
    };
    await dentro();
    await page.clock.runFor(20_000); // il giro delle zone non lo nasconde
    await expect(eq).toBeVisible();
    await expect(eq).toHaveAttribute("data-forma", "riquadro");
    await dentro();
  });

  // A136(5) come il mockup approvato: con la coda il QR sta nella colonna destra, sotto il riquadro, e si legge
  test("intero con lo Schermo: con la coda il QR sta sotto il riquadro, leggibile", async ({ page, request }) => {
    const modulo = (await import("jsqr")) as unknown as { default: typeof import("jsqr").default | { default: typeof import("jsqr").default } };
    const jsQR = "default" in modulo.default ? modulo.default.default : modulo.default;
    const { PNG } = await import("pngjs");
    const { servizi: _, ...n } = await (await request.get("/api/negozio")).json();
    const url = "https://esempio.it/menu";
    expect((await request.put("/api/negozio", { data: { ...n, negozio: { ...n.negozio, qr: { url, testo: "Menu" } } }, headers: intestazioni })).ok()).toBe(true);
    try {
      await page.setViewportSize(TV);
      await page.goto("/player.html");
      await expect(page.locator('.zona[data-servizio="eliminacode"]')).toHaveAttribute("data-forma", "riquadro");
      await expect(page.locator("#qr")).toBeVisible();
      const r = await page.evaluate(() => {
        const b = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const qr = b("#qr"), riq = b('.zona[data-forma="riquadro"]'), lato = b("#lato");
        return { sotto: qr.top >= riq.bottom - 1, dentro: qr.left >= lato.left - 1 && qr.right <= lato.right + 1 && qr.bottom <= lato.bottom + 1, lato: b("#qr-svg").height / innerHeight };
      });
      expect(r.sotto, "QR sotto il riquadro").toBe(true);
      expect(r.dentro, "QR nella colonna destra").toBe(true);
      expect(r.lato).toBeGreaterThanOrEqual(0.09);
      const png = PNG.sync.read(await page.locator("#qr-svg").screenshot());
      expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(url);
    } finally {
      await request.put("/api/negozio", { data: n, headers: intestazioni }); // il QR non resta ai test dopo
    }
  });

  // A137: con "Foto grande" (body[data-layout=foto][data-foto=1]) main perdeva lo spazio riservato alla colonna di
  // destra e il menu degli altri servizi finiva sotto riquadro e QR. Ogni disposizione deve lasciarlo libero.
  test("intero con lo Schermo: nessuna disposizione dell'aspetto porta le zone sotto riquadro e QR", async ({ page }) => {
    await page.goto("/player.html");
    await expect(page.locator('.zona[data-servizio="eliminacode"]')).toHaveAttribute("data-forma", "riquadro");
    for (const [layout, foto] of [["classico", "0"], ["foto", "1"], ["listino", "0"], ["lavagna", "0"]] as const) {
      const m = await page.evaluate(([layout, foto]) => {
        Object.assign(document.body.dataset, { layout, foto, qr: "1" });
        const main = document.querySelector("main")!;
        const destra = main.getBoundingClientRect().right - parseFloat(getComputedStyle(main).paddingRight);
        const riq = document.querySelector('.zona[data-forma="riquadro"]')!.getBoundingClientRect();
        const qr = document.querySelector("#qr")!.getBoundingClientRect(), z = main.getBoundingClientRect();
        // il QR sta nel piede (A136(5)): nessuna zona ci finisce sopra
        const sottoQr = qr.width > 0 && qr.left < z.right && z.left < qr.right && qr.top < z.bottom && z.top < qr.bottom;
        return { destra, riquadro: riq.left, sottoQr };
      }, [layout, foto]);
      expect(m.destra, `${layout}: zone sotto il riquadro`).toBeLessThanOrEqual(m.riquadro);
      expect(m.sottoQr, `${layout}: zone sotto il QR`).toBe(false);
    }
  });

  test("intero con lo Schermo: a numero nuovo il riquadro prende lo schermo qualche secondo, con suono, poi torna", async ({ page, request }) => {
    await audioFinto(page, true);
    await page.goto("/player.html");
    const eq = page.locator('.zona[data-servizio="eliminacode"]');
    await expect(eq).toHaveAttribute("data-forma", "riquadro");
    await azione(request, "prossimo");
    await expect(eq).toHaveAttribute("data-forma", "primo-piano", { timeout: 2500 });
    const r = (await eq.boundingBox())!;
    expect(r.width).toBeGreaterThan(TV.width * 0.9);
    expect((await page.locator(".eq-numero").boundingBox())!.height).toBeGreaterThan(TV.height * 0.3);
    await expect.poll(() => suoni(page)).toBeGreaterThan(0);
    await expect(eq).toHaveAttribute("data-forma", "riquadro", { timeout: 6000 });
    await azione(request, "indietro"); // tornare indietro non è una chiamata: niente primo piano
    await expect(page.locator(".eq-numero")).toHaveText("—", { timeout: 2500 });
    await expect(eq).toHaveAttribute("data-forma", "riquadro");
  });

  // A136(8): anche affiancato il numero sta nel riquadro della colonna destra; prima era una terza colonna stretta
  // che a 960×540 spezzava le parole.
  test("affiancato con lo Schermo vero: numero nella colonna destra, Schermo nel contenuto, anche a 3 cifre", async ({ page, request }) => {
    await negozioCon(request, "affiancato");
    for (let i = 0; i < 128; i++) await azione(request, "prossimo");
    await banchi(request, 2);
    await page.goto("/player.html");
    await expect(page.locator("#zone > .zona")).toHaveCount(1);
    const eq = page.locator('#lato > .zona[data-servizio="eliminacode"]');
    await expect(eq).toHaveAttribute("data-forma", "riquadro");
    await expect(page.locator(".eq-numero")).toHaveText("128", { timeout: 2500 });
    await expect(page.locator("#titolo, #riposo p, #listino").first()).toBeVisible(); // lo Schermo è lì, vero
    const [m, r] = await Promise.all([page.locator("#zone").boundingBox(), eq.boundingBox()]);
    expect(m!.x + m!.width).toBeLessThanOrEqual(r!.x + 1);
    const n = await page.locator(".eq-numero").boundingBox();
    expect(n!.x).toBeGreaterThanOrEqual(r!.x - 1);
    expect(n!.x + n!.width).toBeLessThanOrEqual(r!.x + r!.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(TV.width);
    expect(n!.height).toBeGreaterThan(TV.height * 0.08);
  });

  test("senza il servizio attivo la TV non mostra nulla di suo", async ({ page }) => {
    await page.route("**/api/negozio", async (r) => {
      const vero = await (await r.fetch()).json();
      return r.fulfill({ json: { ...vero, servizi: ["schermo"] } });
    });
    await page.goto("/player.html");
    await expect(page.locator("#zone > .zona")).toHaveCount(1);
    await expect(page.locator(".eq-tv")).toHaveCount(0);
  });
});

test.describe("pannello", () => {
  test.use(IPHONE);
  const sezione = (page: Page) => page.locator('section.servizio[data-servizio="eliminacode"]');

  test("Prossimo: numero grande, tocco enorme, la TV lo vede", async ({ page, request }) => {
    await page.goto(`/panel.html#t=${TOKEN}`);
    const s = sezione(page);
    const prossimo = s.getByRole("button", { name: "Prossimo" });
    await expect(prossimo).toBeEnabled();
    const b = (await prossimo.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(96); // «tocco ≥ 48 px» ×2: lo usa anche chi ha mani incerte
    expect(b.width).toBeGreaterThan(300);
    await prossimo.click();
    await expect(s.locator(".eq-p-cifra")).toHaveText("1");
    await expect(page.locator("#toast")).toContainText("Chiamato il n. 1");
    expect((await (await request.get("/api/eliminacode")).json()).numero).toBe(1);
  });

  test("un doppio tocco veloce non salta un numero", async ({ page, request }) => {
    await page.goto(`/panel.html#t=${TOKEN}`);
    const prossimo = sezione(page).getByRole("button", { name: "Prossimo" });
    await expect(prossimo).toBeEnabled();
    await prossimo.dblclick();
    await expect(sezione(page).locator(".eq-p-cifra")).toHaveText("1");
    expect((await (await request.get("/api/eliminacode")).json()).numero).toBe(1);
  });

  test("Indietro torna di uno; «Annulla» nell'avviso fa lo stesso", async ({ page, request }) => {
    await azione(request, "prossimo");
    await azione(request, "prossimo");
    await page.goto(`/panel.html#t=${TOKEN}`);
    const s = sezione(page);
    await expect(s.locator(".eq-p-cifra")).toHaveText("2");
    await s.getByRole("button", { name: "Indietro" }).click();
    await expect(s.locator(".eq-p-cifra")).toHaveText("1");
    await s.getByRole("button", { name: "Prossimo" }).click();
    await expect(s.locator(".eq-p-cifra")).toHaveText("2");
    await page.locator("#toast-annulla").click();
    await expect(s.locator(".eq-p-cifra")).toHaveText("1");
  });

  test("Azzera chiede conferma: «No» non cambia niente, «Sì» riparte da zero", async ({ page, request }) => {
    await azione(request, "prossimo");
    await page.goto(`/panel.html#t=${TOKEN}`);
    const s = sezione(page);
    await expect(s.locator(".eq-p-cifra")).toHaveText("1");
    await s.getByRole("button", { name: "Azzera" }).click();
    const dialogo = s.getByRole("dialog", { name: "Azzerare i numeri?" });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "No, lascia com'è" }).click();
    await expect(dialogo).toBeHidden();
    expect((await (await request.get("/api/eliminacode")).json()).numero).toBe(1);
    await s.getByRole("button", { name: "Azzera" }).click();
    await dialogo.getByRole("button", { name: "Sì, azzera" }).click();
    await expect(s.locator(".eq-p-cifra")).toHaveText("—");
    expect((await (await request.get("/api/eliminacode")).json()).numero).toBe(0);
  });

  test("due banchi: scelgo il mio e la TV dice quale banco chiama", async ({ page, request }) => {
    await page.goto(`/panel.html#t=${TOKEN}`);
    const s = sezione(page);
    await expect(s.locator(".eq-banchi")).toBeHidden();
    await s.getByRole("switch", { name: /Due banchi/ }).check();
    await expect(s.getByRole("button", { name: "Banco 2" })).toBeVisible();
    await s.getByRole("button", { name: "Banco 2" }).click();
    await expect(s.getByRole("button", { name: "Banco 2" })).toHaveAttribute("aria-pressed", "true");
    await s.getByRole("button", { name: "Prossimo" }).click();
    await expect(s.locator(".eq-p-banco")).toHaveText("Banco 2");
    expect(await (await request.get("/api/eliminacode")).json()).toMatchObject({ numero: 1, banco: 1 });
  });

  test("un secondo telefono vede il numero entro 2-3 secondi", async ({ page, request }) => {
    await page.goto(`/panel.html#t=${TOKEN}`);
    await expect(sezione(page).locator(".eq-p-cifra")).toHaveText("—");
    await azione(request, "prossimo");
    await expect(sezione(page).locator(".eq-p-cifra")).toHaveText("1", { timeout: 3500 });
  });

  test("senza il link completo non scrive e lo dice", async ({ page, request }) => {
    await page.goto("/panel.html");
    await sezione(page).getByRole("button", { name: "Prossimo" }).click();
    await expect(page.locator("#avviso")).toContainText("link completo");
    expect((await (await request.get("/api/eliminacode")).json()).numero).toBe(0);
  });

  test("il numero che cambia non sposta il resto della pagina", async ({ page, request }) => {
    await page.goto(`/panel.html#t=${TOKEN}`);
    const s = sezione(page);
    await expect(s.getByRole("button", { name: "Prossimo" })).toBeEnabled();
    const y = () => s.getByRole("button", { name: "Prossimo" }).evaluate((e) => Math.round(e.getBoundingClientRect().y + scrollY));
    const prima = await y();
    for (let i = 0; i < 10; i++) await azione(request, "prossimo");
    await expect(s.locator(".eq-p-cifra")).toHaveText("10", { timeout: 3500 });
    expect(await y()).toBe(prima);
  });
});
