import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { coloriDalLogo } from "../personalizza.ts";

// Logo finto disegnato nel browser: sfondo bianco, scritta nera, cerchio rosso
async function logo(browser: import("@playwright/test").Browser, tipo: "png" | "jpeg" | "webp"): Promise<string> {
  const p = await browser.newPage();
  const url = await p.evaluate((t) => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 200;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 400, 200);
    x.fillStyle = "#c0392b";
    x.beginPath();
    x.arc(100, 100, 80, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#111";
    x.font = "bold 40px sans-serif";
    x.fillText("Forno", 200, 115);
    return c.toDataURL(`image/${t}`, 0.9);
  }, tipo);
  await p.close();
  const f = join(mkdtempSync(join(tmpdir(), "logo-")), `logo.${tipo}`);
  writeFileSync(f, Buffer.from(url.split(",")[1]!, "base64"));
  return f;
}

for (const tipo of ["png", "jpeg", "webp"] as const)
  test(`colori dal logo ${tipo}: barra del rosso del logo`, async ({ browser }) => {
    const c = (await coloriDalLogo(browser, await logo(browser, tipo)))!;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.primario.slice(i, i + 2), 16));
    expect(r! - Math.max(g!, b!)).toBeGreaterThan(80);
  });
