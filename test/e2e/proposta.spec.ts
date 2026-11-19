// Kit proposta (A102): una sezione per servizio acceso, col marchio del negozio; la TV sta nella sua cornice.
import { expect, test, type Page } from "@playwright/test";
import { demoCopia, imposta, IPHONE_XR, MARTEDI_9 } from "./aiuti.ts";

test.use(IPHONE_XR);
test.beforeEach(async ({ request, page }) => {
  await imposta(request);
  await page.clock.install({ time: MARTEDI_9 });
});

const VETRINA = {
  orari: [{ giorni: [1, 2, 3, 4, 5, 6], da: "07:00", a: "19:30" }],
  contatti: { indirizzo: "Via Esempio 12, 00100 Roma" },
  linkMenu: "/menu.html",
  qr: [{ id: "recensione", titolo: "Ti è piaciuto?", sotto: "Inquadra", testo: "https://search.google.com/local/writereview?placeid=ChIJ-esempio_FINTO123" }],
  recensioni: { fonte: "finte", elenco: [] },
  secondiPerSlide: 10,
};

async function tuttiAccesi(p: Page) {
  await p.route("**/api/negozio", async (r) => r.fulfill({ json: { ...(await (await r.fetch()).json()), servizi: ["schermo", "vetrina", "menu-qr"] } }));
  await p.route("**/api/vetrina/sito", (r) => r.fulfill({ json: VETRINA }));
}

const voci = (p: Page) => p.locator(".navigazione a:visible");

test("solo le sezioni dei servizi accesi; la prima è aperta", async ({ page }) => {
  await page.goto("/proposta.html");
  await expect(page.locator("body")).toHaveAttribute("data-pronto", "1");
  await expect(voci(page)).toHaveText(["TV", "Volantino"]);
  await expect(page.locator("#sez-tv")).toBeVisible();
  await expect(page.locator(".navigazione a[aria-current=page]")).toHaveText("TV");
});

test("col marchio del negozio: nome, colori, offerte e prezzi della TV nel volantino", async ({ page, request }) => {
  const c = demoCopia();
  c.negozio.nome = "Bar Prova";
  c.negozio.colori.primario = "#123456";
  await imposta(request, c);
  await page.goto("/proposta.html#volantino");
  await expect(page.locator("h1")).toHaveText("Bar Prova");
  await expect(page).toHaveTitle("Proposta per Bar Prova");
  await expect(page.locator(".testata")).toHaveCSS("background-color", "rgb(18, 52, 86)");
  const attive = c.slides.filter((s) => s.attiva);
  await expect(page.locator("#volantino-offerte li")).toHaveCount(Math.min(attive.length, 6));
  await expect(page.locator("#volantino-offerte .titolo").first()).toHaveText(String(attive[0]!.titolo));
  await expect(page.locator("#sez-volantino [data-nome]")).toHaveText("Bar Prova");
});

test("la TV gira a 1920×1080 rimpicciolita dentro la cornice", async ({ page }) => {
  await page.goto("/proposta.html#tv");
  const tv = page.frameLocator("#f-tv");
  await expect(tv.locator("#titolo")).not.toHaveText("");
  const cornice = (await page.locator("#schermo-tv").boundingBox())!;
  const f = (await page.locator("#f-tv").boundingBox())!;
  expect(Math.abs(f.width - cornice.width)).toBeLessThan(1);
  expect(Math.abs(f.height - cornice.height)).toBeLessThan(1);
});

test("tutti i servizi: cinque sezioni, un iframe si carica solo aprendo la sua sezione", async ({ page }) => {
  await tuttiAccesi(page);
  await page.goto("/proposta.html");
  await expect(voci(page)).toHaveText(["Sito", "Menu", "TV", "Cartello", "Volantino"]);
  await expect(page.frameLocator("#f-sito").locator("h1")).not.toHaveText("");
  await expect(page.locator("#f-menu")).not.toHaveAttribute("src", /./);
  await page.getByRole("link", { name: "Menu" }).click();
  await expect(page).toHaveURL(/#menu$/);
  await expect(page.locator("#sez-menu")).toBeVisible();
  await expect(page.locator("#sez-sito")).toBeHidden();
  await expect(page.locator("#f-menu")).toHaveAttribute("src", "/menu.html");
});

test("cartello: i QR della vetrina più quello del sito, senza Wi-Fi", async ({ page }) => {
  await tuttiAccesi(page);
  await page.goto("/proposta.html#cartello");
  await expect(page.locator("#cartello-qr figure")).toHaveCount(2);
  await expect(page.locator("#cartello-qr figcaption strong")).toHaveText(["Ti è piaciuto?", "Il nostro sito"]);
  await expect(page.locator("#cartello-qr svg path").first()).toHaveAttribute("d", /^M/);
});

test("server spento o negozio non valido: lo dice, niente sezioni", async ({ page }) => {
  await page.route("**/api/negozio", (r) => r.fulfill({ status: 503, body: "" }));
  await page.goto("/proposta.html");
  await expect(page.locator("#errore")).toBeVisible();
  await expect(voci(page)).toHaveCount(0);
});
