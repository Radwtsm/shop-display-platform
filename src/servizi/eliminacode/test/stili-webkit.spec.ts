// A139: gli stili dell'Eliminacode devono applicarsi anche in WebKit (Safari/iPhone), dove la CSP `style-src 'self'`
// blocca i fogli costruiti dal codice (adoptedStyleSheets). Il WebKit di Playwright (27.2) NON rifiuta ancora quei
// fogli (provato: console pulita e stile applicato anche col codice vecchio), Safari/iPhone sì: per questo oltre a
// stile e console il test esige la causa, cioè nessun foglio costruito e un <link rel=stylesheet> del servizio.
import { expect, test, type Page } from "@playwright/test";
import { PORTA_DUE, TOKEN } from "../../../../playwright.config.ts";

test.use({ browserName: "webkit", baseURL: `http://127.0.0.1:${PORTA_DUE}` });

function erroriStile(page: Page) {
  const e: string[] = [];
  page.on("console", (m) => {
    if (/Refused to apply a stylesheet/i.test(m.text())) e.push(m.text());
  });
  return e;
}

test("TV: lo stile eq- è applicato e la CSP non rifiuta fogli", async ({ page }) => {
  const errori = erroriStile(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/player.html");
  const numero = page.locator('.zona[data-servizio="eliminacode"] .eq-numero');
  await expect(numero).toBeVisible();
  await expect(numero).toHaveCSS("font-weight", "800"); // il peso del riquadro (mockup A136) viene solo da eliminacode-tv.css
  expect(errori).toEqual([]);
  await expect.poll(() => page.evaluate(() => document.adoptedStyleSheets.length)).toBe(0);
  await expect(page.locator('link[rel=stylesheet][href="/eliminacode-tv.css"]')).toHaveCount(1);
});

test("pannello: lo stile eq- è applicato e la CSP non rifiuta fogli", async ({ page }) => {
  const errori = erroriStile(page);
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto(`/panel.html#t=${TOKEN}`);
  const numero = page.locator(".eq-p-numero");
  await expect(numero).toBeVisible();
  await expect(numero).toHaveCSS("font-weight", "900");
  expect(errori).toEqual([]);
  await expect.poll(() => page.evaluate(() => document.adoptedStyleSheets.length)).toBe(0);
  await expect(page.locator('link[rel=stylesheet][href="/eliminacode-pannello.css"]')).toHaveCount(1);
});
