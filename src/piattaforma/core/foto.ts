// Foto dei prodotti: controlli sui byte, senza decodificare l'immagine. Il pannello le rimpicciolisce e toglie i
// metadati prima di mandarle; il server non si fida e ricontrolla tipo, misure e metadati.

export type TipoFoto = "jpg" | "png" | "webp";

/** Nome con cui il server salva una foto: casuale, mai scelto dal telefono. */
export const FOTO = /^[a-f0-9]{16}\.(jpg|png|webp)$/;
export const FOTO_MAX_BYTE = 2 * 1024 * 1024;
/** Oltre questo lato la TV rischia di finire la memoria (immagine piccola da scaricare, enorme da disegnare). */
export const FOTO_MAX_LATO = 4096;
/** Lato lungo a cui il pannello rimpicciolisce la foto: basta per una TV 4K a metà schermo. */
export const FOTO_LATO_PANNELLO = 1600;

const ascii = (b: Uint8Array, da: number, n: number) => String.fromCharCode(...b.subarray(da, da + n));
const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u32be = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const u32le = (b: Uint8Array, i: number) => b[i]! + (b[i + 1]! << 8) + (b[i + 2]! << 16) + ((b[i + 3]! << 24) >>> 0);
const u24le = (b: Uint8Array, i: number) => b[i]! + (b[i + 1]! << 8) + (b[i + 2]! << 16);

/** Tipo dai primi byte: il nome del file e il Content-Type non contano. */
export function tipoFoto(b: Uint8Array): TipoFoto | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && ascii(b, 1, 3) === "PNG" && b[0] === 0x89 && b[4] === 0x0d && b[5] === 0x0a) return "png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  return null;
}

export interface InfoFoto {
  larghezza: number;
  altezza: number;
  /** Contiene ancora EXIF (posizione, modello del telefono…). */
  metadati: boolean;
}

function jpg(b: Uint8Array): InfoFoto | null {
  let i = 2;
  let metadati = false;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1]!;
    if (m === 0xd9 || m === 0xda) break; // fine o inizio dei dati compressi: le misure dovevano già esserci
    const lung = u16be(b, i + 2);
    if (m === 0xe1 && ascii(b, i + 4, 4) === "Exif") metadati = true;
    // SOF0…SOF15 tranne DHT (C4), JPG (C8), DAC (CC)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
      return { altezza: u16be(b, i + 5), larghezza: u16be(b, i + 7), metadati: metadati || haExifDopo(b, i + 2 + lung) };
    i += 2 + lung;
  }
  return null;
}

/** Un APP1 Exif dopo le misure (raro ma possibile): si continua a cercare fino ai dati compressi. */
function haExifDopo(b: Uint8Array, i: number): boolean {
  while (i + 4 <= b.length && b[i] === 0xff) {
    const m = b[i + 1]!;
    if (m === 0xda || m === 0xd9) return false;
    if (m === 0xe1 && ascii(b, i + 4, 4) === "Exif") return true;
    i += 2 + u16be(b, i + 2);
  }
  return false;
}

function png(b: Uint8Array): InfoFoto | null {
  if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
  let metadati = false;
  for (let i = 8; i + 8 <= b.length; ) {
    const tipo = ascii(b, i + 4, 4);
    if (tipo === "eXIf") metadati = true;
    if (tipo === "IEND") break;
    i += 12 + u32be(b, i);
  }
  return { larghezza: u32be(b, 16), altezza: u32be(b, 20), metadati };
}

function webp(b: Uint8Array): InfoFoto | null {
  let misure: { larghezza: number; altezza: number } | null = null;
  let metadati = false;
  for (let i = 12; i + 8 <= b.length; ) {
    const tipo = ascii(b, i, 4);
    const lung = u32le(b, i + 4);
    const d = i + 8;
    if (tipo === "EXIF") metadati = true;
    if (tipo === "VP8X" && d + 10 <= b.length) misure ??= { larghezza: u24le(b, d + 4) + 1, altezza: u24le(b, d + 7) + 1 };
    if (tipo === "VP8 " && d + 10 <= b.length) misure ??= { larghezza: u16le14(b, d + 6), altezza: u16le14(b, d + 8) };
    if (tipo === "VP8L" && d + 5 <= b.length) {
      const v = u32le(b, d + 1);
      misure ??= { larghezza: (v & 0x3fff) + 1, altezza: ((v >>> 14) & 0x3fff) + 1 };
    }
    i = d + lung + (lung & 1);
  }
  return misure && { ...misure, metadati };
}
const u16le14 = (b: Uint8Array, i: number) => (b[i]! + (b[i + 1]! << 8)) & 0x3fff;

export function infoFoto(b: Uint8Array, tipo: TipoFoto): InfoFoto | null {
  return tipo === "jpg" ? jpg(b) : tipo === "png" ? png(b) : webp(b);
}

export type EsitoFoto = { ok: true; tipo: TipoFoto } | { ok: false; errore: string };

/** Unico controllo di una foto caricata: lo usa il server, i messaggi sono quelli che vede il negoziante. */
export function controllaFoto(b: Uint8Array): EsitoFoto {
  if (!b.length) return { ok: false, errore: "La foto è vuota." };
  if (b.length > FOTO_MAX_BYTE) return { ok: false, errore: "La foto è troppo pesante (massimo 2 MB)." };
  const tipo = tipoFoto(b);
  if (!tipo) return { ok: false, errore: "Questo file non è una foto: usa una foto JPG, PNG o WebP." };
  const info = infoFoto(b, tipo);
  if (!info || !info.larghezza || !info.altezza) return { ok: false, errore: "La foto è rovinata, prova con un'altra." };
  if (info.larghezza > FOTO_MAX_LATO || info.altezza > FOTO_MAX_LATO)
    return { ok: false, errore: "La foto è troppo grande, prova con un'altra." };
  if (info.metadati) return { ok: false, errore: "La foto contiene ancora i dati del telefono: caricala dal pannello." };
  return { ok: true, tipo };
}
