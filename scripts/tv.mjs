// Prova sulla TV vera (Google TV di casa, A17): apre la demo nel browser della TV e ne fa lo screenshot. Serve `npm start`
// e il Mac autorizzato una volta sulla TV (adb). TV e browser cambiano con TV_ADB / TV_BROWSER.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const tv = process.env.TV_ADB ?? "192.168.1.10:5555";
const browser = process.env.TV_BROWSER ?? "com.tcl.browser"; // BrowseHere, il browser già sulla TV
const porta = process.env.PORT ?? "8080";
// maxBuffer: uno screenshot PNG della TV supera il milione di byte di default (schermata Home ricca = ENOBUFS)
const adb = (...a) => execFileSync("adb", ["-s", tv, ...a], { encoding: "buffer", timeout: 20_000, maxBuffer: 64 * 1024 * 1024 });

execFileSync("adb", ["connect", tv], { timeout: 20_000 });
const [cosa = "apri", pagina = "player.html"] = process.argv.slice(2);
if (cosa === "apri") {
  const ip = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
  if (!ip) throw new Error("tv: nessuna rete trovata (Wi-Fi spenta?)");
  adb("shell", "input keyevent KEYCODE_WAKEUP");
  adb("shell", `am start -a android.intent.action.VIEW -d http://${ip}:${porta}/${pagina} ${browser}`);
  console.log(`Sulla TV: http://${ip}:${porta}/${pagina}`);
} else if (cosa === "foto") {
  const file = pagina.endsWith(".png") ? pagina : "test-results/tv.png";
  mkdirSync("test-results", { recursive: true });
  writeFileSync(file, adb("exec-out", "screencap", "-p"));
  console.log(`Screenshot della TV: ${file}`);
} else {
  console.error("uso: npm run tv [-- apri [pagina]] | npm run tv -- foto [file.png]");
  process.exit(1);
}
