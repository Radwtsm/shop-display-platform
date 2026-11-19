// QR del pannello per aprirlo dall'iPhone vero (stessa Wi-Fi). Serve `npm start` (in ascolto su tutta la rete).
import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const porta = process.env.PORT ?? "8080";
const ip = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
if (!ip) {
  console.error("qr: nessuna rete trovata (Wi-Fi spenta?)");
  process.exit(1);
}
const token = readFileSync("data/clienti/demo/token", "utf8").trim();
const file = "data/qr-pannello.png";
execFileSync("qrencode", ["-o", file, "-s", "10", "-m", "2", `http://${ip}:${porta}/panel.html#t=${token}`]);
chmodSync(file, 0o600); // contiene il link segreto del pannello
console.log(`QR del pannello in ${file} (per http://${ip}:${porta}/panel.html): inquadralo con la fotocamera dell'iPhone.`);
