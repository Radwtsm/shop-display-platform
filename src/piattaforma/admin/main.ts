import { avvisi, canone, cerca, durata, online, perServizio, riepilogo, spostaDemo, type Avviso, type Cliente, type DatiAdmin, type Dispositivo, type StatoServizio } from "../core/admin.ts";
import { servizio, type IdServizio, type Servizio } from "../core/servizi.ts";
import { FUSO } from "../core/orario.ts";
import { formatta, formattaBreve } from "../core/prezzo.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SEZIONI = ["panoramica", "clienti", "servizi"] as const;
type Sezione = (typeof SEZIONI)[number];

let dati: DatiAdmin | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, classe = "", testo = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (testo) e.textContent = testo;
  return e;
}

const ICONE: Record<string, string> = { ok: "●", attenzione: "▲", problema: "■" };

/** Stato sempre con icona + parola: mai solo il colore. */
function badge(tipo: "ok" | "attenzione" | "problema", testo: string): HTMLSpanElement {
  const b = el("span", `stato stato-${tipo}`);
  const i = el("span", "", ICONE[tipo]);
  i.setAttribute("aria-hidden", "true");
  b.append(i, document.createTextNode(testo));
  return b;
}

const NOMI_LIVELLO: Record<Avviso["livello"], string> = { problema: "Problema", attenzione: "Attenzione" };

const giorno = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });
const dataBreve = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, day: "numeric", month: "long", year: "numeric" });
const ora24 = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, hour: "numeric", hourCycle: "h23" });

function saluto(ora: number): string {
  const h = Number(ora24.format(ora));
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

const fa = (iso: string, ora: number) => `${durata(ora - Date.parse(iso))} fa`;

function statoDispositivo(s: Dispositivo, ora: number): HTMLSpanElement {
  const p = servizio(s.servizio).dispositivi;
  const [acceso, spento] = p ? [p.acceso, p.spento] : ["Acceso", "Spento"];
  return online(s, ora) ? badge("ok", acceso) : badge("problema", `${spento} da ${durata(ora - Date.parse(s.ultimoSegnale))}`);
}

/** Icona del servizio (simboli in admin.html): sempre accanto al suo nome. */
function icona(id: IdServizio): HTMLSpanElement {
  const box = el("span", "icona-servizio");
  box.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${id}`);
  svg.append(use);
  box.append(svg);
  return box;
}

const freccia = () => Object.assign(el("span", "freccia", "›"), { ariaHidden: "true" });
const clientiN = (n: number) => (n === 1 ? "1 cliente" : `${n} clienti`);

/** Stato degli apparecchi di un servizio ("6 di 7 TV"); un servizio senza apparecchi non ha stato da mostrare. */
function statoApparecchi(t: StatoServizio): HTMLSpanElement | null {
  const p = t.servizio.dispositivi;
  if (!p || !t.dispositiviTotali) return null;
  const testo = `${t.dispositiviOnline} di ${t.dispositiviTotali} ${p.plurale}`;
  return badge(t.problemi ? "problema" : t.dispositiviOnline < t.dispositiviTotali ? "attenzione" : "ok", testo);
}

function rigaServizio(t: StatoServizio): HTMLLIElement {
  const li = el("li");
  const b = el("button", "riga");
  b.type = "button";
  const testi = el("span", "riga-testi");
  testi.append(el("span", "riga-titolo", t.servizio.nome), el("span", "riga-sotto", `${clientiN(t.clienti.length)} · ${formattaBreve(t.canoniMese)}/mese`));
  const stato = statoApparecchi(t);
  const d = el("span", "riga-destra");
  if (stato) d.append(stato);
  b.append(icona(t.servizio.id), testi, d, freccia());
  b.addEventListener("click", () => apriServizio(t.servizio.id));
  li.append(b);
  return li;
}

function rigaInArrivo(s: Servizio): HTMLLIElement {
  const li = el("li");
  const r = el("div", "riga");
  const testi = el("span", "riga-testi");
  testi.append(el("span", "riga-titolo", s.nome), el("span", "riga-sotto", s.cosa));
  r.append(icona(s.id), testi);
  li.append(r);
  return li;
}

function rigaAvviso(a: Avviso): HTMLLIElement {
  const li = el("li");
  const b = el("button", "riga");
  b.type = "button";
  const t = el("span", "riga-testi");
  t.append(badge(a.livello, NOMI_LIVELLO[a.livello]), el("span", "riga-titolo", `${a.cliente}: ${a.titolo}`), el("span", "avviso-cosa", a.cosaFare));
  b.append(t, Object.assign(el("span", "freccia", "›"), { ariaHidden: "true" }));
  b.addEventListener("click", () => apriCliente(a.clienteId));
  li.append(b);
  return li;
}

function disegnaPanoramica(ora: number) {
  const r = riepilogo(dati!, ora);
  $("data-oggi").textContent = giorno.format(ora);
  $("t-panoramica").textContent = saluto(ora);
  $("k-clienti").textContent = String(r.clienti);
  $("k-clienti-nota").textContent = r.abbonamenti === 1 ? "1 servizio in uso" : `${r.abbonamenti} servizi in uso`;
  $("k-dispositivi").textContent = `${r.dispositiviOnline} di ${r.dispositiviTotali}`;
  const spenti = r.dispositiviTotali - r.dispositiviOnline;
  $("k-dispositivi-nota").replaceChildren(spenti ? badge("problema", spenti === 1 ? "1 spento" : `${spenti} spenti`) : badge("ok", "Tutti accesi"));
  $("k-canoni").textContent = formattaBreve(r.canoniMese);
  $("k-avvisi").textContent = String(r.avvisi.length);
  const problemi = r.avvisi.filter((a) => a.livello === "problema").length;
  $("k-avvisi-nota").replaceChildren(
    r.avvisi.length ? badge(problemi ? "problema" : "attenzione", problemi ? (problemi === 1 ? "1 urgente" : `${problemi} urgenti`) : "Niente di urgente") : badge("ok", "Niente da fare"),
  );
  $("lista-avvisi").replaceChildren(...r.avvisi.map(rigaAvviso));
  $("lista-avvisi").hidden = !r.avvisi.length;
  $("tutto-ok").hidden = !!r.avvisi.length;
  $("servizi-panoramica").replaceChildren(...perServizio(dati!, ora).attivi.map(rigaServizio));
}

/** Stato del cliente in una parola, uguale per ogni servizio: dagli avvisi, non dagli schermi. */
function statoCliente(c: Cliente, ora: number): HTMLSpanElement {
  const suoi = avvisi(dati!, ora).filter((a) => a.clienteId === c.id);
  const problemi = suoi.filter((a) => a.livello === "problema").length;
  if (problemi) return badge("problema", problemi === 1 ? "1 problema" : `${problemi} problemi`);
  return suoi.length ? badge("attenzione", "Da controllare") : badge("ok", "Tutto a posto");
}

const nomiServizi = (c: Cliente) => c.servizi.map((a) => servizio(a.servizio).nome).join(", ");

function rigaCliente(c: Cliente, ora: number): HTMLLIElement {
  const li = el("li");
  const b = el("button", "riga");
  b.type = "button";
  const t = el("span", "riga-testi");
  t.append(el("span", "riga-titolo", c.nome), el("span", "riga-sotto", [c.settore, c.zona, nomiServizi(c)].join(" · ")));
  const d = el("span", "riga-destra");
  d.append(el("span", "", `${formatta(canone(c))}/mese`), statoCliente(c, ora));
  b.append(t, d, freccia());
  b.addEventListener("click", () => apriCliente(c.id));
  li.append(b);
  return li;
}

function disegnaClienti(ora: number) {
  const r = riepilogo(dati!, ora);
  $("clienti-sopra").textContent = `${r.clienti} clienti · ${formattaBreve(r.canoniMese)} al mese`;
  const trovati = cerca(dati!.clienti, $<HTMLInputElement>("cerca").value);
  $("lista-clienti").replaceChildren(...trovati.map((c) => rigaCliente(c, ora)));
  $("lista-clienti").hidden = !trovati.length;
  $("nessun-cliente").hidden = !!trovati.length;
}

function disegnaServizi(ora: number) {
  const { attivi, inArrivo } = perServizio(dati!, ora);
  $("servizi-sopra").textContent = `${attivi.length} attivi · ${inArrivo.length} in arrivo`;
  $("servizi-attivi").replaceChildren(...attivi.map(rigaServizio));
  $("servizi-in-arrivo").replaceChildren(...inArrivo.map(rigaInArrivo));
}

function rigaDispositivo(s: Dispositivo, c: Cliente | null, ora: number): HTMLLIElement {
  const li = el("li");
  const r = el("div", "riga");
  const t = el("span", "riga-testi");
  const versione = s.versione === dati!.versioneAttuale ? `versione ${s.versione}` : `versione ${s.versione} · da aggiornare`;
  t.append(el("span", "riga-titolo", c ? `${s.nome} · ${c.nome}` : s.nome), el("span", "riga-sotto", `${versione} · ultimo segnale ${fa(s.ultimoSegnale, ora)}`));
  r.append(t, statoDispositivo(s, ora));
  li.append(r);
  return li;
}

function riga(dt: string, dd: string): HTMLDivElement {
  const d = el("div");
  d.append(el("dt", "", dt), el("dd", "", dd));
  return d;
}

/** Il foglio è uno solo: cliente o servizio cambiano solo il contenuto. */
function apriFoglio(nome: string, sotto: string, avvisiFoglio: Avviso[], dati_: HTMLElement[], corpo: HTMLElement[], conCliente = false) {
  $("sc-nome").textContent = nome;
  $("sc-sotto").textContent = sotto;
  $("sc-avvisi").replaceChildren(
    ...avvisiFoglio.map((a) => {
      const box = el("div", "avviso-scheda");
      box.append(badge(a.livello, `${NOMI_LIVELLO[a.livello]}: ${conCliente ? `${a.cliente}, ` : ""}${a.titolo}`), el("span", "avviso-cosa", a.cosaFare));
      return box;
    }),
  );
  $("sc-dati").replaceChildren(...dati_);
  $("sc-corpo").replaceChildren(...corpo);
  const f = $<HTMLDialogElement>("scheda");
  if (!f.open) f.showModal();
  f.scrollTop = 0;
}

function apriCliente(id: string) {
  const c = dati?.clienti.find((x) => x.id === id);
  if (!c) return;
  const ora = Date.now();
  const corpo: HTMLElement[] = [];
  for (const a of c.servizi) {
    const sv = servizio(a.servizio);
    const h = el("h3", "titolo-sezione titolo-servizio");
    h.append(icona(sv.id), el("span", "", `${sv.nome} · ${formatta(a.canone)}/mese`));
    corpo.push(h);
    const suoi = c.dispositivi.filter((x) => x.servizio === sv.id);
    if (suoi.length) {
      const ul = el("ul", "gruppo");
      ul.setAttribute("aria-label", `${sv.nome}: apparecchi`);
      ul.replaceChildren(...suoi.map((x) => rigaDispositivo(x, null, ora)));
      corpo.push(ul);
    } else corpo.push(el("p", "vuoto", sv.dispositivi ? "Nessun apparecchio collegato." : "Funziona dal telefono del cliente: niente apparecchi in negozio."));
  }
  apriFoglio(c.nome, `${c.settore} · ${c.zona}`, avvisi(dati!, ora).filter((a) => a.clienteId === id), [
    riga("Cliente dal", dataBreve.format(Date.parse(c.cliente_dal))),
    Object.assign(riga("Canone", `${formatta(canone(c))} al mese`), { id: "sc-canone" }),
    riga("Ultimo backup", fa(c.backup.ultimo, ora)),
    riga("Prova di ripristino", fa(c.backup.provaRipristino, ora)),
  ], corpo);
}

function apriServizio(id: IdServizio) {
  const ora = Date.now();
  const t = perServizio(dati!, ora).attivi.find((x) => x.servizio.id === id);
  if (!t) return;
  const p = t.servizio.dispositivi;
  const corpo: HTMLElement[] = [el("h3", "titolo-sezione", "Clienti")];
  const ul = el("ul", "gruppo");
  ul.setAttribute("aria-label", `Clienti di ${t.servizio.nome}`);
  ul.replaceChildren(...t.clienti.map((c) => rigaCliente(c, ora)));
  corpo.push(ul);
  if (p && t.dispositiviTotali) {
    const righe = t.clienti.flatMap((c) => c.dispositivi.filter((x) => x.servizio === id).map((x) => ({ x, c })));
    righe.sort((a, b) => Number(online(a.x, ora)) - Number(online(b.x, ora)));
    const lista = el("ul", "gruppo");
    lista.setAttribute("aria-label", `${t.servizio.nome}: apparecchi`);
    lista.replaceChildren(...righe.map(({ x, c }) => rigaDispositivo(x, c, ora)));
    corpo.push(el("h3", "titolo-sezione", p.plurale[0]!.toUpperCase() + p.plurale.slice(1)), lista);
  }
  apriFoglio(t.servizio.nome, t.servizio.cosa, avvisi(dati!, ora).filter((a) => a.servizio === id),
    [
      riga("Clienti", String(t.clienti.length)),
      riga("Canoni al mese", formattaBreve(t.canoniMese)),
      ...(p && t.dispositiviTotali ? [riga("Apparecchi accesi", `${t.dispositiviOnline} di ${t.dispositiviTotali}`)] : []),
    ], corpo, true);
}

function sezioneDaUrl(): Sezione {
  const h = location.hash.slice(1);
  return (SEZIONI as readonly string[]).includes(h) ? (h as Sezione) : "panoramica";
}

function mostra() {
  const attiva = sezioneDaUrl();
  for (const s of SEZIONI) $(`sez-${s}`).hidden = s !== attiva;
  for (const a of document.querySelectorAll<HTMLAnchorElement>(".navigazione a"))
    if (a.dataset.sezione === attiva) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  if (!dati) return;
  const ora = Date.now();
  if (attiva === "panoramica") disegnaPanoramica(ora);
  if (attiva === "clienti") disegnaClienti(ora);
  if (attiva === "servizi") disegnaServizi(ora);
}

$("cerca").addEventListener("input", () => disegnaClienti(Date.now()));
$("sc-chiudi").addEventListener("click", () => $<HTMLDialogElement>("scheda").close());
// id delle sezioni ≠ hash: il browser non scorre da solo; ogni sezione parte dall'alto, titolo sempre nello stesso punto
addEventListener("hashchange", () => {
  mostra();
  scrollTo(0, 0);
});

fetch("/api/admin", { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  })
  .then((d: DatiAdmin) => {
    if (!Array.isArray(d.clienti)) throw new Error("dati");
    dati = spostaDemo(d, Date.now());
    mostra();
    document.body.dataset.pronto = "1";
  })
  .catch(() => {
    $("errore").textContent = "Non riesco a leggere i dati della dashboard. Il server è acceso?";
    $("errore").hidden = false;
  });
mostra();
setInterval(mostra, 30_000);
