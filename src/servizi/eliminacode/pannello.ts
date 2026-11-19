// L'Eliminacode nel pannello del negoziante: «Prossimo» grande, «Indietro» per gli sbagli, «Azzera» con conferma,
// uno o due banchi. Token, avvisi e conferme in basso sono del guscio.
import { frammento } from "../../piattaforma/client/dom.ts";
import { NON_RAGGIUNGIBILE, type ContestoPannello, type ServizioPannello } from "../../piattaforma/pannello/contratto.ts";
import { leggi } from "./core/client.ts";
import { descrivi, ROTTA, type Azione, type DatiEliminacode } from "./core/tipi.ts";
import { nomiBanchi, valida } from "./core/valida.ts";
import { MARKUP_PANNELLO } from "./pannello-markup.ts";

const AGGIORNA_MS = 2000;
const CHIAVE_BANCO = "eliminacode.banco";

const FOGLIO = "/eliminacode-pannello.css";

function montaPannello(sezione: HTMLElement, ctx: ContestoPannello) {
  // Foglio di stile solo dell'Eliminacode (public/eliminacode-pannello.css): un file, non un foglio costruito dal
  // codice, perché Safari applica la CSP `style-src 'self'` anche a quelli.
  const foglio = document.createElement("link");
  foglio.rel = "stylesheet";
  foglio.href = FOGLIO;
  document.head.append(foglio);
  sezione.append(frammento(MARKUP_PANNELLO));
  const $ = <T extends HTMLElement = HTMLElement>(classe: string) => sezione.querySelector(`.${classe}`) as T;
  const cifra = $("eq-p-cifra");
  const nomeBanco = $("eq-p-banco");
  const gruppoBanchi = $("eq-banchi");
  const prossimo = $<HTMLButtonElement>("eq-prossimo");
  const indietro = $<HTMLButtonElement>("eq-indietro");
  const azzera = $<HTMLButtonElement>("eq-azzera");
  const due = $<HTMLInputElement>("eq-due");
  const conferma = $<HTMLDialogElement>("eq-conferma");

  let dati: DatiEliminacode | null = null;
  let etag = "";
  let inCorso = false; // un tocco alla volta: il doppio tocco di una mano incerta non salta un numero
  let mioBanco = 0;
  try {
    mioBanco = Number(localStorage.getItem(CHIAVE_BANCO)) || 0;
  } catch {}

  const bottoni = [prossimo, indietro, azzera];
  const occupato = (si: boolean) => {
    inCorso = si;
    for (const b of bottoni) b.disabled = si || !dati;
  };

  function mostra(d: DatiEliminacode) {
    dati = d;
    cifra.textContent = d.numero === 0 ? "—" : String(d.numero);
    $("eq-p-numero").setAttribute("aria-label", descrivi(d));
    nomeBanco.textContent = d.banchi.length > 1 && d.numero > 0 ? d.banchi[d.banco]! : "";
    due.checked = d.banchi.length > 1;
    if (mioBanco >= d.banchi.length) mioBanco = 0;
    gruppoBanchi.hidden = d.banchi.length < 2;
    gruppoBanchi.replaceChildren(
      ...d.banchi.map((nome, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = nome;
        b.setAttribute("aria-pressed", String(i === mioBanco));
        b.addEventListener("click", () => {
          mioBanco = i;
          try {
            localStorage.setItem(CHIAVE_BANCO, String(i));
          } catch {}
          mostra(dati!);
        });
        return b;
      }),
    );
    indietro.disabled = inCorso || d.numero === 0;
    azzera.disabled = inCorso || d.numero === 0;
    prossimo.disabled = inCorso;
  }

  async function scrivi(metodo: "POST" | "PUT", rotta: string, corpo: unknown): Promise<DatiEliminacode | null> {
    if (!ctx.token()) {
      ctx.avviso("Per modificare apri il pannello dal link completo che ti abbiamo dato.");
      return null;
    }
    occupato(true);
    try {
      const r = await fetch(rotta, { method: metodo, headers: { "Content-Type": "application/json", "X-Token": ctx.token() }, body: JSON.stringify(corpo) });
      if (r.status === 401) {
        ctx.avviso("Questo link non è più valido. Chiedi il link nuovo a chi ha installato la TV.");
        return null;
      }
      const e = valida(await r.json().catch(() => null));
      if (!r.ok || !e.ok) {
        ctx.avviso("Non salvato, riprova.", () => void aggiorna());
        return null;
      }
      ctx.nascondiAvviso();
      etag = "";
      mostra(e.dati);
      return e.dati;
    } catch {
      ctx.avviso(NON_RAGGIUNGIBILE);
      return null;
    } finally {
      occupato(false);
      if (dati) mostra(dati);
    }
  }

  const azione = (a: Azione) => scrivi("POST", `${ROTTA}/azione`, { azione: a, banco: mioBanco });

  async function aggiorna() {
    const r = await leggi(etag);
    if (r.stato === "nuovo" && !inCorso) {
      etag = r.etag;
      mostra(r.dati);
      ctx.nascondiAvviso();
    }
  }

  prossimo.addEventListener("click", async () => {
    const d = await azione("prossimo");
    if (d) ctx.toast(`Chiamato il n. ${d.numero} ✓`, () => void azione("indietro"));
  });
  indietro.addEventListener("click", async () => {
    const d = await azione("indietro");
    if (d) ctx.toast(d.numero === 0 ? "Tornato all'inizio" : `Tornato al n. ${d.numero}`);
  });
  azzera.addEventListener("click", () => conferma.showModal());
  $("eq-conf-no").addEventListener("click", () => conferma.close());
  $("eq-conf-si").addEventListener("click", async () => {
    conferma.close();
    if (await azione("azzera")) ctx.toast("Numeri azzerati ✓");
  });
  due.addEventListener("change", async () => {
    const r = await scrivi("PUT", `${ROTTA}/banchi`, { banchi: nomiBanchi(due.checked ? 2 : 1) });
    if (!r) due.checked = !due.checked;
  });

  for (const b of bottoni) b.disabled = true; // finché non si sa a che numero siamo
  void aggiorna();
  setInterval(() => void aggiorna(), AGGIORNA_MS);
}

export const servizioPannello: ServizioPannello = { id: "eliminacode", montaPannello };
