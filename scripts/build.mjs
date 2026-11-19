import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { css } from "./tokens.mjs";

// I punti d'ingresso di TV e pannello si generano dalle cartelle in src/servizi: aggiungere un servizio non tocca
// il guscio. Ogni tv.ts / pannello.ts esporta `servizioTv` / `servizioPannello` (src/servizi/LEGGIMI.md).
const servizi = readdirSync("src/servizi", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const ingresso = (file, esporta, avvia, guscio) => {
  const con = servizi.filter((id) => existsSync(`src/servizi/${id}/${file}`));
  const nomi = con.map((_, i) => `s${i}`);
  return {
    contents: [
      ...con.map((id, i) => `import { ${esporta} as ${nomi[i]} } from "./servizi/${id}/${file}";`),
      `import { ${avvia} } from "${guscio}";`,
      `${avvia}([${nomi.join(", ")}]);`,
    ].join("\n"),
    resolveDir: "src",
    sourcefile: `ingresso-${file}`,
  };
};

writeFileSync("public/tokens.css", css());
const comuni = { outdir: "public/assets", bundle: true, format: "esm", target: "es2020", sourcemap: true, logLevel: "warning" };
await build({ ...comuni, stdin: ingresso("tv.ts", "servizioTv", "avviaTv", "./piattaforma/tv/guscio.ts"), outfile: "public/assets/player.js", outdir: undefined });
await build({ ...comuni, stdin: ingresso("pannello.ts", "servizioPannello", "avviaPannello", "./piattaforma/pannello/guscio.ts"), outfile: "public/assets/panel.js", outdir: undefined });
await build({ ...comuni, entryPoints: { admin: "src/piattaforma/admin/main.ts" } });
await build({ ...comuni, entryPoints: { sito: "src/servizi/vetrina/sito.ts" } });
await build({ ...comuni, entryPoints: { proposta: "src/proposta/main.ts" } }); // kit proposta per la visita (A102)
await build({ ...comuni, entryPoints: { menu: "src/servizi/menu-qr/cliente.ts" } }); // pagina del cliente (public/menu.html)
