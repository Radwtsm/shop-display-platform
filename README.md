# Shop Display Platform

A small platform for local shops (bakeries, bars, hairdressers, pharmacies): the shop's own TV becomes a digital
signage screen, and the owner changes it from their phone in a few taps. One Node server per shop, a full-screen
player for the TV, a phone panel, and an owner dashboard across clients.

TypeScript with no framework and **zero runtime dependencies** in the product (the only one, `qrcode-generator`, is
bundled at build time). Built test-first: ~590 unit tests (Vitest) and end-to-end tests in a real browser
(Playwright) at TV, tablet and phone sizes.

The UI, comments and identifiers are in Italian (the product is for Italian shops); this README is the English
entry point.

## Services

The platform knows nothing about any service: each one is a folder that plugs into fixed contracts.

| Service | What it does |
|---|---|
| `schermo` (screen) | offers with prices, photos and time slots ("croissant + cappuccino until 11"), rotating on the TV |
| `vetrina` (shop window) | opening hours, news and a one-page website generated from the same data |
| `menu-qr` | a menu customers open by scanning a QR code; read-only for them, edited from the panel |
| `eliminacode` (queue) | "now serving" numbers on the TV, advanced from the phone |

Several services can share one TV, rotating or side by side; the shell around them (name, logo, colours, QR, clock,
weather) belongs to the platform.

## Architecture

```
src/piattaforma/          the platform (never imports from a service: a test enforces it)
  core/                     pure logic, no DOM, no Node: prices, time slots, colours, shop identity, service catalogue
  server/                   HTTP server on node:http: security headers, tokens, per-client archive, module loader
  tv/  pannello/            the TV shell and the phone-panel shell, with the contracts services implement
  admin/                    owner dashboard: clients → services → devices
src/servizi/<id>/         one service = core/ (types, valida()), server.ts, tv.ts, pannello.ts, test/
public/                   HTML + CSS per page; CSS reads only design tokens
design/tokens.json        the single source for colours, sizes and timings → generated tokens.css
scripts/                  build (esbuild), A4 sales sheet, QR, design-token lint, licence check, real-TV check
test/unit  test/e2e       platform tests; each service keeps its own next to its code
```

Design choices:
- **One validation per data type.** Every input (server, panel, TV, CLI) goes through the service's `valida()`;
  shop data through one shared rule. Client data is reached only through `Archivio`/`Cliente`, never through
  hand-built paths (client ids are checked, `..` is rejected).
- **Money and time are types, not floats and strings.** Prices are integer cents; time slots go through one module
  pinned to Europe/Rome, so daylight-saving changes are tested, not hoped for.
- **The TV never jumps.** Content that changes on its own (rotation, queue numbers, weather) has a "does not move the
  page" test; a layout spec checks every page at 320/414/820/1440 px (and 1920 for the TV), light and dark, plus axe
  accessibility.
- **Adding a service is a recipe**, not a refactor: [src/servizi/LEGGIMI.md](src/servizi/LEGGIMI.md). A folder missing
  from the catalogue fails a test.

## Security

Mapped to OWASP ASVS 5.0 level 2 in [SICUREZZA.md](SICUREZZA.md), with an honest status per requirement (✅ done
with a test as proof, ❌ still to do before selling).
- Strict CSP (`default-src 'none'`, no `unsafe-*`, no inline scripts or styles), nosniff, COOP/CORP,
  Permissions-Policy; user text only through `textContent`.
- Panel token: 144 random bits, carried in the URL fragment (never sent to the server in the URL), compared in
  constant time, 10 failures/minute per address → 429.
- Atomic writes (`.tmp` + previous copy), 64 KB body limit, method allow-list per route, generic 500s.
- Custom Semgrep rules ([security/semgrep.yml](security/semgrep.yml)) in pre-commit; OSV-Scanner + Semgrep OWASP
  rules in pre-push; gitleaks on every commit.
- Dependencies pinned to exact versions published at least two weeks earlier, `ignore-scripts`, lockfile committed,
  licences checked.

## Run

Requirements: Node 24+ (TypeScript runs natively with `--experimental-strip-types`).

```sh
npm ci
npm start                 # http://localhost:8080 — prints the TV, panel and dashboard links
npm test                  # unit tests
npm run e2e               # Playwright (install browsers once: npx playwright install chromium)
npm run check             # types + token lint + licences + Semgrep + unit + e2e (the pre-commit gate)
```

Optional git hooks: `git config core.hooksPath .githooks` (needs gitleaks, Semgrep and OSV-Scanner).

Demo data for a sales visit:
`npm run personalizza -- --modello bar|panificio|parrucchiere|farmacia --nome "Bar Roma"` (with `--logo`, the colours
are taken from the logo). All data in `fixtures/` is invented; demo photos are from Unsplash
([fixtures/foto-demo/FONTI.md](fixtures/foto-demo/FONTI.md)). Client data lives in `data/`, which is never committed.

## Status

A working demo used for visits to shops, not yet a product in production. Next: multi-client hosting with HTTPS,
token rotation, an audit log.

## License

MIT — see [LICENSE](LICENSE). Fonts and photos keep their own licences (`public/fonts/FONTI.md`,
`fixtures/foto-demo/FONTI.md`).
