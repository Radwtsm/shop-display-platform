import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { PROFILO_ESEMPIO } from "../../scripts/analisi/core.ts";
import { esempio } from "../../scripts/resoconto/core.ts";
import { creaResoconto } from "../../scripts/resoconto.ts";

test("resoconto prima/dopo: una pagina sola, anche con molte cose fatte", async ({ browser }) => {
  const [a, b] = esempio({ ...PROFILO_ESEMPIO, nome: "Forno <b>Esempio</b>" });
  const fatto = ["QR delle recensioni al banco", "10 foto nuove su Google", "Orari aggiornati", "Minisito leggibile dal telefono"];
  const file = await creaResoconto(browser, a, { ...b, sito: { indirizzo: "https://forno.example", raggiunto: true, mobile: true, lcpMs: 900, problemi: 0, contrasto: 0 } }, fatto, true);
  const pdf = readFileSync(file);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
});
