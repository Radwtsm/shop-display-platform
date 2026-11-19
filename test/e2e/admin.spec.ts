import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { IPHONE_XR } from "./aiuti.ts";

const RIFERIMENTO = new Date("2026-10-27T09:00:00Z"); // = "riferimento" dei dati finti: la demo non si sposta
const TAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function apri(page: Page, sezione = "") {
  await page.clock.install({ time: RIFERIMENTO });
  await page.goto(`/admin.html${sezione}`);
  await expect(page.locator("body")).toHaveAttribute("data-pronto", "1");
}

/** Niente esce dal suo riquadro o dalla pagina. */
async function nienteDeborda(page: Page) {
  const fuori = await page.evaluate(() => {
    const out: string[] = [];
    if (document.documentElement.scrollWidth > innerWidth) out.push(`pagina ${document.documentElement.scrollWidth} > ${innerWidth}`);
    for (const box of document.querySelectorAll<HTMLElement>(".riquadro, .riga, .avviso-scheda"))
      if (box.offsetParent && box.scrollWidth > box.clientWidth + 1) out.push(`${box.className}: ${box.textContent?.trim().slice(0, 40)}`);
    return out;
  });
  expect(fuori).toEqual([]);
}

test("panoramica: numeri e avvisi giusti", async ({ page }) => {
  await apri(page);
  await expect(page.locator("#k-clienti")).toHaveText("6");
  await expect(page.locator("#t-panoramica")).toHaveText("Buongiorno");
  await expect(page.locator("#data-oggi")).toHaveText("martedì 27 ottobre");
  await expect(page.locator("#k-dispositivi")).toHaveText("8 di 9");
  await expect(page.locator("#k-dispositivi-nota")).toHaveText("■1 spento");
  await expect(page.locator("#servizi-panoramica li")).toHaveCount(3);
  await expect(page.locator("#k-canoni")).toHaveText("234 €");
  await expect(page.locator("#k-avvisi")).toHaveText("3");
  await expect(page.locator("#lista-avvisi li")).toHaveCount(3);
  await expect(page.locator("#lista-avvisi li").first()).toContainText("Bar Esempio: TV cassa spenta da 2 h");
});

test("un avviso apre la scheda del cliente", async ({ page }) => {
  await apri(page);
  await page.locator("#lista-avvisi li").first().getByRole("button").click();
  const s = page.locator("#scheda");
  await expect(s).toBeVisible();
  await expect(s.locator("#sc-nome")).toHaveText("Bar Esempio");
  await expect(s.locator("#sc-avvisi")).toContainText("TV cassa spenta da 2 h");
  await expect(s.getByRole("list", { name: "Schermo: apparecchi" }).locator("li")).toHaveCount(2);
  await expect(s.locator("#sc-corpo")).toContainText("Menu QR · 20,00 €/mese");
  await expect(s.locator("#sc-corpo")).toContainText("Funziona dal telefono del cliente");
  await expect(s.locator("#sc-canone dd")).toHaveText("49,00 € al mese");
  await s.getByRole("button", { name: "Fine" }).click();
  await expect(s).toBeHidden();
});

test("clienti: ricerca senza accenti né maiuscole", async ({ page }) => {
  await apri(page, "#clienti");
  await expect(page.locator("#lista-clienti li")).toHaveCount(6);
  await page.getByLabel("Cerca tra i clienti").fill("FARMÀCIA");
  await expect(page.locator("#lista-clienti li")).toHaveCount(1);
  await page.getByLabel("Cerca tra i clienti").fill("centro");
  await expect(page.locator("#lista-clienti li")).toHaveCount(2);
  await page.getByLabel("Cerca tra i clienti").fill("nessuno così");
  await expect(page.locator("#nessun-cliente")).toBeVisible();
});

test("servizi: attivi con i loro numeri, poi quelli in arrivo", async ({ page }) => {
  await apri(page, "#servizi");
  await expect(page.locator("#servizi-sopra")).toHaveText("3 attivi · 6 in arrivo");
  await expect(page.locator("#servizi-attivi li")).toHaveText([/Schermo.*5 clienti · 145\s€\/mese.*6 di 7 TV/s, /Eliminacode.*2 clienti.*2 di 2 display/s, /Menu QR.*1 cliente/s]);
  await expect(page.locator("#servizi-in-arrivo li")).toHaveCount(6);
});

test("servizio: avvisi col nome del negozio, prima gli apparecchi spenti, un cliente si apre dal foglio", async ({ page }) => {
  await apri(page, "#servizi");
  await page.locator("#servizi-attivi li").first().getByRole("button").click();
  const s = page.locator("#scheda");
  await expect(s.locator("#sc-nome")).toHaveText("Schermo");
  await expect(s.locator("#sc-avvisi")).toContainText("Bar Esempio, TV cassa spenta da 2 h");
  await expect(s.locator("#sc-avvisi")).not.toContainText("ripristino");
  const tv = s.getByRole("list", { name: "Schermo: apparecchi" }).locator("li");
  await expect(tv).toHaveCount(7);
  await expect(tv.first()).toContainText("TV cassa · Bar Esempio");
  await expect(tv.first()).toContainText("Spenta da 2 h");
  await expect(s.getByRole("list", { name: "Schermo: apparecchi" })).toContainText("versione 0.2.1 · da aggiornare");
  await s.getByRole("list", { name: "Clienti di Schermo" }).getByRole("button", { name: /Bar Esempio/ }).click();
  await expect(s.locator("#sc-nome")).toHaveText("Bar Esempio");
});

test("navigazione: la sezione attiva è segnata", async ({ page }) => {
  await apri(page);
  await page.getByRole("link", { name: "Clienti" }).click();
  await expect(page.locator("#sez-clienti")).toBeVisible();
  await expect(page.getByRole("link", { name: "Clienti" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#sez-panoramica")).toBeHidden();
});

for (const [nome, vista] of [["mac", { width: 1440, height: 900 }], ["ipad", { width: 820, height: 1180 }]] as const) {
  test(`${nome}: niente deborda, accessibilità e aspetto`, async ({ page }) => {
    await page.setViewportSize(vista);
    await apri(page);
    await nienteDeborda(page);
    const a = await new AxeBuilder({ page }).withTags([...TAG]).analyze();
    expect(a.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await expect(page).toHaveScreenshot(`admin-${nome}.png`);
  });
}

test.describe("telefono", () => {
  test.use(IPHONE_XR);
  for (const schema of ["light", "dark"] as const) {
    test(`iPhone XR ${schema}: niente deborda, tocchi ≥ 48 px, accessibilità, aspetto`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: schema, reducedMotion: "reduce" });
      await apri(page);
      await nienteDeborda(page);
      const piccoli = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".navigazione a, button")]
          .filter((e) => e.offsetParent)
          .map((e) => ({ t: e.textContent?.trim().slice(0, 30), r: e.getBoundingClientRect() }))
          .filter(({ r }) => r.height < 48 || r.width < 48)
          .map(({ t, r }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
      );
      expect(piccoli).toEqual([]);
      const a = await new AxeBuilder({ page }).withTags([...TAG]).analyze();
      expect(a.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      await expect(page).toHaveScreenshot(`admin-iphone-${schema}.png`);
      await page.locator("#lista-avvisi li").first().getByRole("button").click();
      await nienteDeborda(page);
      const b = await new AxeBuilder({ page }).withTags([...TAG]).analyze();
      expect(b.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      await expect(page).toHaveScreenshot(`admin-iphone-scheda-${schema}.png`);
    });
  }
  test("320 px: niente deborda", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await apri(page);
    await nienteDeborda(page);
    await page.goto("/admin.html#clienti");
    await nienteDeborda(page);
  });
});

for (const [nome, vista] of [["iphone", { width: 414, height: 896 }], ["mac", { width: 1440, height: 900 }]] as const) {
  test(`${nome}: il titolo sta nello stesso punto in ogni sezione`, async ({ page }) => {
    await page.setViewportSize(vista);
    await apri(page);
    const posizioni: Record<string, number[]> = {};
    for (const sezione of ["panoramica", "clienti", "servizi"]) {
      await page.mouse.wheel(0, 600);
      // la rotella scorre in modo animato: se finisce dopo il clic, sposta la pagina tra una misura e l'altra
      await page.waitForFunction(() => new Promise((ok) => {
        const y = scrollY;
        requestAnimationFrame(() => requestAnimationFrame(() => ok(scrollY === y)));
      }));
      await page.getByRole("link", { name: sezione[0]!.toUpperCase() + sezione.slice(1) }).click();
      await expect(page.locator(`#sez-${sezione} h1`)).toBeVisible();
      await expect.poll(() => page.evaluate(() => scrollY), { message: `${sezione}: la pagina parte dall'alto` }).toBe(0);
      posizioni[sezione] = await page.locator(`#sez-${sezione}`).evaluate((s) => {
        const sopra = s.querySelector(".sopratitolo")!.getBoundingClientRect();
        const h1 = s.querySelector("h1")!.getBoundingClientRect();
        return [Math.round(sopra.y), Math.round(h1.y), Math.round(h1.x)];
      });
    }
    expect(posizioni.clienti).toEqual(posizioni.panoramica);
    expect(posizioni.servizi).toEqual(posizioni.panoramica);
  });
}

test("riquadri: 2×2 o 4 in fila a ogni larghezza, mai uno da solo", async ({ page }) => {
  for (const width of [320, 414, 600, 800, 820, 1000, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await apri(page);
    const righe = await page.locator(".riquadro").evaluateAll((els) => {
      const per = new Map<number, number>();
      for (const e of els) {
        const y = Math.round(e.getBoundingClientRect().top);
        per.set(y, (per.get(y) ?? 0) + 1);
      }
      return [...per.values()];
    });
    expect([[2, 2], [4]], `${width}px: ${JSON.stringify(righe)}`).toContainEqual(righe);
  }
});
