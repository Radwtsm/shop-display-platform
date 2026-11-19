import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import { creaServer } from "./app.ts";
import { Archivio } from "./archivio.ts";
import { attivaServizio, caricaModuli } from "./modulo.ts";
import { migraConfigUnica, salvaVista } from "../../servizi/schermo/server.ts";
import { valida } from "../../servizi/schermo/core/valida.ts";

const radice = resolve(import.meta.dirname, "../../..");
const dataDir = resolve(process.env.DATA_DIR ?? join(radice, "data"));
const porta = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";

const moduli = await caricaModuli(join(radice, "src/servizi"));

// un solo cliente per processo finché non ci sono account veri (A7): la demo
const cliente = new Archivio(dataDir).cliente(process.env.CLIENTE ?? "demo");
if (migraConfigUnica(dataDir, cliente)) console.log(`Dati della versione prima spostati in ${cliente.dir}`);
// Servizi del cliente demo (anche per un cliente già creato: attivare è ripetibile e non tocca i dati). Con più di
// un servizio un cliente nuovo parte "affiancato", così la demo mostra subito offerte e numero insieme.
const demoServizi = (process.env.DEMO_SERVIZI ?? "schermo,eliminacode").split(",").map((s) => s.trim());
if (!cliente.esiste()) {
  const demo = valida(JSON.parse(readFileSync(join(radice, "fixtures/demo.json"), "utf8")));
  if (!demo.ok) throw new Error(demo.errori.join("; "));
  salvaVista(cliente, demoServizi.length > 1 ? { ...demo.config, disposizione: "affiancato" } : demo.config);
}
for (const id of demoServizi.filter(Boolean)) {
  const m = moduli.find((x) => x.id === id);
  if (!m) throw new Error(`DEMO_SERVIZI: servizio sconosciuto «${id}»`);
  // dati di esempio del servizio (es. il menu, A19), solo la prima volta
  if (m.esempio && cliente.leggi(m.id) === null) {
    const dati = m.esempio();
    const errori = m.valida(dati);
    if (errori.length) throw new Error(`esempio di ${id} non valido: ${errori.join("; ")}`);
    cliente.scrivi(m.id, JSON.stringify(dati, null, 2));
  }
  attivaServizio(cliente, m);
}
mkdirSync(cliente.logo, { recursive: true, mode: 0o700 });
const fileToken = cliente.fileToken;
let token = process.env.PANEL_TOKEN;
if (!token) {
  if (!existsSync(fileToken)) writeFileSync(fileToken, randomBytes(18).toString("base64url"), { mode: 0o600 });
  token = readFileSync(fileToken, "utf8").trim();
}

const ip =
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === "IPv4" && !i.internal)?.address ?? "localhost";

// base dei QR predefiniti (menu): la TV della demo apre localhost, che sul telefono non porta al server
const origineTelefono = process.env.INDIRIZZO_TELEFONO || (host === "0.0.0.0" && ip !== "localhost" ? `http://${ip}:${porta}` : undefined);

creaServer({ publicDir: join(radice, "public"), cliente, token, moduli, adminDati: join(radice, "fixtures/admin-demo.json"), origineTelefono }).listen(porta, host, () => {
  console.log(`TV:      http://localhost:${porta}/player.html`);
  console.log(`Pannello (dal telefono, stessa Wi-Fi): http://${ip}:${porta}/panel.html#t=${token}`);
  if (demoServizi.length > 1) console.log(`Proposta (da mostrare alla visita): http://${ip}:${porta}/proposta.html`);
  console.log(`Dashboard (solo da questo computer): http://localhost:${porta}/admin.html`);
});
