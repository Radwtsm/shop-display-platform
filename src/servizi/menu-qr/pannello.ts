// Il Menu nel pannello del negoziante: QR per i clienti, categorie, piatti, allergeni, "finito oggi". Si monta nella
// sua sezione del guscio (public/panel.html); token, avvisi e toast sono del guscio.
import { frammento } from "../../piattaforma/client/dom.ts";
import { formatta, leggi, perCampo } from "../../piattaforma/core/prezzo.ts";
import { sceltaTema } from "../../piattaforma/core/negozio.ts";
import { percorsoQr, urlQrValido } from "../../piattaforma/core/qr.ts";
import { NON_RAGGIUNGIBILE, type ContestoPannello, type Esito, type ServizioPannello } from "../../piattaforma/pannello/contratto.ts";
import { ALLERGENI, allergene, type IdAllergene } from "./core/allergeni.ts";
import { perCategoria, senzaCategoria } from "./core/filtri.ts";
import { segnaFinito, finitoOggi } from "./core/finito.ts";
import { idDa } from "./core/id.ts";
import { MAX_CATEGORIE, MAX_PIATTI, type DatiMenu, type Piatto } from "./core/tipi.ts";
import { valida } from "./core/valida.ts";
import { scaricaMenu } from "./client.ts";
import { iconaAllergene } from "./icone.ts";
import { MARKUP_PANNELLO } from "./pannello-markup.ts";
import { caricaStile } from "./stile.ts";

const PERCORSO = "/api/menu-qr/menu";
const TESTO_QR = "Menu e allergeni";

function montaPannello(sezione: HTMLElement, ctx: ContestoPannello) {
  sezione.append(frammento(MARKUP_PANNELLO));
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => sezione.querySelector(`#${id}`) as T;
  const radice = sezione.querySelector<HTMLElement>(".mn-pann")!;

  let menu: DatiMenu | null = null;
  let piattoAperto: string | null = null; // id del piatto nel foglio; null = nuovo
  let catAperta: string | null = null;

  const copia = (m: DatiMenu): DatiMenu => structuredClone(m);
  const campo = (f: HTMLFormElement, n: string) => f.elements.namedItem(n) as HTMLInputElement;
  const formPiatto = () => $<HTMLFormElement>("mn-form-piatto");
  const formCat = () => $<HTMLFormElement>("mn-form-cat");

  function errore(id: string, input: HTMLInputElement | null, testo: string) {
    const p = $(id);
    p.textContent = testo;
    p.hidden = !testo;
    if (input) {
      if (testo) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  async function salva(nuovo: DatiMenu, messaggio: string, annullabile = true): Promise<Esito> {
    const e = valida(nuovo);
    if (!e.ok) return { ok: false, errore: e.errori.join(" · ") };
    if (!ctx.token()) return { ok: false, errore: "Per modificare apri il pannello dal link completo che ti abbiamo dato." };
    const prima = menu ? copia(menu) : null;
    try {
      const r = await fetch(PERCORSO, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Token": ctx.token() },
        body: JSON.stringify(e.dati),
      });
      const corpo = await r.json().catch(() => ({}));
      if (r.status === 401) return { ok: false, errore: "Questo link non è più valido. Chiedi il link nuovo a chi ha installato la TV." };
      if (!r.ok) return { ok: false, errore: (corpo as { errori?: string[] }).errori?.join(" · ") ?? "Non salvato, riprova." };
      menu = corpo as DatiMenu;
      ctx.nascondiAvviso();
      disegna();
      ctx.toast(`${messaggio} ✓`, annullabile && prima ? () => void salva(prima, "Modifica annullata", false).then((x) => !x.ok && ctx.avviso(x.errore)) : undefined);
      return { ok: true };
    } catch {
      ctx.avviso(NON_RAGGIUNGIBILE, () => void carica());
      return { ok: false, errore: NON_RAGGIUNGIBILE };
    }
  }

  // ---- QR per i clienti ----
  const indirizzoMenu = () => `${location.origin}/menu.html`;

  function disegnaQr() {
    $("mn-link").textContent = indirizzoMenu();
    try {
      const q = percorsoQr(indirizzoMenu());
      const margine = 2;
      const svg = $("mn-qr");
      svg.setAttribute("viewBox", `${-margine} ${-margine} ${q.lato + 2 * margine} ${q.lato + 2 * margine}`);
      $("mn-qr-path").setAttribute("d", q.d);
      svg.hidden = false;
    } catch {
      $("mn-qr").hidden = true;
    }
    const sulla = ctx.negozio().negozio.qr?.url === indirizzoMenu();
    $("mn-qr-tv").querySelector(".riga-titolo")!.textContent = sulla ? "Il QR è sulla TV" : "Mostra questo QR sulla TV";
    ($("mn-qr-tv") as HTMLButtonElement).disabled = sulla;
  }

  $("mn-qr-tv").addEventListener("click", async () => {
    errore("mn-err-qr", null, "");
    if (!urlQrValido(indirizzoMenu())) {
      return errore("mn-err-qr", null, "La TV mostra solo QR con indirizzo https. Questo indirizzo è interno al negozio: usa il sito pubblico del negozio.");
    }
    const n = ctx.negozio();
    const r = await ctx.salvaNegozio({
      versione: 1,
      negozio: { ...n.negozio, qr: { url: indirizzoMenu(), testo: TESTO_QR } },
      ...sceltaTema(n),
      ...(n.disposizione ? { disposizione: n.disposizione } : {}),
    });
    if (!r.ok) errore("mn-err-qr", null, r.errore);
    else disegnaQr();
  });

  // ---- Lista ----
  function sotto(p: Piatto): string {
    const allergeni = p.allergeni === null ? "allergeni da indicare" : p.allergeni.length ? p.allergeni.map((a) => allergene(a).breve).join(", ") : "nessun allergene";
    return [formatta(p.prezzo), allergeni, finitoOggi(p) ? "finito oggi" : ""].filter(Boolean).join(" · ");
  }

  function rigaPiatto(p: Piatto): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "offerta-riga" + (finitoOggi(p) ? " nascosta" : "");
    li.dataset.id = p.id;
    const apri = document.createElement("button");
    apri.type = "button";
    apri.className = "riga";
    const testi = document.createElement("span");
    testi.className = "riga-testi";
    const tit = document.createElement("span");
    tit.className = "riga-titolo";
    tit.textContent = p.nome;
    const sub = document.createElement("span");
    sub.className = "riga-sotto";
    sub.textContent = sotto(p);
    testi.append(tit, sub);
    apri.append(testi);
    apri.addEventListener("click", () => apriPiatto(p.id));
    const zona = document.createElement("label");
    zona.className = "interruttore-zona";
    const sw = document.createElement("input");
    sw.type = "checkbox";
    sw.setAttribute("role", "switch");
    sw.checked = !finitoOggi(p);
    sw.setAttribute("aria-label", `${p.nome}: disponibile oggi`);
    sw.addEventListener("change", async () => {
      const nuovo = copia(menu!);
      const i = nuovo.piatti.findIndex((x) => x.id === p.id);
      nuovo.piatti[i] = segnaFinito(nuovo.piatti[i]!, !sw.checked);
      const r = await salva(nuovo, sw.checked ? `${p.nome}: di nuovo disponibile` : `${p.nome}: finito oggi`);
      if (!r.ok) {
        sw.checked = !sw.checked;
        ctx.avviso(r.errore);
      }
    });
    zona.append(sw);
    li.append(apri, zona);
    return li;
  }

  function disegna() {
    if (!menu) return;
    const gruppi = perCategoria(menu.categorie, menu.piatti);
    const blocchi = menu.categorie.map((c) => {
      const piatti = gruppi.find((g) => g.categoria.id === c.id)?.piatti ?? [];
      const box = document.createElement("section");
      box.dataset.categoria = c.id;
      const testata = document.createElement("div");
      testata.className = "mn-pann-cat";
      const h = document.createElement("h3");
      h.className = "sezione";
      h.textContent = c.nome;
      const mod = document.createElement("button");
      mod.type = "button";
      mod.className = "testo-azione";
      mod.textContent = "Modifica";
      mod.setAttribute("aria-label", `Modifica la categoria ${c.nome}`);
      mod.addEventListener("click", () => apriCategoria(c.id));
      testata.append(h, mod);
      box.append(testata);
      if (piatti.length) {
        const ul = document.createElement("ul");
        ul.className = "gruppo";
        ul.setAttribute("aria-label", c.nome);
        ul.append(...piatti.map(rigaPiatto));
        box.append(ul);
      } else {
        const p = document.createElement("p");
        p.className = "nota-gruppo";
        p.textContent = "Nessun piatto in questa categoria.";
        box.append(p);
      }
      return box;
    });
    $("mn-lista").replaceChildren(...blocchi);
    $("mn-vuoto").hidden = menu.categorie.length > 0;
    ($("mn-nuovo-piatto") as HTMLButtonElement).disabled = !menu.categorie.length || menu.piatti.length >= MAX_PIATTI;
    ($("mn-nuova-cat") as HTMLButtonElement).disabled = menu.categorie.length >= MAX_CATEGORIE;
    disegnaQr();
  }

  // ---- Foglio piatto ----
  const voci = new Map<IdAllergene, HTMLInputElement>();
  for (const a of ALLERGENI) {
    const label = document.createElement("label");
    label.className = "riga interruttore mn-pann-voce";
    const nome = document.createElement("span");
    nome.append(iconaAllergene(a));
    const t = document.createElement("span");
    t.className = "riga-titolo";
    t.textContent = a.nome;
    nome.append(t);
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.setAttribute("role", "switch");
    cb.name = `allergene-${a.id}`;
    voci.set(a.id, cb);
    label.append(nome, cb);
    $("mn-allergeni-campi").append(label);
  }
  const sincronizzaControllati = () => {
    ($("mn-allergeni-campi") as HTMLFieldSetElement).disabled = !campo(formPiatto(), "controllati").checked;
  };
  campo(formPiatto(), "controllati").addEventListener("change", sincronizzaControllati);

  function apriPiatto(id: string | null) {
    if (!menu) return;
    piattoAperto = id;
    const p = id ? menu.piatti.find((x) => x.id === id) : undefined;
    const f = formPiatto();
    campo(f, "nome").value = p?.nome ?? "";
    campo(f, "descrizione").value = p?.descrizione ?? "";
    campo(f, "prezzo").value = p ? perCampo(p.prezzo) : "";
    const sel = f.elements.namedItem("categoria") as HTMLSelectElement;
    sel.replaceChildren(
      ...menu.categorie.map((c) => {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome;
        return o;
      }),
    );
    sel.value = p?.categoria ?? menu.categorie[0]!.id;
    campo(f, "controllati").checked = p ? p.allergeni !== null : false;
    for (const [a, cb] of voci) cb.checked = !!p?.allergeni?.includes(a);
    sincronizzaControllati();
    campo(f, "disponibile").checked = !p || !finitoOggi(p);
    $("mn-fp-tit").textContent = p ? "Piatto" : "Nuovo piatto";
    $("mn-zona-elimina-piatto").hidden = !p;
    errore("mn-err-nome", campo(f, "nome"), "");
    errore("mn-err-prezzo", campo(f, "prezzo"), "");
    errore("mn-err-piatto", null, "");
    $<HTMLDialogElement>("mn-foglio-piatto").showModal();
    if (!p) campo(f, "nome").focus();
  }
  $("mn-nuovo-piatto").addEventListener("click", () => apriPiatto(null));

  formPiatto().addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!menu) return;
    const f = formPiatto();
    const nome = campo(f, "nome").value.trim();
    const testoPrezzo = campo(f, "prezzo").value.trim();
    const prezzo = testoPrezzo ? leggi(testoPrezzo) : null;
    errore("mn-err-nome", campo(f, "nome"), nome ? "" : "Scrivi il nome del piatto.");
    errore("mn-err-prezzo", campo(f, "prezzo"), prezzo === null ? "Scrivi il prezzo così: 8,50" : "");
    if (!nome) return campo(f, "nome").focus();
    if (prezzo === null) return campo(f, "prezzo").focus();
    const nuovo = copia(menu);
    const descrizione = campo(f, "descrizione").value.trim();
    const dati: Omit<Piatto, "id"> = {
      nome,
      ...(descrizione ? { descrizione } : {}),
      prezzo,
      categoria: (f.elements.namedItem("categoria") as HTMLSelectElement).value,
      allergeni: campo(f, "controllati").checked ? ALLERGENI.filter((a) => voci.get(a.id)!.checked).map((a) => a.id) : null,
    };
    const finito = !campo(f, "disponibile").checked;
    if (piattoAperto) {
      const i = nuovo.piatti.findIndex((x) => x.id === piattoAperto);
      nuovo.piatti[i] = segnaFinito({ id: piattoAperto, ...dati }, finito);
    } else {
      nuovo.piatti.push(segnaFinito({ id: idDa(nome, new Set(nuovo.piatti.map((x) => x.id))), ...dati }, finito));
    }
    const r = await salva(nuovo, piattoAperto ? "Piatto aggiornato" : "Piatto aggiunto");
    if (r.ok) $<HTMLDialogElement>("mn-foglio-piatto").close();
    else errore("mn-err-piatto", null, r.errore);
  });

  // ---- Foglio categoria ----
  function apriCategoria(id: string | null) {
    if (!menu) return;
    catAperta = id;
    const c = id ? menu.categorie.find((x) => x.id === id) : undefined;
    const f = formCat();
    campo(f, "nome").value = c?.nome ?? "";
    $("mn-fc-tit").textContent = c ? "Categoria" : "Nuova categoria";
    $("mn-zona-elimina-cat").hidden = !c;
    errore("mn-err-cat-nome", campo(f, "nome"), "");
    errore("mn-err-cat", null, "");
    $<HTMLDialogElement>("mn-foglio-cat").showModal();
    if (!c) campo(f, "nome").focus();
  }
  $("mn-nuova-cat").addEventListener("click", () => apriCategoria(null));

  formCat().addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!menu) return;
    const nome = campo(formCat(), "nome").value.trim();
    errore("mn-err-cat-nome", campo(formCat(), "nome"), nome ? "" : "Scrivi il nome della categoria.");
    if (!nome) return campo(formCat(), "nome").focus();
    const nuovo = copia(menu);
    if (catAperta) nuovo.categorie.find((x) => x.id === catAperta)!.nome = nome;
    else nuovo.categorie.push({ id: idDa(nome, new Set(nuovo.categorie.map((x) => x.id))), nome });
    const r = await salva(nuovo, catAperta ? "Categoria aggiornata" : "Categoria aggiunta");
    if (r.ok) $<HTMLDialogElement>("mn-foglio-cat").close();
    else errore("mn-err-cat", null, r.errore);
  });

  // ---- Elimina (con conferma) ----
  let eliminare: (() => Promise<Esito>) | null = null;
  function chiediConferma(titolo: string, sottoTesto: string, azione: () => Promise<Esito>) {
    $("mn-conf-tit").textContent = titolo;
    $("mn-conf-sotto").textContent = sottoTesto;
    eliminare = azione;
    $<HTMLDialogElement>("mn-conferma").showModal();
  }
  $("mn-elimina-piatto").addEventListener("click", () => {
    const p = menu?.piatti.find((x) => x.id === piattoAperto);
    if (!p) return;
    chiediConferma(`Eliminare "${p.nome}"?`, "Non comparirà più nel menu. Puoi annullare subito dopo.", () => {
      const nuovo = copia(menu!);
      nuovo.piatti = nuovo.piatti.filter((x) => x.id !== p.id);
      return salva(nuovo, "Piatto eliminato");
    });
  });
  $("mn-elimina-cat").addEventListener("click", () => {
    const c = menu?.categorie.find((x) => x.id === catAperta);
    if (!c) return;
    const quanti = menu!.piatti.filter((p) => p.categoria === c.id).length;
    chiediConferma(
      `Eliminare "${c.nome}"?`,
      quanti ? `Spariranno anche i ${quanti} piatti che contiene. Puoi annullare subito dopo.` : "Non comparirà più nel menu. Puoi annullare subito dopo.",
      () => salva(senzaCategoria(copia(menu!), c.id), "Categoria eliminata"),
    );
  });
  $("mn-conf-no").addEventListener("click", () => $<HTMLDialogElement>("mn-conferma").close());
  $("mn-conf-si").addEventListener("click", async () => {
    const r = eliminare ? await eliminare() : ({ ok: false, errore: "" } as Esito);
    $<HTMLDialogElement>("mn-conferma").close();
    if (r.ok) {
      $<HTMLDialogElement>("mn-foglio-piatto").close();
      $<HTMLDialogElement>("mn-foglio-cat").close();
    } else if (r.errore) {
      ctx.avviso(r.errore);
    }
  });

  for (const b of sezione.querySelectorAll<HTMLButtonElement>("[data-chiudi]")) b.addEventListener("click", () => b.closest("dialog")!.close());

  async function carica() {
    const r = await scaricaMenu();
    if (r.stato === "nuovo") {
      menu = r.menu;
      disegna();
      ctx.nascondiAvviso();
    } else if (r.stato === "errore") ctx.avviso(NON_RAGGIUNGIBILE, () => void carica());
  }

  return caricaStile().then(async () => {
    radice.hidden = false;
    await carica();
  });
}

export const servizioPannello: ServizioPannello = { id: "menu-qr", montaPannello };
