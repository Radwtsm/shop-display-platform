// Lo Schermo nel pannello del negoziante: offerte, colori, aspetto, negozio. Si monta nella sua sezione del guscio
// (public/panel.html); token, avvisi, conferme e colori del negozio sono del guscio.
import { frammento } from "../../piattaforma/client/dom.ts";
import { animaEntrata, applicaAspetto } from "./core/client.ts";
import { aspettoCompleto, consigliata, GRUPPI_ASPETTO, riassuntoAspetto, SECONDI, type Aspetto } from "./core/aspetto.ts";
import { descriviFasce, indiceCorrente } from "../../piattaforma/core/orario.ts";
import { slideAttive } from "./core/offerte.ts";
import { formatta, leggi, perCampo } from "../../piattaforma/core/prezzo.ts";
import { descriviQuantita, leggiQuantita, prezzoPerUnita } from "../../piattaforma/core/unita.ts";
import { urlQrValido } from "../../piattaforma/core/qr.ts";
import { BARRA_CONSIGLIATA, DISPOSIZIONI, POSIZIONI_BARRA, TEMI, VARIANTI_TEMA, variantiDi, type Citta, type DatiNegozio, type Disposizione, type PosizioneBarra, type Tema, type VarianteTema } from "../../piattaforma/core/negozio.ts";
import { NON_RAGGIUNGIBILE, type ContestoPannello, type Esito, type ServizioPannello } from "../../piattaforma/pannello/contratto.ts";
import { componi, dividi, type Colori, type Config, type Slide } from "./core/tipi.ts";
import { posizioneBarra } from "../../piattaforma/core/barra.ts";
import type { Fascia } from "../../piattaforma/core/orario.ts";
import { COMBINAZIONI, daUnColore, problemiColori, sistema, stessiColori } from "../../piattaforma/core/colori.ts";
import { valida } from "./core/valida.ts";
import { FOTO_LATO_PANNELLO, FOTO_MAX_BYTE } from "../../piattaforma/core/foto.ts";
import { MARKUP_PANNELLO } from "./pannello-markup.ts";

const NOME_TEMA: Record<Tema, string> = { natale: "Natale", pasqua: "Pasqua", estate: "Estate", saldi: "Saldi", blackfriday: "Black Friday" };
type SceltaPannello = Tema | "";
const COLORI_TEMA = ["tema", "negozio"] as const;
const NOME_COLORI_TEMA: Record<(typeof COLORI_TEMA)[number], string> = { tema: "Colori del tema", negozio: "I miei colori" };
/** "" = palette base del tema. Oggi solo Natale ha varianti: un tema nuovo con varianti allarga questa lista. */
const VARIANTI_PANNELLO = ["", ...VARIANTI_TEMA.natale] as const;
const NOME_VARIANTE: Record<VarianteTema | "", string> = { "": "Classico", elegante: "Elegante", nordico: "Nordico", caldo: "Caldo" };
const NOME_BARRA: Record<PosizioneBarra, string> = { sotto: "Sotto", sopra: "Sopra", nascosta: "Nascosta" };
const FASCE_MAX = 10;
const NOME_DISPOSIZIONE: Record<Disposizione, string> = { intero: "Uno alla volta", affiancato: "Affiancati" };

function montaPannello(sezione: HTMLElement, ctx: ContestoPannello) {
  sezione.append(frammento(MARKUP_PANNELLO));
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => sezione.querySelector(`#${id}`) as T;

  let config: Config | null = null;
  let inModifica: string | null = null; // id dell'offerta aperta nel foglio; null = nuova
  let fotoScelta: string | undefined; // foto dell'offerta aperta nel foglio: si salva solo con "Fatto"

  const copia = (c: Config): Config => structuredClone(c);

  function sottotitolo(s: Slide): string {
    if (!s.attiva) return "Nascosta dalla TV";
    // con le fasce si mostra quando va in onda (spesso la nota lo ripete già)
    const dettaglio = descriviFasce(s.fasce) || s.nota || "";
    let prezzo = s.prezzo !== undefined ? formatta(s.prezzo) : "";
    if (s.prezzo !== undefined && s.quantita) {
      const u = prezzoPerUnita(s.prezzo, s.quantita);
      prezzo += ` per ${descriviQuantita(s.quantita)} (${formatta(u.centesimi)}/${u.per})`;
    }
    return [prezzo, dettaglio].filter(Boolean).join(" · ");
  }

  function riga(s: Slide): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "offerta-riga" + (s.attiva ? "" : " nascosta");
    li.dataset.id = s.id;
    const apri = document.createElement("button");
    apri.type = "button";
    apri.className = "riga";
    const testi = document.createElement("span");
    testi.className = "riga-testi";
    const tit = document.createElement("span");
    tit.className = "riga-titolo";
    tit.textContent = s.titolo;
    const sotto = document.createElement("span");
    sotto.className = "riga-sotto";
    sotto.textContent = sottotitolo(s);
    testi.append(tit, sotto);
    if (s.foto) {
      const img = document.createElement("img");
      img.className = "lista-foto";
      img.alt = "";
      img.src = `/foto/${encodeURIComponent(s.foto)}`;
      apri.append(img);
    }
    apri.append(testi);
    apri.addEventListener("click", () => apriOfferta(s.id));
    const zona = document.createElement("label");
    zona.className = "interruttore-zona";
    const sw = document.createElement("input");
    sw.type = "checkbox";
    sw.setAttribute("role", "switch");
    sw.checked = s.attiva;
    sw.setAttribute("aria-label", `Mostra ${s.titolo} sulla TV`);
    sw.addEventListener("change", async () => {
      const nuova = copia(config!);
      nuova.slides.find((x) => x.id === s.id)!.attiva = sw.checked;
      const r = await salva(nuova, sw.checked ? `${s.titolo}: di nuovo sulla TV` : `${s.titolo}: nascosta dalla TV`);
      if (!r.ok) {
        sw.checked = !sw.checked;
        mostraAvviso(r.errore, false);
      }
    });
    zona.append(sw);
    li.append(apri, zona);
    return li;
  }

  function disegna() {
    if (!config) return;
    const n = config.negozio;
    $("offerte").replaceChildren(...config.slides.map(riga));
    $("offerte").hidden = !config.slides.length;
    $("vuoto").hidden = !!config.slides.length;
    $("zona-negozio").hidden = false;
    $("negozio-sotto").textContent = `${n.nome}${n.orari?.length ? " · orari" : ""}${n.citta ? ` · meteo ${n.citta.nome.split(",")[0]}` : ""}${n.qr ? " · QR sulla TV" : ""}`;
    coloraMini($("colori-mini"), n.colori);
    coloraMini($("aspetto-mini"), n.colori);
    applicaAspetto($("aspetto-mini"), config.aspetto);
    const tema = config.tema ? `tema ${NOME_TEMA[config.tema].toLowerCase()}` : "";
    const variante = config.temaVariante && config.temaColori !== "negozio" ? ` ${NOME_VARIANTE[config.temaVariante].toLowerCase()}` : "";
    const extra = [tema && config.temaColori === "negozio" ? `${tema} con i tuoi colori` : tema + variante, posizioneBarra(n.barra?.posizione) !== BARRA_CONSIGLIATA ? `barra ${NOME_BARRA[posizioneBarra(n.barra?.posizione)].toLowerCase()}` : ""].filter(Boolean);
    $("aspetto-sotto").textContent = [riassuntoAspetto(config.aspetto), ...extra].join(" · ") + ` · ${config.secondiPerSlide} secondi per offerta`;
    $("colori-sotto").textContent = nomeColori(config) + (n.contrastoLibero && problemiColori(n.colori).length ? " · si leggono male" : "");
    anteprima();
  }

  function anteprima() {
    if (!config) return;
    const ora = Date.now();
    const sez = $("anteprima-tit").closest("section")!;
    sez.dataset.tema = config.tema ?? "";
    sez.dataset.temaColori = config.temaColori ?? "";
    sez.dataset.temaVariante = config.temaVariante ?? "";
    const attive = slideAttive(config, ora);
    const s = attive[indiceCorrente(attive.length, ora, config.secondiPerSlide)];
    $("ant-titolo").textContent = s ? s.titolo : "Nessuna offerta sulla TV adesso";
    $("ant-prezzo").textContent = s?.prezzo !== undefined ? formatta(s.prezzo) : "";
    $("ant-nota").textContent = s?.nota ?? "";
    const foto = $<HTMLImageElement>("ant-foto");
    foto.hidden = !s?.foto;
    if (s?.foto && !foto.src.endsWith(`/foto/${s.foto}`)) foto.src = `/foto/${encodeURIComponent(s.foto)}`;
    const quante = attive.length === 1 ? "1 offerta" : `${attive.length} offerte`;
    $("ant-info").textContent = `Cambia ogni ${config.secondiPerSlide} secondi · ${quante} sulla TV adesso`;
  }

  const mostraAvviso = (testo: string, riprova: boolean) => ctx.avviso(testo, riprova ? () => void carica() : undefined);

  async function ripristina(prima: Config) {
    const r = await salva(prima, "Modifica annullata", false);
    if (!r.ok) mostraAvviso(r.errore, false);
  }

  const toast = (testo: string, prima: Config | null) => ctx.toast(testo, prima ? () => void ripristina(prima) : undefined);

  async function salva(nuova: Config, messaggio: string, annullabile = true): Promise<Esito> {
    const e = valida(nuova);
    if (!e.ok) return { ok: false, errore: e.errori.join(" · ") };
    if (!ctx.token()) return { ok: false, errore: "Per modificare apri il pannello dal link completo che ti abbiamo dato." };
    const prima = config ? copia(config) : null;
    try {
      const r = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Token": ctx.token() },
        body: JSON.stringify(e.config),
      });
      const corpo = await r.json().catch(() => ({}));
      if (r.status === 401)
        return { ok: false, errore: "Questo link non è più valido. Chiedi il link nuovo a chi ha installato la TV." };
      if (!r.ok) return { ok: false, errore: (corpo as { errori?: string[] }).errori?.join(" · ") ?? "Non salvato, riprova." };
      config = corpo as Config;
      ctx.negozioCambiato(dividi(config).negozio);
      ctx.nascondiAvviso();
      disegna();
      toast(`${messaggio} ✓`, annullabile ? prima : null);
      return { ok: true };
    } catch {
      mostraAvviso(NON_RAGGIUNGIBILE, true);
      return { ok: false, errore: NON_RAGGIUNGIBILE };
    }
  }

  function errore(id: string, input: HTMLInputElement | null, testo: string) {
    const p = $(id);
    p.textContent = testo;
    p.hidden = !testo;
    if (input) {
      if (testo) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  const formOfferta = () => $<HTMLFormElement>("modulo-offerta");

  function mostraFoto(stato = "") {
    const img = $<HTMLImageElement>("fo-foto");
    img.hidden = !fotoScelta;
    $("fo-foto-vuota").toggleAttribute("hidden", !!fotoScelta);
    if (fotoScelta) img.src = `/foto/${encodeURIComponent(fotoScelta)}`;
    $("fo-foto-scegli").textContent = fotoScelta ? "Cambia foto" : "Aggiungi foto";
    $("fo-foto-togli").hidden = !fotoScelta;
    $("fo-foto-stato").textContent = stato || (fotoScelta ? "Sulla TV accanto al nome e al prezzo" : "Scatta o scegli una foto del prodotto");
  }

  /** Rimpicciolisce e ridisegna la foto: via i dati del telefono (posizione, modello), peso adatto alla TV. */
  async function preparaFoto(file: File): Promise<Blob> {
    const bmp = await createImageBitmap(file);
    const scala = Math.min(1, FOTO_LATO_PANNELLO / Math.max(bmp.width, bmp.height));
    const tela = document.createElement("canvas");
    tela.width = Math.round(bmp.width * scala);
    tela.height = Math.round(bmp.height * scala);
    const ctx = tela.getContext("2d")!;
    const comeBlob = (tipo: string) => new Promise<Blob | null>((ok) => tela.toBlob(ok, tipo, 0.85));
    ctx.drawImage(bmp, 0, 0, tela.width, tela.height);
    // PNG (spesso prodotti scontornati) resta PNG se ci sta; altrimenti JPG su fondo bianco
    if (file.type === "image/png") {
      const png = await comeBlob("image/png");
      if (png && png.size <= FOTO_MAX_BYTE) return png;
    }
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, tela.width, tela.height);
    const jpg = await comeBlob("image/jpeg");
    if (!jpg) throw new Error("foto");
    return jpg;
  }

  $("fo-foto-file").addEventListener("change", async () => {
    const input = $<HTMLInputElement>("fo-foto-file");
    const file = input.files?.[0];
    input.value = ""; // la stessa foto si può scegliere di nuovo
    if (!file) return;
    errore("err-foto", null, "");
    if (!ctx.token()) return errore("err-foto", null, "Per caricare foto apri il pannello dal link completo che ti abbiamo dato.");
    const zona = $("fo-foto-scegli").closest("label")!;
    zona.setAttribute("aria-disabled", "true");
    mostraFoto("Preparo la foto…");
    try {
      let blob: Blob;
      try {
        blob = await preparaFoto(file);
      } catch {
        mostraFoto();
        return errore("err-foto", null, "Non riesco ad aprire questo file: scegli una foto (JPG, PNG o WebP).");
      }
      const r = await fetch("/api/foto", { method: "POST", headers: { "Content-Type": blob.type, "X-Token": ctx.token() }, body: blob });
      const corpo = (await r.json().catch(() => ({}))) as { foto?: string; errori?: string[] };
      if (!r.ok || !corpo.foto) {
        mostraFoto();
        return errore("err-foto", null, corpo.errori?.join(" · ") ?? "Foto non caricata, riprova.");
      }
      fotoScelta = corpo.foto;
      mostraFoto("Foto pronta: premi Fatto per metterla sulla TV");
    } catch {
      mostraFoto();
      errore("err-foto", null, NON_RAGGIUNGIBILE);
    } finally {
      zona.removeAttribute("aria-disabled");
    }
  });

  $("fo-foto-togli").addEventListener("click", () => {
    fotoScelta = undefined;
    mostraFoto("Foto tolta: premi Fatto per toglierla dalla TV");
  });
  const campo = (f: HTMLFormElement, n: string) => f.elements.namedItem(n) as HTMLInputElement;

  function apriOfferta(id: string | null) {
    if (!config) return;
    inModifica = id;
    const s = id ? config.slides.find((x) => x.id === id) : undefined;
    const f = formOfferta();
    campo(f, "titolo").value = s?.titolo ?? "";
    campo(f, "prezzo").value = s?.prezzo !== undefined ? perCampo(s.prezzo) : "";
    campo(f, "nota").value = s?.nota ?? "";
    campo(f, "quantita").value = s?.quantita ? descriviQuantita(s.quantita) : "";
    campo(f, "attiva").checked = s?.attiva ?? true;
    fotoScelta = s?.foto;
    mostraFoto();
    errore("err-foto", null, "");
    $("fo-tit").textContent = s ? "Offerta" : "Nuova offerta";
    $("zona-elimina").hidden = !s;
    const orario = descriviFasce(s?.fasce);
    $("fo-orario").textContent = orario ? `Sulla TV ${orario}. Per cambiare gli orari scrivi a chi ha installato la TV.` : "";
    $("fo-orario").hidden = !orario;
    errore("err-titolo", campo(f, "titolo"), "");
    errore("err-prezzo", campo(f, "prezzo"), "");
    errore("err-quantita", campo(f, "quantita"), "");
    errore("err-offerta", null, "");
    $<HTMLDialogElement>("foglio-offerta").showModal();
    if (!s) campo(f, "titolo").focus();
  }

  function nuovoId(): string {
    const usati = new Set(config!.slides.map((s) => s.id));
    let n = config!.slides.length + 1;
    while (usati.has(`offerta-${n}`)) n++;
    return `offerta-${n}`;
  }

  formOfferta().addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!config) return;
    const f = formOfferta();
    const titolo = campo(f, "titolo").value.trim();
    const testoPrezzo = campo(f, "prezzo").value.trim();
    const prezzo = testoPrezzo ? leggi(testoPrezzo) : undefined;
    errore("err-titolo", campo(f, "titolo"), titolo ? "" : "Scrivi il nome dell'offerta.");
    errore("err-prezzo", campo(f, "prezzo"), prezzo === null ? "Scrivi il prezzo così: 2,50" : "");
    const testoQuantita = campo(f, "quantita").value.trim();
    const quantita = testoQuantita ? leggiQuantita(testoQuantita) : undefined;
    errore(
      "err-quantita",
      campo(f, "quantita"),
      quantita === null ? "Scrivi la quantità così: 100 g, 1 kg, 500 ml" : quantita && prezzo === undefined ? "Per la quantità serve anche il prezzo." : "",
    );
    if (!titolo) return campo(f, "titolo").focus();
    if (prezzo === null) return campo(f, "prezzo").focus();
    if (quantita === null || (quantita && prezzo === undefined)) return campo(f, "quantita").focus();
    const nuova = copia(config);
    const s: Slide = inModifica ? nuova.slides.find((x) => x.id === inModifica)! : { id: nuovoId(), titolo, attiva: true };
    if (!inModifica) nuova.slides.push(s);
    s.titolo = titolo;
    s.attiva = campo(f, "attiva").checked;
    const nota = campo(f, "nota").value.trim();
    if (nota) s.nota = nota;
    else delete s.nota;
    if (prezzo === undefined) delete s.prezzo;
    else s.prezzo = prezzo;
    if (quantita) s.quantita = quantita;
    else delete s.quantita;
    if (fotoScelta) s.foto = fotoScelta;
    else delete s.foto;
    const r = await salva(nuova, inModifica ? "Aggiornato sulla TV" : "Offerta aggiunta");
    if (r.ok) $<HTMLDialogElement>("foglio-offerta").close();
    else errore("err-offerta", null, r.errore);
  });

  $("elimina").addEventListener("click", () => {
    const s = config?.slides.find((x) => x.id === inModifica);
    if (!s) return;
    $("conf-tit").textContent = `Eliminare "${s.titolo}"?`;
    $<HTMLDialogElement>("conferma").showModal();
  });
  $("conf-no").addEventListener("click", () => $<HTMLDialogElement>("conferma").close());
  $("conf-si").addEventListener("click", async () => {
    if (!config) return;
    const nuova = copia(config);
    nuova.slides = nuova.slides.filter((x) => x.id !== inModifica);
    const r = await salva(nuova, "Offerta eliminata");
    $<HTMLDialogElement>("conferma").close();
    if (r.ok) $<HTMLDialogElement>("foglio-offerta").close();
    else errore("err-offerta", null, r.errore);
  });

  // ---- Colori: combinazioni pronte, un colore, ogni colore; il negoziante ha l'ultima parola ----

  let bozza: Colori | null = null;
  const CHIAVI = ["primario", "sfondo", "testo", "accento"] as const;

  function coloraMini(el: HTMLElement, c: Colori) {
    for (const k of CHIAVI) el.style.setProperty(`--mt-${k}`, c[k]);
  }

  function nomeColori(c: Config): string {
    const col = c.negozio.colori;
    if (c.negozio.marchio && stessiColori(col, c.negozio.marchio)) return "Colori del negozio";
    return COMBINAZIONI.find((x) => stessiColori(x.colori, col))?.nome ?? "Scelti da te";
  }

  function disegnaColori() {
    if (!bozza || !config) return;
    coloraMini($("fc-anteprima"), bozza);
    $("fc-nome").textContent = config.negozio.nome;
    for (const b of sezione.querySelectorAll<HTMLButtonElement>("#fc-pronti .combinazione"))
      b.setAttribute("aria-pressed", String(stessiColori(COMBINAZIONI.find((x) => x.id === b.dataset.id)!.colori, bozza)));
    const f = $<HTMLFormElement>("modulo-colori");
    for (const k of CHIAVI) campo(f, k).value = bozza[k];
    const problemi = problemiColori(bozza);
    $("fc-avviso").hidden = !problemi.length;
    $("fc-avviso-testo").textContent = problemi.length ? `⚠ ${problemi.join(". ")}.` : "";
    const marchio = config.negozio.marchio;
    $("fc-zona-marchio").hidden = !marchio || stessiColori(marchio, bozza);
  }

  function combinazione(id: string, nome: string, c: Colori): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "combinazione";
    b.dataset.id = id;
    const mini = document.createElement("span");
    mini.className = "mini-tv";
    mini.setAttribute("aria-hidden", "true");
    const barra = document.createElement("span");
    barra.className = "mt-barra";
    const prezzo = document.createElement("span");
    prezzo.className = "mt-prezzo";
    prezzo.textContent = "2,50";
    mini.append(barra, document.createElement("span"), prezzo);
    coloraMini(mini, c);
    const n = document.createElement("span");
    n.className = "nome-comb";
    n.textContent = nome;
    b.append(mini, n);
    b.addEventListener("click", () => {
      bozza = { ...c };
      disegnaColori();
    });
    return b;
  }

  $("fc-pronti").replaceChildren(...COMBINAZIONI.map((x) => combinazione(x.id, x.nome, x.colori)));

  $("apri-colori").addEventListener("click", () => {
    if (!config) return;
    bozza = { ...config.negozio.colori };
    campo($<HTMLFormElement>("modulo-colori"), "principale").value = bozza.primario;
    errore("err-colori", null, "");
    disegnaColori();
    $<HTMLDialogElement>("foglio-colori").showModal();
  });

  campo($<HTMLFormElement>("modulo-colori"), "principale").addEventListener("input", (e) => {
    bozza = daUnColore((e.target as HTMLInputElement).value);
    disegnaColori();
  });
  for (const k of CHIAVI)
    campo($<HTMLFormElement>("modulo-colori"), k).addEventListener("input", (e) => {
      if (!bozza) return;
      bozza = { ...bozza, [k]: (e.target as HTMLInputElement).value };
      disegnaColori();
    });
  $("fc-sistema").addEventListener("click", () => {
    if (!bozza) return;
    bozza = sistema(bozza);
    disegnaColori();
  });
  $("fc-marchio").addEventListener("click", () => {
    if (!config?.negozio.marchio) return;
    bozza = { ...config.negozio.marchio };
    disegnaColori();
  });

  /** Il negozio è di tutti i servizi: si salva su /api/negozio (lo valida il server) e si può annullare. */
  async function salvaNegozio(modifica: (d: DatiNegozio) => void, messaggio: string): Promise<Esito> {
    if (!config) return { ok: false, errore: NON_RAGGIUNGIBILE };
    const prima = dividi(config).negozio;
    const dati = structuredClone(prima);
    modifica(dati);
    const r = await ctx.salvaNegozio(dati);
    if (!r.ok) return r;
    config = componi(ctx.negozio(), dividi(config).schermo);
    disegna();
    ctx.toast(`${messaggio} ✓`, () => void annullaNegozio(prima));
    return r;
  }

  async function annullaNegozio(prima: DatiNegozio) {
    const r = await ctx.salvaNegozio(prima);
    if (!r.ok) return mostraAvviso(r.errore, false);
    if (config) config = componi(ctx.negozio(), dividi(config).schermo);
    disegna();
    ctx.toast("Modifica annullata ✓");
  }

  async function salvaColori(c: Colori, libero: boolean) {
    const r = await salvaNegozio((d) => {
      d.negozio.colori = c;
      if (libero) d.negozio.contrastoLibero = true;
      else delete d.negozio.contrastoLibero;
    }, "Colori aggiornati sulla TV");
    if (r.ok) $<HTMLDialogElement>("foglio-colori").close();
    else errore("err-colori", null, r.errore);
  }

  $<HTMLFormElement>("modulo-colori").addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!bozza) return;
    const problemi = problemiColori(bozza);
    if (!problemi.length) return void salvaColori(bozza, false);
    $("cc-sotto").textContent = `${problemi.join(". ")}. Puoi usarli lo stesso o farli sistemare a noi (cambiamo solo quanto basta).`;
    $<HTMLDialogElement>("conferma-colori").showModal();
  });
  $("cc-usa").addEventListener("click", () => {
    $<HTMLDialogElement>("conferma-colori").close();
    if (bozza) void salvaColori(bozza, true);
  });
  $("cc-sistema").addEventListener("click", () => {
    $<HTMLDialogElement>("conferma-colori").close();
    if (!bozza) return;
    bozza = sistema(bozza);
    disegnaColori();
    void salvaColori(bozza, false);
  });

  // ---- Aspetto: miniature generate dall'elenco unico delle scelte (core/aspetto.ts) ----

  let bozzaAspetto: Aspetto = {};
  let aspettoAperto: Aspetto = {};
  let bozzaSecondi = 8;
  let secondiAperti = 8;
  let bozzaDisposizione: Disposizione = "intero";
  let disposizioneAperta: Disposizione = "intero";
  let bozzaTema: SceltaPannello = "";
  let temaAperto: SceltaPannello = "";
  let bozzaVariante: VarianteTema | "" = "";
  let varianteAperta: VarianteTema | "" = "";
  let bozzaMieiColori = false;
  let mieiColoriAperti = false;
  let bozzaBarra: PosizioneBarra = BARRA_CONSIGLIATA;
  let barraAperta: PosizioneBarra = BARRA_CONSIGLIATA;

  /** Miniatura con tema e barra: il tema colora la miniatura con la sua palette (stesse variabili della TV). */
  function vestiMini(m: HTMLElement, c: Colori, a: Aspetto, scelta: SceltaPannello, barra: PosizioneBarra, mieiColori = bozzaMieiColori, variante = bozzaVariante) {
    coloraMini(m, c);
    // "i miei colori": solo le decorazioni del tema, sui colori del negozio
    const tema = scelta;
    if (tema && !mieiColori) for (const k of CHIAVI) m.style.setProperty(`--mt-${k}`, `var(--${k})`);
    m.dataset.tema = tema;
    m.dataset.temaColori = mieiColori ? "negozio" : "";
    m.dataset.temaVariante = variantiDi(tema || undefined).includes(variante as VarianteTema) ? variante : "";
    m.dataset.barra = barra;
    applicaAspetto(m, a);
  }

  /** Pezzi delle miniature che si vedono solo in certe disposizioni: la "foto" e le righe del listino. */
  function extraMini(): HTMLElement[] {
    const foto = document.createElement("span");
    foto.className = "mt-foto";
    const righe = document.createElement("span");
    righe.className = "mt-righe";
    for (const [n, p] of [["Pane", "4,20"], ["Pizza", "1,80"]]) {
      const r = document.createElement("span");
      const a = document.createElement("span");
      a.textContent = n!;
      const b = document.createElement("span");
      b.textContent = p!;
      r.append(a, b);
      righe.append(r);
    }
    return [foto, righe];
  }

  function miniAspetto(): HTMLSpanElement {
    const m = document.createElement("span");
    m.className = "mini-tv mini-aspetto";
    m.setAttribute("aria-hidden", "true");
    const barra = document.createElement("span");
    barra.className = "mt-barra";
    const logo = document.createElement("span");
    logo.className = "mt-logo";
    const nome = document.createElement("span");
    nome.className = "mt-nome";
    barra.append(logo, nome);
    const tit = document.createElement("span");
    tit.className = "mt-titolo";
    const prezzo = document.createElement("span");
    prezzo.className = "mt-prezzo";
    prezzo.textContent = "2,50";
    const fondo = document.createElement("span");
    fondo.className = "mt-fondo";
    m.append(barra, ...extraMini(), tit, prezzo, fondo);
    return m;
  }

  $("fa-gruppi").replaceChildren(
    ...GRUPPI_ASPETTO.flatMap((g) => {
      const h = document.createElement("h3");
      h.className = "sezione";
      h.textContent = g.titolo;
      const box = document.createElement("div");
      box.className = "combinazioni";
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", g.titolo);
      for (const o of g.opzioni) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "combinazione";
        b.dataset.chiave = g.chiave;
        b.dataset.valore = o.valore;
        const n = document.createElement("span");
        n.className = "nome-comb";
        n.textContent = o.nome;
        const c = document.createElement("span");
        c.className = "consigliata";
        c.textContent = o.valore === consigliata(g) ? " Consigliata" : "";
        b.append(miniAspetto(), n, c);
        b.addEventListener("click", () => {
          bozzaAspetto = { ...bozzaAspetto, [g.chiave]: o.valore };
          disegnaAspetto();
          if (g.chiave === "passaggio") animaEntrata([...sezione.querySelectorAll<HTMLElement>("#fa-anteprima .mt-titolo, #fa-anteprima .mt-prezzo")], o.valore);
        });
        box.append(b);
      }
      return [h, box];
    }),
  );

  $("fa-anteprima").querySelector(".mt-barra")!.after(...extraMini());
  $("fa-anteprima").append(Object.assign(document.createElement("span"), { className: "mt-fondo" }));

  function gruppoMiniature<V extends string>(id: string, valori: readonly V[], nome: (v: V) => string, consigliato: V | null, scegli: (v: V) => void, mini: (v: V) => void) {
    $(id).replaceChildren(
      ...valori.map((v) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "combinazione";
        b.dataset.valore = v;
        const n = document.createElement("span");
        n.className = "nome-comb";
        n.textContent = nome(v);
        const c = document.createElement("span");
        c.className = "consigliata";
        c.textContent = v === consigliato ? " Consigliata" : "";
        const m = miniAspetto();
        b.append(m, n, c);
        b.addEventListener("click", () => scegli(v));
        mini(v);
        return b;
      }),
    );
  }
  gruppoMiniature("fa-temi", ["", ...TEMI] as const, (v) => (v ? NOME_TEMA[v] : "Nessuno"), null, (v) => { bozzaTema = v; disegnaAspetto(); }, () => {});
  gruppoMiniature("fa-temacolori", COLORI_TEMA, (v) => NOME_COLORI_TEMA[v], "tema", (v) => { bozzaMieiColori = v === "negozio"; disegnaAspetto(); }, () => {});
  gruppoMiniature("fa-varianti", VARIANTI_PANNELLO, (v) => NOME_VARIANTE[v], null, (v) => { bozzaVariante = v; disegnaAspetto(); }, () => {});
  gruppoMiniature("fa-barra", POSIZIONI_BARRA, (v) => NOME_BARRA[v], BARRA_CONSIGLIATA, (v) => { bozzaBarra = v; disegnaAspetto(); }, () => {});

  $("fa-secondi").replaceChildren(
    ...SECONDI.map((sec, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "combinazione";
      b.dataset.secondi = String(sec);
      const n = document.createElement("span");
      n.className = "nome-comb";
      n.textContent = `${sec} secondi`;
      const c = document.createElement("span");
      c.className = "consigliata";
      c.textContent = i === 0 ? " Consigliata" : "";
      b.append(n, c);
      b.addEventListener("click", () => {
        bozzaSecondi = sec;
        disegnaAspetto();
      });
      return b;
    }),
  );

  $("fa-disposizione").replaceChildren(
    ...DISPOSIZIONI.map((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "combinazione";
      b.dataset.disposizione = d;
      const n = document.createElement("span");
      n.className = "nome-comb";
      n.textContent = NOME_DISPOSIZIONE[d];
      const c = document.createElement("span");
      c.className = "consigliata";
      c.textContent = d === "intero" ? " Consigliata" : "";
      b.append(n, c);
      b.addEventListener("click", () => {
        bozzaDisposizione = d;
        disegnaAspetto();
      });
      return b;
    }),
  );

  function disegnaAspetto() {
    if (!config) return;
    const c = config.negozio.colori;
    const completo = aspettoCompleto(bozzaAspetto);
    vestiMini($("fa-anteprima"), c, bozzaAspetto, bozzaTema, bozzaBarra);
    $("fa-nome").textContent = config.negozio.nome;
    for (const b of sezione.querySelectorAll<HTMLButtonElement>("#fa-gruppi .combinazione")) {
      const k = b.dataset.chiave as keyof typeof completo;
      b.setAttribute("aria-pressed", String(completo[k] === b.dataset.valore));
      const m = b.querySelector<HTMLElement>(".mini-tv")!;
      coloraMini(m, c);
      applicaAspetto(m, { ...bozzaAspetto, [k]: b.dataset.valore });
    }
    for (const b of sezione.querySelectorAll<HTMLButtonElement>("#fa-temi .combinazione")) {
      b.setAttribute("aria-pressed", String(b.dataset.valore === bozzaTema));
      vestiMini(b.querySelector<HTMLElement>(".mini-tv")!, c, bozzaAspetto, b.dataset.valore as SceltaPannello, bozzaBarra);
    }
    // i colori del tema contano solo con un tema
    $("fa-zona-temacolori").hidden = !bozzaTema;
    const esempio: Tema = bozzaTema || "natale";
    for (const b of sezione.querySelectorAll<HTMLButtonElement>("#fa-temacolori .combinazione")) {
      b.setAttribute("aria-pressed", String((b.dataset.valore === "negozio") === bozzaMieiColori));
      vestiMini(b.querySelector<HTMLElement>(".mini-tv")!, c, bozzaAspetto, esempio, bozzaBarra, b.dataset.valore === "negozio");
    }
    // la palette conta solo con un tema che ne ha più d'una e senza "I miei colori"
    $("fa-zona-varianti").hidden = !variantiDi(bozzaTema || undefined).length || bozzaMieiColori;
    for (const b of sezione.querySelectorAll<HTMLButtonElement>("#fa-varianti .combinazione")) {
      b.setAttribute("aria-pressed", String(b.dataset.valore === bozzaVariante));
      vestiMini(b.querySelector<HTMLElement>(".mini-tv")!, c, bozzaAspetto, "natale", bozzaBarra, false, b.dataset.valore as VarianteTema | "");
    }
    for (const b of sezione.querySelectorAll<HTMLButtonElement>("#fa-barra .combinazione")) {
      b.setAttribute("aria-pressed", String(b.dataset.valore === bozzaBarra));
      vestiMini(b.querySelector<HTMLElement>(".mini-tv")!, c, bozzaAspetto, bozzaTema, b.dataset.valore as PosizioneBarra);
    }
    for (const b of sezione.querySelectorAll<HTMLButtonElement>("#fa-secondi .combinazione"))
      b.setAttribute("aria-pressed", String(Number(b.dataset.secondi) === bozzaSecondi));
    // la scelta "uno alla volta / affiancati" ha senso solo con due o più servizi sulla TV
    $("fa-zona-disposizione").hidden = ctx.servizi().length < 2;
    for (const b of sezione.querySelectorAll<HTMLButtonElement>("#fa-disposizione .combinazione"))
      b.setAttribute("aria-pressed", String(b.dataset.disposizione === bozzaDisposizione));
    $("fa-zona-prima").hidden =
      JSON.stringify(completo) === JSON.stringify(aspettoCompleto(aspettoAperto)) &&
      bozzaSecondi === secondiAperti &&
      bozzaTema === temaAperto &&
      bozzaMieiColori === mieiColoriAperti &&
      bozzaVariante === varianteAperta &&
      bozzaBarra === barraAperta &&
      bozzaDisposizione === disposizioneAperta;
  }

  $("apri-aspetto").addEventListener("click", () => {
    if (!config) return;
    aspettoAperto = { ...config.aspetto };
    bozzaAspetto = { ...aspettoAperto };
    secondiAperti = bozzaSecondi = config.secondiPerSlide;
    disposizioneAperta = bozzaDisposizione = config.disposizione ?? "intero";
    temaAperto = bozzaTema = config.tema ?? "";
    mieiColoriAperti = bozzaMieiColori = config.temaColori === "negozio";
    varianteAperta = bozzaVariante = config.temaVariante ?? "";
    barraAperta = bozzaBarra = posizioneBarra(config.negozio.barra?.posizione);
    errore("err-aspetto", null, "");
    disegnaAspetto();
    $<HTMLDialogElement>("foglio-aspetto").showModal();
  });
  $("fa-prima").addEventListener("click", () => {
    bozzaAspetto = { ...aspettoAperto };
    bozzaSecondi = secondiAperti;
    bozzaDisposizione = disposizioneAperta;
    bozzaTema = temaAperto;
    bozzaMieiColori = mieiColoriAperti;
    bozzaVariante = varianteAperta;
    bozzaBarra = barraAperta;
    disegnaAspetto();
  });
  $<HTMLFormElement>("modulo-aspetto").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!config) return;
    const nuova = copia(config);
    // si salvano solo le scelte diverse dalla consigliata: la consigliata può migliorare per tutti
    const completo = aspettoCompleto(bozzaAspetto);
    const scelte = Object.fromEntries(GRUPPI_ASPETTO.filter((g) => completo[g.chiave] !== consigliata(g)).map((g) => [g.chiave, completo[g.chiave]]));
    if (Object.keys(scelte).length) nuova.aspetto = scelte;
    else delete nuova.aspetto;
    nuova.secondiPerSlide = bozzaSecondi;
    if (bozzaDisposizione === "affiancato") nuova.disposizione = bozzaDisposizione;
    else delete nuova.disposizione;
    delete nuova.tema;
    delete nuova.temaColori;
    delete nuova.temaVariante;
    if (bozzaTema) nuova.tema = bozzaTema;
    if (bozzaTema && bozzaMieiColori) nuova.temaColori = "negozio";
    // la variante si tiene solo se vale per il tema scelto e se si usano i colori del tema
    if (bozzaVariante && !bozzaMieiColori && variantiDi(bozzaTema || undefined).includes(bozzaVariante)) nuova.temaVariante = bozzaVariante;
    // la barra consigliata non si salva, così può migliorare per tutti
    const barra = { ...nuova.negozio.barra };
    if (bozzaBarra !== BARRA_CONSIGLIATA) barra.posizione = bozzaBarra;
    else delete barra.posizione;
    if (Object.keys(barra).length) nuova.negozio.barra = barra;
    else delete nuova.negozio.barra;
    const r = await salva(nuova, "Aspetto aggiornato sulla TV");
    if (r.ok) $<HTMLDialogElement>("foglio-aspetto").close();
    else errore("err-aspetto", null, r.errore);
  });

  const formNegozio = () => $<HTMLFormElement>("modulo-negozio");

  // ---- Orari di apertura e città del meteo (foglio Negozio) ----
  let fasce: Fascia[] = [];
  let citta: Citta | null = null;
  const GIORNI_SIGLA = ["L", "M", "M", "G", "V", "S", "D"];
  const GIORNI_NOME = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];

  function disegnaOrari() {
    $("fn-orari").replaceChildren(
      ...fasce.map((fa, i) => {
        const riga = document.createElement("div");
        riga.className = "fascia";
        const giorni = document.createElement("div");
        giorni.className = "fascia-giorni";
        giorni.setAttribute("role", "group");
        giorni.setAttribute("aria-label", `Giorni dell'orario ${i + 1}`);
        GIORNI_SIGLA.forEach((sigla, k) => {
          const g = document.createElement("button");
          g.type = "button";
          g.textContent = sigla;
          g.setAttribute("aria-label", GIORNI_NOME[k]!);
          g.setAttribute("aria-pressed", String(fa.giorni.includes(k + 1)));
          g.addEventListener("click", () => {
            fa.giorni = fa.giorni.includes(k + 1) ? fa.giorni.filter((x) => x !== k + 1) : [...fa.giorni, k + 1].sort();
            g.setAttribute("aria-pressed", String(fa.giorni.includes(k + 1)));
          });
          giorni.append(g);
        });
        const ore = document.createElement("div");
        ore.className = "fascia-ore";
        for (const [chiave, nome] of [["da", "Apre alle"], ["a", "Chiude alle"]] as const) {
          const l = document.createElement("label");
          const t = document.createElement("span");
          t.textContent = nome;
          const inp = document.createElement("input");
          inp.type = "time";
          inp.value = fa[chiave];
          inp.addEventListener("change", () => { if (inp.value) fa[chiave] = inp.value; });
          l.append(t, inp);
          ore.append(l);
        }
        const togli = document.createElement("button");
        togli.type = "button";
        togli.className = "riga pericolo-testo";
        togli.textContent = "Togli";
        togli.setAttribute("aria-label", `Togli l'orario ${i + 1}`);
        togli.addEventListener("click", () => { fasce.splice(i, 1); disegnaOrari(); });
        riga.append(giorni, ore, togli);
        return riga;
      }),
    );
    $<HTMLButtonElement>("fn-aggiungi-fascia").disabled = fasce.length >= FASCE_MAX;
  }
  $("fn-aggiungi-fascia").addEventListener("click", () => {
    fasce.push({ giorni: fasce.length ? [] : [1, 2, 3, 4, 5], da: "09:00", a: "19:00" });
    disegnaOrari();
  });

  function disegnaCitta() {
    $("fn-citta-nota").textContent = citta ? `Meteo di ${citta.nome}` : "Nessun meteo sulla TV.";
    $("fn-citta-togli").hidden = !citta;
  }
  $("fn-citta-togli").addEventListener("click", () => { citta = null; disegnaCitta(); });
  let ricerca = 0;
  campo(formNegozio(), "citta-cerca").addEventListener("input", async () => {
    const q = campo(formNegozio(), "citta-cerca").value.trim();
    const mia = ++ricerca;
    if (q.length < 2) return $("fn-citta-risultati").replaceChildren();
    try {
      const r = await fetch(`/api/citta?q=${encodeURIComponent(q)}`, { headers: { "X-Token": ctx.token() } });
      const j = (await r.json()) as { citta?: Citta[] };
      if (mia !== ricerca) return;
      const trovate = j.citta ?? [];
      $("fn-citta-risultati").replaceChildren(
        ...trovate.map((c) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "riga";
          b.textContent = c.nome;
          b.addEventListener("click", () => {
            citta = c;
            campo(formNegozio(), "citta-cerca").value = "";
            $("fn-citta-risultati").replaceChildren();
            disegnaCitta();
          });
          return b;
        }),
      );
      if (!trovate.length) $("fn-citta-nota").textContent = "Nessuna città con questo nome.";
    } catch {
      if (mia === ricerca) $("fn-citta-nota").textContent = "Ricerca non riuscita: riprova.";
    }
  });

  $("apri-negozio").addEventListener("click", () => {
    if (!config) return;
    const f = formNegozio();
    campo(f, "nome").value = config.negozio.nome;
    fasce = structuredClone(config.negozio.orari ?? []);
    citta = config.negozio.citta ? { ...config.negozio.citta } : null;
    campo(f, "barra-testo").value = config.negozio.barra?.testo ?? "";
    campo(f, "citta-cerca").value = "";
    $("fn-citta-risultati").replaceChildren();
    disegnaOrari();
    disegnaCitta();
    campo(f, "qr-url").value = config.negozio.qr?.url ?? "";
    campo(f, "qr-testo").value = config.negozio.qr?.testo ?? "";
    errore("err-nome", campo(f, "nome"), "");
    errore("err-qr-url", campo(f, "qr-url"), "");
    errore("err-qr-testo", campo(f, "qr-testo"), "");
    errore("err-negozio", null, "");
    $<HTMLDialogElement>("foglio-negozio").showModal();
  });

  formNegozio().addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!config) return;
    const f = formNegozio();
    const nome = campo(f, "nome").value.trim();
    errore("err-nome", campo(f, "nome"), nome ? "" : "Scrivi il nome del negozio.");
    // https:// si aggiunge da solo: il negoziante incolla spesso l'indirizzo senza
    let qrUrl = campo(f, "qr-url").value.trim();
    if (qrUrl && !/^[a-z]+:/i.test(qrUrl)) qrUrl = `https://${qrUrl}`;
    const qrTesto = campo(f, "qr-testo").value.trim();
    errore("err-qr-url", campo(f, "qr-url"), qrUrl && !urlQrValido(qrUrl) ? "Serve un indirizzo completo, per esempio https://g.page/…" : "");
    errore("err-qr-testo", campo(f, "qr-testo"), qrUrl && !qrTesto ? "Scrivi cosa trova chi inquadra il QR." : "");
    if (!nome) return campo(f, "nome").focus();
    if (qrUrl && !urlQrValido(qrUrl)) return campo(f, "qr-url").focus();
    if (qrUrl && !qrTesto) return campo(f, "qr-testo").focus();
    const testoBarra = campo(f, "barra-testo").value.trim();
    const r = await salvaNegozio((d) => {
      d.negozio.nome = nome;
      if (fasce.length) d.negozio.orari = fasce;
      else delete d.negozio.orari;
      if (citta) d.negozio.citta = citta;
      else delete d.negozio.citta;
      const barra = { ...d.negozio.barra };
      if (testoBarra) barra.testo = testoBarra;
      else delete barra.testo;
      if (Object.keys(barra).length) d.negozio.barra = barra;
      else delete d.negozio.barra;
      if (qrUrl) d.negozio.qr = { url: qrUrl, testo: qrTesto };
      else delete d.negozio.qr;
    }, "Aggiornato sulla TV");
    if (r.ok) $<HTMLDialogElement>("foglio-negozio").close();
    else errore("err-negozio", null, r.errore);
  });

  for (const b of sezione.querySelectorAll<HTMLButtonElement>("[data-chiudi]"))
    b.addEventListener("click", () => b.closest("dialog")?.close());

  $("aggiungi").addEventListener("click", () => apriOfferta(null));

  async function carica() {
    try {
      const r = await fetch("/api/config", { cache: "no-store" });
      const e = valida(await r.json());
      if (!e.ok) throw new Error("config non valida");
      config = e.config;
      ctx.nascondiAvviso();
      disegna();
      if (!ctx.token()) mostraAvviso("Per modificare le offerte apri il pannello dal link completo che ti abbiamo dato.", false);
    } catch {
      mostraAvviso(NON_RAGGIUNGIBILE, true);
    }
  }

  setInterval(anteprima, 1000);
  void carica();
}

export const servizioPannello: ServizioPannello = { id: "schermo", montaPannello };
