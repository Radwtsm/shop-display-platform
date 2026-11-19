// La Vetrina nel pannello del negoziante: storia, QR (recensioni, Wi-Fi, Instagram), dati del sito e cartello A5.
// Si monta nella sua sezione del guscio (public/panel.html); token, avvisi e conferme sono del guscio.
import { frammento } from "../../piattaforma/client/dom.ts";
import { FOTO_LATO_PANNELLO, FOTO_MAX_BYTE } from "../../piattaforma/core/foto.ts";
import { descriviFasce } from "../../piattaforma/core/orario.ts";
import { percorsoQr } from "../../piattaforma/core/qr.ts";
import { NON_RAGGIUNGIBILE, type ContestoPannello, type Esito, type ServizioPannello } from "../../piattaforma/pannello/contratto.ts";
import { vociQr } from "./core/qr.ts";
import type { DatiVetrina, Fascia, Recensioni } from "./core/tipi.ts";
import { controlla, pulisciInstagram, validaVetrina, type Errore } from "./core/valida.ts";
import { MARKUP_PANNELLO } from "./pannello-markup.ts";

const FOGLIO = "/vetrina-pannello.css";
const MARGINE_QR = 2;
const GIORNI = [1, 2, 3, 4, 5, 6, 7];

function montaPannello(sezione: HTMLElement, ctx: ContestoPannello) {
  // Foglio di stile solo della Vetrina (area di testo, giorni, cartello A5 per la stampa).
  const foglio = document.createElement("link");
  foglio.rel = "stylesheet";
  foglio.href = FOGLIO;
  document.head.append(foglio);
  sezione.append(frammento(MARKUP_PANNELLO));
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => sezione.querySelector(`#${id}`) as T;
  const dialogo = (id: string) => $<HTMLDialogElement>(id);

  let dati: DatiVetrina | null = null;
  let recensioni: Recensioni | null = null;
  let fotoScelta: string | undefined;

  const copia = (d: DatiVetrina): DatiVetrina => structuredClone(d);
  const campo = (f: HTMLFormElement, n: string) => f.elements.namedItem(n) as HTMLInputElement;
  const mostraAvviso = (testo: string, riprova: boolean) => ctx.avviso(testo, riprova ? () => void carica() : undefined);

  function errore(id: string, input: HTMLElement | null, testo: string) {
    const p = $(id);
    p.textContent = testo;
    p.hidden = !testo;
    if (input) {
      if (testo) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  /** Gli errori del controllo accanto ai campi giusti; ciò che non ha un campo va in fondo al foglio. */
  function mostraErrori(f: HTMLFormElement, campi: string[], fondo: string, errori: Errore[]) {
    for (const n of campi) errore(`v-err-${n}`, campo(f, n) ?? null, errori.find((e) => e.campo === n)?.testo ?? "");
    errore(fondo, null, errori.filter((e) => !e.campo || !campi.includes(e.campo)).map((e) => e.testo).join(" · "));
  }

  // ---- Elenco ----
  function disegna() {
    if (!dati) return;
    const s = dati.storia;
    $("v-storia-sotto").textContent = s ? [s.anno ? `Dal ${s.anno}` : "", s.testo].filter(Boolean).join(" · ") : "Non ancora scritta";
    const qr = vociQr(dati, true).map((v) => (v.id === "recensione" ? "recensioni" : v.id === "wifi" ? "Wi-Fi" : "Instagram"));
    $("v-qr-sotto").textContent = qr.length ? qr.join(", ") : "Nessun QR: aggiungine uno";
    const c = dati.contatti;
    $("v-sito-sotto").textContent = [c.indirizzo, descriviFasce(dati.orari)].filter(Boolean).join(" · ") || "Indirizzo e orari da scrivere";
    $("v-recensioni").textContent = !recensioni
      ? ""
      : recensioni.fonte === "finte"
        ? "Recensioni di esempio: il collegamento a Google non è ancora attivo, sul sito e sulla TV compaiono recensioni finte."
        : recensioni.elenco.length
          ? `Recensioni da Google${recensioni.voto ? ` · ${recensioni.voto.toLocaleString("it-IT", { minimumFractionDigits: 1 })} su 5` : ""}`
          : "Nessuna recensione letta da Google: controlla il Place ID.";
    cartello();
  }

  // ---- Salvataggio ----
  async function salva(nuova: DatiVetrina, messaggio: string, annullabile = true): Promise<Esito> {
    const e = validaVetrina(nuova);
    if (!e.ok) return { ok: false, errore: e.errori.join(" · ") };
    if (!ctx.token()) return { ok: false, errore: "Per modificare apri il pannello dal link completo che ti abbiamo dato." };
    const prima = dati ? copia(dati) : null;
    try {
      const r = await fetch("/api/vetrina", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Token": ctx.token() },
        body: JSON.stringify(e.dati),
      });
      const corpo = await r.json().catch(() => ({}));
      if (r.status === 401) return { ok: false, errore: "Questo link non è più valido. Chiedi il link nuovo a chi ha installato la TV." };
      if (!r.ok) return { ok: false, errore: (corpo as { errori?: string[] }).errori?.join(" · ") ?? "Non salvato, riprova." };
      dati = corpo as DatiVetrina;
      ctx.nascondiAvviso();
      await leggiRecensioni();
      disegna();
      ctx.toast(`${messaggio} ✓`, annullabile && prima ? () => void ripristina(prima) : undefined);
      return { ok: true };
    } catch {
      mostraAvviso(NON_RAGGIUNGIBILE, true);
      return { ok: false, errore: NON_RAGGIUNGIBILE };
    }
  }

  async function ripristina(prima: DatiVetrina) {
    const r = await salva(prima, "Modifica annullata", false);
    if (!r.ok) mostraAvviso(r.errore, false);
  }

  // ---- Storia ----
  function mostraFoto(stato = "") {
    const img = $<HTMLImageElement>("v-foto");
    img.hidden = !fotoScelta;
    $("v-foto-vuota").toggleAttribute("hidden", !!fotoScelta);
    if (fotoScelta) img.src = `/foto/${encodeURIComponent(fotoScelta)}`;
    $("v-foto-scegli").textContent = fotoScelta ? "Cambia foto" : "Aggiungi foto";
    $("v-foto-togli").hidden = !fotoScelta;
    $("v-foto-stato").textContent = stato || (fotoScelta ? "Sulla TV e sul sito accanto alla storia" : "Il negozio, il forno, la famiglia…");
  }

  /** Rimpicciolisce e ridisegna la foto: via i dati del telefono (posizione, modello), peso adatto alla TV. */
  async function preparaFoto(file: File): Promise<Blob> {
    const bmp = await createImageBitmap(file);
    const scala = Math.min(1, FOTO_LATO_PANNELLO / Math.max(bmp.width, bmp.height));
    const tela = document.createElement("canvas");
    tela.width = Math.round(bmp.width * scala);
    tela.height = Math.round(bmp.height * scala);
    const c2 = tela.getContext("2d")!;
    const comeBlob = (tipo: string) => new Promise<Blob | null>((ok) => tela.toBlob(ok, tipo, 0.85));
    c2.drawImage(bmp, 0, 0, tela.width, tela.height);
    if (file.type === "image/png") {
      const png = await comeBlob("image/png");
      if (png && png.size <= FOTO_MAX_BYTE) return png;
    }
    c2.globalCompositeOperation = "destination-over";
    c2.fillStyle = "#fff";
    c2.fillRect(0, 0, tela.width, tela.height);
    const jpg = await comeBlob("image/jpeg");
    if (!jpg) throw new Error("foto");
    return jpg;
  }

  $("v-foto-file").addEventListener("change", async () => {
    const input = $<HTMLInputElement>("v-foto-file");
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    errore("v-err-foto", null, "");
    if (!ctx.token()) return errore("v-err-foto", null, "Per caricare foto apri il pannello dal link completo che ti abbiamo dato.");
    const zona = $("v-foto-scegli").closest("label")!;
    zona.setAttribute("aria-disabled", "true");
    try {
      let blob: Blob;
      try {
        blob = await preparaFoto(file);
      } catch {
        mostraFoto();
        return errore("v-err-foto", null, "Non riesco ad aprire questo file: scegli una foto (JPG, PNG o WebP).");
      }
      const r = await fetch("/api/foto", { method: "POST", headers: { "Content-Type": blob.type, "X-Token": ctx.token() }, body: blob });
      const corpo = (await r.json().catch(() => ({}))) as { foto?: string; errori?: string[] };
      if (!r.ok || !corpo.foto) {
        mostraFoto();
        return errore("v-err-foto", null, corpo.errori?.join(" · ") ?? "Foto non caricata, riprova.");
      }
      fotoScelta = corpo.foto;
      mostraFoto("Foto pronta: premi Fatto per metterla sulla TV");
    } catch {
      mostraFoto();
      errore("v-err-foto", null, NON_RAGGIUNGIBILE);
    } finally {
      zona.removeAttribute("aria-disabled");
    }
  });
  $("v-foto-togli").addEventListener("click", () => {
    fotoScelta = undefined;
    mostraFoto("Foto tolta: premi Fatto per toglierla dalla TV");
  });

  const formStoria = () => $<HTMLFormElement>("v-modulo-storia");
  $("v-apri-storia").addEventListener("click", () => {
    if (!dati) return;
    const f = formStoria();
    campo(f, "anno").value = dati.storia?.anno ? String(dati.storia.anno) : "";
    f.querySelector("textarea")!.value = dati.storia?.testo ?? "";
    fotoScelta = dati.storia?.foto;
    mostraFoto();
    for (const n of ["foto", "anno", "storia"]) errore(`v-err-${n}`, null, "");
    errore("v-err-fs", null, "");
    dialogo("v-foglio-storia").showModal();
  });
  formStoria().addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!dati) return;
    const f = formStoria();
    const testo = f.querySelector("textarea")!.value.trim();
    const annoTesto = campo(f, "anno").value.trim();
    const anno = annoTesto ? Number(annoTesto) : undefined;
    const nuova = copia(dati);
    if (!testo) delete nuova.storia;
    else {
      nuova.storia = { testo };
      if (anno !== undefined) nuova.storia.anno = anno;
      if (fotoScelta) nuova.storia.foto = fotoScelta;
    }
    const errori = nuova.storia ? controlla(nuova).filter((e) => ["anno", "storia", "foto"].includes(e.campo ?? "")) : [];
    if (annoTesto && !Number.isInteger(anno)) errori.push({ campo: "anno", testo: "Anno: quattro cifre, per esempio 1987" });
    mostraErrori(f, ["anno"], "v-err-fs", errori.filter((e) => e.campo !== "storia"));
    errore("v-err-storia", null, errori.find((e) => e.campo === "storia")?.testo ?? "");
    if (errori.length) return;
    const r = await salva(nuova, "Storia aggiornata");
    if (r.ok) dialogo("v-foglio-storia").close();
    else errore("v-err-fs", null, r.errore);
  });

  // ---- QR ----
  const formQr = () => $<HTMLFormElement>("v-modulo-qr");
  $("v-apri-qr").addEventListener("click", () => {
    if (!dati) return;
    const f = formQr();
    campo(f, "placeId").value = dati.placeId ?? "";
    campo(f, "ssid").value = dati.wifi?.ssid ?? "";
    campo(f, "password").value = dati.wifi?.password ?? "";
    campo(f, "instagram").value = dati.instagram ? `@${dati.instagram}` : "";
    for (const n of ["placeId", "ssid", "password", "instagram"]) errore(`v-err-${n}`, null, "");
    errore("v-err-fq", null, "");
    dialogo("v-foglio-qr").showModal();
  });
  formQr().addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!dati) return;
    const f = formQr();
    const nuova = copia(dati);
    const placeId = campo(f, "placeId").value.trim();
    const ssid = campo(f, "ssid").value.trim();
    const password = campo(f, "password").value;
    const instagram = pulisciInstagram(campo(f, "instagram").value);
    if (placeId) nuova.placeId = placeId;
    else delete nuova.placeId;
    if (ssid) nuova.wifi = password ? { ssid, password } : { ssid };
    else delete nuova.wifi;
    if (instagram) nuova.instagram = instagram;
    else delete nuova.instagram;
    const errori = controlla(nuova);
    mostraErrori(f, ["placeId", "ssid", "password", "instagram"], "v-err-fq", errori);
    if (errori.length) return;
    const r = await salva(nuova, "QR aggiornati");
    if (r.ok) dialogo("v-foglio-qr").close();
    else errore("v-err-fq", null, r.errore);
  });

  // ---- Sito ----
  const formSito = () => $<HTMLFormElement>("v-modulo-sito");
  const unaFascia = (o: Fascia[]) => o.length <= 1;
  $("v-apri-sito").addEventListener("click", () => {
    if (!dati) return;
    const f = formSito();
    const c = dati.contatti;
    campo(f, "indirizzo").value = c.indirizzo ?? "";
    campo(f, "telefono").value = c.telefono ?? "";
    campo(f, "email").value = c.email ?? "";
    campo(f, "linkMenu").value = dati.linkMenu;
    const fascia = dati.orari[0];
    for (const g of GIORNI) campo(f, `g${g}`).checked = !!fascia?.giorni.includes(g);
    campo(f, "da").value = fascia?.da ?? "";
    campo(f, "a").value = fascia?.a ?? "";
    const semplice = unaFascia(dati.orari);
    $("v-orari-complessi").hidden = semplice;
    for (const el of [...GIORNI.map((g) => campo(f, `g${g}`)), campo(f, "da"), campo(f, "a")]) el.disabled = !semplice;
    for (const n of ["indirizzo", "telefono", "email", "linkMenu", "orari"]) errore(`v-err-${n}`, null, "");
    errore("v-err-fi", null, "");
    dialogo("v-foglio-sito").showModal();
  });
  formSito().addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!dati) return;
    const f = formSito();
    const nuova = copia(dati);
    const contatti: DatiVetrina["contatti"] = {};
    for (const n of ["indirizzo", "telefono", "email"] as const) {
      const v = campo(f, n).value.trim();
      if (v) contatti[n] = v;
    }
    nuova.contatti = contatti;
    nuova.linkMenu = campo(f, "linkMenu").value.trim();
    if (unaFascia(dati.orari)) {
      const giorni = GIORNI.filter((g) => campo(f, `g${g}`).checked);
      const da = campo(f, "da").value;
      const a = campo(f, "a").value;
      if (!giorni.length && !da && !a) nuova.orari = [];
      else nuova.orari = [{ giorni, da, a }];
    }
    const errori = controlla(nuova);
    mostraErrori(f, ["indirizzo", "telefono", "email", "linkMenu", "orari"], "v-err-fi", errori);
    if (errori.length) return;
    const r = await salva(nuova, "Sito aggiornato");
    if (r.ok) dialogo("v-foglio-sito").close();
    else errore("v-err-fi", null, r.errore);
  });

  // ---- Cartello A5 (si vede solo stampando: public/vetrina-pannello.css) ----
  function cartello() {
    if (!dati) return;
    $("v-c-nome").textContent = ctx.negozio().negozio.nome;
    const voci = vociQr(dati, true);
    $("v-c-qr").replaceChildren(
      ...voci.map((v) => {
        const fig = frammento(`<figure class="v-c-voce"><svg class="v-svg" aria-hidden="true"><path/></svg><figcaption><strong class="v-c-titolo"></strong><span class="v-c-sotto"></span></figcaption></figure>`);
        const q = percorsoQr(v.testo);
        const svg = fig.querySelector("svg")!;
        svg.setAttribute("viewBox", `${-MARGINE_QR} ${-MARGINE_QR} ${q.lato + 2 * MARGINE_QR} ${q.lato + 2 * MARGINE_QR}`);
        svg.querySelector("path")!.setAttribute("d", q.d);
        fig.querySelector(".v-c-titolo")!.textContent = v.titolo;
        fig.querySelector(".v-c-sotto")!.textContent = v.sotto;
        fig.firstElementChild!.setAttribute("data-qr", v.id);
        return fig.firstElementChild!;
      }),
    );
  }
  $("v-stampa").addEventListener("click", () => {
    if (!dati || !vociQr(dati, true).length) return errore("v-err-pagina", null, "Prima aggiungi almeno un QR (recensioni, Wi-Fi o Instagram).");
    errore("v-err-pagina", null, "");
    cartello();
    window.print();
  });

  for (const b of sezione.querySelectorAll<HTMLButtonElement>("[data-chiudi]")) b.addEventListener("click", () => b.closest("dialog")?.close());

  async function leggiRecensioni() {
    try {
      const r = await fetch("/api/vetrina/sito", { cache: "no-store" });
      if (r.ok) recensioni = ((await r.json()) as { recensioni?: Recensioni }).recensioni ?? null;
    } catch {
      recensioni = null;
    }
  }

  async function carica() {
    try {
      const r = await fetch("/api/vetrina", { cache: "no-store", headers: ctx.token() ? { "X-Token": ctx.token() } : {} });
      if (r.status === 401) {
        mostraAvviso("Per modificare la Vetrina apri il pannello dal link completo che ti abbiamo dato.", false);
        return;
      }
      const e = validaVetrina(await r.json());
      if (!e.ok) throw new Error("dati non validi");
      dati = e.dati;
      ctx.nascondiAvviso();
      await leggiRecensioni();
      disegna();
    } catch {
      mostraAvviso(NON_RAGGIUNGIBILE, true);
    }
  }

  void carica();
}

export const servizioPannello: ServizioPannello = { id: "vetrina", montaPannello };
