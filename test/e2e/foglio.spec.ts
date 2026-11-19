import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { TOKEN } from "../../playwright.config.ts";
// @ts-expect-error script JS senza tipi
import { creaFoglio } from "../../scripts/foglio.mjs";
import { imposta } from "./aiuti.ts";

test("foglio A4: una pagina sola, con nome e contatti presi da materiali/agenzia.json", async ({ request, baseURL }) => {
  test.setTimeout(60_000);
  await imposta(request);
  const pdf = readFileSync(await creaFoglio(baseURL, TOKEN));
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
  const html = readFileSync("materiali/out/foglio-a4.html", "utf8");
  expect(html).toContain('data-campo="nome"'); // i campi si riempiono con textContent, mai HTML da stringa
});
