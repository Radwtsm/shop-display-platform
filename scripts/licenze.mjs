// Licenses of every dependency (package-lock). Shipped code: permissive only; dev tools: also weak copyleft.
import { readFileSync } from "node:fs";

export const PERMISSIVE = new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "CC0-1.0", "BlueOak-1.0.0", "Unlicense", "Python-2.0", "CC-BY-4.0"]);
export const SOLO_SVILUPPO = new Set(["MPL-2.0", "LGPL-2.1-only", "LGPL-3.0-only"]);

/** "(MIT OR Apache-2.0)" va bene se almeno una delle alternative va bene. */
function ammessa(lic, consentite) {
  if (!lic) return false;
  return lic.replace(/[()]/g, "").split(/\s+OR\s+/).some((l) => consentite.has(l.trim()));
}

export function controllaLicenze(lock) {
  const problemi = [];
  const elenco = [];
  for (const [percorso, p] of Object.entries(lock.packages ?? {})) {
    if (!percorso) continue;
    const nome = percorso.replace(/^.*node_modules\//, "");
    const lic = typeof p.license === "string" ? p.license : undefined;
    const nelProdotto = !p.dev;
    elenco.push({ nome, versione: p.version, lic: lic ?? "?", nelProdotto });
    const ok = nelProdotto ? ammessa(lic, PERMISSIVE) : ammessa(lic, PERMISSIVE) || ammessa(lic, SOLO_SVILUPPO);
    if (!ok) problemi.push(`${nome}@${p.version}: licenza "${lic ?? "mancante"}" non ammessa ${nelProdotto ? "nel prodotto" : "negli strumenti"}`);
  }
  return { problemi, elenco };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { problemi, elenco } = controllaLicenze(JSON.parse(readFileSync("package-lock.json", "utf8")));
  if (process.argv.includes("--elenco")) for (const e of elenco) console.log(`${e.nelProdotto ? "PRODOTTO" : "sviluppo"}\t${e.lic}\t${e.nome}@${e.versione}`);
  if (problemi.length) {
    console.error("licenze: da verificare prima di usarle (vedi METODO → Licenze)\n" + problemi.join("\n"));
    process.exit(1);
  }
}
