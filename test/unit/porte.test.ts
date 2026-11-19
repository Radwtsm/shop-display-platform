import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// Le porte degli e2e stanno solo in playwright.config.ts: uno spec che se ne calcola una ha già fatto partire due
// server sulla stessa porta (vetrina.spec +200 = PORTA_TUTTI, 11/11) e preso la 4173 occupata da un altro agente.
const spec = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === "node_modules" ? [] : spec(join(dir, e.name))) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
  );

test("nessun test si calcola una porta da solo: tutte da playwright.config.ts", () => {
  const colpevoli = [...spec("test"), ...spec("src/servizi")].filter((f) => !f.endsWith("porte.test.ts") && /E2E_PORTA|\b4173\b/.test(readFileSync(f, "utf8")));
  expect(colpevoli).toEqual([]);
});
