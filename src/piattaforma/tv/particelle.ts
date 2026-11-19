// Decorazioni in movimento dei temi (neve, petali, bolle, "%", scintille): un canvas nostro.
// Perché non una libreria: tsParticles pesa centinaia di KB (il budget JS della TV è 50 KB gzip) e magic-snowflakes
// crea un elemento DOM per fiocco con un'animazione CSS che si ripete (è proprio la griglia e il "reset" che
// vogliamo togliere). Qui: mezza risoluzione, 30 fps, sprite disegnati una volta, 3 profondità con velocità, misura
// e deriva diverse, vento lento comune, fiocchi che rientrano da sopra in continuo (niente ciclo che si vede).
import { calmo, suCalmo } from "../client/movimento.ts";
import { coloreDecorazione } from "../core/colori.ts";
import type { Tema } from "../core/negozio.ts";

export type Forma = "fiocco" | "petalo" | "bolla" | "percento" | "scintilla";
export interface Profilo {
  forma: Forma;
  /** Colore preso dal tema: scritte o prezzi. */
  colore: "testo" | "accento";
  quanti: number;
  /** Velocità verticale in % dell'altezza al secondo (negativa = sale), vicino = più veloce. */
  vel: number;
  /** Ampiezza dell'ondeggiamento in % della larghezza dello schermo. */
  deriva: number;
  /** Misura del più grande in % dell'altezza. */
  misura: number;
  /** Rotazione in giri al secondo (0 = ferma). */
  giro: number;
}

export const PROFILI: Record<Tema, Profilo> = {
  natale: { forma: "fiocco", colore: "testo", quanti: 120, vel: 7, deriva: 1.6, misura: 2.6, giro: 0 },
  pasqua: { forma: "petalo", colore: "accento", quanti: 26, vel: 5, deriva: 4, misura: 4, giro: 0.12 },
  estate: { forma: "bolla", colore: "accento", quanti: 24, vel: -6, deriva: 2.2, misura: 4.5, giro: 0 },
  saldi: { forma: "percento", colore: "accento", quanti: 16, vel: 4.5, deriva: 2, misura: 7, giro: 0.04 },
  blackfriday: { forma: "scintilla", colore: "accento", quanti: 34, vel: -0.8, deriva: 1, misura: 3.4, giro: 0 },
};

const QUADRO_MS = 1000 / 30;
const PROFONDITA = [0.35, 0.65, 1] as const; // lontano, medio, vicino

/** Numeri sempre uguali a ogni avvio: la TV non cambia aspetto a ogni riaccensione e gli screenshot dei test non ballano. */
export function casuale(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface P {
  x: number; // 0..1 della larghezza
  y: number; // 0..1 dell'altezza
  z: number; // indice della profondità
  fase: number;
  freq: number;
  rot: number;
}

export function creaParticelle(profilo: Profilo, seme = 1): P[] {
  const r = casuale(seme);
  return Array.from({ length: profilo.quanti }, (_, i) => ({
    x: r(), y: r(), z: i % PROFONDITA.length, fase: r() * Math.PI * 2, freq: 0.3 + r() * 0.5, rot: r() * Math.PI * 2,
  }));
}

/** Dove sono tra `dt` secondi. Una particella che esce rientra dall'altro lato con x nuova: il flusso non si ripete. */
export function muovi(ps: P[], profilo: Profilo, t: number, dt: number, rnd: () => number): void {
  const vento = Math.sin(t * 0.07) * 0.004 + Math.sin(t * 0.19) * 0.0015; // larghezze al secondo
  for (const p of ps) {
    const prof = PROFONDITA[p.z]!;
    p.y += (profilo.vel / 100) * (0.45 + prof * 0.7) * dt;
    p.x += (Math.cos(t * p.freq + p.fase) * (profilo.deriva / 100) * p.freq * prof + vento * (0.4 + prof)) * dt;
    p.rot += profilo.giro * Math.PI * 2 * dt;
    if (p.y > 1.05 || p.y < -0.05) {
      p.y = profilo.vel > 0 ? -0.04 : 1.04;
      p.x = rnd();
    }
    if (p.x > 1.05) p.x -= 1.1;
    else if (p.x < -0.05) p.x += 1.1;
  }
}

function sprite(forma: Forma, colore: string, px: number, lontano: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = Math.max(4, Math.ceil(px));
  const g = c.getContext("2d")!;
  const m = c.width / 2;
  g.fillStyle = colore;
  g.strokeStyle = colore;
  if (forma === "fiocco") {
    // tondo e morbido: più sfumato è, più sembra lontano
    g.beginPath();
    g.arc(m, m, m * 0.95, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "destination-in";
    const sf = g.createRadialGradient(m, m, 0, m, m, m);
    sf.addColorStop(0, "rgba(0,0,0,1)");
    sf.addColorStop(Math.max(0.1, 0.55 - lontano * 0.4), "rgba(0,0,0,0.9)");
    sf.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sf;
    g.fillRect(0, 0, c.width, c.height);
  } else if (forma === "petalo") {
    g.beginPath();
    g.moveTo(m, 0);
    g.bezierCurveTo(c.width, m * 0.5, c.width * 0.85, c.height, m, c.height);
    g.bezierCurveTo(c.width * 0.15, c.height, 0, m * 0.5, m, 0);
    g.fill();
  } else if (forma === "bolla") {
    g.lineWidth = Math.max(1, c.width * 0.07);
    g.beginPath();
    g.arc(m, m, m - g.lineWidth, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 0.6;
    g.beginPath();
    g.arc(m * 0.68, m * 0.68, m * 0.14, 0, Math.PI * 2);
    g.fill();
  } else if (forma === "percento") {
    g.font = `800 ${Math.round(c.height * 0.9)}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("%", m, m * 1.05);
  } else {
    // scintilla: stella a quattro punte
    g.beginPath();
    g.moveTo(m, 0);
    g.quadraticCurveTo(m, m, c.width, m);
    g.quadraticCurveTo(m, m, m, c.height);
    g.quadraticCurveTo(m, m, 0, m);
    g.quadraticCurveTo(m, m, m, 0);
    g.fill();
  }
  return c;
}

const coloreDi = (p: Profilo) => {
  const st = getComputedStyle(document.body);
  const colore = st.getPropertyValue(p.colore === "testo" ? "--testo" : "--accento").trim() || "#fff";
  return coloreDecorazione(colore, st.getPropertyValue("--sfondo").trim());
};

export function avviaParticelle(canvas: HTMLCanvasElement) {
  const g = canvas.getContext("2d");
  if (!g) return { tema: (_: Tema | undefined) => {} };
  let profilo: Profilo | null = null;
  let ps: P[] = [];
  let sprites: HTMLCanvasElement[] = [];
  let rnd = casuale(7);
  let t = 0;
  let ultimo = 0;
  let giro = 0;

  function misure() {
    // mezza risoluzione: i fiocchi sono morbidi, il dettaglio non si vede e la TV fa un quarto dei pixel
    canvas.width = Math.max(2, Math.round(innerWidth / 2));
    canvas.height = Math.max(2, Math.round(innerHeight / 2));
    if (profilo) preparaSprite();
  }

  function preparaSprite() {
    const grande = (profilo!.misura / 100) * canvas.height;
    sprites = PROFONDITA.map((z) => sprite(profilo!.forma, coloreDi(profilo!), grande * z, 1 - z));
  }

  function disegna() {
    g!.clearRect(0, 0, canvas.width, canvas.height);
    if (!profilo) return;
    for (const p of ps) {
      const s = sprites[p.z]!;
      const x = p.x * canvas.width;
      const y = p.y * canvas.height;
      let alfa = 0.35 + PROFONDITA[p.z]! * 0.6;
      if (profilo.forma === "scintilla") alfa *= 0.5 + 0.5 * Math.sin(t * 1.6 + p.fase * 3);
      g!.globalAlpha = Math.max(0, alfa);
      if (profilo.giro || profilo.forma === "petalo") {
        g!.setTransform(1, 0, 0, 1, x, y);
        g!.rotate(p.rot);
        g!.drawImage(s, -s.width / 2, -s.height / 2);
        g!.setTransform(1, 0, 0, 1, 0, 0);
      } else g!.drawImage(s, x - s.width / 2, y - s.height / 2);
    }
    g!.globalAlpha = 1;
  }

  function quadro(ora: number) {
    giro = requestAnimationFrame(quadro);
    if (document.hidden || ora - ultimo < QUADRO_MS) return;
    const dt = Math.min(0.1, (ora - (ultimo || ora - QUADRO_MS)) / 1000);
    ultimo = ora;
    t += dt;
    muovi(ps, profilo!, t, dt, rnd);
    disegna();
  }

  function ferma() {
    cancelAnimationFrame(giro);
    giro = 0;
  }

  function parti() {
    ferma();
    if (!profilo) return void g!.clearRect(0, 0, canvas.width, canvas.height);
    preparaSprite();
    if (calmo()) return disegna(); // un fotogramma fermo: la decorazione c'è, il movimento no
    ultimo = 0;
    giro = requestAnimationFrame(quadro);
  }

  let chiave = "";
  addEventListener("resize", () => {
    misure();
    if (profilo && calmo()) disegna();
  });
  suCalmo(parti);
  document.addEventListener("visibilitychange", () => {
    ultimo = 0;
  });
  misure();

  return {
    /** Il tema della TV è cambiato (o è lo stesso: non succede niente). */
    tema(tema: Tema | undefined) {
      const nuova = tema ? PROFILI[tema] : null;
      const k = `${tema ?? ""}|${nuova ? coloreDi(nuova) : ""}`;
      if (k === chiave) return;
      chiave = k;
      if (tema) canvas.dataset.particelle = tema;
      else delete canvas.dataset.particelle;
      profilo = nuova ?? null;
      ps = profilo ? creaParticelle(profilo) : [];
      rnd = casuale(7);
      t = 0;
      parti();
    },
  };
}
