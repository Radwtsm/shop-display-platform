import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { TOKEN } from "../../../../playwright.config.ts";
import { apriTv, config, demoCopia, imposta, IPHONE_XR, MARTEDI_9 } from "../../../../test/e2e/aiuti.ts";
import { infoFoto, tipoFoto } from "../../../piattaforma/core/foto.ts";
import { pngFinto } from "../../../../test/foto-finte.ts";
import { COMBINAZIONI, problemiColori } from "../../../piattaforma/core/colori.ts";

test.use(IPHONE_XR);
test.beforeEach(async ({ request }) => imposta(request));

async function apri(page: Page, conToken = true) {
  await page.clock.install({ time: MARTEDI_9 });
  await page.goto(conToken ? `/panel.html#t=${TOKEN}` : "/panel.html");
  await expect(page.locator("#offerte li")).toHaveCount(5);
}
const foglio = (page: Page) => page.locator("#foglio-offerta");
const riga = (page: Page, titolo: string) => page.locator("#offerte li", { hasText: titolo });
const fatto = (page: Page) => foglio(page).getByRole("button", { name: "Fatto" });

test("anteprima: mostra cosa c'è sulla TV adesso", async ({ page }) => {
  await apri(page);
  await expect(page.locator("#ant-titolo")).toHaveText("Cornetto + cappuccino");
  await expect(page.locator("#ant-info")).toHaveText("Cambia ogni 8 secondi · 4 offerte sulla TV adesso");
  await expect(riga(page, "Cornetto").locator(".riga-sotto")).toHaveText("2,80 € · dalle 06:30 alle 11:00");
});

test("cambio un prezzo dal foglio e la TV lo mostra", async ({ page, browser }) => {
  await apri(page);
  await expect(page).toHaveURL(/panel\.html$/); // token tolto dalla barra
  await riga(page, "Cornetto").locator("button.riga").click();
  await expect(foglio(page)).toBeVisible();
  await foglio(page).getByLabel("Prezzo").fill("3,20");
  await fatto(page).click();
  await expect(foglio(page)).toBeHidden();
  await expect(page.locator("#toast")).toContainText("Aggiornato sulla TV ✓");
  await expect(riga(page, "Cornetto").locator(".riga-sotto")).toContainText("3,20");

  const tv = await browser.newPage();
  await apriTv(tv);
  await expect(tv.locator("#prezzo")).toHaveText("3,20 €");
  await tv.close();
});

test("Annulla nel toast rimette com'era", async ({ page, request }) => {
  await apri(page);
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).getByLabel("Prezzo").fill("9,99");
  await fatto(page).click();
  await expect(page.locator("#toast")).toBeVisible();
  expect((await config(request)).slides[1]!.prezzo).toBe(999);
  await page.locator("#toast").getByRole("button", { name: "Annulla" }).click();
  await expect(page.locator("#toast")).toContainText("Modifica annullata");
  expect((await config(request)).slides[1]!.prezzo).toBe(250);
});

test("Annulla nel foglio non salva niente", async ({ page, request }) => {
  await apri(page);
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).getByLabel("Nome").fill("Cambiato");
  await foglio(page).getByRole("button", { name: "Annulla" }).click();
  await expect(foglio(page)).toBeHidden();
  expect((await config(request)).slides[1]!.titolo).toBe("Focaccia genovese");
});

test("prezzo sbagliato: errore sotto il campo, il foglio resta aperto, il testo resta", async ({ page, request }) => {
  await apri(page);
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).getByLabel("Prezzo").fill("due euro");
  await fatto(page).click();
  await expect(page.locator("#err-prezzo")).toHaveText("Scrivi il prezzo così: 2,50");
  await expect(foglio(page).getByLabel("Prezzo")).toHaveValue("due euro");
  await expect(foglio(page).getByLabel("Prezzo")).toBeFocused();
  await expect(foglio(page)).toBeVisible();
  expect((await config(request)).slides[1]!.prezzo).toBe(250);
});

test("prezzi scritti in tanti modi sono accettati", async ({ page, request }) => {
  await apri(page);
  for (const [scritto, cent] of [["2.5", 250], ["€ 3", 300], ["1,05", 105]] as const) {
    await riga(page, "Focaccia").locator("button.riga").click();
    await foglio(page).getByLabel("Prezzo").fill(scritto);
    await fatto(page).click();
    await expect(foglio(page)).toBeHidden();
    expect((await config(request)).slides[1]!.prezzo).toBe(cent);
  }
});

test("nome vuoto: errore, niente salvato", async ({ page, request }) => {
  await apri(page);
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).getByLabel("Nome").fill("  ");
  await fatto(page).click();
  await expect(page.locator("#err-titolo")).toHaveText("Scrivi il nome dell'offerta.");
  expect((await config(request)).slides[1]!.titolo).toBe("Focaccia genovese");
});

test("interruttore nella lista: nasconde dalla TV e si annulla", async ({ page, request }) => {
  await apri(page);
  await page.getByRole("switch", { name: "Mostra Focaccia genovese sulla TV" }).click();
  await expect(page.locator("#toast")).toContainText("nascosta dalla TV");
  await expect(riga(page, "Focaccia").locator(".riga-sotto")).toHaveText("Nascosta dalla TV");
  expect((await config(request)).slides[1]!.attiva).toBe(false);
  await page.locator("#toast").getByRole("button", { name: "Annulla" }).click();
  await expect(riga(page, "Focaccia").locator(".riga-sotto")).toContainText("2,50");
  expect((await config(request)).slides[1]!.attiva).toBe(true);
});

test("aggiungo un'offerta, poi la elimino con conferma e la ripristino", async ({ page, request }) => {
  await apri(page);
  await page.getByRole("button", { name: "+ Aggiungi offerta" }).click();
  await expect(foglio(page).getByRole("heading")).toHaveText("Nuova offerta");
  await expect(foglio(page).getByLabel("Nome")).toBeFocused();
  await expect(page.locator("#zona-elimina")).toBeHidden();
  await foglio(page).getByLabel("Nome").fill("Biscotti al burro");
  await foglio(page).getByLabel("Prezzo").fill("1,5");
  await fatto(page).click();
  await expect(page.locator("#toast")).toContainText("Offerta aggiunta");
  expect((await config(request)).slides[5]).toMatchObject({ titolo: "Biscotti al burro", prezzo: 150, attiva: true });

  await riga(page, "Biscotti").locator("button.riga").click();
  await foglio(page).getByRole("button", { name: "Elimina offerta" }).click();
  await expect(page.locator("#conferma")).toContainText('Eliminare "Biscotti al burro"?');
  await page.locator("#conferma").getByRole("button", { name: "Elimina" }).click();
  await expect(page.locator("#toast")).toContainText("Offerta eliminata");
  await expect(page.locator("#offerte li")).toHaveCount(5);
  await page.locator("#toast").getByRole("button", { name: "Annulla" }).click();
  await expect(page.locator("#offerte li")).toHaveCount(6);
});

test("foglio Negozio: nome", async ({ page, request }) => {
  await apri(page);
  await page.getByRole("button", { name: /Nome, orari e QR/ }).click();
  const f = page.locator("#foglio-negozio");
  await f.getByLabel("Nome del negozio").fill("");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#err-nome")).toHaveText("Scrivi il nome del negozio.");
  await f.getByLabel("Nome del negozio").fill("Forno Demo");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  expect(await config(request)).toMatchObject({ negozio: { nome: "Forno Demo" } });
  await expect(page.locator("#nome-negozio")).toHaveText("Forno Demo");
});

test("aspetto: secondi per offerta e passaggio dal foglio Aspetto", async ({ page, request }) => {
  await apri(page);
  await page.locator("#apri-aspetto").click();
  const f = page.locator("#foglio-aspetto");
  await expect(f.getByRole("group", { name: "Ogni offerta resta sulla TV" }).getByRole("button")).toHaveCount(6);
  await expect(f.getByRole("button", { name: /(^|\s)8 secondi/ })).toHaveAttribute("aria-pressed", "true");
  await f.getByRole("button", { name: /(^|\s)15 secondi/ }).click();
  await f.getByRole("button", { name: /Scorre di lato/ }).click();
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  expect(await config(request)).toMatchObject({ secondiPerSlide: 15, aspetto: { passaggio: "scorrimento" } });
  await expect(page.locator("#aspetto-sotto")).toHaveText("Passaggio tra le offerte: scorre di lato · 15 secondi per offerta");
  await expect(page.locator("#ant-info")).toContainText("Cambia ogni 15 secondi");
});

test("senza il link completo: avviso e niente salvato", async ({ page, request }) => {
  await apri(page, false);
  await expect(page.locator("#avviso")).toContainText("link completo");
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).getByLabel("Prezzo").fill("9,99");
  await fatto(page).click();
  await expect(page.locator("#err-offerta")).toContainText("link completo");
  expect((await config(request)).slides[1]!.prezzo).toBe(250);
});

test("link sbagliato: messaggio chiaro, niente salvato", async ({ page, request }) => {
  await page.clock.install({ time: MARTEDI_9 });
  await page.goto("/panel.html#t=sbagliato");
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).getByLabel("Prezzo").fill("9,99");
  await fatto(page).click();
  await expect(page.locator("#err-offerta")).toContainText("link non è più valido");
  expect((await config(request)).slides[1]!.prezzo).toBe(250);
});

test("server irraggiungibile: errore nel foglio, Fatto riprova", async ({ page, request }) => {
  await apri(page);
  await page.route("**/api/config", (r) => r.abort());
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).getByLabel("Prezzo").fill("2,70");
  await fatto(page).click();
  await expect(page.locator("#err-offerta")).toContainText("Wi-Fi del negozio");
  await expect(foglio(page).getByLabel("Prezzo")).toHaveValue("2,70");
  await page.unroute("**/api/config");
  await fatto(page).click();
  await expect(foglio(page)).toBeHidden();
  await expect(page.locator("#avviso")).toBeHidden();
  expect((await config(request)).slides[1]!.prezzo).toBe(270);
});

test("pagina aperta senza server: avviso con Riprova", async ({ page }) => {
  await page.route("**/api/config", (r) => r.abort());
  await page.goto(`/panel.html#t=${TOKEN}`);
  await expect(page.locator("#avviso")).toContainText("Wi-Fi del negozio");
  await page.unroute("**/api/config");
  await page.getByRole("button", { name: "Riprova" }).click();
  await expect(page.locator("#avviso")).toBeHidden();
  await expect(page.locator("#offerte li")).toHaveCount(5);
});

test("colore del negozio come accento solo se si legge bene", async ({ page, request }) => {
  await apri(page);
  const sfondoBottone = () => page.locator("#aggiungi").evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await sfondoBottone()).toBe("rgb(122, 62, 18)"); // marrone del panificio, leggibile su chiaro
  const c = demoCopia();
  c.negozio.colori.primario = "#ffd27a"; // giallo chiaro: illeggibile su bianco
  c.negozio.colori.testo = "#1f140c";
  c.negozio.colori.sfondo = "#fff8ee";
  c.negozio.colori.accento = "#7a3e12";
  await imposta(request, c);
  await page.reload();
  await expect(page.locator("#offerte li")).toHaveCount(5);
  expect(await sfondoBottone()).toBe("rgb(0, 98, 204)"); // accento di sistema
});

for (const larghezza of [320, 414]) {
  test(`${larghezza} px: niente scroll orizzontale, tocchi ≥ 48 px, testo ≥ 15 px`, async ({ page }) => {
    await page.setViewportSize({ width: larghezza, height: 800 });
    await apri(page);
    const m = await page.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth }));
    expect(m.w).toBe(larghezza);
    expect(m.sw).toBeLessThanOrEqual(m.w);
    const piccoli = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main button, .barra button, .interruttore-zona")]
        .filter((e) => e.offsetParent)
        .map((e) => ({ e: e.textContent?.trim().slice(0, 30) || e.className, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.height < 48 || r.width < 48)
        .map(({ e, r }) => `${e} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(piccoli).toEqual([]);
    const testoPiccolo = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main *, .barra *")]
        .filter((e) => e.offsetParent && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
        .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 15)
        .map((e) => `${e.textContent!.trim().slice(0, 30)} ${getComputedStyle(e).fontSize}`),
    );
    expect(testoPiccolo).toEqual([]);
  });
}

for (const schema of ["light", "dark"] as const) {
  test(`accessibilità (axe) e aspetto, modo ${schema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: schema, reducedMotion: "reduce" });
    await apri(page);
    const lista = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(lista.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await expect(page).toHaveScreenshot(`pannello-${schema}.png`);
    await riga(page, "Cornetto").locator("button.riga").click();
    await expect(foglio(page)).toBeVisible();
    const aperto = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(aperto.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await expect(page).toHaveScreenshot(`foglio-${schema}.png`);
    await foglio(page).getByRole("button", { name: "Annulla" }).click();
    await page.locator("#apri-colori").click();
    await page.locator("#foglio-colori").getByText("Ogni colore, uno per uno").click();
    const colori = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(colori.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await expect(page).toHaveScreenshot(`colori-${schema}.png`);
    await page.locator("#foglio-colori").getByRole("button", { name: "Annulla" }).click();
    await page.locator("#apri-aspetto").click();
    const aspetto = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(aspetto.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await expect(page).toHaveScreenshot(`aspetto-${schema}.png`);
  });
}

for (const larghezza of [320, 414]) {
  for (const [id, apriFoglio, righeAttese] of [
    ["foglio-colori", async (page: Page) => { await page.locator("#apri-colori").click(); await page.locator("#foglio-colori").getByText("Ogni colore, uno per uno").click(); }, 4],
    ["foglio-aspetto", async (page: Page) => page.locator("#apri-aspetto").click(), 14],
  ] as const)
  test(`${id} a ${larghezza} px: niente esce, tocchi ≥ 48 px, testo ≥ 15 px, miniature a coppie`, async ({ page }) => {
    await page.setViewportSize({ width: larghezza, height: 800 });
    await apri(page);
    await apriFoglio(page);
    const r = await page.evaluate((id) => {
      const f = document.getElementById(id)!;
      const vis = [...f.querySelectorAll<HTMLElement>("*")].filter((e) => e.offsetParent);
      return {
        fuori: vis.filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).map((e) => e.className || e.tagName),
        piccoli: [...f.querySelectorAll<HTMLElement>("button, summary, input")]
          .filter((e) => e.offsetParent)
          .map((e) => ({ t: e.textContent?.trim().slice(0, 20) || (e as HTMLInputElement).name, r: e.getBoundingClientRect() }))
          .filter(({ r }) => r.height < 48 || r.width < 48)
          .map(({ t, r }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
        testo: vis
          .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
          .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 15)
          .map((e) => e.textContent!.trim().slice(0, 20)),
        righe: [...new Set([...f.querySelectorAll<HTMLElement>(".combinazione")].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().top)))].length,
        dispari: [...f.querySelectorAll<HTMLElement>(".combinazioni")].map((g) => g.children.length).filter((n) => n % 2),
      };
    }, id);
    expect(r.fuori).toEqual([]);
    expect(r.piccoli).toEqual([]);
    expect(r.testo).toEqual([]);
    expect(r.dispari).toEqual([]); // mai una miniatura da sola su una riga
    expect(r.righe).toBe(righeAttese);
  });
}

test("l'anteprima che cambia non sposta la pagina", async ({ page }) => {
  await apri(page);
  const misura = () =>
    page.evaluate(() => ({
      anteprima: Math.round(document.querySelector(".anteprima")!.getBoundingClientRect().height),
      lista: Math.round(document.getElementById("offerte")!.getBoundingClientRect().top),
    }));
  const prima = await misura();
  const titoli = new Set<string>();
  for (let i = 0; i < 4; i++) {
    titoli.add((await page.locator("#ant-titolo").textContent()) ?? "");
    expect(await misura()).toEqual(prima);
    await page.clock.runFor(8000);
  }
  expect(titoli.size).toBe(4); // ha davvero mostrato offerte diverse (con e senza prezzo)
});

test("quantità: lista con prezzo al kg, modifica, errori chiari", async ({ page, request }) => {
  await apri(page);
  await expect(riga(page, "Focaccia").locator(".riga-sotto")).toHaveText("2,50 € per 100 g (25,00 €/kg)");
  await riga(page, "Focaccia").locator("button.riga").click();
  await expect(foglio(page).getByLabel("Quantità (facoltativa)")).toHaveValue("100 g");
  await foglio(page).getByLabel("Quantità (facoltativa)").fill("3 pezzi");
  await fatto(page).click();
  await expect(page.locator("#err-quantita")).toHaveText("Scrivi la quantità così: 100 g, 1 kg, 500 ml");
  await foglio(page).getByLabel("Quantità (facoltativa)").fill("1,5 kg");
  await fatto(page).click();
  await expect(foglio(page)).toBeHidden();
  expect((await config(request)).slides[1]).toMatchObject({ prezzo: 250, quantita: { valore: 1500, unita: "g" } });
  await expect(riga(page, "Focaccia").locator(".riga-sotto")).toHaveText("2,50 € per 1,5 kg (1,67 €/kg)");
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).getByLabel("Prezzo").fill("");
  await fatto(page).click();
  await expect(page.locator("#err-quantita")).toHaveText("Per la quantità serve anche il prezzo.");
  await foglio(page).getByLabel("Quantità (facoltativa)").fill("");
  await fatto(page).click();
  await expect(foglio(page)).toBeHidden();
  expect((await config(request)).slides[1]!.quantita).toBeUndefined();
});

test("QR dal foglio Negozio: https aggiunto da solo, errori chiari, si toglie svuotando", async ({ page, request }) => {
  await apri(page);
  await page.getByRole("button", { name: /Nome, orari e QR/ }).click();
  const f = page.locator("#foglio-negozio");
  await f.getByLabel("Link del QR (facoltativo)").fill("g.page/r/esempio");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#err-qr-testo")).toHaveText("Scrivi cosa trova chi inquadra il QR.");
  await f.getByLabel("Scritta sotto il QR").fill("Lasciaci una recensione");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  expect((await config(request)).negozio).toMatchObject({ qr: { url: "https://g.page/r/esempio", testo: "Lasciaci una recensione" } });
  await page.getByRole("button", { name: /Nome, orari e QR/ }).click();
  await f.getByLabel("Link del QR (facoltativo)").fill("javascript:alert(1)");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#err-qr-url")).toContainText("indirizzo completo");
  await f.getByLabel("Link del QR (facoltativo)").fill("");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  expect((await config(request)).negozio.qr).toBeUndefined();
});

test("tema e barra dal foglio Aspetto: anteprima subito, si salvano, 'Torna come prima' li riporta", async ({ page, request }) => {
  await apri(page);
  await page.locator("#apri-aspetto").click();
  const f = page.locator("#foglio-aspetto");
  const temi = f.getByRole("group", { name: "Tema stagionale" });
  const barra = f.getByRole("group", { name: "Barra della TV" });
  await expect(temi.getByRole("button")).toHaveCount(6);
  await expect(barra.getByRole("button", { name: /Sopra/ })).toHaveAttribute("aria-pressed", "true");
  await expect(barra.getByRole("button", { name: /Sopra/ })).toContainText("Consigliata");
  await expect(f.locator("#fa-zona-prima")).toBeHidden();
  await temi.getByRole("button", { name: /Black Friday/ }).click();
  await barra.getByRole("button", { name: /Sotto/ }).click();
  await expect(f.locator("#fa-anteprima")).toHaveAttribute("data-tema", "blackfriday");
  await expect(f.locator("#fa-anteprima")).toHaveAttribute("data-barra", "sotto");
  await expect(f.locator("#fa-zona-prima")).toBeVisible();
  await f.getByRole("button", { name: "Torna come prima" }).click();
  await expect(f.locator("#fa-anteprima")).toHaveAttribute("data-tema", "");
  await expect(f.locator("#fa-anteprima")).toHaveAttribute("data-barra", "sopra");
  await temi.getByRole("button", { name: /Pasqua/ }).click();
  await barra.getByRole("button", { name: /Nascosta/ }).click();
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  const c = await config(request);
  expect(c.tema).toBe("pasqua");
  expect(c.negozio.barra).toEqual({ posizione: "nascosta" });
  await expect(page.locator(".anteprima")).toHaveAttribute("data-tema", "pasqua");
  await expect(page.locator("#aspetto-sotto")).toContainText("tema pasqua");
  await page.locator("#apri-aspetto").click();
  await temi.getByRole("button", { name: /Nessuno/ }).click();
  await barra.getByRole("button", { name: /Sopra/ }).click();
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  const d = await config(request);
  expect(d.tema).toBeUndefined();
  expect(d.negozio.barra).toBeUndefined();
});

test("palette di Natale: solo con Natale e i colori del tema, si salva, «I miei colori» la toglie", async ({ page, request }) => {
  await apri(page);
  await page.locator("#apri-aspetto").click();
  const f = page.locator("#foglio-aspetto");
  const palette = f.getByRole("group", { name: "Palette di Natale" });
  await expect(palette).toBeHidden();
  await f.getByRole("group", { name: "Tema stagionale" }).getByRole("button", { name: /Natale/ }).click();
  await expect(palette.getByRole("button")).toHaveCount(4);
  await expect(palette.getByRole("button", { name: /Classico/ })).toHaveAttribute("aria-pressed", "true");
  await palette.getByRole("button", { name: /Nordico/ }).click();
  await expect(palette.locator('[data-valore="nordico"] .mini-tv')).toHaveAttribute("data-tema-variante", "nordico");
  await expect(f.locator("#fa-anteprima")).toHaveAttribute("data-tema-variante", "nordico");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  const c = await config(request);
  expect(c.tema).toBe("natale");
  expect(c.temaVariante).toBe("nordico");
  await expect(page.locator(".anteprima")).toHaveAttribute("data-tema-variante", "nordico");
  await expect(page.locator("#aspetto-sotto")).toContainText("tema natale nordico");
  await page.locator("#apri-aspetto").click();
  await f.getByRole("group", { name: "Colori con il tema" }).getByRole("button", { name: /I miei colori/ }).click();
  await expect(palette).toBeHidden();
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  const d = await config(request);
  expect(d.temaColori).toBe("negozio");
  expect(d.temaVariante).toBeUndefined();
});

test("foglio Negozio: orari, città del meteo (ricerca finta) e testo della barra", async ({ page, request }) => {
  await page.route("**/api/citta?q=*", (r) => r.fulfill({ json: { citta: [{ nome: "Torino, Piemonte", lat: 45.07, lon: 7.69 }] } }));
  await apri(page);
  await page.getByRole("button", { name: /Nome, orari e QR/ }).click();
  const f = page.locator("#foglio-negozio");
  await f.getByRole("button", { name: "Aggiungi un orario" }).click();
  await f.getByLabel("Chiude alle").fill("18:30");
  await f.getByLabel("Città", { exact: true }).fill("Tori");
  await f.getByRole("button", { name: "Torino, Piemonte" }).click();
  await expect(f.locator("#fn-citta-nota")).toHaveText("Meteo di Torino, Piemonte");
  await f.getByLabel("Testo (facoltativo)").fill("Pane caldo alle 17");
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  const n = (await config(request)).negozio;
  expect(n.orari).toEqual([{ giorni: [1, 2, 3, 4, 5], da: "09:00", a: "18:30" }]);
  expect(n.citta).toEqual({ nome: "Torino, Piemonte", lat: 45.07, lon: 7.69 });
  expect(n.barra).toEqual({ testo: "Pane caldo alle 17" });
  await page.getByRole("button", { name: /Nome, orari e QR/ }).click();
  await f.getByRole("button", { name: "Togli il meteo" }).click();
  await f.getByRole("button", { name: "Togli l'orario 1" }).click();
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  const m = (await config(request)).negozio;
  expect(m.citta).toBeUndefined();
  expect(m.orari).toBeUndefined();
});

test("foto: la carico dal telefono (ridotta, senza dati del telefono), va in lista, anteprima e TV; poi la tolgo", async ({ page, browser, request }) => {
  await apri(page);
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).locator("#fo-foto-file").setInputFiles({ name: "focaccia.png", mimeType: "image/png", buffer: pngFinto(2400, 1800) });
  await expect(page.locator("#fo-foto-stato")).toHaveText(/Foto pronta/);
  await expect(page.locator("#fo-foto")).toBeVisible();
  await expect(foglio(page).getByText("Cambia foto")).toBeVisible();
  await fatto(page).click();
  await expect(foglio(page)).toBeHidden();
  const s = (await config(request)).slides.find((x) => x.titolo.startsWith("Focaccia"))!;
  expect(s.foto).toMatch(/^[a-f0-9]{16}\.(png|jpg)$/);
  const b = await (await request.get(`/foto/${s.foto}`)).body();
  expect(infoFoto(b, tipoFoto(b)!)).toEqual({ larghezza: 1600, altezza: 1200, metadati: false });
  await expect(riga(page, "Focaccia").locator("img.lista-foto")).toBeVisible();

  const tv = await browser.newPage();
  await apriTv(tv);
  for (let i = 0; i < 10 && (await tv.locator("body").getAttribute("data-slide")) !== s.id; i++) await tv.clock.runFor(8000);
  await expect(tv.locator("body")).toHaveAttribute("data-foto", "1");
  await expect(tv.locator("#foto")).toBeVisible();
  expect(await tv.locator("#foto").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1600);
  const r = await tv.locator("#slide").boundingBox();
  expect(r!.x + r!.width).toBeLessThanOrEqual(1920);
  expect(r!.y + r!.height).toBeLessThanOrEqual(1080);
  await tv.close();

  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).getByRole("button", { name: "Togli foto" }).click();
  await fatto(page).click();
  await expect(foglio(page)).toBeHidden();
  expect((await config(request)).slides.find((x) => x.id === s.id)!.foto).toBeUndefined();
  await expect(riga(page, "Focaccia").locator("img.lista-foto")).toHaveCount(0);
});

test("foto: un file che non è una foto dà un errore chiaro e non cambia niente", async ({ page, request }) => {
  await apri(page);
  await riga(page, "Focaccia").locator("button.riga").click();
  await foglio(page).locator("#fo-foto-file").setInputFiles({ name: "listino.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 finto") });
  await expect(page.locator("#err-foto")).toHaveText(/Non riesco ad aprire questo file/);
  await expect(foglio(page).getByText("Aggiungi foto")).toBeVisible();
  await fatto(page).click();
  expect((await config(request)).slides.every((x) => !x.foto)).toBe(true);
});

const fogliColori = (page: Page) => page.locator("#foglio-colori");
async function conMarchio(request: import("@playwright/test").APIRequestContext) {
  const c = demoCopia();
  (c.negozio as Record<string, unknown>).marchio = { ...c.negozio.colori };
  await imposta(request, c);
}

test("colori: una combinazione pronta va sulla TV; poi Torna ai colori del negozio", async ({ page, request, browser }) => {
  await conMarchio(request);
  await apri(page);
  await expect(page.locator("#colori-sotto")).toHaveText("Colori del negozio");
  await page.locator("#apri-colori").click();
  await expect(fogliColori(page).locator(".combinazione")).toHaveCount(COMBINAZIONI.length);
  await expect(fogliColori(page).locator("#fc-zona-marchio")).toBeHidden();
  await fogliColori(page).getByRole("button", { name: "Mare" }).click();
  await expect(fogliColori(page).getByRole("button", { name: "Mare" })).toHaveAttribute("aria-pressed", "true");
  await fogliColori(page).getByRole("button", { name: "Fatto" }).click();
  await expect(fogliColori(page)).toBeHidden();
  await expect(page.locator("#colori-sotto")).toHaveText("Mare");
  expect((await config(request)).negozio.colori).toEqual(COMBINAZIONI.find((x) => x.id === "mare")!.colori);
  const tv = await browser.newPage();
  await apriTv(tv);
  // A136: la testata non è più piena di primario; il colore arriva alla TV come variabile da cui escono fondo e superfici
  const mare = COMBINAZIONI.find((x) => x.id === "mare")!.colori.primario;
  await expect.poll(() => tv.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primario").trim().toLowerCase())).toBe(mare.toLowerCase());
  await tv.close();
  await page.locator("#apri-colori").click();
  await fogliColori(page).getByRole("button", { name: "Torna ai colori del negozio" }).click();
  await fogliColori(page).getByRole("button", { name: "Fatto" }).click();
  await expect(page.locator("#colori-sotto")).toHaveText("Colori del negozio");
});

test("colori: Scegli tu con un colore solo, il resto calcolato e leggibile", async ({ page, request }) => {
  await apri(page);
  await page.locator("#apri-colori").click();
  await fogliColori(page).getByLabel(/Un colore/).fill("#ffff00"); // giallo: il caso più difficile
  await expect(fogliColori(page).locator("#fc-avviso")).toBeHidden();
  await fogliColori(page).getByRole("button", { name: "Fatto" }).click();
  await expect(fogliColori(page)).toBeHidden();
  const c = (await config(request)).negozio;
  expect(problemiColori(c.colori)).toEqual([]);
  expect(c.contrastoLibero).toBeUndefined();
  await expect(page.locator("#colori-sotto")).toHaveText("Scelti da te");
});

test("colori: scelte che si leggono male → avviso col motivo; Usa lo stesso le salva così", async ({ page, request }) => {
  await apri(page);
  await page.locator("#apri-colori").click();
  await fogliColori(page).getByText("Ogni colore, uno per uno").click();
  await fogliColori(page).getByLabel("Prezzi").fill("#2a1d12");
  await expect(fogliColori(page).locator("#fc-avviso")).toContainText("I prezzi si confondono con lo sfondo");
  await fogliColori(page).getByRole("button", { name: "Fatto" }).click();
  const d = page.locator("#conferma-colori");
  await expect(d).toBeVisible();
  await expect(d).toContainText("I prezzi si confondono con lo sfondo");
  await d.getByRole("button", { name: "Usa lo stesso" }).click();
  await expect(fogliColori(page)).toBeHidden();
  const c = (await config(request)).negozio;
  expect(c.colori.accento).toBe("#2a1d12");
  expect(c.contrastoLibero).toBe(true);
  await expect(page.locator("#colori-sotto")).toHaveText("Scelti da te · si leggono male");
});

test("colori: Sistema tu cambia solo quanto basta e salva", async ({ page, request }) => {
  await apri(page);
  const prima = (await config(request)).negozio.colori;
  await page.locator("#apri-colori").click();
  await fogliColori(page).getByText("Ogni colore, uno per uno").click();
  await fogliColori(page).getByLabel("Prezzi").fill("#2a1d12");
  await fogliColori(page).getByRole("button", { name: "Fatto" }).click();
  await page.locator("#conferma-colori").getByRole("button", { name: "Sistema tu" }).click();
  await expect(fogliColori(page)).toBeHidden();
  const c = (await config(request)).negozio;
  expect(problemiColori(c.colori)).toEqual([]);
  expect({ ...c.colori, accento: prima.accento }).toEqual(prima);
  expect(c.contrastoLibero).toBeUndefined();
});

test("aspetto: nome e logo in basso e grandi, la TV cambia; Torna come prima; Consigliato non si salva", async ({ page, request, browser }) => {
  await apri(page);
  await expect(page.locator("#aspetto-sotto")).toHaveText("Consigliato · 8 secondi per offerta");
  await page.locator("#apri-aspetto").click();
  const f = page.locator("#foglio-aspetto");
  await expect(f.getByRole("group", { name: "Nome e logo" }).getByRole("button")).toHaveCount(4);
  await expect(f.getByRole("button", { name: /In alto a sinistra/ })).toHaveAttribute("aria-pressed", "true");
  await expect(f.locator("#fa-zona-prima")).toBeHidden();
  await f.getByRole("button", { name: /In basso/ }).click();
  await f.getByRole("button", { name: /^Grande/ }).click();
  await expect(f.locator("#fa-anteprima")).toHaveAttribute("data-testata", "basso");
  await expect(f.locator("#fa-zona-prima")).toBeVisible();
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden();
  expect((await config(request)).aspetto).toEqual({ testata: "basso", logo: "grande" });
  await expect(page.locator("#aspetto-sotto")).toHaveText("Nome e logo: in basso · Misura del nome e del logo: grande · 8 secondi per offerta");

  const tv = await browser.newPage();
  await apriTv(tv);
  await expect(tv.locator("body")).toHaveAttribute("data-testata", "basso");
  const h = (await tv.locator("header").boundingBox())!;
  // la testata sta in fondo; la barra (consigliata: sopra) resta in cima; tile dentro il margine di 3vh (A141)
  expect(h.y + h.height).toBeCloseTo(1080 * 0.97, 0);
  expect((await tv.locator("#barra").boundingBox())!.y).toBeLessThan(1080 * 0.03 + 2);
  await tv.close();

  await page.locator("#apri-aspetto").click();
  await f.getByRole("button", { name: /In alto a sinistra/ }).click();
  await f.getByRole("button", { name: /Normale/ }).click();
  await f.getByRole("button", { name: "Fatto" }).click();
  await expect(f).toBeHidden(); // il salvataggio è finito: prima si leggerebbe la configurazione vecchia
  expect((await config(request)).aspetto).toBeUndefined();
});

test("aspetto: Torna come prima rimette le scelte di quando si è aperto il foglio", async ({ page }) => {
  await apri(page);
  await page.locator("#apri-aspetto").click();
  const f = page.locator("#foglio-aspetto");
  await f.getByRole("button", { name: /Nascosti/ }).click();
  await f.getByRole("button", { name: "Torna come prima" }).click();
  await expect(f.getByRole("button", { name: /In alto a sinistra/ })).toHaveAttribute("aria-pressed", "true");
  await expect(f.locator("#fa-zona-prima")).toBeHidden();
});
