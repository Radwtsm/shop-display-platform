import { describe, expect, it } from "vitest";
// @ts-expect-error script JS senza tipi
import { controllaLicenze } from "../../scripts/licenze.mjs";

const lock = (pkgs: Record<string, { version: string; license?: string; dev?: boolean }>) => ({ packages: { "": {}, ...pkgs } });

describe("licenze", () => {
  it("permissive ammesse ovunque, scelta OR", () => {
    expect(controllaLicenze(lock({ "node_modules/a": { version: "1", license: "MIT" }, "node_modules/b": { version: "1", license: "(MIT OR GPL-3.0)" } })).problemi).toEqual([]);
  });
  it("copyleft forte mai nel prodotto né negli strumenti", () => {
    const r = controllaLicenze(lock({ "node_modules/g": { version: "1", license: "GPL-3.0-only" }, "node_modules/h": { version: "2", license: "AGPL-3.0", dev: true } }));
    expect(r.problemi).toHaveLength(2);
  });
  it("MPL/LGPL solo per gli strumenti di sviluppo", () => {
    expect(controllaLicenze(lock({ "node_modules/m": { version: "1", license: "MPL-2.0", dev: true } })).problemi).toEqual([]);
    expect(controllaLicenze(lock({ "node_modules/m": { version: "1", license: "MPL-2.0" } })).problemi).toEqual(['m@1: licenza "MPL-2.0" non ammessa nel prodotto']);
  });
  it("licenza mancante = da verificare", () => {
    expect(controllaLicenze(lock({ "node_modules/x": { version: "1", dev: true } })).problemi).toEqual(['x@1: licenza "mancante" non ammessa negli strumenti']);
  });
});
