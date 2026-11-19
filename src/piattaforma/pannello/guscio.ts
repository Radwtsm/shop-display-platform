// Il guscio del pannello (public/panel.html): link con il token, barra con nome e logo, colori del negozio,
// avvisi e conferme, e una sezione per ogni servizio attivo. Non sa niente di nessun servizio.
import { validaNegozio, validaRispostaNegozio, type DatiNegozio, type RispostaNegozio } from "../core/negozio.ts";
import type { IdServizio } from "../core/servizi.ts";
import { accentoPannello } from "../core/tema.ts";
import { applicaColori, cacheNegozio, salvaCacheNegozio } from "../client/dom.ts";
import { NON_RAGGIUNGIBILE, type ContestoPannello, type Esito, type ServizioPannello } from "./contratto.ts";

// stessa chiave di prima: i telefoni già collegati restano collegati
const CHIAVE_TOKEN = "schermo.token";
const CHIAVE_CACHE = "guscio.negozio";
const TOAST_MS = 6000;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Il colore del negozio diventa l'accento del pannello solo dove si legge bene (core/tema.ts). */
function applicaTema(n: DatiNegozio) {
  applicaColori(n.negozio.colori);
  const a = accentoPannello(n.negozio.colori.primario);
  const s = document.documentElement.style;
  for (const modo of ["chiaro", "scuro"] as const) {
    const v = a[modo];
    if (v) {
      s.setProperty(`--brand-azione-${modo}`, v.azione);
      s.setProperty(`--brand-su-azione-${modo}`, v.suAzione);
    } else {
      s.removeProperty(`--brand-azione-${modo}`);
      s.removeProperty(`--brand-su-azione-${modo}`);
    }
  }
}

export function avviaPannello(registrati: ServizioPannello[]) {
  const per = new Map(registrati.map((s) => [s.id, s]));
  // Il token arriva nel frammento (#t=…): non va al server, nei log né nel Referer. Poi si toglie dalla barra.
  const daUrl = new URLSearchParams(location.hash.slice(1)).get("t");
  if (daUrl) {
    try {
      localStorage.setItem(CHIAVE_TOKEN, daUrl);
    } catch {}
    history.replaceState(null, "", location.pathname);
  }
  let token = daUrl ?? "";
  try {
    token = localStorage.getItem(CHIAVE_TOKEN) ?? token;
  } catch {}

  let negozio: RispostaNegozio | null = cacheNegozio(CHIAVE_CACHE);
  const montati: IdServizio[] = [];
  let timerToast = 0;
  let riprovaAvviso: (() => void) | undefined;
  let annullaToast: (() => void) | undefined;

  const ctx: ContestoPannello = {
    token: () => token,
    negozio: () => negozio!,
    servizi: () => [...montati],
    negozioCambiato(dati) {
      negozio = { ...dati, servizi: negozio?.servizi ?? [] };
      mostraNegozio();
    },
    async salvaNegozio(dati): Promise<Esito> {
      if (!token) return { ok: false, errore: "Per modificare apri il pannello dal link completo che ti abbiamo dato." };
      const v = validaNegozio(dati);
      if (!v.ok) return { ok: false, errore: v.errori.join(" · ") };
      try {
        const r = await fetch("/api/negozio", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Token": token },
          body: JSON.stringify(dati),
        });
        const corpo = (await r.json().catch(() => ({}))) as { errori?: string[] };
        if (r.status === 401) return { ok: false, errore: "Questo link non è più valido. Chiedi il link nuovo a chi ha installato la TV." };
        if (!r.ok) return { ok: false, errore: corpo.errori?.join(" · ") ?? "Non salvato, riprova." };
        const e = validaRispostaNegozio(corpo);
        if (!e.ok) return { ok: false, errore: "Non salvato, riprova." };
        negozio = e.dati;
        salvaCacheNegozio(CHIAVE_CACHE, negozio);
        mostraNegozio();
        ctx.nascondiAvviso();
        return { ok: true };
      } catch {
        ctx.avviso(NON_RAGGIUNGIBILE, () => void carica());
        return { ok: false, errore: NON_RAGGIUNGIBILE };
      }
    },
    avviso(testo, riprova) {
      $("avviso-testo").textContent = testo;
      riprovaAvviso = riprova;
      $("riprova").hidden = !riprova;
      $("avviso").hidden = false;
    },
    nascondiAvviso: () => void ($("avviso").hidden = true),
    toast(testo, annulla) {
      $("toast-testo").textContent = testo;
      $("toast-annulla").hidden = !annulla;
      annullaToast = annulla;
      $("toast").hidden = false;
      clearTimeout(timerToast);
      timerToast = window.setTimeout(() => {
        $("toast").hidden = true;
        annullaToast = undefined;
      }, TOAST_MS);
    },
  };

  function mostraNegozio() {
    if (!negozio) return;
    applicaTema(negozio);
    const n = negozio.negozio;
    $("nome-negozio").textContent = n.nome;
    $("marchio").textContent = n.nome.trim().charAt(0).toUpperCase();
    const logo = $<HTMLImageElement>("logo");
    logo.hidden = !n.logo;
    $("marchio").hidden = !!n.logo;
    if (n.logo) logo.src = `/logo/${encodeURIComponent(n.logo)}`;
  }

  /** Una sezione per ogni servizio attivo che il guscio conosce, nell'ordine del catalogo; si monta una volta sola. */
  function montaSezioni(n: RispostaNegozio) {
    for (const id of n.servizi) {
      const servizio = per.get(id);
      if (!servizio || montati.includes(id)) continue;
      const sezione = document.createElement("section");
      sezione.className = "servizio";
      sezione.dataset.servizio = id;
      $("sezioni").append(sezione);
      montati.push(id);
      void servizio.montaPannello(sezione, ctx);
    }
  }

  async function carica() {
    try {
      const r = await fetch("/api/negozio", { cache: "no-store" });
      const e = validaRispostaNegozio(await r.json());
      if (!e.ok) throw new Error("negozio non valido");
      negozio = e.dati;
      salvaCacheNegozio(CHIAVE_CACHE, negozio);
      ctx.nascondiAvviso();
      mostraNegozio();
      montaSezioni(negozio);
    } catch {
      ctx.avviso(NON_RAGGIUNGIBILE, () => void carica());
    }
  }

  $("riprova").addEventListener("click", () => riprovaAvviso?.());
  $("toast-annulla").addEventListener("click", () => {
    const annulla = annullaToast;
    if (!annulla) return;
    $("toast").hidden = true;
    annullaToast = undefined;
    annulla();
  });
  void carica();
}
