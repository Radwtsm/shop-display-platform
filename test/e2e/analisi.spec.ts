import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { leggiProfilo } from "../../scripts/analisi/core.ts";
import { creaAnalisi, misuraSito } from "../../scripts/analisi.ts";

test("analisi presenza online: misura il nostro minisito e stampa una pagina sola", async ({ browser, baseURL }) => {
  test.setTimeout(60_000);
  const s = await misuraSito(browser, `${baseURL}/sito.html`);
  expect(s).toMatchObject({ raggiunto: true, mobile: true, problemi: 0, contrasto: 0 });
  expect(s.lcpMs).not.toBeNull();
  expect((await misuraSito(browser, "http://127.0.0.1:9/")).raggiunto).toBe(false);

  const p = leggiProfilo({ displayName: { text: "Forno <b>Esempio</b>" }, primaryType: "bakery", rating: 4.2, userRatingCount: 8 })!;
  const pdf = readFileSync(await creaAnalisi(browser, p, s));
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
});
