import { expect, test } from "@playwright/test";
import { apriTv, DOMENICA_12, MARTEDI_9, demoCopia, imposta } from "../../../../test/e2e/aiuti.ts";
import { TOKEN } from "../../../../playwright.config.ts";
import { pngFinto } from "../../../../test/foto-finte.ts";

test.beforeEach(async ({ request }) => imposta(request));

test("martedì 9:00: nome del negozio e prima offerta", async ({ page }) => {
  await apriTv(page);
  await expect(page.locator("#nome")).toHaveText("Panificio Demo");
  await expect(page.locator("#titolo")).toHaveText("Cornetto + cappuccino");
  await expect(page.locator("#prezzo")).toHaveText("2,80 €");
  await expect(page.locator("body")).toHaveAttribute("data-offline", "0");
  await expect(page).toHaveScreenshot("tv-martedi-9.png");
});

test("ruota le offerte ogni 8 secondi", async ({ page }) => {
  await apriTv(page);
  await expect(page.locator("#titolo")).toHaveText("Cornetto + cappuccino");
  await page.clock.runFor(8000);
  await expect(page.locator("#titolo")).toHaveText("Focaccia genovese");
  await page.clock.runFor(8000);
  await expect(page.locator("#titolo")).toHaveText("Pane di Altamura");
});

test("domenica 12:00: niente colazione né pizza (fasce orarie)", async ({ page }) => {
  await apriTv(page, DOMENICA_12);
  const viste = new Set<string>();
  for (let i = 0; i < 6; i++) {
    await expect(page.locator("#titolo")).not.toHaveText("");
    viste.add((await page.locator("#titolo").textContent()) ?? "");
    await page.clock.runFor(8000);
  }
  expect([...viste].sort()).toEqual(["Focaccia genovese", "Pane di Altamura", "Torte su ordinazione"]);
});

test("senza server: resta l'ultima offerta, anche dopo un riavvio; pallino rosso dopo 60 s", async ({ page }) => {
  await apriTv(page);
  await expect(page.locator("#titolo")).toHaveText("Cornetto + cappuccino");
  await page.route("**/api/config", (r) => r.abort());
  await page.clock.runFor(61_000);
  await expect(page.locator("body")).toHaveAttribute("data-offline", "1");
  await expect(page.locator("#titolo")).not.toHaveText("");
  await page.reload();
  await expect(page.locator("#nome")).toHaveText("Panificio Demo");
  await expect(page.locator("#titolo")).not.toHaveText("");
});

test("nessuna offerta attiva: schermata di benvenuto", async ({ page, request }) => {
  const c = demoCopia();
  c.slides.forEach((s) => (s.attiva = false));
  await imposta(request, c);
  await apriTv(page);
  await expect(page.locator("#riposo")).toBeVisible();
  await expect(page.locator("#slide")).toBeHidden();
});

test("testo con HTML viene mostrato, non eseguito", async ({ page, request }) => {
  const c = demoCopia();
  c.slides[0]!.titolo = '<img src=x onerror="document.title=1">';
  await imposta(request, c);
  await apriTv(page);
  await expect(page.locator("#titolo")).toHaveText('<img src=x onerror="document.title=1">');
  await expect(page.locator("main img:not(#foto)")).toHaveCount(0); // #foto: il riquadro della foto, vuoto senza foto
  await expect(page.locator("#foto")).toBeHidden();
});

test("la TV si aggiorna da sola quando cambia la config", async ({ page, request }) => {
  await apriTv(page);
  await expect(page.locator("#prezzo")).toHaveText("2,80 €");
  const c = demoCopia();
  c.slides[0]!.prezzo = 300;
  await imposta(request, c);
  await page.clock.runFor(6000);
  await expect(page.locator("#prezzo")).toHaveText("3,00 €");
});

test("prezzo per unità sotto il prezzo (focaccia all'etto = 25,00 €/kg)", async ({ page }) => {
  await apriTv(page);
  await page.clock.runFor(8000);
  await expect(page.locator("#titolo")).toHaveText("Focaccia genovese");
  await expect(page.locator("#per-unita")).toHaveText("100 g · 25,00 €/kg");
  await page.clock.runFor(16000); // Torte su ordinazione: niente prezzo, niente riga
  await expect(page.locator("#titolo")).toHaveText("Torte su ordinazione");
  await expect(page.locator("#per-unita")).toHaveText("");
});

test("QR sulla TV: si legge davvero e porta al link giusto", async ({ page, request }) => {
  // jsqr è CommonJS: sotto nodenext il default arriva annidato
  const modulo = (await import("jsqr")) as unknown as { default: typeof import("jsqr").default | { default: typeof import("jsqr").default } };
  const jsQR = "default" in modulo.default ? modulo.default.default : modulo.default;
  const { PNG } = await import("pngjs");
  const c = demoCopia() as any;
  c.negozio.qr = { url: "https://g.page/r/esempio-recensioni/review", testo: "Lasciaci una recensione" };
  await imposta(request, c);
  await apriTv(page);
  await expect(page.locator("#qr")).toBeVisible();
  await expect(page.locator("#qr-testo")).toHaveText("Lasciaci una recensione");
  const png = PNG.sync.read(await page.locator("#qr-svg").screenshot());
  const letto = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(letto?.data).toBe("https://g.page/r/esempio-recensioni/review");
});

test("senza QR configurato non compare niente", async ({ page }) => {
  await apriTv(page);
  await expect(page.locator("#titolo")).not.toHaveText("");
  await expect(page.locator("#qr")).toBeHidden();
});

test("tema Natale: colori del tema, neve sul canvas (non più CSS), ferma con riduci movimento", async ({ page, request }) => {
  const c = demoCopia() as any;
  c.tema = "natale";
  await imposta(request, c);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await apriTv(page);
  await expect(page.locator("body")).toHaveAttribute("data-tema", "natale");
  expect(await page.locator("body").evaluate((b) => getComputedStyle(b).backgroundColor)).toBe("rgb(14, 42, 31)");
  await expect(page.locator("#fx")).toHaveAttribute("data-particelle", "natale");
  // riduci movimento: un solo fotogramma, i fiocchi non si muovono
  const a = await page.locator("#fx").evaluate((cv: HTMLCanvasElement) => cv.toDataURL());
  await page.clock.runFor(3000);
  expect(await page.locator("#fx").evaluate((cv: HTMLCanvasElement) => cv.toDataURL())).toBe(a);
  await expect(page).toHaveScreenshot("tv-natale.png");
});

test("tema Natale con i miei colori: neve e decorazioni sui colori del negozio", async ({ page, request }) => {
  const c = demoCopia() as any;
  c.tema = "natale";
  c.temaColori = "negozio";
  await imposta(request, c);
  await apriTv(page);
  await expect(page.locator("body")).toHaveAttribute("data-tema", "natale");
  await expect(page.locator("body")).toHaveAttribute("data-tema-colori", "negozio");
  expect(await page.locator("body").evaluate((b) => getComputedStyle(b).backgroundColor)).toBe("rgb(31, 20, 12)");
  await expect(page.locator("#fx")).toHaveAttribute("data-particelle", "natale");
});

for (const [variante, sfondo] of [["elegante", "rgb(11, 20, 38)"], ["nordico", "rgb(247, 249, 251)"], ["caldo", "rgb(42, 22, 13)"]] as const) {
  test(`Natale ${variante}: palette della variante, stessa neve`, async ({ page, request }) => {
    const c = demoCopia() as any;
    c.tema = "natale";
    c.temaVariante = variante;
    await imposta(request, c);
    await apriTv(page);
    await expect(page.locator("body")).toHaveAttribute("data-tema-variante", variante);
    expect(await page.locator("body").evaluate((b) => getComputedStyle(b).backgroundColor)).toBe(sfondo);
    await expect(page.locator("#fx")).toHaveAttribute("data-particelle", "natale");
  });
}

for (const tema of ["pasqua", "estate", "saldi", "blackfriday"] as const) {
  test(`tema ${tema}: palette e particelle proprie`, async ({ page, request }) => {
    const c = demoCopia() as any;
    c.tema = tema;
    await imposta(request, c);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await apriTv(page);
    await expect(page.locator("body")).toHaveAttribute("data-tema", tema);
    await expect(page.locator("#fx")).toHaveAttribute("data-particelle", tema);
    await expect(page).toHaveScreenshot(`tv-${tema}.png`);
  });
}

test("neve in movimento: senza riduci movimento il canvas cambia nel tempo", async ({ page, request }) => {
  const c = demoCopia() as any;
  c.tema = "natale";
  await imposta(request, c);
  await apriTv(page);
  const a = await page.locator("#fx").evaluate((cv: HTMLCanvasElement) => cv.toDataURL());
  await page.clock.runFor(1000);
  expect(await page.locator("#fx").evaluate((cv: HTMLCanvasElement) => cv.toDataURL())).not.toBe(a);
});

const conBarra = (extra: (c: any) => void = () => {}) => {
  const c = demoCopia() as any;
  c.negozio.orari = [{ giorni: [1, 2, 3, 4, 5, 6, 7], da: "08:00", a: "19:30" }];
  c.negozio.citta = { nome: "Torino, Piemonte", lat: 45.07, lon: 7.69 };
  c.negozio.barra = { testo: "Oggi pane caldo alle 17 e focaccia appena sfornata" };
  extra(c);
  return c;
};
const METEO = { temperatura: 21.4, codice: 61, giorno: true, aggiornato: MARTEDI_9.getTime() };

test("barra: ora, orari di oggi, testo e meteo con icona e attribuzione", async ({ page, request }) => {
  await imposta(request, conBarra());
  await page.route("**/api/meteo", (r) => r.fulfill({ json: METEO }));
  await apriTv(page);
  await expect(page.locator("#b-ora")).toHaveText("09:00");
  await expect(page.locator("#b-orari")).toHaveText("Aperto fino alle 19:30");
  await expect(page.locator("#b-testo")).toContainText("pane caldo");
  await expect(page.locator("#b-gradi")).toHaveText("21°");
  await expect(page.locator("#b-meteo")).toHaveAttribute("data-stato", "ok");
  await expect(page.locator("#b-icona-uso")).toHaveAttribute("href", "#m-pioggia");
  await expect(page.locator("#b-meteo")).toContainText("Meteo: Open-Meteo");
});

test("barra: posizione sopra/sotto/nascosta", async ({ page, request }) => {
  for (const [pos, atteso] of [["sotto", "sotto"], ["nascosta", "nascosta"], [undefined, "sopra"]] as const) { // A136: di base sopra, accanto al nome
    await imposta(request, conBarra((c) => { if (pos) c.negozio.barra.posizione = pos; }));
    await page.route("**/api/meteo", (r) => r.fulfill({ json: METEO }));
    await apriTv(page);
    await expect(page.locator("body")).toHaveAttribute("data-barra", atteso);
    const box = await page.locator("#barra").boundingBox();
    if (atteso === "nascosta") expect(box).toBeNull();
    // A141: i tile stanno dentro il margine della TV (3vh), non contro il bordo
    else if (atteso === "sopra") expect(box!.y).toBeLessThan(page.viewportSize()!.height * 0.03 + 2);
    else expect(box!.y + box!.height).toBeGreaterThan(page.viewportSize()!.height * 0.97 - 2);
  }
});

test("barra: la pagina non si sposta quando arriva il meteo e quando il testo cambia", async ({ page, request }) => {
  await imposta(request, conBarra());
  let rilascia: () => void = () => {};
  const via = new Promise<void>((ok) => (rilascia = ok));
  await page.route("**/api/meteo", async (r) => { await via; await r.fulfill({ json: METEO }); });
  await apriTv(page);
  await expect(page.locator("#b-meteo")).toHaveAttribute("data-stato", "attesa");
  const misure = () =>
    page.evaluate(() => ["header", "main", "#barra", "#b-ora", "#b-testo", "#b-meteo"].map((q) => {
      const r = document.querySelector(q)!.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }));
  const prima = await misure();
  rilascia();
  await expect(page.locator("#b-meteo")).toHaveAttribute("data-stato", "ok");
  expect(await misure()).toEqual(prima);
  await page.clock.runFor(61_000);
  expect(await misure()).toEqual(prima);
});

test("meteo giù: resta l'ultimo valore, nessun salto, poi torna", async ({ page, request }) => {
  await imposta(request, conBarra());
  let giu = false;
  await page.route("**/api/meteo", (r) => (giu ? r.fulfill({ status: 503, json: { errori: ["x"] } }) : r.fulfill({ json: METEO })));
  await apriTv(page);
  await expect(page.locator("#b-gradi")).toHaveText("21°");
  const prima = await page.locator("#b-meteo").boundingBox();
  giu = true;
  await page.clock.runFor(11 * 60_000);
  await expect(page.locator("#b-gradi")).toHaveText("21°");
  expect(await page.locator("#b-meteo").boundingBox()).toEqual(prima);
});

test("barra con riduci movimento: il testo non scorre, cambia a pagine", async ({ page, request }) => {
  await imposta(request, conBarra((c) => { c.negozio.barra.testo = "Oggi pane caldo alle diciassette e focaccia appena sfornata per tutti i clienti"; }));
  await page.route("**/api/meteo", (r) => r.fulfill({ json: METEO }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await apriTv(page);
  await expect(page.locator("#b-testo-t")).not.toHaveAttribute("data-scorre", "1");
  const uno = await page.locator("#b-testo-t").textContent();
  await page.clock.runFor(7000);
  await expect(page.locator("#b-testo-t")).not.toHaveText(uno!);
});

/** Niente esce dallo schermo della TV (contenuti di <main> e la barra). */
async function dentroLoSchermo(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main *, header *")]
      .filter((e) => e.offsetParent || getComputedStyle(e).position === "fixed")
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1); })
      .map((e) => `${e.id || e.className || e.tagName} ${e.textContent?.trim().slice(0, 20)}`),
  );
}

for (const [w, h] of [[1920, 1080], [1280, 720]] as const) {
  test(`listino ${w}×${h}: tutte le offerte a righe, 7 offerte in due pagine (4 + 3), niente fuori`, async ({ page, request }) => {
    const c = demoCopia();
    (c as Record<string, unknown>).aspetto = { layout: "listino" };
    c.slides.push(...[1, 2, 3].map((i) => ({ id: `extra-${i}`, titolo: `Biscotti ${i}`, prezzo: 300 + i, attiva: true })));
    await imposta(request, c);
    await apriTv(page);
    await page.setViewportSize({ width: w, height: h });
    await expect(page.locator("#listino")).toBeVisible();
    await expect(page.locator("#slide")).toBeHidden();
    // martedì 9:00: 7 offerte attive (la pizza parte alle 11:30) → 4 + 3
    await expect(page.locator("#righe li")).toHaveCount(4);
    expect(await dentroLoSchermo(page)).toEqual([]);
    if (w === 1920) await expect(page).toHaveScreenshot("tv-listino.png");
    await page.clock.runFor(8000);
    await expect(page.locator("#righe li")).toHaveCount(3);
    expect(await dentroLoSchermo(page)).toEqual([]);
  });
}

test("foto grande: la foto riempie lo schermo, scritte chiare sopra il velo, dentro lo schermo", async ({ page, request }) => {
  const r = await request.post("/api/foto", { headers: { "X-Token": TOKEN, "Content-Type": "image/png" }, data: pngFinto(1600, 1200) });
  const { foto } = await r.json();
  const c = demoCopia();
  (c as Record<string, unknown>).aspetto = { layout: "foto" };
  c.slides[0]!.foto = foto;
  await imposta(request, c);
  await apriTv(page);
  await expect(page.locator("body")).toHaveAttribute("data-foto", "1");
  const f = (await page.locator("#foto").boundingBox())!;
  expect(f.width).toBeGreaterThan(1600); // riempie il contenuto, dentro i margini della griglia (test sotto)
  await expect(page.locator("#prezzo")).toHaveCSS("color", "rgb(255, 255, 255)");
  expect(await dentroLoSchermo(page)).toEqual([]);
});

// Bug 12/11 (owner sulla Google TV, A136(12)): con "Foto grande" il testo cresceva (riempi) e usciva dalla foto
// verso l'alto, sopra la testata: è in basso con position: absolute, e uno sforamento in alto non fa scroll.
for (const viewport of [{ width: 960, height: 540 }, { width: 1920, height: 1080 }])
  test(`foto grande ${viewport.width}: le scritte restano dentro la foto`, async ({ page, request }) => {
    const r = await request.post("/api/foto", { headers: { "X-Token": TOKEN, "Content-Type": "image/png" }, data: pngFinto(1600, 1200) });
    const { foto } = await r.json();
    const c = demoCopia();
    (c as Record<string, unknown>).aspetto = { layout: "foto" };
    c.slides[0]!.foto = foto;
    await imposta(request, c);
    await page.setViewportSize(viewport);
    await apriTv(page);
    await expect(page.locator("body")).toHaveAttribute("data-foto", "1");
    await page.evaluate(() => document.fonts.ready);
    const fuori = await page.evaluate(() => {
      const cornice = document.querySelector(".cornice")!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>(".testi > *")]
        .filter((e) => e.getClientRects().length)
        .filter((e) => { const b = e.getBoundingClientRect(); return b.top < cornice.top - 1 || b.bottom > cornice.bottom + 1 || b.left < cornice.left - 1 || b.right > cornice.right + 1; })
        .map((e) => e.id || e.className);
    });
    expect(fuori).toEqual([]);
  });

// Bug 12/11 (owner sulla Google TV): la foto che si muove piano usciva dal suo riquadro (sopra testata e piede) e il
// velo copriva solo la fascia del testo. Controllo a fine movimento, quando la foto è più grande.
for (const layout of ["foto", "classico"]) {
  test(`foto che si muove (${layout}): resta nel suo riquadro, velo fermo su tutta la foto`, async ({ page, request }) => {
    const r = await request.post("/api/foto", { headers: { "X-Token": TOKEN, "Content-Type": "image/png" }, data: pngFinto(1600, 1200) });
    const { foto } = await r.json();
    const c = demoCopia();
    (c as Record<string, unknown>).aspetto = { layout };
    c.slides[0]!.foto = foto;
    await imposta(request, c);
    await apriTv(page);
    await expect(page.locator("body")).toHaveAttribute("data-foto", "1");
    const esito = await page.evaluate(() => {
      document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 16_000; }); // fine dell'andata: foto alla misura più grande
      const f = document.getElementById("foto")!;
      const cornice = f.parentElement!.getBoundingClientRect();
      const r = f.getBoundingClientRect();
      // punti appena fuori dal riquadro, dove la foto ingrandita arriverebbe senza ritaglio
      const punti: [number, number][] = [
        [cornice.left + cornice.width / 2, cornice.top - 3], [cornice.left + cornice.width / 2, cornice.bottom + 3],
        [cornice.left - 3, cornice.top + cornice.height / 2], [cornice.right + 3, cornice.top + cornice.height / 2],
      ];
      const fuori = punti
        .filter(([x, y]) => x > 0 && y > 0 && x < innerWidth && y < innerHeight && r.left < x && x < r.right && r.top < y && y < r.bottom)
        .filter(([x, y]) => document.elementFromPoint(x, y) === f).length;
      const v = getComputedStyle(f.parentElement!, "::after");
      return { fuori, velo: v.content !== "none", alto: Math.abs(parseFloat(v.height) - cornice.height) < 2, fermo: v.animationName === "none" };
    });
    expect(esito.fuori).toBe(0);
    // owner 12/11 «le foto non si muovono»: il movimento dura quanto la pagina, non si ferma dopo un giro
    expect(await page.evaluate(() => document.getElementById("foto")!.getAnimations()[0]?.effect?.getTiming().iterations)).toBe(Infinity);
    if (layout === "foto") expect(esito).toEqual({ fuori: 0, velo: true, alto: true, fermo: true });

    // griglia coerente (owner 12/11 «alcuni adiacenti, altri coi bordi»): ogni blocco nei margini comuni, stesso raggio
    const griglia = await page.evaluate(() => {
      const px = (v: string) => { const d = document.createElement("div"); d.style.width = v; document.body.append(d); const w = d.getBoundingClientRect().width; d.remove(); return w; };
      const respiro = px("var(--tv-misura-respiro)"), margine = px("var(--tv-misura-margine)");
      const testa = document.querySelector("header")!.getBoundingClientRect().bottom;
      const piede = document.getElementById("piede")!.getBoundingClientRect().top;
      const blocchi = [document.querySelector(".cornice")!, ...document.querySelectorAll("#lato > :not([hidden])")]
        .filter((e) => e.getBoundingClientRect().height > 0);
      return {
        raggi: [...new Set(blocchi.map((e) => getComputedStyle(e).borderTopLeftRadius))].length,
        fuori: blocchi.filter((e) => { const r = e.getBoundingClientRect(); return r.top < testa + respiro - 1 || r.bottom > piede - respiro + 1 || r.left < margine - 1 || r.right > innerWidth - margine + 1; })
          .map((e) => { const r = e.getBoundingClientRect(); return `${e.id || e.className} ${Math.round(r.top)}-${Math.round(r.bottom)} ${Math.round(r.left)}-${Math.round(r.right)} testa ${Math.round(testa)} piede ${Math.round(piede)} m ${margine} r ${respiro}`; }),
      };
    });
    expect(griglia, JSON.stringify(griglia)).toEqual({ raggi: 1, fuori: [] });
  });
}

test("lavagna: fondo lavagna e scritte gesso, qualunque siano i colori del negozio", async ({ page, request }) => {
  const c = demoCopia();
  (c as Record<string, unknown>).aspetto = { layout: "lavagna" };
  await imposta(request, c);
  await apriTv(page);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(31, 43, 37)");
  await expect(page.locator("#titolo")).toHaveCSS("color", "rgb(243, 239, 228)");
  expect(await dentroLoSchermo(page)).toEqual([]);
});

// A136(10): testi al massimo che il pannello accetta, sulla TV vera (960×540): il titolo sta in 3 righe, la nota in
// 2 (il font scende, poi i puntini), il prezzo non si taglia mai, niente esce dallo schermo.
for (const layout of ["classico", "foto", "lavagna"])
test(`testi lunghissimi (${layout}, con foto): titolo 3 righe, nota 2, prezzo intero, tutto dentro lo schermo`, async ({ page, request }) => {
  const { foto } = await (await request.post("/api/foto", { headers: { "X-Token": TOKEN, "Content-Type": "image/png" }, data: pngFinto(1600, 1200) })).json();
  const c = demoCopia() as any;
  c.aspetto = { layout };
  c.slides = [{ ...c.slides[0], foto, titolo: "Focaccia ripiena con verdure grigliate mozzarella di bufala e basilico fresco!!", nota: "Solo oggi, fino a esaurimento: impasto a lunga lievitazione con farina macinata a pietra, olio extravergine del Garda", prezzo: 99999, fasce: undefined }];
  await imposta(request, c);
  await apriTv(page);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.clock.runFor(1000);
  await page.evaluate(() => document.fonts.ready);
  // il testo si adatta dopo il cambio di misura (ResizeObserver): sotto carico arriva tardi, si rimisura finché si assesta
  await expect(async () => {
  const r = await page.evaluate(() => {
    const righe = (q: string) => { const e = document.querySelector<HTMLElement>(q)!; const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight) || 1.2 * parseFloat(cs.fontSize); return Math.round(e.getBoundingClientRect().height / lh); };
    const p = document.querySelector<HTMLElement>("#prezzo")!;
    const fuori = ["#titolo", "#prezzo", "#nota"].filter((q) => document.querySelector(q)!.getBoundingClientRect().bottom > document.querySelector("#piede")!.getBoundingClientRect().top + 1);
    return { titolo: righe("#titolo"), nota: righe("#nota"), prezzoTagliato: p.scrollWidth > p.clientWidth + 1, fuori };
  });
  expect(r.titolo).toBeLessThanOrEqual(3);
  expect(r.nota).toBeLessThanOrEqual(2);
  expect(r).toMatchObject({ prezzoTagliato: false, fuori: [] });
  }).toPass({ timeout: 5000 });
});
