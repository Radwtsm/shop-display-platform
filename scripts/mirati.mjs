// Test mirati: dai file cambiati (rispetto a HEAD, nuovi compresi) ai soli test che li toccano, mentre si lavora.
// Prima: si scopriva tutto col check intero (4 min) a fine lavoro, 19 rossi insieme (A136, 11/11).
// Il check intero resta, e lo fa il pre-commit: questo non lo sostituisce.
//   node scripts/mirati.mjs          → lancia unit (vitest related) ed e2e scelti
//   node scripts/mirati.mjs --lista  → stampa solo cosa lancerebbe
// Regola: pagine di public/ toccate (html, css, js, bundle dai sorgenti) → spec che aprono quelle pagine,
// anche attraverso un aiuto importato (aiuti.ts); token o build → tutto; spec cambiato → se stesso.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).split("\n").filter(Boolean);
const cambiati = [...new Set([...git("diff", "--name-only", "HEAD"), ...git("ls-files", "--others", "--exclude-standard")])].filter(existsSync);
const pagine = readdirSync("public").filter((f) => f.endsWith(".html"));
const tutteLePagine = new Set(pagine);

// sorgenti → pagina che li serve (scripts/build.mjs): guscio TV/pannello e servizi finiscono in player/panel
const BUNDLE = [
  [/^src\/servizi\/vetrina\/sito\.ts$/, ["sito.html"]],
  [/^src\/servizi\/menu-qr\/cliente\.ts$/, ["menu.html"]],
  [/^src\/piattaforma\/admin\//, ["admin.html"]],
  [/^src\/proposta\//, ["proposta.html"]],
  [/^src\/piattaforma\/tv\/|\/tv\.ts$/, ["player.html"]],
  [/^src\/piattaforma\/pannello\/|\/pannello[^/]*\.ts$/, ["panel.html"]],
  [/^src\/piattaforma\/core\/|^src\/servizi\/[^/]+\/core\//, ["player.html", "panel.html"]],
];
const TUTTO = /^(design\/tokens\.json|scripts\/build\.mjs|playwright\.config\.ts|package(-lock)?\.json|public\/tokens\.css)$/;

const toccate = new Set();
const perBundle = (f) => { for (const [re, ps] of BUNDLE) if (re.test(f)) ps.forEach((p) => toccate.add(p)); };
const sorgenti = readdirSync("src", { withFileTypes: true, recursive: true }).filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.includes(".test.") && !e.name.endsWith(".spec.ts")).map((e) => join(e.parentPath, e.name));
let tutto = false;
for (const f of cambiati) {
  if (TUTTO.test(f)) tutto = true;
  else if (f.startsWith("public/") && f.endsWith(".html")) toccate.add(basename(f));
  else if (f.startsWith("public/")) {
    for (const p of pagine) if (readFileSync(join("public", p), "utf8").includes(basename(f))) toccate.add(p);
    // file caricato a runtime da un sorgente (es. eliminacode-tv.css da tv.ts): la pagina di quel sorgente
    for (const src of sorgenti) if (readFileSync(src, "utf8").includes(basename(f))) perBundle(src);
  }
  perBundle(f);
}

const elenca = (dir) => readdirSync(dir, { withFileTypes: true, recursive: true }).filter((e) => e.isFile() && e.name.endsWith(".spec.ts")).map((e) => join(e.parentPath, e.name));
const spec = [...elenca("test/e2e"), ...readdirSync("src/servizi").filter((s) => existsSync(`src/servizi/${s}/test`)).flatMap((s) => elenca(`src/servizi/${s}/test`))];
// pagine aperte da uno spec: nel suo testo, o in una funzione di un aiuto locale (test/…) che lo spec usa
const pagineDi = (f) => {
  const testo = readFileSync(f, "utf8");
  const aiuti = [...testo.matchAll(/from "(\.\.?\/[^"]+\.ts)"/g)].map((m) => join(dirname(f), m[1])).filter((a) => existsSync(a) && !a.endsWith(".spec.ts") && a.startsWith("test/"));
  const usate = aiuti.flatMap((a) =>
    [...readFileSync(a, "utf8").matchAll(/export (?:async )?function (\w+)[\s\S]*?\n}/g)].filter((m) => new RegExp(`\\b${m[1]}\\(`).test(testo)).map((m) => m[0]),
  );
  return [testo, ...usate].join("\n");
};
const e2e = tutto
  ? spec
  : spec.filter((s) => cambiati.includes(s) || [...toccate].some((p) => tutteLePagine.has(p) && pagineDi(s).includes(p)) || cambiati.some((c) => c.startsWith(dirname(dirname(s)) + "/") && c.startsWith("src/servizi/")));
const unit = cambiati.filter((f) => /\.(ts|mjs)$/.test(f) && !f.endsWith(".spec.ts"));

console.log(`cambiati: ${cambiati.length} · pagine: ${tutto ? "tutte" : [...toccate].join(", ") || "-"} · e2e: ${e2e.length}/${spec.length}`);
for (const s of e2e) console.log("  " + s);
if (process.argv.includes("--lista")) process.exit(0);

const passa = (cmd, args) => spawnSync(cmd, args, { stdio: "inherit" }).status === 0;
let ok = true;
if (unit.length) ok = passa("npx", ["vitest", "related", "--run", "--passWithNoTests", ...unit]) && ok;
if (e2e.length) ok = passa("node", ["scripts/build.mjs"]) && passa("npx", ["playwright", "test", "--reporter=line", ...e2e]) && ok;
process.exit(ok ? 0 : 1);
