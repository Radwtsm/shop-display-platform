import type { APIRequestContext, Page } from "@playwright/test";
import demo from "../../fixtures/demo.json" with { type: "json" };
import { TOKEN } from "../../playwright.config.ts";

export const MARTEDI_9 = new Date("2026-10-27T09:00:00+01:00");
export const DOMENICA_12 = new Date("2026-11-01T12:00:00+01:00");
export const TV = { width: 1920, height: 1080 };
export const IPHONE_XR = { viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export const demoCopia = () => structuredClone(demo) as typeof demo & { slides: Record<string, unknown>[] };

export async function imposta(request: APIRequestContext, config: unknown = demo) {
  const r = await request.put("/api/config", { data: config, headers: { "X-Token": TOKEN } });
  if (!r.ok()) throw new Error(`reset config: ${r.status()} ${await r.text()}`);
}

export async function config(request: APIRequestContext) {
  return (await (await request.get("/api/config")).json()) as import("../../src/servizi/schermo/core/tipi.ts").Config;
}

export async function apriTv(page: Page, quando = MARTEDI_9) {
  await page.setViewportSize(TV);
  await page.clock.install({ time: quando });
  await page.goto("/player.html");
}
