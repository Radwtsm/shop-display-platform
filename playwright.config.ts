import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

export const TOKEN = "e2e-token";
/**
 * Tutte le porte degli e2e, solo qui (un test fallisce se uno spec se ne calcola una: `porte.test.ts`).
 * Senza E2E_PORTA la base viene dalla cartella: repo principale, worktree e agenti in parallelo non si pestano
 * (prima 4173 fissa: server di un agente rimasti accesi = e2e di un altro rossi). Sopra 20000: lontano dalle
 * porte che fetch rifiuta (Insidie: "bad port") e da :8080 di `npm start`.
 */
const daCartella = 20000 + ([...process.cwd()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 100) * 400;
const PORTA = Number(process.env.E2E_PORTA ?? daCartella);
/** Server con più servizi attivi (Eliminacode): `piuServizi` negli e2e. */
export const PORTA_DUE = PORTA + 100;
/** Server con tutti i servizi della TV (Schermo, Eliminacode, Menu QR, Vetrina): la griglia a ogni misura. */
export const PORTA_TUTTI = PORTA + 300;
/** Server propri di menu.spec e vetrina.spec (partono e si fermano da soli). */
export const PORTA_MENU = PORTA + 10;
export const PORTA_VETRINA = PORTA + 200;
/** Il meteo punta a un indirizzo morto: i test non chiamano mai Open-Meteo vero. */
export const METEO_MORTO = { METEO_BASE: "http://127.0.0.1:9", METEO_BASE_GEO: "http://127.0.0.1:9" };

export default defineConfig({
  // piattaforma in test/e2e, ogni servizio nella sua cartella
  testDir: ".",
  testMatch: ["test/e2e/**/*.spec.ts", "src/servizi/*/test/**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORTA}`, timezoneId: "Europe/Rome", locale: "it-IT" },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  webServer: [
    {
      // ricompila sempre: lanciare i test su una build vecchia fa passare o fallire cose che non esistono più
      command: "node scripts/build.mjs && node src/piattaforma/server/main.ts",
      url: `http://127.0.0.1:${PORTA}/api/config`,
      reuseExistingServer: false,
      env: { PORT: String(PORTA), HOST: "127.0.0.1", PANEL_TOKEN: TOKEN, ...METEO_MORTO, DEMO_SERVIZI: "schermo", DATA_DIR: mkdtempSync(join(tmpdir(), "schermo-e2e-")) },
    },
    {
      // lo stesso codice con più servizi attivi (Schermo + Eliminacode): non ricompila, la build l'ha fatta il primo
      command: "node src/piattaforma/server/main.ts",
      url: `http://127.0.0.1:${PORTA_DUE}/api/eliminacode`,
      reuseExistingServer: false,
      env: { PORT: String(PORTA_DUE), HOST: "127.0.0.1", PANEL_TOKEN: TOKEN, ...METEO_MORTO, DEMO_SERVIZI: "schermo,eliminacode", DATA_DIR: mkdtempSync(join(tmpdir(), "piu-servizi-e2e-")) },
    },
    {
      command: "node src/piattaforma/server/main.ts",
      url: `http://127.0.0.1:${PORTA_TUTTI}/api/negozio`,
      reuseExistingServer: false,
      env: { PORT: String(PORTA_TUTTI), HOST: "127.0.0.1", PANEL_TOKEN: TOKEN, ...METEO_MORTO, DEMO_SERVIZI: "schermo,eliminacode,menu-qr,vetrina", DATA_DIR: mkdtempSync(join(tmpdir(), "tutti-e2e-")) },
    },
  ],
});
