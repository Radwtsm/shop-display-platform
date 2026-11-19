// adatta() sul codice vero (bundle esbuild al volo, iniettato in about:blank), a tre misure di TV.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { buildSync } from "esbuild";

const js = buildSync({ entryPoints: ["src/piattaforma/tv/adatta.ts"], bundle: true, write: false, format: "iife", globalName: "A", logLevel: "silent" }).outputFiles[0]!.text;
const css = readFileSync("public/adatta.css", "utf8");
const BREVE = "Pane fresco";
const LUNGO = "Focaccia con pomodorini freschi, olive taggiasche e origano di montagna appena raccolto";
const LUNGHISSIMO = Array(40).fill("Focaccia ripiena di verdure grigliate").join(" ");

async function pagina(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("about:blank");
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await page.evaluate((h) => {
    document.body.style.margin = "0";
    const d = document.createElement("div");
    d.id = "box"; d.style.width = "40vw"; d.style.fontSize = `${h * 0.08}px`; d.style.lineHeight = "1.1";
    d.style.fontFamily = "sans-serif";
    document.body.append(d);
  }, h);
}

/** Crea il testo, lo adatta e misura. */
function prova(page: Page, testo: string, righe: number, min: number) {
  return page.evaluate(([t, r, m]) => {
    const A = (window as any).A;
    const d = document.getElementById("box")!;
    const t0 = document.createElement("p");
    t0.id = "t"; t0.textContent = t as string; t0.dataset.righe = String(r); t0.dataset.min = String(m);
    t0.style.margin = "0";
    d.replaceChildren(t0);
    const cqh = innerHeight / 100;
    const base = parseFloat(getComputedStyle(t0).fontSize);
    A.adatta(t0, cqh);
    return misura(t0, base, cqh);
    function misura(e: HTMLElement, base: number, cqh: number) {
      const fs = parseFloat(getComputedStyle(e).fontSize);
      return { base, fs, min: (m as number) * cqh, classi: e.className, righe: Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).lineHeight) || fs * 1.2)), largo: e.scrollWidth > e.clientWidth + 1, nowrap: getComputedStyle(e).whiteSpace };
    }
  }, [testo, righe, min] as const);
}

for (const [w, h] of [[1280, 720], [1920, 1080], [960, 540]] as const) {
  test.describe(`${w}×${h}`, () => {
    test.beforeEach(async ({ page }) => { await pagina(page, w, h); });

    test("testo corto: font del CSS, nessuna classe", async ({ page }) => {
      const r = await prova(page, BREVE, 3, 3);
      expect(r.fs).toBeCloseTo(r.base, 1);
      expect(r.classi).toBe("");
    });

    test("testo lungo su 3 righe: scende, resta ≥ min, ≤ 3 righe", async ({ page }) => {
      const r = await prova(page, LUNGO, 3, 3);
      expect(r.fs).toBeLessThan(r.base);
      expect(r.fs).toBeGreaterThanOrEqual(r.min - 0.01);
      expect(r.classi).toContain("ridotto");
      expect(r.righe).toBeLessThanOrEqual(3);
    });

    test("testo lunghissimo: tagliato, ≤ 3 righe", async ({ page }) => {
      const r = await prova(page, LUNGHISSIMO, 3, 3);
      expect(r.classi).toContain("tagliato");
      expect(r.fs).toBeGreaterThanOrEqual(r.min - 0.01);
      expect(r.righe).toBeLessThanOrEqual(3);
    });

    test("righe=1: niente a capo, ellissi", async ({ page }) => {
      const r = await prova(page, LUNGO, 1, 3);
      expect(r.nowrap).toBe("nowrap");
      expect(r.righe).toBe(1);
      expect(r.classi).toContain("tagliato");
    });

    test("adattaLarghezza: 999 in un box stretto ci sta", async ({ page }) => {
      const r = await page.evaluate(() => {
        const A = (window as any).A;
        const d = document.getElementById("box")!;
        d.style.width = "3ch"; d.style.whiteSpace = "nowrap"; d.style.overflow = "hidden";
        d.textContent = "999";
        d.style.width = `${d.scrollWidth * 0.5}px`;
        const prima = d.scrollWidth > d.clientWidth;
        A.adattaLarghezza(d, innerHeight / 100);
        return { prima, ok: d.scrollWidth <= d.clientWidth };
      });
      expect(r.prima).toBe(true);
      expect(r.ok).toBe(true);
    });

    test("allargando il box il font RISALE", async ({ page }) => {
      await prova(page, LUNGO, 3, 3);
      const f = await page.evaluate(() => {
        const A = (window as any).A;
        const d = document.getElementById("box")!;
        const t = document.getElementById("t")!;
        const cqh = innerHeight / 100;
        t.style.fontSize = "";
        const base = parseFloat(getComputedStyle(t).fontSize);
        A.adatta(t, cqh);
        const stretto = parseFloat(getComputedStyle(t).fontSize);
        d.style.width = "95vw";
        A.adatta(t, cqh);
        return { base, stretto, largo: parseFloat(getComputedStyle(t).fontSize), classi: t.className };
      });
      expect(f.stretto).toBeLessThan(f.base);
      expect(f.largo).toBeGreaterThan(f.stretto);
      expect(f.classi).not.toContain("tagliato");
    });

    test("osservaMisura: richiama su resize e si stacca", async ({ page }) => {
      const n = await page.evaluate(async () => {
        const A = (window as any).A;
        const d = document.getElementById("box")!;
        let n = 0;
        const stacca = A.osservaMisura(d, () => n++);
        await new Promise((r) => setTimeout(r, 200));
        const dopoAvvio = n;
        d.style.width = "50vw";
        await new Promise((r) => setTimeout(r, 200));
        const dopoResize = n;
        stacca();
        d.style.width = "60vw";
        await new Promise((r) => setTimeout(r, 200));
        return { dopoAvvio, dopoResize, fine: n };
      });
      expect(n.dopoResize).toBeGreaterThan(n.dopoAvvio);
      expect(n.fine).toBe(n.dopoResize);
    });
  });
}
