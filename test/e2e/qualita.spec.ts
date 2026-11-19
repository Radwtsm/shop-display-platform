import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { TOKEN } from "../../playwright.config.ts";
import { imposta, IPHONE_XR, MARTEDI_9, TV } from "./aiuti.ts";

test.beforeEach(async ({ request }) => imposta(request));

// Budget (METODO → Sicurezza e prestazioni): misurati su un telefono lento simulato (CPU 4× più lenta, 4G lento).
const BUDGET = { lcp: 2500, cls: 0.1, inp: 200, jsGzip: 50 * 1024, cssGzip: 15 * 1024 };

async function lento(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });
}

async function osserva(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __m: { lcp: number; cls: number; inp: number; csp: string[] } };
    w.__m = { lcp: 0, cls: 0, inp: 0, csp: [] };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__m.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => {
      const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!s.hadRecentInput) w.__m.cls += s.value;
    })).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__m.inp = Math.max(w.__m.inp, e.duration)))).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    document.addEventListener("securitypolicyviolation", (e) => w.__m.csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
}
const misure = (page: Page) => page.evaluate(() => (window as unknown as { __m: Misure }).__m);

type Misure = { lcp: number; cls: number; inp: number; csp: string[] };
const RIPETIZIONI = 3; // come Lighthouse CI: più misure e la mediana, una sola misura sotto carico non è affidabile
const mediana = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

async function misuraMediana(browser: import("@playwright/test").Browser, opzioni: object, giro: (p: Page) => Promise<void>) {
  const tutte: Misure[] = [];
  for (let i = 0; i < RIPETIZIONI; i++) {
    const ctx = await browser.newContext(opzioni);
    const page = await ctx.newPage();
    await osserva(page);
    await lento(page);
    await giro(page);
    await page.waitForTimeout(500);
    tutte.push(await misure(page));
    await ctx.close();
  }
  return {
    lcp: mediana(tutte.map((m) => m.lcp)),
    cls: mediana(tutte.map((m) => m.cls)),
    inp: mediana(tutte.map((m) => m.inp)),
    csp: tutte.flatMap((m) => m.csp),
    tutte: JSON.stringify(tutte.map(({ lcp, cls, inp }) => ({ lcp: Math.round(lcp), cls, inp: Math.round(inp) }))),
  };
}

test("TV: LCP e CLS nel budget su dispositivo lento, nessun blocco CSP", async ({ browser, baseURL }) => {
  const m = await misuraMediana(browser, { viewport: TV, baseURL }, async (page) => {
    await page.goto("/player.html");
    await expect(page.locator("#titolo")).not.toHaveText("");
  });
  expect(m.csp).toEqual([]);
  expect(m.lcp, m.tutte).toBeGreaterThan(0);
  expect(m.lcp, m.tutte).toBeLessThanOrEqual(BUDGET.lcp);
  expect(m.cls, m.tutte).toBeLessThanOrEqual(BUDGET.cls);
});

test("pannello: LCP, CLS e reattività al tocco nel budget su telefono lento, nessun blocco CSP", async ({ browser, baseURL }) => {
  const m = await misuraMediana(browser, { ...IPHONE_XR, baseURL }, async (page) => {
    await page.clock.install({ time: MARTEDI_9 });
    await page.goto(`/panel.html#t=${TOKEN}`);
    await expect(page.locator("#offerte li")).toHaveCount(5);
    await page.locator("#offerte li button.riga").first().click();
    await expect(page.locator("#foglio-offerta")).toBeVisible();
  });
  expect(m.csp).toEqual([]);
  expect(m.lcp, m.tutte).toBeGreaterThan(0);
  expect(m.lcp, m.tutte).toBeLessThanOrEqual(BUDGET.lcp);
  expect(m.cls, m.tutte).toBeLessThanOrEqual(BUDGET.cls);
  expect(m.inp, m.tutte).toBeLessThanOrEqual(BUDGET.inp);
});

test("peso: JS e CSS di ogni pagina nel budget (compressi)", () => {
  const gz = (f: string) => gzipSync(readFileSync(f)).length;
  for (const js of ["public/assets/player.js", "public/assets/panel.js"]) expect(gz(js), js).toBeLessThanOrEqual(BUDGET.jsGzip);
  for (const css of ["public/tokens.css", "public/player.css", "public/panel.css"]) expect(gz(css), css).toBeLessThanOrEqual(BUDGET.cssGzip);
});
