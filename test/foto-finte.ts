// Foto finte generate qui (mai foto vere nei test): PNG veri e decodificabili, testate JPG/WebP solo per i controlli sui byte.
import { crc32, deflateSync } from "node:zlib";

function blocco(tipo: string, dati: Buffer): Buffer {
  const lung = Buffer.alloc(4);
  lung.writeUInt32BE(dati.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo, "ascii"), dati])));
  return Buffer.concat([lung, Buffer.from(tipo, "ascii"), dati, crc]);
}

/** PNG a tinta unita con una banda chiara, `larghezza`×`altezza`. `exif` aggiunge un blocco eXIf. */
export function pngFinto(larghezza = 800, altezza = 600, colore: [number, number, number] = [200, 120, 40], exif = false): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(larghezza, 0);
  ihdr.writeUInt32BE(altezza, 4);
  ihdr[8] = 8; // bit
  ihdr[9] = 2; // RGB
  const riga = Buffer.alloc(1 + larghezza * 3);
  const righe: Buffer[] = [];
  for (let y = 0; y < altezza; y++) {
    const chiaro = y > altezza / 3 && y < altezza / 2;
    for (let x = 0; x < larghezza; x++) riga.set(chiaro ? [250, 240, 220] : colore, 1 + x * 3);
    righe.push(Buffer.from(riga));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco("IHDR", ihdr),
    ...(exif ? [blocco("eXIf", Buffer.from("MM\0*\0\0\0\b\0\0"))] : []),
    blocco("IDAT", deflateSync(Buffer.concat(righe))),
    blocco("IEND", Buffer.alloc(0)),
  ]);
}

/** Solo testata JPG (non decodificabile): SOF0 con le misure, eventualmente un APP1 Exif prima o dopo. */
export function jpgTestata(larghezza: number, altezza: number, exif: "no" | "prima" | "dopo" = "no"): Buffer {
  const app1 = Buffer.from([0xff, 0xe1, 0x00, 0x0a, ...Buffer.from("Exif\0\0"), 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 8, altezza >> 8, altezza & 255, larghezza >> 8, larghezza & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...(exif === "prima" ? [app1] : []), sof, ...(exif === "dopo" ? [app1] : []), sos, Buffer.from([0xff, 0xd9])]);
}

/** Solo testata WebP estesa (VP8X) con le misure, eventualmente un blocco EXIF. */
export function webpTestata(larghezza: number, altezza: number, exif = false): Buffer {
  const vp8x = Buffer.alloc(18);
  vp8x.write("VP8X", 0, "ascii");
  vp8x.writeUInt32LE(10, 4);
  vp8x.writeUIntLE(larghezza - 1, 12, 3);
  vp8x.writeUIntLE(altezza - 1, 15, 3);
  const ex = Buffer.concat([Buffer.from("EXIF", "ascii"), Buffer.from([4, 0, 0, 0]), Buffer.from("MM\0*")]);
  const corpo = Buffer.concat([Buffer.from("WEBP", "ascii"), vp8x, ...(exif ? [ex] : [])]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(corpo.length, 4);
  return Buffer.concat([riff, corpo]);
}
