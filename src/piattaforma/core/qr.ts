import qrcode from "qrcode-generator";

export const QR_URL_MAX = 300;
export const QR_TESTO_MAX = 40;

/** Il QR come un solo percorso SVG (un quadratino per modulo scuro), così si disegna senza HTML da stringhe. */
export function percorsoQr(testo: string): { lato: number; d: string } {
  const qr = qrcode(0, "M");
  qr.addData(testo, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const parti: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) parti.push(`M${c} ${r}h1v1h-1z`);
  return { lato: n, d: parti.join("") };
}

/**
 * Da quale indirizzo parte il QR predefinito (es. menu): quello che il server sa raggiungibile dal telefono, altrimenti
 * quello con cui la TV ha aperto la pagina, ma mai uno di questo computer (localhost, 127.x, ::1): sul telefono porterebbe
 * al telefono. null = nessun QR predefinito (meglio niente che un QR che non si apre).
 */
export function origineQr(dalServer: string | undefined, origineTv: string): string | null {
  if (dalServer) return dalServer;
  const h = new URL(origineTv).hostname;
  return h === "localhost" || h === "[::1]" || /^127\./.test(h) ? null : origineTv;
}

/** Solo indirizzi https completi: niente javascript:, niente spazi, niente indirizzi interni. */
export function urlQrValido(u: unknown): u is string {
  if (typeof u !== "string" || u.length > QR_URL_MAX || /\s/.test(u)) return false;
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname.includes(".") && !x.username && !x.password;
  } catch {
    return false;
  }
}
